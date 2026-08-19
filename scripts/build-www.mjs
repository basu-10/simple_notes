// Regenerates the Capacitor web assets directory (www/) from the project root.
// The repo root holds the canonical web source; www/ is a build artifact (gitignored).
import { rmSync, mkdirSync, cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dest = join(root, 'www');

// Root web files that make up the app (no sw.js / _headers — those are web/PWA-only).
const files = ['app.html', 'index.html', 'css', 'js', 'icon.svg', 'manifest.webmanifest'];

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

for (const f of files) {
  const src = join(root, f);
  if (existsSync(src)) cpSync(src, join(dest, f), { recursive: true });
}

// Capacitor launches index.html, so alias it to the app entry (app.html).
if (existsSync(join(dest, 'app.html'))) {
  writeFileSync(join(dest, 'index.html'), readFileSync(join(dest, 'app.html'), 'utf8'));
}

console.log('Built www/ from root web assets.');
