import { $ } from "./utils.js";

const DB = "plainnote-v2", VER = 4;
let db;

export function openDB() {
  return new Promise((ok, no) => {
    let r = indexedDB.open(DB, VER);
    r.onupgradeneeded = (e) => {
      let d = r.result;
      if (e.oldVersion < 1) {
        const store = d.createObjectStore("items", { keyPath: "id" });
        store.createIndex("by_parent", "parentId");
        store.createIndex("by_type", "type");
        store.createIndex("by_type_parent_updated", ["type", "parentId", "updatedAt"]);
        d.createObjectStore("settings", { keyPath: "key" });
      }
      if (e.oldVersion < 2) {
        const tx = e.target.transaction;
        const store = tx.objectStore("items");
        if (!store.indexNames.contains("by_parent")) store.createIndex("by_parent", "parentId");
        if (!store.indexNames.contains("by_type")) store.createIndex("by_type", "type");
        if (!store.indexNames.contains("by_type_parent_updated")) store.createIndex("by_type_parent_updated", ["type", "parentId", "updatedAt"]);
      }
      if (e.oldVersion < 3) {
        const tx = e.target.transaction;
        const store = tx.objectStore("items");
        if (!store.indexNames.contains("by_deleted")) store.createIndex("by_deleted", "deletedAt");
      }
      if (e.oldVersion < 4) {
        // v4: index already created in v1, this is a no-op for existing users
      }
    };
    r.onsuccess = () => { db = r.result; ok(db); };
    r.onerror = () => no(r.error);
  });
}

export function getDB() { return db; }

function store(n, m = "readonly") {
  return db.transaction(n, m).objectStore(n);
}

export function all(includeDeleted = false) {
  return new Promise((ok, no) => {
    let r = store("items").getAll();
    r.onsuccess = () => {
      let items = r.result;
      if (!includeDeleted) items = items.filter(x => !x.deletedAt);
      ok(items);
    };
    r.onerror = () => no(r.error);
  });
}

export async function put(x) {
  // Validate parent integrity for folders/notes
  if (x.parentId) {
    const parent = await get(x.parentId, true);
    if (!parent || parent.type !== "folder") {
      throw new Error(`Invalid parentId: ${x.parentId} (not a folder or doesn't exist)`);
    }
  }
  return new Promise((ok, no) => {
    let r = store("items", "readwrite").put(x);
    r.onsuccess = ok;
    r.onerror = () => no(r.error);
  });
}

export function del(id) {
  return new Promise((ok, no) => {
    let r = store("items", "readwrite").delete(id);
    r.onsuccess = ok;
    r.onerror = () => no(r.error);
  });
}

export async function softDelete(id) {
  const item = await get(id);
  if (!item) return;
  item.deletedAt = new Date().toISOString();
  await put(item);
}

export async function restore(id) {
  const item = await get(id, true);
  if (!item) return;
  delete item.deletedAt;
  await put(item);
}

export async function purge(id) {
  await del(id);
}

export async function getTrash() {
  const items = await all(true);
  return items.filter(x => x.deletedAt).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export async function getNotesByFolder(folderId, limit = 50, offset = 0) {
  return new Promise((ok, no) => {
    const tx = db.transaction("items", "readonly");
    const store = tx.objectStore("items");
    const index = store.index("by_type_parent_updated");
    const range = IDBKeyRange.bound(
      ["note", folderId, ""],
      ["note", folderId, "\uffff"],
      false, false
    );
    const req = index.getAll(range, limit);
    req.onsuccess = () => {
      const items = req.result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(offset, offset + limit);
      ok(items);
    };
    req.onerror = () => no(req.error);
  });
}

export async function repairParentIntegrity() {
  const items = await all(true);
  const folders = new Set(items.filter(x => x.type === "folder").map(x => x.id));
  const rootFolder = items.find(x => x.type === "folder" && !x.parentId);
  const rootId = rootFolder?.id;
  let fixed = 0;
  for (const x of items) {
    if (x.parentId && !folders.has(x.parentId)) {
      x.parentId = rootId;
      await put(x);
      fixed++;
    }
  }
  return fixed;
}

export async function get(id, includeDeleted = false) {
  return new Promise((ok, no) => {
    let r = store("items").get(id);
    r.onsuccess = () => {
      const item = r.result;
      if (item && !includeDeleted && item.deletedAt) ok(null);
      else ok(item);
    };
    r.onerror = () => no(r.error);
  });
}

export function setting(k) {
  return new Promise(ok => {
    let r = store("settings").get(k);
    r.onsuccess = () => ok(r.result?.value);
  });
}

export function saveSetting(k, v) {
  return new Promise(ok => {
    let r = store("settings", "readwrite").put({ key: k, value: v });
    r.onsuccess = ok;
  });
}

async function storageBytes() {
  const items = await all();
  let bytes = 0;
  for (const x of items) bytes += new Blob([JSON.stringify(x)]).size;
  return bytes;
}

export async function updateDbSize() {
  const el = $("dbSize");
  if (!el) return;
  const fmt = v => v < 1024 ? `${v} B`
    : v < 1048576 ? `${(v / 1024).toFixed(1)} KB`
    : v < 1073741824 ? `${(v / 1048576).toFixed(1)} MB`
    : `${(v / 1073741824).toFixed(2)} GB`;
  const withTimeout = (p, ms) =>
    Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await withTimeout(navigator.storage.estimate(), 3000);
      const n = e.usage || 0, q = e.quota || 0;
      el.textContent = q ? `${fmt(n)} used · ${fmt(q)} quota` : `${fmt(n)} used`;
      return;
    }
    throw new Error("unsupported");
  } catch {
    try {
      el.textContent = `${fmt(await storageBytes())} used`;
    } catch {
      el.textContent = "Size unavailable";
    }
  }
}
