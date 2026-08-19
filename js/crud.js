import { $, uid, now, esc, toast } from "./utils.js";
import { state } from "./state.js";
import { put, del, updateDbSize } from "./db.js";
import { select, renderAll, renderNotes, modal, closeModal, root, kids, updateMeta } from "./ui.js";
import { driveSync } from "./drive.js";

export async function createNote() {
  let p = state.folder || root()?.id;
  let n = { id: uid(), type: "note", parentId: p, title: "", content: "", createdAt: now(), updatedAt: now() };
  state.items.push(n);
  await put(n);
  await updateDbSize();
  select(n.id);
  $("title").focus();
}

export async function createFolder() {
  modal(`<h2>New Folder</h2><p>Choose a name and a restrained accent color. Folder colors are stored in the note database and included in exports.</p>
  <div class="field"><label>Name</label><input id="folderName" placeholder="Folder name"></div>
  <div class="field"><label>Color</label><select id="folderColor">
  <option value="#777976">Graphite</option><option value="#85877f">Olive Gray</option><option value="#8a8179">Warm Stone</option><option value="#7f8787">Slate</option><option value="#8d7f86">Mauve Gray</option><option value="#777f8a">Blue Gray</option><option value="#8b8171">Sand</option><option value="#696b69">Charcoal</option>
  </select></div>
  <div class="modal-actions"><button id="cancel">Cancel</button><button class="primary" id="create">Create Folder</button></div>`);
  $("cancel").onclick = closeModal;
  $("create").onclick = async () => {
    let name = $("folderName").value.trim();
    if (!name) return toast("Folder name required");
    let f = { id: uid(), type: "folder", parentId: state.folder || root()?.id, name, color: $("folderColor").value, createdAt: now(), updatedAt: now() };
    state.items.push(f);
    state.folder = f.id;
    await put(f);
    await updateDbSize();
    closeModal();
    renderAll();
    toast("Folder created");
  };
  $("folderName").focus();
}

export async function rename(x) {
  if (x.type !== "folder") {
    let n = prompt("Rename", x.title);
    if (!n?.trim()) return;
    x.title = n.trim(); x.updatedAt = now();
    await put(x); await updateDbSize();
    if (x.id === state.selected) select(x.id);
    renderAll();
    return;
  }
  const colors = [["#777976", "Graphite"], ["#85877f", "Olive Gray"], ["#8a8179", "Warm Stone"], ["#7f8787", "Slate"], ["#8d7f86", "Mauve Gray"], ["#777f8a", "Blue Gray"], ["#8b8171", "Sand"], ["#696b69", "Charcoal"]];
  modal(`<h2>Edit Folder</h2><p>Rename the folder or change its subtle accent.</p><div class="field"><label>Name</label><input id="folderName" value="${esc(x.name)}"></div><div class="field"><label>Color</label><select id="folderColor">${colors.map(([c, n]) => `<option value="${c}" ${x.color === c ? "selected" : ""}>${n}</option>`).join("")}</select></div><div class="modal-actions"><button id="cancel">Cancel</button><button class="primary" id="saveFolder">Save</button></div>`);
  $("cancel").onclick = closeModal;
  $("saveFolder").onclick = async () => {
    let n = $("folderName").value.trim();
    if (!n) return toast("Folder name required");
    x.name = n; x.color = $("folderColor").value; x.updatedAt = now();
    await put(x); await updateDbSize();
    closeModal(); renderAll(); toast("Folder updated");
  };
}

export function schedule() {
  clearTimeout(state.timer);
  $("saveState").textContent = "Unsaved";
  state.timer = setTimeout(saveCurrent, 300);
}

export async function saveCurrent() {
  let n = state.items.find(x => x.id === state.selected);
  if (!n) return;
  n.title = $("title").value; n.content = $("content").value; n.updatedAt = now();
  await put(n);
  updateDbSize();
  $("saveState").textContent = "Saved";
  $("date").textContent = new Date(n.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) + "  ·  " + new Date(n.updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  updateMeta(); renderNotes();
  if (state.mode === "drive" && state.driveToken) driveSync(n).catch(console.warn);
}

export async function deleteCurrent() {
  let n = state.items.find(x => x.id === state.selected);
  if (!n) return;
  if (confirm("Delete this note?")) {
    await del(n.id);
    updateDbSize();
    state.items = state.items.filter(x => x.id !== n.id);
    state.selected = null;
    let next = kids(state.folder).find(x => x.type === "note");
    next ? select(next.id) : (state.folder = state.folder, renderAll(), $("title").value = "", $("content").value = "");
  }
}
