# NoteZen

A calm, **local-first** note-taking app — no accounts, no backend, no AI.
Notes live in your browser (IndexedDB) by default, organized into folders,
with optional bring-your-own-credentials Google Drive sync.

Ships two ways from one web codebase:

- **Web / PWA** — installable, works offline (Cloudflare Pages).
- **Android** — packaged with Capacitor, sharing the exact same UI code.

## Features

- Nested folders, favorites, fast search (⌘K), trash with restore/purge.
- Auto-save, three appearance modes (Auto / Dark / Light).
- Portable export / import in open formats (`.notezen`, `.json`, `.plainnote`).
- Optional Google Drive sync (BYOK OAuth — your credentials, your files).

## Project layout

```
app.html            App shell (loaded after the landing page)
index.html          Marketing / landing page
css/                Hand-written styles (styles.css = app, landing.css = site)
js/                 Application source (ES modules) — source of truth
www/                Capacitor web assets — BUILD ARTIFACT, do not edit by hand
sw.js               Service worker (PWA caching)
manifest.webmanifest
android/            Generated Capacitor Android project
tests/              Vitest unit tests (db.js / crud.js)
```

## Scripts

```bash
npm run build:www   # regenerate www/ from the root source (js/, css/, html)
npm run sync        # build:www + npx cap sync android
npm run deploy      # deploy the web app via wrangler
npm test            # run the Vitest suite once
npm run test:watch  # run Vitest in watch mode
```

## Testing

Unit tests use **Vitest** with a `jsdom` environment and `fake-indexeddb`,
so the IndexedDB data layer (`js/db.js`) and note CRUD logic (`js/crud.js`)
can be tested without a browser. The render/DOM and Drive layers are mocked.

```bash
npm install   # installs vitest, fake-indexeddb, jsdom
npm test
```

## Notes for contributors

- `www/` is generated — edit the source under the repo root, then
  `npm run build:www`. Never commit hand-edits to `www/`.
- The app deliberately has **no AI features** and **no application backend**;
  external integrations (Google Drive) are strictly BYOK and talk directly
  from the browser to the provider.
- See `architecture.md` and `product.md` for deeper design context.
