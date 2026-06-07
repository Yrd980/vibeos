# VibeOS

VibeOS is a web prototype built to recreate the experience of Zev.3R's "VibeOS - Fully Hallucinated Operating System" demo. It is not a real OS. It is a desktop shell where the user can ask for familiar, obsolete, impossible, or personalized software and watch it appear as if the operating system hallucinated it on demand.

The product goal is to match the reference video's feel: a bootable-looking retro desktop, classic apps, fake Internet Explorer/search pages, invented Encarta-style knowledge apps, weird custom utilities, and nested simulated systems that are generated live from the user's prompt. The system should feel like a stage demo of an operating system where every app and every fact can be confidently made up.

The implementation still separates local shell mechanics from generated content. Window management and routine controls stay local so the demo stays responsive; AI sessions are reserved for generated or imagined app surfaces.

Current first-phase behavior:

- The Start menu and taskbar both expose an `Ask VibeOS` prompt for launching arbitrary generated apps.
- The Start menu includes reference-demo examples such as `Encarta 98 about Mark Russinovich`, `Commander XE but rude`, and `Microsoft Money 95 for Scott Hanselman`.
- Recently generated app prompts are tracked in renderer state so they can be relaunched quickly.
- Unknown generated apps receive inferred profiles for finance ledgers, encyclopedia articles, browser/search pages, paint canvases, setup wizards, nested desktops, and snarky utilities.
- Generated app startup falls back to prompt-aware local UI when the model provider is unavailable, so `Ask VibeOS` still opens a usable retro app instead of an error panel.
- Generated app UI uses structured content blocks, not raw model HTML. The renderer owns the React output and delegated event attributes.
- Calculator, Browser, and Notepad are local React runtimes. Calculator shows pending operators such as `7 *` and accepts both button clicks and keyboard input.
- The local Browser runtime stays responsive but renders richer hallucinated search/article pages for external-looking addresses and search queries.

## Setup

```powershell
bun install
bun run dev
```

The default provider is `hybrid`. Built-in apps stay local; arbitrary generated apps use DeepSeek when `VITE_DEEPSEEK_API_KEY` is set and fall back to the local mock generator when it is unavailable.

## DeepSeek

Copy `.env.example` to `.env` and set:

```text
VITE_VIBEOS_LLM_PROVIDER=hybrid
VITE_DEEPSEEK_API_KEY=sk-...
VITE_DEEPSEEK_MODEL=deepseek-v4-flash
VITE_DEEPSEEK_PROXY_TARGET=https://api.deepseek.com
```

`hybrid` keeps local-runtime apps instant, while using DeepSeek for generated custom apps. In this web-only prototype, DeepSeek is called from browser code through the Vite dev proxy by default. `VITE_` variables are exposed to the client, so do not ship a production key in a public static deployment.

`VITE_VIBEOS_LLM_PROVIDER=deepseek` sends generated-app turns directly to DeepSeek. Calculator, Browser, and Notepad do not call the model for routine clicks or typing. If DeepSeek is missing, times out, or returns an unusable provider-error frame in `hybrid`, VibeOS falls back to the local mock generator for that turn.

The browser always calls the same-origin `/deepseek-api` path. `vite.config.ts` installs a local `/deepseek-api` middleware for development and preview, and that middleware forwards requests to `VITE_DEEPSEEK_PROXY_TARGET`. This avoids browser CORS failures from direct requests to `https://api.deepseek.com`. Static production hosting still needs an equivalent backend, API route, or edge function for `/deepseek-api`.

## Scripts

```powershell
bun run dev        # Start Vite web dev server
bun run typecheck  # TypeScript check
bun run build      # Build static web app
bun run preview    # Preview the production build
```

## Security Model

- LLM output is structured data only. Generated apps return `GenerateUiResult.blocks`, not raw HTML, scripts, styles, or markup fragments.
- `AppViewport` renders every generated block as React. Text, labels, list items, table cells, and field values stay plain strings.
- Generated blocks may request only known renderer vocabulary: safe class names, block roles, actions, fields, lists, text, and tables.
- The model can provide action and field identifiers, but the renderer owns the actual React elements and `data-vibe-*` event attributes.
- Model JavaScript, iframes, forms, remote resources, inline handlers, arbitrary CSS, raw HTML, filesystem access, and real network access are outside the generated app contract.
- Local-runtime apps use React controls and renderer state for routine interaction.
- Generated app surfaces use delegated events and send only small structured event objects plus current generated state back to the browser-side session adapter.

## Architecture

```text
src/renderer/apps        app catalog and launch metadata
src/renderer/components  desktop shell, window chrome, local runtimes, and AppViewport
src/renderer/llm         browser-side mock, hybrid, and DeepSeek adapters
src/renderer/utils       generated session API and safe UI vocabulary
src/shared               app event and generated UI result types
```

Runtime flow:

```text
user click or input
  -> renderer desktop, taskbar, start menu, or window chrome
  -> app catalog resolves the launch target
  -> AppWindowContent chooses a local runtime or generated viewport
  -> LocalAppRuntime handles Calculator, Browser, and Notepad entirely in React
  -> vibeosApi manages generated app sessions, request queueing, and cache hydration
  -> mock, hybrid, or DeepSeek adapter returns structured generated blocks
  -> AppViewport renders the blocks and delegates safe events back into the session
```

Reference-demo behavior:

```text
user asks for an app or topic
  -> Start menu or taskbar Ask VibeOS launches the request
  -> VibeOS opens a plausible retro application window immediately
  -> local runtime handles fast demo props or the model invents UI, content, labels, fake data, and simulated responses
  -> the renderer keeps the shell stable while the generated app sells the illusion
```

Local-runtime apps live in `src/renderer/components/LocalAppRuntime.tsx`. They use normal React controls and renderer state, so routine typing and clicks do not rebuild the DOM from model output.

Browser is currently a hybrid demo prop: its chrome and address entry stay local, while external-looking routes are rendered as simulated offline search results or articles. It does not access the real internet.

Generated apps use the blocks-only protocol:

```ts
GenerateUiResult {
  title: string;
  state: unknown;
  narration?: string | null;
  blocks: GeneratedUiBlock[];
}
```

Each `GeneratedUiBlock` has an `id`, a role such as `menubar`, `toolbar`, `sidebar`, `main`, `panel`, `status`, or `dialog`, and optional structured content: `title`, `text`, `items`, `actions`, `fields`, `table`, and a safe `className`. Actions expose `id`, `label`, optional `value`, and a limited variant. Fields expose `id`, `label`, string `value`, optional `placeholder`, and optional multiline mode.

There is no compatibility HTML channel. Generated app behavior is expressed through structured blocks plus delegated `click`, `input`, `submit`, and `keyboard` events. Initial generated app results are cached in browser memory so reopening the same generated app can hydrate a new session without waiting for the model again.

## Experience Targets

- Recreate the reference video's "fully hallucinated operating system" premise, not a serious productivity OS.
- Make custom app creation the main trick: search for or request any software, then generate a believable app window for it.
- Prefer retro Windows desktop conventions: taskbar, window chrome, classic app names, dense controls, fake system utilities, and old software nostalgia.
- Let generated apps be confidently fictional, funny, and personalized when the prompt asks for it.
- Keep simulated browsing obviously offline and model-generated. The answer to "is this AI?" should always be yes.
- Support built-in classics such as Notepad, Calculator, and Browser as fast local props for the demo, while generated apps provide the hallucinated spectacle.
- Favor continuity over correctness: reopening the same generated app should preserve the illusion through cached or hydrated state.
