import { $, esc, toast, stripHtml } from "./utils.js";
import { state } from "./state.js";
import { setContent, getContent } from "./editor.js";
import { rename, moveNote, duplicateNote, deleteNote, deleteFolder, restoreFromTrash, purgeFromTrash, emptyTrash, toggleFavorite, changeFolderColor, duplicateFolder, moveFolder } from "./crud.js";
import { getTrash } from "./db.js";

export function kids(id) {
  return state.items.filter(x => x.parentId === id && !x.deletedAt);
}

const FILE_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
const SUBFOLDER_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

export function root() {
  return state.items.find(x => x.type === "folder" && !x.parentId && !x.deletedAt);
}

export function path(id) {
  let a = [], x = state.items.find(y => y.id === id);
  while (x) { a.unshift(x.name); x = x.parentId ? state.items.find(y => y.id === x.parentId) : null; }
  return a.join(" / ");
}

function sortNotes(arr) {
  const s = state.sort;
  const nameOf = x => (x.title || x.name || "");
  const colorOf = x => (x.color || state.items.find(i => i.id === x.parentId)?.color || "#4b8fe6");
  const cmp = (a, b) => {
    switch (s) {
      case "created": return b.createdAt.localeCompare(a.createdAt);
      case "title": return nameOf(a).localeCompare(nameOf(b));
      case "color": return colorOf(a).localeCompare(colorOf(b)) || b.updatedAt.localeCompare(a.updatedAt);
      case "modified":
      default: return b.updatedAt.localeCompare(a.updatedAt);
    }
  };
  return [...arr].sort(cmp);
}

function emptyState(parent, msg) {
  const e = document.createElement("div");
  e.className = "empty-state";
  e.textContent = msg;
  parent.appendChild(e);
}

function breadcrumb(folderId) {
  const wrap = document.createElement("div");
  wrap.className = "crumb";
  const trail = [];
  let x = state.items.find(y => y.id === folderId);
  while (x) { trail.unshift(x); x = x.parentId ? state.items.find(y => y.id === x.parentId) : null; }
  if (trail.length <= 1) return wrap;
  trail.forEach((item, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.textContent = "›";
      wrap.appendChild(sep);
    }
    const c = document.createElement("button");
    c.className = "crumb-item" + (i === trail.length - 1 ? " current" : "");
    c.textContent = item.name;
    if (i < trail.length - 1) c.onclick = () => {
      state.selected = null; state.folder = item.id; state.showFavorites = false; renderAll();
      if (innerWidth <= 700) setMobileView("files");
    };
    wrap.appendChild(c);
  });
  return wrap;
}

function folderRow(f) {
  const row = document.createElement("div");
  row.className = "folder-row";
  row.style.setProperty("--folder-color", f.color || "#4b8fe6");
  const icon = document.createElement("span"); icon.className = "folder-icon";
  const name = document.createElement("span"); name.className = "folder-name"; name.textContent = f.name;
  const counts = document.createElement("span"); counts.className = "counts";
  const noteCount = kids(f.id).filter(x => x.type === "note").length;
  const subFolderCount = kids(f.id).filter(x => x.type === "folder").length;
  if (noteCount) {
    const b = document.createElement("span");
    b.className = "count-badge";
    b.title = noteCount + " note" + (noteCount === 1 ? "" : "s");
    b.innerHTML = FILE_ICON_SVG + `<span>${noteCount}</span>`;
    counts.appendChild(b);
  }
  if (subFolderCount) {
    const b = document.createElement("span");
    b.className = "count-badge";
    b.title = subFolderCount + " folder" + (subFolderCount === 1 ? "" : "s");
    b.innerHTML = SUBFOLDER_ICON_SVG + `<span>${subFolderCount}</span>`;
    counts.appendChild(b);
  }
  const rowChildren = [icon, name];
  if (counts.childElementCount) rowChildren.push(counts);
  row.append(...rowChildren);
  row.onclick = () => { state.selected = null; state.folder = f.id; state.showFavorites = false; renderAll(); if (innerWidth <= 700) setMobileView("files"); };
  row.ondblclick = () => rename(f);
  longPress(row, (cx, cy) => openMenu(cx, cy, folderMenu(f)));
  return row;
}

function noteCard(x) {
  const card = document.createElement("div"); card.className = "note-card " + (x.id === state.selected ? "active" : "") + (x.favorite ? " is-fav" : "");
  const head = document.createElement("div"); head.className = "note-title";
  const title = document.createElement("span"); title.textContent = x.title || "Untitled note";
  const date = document.createElement("span"); date.className = "note-date";
  date.textContent = new Date(x.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  head.append(title, date);
  const preview = document.createElement("div"); preview.className = "note-preview";
  preview.textContent = stripHtml(x.content).slice(0, 110);
  const star = document.createElement("button"); star.className = "card-star" + (x.favorite ? " on" : ""); star.title = x.favorite ? "Remove from Favorites" : "Add to Favorites";
  star.textContent = x.favorite ? "★" : "☆";
  star.onclick = (e) => {
    e.stopPropagation();
    toggleFavorite(x);
  };
  card.append(head, preview, star);
  card.onclick = () => select(x.id);
  card.ondblclick = () => rename(x);
  longPress(card, (cx, cy) => openMenu(cx, cy, noteMenu(x)));
  return card;
}

function groupLabel(text) {
  const lbl = document.createElement("div");
  lbl.className = "group-label";
  lbl.textContent = text;
  return lbl;
}

export function renderExplorer() {
  const ex = $("explorer");
  ex.innerHTML = "";
  ex.dataset.view = state.view;
  const shell = document.querySelector(".shell");
  if (shell) shell.classList.toggle("no-selection", !state.selected);
  if (state.showFavorites) {
    const favCount = state.items.filter(x => x.type === "note" && x.favorite && !x.deletedAt).length;
    $("folderTitle").textContent = "Favorites";
    $("folderCount").textContent = favCount + " note" + (favCount === 1 ? "" : "s");
    if (!favCount) { emptyState(ex, "No favorites yet — tap the star on a note to add it here."); return; }
    const wrap = document.createElement("div"); wrap.className = "view-wrap";
    sortNotes(state.items.filter(x => x.type === "note" && x.favorite && !x.deletedAt))
      .forEach(x => wrap.appendChild(noteCard(x)));
    ex.appendChild(wrap);
    return;
  }
  const folderId = state.folder || root()?.id;
  const folder = state.items.find(x => x.id === folderId);
  $("folderTitle").textContent = folder?.name || "All Folders";
  const folders = sortNotes(kids(folderId).filter(x => x.type === "folder"));
  const allNotes = kids(folderId).filter(x => x.type === "note");
  const notes = [
    ...allNotes.filter(x => x.favorite),
    ...sortNotes(allNotes.filter(x => !x.favorite))
  ];
  $("folderCount").textContent = notes.length + " note" + (notes.length === 1 ? "" : "s");
  const bc = breadcrumb(folderId);
  if (bc.childElementCount) ex.appendChild(bc);
  const favCount = state.items.filter(x => x.type === "note" && x.favorite && !x.deletedAt).length;
  if (favCount) {
    const favRow = document.createElement("div");
    favRow.className = "folder-row fav-entry";
    const star = document.createElement("span"); star.className = "fav-star"; star.textContent = "★";
    const name = document.createElement("span"); name.className = "folder-name"; name.textContent = "Favorites";
    const count = document.createElement("span"); count.className = "count"; count.textContent = favCount;
    favRow.append(star, name, count);
    favRow.onclick = () => { state.showFavorites = true; state.folder = null; renderAll(); };
    ex.appendChild(favRow);
  }
  if (folders.length) {
    ex.appendChild(groupLabel("Folders"));
    const wrap = document.createElement("div"); wrap.className = "view-wrap";
    folders.forEach(f => wrap.appendChild(folderRow(f)));
    ex.appendChild(wrap);
  }
  if (notes.length) {
    ex.appendChild(groupLabel("Notes"));
    const wrap = document.createElement("div"); wrap.className = "view-wrap";
    notes.forEach(x => wrap.appendChild(noteCard(x)));
    ex.appendChild(wrap);
  }
  if (!folders.length && !notes.length) emptyState(ex, "Nothing here yet — create a note or folder.");
}

export function renderNotes() { renderExplorer(); }

export function renderAll() { renderExplorer(); }

export function renderTrash() {
  const list = $("explorer");
  list.innerHTML = "";
  $("folderTitle").textContent = "Trash";
  const trash = state.items.filter(x => x.deletedAt).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  $("folderCount").textContent = trash.length + " item" + (trash.length === 1 ? "" : "s");
  if (!trash.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Trash is empty";
    list.appendChild(empty);
    return;
  }
  trash.forEach((x, i) => {
    const card = document.createElement("div"); card.className = "note-card trash-card";
    const head = document.createElement("div"); head.className = "note-title";
    const title = document.createElement("span"); title.textContent = (x.type === "folder" ? "📁 " : "") + (x.title || x.name || "Untitled");
    const date = document.createElement("span"); date.className = "note-date";
    date.textContent = "Deleted " + new Date(x.deletedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    head.append(title, date);
    const preview = document.createElement("div"); preview.className = "note-preview";
    preview.textContent = x.type === "note" ? stripHtml(x.content).slice(0, 110) : `${kids(x.id).length} items`;
    const actions = document.createElement("div"); actions.className = "trash-actions";
    const restoreBtn = document.createElement("button"); restoreBtn.className = "raised"; restoreBtn.textContent = "Restore";
    restoreBtn.onclick = (e) => { e.stopPropagation(); restoreFromTrash(x.id); };
    const purgeBtn = document.createElement("button"); purgeBtn.className = "raised danger"; purgeBtn.textContent = "Delete forever";
    purgeBtn.onclick = (e) => { e.stopPropagation(); purgeFromTrash(x.id); };
    actions.append(restoreBtn, purgeBtn);
    card.append(head, preview, actions);
    list.appendChild(card);
    if (i < trash.length - 1) { const d = document.createElement("div"); d.className = "note-divider"; list.appendChild(d); }
  });
}

export function setMobileView(view) {
  document.querySelector(".shell").dataset.mobileView = view;
  document.querySelectorAll("#mobileNav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
}

export async function select(id) {
  state.selected = id;
  let n = state.items.find(x => x.id === id); if (!n) return;
  state.folder = n.parentId;
  state.showFavorites = false;
  $("title").value = n.title;
  await setContent(n.content);
  $("date").textContent = new Date(n.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) + "  ·  " + new Date(n.updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  updateMeta(); renderAll(); updateStar();
  if (innerWidth <= 700) setMobileView("editor");
}

export function updateStar() {
  const el = $("star");
  if (!el) return;
  const n = state.items.find(x => x.id === state.selected);
  const on = !!(n && n.favorite);
  el.textContent = on ? "★" : "☆";
  el.classList.toggle("on", on);
  el.title = on ? "Remove from Favorites" : "Add to Favorites";
}

export function cycleNote(dir) {
  const folderId = state.folder || root()?.id;
  const allNotes = kids(folderId).filter(x => x.type === "note");
  const notes = [...allNotes.filter(x => x.favorite), ...sortNotes(allNotes.filter(x => !x.favorite))];
  if (!notes.length) return;
  let i = notes.findIndex(x => x.id === state.selected);
  let n = (i === -1 ? (dir > 0 ? -1 : 0) : i) + dir;
  n = (n + notes.length) % notes.length;
  select(notes[n].id);
}

export function updateMeta() {
  $("meta").textContent = getContent().length.toLocaleString() + " characters";
}

export function modal(html) {
  $("modal").innerHTML = html;
  $("modalBackdrop").classList.add("open");
}

export function closeModal() {
  $("modalBackdrop").classList.remove("open");
}

const ICONS = {
  rename: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  move: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  color: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/></svg>'
};

export function isDescendant(candidateId, ancestorId) {
  let x = state.items.find(i => i.id === candidateId);
  while (x && x.parentId) {
    if (x.parentId === ancestorId) return true;
    x = state.items.find(i => i.id === x.parentId);
  }
  return false;
}

export function openMenu(x, y, items) {
  const m = $("contextMenu");
  m.innerHTML = "";
  items.forEach(it => {
    const b = document.createElement("button");
    b.className = "ctx-item" + (it.danger ? " danger" : "");
    b.innerHTML = (it.icon ? ICONS[it.icon] : "") + `<span>${esc(it.label)}</span>`;
    b.onclick = () => { closeMenu(); it.onClick(); };
    m.appendChild(b);
  });
  m.style.display = "block";
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + "px";
  m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + "px";
  requestAnimationFrame(() => $("ctxBackdrop").classList.add("open"));
  $("ctxBackdrop").onclick = closeMenu;
  window.addEventListener("scroll", closeMenu, { once: true, passive: true });
  window.addEventListener("resize", closeMenu, { once: true });
}

export function closeMenu() {
  const m = $("contextMenu");
  if (m) m.style.display = "none";
  const b = $("ctxBackdrop");
  if (b) b.classList.remove("open");
}

export function noteMenu(x) {
  return [
    { label: "Move to…", icon: "move", onClick: () => moveNote(x) },
    { label: "Duplicate", icon: "copy", onClick: () => duplicateNote(x) },
    { label: "Rename", icon: "rename", onClick: () => rename(x) },
    { label: "Delete", icon: "trash", danger: true, onClick: () => deleteNote(x) }
  ];
}

export function folderMenu(f) {
  return [
    { label: "Change color", icon: "color", onClick: () => changeFolderColor(f) },
    { label: "Move to…", icon: "move", onClick: () => moveFolder(f) },
    { label: "Duplicate", icon: "copy", onClick: () => duplicateFolder(f) },
    { label: "Rename", icon: "rename", onClick: () => rename(f) },
    { label: "Delete", icon: "trash", danger: true, onClick: () => deleteFolder(f) }
  ];
}

export function longPress(el, fn) {
  let t, sx = 0, sy = 0, fired = false;
  el.addEventListener("touchstart", e => {
    const p = e.touches[0];
    sx = p.clientX; sy = p.clientY; fired = false;
    t = setTimeout(() => { fired = true; fn(sx, sy); }, 480);
  }, { passive: true });
  el.addEventListener("touchmove", e => {
    const p = e.touches[0];
    if (Math.abs(p.clientX - sx) > 10 || Math.abs(p.clientY - sy) > 10) clearTimeout(t);
  }, { passive: true });
  el.addEventListener("touchend", () => clearTimeout(t));
  el.addEventListener("click", e => { if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; } }, true);
  el.addEventListener("contextmenu", e => { e.preventDefault(); const p = e; fn(p.clientX, p.clientY); });
}

export function search(q) {
  q = q.trim().toLowerCase();
  state.showFavorites = false;
  let notes = q ? state.items.filter(x => x.type === "note" && ((x.title + " " + stripHtml(x.content)).toLowerCase().includes(q))) : [];
  let list = $("explorer");
  if (!q) return renderNotes();
  list.innerHTML = "";
  $("folderTitle").textContent = "Search";
  $("folderCount").textContent = notes.length + " matches";
  notes.forEach(x => {
    let r = document.createElement("div"); r.className = "note-card";
    r.innerHTML = '<div class="note-title"><span>' + esc(x.title || "Untitled note") + '</span></div><div class="note-preview">' + esc(stripHtml(x.content).slice(0, 130)) + "</div>";
    r.onclick = () => select(x.id);
    list.appendChild(r);
  });
}


