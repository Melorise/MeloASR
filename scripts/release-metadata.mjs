import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [version] = process.argv.slice(2);

if (!version) {
  throw new Error('用法：node scripts/release-metadata.mjs <版本号> [输出文件]');
}

const root = resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (packageJson.version !== version) {
  throw new Error(`package.json 版本为 ${packageJson.version}，与请求版本 ${version} 不一致。`);
}

const changelog = await readFile(resolve(root, 'CHANGELOG.md'), 'utf8');
const heading = new RegExp(`^## \\[${version.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\](?:\\s|$).*$`, 'm');
const match = heading.exec(changelog);
if (!match) {
  throw new Error(`CHANGELOG.md 中缺少版本 ${version} 的二级标题。`);
}

const start = match.index + match[0].length;
const next = /^##\s+\[/m.exec(changelog.slice(start));
const notes = changelog.slice(start, next ? start + next.index : undefined).trim();
if (!notes) {
  throw new Error(`CHANGELOG.md 中版本 ${version} 没有发布说明。`);
}

const output = process.argv[3];
if (output) {
  await writeFile(resolve(output), `${notes}\n`, 'utf8');
} else {
  process.stdout.write(`${notes}\n`);
}
