import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach } from "vitest";

// Each test gets a fresh IndexedDB instance so data never leaks between cases.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  // Minimal DOM that the CRUD layer touches ($ / confirm).
  document.body.innerHTML =
    '<input id="title"><textarea id="content"></textarea>' +
    '<div id="saveState"></div><div id="date"></div><div id="toast"></div>';
  globalThis.confirm = () => true;
});
