import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const copies = [
  ['src/renderer/settings.html', 'dist/renderer/settings.html'],
  ['src/renderer/settings.css', 'dist/renderer/settings.css'],
  ['src/renderer/overlay.html', 'dist/renderer/overlay.html'],
  ['src/renderer/overlay.css', 'dist/renderer/overlay.css'],
  ['logo.png', 'dist/assets/logo.png']
];

for (const [source, target] of copies) {
  const destination = path.join(root, target);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, source), destination);
}
