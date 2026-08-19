export const $ = id => document.getElementById(id);
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

export const toast = m => {
  let t = $("toast");
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(t.x);
  t.x = setTimeout(() => t.classList.remove("show"), 1800);
};

export const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
