# VibeOS Agent Guide

## Project Shape

VibeOS is a Vite + React web prototype inspired by Zev.3R's "VibeOS - Fully Hallucinated Operating System" demo. It is not a real operating system.

The target experience is a retro Windows-like desktop where the user can request almost any app, topic, fake website, classic software package, rude utility, personalized finance app, Encarta-style encyclopedia, Paint scene, or nested simulated OS, and VibeOS opens a plausible hallucinated application for it. The point is to preserve the reference video's stage-demo feeling: the shell looks stable and familiar, while app content is confidently invented on demand.

The current architecture is intentionally split:

- Local shell behavior stays in the renderer: desktop icons, window focus, drag, resize, minimize, maximize, close, taskbar, and local app controls.
- Calculator, Browser, and Notepad run as React local runtimes in `src/renderer/components/LocalAppRuntime.tsx`.
- Generated or imagined apps use a browser-side LLM adapter.
- Generated app UI is returned as structured content blocks and rendered by React through `AppViewport`.
- `Ask VibeOS` entry points in the Start menu and taskbar launch arbitrary app prompts as the primary product loop.
- Recent generated prompts are tracked in renderer state so the demo can relaunch prior hallucinated apps quickly.

Do not turn the project into a serious productivity OS or a generic app builder. The north star is the reference video's bit: fully hallucinated, retro, playful, and generated on demand.

Do not reintroduce per-click full-page LLM rendering for local-runtime apps. Local runtime apps exist to keep the shell and demo props responsive; generated apps should carry the hallucinated spectacle.

## Reference Video Notes

Source: `https://www.youtube.com/watch?v=z3pV6FHvcgM`

Important behaviors to preserve or move toward:

- The OS feels bootable and real enough, but the product joke is that everything meaningful is hallucinated.
- Built-in classics include Notepad, Calculator, and Internet Explorer-style browsing.
- Browser/search content is hallucinated; fake websites and fake facts are acceptable when presented as simulated/offline.
- Users can ask for arbitrary software and VibeOS should create it on the fly.
- Generated apps should support the same class of prompts as the demo: Encarta-style pages about specific people or topics, rude classic utilities, personalized finance tools, Paint scenes with preloaded drawings, and nested OS/simulator ideas.
- The visual language should lean retro Windows rather than modern SaaS.
- The experience should value immediacy, humor, and plausible UI over factual reliability.

## Architecture Rules

- Routine UI interaction must be local first.
- Only use DeepSeek or another LLM for generated apps, imagined content, search-like expansion, or semantic changes.
- Keep local-runtime app state in the renderer window store.
- Keep generated app sessions in browser memory.
- If a generated app is opened more than once, preserve the browser-side cache behavior in `src/renderer/utils/vibeosApi.ts`.
- Treat `GenerateUiResult.blocks` as the generated-app UI contract. Do not reintroduce full-frame model HTML.
- Keep Browser local for chrome/address responsiveness, but route external-looking addresses and searches into simulated offline search/article pages unless the generated-app protocol is intentionally expanded.
- Keep generated block vocabulary centralized in `src/renderer/utils/generatedUiVocabulary.ts` when adding safe renderer classes.

The intended future direction is:

```text
user event
  -> local shell / local app runtime
  -> LLM only when content must be imagined
  -> structured content blocks
  -> local renderer applies the update
```

For generated-app creation, the desired product loop is:

```text
user asks for any app or topic
  -> open a retro application window immediately
  -> model invents the app identity, UI, content, fake data, and next response
  -> renderer renders structured blocks
  -> cached/hydrated session preserves the illusion when reopened
```
