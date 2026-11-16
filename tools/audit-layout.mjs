#!/usr/bin/env node
// A layout audit of the hall's interface at common screen sizes.
//
//   node tools/audit-layout.mjs [out-dir] [--shots] [--only=phone-se,ipad]
//
// For every size and every state (the hall, a placard, the index, the passport, a table with its rules, its
// moves, the guide, the variant and pack switches, and the end-of-game card) it measures:
//   offscreen  a control that is not wholly inside the window
//   covered    a control another element sits on top of, so a tap at its middle goes elsewhere
//   overlap    two panels on top of each other
//   noexit     an open panel with no visible, tappable way to close it
//   small      a control smaller than 24 x 24 CSS pixels (WCAG 2.2, 2.5.8)
//   overflow   a panel taller than the window that cannot scroll, or text cut off sideways
// It writes report.json and report.md to the out dir, and screenshots with --shots. Needs Playwright.
import { createServer } from 'node:http';
import { readFileSync, existsSync, createReadStream, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const OUT = args.find(a => !a.startsWith('--')) || join(ROOT, 'test-results', 'layout');
const SHOTS = args.includes('--shots');
const ONLY = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });

export const SIZES = [
  { id: 'phone-small', w: 320, h: 568, touch: true, label: 'iPhone SE (1st gen)' },
  { id: 'phone-android', w: 360, h: 740, touch: true, label: 'Android, small' },
  { id: 'phone-se', w: 375, h: 667, touch: true, label: 'iPhone SE' },
  { id: 'phone', w: 390, h: 844, touch: true, label: 'iPhone 14' },
  { id: 'phone-pixel', w: 412, h: 915, touch: true, label: 'Pixel 7' },
  { id: 'phone-max', w: 430, h: 932, touch: true, label: 'iPhone Pro Max' },
  { id: 'phone-se-land', w: 667, h: 375, touch: true, label: 'iPhone SE, landscape' },
  { id: 'phone-land', w: 844, h: 390, touch: true, label: 'iPhone 14, landscape' },
  { id: 'phone-pixel-land', w: 915, h: 412, touch: true, label: 'Pixel 7, landscape' },
  { id: 'ipad-mini', w: 768, h: 1024, touch: true, label: 'iPad mini' },
  { id: 'ipad', w: 820, h: 1180, touch: true, label: 'iPad Air' },
  { id: 'ipad-land', w: 1180, h: 820, touch: true, label: 'iPad Air, landscape' },
  { id: 'laptop-small', w: 1280, h: 720, touch: false, label: 'Laptop 1280 x 720' },
  { id: 'laptop', w: 1366, h: 768, touch: false, label: 'Laptop 1366 x 768' },
  { id: 'desktop', w: 1440, h: 900, touch: false, label: 'Desktop 1440 x 900' },
  { id: 'desktop-hd', w: 1920, h: 1080, touch: false, label: 'Desktop 1920 x 1080' },
];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = createServer((req, res) => {
  let f = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (f.startsWith(ROOT) && existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  createReadStream(f).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Runs in the page: measures what is on screen now. `open` names the panels that should be closable.
function measure(open) {
  const W = innerWidth, H = innerHeight, app = document.getElementById('lm-app');
  const vis = el => { if (!el || el.closest('[hidden]')) return false; const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const name = el => el.id ? '#' + el.id : (el.getAttribute('aria-label') || el.textContent.trim().slice(0, 24) || el.className);
  const issues = [];
  const controls = [...app.querySelectorAll('button, input, a[href], select')].filter(vis).filter(el => !el.closest('.placard.away') && !el.closest('.loader'));
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    // Strips that scroll sideways (the rail's exhibits, the moves list) are allowed to run past the edge.
    const scroller = el.closest('.stops, .indexcols, .scroll, .rules, .coach');
    if (!scroller && (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1)) issues.push({ kind: 'offscreen', what: name(el), rect: [r.left, r.top, r.right, r.bottom].map(Math.round) });
    if (scroller) { const sr = scroller.getBoundingClientRect(); if (r.right < sr.left || r.left > sr.right || r.bottom < sr.top || r.top > sr.bottom) continue; }
    const cx = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(H - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(cx, cy);
    if (hit && hit !== el && !el.contains(hit) && !(el.labels && [...el.labels].includes(hit))) issues.push({ kind: 'covered', what: name(el), by: name(hit.closest('[id]') || hit) });
    if ((r.width < 24 || r.height < 24) && !el.closest('.stops')) issues.push({ kind: 'small', what: name(el), size: [Math.round(r.width), Math.round(r.height)] });
  }
  // Panels that should not sit on one another.
  const PANELS = ['.brand', '#lm-helpBtn', '#lm-soundBtn', '#lm-fsBtn', '#lm-placard:not(.away)', '#lm-rail', '#lm-index', '#lm-passport', '.hudtop', '#lm-rules', '#lm-moves', '#lm-coach', '.hudbottom', '#lm-joy', '#lm-win .card'];
  const boxes = PANELS.map(sel => { const el = app.querySelector(sel); return vis(el) ? { sel, r: el.getBoundingClientRect() } : null; }).filter(Boolean);
  // A few pairs are meant to overlap: the brand under the HUD while playing (it fades), the rail's fade, the dialogs over the rail's fade.
  const fine = new Set(['.brand|.hudtop', '#lm-rail|#lm-index', '#lm-rail|#lm-passport', '.hudbottom|#lm-coach']);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (fine.has(a.sel + '|' + b.sel) || fine.has(b.sel + '|' + a.sel)) continue;
    if (a.sel === '#lm-win .card' || b.sel === '#lm-win .card') continue; // the end card is modal on purpose
    const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (x > 4 && y > 4) issues.push({ kind: 'overlap', what: a.sel + ' + ' + b.sel, area: [Math.round(x), Math.round(y)] });
  }
  // Every open panel needs a way out that is on screen and tappable.
  const EXITS = { '#lm-placard': ['#lm-closeP'], '#lm-index': ['#lm-indexClose'], '#lm-passport': ['#lm-passClose'], '#lm-rules': ['#lm-rulesBtn', '#lm-rulesClose'], '#lm-moves': ['#lm-movesBtn', '#lm-movesClose'], '#lm-coach': ['#lm-coachOk'], '#lm-win': ['#lm-winLeave', '#lm-againBtn'] };
  for (const p of open) {
    const panel = app.querySelector(p); if (!vis(panel)) continue;
    const ok = (EXITS[p] || []).some(sel => {
      const el = app.querySelector(sel); if (!vis(el)) return false;
      const r = el.getBoundingClientRect(); if (r.left < 0 || r.top < 0 || r.right > W || r.bottom > H) return false;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit && (hit === el || el.contains(hit));
    });
    if (!ok) issues.push({ kind: 'noexit', what: p });
  }
  // Panels taller than the window must scroll; text must not run off sideways.
  for (const sel of ['#lm-placard', '#lm-index', '#lm-passport', '#lm-rules', '#lm-moves', '#lm-coach', '#lm-win .card', '.hudtop', '.hudbottom']) {
    const el = app.querySelector(sel); if (!vis(el) || (sel === '#lm-placard' && el.classList.contains('away'))) continue;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    if ((r.bottom > H + 1 || r.top < -1) && !/(auto|scroll)/.test(s.overflowY)) issues.push({ kind: 'overflow', what: sel, rect: [Math.round(r.top), Math.round(r.bottom)] });
    if (el.scrollWidth > el.clientWidth + 2 && !/(auto|scroll)/.test(s.overflowX)) issues.push({ kind: 'overflow', what: sel + ' (sideways)', by: el.scrollWidth + ' > ' + el.clientWidth });
  }
  const hudTop = app.querySelector('.hudtop'), hudBot = app.querySelector('.hudbottom');
  // How much of the window the interface leaves for the board while playing.
  const free = vis(hudTop) && vis(hudBot) ? Math.round(hudBot.getBoundingClientRect().top - hudTop.getBoundingClientRect().bottom) : null;
  return { issues, free };
}

async function run() {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = [];
  for (const S of SIZES) {
    if (ONLY.length && !ONLY.includes(S.id)) continue;
    const ctx = await browser.newContext({ viewport: { width: S.w, height: S.h }, deviceScaleFactor: 1, isMobile: S.touch && S.w < 1000, hasTouch: S.touch, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      localStorage.setItem('librarium.archives.v1', JSON.stringify({ level: 'gentle', rulesSeen: { newqueen: true, piquet: true, bezique: true, scopa: true } }));
    });
    if (existsSync(join(ROOT, 'vendor/three.min.js'))) await page.route('**/three.min.js', r => r.fulfill({ path: join(ROOT, 'vendor/three.min.js'), contentType: 'text/javascript' }));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(`${base}/index.html?debug`, { timeout: 300000 });
    await page.waitForFunction(() => window.__archives && document.querySelector('#lm-loader.done'), null, { timeout: 300000 });
    // Two frames a second: the layout is the same, and the audit costs a fraction of the time.
    await page.evaluate(() => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => setTimeout(() => raf(cb), 500); });
    const states = [];
    const check = async (state, open = [], prep) => {
      try { if (prep) await prep(); } catch (e) { states.push({ state, error: String(e).slice(0, 200) }); return; }
      await sleep(900);
      const m = await page.evaluate(measure, open);
      states.push({ state, ...m });
      if (SHOTS) await page.screenshot({ path: join(OUT, `${S.id}--${state}.png`), timeout: 600000 });
    };
    const A = f => page.evaluate(f);
    const click = sel => A(`document.querySelector(${JSON.stringify(sel)}).click()`);
    await check('hall', ['#lm-placard']);
    await check('placard', ['#lm-placard'], () => A(() => { const M = window.__archives; M.goStop(M.STOPS.findIndex(s => s.id === 'newqueen')); }));
    await check('index', ['#lm-index'], () => click('#lm-indexBtn'));
    await check('index-search', ['#lm-index'], async () => { await page.focus('#lm-indexSearch'); await page.keyboard.type('chess'); });
    await check('passport', ['#lm-passport'], async () => { await click('#lm-indexClose'); await click('#lm-passBtnRail'); });
    await A(() => document.getElementById('lm-passClose').click());
    const sit = id => A(`(() => { const M = window.__archives; M.jump(${JSON.stringify(id)}); M.startGame(M.STOPS.find(x => x.id === ${JSON.stringify(id)})); })()`);
    const myTurn = async () => { for (let k = 0; k < 240; k++) { if (await A(() => { const P = window.__archives.play; return P.phase === 'choose' && P.cur === 0; })) return; await sleep(500); } };
    await check('table-chess', [], async () => { await sit('newqueen'); await myTurn(); });
    await check('table-chess-rules', ['#lm-rules'], () => click('#lm-rulesBtn'));
    await check('table-chess-moves', ['#lm-moves'], async () => { await A(() => { const P = window.__archives.play; window.__archives.choose(P.moves[0]); }); await myTurn(); await A(() => { const b = document.getElementById('lm-movesBtn'); if (!b.hidden) b.click(); }); });
    await check('table-chess-win', ['#lm-win'], () => A(() => { document.getElementById('lm-winTitle').textContent = 'You win at the New Queen'; document.getElementById('lm-winText').textContent = 'Checkmate in 31 moves, at Sharp.'; document.getElementById('lm-winRecord').textContent = 'Your record here: 3 wins, 2 losses.'; document.getElementById('lm-win').hidden = false; }));
    await A(() => { document.getElementById('lm-win').hidden = true; window.__archives.leaveGame(); }); await sleep(600);
    await check('table-piquet', [], async () => { await sit('cards'); await myTurn(); });
    await check('table-piquet-rules', ['#lm-rules'], () => click('#lm-rulesBtn'));
    await A(() => window.__archives.leaveGame()); await sleep(600);
    await check('table-bao-guide', ['#lm-coach'], async () => { await A(() => { localStorage.setItem('librarium.archives.v1', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('librarium.archives.v1') || '{}'), { guide: {} }))); }); await sit('bao'); await myTurn(); });
    await A(() => window.__archives.leaveGame()); await sleep(600);
    await check('table-ur', [], async () => { await sit('ur'); await sleep(1500); });
    await A(() => window.__archives.leaveGame()); await sleep(600);
    report.push({ size: S, states, errors });
    const n = states.reduce((t, s) => t + (s.issues ? s.issues.filter(i => i.kind !== 'small').length : 0), 0);
    console.log(`${S.id} ${S.w}x${S.h}: ${n} issues${errors.length ? ', ' + errors.length + ' page errors' : ''}`);
    await ctx.close();
  }
  await browser.close(); server.close();
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  // A readable summary: each issue once, with the sizes and states it shows up at.
  const seen = new Map();
  for (const r of report) for (const s of r.states) for (const i of s.issues || []) {
    const key = `${i.kind}: ${i.what}${i.by ? ' (under ' + i.by + ')' : ''}`;
    if (!seen.has(key)) seen.set(key, new Set()); seen.get(key).add(`${r.size.id}/${s.state}`);
  }
  const lines = ['# Layout audit', '', `${report.length} sizes. Board space while playing (px between the top and bottom bars):`, ''];
  for (const r of report) { const t = r.states.find(s => s.state === 'table-chess'); lines.push(`- ${r.size.label} (${r.size.w} x ${r.size.h}): ${t && t.free !== null ? t.free : '?'}`); }
  lines.push('', '## Issues', '');
  for (const [k, where] of [...seen].sort()) lines.push(`- **${k}** at ${[...where].slice(0, 8).join(', ')}${where.size > 8 ? ` and ${where.size - 8} more` : ''}`);
  writeFileSync(join(OUT, 'report.md'), lines.join('\n') + '\n');
  console.log('written', join(OUT, 'report.md'));
}
run().catch(e => { console.error(e); process.exit(1); });
