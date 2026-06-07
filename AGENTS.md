# VibeOS Agent Guide

## Project Shape

VibeOS is a Vite + React web prototype inspired by Zev.3R's "VibeOS - Fully Hallucinated Operating System" demo. It is not a real operating system.

The target experience is a retro Windows-like desktop where the user can request almost any app, topic, fake website, classic software package, rude utility, personalized finance app, Encarta-style encyclopedia, Paint scene, or nested simulated OS, and VibeOS opens a plausible hallucinated application for it. The point is to preserve the reference video's stage-demo feeling: the shell looks stable and familiar, while app content is confidently invented on demand.

A key part of the trick is that generated UI should feel like it is being imagined into existence step by step, but at web-page loading speed. VibeOS should open the retro window immediately, then reveal identity, menus, toolbars, panes, fake data, status text, and detailed controls in quick stages. The target is a fast burst of construction, usually hundreds of milliseconds to a couple of seconds, not a slow animation. Avoid turning generated-app startup into a long wait followed by a fully completed screen; the visible construction process is part of the product experience, but it must not make the app feel sluggish.

Generated pages inside apps should also look like the real thing they are simulating. An Internet Explorer window showing Google, Wikipedia, example.com, a fake download site, or an Encarta-style article should use recognizable page structure, typography, spacing, link styling, search-result rhythm, article infoboxes, status bars, and era-appropriate chrome. The facts may be hallucinated and offline, but the page should visually read as a plausible facsimile of the requested site or software.

App Search is a core shell affordance, not a fixed app list. It should search for anything the user types and asynchronously infer plausible next steps while they type. Results should update live under the input with Windows-like selection, icons, descriptions, scrolling, keyboard navigation, and launch behavior. If the user types `todo`, VibeOS can suggest To Do, TaskPad, Checklist, Reminder Desk, or any other plausible generated app. This should feel like a Windows feature that can find and create anything, not a command palette bolted onto the demo.

The target architecture is intentionally split:

- Local shell behavior stays in the renderer: desktop icons, window focus, drag, resize, minimize, maximize, close, taskbar, and local app controls.
- Calculator, Browser, and Notepad run as React local runtimes.
- Generated or imagined apps use a browser-side LLM adapter.
- Generated app UI is returned as a validated generated document, block tree, and patch stream rendered by React through the generated block renderer.
- Generated app startup should support staged or incremental reveal through validated patches.
- `Ask VibeOS` entry points in the Start menu and taskbar launch arbitrary app prompts as the primary product loop.
- App Search should act as a live asynchronous discovery and launch surface for built-in apps, generated apps, fake utilities, websites, documents, and next-step suggestions.
- Recent generated prompts are tracked in renderer state so the demo can relaunch prior hallucinated apps quickly.

Do not turn the project into a serious productivity OS or a generic app builder. The north star is the reference video's bit: fully hallucinated, retro, playful, and generated on demand.

Do not reintroduce per-click full-page LLM rendering for local-runtime apps. Local runtime apps exist to keep the shell and demo props responsive; generated apps should carry the hallucinated spectacle.

## Reference Video Notes

Source: `https://www.youtube.com/watch?v=z3pV6FHvcgM`

Important behaviors to preserve or move toward:

- The OS feels bootable and real enough, but the product joke is that everything meaningful is hallucinated.
- Built-in classics include Notepad, Calculator, and Internet Explorer-style browsing.
- Browser/search content is hallucinated; fake websites and fake facts are acceptable when presented as simulated/offline, but the pages should visually resemble the real sites or site genres being simulated.
- App Search can find anything: built-in utilities, plausible apps that do not exist yet, websites, fake files, Control Panel-style settings, and context-aware next actions.
- Users can ask for arbitrary software and VibeOS should create it on the fly.
- Generated apps should support the same class of prompts as the demo: Encarta-style pages about specific people or topics, rude classic utilities, personalized finance tools, Paint scenes with preloaded drawings, and nested OS/simulator ideas.
- Generated apps should visibly come together over time: first the window shell, then recognizable chrome, then content, then convincing small details.
- Staged generation should feel fast, like a website progressively loading. Use short, purposeful phases rather than theatrical delays.
- The visual language should lean retro Windows rather than modern SaaS.
- The experience should value immediacy, humor, and plausible UI over factual reliability.

## Architecture Rules

- Routine UI interaction must be local first.
- Only use DeepSeek or another LLM for generated apps, imagined content, search-like expansion, or semantic changes.
- Implement AI integration manually through a provider adapter.
- Keep local-runtime app state in the renderer window store.
- Keep generated app sessions in browser memory.
- If a generated app is opened more than once, preserve browser-side cache and staged hydration behavior.
- Treat `GeneratedDocument`, `GeneratedBlock`, and `PatchEnvelope` as the generated-app UI contract. Do not reintroduce full-frame model HTML.
- Preserve the staged-generation illusion for generated apps. Prefer incremental block additions or patch-like updates over replacing a blank loading state with one final complete UI.
- Keep staged generation responsive. The user should be able to see construction happen, but the UI should become usable quickly.
- Keep Browser local for chrome/address responsiveness, but route external-looking addresses and searches into simulated offline search/article pages unless the generated-app protocol is intentionally expanded.
- For Browser and website-like generated apps, prioritize recognizable facsimiles over generic content panels: Google-like search, Wikipedia-like articles, example.com-like plain pages, old download portals, fan sites, and fake corporate pages should each have distinct real-world layout cues.
- For App Search, preserve Windows-like behavior: live results while typing, highlighted first result, arrow-key movement, Enter to launch, Escape to close, scrollable result panes, icons, short descriptions, and async loading indicators when results are still being imagined.
- Keep generated block vocabulary centralized when adding safe renderer classes or style tokens.

The intended future direction is:

```text
user event
  -> local shell / local app runtime
  -> LLM only when content must be imagined
  -> validated generated document patches
  -> local renderer applies the update
```

For generated-app creation, the desired product loop is:

```text
user asks for any app or topic
  -> open a retro application window immediately
  -> reveal the app identity and basic chrome first
  -> progressively add menus, toolbars, panes, content, fake data, and status details
  -> complete the visible construction quickly, like a page load rather than a long animation
  -> model invents the app identity, UI, content, fake data, and next response as structured data
  -> renderer applies validated patch envelopes in staged updates
  -> cached/hydrated session preserves the illusion when reopened
```
