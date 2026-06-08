export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LaunchIntentKind =
  | 'local-app'
  | 'generated-app'
  | 'browser-page'
  | 'file-like'
  | 'system-tool'
  | 'nested-os';

export type LaunchIntent = {
  id: string;
  source: 'start' | 'search' | 'desktop' | 'taskbar' | 'browser' | 'app-action';
  kind: LaunchIntentKind;
  rawQuery: string;
  title: string;
  prompt: string;
  seed: string;
  iconHint: string;
  targetHint?: string;
  browserAddress?: string;
  generationMode: 'instant' | 'staged' | 'cached';
  payload?: unknown;
};

export type WindowState = {
  id: string;
  sessionId: string;
  title: string;
  iconToken: string;
  chromeKind: 'win98' | 'browser' | 'dialog' | 'nested';
  rect: Rect;
  restoreRect?: Rect;
  zIndex: number;
  mode: 'normal' | 'minimized' | 'maximized';
  focusState: 'focused' | 'blurred';
  interaction: 'idle' | 'dragging' | 'resizing';
};

export type SessionLifecycle =
  | 'created'
  | 'hydrating'
  | 'booting'
  | 'running'
  | 'suspended'
  | 'crashed'
  | 'closing'
  | 'closed';

export type RuntimeError = {
  code: string;
  message: string;
};

export type AppSession = {
  id: string;
  kind: 'local' | 'browser' | 'generated' | 'nested';
  intent: LaunchIntent;
  runtimeId: string;
  lifecycle: SessionLifecycle;
  createdAt: number;
  lastActiveAt: number;
  windowIds: string[];
  hydrationState: 'miss' | 'partial' | 'hit' | 'stale';
  error?: RuntimeError;
};

export type SearchResult = {
  id: string;
  icon: string;
  title: string;
  kind: string;
  description: string;
  intent: LaunchIntent;
};

export type ShellState = {
  startMenuOpen: boolean;
  appSearchOpen: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  selectedSearchIndex: number;
  semanticSuggestions: SearchResult[];
  semanticStatus: 'idle' | 'debouncing' | 'resolving';
  semanticRequestId: number;
  desktopSelectedIconId?: string;
  recentIntents: LaunchIntent[];
};

export type LocalAppState =
  | {
      type: 'calculator';
      display: string;
      expression: string;
    }
  | {
      type: 'notepad';
      text: string;
    };

export type BrowserPageKind =
  | 'google'
  | 'wikipedia'
  | 'example'
  | 'encarta'
  | 'download'
  | 'unknown';

export type BrowserPage = {
  title: string;
  address: string;
  kind: BrowserPageKind;
  document: GeneratedDocument;
  statusText: string;
};

export type BrowserState = {
  address: string;
  addressDraft: string;
  page: BrowserPage;
  history: BrowserPage[];
  historyIndex: number;
  stream: PatchEnvelope[];
  nextPatchIndex: number;
};

export type AppIdentity = {
  title: string;
  subtitle: string;
  iconToken: string;
  statusText: string;
};

export type GeneratedDocumentStage =
  | 'booting'
  | 'identifying'
  | 'building-chrome'
  | 'building-content'
  | 'detailing'
  | 'ready'
  | 'stale'
  | 'errored';

export type BlockType =
  | 'app-chrome'
  | 'menu-bar'
  | 'menu'
  | 'toolbar'
  | 'status-bar'
  | 'split-pane'
  | 'tab-strip'
  | 'panel'
  | 'group-box'
  | 'dialog'
  | 'toast'
  | 'progress'
  | 'button'
  | 'text-input'
  | 'search-input'
  | 'checkbox'
  | 'radio-group'
  | 'select'
  | 'slider'
  | 'tree'
  | 'list'
  | 'table'
  | 'form'
  | 'command-link'
  | 'text'
  | 'heading'
  | 'rich-text-spans'
  | 'image-placeholder'
  | 'generated-bitmap'
  | 'chart'
  | 'timeline'
  | 'terminal-transcript'
  | 'paint-canvas'
  | 'file-list'
  | 'property-sheet'
  | 'facsimile-page'
  | 'facsimile-address-bar'
  | 'search-home'
  | 'search-results'
  | 'wiki-article'
  | 'encyclopedia-article'
  | 'plain-example-page'
  | 'download-portal'
  | 'fan-site'
  | 'corporate-site'
  | 'forum-thread'
  | 'classic-software-page'
  | 'control-panel-page'
  | 'nested-os-desktop';

export type GeneratedBlock = {
  id: string;
  type: BlockType;
  role?: string;
  props: Record<string, unknown>;
  children: string[];
  state?: Record<string, unknown>;
  styleTokens: string[];
  eventIntents?: string[];
  accessibilityLabel?: string;
};

export type EventIntent = {
  id: string;
  blockId: string;
  eventType: 'click' | 'submit' | 'change' | 'select' | 'navigate-simulated' | 'open-dialog';
  description: string;
  valueSchema?: unknown;
};

export type FacsimileRoute = {
  pageKind: string;
  displayUrl: string;
  offlineSimulated: true;
  visualCues: string[];
  routeIntent?: string;
};

export type GeneratedBitmapResource = {
  id: string;
  kind: 'generated-bitmap';
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  byteLength: number;
  hash: string;
  dataUrl?: string;
  altText?: string;
};

export type GeneratedResource = GeneratedBitmapResource;

export type ResourceManifest = {
  resources: Record<string, GeneratedResource>;
};

export type ViewportHints = {
  width: number;
  height: number;
  colorDepth: number;
};

export type GenerationSessionMeta = {
  sessionId: string;
  prompt: string;
  kind: 'generated-app' | 'browser-facsimile' | 'document' | 'utility' | 'nested-os';
  cacheKey: string;
  baseRevision: number;
  viewportHints: ViewportHints;
  locale: string;
  safetyMode: 'offline-simulated';
};

export type HydrationResult =
  | { kind: 'miss' }
  | {
      kind: 'hit';
      snapshot: GeneratedDocument;
      patchLog: PatchEnvelope[];
      eventLog: UiEvent[];
      eventPatchLog: PatchEnvelope[];
      cacheMeta: CacheMeta;
    }
  | {
      kind: 'partial';
      snapshot: GeneratedDocument;
      missingFromRevision: number;
      patchLog: PatchEnvelope[];
      eventLog: UiEvent[];
      eventPatchLog: PatchEnvelope[];
      cacheMeta: CacheMeta;
    }
  | {
      kind: 'stale';
      snapshot: GeneratedDocument;
      reason: string;
      patchLog: PatchEnvelope[];
      eventLog: UiEvent[];
      eventPatchLog: PatchEnvelope[];
      cacheMeta: CacheMeta;
    };

export type CacheMeta = {
  promptSummary: string;
  safetyValidationVersion: number;
  vocabularyVersion: number;
  savedAt: number;
};

export type GeneratedDocument = {
  documentId: string;
  revision: number;
  appIdentity: AppIdentity;
  stage: GeneratedDocumentStage;
  rootBlockId: string;
  blocks: Record<string, GeneratedBlock>;
  eventIntents: Record<string, EventIntent>;
  facsimileRoute?: FacsimileRoute;
  resourceManifest: ResourceManifest;
  loadingHint?: string | null;
  selection?: { blockId: string; value: unknown };
  focusRequest?: string;
  scrollRequest?: string;
};

export type PatchOperation =
  | { op: 'createBlock'; block: GeneratedBlock }
  | { op: 'insertBlock'; parentId: string; childId: string; index?: number }
  | { op: 'replaceBlock'; blockId: string; block: GeneratedBlock }
  | { op: 'removeBlock'; blockId: string }
  | { op: 'moveBlock'; blockId: string; parentId: string; index?: number }
  | { op: 'setChildren'; blockId: string; childIds: string[] }
  | { op: 'spliceChildren'; blockId: string; start: number; deleteCount: number; childIds: string[] }
  | { op: 'setProps'; blockId: string; props: Record<string, unknown> }
  | { op: 'mergeProps'; blockId: string; props: Record<string, unknown> }
  | { op: 'unsetProp'; blockId: string; key: string }
  | { op: 'setState'; blockId: string; state: Record<string, unknown> }
  | { op: 'setStyleTokens'; blockId: string; styleTokens: string[] }
  | { op: 'appendText'; blockId: string; text: string }
  | { op: 'replaceTextRange'; blockId: string; start: number; end: number; text: string }
  | { op: 'setItems'; blockId: string; items: unknown[] }
  | { op: 'appendItems'; blockId: string; items: unknown[] }
  | { op: 'spliceItems'; blockId: string; start: number; deleteCount: number; items: unknown[] }
  | { op: 'updateItem'; blockId: string; itemId: string; patch: Record<string, unknown> }
  | { op: 'removeItem'; blockId: string; itemId: string }
  | { op: 'setAppIdentity'; identity: Partial<AppIdentity> }
  | { op: 'setStage'; stage: GeneratedDocumentStage }
  | { op: 'setStatusText'; text: string }
  | { op: 'setLoadingHint'; text: string | null }
  | { op: 'setFacsimileRoute'; route: FacsimileRoute }
  | { op: 'setResourceManifest'; manifest: ResourceManifest }
  | { op: 'setSelection'; blockId: string; selection: unknown }
  | { op: 'setFocusRequest'; blockId: string }
  | { op: 'scrollIntoView'; blockId: string }
  | { op: 'registerEventIntent'; intent: EventIntent }
  | { op: 'updateEventIntent'; intentId: string; patch: Partial<EventIntent> }
  | { op: 'unregisterEventIntent'; intentId: string };

export type TransactionEnvelope = {
  transactionId: string;
  ops: PatchOperation[];
};

export type PatchEnvelope = {
  protocolVersion: 1;
  sessionId: string;
  streamId: string;
  seq: number;
  baseRevision: number;
  resultRevision: number;
  kind: 'lifecycle' | 'patch' | 'transaction' | 'validation' | 'heartbeat' | 'done' | 'error';
  payload: PatchOperation | TransactionEnvelope | { message: string };
};

export type StagePlan = {
  mode: 'stream' | 'cache-replay' | 'fallback';
  startedAt: number;
  lastVisibleRevision: number;
};

export type ProviderSource = 'mock' | 'deepseek' | 'fallback' | 'cache';

export type ProviderRunState = {
  providerId: string;
  source: ProviderSource;
  streamId: string;
  status: 'idle' | 'queued' | 'requesting' | 'streaming' | 'complete' | 'failed' | 'cancelled';
  cancellationReason?: string;
  errorReason?: string;
  lastPollAt?: number;
};

export type ProviderSessionHandle = {
  id: string;
  providerId: string;
  source: Exclude<ProviderSource, 'cache'>;
  streamId: string;
  status: 'queued' | 'requesting' | 'streaming' | 'complete' | 'failed' | 'cancelled';
  poll(): PatchEnvelope[];
  pollAsync?(): void;
  handleEvent?(event: UiEvent): PatchEnvelope[];
  cancel(reason: string): void;
};

export type GeneratedSessionState = {
  prompt: string;
  generationId: string;
  modelState: 'idle' | 'queued' | 'requesting' | 'streaming' | 'complete' | 'failed';
  document: GeneratedDocument;
  visibleDocument: GeneratedDocument;
  stagePlan: StagePlan;
  provider: ProviderRunState;
  providerSession?: ProviderSessionHandle;
  actionHistory: UiEvent[];
  cacheKey: string;
  stream: PatchEnvelope[];
  eventPatchLog: PatchEnvelope[];
  nextPatchIndex: number;
};

export type UiEvent = {
  sessionId: string;
  baseRevision: number;
  blockId: string;
  intentId: string;
  eventType: EventIntent['eventType'];
  value?: unknown;
};

export type RuntimeSnapshot = {
  now: number;
  shell: ShellState;
  windows: WindowState[];
  sessions: Record<string, AppSession>;
  localApps: Record<string, LocalAppState>;
  browserApps: Record<string, BrowserState>;
  generatedApps: Record<string, GeneratedSessionState>;
};

export type KernelEvent =
  | { type: 'shell.toggleStart' }
  | { type: 'shell.openSearch' }
  | { type: 'shell.closeSearch' }
  | { type: 'shell.setSearchQuery'; query: string }
  | { type: 'shell.semanticSuggestionsReady'; requestId: number; query: string; results: SearchResult[] }
  | { type: 'shell.moveSearchSelection'; delta: number }
  | { type: 'shell.launchSelectedSearch' }
  | { type: 'shell.launchRawSearch' }
  | { type: 'shell.launchIntent'; intent: LaunchIntent }
  | { type: 'window.focus'; windowId: string }
  | { type: 'window.minimize'; windowId: string }
  | { type: 'window.maximize'; windowId: string }
  | { type: 'window.restore'; windowId: string }
  | { type: 'window.close'; windowId: string }
  | { type: 'window.move'; windowId: string; x: number; y: number }
  | { type: 'window.resize'; windowId: string; rect: Rect }
  | { type: 'taskbar.toggleWindow'; windowId: string }
  | { type: 'local.calculatorPress'; sessionId: string; key: string }
  | { type: 'local.notepadChange'; sessionId: string; text: string }
  | { type: 'browser.setAddressDraft'; sessionId: string; value: string }
  | { type: 'browser.navigate'; sessionId: string; address: string }
  | { type: 'browser.back'; sessionId: string }
  | { type: 'browser.forward'; sessionId: string }
  | { type: 'browser.refresh'; sessionId: string }
  | { type: 'browser.stop'; sessionId: string }
  | { type: 'runtime.tick' }
  | { type: 'generated.tick'; sessionId: string }
  | { type: 'generated.uiEvent'; event: UiEvent };
