// Browser tests for the Archives: the hall loads, and the systems that span every table still hold up.
//
//   npm run test:e2e            (needs Playwright and its Chromium: see docs/development.md)
//
// They drive the page through its debug API (index.html?debug exposes window.__archives) instead of
// clicking the 3D view, and run in a software-rendered browser, so every wait is generous. Screenshots
// land in test-results/ and are kept by CI.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, createReadStream, mkdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'test-results'); mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const LONG = 300000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let server, browser, page, base;
const errors = [];

// Every table a test touches is marked as seen, so its rules panel stays shut; the Scribe plays Gentle to keep it quick.
const SEEN = ['newqueen', 'chess', 'dotsboxes', 'ur', 'bao', 'scopa'];
async function open(path = 'index.html') {
  page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  await page.addInitScript(seen => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const rulesSeen = {}; for (const g of seen) rulesSeen[g] = true;
    localStorage.setItem('librarium.archives.v1', JSON.stringify({ rulesSeen, level: 'gentle', variants: { dotsboxes: '4' } }));
  }, SEEN);
  // three.js from vendor/ when it is there (CI fetches it), so the tests need no network.
  if (existsSync(join(ROOT, 'vendor/three.min.js'))) await page.route('**/three.min.js', r => r.fulfill({ path: join(ROOT, 'vendor/three.min.js'), contentType: 'text/javascript' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(`${base}/${path}?debug`, { timeout: LONG });
  await page.waitForFunction(() => window.__archives && document.querySelector('#lm-loader.done'), null, { timeout: LONG });
}
const state = () => page.evaluate(() => {
  const P = window.__archives.play;
  return { phase: P.phase, cur: P.cur, moves: P.moves.length, hot: !!P.hotseat, msg: document.getElementById('lm-msg').textContent };
});
async function yourTurn(ms = LONG) {
  const t = Date.now(); let s;
  while (Date.now() - t < ms) { s = await state(); if (s.phase === 'over' || (s.phase === 'choose' && s.cur === 0)) return s; await sleep(300); }
  throw new Error('still waiting for a turn: ' + JSON.stringify(s));
}
const sit = id => page.evaluate(id => { const M = window.__archives; M.jump(id); M.startGame(M.STOPS.find(x => x.id === id)); }, id);
const leave = async () => { await page.evaluate(() => window.__archives.leaveGame()); await sleep(800); };
const playAny = () => page.evaluate(() => { const P = window.__archives.play; window.__archives.choose(P.moves[(Math.random() * P.moves.length) | 0]); });
const shot = name => page.screenshot({ path: join(OUT, name + '.png'), timeout: LONG * 3 });

before(async () => {
  server = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/artifact.html') { // the single-file build, in a page of its own
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end('<!doctype html><meta charset="utf-8"><body>' + readFileSync(join(ROOT, 'dist/artifact.html'), 'utf8'));
    }
    let f = join(ROOT, url);
    if (f.startsWith(ROOT) && existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html'); // as a host would: the service worker caches ./
    if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
    createReadStream(f).pipe(res);
  }).listen(0);
  base = `http://localhost:${server.address().port}`;
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await open();
});
after(async () => { if (browser) await browser.close(); if (server) server.close(); });

test('the hall loads, and the passport has a stamp for every exhibit', { timeout: LONG }, async () => {
  const n = await page.evaluate(() => {
    document.getElementById('lm-passBtnRail').click();
    return { stamps: document.querySelectorAll('#lm-passport .stamp').length, hidden: document.getElementById('lm-passport').hidden };
  });
  assert.equal(n.hidden, false);
  assert.ok(n.stamps >= 66, `only ${n.stamps} stamps`);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.getElementById('lm-passport').hidden), true);
});

test('chess: the Scribe answers from its worker; Undo, the move list, and a resumed game', { timeout: LONG * 3 }, async () => {
  await sit('newqueen'); await yourTurn();
  for (let k = 0; k < 2; k++) { await playAny(); await sleep(400); await yourTurn(); }
  assert.equal(await page.evaluate(() => window.__archives.scribe.on), true, 'the Scribe is not thinking in a worker');
  assert.ok(await page.evaluate(() => window.__archives.play.halos.size > 0), 'no ring marks the pieces you can move');
  // Hints off: no halos and no rings drawn, though the rings are still there to click; on again brings them back.
  await page.keyboard.press('KeyM'); await sleep(300);
  const off = await page.evaluate(() => { const P = window.__archives.play; return { halos: P.halos.size, drawn: P.rings.filter(r => r.material.visible).length, label: document.getElementById('lm-marksBtn').textContent }; });
  assert.deepEqual(off, { halos: 0, drawn: 0, label: 'Hints: off' });
  await page.evaluate(() => document.getElementById('lm-marksBtn').click()); await sleep(300);
  assert.ok(await page.evaluate(() => window.__archives.play.halos.size > 0), 'hints did not come back on');
  const listed = await page.evaluate(() => { document.getElementById('lm-movesBtn').click(); return [...document.querySelectorAll('#lm-moveList li')].map(li => li.textContent); });
  assert.equal(listed.length, 4, listed.join(' / '));
  assert.match(listed[0], /^1\.You[a-h][1-8][–×][a-h][1-8]/);
  const before = await page.evaluate(() => JSON.stringify(window.__archives.play.game.board || window.__archives.play.game.b));
  await page.evaluate(() => document.getElementById('lm-undoBtn').click()); await sleep(600); await yourTurn();
  const undone = await page.evaluate(() => ({ list: document.querySelectorAll('#lm-moveList li').length, board: JSON.stringify(window.__archives.play.game.board || window.__archives.play.game.b) }));
  assert.equal(undone.list, 2); assert.notEqual(undone.board, before);
  await leave(); await sit('newqueen'); await yourTurn();
  assert.equal(await page.evaluate(() => window.__archives.play.resumed), true, 'the game was not resumed');
  await shot('chess-resumed');
  await leave();
});

test('dots and boxes: played to the end, then replayed move by move', { timeout: LONG * 4 }, async () => {
  await sit('dotsboxes'); let s = await yourTurn();
  for (let k = 0; k < 60 && s.phase !== 'over'; k++) { await playAny(); await sleep(250); s = await yourTurn(); }
  assert.equal(s.phase, 'over');
  await sleep(600);
  const lines = () => page.evaluate(() => { const P = window.__archives.play; return [P.P.ex.pieces.lines.filter(l => l.visible).length, P.game.drawn.filter(Boolean).length]; });
  await page.evaluate(() => document.getElementById('lm-replayBtn').click()); await sleep(400);
  assert.deepEqual(await lines(), [0, 0]);
  await page.evaluate(() => { for (let k = 0; k < 3; k++) [...document.querySelectorAll('#lm-choices button')].find(b => b.getAttribute('aria-label') === 'Next move').click(); });
  assert.deepEqual(await lines(), [3, 3]);
  await page.keyboard.press('ArrowLeft');
  assert.deepEqual(await lines(), [2, 2]);
  await page.keyboard.press('Escape'); await sleep(300);
  assert.equal(await page.evaluate(() => document.getElementById('lm-win').hidden), false);
  await leave();
});

test('ur: pass-and-play, each player throwing for themselves', { timeout: LONG * 2 }, async () => {
  await sit('ur'); await sleep(1500);
  // the Opponent switch beside the board: choosing a friend starts the game again
  await page.evaluate(() => [...document.querySelectorAll('#lm-hud button')].find(b => b.textContent.trim() === 'A friend').click());
  await page.waitForFunction(() => window.__archives.play.hotseat === true, null, { timeout: LONG });
  const seats = new Set();
  for (let k = 0; k < 120 && seats.size < 2; k++) {
    await sleep(300); const s = await state();
    if (s.phase === 'throw') { seats.add(s.cur); await page.evaluate(() => window.__archives.humanThrow()); }
    else if (s.phase === 'choose') await page.evaluate(() => { const P = window.__archives.play; window.__archives.choose(P.moves[0]); });
    else assert.notEqual(s.phase, 'ai', 'the Scribe took a turn in a game against a friend');
  }
  assert.deepEqual([...seats].sort(), [0, 1]);
  await leave();
});

// No screenshot here: a software-rendered frame of Bao's sixty-four seeds took from one to five minutes to capture, depending on the machine's load.
test('bao: the guide opens a first game', { timeout: LONG * 2 }, async t => {
  let t0 = Date.now(); const lap = n => { t.diagnostic(`${n} ${((Date.now() - t0) / 1000).toFixed(1)} s`); t0 = Date.now(); }; // timings, to see a slow step in CI
  await sit('bao'); lap('sit'); await yourTurn(); lap('turn');
  t.diagnostic('scene objects ' + await page.evaluate(() => { let n = 0; window.__archives.play.ex.group.parent.traverse(() => n++); return n; }));
  const note = await page.evaluate(() => document.getElementById('lm-coach').hidden ? '' : document.getElementById('lm-coachText').textContent);
  assert.match(note, /seed/);
  await page.evaluate(() => document.getElementById('lm-coachOff').click());
  assert.equal(await page.evaluate(() => document.getElementById('lm-coach').hidden), true);
  await leave();
});

test('scopa: the Pack switch redraws the cards in place, and a hand goes on', { timeout: LONG * 2 }, async () => {
  await sit('scopa'); await yourTurn();
  const faces = () => page.evaluate(() => window.__archives.PRES.scopa.cards.map(m => m.userData.mats[0].map.uuid).join());
  const before = await faces(), moves = await page.evaluate(() => window.__archives.play.moves.length);
  const pack = await page.evaluate(() => [...document.querySelectorAll('#lm-variant button')].filter(b => ['French', 'German', 'Swiss', 'Latin'].includes(b.textContent)).map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')));
  assert.deepEqual(pack, ['French', 'German', 'Swiss', 'Latin*']);
  await page.evaluate(() => [...document.querySelectorAll('#lm-variant button')].find(b => b.textContent === 'French').click()); await sleep(500);
  assert.notEqual(await faces(), before, 'the cards were not redrawn');
  assert.equal(await page.evaluate(() => window.__archives.play.moves.length), moves, 'switching the pack restarted the hand');
  assert.doesNotMatch(await page.evaluate(() => document.getElementById('lm-rules').textContent + document.getElementById('lm-msg').textContent), /\b(swords|batons)\b/);
  await playAny(); await sleep(400); await yourTurn();
  await page.evaluate(() => [...document.querySelectorAll('#lm-variant button')].find(b => b.textContent === 'Latin').click());
  await leave();
});

test('the single-file build loads and its Scribe thinks in a worker too', { timeout: LONG * 2 }, async () => {
  if (!existsSync(join(ROOT, 'dist/artifact.html'))) return; // built by npm run build:artifact
  await page.close(); await open('artifact.html');
  await sit('newqueen'); await yourTurn();
  await playAny(); await sleep(400); await yourTurn();
  assert.equal(await page.evaluate(() => window.__archives.scribe.on), true);
  await leave();
});

test('the published site works offline once it has loaded', { timeout: LONG * 2 }, async () => {
  // The software renderer is shared by every page in the browser: shut the hall's own page so this one gets it.
  if (page) { await page.close(); page = null; }
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 } });
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push(String(e).slice(0, 300)));
  if (existsSync(join(ROOT, 'vendor/three.min.js'))) await ctx.route('**/three.min.js', r => r.fulfill({ path: join(ROOT, 'vendor/three.min.js'), contentType: 'text/javascript' }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(`${base}/index.html?pwa`, { timeout: LONG, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), null, { timeout: LONG });
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload({ timeout: LONG, waitUntil: 'domcontentloaded' }); // now under the worker's control
  await ctx.setOffline(true);
  await p.reload({ timeout: LONG, waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelector('#lm-loader.done'), null, { timeout: LONG });
  assert.equal(await p.evaluate(() => !!navigator.serviceWorker.controller), true);
  await ctx.close();
});

test('no page errors along the way', () => { assert.deepEqual(errors, []); });
