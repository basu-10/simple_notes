import { $, now, uid, toast, esc } from "./utils.js";
import { state } from "./state.js";
import { openDB, getDB, updateDbSize, getAsset } from "./db.js";
import { renderAll, modal, closeModal } from "./ui.js";

const REQUIRED_NOTE = ["id", "type", "parentId", "title", "content", "createdAt", "updatedAt"];
const REQUIRED_FOLDER = ["id", "type", "parentId", "name", "color", "createdAt", "updatedAt"];

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function itemName(x) {
  if (x.type === "note") return x.title || "Untitled note";
  if (x.type === "folder") return x.name || "Untitled folder";
  return "Unknown item";
}

function itemSize(x) {
  return new Blob([JSON.stringify(x)]).size;
}

function validateItem(x) {
  if (!x || typeof x !== "object") return "Not an object";
  if (x.type === "note") {
    const missing = REQUIRED_NOTE.filter(k => !(k in x));
    return missing.length ? "Missing fields: " + missing.join(", ") : null;
  }
  if (x.type === "folder") {
    const missing = REQUIRED_FOLDER.filter(k => !(k in x));
    return missing.length ? "Missing fields: " + missing.join(", ") : null;
  }
  return "Unknown type: " + (x.type ?? "none");
}

function filesHtml(rows, selectable) {
  if (!rows.length) return `<div class="file-empty">No items found.</div>`;
  const tag = selectable ? "label" : "div";
  return `<div class="file-list">` + rows.map((r, i) => `
    <${tag} class="file-row${r.error ? " err" : ""}">
      ${selectable ? `<input type="checkbox" class="file-check" data-index="${i}" checked>` : ""}
      <div class="file-icon">${r.type === "folder" ? "📁" : "📝"}</div>
      <div class="file-main">
        <span class="file-name">${esc(itemName(r.item))}</span>
        <span class="file-type">${esc(r.type)}</span>
      </div>
      <div class="file-meta">
        ${r.error
          ? `<span class="file-error">${esc(r.error)}</span>`
          : `<span class="file-size">${formatSize(r.size)}</span>`}
      </div>
    </${tag}>`).join("") + `</div>`;
}

function summaryHtml(ok, errors, totalSize) {
  const parts = [`${ok} item${ok === 1 ? "" : "s"} ready`];
  if (errors) parts.push(`${errors} with errors`);
  parts.push(`· ${formatSize(totalSize)} total`);
  return `<div class="file-summary">${esc(parts.join(" "))}</div>`;
}

export async function exportData() {
  const items = state.items;
  const rows = items.map(item => ({ item, type: item.type, size: itemSize(item), error: null }));
  const fileName = "notezen-export-" + now().slice(0, 10) + ".notezen";

  modal(`
    <h2>Export</h2>
    <p>Select the files and folders to include in this export.</p>
    <div class="file-head">
      <label class="file-select-all"><input type="checkbox" id="exportAll" checked> Select all</label>
      <div class="file-meta"><span class="file-size" id="exportTotal">${formatSize(rows.reduce((s, r) => s + r.size, 0))}</span></div>
    </div>
    ${filesHtml(rows, true)}
    <div class="file-summary" id="exportSummary"></div>
    <div class="modal-actions">
      <button class="primary" data-act="cancel">Cancel</button>
      <button class="primary" data-act="download">Download</button>
    </div>
  `);

  const backdrop = $("modalBackdrop");
  backdrop.querySelector('[data-act="cancel"]').onclick = closeModal;

  const checks = [...backdrop.querySelectorAll(".file-check")];
  const all = backdrop.querySelector("#exportAll");
  const downloadBtn = backdrop.querySelector('[data-act="download"]');
  const totalEl = backdrop.querySelector("#exportTotal");
  const summaryEl = backdrop.querySelector("#exportSummary");

  function update() {
    const sel = checks.filter(c => c.checked);
    const size = sel.reduce((s, c) => s + rows[+c.dataset.index].size, 0);
    totalEl.textContent = formatSize(size);
    summaryEl.textContent = `${sel.length} of ${rows.length} selected · ${formatSize(size)}`;
    downloadBtn.disabled = sel.length === 0;
    all.checked = sel.length === checks.length;
    all.indeterminate = sel.length > 0 && sel.length < checks.length;
  }

  checks.forEach(c => c.onchange = update);
  all.onchange = () => { checks.forEach(c => c.checked = all.checked); update(); };
  update();

  downloadBtn.onclick = () => {
    const selected = checks.filter(c => c.checked).map(c => rows[+c.dataset.index].item);
    const p = {
      format: "notezen",
      version: 2,
      schemaVersion: 2,
      exportedAt: now(),
      items: selected
    };
    const b = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    closeModal();
    toast(`Exported ${selected.length} item${selected.length === 1 ? "" : "s"}`);
  };
}

export async function exportNote(item) {
  if (!item) return;
  const body = await htmlToRtf(item.content, item.title);
  const safe = (item.title || "Untitled note").replace(/[^\w.-]+/g, "_").slice(0, 60) || "note";
  const fileName = safe + ".rtf";
  const b = new Blob([body], { type: "application/rtf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Downloaded “" + (item.title || "Untitled note") + "” as RTF");
}

function rtfEscapeChar(ch) {
  const code = ch.codePointAt(0);
  if (ch === "\\" || ch === "{" || ch === "}") return "\\" + ch;
  if (code <= 0x7f) return ch;
  if (code <= 0xff) return "\\'" + code.toString(16).padStart(2, "0");
  const signed = code >= 0x8000 ? code - 0x10000 : code;
  return "\\u" + signed + "\\'3f";
}

function rtfEscape(text) {
  let out = "";
  for (const ch of (text || "")) out += rtfEscapeChar(ch);
  return out;
}

function parseRtfColor(c) {
  if (!c) return null;
  c = c.trim();
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split("").map(x => x + x).join("");
    const num = parseInt(h, 16);
    if (Number.isNaN(num)) return null;
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255].join(",");
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(",").map(s => parseFloat(s));
    return [p[0], p[1], p[2]].map(Math.round).join(",");
  }
  return null;
}

function parseRtfFontSize(s) {
  if (!s) return null;
  const m = s.match(/([\d.]+)px/);
  return m ? parseFloat(m[1]) : null;
}

function bufToHex(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

function loadImageDims(blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function blobToRtfPict(blob) {
  const type = blob.type || "";
  let fmt = null;
  if (type.includes("png")) fmt = "pngblip";
  else if (type.includes("jpeg")) fmt = "jpegblip";
  if (!fmt) return null;

  const buf = await blob.arrayBuffer();
  const dims = await loadImageDims(blob);
  if (!dims || !dims.w || !dims.h) return null;

  const MAX_W = 8640; // 6 inches in twips
  let gw = Math.round(dims.w * 15);
  let gh = Math.round(dims.h * 15);
  if (gw > MAX_W) {
    const scale = MAX_W / gw;
    gw = MAX_W;
    gh = Math.round(gh * scale);
  }

  return `{\\pict\\${fmt}\\picw${dims.w}\\pich${dims.h}` +
    `\\picwgoal${gw}\\pichgoal${gh} ${bufToHex(buf)}}`;
}

async function htmlToRtf(html, title) {
  let out = "";
  const colorList = [];
  const colorIndex = new Map();

  function colorFor(rgb) {
    if (colorIndex.has(rgb)) return colorIndex.get(rgb);
    const idx = colorList.length + 1;
    colorList.push(rgb);
    colorIndex.set(rgb, idx);
    return idx;
  }

  function inlineStyle(el) {
    const style = el.style || {};
    let on = "", off = "";
    const col = parseRtfColor(style.color);
    if (col) { on += "\\cf" + colorFor(col) + " "; off = "\\cf0 " + off; }
    const fs = parseRtfFontSize(style.fontSize);
    if (fs) { on += "\\fs" + Math.round(fs * 2) + " "; off = "\\fs22 " + off; }
    return { on, off };
  }

  async function renderNode(node) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) out += rtfEscape(child.nodeValue);
      else if (child.nodeType === Node.ELEMENT_NODE) await renderElement(child);
    }
  }

  async function renderList(el, ordered) {
    let n = 1;
    for (const li of el.children) {
      if (li.tagName.toLowerCase() !== "li") { await renderElement(li); continue; }
      out += "\\par ";
      out += ordered ? (n + ".\\tab ") : "\\u2022\\tab ";
      n++;
      await renderNode(li);
      out += "\\par ";
    }
  }

  async function renderElement(el) {
    const tag = el.tagName.toLowerCase();
    const { on, off } = inlineStyle(el);
    switch (tag) {
      case "br": out += "\\par "; return;
      case "p":
      case "div":
        out += on; await renderNode(el); out += off + "\\par "; return;
      case "b":
      case "strong": out += on + "\\b "; await renderNode(el); out += "\\b0 " + off; return;
      case "i":
      case "em": out += on + "\\i "; await renderNode(el); out += "\\i0 " + off; return;
      case "u": out += on + "\\ul "; await renderNode(el); out += "\\ul0 " + off; return;
      case "s":
      case "strike":
      case "del": out += on + "\\strike "; await renderNode(el); out += "\\strike0 " + off; return;
      case "h1": out += on + "\\fs36\\b "; await renderNode(el); out += "\\b0\\fs22 " + off + "\\par "; return;
      case "h2": out += on + "\\fs30\\b "; await renderNode(el); out += "\\b0\\fs22 " + off + "\\par "; return;
      case "h3": out += on + "\\fs28\\b "; await renderNode(el); out += "\\b0\\fs22 " + off + "\\par "; return;
      case "h4": out += on + "\\fs26\\b "; await renderNode(el); out += "\\b0\\fs22 " + off + "\\par "; return;
      case "h5":
      case "h6": out += on + "\\fs24\\b "; await renderNode(el); out += "\\b0\\fs22 " + off + "\\par "; return;
      case "blockquote": out += on + "\\li720\\ri720 "; await renderNode(el); out += "\\li0\\ri0 " + off + "\\par "; return;
      case "ul": await renderList(el, false); return;
      case "ol": await renderList(el, true); return;
      case "a": {
        const href = el.getAttribute("href");
        await renderNode(el);
        if (href) out += " (" + rtfEscape(href) + ")";
        out += "\\par "; return;
      }
      case "img": {
        const aid = el.dataset.assetId || el.getAttribute("data-asset-id");
        if (aid) {
          try {
            const blob = await getAsset(aid);
            if (blob) {
              const pict = await blobToRtfPict(blob);
              if (pict) { out += pict + " "; return; }
            }
          } catch (e) { /* fall back to alt text */ }
        }
        const alt = el.getAttribute("alt");
        if (alt) out += rtfEscape(alt);
        return;
      }
      case "table": out += "\\par "; await renderNode(el); out += "\\par "; return;
      case "tr": await renderNode(el); out += "\\par "; return;
      case "td":
      case "th": await renderNode(el); out += "\\tab "; return;
      case "hr": out += "\\par\\line "; return;
      default: out += on; await renderNode(el); out += off; return;
    }
  }

  const doc = new DOMParser().parseFromString(html || "", "text/html");
  if (title) out += "\\fs36\\b " + rtfEscape(title) + "\\b0\\fs22\\par ";
  await renderNode(doc.body);

  let colortbl = "{\\colortbl;";
  for (const c of colorList) {
    const [r, g, b] = c.split(",").map(Number);
    colortbl += "\\red" + r + "\\green" + g + "\\blue" + b + ";";
  }
  colortbl += "}";

  return "{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff0\\f0" +
    "{\\fonttbl{\\f0\\fnil\\fcharset0 Calibri;}}" +
    colortbl + "\\f0\\fs22 " + out + "}";
}

export async function importData(file) {
  try {
    const text = await file.text();
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      openImportModal({
        file,
        rows: [],
        totalSize: file.size,
        parseError: "Could not parse file: " + e.message
      }, null);
      return;
    }

    if (d.format !== "notezen" || !d.items || !Array.isArray(d.items)) {
      openImportModal({
        file,
        rows: [],
        totalSize: file.size,
        parseError: "Invalid NoteZen file (missing format or items)"
      }, null);
      return;
    }

    const rows = d.items.map(item => {
      const error = validateItem(item);
      return { item, type: item.type ?? "?", size: itemSize(item), error };
    });

    openImportModal({ file, rows, totalSize: file.size }, d);
  } catch (e) {
    console.error(e);
    toast("Import failed: " + e.message);
  }
}

function openImportModal(meta, d) {
  const okCount = meta.rows.filter(r => !r.error).length;
  const errCount = meta.rows.filter(r => r.error).length;

  let body;
  if (meta.parseError) {
    body = `
      <div class="file-head">
        <div><span class="file-name">${esc(meta.file.name)}</span></div>
        <div class="file-meta"><span class="file-size">${formatSize(meta.totalSize)}</span></div>
      </div>
      <div class="file-list"><div class="file-row err"><div class="file-main"><span class="file-error">${esc(meta.parseError)}</span></div></div></div>
    `;
  } else {
    body = `
      <div class="file-head">
        <div><span class="file-name">${esc(meta.file.name)}</span></div>
        <div class="file-meta"><span class="file-size">${formatSize(meta.totalSize)}</span></div>
      </div>
      ${filesHtml(meta.rows)}
      ${summaryHtml(okCount, errCount, meta.totalSize)}
    `;
  }

  modal(`
    <h2>Import</h2>
    <p>${meta.parseError ? "This file could not be imported." : "Review the files below. Items with errors will be skipped."}</p>
    ${body}
    <div class="modal-actions">
      <button class="primary" data-act="cancel">Cancel</button>
      ${d ? `<button class="primary" data-act="confirm">Import${errCount ? " valid" : ""}</button>` : ""}
    </div>
  `);

  const backdrop = $("modalBackdrop");
  backdrop.querySelector('[data-act="cancel"]').onclick = closeModal;
  if (d) {
    backdrop.querySelector('[data-act="confirm"]').onclick = () => runImport(d, meta.rows);
  }
}

async function runImport(d, rows) {
  const valid = rows.filter(r => !r.error).map(r => r.item);

  const idMap = new Map();
  for (const x of valid) {
    if (state.items.some(i => i.id === x.id)) {
      const newId = uid();
      idMap.set(x.id, newId);
      x.id = newId;
    }
  }
  for (const x of valid) {
    if (x.parentId && idMap.has(x.parentId)) {
      x.parentId = idMap.get(x.parentId);
    }
  }

  const db = getDB();
  if (!db) await openDB();
  await new Promise((ok, no) => {
    const tx = db.transaction("items", "readwrite");
    const store = tx.objectStore("items");
    for (const x of valid) store.put(x);
    tx.oncomplete = ok;
    tx.onerror = () => no(tx.error);
  });

  state.items.push(...valid);
  await updateDbSize();
  renderAll();
  closeModal();

  const skipped = rows.length - valid.length;
  const msg = `Imported ${valid.length} item${valid.length === 1 ? "" : "s"}` + (skipped ? `, skipped ${skipped}` : "");
  toast(msg);
}
