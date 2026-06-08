import { createBrowserPatchStream, createGeneratedPatchStream } from './generatedRuntime';
import type {
  GeneratedDocument,
  GenerationSessionMeta,
  LaunchIntent,
  PatchEnvelope,
  PatchOperation,
  ProviderSessionHandle,
  UiEvent,
} from './types';

export type RuntimeProvider = {
  id: string;
  source: 'mock' | 'deepseek' | 'fallback';
  start(intent: LaunchIntent, meta: GenerationSessionMeta, baseDocument?: GeneratedDocument): ProviderSession;
};

export type ProviderSession = ProviderSessionHandle;

export const mockGeneratedProvider: RuntimeProvider = {
  id: 'mock-patch-stream',
  source: 'mock',
  start(intent, meta) {
    return createQueuedProviderSession({
      id: `${meta.sessionId}-mock-provider`,
      providerId: 'mock-patch-stream',
      source: 'mock',
      streamId: `${meta.sessionId}-mock-stream`,
      envelopes: createGeneratedPatchStream(meta.sessionId, intent),
      handleEvent: (event) => createMockEventResponse(meta.sessionId, event),
    });
  },
};

export const mockBrowserProvider = {
  start(address: string, sessionId: string): PatchEnvelope[] {
    return createBrowserPatchStream(sessionId, address);
  },
};

export function createQueuedProviderSession(options: {
  id: string;
  providerId: string;
  source: RuntimeProvider['source'];
  streamId: string;
  envelopes: PatchEnvelope[];
  handleEvent?: (event: UiEvent) => PatchEnvelope[];
}): ProviderSession {
  let cancelled = false;
  let status: ProviderSession['status'] = options.envelopes.length ? 'streaming' : 'complete';

  return {
    id: options.id,
    providerId: options.providerId,
    source: options.source,
    streamId: options.streamId,
    get status() {
      return status;
    },
    poll() {
      if (cancelled || status === 'complete' || status === 'failed') return [];
      const envelope = options.envelopes.shift();
      if (!envelope) {
        status = 'complete';
        return [];
      }
      if (!options.envelopes.length) status = 'complete';
      return [envelope];
    },
    handleEvent(event) {
      if (cancelled || status === 'failed') return [];
      return options.handleEvent?.(event) ?? [];
    },
    cancel() {
      cancelled = true;
      status = 'cancelled';
      options.envelopes.length = 0;
    },
  };
}

function createMockEventResponse(sessionId: string, event: UiEvent): PatchEnvelope[] {
  const ops = mockEventOps(event);
  if (!ops.length) return [];

  return [
    {
      protocolVersion: 1,
      sessionId,
      streamId: `${sessionId}-mock-event-stream`,
      seq: event.baseRevision + 1,
      baseRevision: event.baseRevision,
      resultRevision: event.baseRevision + 1,
      kind: 'transaction',
      payload: {
        transactionId: `${sessionId}-mock-event-${event.baseRevision + 1}`,
        ops,
      },
    },
  ];
}

function mockEventOps(event: UiEvent): PatchOperation[] {
  const selected = displayValue(event.value);

  switch (event.intentId) {
    case 'complete-task':
      return [
        { op: 'setSelection', blockId: event.blockId, selection: selected },
        {
          op: 'mergeProps',
          blockId: 'detail',
          props: {
            title: 'Selected Task',
            text: `"${selected}" is now active. Mock provider handled the typed select intent and returned a patch envelope.`,
          },
        },
        { op: 'scrollIntoView', blockId: 'detail' },
        { op: 'setStatusText', text: `Mock provider selected task: ${selected}.` },
      ];
    case 'press-generated-key':
      return [
        {
          op: 'mergeProps',
          blockId: event.blockId,
          props: {
            display: selected.slice(0, 24) || '0',
            caption: `Mock provider received key "${selected}" through a typed click intent.`,
          },
        },
        { op: 'setStatusText', text: `Mock provider handled generated key "${selected}".` },
      ];
    case 'choose-mirror':
      return [
        {
          op: 'mergeProps',
          blockId: event.blockId,
          props: {
            ad: `Mock provider selected mirror: ${selected}. The transfer remains simulated.`,
          },
        },
        { op: 'setStatusText', text: `Mock provider selected mirror: ${selected}.` },
      ];
    case 'open-inner-icon':
      return [
        {
          op: 'mergeProps',
          blockId: event.blockId,
          props: {
            windows: [
              {
                title: selected,
                text: `${selected} opened inside the nested OS through a provider event envelope.`,
              },
            ],
            taskbar: ['Start', selected],
          },
        },
        { op: 'setStatusText', text: `Mock provider opened nested icon: ${selected}.` },
      ];
    case 'fallback-action':
      return mockFallbackOps(event.blockId, selected);
    case 'inspect-table-row':
      return [
        { op: 'setSelection', blockId: event.blockId, selection: selected },
        {
          op: 'mergeProps',
          blockId: 'body',
          props: {
            text: `Mock provider inspected row: ${selected}. The event was converted into a replayable patch envelope.`,
          },
        },
        { op: 'setStatusText', text: `Mock provider inspected row: ${selected}.` },
      ];
    default:
      return [];
  }
}

function mockFallbackOps(blockId: string, selected: string): PatchOperation[] {
  const action = selected.toLowerCase();
  if (action === 'continue') {
    return [
      { op: 'mergeProps', blockId, props: { text: 'Mock provider continued from the last valid fallback surface.' } },
      { op: 'setStage', stage: 'ready' },
      { op: 'setStatusText', text: 'Mock provider continued offline fallback.' },
    ];
  }

  if (action === 'regenerate') {
    return [
      {
        op: 'mergeProps',
        blockId,
        props: {
          title: 'Mock-Regenerated Fallback',
          text: 'Mock provider regenerated this fallback panel as a patch envelope.',
        },
      },
      { op: 'setStatusText', text: 'Mock provider regenerated fallback.' },
    ];
  }

  if (action === 'make more realistic') {
    return [
      {
        op: 'mergeProps',
        blockId,
        props: {
          text: 'Mock provider added realistic fallback metadata while preserving the last valid UI.',
        },
      },
      { op: 'setStatusText', text: 'Mock provider added realism details.' },
    ];
  }

  return [
    {
      op: 'mergeProps',
      blockId,
      props: {
        text: 'Mock provider prepared a retry envelope without exposing raw provider details.',
      },
    },
    { op: 'setStage', stage: 'stale' },
    { op: 'setStatusText', text: 'Mock provider retry prepared locally.' },
  ];
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

export function createAsyncProviderSession(options: {
  id: string;
  providerId: string;
  source: RuntimeProvider['source'];
  streamId: string;
  baseRevision?: number;
  request: (enqueue: (envelopes: PatchEnvelope[]) => void, signal: AbortSignal) => Promise<PatchEnvelope[] | void>;
  failureEnvelope: (message: string, baseRevision: number) => PatchEnvelope | PatchEnvelope[];
}): ProviderSession {
  let cancelled = false;
  let started = false;
  let settled = false;
  let status: ProviderSession['status'] = 'queued';
  const envelopes: PatchEnvelope[] = [];
  const abortController = new AbortController();
  let latestRevision = options.baseRevision ?? 0;

  const start = () => {
    if (started || cancelled) return;
    started = true;
    status = 'requesting';
    const enqueue = (nextEnvelopes: PatchEnvelope[]) => {
      if (cancelled || !nextEnvelopes.length) return;
      envelopes.push(...nextEnvelopes);
      latestRevision = nextEnvelopes.at(-1)?.resultRevision ?? latestRevision;
      if (status !== 'failed') status = 'streaming';
    };
    void options
      .request(enqueue, abortController.signal)
      .then((nextEnvelopes) => {
        if (cancelled) return;
        settled = true;
        if (nextEnvelopes?.length) enqueue(nextEnvelopes);
        status = envelopes.length ? 'streaming' : 'complete';
      })
      .catch((error) => {
        if (cancelled) return;
        settled = true;
        envelopes.push(
          ...asEnvelopeList(
            options.failureEnvelope(error instanceof Error ? error.message : 'provider request failed', latestRevision),
          ),
        );
        status = 'failed';
      });
  };

  return {
    id: options.id,
    providerId: options.providerId,
    source: options.source,
    streamId: options.streamId,
    get status() {
      return status;
    },
    poll() {
      start();
      const envelope = envelopes.shift();
      if (!envelope) return [];
      if (!envelopes.length && status === 'streaming') status = settled ? 'complete' : 'requesting';
      return [envelope];
    },
    pollAsync() {
      start();
    },
    cancel() {
      cancelled = true;
      abortController.abort();
      status = 'cancelled';
      envelopes.length = 0;
    },
  };
}

function asEnvelopeList(envelope: PatchEnvelope | PatchEnvelope[]) {
  return Array.isArray(envelope) ? envelope : [envelope];
}
