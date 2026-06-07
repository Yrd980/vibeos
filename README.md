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
VITE_DEEPSEEK_BASE_URL=/deepseek-api
VITE_DEEPSEEK_PROXY_TARGET=https://api.deepseek.com
```

`hybrid` keeps local-runtime apps instant, while using DeepSeek for generated custom apps. In this web-only prototype, DeepSeek is called from browser code through the Vite dev proxy by default. `VITE_` variables are exposed to the client, so do not ship a production key in a public static deployment.

`VITE_VIBEOS_LLM_PROVIDER=deepseek` sends generated-app turns directly to DeepSeek. Calculator, Browser, and Notepad do not call the model for routine clicks or typing. If DeepSeek is missing, times out, or returns an unusable provider-error frame in `hybrid`, VibeOS falls back to the local mock generator for that turn.

The DeepSeek API itself is reachable with the configured key, but browser requests to `https://api.deepseek.com` can still be blocked by CORS. Keep `VITE_DEEPSEEK_BASE_URL=/deepseek-api` for local development and preview: `vite.config.ts` installs a same-origin `/deepseek-api` middleware that forwards requests to `VITE_DEEPSEEK_PROXY_TARGET`. Setting `VITE_DEEPSEEK_BASE_URL=https://api.deepseek.com` makes the browser call DeepSeek directly and may fail even when the API key is valid.

## Scripts

```powershell
bun run dev        # Start Vite web dev server
bun run typecheck  # TypeScript check
bun run build      # Build static web app
bun run preview    # Preview the production build
```

## Security Model

- LLM HTML is treated as untrusted.
- The renderer sanitizes generated HTML with a strict allowlist.
- Model JavaScript, iframes, forms, remote resources, inline handlers, and arbitrary CSS are stripped.
- Local-runtime apps use React controls and renderer state for routine interaction.
- Generated app surfaces use delegated events and send only small structured events to the browser-side session adapter.

## Architecture

```text
src/renderer    React desktop shell and safe app viewport
src/renderer/llm Browser-side mock, hybrid, and DeepSeek adapters
src/shared      app event and generated UI result types
```

Runtime flow:

```text
user click or input
  -> renderer desktop/window shell
  -> local runtime when the app is Calculator, Browser, or Notepad
  -> browser-side LLM adapter only for generated or imagined app surfaces
  -> sanitized generated HTML fallback for model-built apps
```

Reference-demo behavior:

```text
user asks for an app or topic
  -> Start menu or taskbar Ask VibeOS launches the request
  -> VibeOS opens a plausible retro application window immediately
  -> local runtime handles fast demo props or the model invents UI, content, labels, fake data, and simulated responses
  -> the renderer keeps the shell stable while the generated app sells the illusion
```

Local-runtime apps live in `src/renderer/components/LocalAppRuntime.tsx`. They use normal React controls and renderer state, so routine typing and clicks do not rebuild the DOM from model HTML.

Browser is currently a hybrid demo prop: its chrome and address entry stay local, while external-looking routes are rendered as simulated offline search results or articles. It does not access the real internet.

Generated apps still use `GenerateUiResult { title, html, state, narration }` for compatibility. Their HTML is sanitized and rendered through `AppViewport`. Initial generated app results are cached in browser memory so reopening the same generated app can hydrate a new session without waiting for the model again.

## Experience Targets

- Recreate the reference video's "fully hallucinated operating system" premise, not a serious productivity OS.
- Make custom app creation the main trick: search for or request any software, then generate a believable app window for it.
- Prefer retro Windows desktop conventions: taskbar, window chrome, classic app names, dense controls, fake system utilities, and old software nostalgia.
- Let generated apps be confidently fictional, funny, and personalized when the prompt asks for it.
- Keep simulated browsing obviously offline and model-generated. The answer to "is this AI?" should always be yes.
- Support built-in classics such as Notepad, Calculator, and Browser as fast local props for the demo, while generated apps provide the hallucinated spectacle.
- Favor continuity over correctness: reopening the same generated app should preserve the illusion through cached or hydrated state.

## Verification

After code changes, run:

```powershell
bun run typecheck
bun run build
```

Useful UI smoke checks:

- Calculator: `7 * 8 = 56` and no `Thinking` badge.
- Calculator: after pressing `7` then `*`, the expression row shows `7 *`; keyboard input supports digits, `/`, `*`, `+`, `-`, `.`, `C`, and `Enter`.
- Notepad: typing keeps textarea focus and updates the title.
- Browser: clicking the address bar selects the current address; Enter and Go navigate simulated `vibe://` pages or hallucinated search/article pages such as `google.com/search?q=Hanselman+Wikipedia`.
- Start menu/taskbar: `Ask VibeOS` can launch a custom generated prompt, and generated prompts appear in Recent.
- Start menu/taskbar: with the model provider unavailable, `Ask VibeOS` still opens a prompt-specific local fallback UI rather than `Could not start app`.
- Clicking visible window content brings that window to the front.
