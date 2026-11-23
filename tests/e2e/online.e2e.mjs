// Online play in the hall: one page in Chromium, and the other player as a plain WebSocket that moves at
// random. Run by tests/online-run.mjs (npm run test:online -- --e2e), which starts a local server first.
//
//   As host: the page sits at chess, opens a room from the Opponent row, and plays the Node player.
//   As guest: the Node player opens an Ur room, and the page joins by its link (?join=CODE): it sits in the
//   far seat, sees the board from across the table, reads the notes turned round, and throws its own dice.
// Both check that the page's game matches the server's after every move it was sent.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, createReadStream, mkdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'test-results'); mkdirSync(OUT, { recursive: true });
const ONLINE = process.env.ONLINE_URL || 'http://127.0.0.1:8788', WS = ONLINE.replace(/^http/, 'ws');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const LONG = 300000;

// The site, with the server's address in data-online as a host page would have it.
const server = createServer((req, res) => {
  let f = join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  if (f.endsWith('index.html')) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(readFileSync(f, 'utf8').replace('<div id="lm-app"', `<div id="lm-app" data-online="${ONLINE}"`)); }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); createReadStream(f).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
after(async () => { await browser.close(); server.close(); });
// A failed test leaves no page running behind it: two software-rendered pages at once starve each other.
const closeAll = async () => { for (const p of opened.splice(0)) await p.close().catch(() => {}); for (const f of friends.splice(0)) f.close(); };

// The other player: plays at random on its turns, and keeps the last state the server sent.
function friend(code, token) {
  const ws = new WebSocket(`${WS}/rooms/${code}` + (token ? `?token=${encodeURIComponent(token)}` : ''));
  const f = { seat: null, me: null, cur: 0, phase: '', moves: [], over: null, state: null, sent: 0, auto: true, inbox: [] };
  const act = () => {
    if (!f.auto || f.phase !== 'throw' && f.phase !== 'choose' || f.cur !== f.me) return;
    const msg = f.phase === 'throw' ? { t: 'throw' } : f.moves.length ? { t: 'choose', i: (Math.random() * f.moves.length) | 0 } : { t: 'pass' };
    f.phase = 'sent'; setTimeout(() => { ws.send(JSON.stringify(msg)); f.sent++; }, 700);
  };
  ws.addEventListener('message', e => {
    if (e.data === 'pong') return;
    const m = JSON.parse(e.data);
    f.inbox.push(m);
    if (m.t === 'welcome') { f.seat = m.seat; f.me = m.seat; }
    if (m.t === 'snapshot') { Object.assign(f, { me: m.snap.you ?? f.seat, cur: m.snap.cur, phase: m.snap.phase, moves: m.snap.moves || [], state: m.snap.state }); act(); }
    if (m.t === 'events') {
      for (const ev of m.events) {
        if (ev.type === 'turn') Object.assign(f, { cur: ev.seat, phase: ev.phase, moves: ev.moves || [] });
        if (ev.type === 'move') f.state = ev.state;
        if (ev.type === 'over') { f.phase = 'over'; f.over = ev.result; }
      }
      act();
    }
  });
  f.close = () => { try { ws.close(); } catch (e) { /* closed */ } };
  f.send = m => ws.send(JSON.stringify(m));
  f.opened = new Promise(r => ws.addEventListener('open', r));
  f.wait = async (pred, ms = LONG) => { const t0 = Date.now(); for (;;) { const i = f.inbox.findIndex(pred); if (i >= 0) return f.inbox.splice(i, 1)[0]; if (Date.now() - t0 > ms) throw new Error('the friend waited in vain; got ' + f.inbox.map(x => x.t).join(',')); await new Promise(r => setTimeout(r, 200)); } };
  f.log = []; ws.addEventListener('message', e => { if (e.data !== 'pong') f.log.push(String(e.data).slice(0, 300)); });
  friends.push(f);
  return f;
}

const opened = [], friends = [];
async function newPage(url) {
  const page = await browser.newPage({ viewport: { width: 760, height: 520 } });
  opened.push(page);
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e).slice(0, 300)));
  if (existsSync(join(ROOT, 'vendor/three.min.js'))) await page.route('**/three.min.js', r => r.fulfill({ path: join(ROOT, 'vendor/three.min.js'), contentType: 'text/javascript' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto(url, { timeout: LONG, waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__archives && document.querySelector('#lm-loader.done'), null, { polling: 500, timeout: LONG });
  return page;
}
// A wait that says where the page was when it gives up.
async function waitOn(page, fn, arg, opts) {
  try { return await page.waitForFunction(fn, arg, opts); }
  catch (e) {
    const where = await page.evaluate(() => { const P = window.__archives && window.__archives.play; return JSON.stringify({ phase: P && P.phase, online: P && P.online && P.online.seat, panel: !document.getElementById('lm-online').hidden, err: document.getElementById('lm-onErr').textContent, status: document.getElementById('lm-onStatus').textContent, msg: document.getElementById('lm-msg').textContent }); }).catch(() => 'unknown');
    throw new Error(e.message.split('\n')[0] + ' — the page: ' + where);
  }
}
const state = page => page.evaluate(() => { const P = window.__archives.play; return { phase: P.phase, cur: P.cur, seat: P.online && P.online.seat, code: P.online && P.online.code, msg: document.getElementById('lm-msg').textContent }; });
const engine = page => page.evaluate(() => { const g = window.__archives.play.game, out = {}, d = Object.getOwnPropertyDescriptors(g); for (const k of Object.keys(d)) if ('value' in d[k] && typeof d[k].value !== 'function' && !['rules', 'source', 'surface'].includes(k)) out[k] = d[k].value; return JSON.stringify(window.LibrariumRules.packState(out)); });

// Take turns until a number of the page's own moves are made, checking the page agrees with the server.
async function playTurns(page, f, ownMoves) {
  let mine = 0; const said = new Set();
  for (let k = 0; k < 200 && mine < ownMoves && f.phase !== 'over'; k++) {
    const s = await state(page); said.add(s.msg);
    if ((s.phase === 'choose' || s.phase === 'throw') && s.cur === s.seat) {
      await page.evaluate(() => { const A = window.__archives, P = A.play; if (P.phase === 'throw') A.humanThrow(); else A.choose(P.moves[(Math.random() * P.moves.length) | 0]); });
      mine++;
    }
    await page.waitForTimeout(900);
  }
  // Settle on the page's own turn (the friend is waiting), then the page's game is the server's.
  await waitOn(page, () => { const P = window.__archives.play; return P.phase === 'over' || ['choose', 'throw'].includes(P.phase) && P.cur === P.online.seat; }, null, { polling: 500, timeout: LONG });
  const ours = JSON.parse(await engine(page));
  for (const k of Object.keys(f.state)) assert.deepEqual(ours[k], f.state[k], `the page's game is the server's (${k})`);
  return [...said];
}

test('online, as host: open a room at the chess table and play a friend on another device', { timeout: LONG * 3 }, async t => {
  t.after(closeAll);
  const page = await newPage(`${base}/index.html?debug`);
  await page.evaluate(() => { const A = window.__archives, ex = A.STOPS.find(s => s.game === 'chess'); A.jump(ex.id); A.startGame(ex); });
  await waitOn(page, () => window.__archives.play.phase === 'choose', null, { polling: 500, timeout: LONG });
  assert.equal(await page.evaluate(() => !!document.getElementById('lm-onlineBtn')), true, 'the Opponent row offers Online');
  await page.evaluate(() => document.getElementById('lm-onlineBtn').click());
  await page.evaluate(() => document.getElementById('lm-onOpen').click());
  await waitOn(page, () => /^[A-Z2-9]{6}$/.test(document.getElementById('lm-onCodeShow').textContent), null, { polling: 500, timeout: LONG });
  const code = await page.evaluate(() => document.getElementById('lm-onCodeShow').textContent);
  await page.screenshot({ path: join(OUT, 'online-room.png'), clip: { x: 0, y: 0, width: 760, height: 520 }, timeout: LONG, animations: 'disabled' });
  const f = friend(code);
  await waitOn(page, () => { const P = window.__archives.play; return P.online && ['choose', 'remote'].includes(P.phase); }, null, { polling: 500, timeout: LONG });
  const s = await state(page);
  assert.equal(s.seat, 0); assert.equal(s.code, code);
  assert.match(s.msg, /Your friend has joined/);
  assert.equal(await page.evaluate(() => document.getElementById('lm-hintBtn').hidden && document.getElementById('lm-undoBtn').hidden), true, 'no hints or take-backs online');
  const said = await playTurns(page, f, 3);
  assert.ok(said.some(m => /Waiting for your friend/.test(m)), 'the page says when it is the friend\'s turn');
  // Leaving the table gives up the seat: the friend hears of it.
  await page.evaluate(() => window.__archives.leaveGame());
  assert.equal(await page.evaluate(() => window.__archives.play.online), null);
  f.close();
  assert.deepEqual(page.errors, []);
});

test('online, as guest: join an Ur room by its link, sit across the table, throw your own dice', { timeout: LONG * 3 }, async t => {
  t.after(closeAll);
  const r = await fetch(ONLINE + '/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'ur' }) }).then(x => x.json());
  const f = friend(r.code, r.token);
  const page = await newPage(`${base}/index.html?debug&join=${r.code}`);
  await waitOn(page, () => { const P = window.__archives.play; return P.online && ['throw', 'remote', 'choose'].includes(P.phase); }, null, { polling: 500, timeout: LONG });
  assert.equal((await state(page)).seat, 1);
  // The camera is on the far side of the table.
  assert.ok(await page.evaluate(() => { const A = window.__archives; return A.play.ex.group.worldToLocal(A.camera.position.clone()).z < 0; }), 'the guest looks from the far side');
  const said = await playTurns(page, f, 4);
  assert.ok(said.some(m => /You threw \d/.test(m)), 'the guest throws for themselves');
  assert.ok(said.every(m => !/The Scribe/.test(m)), 'no Scribe online');
  await page.screenshot({ path: join(OUT, 'online-guest.png'), clip: { x: 0, y: 0, width: 760, height: 520 }, timeout: LONG, animations: 'disabled' });
  // A dropped connection comes back to the same seat: reload the page with the link.
  await page.reload({ timeout: LONG, waitUntil: 'domcontentloaded' });
  await waitOn(page, () => { const P = window.__archives && window.__archives.play; return P && P.online && P.online.seat === 1 && ['throw', 'remote', 'choose'].includes(P.phase); }, null, { polling: 500, timeout: LONG });
  f.close();
  assert.deepEqual(page.errors, []);
});

test('online cards: join a gin room in the second seat; the other hand and the stock are only ever card backs here', { timeout: LONG * 3 }, async t => {
  t.after(closeAll);
  const r = await fetch(ONLINE + '/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'gin' }) }).then(x => x.json());
  const f = friend(r.code, r.token);
  const page = await newPage(`${base}/index.html?debug&join=${r.code}`);
  await waitOn(page, () => { const P = window.__archives.play; return P.online && ['choose', 'remote'].includes(P.phase); }, null, { polling: 500, timeout: LONG });
  // What this page holds: its own ten cards, face values; the host's hand and the stock, backs (negative) only.
  const hands = () => page.evaluate(() => { const G = window.__archives.play.game; return { mine: G.hands[1].slice(), theirs: G.hands[0].slice(), stock: G.stock.slice(), up: G.hands[1].map(c => { const m = window.__archives.play.P.mesh.get(c); return m && Math.abs(m.rotation.z) < 0.01; }) }; });
  for (let k = 0; k < 6; k++) {
    const h = await hands();
    assert.ok(h.mine.length >= 10 && h.mine.every(c => c >= 0), 'your own cards, face values');
    assert.ok(h.theirs.every(c => c < 0), 'the host\'s cards: backs only');
    assert.ok(h.stock.every(c => c < 0), 'the stock: backs only');
    assert.ok(h.up.every(Boolean), 'your own hand is face up on your side');
    // Our move when it is our turn; then the friend's.
    await waitOn(page, () => { const P = window.__archives.play; return P.phase === 'choose' && P.cur === P.online.seat; }, null, { polling: 500, timeout: LONG });
    await page.evaluate(() => { const A = window.__archives, P = A.play; A.choose(P.moves[(Math.random() * P.moves.length) | 0]); });
    await page.waitForTimeout(2500);
  }
  assert.ok(!(await page.evaluate(() => document.getElementById('lm-msg').textContent)).includes('Scribe'));
  await page.screenshot({ path: join(OUT, 'online-gin.png'), clip: { x: 0, y: 0, width: 760, height: 520 }, timeout: LONG, animations: 'disabled' });
  f.close();
  assert.deepEqual(page.errors, []);
});

test('online cards: open an Écarté room as host; the guest\'s hand and the talon are only ever card backs here', { timeout: LONG * 3 }, async t => {
  t.after(closeAll);
  const page = await newPage(`${base}/index.html?debug`);
  await page.evaluate(() => { const A = window.__archives, ex = A.STOPS.find(s => s.game === 'ecarte'); A.jump(ex.id); A.startGame(ex); });
  await waitOn(page, () => !!document.getElementById('lm-onlineBtn'), null, { polling: 500, timeout: LONG });
  await page.evaluate(() => document.getElementById('lm-onlineBtn').click());
  await page.evaluate(() => document.getElementById('lm-onOpen').click());
  await waitOn(page, () => /^[A-Z2-9]{6}$/.test(document.getElementById('lm-onCodeShow').textContent), null, { polling: 500, timeout: LONG });
  const f = friend(await page.evaluate(() => document.getElementById('lm-onCodeShow').textContent));
  await waitOn(page, () => { const P = window.__archives.play; return P.online && P.game.id === 'ecarte' && ['choose', 'remote'].includes(P.phase); }, null, { polling: 500, timeout: LONG });
  for (let k = 0; k < 5; k++) {
    const h = await page.evaluate(() => { const G = window.__archives.play.game; return { mine: G.hands[0].slice(), theirs: G.hands[1].slice(), talon: G.stock.slice(), theirDiscards: G.discards[1].slice() }; });
    assert.ok(h.mine.every(c => c >= 0) && h.theirs.every(c => c < 0) && h.talon.every(c => c < 0) && h.theirDiscards.every(c => c < 0), 'only your own cards are faces');
    await waitOn(page, () => { const P = window.__archives.play; return P.phase === 'choose' && P.cur === P.online.seat || P.phase === 'over'; }, null, { polling: 500, timeout: LONG });
    if (await page.evaluate(() => window.__archives.play.phase === 'over')) break;
    await page.evaluate(() => { const A = window.__archives, P = A.play; A.choose(P.moves[(Math.random() * P.moves.length) | 0]); });
    await page.waitForTimeout(2500);
  }
  f.close();
  assert.deepEqual(page.errors, []);
});

// The Games Desk: a room with no game, the friend's suggestion accepted, the game saved to a sealed file, the
// table left and come back to, and the file carried on in a new room, each player back in their seat.
test('the Games Desk: a suggestion accepted, a sealed save, and the game carried on in a new room', { timeout: LONG * 4 }, async t => {
  t.after(closeAll);
  const page = await newPage(`${base}/index.html?debug`);
  await page.evaluate(() => { const A = window.__archives; A.jump('lobby'); });
  await waitOn(page, () => [...document.querySelectorAll('#lm-placardActions .btn')].some(b => b.textContent === 'Open the Games Desk'), null, { polling: 500, timeout: LONG });
  await page.evaluate(() => [...document.querySelectorAll('#lm-placardActions .btn')].find(b => b.textContent === 'Open the Games Desk').click());
  assert.equal(await page.evaluate(() => !document.getElementById('lm-online').hidden && document.querySelectorAll('#lm-onSteps li').length), 4, 'the desk opens with its four steps');
  await page.evaluate(() => document.getElementById('lm-onOpen').click());
  await waitOn(page, () => /^[A-Z2-9]{6}$/.test(document.getElementById('lm-onCodeShow').textContent), null, { polling: 500, timeout: LONG });
  const code = await page.evaluate(() => document.getElementById('lm-onCodeShow').textContent);
  await page.screenshot({ path: join(OUT, 'online-desk.png'), clip: { x: 0, y: 0, width: 760, height: 520 }, timeout: LONG, animations: 'disabled' });
  // The friend joins and suggests Kalah; the page sees it at the desk and accepts.
  const f = friend(code); await f.opened; await f.wait(m => m.t === 'welcome');
  assert.equal(await page.evaluate(() => window.__archives.play.phase !== 'choose'), true, 'no game begins by itself');
  f.send({ t: 'propose', game: 'kalah' });
  await waitOn(page, () => !document.getElementById('lm-onProposal').hidden && !document.getElementById('lm-onPropYes').hidden, null, { polling: 500, timeout: LONG });
  assert.match(await page.evaluate(() => document.getElementById('lm-onPropText').textContent), /Your friend suggests Kalah/);
  await page.evaluate(() => document.getElementById('lm-onAccept').click());
  await waitOn(page, () => { const P = window.__archives.play; return P.online && P.game.id === 'kalah' && ['choose', 'remote'].includes(P.phase); }, null, { polling: 500, timeout: LONG });
  assert.equal(await page.evaluate(() => window.__archives.play.online.seat), 1, 'the friend suggested it, so the friend moves first');
  await playTurns(page, f, 2);
  // Save: a sealed file comes down; the friend is sent nothing.
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: LONG }), page.evaluate(() => document.getElementById('lm-saveBtn').click())]);
  const file = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  assert.equal(file.librarium, 'online-save'); assert.equal(file.game, 'kalah'); assert.equal(file.seat, 1); assert.match(file.sealed, /^L1\./);
  assert.ok(!file.sealed.includes('kalah') && !('state' in file), 'the game is sealed');
  const atSave = JSON.parse(await engine(page));
  // Leaving the table keeps the room: the desk says the game is on, and Back to the table returns to it.
  await page.evaluate(() => window.__archives.leaveGame());
  await waitOn(page, () => !document.getElementById('lm-online').hidden && !document.getElementById('lm-onGame').hidden, null, { polling: 500, timeout: LONG });
  await page.evaluate(() => document.getElementById('lm-onBack').click());
  await waitOn(page, () => { const P = window.__archives.play; return P.online && P.game.id === 'kalah' && ['choose', 'remote'].includes(P.phase); }, null, { polling: 500, timeout: LONG });
  // Leave the room altogether; open a new one, and bring the file: the new friend is asked, and accepts.
  f.auto = false;
  await page.evaluate(() => { window.__archives.leaveGame(); });
  await waitOn(page, () => !document.getElementById('lm-online').hidden, null, { polling: 500, timeout: LONG });
  await page.evaluate(() => document.getElementById('lm-onLeaveRoom').click());
  f.close();
  await waitOn(page, () => !document.getElementById('lm-onStart').hidden, null, { polling: 500, timeout: LONG });
  await page.setInputFiles('#lm-onFile', { name: 'saved.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await waitOn(page, () => /^[A-Z2-9]{6}$/.test(document.getElementById('lm-onCodeShow').textContent) && !document.getElementById('lm-onProposal').hidden, null, { polling: 500, timeout: LONG });
  assert.match(await page.evaluate(() => document.getElementById('lm-onPropText').textContent), /You asked to carry on your game of Kalah/);
  const code2 = await page.evaluate(() => document.getElementById('lm-onCodeShow').textContent);
  assert.notEqual(code2, code);
  const f2 = friend(code2); await f2.opened;
  const w2 = await f2.wait(m => m.t === 'welcome');
  assert.ok(w2.proposal && w2.proposal.resume && w2.proposal.game === 'kalah', 'the new friend is asked to carry on the saved game');
  f2.send({ t: 'answer', yes: true });
  await waitOn(page, () => { const P = window.__archives.play; return P.online && P.game.id === 'kalah' && ['choose', 'remote'].includes(P.phase); }, null, { polling: 500, timeout: LONG });
  assert.equal(await page.evaluate(() => window.__archives.play.online.seat), 1, 'back in the seat it had, though this page opened the room');
  const back = JSON.parse(await engine(page));
  assert.deepEqual(back.p, atSave.p, 'the pits as they were saved');
  f2.close();
  assert.deepEqual(page.errors, []);
});

// Games at one screen and against the Scribe save to a plain file and come back from the desk as they were.
test('saved games: a chess game against the Scribe and an Ur game at one screen go to a file and come back', { timeout: LONG * 3 }, async t => {
  t.after(closeAll);
  const page = await newPage(`${base}/index.html?debug`);
  const sit = id => page.evaluate(id => { const A = window.__archives, ex = A.STOPS.find(s => s.game === id); A.jump(ex.id); A.startGame(ex); }, id);
  const saveFile = async () => { const [dl] = await Promise.all([page.waitForEvent('download', { timeout: LONG }), page.evaluate(() => document.getElementById('lm-saveBtn').click())]); return JSON.parse(readFileSync(await dl.path(), 'utf8')); };
  const bring = async file => {
    await page.evaluate(() => { const A = window.__archives; A.leaveGame(); });
    await page.evaluate(() => document.getElementById('lm-deskBtn').click());
    await waitOn(page, () => !document.getElementById('lm-online').hidden, null, { polling: 500, timeout: LONG });
    await page.setInputFiles('#lm-onFile', { name: 'saved.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  };
  // Chess against the Scribe: one move each, then save at the start of the next turn.
  await sit('chess');
  await waitOn(page, () => window.__archives.play.phase === 'choose', null, { polling: 500, timeout: LONG });
  await page.evaluate(() => { const A = window.__archives, P = A.play; A.choose(P.moves[0]); });
  await waitOn(page, () => { const P = window.__archives.play; return P.phase === 'choose' && P.cur === 0; }, null, { polling: 500, timeout: LONG });
  const chess = await saveFile();
  assert.equal(chess.librarium, 'game-save'); assert.equal(chess.game, 'chess'); assert.equal(chess.hotseat, false);
  await bring(chess);
  await waitOn(page, () => { const P = window.__archives.play; return P.game && P.game.id === 'chess' && P.phase === 'choose' && P.resumed; }, null, { polling: 500, timeout: LONG });
  assert.deepEqual(JSON.parse(await engine(page)).b, chess.state.b, 'the board as it was saved');
  // Ur at one screen: save before a throw; it comes back at one screen, with the same player to throw.
  await page.evaluate(() => { const A = window.__archives; A.leaveGame(); });
  await sit('ur');
  await waitOn(page, () => !!document.querySelector('#lm-variant button'), null, { polling: 500, timeout: LONG });
  await page.evaluate(() => { const b = [...document.querySelectorAll('#lm-variant button')].find(x => x.textContent === 'A friend'); if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); });
  await waitOn(page, () => { const P = window.__archives.play; return P.hotseat && P.phase === 'throw'; }, null, { polling: 500, timeout: LONG });
  for (let k = 0; k < 40; k++) { // a few throws and moves, ending before a throw
    const ph = await page.evaluate(() => window.__archives.play.phase);
    if (k >= 4 && ph === 'throw') break;
    await page.evaluate(() => { const A = window.__archives, P = A.play; if (P.phase === 'throw') A.humanThrow(); else if (P.phase === 'choose') A.choose(P.moves[0]); });
    await page.waitForTimeout(1500);
  }
  await waitOn(page, () => window.__archives.play.phase === 'throw', null, { polling: 500, timeout: LONG });
  const ur = await saveFile();
  assert.equal(ur.game, 'ur'); assert.equal(ur.hotseat, true);
  const turn = await page.evaluate(() => window.__archives.play.cur);
  assert.equal(ur.turn, turn);
  await bring(ur);
  await waitOn(page, () => { const P = window.__archives.play; return P.game && P.game.id === 'ur' && P.hotseat && P.phase === 'throw' && P.resumed; }, null, { polling: 500, timeout: LONG });
  assert.equal(await page.evaluate(() => window.__archives.play.cur), turn, 'the same player to throw');
  assert.deepEqual(JSON.parse(await engine(page)).pos, ur.state.pos, 'the pieces as they were');
  // A file that is not a saved game is refused at the desk.
  await page.setInputFiles('#lm-onFile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await waitOn(page, () => !document.getElementById('lm-onErr').hidden, null, { polling: 500, timeout: LONG });
  assert.deepEqual(page.errors, []);
});
