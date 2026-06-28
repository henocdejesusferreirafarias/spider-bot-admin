# SpiderBot Admin

Standalone Vite app for the SpiderBot admin panel.

This extraction preserves the functional static admin from `apps/api/public/admin.html` and `admin.js`. The HTML lives in `index.html`, and the admin script lives in `src/admin.js` so Vite can inject `VITE_API_URL`. It intentionally excludes the marketing landing page, customer auth, customer portal, and public checkout UI.

## Development

```sh
npm install
npm run dev
```

The dev server runs on `http://127.0.0.1:5174` and proxies `/v1` to `http://127.0.0.1:8787` by default.

## Deploy API URL

Set `VITE_API_URL` when the admin is deployed separately from the API:

```sh
VITE_API_URL=https://api.example.com npm run build
```

When `VITE_API_URL` is empty, the admin uses relative `/v1/admin/*` requests. This is the preferred Easypanel shape when the admin domain can reverse-proxy `/v1` to the API.

When `VITE_API_URL` points to another origin, the API must allow the admin origin in `CORS_ORIGIN`. Keep the admin and API on the same site, for example `admin.example.com` and `api.example.com`, so the admin session cookie can work with `SameSite=Lax`.

The Vite build uses relative assets, so it can be served from a domain root or a subpath such as `/admin/`.

## Verification

```sh
npm run check
npm run build
```
