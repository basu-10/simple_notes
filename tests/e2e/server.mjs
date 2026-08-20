// Zero-dependency static file server for the Playwright e2e suite.
// Serves the built www/ directory (run `npm run build:www` first).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = join(process.cwd(), "www");
const PORT = 5188;
const HOST = "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json"
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/") path = "/app.html";
    const filePath = normalize(join(ROOT, path));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404).end("Not found: " + path);
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": TYPES[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-cache"
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500).end("Server error: " + e.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`e2e static server on http://${HOST}:${PORT}`);
});
