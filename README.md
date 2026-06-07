# VibeOS

VibeOS is a web prototype built to recreate the experience of Zev.3R's "VibeOS - Fully Hallucinated Operating System" demo. It is not a real OS. It is a desktop shell where the user can ask for familiar, obsolete, impossible, or personalized software and watch it appear as if the operating system hallucinated it on demand.

The product goal is to match the reference video's feel: a bootable-looking retro desktop, classic apps, fake Internet Explorer/search pages, invented Encarta-style knowledge apps, weird custom utilities, and nested simulated systems that are generated live from the user's prompt. The system should feel like a stage demo of an operating system where every app and every fact can be confidently made up.

Generated UI should not feel like a normal app builder response where the user waits and then receives a completed screen. The intended trick is visible construction at web-page loading speed: VibeOS opens a retro window immediately, then the app identity, menu bar, toolbar, panes, fake data, status copy, and small controls appear in quick stages, as if the OS is thinking the interface into existence. This should usually feel like hundreds of milliseconds to a couple of seconds of progressive loading, not a slow animation.

The generated content should also visually resemble the real thing being simulated. When Internet Explorer opens Google, Wikipedia, example.com, a search result page, a fake download portal, or a personal homepage, the page should use recognizable layout cues: familiar link colors, old-web spacing, article headings, infoboxes, search boxes, result snippets, simple status text, and era-appropriate page density. The content remains offline and may be invented, but the surface should look like a plausible page from the requested site or genre.

App Search is a core part of the shell. It should search for anything the user types and asynchronously infer plausible next steps as the user is typing. The result pane should update live with Windows-like rows, icons, descriptions, highlighted selection, scrolling, keyboard navigation, and launch behavior. Searching `todo` might suggest To Do, TaskPad, Checklist, Reminder Desk, fake files, settings, websites, or a new generated app.

The target implementation separates local shell mechanics from generated content. Window management and routine controls stay local so the demo stays responsive; AI sessions are reserved for generated or imagined app surfaces.

Target behavior:

- The Start menu and taskbar both expose an `Ask VibeOS` prompt for launching arbitrary generated apps.
- App Search is a live async discovery surface for built-in apps, generated apps, fake utilities, websites, files, settings, and next-step suggestions.
- The Start menu includes reference-demo examples such as `Encarta 98 about Mark Russinovich`, `Commander XE but rude`, and `Microsoft Money 95 for Scott Hanselman`.
- Recently generated app prompts are tracked in renderer state so they can be relaunched quickly.
- Unknown generated apps receive inferred profiles for finance ledgers, encyclopedia articles, browser/search pages, paint canvases, setup wizards, nested desktops, and snarky utilities.
- Generated app startup falls back to prompt-aware local UI when the model provider is unavailable, so `Ask VibeOS` still opens a usable retro app instead of an error panel.
- Generated app UI uses generated documents, generated blocks, and patch envelopes, not raw model HTML. The renderer owns the React output and delegated event attributes.
- Generated app startup should use staged reveal through a validated block tree and patch stream.
- Staged reveal should be fast and purposeful, like a page loading in pieces. It should show construction without delaying usability.
- Calculator, Browser, and Notepad are local React runtimes. Calculator shows pending operators such as `7 *` and accepts both button clicks and keyboard input.
- The local Browser runtime stays responsive but renders richer hallucinated search/article pages for external-looking addresses and search queries. These pages should resemble their real targets or genres, not generic cards with fake copy.

## Setup

```powershell
bun install
bun run dev
```

The default implementation path is local-first. Built-in apps stay local; arbitrary generated apps should use DeepSeek through a hand-written provider adapter only after the local runtime, patch protocol, validator, scheduler, and mock provider are working.

## DeepSeek

DeepSeek integration should be implemented manually behind a provider interface that converts model output into validated VibeOS patch envelopes.

```text
local runtime -> generated runtime host -> provider adapter -> DeepSeek
              -> patch validator/reducer -> stage scheduler -> React renderer
```

Calculator, Browser chrome, Notepad, shell controls, window management, and App Search typing must not call the model for routine interactions. If DeepSeek is missing, slow, or returns unusable output, VibeOS should keep the last valid generated document visible and fall back to local simulated/stale UI for that turn.

Keep API keys out of the public client bundle. Development and production should use a same-origin server endpoint or equivalent backend boundary when calling DeepSeek.

## Scripts

```powershell
bun run dev        # Start Vite web dev server
bun run typecheck  # TypeScript check
bun run build      # Build static web app
bun run preview    # Preview the production build
```

## Security Model

- LLM output is structured data only. Generated apps use `GeneratedDocument`, `GeneratedBlock`, and `PatchEnvelope` data, not raw HTML, scripts, styles, or markup fragments.
- The generated block renderer renders every visible generated block as React. Text, labels, list items, table cells, and field values stay plain strings.
- Generated blocks may request only known renderer vocabulary: whitelisted block types, style tokens, roles, actions, fields, lists, text, and tables.
- The model can provide action and field identifiers, but the renderer owns the actual React elements and delegated event attributes.
- Model JavaScript, iframes, forms, remote resources, inline handlers, arbitrary CSS, raw HTML, filesystem access, and real network access are outside the generated app contract.
- Local-runtime apps use React controls and renderer state for routine interaction.
- Generated app surfaces use delegated events and send only small structured event objects plus current generated state back to the browser-side session adapter.

## Architecture

```text
app catalog and launch metadata
desktop shell, window chrome, local runtimes, and generated block renderer
runtime kernel, session manager, stage scheduler, and cache hydrator
mock and DeepSeek provider adapters
shared app event, generated document, patch, and block types
```

Runtime flow:

```text
user click or input
  -> renderer desktop, taskbar, start menu, or window chrome
  -> intent resolver produces a LaunchIntent
  -> runtime kernel opens/focuses a window and session
  -> runtime registry chooses local, browser, or generated runtime
  -> local runtime handles Calculator, Browser chrome, and Notepad entirely in React
  -> generated runtime manages sessions, request queueing, cache hydration, and staging
  -> mock or DeepSeek adapter returns validated generated patches
  -> generated block renderer renders visible blocks and delegates safe events back into the session
```

Reference-demo behavior:

```text
user asks for an app or topic
  -> Start menu or taskbar Ask VibeOS launches the request
  -> VibeOS opens a plausible retro application window immediately
  -> generated apps reveal chrome, content, fake data, and details step by step
  -> the reveal completes quickly, like a webpage loading rather than a long animation
  -> local runtime handles fast demo props or the model invents UI, content, labels, fake data, and simulated responses
  -> the renderer keeps the shell stable while the generated app sells the illusion
```

App Search behavior:

```text
user types into App Search
  -> local shell updates the input immediately
  -> result pane shows a small loading/thinking state when needed
  -> VibeOS asynchronously predicts useful matches and next actions
  -> results appear live with icons, names, descriptions, and highlighted selection
  -> Enter/click launches the selected built-in app, generated app, website-like page, fake file, or setting
```

Local-runtime apps use normal React controls and renderer state, so routine typing and clicks do not rebuild the DOM from model output.

Browser is a hybrid demo prop: its chrome and address entry stay local, while external-looking routes are rendered as simulated offline search results or articles. It does not access the real internet.

Browser pages should be recognizable facsimiles. Google-like pages should feel like old search pages, Wikipedia-like pages should use article and infobox structure, example.com-like pages should stay plain and document-like, and fake sites should borrow the visual language of the requested site category.

Generated apps use a validated block tree and patch stream protocol:

```ts
GeneratedDocument {
  revision: number;
  appIdentity: AppIdentity;
  stage: 'booting' | 'identifying' | 'building-chrome' | 'building-content' | 'detailing' | 'ready' | 'stale' | 'errored';
  rootBlockId: string;
  blocks: Record<string, GeneratedBlock>;
  eventIntents: Record<string, EventIntent>;
}

PatchEnvelope {
  seq: number;
  baseRevision: number;
  resultRevision: number;
  kind: 'lifecycle' | 'patch' | 'transaction' | 'validation' | 'heartbeat' | 'done' | 'error';
  payload: unknown;
}
```

Each `GeneratedBlock` has an `id`, whitelisted `type`, optional `role`, schema-validated `props`, ordered child block IDs, whitelisted `styleTokens`, and optional registered event intents. The model never provides executable code, arbitrary CSS, or raw markup.

There is no compatibility HTML channel. Generated app behavior is expressed through structured blocks, validated patch operations, and delegated typed events. Generated sessions should be cached in browser memory so reopening the same generated app can hydrate quickly with a short staged replay.

## Experience Targets

- Recreate the reference video's "fully hallucinated operating system" premise, not a serious productivity OS.
- Make custom app creation the main trick: search for or request any software, then generate a believable app window for it.
- Make App Search feel like a native Windows feature that can find or invent anything, with live suggestions that keep up with typing.
- Treat visible step-by-step UI creation as part of the trick, not as a loading state to hide.
- Keep staged creation fast. The user should notice the app assembling itself, then be able to use it almost immediately.
- Prefer retro Windows desktop conventions: taskbar, window chrome, classic app names, dense controls, fake system utilities, and old software nostalgia.
- Make simulated websites and in-app pages visually specific to their references or genres, rather than abstract generated panels.
- Let generated apps be confidently fictional, funny, and personalized when the prompt asks for it.
- Keep simulated browsing obviously offline and model-generated. The answer to "is this AI?" should always be yes.
- Support built-in classics such as Notepad, Calculator, and Browser as fast local props for the demo, while generated apps provide the hallucinated spectacle.
- Favor continuity over correctness: reopening the same generated app should preserve the illusion through cached or hydrated state.
