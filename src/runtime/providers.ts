import { createBrowserPatchStream, createGeneratedPatchStream } from './generatedRuntime';
import type { GenerationSessionMeta, LaunchIntent, PatchEnvelope, ProviderSessionHandle, UiEvent } from './types';

export type RuntimeProvider = {
  id: string;
  source: 'mock' | 'deepseek' | 'fallback';
  start(intent: LaunchIntent, meta: GenerationSessionMeta): ProviderSession;
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
    cancel() {
      cancelled = true;
      status = 'cancelled';
      options.envelopes.length = 0;
    },
  };
}

export function createAsyncProviderSession(options: {
  id: string;
  providerId: string;
  source: RuntimeProvider['source'];
  streamId: string;
  request: () => Promise<PatchEnvelope[]>;
  failureEnvelope: (message: string) => PatchEnvelope;
}): ProviderSession {
  let cancelled = false;
  let started = false;
  let status: ProviderSession['status'] = 'queued';
  const envelopes: PatchEnvelope[] = [];

  const start = () => {
    if (started || cancelled) return;
    started = true;
    status = 'requesting';
    void options
      .request()
      .then((nextEnvelopes) => {
        if (cancelled) return;
        envelopes.push(...nextEnvelopes);
        status = envelopes.length ? 'streaming' : 'complete';
      })
      .catch((error) => {
        if (cancelled) return;
        envelopes.push(options.failureEnvelope(error instanceof Error ? error.message : 'provider request failed'));
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
      if (!envelopes.length && status === 'streaming') status = 'complete';
      return [envelope];
    },
    pollAsync() {
      start();
    },
    cancel() {
      cancelled = true;
      status = 'cancelled';
      envelopes.length = 0;
    },
  };
}
