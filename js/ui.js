import { $, esc, toast } from "./utils.js";
import { state } from "./state.js";
import { rename, moveNote, duplicateNote, deleteNote, deleteFolder, restoreFromTrash, purgeFromTrash, emptyTrash, toggleFavorite } from "./crud.js";
import { getTrash } from "./db.js";

export function kids(id) {
  return state.items.filter(x => x.parentId === id && !x.deletedAt);
}

export function root() {
  return state.items.find(x => x.type === "folder" && !x.parentId && !x.deletedAt);
}

export function path(id) {
  let a = [], x = state.items.find(y => y.id === id);
  while (x) { a.unshift(x.name); x = x.parentId ? state.items.find(y => y.id === x.parentId) : null; }
  return a.join(" / ");
}

export function renderTree() {
  const t = $("tree");
  t.innerHTML = "";
  const favCount = state.items.filter(x => x.type === "note" && x.favorite && !x.deletedAt).length;
  const favRow = document.createElement("div");
  favRow.className = "tree-row fav-row" + (state.showFavorites ? " active" : "");
  favRow.innerHTML = `<span class="folder-color fav-star" style="--folder-color:#b89a52">★</span><span class="fav-label">Favorites</span><span class="count">${favCount}</span>`;
  favRow.onclick = () => {
    state.showFavorites = true;
    state.folder = null;
    renderAll();
    if (innerWidth <= 700) setMobileView("notes");
  };
  t.appendChild(favRow);
  function ensurePath(id) {
    let x = state.items.find(y => y.id === id);
    while (x) { state.expanded.add(x.id); x = x.parentId ? state.items.find(y => y.id === x.parentId) : null; }
  }
  if (state.folder) ensurePath(state.folder);
  function draw(parentId, depth) {
    const folders = kids(parentId).filter(x => x.type === "folder").sort((a, b) => a.name.localeCompare(b.name));
    folders.forEach(f => {
      const row = document.createElement("div");
      row.className = "tree-row " + (state.folder === f.id ? "active" : "");
      row.style.paddingLeft = (10 + depth * 15) + "px";
      const twist = document.createElement("span"); twist.className = "twisty";
      const hasKids = kids(f.id).length > 0;
      const open = state.expanded.has(f.id) || !f.parentId;
      twist.textContent = hasKids ? (open ? "⌄" : "›") : "";
      const color = document.createElement("span"); color.className = "folder-color";
      color.style.setProperty("--folder-color", f.color || "#777976");
      const icon = document.createElement("span"); icon.className = "folder-icon";
      const name = document.createElement("span"); name.textContent = f.name;
      const count = document.createElement("span"); count.className = "count";
      count.textContent = kids(f.id).filter(x => x.type === "note").length;
      const kebab = document.createElement("button"); kebab.className = "row-menu"; kebab.title = "Folder actions";
      kebab.innerHTML = "&#8942;";
      kebab.onclick = (e) => {
        e.stopPropagation();
        const r = kebab.getBoundingClientRect();
        openMenu(r.right - 4, r.bottom + 4, folderMenu(f));
      };
      row.append(twist, color, icon, name, count, kebab);
      twist.onclick = (e) => {
        e.stopPropagation();
        if (!hasKids) return;
        if (state.expanded.has(f.id)) state.expanded.delete(f.id);
        else state.expanded.add(f.id);
        renderAll();
      };
      row.onclick = () => { state.folder = f.id; state.expanded.add(f.id); state.showFavorites = false; renderAll(); if (innerWidth <= 700) setMobileView("notes"); };
      row.ondblclick = () => rename(f);
      longPress(row, (cx, cy) => openMenu(cx, cy, folderMenu(f)));
      t.appendChild(row);
      if (open) draw(f.id, depth + 1);
    });
  }
  draw(null, 0);
  const sidebar = t.closest(".sidebar");
  if (!t.dataset.bound) {
    t.dataset.bound = "1";
    const deselect = () => { state.folder = null; state.showFavorites = false; renderAll(); };
    t.addEventListener("click", e => { if (e.target === t) deselect(); });
    if (sidebar) sidebar.addEventListener("click", e => {
      if (e.target === sidebar || e.target.classList?.contains("section-label")) deselect();
    });
  }
  if (sidebar) sidebar.classList.toggle("root-selected", state.folder === null);
}

export function renderNotes() {
  const list = $("notes");
  let notes, title;
  if (state.showFavorites) {
    notes = state.items.filter(x => x.type === "note" && x.favorite && !x.deletedAt);
    title = "Favorites";
  } else {
    const folderId = state.folder || root()?.id;
    notes = kids(folderId).filter(x => x.type === "note");
    title = state.items.find(x => x.id === folderId)?.name || "Personal";
  }
  notes.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || b.updatedAt.localeCompare(a.updatedAt));
  list.innerHTML = "";
  $("folderTitle").textContent = title;
  $("folderCount").textContent = notes.length + " note" + (notes.length === 1 ? "" : "s");
  if (state.showFavorites && !notes.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No favorites yet — tap the star on a note to add it here.";
    list.appendChild(empty);
    return;
  }
  notes.forEach((x, i) => {
    const card = document.createElement("div"); card.className = "note-card " + (x.id === state.selected ? "active" : "") + (x.favorite ? " is-fav" : "");
    const head = document.createElement("div"); head.className = "note-title";
    const title = document.createElement("span"); title.textContent = x.title || "Untitled note";
    const date = document.createElement("span"); date.className = "note-date";
    date.textContent = new Date(x.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    head.append(title, date);
    const preview = document.createElement("div"); preview.className = "note-preview";
    preview.textContent = (x.content || "").replace(/\s+/g, " ").slice(0, 110);
    const star = document.createElement("button"); star.className = "card-star" + (x.favorite ? " on" : ""); star.title = x.favorite ? "Remove from Favorites" : "Add to Favorites";
    star.textContent = x.favorite ? "★" : "☆";
    star.onclick = (e) => {
      e.stopPropagation();
      toggleFavorite(x);
    };
    const kebab = document.createElement("button"); kebab.className = "card-menu"; kebab.title = "Note actions";
    kebab.innerHTML = "&#8942;";
    kebab.onclick = (e) => {
      e.stopPropagation();
      const r = kebab.getBoundingClientRect();
      openMenu(r.right - 4, r.bottom + 4, noteMenu(x));
    };
    card.append(head, preview, star, kebab);
    card.onclick = () => select(x.id);
    card.ondblclick = () => rename(x);
    longPress(card, (cx, cy) => openMenu(cx, cy, noteMenu(x)));
    list.appendChild(card);
    if (i < notes.length - 1) { const d = document.createElement("div"); d.className = "note-divider"; list.appendChild(d); }
  });
}

export function renderAll() { renderTree(); renderNotes(); }

export function renderTrash() {
  const list = $("notes");
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
    preview.textContent = x.type === "note" ? (x.content || "").replace(/\s+/g, " ").slice(0, 110) : `${kids(x.id).length} items`;
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

export function select(id) {
  state.selected = id;
  let n = state.items.find(x => x.id === id); if (!n) return;
  state.folder = n.parentId;
  state.showFavorites = false;
  $("title").value = n.title; $("content").value = n.content;
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
  const notes = kids(folderId).filter(x => x.type === "note").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!notes.length) return;
  let i = notes.findIndex(x => x.id === state.selected);
  let n = (i === -1 ? (dir > 0 ? -1 : 0) : i) + dir;
  n = (n + notes.length) % notes.length;
  select(notes[n].id);
}

export function updateMeta() {
  $("meta").textContent = $("content").value.length.toLocaleString() + " characters";
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
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>'
};

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
  let notes = q ? state.items.filter(x => x.type === "note" && ((x.title + " " + x.content).toLowerCase().includes(q))) : [];
  let list = $("notes");
  if (!q) return renderNotes();
  list.innerHTML = "";
  $("folderTitle").textContent = "Search";
  $("folderCount").textContent = notes.length + " matches";
  notes.forEach(x => {
    let r = document.createElement("div"); r.className = "note-card";
    r.innerHTML = '<div class="note-title"><span>' + esc(x.title || "Untitled note") + '</span></div><div class="note-preview">' + esc(x.content.slice(0, 130).replace(/\s+/g, " ")) + "</div>";
    r.onclick = () => select(x.id);
    list.appendChild(r);
  });
}

export function renderModelOptions() {
  const sel = $("model"), cur = sel.value, defaults = ["openai/gpt-4o-mini", "google/gemini-2.5-flash", "anthropic/claude-3.5-haiku"];
  sel.innerHTML = "";
  defaults.forEach(m => { const o = document.createElement("option"); o.value = m; o.textContent = m; sel.appendChild(o); });
  state.endpoints.forEach((e, i) => { const o = document.createElement("option"); o.value = "custom:" + i; o.textContent = e.name; sel.appendChild(o); });
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}

export function aiConfigured() {
  return !!(state.orKey || state.endpoints.length);
}

export function renderAI() {
  const on = aiConfigured();
  $("aiPanel").classList.toggle("ai-off", !on);
  $("aiSetup").hidden = on;
  $("model").hidden = !on;
  $("askAI").hidden = !on;
}
