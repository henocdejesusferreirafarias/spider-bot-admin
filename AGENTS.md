# AGENTS.md

This repository is the standalone SpiderBot admin panel.

- Preserve the current static admin behavior first. The source of truth for this extraction is `index.html` plus `src/admin.js`.
- Do not add marketing UI, customer login/signup, customer portal, public checkout, or legacy React bot/customer panels.
- Admin API calls must stay under `/v1/admin/*`.
- Local development uses the Vite proxy for `/v1` to `http://127.0.0.1:8787`.
- Deploys may set `VITE_API_URL` to point the static admin at a remote API. If it is cross-origin, keep API `CORS_ORIGIN` aligned and prefer same-site domains so the admin cookie works.
- Run `npm run check` and `npm run build` before committing changes.
