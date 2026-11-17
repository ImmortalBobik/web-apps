# CLAUDE.md

This repo is a collection of many small, independent web apps.

## Conventions

- Create every new app with `npm run new -- <kebab-slug> "Title" "One-line description"`.
  This copies `apps/_template/` and registers the app in `apps.json` (which the hub page reads).
  Never hand-create an app folder without also adding it to `apps.json`.
- Plain HTML/CSS/JS with ES modules. No build step, no npm dependencies. If an app truly needs a
  library, load a pinned version from a CDN (e.g. `https://cdn.jsdelivr.net/npm/pkg@1.2.3/...`).
- Each app is self-contained in `apps/<slug>/`. Apps never import from each other; shared code
  belongs in `shared/`.
- Link `../../shared/base.css` first and use its CSS variables (`--bg`, `--surface`, `--text`,
  `--accent`, ...) so apps get light/dark mode for free.
- Keep the "← All apps" back link at the top of each app.
- Layout must work at phone width (375px) with no horizontal scroll.
- Persist per-user state in `localStorage`, wrapped in try/catch.

## Running

`npm run dev` serves the repo at http://localhost:5173/ (launch config `web-apps` in
`.claude/launch.json`). Verify each new app in the browser before calling it done.
