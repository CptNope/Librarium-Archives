#!/usr/bin/env node
// Builds dist/artifact.html: a single self-contained fragment for publishing as a
// Claude artifact. It takes the <!-- artifact:head --> and <!-- artifact:body -->
// sections of index.html and inlines the local CSS and JS they reference.
// Remote scripts and Google Fonts links stay as they are.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

function section(name) {
  const m = html.match(new RegExp(`<!-- artifact:${name} -->([\\s\\S]*?)<!-- /artifact:${name} -->`));
  if (!m) throw new Error(`index.html is missing the artifact:${name} markers`);
  return m[1].trim();
}
const isLocal = p => !/^(https?:)?\/\//.test(p);
const inline = s => s
  .replace(/<link rel="stylesheet" href="([^"]+)">/g, (all, href) =>
    isLocal(href) ? `<style>\n${readFileSync(join(root, href), 'utf8').trim()}\n</style>` : all)
  .replace(/<script src="([^"]+)"><\/script>/g, (all, src) =>
    isLocal(src) ? `<script>\n${readFileSync(join(root, src), 'utf8').trim()}\n</script>` : all);

const out = `${inline(section('head'))}\n\n${inline(section('body'))}\n`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'artifact.html'), out);
console.log(`dist/artifact.html written (${(out.length / 1024).toFixed(1)} KB)`);
