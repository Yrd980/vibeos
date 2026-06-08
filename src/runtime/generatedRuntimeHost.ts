import { applyPatchEnvelope, createEmptyDocument } from './generatedRuntime';
import { hydrateCache, rememberCheckpoint } from './cacheHydrator';
import { cacheReplayStream } from './fallbackAdapter';
import { selectGeneratedProvider } from './providerRegistry';
import { mockGeneratedProvider, type ProviderSession } from './providers';
import { advanceGeneratedStage, type StageStepResult } from './stageScheduler';
import type { AppSession, GeneratedSessionState, GenerationSessionMeta, LaunchIntent, PatchEnvelope, ProviderRunState } from './types';

export function createGeneratedRuntimeState(sessionId: string, intent: LaunchIntent): GeneratedSessionState {
  let document = createEmptyDocument(`generated-${sessionId}`, intent.title);
  let stream = [];
  let nextPatchIndex = 0;
  const hydration = hydrateCache(intent);
  const meta = createGenerationMeta(sessionId, intent, document.revision);
  let providerSession: ProviderSession | undefined;
  let provider: ProviderRunState = {
    providerId: 'mock-patch-stream',
    source: 'mock',
    streamId: `${sessionId}-mock-stream`,
    status: 'streaming',
  };

  if (
    hydration.kind === 'hit' ||
    hydration.kind === 'partial' ||
    (hydration.kind === 'stale' && intent.generationMode === 'cached')
  ) {
    document = {
      ...hydration.snapshot,
      documentId: `generated-${sessionId}`,
    };
    stream = cacheReplayStream(
      sessionId,
      document.revision,
      hydration.kind === 'hit'
        ? 'Restored from cache. Short replay complete.'
        : hydration.kind === 'partial'
          ? `Restored partial cache through revision ${document.revision}. Resuming offline construction.`
          : `Restored stale cache: ${hydration.reason}.`,
      hydration.kind === 'stale',
    );
    provider = {
      providerId: 'cache-hydrator',
      source: 'cache',
      streamId: `${sessionId}-cache-replay`,
      status: stream.length ? 'streaming' : 'complete',
    };
    if (hydration.kind === 'partial') {
      providerSession = mockGeneratedProvider.start(intent, createGenerationMeta(sessionId, intent, document.revision));
      provider = {
        ...provider,
        status: 'streaming',
      };
    }
  } else if (intent.generationMode === 'cached') {
    providerSession = selectGeneratedProvider().start(intent, meta);
    stream = providerSession.poll();
    provider = providerStateFromSession(providerSession);
    while (nextPatchIndex < Math.min(2, stream.length)) {
      document = applyPatchEnvelope(document, stream[nextPatchIndex]);
      nextPatchIndex += 1;
    }
  } else {
    providerSession = selectGeneratedProvider().start(intent, meta);
    stream = providerSession.poll();
    provider = providerStateFromSession(providerSession);
  }

  return {
    prompt: intent.prompt,
    generationId: `${sessionId}-generation`,
    modelState: nextPatchIndex >= stream.length ? 'complete' : 'streaming',
    document,
    visibleDocument: document,
    stagePlan: {
      mode:
        hydration.kind === 'hit' || (hydration.kind === 'stale' && intent.generationMode === 'cached')
          ? 'cache-replay'
          : intent.rawQuery.toLowerCase().includes('fail') || intent.rawQuery.toLowerCase().includes('provider error')
            ? 'fallback'
            : 'stream',
      startedAt: Date.now(),
      lastVisibleRevision: document.revision,
    },
    provider,
    providerSession,
    actionHistory: hydration.kind === 'miss' ? [] : hydration.eventLog,
    cacheKey: intent.seed,
    stream,
    eventPatchLog: hydration.kind === 'miss' ? [] : hydration.eventPatchLog,
    nextPatchIndex,
  };
}

export function tickGeneratedRuntime(state: GeneratedSessionState | undefined, session?: AppSession): StageStepResult {
  if (!state) return { advanced: false };
  fillStreamFromProvider(state);

  const result = advanceGeneratedStage(state);
  state.provider.status = state.providerSession?.status ?? state.provider.status;
  if (result.advanced && session && state.document.stage === 'ready') {
    rememberCheckpoint(
      session.intent,
      state.document,
      [...state.stream.slice(0, state.nextPatchIndex), ...state.eventPatchLog],
      state.actionHistory,
      state.eventPatchLog,
    );
  }

  return result;
}

export function handleGeneratedUiEvent(
  generated: GeneratedSessionState | undefined,
  session: AppSession | undefined,
  blockId: string,
  intentId: string,
  eventType: string,
  baseRevision: number,
  value: unknown,
) {
  if (!generated) return;

  const block = generated.document.blocks[blockId];
  const intent = generated.document.eventIntents[intentId];
  if (!block || !intent) return;
  if (intent.blockId !== blockId) return;
  if (intent.eventType !== eventType) return;
  if (baseRevision !== generated.document.revision) return;

  generated.actionHistory.push({
      sessionId: session?.id ?? '',
      baseRevision: generated.document.revision,
    blockId,
    intentId,
    eventType: intent.eventType,
    value,
  });

  const selected = typeof value === 'string' ? value : 'simulated item';
  const eventEnvelope: PatchEnvelope = {
    protocolVersion: 1,
    sessionId: session?.id ?? '',
    streamId: `${session?.id ?? 'session'}-interaction`,
    seq: generated.document.revision + 1,
    baseRevision: generated.document.revision,
    resultRevision: generated.document.revision + 1,
    kind: 'transaction',
    payload: {
      transactionId: `${session?.id ?? 'session'}-event-${generated.actionHistory.length}`,
      ops: [
        {
          op: 'mergeProps',
          blockId: blockId === 'tasks' && generated.document.blocks.detail ? 'detail' : blockId,
          props: {
            text: `Handled "${intent.description}" for ${selected}. The model registered the intent; the local runtime routed it.`,
            lastEvent: intentId,
          },
        },
        { op: 'setStatusText', text: `Handled event intent ${intentId}.` },
      ],
    },
  };
  generated.document = applyPatchEnvelope(generated.document, eventEnvelope);
  generated.visibleDocument = generated.document;
  generated.eventPatchLog.push(eventEnvelope);

  if (session) {
    rememberCheckpoint(
      session.intent,
      generated.document,
      [...generated.stream.slice(0, generated.nextPatchIndex), ...generated.eventPatchLog],
      generated.actionHistory,
      generated.eventPatchLog,
    );
  }
}

function fillStreamFromProvider(state: GeneratedSessionState) {
  if (!state.providerSession) return;
  if (state.nextPatchIndex < state.stream.length) return;

  state.providerSession.pollAsync?.();
  const rawEnvelopes = state.providerSession.poll();
  const envelopes =
    state.providerSession.source === 'mock' || state.providerSession.source === 'fallback'
      ? rebaseProviderEnvelopes(rawEnvelopes, state.document.revision)
      : rawEnvelopes.filter((envelope) => envelope.baseRevision === state.document.revision);
  if (envelopes.length) state.stream.push(...envelopes);
  state.provider.status = state.providerSession.status;
}

function rebaseProviderEnvelopes(envelopes: ReturnType<ProviderSession['poll']>, baseRevision: number) {
  return envelopes.map((envelope, index) => ({
    ...envelope,
    seq: baseRevision + index + 1,
    baseRevision: baseRevision + index,
    resultRevision: baseRevision + index + 1,
  }));
}

function createGenerationMeta(sessionId: string, intent: LaunchIntent, baseRevision: number): GenerationSessionMeta {
  return {
    sessionId,
    prompt: intent.prompt,
    kind:
      intent.kind === 'nested-os'
        ? 'nested-os'
        : intent.kind === 'file-like'
          ? 'document'
          : intent.kind === 'system-tool'
            ? 'utility'
            : 'generated-app',
    cacheKey: intent.seed,
    baseRevision,
    viewportHints: {
      width: 840,
      height: 560,
      colorDepth: 8,
    },
    locale: globalThis.navigator?.language || 'en-US',
    safetyMode: 'offline-simulated',
  };
}

function providerStateFromSession(session: ProviderSession): ProviderRunState {
  return {
    providerId: session.providerId,
    source: session.source,
    streamId: session.streamId,
    status: session.status,
  };
}
