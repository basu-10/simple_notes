import { $, now, uid, toast } from "./utils.js";
import { state } from "./state.js";
import { openDB, getDB, updateDbSize } from "./db.js";
import { renderAll } from "./ui.js";

const REQUIRED_NOTE = ["id", "type", "parentId", "title", "content", "createdAt", "updatedAt"];
const REQUIRED_FOLDER = ["id", "type", "parentId", "name", "color", "createdAt", "updatedAt"];

function validateItem(x) {
  if (!x || typeof x !== "object") return false;
  if (x.type === "note") return REQUIRED_NOTE.every(k => k in x);
  if (x.type === "folder") return REQUIRED_FOLDER.every(k => k in x);
  return false;
}

export function exportData() {
  const payload = {
    format: "notezen",
    version: 2,
    schemaVersion: 2,
    exportedAt: now(),
    items: state.items
  };
  let blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "notezen-export-" + now().slice(0, 10) + ".notezen";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Export complete");
}

export async function importData(file) {
  try {
    const text = await file.text();
    let d = JSON.parse(text);
    if (d.format !== "notezen" || !d.items || !Array.isArray(d.items)) {
      throw new Error("Invalid NoteZen file");
    }

    for (const x of d.items) {
      if (!validateItem(x)) throw new Error("Invalid item schema");
    }

    const idMap = new Map();
    for (const x of d.items) {
      if (state.items.some(i => i.id === x.id)) {
        const newId = uid();
        idMap.set(x.id, newId);
        x.id = newId;
      }
    }
    for (const x of d.items) {
      if (x.parentId && idMap.has(x.parentId)) {
        x.parentId = idMap.get(x.parentId);
      }
    }

    const db = getDB();
    if (!db) await openDB();
    await new Promise((ok, no) => {
      const tx = db.transaction("items", "readwrite");
      const store = tx.objectStore("items");
      for (const x of d.items) {
        store.put(x);
      }
      tx.oncomplete = ok;
      tx.onerror = () => no(tx.error);
    });

    state.items.push(...d.items);
    await updateDbSize();
    renderAll();
    toast(`Imported ${d.items.length} items`);
  } catch (e) {
    console.error(e);
    toast("Import failed: " + e.message);
  }
}