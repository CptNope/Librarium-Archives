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

test('Reversi: Gentle Scribe chooses any legal move without searching', () => {
  const oldLevel = rules.level(), oldRandom = Math.random;
  try {
    rules.setLevel('gentle');
    RV.init();
    RV.apply(RV.legal(0)[0]); // Give the Scribe a real position with several replies.
    const moves = RV.legal(1), before = RV.snapshot();
    assert.ok(moves.length > 1);
    Math.random = () => 0;
    assert.deepEqual(RV.aiPlan(1), [moves[0]]);
    Math.random = () => 0.999999;
    assert.deepEqual(RV.aiPlan(1), [moves[moves.length - 1]]);
    assert.deepEqual(RV.snapshot(), before, 'AI selection does not alter the board');

    RV.b.fill(0); RV.b[0] = 1; RV.b[1] = 2;
    assert.deepEqual(RV.aiPlan(1), [{ pl: 1, pass: true }], 'a player with no legal move still passes');
  } finally {
    Math.random = oldRandom;
    rules.setLevel(oldLevel);
  }
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

test('Halma: the house rule ends a long game on men home', () => {
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

/* ------------------------------------------------- The Landlord's Game (1904) */
const LLG = rules.landlord;
const llFresh = () => { LLG.setVariant('3'); LLG.init(); LLG.ticketsOpen = [false, false]; };
test('Landlord: the patent board has forty spaces, 22 lots priced ten times their number', () => {
  const S = LLG.SPACES;
  assert.equal(S.length, 40);
  const lots = S.filter(sp => sp.t === 'lot');
  assert.equal(lots.length, 22);
  assert.ok(lots.every(sp => sp.price === 10 * sp.n && sp.rent === sp.n));
  assert.equal(S[0].key, 'earth'); assert.equal(S[10].key, 'coal'); assert.equal(S[20].key, 'park'); assert.equal(S[30].t, 'trespass');
  assert.equal(S.filter(sp => sp.t === 'rr').length, 4);
  assert.equal(S.filter(sp => sp.t === 'lux').length, 3);
  assert.equal(S.filter(sp => sp.t === 'need').length, 4);
});
test('Landlord: each player draws six lot tickets and may buy them before the first throw', () => {
  LLG.init();
  assert.equal(LLG.tickets[0].length, 6); assert.equal(LLG.tickets[1].length, 6);
  const pre = LLG.preThrow(0), buy = pre.find(m => m.kind === 'ticket');
  const r = LLG.apply(buy);
  assert.equal(LLG.owner[buy.n], 0); assert.equal(LLG.cash[0], 500 - 10 * buy.n);
  assert.ok(r.followUp.some(m => m.kind === 'endTickets'));
  assert.ok(LLG.apply({ pl: 0, kind: 'endTickets', pre: true }).thenThrow);
  assert.equal(LLG.preThrow(0), null);
});
test('Landlord: passing Mother Earth pays $100 wages and counts a round', () => {
  llFresh(); LLG.pos[0] = 38;
  LLG.apply({ pl: 0, kind: 'move', from: 38, steps: 4, dir: 1, to: 2 }); // lands on Bread
  assert.equal(LLG.laps[0], 1); assert.equal(LLG.cash[0], 500 + 100 - 5);
});
test('Landlord: an unowned lot offers buy or rent; an owned one charges rent to the owner', () => {
  llFresh();
  const r = LLG.apply({ pl: 0, kind: 'move', from: 0, steps: 3, dir: 1, to: 3 });
  assert.deepEqual(r.followUp.map(m => m.kind), ['buyLot', 'rentLot']);
  LLG.apply(r.followUp[0]);
  assert.equal(LLG.owner[2], 0); assert.equal(LLG.cash[0], 480);
  LLG.apply({ pl: 1, kind: 'move', from: 0, steps: 3, dir: 1, to: 3 });
  assert.equal(LLG.cash[1], 498); assert.equal(LLG.cash[0], 482);
});
test('Landlord: No Trespassing sends you to jail; a double gets you out', () => {
  llFresh();
  LLG.apply({ pl: 0, kind: 'move', from: 0, steps: 4, dir: 1, to: 4 });
  assert.equal(LLG.pos[0], LLG.JAIL); assert.ok(LLG.jailed[0]);
  assert.deepEqual(LLG.preThrow(0).map(m => m.kind), ['fine', 'tryDouble']);
  assert.equal(LLG.legal(0, 7, { value: 7, faces: [3, 4] })[0].kind, 'stay');
  const out = LLG.legal(0, 6, { value: 6, faces: [3, 3] })[0];
  assert.ok(out.free); LLG.apply(out);
  assert.ok(!LLG.jailed[0]);
});
test('Landlord: a double that passes a railroad may ride to the next one', () => {
  llFresh(); LLG.pos[0] = 1;
  const ms = LLG.legal(0, 8, { value: 8, faces: [4, 4] });
  const ride = ms.find(m => m.ride !== undefined);
  assert.ok(ride); assert.equal(ride.to, 15);
});
test('Landlord: declining a luxury loses the move', () => {
  llFresh(); LLG.pos[0] = 5;
  const r = LLG.apply({ pl: 0, kind: 'move', from: 5, steps: 3, dir: 1, to: 8 });
  const dec = r.followUp.find(m => m.kind === 'declineLux');
  LLG.apply(dec);
  assert.equal(LLG.pos[0], 5); assert.equal(LLG.cash[0], 500);
});
test('Landlord: short of cash you borrow against your lots, and with none you go to the poorhouse', () => {
  llFresh(); LLG.cash[0] = 0; LLG.owner[20] = 0; LLG.owner[2] = 1;
  LLG.apply({ pl: 0, kind: 'move', from: 0, steps: 3, dir: 1, to: 3 });
  assert.equal(LLG.notes[0], 1); assert.equal(LLG.cash[0], 98);
  llFresh(); LLG.cash[0] = 0; LLG.owner[2] = 1;
  LLG.apply({ pl: 0, kind: 'move', from: 0, steps: 3, dir: 1, to: 3 });
  assert.equal(LLG.pos[0], LLG.PARK);
});
test('Landlord: simulated games end, and the worth adds up', () => {
  for (const lv of ['gentle', 'fair', 'sharp']) {
    rules.setLevel(lv);
    for (let g = 0; g < 20; g++) {
      LLG.setVariant(g % 2 ? '5' : '3'); LLG.init(); let pl = 0, t = 0;
      while (!LLG.done() && t++ < 2000) {
        for (const m of LLG.aiPre(pl)) LLG.apply(m);
        const r = LLG.roll(); for (const m of LLG.aiPlan(pl, LLG.legal(pl, r.value, r))) LLG.apply(m);
        assert.equal(LLG.pend, null); pl = 1 - pl;
      }
      assert.ok(LLG.done());
      const f = LLG.final(); assert.ok([0, 1, -1].includes(f.winner));
    }
  }
  rules.setLevel('fair'); LLG.setVariant('3');
});

/* ------------------------------------------------------- Chinese checkers */
const CCK = rules.chinese;
test('Chinese checkers: a star of 121 holes, ten marbles a side in opposite points', () => {
  assert.equal(CCK.CELLS.length, 121);
  CCK.init();
  assert.equal(CCK.men(0).length, 10); assert.equal(CCK.men(1).length, 10);
  assert.ok(CCK.CAMP[0].every(i => CCK.CELLS[i][2] > 4)); assert.ok(CCK.CAMP[1].every(i => CCK.CELLS[i][2] < -4));
});
test('Chinese checkers: hops chain over either colour and capture nothing', () => {
  CCK.init(); CCK.b.fill(0);
  const at = (x, y) => CCK.CELLS.findIndex(c => c[0] === x && c[1] === y);
  const a = at(0, 0); CCK.b[a] = 1; CCK.b[at(1, -1)] = 2; CCK.b[at(3, -3)] = 1;
  const far = CCK.reach(a).find(m => m.to === at(4, -4));
  assert.ok(far && far.path.length === 2);
  CCK.apply(far); assert.equal(CCK.b[at(1, -1)], 2);
});
test('Chinese checkers: filling the far point wins, even with the other side\'s marbles in it', () => {
  CCK.init(); CCK.b.fill(0);
  CCK.CAMP[1].forEach((i, k) => { CCK.b[i] = k < 9 ? 1 : 2; });
  assert.equal(CCK.winner(), 0);
});

/* -------------------------------------------------------------------- Hex */
const HX = rules.hex;
test('Hex: red joins near and far rows, blue joins the sides', () => {
  HX.setVariant('7'); HX.init();
  for (let r = 0; r < 7; r++) HX.apply({ pl: 0, at: r * 7 + 3 });
  assert.equal(HX.result().winner, 0);
  HX.init(); for (let c = 0; c < 7; c++) HX.apply({ pl: 1, at: 2 * 7 + c });
  assert.equal(HX.result().winner, 1);
});
test('Hex: a full board always has exactly one winner', () => {
  HX.setVariant('7');
  for (let g = 0; g < 50; g++) {
    HX.init(); const b = new Uint8Array(49);
    for (let i = 0; i < 49; i++) b[i] = Math.random() < 0.5 ? 1 : 2;
    assert.notEqual(HX.joined(b, 1), HX.joined(b, 2));
  }
});
test('Hex: you move first, and the swap rule is off unless you turn it on', () => {
  HX.setVariant('9'); HX.setToggle('swap', false); HX.init();
  assert.equal(HX.first, 0);
  HX.apply({ pl: 0, at: 4 * 9 + 4 });
  assert.ok(!HX.legal(1).some(m => m.swap));
  rules.setLevel('sharp'); assert.ok(!HX.aiPlan(1).some(m => m.swap)); rules.setLevel('fair');
  assert.match(HX.rules[3], /swap rule is off/);
});
test('Hex: with the swap rule on, the swap reflects the opening stone into blue', () => {
  HX.setVariant('9'); HX.setToggle('swap', true); HX.init(); HX.apply({ pl: 0, at: 2 * 9 + 5 });
  const sw = HX.legal(1).find(m => m.swap); assert.ok(sw);
  HX.apply(sw);
  assert.equal(HX.b[5 * 9 + 2], 2); assert.equal(HX.b[2 * 9 + 5], 0);
  assert.ok(!HX.legal(1).some(m => m.swap));
  HX.setToggle('swap', false);
});
test('Hex: the Scribe answers on a 9 × 9 board in good time', () => {
  rules.setLevel('fair'); HX.setVariant('9'); HX.init(); HX.apply({ pl: 0, at: 0 });
  const t0 = Date.now(), plan = HX.aiPlan(1);
  assert.ok(plan.length === 1 && Date.now() - t0 < 2000);
  HX.setVariant('9');
});

/* ----------------------------------------------------------------- Gomoku */
const GMK = rules.gomoku;
test('Gomoku: five in a row wins, and so do six', () => {
  GMK.init();
  for (let c = 0; c < 5; c++) GMK.apply({ pl: 0, at: 7 * 15 + c });
  assert.equal(GMK.result().winner, 0); assert.equal(GMK.line.length, 5);
  GMK.init();
  for (const c of [0, 1, 2, 4, 5]) GMK.apply({ pl: 1, at: c });
  assert.equal(GMK.result(), null);
  GMK.apply({ pl: 1, at: 3 });
  assert.equal(GMK.result().winner, 1); assert.equal(GMK.line.length, 6);
});
test('Gomoku: the Scribe takes a win and blocks an open four', () => {
  for (const lv of ['fair', 'sharp']) {
    rules.setLevel(lv);
    GMK.init(); for (const c of [3, 4, 5, 6]) GMK.b[7 * 15 + c] = 2; for (const c of [3, 4, 5]) GMK.b[2 * 15 + c] = 1; GMK.ply = 7;
    assert.ok([7 * 15 + 2, 7 * 15 + 7].includes(GMK.aiPlan(1)[0].at));
    GMK.init(); for (const c of [3, 4, 5, 6]) GMK.b[7 * 15 + c] = 1; GMK.b[0] = 2; GMK.b[14] = 2; GMK.ply = 6;
    assert.ok([7 * 15 + 2, 7 * 15 + 7].includes(GMK.aiPlan(1)[0].at));
  }
  rules.setLevel('fair');
});

/* --------------------------------------------------------------- Dominoes */
const DMN = rules.dominoes;
test('Dominoes: a double-six set of 28, seven each and fourteen in the boneyard', () => {
  assert.equal(DMN.TILES.length, 28);
  DMN.init();
  assert.equal(DMN.hands[0].length, 7); assert.equal(DMN.hands[1].length, 7); assert.equal(DMN.yard.length, 14);
});
test('Dominoes: tiles match the open ends, and you draw until you can play but never the last two', () => {
  DMN.init();
  const t = DMN.TILES.findIndex(([a, b]) => a === 6 && b === 6);
  const id = (a, b) => DMN.TILES.findIndex(([x, y]) => x === a && y === b);
  DMN.hands = [[t, id(2, 3)], [id(0, 1)]];
  DMN.yard = [id(0, 2), id(1, 1), id(4, 6)]; // drawn from the end: the 4-6 first
  DMN.apply({ pl: 0, kind: 'play', t, side: 1 });
  assert.deepEqual(DMN.ends, [6, 6]);
  assert.equal(DMN.legal(1)[0].kind, 'draw');
  DMN.apply(DMN.legal(1)[0]);
  assert.equal(DMN.legal(1)[0].kind, 'play');
  DMN.hands[1] = [id(0, 1)];
  assert.equal(DMN.legal(1)[0].kind, 'pass'); // two left in the boneyard
});
test('Dominoes: a blocked hand goes to the lower pip count', () => {
  DMN.init();
  DMN.hands = [[DMN.TILES.findIndex(([a, b]) => a === 0 && b === 1)], [DMN.TILES.findIndex(([a, b]) => a === 5 && b === 6)]];
  DMN.passes = 2;
  const r = DMN.result(); assert.equal(r.winner, 0);
});
test('Dominoes: simulated hands always end, and every tile is accounted for', () => {
  for (const lv of ['gentle', 'fair', 'sharp']) {
    rules.setLevel(lv);
    for (let g = 0; g < 40; g++) {
      DMN.init(); let pl = 0, t = 0;
      while (!DMN.result() && t++ < 200) { for (const m of DMN.aiPlan(pl)) DMN.apply(m); pl = 1 - pl; }
      assert.ok(DMN.result());
      assert.equal(DMN.hands[0].length + DMN.hands[1].length + DMN.yard.length + DMN.line.length, 28);
    }
  }
  rules.setLevel('fair');
});

/* ------------------------------------------------------------------ Tablut */
const TBL = rules.tablut;
test('Tablut: 16 Muscovites against the king and 8 Swedes on 9 × 9', () => {
  TBL.init(); assert.equal(TBL.count(1), 16); assert.equal(TBL.count(0), 9); assert.equal(TBL.b[40], 3);
});
test('Tablut: the king escapes at any edge square', () => {
  TBL.init(); TBL.b.fill(0); TBL.b[22] = 3; TBL.b[0] = 1;
  TBL.apply({ pl: 0, from: 22, to: 4 });
  assert.equal(TBL.result(0).winner, 0);
});
test('Tablut: away from the throne two Muscovites capture the king; beside it, three and the throne', () => {
  TBL.init(); TBL.b.fill(0); TBL.b[20] = 3; TBL.b[19] = 1; TBL.b[30] = 1; TBL.b[80] = 2;
  TBL.apply({ pl: 1, from: 30, to: 21 });
  assert.equal(TBL.win && TBL.win.winner, 1);
  TBL.init(); TBL.b.fill(0); TBL.b[31] = 3; TBL.b[30] = 1; TBL.b[32] = 1; TBL.b[13] = 1; TBL.b[80] = 2;
  TBL.apply({ pl: 1, from: 13, to: 22 });
  assert.equal(TBL.win && TBL.win.winner, 1);
  TBL.init(); TBL.b.fill(0); TBL.b[31] = 3; TBL.b[30] = 1; TBL.b[13] = 1; TBL.b[80] = 2;
  TBL.apply({ pl: 1, from: 13, to: 22 });
  assert.equal(TBL.win, null);
});
test('Tablut: the king helps capture, and only he may stop on the throne', () => {
  TBL.init(); TBL.b.fill(0); TBL.b[10] = 3; TBL.b[11] = 1; TBL.b[30] = 2; TBL.b[0] = 1;
  const r = TBL.apply({ pl: 0, from: 30, to: 12 });
  assert.deepEqual(r.caps, [11]);
  TBL.init(); assert.ok(!TBL.legal(0).some(m => m.to === 40));
});

/* ------------------------------------------------------------------ Makruk */
const MKR = rules.makruk;
test('Makruk: 23 legal opening moves, pawns on the third rank, no double step', () => {
  MKR.init(); assert.equal(MKR.legal(0).length, 23);
  assert.ok(MKR.legal(0).filter(m => (MKR.b[m.from] & 7) === 6).every(m => m.to - m.from === 8));
});
test('Makruk: a bia reaching the sixth rank turns into a met', () => {
  MKR.init(); MKR.b.fill(0); MKR.b[3] = 1; MKR.b[60] = 9; MKR.b[32] = 6;
  MKR.apply({ pl: 0, from: 32, to: 40 });
  assert.equal(MKR.b[40], 7);
});
test('Makruk: the khon steps one diagonally or one straight forward', () => {
  MKR.init(); MKR.b.fill(0); MKR.b[0] = 1; MKR.b[63] = 9; MKR.b[27] = 3;
  const to = MKR.legal(0).filter(m => m.from === 27).map(m => m.to).sort((a, b) => a - b);
  assert.deepEqual(to, [18, 20, 34, 35, 36]);
});
test('Makruk: checkmate wins and stalemate draws', () => {
  MKR.init(); MKR.b.fill(0); MKR.b[56] = 9; MKR.b[42] = 1; MKR.b[49] = 5; MKR.b[1] = 5;
  MKR.apply({ pl: 0, from: 1, to: 57 });
  assert.equal(MKR.result(1).winner, 0);
});

/* ------------------------------------------------------------------- Kalah */
const KLH = rules.kalah;
test('Kalah: a last seed in your store earns another move', () => {
  KLH.setVariant('4'); KLH.init();
  const r = KLH.apply({ pl: 0, pit: 2 });
  assert.ok(r.again); assert.equal(KLH.p[6], 1); assert.ok(r.followUp.length);
});
test('Kalah: landing in your own empty pit captures the pit opposite', () => {
  KLH.init(); KLH.p.fill(0); KLH.p[0] = 1; KLH.p[11] = 5; KLH.p[12] = 1; KLH.p[5] = 1;
  KLH.apply({ pl: 0, pit: 0 });
  assert.equal(KLH.p[6], 6); assert.equal(KLH.p[11], 0); assert.equal(KLH.p[1], 0);
});
test('Kalah: sowing skips the Scribe\'s store, and the game ends when a side is empty', () => {
  KLH.init(); KLH.p.fill(0); KLH.p[5] = 9; KLH.p[7] = 1;
  KLH.apply({ pl: 0, pit: 5 });
  assert.equal(KLH.p[13], 0); assert.equal(KLH.p[0], 1); // wrapped past the Scribe's store (and captured with the last seed)
  KLH.init(); KLH.p.fill(0); KLH.p[5] = 1; KLH.p[8] = 3;
  KLH.apply({ pl: 0, pit: 5 });
  assert.equal(KLH.p[6], 1); assert.equal(KLH.p[13], 3); assert.ok(KLH.result());
});

/* ---------------------------------------------------------------- Cribbage */
const CRB = rules.cribbage, crd = (r, s) => s * 13 + r;
test('Cribbage: the show counts fifteens, pairs, runs, flushes and nobs (29 is the best hand)', () => {
  assert.equal(CRB.show([crd(4, 0), crd(4, 1), crd(4, 2), crd(10, 3)], crd(4, 3), false).total, 29);
  assert.equal(CRB.show([crd(2, 0), crd(3, 1), crd(4, 0), crd(4, 2)], crd(5, 3), false).total, 14);
  assert.equal(CRB.show([crd(0, 1), crd(2, 1), crd(6, 1), crd(8, 1)], crd(11, 0), false).total, 4);
  assert.equal(CRB.show([crd(0, 1), crd(2, 1), crd(6, 1), crd(8, 1)], crd(11, 0), true).total, 0);
});
test('Cribbage: the play pegs fifteens, pairs, runs and thirty-one', () => {
  assert.equal(CRB.peg([crd(4, 0), crd(4, 1), crd(4, 2)], 15).pts, 8);
  assert.equal(CRB.peg([crd(3, 0), crd(5, 1), crd(4, 2)], 15).pts, 5);
  assert.equal(CRB.peg([crd(12, 0), crd(11, 1), crd(10, 2), crd(0, 3)], 31).pts, 2);
});
test('Cribbage: a full game ends, every card is accounted for each deal, and scores reach the target', () => {
  for (const lv of ['gentle', 'fair', 'sharp']) {
    rules.setLevel(lv); CRB.setVariant('61');
    for (let g = 0; g < 10; g++) {
      CRB.init(); let t = 0;
      while (CRB.over < 0 && t++ < 3000) {
        const pl = CRB.need.pl, ms = CRB.legal(pl);
        assert.ok(ms.length);
        if (pl === 0) CRB.apply(CRB.need.type === 'play' ? CRB.aiCard(0, ms) : ms[(Math.random() * ms.length) | 0]);
        else for (const m of CRB.aiPlan(1)) CRB.apply(m);
        if (CRB.need.type === 'play') assert.ok(CRB.count <= 31);
      }
      assert.ok(CRB.over >= 0); assert.equal(CRB.score[CRB.over], 61);
    }
  }
  rules.setLevel('fair');
});

/* -------------------------------------------------------------- Morabaraba */
const MBR = rules.morabaraba;
test('Morabaraba: twelve cows each, and the diagonals carry moves and mills', () => {
  MBR.init(); assert.deepEqual(MBR.hand, [12, 12]);
  assert.ok(MBR.ADJ[0].includes(8) && MBR.ADJ[8].includes(16));
  assert.ok(MBR.MILLS.some(m => m.join() === '0,8,16'));
  MBR.board[0] = 0; MBR.board[8] = 0; MBR.hand[0] = 10;
  const r = MBR.apply({ type: 'place', pl: 0, to: 16 });
  assert.ok(r.followUp && r.followUp.length === 0 || r.followUp === undefined || r.followUp.every(m => m.type === 'remove'));
  assert.ok(MBR.inMill(16, 0));
});
test('Morabaraba: Nine Men\'s Morris is unchanged by the shared code', () => {
  const M = rules.morris; M.init();
  assert.deepEqual(M.hand, [9, 9]); assert.equal(M.ADJ[0].length, 2); assert.equal(M.MILLS.length, 16);
});
test('Morabaraba: three cows each and ten quiet moves each is a draw', () => {
  MBR.init(); MBR.hand = [0, 0]; MBR.board.fill(-1); [0, 2, 4].forEach(p => { MBR.board[p] = 0; }); [17, 19, 21].forEach(p => { MBR.board[p] = 1; });
  MBR.quiet = 20; assert.equal(MBR.result(0).winner, -1);
});

/* -------------------------------------------------------------------- Ludo */
const LDO = rules.ludo;
test('Ludo: a 52-square track; a six brings a token out', () => {
  assert.equal(LDO.TRACK.length, 52); assert.equal(new Set(LDO.TRACK.map(p => p.join())).size, 52);
  LDO.init(); assert.equal(LDO.legal(0, 5).length, 0); assert.equal(LDO.legal(0, 6).length, 1);
  LDO.apply(LDO.legal(0, 6)[0]); assert.deepEqual(LDO.pos[0], [0, -1, -1, -1]);
  assert.ok(LDO.extra({ pl: 0 }, 6));
});
test('Ludo: landing on a Scribe token sends it home, and the finish needs the exact throw', () => {
  LDO.init(); LDO.pos[0] = [24, -1, -1, -1]; LDO.pos[1] = [0, -1, -1, -1]; // the Scribe's start is square 26
  const m = LDO.legal(0, 2)[0]; const r = LDO.apply(m);
  assert.deepEqual(r.caps, [0]); assert.equal(LDO.pos[1][0], -1);
  LDO.init(); LDO.pos[0] = [53, 56, 56, 56];
  assert.equal(LDO.legal(0, 4).length, 0); assert.equal(LDO.legal(0, 3).length, 1);
  LDO.apply(LDO.legal(0, 3)[0]); assert.ok(LDO.done(0));
});
test('Ludo: the home column is safe', () => {
  LDO.init(); LDO.pos[0] = [52, -1, -1, -1]; LDO.pos[1] = [50, -1, -1, -1];
  assert.equal(LDO.abs(0, 52), -1);
});

/* ------------------------------------------------------------------ Janggi */
const JGI = rules.janggi;
test('Janggi: the setup, the points (72 to 73.5) and no river', () => {
  JGI.init(); assert.equal(JGI.points(0), 72); assert.equal(JGI.points(1), 73.5);
  assert.equal(JGI.b[13], 1); assert.equal(JGI.b[76], 9);
  assert.ok(JGI.legal(0).some(m => m.pass));
});
test('Janggi: a cannon needs a screen, and can neither jump nor take a cannon', () => {
  JGI.init(); assert.ok(!JGI.legal(0).some(m => (JGI.b[m.from] & 7) === 6));
  JGI.b.fill(0); JGI.b[4] = 1; JGI.b[85] = 9; JGI.b[40] = 6; JGI.b[42] = 7; JGI.b[38] = 14;
  const to = JGI.legal(0).filter(m => m.from === 40).map(m => m.to).sort((a, b) => a - b);
  assert.deepEqual(to, [43, 44]); // over the soldier to the right, but not over the Han cannon to the left
});
test('Janggi: the elephant moves one straight and two diagonally, and can be blocked', () => {
  JGI.init(); JGI.b.fill(0); JGI.b[4] = 1; JGI.b[85] = 9; JGI.b[40] = 3;
  const to = JGI.legal(0).filter(m => m.from === 40).map(m => m.to).sort((a, b) => a - b);
  assert.equal(to.length, 8);
  JGI.b[49] = 7; assert.equal(JGI.legal(0).filter(m => m.from === 40).length, 6);
});
test('Janggi: bikjang left unblocked goes to points', () => {
  JGI.init(); JGI.b.fill(0); JGI.b[4] = 1; JGI.b[3] = 5; JGI.b[76] = 9; JGI.b[31] = 7;
  JGI.apply({ pl: 0, from: 31, to: 30 }); // opens the file: generals face each other
  assert.ok(JGI.facing());
  JGI.apply({ pl: 1, pass: true });
  assert.ok(JGI.over); assert.equal(JGI.over.winner, 0);
});

/* ---------------------------------------------------------- Chaturaji */

const CJ = rules.chaturaji;
const cjAt = (x, y) => y * 8 + x;
const cjClear = () => { CJ.init(); CJ.b.fill(0); };
const cjPut = (seat, type, x, y) => { CJ.b[cjAt(x, y)] = (seat << 3) | type; };

test('Chaturaji: four armies of eight, set out in a pinwheel', () => {
  CJ.init();
  for (let s = 0; s < 4; s++) {
    let n = 0; for (let i = 0; i < 64; i++) if (CJ.b[i] && (CJ.b[i] >> 3) === s) n++;
    assert.equal(n, 8);
    assert.equal(CJ.count(s, 1), 1); assert.equal(CJ.count(s, 5), 4);
  }
  // Turning the board a quarter turn carries each army onto the next one's squares.
  for (let i = 0; i < 64; i++) {
    const v = CJ.b[i]; if (!v) continue;
    const x = i & 7, y = i >> 3, j = cjAt(y, 7 - x);
    assert.equal(CJ.b[j], (((v >> 3) + 1) % 4) << 3 | (v & 7));
  }
  assert.equal(CJ.b[cjAt(3, 0)], 1); // your king on d1
});

test('Chaturaji: each face moves its own kind of piece, and the boat jumps two diagonally', () => {
  CJ.init();
  const types = f => new Set(CJ.legal(0, 0, { faces: [f, f] }).filter(m => !m.pass).map(m => CJ.b[m.from] & 7));
  assert.deepEqual([...types(3)], [3]);
  assert.deepEqual([...types(1)].sort(), [1, 5]);
  assert.deepEqual([...types(5)].sort(), [1, 5]);
  assert.equal(types(4).size, 0); // the elephant is boxed in at the start
  cjClear(); cjPut(0, 4, 3, 3); cjPut(1, 5, 4, 4); cjPut(0, 1, 0, 0);
  const boat = CJ.legal(0, 0, { faces: [2, 2] }).filter(m => !m.pass).map(m => m.to).sort((a, b) => a - b);
  assert.deepEqual(boat, [cjAt(1, 1), cjAt(5, 1), cjAt(1, 5), cjAt(5, 5)]); // it jumps the pawn on e5
  cjClear(); cjPut(0, 2, 0, 0); cjPut(2, 5, 0, 5); cjPut(0, 1, 7, 7);
  const el = CJ.legal(0, 0, { faces: [4, 6] }).filter(m => !m.pass);
  assert.equal(el.filter(m => (m.to & 7) === 0).length, 5); // up the a-file to a6, taking the pawn
  assert.ok(el.some(m => m.to === cjAt(0, 5) && m.cap));
  assert.equal(new Set(el.map(m => m.from * 64 + m.to)).size, el.length); // 4 and 6 do not offer the same move twice
});

test('Chaturaji: pawns step away from their own side, and take diagonally forward', () => {
  const step = (seat, x, y) => { cjClear(); cjPut(seat, 5, x, y); return CJ.movesFor(seat, [1], 1).map(m => m.to); };
  assert.deepEqual(step(0, 3, 3), [cjAt(3, 4)]);
  assert.deepEqual(step(1, 3, 3), [cjAt(4, 3)]);
  assert.deepEqual(step(2, 3, 3), [cjAt(3, 2)]);
  assert.deepEqual(step(3, 3, 3), [cjAt(2, 3)]);
  cjClear(); cjPut(1, 5, 3, 3); cjPut(0, 3, 4, 4); cjPut(0, 3, 4, 2); cjPut(0, 3, 2, 4); cjPut(0, 3, 4, 3);
  assert.deepEqual(CJ.movesFor(1, [5], 1).map(m => m.to).sort((a, b) => a - b), [cjAt(4, 2), cjAt(4, 4)]); // blocked ahead; takes both forward diagonals
});

test('Chaturaji: a pawn on the far edge becomes a piece only if that piece has been lost', () => {
  cjClear(); cjPut(0, 1, 0, 0); cjPut(0, 3, 7, 0); cjPut(0, 5, 6, 6); CJ.left = [5];
  CJ.apply({ seat: 0, pl: 0, from: cjAt(6, 6), to: cjAt(6, 7), face: 5 });
  assert.equal(CJ.b[cjAt(6, 7)] & 7, 5); // g8 is a horse's square, and the horse is still in play
  cjClear(); cjPut(0, 1, 0, 0); cjPut(0, 5, 5, 6); CJ.left = [1];
  const r = CJ.apply({ seat: 0, pl: 0, from: cjAt(5, 6), to: cjAt(5, 7), face: 1 });
  assert.equal(CJ.b[cjAt(5, 7)] & 7, 2); // f8: an elephant, since ours is gone
  assert.equal(r.promo, 2);
  cjClear(); cjPut(0, 1, 0, 0); cjPut(0, 5, 3, 6); CJ.left = [1];
  CJ.apply({ seat: 0, pl: 0, from: cjAt(3, 6), to: cjAt(3, 7), face: 1 });
  assert.equal(CJ.b[cjAt(3, 7)] & 7, 5); // a king's square never promotes
});

test('Chaturaji: a boat that completes a square of four boats takes the other three', () => {
  cjClear(); cjPut(0, 1, 0, 0); cjPut(1, 4, 3, 3); cjPut(2, 4, 4, 3); cjPut(3, 4, 3, 4); cjPut(0, 4, 2, 6); CJ.left = [2];
  const r = CJ.apply({ seat: 0, pl: 0, from: cjAt(2, 6), to: cjAt(4, 4), face: 2 });
  assert.ok(r.triumph);
  assert.equal(r.captured.length, 3);
  assert.equal(CJ.score[0], 6);
  assert.equal(CJ.count(1, 4) + CJ.count(2, 4) + CJ.count(3, 4), 0);
});

test('Chaturaji: a player without a king is out, its army stays, and play skips it', () => {
  cjClear(); cjPut(0, 1, 0, 0); cjPut(1, 1, 7, 7); cjPut(1, 2, 7, 6); cjPut(2, 1, 4, 4); cjPut(3, 1, 6, 0); cjPut(0, 3, 6, 5);
  CJ.left = [3];
  const t = CJ.apply({ seat: 0, pl: 0, from: cjAt(6, 5), to: cjAt(7, 7), face: 3 });
  assert.match(t.note, /Black is out/);
  assert.equal(CJ.alive[1], false);
  assert.equal(CJ.b[cjAt(7, 6)], (1 << 3) | 2); // Black's elephant stays, to be taken
  CJ.seat = 0;
  assert.equal(CJ.passTurn(), 1); assert.equal(CJ.seat, 2); // Black is skipped
  assert.equal(CJ.over, null);
});

test('Chaturaji: losing your king ends the game; taking all three is chaturaji', () => {
  cjClear(); cjPut(0, 1, 3, 3); cjPut(2, 3, 5, 4); cjPut(1, 1, 0, 7); cjPut(3, 1, 7, 0); cjPut(2, 1, 7, 7);
  CJ.left = [3];
  CJ.apply({ seat: 2, pl: 1, from: cjAt(5, 4), to: cjAt(3, 3), face: 3 });
  assert.equal(CJ.over.winner, 1);
  assert.match(CJ.over.text, /Red took your king/);
  cjClear(); cjPut(0, 1, 3, 3); cjPut(0, 2, 0, 0); cjPut(1, 1, 0, 7); cjPut(2, 1, 7, 7); cjPut(3, 1, 7, 0);
  CJ.alive = [true, false, false, true]; CJ.kings[0] = [1, 2]; CJ.b[cjAt(0, 7)] = 0; CJ.b[cjAt(7, 7)] = 0; CJ.outNoted = [false, true, true, false];
  CJ.left = [4];
  CJ.apply({ seat: 0, pl: 0, from: cjAt(0, 0), to: cjAt(7, 0), face: 4 });
  assert.equal(CJ.over.winner, 0);
  assert.equal(CJ.over.title, 'Chaturaji');
});

test('Chaturaji: the visitor may skip, and is offered the other die after the first move', () => {
  CJ.init();
  const ms = CJ.legal(0, 8, { faces: [3, 5], value: 8 });
  assert.ok(ms.some(m => m.pass));
  const horse = ms.find(m => m.face === 3);
  const r = CJ.apply(horse);
  assert.ok(r.followUp.length > 1);
  assert.ok(r.followUp.every(m => m.pass || m.face === 5));
  assert.match(CJ.followPrompt, /other die, 5/);
});

test('Chaturaji: after thirty rounds the highest score among the kings left wins', () => {
  CJ.init(); CJ.score = [7, 3, 9, 2]; CJ.alive = [true, true, false, true]; CJ.round = 30; CJ.seat = 3;
  assert.equal(CJ.passTurn(), 0);
  assert.equal(CJ.over.winner, 0); // Red scored more but is out
  CJ.init(); CJ.score = [4, 4, 1, 0]; CJ.round = 30; CJ.seat = 3; CJ.passTurn();
  assert.equal(CJ.over.winner, -1);
});

test('Chaturaji: simulated games end, and every point scored is a piece off the board', () => {
  for (const level of ['gentle', 'fair', 'sharp']) {
    rules.setLevel(level);
    for (let g = 0; g < 4; g++) {
      CJ.init(); let pl = 0, guard = 0, raised = 0;
      while (!CJ.over && guard++ < 600) {
        const r = CJ.roll(), seat = pl === 0 ? 0 : CJ.seat;
        const ms = CJ.legal(pl, r.value, r);
        if (ms.length) {
          const t = Date.now(), plan = CJ.aiPlan(1, ms);
          assert.ok(Date.now() - t < 1500);
          for (const m of plan) { assert.ok(m.pass || CJ.movesFor(seat, CJ.left, 1).some(x => x.from === m.from && x.to === m.to)); const r = CJ.apply(Object.assign({}, m, { pl, seat })); if (r.promo) raised += CJ.VAL[r.promo] - 1; }
        }
        if (!CJ.over) pl = CJ.passTurn();
        let left = 0; for (let i = 0; i < 64; i++) if (CJ.b[i]) left += CJ.VAL[CJ.b[i] & 7];
        assert.equal(left + CJ.score.reduce((a, b) => a + b, 0), 4 * 18 + raised);
      }
      assert.ok(CJ.over, 'the game ends');
    }
  }
  rules.setLevel('fair');
});

/* ---------------------------------------------------------- Seega */

const SG = rules.seega;
const sgMid = () => { SG.init(); SG.placed = [12, 12]; SG.started = true; SG.b.fill(0); };
test('Seega: pieces go down two at a time, never on the centre, and the first move fills it', () => {
  SG.init();
  const first = SG.legal(0);
  assert.equal(first.length, 24);
  assert.ok(!first.some(m => m.place === 12));
  const r = SG.apply(first[0]);
  assert.ok(r.followUp && r.followUp.every(m => m.pl === 0));
  assert.equal(SG.apply(r.followUp[0]).followUp, undefined);
  SG.init();
  let pl = 0;
  while (SG.placing()) { const r2 = SG.apply(SG.legal(pl)[0]); if (r2.followUp) SG.apply(r2.followUp[0]); pl = 1 - pl; }
  assert.equal(SG.count(0), 12); assert.equal(SG.count(1), 12);
  const ms = SG.legal(0);
  assert.ok(ms.length && ms.every(m => m.to === 12));
});

test('Seega: a piece trapped between the mover and a friend is taken; moving between two is safe', () => {
  sgMid(); SG.b[1] = 1; SG.b[2] = 2; SG.b[8] = 1; SG.b[20] = 2; SG.b[24] = 1;
  assert.deepEqual(SG.apply({ pl: 0, from: 8, to: 3 }).taken, [2]); // c1 between b1 and d1
  sgMid(); SG.b[11] = 2; SG.b[13] = 2; SG.b[17] = 1; SG.b[0] = 1; SG.b[24] = 2;
  const r = SG.apply({ pl: 0, from: 17, to: 12 });
  assert.equal(r.taken.length, 0); assert.equal(SG.b[12], 1); // safe between two enemies
});

test('Seega: after a capture the mover goes on capturing, and a boxed-in side gets a way opened', () => {
  sgMid(); SG.b[5] = 1; SG.b[7] = 2; SG.b[8] = 1; SG.b[18] = 2; SG.b[19] = 1; SG.b[0] = 2; SG.b[22] = 1;
  const r = SG.apply({ pl: 0, from: 5, to: 6 }); // takes c2; then c5 to c4 would trap d4 against e4
  assert.deepEqual(r.taken, [7]);
  assert.ok(r.followUp && r.followUp.length && r.followUp.every(m => m.cap));
  sgMid(); SG.b[0] = 2; SG.b[2] = 1; SG.b[5] = 1; SG.b[24] = 1;
  const b = SG.apply({ pl: 0, from: 2, to: 1 });
  assert.ok(b.followUp && b.followUp.every(m => m.lift !== undefined), 'the Scribe is boxed in at a1');
  SG.apply(b.followUp[0]);
  assert.ok(SG.steps(1).length > 0);
});

test('Seega: taking every enemy piece wins, and twenty quiet moves each go to the larger side', () => {
  sgMid(); SG.b[1] = 1; SG.b[2] = 2; SG.b[8] = 1;
  SG.apply({ pl: 0, from: 8, to: 3 });
  assert.equal(SG.over.winner, 0);
  sgMid(); SG.b[0] = 1; SG.b[1] = 1; SG.b[24] = 2; SG.quiet = 39;
  SG.apply({ pl: 0, from: 1, to: 2 });
  assert.equal(SG.over.winner, 0);
});

/* ---------------------------------------------------------- Tâb */

const TBG = rules.tab;
test('Tâb: throws count white sides, with none as 6, and 1, 4 and 6 throw again', () => {
  TBG.init();
  for (let k = 0; k < 200; k++) { const r = TBG.roll(); const w = r.faces.reduce((a, b) => a + b, 0); assert.equal(r.value, w || 6); }
  assert.ok(TBG.extra(null, 1) && TBG.extra(null, 4) && TBG.extra(null, 6));
  assert.ok(!TBG.extra(null, 2) && !TBG.extra(null, 3));
});

test('Tâb: only a tâb starts a piece, and pieces follow the rows round', () => {
  TBG.init();
  assert.equal(TBG.legal(0, 2).length, 0);
  const ms = TBG.legal(0, 1);
  assert.deepEqual(ms.map(m => m.from), [8]); // only the front piece has room
  assert.equal(ms[0].to, 17);
  TBG.apply(ms[0]);
  assert.deepEqual(TBG.legal(0, 3).map(m => m.to), [14]); // along the second row, to the left
  // From the end of the third row a piece may go on into the enemy row, or round the middle.
  const p = TBG.pc[8]; TBG.at[p.cell] = -1; p.cell = 2 * 9 + 8; TBG.at[p.cell] = 8;
  assert.deepEqual(TBG.walk(p, 2).map(d => d.cell).sort((a, b) => a - b), [16, 34]);
});

test('Tâb: landing on an enemy takes it; a raider waits while pieces remain at home', () => {
  TBG.init();
  const p = TBG.pc[8]; TBG.at[p.cell] = -1; p.cell = 2 * 9 + 7; p.conv = true; TBG.at[p.cell] = 8;
  const m = TBG.legal(0, 2).find(x => x.to === 35);
  assert.ok(m && m.cap); // onto the Scribe's piece on its home row
  TBG.apply(m);
  assert.equal(TBG.count(1), 8);
  assert.equal(TBG.legal(0, 2).filter(x => x.piece === 8).length, 0); // your other pieces are still at home
});

test('Tâb: games between Scribes end with one side wiped out', () => {
  for (const level of ['gentle', 'sharp']) {
    rules.setLevel(level);
    TBG.init(); let pl = 0, n = 0;
    while (!TBG.over && n++ < 5000) {
      const r = TBG.roll(), ms = TBG.legal(pl, r.value, r); let m = null;
      if (ms.length) { m = TBG.aiPlan(pl, ms)[0]; TBG.apply(m); }
      if (!TBG.over && !TBG.extra(m, r.value)) pl = 1 - pl;
    }
    assert.ok(TBG.over);
  }
  rules.setLevel('fair');
});

/* ---------------------------------------------------------- Bagh-chal */

const BC = rules.baghchal;
test('Bagh-chal: tigers on the corners, goats placed first, and goats wait until all twenty are down', () => {
  BC.setVariant('goats'); BC.init();
  assert.equal(BC.first, 0);
  assert.deepEqual([0, 4, 20, 24].map(i => BC.b[i]), [2, 2, 2, 2]);
  assert.equal(BC.legal(0).length, 21);
  assert.ok(BC.legal(0).every(m => m.place !== undefined));
  BC.setVariant('tigers'); BC.init();
  assert.equal(BC.first, 1);
  assert.ok(BC.legal(0).every(m => m.from !== undefined));
  BC.setVariant('goats');
});

test('Bagh-chal: a tiger jumps a goat along a line, but not along a diagonal that is not drawn', () => {
  BC.setVariant('goats'); BC.init(); BC.b.fill(0); BC.inHand = 0;
  BC.b[12] = 2; BC.b[13] = 1; BC.b[17] = 1; BC.b[18] = 1;
  assert.deepEqual(BC.legal(1).filter(m => m.cap).map(m => m.to).sort((a, b) => a - b), [14, 22, 24]);
  BC.b.fill(0); BC.b[7] = 2; BC.b[13] = 1; // b2 has no diagonal
  assert.equal(BC.legal(1).filter(m => m.cap).length, 0);
});

test('Bagh-chal: five goats win it for the tigers; hemmed-in tigers lose; positions may not repeat', () => {
  BC.setVariant('goats'); BC.init(); BC.b.fill(0); BC.inHand = 0; BC.taken = 4;
  BC.b[0] = 2; BC.b[1] = 1; BC.b[24] = 1;
  BC.apply({ pl: 1, from: 0, to: 2, over: 1, cap: 1 });
  assert.equal(BC.over.winner, 1);
  BC.init(); BC.b.fill(0); BC.inHand = 0;
  BC.b[0] = 2; BC.b[1] = 1; BC.b[2] = 1; BC.b[5] = 1; BC.b[10] = 1; BC.b[6] = 1; BC.b[12] = 1;
  assert.equal(BC.result(1).winner, 0);
  BC.init(); BC.b.fill(0); BC.inHand = 0; BC.b[0] = 2; BC.b[24] = 1;
  BC.apply({ pl: 0, from: 24, to: 23 }); BC.apply({ pl: 1, from: 0, to: 1 }); BC.apply({ pl: 0, from: 23, to: 24 }); BC.apply({ pl: 1, from: 1, to: 0 });
  assert.ok(!BC.legal(0).some(m => m.from === 24 && m.to === 23)); // that would bring back a position already seen
});

/* ---------------------------------------------------------- Four Seasons chess */

const FS = rules.fourseasons;
const fsPiece = (s, t, d = 0) => (s << 5) | (d << 3) | t;
const fsKings = () => { FS.init(); FS.b.fill(0); FS.b[0] = fsPiece(0, 1); FS.b[7] = fsPiece(1, 1); FS.b[63] = fsPiece(2, 1); FS.b[56] = fsPiece(3, 1); };
test('Four Seasons chess: four corner armies, Green first, then round to Red, Black and White', () => {
  FS.init();
  for (let s = 0; s < 4; s++) { let n = 0; for (const v of FS.b) if (v && (v >> 5) === s) n++; assert.equal(n, 8); }
  assert.equal(FS.first, 1); assert.equal(FS.seat, 3);
  assert.equal(FS.passTurn(), 0); assert.equal(FS.passTurn(), 1); assert.equal(FS.seat, 1);
  FS.init();
  const mine = FS.legal(0).map(m => `${m.from}-${m.to}`);
  assert.ok(mine.includes('16-24') && mine.includes('2-3') && mine.includes('9-27')); // a3 up, c1 across, the alfil b2 to d4
  assert.ok(!mine.some(m => m.startsWith('0-'))); // the king is boxed in
});

test('Four Seasons chess: the alfil leaps two diagonally, and pawns become generals at the edge', () => {
  fsKings(); FS.b[27] = fsPiece(0, 4); FS.b[36] = fsPiece(1, 5, 3);
  assert.deepEqual(FS.legal(0).filter(m => m.from === 27).map(m => m.to).sort((a, b) => a - b), [9, 13, 41, 45]); // over e5 too
  fsKings(); FS.b[51] = fsPiece(0, 5, 0); // a red pawn marching up, on d7
  const r = FS.apply({ seat: 0, pl: 0, from: 51, to: 59 });
  assert.ok(r.promo); assert.equal(FS.b[59] & 7, 6);
});

test('Four Seasons chess: you may not stay in check; a mate hands the army to the mater', () => {
  fsKings(); FS.b[16] = fsPiece(1, 2);
  assert.ok(FS.legal(0).every(m => m.from === 0 && m.to !== 8)); // the rook on a3 checks: the king must leave the a-file
  fsKings(); FS.b[48] = fsPiece(3, 5, 2); FS.b[49] = fsPiece(3, 5, 2); FS.b[25] = fsPiece(3, 3); FS.b[36] = fsPiece(1, 2);
  const m = FS.apply({ seat: 1, pl: 1, from: 36, to: 60 }); // Black's rook to e8: Green's king on a8 is boxed by its pawns
  assert.match(m.note, /Black checkmates Green/);
  assert.equal(FS.alive[3], false);
  assert.equal(FS.b[56], 0);
  assert.equal(FS.b[25] >> 5, 1); // Green's knight now serves Black
});

test('Four Seasons chess: a stalemated army leaves the board, and the last army left wins', () => {
  fsKings(); FS.b[17] = fsPiece(0, 2); FS.b[18] = fsPiece(0, 2); FS.b[40] = fsPiece(3, 5, 2);
  // Green has a king on a8 and a pawn on a6, blocked by a red pawn on a5. The rook on b3 covers b7 and b8; the rook from c3 to c7 covers a7.
  FS.b[32] = fsPiece(0, 5, 0);
  const r = FS.apply({ seat: 0, pl: 0, from: 18, to: 50 });
  assert.match(r.note, /Green is stalemated/);
  assert.ok(!FS.b[56] && !FS.b[40]);
  fsKings(); FS.alive = [true, false, false, true]; FS.b[7] = 0; FS.b[63] = 0;
  FS.b[48] = fsPiece(3, 5, 2); FS.b[49] = fsPiece(3, 5, 2); FS.b[25] = fsPiece(3, 3); FS.b[36] = fsPiece(0, 2);
  FS.apply({ seat: 0, pl: 0, from: 36, to: 60 });
  assert.equal(FS.over && FS.over.winner, 0);
});

test('Four Seasons chess: simulated games end, and every Scribe move is legal', () => {
  for (const level of ['gentle', 'fair', 'sharp']) {
    rules.setLevel(level);
    FS.init(); let pl = FS.first, n = 0;
    while (n++ < 400) {
      if (FS.result(pl) || FS.ended()) break;
      if (pl === 0) FS.seat = 0;
      for (const m of FS.aiPlan()) { assert.ok(FS.movesOf(FS.seat).some(x => x.from === m.from && x.to === m.to)); m.pl = pl; FS.apply(m); }
      if (FS.over) break;
      pl = FS.passTurn();
    }
    assert.ok(FS.over, 'the game ends');
  }
  rules.setLevel('fair');
});

/* ---------------------------------------------------------- Hounds and Jackals */

const HJ = rules.hounds;
test('Hounds and Jackals: pins enter from the bottom, one to a hole, and reach the goal exactly', () => {
  HJ.init();
  const ms = HJ.legal(0, 3);
  assert.equal(ms.length, 1); // all five waiting pins are alike
  HJ.apply(ms[0]);
  assert.deepEqual(HJ.legal(0, 3).map(m => m.to), [6]); // hole 3 is taken, so no new pin can enter
  HJ.pos[0] = [27, 0, 0, 0, 0];
  assert.ok(!HJ.legal(0, 3).some(m => m.from === 27)); // 30 would overshoot the goal
  assert.ok(HJ.legal(0, 2).some(m => m.from === 27 && m.end === 29));
});

test('Hounds and Jackals: holes 20 and 10 slide back down their lines; 15 and 25 throw again', () => {
  HJ.init(); HJ.pos[0] = [17, 7, 0, 0, 0];
  const m = HJ.legal(0, 3).find(x => x.from === 17);
  assert.equal(m.to, 20); assert.equal(m.end, 6);
  assert.equal(HJ.legal(0, 3).find(x => x.from === 7).end, 8);
  HJ.init(); HJ.pos[0] = [12, 0, 0, 0, 0];
  const g = HJ.legal(0, 3).find(x => x.from === 12); HJ.apply(g);
  assert.ok(HJ.extra(g));
  HJ.init(); HJ.pos[0] = [29, 29, 29, 29, 27];
  HJ.apply(HJ.legal(0, 2).find(x => x.from === 27));
  assert.equal(HJ.over.winner, 0);
});

/* ---------------------------------------------------------- Latrunculi */

const LT = rules.latrunculi;
const ltMid = () => { LT.init(); LT.placed = [20, 20]; LT.b.fill(0); };
test('Latrunculi: twenty counters each, placed one at a time on any empty square', () => {
  LT.init();
  assert.equal(LT.legal(0).length, 64);
  let pl = 0; while (LT.placing()) { LT.apply(LT.legal(pl)[0]); pl = 1 - pl; }
  assert.equal(LT.count(0), 20); assert.equal(LT.count(1), 20);
  assert.ok(LT.legal(0).every(m => m.from !== undefined));
});

test('Latrunculi: a counter trapped between two enemies is taken; corners need only the two beside them', () => {
  ltMid(); LT.b[10] = 1; LT.b[11] = 2; LT.b[20] = 1; LT.b[40] = 2; LT.b[50] = 1;
  const r = LT.apply({ pl: 0, from: 20, to: 12 });
  assert.deepEqual(r.taken, [11]);
  ltMid(); LT.b[0] = 2; LT.b[8] = 1; LT.b[2] = 1; LT.b[40] = 2; LT.b[50] = 1;
  assert.deepEqual(LT.apply({ pl: 0, from: 2, to: 1 }).taken, [0]);
  ltMid(); LT.b[11] = 2; LT.b[13] = 2; LT.b[20] = 1; LT.b[40] = 2; LT.b[50] = 1;
  LT.apply({ pl: 0, from: 20, to: 12 });
  assert.equal(LT.b[12], 1); // safe between two
});

test('Latrunculi: no stepping straight back, and the game ends at one counter', () => {
  ltMid(); LT.b[20] = 1; LT.b[50] = 1; LT.b[40] = 2; LT.b[44] = 2;
  LT.apply({ pl: 0, from: 20, to: 21 });
  assert.ok(!LT.legal(0).some(m => m.from === 21 && m.to === 20));
  ltMid(); LT.b[10] = 1; LT.b[11] = 2; LT.b[20] = 1; LT.b[50] = 1;
  LT.apply({ pl: 0, from: 20, to: 12 });
  assert.equal(LT.over.winner, 0); // the Scribe's last counter is gone
});

/* ---------------------------------------------------------- Patolli */

const PT = rules.patolli;
test('Patolli: five beans count their marks, all five count 10, and none means an offering', () => {
  PT.init();
  for (let k = 0; k < 200; k++) { const r = PT.roll(); const n = r.faces.reduce((a, b) => a + b, 0); assert.equal(r.value, n === 5 ? 10 : n); }
  const o = PT.legal(0, 0); assert.ok(o[0].offering);
  PT.apply(o[0]); assert.equal(PT.treasure[0], 5); assert.equal(PT.pot, 1);
});

test('Patolli: a 1 enters a marker; markers may not land on others except in the centre', () => {
  PT.init();
  assert.equal(PT.legal(0, 2).length, 0);
  const e = PT.legal(0, 1); assert.equal(e.length, 1); assert.ok(e[0].enter);
  PT.apply(e[0]);
  PT.pos[1][0] = 24; // the Scribe's marker sits on our house 50
  PT.pos[0][1] = 47;
  assert.ok(!PT.legal(0, 3).some(m => m.k === 1)); // house 50 is taken, and not a centre house
  PT.pos[1][0] = 13; // now on house 39, a centre house
  PT.pos[0][1] = 37;
  const c = PT.legal(0, 2).find(m => m.k === 1); assert.ok(c && c.cap);
  PT.apply(c);
  assert.equal(PT.pos[1][0], -1); assert.equal(PT.treasure[1], 5); assert.equal(PT.treasure[0], 7);
});

test('Patolli: dark houses cost a treasure, tips throw again, and the circuit ends by exact count', () => {
  PT.init(); PT.pos[0][0] = 1;
  const d = PT.legal(0, 3)[0]; assert.equal(PT.KIND(d.house), 'dark'); PT.apply(d);
  assert.equal(PT.treasure[0], 5);
  PT.init(); PT.pos[0][0] = 3;
  const t = PT.legal(0, 3)[0]; PT.apply(t); assert.ok(PT.extra(t));
  PT.init(); PT.pos[0][0] = 49;
  assert.equal(PT.legal(0, 3).length, 0); // 52 is past the last house
  const off = PT.legal(0, 2)[0]; assert.ok(off.off); PT.apply(off);
  assert.equal(PT.home(0), 1); assert.equal(PT.treasure[0], 7);
});

test('Patolli and Hounds and Jackals: games between Scribes end', () => {
  for (const G of [PT, HJ]) for (const level of ['gentle', 'sharp']) {
    rules.setLevel(level); G.init(); let pl = 0, n = 0;
    while (!G.over && n++ < 5000) {
      const r = G.roll(), ms = G.legal(pl, r.value, r); let m = null;
      if (ms.length) { m = G.aiPlan(pl, ms)[0]; G.apply(m); }
      if (!G.over && !(m && G.extra(m, r.value))) pl = 1 - pl;
    }
    assert.ok(G.over);
  }
  rules.setLevel('fair');
});

/* ---------------------------------------------------------- The Mansion of Happiness */

const MH = rules.mansion;
const mhMove = (pl, from, v) => { MH.pos[pl] = from; return MH.legal(pl, v, { faces: [v], value: v })[0]; };
test('Mansion of Happiness: every virtue and vice on the 1843 board is where the rules expect it', () => {
  const kind = k => Object.entries(MH.SQ).filter(([, v]) => v[1] === k).map(([n, v]) => v[0]);
  assert.equal(kind('virtue').length, 13);
  assert.deepEqual(kind('vice').sort(), ['Audacity', 'Cruelty', 'Immodesty', 'Ingratitude']);
  assert.equal(MH.SQ[6][0], 'The Water'); assert.equal(MH.SQ[9][0], 'The Inn'); assert.equal(MH.SQ[60][0], 'Seat of Expectation');
});

test('Mansion of Happiness: virtues advance six, vices send you back, the Water and the Inn carry you on', () => {
  MH.init();
  assert.equal(mhMove(0, 0, 2).to, 8); // Piety
  assert.equal(mhMove(0, 3, 4).to, 3); // Audacity at 7: back where you were
  assert.equal(mhMove(0, 0, 6).to, 10); // the Water
  assert.equal(mhMove(0, 5, 4).to, 12); // the Inn
  assert.equal(mhMove(0, 10, 1).to, 12); // Poverty (11) is not counted
});

test('Mansion of Happiness: crimes are punished, and cheats and robbers lose turns and begin again', () => {
  MH.init();
  assert.equal(mhMove(0, 12, 1).to, 19); // Temperance (13), then six more
  assert.equal(mhMove(0, 17, 1).to, 25); // Prudence (18): six on, not counting the Whipping Post (22); Immodesty there does not act again
  MH.init();
  assert.equal(mhMove(0, 10, 3).to, 6); // Passion (14): to the Water
  const c = mhMove(0, 32, 2); assert.equal(c.to, 30); assert.equal(c.jail, 1); MH.apply(c);
  assert.match(MH.skipTurn(0), /begin the game again/);
  assert.equal(MH.pos[0], 0);
  assert.equal(MH.skipTurn(0), '');
  MH.init();
  const r = mhMove(1, 56, 1); assert.equal(r.to, 50); assert.equal(r.jail, 2); MH.apply(r);
  assert.match(MH.skipTurn(1), /serves a month/); assert.match(MH.skipTurn(1), /begins again/);
});

test('Mansion of Happiness: landing on a counter sends it back; 67 needs an exact count', () => {
  MH.init(); MH.pos[1] = 5;
  const m = mhMove(0, 3, 2); MH.apply(m);
  assert.equal(MH.pos[0], 5); assert.equal(MH.pos[1], 3);
  MH.init();
  const o = mhMove(0, 65, 4); assert.equal(o.to, 60); MH.apply(o);
  const o2 = mhMove(0, 64, 6); assert.equal(o2.to, 0); // a second overshoot: begin again
  MH.init();
  MH.apply(mhMove(0, 64, 3)); assert.equal(MH.won.winner, 0);
});

/* ---------------------------------------------------------- The Checkered Game of Life */

const CL = rules.lifegame;
test('Checkered Game of Life: the 32 squares of the board, and hands that carry you on', () => {
  const sq = Object.keys(CL.SQ).map(Number);
  assert.equal(sq.length, 32);
  assert.ok(sq.every(s => ((s >> 3) + (s & 7)) % 2 === 1)); // only the pale squares are played on
  assert.equal(CL.SQ[56][0], 'Infancy'); assert.equal(CL.SQ[7][0], 'Happy Old Age'); assert.equal(CL.SQ[46][0], 'Suicide');
  CL.init(); CL.pos[0] = 56;
  const m = CL.legal(0, 2); // right from Infancy: Disgrace
  assert.deepEqual(m.map(x => x.to), [58]);
  CL.pos[0] = 58;
  const s = CL.legal(0, 3).find(x => x.via === 49); // diagonally onto School, which leads to College
  assert.ok(s.hand); assert.equal(s.to, 44);
});

test('Checkered Game of Life: points, Jail, Prison, Speculation and the hundred', () => {
  CL.init(); CL.pos[0] = 58;
  CL.apply(CL.legal(0, 3).find(x => x.via === 49));
  assert.equal(CL.score[0], 5); // College
  CL.pos[1] = 26; CL.pos[0] = 44; // the Scribe stands on Honor; College is two squares diagonally away
  CL.apply(CL.legal(0, 6).find(x => x.to === 26));
  assert.equal(CL.pos[1], 60); // sent back to Jail
  CL.pos[0] = 53; CL.apply(CL.legal(0, 3).find(x => x.to === 62));
  assert.match(CL.skipTurn(0), /Prison/); assert.equal(CL.skipTurn(0), '');
  CL.pos[0] = 30; assert.equal(CL.legal(0, 6)[0].to, 1); assert.equal(CL.legal(0, 2)[0].to, 39);
  CL.init(); CL.score[0] = 95; CL.pos[0] = 15;
  CL.apply({ pl: 0, from: 15, via: 7, to: 7, hand: false });
  assert.equal(CL.over.winner, 0);
});

/* ---------------------------------------------------------- Jungle (Dou Shou Qi) */

const JU = rules.jungle;
const juEmpty = () => { JU.init(); JU.b.fill(0); JU.seen.clear(); JU.trail = []; };
test('Jungle: the opening array, the rivers and the dens', () => {
  JU.init();
  assert.equal(JU.count(0), 8); assert.equal(JU.count(1), 8);
  assert.equal(JU.b[6], 7); assert.equal(JU.b[0], 6); // your lion on the right, tiger on the left
  assert.equal(JU.b[14], 8); assert.equal(JU.b[42], 11); // your elephant faces the Scribe's rat
  assert.equal(JU.WATER.filter(Boolean).length, 12);
  assert.equal(JU.legal(0).length, 24);
  juEmpty(); JU.b[10] = 3; JU.b[56] = 13; // a dog beside its own den may not step in
  assert.ok(!JU.legal(0).some(m => m.to === 3));
});

test('Jungle: rank, the rat and the elephant, and traps', () => {
  juEmpty(); JU.b[8] = 8; JU.b[9] = 11; // elephant beside an enemy rat on land
  assert.ok(!JU.legal(0).some(m => m.to === 9));
  assert.ok(JU.legal(1).some(m => m.from === 9 && m.to === 8)); // the rat takes the elephant
  juEmpty(); JU.b[7] = 3; JU.b[8] = 14; // a dog cannot take a wolf...
  assert.ok(!JU.legal(0).some(m => m.to === 8));
  juEmpty(); JU.b[9] = 2; JU.b[10] = 18; // ...but a cat takes an elephant standing in your trap
  assert.ok(JU.legal(0).some(m => m.from === 9 && m.to === 10));
});

test('Jungle: only the rat swims, and it cannot take while entering or leaving', () => {
  juEmpty(); JU.b[21] = 1; JU.b[22] = 0; JU.b[35] = 4;
  assert.ok(JU.legal(0).some(m => m.from === 21 && m.to === 22)); // the rat swims
  JU.b[21] = 4; assert.ok(!JU.legal(0).some(m => m.from === 21 && m.to === 22)); // a wolf cannot
  juEmpty(); JU.b[21] = 1; JU.b[22] = 11; // an enemy rat in the water cannot be taken from the bank
  assert.ok(!JU.legal(0).some(m => m.to === 22));
  JU.b[23] = 1; JU.b[21] = 0; JU.b[22] = 0; JU.b[30] = 11; JU.b[29] = 1; // both rats in the water: one may take the other
  assert.ok(JU.legal(0).some(m => m.from === 29 && m.to === 30));
});

test('Jungle: the lion and tiger leap the rivers unless a rat blocks them', () => {
  juEmpty(); JU.b[15] = 7; // lion below the left river
  assert.ok(JU.legal(0).some(m => m.from === 15 && m.to === 43 && m.leap));
  JU.b[29] = 11; assert.ok(!JU.legal(0).some(m => m.from === 15 && m.to === 43));
  juEmpty(); JU.b[28] = 6; // tiger on the bank leaps sideways too
  assert.ok(JU.legal(0).some(m => m.from === 28 && m.to === 31 && m.leap));
  juEmpty(); JU.b[15] = 5; assert.ok(!JU.legal(0).some(m => m.from === 15 && m.to !== 8 && m.to !== 14 && m.to !== 16)); // a leopard cannot
});

test('Jungle: entering the den wins, and the Scribe takes a free den', () => {
  juEmpty(); JU.b[52] = 2; JU.b[0] = 18;
  JU.apply({ pl: 0, from: 52, to: 59 });
  assert.equal(JU.result(1).winner, 0);
  juEmpty(); JU.b[10] = 12; JU.b[62] = 8; JU.b[46] = 3;
  const plan = JU.aiPlan(1, 2);
  assert.equal(plan[0].to, 3);
});

/* ---------------------------------------------------------- Chaturanga (reconstruction) */

const CRG = rules.chaturanga;
test('Chaturanga: plays by shatranj rules under Sanskrit names, and says it is a reconstruction', () => {
  CRG.init(); rules.shatranj.init();
  assert.deepEqual(CRG.b, rules.shatranj.b);
  assert.equal(CRG.legal(0).length, rules.shatranj.legal(0).length);
  assert.match(CRG.rules[0], /modern reconstruction/);
  assert.equal(CRG.pieceName(CRG.SH.E), 'gaja');
  const e = CRG.legal(0).find(m => CRG.type(CRG.b[m.from]) === CRG.SH.E);
  assert.equal(Math.abs((e.to >> 3) - (e.from >> 3)), 2); // the gaja leaps two squares diagonally
  CRG.b.fill(0); CRG.b[0] = CRG.SH.K; CRG.b[2] = CRG.SH.R; CRG.b[63] = CRG.SH.K + 8;
  assert.match(CRG.result(1).text, /raja is bare/);
});

/* ---------------------------------------------------------- Whist */

const WS = rules.whist;
const wsDeck = () => Array.from({ length: 52 }, (_, i) => i);
test('Whist: the deal, the turned trump and the first lead', () => {
  WS.init(wsDeck());
  assert.equal(WS.dealer, 3); assert.equal(WS.toMove, 0);
  assert.ok(WS.hands.every(h => h.length === 13));
  assert.equal(WS.turnUp, 51); assert.ok(WS.hands[3].includes(51)); assert.equal(WS.trump, 3); // the dealer's last card: clubs
  assert.equal(WS.legal(0).length, 13); assert.equal(WS.legal(1).length, 0);
});

test('Whist: follow suit, trumps win, and the winner leads', () => {
  WS.init(wsDeck());
  WS.hands = [[1, 14], [2, 40], [3, 30], [27, 44]]; WS.toMove = 0; WS.trump = 3;
  WS.apply({ seat: 0, card: 1, kind: 'play' }); // a two of spades
  assert.deepEqual(WS.legalCards(WS.hands[1]), [2]); // West must follow
  WS.apply({ seat: 1, card: 2, kind: 'play' }); WS.apply({ seat: 2, card: 3, kind: 'play' });
  assert.deepEqual(WS.legalCards(WS.hands[3]).sort(), [27, 44]); // East has no spade
  const res = WS.apply({ seat: 3, card: 44, kind: 'play' }); // and trumps with a club
  assert.equal(WS.lastTrick.winner, 3); assert.equal(WS.toMove, 3); assert.deepEqual(WS.tricks, [0, 1]);
  assert.match(res.note, /East takes the trick/);
});

test('Whist: odd tricks, honours and the side at four', () => {
  WS.init(wsDeck());
  WS.tricks = [9, 4]; WS.honours = [0, 4]; WS.start = [0, 0]; WS.score = [0, 0];
  const notes = []; WS.endHand(notes);
  assert.deepEqual(WS.score, [3, 4]); assert.equal(WS.need, 'next');
  WS.tricks = [5, 8]; WS.honours = [3, 0]; WS.start = [4, 1]; WS.score = [4, 1];
  WS.endHand([]); // the side at four cannot score its honours
  assert.deepEqual(WS.score, [4, 3]);
  WS.tricks = [8, 5]; WS.honours = [0, 4]; WS.start = [4, 3]; WS.score = [4, 3];
  WS.endHand([]); // tricks score first, so you reach five before their honours
  assert.equal(WS.over.winner, 0); assert.deepEqual(WS.score, [6, 3]);
});

test('Whist: every Scribe plays a legal card through a whole game', () => {
  rules.setLevel('fair'); WS.init();
  let n = 0;
  while (!WS.over && n++ < 2000) {
    if (WS.need === 'next') { WS.apply({ pl: 0, kind: 'next' }); WS.passTurn(); continue; }
    const s = WS.toMove, [m] = WS.aiPlan();
    assert.ok(WS.legalCards(WS.hands[s]).includes(m.card));
    WS.apply(m); WS.passTurn();
  }
  assert.ok(WS.over && WS.score[WS.over.winner] >= 5);
});

/* ---------------------------------------------------------- Rithmomachia (reconstruction) */

const RM = rules.rithmo;
const rmEmpty = () => { RM.init(); RM.b.fill(null); };
test('Rithmomachia: Boissière\'s array, and moves of one, two and three', () => {
  RM.init();
  assert.equal(RM.count(0), 24); assert.equal(RM.count(1), 24);
  const sum = pl => RM.b.reduce((n, p) => n + (p && p.pl === pl ? 1 : 0), 0);
  assert.equal(sum(0), 24);
  assert.equal(RM.b[9].shape, 'p'); assert.equal(RM.b[9].v, 91); assert.equal(RM.b[112].v, 190);
  rmEmpty(); RM.b[60] = { pl: 0, shape: 't', v: 6 };
  assert.deepEqual(RM.legal(0).map(m => m.to).sort((a, b) => a - b), [44, 58, 62, 76]); // a triangle moves exactly two
  RM.b[52] = { pl: 1, shape: 'c', v: 3 }; // and cannot pass over a piece
  assert.ok(!RM.legal(0).some(m => m.to === 44));
});

test('Rithmomachia: meeting, assault, ambuscade and siege', () => {
  rmEmpty(); RM.b[60] = { pl: 0, shape: 'c', v: 9 }; RM.b[68] = { pl: 1, shape: 'c', v: 9 }; RM.b[0] = { pl: 0, shape: 'p', v: 91 }; RM.b[127] = { pl: 1, shape: 'p', v: 190 };
  const meet = RM.legal(0).find(m => m.to === 68); assert.ok(meet.meet);
  RM.apply(meet); assert.equal(RM.taken[0], 1); assert.equal(RM.b[68].pl, 0);
  rmEmpty(); RM.b[0] = { pl: 0, shape: 'p', v: 91 }; RM.b[127] = { pl: 1, shape: 'p', v: 190 };
  RM.b[3] = { pl: 0, shape: 'c', v: 4 }; RM.b[35] = { pl: 1, shape: 't', v: 12 }; // 4 times three empty squares makes 12
  assert.deepEqual(RM.caught(0).map(x => x[1]), ['assault']);
  rmEmpty(); RM.b[0] = { pl: 0, shape: 'p', v: 91 }; RM.b[127] = { pl: 1, shape: 'p', v: 190 };
  RM.b[42] = { pl: 0, shape: 'c', v: 9 }; RM.b[44] = { pl: 0, shape: 'c', v: 16 }; RM.b[43] = { pl: 1, shape: 'c', v: 25 };
  assert.deepEqual(RM.caught(0).map(x => x[1]), ['ambuscade']);
  rmEmpty(); RM.b[127] = { pl: 0, shape: 'p', v: 91 }; RM.b[0] = { pl: 1, shape: 'c', v: 7 }; RM.b[1] = { pl: 0, shape: 'c', v: 2 }; RM.b[8] = { pl: 0, shape: 'c', v: 8 };
  assert.deepEqual(RM.caught(0), [[0, 'siege']]); // in the corner, closed by two pieces and two edges
});

test('Rithmomachia: taking the pyramid wins at once', () => {
  rmEmpty(); RM.b[0] = { pl: 0, shape: 'p', v: 91 }; RM.b[64] = { pl: 0, shape: 'c', v: 25 }; RM.b[74] = { pl: 0, shape: 'c', v: 165 }; RM.b[127] = { pl: 1, shape: 'p', v: 190 };
  RM.b[73] = { pl: 1, shape: 'p', v: 190 }; RM.b[127] = null;
  RM.apply({ pl: 0, from: 64, to: 72 }); // 25 and 165 now flank the 190
  assert.equal(RM.result(1).winner, 0);
});

/* ---------------------------------------------------------- Medieval chess (Lewis chessmen) */

const LW = rules.lewischess;
test('Medieval chess: shatranj moves under European names, and only checkmate wins', () => {
  LW.init();
  rules.shatranj.init(); assert.equal(LW.legal(0).length, rules.shatranj.legal(0).length);
  assert.match(LW.rules[0], /modern reconstruction/);
  assert.equal(LW.pieceName(LW.SH.F), 'queen'); assert.equal(LW.pieceName(LW.SH.E), 'bishop');
  LW.b.fill(0); LW.b[0] = LW.SH.K; LW.b[2] = LW.SH.R; LW.b[63] = LW.SH.K + 8; // a bare king is no longer a loss
  assert.equal(LW.result(1), null);
  LW.b.fill(0); LW.b[56] = LW.SH.K + 8; LW.b[41] = LW.SH.K; LW.b[50] = LW.SH.F; // the Scribe's king in the corner, stalemated
  assert.equal(LW.result(1).winner, -1);
});

/* ---------------------------------------------------------- Courier chess */

const CO = rules.courier;
test('Courier chess: twelve files, the opening leaps made, and the new pieces', () => {
  CO.init(); const P = CO.CO;
  assert.equal(CO.b.length, 96); assert.equal(CO.material(0), 23);
  assert.equal(CO.b[5], P.K); assert.equal(CO.b[30], P.F); assert.equal(CO.b[36], P.P); assert.equal(CO.b[47], P.P); // king f1, queen g3, pawns a4 and l4
  assert.equal(CO.b[66], P.F + 16); assert.equal(CO.b[48], P.P + 16);
  CO.b.fill(0); CO.b[0] = P.K; CO.b[95] = P.K + 16;
  CO.b[40] = P.C; assert.equal(CO.legal(0).filter(m => m.from === 40).length, 4 + 4 + 3 + 3); // the courier slides diagonally
  CO.b[40] = P.S; assert.equal(CO.legal(0).filter(m => m.from === 40).length, 4); // the schleich steps straight
  CO.b[40] = P.M; assert.equal(CO.legal(0).filter(m => m.from === 40).length, 8); // the sage steps like a king
});

test('Courier chess: check, mate and promotion', () => {
  CO.init(); const P = CO.CO;
  CO.b.fill(0); CO.b[0] = P.K; CO.b[95] = P.K + 16; CO.b[84] = P.R; CO.b[72] = P.R; // two rooks mate on the back rank
  assert.equal(CO.result(1).winner, 0);
  CO.b.fill(0); CO.b[0] = P.K; CO.b[95] = P.K + 16; CO.b[78] = P.P;
  const pr = CO.legal(0).find(m => m.from === 78); assert.ok(pr.promo);
  CO.apply(pr); assert.equal(CO.b[90], P.F);
});

/* ---------------------------------------------------------- Hazard */

const HZ = rules.hazard;
test('Hazard: nicks, outs and the chance', () => {
  for (const [main, v, nick, out] of [[7, 7, true, false], [7, 11, true, false], [7, 12, false, true], [6, 12, true, false], [8, 11, false, true], [5, 12, false, true], [9, 3, false, true], [5, 6, false, false]]) {
    assert.equal(HZ.nick(main, v), nick, `${main}/${v}`); assert.equal(HZ.out(main, v), out, `${main}/${v}`);
  }
  HZ.init();
  assert.deepEqual(HZ.preThrow(0).map(m => m.n), [1, 2, 5]);
  HZ.apply({ pl: 0, kind: 'stake', n: 2 }); HZ.apply({ pl: 0, kind: 'main', n: 7 });
  HZ.apply({ pl: 0, kind: 'throw', value: 6 }); assert.ok(HZ.extra()); assert.equal(HZ.chance, 6);
  HZ.apply({ pl: 0, kind: 'throw', value: 4 }); assert.ok(HZ.extra());
  HZ.apply({ pl: 0, kind: 'throw', value: 6 }); assert.ok(!HZ.extra());
  assert.deepEqual(HZ.purse, [12, 8]);
});

test('Hazard: the dice pass after three losses running', () => {
  HZ.init();
  for (let k = 0; k < 3; k++) { HZ.apply({ pl: 0, kind: 'stake', n: 1 }); HZ.apply({ pl: 0, kind: 'main', n: 7 }); HZ.apply({ pl: 0, kind: 'throw', value: 2 }); }
  assert.equal(HZ.caster, 1); assert.deepEqual(HZ.purse, [7, 13]); assert.equal(HZ.passTurn(), 1);
});

/* ---------------------------------------------------------- Piquet */

const PQ = rules.piquet;
const pq = (r, su) => su * 13 + r; // rank 0 is the ace
test('Piquet: declarations of point, sequence and sets', () => {
  const d = PQ_DECLARE([pq(0, 0), pq(12, 0), pq(11, 0), pq(10, 0), pq(9, 0), pq(0, 1), pq(0, 2), pq(0, 3), pq(12, 1), pq(12, 2), pq(7, 3), pq(6, 3)]);
  assert.equal(d.point.len, 5); assert.equal(d.seqs[0].len, 5); assert.equal(d.sets[0].n, 4); assert.equal(d.sets[1].n, 3);
  assert.ok(!d.blanche);
});
const PQ_DECLARE = h => rules.piquet.declareHand(h);

test('Piquet: exchange, scoring the deal, and a full partie between Scribes', () => {
  rules.setLevel('fair'); PQ.setVariant('2'); PQ.init();
  assert.equal(PQ.hands[0].length, 12); assert.equal(PQ.talon.length, 8); assert.equal(PQ.elder, 0);
  PQ.apply({ pl: 0, kind: 'mark', c: PQ.hands[0][0] }); assert.equal(PQ.legal(0).filter(m => m.kind === 'exchange').length, 1);
  let n = 0;
  while (!PQ.over && n++ < 500) {
    const pl = PQ.toMove;
    if (PQ.stage === 'next') { PQ.apply({ pl, kind: 'next' }); continue; }
    for (const m of PQ.aiPlan(pl)) { if (m.kind === 'play') assert.ok(PQ.legalCards(pl).includes(m.c)); PQ.apply(m); }
  }
  assert.ok(PQ.over); assert.equal(PQ.deals, 2);
  PQ.setVariant('6');
});

/* ---------------------------------------------------------- Saved games
 * The hall saves an engine's plain data fields as JSON and restores them over a
 * fresh init(). Every game that offers saving must come back exactly. */

const SAVED = ['chess', 'xiangqi', 'janggi', 'makruk', 'shatranj', 'chaturanga', 'lewischess', 'courier', 'rithmo', 'whist', 'piquet', 'draughts', 'tablut', 'halma', 'reversi'];
const dataFields = g => {
  const out = {}, d = Object.getOwnPropertyDescriptors(g);
  for (const k of Object.keys(d)) if ('value' in d[k] && typeof d[k].value !== 'function' && !['rules', 'source', 'surface'].includes(k)) out[k] = d[k].value;
  return JSON.parse(JSON.stringify(out));
};
test('Saved games: every saveable engine restores to the same position and moves', () => {
  rules.setLevel('gentle');
  for (const id of SAVED) {
    const g = rules[id]; g.init();
    let pl = g.first;
    for (let k = 0; k < 6; k++) { // a few plies by the Scribe for both sides
      if (g.stage === 'next' || g.need === 'next') { g.apply({ pl: 0, kind: 'next' }); }
      const who = g.toMove !== undefined ? (g.toMove === 0 ? 0 : 1) : pl;
      const plan = g.aiPlan(who); if (!plan || !plan.length) break;
      for (const m of plan) g.apply(m);
      pl = g.passTurn ? g.passTurn() : 1 - pl;
    }
    const saved = dataFields(g), before = JSON.stringify(g.legal(pl));
    g.init(); Object.assign(g, saved);
    assert.equal(JSON.stringify(g.legal(pl)), before, id);
  }
});
