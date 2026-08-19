export const $ = id => document.getElementById(id);
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

export const toast = (m, duration = 1800) => {
  let t = $("toast");
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(t.x);
  t.x = setTimeout(() => t.classList.remove("show"), duration);
};

export const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
