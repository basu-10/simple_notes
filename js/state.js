import { uid, now } from "./utils.js";

export const state = {
  items: [],
  selected: null,
  folder: null,
  mode: "local",
  driveToken: null,
  endpoints: [],
  timer: null
};
