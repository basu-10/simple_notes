import { $, uid, now, esc, toast } from "./utils.js";
import { state } from "./state.js";
import { put, del, updateDbSize, softDelete, restore, purge, getTrash } from "./db.js";
import { select, renderAll, renderNotes, modal, closeModal, root, kids, updateMeta, openMenu } from "./ui.js";
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
    let f = { id: uid(), type: "folder", parentId: state.folder, name, color: $("folderColor").value, createdAt: now(), updatedAt: now() };
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
    modal(`<h2>Rename note</h2><div class="field"><label>Title</label><input id="noteTitle" value="${esc(x.title)}"></div><div class="modal-actions"><button id="cancel">Cancel</button><button class="primary" id="saveNote">Save</button></div>`);
    $("cancel").onclick = closeModal;
    $("saveNote").onclick = async () => {
      let t = $("noteTitle").value.trim();
      x.title = t; x.updatedAt = now();
      await put(x); await updateDbSize();
      if (x.id === state.selected) select(x.id);
      closeModal(); renderAll(); toast("Renamed");
    };
    $("noteTitle").focus();
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
  await deleteNote(n);
}

export async function deleteNote(x) {
  if (!confirm("Move note to Trash?")) return;
  await softDelete(x.id);
  await updateDbSize();
  // Update in-memory item instead of removing
  const idx = state.items.findIndex(i => i.id === x.id);
  if (idx >= 0) state.items[idx].deletedAt = new Date().toISOString();
  if (state.selected === x.id) {
    state.selected = null;
    let next = kids(state.folder).find(i => i.type === "note" && !i.deletedAt);
    next ? select(next.id) : (state.folder = state.folder, renderAll(), $("title").value = "", $("content").value = "");
  } else {
    renderAll();
  }
  toast("Note moved to Trash");
}

export async function deleteFolder(f) {
  let children = kids(f.id);
  let msg = children.length
    ? `Move "${f.name}" and its ${children.length} item(s) to Trash?`
    : `Move folder "${f.name}" to Trash?`;
  if (!confirm(msg)) return;
  await softDelete(f.id);
  for (let c of children) { await softDelete(c.id); }
  await updateDbSize();
  // Update in-memory items instead of removing
  const fIdx = state.items.findIndex(i => i.id === f.id);
  if (fIdx >= 0) state.items[fIdx].deletedAt = new Date().toISOString();
  for (let c of children) {
    const cIdx = state.items.findIndex(i => i.id === c.id);
    if (cIdx >= 0) state.items[cIdx].deletedAt = new Date().toISOString();
  }
  if (state.folder === f.id) state.folder = f.parentId ?? null;
  renderAll();
  toast("Folder moved to Trash");
}

export async function restoreFromTrash(id) {
  await restore(id);
  await updateDbSize();
  renderAll();
  toast("Restored from Trash");
}

export async function purgeFromTrash(id) {
  if (!confirm("Permanently delete?")) return;
  await purge(id);
  await updateDbSize();
  renderAll();
  toast("Permanently deleted");
}

export async function emptyTrash() {
  const trash = await getTrash();
  if (!trash.length) return toast("Trash is empty");
  if (!confirm(`Permanently delete ${trash.length} item(s)?`)) return;
  for (const x of trash) await purge(x.id);
  await updateDbSize();
  renderAll();
  toast("Trash emptied");
}

export async function duplicateNote(x) {
  let copy = {
    id: uid(), type: "note", parentId: x.parentId,
    title: x.title ? x.title + " (copy)" : "Untitled note",
    content: x.content || "", createdAt: now(), updatedAt: now()
  };
  state.items.push(copy);
  await put(copy);
  await updateDbSize();
  renderAll();
  select(copy.id);
  toast("Note duplicated");
}

export async function moveNote(x) {
  const folders = state.items.filter(f => f.type === "folder").sort((a, b) => a.name.localeCompare(b.name));
  modal(`<h2>Move note</h2><p>Choose the destination folder.</p><div class="folder-picker" id="picker"></div><div class="modal-actions"><button id="cancel">Cancel</button></div>`);
  const picker = $("picker");
  folders.forEach(f => {
    const row = document.createElement("button");
    row.className = "picker-row" + (f.id === x.parentId ? " current" : "");
    row.innerHTML = `<span class="folder-dot" style="background:${f.color || "#777976"}"></span><span>${esc(f.name)}</span>` +
      (f.id === x.parentId ? `<small>(current)</small>` : "");
    row.onclick = async () => {
      x.parentId = f.id; x.updatedAt = now();
      await put(x); await updateDbSize();
      if (state.selected === x.id) state.folder = f.id;
      closeModal(); renderAll();
      toast("Moved to " + f.name);
    };
    picker.appendChild(row);
  });
  $("cancel").onclick = closeModal;
}
