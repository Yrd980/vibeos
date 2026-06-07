# VibeOS Agent Guide

## How To Read This Repo

- `docs/DESTRUCTIVE_REWRITE_SPEC.md` is the product and architecture brief.
- This file is not a second spec. It only describes how an agent should work in this repo.
- The repo may contain only docs at the start of a session. Do not assume implementation files exist just because the spec names future modules.

## Working Style

Think of the spec as a north star, not a cage. Use judgment, taste, and initiative to make the prototype feel alive. When details are not specified, invent the smallest coherent version that strengthens the VibeOS illusion.

Good agent behavior here:

- Build vertical slices that can be run and inspected.
- Prefer vivid, specific retro UI behavior over generic placeholders.
- Use deterministic mocks freely to prove the experience before model integration.
- Make the shell feel immediate and local.
- Let generated apps feel playful, strange, and confidently simulated.
- Keep the implementation simple enough that the next agent can continue it.

## Hard Edges

There are only a few boundaries that should not be crossed without an explicit user request:

- Do not let routine shell interactions depend on model latency.
- Do not render model-provided HTML, scripts, arbitrary CSS, iframes, or real external web pages.
- Do not replace the generated document / block / patch idea with a free-form page builder.
- Do not turn VibeOS into a serious productivity OS or a normal SaaS app.

Everything else is open to pragmatic implementation choices.

## Tooling

- Use `bun` for frontend setup, scripts, type checks, builds, and dev server workflows.
- Use `uv` only for Python helper scripts if needed.
- Avoid introducing extra tooling unless it clearly reduces complexity.

## Delivery

For implementation work, leave the repo in a runnable or clearly explained state. Prefer `bun run typecheck`, `bun run build`, and browser smoke checks when available. If a check cannot be run because the project has not been scaffolded yet, say so plainly.
