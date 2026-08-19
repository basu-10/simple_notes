const CACHE = "notezen-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./css/styles.css",
  "./js/app.js",
  "./js/utils.js",
  "./js/state.js",
  "./js/db.js",
  "./js/ui.js",
  "./js/crud.js",
  "./js/ai.js",
  "./js/drive.js",
  "./js/export-import.js"
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
  if (req.method !== "GET") return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res && res.status === 200 && res.type === "basic") cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  })());
});
