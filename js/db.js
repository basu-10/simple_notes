import { $ } from "./utils.js";

const DB = "plainnote-v2", VER = 1;
let db;

export function openDB() {
  return new Promise((ok, no) => {
    let r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      let d = r.result;
      d.createObjectStore("items", { keyPath: "id" });
      d.createObjectStore("settings", { keyPath: "key" });
    };
    r.onsuccess = () => { db = r.result; ok(); };
    r.onerror = () => no(r.error);
  });
}

function store(n, m = "readonly") {
  return db.transaction(n, m).objectStore(n);
}

export function all() {
  return new Promise((ok, no) => {
    let r = store("items").getAll();
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}

export function put(x) {
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
