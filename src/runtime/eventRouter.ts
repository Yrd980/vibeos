import type { KernelEvent } from './types';

export type KernelEventHandlers = {
  toggleStart(): void;
  openSearch(): void;
  closeSearch(): void;
  setSearchQuery(query: string): void;
  selectDesktopIcon(iconId: string): void;
  markSemanticResolving(event: Extract<KernelEvent, { type: 'shell.semanticSuggestionsResolving' }>): void;
  applySemanticSuggestions(event: Extract<KernelEvent, { type: 'shell.semanticSuggestionsReady' }>): void;
  moveSearchSelection(delta: number): void;
  launchSelectedSearch(): void;
  launchRawSearch(): void;
  launchIntent(event: Extract<KernelEvent, { type: 'shell.launchIntent' }>): void;
  focusWindow(windowId: string): void;
  minimizeWindow(windowId: string): void;
  maximizeWindow(windowId: string): void;
  restoreWindow(windowId: string): void;
  closeWindow(windowId: string): void;
  moveWindow(event: Extract<KernelEvent, { type: 'window.move' }>): void;
  resizeWindow(event: Extract<KernelEvent, { type: 'window.resize' }>): void;
  toggleTaskbarWindow(windowId: string): void;
  pressCalculator(event: Extract<KernelEvent, { type: 'local.calculatorPress' }>): void;
  changeNotepad(event: Extract<KernelEvent, { type: 'local.notepadChange' }>): void;
  setBrowserAddressDraft(event: Extract<KernelEvent, { type: 'browser.setAddressDraft' }>): void;
  navigateBrowser(event: Extract<KernelEvent, { type: 'browser.navigate' }>): void;
  browserBack(sessionId: string): void;
  browserForward(sessionId: string): void;
  browserRefresh(sessionId: string): void;
  browserStop(sessionId: string): void;
  browserToggleFavorites(sessionId: string): void;
  browserAddFavorite(sessionId: string): void;
  tickRuntimes(): void;
  tickGenerated(sessionId: string): void;
  generatedUiEvent(event: Extract<KernelEvent, { type: 'generated.uiEvent' }>): void;
};

export function routeKernelEvent(event: KernelEvent, handlers: KernelEventHandlers) {
  switch (event.type) {
    case 'shell.toggleStart':
      handlers.toggleStart();
      break;
    case 'shell.openSearch':
      handlers.openSearch();
      break;
    case 'shell.closeSearch':
      handlers.closeSearch();
      break;
    case 'shell.setSearchQuery':
      handlers.setSearchQuery(event.query);
      break;
    case 'shell.selectDesktopIcon':
      handlers.selectDesktopIcon(event.iconId);
      break;
    case 'shell.semanticSuggestionsResolving':
      handlers.markSemanticResolving(event);
      break;
    case 'shell.semanticSuggestionsReady':
      handlers.applySemanticSuggestions(event);
      break;
    case 'shell.moveSearchSelection':
      handlers.moveSearchSelection(event.delta);
      break;
    case 'shell.launchSelectedSearch':
      handlers.launchSelectedSearch();
      break;
    case 'shell.launchRawSearch':
      handlers.launchRawSearch();
      break;
    case 'shell.launchIntent':
      handlers.launchIntent(event);
      break;
    case 'window.focus':
      handlers.focusWindow(event.windowId);
      break;
    case 'window.minimize':
      handlers.minimizeWindow(event.windowId);
      break;
    case 'window.maximize':
      handlers.maximizeWindow(event.windowId);
      break;
    case 'window.restore':
      handlers.restoreWindow(event.windowId);
      break;
    case 'window.close':
      handlers.closeWindow(event.windowId);
      break;
    case 'window.move':
      handlers.moveWindow(event);
      break;
    case 'window.resize':
      handlers.resizeWindow(event);
      break;
    case 'taskbar.toggleWindow':
      handlers.toggleTaskbarWindow(event.windowId);
      break;
    case 'local.calculatorPress':
      handlers.pressCalculator(event);
      break;
    case 'local.notepadChange':
      handlers.changeNotepad(event);
      break;
    case 'browser.setAddressDraft':
      handlers.setBrowserAddressDraft(event);
      break;
    case 'browser.navigate':
      handlers.navigateBrowser(event);
      break;
    case 'browser.back':
      handlers.browserBack(event.sessionId);
      break;
    case 'browser.forward':
      handlers.browserForward(event.sessionId);
      break;
    case 'browser.refresh':
      handlers.browserRefresh(event.sessionId);
      break;
    case 'browser.stop':
      handlers.browserStop(event.sessionId);
      break;
    case 'browser.toggleFavorites':
      handlers.browserToggleFavorites(event.sessionId);
      break;
    case 'browser.addFavorite':
      handlers.browserAddFavorite(event.sessionId);
      break;
    case 'runtime.tick':
      handlers.tickRuntimes();
      break;
    case 'generated.tick':
      handlers.tickGenerated(event.sessionId);
      break;
    case 'generated.uiEvent':
      handlers.generatedUiEvent(event);
      break;
  }
}
