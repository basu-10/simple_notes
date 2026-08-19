// Copies the freshly built Android APK into the web deploy root so the
// landing page download link (downloads/NoteZen.apk) can serve it.
// Usage: node scripts/stage-apk.mjs [debug|release]
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const variant = process.argv[2] || 'debug';

const apkDir = join(root, 'android', 'app', 'build', 'outputs', 'apk', variant);
const candidates = [
  join(apkDir, 'app-' + variant + '.apk'),
  join(apkDir, 'app-' + variant + '-signed.apk'),
  join(apkDir, 'app.apk'),
];

const src = candidates.find((p) => existsSync(p));
if (!src) {
  console.error('APK not found. Build it first:\n  cd android && ./gradlew assemble' +
    variant.charAt(0).toUpperCase() + variant.slice(1) + ' --no-daemon && cd ..');
  process.exit(1);
}

const outDir = join(root, 'downloads');
mkdirSync(outDir, { recursive: true });
const dest = join(outDir, 'NoteZen.apk');
cpSync(src, dest, { recursive: false });

console.log('Staged ' + variant + ' APK -> ' + dest);
