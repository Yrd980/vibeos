# VibeOS Destructive Rewrite Spec

This spec is the product and architecture target for the next coding session. It intentionally defines the desired component, store, runtime, and API shape from scratch. Existing implementation details, if any are later present, must not constrain the rewrite.

## North Star

VibeOS is a retro Windows-like hallucinated operating system. It should feel like a stable old desktop shell whose real power is that it can invent any app, website, file, setting, encyclopedia page, utility, game, nested OS, or fake document on demand.

The product is not a serious productivity OS, not a generic app builder, and not a modern SaaS dashboard. It is a fast, visually credible stage demo where the shell feels real and the meaningful content is confidently simulated.

The key product loop:

```text
user enters an intent anywhere
  -> VibeOS resolves it into a LaunchIntent
  -> shell opens a retro window immediately
  -> local runtime or generated runtime takes over
  -> generated UI grows through validated patches
  -> the result looks like the named app/site/document genre
  -> interactions continue the hallucinated session
```

## Product Requirements

### Immediate Shell

The shell must always respond locally:

- Window open, focus, drag, resize, minimize, maximize, close, z-order, taskbar switching, desktop icon selection, Start menu open/close, and App Search typing must not wait on a model or network.
- A requested app/window must appear before generated content is ready.
- Local runtime apps must remain genuinely local: Calculator, Notepad, and Browser chrome must not call the model for routine interactions.

### Fast Staged Construction

Generated UI must feel like an old web page or Windows program quickly drawing itself, not like a slow animation.

Target timing:

```text
0-50ms       local shell responds
50-150ms     retro window appears with title/taskbar item
150-400ms    app identity, icon, menu, and status begin
400-900ms    layout, panes, toolbar, address/search area appear
900-1600ms   article/search/table/list/fake data content fills in
1600-2500ms  small details, metadata, status text, footers, images finish
>2500ms      app must already be understandable and partly usable
```

Staged generation must be a fast burst. Do not add theatrical delays. Do not show a blank spinner as the main experience.

Generated runtime stages:

1. `shell-opened`: window chrome exists locally.
2. `identity-revealed`: title, icon, subtitle, and status text are established.
3. `chrome-revealed`: menu bar, toolbar, address/search bar, tabs, side tree, and status bar appear.
4. `layout-revealed`: main pane structure is visible.
5. `content-streaming`: text, lists, tables, images/placeholders, fake files, and search results fill in.
6. `details-revealed`: row counts, fake timestamps, version numbers, footers, badges, scrollbars, captions, and metadata appear.
7. `interactive`: event intents are registered and controls are fully usable.

### Visual Facsimiles

Generated pages and apps must visually resemble the requested real target or genre. Do not render every request as generic cards.

Required facsimile cues:

- Google-like: white page, search box, blue result titles, green/gray display URLs, black snippets, result rhythm.
- Wikipedia-like: article title, left navigation, tabs, contents, section headings, references, right infobox.
- Encarta-like: CD-ROM encyclopedia feel, side index/tree, media/caption pane, educational article layout.
- Example.com-like: plain centered text block, `Example Domain`, one paragraph, one link; do not overgenerate.
- Download portal: version, mirrors, system requirements, old ads/badges, download buttons.
- Control Panel: icon grid, property sheets, tabs, group boxes, checkboxes.
- File Explorer: tree, file list, type, size, modified date, path/status text.
- Paint: tool palette, color palette, canvas, status bar, optionally preloaded simulated drawing.
- Nested OS: inner desktop, taskbar, windows, fake boot/opening behavior.

### App Search

App Search is the primary shell affordance. It is not a fixed app list and not a command palette.

Behavior:

- Typing updates the query immediately.
- Results update live under the input.
- Local results appear first: built-ins, recents, examples, cached sessions, obvious URL/file/setting matches.
- Async semantic suggestions arrive after a short debounce and never block input.
- First result is highlighted by default.
- `ArrowUp` / `ArrowDown` moves selection.
- `Enter` launches the highlighted result.
- `Shift+Enter` launches the raw query as a generated app.
- `Esc` clears search first, then closes search.
- Results have icon, title, kind, and description.
- Results are scrollable and use Windows-like selected-row styling.
- Empty-result state is forbidden. Always offer creation/search/fake-file/settings next actions.

Example for `todo`:

```text
[selected] To Do
           A simple generated task list for notes and reminders.

           TaskPad 98
           Classic Windows task organizer.

           Checklist
           Step-by-step list builder.

           Reminder Desk
           Sticky-note reminders.

           Search the offline web for "todo"
           Open in Internet Explorer.
```

### Browser

Browser is a hybrid local/generated runtime:

- Browser chrome is local and immediate.
- Page content is local deterministic facsimile or generated facsimile.
- It must not use an iframe or access the real internet.

Chrome requirements:

- Title: `Internet Explorer - [Page Title]`
- Menubar: `File`, `Edit`, `View`, `Favorites`, `Tools`, `Help`
- Toolbar: Back, Forward, Stop, Refresh, Home, Search, Favorites
- Address bar: classic white input with Go button
- Status bar: `Opening page...`, `Done`, `Search complete`, `Simulated offline page`
- History stack, Back/Forward, address focus, and refresh are local.

Address classification:

```text
google.com or plain query
  -> Google-like search/search-home facsimile

wikipedia.org, wiki query, person/topic encyclopedia prompt
  -> Wikipedia-like or Encarta-like article facsimile

example.com
  -> plain example.com facsimile

known old web genre
  -> download portal, fan site, company site, forum, or software page facsimile

unknown domain
  -> generated fake site based on domain name
```

### Failure And Cache

Failures must preserve the illusion:

- Model/API errors must not expose raw provider errors.
- Keep the last valid staged UI and mark the status as stale, offline, or simulated fallback.
- Provide retry, continue, regenerate, and make-more-realistic actions.
- If generation is slow, continue showing shell/chrome/placeholders and concrete status text.
- Cached sessions should restore in `80-350ms` with a short staged replay, not a long loading sequence.
- Cache is experiential continuity, not factual truth.

## Destructive Architecture

The target frontend is a small client-side OS simulator. React renders snapshots. Runtime modules own lifecycle, event routing, generation, caching, and staging.

```text
RuntimeKernel
  ShellRuntime
  WindowManager
  SessionManager
  RuntimeRegistry
  EventRouter
  StageScheduler
  CacheHydrator
  IntentResolver
  AppSearchRuntime
  LocalRuntimeHost
  BrowserRuntimeHost
  GeneratedRuntimeHost
```

### RuntimeKernel

The only write entry point.

Responsibilities:

- Accept normalized events and timer ticks.
- Route events to shell, window manager, sessions, or runtimes.
- Apply commands/reducers.
- Own the authoritative state tree.
- Expose immutable render snapshots to React.

Interface sketch:

```ts
interface RuntimeKernel {
  dispatch(event: KernelEvent): void;
  snapshot(): RuntimeSnapshot;
  subscribe(listener: () => void): () => void;
}
```

React components must dispatch events and render snapshots. They must not directly mutate session/window/generation state.

### ShellRuntime

Owns desktop-level state:

- Start menu
- Taskbar
- Desktop icons
- App Search
- Global shortcuts
- Recent prompts
- Pinned generated shortcuts

ShellRuntime only knows `LaunchIntent`, not app internals.

### WindowManager

Owns windows only:

```ts
interface WindowState {
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
}
```

WindowManager does not know whether a session is Calculator, Browser, or generated.

### SessionManager

Owns app lifecycle:

```text
created -> hydrating -> booting -> running -> suspended -> running
created/booting/running -> crashed
running/suspended -> closing -> closed
```

Session and window are separate concepts. A session may have zero or more windows over time.

```ts
interface AppSession {
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
}
```

### LaunchIntent

All entry points resolve to a launch intent.

```ts
type LaunchIntentKind =
  | 'local-app'
  | 'generated-app'
  | 'browser-page'
  | 'file-like'
  | 'system-tool'
  | 'nested-os';

interface LaunchIntent {
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
}
```

Do not open apps by raw name strings in the new architecture.

### RuntimeRegistry

Maps `LaunchIntent` to runtime host:

- `local-app` -> `LocalRuntimeHost`
- `browser-page` -> `BrowserRuntimeHost`
- `generated-app`, `file-like`, `system-tool`, `nested-os` -> `GeneratedRuntimeHost`

Rules:

- Exact built-in launches use local runtimes.
- Vague or modified built-ins use generated runtimes. Example: `rude calculator` is generated, not the local Calculator.
- Browser chrome is always local; page surface may be deterministic facsimile or generated.

### EventRouter

Routing priority:

```text
DOM event
  -> InputAdapter
  -> RuntimeKernel.dispatch
  -> EventRouter
  -> ShellRuntime or WindowManager
  -> SessionManager
  -> RuntimeHost
  -> commands
  -> reducers
  -> snapshot
  -> React render
```

System/window events win over app events:

- Titlebar drag does not go to app.
- Resize does not go to app.
- `Alt+Tab` does not go to app.
- Browser `Ctrl+L` focuses browser address bar.
- Generated app buttons only dispatch when registered as event intents.

### StageScheduler

StageScheduler is the runtime piece that makes generation feel like rapid construction.

Responsibilities:

- Convert local placeholders, cached snapshots, full fallback documents, or patch streams into visible stage transitions.
- Maintain separate `document` and `visibleDocument` for generated sessions.
- Apply fast timing rules.
- Prevent unstable half-transactions from rendering.
- Keep UI usable quickly.

Generated session state:

```ts
interface GeneratedSessionState {
  prompt: string;
  generationId: string;
  modelState: 'idle' | 'queued' | 'requesting' | 'streaming' | 'complete' | 'failed';
  document: GeneratedDocument;
  visibleDocument: GeneratedDocument;
  stagePlan: StagePlan;
  actionHistory: UiEvent[];
  cacheKey: string;
}
```

### CacheHydrator

Cache stores:

- Checkpoint snapshot
- Patch log since checkpoint
- Event log
- Prompt summary
- Safety validation version
- Vocabulary version

Hydration outcomes:

```ts
type HydrationResult =
  | { kind: 'miss' }
  | { kind: 'hit'; snapshot: GeneratedDocument }
  | { kind: 'partial'; snapshot: GeneratedDocument; missingFromRevision: number }
  | { kind: 'stale'; snapshot: GeneratedDocument; reason: string };
```

Cache restore must validate before display.

## Generation Protocol

The new protocol has two primary concepts:

```text
Block Tree
Patch Stream
```

There is no model HTML channel. There is no model CSS string channel. There is no executable model code channel.

### Session

```ts
interface GenerationSessionMeta {
  sessionId: string;
  prompt: string;
  kind: 'generated-app' | 'browser-facsimile' | 'document' | 'utility' | 'nested-os';
  cacheKey: string;
  baseRevision: number;
  viewportHints: ViewportHints;
  locale: string;
  safetyMode: 'offline-simulated';
}
```

### GeneratedDocument

```ts
interface GeneratedDocument {
  documentId: string;
  revision: number;
  appIdentity: AppIdentity;
  stage:
    | 'booting'
    | 'identifying'
    | 'building-chrome'
    | 'building-content'
    | 'detailing'
    | 'ready'
    | 'stale'
    | 'errored';
  rootBlockId: string;
  blocks: Record<string, GeneratedBlock>;
  eventIntents: Record<string, EventIntent>;
  facsimileRoute?: FacsimileRoute;
  resourceManifest: ResourceManifest;
}
```

### Blocks

```ts
interface GeneratedBlock {
  id: string;
  type: BlockType;
  role?: string;
  props: Record<string, unknown>;
  children: string[];
  state?: Record<string, unknown>;
  styleTokens: string[];
  eventIntents?: string[];
  accessibilityLabel?: string;
}
```

Block categories:

- App structure: `app-chrome`, `menu-bar`, `menu`, `toolbar`, `status-bar`, `split-pane`, `tab-strip`, `panel`, `group-box`, `dialog`, `toast`, `progress`
- Controls: `button`, `text-input`, `search-input`, `checkbox`, `radio-group`, `select`, `slider`, `tree`, `list`, `table`, `form`, `command-link`
- Content: `text`, `heading`, `rich-text-spans`, `image-placeholder`, `generated-bitmap`, `chart`, `timeline`, `terminal-transcript`, `paint-canvas`, `file-list`, `property-sheet`
- Facsimiles: `facsimile-page`, `facsimile-address-bar`, `search-home`, `search-results`, `wiki-article`, `encyclopedia-article`, `plain-example-page`, `download-portal`, `fan-site`, `corporate-site`, `forum-thread`, `classic-software-page`, `control-panel-page`, `nested-os-desktop`

`facsimile-page` must include:

```ts
interface FacsimileProps {
  pageKind: string;
  displayUrl: string;
  offlineSimulated: true;
  visualCues: string[];
  routeIntent?: string;
}
```

`displayUrl` is text. It must not cause a real network fetch.

### Style Tokens

All styling is token-based and centrally whitelisted.

Examples:

- `win98-window`
- `win98-panel`
- `toolbar-button`
- `status-bar`
- `link-blue`
- `google-result-title`
- `wiki-infobox`
- `encarta-sidebar`
- `download-button`
- `file-list-row`

No arbitrary CSS values, style attributes, class strings from model output, or external resources.

### Patch Envelope

```ts
interface PatchEnvelope {
  protocolVersion: 1;
  sessionId: string;
  streamId: string;
  seq: number;
  baseRevision: number;
  resultRevision: number;
  kind: 'lifecycle' | 'patch' | 'transaction' | 'validation' | 'heartbeat' | 'done' | 'error';
  payload: unknown;
}
```

Patch envelopes must be monotonic and replayable. Invalid patches do not advance revision.

### Patch Operations

```ts
type PatchOperation =
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
  | { op: 'setStage'; stage: GeneratedDocument['stage'] }
  | { op: 'setStatusText'; text: string }
  | { op: 'setLoadingHint'; text: string | null }
  | { op: 'setFacsimileRoute'; route: FacsimileRoute }
  | { op: 'setSelection'; blockId: string; selection: unknown }
  | { op: 'setFocusRequest'; blockId: string }
  | { op: 'scrollIntoView'; blockId: string }
  | { op: 'registerEventIntent'; intent: EventIntent }
  | { op: 'updateEventIntent'; intentId: string; patch: Partial<EventIntent> }
  | { op: 'unregisterEventIntent'; intentId: string };
```

Transactions:

```ts
type TransactionEnvelope = {
  transactionId: string;
  ops: PatchOperation[];
};
```

If any op in a transaction fails validation, the whole transaction is rejected.

### Stream Lifecycle

```text
window-opened-local
  -> stream-open
  -> identity-stage
  -> chrome-stage
  -> content-stage
  -> detail-stage
  -> ready
  -> optional background-refine
```

`background-refine` may only append low-risk details. It must not replace the whole app or move stable major regions.

### Event Intents

The model never executes code. It registers typed event intents.

```ts
interface EventIntent {
  id: string;
  blockId: string;
  eventType: 'click' | 'submit' | 'change' | 'select' | 'navigate-simulated' | 'open-dialog';
  description: string;
  valueSchema?: unknown;
}

interface UiEvent {
  sessionId: string;
  baseRevision: number;
  blockId: string;
  intentId: string;
  eventType: EventIntent['eventType'];
  value?: unknown;
}
```

Event examples:

- Search submit -> generate simulated search result patches.
- Facsimile link click -> generate offline route patches.
- Table row select -> patch detail pane.
- Fake installer next -> patch wizard step.
- Nested OS icon launch -> patch inner window.

### Validation

Strong validation is required:

- Block type must be whitelisted.
- Props are schema-validated by block type.
- Parent/child relationships are schema-validated.
- Block graph must be acyclic.
- IDs must be unique and stable.
- Max depth, max block count, max text length, and max item count are enforced.
- Style tokens must be whitelisted.
- URLs are display text only.
- Links trigger only `navigate-simulated`.
- Rich text is spans only, not HTML or markdown execution.
- Generated bitmap resources require MIME, dimensions, hash, and size limits.
- Password/payment/login facsimiles default to fake disabled controls.

## Implementation Plan For Next Session

The next coding session should rewrite in vertical slices. Avoid trying to preserve every current component.

### Phase 1: Kernel And Shell Skeleton

Deliverables:

- `RuntimeKernel` with dispatch/snapshot/subscribe.
- `WindowManager` with open/focus/minimize/maximize/close/drag/resize state.
- Basic React snapshot renderer for desktop, taskbar, windows.
- `LaunchIntent` model and basic `RuntimeRegistry`.
- Local Calculator, Notepad, and Browser chrome can be simple but must prove local runtime separation.

Acceptance:

- Window operations are local and instant.
- Opening Calculator/Notepad/Browser goes through `LaunchIntent`.
- Generated intent opens a placeholder staged window immediately.

### Phase 2: Block Tree Renderer And Patch Reducer

Deliverables:

- Typed `GeneratedDocument`, `GeneratedBlock`, `PatchEnvelope`, `PatchOperation`.
- Patch validator/reducer for create/insert/setProps/setAppIdentity/setStage/registerEventIntent.
- Renderer for initial block types: menu bar, toolbar, status bar, split pane, panel, text, heading, button, input, list, table.
- StageScheduler that can play deterministic staged patches without an LLM.

Acceptance:

- A scripted generated app can grow from identity -> chrome -> layout -> content -> ready.
- Invalid patches are rejected without corrupting visible state.
- Event intents can dispatch a typed event.

### Phase 3: App Search Runtime

Deliverables:

- App Search state machine.
- Local instant result resolver.
- Async suggestion resolver with fake delay and cancellation.
- Keyboard/mouse behavior.
- LaunchIntent generation for built-ins, browser pages, generated apps, fake files, settings, and nested OS.

Acceptance:

- Typing `todo` live-updates results and launches selected item with Enter.
- Empty or unknown queries still produce create/search/open suggestions.
- Results never block on LLM.

### Phase 4: Browser Facsimile Runtime

Deliverables:

- Local IE-like browser chrome.
- Address classification.
- Deterministic facsimiles for Google-like search, Wikipedia-like article, example.com, and unknown fake site.
- Browser history and local Back/Forward.

Acceptance:

- `example.com` opens a plain example page.
- `wikipedia alan turing` opens a Wikipedia-like page.
- Plain text opens Google-like search results.
- No real network or iframe is used.

### Phase 5: Generated Runtime Host

Deliverables:

- Provider interface that consumes `LaunchIntent` and `UiEvent` and yields patch envelopes.
- Mock provider that streams scripted patch sequences.
- DeepSeek provider adapted to patch protocol.
- Fallback adapter that converts full-document provider output into synthetic patch stream if needed.
- CacheHydrator with checkpoint + patch log.

Acceptance:

- Generated app starts immediately and receives streaming patches.
- Provider failure leaves last valid UI with stale status and retry/regenerate actions.
- Reopening cached app restores quickly with short staged replay.

### Phase 6: Visual Vocabulary And Facsimile Depth

Deliverables:

- Central style token vocabulary.
- Windows 95/98 shell polish.
- Distinct facsimile renderers/tokens for Google, Wikipedia, Encarta, download portals, Control Panel, File Explorer, Paint, nested OS.
- Generated prompts updated to request patch protocol and facsimile-specific blocks.

Acceptance:

- Generated and deterministic pages no longer look like one generic card template.
- Screens match the product screenshots' feel: IE chrome, Start/App Search, staged article/app construction.

## Non-Goals

- Do not use `GenerateUiResult` as the main protocol.
- Do not use raw HTML, iframe, script, style strings, arbitrary class names, or real network pages.
- Do not build a real OS or real browser.
- Do not prioritize factual correctness over stage-demo plausibility.
- Do not let local shell or local apps depend on LLM latency.
- Do not make staged generation slow.

## Required Smoke Scenarios

1. `todo`
   - App Search results update live.
   - First result is highlighted.
   - Enter opens a To Do-like generated app.

2. `wikipedia alan turing`
   - Browser window opens immediately.
   - Wikipedia-like page appears in stages.

3. `example.com`
   - Browser opens an example.com facsimile.
   - Page stays simple.

4. `make me a rude calculator`
   - Opens generated app, not local Calculator.
   - It has calculator-like controls but generated personality.

5. `Encarta 98 about Mark Russinovich`
   - Opens encyclopedia-like generated app.
   - Side index, article pane, media/infobox, and status details arrive in staged patches.

6. Reopen a recent generated app
   - Cache restores quickly.
   - Short staged replay preserves the magic.

7. Provider failure
   - No raw API error.
   - Last valid UI remains.
   - Status and retry/regenerate controls appear.

## Implementation Discipline

- Rewrite modules around the target architecture instead of patching current store/component boundaries.
- Keep shell, window manager, sessions, generated document protocol, and render projection separate.
- Start with deterministic mock streams so the UI can be built and verified without model latency.
- Add provider integration only after the patch reducer, stage scheduler, and facsimile renderers are solid.
- Implement DeepSeek integration manually behind the provider interface.
- Use existing project tooling: `bun run typecheck`, `bun run build`, and browser smoke checks.
