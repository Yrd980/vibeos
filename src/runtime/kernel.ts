import {
  createBrowserRuntimeState,
  goBrowserHistory as goBrowserHistoryRuntime,
  navigateBrowserRuntime,
  refreshBrowserRuntime,
  setBrowserAddressDraft as setBrowserRuntimeAddressDraft,
  stopBrowserRuntime,
  tickBrowserRuntime,
} from './browserRuntimeHost';
import { routeKernelEvent } from './eventRouter';
import {
  createGeneratedRuntimeState,
  handleGeneratedUiEvent as handleGeneratedRuntimeUiEvent,
  tickGeneratedRuntime,
} from './generatedRuntimeHost';
import { createLaunchIntent, resolveSearchResults } from './intentResolver';
import {
  changeLocalNotepad,
  createLocalRuntimeState,
  pressLocalCalculator,
} from './localRuntimeHost';
import { resolveRuntimeBinding } from './runtimeRegistry';
import { closeSessionWindow, createSession, markSessionActive, markSessionRunning } from './sessionManager';
import {
  applySemanticSuggestions as applyShellSemanticSuggestions,
  moveSearchSelection as moveShellSearchSelection,
  rememberIntent as rememberShellIntent,
  setSearchQuery as setShellSearchQuery,
} from './shellRuntime';
import { advanceBrowserStage, advanceGeneratedStage } from './stageScheduler';
import type {
  AppSession,
  BrowserState,
  GeneratedSessionState,
  KernelEvent,
  LaunchIntent,
  LocalAppState,
  RuntimeSnapshot,
  SearchResult,
  ShellState,
  WindowState,
} from './types';
import {
  blurWindows,
  defaultWindowRect,
  focusWindow as focusManagedWindow,
  maximizeWindow as maximizeManagedWindow,
  moveWindow as moveManagedWindow,
  resizeWindow as resizeManagedWindow,
  restoreWindow as restoreManagedWindow,
  setWindowMode as setManagedWindowMode,
  syncWindowFromDocument as syncManagedWindowFromDocument,
  titleForWindow,
  toggleTaskbarWindow as toggleManagedTaskbarWindow,
} from './windowManager';

type KernelState = {
  now: number;
  shell: ShellState;
  windows: Record<string, WindowState>;
  sessions: Record<string, AppSession>;
  localApps: Record<string, LocalAppState>;
  browserApps: Record<string, BrowserState>;
  generatedApps: Record<string, GeneratedSessionState>;
  nextZIndex: number;
  counters: Record<string, number>;
};

export class RuntimeKernel {
  private state: KernelState;
  private listeners = new Set<() => void>();
  private snapshotCache: RuntimeSnapshot;

  constructor() {
    const recentIntents: LaunchIntent[] = [];
    const shell: ShellState = {
      startMenuOpen: false,
      appSearchOpen: true,
      searchQuery: '',
      searchResults: resolveSearchResults('', recentIntents),
      selectedSearchIndex: 0,
      semanticSuggestions: [],
      semanticStatus: 'idle',
      semanticRequestId: 0,
      recentIntents,
    };

    this.state = {
      now: Date.now(),
      shell,
      windows: {},
      sessions: {},
      localApps: {},
      browserApps: {},
      generatedApps: {},
      nextZIndex: 10,
      counters: {},
    };
    this.snapshotCache = this.projectSnapshot();
  }

  dispatch(event: KernelEvent): void {
    this.state.now = Date.now();

    routeKernelEvent(event, {
      toggleStart: () => {
        this.state.shell.startMenuOpen = !this.state.shell.startMenuOpen;
        if (this.state.shell.startMenuOpen) this.state.shell.appSearchOpen = true;
      },
      openSearch: () => {
        this.state.shell.appSearchOpen = true;
        this.state.shell.startMenuOpen = true;
      },
      closeSearch: () => this.closeSearch(),
      setSearchQuery: (query) => this.setSearchQuery(query),
      applySemanticSuggestions: (semanticEvent) =>
        this.applySemanticSuggestions(semanticEvent.requestId, semanticEvent.query, semanticEvent.results),
      moveSearchSelection: (delta) => this.moveSearchSelection(delta),
      launchSelectedSearch: () => this.launchSelectedSearch(),
      launchRawSearch: () =>
        this.launchIntent(createLaunchIntent(this.state.shell.searchQuery, { source: 'search', forceGenerated: true })),
      launchIntent: (launchEvent) => this.launchIntent(launchEvent.intent),
      focusWindow: (windowId) => this.focusWindow(windowId),
      minimizeWindow: (windowId) => this.setWindowMode(windowId, 'minimized'),
      maximizeWindow: (windowId) => this.maximizeWindow(windowId),
      restoreWindow: (windowId) => this.restoreWindow(windowId),
      closeWindow: (windowId) => this.closeWindow(windowId),
      moveWindow: (moveEvent) => this.moveWindow(moveEvent.windowId, moveEvent.x, moveEvent.y),
      resizeWindow: (resizeEvent) => this.resizeWindow(resizeEvent.windowId, resizeEvent.rect),
      toggleTaskbarWindow: (windowId) => this.toggleTaskbarWindow(windowId),
      pressCalculator: (calculatorEvent) =>
        pressLocalCalculator(this.state.localApps[calculatorEvent.sessionId], calculatorEvent.key),
      changeNotepad: (notepadEvent) =>
        changeLocalNotepad(this.state.localApps[notepadEvent.sessionId], notepadEvent.text),
      setBrowserAddressDraft: (browserEvent) =>
        setBrowserRuntimeAddressDraft(this.state.browserApps[browserEvent.sessionId], browserEvent.value),
      navigateBrowser: (browserEvent) => this.navigateBrowser(browserEvent.sessionId, browserEvent.address),
      browserBack: (sessionId) => this.goBrowserHistory(sessionId, -1),
      browserForward: (sessionId) => this.goBrowserHistory(sessionId, 1),
      browserRefresh: (sessionId) => this.refreshBrowser(sessionId),
      browserStop: (sessionId) => stopBrowserRuntime(this.state.browserApps[sessionId], sessionId),
      tickRuntimes: () => this.tickRuntimes(),
      tickGenerated: (sessionId) => this.tickGenerated(sessionId),
      generatedUiEvent: (uiEvent) =>
        handleGeneratedRuntimeUiEvent(
          this.state.generatedApps[uiEvent.event.sessionId],
          this.state.sessions[uiEvent.event.sessionId],
          uiEvent.event.blockId,
          uiEvent.event.intentId,
          uiEvent.event.eventType,
          uiEvent.event.baseRevision,
          uiEvent.event.value,
        ),
    });

    this.publish();
  }

  snapshot(): RuntimeSnapshot {
    return this.snapshotCache;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private publish() {
    this.snapshotCache = this.projectSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }

  private projectSnapshot(): RuntimeSnapshot {
    return {
      now: this.state.now,
      shell: {
        ...this.state.shell,
        searchResults: [...this.state.shell.searchResults],
        recentIntents: [...this.state.shell.recentIntents],
      },
      windows: Object.values(this.state.windows).sort((left, right) => left.zIndex - right.zIndex),
      sessions: { ...this.state.sessions },
      localApps: { ...this.state.localApps },
      browserApps: { ...this.state.browserApps },
      generatedApps: { ...this.state.generatedApps },
    };
  }

  private setSearchQuery(query: string) {
    setShellSearchQuery(this.state.shell, query, (requestId, scheduledQuery, results) => {
      this.dispatch({
        type: 'shell.semanticSuggestionsReady',
        requestId,
        query: scheduledQuery,
        results,
      });
    });
  }

  private applySemanticSuggestions(requestId: number, query: string, results: SearchResult[]) {
    applyShellSemanticSuggestions(this.state.shell, requestId, query, results);
  }

  private closeSearch() {
    if (this.state.shell.searchQuery) {
      this.setSearchQuery('');
    } else {
      this.state.shell.appSearchOpen = false;
      this.state.shell.startMenuOpen = false;
    }
  }

  private moveSearchSelection(delta: number) {
    moveShellSearchSelection(this.state.shell, delta);
  }

  private launchSelectedSearch() {
    const result = this.state.shell.searchResults[this.state.shell.selectedSearchIndex];
    if (result) {
      this.launchIntent(result.intent);
    }
  }

  private launchIntent(intent: LaunchIntent) {
    const sessionId = this.nextId('session');
    const windowId = this.nextId('window');
    const runtimeBinding = resolveRuntimeBinding(intent);
    const rect = defaultWindowRect(intent, Object.keys(this.state.windows).length);
    const title = titleForWindow(intent);

    blurWindows(this.state);

    createSession(this.state, {
      sessionId,
      windowId,
      intent,
      runtimeBinding,
      hydrationState: intent.generationMode === 'cached' ? 'hit' : 'miss',
    });

    this.state.windows[windowId] = {
      id: windowId,
      sessionId,
      title,
      iconToken: intent.iconHint,
      chromeKind: runtimeBinding.chromeKind,
      rect,
      zIndex: this.state.nextZIndex++,
      mode: 'normal',
      focusState: 'focused',
      interaction: 'idle',
    };

    if (intent.kind === 'local-app') {
      this.state.localApps[sessionId] = createLocalRuntimeState(intent);
    } else if (intent.kind === 'browser-page') {
      const address = intent.browserAddress ?? intent.rawQuery;
      this.state.browserApps[sessionId] = createBrowserRuntimeState(
        sessionId,
        address,
        intent.generationMode === 'cached',
        () => this.nextId('document'),
      );
    } else {
      this.state.generatedApps[sessionId] = createGeneratedRuntimeState(sessionId, intent);
    }

    markSessionRunning(this.state, sessionId);
    rememberShellIntent(this.state.shell, intent);
    this.state.shell.startMenuOpen = false;
    this.state.shell.appSearchOpen = false;
  }

  private tickRuntimes() {
    for (const sessionId of Object.keys(this.state.generatedApps)) {
      this.tickGenerated(sessionId);
    }
    for (const sessionId of Object.keys(this.state.browserApps)) {
      this.tickBrowser(sessionId);
    }
  }

  private tickGenerated(sessionId: string) {
    const session = this.state.sessions[sessionId];
    const result = tickGeneratedRuntime(this.state.generatedApps[sessionId], session);
    if (result.title && result.iconToken) {
      this.syncWindowFromDocument(sessionId, result.title, result.iconToken);
    }
  }

  private tickBrowser(sessionId: string) {
    const browser = this.state.browserApps[sessionId];
    if (!browser || browser.nextPatchIndex >= browser.stream.length) return;

    const result = tickBrowserRuntime(browser);
    if (result.title && result.iconToken) {
      this.syncWindowFromDocument(sessionId, result.title, result.iconToken);
    }
  }

  private navigateBrowser(sessionId: string, address: string) {
    const result = navigateBrowserRuntime(this.state.browserApps[sessionId], sessionId, address, () => this.nextId('document'));
    if (result.title && result.iconToken) this.syncWindowFromDocument(sessionId, result.title, result.iconToken);
  }

  private goBrowserHistory(sessionId: string, delta: number) {
    const result = goBrowserHistoryRuntime(this.state.browserApps[sessionId], delta);
    if (result.title && result.iconToken) this.syncWindowFromDocument(sessionId, result.title, result.iconToken);
  }

  private refreshBrowser(sessionId: string) {
    const result = refreshBrowserRuntime(this.state.browserApps[sessionId], sessionId, () => this.nextId('document'));
    if (result.title && result.iconToken) this.syncWindowFromDocument(sessionId, result.title, result.iconToken);
  }

  private focusWindow(windowId: string) {
    focusManagedWindow(this.state, windowId);
    const windowState = this.state.windows[windowId];
    if (windowState) markSessionActive(this.state, windowState.sessionId);
  }

  private setWindowMode(windowId: string, mode: 'normal' | 'minimized' | 'maximized') {
    setManagedWindowMode(this.state, windowId, mode);
  }

  private maximizeWindow(windowId: string) {
    maximizeManagedWindow(this.state, windowId);
  }

  private restoreWindow(windowId: string) {
    restoreManagedWindow(this.state, windowId);
  }

  private closeWindow(windowId: string) {
    const windowState = this.state.windows[windowId];
    if (!windowState) return;

    closeSessionWindow(this.state, windowState.sessionId, windowId);

    delete this.state.localApps[windowState.sessionId];
    delete this.state.browserApps[windowState.sessionId];
    delete this.state.generatedApps[windowState.sessionId];
    delete this.state.windows[windowId];
  }

  private moveWindow(windowId: string, x: number, y: number) {
    moveManagedWindow(this.state, windowId, x, y);
  }

  private resizeWindow(windowId: string, rect: { x: number; y: number; width: number; height: number }) {
    resizeManagedWindow(this.state, windowId, rect);
  }

  private toggleTaskbarWindow(windowId: string) {
    toggleManagedTaskbarWindow(this.state, windowId);
  }

  private syncWindowFromDocument(sessionId: string, title: string, iconToken: string) {
    syncManagedWindowFromDocument(this.state, sessionId, title, iconToken);
  }

  private nextId(prefix: string) {
    this.state.counters[prefix] = (this.state.counters[prefix] ?? 0) + 1;
    return `${prefix}-${this.state.counters[prefix]}`;
  }
}
