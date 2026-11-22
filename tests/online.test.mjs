// The online referee (server/referee.mjs): every online table played out at random by two "people",
// through the same turns the hall offers, with the referee packed and unpacked along the way as a sleeping
// room would be. Also checks what a player's page does with each move: apply it to its own copy of the game
// and land on the server's state, so the table animates the move instead of being laid out again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Referee, ONLINE } from '../server/referee.mjs';

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
  assert.throws(() => new Referee(R, 'gin', {}), /cannot be played online/);
  assert.throws(() => new Referee(R, 'landlord', {}), /cannot be played online/);
});

test('every online table plays out between two people, surviving sleep, and the page keeps in step', { timeout: 600000 }, () => {
  const report = [];
  for (const id of ONLINE) {
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
