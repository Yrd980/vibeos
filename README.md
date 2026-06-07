# VibeOS

VibeOS is a Windows-friendly Electron prototype built to recreate the experience of Zev.3R's "VibeOS - Fully Hallucinated Operating System" demo. It is not a real OS. It is a desktop shell where the user can ask for familiar, obsolete, impossible, or personalized software and watch it appear as if the operating system hallucinated it on demand.

The product goal is to match the reference video's feel: a bootable-looking retro desktop, classic apps, fake Internet Explorer/search pages, invented Encarta-style knowledge apps, weird custom utilities, and nested simulated systems that are generated live from the user's prompt. The system should feel like a stage demo of an operating system where every app and every fact can be confidently made up.

The implementation still separates local shell mechanics from generated content. Window management and routine controls stay local so the demo stays responsive; AI sessions are reserved for generated or imagined app surfaces.

Current first-phase behavior:

- The Start menu and taskbar both expose an `Ask VibeOS` prompt for launching arbitrary generated apps.
- The Start menu includes reference-demo examples such as `Encarta 98 about Mark Russinovich`, `Commander XE but rude`, and `Microsoft Money 95 for Scott Hanselman`.
- Recently generated app prompts are tracked in renderer state so they can be relaunched quickly.
- Unknown generated apps receive inferred profiles for finance ledgers, encyclopedia articles, browser/search pages, paint canvases, setup wizards, nested desktops, and snarky utilities.
- The local Browser runtime stays responsive but renders richer hallucinated search/article pages for external-looking addresses and search queries.

## Setup

```powershell
npm install
npm run dev
```

The default provider is `mock`, so the app runs without API keys.

## DeepSeek

Copy `.env.example` to `.env` and set:

```text
VIBEOS_LLM_PROVIDER=hybrid
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

`hybrid` keeps local-runtime apps instant, while using DeepSeek for generated custom apps. DeepSeek is called from the Electron main process only. The renderer never receives the API key.

`VIBEOS_LLM_PROVIDER=deepseek` is currently treated the same as `hybrid` so demos stay responsive. Calculator, Browser, and Notepad do not call the model for routine clicks or typing.

## Scripts

```powershell
npm run dev        # Start Electron + Vite
npm run typecheck  # TypeScript check
npm run build      # Build main, preload, and renderer
npm run dist:win   # Build a Windows installer and portable exe
```

## Security Model

- Electron uses `contextIsolation`, disabled `nodeIntegration`, and a sandboxed renderer.
- The preload exposes only `createAppSession`, `sendAppEvent`, and `closeAppSession`.
- LLM HTML is treated as untrusted.
- The renderer sanitizes generated HTML with a strict allowlist.
- Model JavaScript, iframes, forms, remote resources, inline handlers, and arbitrary CSS are stripped.
- Local-runtime apps use React controls and renderer state for routine interaction.
- Generated app surfaces use delegated events and send only small structured events to the main process.

## Architecture

```text
src/main        Electron main process, IPC, sessions, LLM adapters
src/preload     Narrow contextBridge API
src/renderer    React desktop shell and safe app viewport
src/shared      IPC and app event types
```

Runtime flow:

```text
user click or input
  -> renderer desktop/window shell
  -> local runtime when the app is Calculator, Browser, or Notepad
  -> IPC/LLM only for generated or imagined app surfaces
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

Generated apps still use `GenerateUiResult { title, html, state, narration }` for compatibility. Their HTML is sanitized and rendered through `AppViewport`. Initial generated app results are cached in the Electron main process so reopening the same generated app can hydrate a new session without waiting for the model again.

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
npm run typecheck
npm run build
```

Useful UI smoke checks:

- Calculator: `7 * 8 = 56` and no `Thinking` badge.
- Notepad: typing keeps textarea focus and updates the title.
- Browser: clicking the address bar selects the current address; Enter and Go navigate simulated `vibe://` pages or hallucinated search/article pages such as `google.com/search?q=Hanselman+Wikipedia`.
- Start menu/taskbar: `Ask VibeOS` can launch a custom generated prompt, and generated prompts appear in Recent.
- Clicking visible window content brings that window to the front.
