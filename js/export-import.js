import { $, now, uid, toast } from "./utils.js";
import { state } from "./state.js";
import { put, updateDbSize } from "./db.js";
import { renderAll } from "./ui.js";

export function exportData() {
  let blob = new Blob([JSON.stringify({ format: "plainnote", version: 1, exportedAt: now(), items: state.items }, null, 2)], { type: "application/json" });
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "plainnote-export-" + now().slice(0, 10) + ".plainnote";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Export complete");
}

export async function importData(file) {
  try {
    let d = JSON.parse(await file.text());
    if (d.format !== "plainnote") throw Error("Invalid NoteZen file");
    let ids = new Set(state.items.map(x => x.id));
    for (let x of d.items) {
      if (ids.has(x.id)) x.id = uid();
      state.items.push(x);
      await put(x);
    }
    renderAll();
    toast("Import complete");
  } catch (e) {
    toast("Import failed");
  }
}
