# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this project is

NoteZen is a vanilla-JS (ES modules, no framework) local-first note app plus a
PWA and a Capacitor Android wrapper. It has **no AI features** and **no
application backend**. External integrations (Google Drive) are bring-your-own-
credentials (BYOK) and talk directly from the browser to the provider.

## Build artifacts — `www/` is generated

`www/` is a **build artifact**, not source. It is regenerated from the repo-root
source by `scripts/build-www.mjs`:

```bash
npm run build:www
```

- Edit the canonical source under the repo root (`app.html`, `index.html`,
  `css/`, `js/`). Do **not** hand-edit `www/`.
- `www/` is gitignored. After changing source, rebuild before relying on it
  (the Android `cap sync` step depends on a fresh `www/`).
- `sw.js` caches a hard-coded asset list; bump the `CACHE` constant in `sw.js`
  when `css/`/`js/` change so returning visitors don't get stale assets.

## Code structure (source of truth = `js/`)

| Module     | Responsibility |
|------------|----------------|
| `app.js`   | Entry point: open DB, init theme, wire UI handlers, register SW. |
| `state.js` | Single in-memory app state object. |
| `db.js`    | IndexedDB wrapper (`items` + `settings` stores), soft-delete, queries. |
| `ui.js`    | Rendering & DOM: tree, note list, editor, modals, toasts, view switching. |
| `crud.js`  | Create/update/delete, autosave, favorite, move, duplicate. |
| `theme.js` | Appearance: Auto/Dark/Light cycle + persistence. |
| `drive.js` | Google Drive BYOK OAuth + sync as plain-text files. |
| `export-import.js` | Portable note export/import. |
| `utils.js` | `$`, `uid`, `now`, `esc`, `toast`. |

## Testing

```bash
npm install
npm test          # vitest run
npm run test:watch
```

- Tests live in `tests/` and use Vitest + `jsdom` + `fake-indexeddb`.
- `db.test.js` exercises the real IndexedDB data layer.
- `crud.test.js` tests CRUD logic with the DOM/render and Drive layers mocked
  (via `vi.mock`), keeping real `db.js` + `state.js`.
- `tests/setup.js` gives each test a fresh IndexedDB and a minimal DOM.

## Conventions

- Plain ES modules, no TypeScript, no build framework for the web UI.
- Keep the UI calm/low-noise; avoid introducing backend or AI dependencies.
- Prefer small, focused edits that match existing file style.
