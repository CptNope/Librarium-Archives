// The online referee (server/referee.mjs): every online table played out at random by two "people",
// through the same turns the hall offers, with the referee packed and unpacked along the way as a sleeping
// room would be. Also checks what a player's page does with each move: apply it to its own copy of the game
// and land on the server's state, so the table animates the move instead of being laid out again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Referee, ONLINE, VIEWS as VIEWS_ } from '../server/referee.mjs';

const R = createRequire(import.meta.url)('../js/rules.js');
const pick = a => a[(Math.random() * a.length) | 0];

function playOut(id, { maxActions = 1500, repackEvery = 37 } = {}) {
  let ref = new Referee(R, id, {});
  const events = ref.start();
  // The second player's page: its own engine, kept in step with the state each move event carries.
  const page = Object.create(R[id]); page.surface = 0; if (page.variants) page.setVariant(page.variant); page.init(); if (page.human) page.human = [true, true];
  Object.assign(page, R.unpackState(ref.state()));
  let actions = 0, matched = 0, moves = 0;
  const seen = ev => {
    for (const e of ev) {
      if (e.type !== 'move') continue;
      moves++;
      Object.assign(page, R.unpackState(e.before));
      const was = Math.random; Math.random = () => 0.5; // the page's dice don't matter: the server's state wins
      try { page.apply(Object.assign({}, e.move)); } catch (err) { /* the page lays the table out again */ }
      finally { Math.random = was; }
      const local = JSON.stringify(R.packState(stateOf(page)));
      if (local === JSON.stringify(e.state)) matched++;
      Object.assign(page, R.unpackState(e.state));
    }
  };
  seen(events);
  while (ref.phase !== 'over' && actions < maxActions) {
    actions++;
    if (actions % repackEvery === 0) { assert.ok(Referee.roundTrips(R, ref), `${id}: state survives packing`); ref = Referee.unpack(R, ref.pack()); }
    const seat = ref.cur;
    if (ref.phase === 'throw') { seen(ref.throw(seat)); continue; }
    assert.equal(ref.phase, 'choose', `${id}: a phase a player can act in`);
    if (!ref.moves.length) {
      assert.ok(ref.engine.canPass, `${id}: no moves offered and no pass allowed (stuck)`);
      seen(ref.choose(seat, 0, true)); continue;
    }
    // Moving the other player's piece, or out of turn, is refused.
    assert.throws(() => ref.choose(1 - seat, 0), /not your turn/);
    seen(ref.choose(seat, (Math.random() * ref.moves.length) | 0));
  }
  return { ref, actions, moves, matched };
}
function stateOf(g) {
  const out = {}, d = Object.getOwnPropertyDescriptors(g);
  for (const k of Object.keys(d)) if ('value' in d[k] && typeof d[k].value !== 'function' && !['rules', 'source', 'surface'].includes(k)) out[k] = d[k].value;
  return out;
}

test('the referee refuses tables that cannot be played online', () => {
  assert.throws(() => new Referee(R, 'cribbage', {}), /cannot be played online/);
  assert.throws(() => new Referee(R, 'landlord', {}), /cannot be played online/);
});

test('every online table plays out between two people, surviving sleep, and the page keeps in step', { timeout: 600000 }, () => {
  const report = [];
  for (const id of [...ONLINE].filter(x => !VIEWS_[x])) { // card tables: their own test, below
    let done = 0, act = 0, mv = 0, ok = 0;
    for (let n = 0; n < 3; n++) {
      const { ref, actions, moves, matched } = playOut(id);
      if (ref.phase === 'over') done++;
      act += actions; mv += moves; ok += matched;
      if (ref.phase === 'over') assert.ok(ref.result && 'winner' in ref.result || ref.result.title, `${id}: a result`);
    }
    assert.equal(ok, mv, `${id}: the page lands on the server's state after every move`);
    report.push(`${id} ${done}/3 finished, ${mv} moves, page in step ${mv ? Math.round(100 * ok / mv) : 0}%`);
  }
  console.log(report.join('\n'));
});

test('a throw comes from the server, and only the player to move may throw', () => {
  const ref = new Referee(R, 'ur', {});
  ref.start();
  assert.equal(ref.phase, 'throw');
  assert.throws(() => ref.throw(1 - ref.cur), /not your turn/);
  const ev = ref.throw(ref.cur);
  assert.equal(ev[0].type, 'roll');
  assert.ok(ev[0].roll.value >= 0 && ev[0].roll.value <= 4);
});

test('a move that was not offered is refused', () => {
  const ref = new Referee(R, 'chess', {});
  ref.start();
  assert.throws(() => ref.choose(0, 999), /no such move/);
  assert.throws(() => ref.choose(0, 0, true), /cannot pass/);
});

test('the host\'s variant carries to the referee', () => {
  const ref = new Referee(R, 'hex', { variant: '7' });
  ref.start();
  assert.equal(ref.snapshot().settings.variant, '7');
  assert.equal(ref.engine.n, 7);
});

// Card tables: what each seat is sent. Every game is played out at random by two people through the referee,
// and each seat's messages are checked as that seat's page would get them.
import { VIEWS } from '../server/referee.mjs';
const getAt = (o, p) => p.reduce((x, k) => (x == null ? x : x[k]), o);
function cardsAt(st, paths) { const out = []; for (const p of paths) { const x = getAt(st, p); if (Array.isArray(x)) out.push(...x); else if (x != null) out.push(x); } return out.filter(v => typeof v === 'number'); }

test('card tables: no card a seat has not seen ever reaches it, and its page keeps in step', { timeout: 600000 }, () => {
  const report = [];
  for (const id of Object.keys(VIEWS)) {
    const spec = VIEWS[id], name = c => R[id].cardName(c);
    let checked = 0, moves = 0, inStep = 0, games = 0;
    for (let n = 0; n < 4; n++) {
      const ref = new Referee(R, id, {});
      const first = ref.start();
      // Each seat's page, and the cards that seat has seen (its own, and everything shown on the table).
      const pages = [0, 1].map(() => { const g = Object.create(R[id]); g.surface = 0; if (g.variants) g.setVariant(g.variant); g.init(); return g; });
      const seen = [new Set(), new Set()];
      const look = (seat, raw) => { const hid = new Set(spec.hidden(seat, raw).map(p => p.join('.'))); cardsAt(raw, spec.cards(raw).filter(p => !hid.has(p.join('.')))).forEach(v => seen[seat].add(v)); };
      // Nothing in what a seat is sent may be, or name, a card hidden from it that it has never seen.
      const check = (seat, raw, msg) => {
        look(seat, raw);
        const secret = cardsAt(raw, spec.hidden(seat, raw)).filter(v => v >= 0 && !seen[seat].has(v));
        const text = JSON.stringify(msg);
        for (const v of secret) {
          const nm = name(v);
          if (nm && !nm.startsWith(' ')) assert.ok(!text.includes(nm), `${id}: seat ${seat} was sent "${nm}", which it may not see`);
        }
        const st = msg.state || msg.snap?.state;
        if (st) { const shown = new Set(cardsAt(st, spec.cards(st)).filter(v => v >= 0)); for (const v of secret) assert.ok(!shown.has(v), `${id}: seat ${seat} was sent card ${v} face up`); }
        if (msg.move) for (const f of spec.moveCards) for (const v of [].concat(msg.move[f] ?? [])) assert.ok(!secret.includes(v), `${id}: seat ${seat} was sent card ${v} in a move`);
        checked++;
      };
      for (const seat of [0, 1]) { const snap = ref.snapshotFor(seat); check(seat, ref.state(), { snap }); Object.assign(pages[seat], R.unpackState(snap.state)); }
      const deliver = evs => {
        for (const seat of [0, 1]) for (const e of ref.eventsFor(seat, evs)) {
          if (e.type === 'turn' && e.moves) { look(seat, ref.state()); e.moves.forEach(m => spec.moveCards.forEach(f => [].concat(m[f] ?? []).forEach(v => seen[seat].add(v)))); }
          if (e.type !== 'move') continue;
          const raw = evs.find(x => x.type === 'move' && JSON.stringify(x.move) === JSON.stringify(e.move) || x.type === 'move' && x.seat === e.seat && x.state && JSON.stringify(ref.eventsFor(seat, [x])[0]) === JSON.stringify(e));
          look(seat, raw.state); // what the move brings into view may already show in "before"
          check(seat, raw.before, { state: e.before, move: e.move, note: e.note });
          check(seat, raw.state, { state: e.state, note: e.note });
          // The page plays the move on the server's "before" and should land on its "after".
          const page = pages[seat]; moves++;
          Object.assign(page, R.unpackState(e.before));
          const was = Math.random; Math.random = () => 0.5;
          try { page.apply(Object.assign({}, e.move)); } catch (err) { /* laid out again from the server's state */ } finally { Math.random = was; }
          const mine = R.packState(stateOf(page));
          if (Object.keys(e.state).every(k => JSON.stringify(mine[k]) === JSON.stringify(e.state[k]))) inStep++;
          Object.assign(page, R.unpackState(e.state));
        }
      };
      deliver(first);
      let a = 0;
      while (ref.phase !== 'over' && a++ < 2500) {
        // Every field of the state is accounted for: a card place, or public.
        const known = new Set(spec.public.concat(spec.cards(ref.state()).map(p => String(p[0]))));
        for (const k of Object.keys(ref.state())) assert.ok(known.has(k), `${id}: the field "${k}" is not listed as cards or public`);
        const s = ref.cur;
        if (ref.phase === 'throw') deliver(ref.throw(s));
        else if (ref.moves.length) deliver(ref.choose(s, (Math.random() * ref.moves.length) | 0));
        else deliver(ref.choose(s, 0, true));
      }
      if (ref.phase === 'over') games++;
    }
    report.push(`${id}: ${games}/4 finished, ${checked} messages checked, page in step after ${Math.round(100 * inStep / moves)}% of ${moves} moves`);
    assert.ok(inStep / moves > 0.8, `${id}: the page should play most moves itself`);
  }
  console.log(report.join('\n'));
});
