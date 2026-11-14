#!/usr/bin/env node
// Builds js/rules.js and js/archives.js from the parts in src/rules/ and src/hall/, joined in the order
// their ORDER files give. The site, the single-file page and the plugin all use the built files.
//
//   node tools/build-js.mjs           write the two files
//   node tools/build-js.mjs --check   fail if either is out of date (CI runs this)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const targets = [['src/rules', 'js/rules.js'], ['src/hall', 'js/archives.js']];
let stale = 0;
for (const [dir, out] of targets) {
  const order = readFileSync(join(root, dir, 'ORDER'), 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
  for (const f of order) if (!existsSync(join(root, dir, f))) throw new Error(`${dir}/ORDER names ${f}, which is missing`);
  const text = order.map(f => readFileSync(join(root, dir, f), 'utf8')).join('');
  const now = existsSync(join(root, out)) ? readFileSync(join(root, out), 'utf8') : '';
  if (check) { if (now !== text) { console.error(`${out} is out of date: run npm run build:js`); stale++; } }
  else if (now !== text) { writeFileSync(join(root, out), text); console.log(`${out} written from ${order.length} parts`); }
  else console.log(`${out} is up to date (${order.length} parts)`);
}
if (stale) process.exit(1);
