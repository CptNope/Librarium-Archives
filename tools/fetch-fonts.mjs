#!/usr/bin/env node
// Downloads the Archives' three typefaces (Almendra SC, Amethysta, Montserrat; all SIL Open Font License)
// into vendor/fonts/, with a fonts.css that points at the local files and each family's licence.
// The plugin bundles them when present, so a site using it makes no request to Google.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'vendor', 'fonts'); mkdirSync(dir, { recursive: true });
const CSS = 'https://fonts.googleapis.com/css2?family=Almendra+SC&family=Amethysta&family=Montserrat:wght@400;600&display=swap';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'; // asks for woff2
const LICENCES = { almendrasc: 'Almendra SC', amethysta: 'Amethysta', montserrat: 'Montserrat' };

const get = async (url, opts) => { const r = await fetch(url, opts); if (!r.ok) throw new Error(`${r.status} for ${url}`); return r; };
let css = await (await get(CSS, { headers: { 'user-agent': UA } })).text();
const urls = [...new Set([...css.matchAll(/url\((https:[^)]+\.woff2)\)/g)].map(m => m[1]))];
let n = 0;
for (const url of urls) {
  const name = `f${++n}.woff2`;
  writeFileSync(join(dir, name), Buffer.from(await (await get(url)).arrayBuffer()));
  css = css.split(url).join(name);
}
writeFileSync(join(dir, 'fonts.css'), `/* Almendra SC, Amethysta and Montserrat, from Google Fonts, under the SIL Open Font License 1.1 (see OFL-*.txt). */\n${css}`);
for (const [slug, family] of Object.entries(LICENCES)) {
  const txt = await (await get(`https://raw.githubusercontent.com/google/fonts/main/ofl/${slug}/OFL.txt`)).text();
  writeFileSync(join(dir, `OFL-${family.replace(/ /g, '')}.txt`), txt);
}
console.log(`vendor/fonts: ${urls.length} font files, fonts.css and ${Object.keys(LICENCES).length} licences`);
