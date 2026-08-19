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

export async function updateDbSize() {
  const el = $("dbSize");
  if (!el) return;
  try {
    const e = await navigator.storage.estimate();
    const n = e.usage || 0, q = e.quota || 0;
    const fmt = v => v < 1024 ? `${v} B`
      : v < 1048576 ? `${(v / 1024).toFixed(1)} KB`
      : v < 1073741824 ? `${(v / 1048576).toFixed(1)} MB`
      : `${(v / 1073741824).toFixed(2)} GB`;
    el.textContent = `${fmt(n)} used${q ? ` · ${fmt(q)} quota` : ""}`;
  } catch {
    el.textContent = "Size unavailable";
  }
}
