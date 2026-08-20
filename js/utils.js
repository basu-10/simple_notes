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

// Plain-text view of possibly-rich HTML content (for previews/search).
export const stripHtml = html => {
  const s = String(html ?? "");
  if (!s.includes("<")) return s.replace(/\s+/g, " ").trim();
  const tmp = document.createElement("div");
  tmp.innerHTML = s;
  return (tmp.textContent || "").replace(/\s+/g, " ").trim();
};
