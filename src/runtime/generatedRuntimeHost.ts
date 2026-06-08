import { applyPatchEnvelope, createEmptyDocument } from './generatedRuntime';
import { hydrateCache, rememberCheckpoint } from './cacheHydrator';
import { cacheReplayStream } from './fallbackAdapter';
import { selectGeneratedProvider } from './providerRegistry';
import { mockGeneratedProvider, type ProviderSession } from './providers';
import { advanceGeneratedStage, type StageStepResult } from './stageScheduler';
import type {
  AppSession,
  GeneratedBlock,
  GeneratedSessionState,
  GenerationSessionMeta,
  LaunchIntent,
  PatchEnvelope,
  PatchOperation,
  ProviderRunState,
} from './types';

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
    modelState: modelStateFromProvider(provider.status, stream.length, nextPatchIndex),
    hydrationState: hydration.kind,
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
  state.modelState = modelStateFromProvider(state.provider.status, state.stream.length, state.nextPatchIndex);
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

  const providerEnvelopes = generated.providerSession?.handleEvent?.(generated.actionHistory[generated.actionHistory.length - 1]) ?? [];
  const acceptedProviderEnvelopes = applyEventEnvelopes(generated, providerEnvelopes);
  const eventEnvelopes = acceptedProviderEnvelopes.length
    ? acceptedProviderEnvelopes
    : [applyLocalEventFallback(generated, session, block, intentId, value)];
  generated.eventPatchLog.push(...eventEnvelopes);

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

function applyEventEnvelopes(generated: GeneratedSessionState, envelopes: PatchEnvelope[]) {
  const accepted: PatchEnvelope[] = [];

  for (const envelope of envelopes) {
    const nextDocument = applyPatchEnvelope(generated.document, envelope);
    if (nextDocument === generated.document) break;
    generated.document = nextDocument;
    generated.visibleDocument = nextDocument;
    generated.stagePlan.lastVisibleRevision = nextDocument.revision;
    accepted.push(envelope);
  }

  return accepted;
}

function applyLocalEventFallback(
  generated: GeneratedSessionState,
  session: AppSession | undefined,
  block: GeneratedBlock,
  intentId: string,
  value: unknown,
) {
  const ops = eventPatchOps(generated, block, intentId, value);
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
      ops,
    },
  };
  generated.document = applyPatchEnvelope(generated.document, eventEnvelope);
  generated.visibleDocument = generated.document;
  generated.stagePlan.lastVisibleRevision = generated.document.revision;
  return eventEnvelope;
}

function eventPatchOps(
  generated: GeneratedSessionState,
  block: GeneratedBlock,
  intentId: string,
  value: unknown,
): PatchOperation[] {
  switch (intentId) {
    case 'complete-task':
      return taskSelectionOps(generated, block, value);
    case 'press-generated-key':
      return calculatorKeyOps(generated, block, value);
    case 'choose-mirror':
      return [
        {
          op: 'mergeProps',
          blockId: block.id,
          props: {
            ad: `Selected mirror: ${displayValue(value)}. A fake transfer ticket was prepared and immediately cancelled.`,
          },
        },
        { op: 'setStatusText', text: `Mirror selected: ${displayValue(value)}. No file transfer occurred.` },
      ];
    case 'open-inner-icon':
      return nestedIconOps(block, value);
    case 'fallback-action':
      return fallbackActionOps(block, value);
    case 'inspect-table-row':
      return tableRowOps(generated, block, value);
    default:
      return genericEventOps(generated, block, intentId, value);
  }
}

function taskSelectionOps(generated: GeneratedSessionState, block: GeneratedBlock, value: unknown): PatchOperation[] {
  const selected = displayValue(value);
  const itemId = findItemIdByTitle(block.props.items, selected);
  const ops: PatchOperation[] = [];

  if (itemId) {
    ops.push({ op: 'updateItem', blockId: block.id, itemId, patch: { meta: 'Selected just now' } });
  }

  if (generated.document.blocks.detail) {
    ops.push(
      {
        op: 'mergeProps',
        blockId: 'detail',
        props: {
          title: 'Selected Task',
          text: `"${selected}" is now the active simulated task. The local event router patched this detail pane without executing model code.`,
        },
      },
      { op: 'scrollIntoView', blockId: 'detail' },
    );
  }

  ops.push(
    { op: 'setSelection', blockId: block.id, selection: selected },
    { op: 'setStatusText', text: `Selected task: ${selected}.` },
  );

  return ops;
}

function calculatorKeyOps(generated: GeneratedSessionState, block: GeneratedBlock, value: unknown): PatchOperation[] {
  const key = displayValue(value);
  const display = nextGeneratedCalculatorDisplay(String(block.props.display ?? '0'), key);
  const ops: PatchOperation[] = [
    {
      op: 'mergeProps',
      blockId: block.id,
      props: {
        display,
        caption: `Last generated key: ${key}. This is the hallucinated calculator, not the local Calculator.`,
      },
    },
  ];

  if (generated.document.blocks.remark) {
    ops.push({
      op: 'mergeProps',
      blockId: 'remark',
      props: {
        text: `Status: accepted "${key}" with unnecessary confidence. Display now reads ${display}.`,
      },
    });
  }

  ops.push({ op: 'setStatusText', text: `Generated calculator key "${key}" patched locally.` });
  return ops;
}

function nestedIconOps(block: GeneratedBlock, value: unknown): PatchOperation[] {
  const selected = displayValue(value);
  const windows = recordArray(block.props.windows)
    .filter((windowValue) => windowValue.title !== selected)
    .slice(-5);
  const taskbar = [...stringArray(block.props.taskbar).filter((item) => item !== selected), selected].slice(-16);

  return [
    {
      op: 'mergeProps',
      blockId: block.id,
      props: {
        windows: [
          ...windows,
          {
            title: selected,
            text: `${selected} opened inside the nested desktop as another simulated block window.`,
          },
        ],
        taskbar,
      },
    },
    { op: 'setStatusText', text: `Nested OS opened "${selected}" locally.` },
  ];
}

function fallbackActionOps(block: GeneratedBlock, value: unknown): PatchOperation[] {
  const action = displayValue(value).toLowerCase();
  const label = displayValue(value);

  if (action === 'continue') {
    return [
      {
        op: 'mergeProps',
        blockId: block.id,
        props: {
          text: 'Continued from the last valid surface. Missing provider details were replaced with deterministic local placeholders.',
        },
      },
      { op: 'setStage', stage: 'ready' },
      { op: 'setStatusText', text: 'Continued offline from stale fallback.' },
    ];
  }

  if (action === 'regenerate') {
    return [
      {
        op: 'mergeProps',
        blockId: block.id,
        props: {
          title: 'Regenerated Offline Fallback',
          text: 'A fresh deterministic fallback panel replaced the failed provider tail without discarding the last valid UI.',
        },
      },
      { op: 'setStatusText', text: 'Regenerated fallback surface locally.' },
    ];
  }

  if (action === 'make more realistic') {
    return [
      {
        op: 'mergeProps',
        blockId: block.id,
        props: {
          text: 'Added realistic recovery detail: cached revision kept, provider hidden, retry budget reset, and offline simulation badge preserved.',
        },
      },
      { op: 'setStatusText', text: 'Added low-risk realism details to fallback.' },
    ];
  }

  return [
    {
      op: 'mergeProps',
      blockId: block.id,
      props: {
        text: `Retry stayed local. The runtime would request a new patch stream while preserving this last valid staged surface.`,
      },
    },
    { op: 'setStage', stage: 'stale' },
    { op: 'setStatusText', text: `${label} prepared locally; raw provider errors remain hidden.` },
  ];
}

function tableRowOps(generated: GeneratedSessionState, block: GeneratedBlock, value: unknown): PatchOperation[] {
  const selected = displayValue(value);
  const targetBlockId = generated.document.blocks.body ? 'body' : block.id;
  return [
    { op: 'setSelection', blockId: block.id, selection: selected },
    {
      op: 'mergeProps',
      blockId: targetBlockId,
      props: {
        text: `Selected row: ${selected}. The detail surface changed through a typed select intent and a validated patch transaction.`,
      },
    },
    { op: 'setStatusText', text: `Selected generated table row: ${selected}.` },
  ];
}

function genericEventOps(
  generated: GeneratedSessionState,
  block: GeneratedBlock,
  intentId: string,
  value: unknown,
): PatchOperation[] {
  const selected = displayValue(value);
  const targetBlockId = block.id === 'tasks' && generated.document.blocks.detail ? 'detail' : block.id;

  return [
    {
      op: 'mergeProps',
      blockId: targetBlockId,
      props: {
        text: `Handled event intent ${intentId} for ${selected}. The model registered the intent; the local runtime routed it.`,
        lastEvent: intentId,
      },
    },
    { op: 'setStatusText', text: `Handled event intent ${intentId}.` },
  ];
}

function nextGeneratedCalculatorDisplay(current: string, key: string) {
  if (/^\d$/.test(key) || key === '.') {
    return (current === '0' || current.includes('=') ? key : `${current}${key}`).slice(-24);
  }
  if (['+', '-', '*', '/'].includes(key)) {
    return `${current.replace(/\s+[+\-*/]\s*$/, '')} ${key} `.slice(-24);
  }
  if (key === '=') {
    return `${current.trim()} = ${checksum(current) % 97}`.slice(0, 24);
  }
  return key.slice(0, 24) || '0';
}

function displayValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 160);
  if (Array.isArray(value)) return value.map((item) => String(item)).join(' / ').slice(0, 160) || 'simulated row';
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const title = record.title ?? record.label ?? record.name ?? record.id;
    if (typeof title === 'string' && title.trim()) return title.trim().slice(0, 160);
  }
  return 'simulated item';
}

function findItemIdByTitle(items: unknown, title: string) {
  if (!Array.isArray(items)) return undefined;
  const item = items.find((itemValue) => {
    if (typeof itemValue !== 'object' || itemValue === null || Array.isArray(itemValue)) return false;
    return String((itemValue as Record<string, unknown>).title ?? '') === title;
  });
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return undefined;
  const id = (item as Record<string, unknown>).id;
  return typeof id === 'string' ? id : undefined;
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item));
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function checksum(value: string) {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
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
  state.modelState = modelStateFromProvider(state.provider.status, state.stream.length, state.nextPatchIndex);
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

function modelStateFromProvider(
  status: ProviderRunState['status'],
  streamLength: number,
  nextPatchIndex: number,
): GeneratedSessionState['modelState'] {
  if (status === 'queued') return 'queued';
  if (status === 'requesting') return 'requesting';
  if (status === 'failed') return nextPatchIndex < streamLength ? 'streaming' : 'failed';
  if (status === 'cancelled') return 'failed';
  if (nextPatchIndex < streamLength) return 'streaming';
  return status === 'complete' ? 'complete' : 'idle';
}
