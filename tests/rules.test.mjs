import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rules = require('../js/rules.js');
const { ur: UR, senet: SENET } = rules;

const P0 = 0, P1 = 1;

/* ---------------------------------------------------------- Royal Game of Ur */

test('Ur: a throw of 0 has no moves', () => {
  UR.init();
  assert.deepEqual(UR.legal(P0, 0), []);
});

test('Ur: only one entry move is offered when several pieces wait', () => {
  UR.init();
  const moves = UR.legal(P0, 2);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].from, 0);
  assert.equal(moves[0].to, 2);
});

test('Ur: landing on a rosette earns another throw', () => {
  UR.init();
  for (const sq of [4, 8, 14]) assert.equal(UR.extra({ to: sq }), true);
  assert.equal(UR.extra({ to: 5 }), false);
});

test('Ur: captures happen only in the shared middle row', () => {
  UR.init();
  UR.pos[P0][0] = 3; UR.pos[P1][0] = 6;
  const cap = UR.legal(P0, 3).find(m => m.i === 0);
  assert.equal(cap.to, 6);
  assert.equal(cap.cap, 0);
  UR.apply(cap);
  assert.equal(UR.pos[P1][0], 0, 'captured piece returns to the start');
});

test('Ur: private squares never clash between players', () => {
  UR.init();
  UR.pos[P0][0] = 1; UR.pos[P1][0] = 3;
  const m = UR.legal(P0, 2).find(x => x.i === 0);
  assert.equal(m.to, 3);
  assert.equal(m.cap, -1, 'square 3 is in each player\'s own row');
});

test('Ur: the central rosette is safe', () => {
  UR.init();
  UR.pos[P0][0] = 6; UR.pos[P1][0] = 8;
  assert.equal(UR.legal(P0, 2).some(m => m.i === 0), false);
});

test('Ur: bearing off needs an exact throw', () => {
  UR.init();
  UR.pos[P0][0] = 13;
  assert.equal(UR.legal(P0, 2).find(m => m.i === 0).to, 15);
  assert.equal(UR.legal(P0, 3).some(m => m.i === 0), false);
});

test('Ur: dice values follow four binary dice', () => {
  const counts = [0, 0, 0, 0, 0];
  for (let i = 0; i < 20000; i++) counts[UR.roll().value]++;
  rules.DICE_P.forEach((p, v) => assert.ok(Math.abs(counts[v] / 20000 - p) < 0.02, `value ${v}`));
});

/* ------------------------------------------------------------------- Senet */

test('Senet: no white sticks counts as 5, and 1/4/5 throw again', () => {
  let saw5 = false;
  for (let i = 0; i < 400; i++) { const r = SENET.roll(); if (r.faces.every(f => f === 0)) { assert.equal(r.value, 5); saw5 = true; } }
  assert.ok(saw5);
  assert.deepEqual([1, 2, 3, 4, 5].map(v => SENET.extra({}, v)), [true, false, false, true, true]);
});

test('Senet: landing on a lone opponent swaps places', () => {
  SENET.init();
  SENET.pos = [[12, 31, 31, 31, 31], [14, 31, 31, 31, 31]];
  const m = SENET.legal(P0, 2)[0];
  assert.equal(m.swap, 0);
  SENET.apply(m);
  assert.equal(SENET.pos[P0][0], 14);
  assert.equal(SENET.pos[P1][0], 12);
});

test('Senet: two pieces side by side guard each other', () => {
  SENET.init();
  SENET.pos = [[12, 31, 31, 31, 31], [14, 15, 31, 31, 31]];
  assert.equal(SENET.legal(P0, 2).length, 0);
});

test('Senet: three in a row cannot be passed', () => {
  SENET.init();
  SENET.pos = [[11, 31, 31, 31, 31], [12, 13, 14, 31, 31]];
  assert.equal(SENET.legal(P0, 5).length, 0);
});

test('Senet: every piece must stop on house 26', () => {
  SENET.init();
  SENET.pos = [[24, 31, 31, 31, 31], [1, 31, 31, 31, 31]];
  assert.equal(SENET.legal(P0, 3).length, 0, 'cannot jump past 26');
  assert.equal(SENET.legal(P0, 2)[0].to, 26);
});

test('Senet: the House of Water washes a piece back to 15', () => {
  SENET.init();
  SENET.pos = [[26, 31, 31, 31, 31], [1, 31, 31, 31, 31]];
  const m = SENET.legal(P0, 1)[0];
  assert.equal(m.water, true);
  SENET.apply(m);
  assert.equal(SENET.pos[P0][0], 15);
});

test('Senet: houses 28, 29 and 30 need an exact 3, 2 or 1', () => {
  for (const [sq, need] of [[28, 3], [29, 2], [30, 1]]) {
    SENET.init();
    SENET.pos = [[sq, 31, 31, 31, 31], [1, 31, 31, 31, 31]];
    for (let r = 1; r <= 5; r++) assert.equal(SENET.legal(P0, r).length, r === need ? 1 : 0, `house ${sq}, throw ${r}`);
  }
});

/* ------------------------------------------------------- full simulated games */

function simulate(G, games) {
  const wins = [0, 0];
  for (let n = 0; n < games; n++) {
    G.init();
    let pl = 0, turns = 0;
    for (;;) {
      assert.ok(++turns < 5000, `${G.id} game ${n} did not finish`);
      const r = G.roll(), moves = G.legal(pl, r.value);
      if (!moves.length) { pl = 1 - pl; continue; }
      const m = G.ai(moves);
      G.apply(m);
      if (G.id === 'senet') {
        const seen = new Set();
        for (const p of [0, 1]) for (const q of G.pos[p]) if (q <= 30) {
          assert.ok(!seen.has(q), `two pieces on house ${q}`); seen.add(q);
          assert.notEqual(q, 27, 'a piece was left in the House of Water');
        }
      } else {
        for (const p of [0, 1]) {
          const on = G.pos[p].filter(q => q > 0 && q < 15);
          assert.equal(new Set(on).size, on.length, 'two of one player\'s pieces share a square');
        }
        const a = G.pos[0].filter(q => q >= 5 && q <= 12);
        assert.ok(!G.pos[1].some(q => a.includes(q)), 'both players share a middle square');
      }
      if (G.done(pl)) { wins[pl]++; break; }
      if (!G.extra(m, r.value)) pl = 1 - pl;
    }
  }
  return wins;
}

test('Ur: 500 AI-vs-AI games finish with no illegal positions', () => {
  const w = simulate(UR, 500);
  assert.equal(w[0] + w[1], 500);
});

test('Senet: 500 AI-vs-AI games finish with no illegal positions', () => {
  const w = simulate(SENET, 500);
  assert.equal(w[0] + w[1], 500);
});
