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
  while (T[0].phase !== 'over' && actions < 1500) { // random play: tables usually ends in about 300 actions, and 1 game in 40 runs past 600
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

// A room from the Games Desk: no game until one is suggested and accepted; the one who suggests moves first;
// a game saved to a file comes back, sealed, in a new room, with each player in the seat they had.
async function lobbyRoom() {
  const r = await fetch(`${BASE}/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 200, 'opening a room with no game');
  const room = await r.json(); assert.equal(room.lobby, true); assert.equal(room.game, null);
  const host = client(`${WS}/rooms/${room.code}?token=${room.token}`); await host.opened;
  assert.equal((await host.next(m => m.t === 'welcome')).lobby, true);
  const guest = client(`${WS}/rooms/${room.code}`); await guest.opened;
  const gw = await guest.next(m => m.t === 'welcome'); assert.equal(gw.seat, 1); assert.equal(gw.proposal, null);
  await new Promise(r => setTimeout(r, 300));
  assert.ok(!host.inbox.some(m => m.t === 'snapshot') && !guest.inbox.some(m => m.t === 'snapshot'), 'no game begins by itself');
  return { room, host, guest, gw };
}
{
  const { host, guest } = await lobbyRoom();
  // Moving before any game is refused.
  guest.send({ t: 'choose', i: 0 }); assert.match((await guest.next(m => m.t === 'error')).msg, /No game/);
  // The guest suggests Ur; the guest cannot answer their own suggestion; the host declines, then accepts the next.
  guest.send({ t: 'propose', game: 'ur' });
  for (const c of [host, guest]) { const p = await c.next(m => m.t === 'proposal'); assert.deepEqual([p.proposal.by, p.proposal.game], [1, 'ur']); }
  guest.send({ t: 'answer', yes: true }); assert.match((await guest.next(m => m.t === 'error')).msg, /no suggestion/);
  host.send({ t: 'answer', yes: false });
  for (const c of [host, guest]) { const p = await c.next(m => m.t === 'proposal'); assert.equal(p.proposal, null); assert.equal(p.declined, 0); }
  guest.send({ t: 'propose', game: 'chess' });
  for (const c of [host, guest]) await c.next(m => m.t === 'proposal' && m.proposal);
  host.send({ t: 'answer', yes: true });
  const hs = await host.next(m => m.t === 'snapshot'), gs = await guest.next(m => m.t === 'snapshot');
  assert.equal(hs.fresh, true); assert.equal(hs.snap.id, 'chess');
  assert.deepEqual([gs.snap.you, hs.snap.you], [0, 1], 'the one who suggested the game moves first');
  assert.equal(gs.snap.moves.length > 0, true); assert.equal(hs.snap.moves.length, 0);
  // Play a few moves, then save: only the one who asks gets the file, and it is sealed.
  const T = { [0]: guest, [1]: host }, tr = [tracker(), tracker()]; tr[0].take(gs); tr[1].take(hs);
  for (let k = 0; k < 4; k++) {
    const me = T[tr[0].cur]; me.send({ t: 'choose', i: (Math.random() * tr[tr[0].cur].moves.length) | 0 });
    tr[0].take(await guest.next(m => m.t === 'events')); tr[1].take(await host.next(m => m.t === 'events'));
  }
  host.send({ t: 'save' });
  const saved = await host.next(m => m.t === 'saved');
  assert.equal(saved.game, 'chess'); assert.equal(saved.seat, 1); assert.match(saved.sealed, /^L1\./);
  assert.ok(!saved.sealed.includes('chess') && saved.sealed.length < 40000, 'the file is sealed, and small');
  await new Promise(r => setTimeout(r, 200)); assert.ok(!guest.inbox.some(m => m.t === 'saved'), 'the other player is not sent the file');
  host.send({ t: 'sync' }); const now = await host.next(m => m.t === 'snapshot'); assert.equal(now.fresh, undefined);
  for (const c of [host, guest]) try { c.ws.close(); } catch (e) { /* closed */ }

  // A new room: the file is refused if changed; whole, it is suggested, and accepted, it carries on where it
  // was, with the host back in the seat they had (the second), although the host opened this room.
  const b = await lobbyRoom();
  const bent = saved.sealed.slice(0, 40) + (saved.sealed[40] === 'A' ? 'B' : 'A') + saved.sealed.slice(41);
  b.host.send({ t: 'propose', save: bent }); assert.match((await b.host.next(m => m.t === 'error')).msg, /changed/);
  b.host.send({ t: 'propose', save: saved.sealed });
  const pr = await b.guest.next(m => m.t === 'proposal' && m.proposal);
  assert.equal(pr.proposal.game, 'chess'); assert.equal(pr.proposal.by, 0); assert.ok(pr.proposal.resume && pr.proposal.resume.turns >= 4);
  b.guest.send({ t: 'answer', yes: true });
  const h2 = await b.host.next(m => m.t === 'snapshot'), g2 = await b.guest.next(m => m.t === 'snapshot');
  assert.equal(h2.resumed, true); assert.deepEqual([h2.snap.you, g2.snap.you], [1, 0], 'each back in the seat they had');
  assert.deepEqual(h2.snap.state.b, now.snap.state.b, 'the board as it was saved');
  assert.equal(h2.snap.cur, now.snap.cur);
  for (const c of [b.host, b.guest]) try { c.ws.close(); } catch (e) { /* closed */ }
  // A table's room still begins by itself, and suggestions there are refused.
  const t = await open('kalah'); const th = client(`${WS}/rooms/${t.code}?token=${t.token}`); await th.opened;
  const tg = client(`${WS}/rooms/${t.code}`); await tg.opened; await th.next(m => m.t === 'snapshot');
  th.send({ t: 'propose', game: 'chess' }); assert.match((await th.next(m => m.t === 'error')).msg, /one table/);
  for (const c of [th, tg]) try { c.ws.close(); } catch (e) { /* closed */ }
  console.log('games desk rooms: suggest, decline, accept, save and carry on all passed');
}
console.log('online server: all checks passed');
process.exit(0);
