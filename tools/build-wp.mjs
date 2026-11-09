#!/usr/bin/env node
// Builds the WordPress plugin into dist/librarium-archives/ and zips it to
// dist/librarium-archives.zip.
//
//   wordpress/                  plugin PHP and readme
//   css/, js/                   the Archives, copied to assets/
//   index.html                  its <!-- artifact:body --> markup, minus scripts, becomes templates/archives.html
//   vendor/three.min.js         bundled if present (CI downloads it); otherwise the plugin falls back to the CDN
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'librarium-archives');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets', 'css'), { recursive: true });
mkdirSync(join(out, 'assets', 'js'), { recursive: true });
mkdirSync(join(out, 'templates'), { recursive: true });

cpSync(join(root, 'wordpress'), out, { recursive: true });
cpSync(join(root, 'css', 'archives.css'), join(out, 'assets', 'css', 'archives.css'));
for (const f of ['rules.js', 'archives.js']) cpSync(join(root, 'js', f), join(out, 'assets', 'js', f));

const html = readFileSync(join(root, 'index.html'), 'utf8');
const body = html.match(/<!-- artifact:body -->([\s\S]*?)<!-- \/artifact:body -->/);
if (!body) throw new Error('index.html is missing the artifact:body markers');
const markup = body[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();
if (!markup.includes('<div id="lm-app">')) throw new Error('Archives markup must start with <div id="lm-app">');
writeFileSync(join(out, 'templates', 'archives.html'), markup + '\n');

const three = join(root, 'vendor', 'three.min.js');
if (existsSync(three)) {
  mkdirSync(join(out, 'assets', 'vendor'), { recursive: true });
  cpSync(three, join(out, 'assets', 'vendor', 'three.min.js'));
  if (existsSync(join(root, 'vendor', 'three.LICENSE'))) cpSync(join(root, 'vendor', 'three.LICENSE'), join(out, 'assets', 'vendor', 'three.LICENSE'));
  console.log('three.js bundled');
} else {
  console.warn('vendor/three.min.js not found: this build loads three.js from cdnjs');
}

// Keep the plugin version in step with package.json.
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
for (const f of ['librarium-archives.php', 'readme.txt']) {
  const p = join(out, f);
  writeFileSync(p, readFileSync(p, 'utf8')
    .replace(/(\* Version:\s+)[\d.]+/, `$1${version}`)
    .replace(/(define\( 'LIBRARIUM_ARCHIVES_VERSION', ')[\d.]+(' \);)/, `$1${version}$2`)
    .replace(/(Stable tag: )[\d.]+/, `$1${version}`));
}

const zip = join(root, 'dist', 'librarium-archives.zip');
rmSync(zip, { force: true });
execFileSync('zip', ['-qr', zip, 'librarium-archives'], { cwd: join(root, 'dist') });
console.log(`dist/librarium-archives.zip written (plugin ${version})`);
