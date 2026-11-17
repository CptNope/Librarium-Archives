#!/usr/bin/env node
// Measure what drawing the hall costs, at the entrance, in three wings, at the lectern and seated at two
// tables: draw calls, triangles, meshes, materials, GPU geometries and textures, the CPU time of render(), and
// the JavaScript heap. Measure before optimizing, and compare after (the threejs-performance skill's first rule).
//   node tools/profile-hall.mjs                 the hall as built
//   node tools/profile-hall.mjs --nomerge       without merging static meshes, to compare
//   node tools/profile-hall.mjs --json=out.json also write the numbers to a file
// Uses Playwright's Chromium with SwiftShader, so render times are for software rendering: compare runs on the
// same machine, and trust the counters over the milliseconds.
import { createServer } from 'node:http';
import { existsSync, createReadStream, statSync, writeFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), flag = n => args.includes('--' + n), opt = n => (args.find(a => a.startsWith(`--${n}=`)) || '').split('=')[1];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
const server = createServer((req, res) => {
  let f = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(res);
}).listen(0);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { localStorage.setItem('librarium.archives.v1', JSON.stringify({ level: 'fair', rulesSeen: { go: true, mahjong: true } })); });
if (existsSync(join(ROOT, 'vendor/three.min.js'))) await page.route('**/three.min.js', r => r.fulfill({ path: join(ROOT, 'vendor/three.min.js'), contentType: 'text/javascript' }));
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const t0 = Date.now();
await page.goto(`http://localhost:${server.address().port}/index.html?debug&fixedres${flag('nomerge') ? '&nomerge' : ''}`, { timeout: 300000 });
await page.waitForFunction(() => window.__archives && document.querySelector('#lm-loader.done'), null, { timeout: 300000 });
const loadMs = Date.now() - t0;
await page.waitForFunction(() => window.__archives.bootTimes.all, null, { timeout: 300000 }); // every exhibit built

const measure = () => page.evaluate(() => {
  const M = window.__archives, r = M.renderer, sc = M.scene;
  let meshes = 0; const mats = new Set();
  sc.traverse(o => { if (o.isMesh) { meshes++; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m)); } });
  r.render(sc, M.camera); r.render(sc, M.camera); // the first render at a new place uploads its textures and geometry
  const times = [];
  for (let k = 0; k < 9; k++) { const a = performance.now(); r.render(sc, M.camera); times.push(performance.now() - a); }
  times.sort((a, b) => a - b);
  return { calls: r.info.render.calls, triangles: r.info.render.triangles, meshes, materials: mats.size, geometries: r.info.memory.geometries, textures: r.info.memory.textures,
    renderMs: +times[4].toFixed(1), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null };
});
const places = {};
places.entrance = await measure();
for (const id of ['wing2', 'wing4', 'wing6', 'next']) { await page.evaluate(id => window.__archives.jump(id), id); await sleep(1500); places[id] = await measure(); }
for (const id of ['go', 'mahjong']) {
  await page.evaluate(id => { const M = window.__archives; M.jump(id); M.startGame(M.STOPS.find(s => s.id === id)); }, id);
  await sleep(5000); places['at ' + id] = await measure();
  await page.evaluate(() => window.__archives.leaveGame()); await sleep(800);
}
const merged = await page.evaluate(() => window.__archives.mergeStats);
await browser.close(); server.close();

console.log(`Loader lifted after ${(loadMs / 1000).toFixed(1)} s. Merged ${merged.merged} of ${merged.meshes} static meshes away.\n`);
console.log('| Place | Draw calls | Triangles | Meshes | Materials | GPU geometries | Textures | render() ms | Heap MB |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const [k, v] of Object.entries(places)) console.log(`| ${k} | ${v.calls} | ${v.triangles} | ${v.meshes} | ${v.materials} | ${v.geometries} | ${v.textures} | ${v.renderMs} | ${v.heapMB} |`);
if (opt('json')) writeFileSync(opt('json'), JSON.stringify({ loadMs, merged, places }, null, 1));
