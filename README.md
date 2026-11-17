# Web Apps

A home for lots of small, self-contained web apps. Plain HTML/CSS/JS, no build step, no
dependencies — just Node.js for the dev server and scaffolding script.

## Quick start

```bash
npm run dev                      # http://localhost:5173/  (hub page listing every app)
npm run new -- my-app            # scaffold apps/my-app from the template
npm run new -- tip-calc "Tip Calculator" "Split a bill and add a tip"
```

## Layout

```
index.html          hub page — lists apps from apps.json
apps.json           registry of apps (written by `npm run new`)
shared/base.css     shared design tokens (light/dark), base styles
apps/_template/     starter copied for every new app
apps/<slug>/        one folder per app: index.html, style.css, app.js
scripts/serve.mjs   zero-dependency static dev server
scripts/new-app.mjs scaffolder
```

Each app is fully static, so the whole repo can be deployed as-is to GitHub Pages, Netlify,
Cloudflare Pages, etc.
