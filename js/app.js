import { $, uid, now, toast } from "./utils.js";
import { state } from "./state.js";
import { openDB, all, setting, put, updateDbSize } from "./db.js";
import {
  select, renderAll, setMobileView,
  updateMeta, search, root, closeModal, renderTrash, modal, cycleNote
} from "./ui.js";
import {
  createNote, createFolder, schedule, saveCurrent, deleteNote, toggleFavorite
} from "./crud.js";
import { setMode } from "./drive.js";
import { exportData, importData } from "./export-import.js";
import { initTheme, cycleTheme } from "./theme.js";
import { initShareIn } from "./share-in.js";
import { initEditor, onEditorChange, isEditorReady } from "./editor.js";

$("newNote").onclick = createNote;
$("newFolderBtn").onclick = createFolder;
document.querySelectorAll("#mobileNav button").forEach(b => b.onclick = () => setMobileView(b.dataset.view));

const SWIPE_VIEWS = ["folders", "notes", "editor"];
let swipeX = 0, swipeY = 0, swipeT = 0;
const shellEl = document.querySelector(".shell");
shellEl.addEventListener("touchstart", e => {
  const t = e.changedTouches[0];
  swipeX = t.clientX; swipeY = t.clientY; swipeT = Date.now();
}, { passive: true });
shellEl.addEventListener("touchend", e => {
  if (innerWidth > 700) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - swipeX, dy = t.clientY - swipeY;
  if (Date.now() - swipeT > 700) return;
  if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
  const cur = SWIPE_VIEWS.indexOf(shellEl.dataset.mobileView || "folders");
  const next = dx < 0 ? Math.min(SWIPE_VIEWS.length - 1, cur + 1) : Math.max(0, cur - 1);
  if (next !== cur) setMobileView(SWIPE_VIEWS[next]);
}, { passive: true });
$("export").onclick = exportData;
$("import").onclick = () => $("importFile").click();
$("importFile").onchange = e => e.target.files[0] && importData(e.target.files[0]);
$("localMode").onclick = () => setMode("local");
$("driveMode").onclick = () => setMode("drive");
$("title").oninput = schedule;
// Note content is driven by CKEditor (see editor.js). When the rich-text editor is
// unavailable (e.g. jsdom), fall back to the plain textarea input.
if (!isEditorReady()) {
  $("content").oninput = () => { updateMeta(); schedule(); };
}
$("search").oninput = e => search(e.target.value);
$("delete").onclick = () => {
  const n = state.items.find(x => x.id === state.selected);
  if (!n) return toast("Select a note first");
  deleteNote(n);
};
$("star").onclick = () => {
  const n = state.items.find(x => x.id === state.selected);
  if (!n) return toast("Select a note first");
  toggleFavorite(n);
};
$("theme").onclick = cycleTheme;
const MAX_ICON = '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>';
const MIN_ICON = '<path d="M3 8h3a2 2 0 0 1 2 2v3M21 8h-3a2 2 0 0 0-2 2v3M3 16h3a2 2 0 0 0 2-2v-3M21 16h-3a2 2 0 0 1-2-2v-3"/>';
function applyMaximize(on) {
  const shell = document.querySelector(".shell");
  if (!shell) return;
  shell.classList.toggle("max", on);
  const b = $("maximize");
  if (b) {
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.title = on ? "Exit focus mode" : "Focus mode (collapse panels)";
    const s = b.querySelector("svg");
    if (s) s.innerHTML = on ? MIN_ICON : MAX_ICON;
  }
  try { localStorage.setItem("notezen-max", on ? "1" : "0"); } catch (e) {}
}
$("maximize").onclick = () => applyMaximize(!document.querySelector(".shell").classList.contains("max"));
try { if (localStorage.getItem("notezen-max") === "1") applyMaximize(true); } catch (e) {}
$("back").onclick = () => cycleNote(-1);
$("forward").onclick = () => cycleNote(1);
$("modalBackdrop").onclick = e => e.target === e.currentTarget && closeModal();
$("trashBtn").onclick = () => { state.inTrash = !state.inTrash; state.showFavorites = false; state.inTrash ? renderTrash() : renderAll(); };
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") { e.preventDefault(); e.shiftKey ? createFolder() : createNote(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("search").focus(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveCurrent(); }
  if ((e.ctrlKey || e.metaKey) && e.key === "/") { e.preventDefault(); showShortcuts(); }
  if (e.key === "Escape") { closeModal(); if (state.inTrash) { state.inTrash = false; renderAll(); } }
});

function showShortcuts() {
  modal(`<h2>Keyboard Shortcuts</h2>
  <table class="shortcuts">
    <tr><td>⌘ N</td><td>New note</td></tr>
    <tr><td>⌘ ⇧ N</td><td>New folder</td></tr>
    <tr><td>⌘ K</td><td>Focus search</td></tr>
    <tr><td>⌘ S</td><td>Save note</td></tr>
    <tr><td>⌘ /</td><td>Show this help</td></tr>
    <tr><td>Esc</td><td>Close dialog / Exit trash</td></tr>
  </table>
  <div class="modal-actions"><button class="primary" id="close">Close</button></div>`);
  $("close").onclick = closeModal;
}

(async () => {
  await openDB();
  await initTheme();
  await initEditor();
  onEditorChange(() => { updateMeta(); schedule(); });
  state.items = await all();
  state.items.filter(x => x.type === "folder" && !x.color).forEach(x => x.color = "#777976");
  if (!state.items.some(x => x.type === "folder" && !x.parentId)) {
    let f = { id: uid(), type: "folder", parentId: null, name: "Personal", color: "#777976", createdAt: now(), updatedAt: now() };
    state.items.push(f);
    await put(f);
  }
  state.folder = root().id;
  setMobileView("folders");
  updateDbSize();
  let n = state.items.find(x => x.type === "note");
  n ? select(n.id) : await createNote();
  if (await setting("mode") === "drive") setMode("drive");
  initShareIn();
})().catch(e => { console.error(e); toast("Could not initialize"); });

if ("serviceWorker" in navigator) {
  let reg;
  addEventListener("load", async () => {
    reg = await navigator.serviceWorker.register("sw.js").catch(err => console.warn("SW registration failed", err));
    if (!reg) return;
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          toast("Update available — refresh to apply", 10000);
        }
      });
    });
    // Check for updates every 30 min
    setInterval(() => reg.update(), 30 * 60 * 1000);
  });
  // Listen for controller change (update applied)
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}
