// Handles text shared INTO NoteZen from the Android share sheet.
// The native side exposes window.NoteZenShare.getPending() (returns JSON or "").
import { $, toast } from "./utils.js";
import { createNote, saveCurrent } from "./crud.js";
import { setMobileView } from "./ui.js";
import { state } from "./state.js";

export function checkPendingShare() {
  try {
    const bridge = window.NoteZenShare;
    if (!bridge || typeof bridge.getPending !== "function") return;
    const raw = bridge.getPending();
    if (!raw || raw === "" || raw === "null") return;
    const data = JSON.parse(raw);
    if (!data || !data.text) return;
    consume(data);
  } catch (e) {
    console.warn("share-in: failed to read pending share", e);
  }
}

async function consume(data) {
  const text = data.text || "";
  const title =
    (data.subject && data.subject.trim()) ||
    (text.split("\n")[0] || "").trim().slice(0, 80) ||
    "Shared note";

  try {
    // Reuse a blank, just-created note if one is currently selected (cold-start share),
    // otherwise create a fresh note for the shared content.
    const current = state.items.find((x) => x.id === state.selected);
    const isEmptyCurrent = current && !current.title && !current.content;
    if (!isEmptyCurrent) {
      await createNote();
    }
    $("title").value = title;
    $("content").value = text;
    await saveCurrent();
    setMobileView("editor");
    toast("Note created from shared text");
  } catch (e) {
    console.error("share-in: could not save shared note", e);
    toast("Could not save shared note");
  }
}

export function initShareIn() {
  // Warm start: native dispatches this when a share arrives while the app is alive.
  window.addEventListener("notezen:shareready", checkPendingShare);
  // Fallback for cases where the event is missed (e.g. app backgrounded/resumed).
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkPendingShare();
  });
  // Cold start: app was launched by a share intent.
  checkPendingShare();
}
