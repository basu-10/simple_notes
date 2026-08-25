import { $, uid, now, esc, toast } from "./utils.js";
import { state } from "./state.js";
import { put, del, updateDbSize, softDelete, restore, purge, getTrash, gcAssets } from "./db.js";
import { select, renderAll, renderNotes, modal, closeModal, root, kids, updateMeta, openMenu, updateStar, isDescendant, setMobileView, updateEditorVisibility } from "./ui.js";
import { setContent, getContent } from "./editor.js";

const FOLDER_COLORS = [["#4b8fe6", "Blue"], ["#5bbf6a", "Green"], ["#e6c14b", "Gold"], ["#ec9a4b", "Orange"], ["#e3555a", "Coral"], ["#e06fa8", "Pink"], ["#8a6fe0", "Violet"], ["#3fb7ab", "Teal"]];

function colorGrid(selected) {
  return `<div class="color-grid" id="colorGrid">${FOLDER_COLORS.map(([c, n]) => `<button type="button" class="swatch${selected === c ? " selected" : ""}" data-c="${c}" style="background:${c}" title="${n}"></button>`).join("")}</div>`;
}

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
  const defaultColor = FOLDER_COLORS[0][0];
  modal(`<h2>New Folder</h2><p>Choose a name and a restrained accent color. Folder colors are stored in the note database and included in exports.</p>
  <div class="field"><label>Name</label><input id="folderName" placeholder="Folder name"></div>
  <div class="field"><label>Color</label>${colorGrid(defaultColor)}</div>
  <div class="modal-actions"><button id="cancel">Cancel</button><button class="primary" id="create">Create Folder</button></div>`);
  $("cancel").onclick = closeModal;
  let color = defaultColor;
  const grid = $("colorGrid");
  grid.querySelectorAll(".swatch").forEach(s => {
    s.onclick = () => {
      color = s.dataset.c;
      grid.querySelectorAll(".swatch").forEach(o => o.classList.toggle("selected", o === s));
    };
  });
  $("create").onclick = async () => {
    let name = $("folderName").value.trim();
    if (!name) return toast("Folder name required");
    let f = { id: uid(), type: "folder", parentId: state.folder, name, color, createdAt: now(), updatedAt: now() };
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
  const initColor = x.color || FOLDER_COLORS[0][0];
  modal(`<h2>Edit Folder</h2><p>Rename the folder or change its subtle accent.</p><div class="field"><label>Name</label><input id="folderName" value="${esc(x.name)}"></div><div class="field"><label>Color</label>${colorGrid(initColor)}</div><div class="modal-actions"><button id="cancel">Cancel</button><button class="primary" id="saveFolder">Save</button></div>`);
  $("cancel").onclick = closeModal;
  let color = initColor;
  const grid = $("colorGrid");
  grid.querySelectorAll(".swatch").forEach(s => {
    s.onclick = () => {
      color = s.dataset.c;
      grid.querySelectorAll(".swatch").forEach(o => o.classList.toggle("selected", o === s));
    };
  });
  $("saveFolder").onclick = async () => {
    let n = $("folderName").value.trim();
    if (!n) return toast("Folder name required");
    x.name = n; x.color = color; x.updatedAt = now();
    await put(x); await updateDbSize();
    closeModal(); renderAll(); toast("Folder updated");
  };
}

export function schedule() {
  clearTimeout(state.timer);
  $("saveDot").classList.add("dirty");
  state.timer = setTimeout(saveCurrent, 300);
}

export async function saveCurrent() {
  let n = state.items.find(x => x.id === state.selected);
  if (!n) return;
  n.title = $("title").value; n.content = getContent(); n.updatedAt = now();
  await put(n);
  updateDbSize();
  $("saveDot").classList.remove("dirty");
  $("date").textContent = new Date(n.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) + "  ·  " + new Date(n.updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  updateMeta(); renderNotes();
  if (state.mode === "drive" && state.driveToken) driveSync(n).catch(console.warn);
}

export async function toggleFavorite(x) {
  x.favorite = !x.favorite;
  await put(x);
  await updateDbSize();
  if (x.id === state.selected) updateStar();
  renderAll();
  if (state.mode === "drive" && state.driveToken) driveSync(x).catch(console.warn);
  toast(x.favorite ? "Added to Favorites" : "Removed from Favorites");
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
    if (next) {
      select(next.id);
    } else {
      renderAll();
      await setContent("");
      updateEditorVisibility();
      if (innerWidth <= 700) setMobileView("files");
    }
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

export async function changeFolderColor(f) {
  const initColor = f.color || FOLDER_COLORS[0][0];
  modal(`<h2>Folder color</h2><p>Pick a subtle accent for "${esc(f.name)}".</p><div class="field"><label>Color</label>${colorGrid(initColor)}</div><div class="modal-actions"><button id="cancel">Cancel</button></div>`);
  $("cancel").onclick = closeModal;
  $("colorGrid").querySelectorAll(".swatch").forEach(s => {
    s.onclick = async () => {
      f.color = s.dataset.c; f.updatedAt = now();
      await put(f); await updateDbSize();
      closeModal(); renderAll(); toast("Folder color updated");
    };
  });
}

export async function duplicateFolder(f) {
  let children = kids(f.id);
  let msg = children.length
    ? `Duplicate "${f.name}" and its ${children.length} item(s)?`
    : `Duplicate folder "${f.name}"?`;
  if (!confirm(msg)) return;
  const make = async (src, parentId) => {
    let copy = { ...src, id: uid(), parentId, createdAt: now(), updatedAt: now() };
    delete copy.deletedAt;
    if (src.id === f.id) copy.name = src.name + " (copy)";
    state.items.push(copy);
    await put(copy);
    for (let c of kids(src.id)) await make(c, copy.id);
  };
  await make(f, f.parentId);
  await updateDbSize();
  renderAll();
  toast("Folder duplicated");
}

export async function moveFolder(f) {
  const folders = state.items
    .filter(x => x.type === "folder" && x.id !== f.id && !isDescendant(x.id, f.id) && !x.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name));
  modal(`<h2>Move folder</h2><p>Choose the destination folder.</p><div class="folder-picker" id="picker"></div><div class="modal-actions"><button id="cancel">Cancel</button></div>`);
  const picker = $("picker");
  const addRow = (id, name, color, current) => {
    const row = document.createElement("button");
    row.className = "picker-row" + (current ? " current" : "");
    row.innerHTML = `<span class="folder-dot" style="background:${color || "#4b8fe6"}"></span><span>${esc(name)}</span>` +
      (current ? `<small>(current)</small>` : "");
    row.onclick = async () => {
      f.parentId = id; f.updatedAt = now();
      await put(f); await updateDbSize();
      if (state.folder === f.id) state.folder = id;
      closeModal(); renderAll();
      toast("Moved to " + name);
    };
    picker.appendChild(row);
  };
  addRow(null, "Top level", "#4b8fe6", f.parentId == null);
  folders.forEach(x => addRow(x.id, x.name, x.color, x.id === f.parentId));
  $("cancel").onclick = closeModal;
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
  await gcAssets();
  await updateDbSize();
  renderAll();
  toast("Permanently deleted");
}

export async function emptyTrash() {
  const trash = await getTrash();
  if (!trash.length) return toast("Trash is empty");
  if (!confirm(`Permanently delete ${trash.length} item(s)?`)) return;
  for (const x of trash) await purge(x.id);
  await gcAssets();
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
    row.innerHTML = `<span class="folder-dot" style="background:${f.color || "#4b8fe6"}"></span><span>${esc(f.name)}</span>` +
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
