# NoteZen — Product Overview

## Name & Identity
NoteZen is a calm, local-first note-taking application. The brand emphasizes
quiet, focus, and privacy ("A calm place to think"). It ships as both a
progressive web app (PWA) and an Android app from a single web codebase.

## Vision & Principles
- **Calm by design** — minimal, low-noise UI; neutral palette; no clutter.
- **Local-first** — notes live on the user's device by default (browser
  IndexedDB / app storage). No account is required to start writing.
- **Privacy / BYOK** — there is no backend the vendor controls. Optional
  integrations (Google Drive sync) are brought by the user
  themselves via their own OAuth client ID.
- **Portable** — user data can be exported and re-imported in open formats.

## Target Users
- People who want a simple, private notebook on phone and desktop.
- Users who prefer storing notes locally but optionally syncing to their own
  Google Drive.

## Core Features
1. **Notes & Folders** — nested folder hierarchy; create, edit, rename, delete
   notes and folders.
2. **Favorites** — star notes; dedicated favorites view.
3. **Search** — quick filter across notes (⌘K focus).
4. **Trash** — soft delete with restore and purge.
5. **Appearance / Theming** — three modes: Auto (follows system
   prefers-color-scheme), Dark, Light. Persisted per browser.
6. **Export / Import** — back up and restore notes in portable file formats so
   users own their data.
7. **Google Drive Sync (optional, BYOK)** — connect with the user's own Google
   OAuth Web Client ID; notes sync as plain-text files directly from the
   browser to the user's Drive. No server intermediary.
8. **PWA installability** — installable on desktop/mobile, standalone display,
   offline-capable via service worker.
9. **In-app Home / landing view** — clicking the NoteZen brand opens a
   clutter-free landing panel (hero, feature highlights, "back to notes") inside
   the app. It behaves identically on web and Android, avoiding cross-document
   navigation (which is unreliable in the Android WebView).

## Non-Goals (what NoteZen deliberately is NOT)
- Not a collaborative / multi-user real-time editor.
- Not a hosted service with user accounts, servers, or vendor-held data.
- Not a rich-text/block editor — notes are plain text.
- Not a cross-device sync platform — Drive sync is a user-initiated,
  bring-your-own-credentials feature, not a managed sync engine.
- Note: rich text (tables/links/images via CKEditor 4) is supported, but embedded
  **images are stored as device-local IndexedDB blobs** referenced by `data-asset-id`.
  They are intentionally NOT included in Google Drive sync (HTML uploads as `.txt`) or
  in export/import bundles — so images are local-only until account/asset sync is built.

## Platforms & Distribution
- **Web / PWA** — hosted on Cloudflare Pages; installable; works offline.
- **Android** — packaged with Capacitor (`@capacitor/android`), sharing the
  exact same web UI code.

## Key User Journeys
- **Local writing:** Open app → create folder → create note → type → auto-saved
  to IndexedDB. Reload persists everything.
- **Theming:** Click appearance button → cycles Auto → Dark → Light.
- **Drive sync:** Switch to "Google Drive" → supply OAuth Client ID → authorize
  → notes sync as .txt files in Drive.
- **Data portability:** Export from sidebar → re-import on another device.
- **Home / landing:** Click the NoteZen brand → landing panel opens in place →
  "Back to notes" (or close / Escape) returns to the app, without losing state.

## Known Limitations (product-level)
- Drive sync is manual/per-note and user-credentialed, not continuous background
  sync.
- Theme preference is per-browser (localStorage); not yet unified across the
  IndexedDB settings store consistently.
