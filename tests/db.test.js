import { describe, it, expect, beforeEach } from "vitest";
import {
  openDB, all, put, del, softDelete, restore, purge, getTrash,
  getFavorites, repairParentIntegrity, get, setting, saveSetting,
  getNotesByFolder
} from "../js/db.js";

let folder;

beforeEach(async () => {
  await openDB();
  folder = { id: "f1", type: "folder", parentId: null, name: "Personal", color: "#777976", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await put(folder);
});

describe("db items", () => {
  it("opens and stores a folder", async () => {
    const items = await all();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("f1");
  });

  it("puts a note with a valid folder parent", async () => {
    const note = { id: "n1", type: "note", parentId: "f1", title: "Hi", content: "x", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await expect(put(note)).resolves.toBeUndefined();
    expect(await get("n1")).toMatchObject({ id: "n1", title: "Hi" });
  });

  it("rejects a note whose parent is not a folder", async () => {
    const bad = { id: "n2", type: "note", parentId: "does-not-exist", title: "y", content: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await expect(put(bad)).rejects.toThrow(/Invalid parentId/);
  });

  it("excludes soft-deleted items from all() but includes them with flag", async () => {
    const note = { id: "n3", type: "note", parentId: "f1", title: "t", content: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await put(note);
    await softDelete("n3");
    expect(await all()).toHaveLength(1); // only the folder
    expect((await all(true)).find(x => x.id === "n3")).toBeTruthy();
  });

  it("soft-deletes, restores, and purges", async () => {
    const note = { id: "n4", type: "note", parentId: "f1", title: "t", content: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await put(note);
    await softDelete("n4");
    expect(await get("n4")).toBeNull(); // excluded by default
    await restore("n4");
    expect(await get("n4")).toMatchObject({ id: "n4" });
    await purge("n4");
    expect(await get("n4", true)).toBeUndefined();
  });

  it("getTrash returns deleted items sorted newest-first", async () => {
    // Set deletedAt explicitly so ordering is deterministic (avoids depending
    // on wall-clock ms between two soft-deletes).
    const a = { id: "a", type: "note", parentId: "f1", title: "a", content: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: "2020-01-01T00:00:00.000Z" };
    const b = { id: "b", type: "note", parentId: "f1", title: "b", content: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: "2024-01-01T00:00:00.000Z" };
    await put(a); await put(b);
    const trash = await getTrash();
    expect(trash.map(x => x.id)).toEqual(["b", "a"]);
  });

  it("getFavorites returns only favorited, non-deleted items", async () => {
    const fav = { id: "fav1", type: "note", parentId: "f1", title: "f", content: "", favorite: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const gone = { id: "gone", type: "note", parentId: "f1", title: "g", content: "", favorite: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await put(fav); await put(gone);
    await softDelete("gone");
    const favs = await getFavorites();
    expect(favs.map(x => x.id)).toEqual(["fav1"]);
  });

  it("repairs orphaned parent references", async () => {
    // Orphans come from imported/migrated data, so write one bypassing put()'s
    // parent validation via a raw store write.
    const child = { id: "c", type: "note", parentId: "ghost", title: "c", content: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const db = (await openDB());
    await new Promise((ok, no) => {
      const r = db.transaction("items", "readwrite").objectStore("items").put(child);
      r.onsuccess = ok; r.onerror = () => no(r.error);
    });
    const fixed = await repairParentIntegrity();
    expect(fixed).toBe(1);
    expect((await get("c", true)).parentId).toBe("f1"); // reparented to root folder
  });

  it("getNotesByFolder returns notes in the folder", async () => {
    const note = { id: "nf", type: "note", parentId: "f1", title: "nf", content: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await put(note);
    const notes = await getNotesByFolder("f1");
    expect(notes.map(x => x.id)).toContain("nf");
  });
});

describe("db settings", () => {
  it("round-trips a key/value setting", async () => {
    await saveSetting("mode", "drive");
    expect(await setting("mode")).toBe("drive");
  });

  it("returns undefined for a missing setting", async () => {
    expect(await setting("nope")).toBeUndefined();
  });
});
