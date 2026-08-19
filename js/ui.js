import { $, esc, toast } from "./utils.js";
import { state } from "./state.js";
import { rename } from "./crud.js";

export function kids(id) {
  return state.items.filter(x => x.parentId === id);
}

export function root() {
  return state.items.find(x => x.type === "folder" && !x.parentId);
}

export function path(id) {
  let a = [], x = state.items.find(y => y.id === id);
  while (x) { a.unshift(x.name); x = x.parentId ? state.items.find(y => y.id === x.parentId) : null; }
  return a.join(" / ");
}

export function renderTree() {
  const t = $("tree");
  t.innerHTML = "";
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
      row.append(twist, color, icon, name, count);
      twist.onclick = (e) => {
        e.stopPropagation();
        if (!hasKids) return;
        if (state.expanded.has(f.id)) state.expanded.delete(f.id);
        else state.expanded.add(f.id);
        renderAll();
      };
      row.onclick = () => { state.folder = f.id; state.expanded.add(f.id); renderAll(); if (innerWidth <= 700) setMobileView("notes"); };
      row.ondblclick = () => rename(f);
      t.appendChild(row);
      if (open) draw(f.id, depth + 1);
    });
  }
  draw(null, 0);
}

export function renderNotes() {
  const list = $("notes"), folderId = state.folder || root()?.id;
  const notes = kids(folderId).filter(x => x.type === "note").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  list.innerHTML = "";
  const folder = state.items.find(x => x.id === folderId);
  $("folderTitle").textContent = folder?.name || "Personal";
  $("folderCount").textContent = notes.length + " note" + (notes.length === 1 ? "" : "s");
  notes.forEach((x, i) => {
    const card = document.createElement("div"); card.className = "note-card " + (x.id === state.selected ? "active" : "");
    const head = document.createElement("div"); head.className = "note-title";
    const title = document.createElement("span"); title.textContent = x.title || "Untitled note";
    const date = document.createElement("span"); date.className = "note-date";
    date.textContent = new Date(x.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    head.append(title, date);
    const preview = document.createElement("div"); preview.className = "note-preview";
    preview.textContent = (x.content || "").replace(/\s+/g, " ").slice(0, 110);
    card.append(head, preview);
    card.onclick = () => select(x.id);
    card.ondblclick = () => rename(x);
    list.appendChild(card);
    if (i < notes.length - 1) { const d = document.createElement("div"); d.className = "note-divider"; list.appendChild(d); }
  });
}

export function renderAll() { renderTree(); renderNotes(); }

export function setMobileView(view) {
  document.querySelector(".shell").dataset.mobileView = view;
  document.querySelectorAll("#mobileNav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
}

export function select(id) {
  state.selected = id;
  let n = state.items.find(x => x.id === id); if (!n) return;
  state.folder = n.parentId;
  $("title").value = n.title; $("content").value = n.content;
  $("date").textContent = new Date(n.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) + "  ·  " + new Date(n.updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  updateMeta(); renderAll();
  if (innerWidth <= 700) setMobileView("editor");
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

export function search(q) {
  q = q.trim().toLowerCase();
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
