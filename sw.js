const CACHE = "notezen-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./app.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./css/styles.css",
  "./js/app.js",
  "./js/utils.js",
  "./js/state.js",
  "./js/db.js",
  "./js/ui.js",
  "./js/crud.js",
  "./js/drive.js",
  "./js/export-import.js",
  "./js/editor.js",
  "./js/vendor/ckeditor/ckeditor.js",
  "./js/vendor/ckeditor/config.js",
  "./js/vendor/ckeditor/styles.js",
  "./js/vendor/ckeditor/contents.css"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);

  // Network-first for IndexedDB/Drive API calls
  if (url.pathname.includes("/api/") || url.pathname.includes("googleapis.com")) {
    e.respondWith(networkFirst(req));
    return;
  }

  // Stale-while-revalidate for app assets
  if (req.method === "GET") {
    e.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    return cached || new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);

  const network = fetch(req).then(async res => {
    if (res && res.status === 200 && res.type === "basic") {
      cache.put(req, res.clone());
    }
    return res;
  }).catch(() => cached);

  return cached || network;
}

self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
  if (e.data === "getVersion") e.ports[0].postMessage({ version: CACHE });
});