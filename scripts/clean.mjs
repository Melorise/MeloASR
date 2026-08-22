import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
fs.rmSync(path.join(root, 'dist-test'), { recursive: true, force: true });
