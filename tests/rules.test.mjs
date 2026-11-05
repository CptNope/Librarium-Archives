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
