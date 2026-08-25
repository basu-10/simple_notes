import { $, uid, now, esc } from "./utils.js";
import { getAsset, putAsset } from "./db.js";

// CKEditor 4 (vendored at js/vendor/ckeditor) wraps the existing <textarea id="content">.
// Images are stored as IndexedDB blobs (assets store) and referenced from note HTML via
// <img data-asset-id="..."> — never as inline base64. Object URLs are created for display
// and revoked on every note switch to avoid leaks.

let editor = null;
const liveUrls = new Map(); // assetId -> blob: object URL (display only)
let suppress = false;       // true while we programmatically set data
let changeCb = null;

const TOOLBAR = [
  { name: "basic", items: ["Bold", "Italic", "Underline", "Strike", "RemoveFormat"] },
  { name: "lists", items: ["NumberedList", "BulletedList"] },
  { name: "links", items: ["Link", "Unlink"] },
  { name: "insert", items: ["AssetImage", "Table", "Blockquote"] }
];

function edConfig() {
  return {
    toolbar: TOOLBAR,
    // No upload* plugins are shipped in the Standard build, so there is no base64
    // embed path. We still strip them defensively.
    removePlugins: "elementspath,resize,uploadimage,uploadwidget,uploadfile",
    extraPlugins: "assetimage",
    removeButtons: "Image",
    filebrowserUploadUrl: "about:blank#disabled",
    // Fallback only — styles.css stretches .cke_contents to fill the panel so the
    // writing surface has no dead space under it.
    height: 480,
    autoGrow_onStartup: false,
    versionCheck: false,
    contentsCss: ["js/vendor/ckeditor/contents.css", "css/editor-contents.css"],
    // Notes are user-authored and local-only, so we keep ACF off. This lets
    // <img data-asset-id> (no inline src until we inject a session blob: URL)
    // survive parsing instead of being dropped by CKEditor's required-src rule.
    allowedContent: true
  };
}

function registerAssetImagePlugin() {
  const registered = window.CKEDITOR.plugins.registered || {};
  if (registered.assetimage) return;
  window.CKEDITOR.plugins.add("assetimage", {
    init(editor) {
      editor.addCommand("insertAssetImage", {
        exec() { pickFiles(); }
      });
      editor.ui.addButton("AssetImage", {
        label: "Insert image",
        command: "insertAssetImage",
        toolbar: "insert",
        icon: "image"
      });
    }
  });
}

function pickFiles() {
  if (!editor) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.onchange = () => insertImageFiles(input.files);
  input.click();
}

async function insertImageFiles(fileList) {
  if (!editor || !fileList) return;
  for (const f of fileList) {
    if (!f || !f.type || !f.type.startsWith("image/")) continue;
    const id = uid();
    await putAsset({
      id,
      blob: f,
      type: f.type,
      name: f.name || "image",
      size: f.size,
      createdAt: now()
    });
    const img = new window.CKEDITOR.dom.element("img");
    img.setAttribute("data-asset-id", id);
    img.setAttribute("alt", f.name || "image");
    editor.insertElement(img);
    const url = URL.createObjectURL(f);
    img.$.src = url;
    liveUrls.set(id, url);
    editor.focus();
  }
}

// Keep the editor iframe's document in sync with the app theme so the editable
// area (which lives in an isolated iframe) picks up light/dark like the rest.
function bindThemeSync() {
  if (!editor || !editor.document) return;
  const doc = editor.document.$;
  if (!doc || !doc.documentElement) return;
  const apply = () => {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) doc.documentElement.setAttribute("data-theme", t);
    else doc.documentElement.removeAttribute("data-theme");
  };
  apply();
  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(apply).observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme"]
    });
  }
}

// Fuse CKEditor's native toolbar with the panel's own header bar by moving the
// editor's "top" space into the #formatBar slot in app.html. The toolbar keeps
// working after the move because CKEditor 4 wires its buttons through inline
// onclick/onmousedown attributes that call global CKEDITOR handlers rather than
// listeners bound to the original container, and .cke_toolbox still swallows
// mousedown so the editor selection survives a button press.
function mountToolbar() {
  const slot = $("formatBar");
  const top = editor && editor.ui.space("top");
  if (!slot || !top || !top.$) return;
  slot.appendChild(top.$);
  // CKEditor pins an inline height on the top space; the fused bar sizes itself.
  top.$.style.height = "";
  setupToolbarReflow();
}

// Reflow the format toolbar: when the bar is too narrow for every button group
// (small phones, or the web view resized down), the trailing groups are moved
// whole into a "More" popup. Groups are moved as units, so a visual cluster of
// buttons (e.g. Bold/Italic/Underline) always stays together — never split mid
// group across the bar and the menu.
let reflowAttached = false;
function setupToolbarReflow() {
  const slot = $("formatBar");
  const top = editor && editor.ui.space("top");
  if (!slot || !top || !top.$) return;
  const topEl = top.$;
  const toolbox = topEl.querySelector(".cke_toolbox");
  if (!toolbox) return;

  if (slot.querySelector(".tb-more-format")) return; // already set up

  const more = document.createElement("div");
  more.className = "tb-more-format";
  more.innerHTML =
    '<button class="tool tb-more-btn" type="button" aria-haspopup="true" ' +
    'aria-expanded="false" aria-label="More formatting">' +
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/>' +
    '<circle cx="19" cy="12" r="2"/></svg></button>' +
    '<div class="tb-more-pop" hidden role="menu" aria-label="More formatting"></div>';
  slot.appendChild(more);
  const moreBtn = more.querySelector(".tb-more-btn");
  const pop = more.querySelector(".tb-more-pop");

  const closePop = () => {
    pop.hidden = true;
    moreBtn.setAttribute("aria-expanded", "false");
  };
  moreBtn.addEventListener("click", e => {
    e.stopPropagation();
    const willOpen = pop.hidden;
    pop.hidden = !willOpen;
    moreBtn.setAttribute("aria-expanded", String(willOpen));
  });
  // A formatting command ran from inside the menu — close it so it doesn't
  // linger over the editor. CKEditor fires the command on mousedown, the
  // click lands after, so closing here is safe.
  pop.addEventListener("click", closePop);
  document.addEventListener("click", e => {
    if (!more.contains(e.target)) closePop();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !pop.hidden) { closePop(); moreBtn.focus(); }
  });

  const reflow = () => {
    const groups = [...toolbox.querySelectorAll(":scope > .cke_toolbar")];
    const popped = [...pop.querySelectorAll(":scope > .cke_toolbar")];
    // Start from a clean slate: everything back in the bar.
    for (const g of popped) toolbox.appendChild(g);
    more.hidden = false; // visible so its width is measurable

    const slotCS = getComputedStyle(slot);
    const pad = parseFloat(slotCS.paddingLeft) + parseFloat(slotCS.paddingRight);
    const slotGap = parseFloat(slotCS.gap) || 6;
    const tbGap = parseFloat(getComputedStyle(toolbox).gap) || 6;
    const avail = slot.clientWidth - pad - more.getBoundingClientRect().width - slotGap;

    let used = 0;
    let split = groups.length;
    for (let i = 0; i < groups.length; i++) {
      const w = groups[i].getBoundingClientRect().width;
      const add = used === 0 ? w : w + tbGap;
      if (used + add <= avail) used += add;
      else { split = i; break; }
    }

    if (split >= groups.length) {
      more.hidden = true;
      pop.hidden = true;
      moreBtn.setAttribute("aria-expanded", "false");
    } else {
      for (let i = split; i < groups.length; i++) pop.appendChild(groups[i]);
    }
  };

  if (!reflowAttached) {
    reflowAttached = true;
    window.addEventListener("resize", reflow);
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(reflow).observe(slot);
    }
  }
  // Icons load asynchronously; measure after layout settles.
  requestAnimationFrame(reflow);
  setTimeout(reflow, 250);
}

function bindCapture() {
  const tryCapture = evt => {
    const data = evt.data;
    const dt = data && data.dataTransfer;
    if (!dt || !dt.getFilesCount || dt.getFilesCount() === 0) return;
    const files = [];
    for (let i = 0; i < dt.getFilesCount(); i++) {
      const f = dt.getFile(i);
      if (f && f.type && f.type.startsWith("image/")) files.push(f);
    }
    if (!files.length) return;
    if (data.preventDefault) data.preventDefault();
    insertImageFiles(files);
    evt.cancel();
  };
  editor.on("paste", tryCapture, null, null, 999);
  editor.on("drop", tryCapture, null, null, 999);
}

function legacyToRich(s) {
  if (!s) return "";
  if (s.includes("<")) return s;
  const lines = s.split(/\r?\n/).filter(l => l.trim() !== "");
  return (lines.map(l => `<p>${esc(l)}</p>`).join("") || "<p></p>");
}

async function collectAssetIds(html) {
  if (!html || !html.includes("data-asset-id")) return [];
  const ids = [...html.matchAll(/data-asset-id="([^"]+)"/g)].map(m => m[1]);
  return [...new Set(ids)];
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isEditorReady() {
  return !!editor;
}

export async function initEditor() {
  if (typeof window === "undefined" || !window.CKEDITOR) return false;
  const ta = $("content");
  if (!ta || ta.dataset.ckReady) return false;
  registerAssetImagePlugin();
  editor = window.CKEDITOR.replace("content", edConfig());
  await new Promise(res => {
    const done = () => { ta.dataset.ckReady = "1"; res(); };
    editor.on("instanceReady", () => { bindCapture(); bindThemeSync(); mountToolbar(); done(); });
    editor.on("error", done);
    // Failsafe if instanceReady never fires.
    setTimeout(done, 4000);
  });
  return true;
}

export function onEditorChange(cb) {
  changeCb = cb;
  if (editor) {
    editor.on("change", () => {
      if (suppress || !changeCb) return;
      changeCb();
    });
  }
}

export function revokeAssetUrls() {
  for (const url of liveUrls.values()) URL.revokeObjectURL(url);
  liveUrls.clear();
}

export async function setContent(html) {
  revokeAssetUrls();
  const rich = legacyToRich(html || "");
  if (!editor) {
    const ta = $("content");
    if (ta) ta.value = rich;
    return;
  }
  const ids = await collectAssetIds(rich);
  const urlMap = new Map();
  for (const id of ids) {
    try {
      const blob = await getAsset(id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        urlMap.set(id, url);
        liveUrls.set(id, url);
      }
    } catch { /* missing asset — alt text will show */ }
  }
  // CKEditor drops <img> elements that have no src during parsing, so we must
  // inject a (session-only) blob: URL before setData and strip it again on getContent.
  let resolved = rich;
  for (const [id, url] of urlMap) {
    resolved = resolved.replace(
      new RegExp(`(<img\\b[^>]*?)(data-asset-id="${escapeRegExp(id)}")([^>]*?)>`, "g"),
      (m, pre, da, post) => `${pre}${da}${post} src="${url}">`
    );
  }
  suppress = true;
  await new Promise(res => {
    editor.setData(resolved, () => {
      suppress = false;
      res();
    });
  });
}

export function getContent() {
  if (!editor) {
    const ta = $("content");
    return ta ? ta.value : "";
  }
  const html = editor.getData() || "";
  // Strip session-only blob: src values; data-asset-id remains the source of truth.
  return stripBlobSrc(html);
}

function stripBlobSrc(html) {
  return html.replace(/<img\b([^>]*?)\s+src="blob:[^"]*"([^>]*)>/gi,
    (m, pre, post) => `<img${pre}${post}>`);
}
