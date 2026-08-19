import { uid, now } from "./utils.js";

export const state = {
  items: [],
  selected: null,
  folder: null,
  expanded: new Set(),
  mode: "local",
  driveToken: null,
  endpoints: [],
  orKey: "",
  timer: null
};
