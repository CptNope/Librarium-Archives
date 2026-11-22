// The online server end to end, against a local copy of the Worker (wrangler dev), with two players as
// WebSockets: a room opened and joined, a whole game played at random through the server, a move out of turn
// refused, a lost connection rejoined with the seat's token, a third player turned away, and a code that
// was never opened. Run with:  npm run test:online   (it starts and stops the local server itself)
import assert from 'node:assert/strict';

const BASE = process.env.ONLINE_URL || 'http://127.0.0.1:8787', WS = BASE.replace(/^http/, 'ws');
const GAMES = (process.argv[2] || 'chess,ur,go,tables,kalah').split(',');

function client(url) {
  const ws = new WebSocket(url), inbox = [], waiters = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data); inbox.push(m);
    for (const w of waiters.splice(0)) w();
  });
  const opened = new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const closed = new Promise(res => ws.addEventListener('close', e => res(e.code)));
  async function next(pred, ms = 8000) {
    const t0 = Date.now();
    for (;;) {
      const i = inbox.findIndex(pred);
      if (i >= 0) return inbox.splice(i, 1)[0];
      if (Date.now() - t0 > ms) throw new Error('timed out waiting; inbox: ' + JSON.stringify(inbox.map(m => m.t)));
      await new Promise(r => { waiters.push(r); setTimeout(r, 200); });
    }
  }
  return { ws, opened, closed, next, send: m => ws.send(JSON.stringify(m)), inbox };
}

async function open(game) {
  const r = await fetch(`${BASE}/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game }) });
  assert.equal(r.status, 200, `opening a ${game} room`);
  return r.json();
}

// Follow the game from one player's messages: whose turn, what phase, the moves offered to them.
function tracker() {
  const t = { cur: 0, phase: 'idle', moves: [], over: null };
  t.take = msg => {
    const evs = msg.t === 'snapshot' ? (msg.events || []) : msg.events || [];
    if (msg.t === 'snapshot') { const s = msg.snap; Object.assign(t, { cur: s.cur, phase: s.phase, moves: s.moves || [], over: s.result }); }
    for (const e of evs) {
      if (e.type === 'turn') Object.assign(t, { cur: e.seat, phase: e.phase, moves: e.moves || [] });
      if (e.type === 'over') Object.assign(t, { phase: 'over', over: e.result });
    }
  };
  return t;
}

async function playGame(game) {
  const room = await open(game);
  assert.match(room.code, /^[A-Z2-9]{6}$/);
  const host = client(`${WS}/rooms/${room.code}?token=${room.token}`); await host.opened;
  const hw = await host.next(m => m.t === 'welcome'); assert.equal(hw.seat, 0); assert.equal(hw.opponent, false);
  const guest = client(`${WS}/rooms/${room.code}`); await guest.opened;
  const gw = await guest.next(m => m.t === 'welcome'); assert.equal(gw.seat, 1); assert.ok(gw.token);
  await host.next(m => m.t === 'presence' && m.online);
  const T = [tracker(), tracker()], P = [host, guest];
  for (const s of [0, 1]) T[s].take(await P[s].next(m => m.t === 'snapshot'));

  // A third person is turned away.
  const third = client(`${WS}/rooms/${room.code}`); await third.opened;
  assert.equal((await third.next(m => m.t === 'full')).t, 'full');

  let actions = 0, refusedOnce = false, rejoined = false;
  while (T[0].phase !== 'over' && actions < 600) {
    actions++;
    const s = T[0].cur, me = P[s];
    if (!refusedOnce) { // the other player tries to act: refused, with the game sent again
      P[1 - s].send(T[0].phase === 'throw' ? { t: 'throw' } : { t: 'choose', i: 0 });
      const err = await P[1 - s].next(m => m.t === 'error'); assert.match(err.msg, /not your turn/);
      T[1 - s].take(await P[1 - s].next(m => m.t === 'snapshot'));
      refusedOnce = true;
    }
    if (!rejoined && actions === 6) { // the guest's connection drops, and they come back with their token
      guest.ws.close(); await guest.closed;
      await host.next(m => m.t === 'presence' && !m.online);
      const back = client(`${WS}/rooms/${room.code}?token=${gw.token}`); await back.opened;
      assert.equal((await back.next(m => m.t === 'welcome')).seat, 1);
      T[1] = tracker(); T[1].take(await back.next(m => m.t === 'snapshot'));
      P[1] = back; rejoined = true;
      assert.equal(T[1].cur, T[0].cur);
      continue;
    }
    const mine = T[s];
    if (mine.phase === 'throw') me.send({ t: 'throw' });
    else if (mine.moves.length) me.send({ t: 'choose', i: (Math.random() * mine.moves.length) | 0 });
    else me.send({ t: 'pass' });
    for (const k of [0, 1]) T[k].take(await P[k].next(m => m.t === 'events'));
    assert.equal(T[0].cur, T[1].cur, 'both players agree whose turn it is');
  }
  assert.equal(T[0].phase, 'over', `${game} finished within ${actions} actions`);
  assert.deepEqual(T[0].over, T[1].over);
  // Again: a fresh game in the same room.
  P[0].send({ t: 'again' });
  for (const k of [0, 1]) { const m = await P[k].next(x => x.t === 'snapshot'); assert.equal(m.fresh, true); }
  for (const c of [host, P[1], third]) try { c.ws.close(); } catch (e) { /* closed */ }
  return actions;
}

const health = await fetch(`${BASE}/health`).then(r => r.json());
assert.equal(health.ok, true);
// A code nobody opened.
const ghost = client(`${WS}/rooms/ZZZZZZ`); await ghost.opened;
assert.equal((await ghost.next(m => m.t === 'gone')).t, 'gone');
// A table that cannot be played online.
assert.equal((await fetch(`${BASE}/rooms`, { method: 'POST', body: JSON.stringify({ game: 'cribbage' }) })).status, 400);
for (const g of GAMES) console.log(`${g}: played through the server in ${await playGame(g)} actions`);
console.log('online server: all checks passed');
process.exit(0);
