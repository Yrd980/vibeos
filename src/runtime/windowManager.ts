import type { AppSession, LaunchIntent, Rect, WindowState } from './types';

export type WindowStore = {
  windows: Record<string, WindowState>;
  sessions: Record<string, AppSession>;
  nextZIndex: number;
  now: number;
};

export function defaultWindowRect(intent: LaunchIntent, windowCount: number): Rect {
  const wide = intent.kind === 'browser-page' || intent.rawQuery.toLowerCase().includes('encarta');
  return {
    x: 76 + windowCount * 24,
    y: 54 + windowCount * 22,
    width: wide ? 840 : 620,
    height: wide ? 560 : 430,
  };
}

export function titleForWindow(intent: LaunchIntent) {
  if (intent.kind === 'browser-page') return `Internet Explorer - ${intent.title}`;
  return intent.title;
}

export function blurWindows(store: WindowStore) {
  for (const windowState of Object.values(store.windows)) {
    windowState.focusState = 'blurred';
  }
}

export function focusWindow(store: WindowStore, windowId: string) {
  const windowState = store.windows[windowId];
  if (!windowState) return;

  blurWindows(store);
  windowState.focusState = 'focused';
  windowState.mode = windowState.mode === 'minimized' ? 'normal' : windowState.mode;
  windowState.zIndex = store.nextZIndex++;

  const session = store.sessions[windowState.sessionId];
  if (session) session.lastActiveAt = store.now;
}

export function setWindowMode(store: WindowStore, windowId: string, mode: WindowState['mode']) {
  const windowState = store.windows[windowId];
  if (!windowState) return;
  windowState.mode = mode;
  if (mode !== 'minimized') focusWindow(store, windowId);
}

export function maximizeWindow(store: WindowStore, windowId: string) {
  const windowState = store.windows[windowId];
  if (!windowState || windowState.mode === 'maximized') return;
  windowState.restoreRect = { ...windowState.rect };
  windowState.mode = 'maximized';
  focusWindow(store, windowId);
}

export function restoreWindow(store: WindowStore, windowId: string) {
  const windowState = store.windows[windowId];
  if (!windowState) return;
  if (windowState.mode === 'maximized' && windowState.restoreRect) {
    windowState.rect = windowState.restoreRect;
  }
  windowState.mode = 'normal';
  focusWindow(store, windowId);
}

export function moveWindow(store: WindowStore, windowId: string, x: number, y: number) {
  const windowState = store.windows[windowId];
  if (!windowState || windowState.mode !== 'normal') return;
  windowState.rect = { ...windowState.rect, x: Math.max(0, x), y: Math.max(0, y) };
}

export function resizeWindow(store: WindowStore, windowId: string, rect: Rect) {
  const windowState = store.windows[windowId];
  if (!windowState || windowState.mode !== 'normal') return;
  windowState.rect = {
    x: Math.max(0, rect.x),
    y: Math.max(0, rect.y),
    width: Math.max(320, rect.width),
    height: Math.max(220, rect.height),
  };
}

export function toggleTaskbarWindow(store: WindowStore, windowId: string) {
  const windowState = store.windows[windowId];
  if (!windowState) return;
  if (windowState.mode === 'minimized') {
    restoreWindow(store, windowId);
  } else if (windowState.focusState === 'focused') {
    windowState.mode = 'minimized';
    windowState.focusState = 'blurred';
  } else {
    focusWindow(store, windowId);
  }
}

export function syncWindowFromDocument(store: WindowStore, sessionId: string, title: string, iconToken: string) {
  const session = store.sessions[sessionId];
  if (!session) return;

  for (const windowId of session.windowIds) {
    const windowState = store.windows[windowId];
    if (windowState) {
      windowState.title = title;
      windowState.iconToken = iconToken;
    }
  }
}
