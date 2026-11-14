/*
 * Librarium Archives: game rules.
 *
 * Pure rule engines with no rendering code, so they can be tested in Node
 * (npm test) and reused by any front end. Each game keeps its state in
 * `pos[player][piece]`; player 0 is the visitor, player 1 is the Scribe.
 *
 *   Royal Game of Ur: positions 0 (waiting) .. 14 (on board), 15 (borne off).
 *     Squares 5-12 are the shared middle row; rosettes at 4, 8 and 14.
 *   Senet: positions are houses 1..30, 31 means borne off.
 */
(function (root) {
  'use strict';

  /* How hard the Scribe plays: 'gentle', 'fair' (default) or 'sharp'.
   * Strategy games search deeper or shallower; race games add or remove luck. */
  const LEVEL = { name: 'fair' };
  const LEVELS = ['gentle', 'fair', 'sharp'];
  function setLevel(name) { if (LEVELS.includes(name)) LEVEL.name = name; return LEVEL.name; }
  const pick = (gentle, fair, sharp) => (LEVEL.name === 'gentle' ? gentle : LEVEL.name === 'sharp' ? sharp : fair);
  // Gentle play sometimes just picks any legal move.
  const wander = moves => (LEVEL.name === 'gentle' && Math.random() < 0.45 ? moves[(Math.random() * moves.length) | 0] : null);
  const DICE_P = [1, 4, 6, 4, 1].map(v => v / 16);
  const UR = {
    id: 'ur', name: 'The Royal Game of Ur', N: 7, sides: ['shell', 'lapis'],
    rules: [
      'Throw the four dice and count the marked tips facing up, from 0 to 4.',
      'Enter a new piece or move one already on the board by that many squares. Your route runs along your own row, up the shared middle row, and back into your row.',
      'Land on an opponent in the middle row to send it back to the start.',
      'Landing on a rosette earns another throw. The middle rosette is a safe square.',
      'Bear a piece off with an exact throw. The first to bear off all seven wins.'
    ],
    source: 'Rules after Irving Finkel\'s translation of a Babylonian tablet from about 177 BCE.',
    init() { this.pos = [Array(7).fill(0), Array(7).fill(0)]; },
    roll() { const f = [0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0)); return { faces: f, value: f.reduce((a, b) => a + b, 0) }; },
    rosette: p => p === 4 || p === 8 || p === 14,
    shared: p => p >= 5 && p <= 12,
    at(pl, p) { return this.pos[pl].indexOf(p); },
    legal(pl, r) {
      if (r === 0) return [];
      const moves = []; let entered = false;
      this.pos[pl].forEach((p, i) => {
        if (p === 15) return;
        if (p === 0) { if (entered) return; entered = true; }
        const t = p + r; if (t > 15) return;
        if (t < 15 && this.at(pl, t) >= 0) return;
        let cap = -1;
        if (this.shared(t)) { const o = this.at(1 - pl, t); if (o >= 0) { if (t === 8) return; cap = o; } }
        moves.push({ pl, i, from: p, to: t, cap });
      });
      return moves;
    },
    steps(m) { const s = []; for (let p = m.from + 1; p <= m.to; p++) s.push(p); return s; },
    apply(m) {
      this.pos[m.pl][m.i] = m.to;
      const moved = [];
      let note = '';
      if (m.cap >= 0) { this.pos[1 - m.pl][m.cap] = 0; moved.push({ pl: 1 - m.pl, i: m.cap }); note = m.pl === 0 ? 'Captured. The Scribe\'s piece goes back to the start.' : 'The Scribe captured your piece. It goes back to the start.'; }
      else if (m.to === 15) note = m.pl === 0 ? 'Borne off.' : 'The Scribe bears a piece off.';
      return { moved, note };
    },
    extra(m) { return this.rosette(m.to); },
    extraNote: 'Rosette. Throw again.',
    done(pl) { return this.pos[pl].every(p => p === 15); },
    home(pl) { return this.pos[pl].filter(p => p === 15).length; },
    threat(opp, sq) {
      if (!this.shared(sq) || sq === 8) return 0;
      let p = 0; const seen = new Set();
      this.pos[opp].forEach(q => { const d = sq - q; if (q >= 1 && d >= 1 && d <= 4 && !seen.has(d)) { seen.add(d); p += DICE_P[d]; } });
      return Math.min(1, p);
    },
    ai(moves) {
      const w = wander(moves); if (w) return w;
      let best = moves[0], bs = -1e9;
      for (const m of moves) {
        const opp = 1 - m.pl; let s = 0;
        if (m.to === 15) s += 55;
        if (m.cap >= 0) s += 45 + m.to * 1.5;
        if (this.rosette(m.to)) s += m.to === 8 ? 40 : 28;
        s -= this.threat(opp, m.to) * 42;
        s += this.threat(opp, m.from) * 30;
        if (m.from === 8) s -= 12;
        if (m.from === 0) s += 8;
        s += m.to * 0.6 + Math.random() * pick(8, 3, 0.5);
        if (s > bs) { bs = s; best = m; }
      }
      return best;
    },
  };

  const SENET = {
    id: 'senet', name: 'Senet', N: 5, sides: ['spools', 'cones'],
    rules: [
      'Throw four sticks and count the white sides. No white sides counts as 5.',
      'A throw of 1, 4 or 5 earns another throw. A 2 or 3 ends your turn.',
      'Land on a lone opponent to swap places with it. Two pieces side by side guard each other, and three in a row form a wall that cannot be passed.',
      'Every piece must stop exactly on house 26, the House of Happiness. From there a 1 drops it into the House of Water, which washes it back to house 15. A 2, 3 or 4 moves it to the last houses, and a 5 bears it off.',
      'Pieces on houses 28, 29 and 30 leave with an exact 3, 2 or 1.',
      'The first to bear off all five pieces wins.'
    ],
    source: 'A modern reconstruction after Timothy Kendall (1979). The ancient rules were never written down.',
    init() { this.pos = [[1, 3, 5, 7, 9], [2, 4, 6, 8, 10]]; },
    roll() { const f = [0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0)); const w = f.reduce((a, b) => a + b, 0); return { faces: f, value: w || 5 }; },
    occ(sq) { for (const pl of [0, 1]) { const i = this.pos[pl].indexOf(sq); if (i >= 0) return { pl, i }; } return null; },
    legal(pl, r) {
      const opp = 1 - pl, moves = [];
      const isOpp = s => { const o = this.occ(s); return !!o && o.pl === opp; };
      this.pos[pl].forEach((p, i) => {
        if (p === 31) return;
        if (p >= 28) { if (r === 31 - p) moves.push({ pl, i, from: p, to: 31 }); return; }
        let t;
        if (p === 26) t = r === 5 ? 31 : 26 + r;
        else {
          t = p + r; if (t > 26) return;
          for (let s = p + 1; s < t; s++) if (isOpp(s) && isOpp(s + 1) && isOpp(s + 2)) return;
        }
        if (t === 31) { moves.push({ pl, i, from: p, to: 31 }); return; }
        if (t === 27) { moves.push({ pl, i, from: p, to: 27, water: true }); return; }
        const o = this.occ(t);
        if (o) {
          if (o.pl === pl) return;
          if (t === 26 || t === 28 || t === 29) return;
          if (isOpp(t - 1) || isOpp(t + 1)) return;
          moves.push({ pl, i, from: p, to: t, swap: o.i }); return;
        }
        moves.push({ pl, i, from: p, to: t });
      });
      return moves;
    },
    steps(m) {
      if (m.from >= 26) return [m.to];
      const s = []; for (let p = m.from + 1; p <= m.to; p++) s.push(p); return s;
    },
    apply(m) {
      const moved = []; let note = '';
      if (m.swap != null) {
        this.pos[1 - m.pl][m.swap] = m.from; moved.push({ pl: 1 - m.pl, i: m.swap });
        note = m.pl === 0 ? 'You swap places with the Scribe\'s piece.' : 'The Scribe swaps places with your piece.';
      }
      if (m.water) {
        let d = 15; while (d >= 1 && this.occ(d)) d--;
        if (d < 1) { d = 16; while (this.occ(d)) d++; }
        this.pos[m.pl][m.i] = 27;
        m.washTo = d;
        this.pos[m.pl][m.i] = d; moved.push({ pl: m.pl, i: m.i });
        note = 'The House of Water. The piece is washed back to house ' + d + '.';
      } else {
        this.pos[m.pl][m.i] = m.to;
        if (m.to === 31) note = m.pl === 0 ? 'Borne off.' : 'The Scribe bears a piece off.';
        else if (m.to === 26 && !note) note = 'The House of Happiness.';
      }
      return { moved, note };
    },
    extra(m, roll) { return roll === 1 || roll === 4 || roll === 5; },
    extraNote: 'A throw of 1, 4 or 5. Throw again.',
    done(pl) { return this.pos[pl].every(p => p === 31); },
    home(pl) { return this.pos[pl].filter(p => p === 31).length; },
    ai(moves) {
      const w = wander(moves); if (w) return w;
      let best = moves[0], bs = -1e9;
      for (const m of moves) {
        const pl = m.pl; let s = 0;
        const mine = sq => { const o = this.occ(sq); return o && o.pl === pl && !(o.i === m.i); };
        if (m.to === 31) s += 60;
        if (m.water) s -= 70;
        if (m.to === 26) s += 30;
        if (m.swap != null) s += 20 + (m.to - m.from) * 3;
        if (!m.water && m.to <= 30 && (mine(m.to - 1) || mine(m.to + 1))) s += 10;
        if (m.from < 26 && (mine(m.from - 1) || mine(m.from + 1))) s -= 5;
        if (m.to >= 28 && m.to <= 30) s += 12;
        s += (m.to === 31 ? 30 : m.water ? 0 : m.to) * 0.5 + Math.random() * pick(8, 3, 0.5);
        if (s > bs) { bs = s; best = m; }
      }
      return best;
    },
  };

  // Race games roll dice and pick one move; mark them so the table shows a Throw button.
  UR.dice = SENET.dice = true;
  UR.first = SENET.first = 0;
  UR.aiPlan = function (pl, moves) { return [this.ai(moves)]; };
  SENET.aiPlan = UR.aiPlan;

  /* Shared negamax search for the strategy games. Each game supplies
   * snapshot/restore, turns(pl) (a list of move sequences), terminal(pl, depth)
   * and evaluate(pl). */
  let deadline = Infinity, nodes = 0;
  const OUT_OF_TIME = { outOfTime: true };
  function negamax(G, pl, depth, alpha, beta) {
    if ((++nodes & 127) === 0 && Date.now() > deadline) throw OUT_OF_TIME;
    const t = G.terminal(pl, depth);
    if (t !== null) return t;
    if (depth === 0) return G.noisy && quiet ? quiesce(G, pl, alpha, beta, G.noisyDepth || 4) : G.evaluate(pl);
    let best = -Infinity;
    for (const seq of G.turns(pl)) {
      const s = G.snapshot();
      for (const m of seq) G.apply(m);
      const v = -negamax(G, 1 - pl, depth - 1, -beta, -alpha);
      G.restore(s);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  // At the end of the search, an engine that names its captures (noisy) plays them out, so the Scribe does not
  // stop counting in the middle of an exchange. Each side may also stand pat on the position as it is.
  let quiet = true;
  function quiesce(G, pl, alpha, beta, q) {
    if (Date.now() > deadline) throw OUT_OF_TIME; // these nodes are dear (every one lists moves), so the clock is read at each
    const t = G.terminal(pl, 0); if (t !== null) return t;
    const stand = G.evaluate(pl);
    if (q === 0 || stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    for (const seq of G.noisy(pl)) {
      const s = G.snapshot();
      for (const m of seq) G.apply(m);
      const v = -quiesce(G, 1 - pl, -beta, -alpha, q - 1);
      G.restore(s);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function searchAt(G, pl, depth, first) {
    let best = null, bv = -Infinity;
    const turns = G.turns(pl);
    if (first) { // try the previous depth's choice first; it is usually still best
      const key = JSON.stringify(first), i = turns.findIndex(t => JSON.stringify(t) === key);
      if (i > 0) turns.unshift(turns.splice(i, 1)[0]);
    }
    for (const seq of turns) {
      const s = G.snapshot();
      for (const m of seq) G.apply(m);
      const v = -negamax(G, 1 - pl, depth - 1, -Infinity, Infinity) + Math.random() * pick(6, 0.6, 0.05);
      G.restore(s);
      if (best === null || v > bv) { bv = v; best = seq; } // even when every move loses, pick one
    }
    return best;
  }
  /* With a fixed depth (tests), search exactly that deep. Otherwise deepen one
   * ply at a time until the level's thinking budget would run out, so the
   * Scribe plays as well as the visitor's device allows without stalling. */
  const BUDGET_MS = { gentle: 120, fair: 600, sharp: 1500 };
  function bestPlan(G, pl, depth, maxDepth) {
    if (depth) return searchAt(G, pl, depth);
    const t0 = Date.now(), budget = BUDGET_MS[LEVEL.name], cap = pick(2, maxDepth, maxDepth + 2);
    const root = G.snapshot();
    quiet = false; // the first, one-move look always finishes: it plays out no captures, so it cannot run long
    let best;
    try { best = searchAt(G, pl, 1); } finally { quiet = true; }
    deadline = t0 + budget;
    try {
      for (let d = 2; d <= cap; d++) {
        if ((Date.now() - t0) * 3 > budget) break; // the next ply usually costs several times more
        best = searchAt(G, pl, d, best);
      }
    } catch (e) {
      if (e !== OUT_OF_TIME) throw e;
      G.restore(root); // an interrupted search leaves moves applied; put the board back
    } finally { deadline = Infinity; }
    return best;
  }

