import type { AppSession, LaunchIntent } from './types';
import type { RuntimeBinding } from './runtimeRegistry';

export type SessionStore = {
  sessions: Record<string, AppSession>;
  now: number;
};

export function createSession(
  store: SessionStore,
  options: {
    sessionId: string;
    windowId: string;
    intent: LaunchIntent;
    runtimeBinding: RuntimeBinding;
    hydrationState: AppSession['hydrationState'];
  },
) {
  const session: AppSession = {
    id: options.sessionId,
    kind: options.runtimeBinding.sessionKind,
    intent: options.intent,
    runtimeId: options.runtimeBinding.runtimeId,
    lifecycle: options.hydrationState === 'hit' ? 'hydrating' : 'booting',
    createdAt: store.now,
    lastActiveAt: store.now,
    windowIds: [options.windowId],
    hydrationState: options.hydrationState,
  };

  store.sessions[session.id] = session;
  return session;
}

export function markSessionActive(store: SessionStore, sessionId: string) {
  const session = store.sessions[sessionId];
  if (session) session.lastActiveAt = store.now;
}

export function markSessionRunning(store: SessionStore, sessionId: string) {
  const session = store.sessions[sessionId];
  if (!session || session.lifecycle === 'closed') return;
  session.lifecycle = 'running';
  session.lastActiveAt = store.now;
}

export function closeSessionWindow(store: SessionStore, sessionId: string, windowId: string) {
  const session = store.sessions[sessionId];
  if (!session) return;

  session.lifecycle = 'closed';
  session.windowIds = session.windowIds.filter((id) => id !== windowId);
}
