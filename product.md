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
  integrations (Google Drive sync, AI assistant) are brought by the user
  themselves via their own OAuth client ID and API keys.
- **Portable** — user data can be exported and re-imported in open formats.

## Target Users
- People who want a simple, private notebook on phone and desktop.
- Users who prefer storing notes locally but optionally syncing to their own
  Google Drive.
- Users who want lightweight AI help (review/summarize) without handing notes
  to a third-party app backend.

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
8. **AI Assistant (optional, BYOK)** — review/summarize the current note using
   the user's own OpenRouter key or custom OpenAI-compatible endpoints. Requests
   go directly from the browser to the model provider.
   (Marked BETA in the UI.)
9. **PWA installability** — installable on desktop/mobile, standalone display,
   offline-capable via service worker.

## Non-Goals (what NoteZen deliberately is NOT)
- Not a collaborative / multi-user real-time editor.
- Not a hosted service with user accounts, servers, or vendor-held data.
- Not a rich-text/block editor — notes are plain text.
- Not a cross-device sync platform — Drive sync is a user-initiated,
  bring-your-own-credentials feature, not a managed sync engine.

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
- **AI review:** Set OpenRouter key in Settings → open a note → "Ask AI" →
  receives a privacy-respecting review of the note text.
- **Data portability:** Export from sidebar → re-import on another device.

## Known Limitations (product-level)
- Drive sync is manual/per-note and user-credentialed, not continuous background
  sync.
- AI is review-only in current UI (summarize/refine implied but implemented as
  "review" call).
- Theme preference is per-browser (localStorage); not yet unified across the
  IndexedDB settings store consistently.
