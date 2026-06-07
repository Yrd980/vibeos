# VibeOS Agent Guide

## Project Shape

VibeOS is an Electron + Vite + React prototype built to recreate Zev.3R's "VibeOS - Fully Hallucinated Operating System" demo. It is not a real operating system.

The target experience is a retro Windows-like desktop where the user can request almost any app, topic, fake website, classic software package, rude utility, personalized finance app, Encarta-style encyclopedia, Paint scene, or nested simulated OS, and VibeOS opens a plausible hallucinated application for it. The point is to reproduce the reference video's stage-demo feeling: the shell looks stable and familiar, while the app content is confidently invented in real time.

The current architecture is intentionally split:

- Local shell behavior stays in the renderer: desktop icons, window focus, drag, resize, minimize, maximize, close, taskbar, and local app controls.
- Calculator, Browser, and Notepad run as React local runtimes in `src/renderer/components/LocalAppRuntime.tsx`.
- Generated or imagined apps use Electron IPC and an LLM adapter from the main process.
- Model HTML is untrusted fallback output, rendered only through `AppViewport` and sanitized by `sanitizeHtml.ts`.
- `Ask VibeOS` entry points in the Start menu and taskbar launch arbitrary app prompts as the primary product loop.
- Recent generated prompts are tracked in renderer state so the demo can relaunch prior hallucinated apps quickly.

Do not turn the project into a serious productivity OS or a generic app builder. The north star is the reference video: fully hallucinated, retro, playful, and generated on demand.

Do not reintroduce per-click full-page LLM rendering for local-runtime apps. Local runtime apps exist to keep the shell and demo props responsive; generated apps should carry the hallucinated spectacle.

## Reference Video Notes

Source: `https://www.youtube.com/watch?v=z3pV6FHvcgM`

Important behaviors to preserve or move toward:

- The OS feels bootable and real enough, but the product joke is that everything meaningful is hallucinated.
- Built-in classics include Notepad, Calculator, and Internet Explorer-style browsing.
- Browser/search content is generated live; fake websites and fake facts are acceptable when presented as simulated/offline.
- Users can ask for arbitrary software and VibeOS should create it on the fly.
- Generated apps should support prompts like `Encarta 98 about Mark Russinovich`, `Commander XE but rude`, `Microsoft Money 95 for Scott Hanselman`, `Paint with a drawing already loaded`, or nested OS/simulator ideas.
- The visual language should lean retro Windows rather than modern SaaS.
- The experience should value immediacy, humor, and plausible UI over factual reliability.

## Architecture Rules

- Routine UI interaction must be local first.
- Only use DeepSeek or another LLM for generated apps, imagined content, search-like expansion, or semantic changes.
- Keep local-runtime app state in the renderer window store.
- Keep generated app sessions in the Electron main process `SessionStore`.
- If a generated app is opened more than once, preserve the main-process cache behavior in `src/main/ipc.ts`.
- Treat `GenerateUiResult.html` as a compatibility fallback, not the preferred future interface.
- Keep Browser local for chrome/address responsiveness, but route external-looking addresses and searches into simulated offline search/article pages unless the generated-app protocol is intentionally expanded.
- Keep `SAFE_CLASS_NAMES` in `promptTemplates.ts` and `SAFE_CLASSES` in `sanitizeHtml.ts` synchronized when adding generated UI vocabulary.

The intended future direction is:

```text
user event
  -> local shell / local app runtime
  -> LLM only when content must be imagined
  -> small patch, content block, or app blueprint
  -> local renderer applies the update
```

For generated-app creation, the desired product loop is:

```text
user asks for any app or topic
  -> open a retro application window immediately
  -> model invents the app identity, UI, content, fake data, and next response
  -> renderer applies the safest available representation
  -> cached/hydrated session preserves the illusion when reopened
```

## Important Files

- `src/renderer/components/Desktop.tsx`: app launch flow. Local runtime apps should bypass IPC.
- `src/renderer/components/WindowFrame.tsx`: window chrome, focus, drag, resize, and runtime/viewport split.
- `src/renderer/components/LocalAppRuntime.tsx`: React implementations for Calculator, Browser, and Notepad.
- `src/renderer/components/StartMenu.tsx`: `Ask VibeOS` examples, app list, and recent generated prompts.
- `src/renderer/components/Taskbar.tsx`: compact `Ask VibeOS` launcher and task buttons.
- `src/renderer/components/AppViewport.tsx`: sanitized delegated-event viewport for generated HTML.
- `src/renderer/utils/sanitizeHtml.ts`: DOMPurify allowlist for model output.
- `src/renderer/state/desktopStore.ts`: renderer-side window state.
- `src/main/ipc.ts`: app session IPC, request queueing, and generated app cache.
- `src/main/llm/*`: model adapters, prompts, and generated app session state.
- `src/shared/types.ts`: IPC and app event contracts.

## Implementation Guidance

- Match the existing TypeScript and React style.
- Keep changes surgical. Do not refactor unrelated app profiles, styles, or adapters.
- Do not add new test files unless the user explicitly asks for tests.
- Prefer existing scripts: `npm run typecheck` and `npm run build`.
- Do not use another package manager unless the repo is migrated intentionally.
- Do not expose API keys to the renderer. DeepSeek calls must stay in the main process.
- Do not allow model output to add scripts, inline handlers, remote resources, iframes, arbitrary styles, or filesystem/network access.

## Local Runtime Contract

When adding another local app:

1. Add it to `LocalRuntimeAppName` and `LOCAL_RUNTIME_APPS`.
2. Define a typed runtime state.
3. Add initial state, normalization, title generation, and React UI.
4. Make ordinary clicks and typing update state locally.
5. Keep `html: ''` in local runtime results unless a compatibility reason requires otherwise.

Avoid bringing back `dangerouslySetInnerHTML` for local apps.

## Generated App Contract

Generated apps may still receive `GenerateUiResult { title, html, state, narration }`.

For generated HTML:

- Use only safe classes listed in `sanitizeHtml.ts` and `promptTemplates.ts`.
- Use delegated event attributes such as `data-vibe-action`, `data-vibe-value`, `data-vibe-id`, and `data-vibe-field`.
- Keep generated app behavior simulated and explicit about being offline.
- Make generated apps feel like complete retro software, even when their content is fictional.
- Favor prompt-specific personality and fake-but-coherent details for imagined apps.

If changing the LLM protocol, migrate toward structured patches, content blocks, or blueprints. Update `shared/types.ts`, prompts, adapter parsing, sanitizer rules, and renderer application logic together.

## Verification Checklist

Run at least:

```powershell
npm run typecheck
npm run build
```

For UI changes, smoke test in the app/browser:

- Calculator: `7 * 8 = 56`, no `Thinking` badge.
- Notepad: typing keeps textarea focus and updates the title.
- Browser: address entry replaces the selected address; Enter and Go navigate simulated `vibe://` pages.
- Browser: `google.com/search?q=Hanselman+Wikipedia` renders a simulated search page and still makes no network request.
- Start menu/taskbar: `Ask VibeOS` launches arbitrary generated prompts; examples and recent generated prompts are clickable.
- Window content click brings that window to the front when the clicked area is not covered by another window.

## Known Tooling Note

The Codex in-app browser automation may not have its virtual clipboard installed. In that case, `fill()` or bulk `type()` can fail even when the app works. Use low-level clicks and keypresses for smoke tests when needed.
