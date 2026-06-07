import type { GenerateUiResult } from './types';

export interface AppSession {
  appSessionId: string;
  ownerWebContentsId: number;
  appName: string;
  history: Array<{ at: number; kind: 'event' | 'result'; value: unknown }>;
  currentTitle?: string;
  currentHtml?: string;
  currentState?: unknown;
  createdAt: number;
  updatedAt: number;
  nextRequestId: number;
  latestAppliedRequestId: number;
}

export class SessionStore {
  private readonly sessions = new Map<string, AppSession>();

  createSession(appName: string, ownerWebContentsId: number): AppSession {
    const now = Date.now();
    const appSessionId = crypto.randomUUID();
    const session: AppSession = {
      appSessionId,
      ownerWebContentsId,
      appName,
      history: [],
      createdAt: now,
      updatedAt: now,
      nextRequestId: 1,
      latestAppliedRequestId: 0
    };
    this.sessions.set(appSessionId, session);
    return session;
  }

  getSession(appSessionId: string): AppSession | undefined {
    return this.sessions.get(appSessionId);
  }

  assertOwnedSession(appSessionId: string, ownerWebContentsId: number): AppSession {
    const session = this.sessions.get(appSessionId);
    if (!session || session.ownerWebContentsId !== ownerWebContentsId) {
      throw new Error('App session was not found for this window.');
    }
    return session;
  }

  beginRequest(appSessionId: string): number {
    const session = this.sessions.get(appSessionId);
    if (!session) {
      throw new Error('App session was not found.');
    }
    const requestId = session.nextRequestId;
    session.nextRequestId += 1;
    return requestId;
  }

  recordEvent(appSessionId: string, value: unknown): void {
    const session = this.sessions.get(appSessionId);
    if (!session) {
      return;
    }
    session.history.push({ at: Date.now(), kind: 'event', value });
    session.history = session.history.slice(-20);
  }

  updateSession(appSessionId: string, requestId: number, result: GenerateUiResult): GenerateUiResult {
    const session = this.sessions.get(appSessionId);
    if (!session) {
      throw new Error('App session was not found.');
    }
    if (requestId < session.latestAppliedRequestId) {
      return {
        title: session.currentTitle ?? session.appName,
        html: session.currentHtml ?? '',
        state: session.currentState ?? {},
        narration: 'Ignored a stale response.'
      };
    }
    session.latestAppliedRequestId = requestId;
    session.currentTitle = result.title;
    session.currentHtml = result.html;
    session.currentState = result.state;
    session.updatedAt = Date.now();
    session.history.push({ at: session.updatedAt, kind: 'result', value: result });
    session.history = session.history.slice(-20);
    return result;
  }

  hydrateSession(appSessionId: string, result: GenerateUiResult): GenerateUiResult {
    const session = this.sessions.get(appSessionId);
    if (!session) {
      throw new Error('App session was not found.');
    }
    session.latestAppliedRequestId = Math.max(session.latestAppliedRequestId, 1);
    session.currentTitle = result.title;
    session.currentHtml = result.html;
    session.currentState = result.state;
    session.updatedAt = Date.now();
    session.history.push({ at: session.updatedAt, kind: 'result', value: result });
    session.history = session.history.slice(-20);
    return result;
  }

  closeSession(appSessionId: string, ownerWebContentsId?: number): boolean {
    const session = this.sessions.get(appSessionId);
    if (!session) {
      return false;
    }
    if (ownerWebContentsId !== undefined && session.ownerWebContentsId !== ownerWebContentsId) {
      return false;
    }
    return this.sessions.delete(appSessionId);
  }

  closeSessionsForWebContents(ownerWebContentsId: number): void {
    for (const session of this.sessions.values()) {
      if (session.ownerWebContentsId === ownerWebContentsId) {
        this.sessions.delete(session.appSessionId);
      }
    }
  }
}
