import { describe, it, expect, beforeEach, vi } from "vitest";
import { openDB, all, get, put } from "../js/db.js";
import { state } from "../js/state.js";

// Mock the DOM/render layer so CRUD logic runs without a real UI,
// while keeping root()/kids() (pure state logic) intact.
vi.mock("../js/ui.js", async () => {
  const { state } = await import("../js/state.js");
  const root = () => state.items.find(x => x.type === "folder" && !x.parentId && !x.deletedAt);
  const kids = (id) => state.items.filter(x => x.parentId === id && !x.deletedAt);
  return {
    select: vi.fn(),
    renderAll: vi.fn(),
    renderNotes: vi.fn(),
    updateMeta: vi.fn(),
    updateStar: vi.fn(),
    modal: vi.fn(),
    closeModal: vi.fn(),
    openMenu: vi.fn(),
    root,
    kids
  };
});
vi.mock("../js/drive.js", () => ({ driveSync: vi.fn() }));

import { createNote, toggleFavorite, duplicateNote, deleteNote } from "../js/crud.js";

let folder;

beforeEach(async () => {
  await openDB();
  state.items = [];
  state.selected = null;
  state.folder = null;
  folder = { id: "f1", type: "folder", parentId: null, name: "Personal", color: "#777976", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await put(folder);
  state.items.push(folder);
});

describe("createNote", () => {
  it("creates a note under the current folder and persists it", async () => {
    state.folder = "f1";
    await createNote();
    const note = state.items.find(x => x.type === "note");
    expect(note).toBeTruthy();
    expect(note.parentId).toBe("f1");
    expect((await all()).filter(x => x.type === "note")).toHaveLength(1);
  });
});

describe("toggleFavorite", () => {
  it("flips and persists the favorite flag", async () => {
    const note = { id: "n1", type: "note", parentId: "f1", title: "t", content: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await put(note);
    state.items.push(note);
    await toggleFavorite(note);
    expect(note.favorite).toBe(true);
    expect((await get("n1")).favorite).toBe(true);
  });
});

describe("duplicateNote", () => {
  it("copies title (with suffix) and content", async () => {
    const note = { id: "n1", type: "note", parentId: "f1", title: "Idea", content: "body", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await put(note);
    state.items.push(note);
    await duplicateNote(note);
    const copy = state.items.find(x => x.type === "note" && x.id !== "n1");
    expect(copy.title).toBe("Idea (copy)");
    expect(copy.content).toBe("body");
    expect(copy.parentId).toBe("f1");
  });
});

describe("deleteNote", () => {
  it("soft-deletes the note (moves to trash)", async () => {
    const note = { id: "n1", type: "note", parentId: "f1", title: "t", content: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await put(note);
    state.items.push(note);
    await deleteNote(note);
    expect((await get("n1", true)).deletedAt).toBeTruthy();
  });
});
