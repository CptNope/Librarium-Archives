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

/* ---------------------------------------------------------- Fox and Geese */
const { foxgeese: FG, draughts: DRA, goose: GO } = rules;

test('Fox and Geese: 33 points, 13 geese, the fox in the centre, geese first', () => {
  FG.init();
  assert.equal(FG.geese(), 13);
  assert.equal(FG.fox(), 24);
  assert.equal(FG.first, 1);
  let points = 0; for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if ((r >= 2 && r <= 4) || (c >= 2 && c <= 4)) points++;
  assert.equal(points, 33);
});

test('Fox and Geese: geese never move back toward their side', () => {
  FG.init();
  assert.ok(FG.legal(1).every(m => ((m.to / 7) | 0) >= ((m.from / 7) | 0)));
});

test('Fox and Geese: the fox jumps geese and may chain jumps', () => {
  FG.init(); FG.b.fill(0);
  FG.b[24] = 1; FG.b[31] = 2; FG.b[45] = 2; // geese at (4,3) and (6,3)
  const jumps = FG.legal(0).filter(m => m.caps.length);
  assert.deepEqual(jumps.map(m => m.to), [38]);
  FG.b.fill(0); FG.b[17] = 1; FG.b[24] = 2; FG.b[38] = 2; FG.b[31] = 0; FG.b[2] = 2;
  const chain = FG.legal(0).find(m => m.caps.length === 2);
  assert.ok(chain, 'a double jump is offered');
  FG.apply(chain);
  assert.equal(FG.geese(), 1);
});

test('Fox and Geese: penning the fox wins for the geese; a thin flock loses', () => {
  FG.init(); FG.b.fill(0);
  FG.b[2] = 1; FG.b[3] = 2; FG.b[4] = 2; FG.b[9] = 2; FG.b[16] = 2; FG.b[10] = 2; FG.b[11] = 2; FG.b[17] = 2;
  assert.equal(FG.result(0).winner, 1, 'fox in the top corner with no move or jump');
  FG.init(); FG.b.fill(0); FG.b[24] = 1; [2, 3, 4, 9, 10, 11].forEach(i => { FG.b[i] = 2; });
  assert.equal(FG.result(1).winner, 0);
});

test('Fox and Geese: the geese lose if they stop advancing', () => {
  FG.init(); FG.stall = FG.STALL;
  assert.equal(FG.result(1).winner, 0);
});

/* ---------------------------------------------------------------- Draughts */

test('Draughts: 12 pieces each on dark squares; seven opening moves', () => {
  DRA.init();
  assert.equal(DRA.count(0), 12); assert.equal(DRA.count(1), 12);
  assert.ok(DRA.b.every((v, i) => !v || (((i >> 3) + (i & 7)) % 2 === 1)));
  assert.equal(DRA.legal(0).length, 7);
});

test('Draughts: capture is compulsory and chains continue', () => {
  DRA.init(); DRA.b.fill(0);
  DRA.b[2 * 8 + 1] = 1;            // man at (2,1)
  DRA.b[3 * 8 + 2] = 3;            // enemy at (3,2)
  DRA.b[5 * 8 + 4] = 3;            // enemy at (5,4)
  DRA.b[0 * 8 + 7] = 1;            // another man with a quiet move available
  const ms = DRA.legal(0);
  assert.ok(ms.every(m => m.caps.length), 'only captures are legal');
  assert.equal(ms[0].caps.length, 2, 'the double jump is taken in one move');
  assert.equal(ms[0].to, 6 * 8 + 5);
});

test('Draughts: men crown on the far row and the capture stops there', () => {
  DRA.init(); DRA.b.fill(0);
  DRA.b[5 * 8 + 0] = 1; DRA.b[6 * 8 + 1] = 3; DRA.b[6 * 8 + 3] = 3; DRA.b[0] = 0; DRA.b[1 * 8 + 0] = 3;
  const m = DRA.legal(0).find(x => x.caps.length);
  assert.ok(m.crown); assert.equal(m.caps.length, 1, 'a man crowned mid-capture stops');
  DRA.apply(m);
  assert.equal(DRA.b[7 * 8 + 2], 2);
});

test('Draughts: kings move backwards; men do not', () => {
  DRA.init(); DRA.b.fill(0);
  DRA.b[3 * 8 + 4] = 1; DRA.b[7 * 8 + 0] = 3;
  assert.ok(DRA.legal(0).every(m => (m.to >> 3) > 3));
  DRA.b[3 * 8 + 4] = 2;
  assert.ok(DRA.legal(0).some(m => (m.to >> 3) < 3));
});

/* ------------------------------------------------------- Game of the Goose */

test('Goose: a 9 from the start goes to 26 or 53, never straight home', () => {
  GO.init();
  assert.equal(GO.legal(0, 9, { faces: [6, 3], value: 9 })[0].to, 26);
  assert.equal(GO.legal(0, 9, { faces: [4, 5], value: 9 })[0].to, 53);
  GO.fresh = [false, false]; // back at the start after Death: the rule still applies
  assert.equal(GO.legal(0, 9, { faces: [3, 6], value: 9 })[0].to, 26);
});

test('Goose: geese fly on by the same throw', () => {
  GO.init(); GO.pos[0][0] = 1;
  assert.equal(GO.legal(0, 4, { faces: [2, 2], value: 4 })[0].to, 13, '1 + 4 = 5 (goose), 9 (goose), 13');
});

test('Goose: the Bridge, the Maze and Death', () => {
  GO.init(); GO.pos[0][0] = 3;
  assert.equal(GO.legal(0, 3, { faces: [1, 2], value: 3 })[0].to, 12);
  GO.pos[0][0] = 38;
  assert.equal(GO.legal(0, 4, { faces: [1, 3], value: 4 })[0].to, 39);
  GO.pos[0][0] = 55;
  assert.equal(GO.legal(0, 3, { faces: [1, 2], value: 3 })[0].to, 0);
});

test('Goose: exact landing on 63, and a bounce back', () => {
  GO.init(); GO.pos[0][0] = 57;
  assert.equal(GO.legal(0, 6, { faces: [3, 3], value: 6 })[0].to, 63);
  GO.pos[0][0] = 60; // 61, 62, 63, back to 59: a goose while bouncing, so back 7 more, to the Prison
  const m = GO.legal(0, 7, { faces: [3, 4], value: 7 })[0];
  assert.equal(m.to, 52); assert.equal(m.skip, 3);
});

test('Goose: the Inn costs a turn, and landing on the other player swaps', () => {
  GO.init(); GO.fresh = [false, false];
  GO.pos[0][0] = 16; GO.pos[1][0] = 30;
  const inn = GO.legal(0, 3, { faces: [1, 2], value: 3 })[0];
  GO.apply(inn);
  assert.equal(GO.pos[0][0], 19); assert.ok(GO.skipTurn(0)); assert.equal(GO.skipTurn(0), '');
  GO.pos[0][0] = 26;
  const sw = GO.legal(0, 4, { faces: [1, 3], value: 4 })[0];
  assert.ok(sw.swap);
  GO.apply(sw);
  assert.deepEqual([GO.pos[0][0], GO.pos[1][0]], [30, 26]);
});

test('Goose: 500 two-player games finish', () => {
  for (let n = 0; n < 500; n++) {
    GO.init(); let pl = 0, t = 0;
    while (!GO.done(0) && !GO.done(1)) {
      assert.ok(++t < 3000, 'game did not finish');
      if (GO.skipTurn(pl)) { pl = 1 - pl; continue; }
      const r = GO.roll(); GO.apply(GO.legal(pl, r.value, r)[0]);
      for (const p of [0, 1]) assert.ok(GO.pos[p][0] >= 0 && GO.pos[p][0] <= 63);
      if (!GO.done(pl)) pl = 1 - pl;
    }
  }
});

/* ----------------------------------------------------------------- Reversi */
const { reversi: RV, dotsboxes: DB } = rules;

test('Reversi: four centre discs, four opening moves, each flipping one', () => {
  RV.init();
  assert.equal(RV.count(0), 2); assert.equal(RV.count(1), 2);
  const ms = RV.legal(0);
  assert.equal(ms.length, 4);
  assert.ok(ms.every(m => m.flips.length === 1));
});

test('Reversi: flips run in every direction that is closed off', () => {
  RV.init(); RV.b.fill(0);
  RV.b[0] = 1; RV.b[1] = 2; RV.b[2] = 2; // along row 0: dark, light, light, then the empty square 3
  RV.b[3 * 8 + 3] = 1; RV.b[2 * 8 + 3] = 2; // and up column 3: light at row 2, dark at row 3
  const m = RV.legal(0).find(x => x.at === 3);
  assert.deepEqual(m.flips.sort((a, b) => a - b), [1, 2]);
  const both = RV.legal(0).find(x => x.at === 1 * 8 + 3);
  assert.deepEqual(both.flips, [2 * 8 + 3], 'the column flip is found too');
  RV.apply(m);
  assert.equal(RV.count(1), 1);
});

test('Reversi: a player with no move passes; the game ends when neither can move', () => {
  RV.init(); RV.b.fill(0); RV.b[0] = 1; RV.b[1] = 2;
  assert.ok(RV.skipTurn(1), 'light has no flipping move but dark does');
  RV.b.fill(1); RV.b[63] = 2;
  const r = RV.result(0);
  assert.equal(r.winner, 0);
});

test('Reversi: AI-vs-AI games finish within the thinking budget', () => {
  rules.setLevel('fair');
  RV.init(); let pl = 0, n = 0, r, slowest = 0;
  while (!(r = RV.result(pl))) {
    if (RV.skipTurn(pl)) { pl = 1 - pl; continue; }
    const t0 = Date.now(); RV.aiPlan(pl).forEach(m => RV.apply(m)); slowest = Math.max(slowest, Date.now() - t0);
    pl = 1 - pl; assert.ok(++n < 100);
  }
  assert.equal(RV.count(0) + RV.count(1) <= 64, true);
  assert.ok(slowest < 1100, `took ${slowest} ms`);
});

/* ---------------------------------------------------------- Dots and Boxes */

test('Dots and Boxes: 40 lines and 16 boxes; each inner line borders two boxes', () => {
  DB.init();
  assert.equal(DB.legal(0).length, 40);
  assert.equal(DB.EDGE_BOXES.filter(b => b.length === 2).length, 24);
  assert.equal(DB.EDGE_BOXES.filter(b => b.length === 1).length, 16);
});

test('Dots and Boxes: closing a box scores it and gives another turn', () => {
  DB.init();
  const [t, b, l, r] = DB.BOX_EDGES[0];
  [t, b, l].forEach(e => DB.apply({ pl: 1, e }));
  const res = DB.apply({ pl: 0, e: r });
  assert.deepEqual(res.boxes, [0]);
  assert.equal(DB.score[0], 1);
  assert.ok(res.followUp && res.followUp.length, 'the same player draws again');
});

test('Dots and Boxes: one line can close two boxes', () => {
  DB.init();
  const shared = DB.BOX_EDGES[0][3]; // right side of box 0 = left side of box 1
  for (const box of [0, 1]) for (const e of DB.BOX_EDGES[box]) if (e !== shared) DB.drawn[e] = true;
  const res = DB.apply({ pl: 0, e: shared });
  assert.equal(res.boxes.length, 2);
});

test('Dots and Boxes: the endgame solver finds the right move in a two-chain ending', () => {
  // Every box except two corner dominoes already belongs to someone; whoever must open a domino loses it.
  DB.init();
  DB.drawn.fill(true);
  // Reopen the lines inside and around two separate 2-box chains: boxes 0,1 and 14,15.
  for (const box of [0, 1, 14, 15]) DB.owner[box] = -1;
  const open = new Set([DB.BOX_EDGES[0][3], DB.BOX_EDGES[0][2], DB.BOX_EDGES[1][3], DB.BOX_EDGES[14][3], DB.BOX_EDGES[14][2], DB.BOX_EDGES[15][3]]);
  open.forEach(e => { DB.drawn[e] = false; });
  const e = DB.solve(2000);
  assert.ok(open.has(e));
});

for (const level of ['gentle', 'fair', 'sharp']) {
  test(`Dots and Boxes: at ${level}, a whole game finishes and every turn stays in budget`, () => {
    rules.setLevel(level);
    DB.init(); let pl = 0, slowest = 0;
    while (!DB.result(pl)) {
      const t0 = Date.now(); const plan = DB.aiPlan(pl); slowest = Math.max(slowest, Date.now() - t0);
      assert.ok(plan.length > 0);
      plan.forEach(m => DB.apply(m)); pl = 1 - pl;
    }
    assert.equal(DB.score[0] + DB.score[1], 16);
    assert.ok(slowest < { gentle: 400, fair: 1100, sharp: 2200 }[level], `took ${slowest} ms`);
    rules.setLevel('fair');
  });
}

/* -------------------------------------------------------------------- Halma */
const { halma: HM } = rules;
const hm = (r, c) => r * 16 + c;

test('Halma: each camp holds 19 men in its corner', () => {
  HM.init();
  assert.equal(HM.men(0).length, 19);
  assert.equal(HM.men(1).length, 19);
  assert.equal(HM.b[hm(0, 0)], 1);
  assert.equal(HM.b[hm(15, 15)], 2);
  assert.equal(HM.b[hm(4, 2)], 0); // the camp's rows run 5, 5, 4, 3, 2
});

test('Halma: a man steps to any empty neighbour, or leaps in a chain', () => {
  HM.init(); HM.b.fill(0);
  HM.b[hm(7, 7)] = 1;
  assert.equal(HM.legal(0).length, 8);
  HM.b[hm(8, 8)] = 2; HM.b[hm(10, 10)] = 1;
  const far = HM.reach(hm(7, 7)).find(m => m.to === hm(11, 11));
  assert.ok(far, 'two leaps in a row reach 11,11');
  assert.deepEqual(far.path, [hm(9, 9), hm(11, 11)]);
  assert.ok(!HM.reach(hm(7, 7)).some(m => m.to === hm(7, 7)), 'a chain never ends where it began');
});

test('Halma: a man in the far camp may not leave it', () => {
  HM.init(); HM.b.fill(0);
  HM.b[hm(15, 11)] = 1; // on the camp's edge (row 15 holds columns 11-15)
  const outs = HM.legal(0).filter(m => !HM.GOAL[0][m.to]);
  assert.equal(outs.length, 0);
});

test('Halma: filling the far camp wins, and so does a full camp with one of your men in it', () => {
  HM.init(); HM.b.fill(0);
  HM.CAMP[1].forEach(i => { HM.b[i] = 1; });
  assert.equal(HM.result(1).winner, 0);
  HM.init(); HM.b.fill(0);
  HM.CAMP[1].forEach((i, k) => { HM.b[i] = k === 0 ? 1 : 2; });
  HM.b[hm(8, 8)] = 1;
  assert.equal(HM.result(0).winner, 0);
});

test('Halma: the museum rule ends a long game on men home', () => {
  HM.init();
  HM.ply = 400;
  const r = HM.result(0);
  assert.ok(r);
  assert.equal(r.winner, -1);
});

test('Halma: the Scribe takes a long leap when one is open', () => {
  rules.setLevel('fair');
  HM.init(); HM.b.fill(0);
  HM.CAMP[0].forEach(i => { HM.b[i] = 1; });
  HM.b[hm(9, 9)] = 2; HM.b[hm(8, 8)] = 1; HM.b[hm(6, 6)] = 1; HM.b[hm(4, 4)] = 1;
  HM.b[hm(15, 15)] = 2;
  const [m] = HM.aiPlan(1, 1);
  assert.equal(m.from, hm(9, 9));
  assert.ok(m.path.length >= 3, 'leaps down the chain');
});

for (const level of ['gentle', 'fair', 'sharp']) {
  test(`Halma: at ${level}, the Scribe moves within budget`, () => {
    rules.setLevel(level);
    HM.init(); let pl = 0, slowest = 0;
    for (let k = 0; k < 24; k++) {
      const t0 = Date.now(); const plan = HM.aiPlan(pl); slowest = Math.max(slowest, Date.now() - t0);
      plan.forEach(m => HM.apply(m)); pl = 1 - pl;
    }
    assert.ok(slowest < { gentle: 400, fair: 1100, sharp: 2200 }[level], `took ${slowest} ms`);
    rules.setLevel('fair');
  });
}

/* ----------------------------------------------------------------------- Go */
const { go: WEIQI } = rules;
const gp = (r, c) => r * 9 + c;
const goSet = (stones) => { WEIQI.init(); for (const [r, c, v] of stones) WEIQI.b[gp(r, c)] = v; };

test('Go: surrounding a stone captures it', () => {
  goSet([[4, 4, 2], [3, 4, 1], [5, 4, 1], [4, 3, 1]]);
  const res = WEIQI.apply({ pl: 0, p: gp(4, 5) });
  assert.deepEqual(res.caps, [gp(4, 4)]);
  assert.equal(WEIQI.b[gp(4, 4)], 0);
  assert.equal(WEIQI.caps[0], 1);
});

test('Go: suicide is illegal, but a move that captures is not', () => {
  goSet([[0, 1, 2], [1, 0, 2]]);
  assert.ok(!WEIQI.legal(0).some(m => m.p === gp(0, 0)), 'the corner is suicide for black');
  goSet([[0, 1, 2], [1, 0, 2], [0, 2, 1], [1, 1, 1], [2, 0, 1]]);
  assert.ok(WEIQI.legal(0).some(m => m.p === gp(0, 0)), 'filling the corner captures two white stones');
});

test('Go: ko forbids retaking straight away', () => {
  // Black to capture at (4,5) inside a ko shape; white may not retake at (4,4) at once.
  goSet([[4, 3, 1], [3, 4, 1], [5, 4, 1], [4, 4, 2], [3, 5, 2], [5, 5, 2], [4, 6, 2]]);
  const res = WEIQI.apply({ pl: 0, p: gp(4, 5) });
  assert.deepEqual(res.caps, [gp(4, 4)]);
  assert.ok(!WEIQI.legal(1).some(m => m.p === gp(4, 4)), 'white may not retake the ko');
  WEIQI.apply({ pl: 1, p: gp(0, 0) }); WEIQI.apply({ pl: 0, p: gp(8, 8) });
  assert.ok(WEIQI.legal(1).some(m => m.p === gp(4, 4)), 'after a move elsewhere it may');
});

test('Go: two passes end the game and the board is counted with komi', () => {
  WEIQI.init();
  for (let r = 0; r < 9; r++) WEIQI.b[gp(r, 4)] = 1; // black owns a wall: 5 columns to the left with it, 4 to the right
  for (let r = 0; r < 9; r++) WEIQI.b[gp(r, 5)] = 2;
  WEIQI.apply({ pl: 0, pass: true });
  assert.equal(WEIQI.result(), null);
  WEIQI.apply({ pl: 1, pass: true });
  const r = WEIQI.result();
  assert.ok(r);
  assert.match(r.text, /You 45, the Scribe 36 \+ 7 komi = 43/);
  assert.equal(r.winner, 0);
});

test('Go: the Scribe captures a stone left in atari', () => {
  rules.setLevel('fair');
  goSet([[4, 4, 1], [3, 4, 2], [5, 4, 2], [4, 3, 2], [0, 0, 1], [8, 8, 2]]);
  WEIQI.ply = 6;
  const [m] = WEIQI.aiPlan(1, 600);
  assert.equal(m.p, gp(4, 5));
});

for (const level of ['gentle', 'fair', 'sharp']) {
  test(`Go: at ${level}, the Scribe moves within budget`, () => {
    rules.setLevel(level);
    WEIQI.init(); WEIQI.apply({ pl: 0, p: gp(4, 4) });
    const t0 = Date.now(); const plan = WEIQI.aiPlan(1); const dt = Date.now() - t0;
    assert.equal(plan.length, 1);
    assert.ok(plan[0].pass || WEIQI.legal(1).some(m => m.p === plan[0].p));
    assert.ok(dt < { gentle: 400, fair: 1100, sharp: 2200 }[level], `took ${dt} ms`);
    rules.setLevel('fair');
  });
}

/* ---------------------------------------------------------------- Alquerque */
const { alquerque: AQ, snakes: SL, xiangqi: XQG } = rules;

test('Alquerque: twelve pieces a side and the centre empty', () => {
  AQ.init();
  assert.equal(AQ.count(0), 12); assert.equal(AQ.count(1), 12);
  assert.equal(AQ.b[12], 0);
});

test('Alquerque: pieces never step backwards, and diagonals only run through even points', () => {
  AQ.init(); AQ.b.fill(0);
  AQ.b[12] = 1; // centre: an even point with diagonals
  const to = AQ.legal(0).map(m => m.to).sort((a, b) => a - b);
  assert.deepEqual(to, [11, 13, 16, 17, 18]);
  AQ.b.fill(0); AQ.b[7] = 1; // (1,2): odd, no diagonals
  assert.deepEqual(AQ.legal(0).map(m => m.to).sort((a, b) => a - b), [6, 8, 12]);
});

test('Alquerque: capture is compulsory and chains', () => {
  AQ.init(); AQ.b.fill(0);
  AQ.b[0] = 1; AQ.b[6] = 2; AQ.b[18] = 2; AQ.b[20] = 1; // a free move is open to the piece on 20
  const ms = AQ.legal(0);
  assert.ok(ms.every(m => m.caps.length), 'only captures are offered');
  const chain = ms.find(m => m.caps.length === 2);
  assert.ok(chain); assert.deepEqual(chain.path, [12, 24]);
});

/* ------------------------------------------------------- Snakes and Ladders */
test('Snakes and Ladders: ladders climb, snakes slide, and 100 needs an exact throw', () => {
  SL.init();
  SL.pos[0][0] = 9;
  let [m] = SL.legal(0, 3, { faces: [3], value: 3 });
  assert.equal(m.to, 31);
  SL.pos[0][0] = 95;
  [m] = SL.legal(0, 4, { faces: [4], value: 4 });
  assert.equal(m.to, 61); // the snake of Lust at 99
  [m] = SL.legal(0, 6, { faces: [6], value: 6 });
  assert.equal(m.to, 95);
  SL.pos[0][0] = 97;
  [m] = SL.legal(0, 3, { faces: [3], value: 3 });
  SL.apply(m); assert.ok(SL.done(0));
});

/* ------------------------------------------------------------------ Xiangqi */
const xq = (r, c) => r * 9 + c;
test('Xiangqi: red has 44 opening moves', () => {
  XQG.init();
  assert.equal(XQG.legal(0).length, 44);
});

test('Xiangqi: the generals may not face each other on an open file', () => {
  XQG.init(); XQG.b.fill(0);
  XQG.b[xq(0, 4)] = XQG.T.K; XQG.b[xq(9, 3)] = XQG.T.K + 8;
  assert.ok(!XQG.legal(0).some(m => m.from === xq(0, 4) && m.to === xq(0, 3)), 'the red general may not step onto the black general\'s file');
});

test('Xiangqi: a cannon captures only over a screen, and a horse can be hobbled', () => {
  XQG.init(); XQG.b.fill(0);
  XQG.b[xq(0, 4)] = XQG.T.K; XQG.b[xq(9, 3)] = XQG.T.K + 8;
  XQG.b[xq(4, 0)] = XQG.T.C; XQG.b[xq(4, 8)] = XQG.T.P + 8;
  assert.ok(!XQG.legal(0).some(m => m.from === xq(4, 0) && m.to === xq(4, 8)), 'no screen, no capture');
  XQG.b[xq(4, 4)] = XQG.T.P;
  assert.ok(XQG.legal(0).some(m => m.from === xq(4, 0) && m.to === xq(4, 8)), 'over a screen it captures');
  XQG.b.fill(0); XQG.b[xq(0, 4)] = XQG.T.K; XQG.b[xq(9, 3)] = XQG.T.K + 8;
  XQG.b[xq(2, 2)] = XQG.T.H;
  const free = XQG.legal(0).filter(m => m.from === xq(2, 2)).length;
  XQG.b[xq(3, 2)] = XQG.T.P;
  const hobbled = XQG.legal(0).filter(m => m.from === xq(2, 2)).length;
  assert.equal(free, 8); assert.equal(hobbled, 6);
});

test('Xiangqi: elephants stay home and a general with no move loses', () => {
  XQG.init(); XQG.b.fill(0);
  XQG.b[xq(0, 4)] = XQG.T.K; XQG.b[xq(9, 3)] = XQG.T.K + 8;
  XQG.b[xq(4, 2)] = XQG.T.E;
  assert.ok(XQG.legal(0).filter(m => m.from === xq(4, 2)).every(m => m.to < 45));
  // Two black chariots pin the red general in the corner of his palace.
  XQG.b.fill(0); XQG.b[xq(0, 3)] = XQG.T.K; XQG.b[xq(9, 5)] = XQG.T.K + 8;
  XQG.b[xq(9, 3)] = XQG.T.R + 8; XQG.b[xq(5, 4)] = XQG.T.R + 8;
  const r = XQG.result(0);
  assert.ok(r); assert.equal(r.winner, 1);
});

for (const id of ['alquerque', 'xiangqi']) for (const level of ['gentle', 'fair', 'sharp']) {
  test(`${id}: at ${level}, the Scribe moves within budget`, () => {
    rules.setLevel(level);
    const G = rules[id]; G.init(); let pl = 0, slowest = 0;
    for (let k = 0; k < 8 && !G.result(pl); k++) { const t0 = Date.now(); const plan = G.aiPlan(pl); slowest = Math.max(slowest, Date.now() - t0); plan.forEach(m => G.apply(m)); pl = 1 - pl; }
    assert.ok(slowest < { gentle: 400, fair: 1100, sharp: 2200 }[level], `took ${slowest} ms`);
    rules.setLevel('fair');
  });
}

/* ----------------------------------------------------------------- Tarocchi */
const { tarocchi: TC } = rules;
const card = (suit, rank) => suit * 14 + rank - 1, trump = n => 55 + n;

test('Tarocchi: you must follow suit, else trump, and the Fool is always allowed', () => {
  TC.init(); TC.hands = [[card(0, 3), card(1, 9), trump(4), TC.FOOL], [card(0, 12)]]; TC.toMove = 1;
  TC.apply({ pl: 1, card: card(0, 12) });
  assert.deepEqual(TC.legal(0).map(m => m.card).sort((a, b) => a - b), [card(0, 3), TC.FOOL].sort((a, b) => a - b));
  TC.init(); TC.hands = [[card(1, 9), trump(4), trump(9)], [card(0, 12)]]; TC.toMove = 1;
  TC.apply({ pl: 1, card: card(0, 12) });
  assert.deepEqual(TC.legal(0).map(m => m.card), [trump(4), trump(9)]);
});

test('Tarocchi: trumps win, the led suit beats a discard, and the Fool never wins', () => {
  TC.init(); TC.hands = [[trump(1)], [card(2, 14)]]; TC.toMove = 1;
  TC.apply({ pl: 1, card: card(2, 14) }); let r = TC.apply({ pl: 0, card: trump(1) });
  assert.equal(r.winner, 0);
  TC.init(); TC.hands = [[card(3, 14)], [card(2, 2)]]; TC.toMove = 1;
  TC.apply({ pl: 1, card: card(2, 2) }); r = TC.apply({ pl: 0, card: card(3, 14) });
  assert.equal(r.winner, 1, 'a king of another suit is only a discard');
  TC.init(); TC.hands = [[TC.FOOL], [card(2, 2)]]; TC.toMove = 0;
  TC.apply({ pl: 0, card: TC.FOOL }); r = TC.apply({ pl: 1, card: card(2, 2) });
  assert.equal(r.winner, 1);
  assert.ok(TC.won[0].includes(TC.FOOL), 'the Fool goes back to its owner');
});

test('Tarocchi: the winner of a trick leads the next, and the count adds card points and tricks', () => {
  TC.init(); TC.hands = [[card(0, 14), card(1, 1)], [card(0, 2), card(1, 2)]]; TC.toMove = 0;
  TC.apply({ pl: 0, card: card(0, 14) });
  const r = TC.apply({ pl: 1, card: card(0, 2) });
  assert.equal(r.winner, 0); assert.equal(TC.toMove, 0); assert.ok(TC.legal(0).length);
  assert.equal(r.followUp, undefined, 'the leader won, so play passes back normally');
  assert.equal(TC.score(0), 5 + 1);
  assert.equal([...Array(78).keys()].reduce((n, c) => n + TC.points(c), 0), 71);
});

for (const level of ['gentle', 'fair', 'sharp']) {
  test(`Tarocchi: at ${level}, a whole hand finishes and every Scribe turn stays in budget`, () => {
    rules.setLevel(level);
    TC.init(); let slowest = 0;
    while (!TC.result()) { const pl = TC.toMove; const t0 = Date.now(); const plan = TC.aiPlan(pl); slowest = Math.max(slowest, Date.now() - t0); assert.ok(plan.length); plan.forEach(m => TC.apply(m)); }
    assert.equal(TC.tricks[0] + TC.tricks[1], 13);
    assert.ok(slowest < { gentle: 400, fair: 1100, sharp: 2200 }[level], `took ${slowest} ms`);
    rules.setLevel('fair');
  });
}

/* --------------------------------------------------------------- Mū tōrere */
const { mutorere: MT, konane: KN, fanorona: FN } = rules;
test('Mū tōrere: a man enters the centre only beside an enemy man', () => {
  MT.init();
  // At the start the centre is empty: only the two end men of each group touch the other side.
  assert.deepEqual(MT.legal(0).map(m => m.from).sort(), [4, 7]);
  MT.b = [2, 2, 2, 0, 1, 1, 1, 1, 2]; // centre held by the Scribe, arm 3 empty
  assert.deepEqual(MT.legal(0).map(m => m.from).sort(), [4]);
  assert.deepEqual(MT.legal(1).map(m => m.from).sort(), [2, 8]);
});
test('Mū tōrere: a side with no move loses', () => {
  MT.init();
  MT.b = [2, 2, 2, 1, 0, 1, 1, 2, 1]; // arm 4 is empty, and its neighbours and the centre are all the visitor's
  assert.equal(MT.legal(1).length, 0);
  assert.equal(MT.result(1).winner, 0);
});

/* ------------------------------------------------------------------ Kōnane */
test('Kōnane: the opening lifts a centre or corner stone, then one beside the gap', () => {
  KN.init();
  assert.deepEqual(KN.legal(0).map(m => m.remove).sort((a, b) => a - b), [0, 27, 36, 63]);
  KN.apply({ pl: 0, remove: 27 });
  assert.deepEqual(KN.legal(1).map(m => m.remove).sort((a, b) => a - b), [19, 26, 28, 35]);
});
test('Kōnane: jumps run in a straight line and may stop', () => {
  KN.init(); KN.b.fill(0); KN.ply = 2;
  KN.b[0] = 1; KN.b[1] = 2; KN.b[3] = 2; KN.b[8] = 2;
  const ms = KN.legal(0).filter(m => m.from === 0);
  assert.deepEqual(ms.map(m => m.to).sort((a, b) => a - b), [2, 4, 16]);
  assert.deepEqual(ms.find(m => m.to === 4).caps, [1, 3]);
});

/* ---------------------------------------------------------------- Fanorona */
test('Fanorona: approach and withdrawal capture whole lines, and capture is compulsory', () => {
  FN.init(); FN.b.fill(0);
  const at = (r, c) => r * 9 + c;
  FN.b[at(2, 2)] = 1; FN.b[at(2, 4)] = 2; FN.b[at(2, 5)] = 2; FN.b[at(2, 1)] = 2; FN.b[at(0, 8)] = 1;
  const ms = FN.legal(0);
  assert.ok(ms.every(m => m.caps.length), 'no quiet moves while a capture exists');
  const appr = ms.find(m => m.kind === 'approach' && m.to === at(2, 3));
  assert.deepEqual(appr.caps, [at(2, 4), at(2, 5)]);
  const wd = ms.find(m => m.kind === 'withdrawal' && m.to === at(2, 3));
  assert.deepEqual(wd.caps, [at(2, 1)]);
});
test('Fanorona: a capturing stone may go on, not back to a visited point nor the same way twice', () => {
  FN.init(); FN.b.fill(0);
  const at = (r, c) => r * 9 + c;
  FN.b[at(0, 0)] = 1; FN.b[at(0, 2)] = 2; FN.b[at(2, 1)] = 2; FN.b[at(4, 8)] = 2;
  const res = FN.apply(FN.legal(0).find(m => m.to === at(0, 1)));
  assert.ok(res.followUp, 'a second capture is on offer');
  assert.ok(res.followUp.some(m => m.pass), 'and so is stopping');
  assert.ok(res.followUp.every(m => m.pass || m.to !== at(0, 0)), 'never back to where it started');
});

/* -------------------------------------------------------------------- Chess */
const { chess: CHG } = rules;
function chessFen(fen) {
  const [rows, side, castle, ep] = fen.split(' ');
  const T = { k: 1, q: 2, b: 3, n: 4, r: 5, p: 6 };
  CHG.init(); CHG.b.fill(0);
  rows.split('/').forEach((row, k) => { let c = 0; for (const ch of row) { if (/\d/.test(ch)) c += +ch; else { CHG.b[(7 - k) * 8 + c] = T[ch.toLowerCase()] + (ch === ch.toLowerCase() ? 8 : 0); c++; } } });
  CHG.castle = [[castle.includes('Q'), castle.includes('K')], [castle.includes('q'), castle.includes('k')]];
  CHG.ep = ep === '-' ? -1 : (+ep[1] - 1) * 8 + ep.charCodeAt(0) - 97;
  return side === 'w' ? 0 : 1;
}
function perft(pl, d) { if (!d) return 1; let n = 0; for (const m of CHG.legal(pl)) { const s = CHG.snapshot(); CHG.raw(m); n += perft(1 - pl, d - 1); CHG.restore(s); } return n; }
test('Chess: move counts from the start match the known values', () => {
  CHG.init();
  assert.deepEqual([1, 2, 3].map(d => perft(0, d)), [20, 400, 8902]);
});
test('Chess: castling, en passant and promotion counted right in the Kiwipete position', () => {
  const pl = chessFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -');
  assert.deepEqual([1, 2].map(d => perft(pl, d)), [48, 2039]);
});
test('Chess: checkmate and stalemate', () => {
  let pl = chessFen('7k/6Q1/6K1/8/8/8/8/8 b - -'); // black is mated
  assert.equal(CHG.result(pl).winner, 0);
  pl = chessFen('7k/5Q2/6K1/8/8/8/8/8 b - -'); // black to move, no moves, not in check
  assert.equal(CHG.result(pl).winner, -1);
});

/* -------------------------------------------------------------------- Shogi */
const { shogi: SGG } = rules;
const sq = (r, c) => r * 9 + c, T = SGG.SG;
function sgPerft(pl, d) { if (!d) return 1; let n = 0; for (const m of SGG.legal(pl)) { const s = SGG.snapshot(); SGG.raw(m); n += sgPerft(1 - pl, d - 1); SGG.restore(s); } return n; }
test('Shogi: move counts match the standard ones, less the optional promotions we make automatic', () => {
  SGG.init();
  assert.deepEqual([1, 2, 3].map(d => sgPerft(0, d)), [30, 900, 25470 - 30]);
});
test('Shogi: captured pieces go to hand and can be dropped, but not a second pawn on a file', () => {
  SGG.init(); SGG.b.fill(0);
  SGG.b[sq(0, 4)] = T.K; SGG.b[sq(8, 4)] = T.K + 32;
  SGG.b[sq(4, 4)] = T.R; SGG.b[sq(6, 4)] = T.P + 32;
  SGG.apply(SGG.legal(0).find(m => m.from === sq(4, 4) && m.to === sq(6, 4)));
  assert.equal(SGG.hands[0][T.P - 1], 1);
  SGG.b[sq(2, 3)] = T.P; // an unpromoted pawn of ours on file 3
  const drops = SGG.legal(0).filter(m => m.drop === T.P);
  assert.ok(drops.length > 0);
  assert.ok(drops.every(m => m.to % 9 !== 3), 'no second pawn on file 3');
  assert.ok(drops.every(m => ((m.to / 9) | 0) !== 8), 'no pawn dropped on the last rank');
});
test('Shogi: no checkmate by dropping a pawn', () => {
  SGG.init(); SGG.b.fill(0);
  // The Scribe's king in the corner, boxed in by its own pieces; a dropped pawn in front would mate.
  SGG.b[sq(8, 0)] = T.K + 32; SGG.b[sq(8, 1)] = T.L + 32; SGG.b[sq(7, 1)] = T.S + 32;
  SGG.b[sq(6, 0)] = T.G; SGG.b[sq(0, 8)] = T.K;
  SGG.hands[0][T.P - 1] = 1;
  assert.ok(!SGG.legal(0).some(m => m.drop === T.P && m.to === sq(7, 0)));
});
for (const level of ['gentle', 'fair', 'sharp']) {
  test(`Shogi: at ${level}, the Scribe moves within budget`, () => {
    rules.setLevel(level);
    SGG.init(); let pl = 0, slowest = 0;
    for (let k = 0; k < 6; k++) { const t0 = Date.now(); const plan = SGG.aiPlan(pl); slowest = Math.max(slowest, Date.now() - t0); plan.forEach(m => SGG.apply(m)); pl = 1 - pl; }
    assert.ok(slowest < { gentle: 400, fair: 1100, sharp: 2200 }[level], `took ${slowest} ms`);
    rules.setLevel('fair');
  });
}

/* ----------------------------------------------------------------- Yut Nori */
const { yut: YT } = rules;
test('Yut Nori: shortcuts from the corners and the centre', () => {
  assert.deepEqual(YT.route(5).slice(0, 3), [20, 21, 22]);
  assert.deepEqual(YT.route(10), [25, 26, 22, 27, 28, 0, YT.HOME]);
  assert.deepEqual(YT.route(22), [27, 28, 0, YT.HOME]);
  assert.deepEqual(YT.route(3).slice(0, 3), [4, 5, 6], 'passing a corner does not cut across');
});
test('Yut Nori: pieces stack, captures send a stack home, and yut, mo or a capture throw again', () => {
  YT.init();
  YT.pos[0] = [3, 3, -1, -1]; YT.pos[1] = [6, -1, -1, -1];
  const m = YT.legal(0, 3).find(x => x.from === 3);
  assert.deepEqual(m.group.sort(), [0, 1]);
  assert.deepEqual(m.cap, [0]);
  YT.apply(m);
  assert.deepEqual(YT.pos[0].slice(0, 2), [6, 6]); assert.equal(YT.pos[1][0], -1);
  assert.ok(YT.extra(m), 'a capture earns a throw');
  assert.ok(YT.extra({ cap: [], value: 5 }), 'so does mo');
  assert.ok(!YT.extra({ cap: [], value: 2 }));
});
test('Yut Nori: a piece goes home by passing the start corner', () => {
  YT.init(); YT.pos[0] = [28, YT.HOME, YT.HOME, YT.HOME];
  const m = YT.legal(0, 2)[0];
  assert.equal(m.to, YT.HOME); YT.apply(m); assert.ok(YT.done(0));
});

/* ------------------------------------------------------------------ Pachisi */
const { pachisi: PC } = rules;
test('Pachisi: an 84-step route, with the castles 25 from home where the sources put them', () => {
  for (let a = 0; a < 4; a++) {
    assert.equal(PC.ROUTE[a].length, 84);
    assert.ok(PC.castle(PC.ROUTE[a][84 - 25]));
  }
});
test('Pachisi: the first piece of a colour comes out on any throw; later ones need a grace', () => {
  PC.setVariant('short'); PC.init();
  assert.ok(PC.legal(0, 3).some(m => m.from === 0));
  PC.pos[0][0] = 5;
  assert.ok(!PC.legal(0, 3).some(m => m.from === 0 && PC.arm(0, m.i) === PC.arm(0, 0)), 'yellow\'s second piece needs a grace');
  assert.ok(PC.legal(0, 10).some(m => m.from === 0 && PC.arm(0, m.i) === PC.arm(0, 0)));
});
test('Pachisi: captures off castles only, no landing on an enemy castle, and no stopping one short of home', () => {
  PC.setVariant('short'); PC.init();
  PC.pos[0] = [5, 0, 0, 0];
  const target = PC.cellOf(0, 0, 8); // yellow's 8th square, the castle at the end of its arm
  assert.ok(PC.castle(target));
  // Put a Scribe piece there: yellow may not land on it.
  PC.pos[1] = [0, 0, 0, 0];
  for (let idx = 1; idx < 84; idx++) if (PC.cellOf(1, 0, idx) === target) { PC.pos[1][0] = idx; break; }
  assert.ok(!PC.legal(0, 3).some(m => m.i === 0 && m.to === 8));
  // On an ordinary square, the same landing captures.
  const plain = PC.cellOf(0, 0, 9);
  for (let idx = 1; idx < 84; idx++) if (PC.cellOf(1, 0, idx) === plain) { PC.pos[1][0] = idx; break; }
  const m = PC.legal(0, 4).find(x => x.i === 0 && x.to === 9);
  assert.deepEqual(m.cap, [0]);
  PC.pos[0][0] = 80;
  assert.ok(!PC.legal(0, 3).some(x => x.i === 0), 'square 83 is a dead end');
  assert.ok(PC.legal(0, 4).some(x => x.i === 0 && x.to === 84));
});

/* ------------------------------------------------------------------ Mahjong */
const { mahjong: MJ } = rules;
const mjIds = ts => ts.map((t, k) => t * 4 + (k % 4));
test('Mahjong: counts how far a hand is from winning, including seven pairs and thirteen orphans', () => {
  assert.equal(MJ.shanten(mjIds([0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 31, 31]), 0), -1);
  assert.equal(MJ.shanten(mjIds([0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 31]), 0), 0);
  assert.equal(MJ.shanten(mjIds([0, 0, 3, 3, 5, 5, 9, 9, 12, 12, 30, 30, 33, 33]), 0), -1);
  assert.equal(MJ.shanten(mjIds([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33, 33]), 0), -1);
  assert.equal(MJ.shanten(mjIds([0, 1, 2, 9, 10, 11, 31, 31]), 2), -1, 'with two sets already shown');
});
test('Mahjong: a chow can be claimed only from the player on the left', () => {
  MJ.init();
  MJ.hands[0] = [1 * 4, 2 * 4, 30 * 4, 30 * 4 + 1];
  const fromLeft = MJ.claimsFor(0, { seat: 3, tile: 0 * 4 + 1 }), fromRight = MJ.claimsFor(0, { seat: 1, tile: 0 * 4 + 1 });
  assert.ok(fromLeft.some(c => c.kind === 'chow'));
  assert.ok(!fromRight.some(c => c.kind === 'chow'));
  assert.ok(MJ.claimsFor(0, { seat: 1, tile: 30 * 4 + 2 }).some(c => c.kind === 'pung'));
});
test('Mahjong: you are not asked to chow when a Scribe will pung the same tile', () => {
  MJ.init(); rules.setLevel('fair');
  MJ.hands[0] = [1 * 4, 2 * 4, 33 * 4, 33 * 4 + 1, 33 * 4 + 2, 27 * 4, 28 * 4, 29 * 4, 31 * 4, 32 * 4, 4 * 4, 5 * 4, 6 * 4];
  MJ.hands[1] = [0 * 4 + 2, 0 * 4 + 3, 9 * 4, 10 * 4, 11 * 4, 12 * 4, 13 * 4, 14 * 4, 15 * 4, 16 * 4, 17 * 4, 22 * 4, 23 * 4];
  MJ.openClaims({ seat: 3, tile: 0 * 4 + 1 });
  if (MJ.need.ai && MJ.need.ai.kind === 'pung') assert.ok(!MJ.need.mine.some(c => c.kind === 'chow'));
});
for (const level of ['gentle', 'fair', 'sharp']) {
  test(`Mahjong: at ${level}, a whole hand plays out, every Scribe turn in good time`, () => {
    rules.setLevel(level); MJ.init(); let slowest = 0, guard = 0;
    while (!MJ.result() && guard++ < 1000) {
      const ms = MJ.legal(0);
      if (ms.length) { const pick0 = MJ.need.type === 'discard' ? MJ.chooseDiscard(0) : -1; const m = ms.find(x => x.kind === 'tsumo' || x.kind === 'ron') || ms.find(x => x.kind === 'pass') || ms.find(x => x.kind === 'discard' && x.tile === pick0); MJ.apply(m); continue; }
      const t0 = Date.now(); const plan = MJ.aiPlan(); slowest = Math.max(slowest, Date.now() - t0);
      assert.ok(plan.length, 'the Scribes always have something to do');
      plan.forEach(st => MJ.apply(st));
    }
    assert.ok(MJ.result());
    assert.ok(slowest < 1500, `took ${slowest} ms`);
    rules.setLevel('fair');
  });
}

/* ---------------------------------------------------------- Bao la Kujifunza */
const BAO = rules.bao;
const baoEmpty = () => { BAO.init(); BAO.p.fill(0); };
test('Bao: 64 seeds, two to a pit, and every opening move captures', () => {
  BAO.init();
  assert.equal(BAO.count(0) + BAO.count(1), 64);
  const ms = BAO.legal(0);
  assert.ok(ms.length > 0 && ms.every(m => m.mtaji));
});
test('Bao: a capture in the middle is sown from the kichwa that keeps the direction', () => {
  baoEmpty();
  BAO.p[9] = 2; BAO.p[11] = 1; BAO.p[28] = 3; BAO.p[24] = 1;
  const m = BAO.legal(0).find(x => x.pit === 9 && x.dir === 1);
  assert.ok(m && m.mtaji);
  BAO.apply(m);
  assert.deepEqual([8, 9, 10, 11, 12].map(i => BAO.p[i]), [1, 1, 0, 3, 1]);
  assert.equal(BAO.p[28], 0);
});
test('Bao: a capture near an end is sown from the nearer kichwa', () => {
  baoEmpty();
  BAO.p[12] = 2; BAO.p[14] = 1; BAO.p[25] = 2; BAO.p[24] = 1;
  BAO.apply(BAO.legal(0).find(x => x.pit === 12 && x.dir === 1));
  assert.deepEqual([11, 12, 13, 14, 15].map(i => BAO.p[i]), [1, 1, 2, 0, 1]);
  assert.equal(BAO.p[25], 0);
});
test('Bao: with no capture open, you must sow from the inner row', () => {
  baoEmpty();
  BAO.p[0] = 3; BAO.p[9] = 2; BAO.p[16] = 5;
  const ms = BAO.legal(0);
  assert.equal(ms.length, 2);
  assert.ok(ms.every(m => m.pit === 9 && !m.mtaji));
});
test('Bao: an empty inner row loses', () => {
  baoEmpty();
  BAO.p[0] = 4; BAO.p[24] = 2;
  assert.equal(BAO.result(0).winner, 1);
});
test('Bao: random games keep all 64 seeds and always end', () => {
  for (let g = 0; g < 50; g++) {
    BAO.init(); let pl = 0, r = null;
    for (let t = 0; t < 400 && !(r = BAO.result(pl)); t++) { const ms = BAO.legal(pl); BAO.apply(ms[(Math.random() * ms.length) | 0]); pl = 1 - pl; }
    assert.ok(r);
    assert.equal(BAO.count(0) + BAO.count(1), 64);
  }
});
for (const level of ['gentle', 'fair', 'sharp']) {
  test(`Bao: at ${level}, the Scribe answers in good time`, () => {
    rules.setLevel(level); BAO.init(); BAO.apply(BAO.legal(0)[0]);
    const t0 = Date.now(), plan = BAO.aiPlan(1);
    assert.ok(plan.length && Date.now() - t0 < 2000);
    rules.setLevel('fair');
  });
}
