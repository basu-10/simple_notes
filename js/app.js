import { $, uid, now, toast } from "./utils.js";
import { state } from "./state.js";
import { openDB, all, setting, put, updateDbSize } from "./db.js";
import {
  select, renderAll, renderModelOptions, renderAI, setMobileView,
  updateMeta, search, root, closeModal, renderTrash, modal, cycleNote
} from "./ui.js";
import {
  createNote, createFolder, schedule, saveCurrent, deleteCurrent
} from "./crud.js";
import { setMode } from "./drive.js";
import { settings, askAI } from "./ai.js";
import { exportData, importData } from "./export-import.js";

$("newNote").onclick = createNote;
$("newFolderBtn").onclick = createFolder;
document.querySelectorAll("#mobileNav button").forEach(b => b.onclick = () => setMobileView(b.dataset.view));
$("export").onclick = exportData;
$("import").onclick = () => $("importFile").click();
$("importFile").onchange = e => e.target.files[0] && importData(e.target.files[0]);
$("localMode").onclick = () => setMode("local");
$("driveMode").onclick = () => setMode("drive");
$("settings").onclick = settings;
$("askAI").onclick = askAI;
$("aiSetupBtn").onclick = settings;
$("title").oninput = schedule;
$("content").oninput = () => { updateMeta(); schedule(); };
$("search").oninput = e => search(e.target.value);
$("delete").onclick = deleteCurrent;
$("star").onclick = () => toast("Star saved for this note");
$("theme").onclick = () => toast("Monochrome appearance is fixed");
$("back").onclick = () => cycleNote(-1);
$("forward").onclick = () => cycleNote(1);
$("modalBackdrop").onclick = e => e.target === e.currentTarget && closeModal();
$("trashBtn").onclick = () => { state.inTrash = !state.inTrash; state.inTrash ? renderTrash() : renderAll(); };
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
  state.endpoints = await setting("endpoints") || [];
  state.orKey = await setting("orKey") || "";
  renderModelOptions();
  renderAI();
  let n = state.items.find(x => x.type === "note");
  n ? select(n.id) : await createNote();
  if (await setting("mode") === "drive") setMode("drive");
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
