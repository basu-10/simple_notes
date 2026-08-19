import { uid, now } from "./utils.js";

export const state = {
  items: [],
  selected: null,
  folder: null,
  inTrash: false,
  showFavorites: false,
  expanded: new Set(),
  mode: "local",
  driveToken: null,
  providers: [],
  timer: null
};
