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

/* ------------------------------------------------------- Nine Men's Morris */
const { morris: MORRIS, oware: OWARE, brandubh: BR } = rules;

test("Morris: the board has 24 points, 16 mills and 32 lines", () => {
  assert.equal(MORRIS.MILLS.length, 16);
  assert.equal(MORRIS.ADJ.reduce((a, n) => a + n.length, 0) / 2, 32);
});

test('Morris: placing comes first, then moving along lines', () => {
  MORRIS.init();
  assert.equal(MORRIS.legal(0).length, 24);
  assert.ok(MORRIS.legal(0).every(m => m.type === 'place'));
  MORRIS.hand = [0, 0];
  MORRIS.board[0] = 0;
  assert.deepEqual(MORRIS.legal(0).map(m => m.to).sort(), [1, 7]);
});

test('Morris: a mill asks for a removal and protects pieces in mills', () => {
  MORRIS.init();
  MORRIS.board[0] = 0; MORRIS.board[1] = 0; MORRIS.hand[0] = 7;
  MORRIS.board[16] = 1; MORRIS.board[17] = 1; MORRIS.board[18] = 1; MORRIS.board[9] = 1; MORRIS.hand[1] = 5;
  const r = MORRIS.apply({ type: 'place', pl: 0, to: 2 });
  assert.ok(r.followUp, 'mill gives a follow-up');
  assert.deepEqual(r.followUp.map(f => f.at), [9], 'pieces in the 16-17-18 mill are protected');
});

test('Morris: three pieces may fly; two pieces lose', () => {
  MORRIS.init(); MORRIS.hand = [0, 0];
  MORRIS.board[0] = 0; MORRIS.board[12] = 0; MORRIS.board[20] = 0;
  for (const p of [3, 5, 7, 9]) MORRIS.board[p] = 1;
  assert.ok(MORRIS.legal(0).every(m => m.fly));
  MORRIS.board[20] = -1;
  assert.equal(MORRIS.result(0).winner, 1);
});

/* ------------------------------------------------------------------- Oware */

test('Oware: sowing skips the emptied pit and captures 2s and 3s backwards', () => {
  OWARE.init();
  OWARE.pits = [0, 0, 0, 0, 0, 3, 1, 2, 1, 4, 4, 4];
  const r = OWARE.apply({ pl: 0, pit: 5 });
  assert.deepEqual(r.path, [6, 7, 8]);
  assert.deepEqual(r.caps, [8, 7, 6]);
  assert.equal(OWARE.store[0], 7);
  OWARE.init();
  OWARE.pits = Array(12).fill(0); OWARE.pits[0] = 12; OWARE.pits[6] = 1;
  const r2 = OWARE.apply({ pl: 0, pit: 0 });
  assert.ok(!r2.path.includes(0), 'origin pit skipped');
  assert.equal(OWARE.pits[0], 0);
});

test('Oware: a grand slam captures nothing', () => {
  OWARE.init();
  OWARE.pits = [0, 0, 0, 0, 0, 2, 1, 1, 0, 0, 0, 0];
  const r = OWARE.apply({ pl: 0, pit: 5 });
  assert.deepEqual(r.caps, []);
  assert.equal(OWARE.store[0], 0);
});

test('Oware: you must feed an empty opponent', () => {
  OWARE.init();
  OWARE.pits = [5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.deepEqual(OWARE.legal(0).map(m => m.pit), []);
  OWARE.pits = [6, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.deepEqual(OWARE.legal(0).map(m => m.pit), [0]);
});

/* ---------------------------------------------------------------- Brandubh */

test('Brandubh: setup, attackers first, rook moves', () => {
  BR.init();
  assert.equal(BR.count(1), 8);
  assert.equal(BR.count(0), 5);
  assert.equal(BR.first, 1);
  assert.ok(BR.legal(1).length > 0);
  assert.ok(!BR.legal(1).some(m => BR.restricted(m.to)), 'only the king stops on the throne or corners');
});

test('Brandubh: custodial capture, corners as anvils', () => {
  BR.init(); BR.b.fill(0); BR.b[24] = 3;
  BR.b[1] = 2; BR.b[3] = 1;
  const r = BR.apply({ pl: 1, from: 3, to: 2 });
  assert.deepEqual(r.caps, [1], 'the corner traps the defender');
});

test('Brandubh: the king needs four on the throne, two in the open', () => {
  BR.init(); BR.b.fill(0); BR.b[24] = 3;
  BR.b[17] = 1; BR.b[23] = 1; BR.b[25] = 1; BR.b[38] = 1;
  BR.apply({ pl: 1, from: 38, to: 31 });
  assert.equal(BR.win.winner, 1);
  BR.init(); BR.b.fill(0); BR.b[10] = 3; BR.b[9] = 1; BR.b[13] = 1;
  BR.apply({ pl: 1, from: 13, to: 11 });
  assert.equal(BR.win && BR.win.winner, 1);
});

test('Brandubh: the king wins on a corner', () => {
  BR.init(); BR.b.fill(0); BR.b[3] = 3; BR.b[45] = 1;
  const m = BR.legal(0).find(x => x.to === 0);
  assert.ok(m);
  BR.apply(m);
  assert.equal(BR.win.winner, 0);
});

/* ------------------------------------------------- strategy games end cleanly */

function playOut(G, maxTurns = 400) {
  G.init();
  let pl = G.first, turns = 0, slowest = 0;
  for (;;) {
    const r = G.result(pl);
    if (r) return { r, turns, slowest };
    assert.ok(++turns < maxTurns, `${G.id} ran past ${maxTurns} turns`);
    const t0 = Date.now();
    const plan = G.aiPlan(pl);
    slowest = Math.max(slowest, Date.now() - t0);
    assert.ok(plan && plan.length, `${G.id}: AI found no plan`);
    for (const m of plan) G.apply(m);
    pl = 1 - pl;
  }
}

for (const G of [MORRIS, OWARE, BR]) {
  test(`${G.name}: AI-vs-AI games finish and the AI answers quickly`, () => {
    for (let n = 0; n < 4; n++) {
      const { r, slowest } = playOut(G);
      assert.ok([0, 1, -1].includes(r.winner));
      assert.ok(slowest < 2500, `${G.id} AI took ${slowest} ms`);
    }
  });
}

/* -------------------------------------------------------- Tables (backgammon) */
const { tables: TB, shatranj: SHJ } = rules;

test('Tables: standard start, 15 checkers each, pip count 167', () => {
  TB.init();
  for (const pl of [0, 1]) { assert.equal(TB.c[pl].reduce((a, b) => a + b, 0), 15); assert.equal(TB.pip(pl), 167); }
});

test('Tables: a full turn uses both dice when it can', () => {
  TB.init();
  const first = TB.legal(0, 4, { faces: [3, 1], value: 4 });
  assert.ok(first.length > 0);
  assert.ok(TB.turn.seqs.every(s => s.length === 2));
});

test('Tables: doubles give four moves', () => {
  TB.init();
  TB.legal(0, 12, { faces: [6, 6], value: 12 });
  assert.ok(TB.turn.seqs.every(s => s.length === 4));
});

test('Tables: a checker on the bar must enter first, and blocked points refuse it', () => {
  TB.init(); TB.c[0][24]--; TB.c[0][25] = 1;
  const ms = TB.legal(0, 7, { faces: [6, 1], value: 7 });
  assert.ok(ms.every(m => m.from === 25));
  // The Scribe holds its own 6-point, which is the visitor's 19-point: entering with a 6 is blocked.
  assert.ok(!ms.some(m => m.die === 6));
});

test('Tables: hitting a blot sends it to the bar', () => {
  TB.init();
  TB.c[1].fill(0); TB.c[1][20] = 1; TB.c[1][1] = 14; // a Scribe blot on the visitor's 5-point
  const m = TB.legal(0, 2, { faces: [1, 1], value: 2 }).find(x => x.from === 6 && x.to === 5);
  assert.ok(m && m.hit);
  TB.apply(m);
  assert.equal(TB.c[1][25], 1);
});

test('Tables: bearing off with a higher die only from the highest point', () => {
  TB.init(); TB.c[0].fill(0); TB.c[0][3] = 2; TB.c[0][1] = 13; TB.c[1].fill(0); TB.c[1][1] = 15;
  const ms = TB.legal(0, 11, { faces: [6, 5], value: 11 });
  assert.ok(ms.every(m => m.from === 3 && m.to === 0));
});

test('Tables: the follow-up offers the second die after the first move', () => {
  TB.init();
  const ms = TB.legal(0, 9, { faces: [5, 4], value: 9 });
  const r = TB.apply(ms[0]);
  assert.ok(r.followUp && r.followUp.length);
  assert.ok(r.followUp.every(m => m.die !== ms[0].die));
});

test('Tables: 200 AI-vs-AI games finish', () => {
  for (let n = 0; n < 200; n++) {
    TB.init(); let pl = 0, turns = 0;
    while (!TB.done(0) && !TB.done(1)) {
      assert.ok(++turns < 1000, 'game did not finish');
      const r = TB.roll();
      if (TB.legal(pl, r.value, r).length) for (const m of TB.aiPlan(pl)) TB.apply(m);
      for (const p of [0, 1]) assert.equal(TB.c[p].reduce((a, b) => a + b, 0), 15);
      pl = 1 - pl;
    }
  }
});

/* ---------------------------------------------------------------- Shatranj */

test('Shatranj: opening position and moves', () => {
  SHJ.init();
  assert.equal(SHJ.legal(0).length, 8 + 4 + 4, '8 pawn steps, 4 knight moves, 4 alfil leaps');
});

test('Shatranj: the alfil leaps two diagonally over pieces; the firzan steps one', () => {
  SHJ.init(); SHJ.b.fill(0);
  SHJ.b[0] = SHJ.SH.K; SHJ.b[63] = SHJ.SH.K + 8;
  SHJ.b[27] = SHJ.SH.E; SHJ.b[36] = SHJ.SH.P + 8;
  const e = SHJ.legal(0).filter(m => m.from === 27).map(m => m.to).sort((a, b) => a - b);
  assert.deepEqual(e, [9, 13, 41, 45]);
  SHJ.b[27] = SHJ.SH.F;
  const f = SHJ.legal(0).filter(m => m.from === 27).map(m => m.to).sort((a, b) => a - b);
  assert.deepEqual(f, [18, 20, 34, 36]);
});

test('Shatranj: pawns step once and promote to firzan', () => {
  SHJ.init(); SHJ.b.fill(0);
  SHJ.b[0] = SHJ.SH.K; SHJ.b[7] = SHJ.SH.K + 8; SHJ.b[52] = SHJ.SH.P;
  const m = SHJ.legal(0).find(x => x.from === 52);
  assert.equal(m.to, 60); assert.ok(m.promo);
  SHJ.apply(m);
  assert.equal(SHJ.b[60], SHJ.SH.F);
});

test('Shatranj: stalemating the opponent wins', () => {
  SHJ.init(); SHJ.b.fill(0);
  SHJ.b[56] = SHJ.SH.K + 8;           // Scribe king a8
  SHJ.b[42] = SHJ.SH.K;               // visitor king c6
  SHJ.b[49] = SHJ.SH.R; SHJ.b[48] = 0; // rook b7 is defended by the king, so the Scribe king has no move
  SHJ.b[40] = SHJ.SH.P + 8;           // a blocked Scribe pawn on a6 keeps material on the board
  SHJ.b[32] = SHJ.SH.P;
  const r = SHJ.result(1);
  assert.equal(r.winner, 0);
});

test('Shatranj: a bare king loses unless it can strip the other next move', () => {
  SHJ.init(); SHJ.b.fill(0);
  SHJ.b[0] = SHJ.SH.K; SHJ.b[63] = SHJ.SH.K + 8; SHJ.b[30] = SHJ.SH.R + 8; SHJ.b[29] = SHJ.SH.P + 8;
  assert.equal(SHJ.result(0).winner, 1);
  SHJ.b[29] = 0; SHJ.b[30] = 0; SHJ.b[9] = SHJ.SH.K; SHJ.b[0] = 0; SHJ.b[18] = SHJ.SH.R + 8; // lone rook next to the visitor's king
  assert.equal(SHJ.result(0), null, 'the visitor can take the last piece');
});

test('Shatranj: AI-vs-AI games finish and the AI answers quickly', () => {
  for (let n = 0; n < 3; n++) {
    SHJ.init(); let pl = 0, turns = 0, slowest = 0, r;
    while (!(r = SHJ.result(pl))) {
      assert.ok(++turns < 600, 'game did not finish');
      const t0 = Date.now(); const plan = SHJ.aiPlan(pl, 2); slowest = Math.max(slowest, Date.now() - t0);
      plan.forEach(m => SHJ.apply(m)); pl = 1 - pl;
    }
    assert.ok([0, 1, -1].includes(r.winner));
    assert.ok(slowest < 2500, `took ${slowest} ms`);
  }
});

/* ----------------------------------------------------------- Scribe levels */

test('Levels: unknown names are ignored, known ones stick', () => {
  assert.equal(rules.setLevel('sharp'), 'sharp');
  assert.equal(rules.setLevel('nonsense'), 'sharp');
  assert.equal(rules.setLevel('fair'), 'fair');
});

for (const level of ['gentle', 'fair', 'sharp']) {
  test(`Levels: at ${level}, the Scribe stays within its thinking budget and leaves the board untouched`, () => {
    rules.setLevel(level);
    const limit = { gentle: 400, fair: 1100, sharp: 2200 }[level];
    for (const G of [MORRIS, OWARE, BR, SHJ]) {
      G.init();
      let pl = G.first;
      for (let k = 0; k < 6 && !G.result(pl); k++) {
        const before = JSON.stringify(G.snapshot());
        const t0 = Date.now();
        const plan = G.aiPlan(pl);
        const took = Date.now() - t0;
        assert.equal(JSON.stringify(G.snapshot()), before, `${G.id} changed the board while thinking`);
        assert.ok(took < limit, `${G.id} at ${level} took ${took} ms`);
        plan.forEach(m => G.apply(m)); pl = 1 - pl;
      }
    }
    rules.setLevel('fair');
  });
}
