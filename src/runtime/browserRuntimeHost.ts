import { applyPatchEnvelope, classifyBrowserRoute, createEmptyDocument } from './generatedRuntime';
import { mockBrowserProvider } from './providers';
import { advanceBrowserStage, type StageStepResult } from './stageScheduler';
import type { BrowserFavorite, BrowserPage, BrowserState } from './types';

export function createBrowserRuntimeState(
  sessionId: string,
  address: string,
  cached: boolean,
  nextDocumentId: () => string,
): BrowserState {
  const page = createBrowserPage(sessionId, address, nextDocumentId());
  const stream = mockBrowserProvider.start(address, sessionId);
  let nextPatchIndex = 0;

  if (cached) {
    while (nextPatchIndex < Math.min(2, stream.length)) {
      page.document = applyPatchEnvelope(page.document, stream[nextPatchIndex]);
      page.title = page.document.appIdentity.title;
      page.statusText = page.document.appIdentity.statusText;
      nextPatchIndex += 1;
    }
  }

  return {
    address,
    addressDraft: address === 'about:home' ? '' : address,
    page,
    history: [page],
    historyIndex: 0,
    favorites: defaultBrowserFavorites(),
    favoritesOpen: false,
    stream,
    nextPatchIndex,
  };
}

export function tickBrowserRuntime(browser: BrowserState): StageStepResult {
  return advanceBrowserStage(browser);
}

export function setBrowserAddressDraft(browser: BrowserState | undefined, value: string) {
  if (browser) browser.addressDraft = value;
}

export function navigateBrowserRuntime(
  browser: BrowserState | undefined,
  sessionId: string,
  address: string,
  nextDocumentId: () => string,
): StageStepResult {
  if (!browser) return { advanced: false };

  const nextAddress = address.trim() || browser.addressDraft.trim() || 'about:home';
  const page = createBrowserPage(sessionId, nextAddress, nextDocumentId());
  browser.address = nextAddress;
  browser.addressDraft = nextAddress;
  browser.favoritesOpen = false;
  browser.page = page;
  browser.history = [...browser.history.slice(0, browser.historyIndex + 1), page];
  browser.historyIndex = browser.history.length - 1;
  browser.stream = mockBrowserProvider.start(nextAddress, sessionId);
  browser.nextPatchIndex = 0;

  return { advanced: true, title: `Internet Explorer - ${page.title}`, iconToken: 'browser' };
}

export function goBrowserHistory(browser: BrowserState | undefined, delta: number): StageStepResult {
  if (!browser) return { advanced: false };

  const nextIndex = browser.historyIndex + delta;
  if (nextIndex < 0 || nextIndex >= browser.history.length) return { advanced: false };

  browser.historyIndex = nextIndex;
  browser.page = browser.history[nextIndex];
  browser.address = browser.page.address;
  browser.addressDraft = browser.page.address;
  browser.favoritesOpen = false;
  browser.stream = [];
  browser.nextPatchIndex = 0;

  return { advanced: true, title: `Internet Explorer - ${browser.page.title}`, iconToken: 'browser' };
}

export function refreshBrowserRuntime(
  browser: BrowserState | undefined,
  sessionId: string,
  nextDocumentId: () => string,
): StageStepResult {
  if (!browser) return { advanced: false };

  const address = browser.address;
  browser.page = createBrowserPage(sessionId, address, nextDocumentId());
  browser.history[browser.historyIndex] = browser.page;
  browser.favoritesOpen = false;
  browser.stream = mockBrowserProvider.start(address, sessionId);
  browser.nextPatchIndex = 0;

  return { advanced: true, title: `Internet Explorer - ${browser.page.title}`, iconToken: 'browser' };
}

export function stopBrowserRuntime(browser: BrowserState | undefined, sessionId: string) {
  if (!browser) return;

  browser.stream = [];
  browser.nextPatchIndex = 0;
  browser.page.statusText = 'Stopped - Simulated offline page';
  browser.page.document = applyPatchEnvelope(browser.page.document, {
    protocolVersion: 1,
    sessionId,
    streamId: `${sessionId}-browser-stop`,
    seq: browser.page.document.revision + 1,
    baseRevision: browser.page.document.revision,
    resultRevision: browser.page.document.revision + 1,
    kind: 'transaction',
    payload: {
      transactionId: `${sessionId}-browser-stop`,
      ops: [
        { op: 'setStatusText', text: 'Stopped - Simulated offline page' },
        { op: 'setStage', stage: browser.page.document.stage === 'ready' ? 'ready' : 'stale' },
      ],
    },
  });
}

export function toggleBrowserFavorites(browser: BrowserState | undefined) {
  if (browser) browser.favoritesOpen = !browser.favoritesOpen;
}

export function addCurrentBrowserFavorite(browser: BrowserState | undefined) {
  if (!browser) return;

  const favorite: BrowserFavorite = {
    title: browser.page.title,
    address: browser.address,
    kind: browser.page.kind,
  };
  browser.favorites = [
    favorite,
    ...browser.favorites.filter((item) => item.address !== favorite.address),
  ].slice(0, 12);
  browser.favoritesOpen = true;
}

function createBrowserPage(sessionId: string, address: string, documentId: string): BrowserPage {
  const route = classifyBrowserRoute(address);
  return {
    title: route.title,
    address,
    kind: route.kind,
    document: createEmptyDocument(`browser-${sessionId}-${documentId}`, route.title),
    statusText: 'Opening page...',
  };
}

function defaultBrowserFavorites(): BrowserFavorite[] {
  return [
    { title: 'Google', address: 'google.com', kind: 'google' },
    { title: 'Wikipedia', address: 'wikipedia alan turing', kind: 'wikipedia' },
    { title: 'Example Domain', address: 'example.com', kind: 'example' },
    { title: 'Encarta Articles', address: 'encyclopedia alan turing', kind: 'encarta' },
  ];
}
