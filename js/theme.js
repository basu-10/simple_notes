import { setting } from "./db.js";

const KEY = "notezen-theme";
const MODES = ["auto", "dark", "light"];
const LABELS = {
  auto: "Appearance: Auto (system)",
  dark: "Appearance: Dark",
  light: "Appearance: Light",
};
const META = { dark: "#1f2123", light: "#e8e8e6" };
const ICONS = {
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/>',
  dark: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};

const root = document.documentElement;
let media;
let currentMode = "auto";

function read() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function write(v) {
  try { localStorage.setItem(KEY, v); } catch {}
}

function systemPrefersDark() {
  return media ? media.matches : false;
}

function resolved(mode) {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return systemPrefersDark() ? "dark" : "light";
}

function apply(mode) {
  if (mode === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  const r = resolved(mode);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", META[r]);
  const btn = document.getElementById("theme");
  if (btn) {
    btn.title = LABELS[mode];
    const svg = btn.querySelector("svg");
    if (svg) {
      svg.innerHTML = ICONS[mode];
      if (mode === "auto") svg.removeAttribute("stroke-width");
      else svg.setAttribute("stroke-width", "1.65");
    }
  }
}

export async function initTheme() {
  media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", () => {
    if (currentMode === "auto") apply(currentMode);
  });
  let saved = read();
  if (!MODES.includes(saved)) {
    const dbSaved = await setting("theme");
    if (MODES.includes(dbSaved)) { saved = dbSaved; write(dbSaved); }
  }
  currentMode = MODES.includes(saved) ? saved : "auto";
  apply(currentMode);
  window.addEventListener("storage", e => {
    if (e.key !== KEY) return;
    if (!MODES.includes(e.newValue)) return;
    currentMode = e.newValue;
    apply(currentMode);
  });
}

export function cycleTheme() {
  const i = MODES.indexOf(currentMode);
  currentMode = MODES[(i + 1) % MODES.length];
  apply(currentMode);
  write(currentMode);
}
