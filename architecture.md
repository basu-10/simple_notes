# NoteZen — Architecture

> Audience: an AI coding agent (e.g., Codex) being onboarded to this repo.
> Goal: understand structure, responsibilities, data flow, and deployment
> without reading every file line-by-line. No source code is/should be included here.
> update this doc as and when needed(no-code).

## 1. Summary
NoteZen is a **vanilla JavaScript (ES modules) single-page app** with **no
build framework** (no React/Vite/TS). The same web UI is shipped two ways:
1. As a **PWA** served from **Cloudflare Pages** (with a service worker).
2. As an **Android app** via **Capacitor** (`@capacitor/android`).

There is **no application backend**. All persistence is client-side
(IndexedDB + localStorage). External integrations (Google Drive) are
**BYOK** and talk directly from the browser to the provider.

## 2. Tech Stack
- Language: plain JavaScript (ES modules, `<script type="module">`).
- Storage: IndexedDB (notes/settings) + localStorage (theme preference).
- Styling: single hand-written CSS file using CSS custom properties
  (variables) for theming.
- PWA: custom service worker (no Workbox).
- Android: Capacitor 6 (`@capacitor/core`, `@capacitor/android`,
  `@capacitor/cli`, `@capacitor/share`).
- Hosting: Cloudflare Pages (uses `_headers` convention).
- External APIs: Google Identity Services (OAuth) + Google Drive API.

## 3. Repository Layout
- `app.html` — the application shell. It also contains an in-app **Home
  overlay** (landing content) opened by the brand button; this is how the
  landing page is reached from inside the app on both web and Android.
- `index.html` — marketing/landing page with its own inline theme bootstrap.
  **Build constraint:** `scripts/build-www.mjs` overwrites this file with
  `app.html` so Capacitor can launch the app from `index.html`. As a result the
  standalone landing is web-only; inside the app the landing is shown via the
  in-app Home overlay, not by navigating to `index.html` (which would just
  reload the app on Android).
- `css/styles.css` — application styles + theme variables.
  `css/landing.css` — landing page styles.
  `css/home.css` — styles for the in-app Home overlay (landing content shown
  inside the app). It reuses the tokens and shared component classes already
  defined in `styles.css`, so it only defines the landing layout.
- `js/` — application source (ES modules). This is the source of truth.
- `www/` — Capacitor `webDir` build output (mirror of source assets).
  Capacitor and the web deploy both consume `www`. Keep `www` in sync with
  `js/`/`css/` (currently tracked in git).
- `sw.js` — service worker (caching strategy for PWA).
- `manifest.webmanifest` — PWA manifest (start URL `./app.html`).
- `_headers` — Cloudflare Pages security/cache headers.
- `capacitor.config.json` — Capacitor config (`appId`, `appName`,
  `webDir: "www"`).
- `android/` — generated Capacitor Android project.

### Module Map (under `js/`)
| Module | Responsibility |
|--------|----------------|
| `app.js` | Entry point. Opens DB, inits theme, wires all UI event handlers (including the in-app Home overlay), registers the service worker, bootstraps first-run state. |
| `state.js` | Single in-memory app state object (selected note, current folder, mode, drive token, etc.). |
| `db.js` | IndexedDB wrapper. Object stores: `items` (notes/folders) and `settings` (key/value). Provides CRUD, queries by index, soft-delete/restore/purge, storage-size estimate. |
| `ui.js` | Rendering & DOM: folder tree, note list, editor, modals, toasts, mobile view switching. |
| `crud.js` | Create/update/delete logic for notes & folders, autosave scheduling, favorite toggle. |
| `theme.js` | Appearance logic: Auto/Dark/Light cycle, system preference listener, applies `data-theme` on `<html>`, persists to localStorage (with IndexedDB fallback). |
| `drive.js` | Google Drive BYOK OAuth connect, load notes from Drive, sync note to Drive as plain-text file. |
| `export-import.js` | Export and import of notes in portable formats. |
| `utils.js` | Helpers: DOM `$`, `uid`, `now`, `esc`, `toast`, etc. |

## 4. Data Model (IndexedDB)
Database name/version are defined in `db.js`.

- **Store `items`** (keyPath `id`): documents of two `type`s:
  - `folder`: `{ id, type:"folder", parentId, name, color, createdAt, updatedAt, deletedAt? }`
  - `note`: `{ id, type:"note", parentId, title, content, createdAt, updatedAt, deletedAt?, favorite?, driveId? }`
  - Indexes: by_parent, by_type, by_type_parent_updated, by_favorite, by_deleted.
  - Deletion is **soft** (sets `deletedAt`); trash view filters on it.
- **Store `settings`** (keyPath `key`): arbitrary key/value. Known keys:
   `theme`, `mode`.

### Persistence split
- **Theme preference**: primarily `localStorage` (key `notezen-theme`);
  `theme.js` also reads an IndexedDB `theme` setting as a fallback.
- **All notes/folders/settings**: IndexedDB.

## 5. Theming
- CSS defines `:root` (light) variables, a `@media (prefers-color-scheme:
  dark)` block (system dark), and explicit `[data-theme="dark"]` /
  `[data-theme="light"]` blocks.
- `theme.js` sets `data-theme` on `document.documentElement`:
  - `auto` → attribute removed (CSS media query drives appearance).
  - `dark` / `light` → explicit attribute overrides.
- `index.html` includes an **inline** bootstrap script so the landing page
  applies the theme before first paint (avoids flash). `app.html` relies on
  the module (`theme.js`) for this.
- Theme also updates the `theme-color` meta tag and the toggle button icon.

## 6. Sync & External Integrations (BYOK, no backend)
- **Google Drive**: User supplies their own OAuth Web Client ID. Using Google
  Identity Services, the app requests a token client-side and reads/writes
   notes as `text/plain` files tagged with a custom app property. All traffic is
   browser → Google directly.
- **Security posture**: No vendor server sees user data. Keys/tokens live only
   in the browser (IndexedDB/localStorage). This is a deliberate privacy design.

## 7. Deployment & Build
- **Web (Cloudflare Pages)**: deploy the `www/` output (or source assets).
  `_headers` applies security headers and a 1-hour CDN cache on assets
  (`/sw.js` is excluded from cache). `manifest.webmanifest` + `sw.js` make it
  installable/offline.
- **Service worker (`sw.js`)**: precaches an asset list under a named cache
  and uses stale-while-revalidate for GETs, network-first for `/api/` and
  googleapis requests. On `activate` it deletes older caches.
  - **Important gotcha:** the cache name is a hard-coded constant. If its value
    is not bumped when `css/` or `js/` change, returning visitors may run
    **stale cached assets** (e.g., a theme change not appearing until the next
    load). This is the classic cause of "works locally / in Android but not on
    the hosted web version," because the Android WebView does not run the
    service worker and always loads fresh bundled assets.
- **Android (Capacitor)**: `capacitor.config.json` sets `webDir: "www"`.
  `npx cap sync android` copies `www` into the native project. The WebView
  generally does not use the PWA service worker (different scheme/scope), so
  the app uses the fresh bundled assets.

## 8. Entry Points for a Coding Agent
- Start reading at `app.html` (DOM structure) → `js/app.js` (wiring/startup)
  → `js/state.js` (shared state) → `js/db.js` (data) → `js/ui.js` +
  `js/crud.js` (rendering/actions).
- Theming: `js/theme.js` + `css/styles.css` theme blocks.
- Integrations: `js/drive.js`.
- Packaging/deploy: `capacitor.config.json`, `sw.js`, `_headers`,
  `manifest.webmanifest`, `www/`.

## 9. Known Issues / Things to Watch
- Service worker cache invalidation must be handled on every deploy (bump
  cache name or use content-hashed assets).
- Theme persistence is split between localStorage and IndexedDB; the toggle
  writes only to localStorage, so the two stores can diverge.
- `app.html` lacks the inline theme bootstrap that `index.html` has (possible
  first-paint flash / FOUC on the app page).
- Drive sync is manual/per-note and user-credentialed, not continuous.
