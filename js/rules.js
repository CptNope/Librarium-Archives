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
    if (depth === 0) return G.evaluate(pl);
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
    let best = searchAt(G, pl, 1);
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

  /* --------------------------------------------------------- Nine Men's Morris
   * 24 points on three nested squares. Each ring is numbered clockwise from its
   * top-left corner: 0 TL, 1 top, 2 TR, 3 right, 4 BR, 5 bottom, 6 BL, 7 left;
   * ring r adds 8*r (0 outer, 1 middle, 2 inner). */
  const MORRIS_ADJ = (() => {
    const adj = Array.from({ length: 24 }, () => []);
    const link = (a, b) => { adj[a].push(b); adj[b].push(a); };
    for (let r = 0; r < 3; r++) for (let k = 0; k < 8; k++) link(r * 8 + k, r * 8 + (k + 1) % 8);
    for (const k of [1, 3, 5, 7]) { link(k, k + 8); link(k + 8, k + 16); }
    return adj;
  })();
  const MORRIS_MILLS = (() => {
    const m = [];
    for (let r = 0; r < 3; r++) for (const k of [0, 2, 4, 6]) m.push([r * 8 + k, r * 8 + k + 1, r * 8 + (k + 2) % 8]);
    for (const k of [1, 3, 5, 7]) m.push([k, k + 8, k + 16]);
    return m;
  })();
  const MORRIS = {
    id: 'morris', name: "Nine Men's Morris", dice: false, first: 0, N: 9,
    rules: [
      'Take turns placing your nine pieces on empty points.',
      'Three of your pieces in a row along a drawn line make a mill. Each new mill lets you remove one of the Scribe\'s pieces. Pieces in a mill are protected unless every piece is in one.',
      'Once every piece is placed, move one piece along a line to a neighboring empty point.',
      'When you are down to three pieces, you may fly to any empty point.',
      'You lose when you have two pieces left or cannot move. A long stretch with no captures is a draw.'
    ],
    source: 'Traditional rules, as played across Europe since the Middle Ages.',
    followPrompt: 'Pick one of the Scribe\'s pieces to remove.',
    ADJ: MORRIS_ADJ, MILLS: MORRIS_MILLS,
    init() { this.board = Array(24).fill(-1); this.hand = [this.N, this.N]; this.quiet = 0; },
    onBoard(pl) { let n = 0; for (const v of this.board) if (v === pl) n++; return n; },
    count(pl) { return this.hand[pl] + this.onBoard(pl); },
    inMill(p, pl) { return this.MILLS.some(m => m.includes(p) && m.every(q => this.board[q] === pl)); },
    legal(pl) {
      const b = this.board, out = [];
      if (this.hand[pl] > 0) { for (let p = 0; p < 24; p++) if (b[p] < 0) out.push({ type: 'place', pl, to: p }); return out; }
      const fly = this.onBoard(pl) === 3;
      for (let p = 0; p < 24; p++) {
        if (b[p] !== pl) continue;
        const targets = fly ? b.map((v, q) => (v < 0 ? q : -1)).filter(q => q >= 0) : this.ADJ[p].filter(q => b[q] < 0);
        for (const q of targets) out.push({ type: 'move', pl, from: p, to: q, fly });
      }
      return out;
    },
    removals(pl) {
      const opp = 1 - pl, pts = [];
      for (let p = 0; p < 24; p++) if (this.board[p] === opp) pts.push(p);
      const free = pts.filter(p => !this.inMill(p, opp));
      return (free.length ? free : pts).map(p => ({ type: 'remove', pl, at: p }));
    },
    apply(m) {
      const b = this.board;
      if (m.type === 'remove') {
        b[m.at] = -1; this.quiet = 0;
        return { note: m.pl === 0 ? 'You remove one of the Scribe\'s pieces.' : 'The Scribe removes one of your pieces.' };
      }
      if (m.type === 'place') { b[m.to] = m.pl; this.hand[m.pl]--; } else { b[m.from] = -1; b[m.to] = m.pl; }
      this.quiet++;
      if (this.inMill(m.to, m.pl)) {
        const f = this.removals(m.pl);
        if (f.length) return { note: m.pl === 0 ? 'A mill.' : 'The Scribe makes a mill.', followUp: f };
      }
      return { note: '' };
    },
    result(pl) {
      for (const p of [0, 1]) if (this.count(p) < 3) return { winner: 1 - p, text: p === 0 ? 'You are down to two pieces.' : 'The Scribe is down to two pieces.' };
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no legal move.' : 'The Scribe has no legal move.' };
      if (this.quiet >= 120) return { winner: -1, text: 'A long stretch with no captures. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.board.slice(), this.hand.slice(), this.quiet]; },
    restore(s) { this.board = s[0].slice(); this.hand = s[1].slice(); this.quiet = s[2]; },
    turns(pl) {
      const out = [];
      for (const m of this.legal(pl)) {
        const s = this.snapshot(); const r = this.apply(m); this.restore(s);
        if (r.followUp) for (const f of r.followUp) out.push([m, f]); else out.push([m]);
      }
      // Mills and blocks first, so alpha-beta prunes more.
      return out.sort((a, b) => b.length - a.length);
    },
    terminal(pl, depth) {
      const r = this.result(pl);
      if (!r) return null;
      return r.winner === -1 ? 0 : r.winner === pl ? 1000 + depth : -1000 - depth;
    },
    evaluate(pl) {
      const opp = 1 - pl;
      let s = (this.count(pl) - this.count(opp)) * 12;
      for (const mill of this.MILLS) {
        let a = 0, o = 0, e = 0;
        for (const q of mill) { const v = this.board[q]; if (v === pl) a++; else if (v === opp) o++; else e++; }
        if (a === 2 && e === 1) s += 3; if (o === 2 && e === 1) s -= 3;
        if (a === 3) s += 1; if (o === 3) s -= 1;
      }
      if (!this.hand[pl] && !this.hand[opp]) s += (this.legal(pl).length - this.legal(opp).length) * 0.4;
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

  /* --------------------------------------------------------------- Oware
   * Pits 0-5 are the visitor's row (left to right as they sit), 6-11 the
   * Scribe's row; sowing runs 0 → 11 and wraps (counterclockwise). */
  const OWARE = {
    id: 'oware', name: 'Oware', dice: false, first: 0, N: 25,
    rules: [
      'Take every seed from one of your six pits (the row nearest you) and sow them one at a time into the following pits, counterclockwise.',
      'If a pit holds 12 or more seeds, skip the pit you emptied as you go around.',
      'If your last seed lands in one of the Scribe\'s pits and makes 2 or 3, capture them, along with any unbroken run of 2s and 3s just before it on the Scribe\'s side.',
      'A move that would capture every seed on the Scribe\'s side captures nothing.',
      'If the Scribe\'s side is empty you must sow into it if you can. If you cannot, the game ends and you keep the seeds on your side.',
      'The first to capture 25 seeds wins.'
    ],
    source: 'Abapa rules, the standard form of Oware played in competitions.',
    init() { this.pits = Array(12).fill(4); this.store = [0, 0]; this.quiet = 0; this.over = null; },
    side(pl) { let n = 0; for (let i = pl * 6; i < pl * 6 + 6; i++) n += this.pits[i]; return n; },
    own(pl, i) { return (i < 6) === (pl === 0); },
    feeds(pl, i) { return this.pits[i] >= (pl === 0 ? 6 - i : 12 - i); },
    legal(pl) {
      if (this.over) return [];
      const must = this.side(1 - pl) === 0, out = [];
      for (let i = pl * 6; i < pl * 6 + 6; i++) {
        if (!this.pits[i]) continue;
        if (must && !this.feeds(pl, i)) continue;
        out.push({ pl, pit: i });
      }
      return out;
    },
    apply(m) {
      const p = this.pits; let n = p[m.pit]; p[m.pit] = 0;
      const path = []; let q = m.pit;
      while (n > 0) { q = (q + 1) % 12; if (q === m.pit) continue; p[q]++; n--; path.push(q); }
      let caps = []; let k = q;
      while (!this.own(m.pl, k) && (p[k] === 2 || p[k] === 3)) { caps.push(k); k = (k + 11) % 12; }
      let note = '';
      if (caps.length) {
        const total = caps.reduce((a, c) => a + p[c], 0);
        if (total === this.side(1 - m.pl)) { caps = []; note = 'That would take every seed on the other side, so nothing is captured.'; }
        else {
          for (const c of caps) { this.store[m.pl] += p[c]; p[c] = 0; }
          note = (m.pl === 0 ? 'You capture ' : 'The Scribe captures ') + total + ' seeds.';
        }
      }
      this.quiet = caps.length ? 0 : this.quiet + 1;
      return { path, caps, note };
    },
    result(pl) {
      if (this.over) return this.over;
      let r = null;
      if (this.store[0] >= 25) r = { winner: 0, text: 'You captured ' + this.store[0] + ' seeds.' };
      else if (this.store[1] >= 25) r = { winner: 1, text: 'The Scribe captured ' + this.store[1] + ' seeds.' };
      else if (this.store[0] === 24 && this.store[1] === 24) r = { winner: -1, text: '24 seeds each. The game is drawn.' };
      else if (!this.legal(pl).length || this.quiet >= 100) {
        if (this.quiet >= 100) { this.store[0] += this.side(0); this.store[1] += this.side(1); }
        else if (this.side(pl) === 0) this.store[1 - pl] += this.side(1 - pl);
        else this.store[pl] += this.side(pl);
        this.pits.fill(0);
        const w = this.store[0] > this.store[1] ? 0 : this.store[1] > this.store[0] ? 1 : -1;
        r = { winner: w, text: `The board is cleared. Final count: you ${this.store[0]}, the Scribe ${this.store[1]}.`, sweep: true };
      }
      if (r) this.over = r;
      return r;
    },
    snapshot() { return [this.pits.slice(), this.store.slice(), this.quiet]; },
    restore(s) { this.pits = s[0].slice(); this.store = s[1].slice(); this.quiet = s[2]; this.over = null; },
    turns(pl) { return this.legal(pl).map(m => [m]); },
    terminal(pl, depth) {
      if (this.store[pl] >= 25) return 1000 + depth;
      if (this.store[1 - pl] >= 25) return -1000 - depth;
      if (!this.legal(pl).length) {
        let a = this.store[pl], b = this.store[1 - pl];
        if (this.side(pl) === 0) b += this.side(1 - pl); else a += this.side(pl);
        return a > b ? 900 : a < b ? -900 : 0;
      }
      return null;
    },
    evaluate(pl) { return this.store[pl] - this.store[1 - pl]; },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 10); },
  };

  /* ------------------------------------------------------------- Brandubh
   * 7x7 board, index r*7+c. 0 empty, 1 attacker, 2 defender, 3 king.
   * Player 0 (the visitor) commands the king's side, player 1 the attackers. */
  const BR_THRONE = 24, BR_CORNERS = [0, 6, 42, 48];
  const BR_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const BRANDUBH = {
    id: 'brandubh', name: 'Brandubh', dice: false, first: 1,
    rules: [
      'The Scribe commands the eight attackers and moves first. You command the king and his four defenders.',
      'Every piece moves like a chess rook: any distance in a straight line, without jumping.',
      'Only the king may stop on the central throne or the four corners. Other pieces may pass over the empty throne.',
      'Trap an enemy piece between two of yours to capture it. The corners and the empty throne count as an enemy to both sides, and the king can help capture.',
      'The king is caught by two attackers on opposite sides, by three when he stands beside the throne, and by four on the throne.',
      'You win when the king reaches a corner. The Scribe wins by capturing him.'
    ],
    source: 'A modern reconstruction. The ancient Irish rules did not survive.',
    THRONE: BR_THRONE, CORNERS: BR_CORNERS,
    init() {
      const b = Array(49).fill(0);
      [3, 10, 21, 22, 26, 27, 38, 45].forEach(i => { b[i] = 1; });
      [17, 23, 25, 31].forEach(i => { b[i] = 2; });
      b[BR_THRONE] = 3;
      this.b = b; this.win = null; this.ply = 0;
    },
    owns(pl, v) { return pl === 1 ? v === 1 : v === 2 || v === 3; },
    restricted(i) { return i === BR_THRONE || BR_CORNERS.includes(i); },
    count(pl) { let n = 0; for (const v of this.b) if (this.owns(pl, v)) n++; return n; },
    legal(pl) {
      if (this.win) return [];
      const b = this.b, out = [];
      for (let i = 0; i < 49; i++) {
        const v = b[i]; if (!this.owns(pl, v)) continue;
        const r0 = (i / 7) | 0, c0 = i % 7;
        for (const [dr, dc] of BR_DIRS) {
          let r = r0 + dr, c = c0 + dc;
          while (r >= 0 && r < 7 && c >= 0 && c < 7) {
            const j = r * 7 + c;
            if (b[j]) break;
            if (this.restricted(j) && v !== 3) { if (j === BR_THRONE) { r += dr; c += dc; continue; } break; }
            out.push({ pl, from: i, to: j });
            r += dr; c += dc;
          }
        }
      }
      return out;
    },
    anvil(j, pl) { const v = this.b[j]; return this.owns(pl, v) || (v === 0 && this.restricted(j)); },
    neighbors(k) {
      const r = (k / 7) | 0, c = k % 7;
      return BR_DIRS.map(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr < 0 || rr > 6 || cc < 0 || cc > 6 ? -1 : rr * 7 + cc; });
    },
    apply(m) {
      const b = this.b, v = b[m.from];
      b[m.from] = 0; b[m.to] = v; this.ply++;
      const caps = [];
      if (v === 3 && BR_CORNERS.includes(m.to)) { this.win = { winner: 0, text: 'The king reaches a corner and escapes.' }; return { caps, note: 'The king escapes.' }; }
      const r = (m.to / 7) | 0, c = m.to % 7;
      for (const [dr, dc] of BR_DIRS) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 6 || cc < 0 || cc > 6) continue;
        const n = rr * 7 + cc, t = b[n];
        if (!t || this.owns(m.pl, t)) continue;
        const fr = rr + dr, fc = cc + dc;
        const far = fr < 0 || fr > 6 || fc < 0 || fc > 6 ? -1 : fr * 7 + fc;
        if (t === 3) {
          const nb = this.neighbors(n);
          let caught;
          if (n === BR_THRONE) caught = nb.every(j => j >= 0 && b[j] === 1);
          else if (nb.includes(BR_THRONE)) caught = nb.every(j => j === BR_THRONE || (j >= 0 && b[j] === 1));
          else caught = far >= 0 && this.anvil(far, m.pl);
          if (caught) { b[n] = 0; caps.push(n); this.win = { winner: 1, text: 'The king is surrounded and captured.' }; }
          continue;
        }
        if (far >= 0 && this.anvil(far, m.pl)) { b[n] = 0; caps.push(n); }
      }
      let note = '';
      if (this.win) note = 'The king is captured.';
      else if (caps.length) note = m.pl === 0
        ? (caps.length > 1 ? `You capture ${caps.length} attackers.` : 'You capture an attacker.')
        : (caps.length > 1 ? `The Scribe captures ${caps.length} of your pieces.` : 'The Scribe captures one of your pieces.');
      return { caps, note };
    },
    result(pl) {
      if (this.win) return this.win;
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no legal move.' : 'The Scribe has no legal move.' };
      if (this.ply >= 200) return { winner: -1, text: 'Two hundred moves without a result. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.win, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.win = s[1]; this.ply = s[2]; },
    turns(pl) {
      const ms = this.legal(pl).map(m => [m]);
      const k = this.b.indexOf(3);
      // Look at king moves and moves near the king first.
      const near = m => { const a = m[0].to, kr = (k / 7) | 0, kc = k % 7; return Math.abs(((a / 7) | 0) - kr) + Math.abs((a % 7) - kc); };
      return k < 0 ? ms : ms.sort((a, b) => near(a) - near(b));
    },
    terminal(pl, depth) {
      if (this.win) return this.win.winner === pl ? 1000 + depth : -1000 - depth;
      if (this.ply >= 200) return 0;
      return null;
    },
    kingRuns() {
      const k = this.b.indexOf(3); if (k < 0) return 0;
      let n = 0; const r = (k / 7) | 0, c = k % 7;
      for (const [dr, dc] of BR_DIRS) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 7 && cc >= 0 && cc < 7) {
          const j = rr * 7 + cc;
          if (this.b[j]) break;
          if (BR_CORNERS.includes(j)) { n++; break; }
          rr += dr; cc += dc;
        }
      }
      return n;
    },
    evaluate(pl) {
      const k = this.b.indexOf(3);
      let s;
      if (k < 0) s = -1000;
      else {
        let att = 0, def = 0; for (const v of this.b) { if (v === 1) att++; else if (v === 2) def++; }
        const adj = this.neighbors(k).filter(j => j >= 0 && this.b[j] === 1).length;
        const kr = (k / 7) | 0, kc = k % 7;
        const dist = Math.min(...BR_CORNERS.map(q => Math.abs(((q / 7) | 0) - kr) + Math.abs((q % 7) - kc)));
        // Attackers on the squares beside a corner shut that corner; a king with room to run is dangerous.
        const guards = [1, 7, 5, 13, 35, 43, 41, 47].filter(j => this.b[j] === 1).length;
        let kingMoves = 0;
        for (const [dr, dc] of BR_DIRS) {
          let rr = kr + dr, cc = kc + dc;
          while (rr >= 0 && rr < 7 && cc >= 0 && cc < 7 && !this.b[rr * 7 + cc]) { kingMoves++; rr += dr; cc += dc; }
        }
        s = def * 3 - att * 2.5 + this.kingRuns() * 25 - adj * 6 - dist - guards * 3 + kingMoves * 0.8;
      }
      return pl === 0 ? s : -s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 5); },
  };

  /* ----------------------------------------------------- Tables (backgammon)
   * Each player counts points from their own side: 24 is where they start,
   * 1-6 is their home board, 25 is the bar and 0 is borne off. A player's
   * point p is the opponent's point 25 - p. A turn is a sequence of single
   * moves; legal() works out every full sequence, and apply() narrows them
   * as moves are made, returning the next choices as a follow-up. */
  const TABLES = {
    id: 'tables', name: 'Tables', dice: true, pipDice: true, first: 0, N: 15, sides: ['pale checkers', 'dark checkers'],
    rules: [
      'Throw two dice and move one checker by each die, or one checker by both. Doubles are played four times.',
      'Your checkers travel counterclockwise toward your home board in the near-right quarter.',
      'You may not land on a point held by two or more of the Scribe\'s checkers. Land on a single one to hit it and send it to the bar.',
      'A checker on the bar must come back in through the Scribe\'s home board before you move anything else.',
      'You must use both dice if you can. If only one can be used, use the larger if possible.',
      'When all fifteen are in your home board, start bearing them off. The first to bear off all fifteen wins.'
    ],
    source: 'Modern backgammon rules without the doubling cube. Roman tabula used three dice and probably different starting rules.',
    followPrompt: 'Move again with your remaining dice.',
    extraNote: '',
    init() {
      this.c = [Array(26).fill(0), Array(26).fill(0)];
      for (const pl of [0, 1]) { const c = this.c[pl]; c[24] = 2; c[13] = 5; c[8] = 3; c[6] = 5; }
      this.turn = null;
    },
    roll() { const a = 1 + ((Math.random() * 6) | 0), b = 1 + ((Math.random() * 6) | 0); return { faces: [a, b], value: a + b }; },
    pip(pl) { let s = 0; for (let i = 1; i <= 25; i++) s += this.c[pl][i] * i; return s; },
    canBearOff(pl) { const c = this.c[pl]; for (let i = 7; i <= 25; i++) if (c[i]) return false; return true; },
    single(pl, d) {
      const c = this.c[pl], o = this.c[1 - pl], out = [];
      const froms = [];
      if (c[25]) froms.push(25); else for (let i = 24; i >= 1; i--) if (c[i]) froms.push(i);
      for (const f of froms) {
        const t = f - d;
        if (t >= 1) { const oc = o[25 - t]; if (oc >= 2) continue; out.push({ pl, from: f, to: t, die: d, hit: oc === 1 }); }
        else {
          if (!this.canBearOff(pl)) continue;
          if (t < 0) { let higher = false; for (let i = f + 1; i <= 6; i++) if (c[i]) { higher = true; break; } if (higher) continue; }
          out.push({ pl, from: f, to: 0, die: d, hit: false });
        }
      }
      return out;
    },
    doMove(m) { const c = this.c[m.pl], o = this.c[1 - m.pl]; c[m.from]--; c[m.to]++; if (m.hit) { o[25 - m.to]--; o[25]++; } },
    undoMove(m) { const c = this.c[m.pl], o = this.c[1 - m.pl]; c[m.to]--; c[m.from]++; if (m.hit) { o[25]--; o[25 - m.to]++; } },
    sequences(pl, dice) {
      const dl = dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [dice[0], dice[1]];
      let best = [], maxLen = 0;
      const seen = new Set();
      const rec = (remaining, seq) => {
        let any = false; const tried = new Set();
        for (let k = 0; k < remaining.length; k++) {
          const d = remaining[k]; if (tried.has(d)) continue; tried.add(d);
          for (const m of this.single(pl, d)) {
            any = true; this.doMove(m);
            rec(remaining.slice(0, k).concat(remaining.slice(k + 1)), seq.concat([m]));
            this.undoMove(m);
          }
        }
        if (!any && seq.length) {
          const key = this.c[0].join(',') + '|' + this.c[1].join(',') + '|' + seq.map(m => m.from + '>' + m.to + ':' + m.die).join(' ');
          if (seq.length > maxLen) { maxLen = seq.length; best = []; }
          if (seq.length === maxLen && !seen.has(key)) { seen.add(key); best.push(seq); }
        }
      };
      rec(dl, []);
      if (dice[0] !== dice[1] && maxLen === 1) {
        const hi = Math.max(dice[0], dice[1]);
        if (best.some(s => s[0].die === hi)) best = best.filter(s => s[0].die === hi);
      }
      return best;
    },
    firstMoves() {
      const byKey = new Map();
      for (const s of this.turn.seqs) {
        const m = s[0], k = m.from + '>' + m.to;
        const prev = byKey.get(k);
        if (!prev || m.die < prev.die) byKey.set(k, m);
      }
      return [...byKey.values()];
    },
    legal(pl, value, roll) {
      this.turn = { pl, seqs: this.sequences(pl, roll ? roll.faces : [value, value]) };
      return this.turn.seqs.length ? this.firstMoves() : [];
    },
    apply(m) {
      this.doMove(m);
      let note = '';
      if (m.hit) note = m.pl === 0 ? 'You hit one of the Scribe\'s checkers. It goes to the bar.' : 'The Scribe hits your checker. It goes to the bar.';
      else if (m.to === 0) note = m.pl === 0 ? 'Borne off.' : '';
      let followUp = null;
      if (this.turn && this.turn.pl === m.pl) {
        this.turn.seqs = this.turn.seqs.filter(s => s[0].from === m.from && s[0].to === m.to && s[0].die === m.die).map(s => s.slice(1)).filter(s => s.length);
        if (this.turn.seqs.length) followUp = this.firstMoves();
      }
      return { note, followUp, moved: [] };
    },
    extra() { return false; },
    done(pl) { return this.c[pl][0] === 15; },
    home(pl) { return this.c[pl][0]; },
    evaluate(pl) {
      const me = this.c[pl], op = this.c[1 - pl];
      let s = (this.pip(1 - pl) - this.pip(pl)) + me[0] * 3 + op[25] * 9;
      // Is there still contact? Find my rearmost checker and the opponent's rearmost (in my numbering).
      let myBack = 0; for (let i = 25; i >= 1; i--) if (me[i]) { myBack = i; break; }
      let opBack = 25; for (let i = 25; i >= 1; i--) if (op[i]) { opBack = 25 - i; break; }
      const contact = myBack > opBack;
      if (!contact) return s;
      let run = 0;
      for (let i = 1; i <= 24; i++) {
        if (me[i] >= 2) { s += i <= 7 ? 4 : 1.5; run++; if (run >= 3) s += run; } else run = 0;
        if (me[i] === 1) {
          // Opponent checkers that sit "below" this point in my numbering can hit it moving upward.
          let direct = 0, indirect = 0;
          for (let p = 0; p < i; p++) {
            const n = p === 0 ? op[25] : op[25 - p];
            if (!n) continue;
            const dist = i - p;
            if (dist <= 6) direct++; else if (dist <= 12) indirect++;
          }
          s -= (direct ? 6 : 0) + (indirect ? 2 : 0) + (i <= 6 ? 2 : 0) * (direct ? 1 : 0);
        }
      }
      return s;
    },
    aiPlan(pl) {
      const seqs = this.turn && this.turn.pl === pl ? this.turn.seqs : [];
      let best = seqs[0], bv = -Infinity;
      for (const seq of seqs) {
        for (const m of seq) this.doMove(m);
        const v = this.evaluate(pl) + Math.random() * pick(14, 0.3, 0);
        for (let k = seq.length - 1; k >= 0; k--) this.undoMove(seq[k]);
        if (v > bv) { bv = v; best = seq; }
      }
      return best ? best.slice() : [];
    },
  };

  /* ------------------------------------------------------------------ Nard
   * Long nard on a tables board. Like TABLES, c[pl][1..24] counts a player's
   * checkers by distance from home and c[pl][0] those borne off; there is no bar,
   * since nobody hits. Both sides run counterclockwise, so a player's point t is
   * the other's point ndOpp(t). Point 24 is the head, where all fifteen start. */
  const ndOpp = t => (t > 12 ? t - 12 : t + 12);
  const NARD = Object.assign({}, TABLES, {
    id: 'nard', name: 'Nard',
    rules: [
      'All fifteen of your checkers start on your head, the far right point. Both sides race the same way, counterclockwise, the Scribe from the near left corner.',
      'Throw two dice and move one checker by each die, or one checker by both. Doubles are played four times. Use both dice if you can, or the larger if only one can be played.',
      'Nobody hits. A single checker holds its point, and you may not land where the Scribe has any checker.',
      'Only one checker may leave the head each turn. On your first throw, a double 3, 4 or 6 lets two leave.',
      'You may not build six points in a row unless at least one of the Scribe\'s checkers is already past them.',
      'When all fifteen are home, in the near-right quarter, bear them off. The first to bear off all fifteen wins; a win before the loser has borne off any is a mars, worth double.'
    ],
    source: 'Long nard (long nardy) as played across Iran, the Caucasus and Russia, after the rules collected at bkgm.com and Wikipedia.',
    followPrompt: 'Move again with your remaining dice.',
    init() {
      this.c = [Array(26).fill(0), Array(26).fill(0)];
      this.c[0][24] = 15; this.c[1][24] = 15;
      this.turn = null; this.thrown = [0, 0]; this.headUsed = 0; this.headLimit = 1;
    },
    canBearOff(pl) { const c = this.c[pl]; for (let i = 7; i <= 24; i++) if (c[i]) return false; return true; },
    // Six of a player's points in a row are allowed only with an enemy checker already past them.
    primeOK(pl) {
      const c = this.c[pl], o = this.c[1 - pl];
      for (let start = 1; start <= 19; start++) {
        let run = true; for (let k = 0; k < 6; k++) if (!c[start + k]) { run = false; break; }
        if (!run) continue;
        const lowest = Math.min(...[0, 1, 2, 3, 4, 5].map(k => ndOpp(start + k))); // where the block begins in the enemy's count
        let past = false; for (let r = 0; r < lowest; r++) if (o[r]) { past = true; break; } // borne off counts as past
        if (!past) return false;
      }
      return true;
    },
    single(pl, d) {
      const c = this.c[pl], o = this.c[1 - pl], out = [];
      for (let f = 24; f >= 1; f--) {
        if (!c[f]) continue;
        if (f === 24 && this.headUsed >= this.headLimit) continue;
        const t = f - d;
        let m = null;
        if (t >= 1) { if (o[ndOpp(t)]) continue; m = { pl, from: f, to: t, die: d, hit: false }; }
        else {
          if (!this.canBearOff(pl)) continue;
          if (t < 0) { let higher = false; for (let i = f + 1; i <= 6; i++) if (c[i]) { higher = true; break; } if (higher) continue; }
          m = { pl, from: f, to: 0, die: d, hit: false };
        }
        this.doMove(m); const ok = this.primeOK(pl); this.undoMove(m);
        if (ok) out.push(m);
      }
      return out;
    },
    doMove(m) { const c = this.c[m.pl]; c[m.from]--; c[m.to]++; if (m.from === 24) this.headUsed++; },
    undoMove(m) { const c = this.c[m.pl]; c[m.to]--; c[m.from]++; if (m.from === 24) this.headUsed--; },
    legal(pl, value, roll) {
      const dice = roll ? roll.faces : [value, value];
      this.headUsed = 0;
      this.headLimit = !this.thrown[pl] && dice[0] === dice[1] && [3, 4, 6].includes(dice[0]) ? 2 : 1;
      this.thrown[pl]++;
      this.turn = { pl, seqs: this.sequences(pl, dice) };
      return this.turn.seqs.length ? this.firstMoves() : [];
    },
    apply(m) {
      const res = TABLES.apply.call(this, m);
      res.note = m.to === 0 && m.pl === 0 ? 'Borne off.' : '';
      return res;
    },
    final() {
      const w = this.c[0][0] === 15 ? 0 : 1, mars = this.c[1 - w][0] === 0;
      return { winner: w, title: w ? 'The Scribe wins' : 'You win', text: (w ? 'The Scribe bears off all fifteen first' : 'You bear off all fifteen first') + (mars ? ', before the other side has borne off one: a mars, a double win.' : '.') };
    },
    // Race, keep points ahead of the enemy's checkers, and do not leave the head crowded late.
    evaluate(pl) {
      const me = this.c[pl], op = this.c[1 - pl];
      let s = (this.pip(1 - pl) - this.pip(pl)) + me[0] * 4;
      let opBack = 0; for (let r = 24; r >= 1; r--) if (op[r]) { opBack = r; break; } // the enemy's rearmost checker
      let run = 0;
      for (let t = 1; t <= 24; t++) {
        if (!me[t]) { run = 0; continue; }
        run++;
        const ahead = ndOpp(t) < opBack; // the enemy still has to pass this point
        if (ahead) s += 1.2 + Math.min(run, 5) * 0.8;
      }
      s -= Math.max(0, me[24] - 10) * 0.5;
      return s;
    },
  });

  /* -------------------------------------------------- Ludus duodecim scriptorum
   * A modern reconstruction. p[pl][k] counts a player's pieces at route position
   * k: 0 waiting off the board, 1-6 the player's own half of the middle row,
   * 7-18 the far row and 19-30 the near row, shared by both, 31 borne off.
   * Three dice; every die must be used if it can be. */
  const XII_DONE = 31;
  const XII = {
    id: 'xii', name: 'Duodecim scripta', dice: true, pipDice: true, first: 0, N: 15,
    rules: [
      'This is a modern reconstruction: no Roman account of the rules survives. You have fifteen pieces and throw three dice.',
      'Each die brings a waiting piece onto your half of the middle row, on the space of its number, or moves a piece that many spaces on. You must use every die you can.',
      'From your half of the middle row the course runs along the far row, right to left, then along the near row to the finish. The Scribe starts on the other half and shares the same course.',
      'No piece may leave your home row until all fifteen are on the board. A piece taken must come back on before you move anything else.',
      'Two or more pieces together are safe and block the space. Land on a single enemy piece to send it back to wait off the board.',
      'When all fifteen are in the last six spaces, bear them off with exact throws: a piece on the last space needs a 1. The first to bear off all fifteen wins.'
    ],
    source: 'A modern reconstruction, after the basics worked out by Roland Austin and H. J. R. Murray in the early 20th century and adapted from tabula, in the version the J. Paul Getty Museum gives in Ancient Rome at Home.',
    followPrompt: 'Move again with your remaining dice.',
    extraNote: '',
    rollName: r => `${r.faces.join(', ')}`,
    init() { this.p = [Array(32).fill(0), Array(32).fill(0)]; this.p[0][0] = 15; this.p[1][0] = 15; this.turn = null; this.hitOnce = [false, false]; },
    roll() { const f = [0, 0, 0].map(() => 1 + ((Math.random() * 6) | 0)); return { faces: f, value: f[0] + f[1] + f[2] }; },
    waiting(pl) { return this.p[pl][0]; },
    home(pl) { return this.p[pl][XII_DONE]; },
    done(pl) { return this.p[pl][XII_DONE] === 15; },
    allIn(pl) { const q = this.p[pl]; for (let k = 0; k <= 24; k++) if (q[k]) return false; return true; },
    blocked(pl, k) { return k >= 7 && k <= 30 && this.p[1 - pl][k] >= 2; },
    single(pl, d) {
      const q = this.p[pl], o = this.p[1 - pl], out = [];
      const add = (from, to) => { if (this.blocked(pl, to)) return; out.push({ pl, from, to, die: d, hit: to >= 7 && to <= 30 && o[to] === 1 }); };
      if (q[0]) { add(0, d); if (this.reentry(pl)) return out; } // a taken piece comes back before anything else moves
      const filling = q[0] > 0;
      for (let k = 1; k <= 30; k++) {
        if (!q[k]) continue;
        const to = k + d;
        if (filling && to > 6) continue; // nothing leaves the home row until all fifteen are on
        if (to <= 30) add(k, to);
        else if (to === XII_DONE && this.allIn(pl)) out.push({ pl, from: k, to: XII_DONE, die: d, hit: false });
      }
      return out;
    },
    reentry(pl) { return this.hitOnce[pl] && this.p[pl][0] > 0; }, // a piece that was taken must come back before others move
    doMove(m) { const q = this.p[m.pl]; q[m.from]--; q[m.to]++; if (m.hit) { const o = this.p[1 - m.pl]; o[m.to]--; o[0]++; m.wasHit = this.hitOnce[1 - m.pl]; this.hitOnce[1 - m.pl] = true; } },
    undoMove(m) { const q = this.p[m.pl]; q[m.to]--; q[m.from]++; if (m.hit) { const o = this.p[1 - m.pl]; o[0]--; o[m.to]++; this.hitOnce[1 - m.pl] = m.wasHit; } },
    sequences(pl, dice) {
      let best = [], maxLen = 0; const seen = new Set();
      const rec = (rem, seq) => {
        let any = false; const tried = new Set();
        for (let k = 0; k < rem.length; k++) {
          const d = rem[k]; if (tried.has(d)) continue; tried.add(d);
          for (const m of this.single(pl, d)) { any = true; this.doMove(m); rec(rem.slice(0, k).concat(rem.slice(k + 1)), seq.concat([m])); this.undoMove(m); }
        }
        if (!any && seq.length) {
          const key = this.p[0].join(',') + '|' + this.p[1].join(',');
          if (seq.length > maxLen) { maxLen = seq.length; best = []; seen.clear(); }
          if (seq.length === maxLen && !seen.has(key)) { seen.add(key); best.push(seq.map(m => Object.assign({}, m))); }
        }
      };
      rec(dice.slice(), []);
      return best;
    },
    firstMoves() {
      const byKey = new Map();
      for (const s of this.turn.seqs) { const m = s[0], k = m.from + '>' + m.to; if (!byKey.has(k)) byKey.set(k, m); }
      return [...byKey.values()];
    },
    legal(pl, value, roll) {
      this.turn = { pl, seqs: this.sequences(pl, roll ? roll.faces : [value]) };
      return this.turn.seqs.length ? this.firstMoves() : [];
    },
    apply(m) {
      this.doMove(m);
      const you = m.pl === 0;
      const note = m.hit ? (you ? 'You take a Scribe\'s piece: it goes back to wait off the board.' : 'The Scribe takes one of your pieces: it goes back to wait off the board.') : '';
      let followUp = null;
      if (this.turn && this.turn.pl === m.pl) {
        this.turn.seqs = this.turn.seqs.filter(s => s[0].from === m.from && s[0].to === m.to && s[0].die === m.die).map(s => s.slice(1)).filter(s => s.length);
        if (this.turn.seqs.length) followUp = this.firstMoves();
      }
      return { note, followUp };
    },
    extra() { return false; },
    final() { const w = this.done(0) ? 0 : 1; return { winner: w, text: w ? `The Scribe bears off all fifteen first. You bore off ${this.home(0)}.` : `You bear off all fifteen first. The Scribe bore off ${this.home(1)}.` }; },
    progress(pl) { const q = this.p[pl]; let s = 0; for (let k = 1; k <= XII_DONE; k++) s += q[k] * k; return s; },
    evaluate(pl) {
      const me = this.p[pl], op = this.p[1 - pl];
      let s = this.progress(pl) - this.progress(1 - pl) + op[0] * 6 * (this.hitOnce[1 - pl] ? 1 : 0.2) + (me[XII_DONE] - op[XII_DONE]) * 14;
      // Bearing off needs exact throws, so pieces spread over the last six spaces use more of each throw;
      // a crowd on the last spaces waits for ones and twos.
      for (let k = 25; k <= 30; k++) s -= Math.max(0, me[k] - 2) * 3 + me[k] * Math.max(0, k - 27) * 1.5;
      for (let k = 7; k <= 30; k++) {
        if (me[k] >= 2) s += 1.5;
        if (me[k] === 1) { // a lone piece the enemy can reach with up to three dice: weigh what it would lose
          let near = 99; for (let b = Math.max(1, k - 18); b < k; b++) if (op[b]) near = Math.min(near, k - b);
          const risk = near <= 6 ? 0.55 : near <= 12 ? 0.3 : near <= 18 ? 0.12 : 0;
          s -= risk * (k + 6);
        }
      }
      return s;
    },
    aiPlan(pl) {
      const seqs = this.turn && this.turn.pl === pl ? this.turn.seqs : [];
      let best = seqs[0], bv = -Infinity;
      for (const seq of seqs) {
        const done = []; for (const m of seq) { const c = Object.assign({}, m); this.doMove(c); done.push(c); }
        const v = this.evaluate(pl) + Math.random() * pick(60, 3, 0);
        for (let k = done.length - 1; k >= 0; k--) this.undoMove(done[k]);
        if (v > bv) { bv = v; best = seq; }
      }
      return best ? best.map(m => Object.assign({}, m)) : [];
    },
  };

  /* --------------------------------------------------------------- Koi-koi
   * 48 hanafuda cards: card c is month c >> 2 (0 pine ... 11 paulownia), and
   * HF_KIND[c] its kind: b bright, a animal, r ribbon (red poem, blue or plain
   * red), k chaff. Player 0 is the visitor; the oya (dealer) plays first. */
  const HF_MONTH = ['pine', 'plum', 'cherry', 'wisteria', 'iris', 'peony', 'bush clover', 'pampas', 'chrysanthemum', 'maple', 'willow', 'paulownia'];
  const HF_CARDS = [ // [kind, name] for the four cards of each month
    [['b', 'crane'], ['rp', 'red poem ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'bush warbler'], ['rp', 'red poem ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['b', 'curtain'], ['rp', 'red poem ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'cuckoo'], ['rr', 'red ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'eight-plank bridge'], ['rr', 'red ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'butterflies'], ['rb', 'blue ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'boar'], ['rr', 'red ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['b', 'moon'], ['a', 'geese'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'sake cup'], ['rb', 'blue ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'deer'], ['rb', 'blue ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['b', 'rain man'], ['a', 'swallow'], ['rr', 'red ribbon'], ['k', 'lightning']],
    [['b', 'phoenix'], ['k', 'chaff'], ['k', 'chaff'], ['k', 'chaff']]
  ];
  const hfKind = c => HF_CARDS[c >> 2][c & 3][0];
  const hfName = c => `${HF_MONTH[c >> 2]} ${HF_CARDS[c >> 2][c & 3][1]}`;
  const HF = { RAIN: 40, MOON: 28, CURTAIN: 8, SAKE: 32, BOAR: 24, DEER: 36, BUTTERFLIES: 20 };
  const hfValue = c => { const k = hfKind(c); return k === 'b' ? 20 : k === 'a' ? (c === HF.SAKE ? 16 : [HF.BOAR, HF.DEER, HF.BUTTERFLIES].includes(c) ? 12 : 10) : k === 'rp' || k === 'rb' ? 7 : k === 'rr' ? 5 : 1; };
  function hfYaku(pile) { // [{name, pts}] for a pile of captured cards
    const has = c => pile.includes(c), out = [];
    const brights = pile.filter(c => hfKind(c) === 'b'), rain = has(HF.RAIN);
    if (brights.length === 5) out.push(['gokō, five brights', 10]);
    else if (brights.length === 4) out.push(rain ? ['ame-shikō, four brights with the rain man', 7] : ['shikō, four brights', 8]);
    else if (brights.length === 3 && !rain) out.push(['sankō, three brights', 5]);
    if (has(HF.MOON) && has(HF.SAKE)) out.push(['tsukimi-zake, moon and sake', 5]);
    if (has(HF.CURTAIN) && has(HF.SAKE)) out.push(['hanami-zake, cherry blossom and sake', 5]);
    if (has(HF.BOAR) && has(HF.DEER) && has(HF.BUTTERFLIES)) out.push(['inoshikachō, boar, deer and butterflies', 5]);
    if (pile.filter(c => hfKind(c) === 'rp').length === 3) out.push(['akatan, the red poem ribbons', 5]);
    if (pile.filter(c => hfKind(c) === 'rb').length === 3) out.push(['aotan, the blue ribbons', 5]);
    const n = { a: 0, r: 0, k: 0 }; pile.forEach(c => { const k = hfKind(c)[0]; if (n[k] !== undefined) n[k]++; });
    if (n.a >= 5) out.push([`tane, ${n.a} animals`, n.a - 4]);
    if (n.r >= 5) out.push([`tan, ${n.r} ribbons`, n.r - 4]);
    if (n.k >= 10) out.push([`kasu, ${n.k} chaff`, n.k - 9]);
    return out;
  }
  const hfPoints = pile => hfYaku(pile).reduce((t, y) => t + y[1], 0);
  const KOIKOI = {
    id: 'koikoi', name: 'Koi-koi', dice: false, first: 0, cardName: hfName,
    MONTH: HF_MONTH, kind: hfKind, yaku: hfYaku, points: hfPoints,
    variants: [{ id: '3', label: '3 months' }, { id: '6', label: '6 months' }, { id: '12', label: '12 months' }], variant: '6', variantLabel: 'Game',
    setVariant(id) { this.variant = ['3', '6', '12'].includes(id) ? id : '6'; },
    rules: [
      'Forty-eight flower cards, four for each month. Each of you holds eight, eight lie face up between you, and the rest are the draw pile. The dealer (oya) plays first; you deal the first month.',
      'On your turn, play a card from your hand. If a card of the same month lies on the table, take both into your pile; if two do, choose one; if three do, take all four. If none does, your card stays on the table.',
      'Then turn up the top card of the pile and match it the same way.',
      'Collect combinations (yaku): five brights 10, four brights 8 (7 with the rain man), three brights 5 (not with the rain man); moon and sake 5; cherry blossom and sake 5; boar, deer and butterflies 5; the three red poem ribbons 5; the three blue ribbons 5; five animals, five ribbons or ten chaff 1, and 1 more for each card beyond.',
      'When you make a new yaku you may stop and score, or call koi-koi and play on for more. If you call koi-koi and the Scribe then stops first, it scores double and you score nothing. A score of 7 or more doubles.',
      'If the hands run out with no yaku, the dealer scores 1. The winner of a month deals the next. Highest total after the last month wins.'
    ],
    source: 'Koi-koi as commonly played in Japan, after the rules on Wikipedia. Four of a month or four pairs dealt to a player score 6 at once; the same on the table means a redeal.',
    get followPrompt() { return this.need === 'koi' ? 'You have a new yaku. Stop and score, or call koi-koi and play on?' : 'Two cards of that month are on the table: choose one to take.'; },
    init() { this.total = [0, 0]; this.month = 0; this.oya = 0; this.over = null; this.deal(); },
    deal() {
      for (let tries = 0; tries < 50; tries++) {
        const d = Array.from({ length: 48 }, (_, i) => i); for (let i = 47; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
        this.hands = [d.slice(0, 8), d.slice(8, 16)]; this.field = d.slice(16, 24); this.pile = d.slice(24);
        const four = cs => { const n = Array(12).fill(0); cs.forEach(c => n[c >> 2]++); return n.some(x => x === 4) || n.filter(x => x === 2).length === 4; };
        if (!four(this.field)) break; // four of a month, or four pairs, on the table: deal again
      }
      this.hands.forEach(h => h.sort((a, b) => a - b));
      this.won = [[], []]; this.koi = [false, false]; this.lastPts = [0, 0];
      this.toMove = this.oya; this.need = 'play'; this.pendingDraw = null; this.notes = []; this.month++;
      // Four of a month or four pairs in a hand (teshi, kuttsuki) score 6 at once.
      for (const pl of [this.oya, 1 - this.oya]) {
        const n = Array(12).fill(0); this.hands[pl].forEach(c => n[c >> 2]++);
        if (n.some(x => x === 4) || n.filter(x => x === 2).length === 4) { this.endMonth(pl, 6, [`${pl ? 'The Scribe was' : 'You were'} dealt ${n.some(x => x === 4) ? 'all four cards of a month (teshi)' : 'four pairs (kuttsuki)'}: 6 points.`]); break; }
      }
    },
    get rounds() { return +this.variant; },
    matches(c) { return this.field.filter(f => f >> 2 === c >> 2); },
    legal(pl) {
      if (this.over || pl !== this.toMove) return [];
      if (this.need === 'next') return [{ pl, kind: 'next', label: this.month >= this.rounds ? 'See the result' : 'Next month' }];
      if (this.need === 'koi') return [{ pl, kind: 'stop', label: `Stop and score ${this.scoreNow(pl)}` }, { pl, kind: 'koikoi', label: 'Koi-koi!' }];
      if (this.need === 'draw') return this.matches(this.pendingDraw).map(f => ({ pl, kind: 'draw', c: this.pendingDraw, take: f }));
      const out = [];
      for (const c of this.hands[pl]) {
        const m = this.matches(c);
        if (m.length === 2) for (const f of m) out.push({ pl, kind: 'play', c, take: f });
        else out.push({ pl, kind: 'play', c, take: m.length ? m[0] : null });
      }
      return out;
    },
    // The score a player would bank by stopping now.
    scoreNow(pl) { let p = hfPoints(this.won[pl]); if (p >= 7) p *= 2; if (this.koi[1 - pl]) p *= 2; return p; },
    capture(pl, c, take, events) {
      const same = this.matches(c);
      if (!same.length) { this.field.push(c); events.push({ type: 'toField', pl, c }); return; }
      const got = same.length === 3 ? same : [take];
      for (const f of got) this.field.splice(this.field.indexOf(f), 1);
      this.won[pl].push(c, ...got); events.push({ type: 'capture', pl, cards: [c, ...got] });
    },
    apply(m) {
      const pl = m.pl, events = [], notes = [];
      if (m.kind === 'next') {
        if (this.month >= this.rounds) { this.finishGame(); return { note: '', events }; }
        this.deal(); events.push({ type: 'deal' });
        return { note: this.need === 'next' ? this.notes.join(' ') : `${HF_MONTH[(this.month - 1) % 12][0].toUpperCase() + HF_MONTH[(this.month - 1) % 12].slice(1)} month. ${this.oya ? 'The Scribe deals and plays first.' : 'You deal and play first.'}`, events };
      }
      if (m.kind === 'stop') { this.endMonth(pl, this.scoreNow(pl), [`${pl ? 'The Scribe stops' : 'You stop'} and ${pl ? 'scores' : 'score'} ${this.scoreNow(pl)}.`]); return { note: this.notes.join(' '), events: [{ type: 'end' }] }; }
      if (m.kind === 'koikoi') { this.koi[pl] = true; this.passOn(pl); return { note: pl ? 'The Scribe calls koi-koi!' : 'Koi-koi! You play on.', events }; }
      if (m.kind === 'play') {
        this.hands[pl].splice(this.hands[pl].indexOf(m.c), 1);
        this.capture(pl, m.c, m.take, events);
        const d = this.pile.shift(); events.push({ type: 'drawn', pl, c: d });
        if (this.matches(d).length === 2 && pl === 0) { this.pendingDraw = d; this.need = 'draw'; return { note: `You turn up the ${hfName(d)}.`, events, followUp: this.legal(pl) }; }
        const two = this.matches(d); this.capture(pl, d, two.length === 2 ? two.reduce((x, y) => (hfValue(y) > hfValue(x) ? y : x)) : two[0], events);
      } else if (m.kind === 'draw') { this.capture(pl, m.c, m.take, events); this.pendingDraw = null; }
      return this.afterTurn(pl, events, notes);
    },
    afterTurn(pl, events, notes) {
      const pts = hfPoints(this.won[pl]);
      if (pts > this.lastPts[pl]) {
        this.lastPts[pl] = pts;
        const names = hfYaku(this.won[pl]).map(y => y[0]).join('; ');
        notes.push(`${pl ? 'The Scribe has' : 'You have'} ${names}.`);
        if (pl === 0) { this.need = 'koi'; return { note: notes.join(' '), events, followUp: this.legal(0) }; }
        if (this.aiStop()) { const s = this.scoreNow(1); this.endMonth(1, s, notes.concat([`The Scribe stops and scores ${s}.`])); return { note: this.notes.join(' '), events: events.concat([{ type: 'end' }]) }; }
        this.koi[1] = true; notes.push('The Scribe calls koi-koi!');
      }
      this.passOn(pl);
      if (this.need === 'next') events.push({ type: 'end' });
      return { note: (notes.concat(this.need === 'next' ? this.notes : [])).join(' '), events };
    },
    passOn(pl) {
      this.need = 'play'; this.toMove = 1 - pl;
      if (!this.hands[0].length && !this.hands[1].length) this.endMonth(this.oya, 1, ['The hands are empty with no one stopping: the dealer scores 1.']);
    },
    endMonth(pl, pts, notes) {
      this.total[pl] += pts; this.oya = pl;
      this.notes = notes.concat([`After ${this.month} of ${this.rounds} months: you ${this.total[0]}, the Scribe ${this.total[1]}.`]);
      this.need = 'next'; this.toMove = 0;
    },
    finishGame() {
      const [a, b] = this.total;
      this.over = { winner: a > b ? 0 : b > a ? 1 : -1, title: a > b ? 'You win' : b > a ? 'The Scribe wins' : 'A draw', text: `${a} to ${b} after ${this.rounds} months.` };
    },
    passTurn() { return this.over ? 0 : this.toMove; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    // The Scribe stops when it is ahead in the match or holds 7 or more; otherwise, with cards left, it may press on.
    aiStop() {
      const s = this.scoreNow(1), left = this.hands[1].length, behind = this.total[0] - this.total[1];
      if (LEVEL.name === 'gentle') return Math.random() < 0.6;
      if (s >= 7 || left <= 2) return true;
      if (LEVEL.name === 'sharp') { const oppNear = hfPoints(this.won[0]) > 0 || this.won[0].length >= 10; return oppNear || behind <= 0 ? true : left < 5; }
      return true;
    },
    // Score a play: what it takes now, what it leaves for the opponent, and yaku in the making.
    aiPlan(pl) {
      const ms = this.legal(pl);
      if (LEVEL.name === 'gentle' && Math.random() < 0.4) return [ms[(Math.random() * ms.length) | 0]];
      const seen = new Set(this.won[0].concat(this.won[1], this.field, this.hands[pl]));
      const deadMonth = m => [0, 1, 2, 3].every(k => seen.has(m * 4 + k)); // every card of the month accounted for
      let best = ms[0], bv = -Infinity;
      for (const m of ms) {
        let v = 0;
        if (m.kind !== 'play' && m.kind !== 'draw') { v = 0; }
        else {
          const same = this.matches(m.c), got = !same.length ? [] : same.length === 3 ? [m.c, ...same] : [m.c, m.take];
          const before = hfPoints(this.won[pl]), after = hfPoints(this.won[pl].concat(got));
          v = got.reduce((t, c) => t + hfValue(c), 0) + (after - before) * 25;
          if (!got.length) v -= hfValue(m.c) * (deadMonth(m.c >> 2) ? 0.2 : 1.2); // a card left on the table may feed the opponent
        }
        v += Math.random() * pick(6, 1, 0.2);
        if (v > bv) { bv = v; best = m; }
      }
      return [best];
    },
  };

  /* --------------------------------------------------------------- Shatranj
   * 64 squares, index r*8+c with rank 0 on the visitor's side. A square holds
   * 0 or type + 8*player: 1 shah (king), 2 firzan, 3 alfil, 4 faras (knight),
   * 5 rukh (rook), 6 baidaq (pawn). The visitor (player 0) moves up the board. */
  const SH = { K: 1, F: 2, E: 3, N: 4, R: 5, P: 6 };
  const SH_VALUE = [0, 0, 1.6, 1.25, 3, 5, 1];
  const SH_KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const SH_KING = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const SH_DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const SH_ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const SHATRANJ = {
    id: 'shatranj', name: 'Shatranj', dice: false, first: 0, SH,
    rules: [
      'The shah (king) moves one square in any direction, and the rukh (rook) and faras (knight) move as in modern chess.',
      'The firzan, ancestor of the queen, moves only one square diagonally.',
      'The alfil, ancestor of the bishop, jumps exactly two squares diagonally, over anything in between.',
      'The baidaq (pawn) steps one square forward and captures one square diagonally forward. It never moves two at once, and on the far rank it becomes a firzan.',
      'You win by checkmate (shah mat), by stalemating the Scribe, or by capturing everything but its king, unless it can strip yours bare on the very next move.',
      'There is no castling. A long stretch with no capture or pawn move is a draw.'
    ],
    source: 'Rules as recorded by medieval Arabic writers such as al-Adli and as-Suli (9th–10th centuries).',
    init() {
      const b = Array(64).fill(0);
      const back = [SH.R, SH.N, SH.E, SH.F, SH.K, SH.E, SH.N, SH.R];
      for (let c = 0; c < 8; c++) { b[c] = back[c]; b[8 + c] = SH.P; b[48 + c] = SH.P + 8; b[56 + c] = back[c] + 8; }
      this.b = b; this.quiet = 0; this.ply = 0;
    },
    owner: v => (v > 8 ? 1 : 0),
    type: v => v & 7,
    on: (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8,
    material(pl) { let n = 0; for (const v of this.b) if (v && this.owner(v) === pl && this.type(v) !== SH.K) n++; return n; },
    score(pl) { let n = 0; for (const v of this.b) if (v && this.owner(v) === pl) n += SH_VALUE[this.type(v)]; return n; },
    attacked(sq, by) {
      const b = this.b, r = sq >> 3, c = sq & 7;
      const is = (rr, cc, t) => { if (!this.on(rr, cc)) return false; const v = b[rr * 8 + cc]; return v && this.owner(v) === by && this.type(v) === t; };
      for (const [dr, dc] of SH_KNIGHT) if (is(r + dr, c + dc, SH.N)) return true;
      for (const [dr, dc] of SH_KING) if (is(r + dr, c + dc, SH.K)) return true;
      for (const [dr, dc] of SH_DIAG) { if (is(r + dr, c + dc, SH.F)) return true; if (is(r + 2 * dr, c + 2 * dc, SH.E)) return true; }
      const pr = by === 0 ? r - 1 : r + 1;
      if (is(pr, c - 1, SH.P) || is(pr, c + 1, SH.P)) return true;
      for (const [dr, dc] of SH_ORTHO) {
        let rr = r + dr, cc = c + dc;
        while (this.on(rr, cc)) { const v = b[rr * 8 + cc]; if (v) { if (this.owner(v) === by && this.type(v) === SH.R) return true; break; } rr += dr; cc += dc; }
      }
      return false;
    },
    inCheck(pl) { const k = this.b.indexOf(SH.K + 8 * pl); return k >= 0 && this.attacked(k, 1 - pl); },
    pseudo(pl) {
      const b = this.b, out = [];
      const add = (from, r, c, captureOnly, quietOnly) => {
        if (!this.on(r, c)) return false;
        const to = r * 8 + c, v = b[to];
        if (v && this.owner(v) === pl) return false;
        if (v && quietOnly) return false;
        if (!v && captureOnly) return false;
        out.push({ pl, from, to, cap: v });
        return !v;
      };
      for (let i = 0; i < 64; i++) {
        const v = b[i]; if (!v || this.owner(v) !== pl) continue;
        const r = i >> 3, c = i & 7, t = this.type(v);
        if (t === SH.K) for (const [dr, dc] of SH_KING) add(i, r + dr, c + dc);
        else if (t === SH.F) for (const [dr, dc] of SH_DIAG) add(i, r + dr, c + dc);
        else if (t === SH.E) for (const [dr, dc] of SH_DIAG) add(i, r + 2 * dr, c + 2 * dc);
        else if (t === SH.N) for (const [dr, dc] of SH_KNIGHT) add(i, r + dr, c + dc);
        else if (t === SH.R) for (const [dr, dc] of SH_ORTHO) { let rr = r + dr, cc = c + dc; while (add(i, rr, cc)) { rr += dr; cc += dc; } }
        else if (t === SH.P) {
          const dr = pl === 0 ? 1 : -1;
          add(i, r + dr, c, false, true); add(i, r + dr, c - 1, true); add(i, r + dr, c + 1, true);
        }
      }
      for (const m of out) { const t = this.type(b[m.from]); if (t === SH.P && ((m.to >> 3) === (pl === 0 ? 7 : 0))) m.promo = true; }
      return out;
    },
    legal(pl) {
      const out = [];
      for (const m of this.pseudo(pl)) {
        const s = this.snapshot(); this.raw(m);
        if (!this.inCheck(pl)) out.push(m);
        this.restore(s);
      }
      return out;
    },
    raw(m) {
      const b = this.b, v = b[m.from];
      b[m.to] = m.promo ? SH.F + 8 * m.pl : v; b[m.from] = 0;
      this.quiet = m.cap || this.type(v) === SH.P ? 0 : this.quiet + 1; this.ply++;
    },
    apply(m) {
      this.raw(m);
      const opp = 1 - m.pl;
      const parts = [];
      if (m.cap) parts.push(m.pl === 0 ? 'You capture the Scribe\'s ' + this.pieceName(m.cap) + '.' : 'The Scribe captures your ' + this.pieceName(m.cap) + '.');
      if (m.promo) parts.push('The baidaq becomes a firzan.');
      if (this.inCheck(opp)) parts.push(opp === 1 ? 'Shah! The Scribe\'s king is in check.' : 'Shah! Your king is in check.');
      return { note: parts.join(' ') };
    },
    pieceName(v) { return ['', 'shah', 'firzan', 'alfil', 'faras', 'rukh', 'baidaq'][this.type(v)]; },
    result(pl) {
      const moves = this.legal(pl);
      if (!moves.length) {
        return this.inCheck(pl)
          ? { winner: 1 - pl, text: pl === 0 ? 'Shah mat. Your king is checkmated.' : 'Shah mat. The Scribe\'s king is checkmated.' }
          : { winner: 1 - pl, text: pl === 0 ? 'Your king is stalemated, and in shatranj that loses.' : 'You stalemated the Scribe, and in shatranj that wins.' };
      }
      const mine = this.material(pl), theirs = this.material(1 - pl);
      if (!mine && !theirs) return { winner: -1, text: 'Both kings stand bare. The game is drawn.' };
      if (!mine) {
        const strip = theirs === 1 && moves.some(m => m.cap && this.type(m.cap) !== SH.K);
        if (!strip) return { winner: 1 - pl, text: pl === 0 ? 'Your king is bare, and you cannot strip the Scribe\'s in reply.' : 'The Scribe\'s king is bare.' };
      }
      if (this.quiet >= 100) return { winner: -1, text: 'A long stretch with no capture or pawn move. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.quiet, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.quiet = s[1]; this.ply = s[2]; },
    turns(pl) {
      return this.legal(pl).sort((a, b) => (b.cap ? SH_VALUE[this.type(b.cap)] * 10 : 0) - (a.cap ? SH_VALUE[this.type(a.cap)] * 10 : 0)).map(m => [m]);
    },
    terminal(pl, depth) {
      const mine = this.material(pl), theirs = this.material(1 - pl);
      if (!this.pseudo(pl).some(m => { const s = this.snapshot(); this.raw(m); const ok = !this.inCheck(pl); this.restore(s); return ok; })) return -1000 - depth;
      if (!mine && !theirs) return 0;
      if (!mine && theirs > 1) return -900 - depth;
      if (this.quiet >= 100) return 0;
      return null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v) continue;
        const o = this.owner(v), t = this.type(v), r = i >> 3, c = i & 7;
        let val = SH_VALUE[t];
        if (t === SH.P) val += 0.06 * (o === 0 ? r : 7 - r);
        if (t === SH.N || t === SH.F) val += 0.08 * (3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5)));
        s += o === pl ? val : -val;
      }
      if (!this.material(1 - pl)) s += 6;
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 5); },
  };

  /* ------------------------------------------------------------------ Chess
   * The modern game, played on at the New Queen. Same board layout as
   * shatranj: index r*8+c, rank 0 nearest the visitor, a square holds
   * type + 8*player: 1 king, 2 queen, 3 bishop, 4 knight, 5 rook, 6 pawn. */
  const CH = { K: 1, Q: 2, B: 3, N: 4, R: 5, P: 6 };
  const CH_VALUE = [0, 0, 9, 3.2, 3, 5, 1];
  const CHESS = {
    id: 'chess', name: 'Chess', dice: false, first: 0, CH,
    rules: [
      'You play white and move first. The queen moves any distance in any direction, the bishop any distance diagonally: the two changes of the 1470s that made chess fast.',
      'The rook moves any distance across or up and down, the knight jumps in an L, and the king steps one square in any direction.',
      'A pawn steps forward one square, or two from its first square, and captures one square diagonally forward. It may take a pawn that has just passed it with a double step (en passant). On the far rank it becomes a queen.',
      'Castling: if neither the king nor that rook has moved, nothing stands between them, and the king is not in check or passing through an attacked square, move the king two squares toward the rook. The rook jumps to the king\'s other side.',
      'Checkmate wins. Stalemate, bare kings, or fifty moves each with no capture or pawn move are draws.'
    ],
    source: 'Modern rules, with pawns always promoting to a queen and no draw by repetition.',
    init() {
      const b = Array(64).fill(0);
      const back = [CH.R, CH.N, CH.B, CH.Q, CH.K, CH.B, CH.N, CH.R];
      for (let c = 0; c < 8; c++) { b[c] = back[c]; b[8 + c] = CH.P; b[48 + c] = CH.P + 8; b[56 + c] = back[c] + 8; }
      this.b = b; this.quiet = 0; this.ply = 0; this.ep = -1;
      this.castle = [[true, true], [true, true]]; // [queen side, king side] for each player
    },
    owner: v => (v > 8 ? 1 : 0),
    type: v => v & 7,
    on: (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8,
    count(pl) { let n = 0; for (const v of this.b) if (v && this.owner(v) === pl) n++; return n; },
    attacked(sq, by) {
      const b = this.b, r = sq >> 3, c = sq & 7;
      const is = (rr, cc, ...ts) => { if (!this.on(rr, cc)) return false; const v = b[rr * 8 + cc]; return v && this.owner(v) === by && ts.includes(this.type(v)); };
      for (const [dr, dc] of SH_KNIGHT) if (is(r + dr, c + dc, CH.N)) return true;
      for (const [dr, dc] of SH_KING) if (is(r + dr, c + dc, CH.K)) return true;
      const pr = by === 0 ? r - 1 : r + 1;
      if (is(pr, c - 1, CH.P) || is(pr, c + 1, CH.P)) return true;
      const slide = (dirs, ts) => { for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (this.on(rr, cc)) { const v = b[rr * 8 + cc]; if (v) { if (this.owner(v) === by && ts.includes(this.type(v))) return true; break; } rr += dr; cc += dc; } } return false; };
      return slide(SH_ORTHO, [CH.R, CH.Q]) || slide(SH_DIAG, [CH.B, CH.Q]);
    },
    inCheck(pl) { const k = this.b.indexOf(CH.K + 8 * pl); return k >= 0 && this.attacked(k, 1 - pl); },
    pseudo(pl) {
      const b = this.b, out = [];
      const add = (from, r, c, captureOnly, quietOnly) => {
        if (!this.on(r, c)) return false;
        const to = r * 8 + c, v = b[to];
        if (v && this.owner(v) === pl) return false;
        if (v && quietOnly) return false;
        if (!v && captureOnly) return false;
        out.push({ pl, from, to, cap: v });
        return !v;
      };
      const slide = (i, dirs) => { const r = i >> 3, c = i & 7; for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (add(i, rr, cc)) { rr += dr; cc += dc; } } };
      for (let i = 0; i < 64; i++) {
        const v = b[i]; if (!v || this.owner(v) !== pl) continue;
        const r = i >> 3, c = i & 7, t = this.type(v);
        if (t === CH.K) {
          for (const [dr, dc] of SH_KING) add(i, r + dr, c + dc);
          const home = pl === 0 ? 0 : 56;
          if (i === home + 4 && !this.inCheck(pl)) {
            if (this.castle[pl][1] && b[home + 7] === CH.R + 8 * pl && !b[home + 5] && !b[home + 6] && !this.attacked(home + 5, 1 - pl)) out.push({ pl, from: i, to: home + 6, cap: 0, castle: [home + 7, home + 5] });
            if (this.castle[pl][0] && b[home] === CH.R + 8 * pl && !b[home + 1] && !b[home + 2] && !b[home + 3] && !this.attacked(home + 3, 1 - pl)) out.push({ pl, from: i, to: home + 2, cap: 0, castle: [home, home + 3] });
          }
        }
        else if (t === CH.Q) { slide(i, SH_ORTHO); slide(i, SH_DIAG); }
        else if (t === CH.B) slide(i, SH_DIAG);
        else if (t === CH.R) slide(i, SH_ORTHO);
        else if (t === CH.N) for (const [dr, dc] of SH_KNIGHT) add(i, r + dr, c + dc);
        else if (t === CH.P) {
          const dr = pl === 0 ? 1 : -1, start = pl === 0 ? 1 : 6;
          if (add(i, r + dr, c, false, true) && r === start) { const n = out.length; add(i, r + 2 * dr, c, false, true); if (out.length > n) out[out.length - 1].double = (r + dr) * 8 + c; }
          add(i, r + dr, c - 1, true); add(i, r + dr, c + 1, true);
          for (const dc of [-1, 1]) if (this.on(r + dr, c + dc) && (r + dr) * 8 + c + dc === this.ep) out.push({ pl, from: i, to: this.ep, cap: CH.P + 8 * (1 - pl), epTake: r * 8 + c + dc });
        }
      }
      for (const m of out) if (this.type(b[m.from]) === CH.P && ((m.to >> 3) === (pl === 0 ? 7 : 0))) m.promo = true;
      return out;
    },
    legal(pl) {
      const out = [];
      for (const m of this.pseudo(pl)) { const s = this.snapshot(); this.raw(m); if (!this.inCheck(pl)) out.push(m); this.restore(s); }
      return out;
    },
    raw(m) {
      const b = this.b, v = b[m.from], t = this.type(v);
      b[m.to] = m.promo ? CH.Q + 8 * m.pl : v; b[m.from] = 0;
      if (m.epTake !== undefined) b[m.epTake] = 0;
      if (m.castle) { b[m.castle[1]] = b[m.castle[0]]; b[m.castle[0]] = 0; }
      if (t === CH.K) this.castle[m.pl] = [false, false];
      for (const [sq, pl, side] of [[0, 0, 0], [7, 0, 1], [56, 1, 0], [63, 1, 1]]) if (m.from === sq || m.to === sq) this.castle[pl][side] = false;
      this.ep = m.double !== undefined ? m.double : -1;
      this.quiet = m.cap || t === CH.P ? 0 : this.quiet + 1; this.ply++;
    },
    pieceName(v) { return ['', 'king', 'queen', 'bishop', 'knight', 'rook', 'pawn'][this.type(v)]; },
    apply(m) {
      this.raw(m);
      const parts = [];
      if (m.castle) parts.push(m.pl === 0 ? 'You castle.' : 'The Scribe castles.');
      if (m.cap) parts.push(m.pl === 0 ? `You take the Scribe's ${this.pieceName(m.cap)}${m.epTake !== undefined ? ' en passant' : ''}.` : `The Scribe takes your ${this.pieceName(m.cap)}${m.epTake !== undefined ? ' en passant' : ''}.`);
      if (m.promo) parts.push('The pawn becomes a queen.');
      if (this.inCheck(1 - m.pl)) parts.push(m.pl === 0 ? 'Check.' : 'Check! Your king is attacked.');
      return { caps: m.cap ? [m.epTake !== undefined ? m.epTake : m.to] : [], note: parts.join(' ') };
    },
    bare() { // only kings, or a king and one minor piece against a bare king
      const rest = this.b.filter(v => v && this.type(v) !== CH.K);
      return !rest.length || (rest.length === 1 && [CH.B, CH.N].includes(this.type(rest[0])));
    },
    result(pl) {
      if (!this.legal(pl).length) return this.inCheck(pl)
        ? { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate! You win.' }
        : { winner: -1, text: pl === 0 ? 'You have no legal move but are not in check: stalemate, a draw.' : 'The Scribe has no legal move but is not in check: stalemate, a draw.' };
      if (this.bare()) return { winner: -1, text: 'Neither side has enough left to checkmate. The game is drawn.' };
      if (this.quiet >= 100) return { winner: -1, text: 'Fifty moves each with no capture or pawn move. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.quiet, this.ply, this.ep, this.castle.map(x => x.slice())]; },
    restore(s) { this.b = s[0].slice(); this.quiet = s[1]; this.ply = s[2]; this.ep = s[3]; this.castle = s[4].map(x => x.slice()); },
    turns(pl) {
      const v = m => (m.cap ? CH_VALUE[this.type(m.cap)] * 10 - CH_VALUE[this.type(this.b[m.from])] : 0) + (m.promo ? 80 : 0);
      return this.legal(pl).sort((a, b) => v(b) - v(a)).map(m => [m]);
    },
    terminal(pl, depth) {
      // A side with no legal move: checkmate is a loss, stalemate a draw. Found by the move list itself.
      if (this.quiet >= 100 || this.bare()) return 0;
      return null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v) continue;
        const o = this.owner(v), t = this.type(v), r = i >> 3, c = i & 7, adv = o === 0 ? r : 7 - r;
        let val = CH_VALUE[t];
        const centre = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5));
        if (t === CH.P) val += 0.05 * adv + (c >= 2 && c <= 5 ? 0.02 * adv : 0);
        if (t === CH.N || t === CH.B) val += 0.1 * centre - (adv === 0 ? 0.15 : 0);
        if (t === CH.K) val += this.count(1 - o) > 7 ? (adv === 0 && (c <= 2 || c >= 6) ? 0.3 : -0.1 * adv) : 0.05 * centre;
        s += o === pl ? val : -val;
      }
      return s + (this.inCheck(1 - pl) ? 0.2 : 0);
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 5); },
  };

  /* ------------------------------------------------------------------ Shogi
   * 9 x 9, index r*9+c, rank 0 nearest the visitor (sente, moving up). A
   * square holds 0 or type (1-8) + 16 if promoted + 32 if the Scribe's.
   * Types: 1 pawn, 2 lance, 3 knight, 4 silver, 5 gold, 6 bishop, 7 rook,
   * 8 king. hands[pl][type - 1] counts captured pieces ready to drop. */
  const SG = { P: 1, L: 2, N: 3, S: 4, G: 5, B: 6, R: 7, K: 8 };
  const SG_VAL = [0, 1, 3, 4, 5, 6, 8, 10, 0];
  const SG_PROMO_VAL = [0, 5, 6, 6, 6, 6, 10, 12, 0];
  const sgType = v => v & 15, sgPro = v => (v & 16) !== 0, sgOwner = v => (v & 32 ? 1 : 0);
  const SG_ALL8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  // Step moves for a piece of this kind, with f = +1 for the visitor, -1 for the Scribe.
  function sgSteps(t, pro, f) {
    const gold = [[f, 0], [f, -1], [f, 1], [0, -1], [0, 1], [-f, 0]];
    if (pro && t <= 4) return gold;
    if (t === SG.G) return gold;
    if (t === SG.S) return [[f, 0], [f, -1], [f, 1], [-f, -1], [-f, 1]];
    if (t === SG.K) return SG_ALL8;
    if (t === SG.P) return [[f, 0]];
    if (t === SG.N) return [[2 * f, -1], [2 * f, 1]];
    if (t === SG.B && pro) return [[1, 0], [-1, 0], [0, 1], [0, -1]];
    if (t === SG.R && pro) return [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    return [];
  }
  function sgSlides(t, pro, f) {
    if (t === SG.L && !pro) return [[f, 0]];
    if (t === SG.B) return [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    if (t === SG.R) return [[1, 0], [-1, 0], [0, 1], [0, -1]];
    return [];
  }
  const SHOGI = {
    id: 'shogi', name: 'Shogi', dice: false, first: 0, SG,
    rules: [
      'You move first, with the pieces pointing away from you. Checkmate the Scribe\'s king to win.',
      'King: one step any way. Gold: one step any way but diagonally back. Silver: one step forward or diagonally. Knight: two forward and one across, jumping. Lance: any distance straight forward. Bishop and rook: as in chess. Pawn: one step forward, and it captures the same way.',
      'A piece that moves into, out of or within the far three ranks is promoted. Pawns, lances, knights and silvers then move like golds; bishops and rooks gain the king\'s step as well. Here a piece always promotes when it can.',
      'Drops: a piece you capture becomes yours. On a later turn, instead of moving, you can put it on any empty square: pick it from your hand at the right, then a ring. You may not drop a pawn on a file where you already have an unpromoted pawn, drop a piece where it could never move, or give checkmate by dropping a pawn.',
      'House rule: after 150 moves each the game is drawn.'
    ],
    source: 'Modern shogi, except that promotion is automatic and repetition (sennichite) is replaced by a move limit.',
    init() {
      const b = Array(81).fill(0), back = [SG.L, SG.N, SG.S, SG.G, SG.K, SG.G, SG.S, SG.N, SG.L];
      back.forEach((t, c) => { b[c] = t; b[72 + c] = t + 32; });
      b[9 + 1] = SG.B; b[9 + 7] = SG.R; b[63 + 1] = SG.R + 32; b[63 + 7] = SG.B + 32;
      for (let c = 0; c < 9; c++) { b[18 + c] = SG.P; b[54 + c] = SG.P + 32; }
      this.b = b; this.hands = [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]]; this.ply = 0;
    },
    zone: (pl, r) => (pl === 0 ? r >= 6 : r <= 2),
    count(pl) { let n = 0; for (const v of this.b) if (v && sgOwner(v) === pl) n++; return n + this.hands[pl].reduce((a, b) => a + b, 0); },
    // Is square sq attacked by player `by`? Looks outward from sq for anything that could reach it.
    attacked(sq, by) {
      const b = this.b, r = (sq / 9) | 0, c = sq % 9, f = by === 0 ? 1 : -1;
      for (const [dr, dc] of SG_ALL8.concat([[2 * f, -1], [2 * f, 1]])) {
        const ar = r - dr, ac = c - dc; if (ar < 0 || ar > 8 || ac < 0 || ac > 8) continue;
        const v = b[ar * 9 + ac]; if (!v || sgOwner(v) !== by) continue;
        if (sgSteps(sgType(v), sgPro(v), f).some(([x, y]) => x === dr && y === dc)) return true;
      }
      for (const [dr, dc] of SG_ALL8) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 9 && cc >= 0 && cc < 9) {
          const v = b[rr * 9 + cc];
          if (v) {
            if (sgOwner(v) === by && sgSlides(sgType(v), sgPro(v), f).some(([x, y]) => x === -dr && y === -dc)) return true;
            break;
          }
          rr += dr; cc += dc;
        }
      }
      return false;
    },
    king(pl) { return this.b.indexOf(SG.K + (pl ? 32 : 0)); },
    inCheck(pl) { const k = this.king(pl); return k < 0 || this.attacked(k, 1 - pl); },
    pseudo(pl) {
      const b = this.b, f = pl === 0 ? 1 : -1, out = [];
      for (let i = 0; i < 81; i++) {
        const v = b[i]; if (!v || sgOwner(v) !== pl) continue;
        const t = sgType(v), pro = sgPro(v), r = (i / 9) | 0, c = i % 9;
        const add = (rr, cc) => {
          if (rr < 0 || rr > 8 || cc < 0 || cc > 8) return false;
          const to = rr * 9 + cc, w = b[to];
          if (w && sgOwner(w) === pl) return false;
          const promo = !pro && t !== SG.G && t !== SG.K && (this.zone(pl, r) || this.zone(pl, rr));
          out.push({ pl, from: i, to, cap: w, promo });
          return !w;
        };
        for (const [dr, dc] of sgSteps(t, pro, f)) add(r + dr, c + dc);
        for (const [dr, dc] of sgSlides(t, pro, f)) { let rr = r + dr, cc = c + dc; while (add(rr, cc)) { rr += dr; cc += dc; } }
      }
      const hand = this.hands[pl], last = pl === 0 ? 8 : 0, last2 = pl === 0 ? 7 : 1;
      for (let t = 1; t <= 7; t++) {
        if (!hand[t - 1]) continue;
        for (let i = 0; i < 81; i++) {
          if (b[i]) continue;
          const r = (i / 9) | 0, c = i % 9;
          if ((t === SG.P || t === SG.L) && r === last) continue;
          if (t === SG.N && (r === last || r === last2)) continue;
          if (t === SG.P) { let two = false; for (let rr = 0; rr < 9; rr++) if (b[rr * 9 + c] === SG.P + (pl ? 32 : 0)) { two = true; break; } if (two) continue; }
          out.push({ pl, drop: t, to: i, cap: 0 });
        }
      }
      return out;
    },
    raw(m) {
      const b = this.b, pl = m.pl;
      if (m.drop) { b[m.to] = m.drop + (pl ? 32 : 0); this.hands[pl][m.drop - 1]--; }
      else {
        const v = b[m.from];
        if (m.cap) this.hands[pl][sgType(m.cap) - 1]++;
        b[m.to] = m.promo ? v | 16 : v; b[m.from] = 0;
      }
      this.ply++;
    },
    legal(pl) {
      const out = [], check = this.inCheck(pl);
      for (const m of this.pseudo(pl)) {
        if (m.drop && !check && m.drop !== SG.P) { out.push(m); continue; }
        const s = this.snapshot(); this.raw(m);
        let ok = !this.inCheck(pl);
        // No checkmate by dropping a pawn.
        if (ok && m.drop === SG.P && this.inCheck(1 - pl) && !this.legal(1 - pl).length) ok = false;
        this.restore(s);
        if (ok) out.push(m);
      }
      return out;
    },
    pieceName(v) { const t = sgType(v), pro = sgPro(v); return pro ? ['', 'tokin', 'promoted lance', 'promoted knight', 'promoted silver', '', 'horse', 'dragon'][t] : ['', 'pawn', 'lance', 'knight', 'silver', 'gold', 'bishop', 'rook', 'king'][t]; },
    apply(m) {
      const name = m.cap ? this.pieceName(m.cap) : '';
      this.raw(m);
      const parts = [];
      if (m.cap) parts.push(m.pl === 0 ? `You take the Scribe's ${name}; it joins your hand.` : `The Scribe takes your ${name}.`);
      if (m.drop && m.pl === 1) parts.push(`The Scribe drops a ${this.pieceName(m.drop)}.`);
      if (m.promo) parts.push(m.pl === 0 ? 'Your piece is promoted.' : 'The Scribe\'s piece is promoted.');
      if (this.inCheck(1 - m.pl)) parts.push(m.pl === 0 ? 'Check.' : 'Check! Your king is attacked.');
      return { caps: m.cap ? [m.to] : [], note: parts.join(' ') };
    },
    result(pl) {
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate! You win.' };
      if (this.ply >= 300) return { winner: -1, text: 'A hundred and fifty moves each. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.hands.map(h => h.slice()), this.ply]; },
    restore(s) { this.b = s[0].slice(); this.hands = s[1].map(h => h.slice()); this.ply = s[2]; },
    value(v) { return sgPro(v) ? SG_PROMO_VAL[sgType(v)] : SG_VAL[sgType(v)]; },
    turns(pl) {
      const key = m => (m.cap ? this.value(m.cap) * 10 : 0) + (m.promo ? 3 : 0) - (m.drop ? 1 : 0);
      const ms = this.legal(pl).sort((a, b) => key(b) - key(a));
      // Keep the search to the likelier drops: those near the action.
      const kings = [this.king(0), this.king(1)];
      return ms.filter(m => !m.drop || ms.length < 60 || kings.some(k => k >= 0 && Math.abs(((k / 9) | 0) - ((m.to / 9) | 0)) <= 2 && Math.abs((k % 9) - (m.to % 9)) <= 2)).map(m => [m]);
    },
    terminal(pl) { return this.ply >= 300 ? 0 : null; },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 81; i++) {
        const v = this.b[i]; if (!v) continue;
        const o = sgOwner(v), r = (i / 9) | 0, adv = o === 0 ? r : 8 - r;
        let val = this.value(v);
        if (sgType(v) !== SG.K) val += 0.03 * adv;
        s += o === pl ? val : -val;
      }
      for (const o of [0, 1]) this.hands[o].forEach((n, k) => { s += (o === pl ? 1 : -1) * n * SG_VAL[k + 1] * 1.1; });
      // A king with gold and silver guards beside it.
      for (const o of [0, 1]) { const k = this.king(o); if (k < 0) continue; let g = 0; const r = (k / 9) | 0, c = k % 9; for (const [dr, dc] of SG_ALL8) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 9 && cc >= 0 && cc < 9) { const v = this.b[rr * 9 + cc]; if (v && sgOwner(v) === o) g++; } } s += (o === pl ? 1 : -1) * 0.25 * Math.min(g, 4); }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

  /* ---------------------------------------------------------------- Yut Nori
   * 29 stations. The outer square is 0-19, run anticlockwise from the start
   * corner 0 (near right): corners at 5 (far right), 10 (far left) and 15
   * (near left). The diagonal from 5 to 15 is 20, 21, centre 22, 23, 24; the
   * diagonal from 10 to 0 is 25, 26, 22, 27, 28. A piece off the board is -1,
   * a piece home is YT_HOME. A piece that STARTS its move on a corner or the
   * centre takes the shortcut. */
  const YT_HOME = 29;
  const YT_NAMES = ['mo', 'do', 'gae', 'geol', 'yut'];
  function ytRoute(s) {
    const tail = a => a.concat([YT_HOME]);
    const outer = from => { const r = []; for (let k = from + 1; k <= 19; k++) r.push(k); return tail(r.concat([0])); };
    if (s === -1) return outer(0);
    if (s === 0) return [YT_HOME];
    if (s === 5) return [20, 21, 22, 23, 24].concat(outer(14).slice(0));
    if (s === 10) return tail([25, 26, 22, 27, 28, 0]);
    if (s === 22) return tail([27, 28, 0]);
    if (s === 20 || s === 21) return [20, 21, 22, 23, 24].slice(s - 19).concat(outer(14));
    if (s === 23 || s === 24) return [24].slice(s - 23).concat(outer(14));
    if (s === 25 || s === 26) return tail([26, 22, 27, 28, 0].slice(s - 25));
    if (s === 27 || s === 28) return tail([28, 0].slice(s - 27));
    return outer(s);
  }
  const YUT = {
    id: 'yut', name: 'Yut Nori', dice: true, N: 4, first: 0, sides: ['red pieces', 'blue pieces'], HOME: YT_HOME, route: ytRoute,
    rules: [
      'Throw the four sticks and count the flat sides that land up: one is do (1 step), two gae (2), three geol (3), four yut (4), and none is mo (5).',
      'Enter a new piece or move one already on the board, anticlockwise from the start corner near you on the right.',
      'A piece that starts its move on a corner or on the centre takes the shortcut across the board instead.',
      'Land on your own piece and they stack, moving together from then on. Land on the Scribe\'s and they all go back off the board.',
      'Throwing yut or mo, or capturing, earns another throw. A piece goes home when it moves past the start corner. Bring all four home first to win.'
    ],
    source: 'Common modern rules for two sides. Each throw is moved at once rather than saved up, and there is no back-do.',
    init() { this.pos = [[-1, -1, -1, -1], [-1, -1, -1, -1]]; },
    roll() { const f = [0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0)); const n = f.reduce((a, b) => a + b, 0); return { faces: f, value: n || 5 }; },
    rollName: r => `${YT_NAMES[r.value % 5]} (${r.value})`,
    legal(pl, v) {
      const moves = [], seen = new Set();
      this.pos[pl].forEach((p, i) => {
        if (p === YT_HOME) return;
        const key = p === -1 ? 'off' : p; if (seen.has(key)) return; seen.add(key);
        const route = ytRoute(p), path = route.slice(0, v);
        const to = path[path.length - 1];
        const group = p === -1 ? [i] : this.pos[pl].map((q, k) => (q === p ? k : -1)).filter(k => k >= 0);
        const cap = to === YT_HOME ? [] : this.pos[1 - pl].map((q, k) => (q === to ? k : -1)).filter(k => k >= 0);
        moves.push({ pl, i, from: p, to, path, group, cap, value: v });
      });
      return moves;
    },
    steps(m) { return m.path; },
    apply(m) {
      const moved = [];
      for (const k of m.group) { this.pos[m.pl][k] = m.to; if (k !== m.i) moved.push({ pl: m.pl, i: k }); }
      for (const k of m.cap) { this.pos[1 - m.pl][k] = -1; moved.push({ pl: 1 - m.pl, i: k }); }
      // Pieces already waiting on the landing station join the stack where they are.
      let note = '';
      if (m.cap.length) note = m.pl === 0 ? `Caught! ${m.cap.length > 1 ? 'The Scribe\'s stack goes' : 'The Scribe\'s piece goes'} back off the board.` : `The Scribe catches ${m.cap.length > 1 ? 'your stack' : 'your piece'}.`;
      else if (m.to === YT_HOME) note = m.pl === 0 ? (m.group.length > 1 ? `${m.group.length} pieces home.` : 'A piece home.') : 'The Scribe brings a piece home.';
      else if (m.from !== -1 && this.pos[m.pl].filter(q => q === m.to).length > m.group.length) note = m.pl === 0 ? 'Stacked: they travel together now.' : 'The Scribe stacks its pieces.';
      else if ([5, 10, 22].includes(m.to)) note = m.pl === 0 ? 'On a shortcut point: next move cuts across.' : '';
      return { moved, note };
    },
    extra(m) { return m.cap.length > 0 || m.value >= 4; },
    extraNote: 'Throw again.',
    done(pl) { return this.pos[pl].every(p => p === YT_HOME); },
    home(pl) { return this.pos[pl].filter(p => p === YT_HOME).length; },
    // How far a piece still has to go: the length of its route home.
    left(p) { return p === YT_HOME ? 0 : ytRoute(p).length; },
    danger(pl, sq) { // chance the other side can land on sq next throw
      if (sq === YT_HOME || sq === -1) return 0;
      const P = [0, 4 / 16, 6 / 16, 4 / 16, 1 / 16, 1 / 16];
      let d = 0;
      for (const q of new Set(this.pos[1 - pl])) { if (q === YT_HOME) continue; const r = ytRoute(q); for (let v = 1; v <= 5; v++) if (r[v - 1] === sq) d += P[v]; }
      return Math.min(1, d);
    },
    ai(moves) {
      let best = moves[0], bs = -1e9;
      for (const m of moves) {
        let s = 0;
        const n = m.group.length;
        if (m.to === YT_HOME) s += 40 * n;
        s += m.cap.length * (30 + 4 * m.cap.reduce((a, k) => a + (20 - this.left(this.pos[1 - m.pl][k])), 0) / Math.max(1, m.cap.length));
        s += (this.left(m.from) - this.left(m.to)) * 2 * n;
        if ([5, 10, 22].includes(m.to)) s += 10;
        if (m.to !== YT_HOME && this.pos[m.pl].some((q, k) => q === m.to && !m.group.includes(k))) s += 8;
        s -= this.danger(m.pl, m.to) * 30 * n;
        s += this.danger(m.pl, m.from) * 18 * n;
        s += Math.random() * pick(30, 6, 0.5);
        if (s > bs) { bs = s; best = m; }
      }
      return best;
    },
    aiPlan(pl, moves) { return [this.ai(moves)]; },
  };

  /* ----------------------------------------------------------------- Pachisi
   * A cross of four arms (0 near, 1 right, 2 far, 3 left: anticlockwise seen
   * from above), each 3 columns wide and 8 squares long, round the Charkoni.
   * A cell is arm*24 + k*3 + (j+1): k counts out from the centre (0-7), j is
   * -1, 0 or +1 across the arm, +1 being the side toward the next arm.
   * Each piece's route has 84 steps: 0 is the Charkoni before it sets out,
   * 1-83 the squares, 84 home again. Two players: the visitor plays the near
   * and far colours (partners), the Scribe the left and right. */
  const PC_HOME = 84;
  const pcCell = (a, k, j) => (((a % 4) + 4) % 4) * 24 + k * 3 + (j + 1);
  const PC_ROUTE = [0, 1, 2, 3].map(a => {
    const r = [null];
    for (let k = 0; k <= 7; k++) r.push(pcCell(a, k, 0));
    for (let k = 7; k >= 0; k--) r.push(pcCell(a, k, 1));
    for (let n = 1; n <= 3; n++) { const b = a + n; for (let k = 0; k <= 7; k++) r.push(pcCell(b, k, -1)); r.push(pcCell(b, 7, 0)); for (let k = 7; k >= 0; k--) r.push(pcCell(b, k, 1)); }
    for (let k = 0; k <= 7; k++) r.push(pcCell(a, k, -1));
    r.push(pcCell(a, 7, 0));
    for (let k = 6; k >= 0; k--) r.push(pcCell(a, k, 0));
    return r; // r[84] is undefined: home
  });
  const pcCastle = cell => { const k = ((cell % 24) / 3) | 0, j = (cell % 3) - 1; return (k === 7 && j === 0) || (k === 4 && j !== 0); };
  const PC_ARMS = [[0, 2], [1, 3]]; // the visitor's two colours, the Scribe's two
  const PC_VAL = [25, 10, 2, 3, 4, 5, 6]; // by the number of cowries landing mouth up
  const PACHISI = {
    id: 'pachisi', name: 'Pachisi', dice: true, N: 4, first: 0, HOME: PC_HOME, ROUTE: PC_ROUTE, castle: pcCastle, ARMS: PC_ARMS,
    sides: ['yellow and blue pieces', 'green and cream pieces'],
    variants: [{ id: 'short', label: 'Short game' }, { id: 'full', label: 'Full game' }],
    variant: 'short', variantLabel: 'Pieces',
    per: 2, // pieces per colour: 2 in the short game, 4 in the full one
    setVariant(id) { this.variant = id === 'full' ? 'full' : 'short'; this.per = this.variant === 'full' ? 4 : 2; this.N = 2 * this.per; },
    rules: [
      'You play two colours as partners: yellow, from the near arm, and blue, from the far arm. The Scribe plays green and cream.',
      'Throw six cowries and count those landing mouth up: 2, 3, 4 or 5 move that many squares; one up is 10, none is 25 and all six is 6. A 6, 10 or 25 is a grace: it can bring a piece out of the Charkoni onto the first square, and it earns another throw.',
      'Each piece goes down the middle of its own arm, anticlockwise round the outside of the cross, and back up its own middle into the Charkoni, which needs an exact throw. No throw is 1, so a piece may not stop on the last square before home.',
      'Land on an enemy piece to send it back to the Charkoni, and throw again. Pieces on the twelve castle squares, marked with a cross, are safe, and you may not land on a castle held by the enemy.',
      'Bring all your pieces home first to win. The short game gives each colour two pieces, the full game four.'
    ],
    source: 'The common rules with six cowries (pachisi has no single standard). As in some versions, each colour\'s first piece may come out on any throw; later ones need a grace. Each throw is moved at once rather than collected first, and the short game uses two pieces per colour so it fits a visit to the Archives.',
    init() { this.pos = [Array(this.N).fill(0), Array(this.N).fill(0)]; },
    arm(pl, i) { return PC_ARMS[pl][i < this.per ? 0 : 1]; },
    cellOf(pl, i, idx) { return idx <= 0 || idx >= PC_HOME ? -1 : PC_ROUTE[this.arm(pl, i)][idx]; },
    roll() {
      const f = [0, 0, 0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0)), n = f.reduce((a, b) => a + b, 0);
      return { faces: f, value: PC_VAL[n] };
    },
    rollName: r => `${r.value}${[6, 10, 25].includes(r.value) ? ', a grace' : ''}`,
    grace: v => v === 6 || v === 10 || v === 25,
    enemiesAt(pl, cell) { const out = []; this.pos[1 - pl].forEach((q, k) => { if (this.cellOf(1 - pl, k, q) === cell) out.push(k); }); return out; },
    legal(pl, v) {
      const moves = [], seen = new Set();
      this.pos[pl].forEach((p, i) => {
        if (p === PC_HOME) return;
        const key = this.arm(pl, i) + ':' + p; if (seen.has(key)) return; seen.add(key);
        let to;
        if (p === 0) {
          // A colour's first piece out may use any throw; after that, coming out needs a grace.
          const colourOut = this.pos[pl].some((q, k) => k !== i && this.arm(pl, k) === this.arm(pl, i) && q !== 0);
          if (colourOut && !this.grace(v)) return;
          to = 1;
        } else to = p + v;
        if (to > PC_HOME || to === PC_HOME - 1) return; // no throw is 1, so the last square before home is a dead end
        const cell = this.cellOf(pl, i, to), foes = cell < 0 ? [] : this.enemiesAt(pl, cell);
        if (foes.length && pcCastle(cell)) return; // an enemy castle cannot be entered
        moves.push({ pl, i, from: p, to, cap: foes, value: v });
      });
      return moves;
    },
    steps(m) { const s = []; for (let k = Math.max(1, m.from + 1); k <= m.to; k++) s.push(k); return s.length ? s : [m.to]; },
    apply(m) {
      this.pos[m.pl][m.i] = m.to; const moved = [];
      for (const k of m.cap) { this.pos[1 - m.pl][k] = 0; moved.push({ pl: 1 - m.pl, i: k }); }
      let note = '';
      if (m.cap.length) note = m.pl === 0 ? `Captured! ${m.cap.length > 1 ? 'Those pieces go' : 'The piece goes'} back to the Charkoni.` : 'The Scribe sends your piece back to the Charkoni.';
      else if (m.to === PC_HOME) note = m.pl === 0 ? 'Home in the Charkoni.' : 'The Scribe brings a piece home.';
      else if (m.from === 0) note = m.pl === 0 ? 'A piece comes out.' : 'The Scribe brings a piece out.';
      return { moved, note };
    },
    extra(m) { return this.grace(m.value) || m.cap.length > 0; },
    extraNote: 'Throw again.',
    done(pl) { return this.pos[pl].every(p => p === PC_HOME); },
    home(pl) { return this.pos[pl].filter(p => p === PC_HOME).length; },
    danger(pl, i, idx) { // chance an enemy can land here next throw
      const cell = this.cellOf(pl, i, idx); if (cell < 0 || pcCastle(cell)) return 0;
      const P = { 2: 0.234, 3: 0.312, 4: 0.234, 5: 0.094, 6: 0.016, 10: 0.094, 25: 0.016 };
      let d = 0;
      this.pos[1 - pl].forEach((q, k) => { if (q <= 0 || q >= PC_HOME) return; for (const v in P) if (this.cellOf(1 - pl, k, q + +v) === cell) d += P[v]; });
      return Math.min(1, d);
    },
    ai(moves) {
      let best = moves[0], bs = -1e9;
      for (const m of moves) {
        let s = (m.to - Math.max(0, m.from)) * 0.4;
        if (m.from === 0) s += 14;
        if (m.to === PC_HOME) s += 40;
        s += m.cap.reduce((a, k) => a + 20 + this.pos[1 - m.pl][k] * 0.5, 0);
        const cell = this.cellOf(m.pl, m.i, m.to);
        if (cell >= 0 && pcCastle(cell)) s += 8;
        s -= this.danger(m.pl, m.i, m.to) * (12 + m.to * 0.35);
        if (m.from > 0) s += this.danger(m.pl, m.i, m.from) * (10 + m.from * 0.3);
        s += Math.random() * pick(30, 5, 0.5);
        if (s > bs) { bs = s; best = m; }
      }
      return best;
    },
    aiPlan(pl, moves) { return [this.ai(moves)]; },
  };

  /* ----------------------------------------------------------------- Mahjong
   * 136 tiles, each an id 0-135 whose type is id >> 2: 0-8 dots 1-9, 9-17
   * bamboo, 18-26 characters, 27-30 winds (east, south, west, north), 31-33
   * dragons (red, green, white). Four seats: 0 is the visitor (East, the
   * dealer); 1, 2 and 3 are Scribes, and play passes 0, 1, 2, 3. In the
   * Archives' two-sided turns, "player 1" is the three Scribes together:
   * everything that happens between the visitor's decisions is one Scribe turn. */
  const MJ_SEATS = ['East', 'South', 'West', 'North'];
  const MJ_TERM = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  const mjCounts = ids => { const c = new Array(34).fill(0); for (const id of ids) c[id >> 2]++; return c; };
  function mjShantenStd(c, open) {
    let best = 8;
    const dfs = (i, m, t, p) => {
      while (i < 34 && !c[i]) i++;
      if (i >= 34) { const mm = m + open, tt = Math.min(t, 4 - mm); const v = 8 - 2 * mm - tt - p; if (v < best) best = v; return; }
      if (c[i] >= 3) { c[i] -= 3; dfs(i, m + 1, t, p); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; dfs(i, m + 1, t, p); c[i]++; c[i + 1]++; c[i + 2]++; }
      if (!p && c[i] >= 2) { c[i] -= 2; dfs(i, m, t, 1); c[i] += 2; }
      if (c[i] >= 2) { c[i] -= 2; dfs(i, m, t + 1, p); c[i] += 2; }
      if (i < 27 && i % 9 <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; dfs(i, m, t + 1, p); c[i]++; c[i + 1]++; }
      if (i < 27 && i % 9 <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; dfs(i, m, t + 1, p); c[i]++; c[i + 2]++; }
      const keep = c[i]; c[i] = 0; dfs(i + 1, m, t, p); c[i] = keep;
    };
    dfs(0, 0, 0, 0);
    return best;
  }
  // How many tiles from ready (0) or complete (-1) a hand is, counting seven pairs and thirteen orphans too.
  function mjShanten(ids, open) {
    const c = mjCounts(ids);
    let s = mjShantenStd(c, open);
    if (!open) {
      let pairs = 0, kinds = 0; for (const n of c) { if (n) kinds++; if (n >= 2) pairs++; }
      s = Math.min(s, 6 - pairs + Math.max(0, 7 - kinds));
      let t = 0, tp = 0; for (const k of MJ_TERM) { if (c[k]) t++; if (c[k] >= 2) tp = 1; }
      s = Math.min(s, 13 - t - tp);
    }
    return s;
  }
  const mjName = t => (t < 27 ? `${(t % 9) + 1} ${['dots', 'bamboo', 'characters'][(t / 9) | 0]}` : ['east wind', 'south wind', 'west wind', 'north wind', 'red dragon', 'green dragon', 'white dragon'][t - 27]);
  const MAHJONG = {
    id: 'mahjong', name: 'Mahjong', dice: false, first: 0, SEATS: MJ_SEATS, shanten: mjShanten, tileName: mjName,
    followPrompt: 'Now discard a tile.',
    rules: [
      'You sit at East, nearest the table\'s front, against three Scribes. Each hand is thirteen tiles; on your turn you draw a fourteenth and discard one by clicking it.',
      'Go out with four sets and a pair: a set is a pung (three alike), a kong (four alike) or a chow (a run of three in one suit). Seven pairs, or one of each terminal and honour plus one more (thirteen orphans), also win.',
      'You can claim another player\'s discard to win, or to make a pung or kong; a chow only from the player on your left (North). The buttons show what you can claim. A win beats a pung or kong, which beats a chow.',
      'Declare a kong of four alike from your hand with its button; you then draw a replacement tile.',
      'The first to go out wins the hand. If the wall runs out first, the hand is drawn. Scoring varies so much between rule sets that the Archives leave it out.'
    ],
    source: 'Common modern rules for 136 tiles without flowers. Scoring is left out: whoever goes out first wins.',
    init() {
      const wall = Array.from({ length: 136 }, (_, i) => i);
      for (let i = wall.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [wall[i], wall[j]] = [wall[j], wall[i]]; }
      this.wall = wall; this.hands = [[], [], [], []]; this.melds = [[], [], [], []]; this.discards = [[], [], [], []];
      for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) this.hands[s].push(this.wall.shift());
      this.hands[0].push(this.wall.shift());
      this.hands.forEach(h => h.sort((a, b) => a - b));
      this.need = { type: 'discard', seat: 0 }; this.winner = null; this.how = '';
    },
    open(seat) { return this.melds[seat].length; },
    tilesOf(seat) { return this.hands[seat].map(id => id >> 2); },
    complete(seat, extra) { const ids = extra === undefined ? this.hands[seat] : this.hands[seat].concat([extra]); return mjShanten(ids, this.open(seat)) === -1; },
    // Kongs the seat may declare from its own hand: four alike, or the fourth tile of a pung it already shows.
    ownKongs(seat) {
      const c = mjCounts(this.hands[seat]), out = [];
      c.forEach((n, t) => { if (n === 4) out.push({ kind: 'ckong', seat, type: t }); });
      for (const m of this.melds[seat]) if (m.type === 'pung' && c[m.tiles[0] >> 2]) out.push({ kind: 'akong', seat, type: m.tiles[0] >> 2 });
      return out;
    },
    // What each seat could do with a discard.
    claimsFor(seat, d) {
      const t = d.tile >> 2, own = this.hands[seat].filter(id => id >> 2 === t), out = [];
      if (this.complete(seat, d.tile)) out.push({ kind: 'ron', seat, pri: 3 });
      if (own.length >= 3) out.push({ kind: 'kong', seat, pri: 2, use: own.slice(0, 3) });
      if (own.length >= 2) out.push({ kind: 'pung', seat, pri: 2, use: own.slice(0, 2) });
      if (seat === (d.seat + 1) % 4 && t < 27) {
        const n = t % 9, has = k => this.hands[seat].find(id => id >> 2 === k);
        for (const [a, b] of [[-2, -1], [-1, 1], [1, 2]]) {
          if (n + a < 0 || n + b > 8) continue;
          const x = has(t + a), y = has(t + b);
          if (x !== undefined && y !== undefined) out.push({ kind: 'chow', seat, pri: 1, use: [x, y], run: [t + a, t, t + b].sort((p, q) => p - q) });
        }
      }
      return out;
    },
    // The Scribes' choice of claim on a discard, if any (the strongest, nearest in turn order for a win).
    aiClaim(d) {
      let best = null;
      for (let k = 1; k <= 3; k++) {
        const seat = (d.seat + k) % 4; if (seat === 0) continue;
        for (const c of this.claimsFor(seat, d)) {
          if (!this.aiWants(seat, c, d)) continue;
          if (!best || c.pri > best.pri) best = Object.assign({}, c, { order: k });
        }
      }
      return best;
    },
    aiWants(seat, c, d) {
      if (c.kind === 'ron') return true;
      const lv = LEVEL.name;
      if (lv === 'gentle' && Math.random() < 0.5) return false;
      const before = mjShanten(this.hands[seat], this.open(seat));
      const rest = this.hands[seat].filter(id => !c.use.includes(id));
      // After the claim the seat discards; take the claim if that leaves it closer to winning.
      let after = 9; for (const id of rest) { const r = rest.filter(x => x !== id); after = Math.min(after, mjShanten(r, this.open(seat) + 1)); }
      if (c.kind === 'kong') return after <= before && lv !== 'gentle';
      return after < before || (lv === 'gentle' && after <= before);
    },
    // Set up the claim phase for a discard: decide the Scribes' claim, and what the visitor may claim over it.
    openClaims(d) {
      const ai = this.aiClaim(d);
      let mine = d.seat === 0 ? [] : this.claimsFor(0, d);
      if (ai) mine = mine.filter(c => c.pri > ai.pri || (c.kind === 'ron' && ai.kind === 'ron' && ((0 - d.seat + 4) % 4) < ai.order));
      this.need = { type: 'claim', d, ai, mine, passed: !mine.length };
    },
    label(m) {
      const t = m.type !== undefined ? m.type : this.need.d ? this.need.d.tile >> 2 : 0;
      return { tsumo: 'Mahjong! Declare the win', ron: 'Mahjong! Win on this tile', pung: 'Pung', kong: 'Kong', pass: 'Pass', ckong: `Kong (${mjName(t)})`, akong: `Add to kong (${mjName(t)})` }[m.kind] || (m.kind === 'chow' ? `Chow ${m.run.map(k => (k % 9) + 1).join('-')}` : '');
    },
    legal(pl) {
      if (pl !== 0 || this.winner !== null || this.need.type === 'over') return [];
      const n = this.need;
      if (n.type === 'discard' && n.seat === 0) {
        const out = this.hands[0].map(id => ({ pl: 0, kind: 'discard', seat: 0, tile: id }));
        if (this.complete(0)) out.push({ pl: 0, kind: 'tsumo', seat: 0 });
        if (this.wall.length) for (const k of this.ownKongs(0)) out.push(Object.assign({ pl: 0 }, k));
        out.forEach(m => { if (m.kind !== 'discard') m.label = this.label(m); });
        return out;
      }
      if (n.type === 'claim' && !n.passed) return n.mine.map(c => Object.assign({ pl: 0 }, c, { label: this.label(c) })).concat([{ pl: 0, kind: 'pass', seat: 0, label: 'Pass' }]);
      return [];
    },
    take(seat, ids) { this.hands[seat] = this.hands[seat].filter(id => !ids.includes(id)); },
    apply(m) {
      const S = MJ_SEATS, who = m.seat === 0 ? 'You' : S[m.seat];
      const res = { note: '' };
      switch (m.kind) {
        case 'draw': {
          if (!this.wall.length) { this.need = { type: 'over' }; res.note = 'The wall is empty.'; break; }
          const id = m.replacement ? this.wall.pop() : this.wall.shift();
          this.hands[m.seat].push(id); res.tile = id;
          this.need = { type: 'discard', seat: m.seat };
          break;
        }
        case 'discard': {
          this.take(m.seat, [m.tile]); this.discards[m.seat].push(m.tile);
          this.hands[m.seat].sort((a, b) => a - b);
          this.openClaims({ seat: m.seat, tile: m.tile });
          break;
        }
        case 'tsumo': this.winner = m.seat; this.how = 'self'; this.need = { type: 'over' }; res.note = m.seat === 0 ? 'Mahjong! You go out on your own draw.' : `${S[m.seat]} declares mahjong on its own draw.`; break;
        case 'ron': {
          const d = this.need.d; this.discards[d.seat].pop(); this.hands[m.seat].push(d.tile);
          this.winner = m.seat; this.how = d.seat; this.need = { type: 'over' };
          res.note = m.seat === 0 ? `Mahjong! You win on ${S[d.seat]}'s ${mjName(d.tile >> 2)}.` : `${S[m.seat]} wins on ${d.seat === 0 ? 'your' : S[d.seat] + '\'s'} ${mjName(d.tile >> 2)}.`;
          break;
        }
        case 'pung': case 'kong': case 'chow': {
          const d = this.need.d; this.discards[d.seat].pop();
          this.take(m.seat, m.use);
          const tiles = m.kind === 'chow' ? m.use.concat([d.tile]).sort((a, b) => (a >> 2) - (b >> 2)) : m.use.concat([d.tile]);
          this.melds[m.seat].push({ type: m.kind, tiles, open: true });
          this.need = m.kind === 'kong' ? { type: 'draw', seat: m.seat, replacement: true } : { type: 'discard', seat: m.seat };
          res.note = `${who} ${m.seat === 0 ? '' : ''}${m.kind === 'chow' ? 'chow' : m.kind}${m.seat === 0 ? '' : 's'} ${d.seat === 0 ? 'your' : S[d.seat] + '\'s'} ${mjName(d.tile >> 2)}.`;
          if (m.seat === 0 && m.kind !== 'kong') res.followUp = this.legal(0);
          break;
        }
        case 'ckong': {
          const ids = this.hands[m.seat].filter(id => id >> 2 === m.type); this.take(m.seat, ids);
          this.melds[m.seat].push({ type: 'kong', tiles: ids, open: false });
          this.need = { type: 'draw', seat: m.seat, replacement: true };
          res.note = m.seat === 0 ? 'You declare a kong.' : `${S[m.seat]} declares a kong.`;
          break;
        }
        case 'akong': {
          const id = this.hands[m.seat].find(x => x >> 2 === m.type); this.take(m.seat, [id]);
          const meld = this.melds[m.seat].find(x => x.type === 'pung' && x.tiles[0] >> 2 === m.type); meld.type = 'kong'; meld.tiles.push(id);
          this.need = { type: 'draw', seat: m.seat, replacement: true };
          res.note = m.seat === 0 ? 'You add the fourth tile to your pung.' : `${S[m.seat]} adds to its pung.`;
          break;
        }
        case 'pass': this.need.passed = true; break;
        case 'resolve': { // nobody claims the discard (or the Scribes' claim is not taken up): play moves on
          this.need = { type: 'draw', seat: (m.from + 1) % 4 };
          break;
        }
      }
      return res;
    },
    // One step of the Scribes' play from the current position.
    aiStep() {
      const n = this.need;
      if (n.type === 'draw') return { pl: 1, kind: 'draw', seat: n.seat, replacement: !!n.replacement };
      if (n.type === 'claim') {
        if (n.ai) return Object.assign({ pl: 1 }, n.ai);
        return { pl: 1, kind: 'resolve', seat: n.d.seat, from: n.d.seat };
      }
      // A Scribe to discard.
      const seat = n.seat, hand = this.hands[seat];
      if (this.complete(seat)) return { pl: 1, kind: 'tsumo', seat };
      if (this.wall.length && LEVEL.name !== 'gentle') { const k = this.ownKongs(seat)[0]; if (k) return Object.assign({ pl: 1 }, k); }
      return { pl: 1, kind: 'discard', seat, tile: this.chooseDiscard(seat) };
    },
    chooseDiscard(seat) {
      const hand = this.hands[seat], open = this.open(seat), lv = LEVEL.name;
      if (lv === 'gentle' && Math.random() < 0.4) return hand[(Math.random() * hand.length) | 0];
      // Tiles this seat can see: its own, every discard and every open meld.
      const seen = mjCounts(hand.concat(...this.discards, ...this.melds.map(ms => ms.flatMap(x => x.open ? x.tiles : [])).flat()));
      let best = null, bv = Infinity;
      const tried = new Set();
      for (const id of hand) {
        const t = id >> 2; if (tried.has(t)) continue; tried.add(t);
        const rest = hand.filter(x => x !== id), sh = mjShanten(rest, open);
        let v = sh * 1000;
        if (lv !== 'gentle') {
          // Prefer the discard that leaves the most tiles that would bring the hand closer.
          let wait = 0;
          for (let k = 0; k < 34; k++) { if (seen[k] >= 4) continue; if (mjShanten(rest.concat([k * 4]), open) < sh) wait += 4 - seen[k]; }
          v -= wait * (lv === 'sharp' ? 2 : 1);
          if (lv === 'sharp' && t >= 27 && seen[t] >= 3) v -= 3; // a safe, dead honour
        }
        v += Math.random() * 0.5;
        if (v < bv) { bv = v; best = id; }
      }
      return best;
    },
    result() {
      if (this.winner !== null) {
        const w = this.winner, S = MJ_SEATS;
        const how = this.how === 'self' ? 'on a self-drawn tile' : this.how === 0 ? 'on your discard' : `on ${S[this.how]}'s discard`;
        return { winner: w === 0 ? 0 : 1, text: w === 0 ? `You go out first, ${how}.` : `${S[w]} goes out first, ${how}.` };
      }
      if (this.need.type === 'over' || (this.need.type === 'draw' && !this.wall.length)) return { winner: -1, text: 'The wall ran out before anyone went out. The hand is drawn.' };
      return null;
    },
    snapshot() { return JSON.stringify({ w: this.wall, h: this.hands, m: this.melds, d: this.discards, n: this.need, x: this.winner, y: this.how }); },
    restore(s) { const o = JSON.parse(s); this.wall = o.w; this.hands = o.h; this.melds = o.m; this.discards = o.d; this.need = o.n; this.winner = o.x; this.how = o.y; },
    // Everything the Scribes do until the visitor has a decision to make, or the hand ends.
    aiPlan() {
      const root = this.snapshot(), plan = [];
      let guard = 0;
      while (this.winner === null && this.need.type !== 'over' && !this.legal(0).length && guard++ < 400) {
        if (this.need.type === 'draw' && !this.wall.length) { plan.push({ pl: 1, kind: 'draw', seat: this.need.seat }); this.need = { type: 'over' }; break; }
        const step = this.aiStep(); plan.push(step); this.apply(step);
        // The visitor's own draw is part of the Scribes' turn: it ends with the visitor holding 14 tiles.
      }
      this.restore(root);
      return plan;
    },
  };

  /* ------------------------------------------------------- Bao la Kujifunza
   * Each player owns a loop of 16 pits: 8 in the outer row and 8 in the inner
   * row facing the other player. A pit is identified as player*16 + L, where
   * L runs round the player's loop anticlockwise seen from above:
   *   visitor:  L 0-7 = outer row, columns 0-7 (left to right as seen by
   *             the visitor); L 8-15 = inner row, columns 7 down to 0.
   *   Scribe:   L 0-7 = outer row, columns 7 down to 0; L 8-15 = inner row,
   *             columns 0-7.
   * Direction +1 is anticlockwise, -1 clockwise. */
  const BAO_INNER = (pl, c) => pl * 16 + (pl === 0 ? 15 - c : 8 + c); // the inner-row pit in column c
  const baoCol = pit => { const pl = pit >> 4, L = pit & 15; return L < 8 ? (pl === 0 ? L : 7 - L) : (pl === 0 ? 15 - L : L - 8); };
  const baoInner = pit => (pit & 15) >= 8;
  const BAO = {
    id: 'bao', name: 'Bao la Kujifunza', dice: false, first: 0, INNER: BAO_INNER, col: baoCol,
    rules: [
      'You own the two rows nearest you: sixteen pits that you sow round as a loop, never into the Scribe\'s side. Every pit starts with two seeds.',
      'Pick up all the seeds of one of your pits holding two or more, and sow them one by one into the following pits, in either direction: pick a pit, then the ring on the side you want to sow toward.',
      'Capture: if your last seed lands in an occupied pit of your inner row, and the Scribe\'s pit opposite has seeds, take them. Sow them into your own pits starting from an end of your inner row (a kichwa): the nearer end if the capture was in one of the two pits at either end, otherwise the end that keeps your direction. If you can capture, you must.',
      'If your last seed lands in any other occupied pit, pick up everything there and keep sowing. The turn ends when a last seed falls into an empty pit. A turn that does not start with a capture captures nothing, and must start from your inner row if it can.',
      'You lose if your inner row is empty, or if you cannot move.'
    ],
    source: 'Bao la Kujifunza, the beginners\' Bao, as transcribed from Zanzibari masters: every seed starts on the board and the house (nyumba) has no special powers.',
    init() { this.p = new Array(32).fill(2); this.ply = 0; },
    count(pl) { let n = 0; for (let k = 0; k < 16; k++) n += this.p[pl * 16 + k]; return n; },
    innerCount(pl) { let n = 0; for (let k = 8; k < 16; k++) n += this.p[pl * 16 + k]; return n; },
    opposite(pit) { const pl = pit >> 4, c = baoCol(pit); return BAO_INNER(1 - pl, c); },
    next(pit, dir) { const pl = pit >> 4; return pl * 16 + (((pit & 15) + dir + 16) % 16); },
    // Where captured seeds start: the kichwa nearest a capture made at either end, else the one that keeps the direction.
    kichwa(pl, capPit, dir) {
      const c = baoCol(capPit);
      // Right kichwa (from the player's own seat) sows anticlockwise, left kichwa clockwise.
      const right = BAO_INNER(pl, pl === 0 ? 7 : 0), left = BAO_INNER(pl, pl === 0 ? 0 : 7);
      if (c <= 1 || c >= 6) { const near = BAO_INNER(pl, c <= 1 ? 0 : 7); return { pit: near, dir: near === right ? 1 : -1 }; }
      return dir === 1 ? { pit: right, dir: 1 } : { pit: left, dir: -1 };
    },
    // Play out a sowing from pit in dir. Returns the trace of pit changes; with apply false, the board is restored.
    sow(pl, pit, dir, capturing, trace) {
      let hand = this.p[pit]; this.p[pit] = 0; trace.push([pit, 0]);
      let at = pit, steps = 0, caps = 0, first = true, mtaji = capturing;
      for (;;) {
        while (hand > 0) { at = this.next(at, dir); this.p[at]++; hand--; trace.push([at, this.p[at]]); }
        if (++steps > 200) break; // a sowing that would never end
        if (this.p[at] === 1) break; // the last seed fell into an empty pit
        const opp = this.opposite(at);
        if (baoInner(at) && this.p[opp] > 0 && (mtaji === null ? first : mtaji)) {
          if (mtaji === null) mtaji = true;
          hand = this.p[opp]; caps += hand; this.p[opp] = 0; trace.push([opp, 0]);
          const k = this.kichwa(pl, at, dir); dir = k.dir;
          // The first captured seed goes into the kichwa itself.
          this.p[k.pit]++; hand--; at = k.pit; trace.push([at, this.p[at]]);
          first = false; continue;
        }
        if (mtaji === null) mtaji = false;
        hand = this.p[at]; this.p[at] = 0; trace.push([at, 0]); first = false;
      }
      return { mtaji: !!mtaji, caps };
    },
    capturesFirst(pl, pit, dir) { // does the opening sowing end in a capture?
      const n = this.p[pit], q = this.p.slice(); q[pit] = 0; let at = pit;
      for (let k = 0; k < n; k++) { at = this.next(at, dir); q[at]++; }
      return q[at] > 1 && baoInner(at) && q[this.opposite(at)] > 0;
    },
    legal(pl) {
      const starts = [];
      for (let L = 0; L < 16; L++) { const pit = pl * 16 + L; if (this.p[pit] >= 2) for (const dir of [1, -1]) starts.push({ pl, pit, dir }); }
      const cap = starts.filter(m => this.capturesFirst(pl, m.pit, m.dir));
      if (cap.length) return cap.map(m => Object.assign(m, { mtaji: true }));
      const inner = starts.filter(m => baoInner(m.pit));
      return (inner.length ? inner : starts).map(m => Object.assign(m, { mtaji: false }));
    },
    apply(m) {
      const trace = [], r = this.sow(m.pl, m.pit, m.dir, m.mtaji ? null : false, trace);
      this.ply++;
      return { trace, note: r.caps ? (m.pl === 0 ? `You capture ${r.caps} seeds.` : `The Scribe captures ${r.caps} of your seeds.`) : '' };
    },
    result(pl) {
      if (!this.innerCount(pl)) return { winner: 1 - pl, text: pl === 0 ? 'Your inner row is empty.' : 'The Scribe\'s inner row is empty.' };
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no pit with two seeds to sow.' : 'The Scribe has no pit with two seeds to sow.' };
      if (this.ply >= 200) { const a = this.count(0), b = this.count(1); return { winner: a > b ? 0 : b > a ? 1 : -1, text: `A hundred moves each. Seeds: you ${a}, the Scribe ${b}.` }; }
      return null;
    },
    snapshot() { return [this.p.slice(), this.ply]; },
    restore(s) { this.p = s[0].slice(); this.ply = s[1]; },
    turns(pl) { return this.legal(pl).map(m => [m]); },
    terminal(pl, depth) {
      if (!this.innerCount(pl) || !this.legal(pl).length) return -1000 - depth;
      if (this.ply >= 200) return 0;
      return null;
    },
    evaluate(pl) { // seeds, then the inner row, then the best capture on offer to the side to move
      let threat = 0;
      for (let L = 0; L < 16; L++) {
        const pit = pl * 16 + L, n = this.p[pit]; if (n < 2) continue;
        for (const dir of [1, -1]) if (this.capturesFirst(pl, pit, dir)) { let at = pit; for (let k = 0; k < n; k++) at = this.next(at, dir); threat = Math.max(threat, this.p[this.opposite(at)]); }
      }
      return this.count(pl) - this.count(1 - pl) + 0.3 * (this.innerCount(pl) - this.innerCount(1 - pl)) + 0.6 * threat;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, pick(4, 4, 10)); }, // Bao is cheap to search: Sharp looks twelve plies ahead
  };

  /* ------------------------------------------------- The Landlord's Game (1904)
   * Lizzie Magie's patent board, U.S. 748,626: forty spaces read from the drawing,
   * starting at Mother Earth and running clockwise as the patent draws it. */
  const LL_SEQ = ['earth', 1, 'bread', 2, 'trespass', 'rr', 3, 4, 'lux', 5,
    'coal', 6, 7, 'light', 8, 'rr', 9, 'shelter', 10, 11,
    'park', 12, 'lux', 13, 14, 'rr', 15, 'water', 16, 17,
    'blueblood', 18, 'clothing', 19, 20, 'rr', 21, 'legacy', 22, 'lux'];
  const LL_NAME = { earth: 'Mother Earth', bread: 'Bread', coal: 'Coal', shelter: 'Shelter', clothing: 'Clothing', trespass: 'No Trespassing', blueblood: 'No Trespassing', rr: 'the railroad', lux: 'Luxury', light: 'the light franchise', water: 'the water franchise', park: 'the Public Park', legacy: 'Legacy' };
  const LL = LL_SEQ.map((s, i) => typeof s === 'number' ? { i, t: 'lot', n: s, price: 10 * s, rent: s, name: `lot ${s}` }
    : { i, t: { bread: 'need', coal: 'need', shelter: 'need', clothing: 'need', blueblood: 'trespass', light: 'franchise', water: 'franchise' }[s] || s, key: s, name: LL_NAME[s] });
  const LL_JAIL = 10, LL_PARK = 20, LL_LOT = n => LL.findIndex(sp => sp.n === n);
  const LANDLORD = {
    id: 'landlord', name: 'The Landlord\'s Game', dice: true, pipDice: true, autoMove: true, first: 0, N: 1,
    SPACES: LL, JAIL: LL_JAIL, PARK: LL_PARK, lotAt: LL_LOT,
    get followPrompt() {
      const p = this.pend; if (!p) return 'Buy another of your ticket lots, or start.';
      const sp = LL[p.at];
      return p.kind === 'lot' ? `Lot ${sp.n} is for sale at $${sp.price}, or to rent at $${sp.rent}.` : 'Luxury: buy a ticket for $50, or decline and lose the move.';
    },
    extraNote: '',
    variants: [{ id: '3', label: 'Three rounds' }, { id: '5', label: 'Five rounds' }],
    variant: '3', variantLabel: 'Rounds', ROUNDS: 3, // the patent plays five times round; three is the default here
    setVariant(id) { this.variant = id === '5' ? '5' : '3'; this.ROUNDS = +this.variant; },
    rules: [
      'Throw two dice and move your checker that many spaces clockwise. Each time you pass Mother Earth you draw $100 in wages, for five times round the board (three in the short game).',
      'A green lot can be bought for its price or rented for its rent, both paid to the Public Treasury. On a lot someone owns, pay the rent to the owner; on your own, pay nothing. At the start you draw lot tickets and may buy those lots before your first throw.',
      'Bread, Coal, Shelter and Clothing are absolute necessities: $5 tax. A railroad costs $5 fare. Luxury costs $50 for a ticket worth $60 at the end, or decline and lose the move. The first to land on a franchise takes its charter free, and charges $5 to anyone else who lands there. Legacy pays $100. The Public Park is free.',
      'No Trespassing sends you to jail, in the Coal corner. To leave, pay a $50 fine or throw a double. A double that would carry you past a railroad lets you ride to the next one instead (and pay its fare).',
      'Short of cash, you borrow $100 notes from the Bank against your lots (worth $10 more than the loan) and pay $5 interest on each note at every wage; notes are repaid before you pass Mother Earth when you can. With nothing to borrow against, you go to the poorhouse.',
      'When both players have been round five times (or three) the game ends. Your worth is your cash, your lots at their price and $60 a luxury ticket, less any notes. The richer player wins. Once round and free of debt, you may move either way.'
    ],
    source: 'U.S. Patent 748,626, granted to Lizzie J. Magie on January 5, 1904: the board is read from the patent drawing and the rules from its text, for two players. The patent\'s rule for two checkers sharing a lot is left out.',
    init() {
      this.pos = [0, 0]; this.cash = [500, 500]; this.notes = [0, 0]; this.laps = [0, 0]; this.lux = [0, 0]; this.legacies = [0, 0];
      this.jailed = [false, false]; this.owner = new Array(23).fill(-1); this.fran = { 13: -1, 27: -1 };
      const t = Array.from({ length: 22 }, (_, k) => k + 1);
      for (let k = t.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [t[k], t[j]] = [t[j], t[k]]; }
      this.tickets = [[], []]; for (let k = 0; k < 12; k++) this.tickets[k % 2].push(t[k]);
      this.tickets.forEach(a => a.sort((x, y) => x - y));
      this.ticketsOpen = [true, true]; this.pend = null; this.turnsTaken = 0;
    },
    roll() { const a = 1 + ((Math.random() * 6) | 0), b = 1 + ((Math.random() * 6) | 0); return { value: a + b, faces: [a, b] }; },
    lotValue(pl) { let v = 0; for (let n = 1; n <= 22; n++) if (this.owner[n] === pl) v += 10 * n; return v; },
    worth(pl) { return this.cash[pl] + this.lotValue(pl) + 60 * this.lux[pl] - 100 * this.notes[pl]; },
    canBorrow(pl) { return this.lotValue(pl) >= (this.notes[pl] + 1) * 110; },
    // Pay amt to the other player (to = 0 or 1) or to the Treasury or railroad (to = null), borrowing if need be.
    pay(pl, amt, to, notes) {
      let borrowed = 0;
      while (this.cash[pl] < amt && this.canBorrow(pl)) { this.notes[pl]++; this.cash[pl] += 100; borrowed++; }
      if (borrowed) notes.push(`${pl === 0 ? 'You borrow' : 'The Scribe borrows'} $${100 * borrowed} from the Bank.`);
      if (this.cash[pl] >= amt) { this.cash[pl] -= amt; if (to !== null) this.cash[to] += amt; return true; }
      const paid = this.cash[pl]; this.cash[pl] = 0; if (to !== null) this.cash[to] += paid;
      this.pos[pl] = LL_PARK; this.jailed[pl] = false;
      notes.push(pl === 0 ? 'You cannot pay, and have nothing to borrow against: off to the poorhouse.' : 'The Scribe cannot pay and goes to the poorhouse.');
      return false;
    },
    // Choices before throwing: lot tickets at the start, or the way out of jail.
    preThrow(pl) {
      if (this.pend) return null;
      if (this.ticketsOpen[pl]) {
        const ms = this.tickets[pl].filter(n => this.owner[n] < 0 && this.cash[pl] >= 10 * n).map(n => ({ pl, kind: 'ticket', n, pre: true, label: `Buy lot ${n}: $${10 * n}` }));
        return ms.concat([{ pl, kind: 'endTickets', pre: true, label: ms.length ? 'Done buying' : 'Start' }]);
      }
      if (this.jailed[pl]) return [{ pl, kind: 'fine', pre: true, label: 'Pay the $50 fine' }, { pl, kind: 'tryDouble', pre: true, label: 'Throw for a double' }];
      return null;
    },
    passesRR(from, steps) { for (let k = 1; k < steps; k++) if (LL[(from + k) % 40].t === 'rr') return (from + k) % 40; return -1; },
    nextRR(at) { for (let k = 1; k <= 40; k++) if (LL[(at + k) % 40].t === 'rr') return (at + k) % 40; return at; },
    legal(pl, value, roll) {
      if (this.pend) return this.pendMoves();
      const from = this.pos[pl];
      if (this.jailed[pl]) return roll && roll.faces[0] === roll.faces[1] ? [{ pl, kind: 'move', from, steps: value, dir: 1, to: (from + value) % 40, free: true }] : [{ pl, kind: 'stay', from, to: from }];
      const ms = [{ pl, kind: 'move', from, steps: value, dir: 1, to: (from + value) % 40 }];
      const rr = this.passesRR(from, value);
      if (roll && roll.faces[0] === roll.faces[1] && rr >= 0) { const to = this.nextRR(rr); ms.push({ pl, kind: 'move', from, steps: (to - from + 40) % 40, dir: 1, to, ride: rr }); }
      if (this.laps[pl] >= this.ROUNDS && !this.notes[pl]) ms.push({ pl, kind: 'move', from, steps: value, dir: -1, to: (from - value + 40) % 40 });
      return ms;
    },
    steps(m) { // the spaces the checker passes through, for the animation
      if (m.kind !== 'move') return [];
      if (m.ride !== undefined) { const a = []; for (let k = 1; k <= (m.ride - m.from + 40) % 40; k++) a.push((m.from + k) % 40); a.push(m.to); return a; }
      return Array.from({ length: m.steps }, (_, k) => (m.from + m.dir * (k + 1) + 40) % 40);
    },
    pendMoves() {
      const { pl, kind, at } = this.pend, sp = LL[at];
      if (kind === 'lot') return [{ pl, kind: 'buyLot', at, label: `Buy lot ${sp.n} for $${sp.price}` }, { pl, kind: 'rentLot', at, label: `Rent it for $${sp.rent}` }];
      return [{ pl, kind: 'buyLux', at, label: 'Buy a luxury ticket: $50' }, { pl, kind: 'declineLux', at, back: this.pend.back, label: 'Decline, and lose the move' }];
    },
    who(pl) { return pl === 0 ? 'You' : 'The Scribe'; },
    apply(m) {
      const pl = m.pl, notes = [], me = this.who(pl), mine = pl === 0 ? 'your' : 'its';
      const out = () => ({ note: notes.join(' '), moved: [], caps: 0 });
      switch (m.kind) {
        case 'ticket': {
          this.cash[pl] -= 10 * m.n; this.owner[m.n] = pl;
          notes.push(`${me} ${pl === 0 ? 'buy' : 'buys'} lot ${m.n}.`);
          const r = out(); if (pl === 0) r.followUp = this.preThrow(pl); return r;
        }
        case 'endTickets': this.ticketsOpen[pl] = false; return Object.assign(out(), { thenThrow: true });
        case 'fine': this.pay(pl, 50, null, notes); this.jailed[pl] = false; notes.unshift(`${me} ${pl === 0 ? 'pay' : 'pays'} the $50 fine.`); return Object.assign(out(), { thenThrow: true });
        case 'tryDouble': return Object.assign(out(), { thenThrow: true });
        case 'stay': notes.push(pl === 0 ? 'No double: you stay in jail.' : 'No double: the Scribe stays in jail.'); return out();
        case 'buyLot': { const sp = LL[m.at]; this.pend = null; this.cash[pl] -= sp.price; this.owner[sp.n] = pl; notes.push(`${me} ${pl === 0 ? 'buy' : 'buys'} lot ${sp.n} for $${sp.price}.`); return out(); }
        case 'rentLot': { const sp = LL[m.at]; this.pend = null; this.pay(pl, sp.rent, null, notes); notes.unshift(`${me} ${pl === 0 ? 'rent' : 'rents'} lot ${sp.n} for $${sp.rent}.`); return out(); }
        case 'buyLux': this.pend = null; this.cash[pl] -= 50; this.lux[pl]++; notes.push(`${me} ${pl === 0 ? 'buy' : 'buys'} a luxury ticket.`); return out();
        case 'declineLux': this.pend = null; this.pos[pl] = m.back; notes.push(`${me} ${pl === 0 ? 'decline' : 'declines'} the luxury and ${pl === 0 ? 'go' : 'goes'} back.`); return Object.assign(out(), { back: true });
      }
      // A move round the board.
      this.turnsTaken++;
      if (m.free) { this.jailed[pl] = false; notes.push(`A double: ${pl === 0 ? 'you are' : 'the Scribe is'} out of jail.`); }
      this.pos[pl] = m.to;
      if (m.ride !== undefined) notes.push(`${me} ${pl === 0 ? 'ride' : 'rides'} the railroad.`);
      if (m.dir === 1 && m.from + m.steps >= 40) this.wages(pl, notes);
      if (this.pos[pl] === m.to) this.land(pl, m.to, m.from, notes);
      const r = out();
      if (this.pend) r.followUp = this.pendMoves();
      return r;
    },
    wages(pl, notes) {
      // Repay notes before passing, to save the interest.
      while (this.notes[pl] && this.cash[pl] >= 150) { this.notes[pl]--; this.cash[pl] -= 100; notes.push(`${this.who(pl)} ${pl === 0 ? 'repay' : 'repays'} a $100 note.`); }
      this.laps[pl]++;
      if (this.laps[pl] <= this.ROUNDS) {
        this.cash[pl] += 100;
        notes.push(`${this.who(pl)} ${pl === 0 ? 'pass' : 'passes'} Mother Earth and ${pl === 0 ? 'draw' : 'draws'} $100 wages (round ${this.laps[pl]} of ${this.ROUNDS}).`);
        if (this.notes[pl]) this.pay(pl, 5 * this.notes[pl], null, notes);
      }
    },
    land(pl, at, from, notes) {
      const sp = LL[at], me = this.who(pl), other = 1 - pl;
      switch (sp.t) {
        case 'lot': {
          const o = this.owner[sp.n];
          if (o === pl) { notes.push(`Lot ${sp.n} is ${pl === 0 ? 'yours' : 'the Scribe\'s own'}.`); return; }
          if (o === other) { this.pay(pl, sp.rent, other, notes); notes.unshift(`${me} ${pl === 0 ? 'pay' : 'pays'} $${sp.rent} rent on lot ${sp.n}.`); return; }
          if (this.cash[pl] >= sp.price) { this.pend = { pl, kind: 'lot', at }; return; }
          this.pay(pl, sp.rent, null, notes); notes.unshift(`${me} ${pl === 0 ? 'rent' : 'rents'} lot ${sp.n} for $${sp.rent}.`); return;
        }
        case 'need': this.pay(pl, 5, null, notes); notes.unshift(`${sp.name}: $5 tax.`); return;
        case 'rr': this.pay(pl, 5, null, notes); notes.unshift('Railroad fare: $5.'); return;
        case 'lux':
          if (this.cash[pl] >= 50) { this.pend = { pl, kind: 'lux', at, back: from }; return; }
          this.pos[pl] = from; notes.push(`${me} cannot afford the luxury and ${pl === 0 ? 'lose' : 'loses'} the move.`); return;
        case 'franchise': {
          const h = this.fran[at];
          if (h < 0) { this.fran[at] = pl; notes.push(`${me} ${pl === 0 ? 'take' : 'takes'} the charter for ${sp.name}.`); }
          else if (h === other) { this.pay(pl, 5, other, notes); notes.unshift(`${me} ${pl === 0 ? 'pay' : 'pays'} $5 for ${sp.name}.`); }
          return;
        }
        case 'trespass': this.pos[pl] = LL_JAIL; this.jailed[pl] = true; notes.push(`No Trespassing! ${pl === 0 ? 'You go' : 'The Scribe goes'} to jail.`); return;
        case 'legacy': this.cash[pl] += 100; this.legacies[pl]++; notes.push(`A legacy: ${pl === 0 ? 'you receive' : 'the Scribe receives'} $100.`); return;
        case 'park': notes.push('The Public Park is free.'); return;
        default: return;
      }
    },
    done() { return this.laps[0] >= this.ROUNDS && this.laps[1] >= this.ROUNDS; },
    final() {
      const a = this.worth(0), b = this.worth(1);
      return { winner: a > b ? 0 : b > a ? 1 : -1, text: `${this.ROUNDS === 5 ? 'Five' : 'Three'} times round. You are worth $${a}, the Scribe $${b}.` };
    },
    home(pl) { return this.laps[pl]; },
    extra() { return false; },
    snapshot() { return JSON.stringify([this.pos, this.cash, this.notes, this.laps, this.lux, this.legacies, this.jailed, this.owner, this.fran, this.tickets, this.ticketsOpen, this.pend, this.turnsTaken]); },
    restore(s) { [this.pos, this.cash, this.notes, this.laps, this.lux, this.legacies, this.jailed, this.owner, this.fran, this.tickets, this.ticketsOpen, this.pend, this.turnsTaken] = JSON.parse(s); },
    // The Scribe's judgement: how much cash to keep in hand for rents and taxes still to come.
    reserve() { return LEVEL.name === 'sharp' ? 0 : 40; }, // land pays: Sharp buys whatever it can afford
    decide(m) { // for a pending choice or a pre-throw choice, which to take
      const pl = m[0].pl, G = LEVEL.name === 'gentle';
      const by = k => m.find(x => x.kind === k);
      if (by('buyLot')) { const sp = LL[by('buyLot').at]; return (G ? Math.random() < 0.5 : this.cash[pl] - sp.price >= this.reserve(pl)) ? by('buyLot') : by('rentLot'); }
      if (by('buyLux')) return (G ? Math.random() < 0.4 : this.cash[pl] - 50 >= this.reserve(pl) + (LEVEL.name === 'sharp' ? 0 : 40)) ? by('buyLux') : by('declineLux');
      if (by('fine')) {
        if (G) return Math.random() < 0.5 ? by('fine') : by('tryDouble');
        const unowned = this.owner.slice(1).filter(o => o < 0).length;
        if (LEVEL.name === 'sharp') { // jail is a safe harbour once the other side owns the streets
          const theirs = this.owner.filter(o => o === 1 - pl).length;
          return unowned >= 4 && this.cash[pl] >= 120 && theirs < 8 ? by('fine') : by('tryDouble');
        }
        return this.cash[pl] >= 150 ? by('fine') : by('tryDouble');
      }
      return m[0];
    },
    aiPre(pl) { // tickets or the way out of jail
      const plan = [];
      if (this.ticketsOpen[pl]) {
        const want = this.tickets[pl];
        let cash = this.cash[pl];
        for (const n of want) if (this.owner[n] < 0 && (LEVEL.name === 'gentle' ? Math.random() < 0.5 : cash - 10 * n >= (LEVEL.name === 'sharp' ? 0 : 200))) { plan.push({ pl, kind: 'ticket', n, pre: true }); cash -= 10 * n; }
        plan.push({ pl, kind: 'endTickets', pre: true });
        return plan;
      }
      const pre = this.preThrow(pl);
      return pre ? [this.decide(pre)] : [];
    },
    // Value of landing on a space, for choosing between a ride, a plain move or going backward.
    landValue(pl, m) {
      const snap = this.snapshot(), w0 = this.worth(pl) - this.worth(1 - pl);
      const r = this.apply(m);
      if (r.followUp) this.apply(this.decide(r.followUp));
      const v = this.worth(pl) - this.worth(1 - pl) - w0 + (this.pos[pl] === LL_PARK && m.to !== LL_PARK ? -30 : 0) + (this.jailed[pl] ? -15 : 0);
      this.restore(snap); return v;
    },
    aiPlan(pl, moves) {
      let m = moves[0];
      if (moves.length > 1) m = LEVEL.name === 'gentle' ? moves[(Math.random() * moves.length) | 0] : moves.reduce((a, b) => (this.landValue(pl, b) > this.landValue(pl, a) ? b : a));
      const snap = this.snapshot(), plan = [m], r = this.apply(m);
      if (r.followUp) plan.push(this.decide(r.followUp));
      this.restore(snap);
      return plan;
    },
  };

  /* --------------------------------------------------------- Chinese checkers
   * Stern-Halma's star of 121 holes, in cube coordinates (x + y + z = 0): the
   * union of two big triangles. The visitor starts in the point nearest them
   * (z > 4) and races for the far point (z < -4); the Scribe the other way. */
  const CC_CELLS = [], CC_AT = new Map();
  for (let x = -8; x <= 8; x++) for (let y = -8; y <= 8; y++) {
    const z = -x - y; if (z < -8 || z > 8) continue;
    if ((x <= 4 && y <= 4 && z <= 4) || (x >= -4 && y >= -4 && z >= -4)) { CC_AT.set(x + ',' + y, CC_CELLS.length); CC_CELLS.push([x, y, z]); }
  }
  const CC_DIRS = [[1, -1, 0], [-1, 1, 0], [1, 0, -1], [-1, 0, 1], [0, 1, -1], [0, -1, 1]];
  const ccAt = (x, y) => { const k = CC_AT.get(x + ',' + y); return k === undefined ? -1 : k; };
  const CC_NB = CC_CELLS.map(([x, y]) => CC_DIRS.map(([dx, dy]) => ccAt(x + dx, y + dy)));
  const CC_JUMP = CC_CELLS.map(([x, y]) => CC_DIRS.map(([dx, dy]) => ccAt(x + 2 * dx, y + 2 * dy)));
  const CC_CAMP = [CC_CELLS.map((c, i) => (c[2] > 4 ? i : -1)).filter(i => i >= 0), CC_CELLS.map((c, i) => (c[2] < -4 ? i : -1)).filter(i => i >= 0)];
  const CC_GOAL = [0, 1].map(pl => { const a = new Uint8Array(CC_CELLS.length); CC_CAMP[1 - pl].forEach(i => { a[i] = 1; }); return a; });
  // Rows still to travel, plus a little for straying into a side point of the star.
  const ccDist = (pl, i) => { const [x, y, z] = CC_CELLS[i]; return (pl === 0 ? z : -z) + 8 + 0.5 * Math.max(0, Math.max(Math.abs(x), Math.abs(y)) - 4); };
  const CC_LIMIT = 300;
  const CHINESE = {
    id: 'chinese', name: 'Chinese checkers', dice: false, first: 0, CELLS: CC_CELLS, CAMP: CC_CAMP, GOAL: CC_GOAL, N: CC_CELLS.length,
    rules: [
      'You play red, from the point of the star nearest you, and move first. Move all ten of your marbles into the far point before the Scribe fills yours.',
      'A marble steps to an empty hole next to it, in any of six directions.',
      'Or it hops: over one marble next to it, of either colour, into the empty hole just beyond. Nothing is captured, and it may keep hopping in the same turn, as far as the chain goes. A move is a step or a chain of hops, never both.',
      'You win when all your marbles are in the far point. If the far point is full and at least one marble in it is yours, you win too, so no one can block by staying home.',
      'House rule: after a hundred and fifty moves each, whoever has more marbles home wins, then whoever is closer overall.'
    ],
    source: 'Stern-Halma, the star Halma Ravensburger published in 1892, for two players with ten marbles each. The rule against blocking a point by staying home is a common modern addition.',
    init() { const b = new Uint8Array(CC_CELLS.length); CC_CAMP[0].forEach(i => { b[i] = 1; }); CC_CAMP[1].forEach(i => { b[i] = 2; }); this.b = b; this.ply = 0; },
    home(pl) { let n = 0; for (const i of CC_CAMP[1 - pl]) if (this.b[i] === pl + 1) n++; return n; },
    men(pl) { const out = []; for (let i = 0; i < this.b.length; i++) if (this.b[i] === pl + 1) out.push(i); return out; },
    reach(i) {
      const b = this.b, pl = b[i] - 1, out = [];
      for (const j of CC_NB[i]) if (j >= 0 && !b[j]) out.push({ pl, from: i, to: j, path: [j] });
      b[i] = 0;
      const seen = new Set([i]), queue = [[i, []]];
      while (queue.length) {
        const [at, path] = queue.shift();
        for (let d = 0; d < 6; d++) {
          const mid = CC_NB[at][d], land = CC_JUMP[at][d];
          if (mid < 0 || land < 0 || !b[mid] || b[land] || seen.has(land)) continue;
          seen.add(land);
          const np = path.concat([land]);
          out.push({ pl, from: i, to: land, path: np, hop: true });
          queue.push([land, np]);
        }
      }
      b[i] = pl + 1;
      return out;
    },
    legal(pl) { if (this.winner() !== null) return []; const out = []; for (const i of this.men(pl)) out.push(...this.reach(i)); return out; },
    apply(m) {
      if (m.pass) { this.ply++; return { note: '' }; }
      const was = CC_GOAL[m.pl][m.from];
      this.b[m.from] = 0; this.b[m.to] = m.pl + 1; this.ply++;
      const parts = [];
      if (m.hop && m.path.length > 1) parts.push(m.pl === 0 ? `You hop ${m.path.length} times.` : `The Scribe hops ${m.path.length} times.`);
      if (!was && CC_GOAL[m.pl][m.to]) { const n = this.home(m.pl); parts.push(m.pl === 0 ? `${n} of your marbles ${n === 1 ? 'is' : 'are'} home.` : `${n} of the Scribe's marbles ${n === 1 ? 'is' : 'are'} home.`); }
      return { note: parts.join(' ') };
    },
    winner() {
      for (const pl of [0, 1]) { const n = this.home(pl); if (n === 10) return pl; if (n && CC_CAMP[1 - pl].every(i => this.b[i])) return pl; }
      return null;
    },
    total(pl) { let d = 0; for (const i of this.men(pl)) d += ccDist(pl, i); return d; },
    skipTurn(pl) { if (this.winner() !== null || this.legal(pl).length || !this.legal(1 - pl).length) return ''; return pl === 0 ? 'Your marbles are boxed in, so you pass.' : 'The Scribe\'s marbles are boxed in, and it passes.'; },
    result() {
      const w = this.winner();
      if (w !== null) return { winner: w, text: w === 0 ? (this.home(0) === 10 ? 'All your marbles reached the far point.' : 'The far point is full, and your marbles are in it.') : (this.home(1) === 10 ? 'All the Scribe\'s marbles reached your point.' : 'Your point is full, and the Scribe\'s marbles are in it.') };
      if (this.ply >= CC_LIMIT || (!this.legal(0).length && !this.legal(1).length)) {
        const a = this.home(0), b = this.home(1), da = this.total(0), db = this.total(1);
        const winner = a !== b ? (a > b ? 0 : 1) : Math.abs(da - db) > 1e-9 ? (da < db ? 0 : 1) : -1;
        return { winner, text: a !== b ? `A hundred and fifty moves each. Marbles home: you ${a}, the Scribe ${b}.` : winner < 0 ? 'A hundred and fifty moves each, dead level. The game is drawn.' : `A hundred and fifty moves each, ${a} home apiece; ${winner === 0 ? 'yours are' : 'the Scribe\'s are'} closer.` };
      }
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply]; },
    restore(s) { this.b = s[0].slice(); this.ply = s[1]; },
    turns(pl) {
      const ms = this.legal(pl);
      if (!ms.length) return [[{ pl, pass: true }]];
      const gain = m => ccDist(pl, m.from) - ccDist(pl, m.to) + (CC_GOAL[pl][m.to] && !CC_GOAL[pl][m.from] ? 1.5 : 0) - (CC_GOAL[pl][m.from] && !CC_GOAL[pl][m.to] ? 3 : 0);
      ms.sort((x, y) => gain(y) - gain(x));
      return ms.slice(0, 30).map(m => [m]);
    },
    terminal(pl, depth) {
      const w = this.winner();
      if (w !== null) return w === pl ? 1000 + depth : -1000 - depth;
      if (this.ply >= CC_LIMIT) return (this.home(pl) - this.home(1 - pl)) * 50 + (this.total(1 - pl) - this.total(pl));
      return null;
    },
    score(pl) { let s = 0; for (let i = 0; i < this.b.length; i++) if (this.b[i] === pl + 1) { const d = ccDist(pl, i); s -= d + 0.06 * d * d; if (CC_GOAL[pl][i]) s += 2; } return s; },
    evaluate(pl) { return this.score(pl) - this.score(1 - pl); },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 3); },
  };

  /* --------------------------------------------------------------------- Hex
   * An n x n rhombus of hexagons, index r*n + c, row 0 nearest the visitor.
   * Red (the visitor) joins the near and far rows; blue (the Scribe) joins
   * the left and right columns. b holds 0 empty, 1 red, 2 blue. */
  const HEX = {
    id: 'hex', name: 'Hex', dice: false, first: 0, n: 9,
    variants: [{ id: '7', label: '7 × 7' }, { id: '9', label: '9 × 9' }, { id: '11', label: '11 × 11' }],
    variant: '9', variantLabel: 'Board',
    setVariant(id) { this.variant = ['7', '9', '11'].includes(id) ? id : '9'; this.n = +this.variant; },
    // The swap rule is off unless the visitor turns it on, so the first move stays the visitor's.
    toggles: [{ id: 'swap', label: 'Swap rule', default: false }], swapRule: false,
    setToggle(id, on) { if (id === 'swap') this.swapRule = !!on; },
    get rules() {
      return [
        'You play red and always move first. Join the red edges, nearest and farthest from you, with an unbroken chain of red hexagons. The Scribe plays blue and joins the left and right edges.',
        'On your turn, place one stone on any empty hexagon. Stones never move and are never taken.',
        'Someone always wins: a full board always holds exactly one winning chain, so Hex cannot be drawn.',
        this.swapRule
          ? 'The swap rule is on: going first is a big advantage, so after your first stone the Scribe may take it for itself instead of playing. The stone is then reflected across the board into blue, and you move again.'
          : 'The swap rule is off, so the first move, and its advantage, stays yours. Turn the swap rule on above for an even game: the Scribe may then take your opening stone for itself.'
      ];
    },
    source: 'Hex as Piet Hein published it in 1942 and John Nash rediscovered it, with the swap rule from the modern game.',
    init() { const N = this.n * this.n; this.b = new Uint8Array(N); this.ply = 0; this.swapped = false; this.last = -1; this.win = -1; },
    nb(i) { const n = this.n, r = (i / n) | 0, c = i % n, out = []; for (const [dr, dc] of [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc); } return out; },
    joined(b, col) { // does col (1 red, 2 blue) join its edges?
      const n = this.n, seen = new Uint8Array(n * n), stack = [];
      for (let k = 0; k < n; k++) { const i = col === 1 ? k : k * n; if (b[i] === col) { seen[i] = 1; stack.push(i); } }
      while (stack.length) {
        const i = stack.pop(), r = (i / n) | 0, c = i % n;
        if (col === 1 ? r === n - 1 : c === n - 1) return true;
        for (const j of this.nb(i)) if (!seen[j] && b[j] === col) { seen[j] = 1; stack.push(j); }
      }
      return false;
    },
    legal(pl) {
      if (this.win >= 0) return [];
      const out = [];
      for (let i = 0; i < this.b.length; i++) if (!this.b[i]) out.push({ pl, at: i });
      if (pl === 1 && this.ply === 1 && !this.swapped && this.swapRule) out.push({ pl, swap: true, label: 'Swap' });
      return out;
    },
    apply(m) {
      const n = this.n;
      if (m.swap) {
        const i = this.b.findIndex(v => v === 1), r = (i / n) | 0, c = i % n, j = c * n + r;
        this.b[i] = 0; this.b[j] = 2; this.swapped = true; this.ply++; this.last = j;
        return { note: m.pl === 1 ? 'The Scribe swaps: it takes your opening stone, reflected into blue. Your move again.' : '', swap: { from: i, to: j } };
      }
      this.b[m.at] = m.pl + 1; this.ply++; this.last = m.at;
      if (this.joined(this.b, m.pl + 1)) this.win = m.pl;
      return { note: '' };
    },
    result() { return this.win < 0 ? null : { winner: this.win, text: this.win === 0 ? 'Your red chain joins your two edges.' : 'The Scribe\'s blue chain joins its two edges.' }; },
    snapshot() { return [this.b.slice(), this.ply, this.swapped, this.last, this.win]; },
    restore(s) { this.b = s[0].slice(); [, this.ply, this.swapped, this.last, this.win] = s; },
    // The Scribe takes the opening stone when it sits in the middle of the board.
    wantSwap() {
      if (LEVEL.name === 'gentle') return false;
      const n = this.n, i = this.b.findIndex(v => v === 1), r = (i / n) | 0, c = i % n, m = LEVEL.name === 'sharp' ? 1 : 2;
      return r >= m && r <= n - 1 - m && c >= m && c <= n - 1 - m;
    },
    aiPlan(pl, budget) {
      if (pl === 1 && this.ply === 1 && !this.swapped && this.swapRule && this.wantSwap()) return [{ pl, swap: true }];
      const at = hexSearch(this, pl, budget || BUDGET_MS[LEVEL.name]);
      return [{ pl, at }];
    },
  };
  // Monte Carlo search with RAVE: random fills of the board, where every stone a side ends up
  // with counts a little toward playing there now (in Hex, the order of moves barely matters).
  function hexSearch(G, pl, budget) {
    const n = G.n, N = n * n, t0 = Date.now(), K = 600;
    const empties0 = []; for (let i = 0; i < N; i++) if (!G.b[i]) empties0.push(i);
    const node = (toMove) => ({ toMove, n: 0, kids: new Map(), rN: new Float32Array(N), rW: new Float32Array(N) });
    const root = node(pl), b = new Uint8Array(N), buf = new Int32Array(N);
    let iters = 0;
    while (true) {
      if ((iters & 63) === 0 && Date.now() - t0 > budget) break;
      iters++;
      b.set(G.b);
      let nd = root; const path = [root];
      // Selection and expansion.
      for (;;) {
        let best = -1, bv = -1;
        const beta0 = Math.sqrt(K / (3 * nd.n + K));
        for (let i = 0; i < N; i++) {
          if (b[i]) continue;
          const ch = nd.kids.get(i), rn = nd.rN[i], amaf = rn ? nd.rW[i] / rn : 0.5;
          let v;
          if (ch && ch.n) { const beta = Math.sqrt(K / (3 * ch.n + K)); v = (1 - beta) * (ch.w / ch.n) + beta * amaf; } else v = amaf + 0.02 * beta0;
          v += Math.random() * 1e-6;
          if (v > bv) { bv = v; best = i; }
        }
        if (best < 0) break;
        b[best] = nd.toMove + 1;
        let ch = nd.kids.get(best);
        if (!ch) { ch = node(1 - nd.toMove); ch.move = best; ch.mover = nd.toMove; ch.w = 0; nd.kids.set(best, ch); path.push(ch); break; }
        path.push(ch); nd = ch;
        if (nd.n < 1) break;
      }
      // Playout: fill the rest at random.
      let m = 0; for (let i = 0; i < N; i++) if (!b[i]) buf[m++] = i;
      let side = path[path.length - 1].toMove;
      for (let k = m - 1; k >= 0; k--) { const j = (Math.random() * (k + 1)) | 0, t = buf[k]; buf[k] = buf[j]; buf[j] = t; b[buf[k]] = side + 1; side = 1 - side; }
      const redWins = G.joined(b, 1), winner = redWins ? 0 : 1;
      // Back up, with all-moves-as-first statistics for each node's side to move.
      for (const nd2 of path) {
        nd2.n++;
        if (nd2.mover !== undefined && nd2.mover === winner) nd2.w++;
        const col = nd2.toMove + 1, won = nd2.toMove === winner ? 1 : 0;
        for (const i of empties0) if (b[i] === col) { nd2.rN[i]++; nd2.rW[i] += won; }
      }
    }
    let best = -1, bn = -1;
    for (const [i, ch] of root.kids) {
      let v = ch.n + (LEVEL.name === 'gentle' ? Math.random() * ch.n * 0.8 : 0);
      if (v > bn) { bn = v; best = i; }
    }
    if (best < 0) best = empties0[(Math.random() * empties0.length) | 0];
    return best;
  }

  /* ------------------------------------------------------------------ Gomoku
   * Five in a row on a 15 x 15 board, index r*15 + c, row 0 nearest the visitor.
   * Freestyle: five or more in a line wins. b holds 0 empty, 1 black, 2 white. */
  const GM_N = 15, GM_DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const GOMOKU = {
    id: 'gomoku', name: 'Gomoku', dice: false, first: 0, n: GM_N,
    rules: [
      'You play black and move first. Place one stone on any empty point, where the lines cross.',
      'Make an unbroken line of five or more of your stones, across, up and down, or diagonally, and you win.',
      'Stones never move and are never taken. If the board fills with no line of five, the game is drawn.'
    ],
    source: 'Freestyle gomoku on a 15 × 15 board: five or more in a row wins, with none of the restrictions renju later placed on black.',
    init() { this.b = new Uint8Array(GM_N * GM_N); this.ply = 0; this.win = -1; this.line = null; this.last = -1; },
    run(b, i, col, dr, dc) { let k = 0, r = ((i / GM_N) | 0) + dr, c = (i % GM_N) + dc; while (r >= 0 && r < GM_N && c >= 0 && c < GM_N && b[r * GM_N + c] === col) { k++; r += dr; c += dc; } return k; },
    legal(pl) { if (this.win >= 0 || this.ply >= GM_N * GM_N) return []; const out = []; for (let i = 0; i < this.b.length; i++) if (!this.b[i]) out.push({ pl, at: i }); return out; },
    apply(m) {
      const col = m.pl + 1; this.b[m.at] = col; this.ply++; this.last = m.at;
      for (const [dr, dc] of GM_DIRS) {
        const f = this.run(this.b, m.at, col, dr, dc), bk = this.run(this.b, m.at, col, -dr, -dc);
        if (f + bk + 1 >= 5) {
          this.win = m.pl; const r = (m.at / GM_N) | 0, c = m.at % GM_N;
          this.line = Array.from({ length: f + bk + 1 }, (_, k) => (r + (k - bk) * dr) * GM_N + (c + (k - bk) * dc));
        }
      }
      return { note: '' };
    },
    result() {
      if (this.win >= 0) return { winner: this.win, text: this.win === 0 ? 'Five black stones in a row.' : 'Five white stones in a row.' };
      if (this.ply >= GM_N * GM_N) return { winner: -1, text: 'The board is full with no five in a row.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply, this.win, this.line, this.last]; },
    restore(s) { this.b = s[0].slice(); [, this.ply, this.win, this.line, this.last] = s; },
    // How good point i is for col: each line through it scored by length and open ends.
    pointScore(i, col) {
      const b = this.b; let s = 0, threats = 0;
      for (const [dr, dc] of GM_DIRS) {
        const f = this.run(b, i, col, dr, dc), bk = this.run(b, i, col, -dr, -dc), len = f + bk + 1;
        if (len >= 5) return 1e7;
        const end = (k, sg) => { const r = ((i / GM_N) | 0) + sg * (k + 1) * dr, c = (i % GM_N) + sg * (k + 1) * dc; return r >= 0 && r < GM_N && c >= 0 && c < GM_N && !b[r * GM_N + c]; };
        // A gap then more of the same colour counts as a broken line.
        const gapF = end(f, 1) ? this.run(b, (((i / GM_N) | 0) + (f + 1) * dr) * GM_N + (i % GM_N) + (f + 1) * dc, col, dr, dc) : 0;
        const gapB = end(bk, -1) ? this.run(b, (((i / GM_N) | 0) - (bk + 1) * dr) * GM_N + (i % GM_N) - (bk + 1) * dc, col, -dr, -dc) : 0;
        const open = (end(f, 1) ? 1 : 0) + (end(bk, -1) ? 1 : 0);
        const broken = Math.max(gapF, gapB);
        const L = len + broken;
        if (len === 4) { s += open === 2 ? 1e6 : open === 1 ? 5e4 : 0; if (open) threats++; } // a four, open or not
        else if (broken && len + broken >= 4) { s += 4e4; threats++; } // a split four: filling the gap makes five
        else if (L === 3) { s += open === 2 ? 1e3 : open === 1 ? 100 : 0; if (open === 2) threats++; } // a three
        else if (L === 2) s += open === 2 ? 60 : open === 1 ? 10 : 0;
        else s += open;
      }
      // Two threats at once (four and three, or two open threes) can rarely both be stopped.
      if (threats >= 2) s += 3e5;
      return s;
    },
    candidates() {
      const out = [], b = this.b;
      if (!this.ply) return [((GM_N / 2) | 0) * GM_N + ((GM_N / 2) | 0)];
      for (let i = 0; i < b.length; i++) {
        if (b[i]) continue;
        const r = (i / GM_N) | 0, c = i % GM_N; let near = false;
        for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < GM_N && cc >= 0 && cc < GM_N && b[rr * GM_N + cc]) { near = true; break; } }
        if (near) out.push(i);
      }
      return out;
    },
    rank(pl) { // candidate points, best first, with attack and defence weighed together
      const me = pl + 1, you = 2 - pl, dw = LEVEL.name === 'sharp' ? 0.7 : 0.85; // Sharp leans to attack
      return this.candidates().map(i => ({ i, a: this.pointScore(i, me), d: this.pointScore(i, you) })).map(x => Object.assign(x, { v: x.a + dw * x.d })).sort((x, y) => y.v - x.v);
    },
    windows(side) { // every run of five points holding only one colour, weighted by how full it is
      const W = [0, 1, 12, 150, 2500, 1e6], b = this.b; let me = 0, you = 0;
      for (const [dr, dc] of GM_DIRS) for (let r = 0; r < GM_N; r++) for (let c = 0; c < GM_N; c++) {
        const r4 = r + 4 * dr, c4 = c + 4 * dc; if (r4 < 0 || r4 >= GM_N || c4 < 0 || c4 >= GM_N) continue;
        let k1 = 0, k2 = 0;
        for (let k = 0; k < 5; k++) { const v = b[(r + k * dr) * GM_N + c + k * dc]; if (v === 1) k1++; else if (v === 2) k2++; }
        if (k1 && !k2) (side === 0 ? (me += W[k1]) : (you += W[k1])); else if (k2 && !k1) (side === 1 ? (me += W[k2]) : (you += W[k2]));
      }
      return me - 1.3 * you;
    },
    winPoints(col) { return this.candidates().filter(j => this.pointScore(j, col) >= 1e7); },
    // Victory by continuous fours: a chain of fours, each forcing a single block, ending in two ways to make five.
    vcf(pl, depth, top = true) {
      if (top) this.vcfNodes = 0;
      if (depth <= 0 || ++this.vcfNodes > 2500) return -1;
      const me = pl + 1, you = 2 - pl;
      for (const i of this.candidates()) {
        const sc = this.pointScore(i, me);
        if (sc >= 1e7) return i;
        if (sc < 4e4) continue; // only moves that make a four
        this.b[i] = me;
        const wins = this.winPoints(me);
        let ok = false;
        if (wins.length >= 2) ok = true;
        else if (wins.length === 1 && this.pointScore(wins[0], you) < 1e7 && !this.winPoints(you).length) {
          this.b[wins[0]] = you; ok = this.vcf(pl, depth - 1, false) >= 0; this.b[wins[0]] = 0;
        }
        this.b[i] = 0;
        if (ok) return i;
      }
      return -1;
    },
    aiPlan(pl) {
      const ranked = this.rank(pl), win = ranked.find(x => x.a >= 1e7), block = ranked.find(x => x.d >= 1e7);
      if (win) return [{ pl, at: win.i }];
      if (block && (LEVEL.name !== 'gentle' || Math.random() < 0.8)) return [{ pl, at: block.i }];
      if (LEVEL.name === 'gentle') { const k = Math.min(ranked.length, 6); return [{ pl, at: ranked[(Math.random() * k) | 0].i }]; }
      if (LEVEL.name === 'fair') return [{ pl, at: ranked[0].i }];
      // Sharp hunts for a win by continuous fours, and stops the visitor's.
      const mine = this.vcf(pl, 10);
      if (mine >= 0) return [{ pl, at: mine }];
      let pool = ranked.slice(0, 10);
      if (this.vcf(1 - pl, 8) >= 0) {
        const safe = ranked.slice(0, 8).filter(x => { this.b[x.i] = pl + 1; const ok = this.vcf(1 - pl, 8) < 0; this.b[x.i] = 0; return ok; });
        if (safe.length) pool = safe;
      }
      // Then a short search over the most promising points, scored by every five-point window on the board.
      const t0 = Date.now();
      const search = (side, depth, alpha, beta) => {
        if (depth === 0 || Date.now() - t0 > 900) return this.windows(side);
        const cands = this.rank(side).slice(0, 7);
        let bestV = -Infinity;
        for (const x of cands) {
          if (x.a >= 1e7) return 1e6 + depth;
          this.b[x.i] = side + 1;
          const v = -search(1 - side, depth - 1, -beta, -alpha);
          this.b[x.i] = 0;
          if (v > bestV) bestV = v;
          if (v > alpha) alpha = v;
          if (alpha >= beta) break;
        }
        return bestV === -Infinity ? this.windows(side) : bestV;
      };
      let best = pool[0].i, bv = -Infinity;
      for (const x of pool.slice(0, 8)) {
        this.b[x.i] = pl + 1;
        const v = -search(1 - pl, 2, -Infinity, -bv);
        this.b[x.i] = 0;
        if (v > bv) { bv = v; best = x.i; }
      }
      return [{ pl, at: best }];
    },
  };

  /* ---------------------------------------------------------------- Dominoes
   * The two-player Draw game with a double-six set. Tile t is the pair DM_T[t].
   * The line runs left to right; its open ends are ends[0] and ends[1]. The
   * boneyard is shuffled at the deal and drawn from the end. */
  const DM_T = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) DM_T.push([a, b]);
  const DOMINOES = {
    id: 'dominoes', name: 'Dominoes', dice: false, first: 0, TILES: DM_T,
    followPrompt: 'Play a glowing tile, or draw again.',
    rules: [
      'Each of you has seven tiles; the other fourteen lie face down in the boneyard. You lead first, with any tile.',
      'On your turn, play one tile that matches either open end of the line: click it, and if it fits both ends, then the ring at the end you want.',
      'If you cannot play, you must draw from the boneyard until you can. The last two tiles are never drawn: once only two remain, a player who cannot play passes.',
      'The hand ends when someone plays their last tile, or when neither of you can play. The player with fewer pips left in hand wins, and scores the difference (a player who goes out scores all the other\'s pips). Equal pips is a draw.'
    ],
    source: 'The Draw game, the oldest kind of European domino game, as pagat.com gives it for two players. One hand is played here rather than a game to 100.',
    init() {
      const t = Array.from({ length: 28 }, (_, k) => k);
      for (let k = 27; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [t[k], t[j]] = [t[j], t[k]]; }
      this.hands = [t.slice(0, 7), t.slice(7, 14)]; this.yard = t.slice(14);
      this.line = []; this.ends = null; this.passes = 0; this.out = -1; this.ply = 0;
      this.lacks = [new Set(), new Set()]; // numbers a player has shown they hold none of
    },
    pips(pl) { return this.hands[pl].reduce((a, t) => a + DM_T[t][0] + DM_T[t][1], 0); },
    fits(t, v) { return DM_T[t][0] === v || DM_T[t][1] === v; },
    legal(pl) {
      if (this.over()) return [];
      const h = this.hands[pl], out = [];
      if (!this.ends) return h.map(t => ({ pl, kind: 'play', t, side: 1 }));
      for (const t of h) for (const side of [0, 1]) {
        if (!this.fits(t, this.ends[side])) continue;
        if (side === 1 && this.ends[0] === this.ends[1] && this.fits(t, this.ends[0])) continue; // same either way
        out.push({ pl, kind: 'play', t, side });
      }
      if (out.length) return out;
      return this.yard.length > 2 ? [{ pl, kind: 'draw', label: 'Draw a tile' }] : [{ pl, kind: 'pass', label: 'Pass', pass: true }];
    },
    over() { return this.out >= 0 || this.passes >= 2; },
    apply(m) {
      const pl = m.pl, who = pl === 0 ? 'You' : 'The Scribe';
      if (m.kind === 'draw') {
        const t = this.yard.pop(); this.hands[pl].push(t);
        if (this.ends) { this.lacks[pl].add(this.ends[0]); this.lacks[pl].add(this.ends[1]); }
        const r = { note: pl === 0 ? `You draw the ${DM_T[t][0]}–${DM_T[t][1]}.` : 'The Scribe draws a tile.', drew: t };
        if (pl === 0) r.followUp = this.legal(0);
        return r;
      }
      if (m.kind === 'pass') {
        this.passes++; if (this.ends) { this.lacks[pl].add(this.ends[0]); this.lacks[pl].add(this.ends[1]); }
        return { note: pl === 0 ? 'You cannot play, and pass.' : 'The Scribe cannot play, and passes.' };
      }
      const [a, b] = DM_T[m.t]; this.hands[pl].splice(this.hands[pl].indexOf(m.t), 1); this.passes = 0; this.ply++;
      let placed;
      if (!this.ends) { placed = { t: m.t, l: a, r: b }; this.line.push(placed); this.ends = [a, b]; }
      else if (m.side === 0) { const v = this.ends[0], o = a === v ? b : a; placed = { t: m.t, l: o, r: v }; this.line.unshift(placed); this.ends[0] = o; }
      else { const v = this.ends[1], o = a === v ? b : a; placed = { t: m.t, l: v, r: o }; this.line.push(placed); this.ends[1] = o; }
      if (!this.hands[pl].length) this.out = pl;
      return { note: this.out === pl ? `${who} ${pl === 0 ? 'play' : 'plays'} the last tile: domino!` : '', placed, side: m.side };
    },
    result() {
      if (!this.over()) return null;
      const a = this.pips(0), b = this.pips(1);
      if (this.out >= 0) { const w = this.out; return { winner: w, text: w === 0 ? `You go out. You score the Scribe's ${b} pips.` : `The Scribe goes out and scores your ${a} pips.` }; }
      if (a === b) return { winner: -1, text: `Blocked, with ${a} pips each. No one scores.` };
      return { winner: a < b ? 0 : 1, text: `Blocked. Pips left: you ${a}, the Scribe ${b}. ${a < b ? 'You score' : 'The Scribe scores'} ${Math.abs(a - b)}.` };
    },
    snapshot() { return JSON.stringify([this.hands, this.yard, this.line, this.ends, this.passes, this.out, this.ply, [...this.lacks[0]], [...this.lacks[1]]]); },
    restore(s) { const v = JSON.parse(s); [this.hands, this.yard, this.line, this.ends, this.passes, this.out, this.ply] = v; this.lacks = [new Set(v[7]), new Set(v[8])]; },
    // The Scribe's choice of tile, using only what it can see: its hand, the line, and what you have shown you lack.
    choose(pl, ms) {
      if (ms.length === 1 || LEVEL.name === 'gentle') return ms[(Math.random() * ms.length) | 0];
      const h = this.hands[pl], foe = 1 - pl;
      const val = m => {
        const [a, b] = DM_T[m.t]; let v = a + b + (a === b ? 6 : 0);
        if (LEVEL.name === 'sharp') {
          const ends = this.ends ? this.ends.slice() : [a, b];
          if (this.ends) { const s = m.side, o = a === ends[s] ? b : a; ends[s] = o; }
          const rest = h.filter(t => t !== m.t);
          v += 2.5 * ends.reduce((acc, e) => acc + rest.filter(t => this.fits(t, e)).length, 0); // keep plays for later
          v += 5 * ends.filter(e => this.lacks[foe].has(e)).length; // leave ends the visitor cannot match
          // Numbers already showing on the table are scarcer for the visitor too.
          const seen = e => this.line.reduce((acc, x) => acc + (x.l === e) + (x.r === e), 0) + rest.filter(t => this.fits(t, e)).length;
          v += 0.8 * ends.reduce((acc, e) => acc + seen(e), 0);
        }
        return v;
      };
      return ms.reduce((x, y) => (val(y) > val(x) ? y : x));
    },
    aiPlan(pl) {
      const snap = this.snapshot(), plan = [];
      for (let k = 0; k < 30; k++) {
        const ms = this.legal(pl); if (!ms.length) break;
        if (ms[0].kind === 'draw') { plan.push(ms[0]); this.apply(ms[0]); continue; }
        plan.push(ms[0].kind === 'pass' ? ms[0] : this.choose(pl, ms)); break;
      }
      this.restore(snap);
      return plan;
    },
  };

  /* ------------------------------------------------------------------ Tablut
   * Linnaeus's Lapland tafl, 9x9, index r*9+c. 0 empty, 1 Muscovite, 2 Swede, 3 king.
   * The visitor commands the Swedes and the king; the Scribe the Muscovites, who move first. */
  const TB_N = 9, TB_THRONE = 40, TB_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const TABLUT = {
    id: 'tablut', name: 'Tablut', dice: false, first: 1, THRONE: TB_THRONE, N: TB_N,
    rules: [
      'The Scribe commands the sixteen Muscovites and moves first. You command the king and his eight Swedes.',
      'Every piece moves like a chess rook: any distance in a straight line, without jumping. Only the king may stop on the throne in the centre; others may pass over it when it is empty.',
      'Trap an enemy piece between two of yours to capture it. The empty throne counts as an enemy to both sides, and the king helps the Swedes capture.',
      'The king is captured like any other piece, by two Muscovites on opposite sides, except on the throne, where it takes four, and beside it, where it takes three with the throne as the fourth.',
      'You win when the king reaches any square on the edge of the board. The Scribe wins by capturing him.',
      'House rule: after a hundred moves each with no result, the game is drawn.'
    ],
    source: 'Linnaeus\'s account of 1732, read as most modern players do: the king escapes to any edge square and is armed, and is captured by two except on or beside the throne.',
    init() {
      const b = Array(81).fill(0);
      [3, 4, 5, 13, 27, 36, 45, 37, 35, 44, 53, 43, 75, 76, 77, 67].forEach(i => { b[i] = 1; });
      [22, 31, 38, 39, 41, 42, 49, 58].forEach(i => { b[i] = 2; });
      b[TB_THRONE] = 3;
      this.b = b; this.win = null; this.ply = 0;
    },
    owns(pl, v) { return pl === 1 ? v === 1 : v === 2 || v === 3; },
    count(pl) { let n = 0; for (const v of this.b) if (this.owns(pl, v)) n++; return n; },
    edge(i) { const r = (i / 9) | 0, c = i % 9; return r === 0 || r === 8 || c === 0 || c === 8; },
    legal(pl) {
      if (this.win) return [];
      const b = this.b, out = [];
      for (let i = 0; i < 81; i++) {
        const v = b[i]; if (!this.owns(pl, v)) continue;
        const r0 = (i / 9) | 0, c0 = i % 9;
        for (const [dr, dc] of TB_DIRS) {
          let r = r0 + dr, c = c0 + dc;
          while (r >= 0 && r < 9 && c >= 0 && c < 9) {
            const j = r * 9 + c;
            if (b[j]) break;
            if (j !== TB_THRONE || v === 3) out.push({ pl, from: i, to: j });
            r += dr; c += dc;
          }
        }
      }
      return out;
    },
    anvil(j, pl) { const v = this.b[j]; return this.owns(pl, v) || (v === 0 && j === TB_THRONE); },
    nb(k) { const r = (k / 9) | 0, c = k % 9; return TB_DIRS.map(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr < 0 || rr > 8 || cc < 0 || cc > 8 ? -1 : rr * 9 + cc; }); },
    apply(m) {
      const b = this.b, v = b[m.from];
      b[m.from] = 0; b[m.to] = v; this.ply++;
      const caps = [];
      if (v === 3 && this.edge(m.to)) { this.win = { winner: 0, text: 'The king reaches the edge of the board and escapes.' }; return { caps, note: 'The king escapes.' }; }
      const r = (m.to / 9) | 0, c = m.to % 9;
      for (const [dr, dc] of TB_DIRS) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 8 || cc < 0 || cc > 8) continue;
        const n = rr * 9 + cc, t = b[n];
        if (!t || this.owns(m.pl, t)) continue;
        const fr = rr + dr, fc = cc + dc, far = fr < 0 || fr > 8 || fc < 0 || fc > 8 ? -1 : fr * 9 + fc;
        if (t === 3) {
          const nb = this.nb(n); let caught;
          if (n === TB_THRONE) caught = nb.every(j => j >= 0 && b[j] === 1);
          else if (nb.includes(TB_THRONE)) caught = nb.every(j => j === TB_THRONE || (j >= 0 && b[j] === 1));
          else caught = far >= 0 && this.anvil(far, m.pl);
          if (caught) { b[n] = 0; caps.push(n); this.win = { winner: 1, text: 'The king is surrounded and captured.' }; }
          continue;
        }
        if (far >= 0 && this.anvil(far, m.pl)) { b[n] = 0; caps.push(n); }
      }
      let note = '';
      if (this.win) note = 'The king is captured.';
      else if (caps.length) note = m.pl === 0 ? (caps.length > 1 ? `You capture ${caps.length} Muscovites.` : 'You capture a Muscovite.') : (caps.length > 1 ? `The Scribe captures ${caps.length} of your Swedes.` : 'The Scribe captures one of your Swedes.');
      return { caps, note };
    },
    result(pl) {
      if (this.win) return this.win;
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no legal move.' : 'The Scribe has no legal move.' };
      if (this.ply >= 200) return { winner: -1, text: 'A hundred moves each without a result. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.win, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.win = s[1]; this.ply = s[2]; },
    // Open lines from the king to the edge: one is a threat, two cannot both be blocked.
    kingRuns() {
      const k = this.b.indexOf(3); if (k < 0) return 0;
      let n = 0; const r = (k / 9) | 0, c = k % 9;
      for (const [dr, dc] of TB_DIRS) {
        let rr = r + dr, cc = c + dc, open = true;
        while (rr >= 0 && rr < 9 && cc >= 0 && cc < 9) { if (this.b[rr * 9 + cc]) { open = false; break; } rr += dr; cc += dc; }
        if (open) n++;
      }
      return n;
    },
    turns(pl) {
      const k = this.b.indexOf(3), kr = (k / 9) | 0, kc = k % 9;
      const near = m => Math.abs(((m.to / 9) | 0) - kr) + Math.abs((m.to % 9) - kc);
      const ms = this.legal(pl);
      ms.sort((a, b) => near(a) - near(b));
      return ms.slice(0, 40).map(m => [m]);
    },
    terminal(pl, depth) {
      if (this.win) return this.win.winner === pl ? 1000 + depth : -1000 - depth;
      if (this.ply >= 200) return 0;
      return null;
    },
    evaluate(pl) {
      const k = this.b.indexOf(3); if (k < 0) return pl === 1 ? 900 : -900;
      const runs = this.kingRuns(), r = (k / 9) | 0, c = k % 9, toEdge = Math.min(r, c, 8 - r, 8 - c);
      let around = 0; for (const j of this.nb(k)) if (j >= 0 && this.b[j] === 1) around++;
      const sw = (this.count(0) - 1) * 1.6 - this.count(1) + runs * (runs > 1 ? 30 : 6) - toEdge * 0.8 - around * 2.5;
      return pl === 0 ? sw : -sw;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

  /* ------------------------------------------------------------------ Makruk
   * Thai chess. Index r*8+c, row 0 nearest the visitor (white). Piece codes:
   * 1 khun (king), 2 met, 3 khon, 4 ma, 5 ruea, 6 bia (pawn), 7 promoted bia; +8 for the Scribe. */
  const MK_K = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], MK_D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const MK_N = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]], MK_R = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const MK_VAL = [0, 0, 2, 3, 3.2, 5, 1, 2];
  const MAKRUK = {
    id: 'makruk', name: 'Makruk', dice: false, first: 0,
    rules: [
      'You play white and move first. Checkmate the Scribe\'s khun (king) to win.',
      'Khun: one square any way. Ruea (boat): like a rook. Ma (horse): like a knight. Khon (nobleman): one square diagonally, or one straight forward. Met (seed): one square diagonally.',
      'Bia (cowrie, the pawn): one square forward, capturing one square diagonally forward. No double first step. A bia reaching the sixth rank turns over and moves like a met.',
      'There is no castling. Stalemate is a draw.',
      'Counting: when no unpromoted bia is left, the side behind may count, and mate must come within 64 moves. When a side is down to its khun alone, the other must mate within a limit set by its pieces (8 moves with two rueas, 16 with one, and so on), counted from the number of pieces on the board. Otherwise the game is drawn.'
    ],
    source: 'Makruk as played in Thailand today, with the counting rules simplified: the count is kept for you.',
    init() {
      const b = new Array(64).fill(0), back = [5, 4, 3, 1, 2, 3, 4, 5], top = [5, 4, 3, 2, 1, 3, 4, 5];
      for (let c = 0; c < 8; c++) { b[c] = back[c]; b[16 + c] = 6; b[40 + c] = 14; b[56 + c] = top[c] + 8; }
      this.b = b; this.ply = 0; this.count = null; this.over = null;
    },
    side(v) { return v ? (v > 8 ? 1 : 0) : -1; },
    kingAt(pl) { const k = pl ? 9 : 1; return this.b.indexOf(k); },
    attacked(i, by) { // is square i attacked by player by?
      const b = this.b, r = i >> 3, c = i & 7, own = v => v && this.side(v) === by, t = v => v & 7;
      for (const [dr, dc] of MK_N) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { const v = b[rr * 8 + cc]; if (own(v) && t(v) === 4) return true; } }
      for (const [dr, dc] of MK_R) { let rr = r + dr, cc = c + dc; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { const v = b[rr * 8 + cc]; if (v) { if (own(v) && t(v) === 5) return true; break; } rr += dr; cc += dc; } }
      for (const [dr, dc] of MK_K) {
        const rr = r + dr, cc = c + dc; if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
        const v = b[rr * 8 + cc]; if (!own(v)) continue;
        const tt = t(v), fwd = by === 0 ? 1 : -1, diag = dr !== 0 && dc !== 0;
        if (tt === 1) return true;
        if ((tt === 2 || tt === 7) && diag) return true;
        if (tt === 3 && (diag || (dc === 0 && dr === -fwd))) return true; // a khon attacks diagonally and straight forward
        if (tt === 6 && diag && dr === -fwd) return true;
      }
      return false;
    },
    pseudo(pl) {
      const b = this.b, out = [], fwd = pl === 0 ? 1 : -1;
      for (let i = 0; i < 64; i++) {
        const v = b[i]; if (!v || this.side(v) !== pl) continue;
        const t = v & 7, r = i >> 3, c = i & 7;
        const add = (rr, cc, capOnly, quietOnly) => {
          if (rr < 0 || rr > 7 || cc < 0 || cc > 7) return false;
          const j = rr * 8 + cc, w = b[j];
          if (w && this.side(w) === pl) return false;
          if (w && quietOnly) return false;
          if (!w && capOnly) return true;
          out.push({ pl, from: i, to: j, cap: !!w }); return !w;
        };
        if (t === 1) MK_K.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === 2 || t === 7) MK_D.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === 3) { MK_D.forEach(([dr, dc]) => add(r + dr, c + dc)); add(r + fwd, c); }
        else if (t === 4) MK_N.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === 5) MK_R.forEach(([dr, dc]) => { let rr = r + dr, cc = c + dc; while (add(rr, cc)) { rr += dr; cc += dc; } });
        else if (t === 6) { add(r + fwd, c, false, true); add(r + fwd, c - 1, true); add(r + fwd, c + 1, true); }
      }
      return out;
    },
    legal(pl) {
      if (this.over) return [];
      return this.pseudo(pl).filter(m => { const s = this.snapshot(); this.move(m); const ok = !this.attacked(this.kingAt(pl), 1 - pl); this.restore(s); return ok; });
    },
    move(m) {
      const b = this.b, v = b[m.from]; b[m.from] = 0; b[m.to] = v;
      const promoRow = m.pl === 0 ? 5 : 2;
      if ((v & 7) === 6 && (m.to >> 3) === promoRow) { b[m.to] = 7 + (m.pl ? 8 : 0); m.promo = true; }
      this.ply++;
    },
    material(pl) { let s = 0; for (const v of this.b) if (v && this.side(v) === pl) s += MK_VAL[v & 7]; return s; },
    pieces(pl) { let n = 0; for (const v of this.b) if (v && this.side(v) === pl) n++; return n; },
    apply(m) {
      const captured = this.b[m.to];
      this.move(m);
      // The counts: start them when their conditions first hold, and step them each move.
      const pawns = this.b.some(v => (v & 7) === 6);
      for (const lone of [0, 1]) {
        if (this.pieces(lone) === 1 && (!this.count || this.count.kind !== 'pieces')) {
          const strong = 1 - lone, has = t => this.b.filter(v => v && this.side(v) === strong && (v & 7) === t).length;
          const lim = has(5) >= 2 ? 8 : has(5) === 1 ? 16 : has(3) >= 2 ? 22 : has(4) >= 2 ? 32 : has(3) === 1 ? 44 : 64;
          this.count = { kind: 'pieces', lone, n: this.pieces(0) + this.pieces(1), lim };
        }
      }
      if (!pawns && !this.count) this.count = { kind: 'board', n: 0, lim: 64 };
      let note = '';
      if (this.count && m.pl === (this.count.kind === 'pieces' ? this.count.lone : this.behind())) { this.count.n++; }
      const opp = 1 - m.pl, check = this.attacked(this.kingAt(opp), m.pl);
      if (m.promo) note = m.pl === 0 ? 'Your bia turns over: it now moves like a met.' : 'The Scribe\'s bia turns over.';
      if (check) note = (note ? note + ' ' : '') + (m.pl === 0 ? 'Check.' : 'Check!');
      return { note, caps: captured ? [m.to] : [] };
    },
    behind() { return this.material(0) <= this.material(1) ? 0 : 1; },
    result(pl) {
      const ms = this.legal(pl);
      if (!ms.length) {
        if (this.attacked(this.kingAt(pl), 1 - pl)) return { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate.' };
        return { winner: -1, text: 'Stalemate. In makruk that is a draw.' };
      }
      if (this.count && this.count.n >= this.count.lim) return { winner: -1, text: this.count.kind === 'pieces' ? 'The count ran out before mate: a draw.' : 'Sixty-four moves counted without mate: a draw.' };
      if (this.pieces(0) === 1 && this.pieces(1) === 1) return { winner: -1, text: 'Only the two khuns are left: a draw.' };
      if (this.ply >= 400) return { winner: -1, text: 'Two hundred moves each: a draw.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply, this.count ? Object.assign({}, this.count) : null]; },
    restore(s) { this.b = s[0].slice(); this.ply = s[1]; this.count = s[2] ? Object.assign({}, s[2]) : null; },
    turns(pl) {
      const ms = this.legal(pl);
      const val = m => (this.b[m.to] ? 10 * MK_VAL[this.b[m.to] & 7] - MK_VAL[this.b[m.from] & 7] : 0);
      ms.sort((a, b) => val(b) - val(a));
      return ms.map(m => [m]);
    },
    terminal(pl, depth) {
      if (!this.legal(pl).length) return this.attacked(this.kingAt(pl), 1 - pl) ? -1000 - depth : 0;
      if (this.count && this.count.n >= this.count.lim) return 0;
      return null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v) continue;
        const p = this.side(v), t = v & 7, r = i >> 3, c = i & 7;
        let x = MK_VAL[t] + (t !== 1 && t !== 5 ? 0.05 * (3.5 - Math.abs(c - 3.5)) : 0);
        if (t === 6) x += 0.08 * (p === 0 ? r - 2 : 5 - r);
        s += p === pl ? x : -x;
      }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 5); },
  };

  /* ------------------------------------------------------------------- Kalah
   * Pits 0-5 are the visitor's, left to right; 6 is the visitor's store (kalah, on
   * their right); 7-12 the Scribe's, running back the other way; 13 the Scribe's store. */
  const KALAH = {
    id: 'kalah', name: 'Kalah', dice: false, first: 0, seeds: 4, followPrompt: 'Choose another pit to sow.',
    variants: [{ id: '3', label: '3 seeds' }, { id: '4', label: '4 seeds' }, { id: '6', label: '6 seeds' }],
    variant: '4', variantLabel: 'Seeds',
    setVariant(id) { this.variant = ['3', '4', '6'].includes(id) ? id : '4'; this.seeds = +this.variant; },
    rules: [
      'Each of you owns the six pits on your side and the store (kalah) on your right. You move first.',
      'Take all the seeds from one of your pits and sow them one by one, anticlockwise, into the following pits and your own store, but never the Scribe\'s store.',
      'If your last seed falls in your store, you move again.',
      'If it falls in an empty pit on your side and the Scribe\'s pit opposite has seeds, you capture both: that seed and everything opposite go to your store.',
      'When one side\'s pits are all empty, the game ends and the other side puts its remaining seeds in its own store. The fuller store wins.'
    ],
    source: 'Kalah as William Julius Champion Jr. sold it from 1944, with the usual modern rules.',
    init() { const p = new Array(14).fill(this.seeds); p[6] = 0; p[13] = 0; this.p = p; this.over = false; this.ply = 0; },
    pit(pl, k) { return pl * 7 + k; }, store(pl) { return pl * 7 + 6; },
    side(pl) { let n = 0; for (let k = 0; k < 6; k++) n += this.p[pl * 7 + k]; return n; },
    legal(pl) { if (this.over) return []; const out = []; for (let k = 0; k < 6; k++) if (this.p[pl * 7 + k]) out.push({ pl, pit: pl * 7 + k }); return out; },
    apply(m) {
      const p = this.p, pl = m.pl, skip = this.store(1 - pl), trace = [];
      let n = p[m.pit], at = m.pit; p[m.pit] = 0; trace.push([m.pit, 0]);
      while (n) { at = (at + 1) % 14; if (at === skip) continue; p[at]++; n--; trace.push([at, p[at]]); }
      this.ply++;
      let again = at === this.store(pl), caps = 0, note = '';
      const mine = at >= pl * 7 && at < pl * 7 + 6;
      if (mine && p[at] === 1) {
        const opp = 12 - at;
        if (p[opp]) { caps = p[opp] + 1; p[this.store(pl)] += caps; trace.push([opp, 0], [at, 0], [this.store(pl), p[this.store(pl)]]); p[opp] = 0; p[at] = 0; note = pl === 0 ? `You capture ${caps} seeds.` : `The Scribe captures ${caps} seeds.`; }
      }
      // The end: the side with seeds left keeps them.
      if (!this.side(0) || !this.side(1)) {
        for (const q of [0, 1]) { let rest = 0; for (let k = 0; k < 6; k++) { const i = q * 7 + k; if (p[i]) { rest += p[i]; p[i] = 0; trace.push([i, 0]); } } if (rest) { p[this.store(q)] += rest; trace.push([this.store(q), p[this.store(q)]]); } }
        this.over = true; again = false;
      }
      if (again) note = (note ? note + ' ' : '') + (pl === 0 ? 'Your last seed lands in your store: move again.' : 'The Scribe\'s last seed lands in its store, and it moves again.');
      const r = { trace, note, again, caps: caps ? [1] : [] };
      if (again && pl === 0) r.followUp = this.legal(0);
      return r;
    },
    result() {
      if (!this.over) return null;
      const a = this.p[6], b = this.p[13];
      return { winner: a > b ? 0 : b > a ? 1 : -1, text: `Stores: you ${a}, the Scribe ${b}.` };
    },
    snapshot() { return [this.p.slice(), this.over, this.ply]; },
    restore(s) { this.p = s[0].slice(); this.over = s[1]; this.ply = s[2]; },
    // A turn is a whole chain of sowings while the last seed keeps landing in the store.
    turns(pl) {
      const out = [], rec = (prefix, depth) => {
        for (const m of this.legal(pl)) {
          const s = this.snapshot(), r = this.apply(m);
          if (r.again && depth < 8 && this.legal(pl).length) rec(prefix.concat([m]), depth + 1);
          else out.push(prefix.concat([m]));
          this.restore(s);
        }
      };
      rec([], 0);
      return out.length ? out : [[]];
    },
    terminal(pl, depth) {
      if (this.over) { const d = this.p[this.store(pl)] - this.p[this.store(1 - pl)]; return d > 0 ? 1000 + depth : d < 0 ? -1000 - depth : 0; }
      const half = this.seeds * 6;
      if (this.p[this.store(pl)] > half) return 1000 + depth;
      if (this.p[this.store(1 - pl)] > half) return -1000 - depth;
      return null;
    },
    evaluate(pl) { return this.p[this.store(pl)] - this.p[this.store(1 - pl)] + 0.25 * (this.side(pl) - this.side(1 - pl)); },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 8); },
  };

  /* ---------------------------------------------------------------- Cribbage
   * Two-player six-card cribbage. Card c: rank c % 13 (0 ace ... 12 king), suit
   * (c / 13) | 0 (spades, hearts, diamonds, clubs). The turn order is not simple
   * alternation, so need says who acts next and how: discard, play, or next (the
   * visitor reads the show and asks for the next deal). */
  const CR_RANK = 'A 2 3 4 5 6 7 8 9 10 J Q K'.split(' '), CR_SUIT = ['♠', '♥', '♦', '♣'];
  const crRank = c => c % 13, crSuit = c => (c / 13) | 0, crVal = c => Math.min(10, (c % 13) + 1);
  const crName = c => CR_RANK[crRank(c)] + CR_SUIT[crSuit(c)];
  // Score a hand of four with the starter: fifteens, pairs, runs, flush and nobs, with the words for each.
  function crShow(hand, starter, crib) {
    const all = starter >= 0 ? hand.concat([starter]) : hand.slice(), n = all.length, parts = []; let total = 0;
    let fif = 0;
    for (let mask = 1; mask < 1 << n; mask++) { let sum = 0; for (let k = 0; k < n; k++) if (mask & (1 << k)) sum += crVal(all[k]); if (sum === 15) fif++; }
    if (fif) { total += 2 * fif; parts.push(`${fif === 1 ? 'fifteen' : fif + ' fifteens'} for ${2 * fif}`); }
    let pairs = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (crRank(all[i]) === crRank(all[j])) pairs++;
    if (pairs) { total += 2 * pairs; parts.push(`${pairs === 1 ? 'a pair' : pairs === 3 ? 'a pair royal' : pairs === 6 ? 'a double pair royal' : pairs + ' pairs'} for ${2 * pairs}`); }
    const cnt = new Array(13).fill(0); all.forEach(c => cnt[crRank(c)]++);
    let runPts = 0;
    for (let r = 0; r < 13;) {
      if (!cnt[r]) { r++; continue; }
      let e = r, mult = 1; while (e < 13 && cnt[e]) { mult *= cnt[e]; e++; }
      if (e - r >= 3) { runPts += (e - r) * mult; parts.push(`${mult > 1 ? mult + ' runs' : 'a run'} of ${e - r} for ${(e - r) * mult}`); }
      r = e;
    }
    total += runPts;
    const fs = crSuit(hand[0]);
    if (hand.every(c => crSuit(c) === fs)) {
      if (starter >= 0 && crSuit(starter) === fs) { total += 5; parts.push('a flush of five for 5'); }
      else if (!crib) { total += 4; parts.push('a flush for 4'); }
    }
    if (starter >= 0 && hand.some(c => crRank(c) === 10 && crSuit(c) === crSuit(starter))) { total += 1; parts.push('his nobs for 1'); }
    return { total, parts };
  }
  // Points for the card just played onto the run of play.
  function crPeg(seq, count) {
    let pts = 0; const why = [];
    if (count === 15) { pts += 2; why.push('fifteen for 2'); }
    if (count === 31) { pts += 2; why.push('thirty-one for 2'); }
    let k = 1; const last = crRank(seq[seq.length - 1]);
    while (k < seq.length && crRank(seq[seq.length - 1 - k]) === last) k++;
    if (k >= 2) { const p = [0, 0, 2, 6, 12][k]; pts += p; why.push(k === 2 ? 'a pair for 2' : k === 3 ? 'a pair royal for 6' : 'a double pair royal for 12'); }
    for (let n = seq.length; n >= 3; n--) {
      const ranks = seq.slice(-n).map(crRank), lo = Math.min(...ranks), hi = Math.max(...ranks);
      if (hi - lo === n - 1 && new Set(ranks).size === n) { pts += n; why.push(`a run of ${n} for ${n}`); break; }
    }
    return { pts, why };
  }
  const CRIBBAGE = {
    id: 'cribbage', name: 'Cribbage', dice: false, first: 0, target: 61,
    variants: [{ id: '61', label: 'To 61' }, { id: '121', label: 'To 121' }],
    variant: '61', variantLabel: 'Game',
    setVariant(id) { this.variant = id === '121' ? '121' : '61'; this.target = +this.variant; },
    show: crShow, peg: crPeg, name_: crName, cardName: crName, rank: crRank, suit: crSuit, val: crVal,
    get followPrompt() {
      const t = this.need.type;
      if (t === 'discard') return `Lay one more card aside for ${this.dealer === 0 ? 'your' : 'the Scribe\'s'} crib.`;
      if (t === 'next') return 'Press Next deal when you are ready.';
      return `The count is ${this.count}. Click a card to play.`;
    },
    rules: [
      'Each deal, you each get six cards and lay two aside, face down, for the crib, which scores for the dealer. The deal alternates; the Scribe deals first. Then a starter card is turned up, and if it is a jack the dealer pegs 2 for his heels.',
      'The play: starting with the player who did not deal, you take turns laying a card and calling the running total, which may not pass 31. Score 2 for making 15 or 31, 2 for a pair with the card before (6 for three of a kind, 12 for four), and 1 a card for a run of three or more. When neither of you can play without passing 31, the last to play pegs 1 for the go and the count starts again from nothing. The last card of all pegs 1.',
      'The show: each hand of four, with the starter, counts 2 for every combination making 15, 2 for every pair, 1 a card for runs, 4 for a flush (5 if the starter matches; the crib needs all five) and 1 for his nobs, a jack of the starter\'s suit. The non-dealer counts first, then the dealer\'s hand, then the crib.',
      'The first to peg out wins: 61 points here by default, or the full 121.'
    ],
    source: 'Cribbage as Sir John Suckling is said to have devised it in the 1630s from the older game of noddy, in its modern two-player six-card form.',
    init() { this.score = [0, 0]; this.dealer = 1; this.over = -1; this.deals = 0; this.lastShow = null; this.deal(); },
    deal() {
      const d = Array.from({ length: 52 }, (_, k) => k);
      for (let k = 51; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [d[k], d[j]] = [d[j], d[k]]; }
      this.deck = d; this.hands = [d.slice(0, 6), d.slice(6, 12)]; this.crib = []; this.starter = -1; this.deals++;
      this.seq = []; this.count = 0; this.played = [[], []]; this.kept = null; this.lastShow = null; this.lastPlayer = -1; this.resets = 0;
      // The Scribe lays its two for the crib at once; the visitor chooses theirs.
      const lay = this.aiDiscard(1);
      lay.forEach(c => { this.hands[1].splice(this.hands[1].indexOf(c), 1); this.crib.push(c); });
      this.need = { pl: 0, type: 'discard' };
    },
    add(pl, pts, notes, why) {
      if (!pts || this.over >= 0) return;
      this.score[pl] = Math.min(this.target, this.score[pl] + pts);
      if (why) notes.push(why);
      if (this.score[pl] >= this.target) { this.over = pl; notes.push(pl === 0 ? 'You peg out!' : 'The Scribe pegs out.'); }
    },
    canPlay(pl) { return this.hands[pl].some(c => this.count + crVal(c) <= 31); },
    legal(pl) {
      if (this.over >= 0 || this.need.pl !== pl) return [];
      if (this.need.type === 'discard') return this.hands[pl].map(c => ({ pl, kind: 'discard', c }));
      if (this.need.type === 'next') return [{ pl, kind: 'next', label: this.over >= 0 ? 'Done' : 'Next deal' }];
      return this.hands[pl].filter(c => this.count + crVal(c) <= 31).map(c => ({ pl, kind: 'play', c }));
    },
    who(pl) { return pl === 0 ? 'You' : 'The Scribe'; },
    apply(m) {
      const pl = m.pl, notes = [], res = { note: '', events: [] };
      if (m.kind === 'discard') {
        this.hands[pl].splice(this.hands[pl].indexOf(m.c), 1); this.crib.push(m.c);
        res.events.push({ type: 'crib', c: m.c, pl });
        if (this.crib.length === 4) {
          this.kept = [this.hands[0].slice(), this.hands[1].slice()];
          const rest = this.deck.filter(c => !this.hands[0].includes(c) && !this.hands[1].includes(c) && !this.crib.includes(c));
          this.starter = rest[(Math.random() * rest.length) | 0];
          res.events.push({ type: 'starter', c: this.starter });
          notes.push(`The starter is the ${crName(this.starter)}.`);
          if (crRank(this.starter) === 10) this.add(this.dealer, 2, notes, `${this.who(this.dealer)} ${this.dealer === 0 ? 'peg' : 'pegs'} 2 for his heels.`);
          this.need = { pl: 1 - this.dealer, type: 'play' };
          this.settle(notes, res);
        }
      } else if (m.kind === 'play') {
        this.hands[pl].splice(this.hands[pl].indexOf(m.c), 1); this.played[pl].push(m.c);
        this.seq.push(m.c); this.count += crVal(m.c); this.lastPlayer = pl;
        res.events.push({ type: 'play', c: m.c, pl, count: this.count });
        const pg = crPeg(this.seq, this.count);
        notes.push(`${this.count}.`);
        if (pg.pts) this.add(pl, pg.pts, notes, `${this.who(pl)}: ${pg.why.join(', ')}.`);
        if (this.count === 31) this.reset(res);
        this.need = { pl: 1 - pl, type: 'play' };
        this.settle(notes, res);
      } else if (m.kind === 'next') {
        if (this.over < 0) { this.dealer = 1 - this.dealer; this.deal(); res.events.push({ type: 'deal' }); notes.push(this.dealer === 0 ? 'Your deal: the crib is yours.' : 'The Scribe deals: the crib is its.'); }
      }
      res.note = notes.join(' ');
      if (pl === 0 && this.need.pl === 0 && this.over < 0) res.followUp = this.legal(0);
      return res;
    },
    reset(res) { this.seq = []; this.count = 0; this.resets++; res.events.push({ type: 'reset' }); },
    // After a card: pass the turn over anyone who cannot play, score the go, and run the show when the cards are out.
    settle(notes, res) {
      if (this.over >= 0) return;
      for (let guard = 0; guard < 6; guard++) {
        const q = this.need.pl;
        if (!this.hands[0].length && !this.hands[1].length) {
          if (this.count && this.count < 31) this.add(this.lastPlayer, 1, notes, `${this.who(this.lastPlayer)}: 1 for the last card.`);
          if (this.over < 0) this.showAll(notes, res);
          return;
        }
        if (this.canPlay(q)) return;
        if (this.canPlay(1 - q)) { if (this.hands[q].length) notes.push(q === 0 ? 'You say go.' : 'The Scribe says go.'); this.need = { pl: 1 - q, type: 'play' }; return; }
        // Neither can play: a go for the last to play, and a fresh count.
        if (this.count && this.count < 31) this.add(this.lastPlayer, 1, notes, `${this.who(this.lastPlayer)}: 1 for the go.`);
        if (this.over >= 0) return;
        this.reset(res);
        const next = 1 - this.lastPlayer;
        this.need = { pl: this.hands[next].length ? next : this.lastPlayer, type: 'play' };
      }
    },
    showAll(notes, res) {
      const pone = 1 - this.dealer, out = [];
      for (const [pl, cards, crib] of [[pone, this.kept[pone], false], [this.dealer, this.kept[this.dealer], false], [this.dealer, this.crib, true]]) {
        const sh = crShow(cards, this.starter, crib);
        const label = crib ? (pl === 0 ? 'Your crib' : 'The Scribe\'s crib') : (pl === 0 ? 'Your hand' : 'The Scribe\'s hand');
        out.push({ pl, crib, cards, total: sh.total, text: `${label}: ${sh.parts.length ? sh.parts.join(', ') : 'nineteen (nothing)'}${sh.total ? `, ${sh.total} in all` : ''}.` });
        this.add(pl, sh.total, []);
        if (this.over >= 0) break;
      }
      this.lastShow = out;
      res.events.push({ type: 'show', show: out });
      notes.push(out.map(x => x.text).join(' '));
      if (this.over >= 0) notes.push(this.over === 0 ? 'You peg out!' : 'The Scribe pegs out.');
      this.need = { pl: 0, type: 'next' };
    },
    result() {
      if (this.over < 0) return null;
      const w = this.over, l = 1 - w, lurch = this.score[l] < (this.target === 121 ? 91 : 31);
      return { winner: w, text: `${w === 0 ? 'You' : 'The Scribe'} reached ${this.target}; ${w === 0 ? 'the Scribe' : 'you'} had ${this.score[l]}.${lurch ? ' A lurch: a double game.' : ''}` };
    },
    snapshot() { return JSON.stringify({ score: this.score, dealer: this.dealer, over: this.over, deals: this.deals, deck: this.deck, hands: this.hands, crib: this.crib, starter: this.starter, seq: this.seq, count: this.count, played: this.played, kept: this.kept, lastPlayer: this.lastPlayer, need: this.need, lastShow: this.lastShow, resets: this.resets }); },
    restore(s) { Object.assign(this, JSON.parse(s)); },
    // The Scribe's two for the crib: the four it keeps should score well with any starter.
    aiDiscard(pl) {
      const h = this.hands[pl], mine = this.dealer === pl;
      if (LEVEL.name === 'gentle') { const a = h.slice().sort(() => Math.random() - 0.5); return a.slice(0, 2); }
      let best = null, bv = -Infinity;
      const others = Array.from({ length: 52 }, (_, k) => k).filter(c => !h.includes(c));
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
        const keep = h.filter((_, k) => k !== i && k !== j), lay = [h[i], h[j]];
        let v;
        if (LEVEL.name === 'fair') v = crShow(keep, -1, false).total; // no starter: score what is held
        else { v = 0; for (const st of others) v += crShow(keep, st, false).total; v /= others.length; }
        // What the two laid aside are worth in the crib: a pair, a fifteen or fives help whoever owns it.
        let c = 0; if (crRank(lay[0]) === crRank(lay[1])) c += 2; if (crVal(lay[0]) + crVal(lay[1]) === 15) c += 2; c += lay.filter(x => crRank(x) === 4).length * 1.5;
        if (Math.abs(crRank(lay[0]) - crRank(lay[1])) === 1) c += 0.8;
        v += mine ? c : -c;
        if (v > bv) { bv = v; best = lay; }
      }
      return best;
    },
    // The Scribe's card in the play: take points, and avoid leaving 5 or 21 or an easy pair or run.
    aiCard(pl, ms) {
      if (ms.length === 1 || LEVEL.name === 'gentle') return ms[(Math.random() * ms.length) | 0];
      let best = ms[0], bv = -Infinity;
      for (const m of ms) {
        const seq = this.seq.concat([m.c]), count = this.count + crVal(m.c);
        let v = crPeg(seq, count).pts * 10;
        if (LEVEL.name === 'sharp') {
          if (count === 5 || count === 21) v -= 6;
          if (count < 31 && 31 - count <= 10) v -= 1; // leaves the other a likely 31
          if (count < 15 && count + 10 >= 15 && count !== 5) v -= 1.5;
          if (this.seq.length === 0 && crVal(m.c) < 5) v += 2; // a low lead cannot be made fifteen
          if (this.hands[pl].some(x => x !== m.c && crRank(x) === crRank(m.c))) v += 0.8; // a pair in hand can answer a pair
          v += crVal(m.c) * 0.05;
        } else if (count === 5 || count === 21) v -= 3;
        if (v > bv) { bv = v; best = m; }
      }
      return best;
    },
    aiPlan(pl) {
      const plan = [], snap = this.snapshot();
      for (let k = 0; k < 20 && this.over < 0 && this.need.pl === pl; k++) {
        const ms = this.legal(pl); if (!ms.length) break;
        const m = ms[0].kind === 'play' ? this.aiCard(pl, ms) : ms[0];
        plan.push(m); this.apply(m);
      }
      this.restore(snap);
      return plan;
    },
  };

  /* -------------------------------------------------------------- Morabaraba
   * The morris board with diagonals joining the corners of the three squares,
   * and twelve cows a side. The diagonals are lines of the board: they carry moves and make mills. */
  const MB_ADJ = MORRIS_ADJ.map(a => a.slice());
  for (const k of [0, 2, 4, 6]) { MB_ADJ[k].push(k + 8); MB_ADJ[k + 8].push(k, k + 16); MB_ADJ[k + 16].push(k + 8); }
  const MB_MILLS = MORRIS_MILLS.concat([0, 2, 4, 6].map(k => [k, k + 8, k + 16]));
  const MORABARABA = Object.assign({}, MORRIS, {
    id: 'morabaraba', name: 'Morabaraba', N: 12, ADJ: MB_ADJ, MILLS: MB_MILLS,
    rules: [
      'Take turns placing your twelve cows on empty points. You play the pale cows and go first.',
      'Three of your cows in a row along any line, the diagonals included, make a mill. Each new mill lets you shoot one of the Scribe\'s cows. Cows in a mill are safe unless every one of them is in a mill.',
      'Once every cow is placed, move one cow along a line to a neighbouring empty point.',
      'A player down to three cows may fly them to any empty point.',
      'You lose when you have two cows left or cannot move. If both sides are down to three and no cow is shot in ten moves each, the game is drawn.'
    ],
    source: 'Morabaraba as Mind Sports South Africa plays it, on the board with diagonals, without the rule that stops a broken mill being remade at once.',
    result(pl) {
      for (const p of [0, 1]) if (this.count(p) < 3) return { winner: 1 - p, text: p === 0 ? 'You are down to two cows.' : 'The Scribe is down to two cows.' };
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no legal move.' : 'The Scribe has no legal move.' };
      if (this.count(0) === 3 && this.count(1) === 3 && !this.hand[0] && !this.hand[1] && this.quiet >= 20) return { winner: -1, text: 'Three cows each and no shot in ten moves. The game is drawn.' };
      if (this.quiet >= 160) return { winner: -1, text: 'A long stretch with no shots. The game is drawn.' };
      return null;
    },
  });
  MORABARABA.apply = function (m) {
    const r = MORRIS.apply.call(this, m);
    if (m.type === 'remove') r.note = m.pl === 0 ? 'You shoot one of the Scribe\'s cows.' : 'The Scribe shoots one of your cows.';
    return r;
  };

  /* -------------------------------------------------------------------- Ludo
   * The cross of 52 squares on a 15 x 15 grid. Square k of the track lies at LD_TRACK[k] (x right,
   * y away from the visitor); each colour starts at its own square and runs 51 squares round,
   * then five up its home column and into the centre. Position: -1 in the yard, 0-50 on the track
   * (counted from that colour's start), 51-55 the home column, 56 home. */
  const LD_TRACK = (() => {
    const t = [], seg = (x0, y0, dx, dy, n) => { for (let k = 0; k < n; k++) t.push([x0 + dx * k, y0 + dy * k]); };
    seg(1, 6, 1, 0, 5); seg(6, 5, 0, -1, 6); t.push([7, 0]); seg(8, 0, 0, 1, 6); seg(9, 6, 1, 0, 6); t.push([14, 7]);
    seg(14, 8, -1, 0, 6); seg(8, 9, 0, 1, 6); t.push([7, 14]); seg(6, 14, 0, -1, 6); seg(5, 8, -1, 0, 6); t.push([0, 7]); t.push([0, 6]);
    return t;
  })();
  const LD_START = [0, 26];
  const LUDO = {
    id: 'ludo', name: 'Ludo', dice: true, oneDie: true, pipDice: true, autoMove: true, first: 0, N: 4, TRACK: LD_TRACK, START: LD_START,
    extraNote: 'A six: throw again.',
    rules: [
      'You play red and the Scribe yellow, from opposite corners. Each of you has four tokens in your yard. You throw first.',
      'Throw one die. A six brings a token out onto your starting square, or moves one six squares, and earns another throw.',
      'Tokens run once round the board, clockwise, then turn up your own coloured column to the centre. You need the exact throw to finish.',
      'Land on a Scribe token and it goes back to its yard. Your home column is safe from capture.',
      'The first to bring all four tokens home wins. If no token can move, the turn passes.'
    ],
    source: 'Ludo as patented in England in 1896, with the common rules: a six to come out, a six to throw again, capture by landing, and an exact throw home.',
    init() { this.pos = [[-1, -1, -1, -1], [-1, -1, -1, -1]]; this.ply = 0; },
    roll() { const v = 1 + ((Math.random() * 6) | 0); return { value: v, faces: [v] }; },
    abs(pl, rel) { return rel < 0 || rel > 50 ? -1 : (rel + LD_START[pl]) % 52; },
    legal(pl, value) {
      const out = [];
      this.pos[pl].forEach((rel, k) => {
        if (rel === 56) return;
        if (rel < 0) { if (value === 6) out.push({ pl, k, from: -1, to: 0 }); return; }
        if (rel + value <= 56) out.push({ pl, k, from: rel, to: rel + value });
      });
      // Tokens of one colour on one square move the same way: offer one of them.
      const seen = new Set();
      return out.filter(m => { const key = m.from + ':' + m.to; if (seen.has(key)) return false; seen.add(key); return true; });
    },
    steps(m) { if (m.from < 0) return [0]; return Array.from({ length: m.to - m.from }, (_, i) => m.from + i + 1); },
    apply(m) {
      const pl = m.pl; this.pos[pl][m.k] = m.to; this.ply++;
      const caps = [], a = this.abs(pl, m.to);
      if (a >= 0) this.pos[1 - pl].forEach((rel, k) => { if (this.abs(1 - pl, rel) === a) { this.pos[1 - pl][k] = -1; caps.push(k); } });
      let note = '';
      if (m.from < 0) note = pl === 0 ? 'A token comes out.' : 'A Scribe token comes out.';
      if (caps.length) note = pl === 0 ? `You send ${caps.length > 1 ? caps.length + ' Scribe tokens' : 'a Scribe token'} back to its yard.` : `The Scribe sends ${caps.length > 1 ? caps.length + ' of your tokens' : 'one of your tokens'} back to your yard.`;
      if (m.to === 56) note = pl === 0 ? 'A token reaches home.' : 'A Scribe token reaches home.';
      return { note, caps };
    },
    extra(m, value) { return value === 6 && !this.done(m.pl); },
    done(pl) { return this.pos[pl].every(r => r === 56); },
    home(pl) { return this.pos[pl].filter(r => r === 56).length; },
    winText: pl => (pl === 0 ? 'All four of your tokens are home.' : 'All four Scribe tokens are home.'),
    snapshot() { return this.pos.map(a => a.slice()); },
    restore(s) { this.pos = s.map(a => a.slice()); },
    // How many enemy tokens could reach this square with one throw.
    danger(pl, rel) {
      if (rel < 1 || rel > 50) return 0;
      const a = this.abs(pl, rel); let d = 0;
      for (const r of this.pos[1 - pl]) {
        if (r < 0 || r > 50) { if (r < 0 && a === LD_START[1 - pl]) d += 0.3; continue; }
        const ea = this.abs(1 - pl, r), gap = (a - ea + 52) % 52;
        if (gap >= 1 && gap <= 6 && r + gap <= 50) d++;
      }
      return d;
    },
    aiPlan(pl, moves) {
      if (moves.length === 1 || LEVEL.name === 'gentle') return [moves[(Math.random() * moves.length) | 0]];
      const sharp = LEVEL.name === 'sharp';
      const val = m => {
        const s = this.snapshot(), r = this.apply(m); let v = 0;
        v += r.caps.length * (sharp ? 12 + 0.25 * r.caps.length : 10);
        if (m.from < 0) v += 8;
        if (m.to === 56) v += 9;
        if (m.to > 50 && m.from <= 50) v += 6;
        v += (m.to - Math.max(m.from, 0)) * 0.1;
        if (sharp) { v -= this.danger(pl, m.to) * 4 * (0.4 + m.to / 50); v += this.danger(pl, m.from) * 3 * (0.4 + m.from / 50); }
        this.restore(s); return v;
      };
      return [moves.reduce((a, b) => (val(b) > val(a) ? b : a))];
    },
  };

  /* ------------------------------------------------------------------ Janggi
   * Korean chess on 9 files x 10 rows, index r*9+c, row 0 nearest the visitor (Cho, blue).
   * Codes: 1 general, 2 guard, 3 elephant, 4 horse, 5 chariot, 6 cannon, 7 soldier; +8 for Han (the Scribe). */
  const JG_VAL = [0, 0, 3, 3, 5, 13, 7, 2];
  const jgPal = i => { const r = (i / 9) | 0, c = i % 9; return c >= 3 && c <= 5 && (r <= 2 || r >= 7); };
  // Palace diagonals: the corners join the centre.
  const JG_DIAG = (() => {
    const d = Array.from({ length: 90 }, () => []);
    for (const [r0, cr] of [[0, 1], [7, 8]]) {
      const ctr = cr * 9 + 4;
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) { const k = (cr + dr) * 9 + 4 + dc; d[ctr].push(k); d[k].push(ctr); }
    }
    return d;
  })();
  const JANGGI = {
    id: 'janggi', name: 'Janggi', dice: false, first: 0, VAL: JG_VAL,
    rules: [
      'You play Cho (blue) and move first. Checkmate Han\'s general to win. Pieces stand on the points, as in Chinese chess, but there is no river.',
      'General and guards: one step along the lines of their palace, diagonals included, never leaving it. Chariot: any distance in a straight line, and along the palace diagonals. Horse: one step straight then one diagonal, blocked by a piece on the first step. Elephant: one step straight then two diagonal, blocked by any piece on the way.',
      'Cannon: must jump over exactly one piece to move or to capture, landing anywhere beyond. It can neither jump over nor take another cannon. In a palace it may jump along a diagonal over the centre.',
      'Soldier: one step forward or sideways, and diagonally forward inside the enemy palace.',
      'You may pass instead of moving, unless you are in check. If the generals face each other on an open file and the next player does not block it, the game ends and is decided on points (chariot 13, cannon 7, horse 5, elephant 3, guard 3, soldier 2, and 1.5 to Han for moving second). Two passes in a row, or two hundred moves each, are decided the same way.'
    ],
    source: 'Janggi as played in Korea today, with the inner elephants setup for both sides and bikjang decided on points.',
    init() {
      const b = new Array(90).fill(0), back = [5, 4, 3, 2, 0, 2, 3, 4, 5];
      for (let c = 0; c < 9; c++) { b[c] = back[c]; if (back[c]) b[81 + c] = back[c] + 8; }
      b[13] = 1; b[76] = 9;
      for (const c of [1, 7]) { b[18 + c] = 6; b[63 + c] = 14; }
      for (const c of [0, 2, 4, 6, 8]) { b[27 + c] = 7; b[54 + c] = 15; }
      this.b = b; this.ply = 0; this.passes = 0; this.over = null;
    },
    side: v => (v ? (v > 8 ? 1 : 0) : -1),
    gen(pl) { return this.b.indexOf(pl ? 9 : 1); },
    facing() { const a = this.gen(0), b = this.gen(1); if (a < 0 || b < 0 || a % 9 !== b % 9) return false; for (let i = a + 9; i < b; i += 9) if (this.b[i]) return false; return true; },
    points(pl) { let s = pl ? 1.5 : 0; for (const v of this.b) if (v && this.side(v) === pl) s += JG_VAL[v & 7]; return s; },
    pseudo(pl) {
      const b = this.b, out = [];
      const own = j => b[j] && this.side(b[j]) === pl;
      const at = (r, c) => (r < 0 || r > 9 || c < 0 || c > 8 ? -1 : r * 9 + c);
      for (let i = 0; i < 90; i++) {
        const v = b[i]; if (!v || this.side(v) !== pl) continue;
        const t = v & 7, r = (i / 9) | 0, c = i % 9, add = j => { if (j >= 0 && !own(j)) out.push({ pl, from: i, to: j }); };
        if (t === 1 || t === 2) {
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = at(r + dr, c + dc); if (j >= 0 && jgPal(j) && (r <= 2) === (((j / 9) | 0) <= 2)) add(j); }
          for (const j of JG_DIAG[i]) add(j);
        } else if (t === 4 || t === 3) {
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const s1 = at(r + dr, c + dc); if (s1 < 0 || b[s1]) continue;
            for (const side of [-1, 1]) {
              const ddr = dr || side, ddc = dc || side;
              if (t === 4) add(at(r + dr + ddr, c + dc + ddc));
              else { const s2 = at(r + dr + ddr, c + dc + ddc); if (s2 < 0 || b[s2]) continue; add(at(r + dr + 2 * ddr, c + dc + 2 * ddc)); }
            }
          }
        } else if (t === 5) {
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { let rr = r + dr, cc = c + dc; for (;;) { const j = at(rr, cc); if (j < 0) break; add(j); if (b[j]) break; rr += dr; cc += dc; } }
          for (const j of JG_DIAG[i]) { add(j); if (!b[j] && JG_DIAG[j].length === 4) { const far = 2 * j - i; add(far); } }
        } else if (t === 6) {
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            let rr = r + dr, cc = c + dc, screen = false;
            for (;;) {
              const j = at(rr, cc); if (j < 0) break;
              if (!screen) { if (b[j]) { if ((b[j] & 7) === 6) break; screen = true; } }
              else { if (b[j]) { if ((b[j] & 7) !== 6) add(j); break; } add(j); }
              rr += dr; cc += dc;
            }
          }
          for (const j of JG_DIAG[i]) { if (JG_DIAG[j].length !== 4 || !b[j] || (b[j] & 7) === 6) continue; const far = 2 * j - i; if (!b[far] || ((b[far] & 7) !== 6 && !own(far))) add(far); }
        } else if (t === 7) {
          const f = pl === 0 ? 1 : -1;
          add(at(r + f, c)); add(at(r, c - 1)); add(at(r, c + 1));
          for (const j of JG_DIAG[i]) if (((j / 9) | 0) - r === f && jgPal(i)) add(j);
        }
      }
      return out;
    },
    attacked(pl) { // is pl's general attacked?
      const g = this.gen(pl); if (g < 0) return true;
      return this.pseudo(1 - pl).some(m => m.to === g);
    },
    legal(pl) {
      if (this.over) return [];
      const out = this.pseudo(pl).filter(m => { const s = this.snapshot(); this.move(m); const ok = !this.attacked(pl); this.restore(s); return ok; });
      if (!this.attacked(pl)) out.push({ pl, pass: true, label: 'Pass' });
      return out;
    },
    move(m) { if (!m.pass) { this.b[m.to] = this.b[m.from]; this.b[m.from] = 0; } this.ply++; },
    apply(m) {
      const before = this.facing(), cap = m.pass ? 0 : this.b[m.to];
      this.move(m);
      this.passes = m.pass ? this.passes + 1 : 0;
      let note = m.pass ? (m.pl === 0 ? 'You pass.' : 'The Scribe passes.') : '';
      const byPoints = why => { const a = this.points(0), b = this.points(1); this.over = { winner: a > b ? 0 : 1, text: `${why} On points: you ${a}, the Scribe ${b}.` }; };
      if (before && this.facing()) byPoints('The generals face each other and no one blocked them (bikjang).');
      else if (this.passes >= 2) byPoints('Both sides passed.');
      else if (this.ply >= 400) byPoints('Two hundred moves each.');
      else if (this.facing()) note = (note ? note + ' ' : '') + (m.pl === 0 ? 'Bikjang: the generals face each other. The Scribe must block, or the game goes to points.' : 'Bikjang: the generals face each other. Block the file, or the game goes to points.');
      else if (this.attacked(1 - m.pl)) note = (note ? note + ' ' : '') + (m.pl === 0 ? 'Janggun! Check.' : 'Janggun! Your general is in check.');
      return { note, caps: cap ? [m.to] : [] };
    },
    result(pl) {
      if (this.over) return this.over;
      const ms = this.legal(pl);
      if (ms.length === 1 && ms[0].pass && this.attacked(pl)) return { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate.' };
      if (!ms.length) return { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply, this.passes, this.over]; },
    restore(s) { this.b = s[0].slice(); this.ply = s[1]; this.passes = s[2]; this.over = s[3]; },
    turns(pl) {
      const ms = this.legal(pl).filter(m => !m.pass || this.passes === 0);
      const val = m => (m.pass ? -5 : this.b[m.to] ? 10 * JG_VAL[this.b[m.to] & 7] - JG_VAL[this.b[m.from] & 7] : 0);
      ms.sort((a, b) => val(b) - val(a));
      return ms.map(m => [m]);
    },
    terminal(pl, depth) {
      if (this.over) return this.over.winner === pl ? 1000 + depth : -1000 - depth;
      const ms = this.legal(pl);
      if (!ms.length || (ms.length === 1 && ms[0].pass && this.attacked(pl))) return -1000 - depth;
      return null;
    },
    evaluate(pl) {
      let s = this.points(pl) - this.points(1 - pl);
      for (let i = 0; i < 90; i++) { const v = this.b[i]; if ((v & 7) === 7) { const p = this.side(v), r = (i / 9) | 0, adv = p === 0 ? r - 3 : 6 - r; s += (p === pl ? 1 : -1) * 0.15 * adv; } }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

  /* ----------------------------------------------------------- Fox and Geese
   * The 33-point cross board: point (r, c) exists when r or c is 2, 3 or 4.
   * Lines run along rows and columns, and diagonally through the points whose
   * r + c is even. Index r*7+c (unused indexes are simply never occupied).
   * Player 0, the visitor, is the fox; player 1, the Scribe, has 15 geese that
   * start on the far side (rows 0-2) and may never move back toward it. */
  const FG_ON = (r, c) => r >= 0 && r < 7 && c >= 0 && c < 7 && ((r >= 2 && r <= 4) || (c >= 2 && c <= 4));
  const FG_POINTS = []; for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (FG_ON(r, c)) FG_POINTS.push(r * 7 + c);
  const FG_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  // Rule choices, kept as data so they can be tuned and tested: whether the board
  // has diagonal lines, whether geese may step sideways, and where they start.
  const FOXGEESE = {
    id: 'foxgeese', name: 'Fox and Geese', dice: false, first: 1, FOX_WINS_AT: 6,
    STALL: 40, // plies without a goose advancing or a capture before the fox escapes
    variant: { diagonals: false, sideways: true, start: [2, 3, 4, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20] },
    line(r, c, dr, dc) { return !(dr && dc) || (this.variant.diagonals && (r + c) % 2 === 0); },
    get GEESE() { return this.variant.start.length; },
    rules: [
      'You are the fox. The Scribe has thirteen geese and moves first.',
      'Each turn, move one piece along a line, across or up and down the board, to the next empty point. The fox may go any way; geese may go forward or sideways, never back.',
      'The fox captures by jumping a goose to the empty point just beyond it, and may keep jumping in one turn. Geese cannot capture.',
      'The geese win by penning the fox in so it cannot move.',
      'The fox wins by thinning the flock to six geese or fewer, or by leaving the geese with no move.',
      'House rule: if the geese go twenty moves without moving forward or losing a goose, the fox slips away and wins.'
    ],
    source: 'A common English form of the game, on the plain cross board. Medieval versions varied in the number of geese, in the lines on the board and in whether geese could move backwards. The twenty-move rule is ours, so games end.',
    init() {
      this.b = Array(49).fill(0);
      this.variant.start.forEach(i => { this.b[i] = 2; });
      this.b[24] = 1; // the fox starts in the centre
      this.ply = 0; this.stall = 0;
    },
    fox() { return this.b.indexOf(1); },
    geese() { let n = 0; for (const v of this.b) if (v === 2) n++; return n; },
    foxMoves() {
      const f = this.fox(); if (f < 0) return [];
      const out = [], r0 = (f / 7) | 0, c0 = f % 7;
      for (const [dr, dc] of FG_DIRS) {
        if (!this.line(r0, c0, dr, dc)) continue;
        const r = r0 + dr, c = c0 + dc;
        if (FG_ON(r, c) && !this.b[r * 7 + c]) out.push({ pl: 0, from: f, to: r * 7 + c, path: [r * 7 + c], caps: [] });
      }
      // Jump chains. Every stopping point along a chain is a legal move of its own.
      const seen = new Set();
      const jump = (at, path, caps) => {
        const r1 = (at / 7) | 0, c1 = at % 7;
        for (const [dr, dc] of FG_DIRS) {
          if (!this.line(r1, c1, dr, dc)) continue;
          const mr = r1 + dr, mc = c1 + dc, lr = r1 + 2 * dr, lc = c1 + 2 * dc;
          if (!FG_ON(mr, mc) || !FG_ON(lr, lc)) continue;
          const mid = mr * 7 + mc, land = lr * 7 + lc;
          if (this.b[mid] !== 2 || caps.includes(mid)) continue;
          if (this.b[land] && land !== f) continue;
          const np = path.concat([land]), nc = caps.concat([mid]);
          const key = land + ':' + nc.slice().sort((a, b) => a - b).join(',');
          if (seen.has(key)) continue; seen.add(key);
          out.push({ pl: 0, from: f, to: land, path: np, caps: nc });
          jump(land, np, nc);
        }
      };
      jump(f, [], []);
      // Where two chains end on the same point, offer the one that takes more geese.
      const best = new Map();
      for (const m of out) { const k = m.to, b = best.get(k); if (!b || m.caps.length > b.caps.length) best.set(k, m); }
      return [...best.values()];
    },
    geeseMoves() {
      const out = [];
      for (const i of FG_POINTS) {
        if (this.b[i] !== 2) continue;
        const r0 = (i / 7) | 0, c0 = i % 7;
        for (const [dr, dc] of FG_DIRS) {
          if (dr < 0 || (!dr && !this.variant.sideways) || !this.line(r0, c0, dr, dc)) continue; // never back toward the far side
          const r = r0 + dr, c = c0 + dc;
          if (FG_ON(r, c) && !this.b[r * 7 + c]) out.push({ pl: 1, from: i, to: r * 7 + c, path: [r * 7 + c], caps: [] });
        }
      }
      return out;
    },
    legal(pl) { return pl === 0 ? this.foxMoves() : this.geeseMoves(); },
    apply(m) {
      const v = this.b[m.from]; this.b[m.from] = 0;
      for (const c of m.caps) this.b[c] = 0;
      this.b[m.to] = v; this.ply++;
      const n = m.caps.length;
      const advanced = m.pl === 1 && ((m.to / 7) | 0) > ((m.from / 7) | 0);
      this.stall = n || advanced ? 0 : this.stall + 1;
      return { caps: m.caps.slice(), note: n ? (n > 1 ? `The fox takes ${n} geese.` : 'The fox takes a goose.') : '' };
    },
    result(pl) {
      if (this.geese() <= this.FOX_WINS_AT) return { winner: 0, text: `Only ${this.geese()} geese are left, too few to pen the fox.` };
      if (pl === 0 && !this.foxMoves().length) return { winner: 1, text: 'The geese have penned the fox in.' };
      if (pl === 1 && !this.geeseMoves().length) return { winner: 0, text: 'The geese have no move left.' };
      if (this.stall >= this.STALL) return { winner: 0, text: 'The geese stopped advancing, and the fox slipped away.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply, this.stall]; },
    restore(s) { this.b = s[0].slice(); this.ply = s[1]; this.stall = s[2]; },
    turns(pl) {
      // Captures first for the fox; forward steps first for the geese, so alpha-beta prunes more.
      const key = m => m.caps.length * 10 + (m.pl === 1 ? ((m.to / 7) | 0) - ((m.from / 7) | 0) : 0);
      return this.legal(pl).sort((a, b) => key(b) - key(a)).map(m => [m]);
    },
    terminal(pl, depth) {
      const r = this.result(pl);
      if (!r) return null;
      return r.winner === pl ? 1000 + depth : -1000 - depth;
    },
    // How many empty points the fox could walk to without jumping: the space the geese must close.
    room() {
      const f = this.fox(); if (f < 0) return 0;
      const seen = new Set([f]), q = [f];
      while (q.length) {
        const at = q.pop(), r0 = (at / 7) | 0, c0 = at % 7;
        for (const [dr, dc] of FG_DIRS) {
          if (!this.line(r0, c0, dr, dc)) continue;
          const r = r0 + dr, c = c0 + dc, j = r * 7 + c;
          if (FG_ON(r, c) && !this.b[j] && !seen.has(j)) { seen.add(j); q.push(j); }
        }
      }
      return seen.size - 1;
    },
    evaluate(pl) {
      const moves = this.foxMoves(), jumps = moves.filter(m => m.caps.length).length;
      let geeseAdvance = 0; for (const i of FG_POINTS) if (this.b[i] === 2) geeseAdvance += (i / 7) | 0;
      // Good for the fox: geese taken, room to roam, moves and jumps on offer.
      // Good for the geese: a flock that has advanced and boxed the fox in.
      const s = (this.GEESE - this.geese()) * 14 + this.room() * 0.9 + moves.length * 1.2 + jumps * 5 - geeseAdvance * 1.0;
      return pl === 0 ? s : -s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 6); },
  };

  /* --------------------------------------------------------------- Draughts
   * English draughts (checkers) on the 32 dark squares of an 8x8 board, index
   * r*8+c with (r + c) odd. Player 0, the visitor, starts on rows 0-2 and moves
   * up; player 1 starts on rows 5-7 and moves down. Values: 1 man, 2 king for
   * player 0; 3 man, 4 king for player 1. */
  const DR_DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const DRAUGHTS = {
    id: 'draughts', name: 'Draughts', dice: false, first: 0,
    rules: [
      'You play the dark pieces and move first. Pieces move one square diagonally forward, on the dark squares only.',
      'Capture by jumping an enemy piece diagonally into the empty square beyond. If you can capture, you must, and you keep jumping while you can.',
      'A piece that reaches the far row is crowned a king. Kings move and capture diagonally backwards as well as forwards.',
      'You win when the Scribe has no pieces left or no legal move. A long stretch with no capture or uncrowned move is a draw.'
    ],
    source: 'English draughts (checkers). Forced capture is first recorded in France around 1535.',
    init() {
      const b = Array(64).fill(0);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2) { if (r <= 2) b[r * 8 + c] = 1; else if (r >= 5) b[r * 8 + c] = 3; }
      this.b = b; this.quiet = 0; this.ply = 0;
    },
    owner: v => (v >= 3 ? 1 : 0),
    king: v => v === 2 || v === 4,
    count(pl) { let n = 0; for (const v of this.b) if (v && this.owner(v) === pl) n++; return n; },
    dirs(v) { if (this.king(v)) return DR_DIAG; return this.owner(v) === 0 ? DR_DIAG.slice(0, 2) : DR_DIAG.slice(2); },
    lastRow(pl) { return pl === 0 ? 7 : 0; },
    captures(pl) {
      const out = [];
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v || this.owner(v) !== pl) continue;
        const walk = (at, path, caps) => {
          const r = at >> 3, c = at & 7; let extended = false;
          for (const [dr, dc] of this.dirs(v)) {
            const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
            if (lr < 0 || lr > 7 || lc < 0 || lc > 7) continue;
            const mid = mr * 8 + mc, land = lr * 8 + lc, mv = this.b[mid];
            if (!mv || this.owner(mv) === pl || caps.includes(mid)) continue;
            if (this.b[land] && land !== i) continue;
            extended = true;
            const np = path.concat([land]), nc = caps.concat([mid]);
            // A man crowned by a capture stops there.
            if (!this.king(v) && lr === this.lastRow(pl)) out.push({ pl, from: i, to: land, path: np, caps: nc, crown: true });
            else walk(land, np, nc);
          }
          if (!extended && caps.length) out.push({ pl, from: i, to: at, path, caps, crown: false });
        };
        walk(i, [], []);
      }
      return out;
    },
    legal(pl) {
      const caps = this.captures(pl);
      if (caps.length) return caps;
      const out = [];
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v || this.owner(v) !== pl) continue;
        const r = i >> 3, c = i & 7;
        for (const [dr, dc] of this.dirs(v)) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr > 7 || nc < 0 || nc > 7 || this.b[nr * 8 + nc]) continue;
          out.push({ pl, from: i, to: nr * 8 + nc, path: [nr * 8 + nc], caps: [], crown: !this.king(v) && nr === this.lastRow(pl) });
        }
      }
      return out;
    },
    apply(m) {
      const v = this.b[m.from]; this.b[m.from] = 0;
      for (const c of m.caps) this.b[c] = 0;
      this.b[m.to] = m.crown ? (m.pl === 0 ? 2 : 4) : v;
      this.quiet = m.caps.length || !this.king(v) ? 0 : this.quiet + 1; this.ply++;
      const parts = [];
      if (m.caps.length) parts.push(m.pl === 0 ? `You take ${m.caps.length > 1 ? m.caps.length + ' pieces' : 'a piece'}.` : `The Scribe takes ${m.caps.length > 1 ? m.caps.length + ' of your pieces' : 'one of your pieces'}.`);
      if (m.crown) parts.push(m.pl === 0 ? 'Your piece is crowned.' : 'The Scribe crowns a piece.');
      return { caps: m.caps.slice(), note: parts.join(' ') };
    },
    result(pl) {
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? (this.count(0) ? 'You have no legal move.' : 'All your pieces are gone.') : (this.count(1) ? 'The Scribe has no legal move.' : 'You have taken every one of the Scribe\'s pieces.') };
      if (this.quiet >= 80) return { winner: -1, text: 'Forty moves each with no capture or uncrowned move. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.quiet, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.quiet = s[1]; this.ply = s[2]; },
    turns(pl) { return this.legal(pl).sort((a, b) => b.caps.length - a.caps.length).map(m => [m]); },
    terminal(pl, depth) {
      if (!this.legal(pl).length) return -1000 - depth;
      if (this.quiet >= 80) return 0;
      return null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v) continue;
        const o = this.owner(v), r = i >> 3, c = i & 7;
        let val = this.king(v) ? 1.6 : 1 + 0.04 * (o === 0 ? r : 7 - r);
        if (c >= 2 && c <= 5 && r >= 2 && r <= 5) val += 0.05;
        if (!this.king(v) && r === (o === 0 ? 0 : 7)) val += 0.06; // guarding the back row
        s += o === pl ? val : -val;
      }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 8); },
  };

  /* ------------------------------------------------------- Game of the Goose
   * A race along a spiral of 63 squares with two dice. Each player has one
   * piece; pos[pl][0] is its square (0 = not yet on the board). */
  const GOOSE_SQ = new Set([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);
  const GOOSE = {
    id: 'goose', name: 'The Game of the Goose', dice: true, pipDice: true, autoMove: true, first: 0, N: 1,
    sides: ['gold piece', 'silver piece'],
    rules: [
      'Throw two dice and move your piece that many squares along the spiral. The first to land exactly on 63 wins; overshoot and you bounce back.',
      'Land on a goose and you fly on again by the same throw.',
      'Throwing 9 from the start would ride the geese all the way home, so 6 and 3 takes you to 26 and 5 and 4 to 53 instead.',
      'The Bridge (6) carries you to 12. The Maze (42) sends you back to 39. Death (58) sends you back to the start.',
      'The Inn (19) costs one turn, the Well (31) two and the Prison (52) three.',
      'Land on the other player\'s square and you swap places with them.'
    ],
    source: 'The traditional squares. In the old game the Well and the Prison held a player until someone else landed there; with only two players we use a set number of turns instead.',
    init() { this.pos = [[0], [0]]; this.skip = [0, 0]; this.fresh = [true, true]; },
    roll() { const a = 1 + ((Math.random() * 6) | 0), b = 1 + ((Math.random() * 6) | 0); return { faces: [a, b], value: a + b }; },
    who: pl => (pl === 0 ? 'You' : 'The Scribe'),
    skipTurn(pl) {
      if (!this.skip[pl]) return '';
      this.skip[pl]--;
      const where = this.pos[pl][0] === 19 ? 'the Inn' : this.pos[pl][0] === 31 ? 'the Well' : 'the Prison';
      return pl === 0 ? `You are still in ${where} and miss this turn.` : `The Scribe is still in ${where} and misses a turn.`;
    },
    plan(pl, roll) {
      const from = this.pos[pl][0], v = roll.value, notes = [], path = [];
      const you = pl === 0 ? 'you' : 'the Scribe', miss = n => (pl === 0 ? `miss ${n}` : `the Scribe misses ${n}`);
      let at = from, dir = 1;
      const walk = n => {
        for (let k = 0; k < n; k++) {
          if (at === 63) dir = -1;
          at += dir; path.push(at);
        }
      };
      let skip = 0;
      // With a goose every nine squares, a 9 from the start would fly all the way home,
      // so the old rules send it to 26 or 53 instead, whenever the piece is at the start.
      if (from === 0 && roll.faces.includes(6) && roll.faces.includes(3)) { at = 26; path.push(26); notes.push('6 and 3 from the start: straight to 26.'); }
      else if (from === 0 && roll.faces.includes(5) && roll.faces.includes(4)) { at = 53; path.push(53); notes.push('5 and 4 from the start: straight to 53.'); }
      else {
        walk(v);
        for (let guard = 0; GOOSE_SQ.has(at) && guard < 10; guard++) { notes.push('A goose! On again by ' + v + '.'); walk(v); }
      }
      if (at === 6) { at = 12; path.push(12); notes.push(`The Bridge carries ${you} to 12.`); }
      else if (at === 42) { at = 39; path.push(39); notes.push('Lost in the Maze: back to 39.'); }
      else if (at === 58) { at = 0; path.push(0); notes.push('Death! Back to the start.'); }
      else if (at === 19) { skip = 1; notes.push(`A night at the Inn: ${miss('a turn')}.`); }
      else if (at === 31) { skip = 2; notes.push(`Down the Well: ${miss('two turns')}.`); }
      else if (at === 52) { skip = 3; notes.push(`Into the Prison: ${miss('three turns')}.`); }
      else if (at === 63) notes.push(pl === 0 ? 'Home to the garden at 63!' : 'The Scribe reaches 63.');
      const opp = 1 - pl, swap = at > 0 && at < 63 && this.pos[opp][0] === at;
      if (swap) notes.push(pl === 0 ? 'You land on the Scribe and swap places.' : 'The Scribe lands on you and you swap places.');
      return { pl, i: 0, from, to: at, path, skip, swap, notes };
    },
    legal(pl, value, roll) { return [this.plan(pl, roll || { faces: [value, 0], value })]; },
    steps(m) { return m.path; },
    apply(m) {
      const opp = 1 - m.pl;
      this.pos[m.pl][0] = m.to; this.fresh[m.pl] = false; this.skip[m.pl] = m.skip;
      const moved = [];
      if (m.swap) { this.pos[opp][0] = m.from; moved.push({ pl: opp, i: 0 }); }
      return { moved, note: m.notes.join(' ') };
    },
    extra() { return false; },
    extraNote: '',
    done(pl) { return this.pos[pl][0] === 63; },
    home(pl) { return this.pos[pl][0] === 63 ? 1 : 0; },
    ai(moves) { return moves[0]; },
    aiPlan(pl, moves) { return [moves[0]]; },
  };

  /* ----------------------------------------------------------------- Reversi
   * 8x8, index r*8+c with row 0 nearest the visitor. 0 empty, 1 the visitor's
   * dark discs, 2 the Scribe's light discs. Dark moves first. */
  const RV_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const RV_W = [
    100, -20, 10, 5, 5, 10, -20, 100,
    -20, -50, -2, -2, -2, -2, -50, -20,
    10, -2, 1, 1, 1, 1, -2, 10,
    5, -2, 1, 0, 0, 1, -2, 5,
    5, -2, 1, 0, 0, 1, -2, 5,
    10, -2, 1, 1, 1, 1, -2, 10,
    -20, -50, -2, -2, -2, -2, -50, -20,
    100, -20, 10, 5, 5, 10, -20, 100,
  ];
  const REVERSI = {
    id: 'reversi', name: 'Reversi', dice: false, first: 0,
    rules: [
      'You play the dark discs and move first.',
      'Place a disc so that it traps a straight line of the Scribe\'s discs, across, up or down, or diagonally, between your new disc and one of yours. Every trapped disc flips to your colour.',
      'A move must flip at least one disc. If you cannot move, you pass.',
      'The game ends when neither player can move. Whoever has more discs showing wins.'
    ],
    source: 'The standard rules, starting from the four centre discs as Othello (1971) made standard. Early reversi began with an empty board.',
    init() {
      const b = Array(64).fill(0);
      b[3 * 8 + 3] = 2; b[4 * 8 + 4] = 2; b[3 * 8 + 4] = 1; b[4 * 8 + 3] = 1;
      this.b = b;
    },
    count(pl) { const v = pl + 1; let n = 0; for (const x of this.b) if (x === v) n++; return n; },
    flips(pl, i) {
      if (this.b[i]) return [];
      const me = pl + 1, them = 2 - pl, r0 = i >> 3, c0 = i & 7, out = [];
      for (const [dr, dc] of RV_DIRS) {
        const line = []; let r = r0 + dr, c = c0 + dc;
        while (r >= 0 && r < 8 && c >= 0 && c < 8 && this.b[r * 8 + c] === them) { line.push(r * 8 + c); r += dr; c += dc; }
        if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && this.b[r * 8 + c] === me) out.push(...line);
      }
      return out;
    },
    legal(pl) {
      const out = [];
      for (let i = 0; i < 64; i++) { const f = this.flips(pl, i); if (f.length) out.push({ pl, at: i, flips: f }); }
      return out;
    },
    apply(m) {
      if (m.pass) return { note: '' };
      this.b[m.at] = m.pl + 1;
      for (const f of m.flips) this.b[f] = m.pl + 1;
      const n = m.flips.length;
      return { note: m.pl === 0 ? `You flip ${n} disc${n === 1 ? '' : 's'}.` : (n === 1 ? 'The Scribe flips one of your discs.' : `The Scribe flips ${n} of your discs.`) };
    },
    skipTurn(pl) {
      if (this.legal(pl).length || !this.legal(1 - pl).length) return '';
      return pl === 0 ? 'You have no move that flips a disc, so you pass.' : 'The Scribe has no move that flips a disc, and passes.';
    },
    result() {
      if (this.legal(0).length || this.legal(1).length) return null;
      const a = this.count(0), b = this.count(1);
      return { winner: a > b ? 0 : b > a ? 1 : -1, text: a === b ? `${a} discs each. The game is drawn.` : `Final count: you ${a}, the Scribe ${b}.` };
    },
    snapshot() { return this.b.slice(); },
    restore(s) { this.b = s.slice(); },
    turns(pl) {
      const ms = this.legal(pl);
      if (!ms.length) return [[{ pl, pass: true }]];
      return ms.sort((x, y) => RV_W[y.at] - RV_W[x.at]).map(m => [m]);
    },
    terminal(pl, depth) {
      if (this.legal(0).length || this.legal(1).length) return null;
      const d = this.count(pl) - this.count(1 - pl);
      return d > 0 ? 1000 + d : d < 0 ? -1000 + d : 0;
    },
    evaluate(pl) {
      const me = pl + 1, them = 2 - pl;
      let empty = 0, pos = 0, discs = 0;
      for (let i = 0; i < 64; i++) {
        const v = this.b[i];
        if (!v) { empty++; continue; }
        // Squares next to a corner stop being dangerous once the corner is taken.
        let w = RV_W[i];
        if (w < 0) { const r = i >> 3, c = i & 7, cr = r < 4 ? 0 : 7, cc = c < 4 ? 0 : 7; if (this.b[cr * 8 + cc]) w = 4; }
        pos += v === me ? w : -w; discs += v === me ? 1 : -1;
      }
      if (empty <= 10) return discs * 10 + pos * 0.2;
      return pos + (this.legal(pl).length - this.legal(1 - pl).length) * 4;
    },
    aiPlan(pl, depth) {
      // Gentle is a beginner opponent: choose any legal move instead of searching.
      // Explicit depths still use the search, so tactical tests keep working.
      if (LEVEL.name === 'gentle' && !depth) {
        const moves = this.legal(pl);
        if (moves.length) return [moves[(Math.random() * moves.length) | 0]];
      }
      return bestPlan(this, pl, depth, 6);
    },
  };

  /* --------------------------------------------------------------- Alquerque
   * Points of a 5 x 5 grid, index r*5+c, row 0 nearest the visitor. Lines run
   * across and up and down everywhere, and diagonally through the points where
   * r + c is even. b: 0 empty, 1 visitor, 2 Scribe. */
  const AQ_ADJ = Array.from({ length: 25 }, (_, i) => {
    const r = (i / 5) | 0, c = i % 5, out = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    if ((r + c) % 2 === 0) dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    for (const [dr, dc] of dirs) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 5 && cc >= 0 && cc < 5) out.push([dr, dc]); }
    return out;
  });
  const ALQUERQUE = {
    id: 'alquerque', name: 'Alquerque', dice: false, first: 0, ADJ: AQ_ADJ,
    rules: [
      'You play the dark pieces and move first. A piece moves along a line to the next point, if it is empty.',
      'Pieces never move backwards. A piece that reaches the far row may only move again to capture.',
      'Capture by jumping along a line over an enemy piece to the empty point beyond, in any direction. Keep jumping while you can. If you can capture, you must.',
      'You win when the Scribe has no pieces left, or none that can move.'
    ],
    source: 'The rules in Alfonso X\'s Libro de los juegos (1283) are incomplete; these follow R. C. Bell\'s widely used reconstruction, with compulsory capture instead of huffing.',
    init() {
      const b = Array(25).fill(0);
      for (let i = 0; i < 10; i++) { b[i] = 1; b[24 - i] = 2; }
      b[13] = 1; b[14] = 1; b[10] = 2; b[11] = 2;
      this.b = b; this.quiet = 0; this.ply = 0;
    },
    count(pl) { let n = 0; for (const v of this.b) if (v === pl + 1) n++; return n; },
    fwd: pl => (pl === 0 ? 1 : -1),
    captures(pl) {
      const out = [], me = pl + 1, them = 2 - pl;
      for (let i = 0; i < 25; i++) {
        if (this.b[i] !== me) continue;
        const walk = (at, path, caps) => {
          let extended = false; const r = (at / 5) | 0, c = at % 5;
          for (const [dr, dc] of AQ_ADJ[at]) {
            const lr = r + 2 * dr, lc = c + 2 * dc;
            if (lr < 0 || lr > 4 || lc < 0 || lc > 4) continue;
            const mid = (r + dr) * 5 + c + dc, land = lr * 5 + lc;
            if (this.b[mid] !== them || caps.includes(mid) || (this.b[land] && land !== i)) continue;
            extended = true;
            walk(land, path.concat([land]), caps.concat([mid]));
          }
          if (!extended && caps.length) out.push({ pl, from: i, to: at, path, caps });
        };
        walk(i, [], []);
      }
      return out;
    },
    legal(pl) {
      const caps = this.captures(pl);
      if (caps.length) return caps;
      const out = [], me = pl + 1, f = this.fwd(pl), back = pl === 0 ? 4 : 0;
      for (let i = 0; i < 25; i++) {
        if (this.b[i] !== me) continue;
        const r = (i / 5) | 0, c = i % 5;
        if (r === back) continue; // on the far row: captures only
        for (const [dr, dc] of AQ_ADJ[i]) {
          if (dr === -f) continue;
          const j = (r + dr) * 5 + c + dc;
          if (!this.b[j]) out.push({ pl, from: i, to: j, path: [j], caps: [] });
        }
      }
      return out;
    },
    apply(m) {
      const v = this.b[m.from]; this.b[m.from] = 0;
      for (const c of m.caps) this.b[c] = 0;
      this.b[m.to] = v; this.ply++;
      this.quiet = m.caps.length ? 0 : this.quiet + 1;
      const n = m.caps.length;
      return { caps: m.caps.slice(), note: !n ? '' : m.pl === 0 ? `You take ${n > 1 ? n + ' pieces' : 'a piece'}.` : `The Scribe takes ${n > 1 ? n + ' of your pieces' : 'one of your pieces'}.` };
    },
    result(pl) {
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? (this.count(0) ? 'None of your pieces can move.' : 'All your pieces are gone.') : (this.count(1) ? 'None of the Scribe\'s pieces can move.' : 'You have taken every one of the Scribe\'s pieces.') };
      if (this.quiet >= 60) return { winner: -1, text: 'Thirty moves each with no capture. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.quiet, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.quiet = s[1]; this.ply = s[2]; },
    turns(pl) { return this.legal(pl).sort((a, b) => b.caps.length - a.caps.length).map(m => [m]); },
    terminal(pl, depth) {
      if (!this.legal(pl).length) return -1000 - depth;
      if (this.quiet >= 60) return 0;
      return null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 25; i++) {
        const v = this.b[i]; if (!v) continue;
        const o = v - 1, r = (i / 5) | 0;
        // Pieces are worth most while they can still move; a piece pinned on the far row is nearly spent.
        let val = 1 + 0.03 * (o === 0 ? r : 4 - r);
        if (r === (o === 0 ? 4 : 0)) val -= 0.25;
        if (r === (o === 0 ? 0 : 4)) val += 0.05; // a back row guard
        s += o === pl ? val : -val;
      }
      return s * 10 + (this.legal(pl).length - this.legal(1 - pl).length) * 0.3;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 8); },
  };

  /* ------------------------------------------------------- Snakes and Ladders
   * The Indian game of knowledge (gyan chaupar, or moksha patam): a 100-square
   * track where virtues are ladders and vices are snakes. */
  const SL_LADDERS = { 12: [31, 'Faith'], 51: [68, 'Reliability'], 57: [83, 'Generosity'], 76: [91, 'Knowledge'], 78: [97, 'Asceticism'] };
  const SL_SNAKES = { 41: [20, 'Disobedience'], 52: [30, 'Theft'], 69: [47, 'Debt'], 73: [7, 'Murder'], 88: [46, 'Anger'], 99: [61, 'Lust'] };
  const SNAKES = {
    id: 'snakes', name: 'Snakes and Ladders', dice: true, pipDice: true, oneDie: true, autoMove: true, first: 0, N: 1,
    LADDERS: SL_LADDERS, SNAKES: SL_SNAKES,
    rules: [
      'Throw the die and move your piece that many squares, along each row and up to the next.',
      'Land at the foot of a ladder, a virtue, and you climb it. Land on a snake\'s head, a vice, and you slide down to its tail.',
      'There are more snakes than ladders: the old boards taught that the way down is easier than the way up.',
      'The first to land exactly on 100, liberation, wins. A throw that would go past 100 is lost.'
    ],
    source: 'The squares of Faith (12), Disobedience (41), Reliability (51), Theft (52), Generosity (57), Debt (69), Murder (73), Knowledge (76), Asceticism (78) and Lust (99) follow an old Indian board. The snake of Anger at 88, and where each ladder and snake ends, are our own.',
    init() { this.pos = [[0], [0]]; },
    roll() { const a = 1 + ((Math.random() * 6) | 0); return { faces: [a], value: a }; },
    plan(pl, roll) {
      const from = this.pos[pl][0], v = roll.value, notes = [], path = [];
      const you = pl === 0 ? 'You' : 'The Scribe';
      if (from + v > 100) {
        notes.push(pl === 0 ? `You need exactly ${100 - from} to reach 100.` : `The Scribe needs exactly ${100 - from}.`);
        return { pl, i: 0, from, to: from, path, notes };
      }
      for (let k = from + 1; k <= from + v; k++) path.push(k);
      let at = from + v;
      if (SL_LADDERS[at]) { const [top, name] = SL_LADDERS[at]; notes.push(`${you} climb${pl ? 's' : ''} the ladder of ${name} to ${top}.`); at = top; path.push(at); }
      else if (SL_SNAKES[at]) { const [tail, name] = SL_SNAKES[at]; notes.push(`The snake of ${name}! ${you} slide${pl ? 's' : ''} down to ${tail}.`); at = tail; path.push(at); }
      if (at === 100) notes.push(pl === 0 ? 'You reach 100: liberation.' : 'The Scribe reaches 100.');
      return { pl, i: 0, from, to: at, path, notes };
    },
    legal(pl, value, roll) { return [this.plan(pl, roll || { faces: [value], value })]; },
    steps(m) { return m.path; },
    apply(m) { this.pos[m.pl][0] = m.to; return { moved: [], note: m.notes.join(' ') }; },
    extra() { return false; },
    extraNote: '',
    done(pl) { return this.pos[pl][0] === 100; },
    home(pl) { return this.pos[pl][0] === 100 ? 1 : 0; },
    ai(moves) { return moves[0]; },
    aiPlan(pl, moves) { return [moves[0]]; },
  };

  /* ------------------------------------------------------------------ Xiangqi
   * 9 files x 10 ranks of points, index r*9+c, rank 0 nearest the visitor.
   * A piece is its type, plus 8 for the Scribe's black pieces. The visitor plays red. */
  const XQ = { K: 1, A: 2, E: 3, H: 4, R: 5, C: 6, P: 7 };
  const XQ_VAL = [0, 0, 2, 2, 4, 9, 4.5, 1];
  const XQ_ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const XQ_DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const XQ_HORSE = [[2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0], [1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1]];
  const xqOwner = v => (v >= 8 ? 1 : 0), xqType = v => v & 7;
  const xqPalace = (pl, r, c) => c >= 3 && c <= 5 && (pl === 0 ? r <= 2 : r >= 7);
  const xqOwnSide = (pl, r) => (pl === 0 ? r <= 4 : r >= 5);
  const XIANGQI = {
    id: 'xiangqi', name: 'Xiangqi', dice: false, first: 0, T: XQ,
    rules: [
      'You play red and move first. Checkmate the Scribe\'s general to win. A player with no legal move also loses.',
      'The general and his two advisors stay inside the palace, the square marked with a cross. The general steps one point along a line, an advisor one point diagonally. The two generals may never face each other on an open file.',
      'Elephants move exactly two points diagonally, never across the river, and are stopped by a piece in between. Horses move one point straight and one diagonally outward, and are stopped by a piece next to them in the straight direction.',
      'Chariots move any distance in a straight line. Cannons move the same way, but capture only by jumping exactly one piece, of either colour, on the way.',
      'Soldiers step one point forward; once across the river they may also step sideways. They never retreat.',
      'House rule: sixty moves each with no capture is a draw.'
    ],
    source: 'The modern rules, which have been settled since the Song dynasty. The rules against perpetual check are replaced here by the sixty-move rule.',
    init() {
      const b = Array(90).fill(0), back = [XQ.R, XQ.H, XQ.E, XQ.A, XQ.K, XQ.A, XQ.E, XQ.H, XQ.R];
      back.forEach((t, c) => { b[c] = t; b[81 + c] = t + 8; });
      for (const c of [1, 7]) { b[2 * 9 + c] = XQ.C; b[7 * 9 + c] = XQ.C + 8; }
      for (const c of [0, 2, 4, 6, 8]) { b[3 * 9 + c] = XQ.P; b[6 * 9 + c] = XQ.P + 8; }
      this.b = b; this.quiet = 0; this.ply = 0;
    },
    count(pl) { let n = 0; for (const v of this.b) if (v && xqOwner(v) === pl) n++; return n; },
    general(pl) { const g = XQ.K + (pl ? 8 : 0); return this.b.indexOf(g); },
    // Is pl's general attacked, or facing the other general?
    inCheck(pl) {
      const b = this.b, k = this.general(pl); if (k < 0) return true;
      const r = (k / 9) | 0, c = k % 9, foe = pl ? 0 : 8;
      for (const [dr, dc] of XQ_ORTH) {
        let rr = r + dr, cc = c + dc, screens = 0;
        while (rr >= 0 && rr < 10 && cc >= 0 && cc < 9) {
          const v = b[rr * 9 + cc];
          if (v) {
            if (screens === 0) {
              if (v === XQ.R + foe || (v === XQ.K + foe && dc === 0)) return true;
              if (v === XQ.P + foe && rr === r + (pl ? -1 : 1) && cc === c) return true;
              if (v === XQ.P + foe && rr === r && Math.abs(cc - c) === 1) return true;
              screens = 1;
            } else { if (v === XQ.C + foe) return true; break; }
          }
          rr += dr; cc += dc;
        }
      }
      for (const [dr, dc, lr, lc] of XQ_HORSE) {
        // A horse at k - (dr, dc) reaches k unless its leg, one step from the horse, is blocked.
        const hr = r - dr, hc = c - dc;
        if (hr < 0 || hr > 9 || hc < 0 || hc > 8 || b[hr * 9 + hc] !== XQ.H + foe) continue;
        if (!b[(hr + lr) * 9 + hc + lc]) return true;
      }
      return false;
    },
    pseudo(pl) {
      const b = this.b, out = [];
      const add = (from, r, c) => {
        if (r < 0 || r > 9 || c < 0 || c > 8) return false;
        const to = r * 9 + c, v = b[to];
        if (v && xqOwner(v) === pl) return false;
        out.push({ pl, from, to, cap: v }); return !v;
      };
      for (let i = 0; i < 90; i++) {
        const v = b[i]; if (!v || xqOwner(v) !== pl) continue;
        const t = xqType(v), r = (i / 9) | 0, c = i % 9;
        if (t === XQ.K) { for (const [dr, dc] of XQ_ORTH) if (xqPalace(pl, r + dr, c + dc)) add(i, r + dr, c + dc); }
        else if (t === XQ.A) { for (const [dr, dc] of XQ_DIAG) if (xqPalace(pl, r + dr, c + dc)) add(i, r + dr, c + dc); }
        else if (t === XQ.E) {
          for (const [dr, dc] of XQ_DIAG) {
            const rr = r + 2 * dr, cc = c + 2 * dc;
            if (rr < 0 || rr > 9 || cc < 0 || cc > 8 || !xqOwnSide(pl, rr) || b[(r + dr) * 9 + c + dc]) continue;
            add(i, rr, cc);
          }
        } else if (t === XQ.H) {
          for (const [dr, dc, lr, lc] of XQ_HORSE) {
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || rr > 9 || cc < 0 || cc > 8 || b[(r + lr) * 9 + c + lc]) continue;
            add(i, rr, cc);
          }
        } else if (t === XQ.R) {
          for (const [dr, dc] of XQ_ORTH) { let rr = r + dr, cc = c + dc; while (add(i, rr, cc)) { rr += dr; cc += dc; } }
        } else if (t === XQ.C) {
          for (const [dr, dc] of XQ_ORTH) {
            let rr = r + dr, cc = c + dc;
            while (rr >= 0 && rr < 10 && cc >= 0 && cc < 9 && !b[rr * 9 + cc]) { out.push({ pl, from: i, to: rr * 9 + cc, cap: 0 }); rr += dr; cc += dc; }
            rr += dr; cc += dc; // jump the screen
            while (rr >= 0 && rr < 10 && cc >= 0 && cc < 9) {
              const w = b[rr * 9 + cc];
              if (w) { if (xqOwner(w) !== pl) out.push({ pl, from: i, to: rr * 9 + cc, cap: w }); break; }
              rr += dr; cc += dc;
            }
          }
        } else if (t === XQ.P) {
          const f = pl ? -1 : 1;
          add(i, r + f, c);
          if (!xqOwnSide(pl, r)) { add(i, r, c - 1); add(i, r, c + 1); }
        }
      }
      return out;
    },
    legal(pl) {
      const out = [];
      for (const m of this.pseudo(pl)) {
        const v = this.b[m.from]; this.b[m.to] = v; this.b[m.from] = 0;
        if (!this.inCheck(pl)) out.push(m);
        this.b[m.from] = v; this.b[m.to] = m.cap;
      }
      return out;
    },
    apply(m) {
      const v = this.b[m.from]; this.b[m.from] = 0; this.b[m.to] = v;
      this.ply++; this.quiet = m.cap ? 0 : this.quiet + 1;
      const names = ['', 'general', 'advisor', 'elephant', 'horse', 'chariot', 'cannon', 'soldier'];
      const parts = [];
      if (m.cap) parts.push(m.pl === 0 ? `You take the Scribe's ${names[xqType(m.cap)]}.` : `The Scribe takes your ${names[xqType(m.cap)]}.`);
      if (this.inCheck(1 - m.pl)) parts.push(m.pl === 0 ? 'Check.' : 'Check! Your general is attacked.');
      return { caps: m.cap ? [m.to] : [], note: parts.join(' ') };
    },
    result(pl) {
      if (!this.legal(pl).length) {
        const mate = this.inCheck(pl);
        return { winner: 1 - pl, text: pl === 0 ? (mate ? 'Checkmate. Your general is taken.' : 'You have no legal move, and in xiangqi that loses.') : (mate ? 'Checkmate! The Scribe\'s general cannot escape.' : 'The Scribe has no legal move, and in xiangqi that loses.') };
      }
      if (this.quiet >= 120) return { winner: -1, text: 'Sixty moves each with no capture. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.quiet, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.quiet = s[1]; this.ply = s[2]; },
    turns(pl) { return this.legal(pl).sort((a, b) => (b.cap ? XQ_VAL[xqType(b.cap)] * 10 - XQ_VAL[xqType(this.b[b.from])] : 0) - (a.cap ? XQ_VAL[xqType(a.cap)] * 10 - XQ_VAL[xqType(this.b[a.from])] : 0)).map(m => [m]); },
    terminal(pl, depth) {
      // A side with no move is found by the search itself (no turns: the worst score).
      return this.quiet >= 120 ? 0 : null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 90; i++) {
        const v = this.b[i]; if (!v) continue;
        const o = xqOwner(v), t = xqType(v), r = (i / 9) | 0, c = i % 9;
        let val = XQ_VAL[t];
        if (t === XQ.P && !xqOwnSide(o, r)) val = c >= 2 && c <= 6 ? 2.2 : 1.8;
        if (t === XQ.H || t === XQ.C) val += 0.1 * (4 - Math.abs(c - 4)) / 4;
        if (t === XQ.R && !xqOwnSide(o, r)) val += 0.3;
        s += o === pl ? val : -val;
      }
      if (this.inCheck(1 - pl)) s += 0.3;
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

  /* --------------------------------------------------------------- Mū tōrere
   * Eight kewai (the arms of a star, 0-7 round the circle) and the pūtahi in
   * the centre (8). Four men each; with nine points and eight men there is
   * always exactly one empty point, and every move goes into it. */
  const MT_CENTRE = 8;
  const MUTORERE = {
    id: 'mutorere', name: 'Mū tōrere', dice: false, first: 0, CENTRE: MT_CENTRE,
    rules: [
      'You play the light stones and move first. There is always exactly one empty point, and every move fills it.',
      'A man on an arm may move to a neighbouring arm, or into the centre. A man in the centre may move out to the empty arm.',
      'A man may move into the centre only if it stands next to one of the Scribe\'s men.',
      'Block the Scribe so it has no move, and you win.',
      'House rule: after thirty moves each the game is drawn. With perfect play mū tōrere is a draw.'
    ],
    source: 'Accounts of the rules differ. The rule for entering the centre used here is the one most often given today; without it the first player can win at once.',
    init() { this.b = [2, 2, 2, 2, 1, 1, 1, 1, 0]; this.ply = 0; },
    empty() { return this.b.indexOf(0); },
    legal(pl) {
      const me = pl + 1, e = this.empty(), out = [];
      if (e === MT_CENTRE) {
        for (let i = 0; i < 8; i++) if (this.b[i] === me && (this.b[(i + 7) % 8] === 3 - me || this.b[(i + 1) % 8] === 3 - me)) out.push({ pl, from: i, to: e });
      } else {
        for (const i of [(e + 7) % 8, (e + 1) % 8, MT_CENTRE]) if (this.b[i] === me) out.push({ pl, from: i, to: e });
      }
      return out;
    },
    apply(m) { this.b[m.to] = this.b[m.from]; this.b[m.from] = 0; this.ply++; return { note: '' }; },
    result(pl) {
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'Your men are blocked: you have no move.' : 'The Scribe is blocked and cannot move.' };
      if (this.ply >= 60) return { winner: -1, text: 'Thirty moves each and no one blocked. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply]; },
    restore(s) { this.b = s[0].slice(); this.ply = s[1]; },
    turns(pl) { return this.legal(pl).map(m => [m]); },
    terminal(pl, depth) { if (!this.legal(pl).length) return -1000 - depth; if (this.ply >= 60) return 0; return null; },
    evaluate(pl) {
      // Room to move, and a man in the centre is worth having.
      const opp = 1 - pl; let s = 0;
      s += this.b[MT_CENTRE] === pl + 1 ? 1.5 : this.b[MT_CENTRE] === opp + 1 ? -1.5 : 0;
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 16); },
  };

  /* ------------------------------------------------------------------ Kōnane
   * An 8 x 8 board filled with black and white stones, index r*8+c, row 0
   * nearest the visitor; black (the visitor) where r + c is even. */
  const KN_N = 8;
  const KONANE = {
    id: 'konane', name: 'Kōnane', dice: false, first: 0, N: KN_N,
    rules: [
      'The board starts full. You play black (lava) and begin by lifting one of your stones from the centre or a corner; the Scribe then lifts one of its white (coral) stones next to the gap.',
      'After that every move is a capture: jump one of your stones over a neighbouring white stone, along a row or column, into the empty point beyond. The jumped stone is removed. No diagonal moves.',
      'You may keep jumping in the same direction while there is a stone to jump and an empty point beyond, and stop whenever you like.',
      'The first player who cannot capture loses. There are no draws.'
    ],
    source: 'The common modern rules on an 8 × 8 board; old Hawaiian boards came in many sizes.',
    init() {
      this.b = Array.from({ length: KN_N * KN_N }, (_, i) => ((((i / KN_N) | 0) + (i % KN_N)) % 2 === 0 ? 1 : 2));
      this.ply = 0; this.gap = -1;
    },
    count(pl) { let n = 0; for (const v of this.b) if (v === pl + 1) n++; return n; },
    legal(pl) {
      const me = pl + 1, N = KN_N, out = [];
      if (this.ply === 0) { // black lifts a centre or corner stone
        for (const i of [0, N * N - 1, (N / 2 - 1) * N + N / 2 - 1, (N / 2) * N + N / 2]) if (this.b[i] === me) out.push({ pl, remove: i });
        return out;
      }
      if (this.ply === 1) { // white lifts a stone next to the gap
        const r = (this.gap / N) | 0, c = this.gap % N;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N && this.b[rr * N + cc] === me) out.push({ pl, remove: rr * N + cc }); }
        return out;
      }
      for (let i = 0; i < N * N; i++) {
        if (this.b[i] !== me) continue;
        const r = (i / N) | 0, c = i % N;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let rr = r, cc = c; const caps = [], path = [];
          for (;;) {
            const mr = rr + dr, mc = cc + dc, lr = rr + 2 * dr, lc = cc + 2 * dc;
            if (lr < 0 || lr >= N || lc < 0 || lc >= N) break;
            if (this.b[mr * N + mc] !== 3 - me || this.b[lr * N + lc]) break;
            caps.push(mr * N + mc); path.push(lr * N + lc); rr = lr; cc = lc;
            out.push({ pl, from: i, to: lr * N + lc, caps: caps.slice(), path: path.slice() });
          }
        }
      }
      return out;
    },
    apply(m) {
      this.ply++;
      if (m.remove !== undefined) { this.b[m.remove] = 0; if (this.ply === 1) this.gap = m.remove; return { caps: [m.remove], note: '' }; }
      const v = this.b[m.from]; this.b[m.from] = 0; m.caps.forEach(c => { this.b[c] = 0; }); this.b[m.to] = v;
      const n = m.caps.length;
      return { caps: m.caps.slice(), note: n > 1 ? (m.pl === 0 ? `You take ${n} stones in one run.` : `The Scribe takes ${n} of your stones in one run.`) : '' };
    },
    result(pl) {
      if (this.ply >= 2 && !this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no capture left to make.' : 'The Scribe has no capture left to make.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply, this.gap]; },
    restore(s) { this.b = s[0].slice(); this.ply = s[1]; this.gap = s[2]; },
    turns(pl) { return this.legal(pl).map(m => [m]); },
    terminal(pl, depth) { if (this.ply >= 2 && !this.legal(pl).length) return -1000 - depth; return null; },
    evaluate(pl) { return this.legal(pl).length - this.legal(1 - pl).length * 1.5; },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 10); },
  };

  /* ---------------------------------------------------------------- Fanorona
   * 5 rows x 9 columns of points, index r*9+c, row 0 nearest the visitor.
   * Every point joins its neighbours across and up and down; the "strong"
   * points, where r + c is even, also join diagonally. A turn is played one
   * step at a time: after a capture the same stone may capture again. */
  const FN_R = 5, FN_C = 9;
  const FN_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const fnDirs = i => { const r = (i / FN_C) | 0, c = i % FN_C; return (r + c) % 2 === 0 ? FN_DIRS : FN_DIRS.slice(0, 4); };
  const fnAt = (r, c) => (r >= 0 && r < FN_R && c >= 0 && c < FN_C ? r * FN_C + c : -1);
  const FANORONA = {
    id: 'fanorona', name: 'Fanorona', dice: false, first: 0, R: FN_R, C: FN_C, stopLabel: 'Stop',
    followPrompt: 'You may capture again with the same stone, or choose Stop.',
    rules: [
      'You play white and move first. A stone moves one step along a line to an empty point.',
      'Capture by approach: step up to an enemy stone in the direction you are moving. Or by withdrawal: step directly away from an enemy stone next to you. Either way, the whole unbroken line of enemy stones beyond is taken.',
      'Pick a stone, then pick the enemy stone you want to capture: the rings show your choices. When one step could approach or withdraw, you choose which line to take.',
      'Capturing is compulsory. After a capture, the same stone may capture again, but never back onto a point it visited this turn, and never twice in the same direction. Or choose Stop.',
      'Take every enemy stone to win. House rule: twenty moves each with no capture is a draw.'
    ],
    source: 'Fanoron-tsivy, the full 5 × 9 game, with the rules as they are usually given today.',
    init() {
      const b = Array(FN_R * FN_C).fill(0);
      for (let i = 0; i < 18; i++) { b[i] = 1; b[44 - i] = 2; }
      [2, 1, 2, 1, 0, 2, 1, 2, 1].forEach((v, c) => { b[2 * FN_C + c] = v; });
      this.b = b; this.chain = null; this.quiet = 0; this.ply = 0;
    },
    count(pl) { let n = 0; for (const v of this.b) if (v === pl + 1) n++; return n; },
    // The line of enemy stones starting at (r, c) and running in (dr, dc).
    line(r, c, dr, dc, them) { const out = []; for (let i = fnAt(r, c); i >= 0 && this.b[i] === them; r += dr, c += dc, i = fnAt(r, c)) out.push(i); return out; },
    stepsFrom(i, captureOnly, visited, lastDir) {
      const me = this.b[i], them = 3 - me, r = (i / FN_C) | 0, c = i % FN_C, out = [];
      for (const [dr, dc] of fnDirs(i)) {
        const to = fnAt(r + dr, c + dc);
        if (to < 0 || this.b[to]) continue;
        if (visited && visited.includes(to)) continue;
        if (lastDir && lastDir[0] === dr && lastDir[1] === dc) continue;
        const pl = me - 1;
        const appr = this.line(r + 2 * dr, c + 2 * dc, dr, dc, them), wd = this.line(r - dr, c - dc, -dr, -dc, them);
        if (appr.length) out.push({ pl, from: i, to, dir: [dr, dc], caps: appr, kind: 'approach' });
        if (wd.length) out.push({ pl, from: i, to, dir: [dr, dc], caps: wd, kind: 'withdrawal' });
        if (!captureOnly && !appr.length && !wd.length) out.push({ pl, from: i, to, dir: [dr, dc], caps: [], kind: 'paika' });
      }
      return out;
    },
    legal(pl) {
      if (this.chain) {
        const more = this.stepsFrom(this.chain.at, true, this.chain.visited, this.chain.dir);
        return more.concat([{ pl, pass: true }]);
      }
      const me = pl + 1; let caps = [], quiet = [];
      for (let i = 0; i < FN_R * FN_C; i++) if (this.b[i] === me) for (const m of this.stepsFrom(i, false)) (m.caps.length ? caps : quiet).push(m);
      return caps.length ? caps : quiet;
    },
    apply(m) {
      if (m.pass) { this.chain = null; this.ply++; return { caps: [], note: '' }; }
      const v = this.b[m.from]; this.b[m.from] = 0; this.b[m.to] = v;
      m.caps.forEach(c => { this.b[c] = 0; });
      const n = m.caps.length, res = { caps: m.caps.slice(), note: '' };
      if (n) {
        res.note = m.pl === 0 ? `You take ${n} by ${m.kind}.` : `The Scribe takes ${n} by ${m.kind}.`;
        const visited = this.chain ? this.chain.visited.concat([m.to]) : [m.from, m.to];
        this.chain = { at: m.to, visited, dir: m.dir };
        if (this.count(1 - m.pl) && this.stepsFrom(m.to, true, visited, m.dir).length) { res.followUp = this.legal(m.pl); }
        else this.chain = null;
        this.quiet = 0;
      } else { this.chain = null; this.quiet++; }
      if (!this.chain) this.ply++;
      return res;
    },
    result(pl) {
      if (!this.count(pl)) return { winner: 1 - pl, text: pl === 0 ? 'The Scribe has taken all your stones.' : 'You have taken every one of the Scribe\'s stones.' };
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no move.' : 'The Scribe has no move.' };
      if (this.quiet >= 40) return { winner: -1, text: 'Twenty moves each with no capture. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.chain && JSON.stringify(this.chain), this.quiet, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.chain = s[1] ? JSON.parse(s[1]) : null; this.quiet = s[2]; this.ply = s[3]; },
    // Whole turns for the search: every capture sequence, stopping wherever the rules allow.
    turns(pl) {
      const out = [], snap = this.snapshot();
      const walk = (seq) => {
        const ms = this.legal(pl);
        for (const m of ms) {
          if (m.pass) { out.push(seq.concat([m])); continue; }
          const s = this.snapshot();
          const res = this.apply(m);
          if (res.followUp && out.length < 400) walk(seq.concat([m])); else out.push(seq.concat([m]));
          this.restore(s);
        }
      };
      walk([]);
      this.restore(snap);
      return out.sort((a, b) => b.reduce((n, m) => n + (m.caps ? m.caps.length : 0), 0) - a.reduce((n, m) => n + (m.caps ? m.caps.length : 0), 0));
    },
    terminal(pl, depth) {
      if (!this.count(pl)) return -1000 - depth;
      if (!this.count(1 - pl)) return 1000 + depth;
      if (this.quiet >= 40) return 0;
      return null;
    },
    evaluate(pl) { return (this.count(pl) - this.count(1 - pl)) * 10 + (this.b[22] === pl + 1 ? 0.5 : this.b[22] ? -0.5 : 0); },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

  /* ---------------------------------------------------------------- Tarocchi
   * A 78-card tarot pack: cards 0-55 are the four suits (suit*14 + rank-1;
   * ranks 1-10, then Jack 11, Knight 12, Queen 13, King 14), 56-76 are the
   * trumps I-XXI, and 77 is the Fool. Two players, thirteen cards each. */
  const TC_FOOL = 77, TC_N = 13;
  const tcSuit = c => (c < 56 ? (c / 14) | 0 : c < 77 ? 4 : 5); // 4 trumps, 5 the Fool
  const tcRank = c => (c < 56 ? (c % 14) + 1 : c < 77 ? c - 55 : 0);
  // Card points: kings 5, queens 4, knights 3, jacks 2, and 5 for the three great trumps (I, XXI and the Fool).
  const tcPts = c => (c === 56 || c === 76 || c === TC_FOOL ? 5 : c < 56 && (c % 14) + 1 > 10 ? (c % 14) + 1 - 9 : 0);
  const TAROCCHI = {
    id: 'tarocchi', name: 'Tarocchi', dice: false, first: 0, FOOL: TC_FOOL, suit: tcSuit, rank: tcRank, points: tcPts,
    followPrompt: 'You won the trick, so you lead the next card.',
    rules: [
      'Each player holds thirteen cards. You lead the first trick; whoever wins a trick leads the next.',
      'Follow the suit that was led if you can. If you cannot, you must play a trump if you have one. Otherwise play anything.',
      'The highest trump wins the trick; with no trump in it, the highest card of the suit led wins. In the suits, the king is highest, then the queen, knight and jack, then 10 down to 1.',
      'The Fool can be played at any time instead of following. It never wins a trick, but you keep it for its points. If you lead the Fool, the other player\'s card wins.',
      'At the end, count your cards: kings 5, queens 4, knights 3, jacks 2, and trumps I and XXI and the Fool 5 each. Each trick you won adds 1. The higher total wins.'
    ],
    source: 'The rules of the first tarocchi games, played in Milan and Ferrara in the 1440s, were never written down. This is a simplified two-player game built on what every tarot game still shares: following suit, the duty to trump, and the Fool as an excuse. In old Italian packs the pip cards of cups and coins ranked in reverse; here every suit ranks the same way.',
    init(deal) {
      const deck = deal ? deal.slice() : Array.from({ length: 78 }, (_, i) => i);
      if (!deal) for (let i = deck.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; }
      this.hands = [deck.slice(0, TC_N).sort((a, b) => a - b), deck.slice(TC_N, 2 * TC_N).sort((a, b) => a - b)];
      this.trick = []; this.leader = 0; this.toMove = 0;
      this.won = [[], []]; this.tricks = [0, 0]; this.played = [];
      this.void = [[false, false, false, false, false], [false, false, false, false, false]]; // what each player has shown they lack
    },
    // Which suit must be followed: the first card that is not the Fool.
    ledSuit() { const c = this.trick.find(t => t.card !== TC_FOOL); return c ? tcSuit(c.card) : -1; },
    legalCards(hand) {
      const led = this.ledSuit();
      if (led < 0) return hand.slice();
      const follow = hand.filter(c => tcSuit(c) === led);
      let ok = follow.length ? follow : hand.filter(c => tcSuit(c) === 4);
      if (!ok.length) ok = hand.slice();
      if (hand.includes(TC_FOOL) && !ok.includes(TC_FOOL)) ok = ok.concat([TC_FOOL]);
      return ok;
    },
    legal(pl) { if (pl !== this.toMove) return []; return this.legalCards(this.hands[pl]).map(card => ({ pl, card })); },
    beats(a, b, led) { // does card a beat card b, with suit led?
      if (a === TC_FOOL) return false; if (b === TC_FOOL) return true;
      const sa = tcSuit(a), sb = tcSuit(b);
      if (sa === 4 || sb === 4) return sa === 4 && (sb !== 4 || tcRank(a) > tcRank(b));
      if (sa !== sb) return sa === led;
      return tcRank(a) > tcRank(b);
    },
    trickWinner() {
      const led = this.ledSuit(); let best = this.trick[0];
      for (const t of this.trick.slice(1)) if (this.beats(t.card, best.card, led)) best = t;
      if (best.card === TC_FOOL) best = this.trick.find(t => t.card !== TC_FOOL) || best;
      return best.pl;
    },
    apply(m) {
      const hand = this.hands[m.pl], led = this.ledSuit();
      hand.splice(hand.indexOf(m.card), 1);
      if (led >= 0 && m.card !== TC_FOOL && tcSuit(m.card) !== led) { this.void[m.pl][led] = true; if (tcSuit(m.card) !== 4) this.void[m.pl][4] = true; }
      this.trick.push({ pl: m.pl, card: m.card }); this.played.push(m.card);
      if (this.trick.length < 2) { this.toMove = 1 - m.pl; return { note: '' }; }
      const w = this.trickWinner(), cards = this.trick.map(t => t.card);
      for (const t of this.trick) { if (t.card === TC_FOOL) this.won[t.pl].push(TC_FOOL); else this.won[w].push(t.card); }
      this.tricks[w]++; this.trick = []; this.leader = w; this.toMove = w;
      const pts = cards.reduce((n, c) => n + (c === TC_FOOL ? 0 : tcPts(c)), 0) + 1;
      const note = w === 0 ? `You take the trick (${pts} point${pts === 1 ? '' : 's'}).` : `The Scribe takes the trick (${pts} point${pts === 1 ? '' : 's'}).`;
      const out = { note, trick: cards, winner: w };
      if (w === m.pl && this.hands[m.pl].length) out.followUp = this.legal(m.pl);
      return out;
    },
    score(pl) { return this.won[pl].reduce((n, c) => n + tcPts(c), 0) + this.tricks[pl]; },
    result() {
      if (this.hands[0].length || this.hands[1].length || this.trick.length) return null;
      const a = this.score(0), b = this.score(1);
      return { winner: a > b ? 0 : b > a ? 1 : -1, text: a === b ? `${a} points each. The game is drawn.` : `You ${a} points, the Scribe ${b}.` };
    },
    snapshot() { return JSON.stringify({ h: this.hands, t: this.trick, l: this.leader, m: this.toMove, w: this.won, k: this.tricks, p: this.played, v: this.void }); },
    restore(s) { const o = JSON.parse(s); this.hands = o.h; this.trick = o.t; this.leader = o.l; this.toMove = o.m; this.won = o.w; this.tricks = o.k; this.played = o.p; this.void = o.v; },
    // A sensible card for pl to play now: win a trick worth taking as cheaply as possible, otherwise throw the least useful card.
    heuristic(pl) {
      const ms = this.legalCards(this.hands[pl]);
      const val = c => (c === TC_FOOL ? 0 : tcPts(c) * 3 + (tcSuit(c) === 4 ? 2 + tcRank(c) / 10 : tcRank(c) / 14));
      if (!this.trick.length) {
        // Leading: a plain low card from a suit, keeping honours and trumps back.
        const plain = ms.filter(c => c !== TC_FOOL && tcSuit(c) < 4 && tcPts(c) === 0);
        const pool = plain.length ? plain : ms.filter(c => c !== TC_FOOL).length ? ms.filter(c => c !== TC_FOOL) : ms;
        return pool.reduce((a, b) => (val(b) < val(a) ? b : a));
      }
      const first = this.trick[0].card, led = this.ledSuit(), onTable = tcPts(first);
      const winners = ms.filter(c => first === TC_FOOL ? c !== TC_FOOL : this.beats(c, first, led));
      if (winners.length && (onTable > 0 || winners.some(c => tcSuit(c) !== 4 || tcRank(c) < 12))) {
        // Take it with the cheapest winning card; a point card is worth spending only to win points.
        return winners.reduce((a, b) => (val(b) < val(a) ? b : a));
      }
      if (ms.includes(TC_FOOL) && onTable >= 3 && !winners.length) return TC_FOOL; // save points with the excuse
      const losers = ms.filter(c => c !== TC_FOOL);
      return (losers.length ? losers : ms).reduce((a, b) => (val(b) < val(a) ? b : a));
    },
    // Sharp: deal the unseen cards out at random many times, consistent with what the visitor has shown,
    // play each deal to the end with the heuristic, and pick the card that scores best on average.
    sample(pl) {
      const opp = 1 - pl, mine = new Set(this.hands[pl]), seen = new Set(this.played);
      const unseen = []; for (let c = 0; c < 78; c++) if (!mine.has(c) && !seen.has(c)) unseen.push(c);
      for (let tries = 0; tries < 20; tries++) {
        for (let i = unseen.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [unseen[i], unseen[j]] = [unseen[j], unseen[i]]; }
        const hand = [], rest = [];
        for (const c of unseen) { if (hand.length < this.hands[opp].length && !(c !== TC_FOOL && this.void[opp][tcSuit(c)])) hand.push(c); else rest.push(c); }
        if (hand.length === this.hands[opp].length) return hand;
      }
      return unseen.slice(0, this.hands[opp].length);
    },
    aiPlan(pl, budget) {
      const plan = [];
      const pickOne = () => {
        const ms = this.legalCards(this.hands[pl]);
        if (ms.length === 1) return ms[0];
        if (LEVEL.name === 'gentle') return Math.random() < 0.5 ? ms[(Math.random() * ms.length) | 0] : this.heuristic(pl);
        if (LEVEL.name === 'fair') return this.heuristic(pl);
        const t0 = Date.now(), limit = budget || BUDGET_MS.sharp, root = this.snapshot(), real = this.hands[1 - pl];
        const total = new Map(ms.map(c => [c, 0])); let deals = 0;
        while (Date.now() - t0 < limit && deals < 400) {
          this.restore(root); // sample from the real position, not the last playout's end
          const guess = this.sample(pl);
          for (const c of ms) {
            this.restore(root); this.hands[1 - pl] = guess.slice();
            this.apply({ pl, card: c });
            while (!this.result()) { const who = this.toMove; this.apply({ pl: who, card: this.heuristic(who) }); }
            total.set(c, total.get(c) + this.score(pl) - this.score(1 - pl));
          }
          deals++;
        }
        this.restore(root); this.hands[1 - pl] = real;
        return [...total].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
      };
      // The Scribe keeps playing while it is still its turn: answering a trick and, if it wins, leading the next.
      const root = this.snapshot();
      do { const card = pickOne(); plan.push({ pl, card }); this.apply({ pl, card }); } while (this.toMove === pl && this.hands[pl].length && !this.result());
      this.restore(root);
      return plan;
    },
  };

  /* ----------------------------------------------------------------------- Go
   * A 9 x 9 board, index r*9+c, row 0 nearest the visitor. b holds 0 empty,
   * 1 black (the visitor, who plays first) and 2 white (the Scribe). Chinese
   * area scoring with a komi of 7 for white. The Scribe searches with Monte
   * Carlo tree search: thousands of random games from the position, steered
   * by RAVE (moves that won when played anywhere later count a little too). */
  const GO_N = 9, GO_KOMI = 7, GO_LIMIT = 300;
  const GO_NB = [], GO_DG = [];
  for (let p = 0; p < 81; p++) {
    const r = (p / 9) | 0, c = p % 9, nb = [], dg = [];
    if (r > 0) nb.push(p - 9); if (r < 8) nb.push(p + 9); if (c > 0) nb.push(p - 1); if (c < 8) nb.push(p + 1);
    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 9 && cc >= 0 && cc < 9) dg.push(rr * 9 + cc); }
    GO_NB.push(nb); GO_DG.push(dg);
  }
  const goMark = new Int32Array(81), goLibMark = new Int32Array(81), goStack = new Int32Array(81), goEmpty = new Int32Array(81);
  let goStamp = 0, goLibAt = -1;
  // Liberties of the group on p, counted up to max. The last one found is left in goLibAt.
  function goLibs(b, p, max) {
    if (goStamp > 2e9) { goStamp = 0; goMark.fill(0); goLibMark.fill(0); } // the marks are 32-bit
    const col = b[p], s = ++goStamp; let sp = 0, libs = 0;
    goStack[sp++] = p; goMark[p] = s;
    while (sp) {
      const nb = GO_NB[goStack[--sp]];
      for (let k = 0; k < nb.length; k++) {
        const n = nb[k], v = b[n];
        if (v === 0) { if (goLibMark[n] !== s) { goLibMark[n] = s; goLibAt = n; if (++libs >= max) return libs; } }
        else if (v === col && goMark[n] !== s) { goMark[n] = s; goStack[sp++] = n; }
      }
    }
    return libs;
  }
  function goRemove(b, p, out) {
    const col = b[p]; let sp = 0, n = 1;
    goStack[sp++] = p; b[p] = 0; if (out) out.push(p);
    while (sp) {
      const nb = GO_NB[goStack[--sp]];
      for (let k = 0; k < nb.length; k++) { const q = nb[k]; if (b[q] === col) { b[q] = 0; n++; if (out) out.push(q); goStack[sp++] = q; } }
    }
    return n;
  }
  // Is it legal for col to play p? Not occupied, not the ko point, and not suicide.
  function goLegal(b, col, p, ko) {
    if (b[p] || p === ko) return false;
    const nb = GO_NB[p];
    for (let k = 0; k < nb.length; k++) {
      const v = b[nb[k]];
      if (!v) return true;
      if (v === col ? goLibs(b, nb[k], 2) >= 2 : goLibs(b, nb[k], 2) === 1) return true;
    }
    return false;
  }
  // Plays a legal move. Returns the new ko point, or -1.
  function goPlay(b, col, p, caps) {
    const opp = 3 - col, nb = GO_NB[p];
    b[p] = col;
    let taken = 0, at = -1;
    for (let k = 0; k < nb.length; k++) { const n = nb[k]; if (b[n] === opp && goLibs(b, n, 1) === 0) { taken += goRemove(b, n, caps); at = n; } }
    if (taken === 1 && goLibs(b, p, 2) === 1) { for (let k = 0; k < nb.length; k++) if (b[nb[k]] === col) return -1; return at; }
    return -1;
  }
  // A point col should never fill: surrounded by its own stones, and not a false eye.
  function goEye(b, p, col) {
    const nb = GO_NB[p];
    for (let k = 0; k < nb.length; k++) if (b[nb[k]] !== col) return false;
    const dg = GO_DG[p]; let bad = 0;
    for (let k = 0; k < dg.length; k++) if (b[dg[k]] === 3 - col) bad++;
    return dg.length < 4 ? bad === 0 : bad < 2;
  }
  // Area score for black minus white, before komi, of a finished random game.
  function goArea(b) {
    let s = 0;
    for (let p = 0; p < 81; p++) {
      const v = b[p];
      if (v) { s += v === 1 ? 1 : -1; continue; }
      let bl = 0, wh = 0; const nb = GO_NB[p];
      for (let k = 0; k < nb.length; k++) { if (b[nb[k]] === 1) bl++; else if (b[nb[k]] === 2) wh++; }
      if (bl && !wh) s++; else if (wh && !bl) s--;
    }
    return s;
  }
  // Plays random moves to the end. Captures a group left in atari by the last move when it can.
  function goPlayout(b, col, ko, passes, last, firstT, firstC, t) {
    while (passes < 2 && t < GO_LIMIT) {
      let p = -1;
      if (last >= 0 && b[last] === 3 - col && goLibs(b, last, 2) === 1) {
        const lib = goLibAt; // goLegal overwrites goLibAt, so keep the liberty first
        if (goLegal(b, col, lib, ko) && Math.random() < 0.9) p = lib;
      }
      if (p < 0) {
        let ne = 0;
        for (let q = 0; q < 81; q++) if (!b[q]) goEmpty[ne++] = q;
        while (ne) {
          const k = (Math.random() * ne) | 0, q = goEmpty[k]; goEmpty[k] = goEmpty[--ne];
          if (!goEye(b, q, col) && goLegal(b, col, q, ko)) { p = q; break; }
        }
      }
      if (p < 0) { passes++; ko = -1; last = -1; }
      else {
        ko = goPlay(b, col, p, null); passes = 0; last = p;
        if (firstT && firstT[p] < 0) { firstT[p] = t; firstC[p] = col; }
      }
      col = 3 - col; t++;
    }
    return goArea(b) - GO_KOMI;
  }
  function goSearch(st, col, budget) {
    const root = { p: -2, col: 3 - col, n: 0, w: 0, rn: 0, rw: 0, kids: null };
    const b = new Int8Array(81), firstT = new Int16Array(81), firstC = new Int8Array(81);
    const t0 = Date.now(); let sims = 0;
    const select = node => {
      let best = null, bv = -Infinity; const ln = Math.log(node.n + 1);
      for (const c of node.kids) {
        let v;
        if (!c.n) v = (c.rn ? c.rw / c.rn : 0.5) + 0.1;
        else {
          const beta = c.rn / (c.rn + c.n + c.rn * c.n * 0.0005);
          v = (1 - beta) * (c.w / c.n) + beta * (c.rn ? c.rw / c.rn : 0) + 0.08 * Math.sqrt(ln / c.n);
        }
        if (c.p === -1) v -= 0.05; // pass only when nothing else is worth playing
        if (v > bv) { bv = v; best = c; }
      }
      return best;
    };
    const expand = (node, toMove, ko) => {
      node.kids = [];
      for (let p = 0; p < 81; p++) if (!goEye(b, p, toMove) && goLegal(b, toMove, p, ko)) node.kids.push({ p, col: toMove, n: 0, w: 0, rn: 0, rw: 0, kids: null });
      node.kids.push({ p: -1, col: toMove, n: 0, w: 0, rn: 0, rw: 0, kids: null });
    };
    do {
      b.set(st.b); firstT.fill(-1);
      let ko = st.ko, passes = st.passes, toMove = col, last = st.last, node = root, depth = 0;
      const path = [root];
      for (;;) {
        if (passes >= 2) break;
        if (!node.kids) { if (node !== root && node.n < 2) break; expand(node, toMove, ko); }
        node = select(node);
        if (node.p >= 0) {
          ko = goPlay(b, toMove, node.p, null); passes = 0; last = node.p;
          if (firstT[node.p] < 0) { firstT[node.p] = depth; firstC[node.p] = toMove; }
        } else { passes++; ko = -1; last = -1; }
        toMove = 3 - toMove; depth++; path.push(node);
      }
      const score = passes >= 2 ? goArea(b) - GO_KOMI : goPlayout(b, toMove, ko, passes, last, firstT, firstC, depth + st.ply);
      const winner = score > 0 ? 1 : 2;
      for (let i = path.length - 1; i >= 0; i--) {
        const nd = path[i];
        nd.n++; if (nd.col === winner) nd.w++;
        if (nd.kids) for (const c of nd.kids) if (c.p >= 0 && firstC[c.p] === c.col && firstT[c.p] >= i) { c.rn++; if (c.col === winner) c.rw++; }
      }
      sims++;
    } while ((sims & 7) || Date.now() - t0 < budget);
    return { root, sims };
  }
  const GO = {
    id: 'go', name: 'Go', dice: false, first: 0, canPass: true, N: GO_N, KOMI: GO_KOMI,
    rules: [
      'You play black and move first. Take turns placing a stone on an empty point where the lines cross. Stones never move.',
      'A stone or a chain of stones joined along the lines is captured when the other side fills every empty point next to it.',
      'You may not play a stone that would have no empty point next to it, unless it captures. Ko: you may not take back a single stone straight away if that would repeat the board.',
      'Use Pass when there is nothing useful left to play. When both players pass in a row, the game ends.',
      'Each side scores its stones plus the empty points it alone surrounds. Stones that could not escape capture are counted as captured. White adds 7 points (komi) for moving second; the higher total wins.'
    ],
    source: 'Modern rules: Chinese area scoring on the 9 × 9 board used for quick games, with a komi of 7.',
    init() { this.b = new Int8Array(81); this.ko = -1; this.passes = 0; this.ply = 0; this.last = -1; this.caps = [0, 0]; this.final = null; },
    count(pl) { let n = 0; for (const v of this.b) if (v === pl + 1) n++; return n; },
    over() { return this.passes >= 2 || this.ply >= GO_LIMIT; },
    legal(pl) {
      if (this.over()) return [];
      const out = [];
      for (let p = 0; p < 81; p++) if (goLegal(this.b, pl + 1, p, this.ko)) out.push({ pl, p });
      return out;
    },
    apply(m) {
      this.ply++; this.final = null;
      if (m.pass) {
        this.passes++; this.ko = -1; this.last = -1;
        const end = this.passes >= 2;
        return { caps: [], note: m.pl === 0 ? (end ? 'You pass too, so the game ends.' : 'You pass.') : (end ? 'The Scribe passes too, so the game ends.' : 'The Scribe passes. Pass as well to end the game and count the board.') };
      }
      const caps = [];
      this.ko = goPlay(this.b, m.pl + 1, m.p, caps); this.passes = 0; this.last = m.p;
      this.caps[m.pl] += caps.length;
      const n = caps.length;
      return { caps, note: !n ? '' : m.pl === 0 ? `You capture ${n === 1 ? 'a stone' : n + ' stones'}.` : `The Scribe captures ${n === 1 ? 'one of your stones' : n + ' of your stones'}.` };
    },
    // Who owns each point at the end: plays the position out many times and keeps the clear majorities.
    // Returns +1 (black), -1 (white) or 0 per point.
    ownership(runs = 300) {
      const tally = new Int16Array(81), b = new Int8Array(81);
      for (let k = 0; k < runs; k++) {
        b.set(this.b);
        goPlayout(b, this.ply % 2 ? 2 : 1, this.ko, 0, this.last, null, null, 0);
        for (let p = 0; p < 81; p++) {
          let v = b[p];
          if (!v) { let bl = 0, wh = 0; for (const n of GO_NB[p]) { if (b[n] === 1) bl++; else if (b[n] === 2) wh++; } v = bl && !wh ? 1 : wh && !bl ? 2 : 0; }
          if (v === 1) tally[p]++; else if (v === 2) tally[p]--;
        }
      }
      return Array.from(tally, t => (t > runs * 0.3 ? 1 : t < -runs * 0.3 ? -1 : 0));
    },
    tally() {
      const own = this.ownership();
      let black = 0, white = 0;
      own.forEach(o => { if (o > 0) black++; else if (o < 0) white++; });
      return { black, white, dead: this.b.reduce((n, v, p) => n + (v && own[p] && (own[p] > 0 ? 1 : 2) !== v ? 1 : 0), 0) };
    },
    result() {
      if (!this.over()) return null;
      if (!this.final) {
        const { black, white, dead } = this.tally(), w = white + GO_KOMI, d = black - w;
        const why = this.passes >= 2 ? '' : 'Three hundred moves played. ';
        const deadNote = dead ? ` ${dead} stone${dead === 1 ? '' : 's'} that could not escape count${dead === 1 ? 's' : ''} as captured.` : '';
        this.final = { winner: d > 0 ? 0 : 1, text: `${why}You ${black}, the Scribe ${white} + 7 komi = ${w}. ${d > 0 ? `You win by ${d}.` : `The Scribe wins by ${-d}.`}${deadNote}` };
      }
      return this.final;
    },
    snapshot() { return [this.b.slice(), this.ko, this.passes, this.ply, this.last, this.caps.slice()]; },
    restore(s) { this.b = s[0].slice(); this.ko = s[1]; this.passes = s[2]; this.ply = s[3]; this.last = s[4]; this.caps = s[5].slice(); this.final = null; },
    aiPlan(pl, budget) {
      const col = pl + 1, pass = [{ pl, pass: true }];
      // After the visitor passes, pass too if the count already favours the Scribe.
      if (this.passes === 1) { const { black, white } = this.tally(); if ((col === 2 ? white + GO_KOMI - black : black - white - GO_KOMI) > 0) return pass; }
      const { root } = goSearch(this, col, budget || BUDGET_MS[LEVEL.name]);
      const kids = root.kids.filter(c => c.n).sort((a, b) => b.n - a.n);
      if (!kids.length) return pass;
      let pick0 = kids[0];
      // Gentle chooses loosely among its better candidates.
      if (LEVEL.name === 'gentle' && kids.length > 1 && Math.random() < 0.35) pick0 = kids[1 + ((Math.random() * Math.min(3, kids.length - 1)) | 0)];
      if (pick0.p < 0) return pass;
      return [{ pl, p: pick0.p }];
    },
  };

  /* -------------------------------------------------------------------- Halma
   * A 16 x 16 board, index r*16+c, row 0 nearest the visitor. Each camp is the
   * 19 squares of a corner (rows of 5, 5, 4, 3 and 2): the visitor's at (0, 0),
   * the Scribe's at (15, 15). b holds 0 empty, 1 visitor, 2 Scribe. */
  const HM_N = 16, HM_MEN = 19;
  const HM_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const HM_CAMP = [[], []];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (r + c <= 5) { HM_CAMP[0].push(r * HM_N + c); HM_CAMP[1].push((15 - r) * HM_N + (15 - c)); }
  // HM_GOAL[pl][i] is 1 when square i is in the camp pl is racing to.
  const HM_GOAL = [0, 1].map(pl => { const a = new Uint8Array(256); HM_CAMP[1 - pl].forEach(i => { a[i] = 1; }); return a; });
  // How far square i is from pl's far corner, counted in diagonal rows.
  const hmDist = (pl, i) => { const r = i >> 4, c = i & 15; return pl === 0 ? 30 - r - c : r + c; };
  const HM_LIMIT = 400; // plies: two hundred moves each
  const HALMA = {
    id: 'halma', name: 'Halma', dice: false, first: 0, N: HM_N, CAMP: HM_CAMP, GOAL: HM_GOAL,
    rules: [
      'You play red and move first. Move all 19 of your men into the Scribe\'s camp in the far corner before the Scribe fills yours.',
      'A man steps to any empty square next to it, across, up or down, or diagonally.',
      'Or it leaps: over one piece next to it, of either colour, onto the empty square just beyond. Nothing is captured, and a man may keep leaping in the same turn, as far as the chain goes.',
      'A man that reaches the far camp may move inside it but may not leave it again.',
      'You win when all your men are in the far camp. If the far camp is full and at least one man in it is yours, you win too, so no one can block a camp by staying home.',
      'House rule: after two hundred moves each, whoever has more men home wins, then whoever is closer overall.'
    ],
    source: 'Two-player Halma as published by George Howard Monks in 1884, with the modern rule against blocking a camp.',
    init() {
      const b = new Uint8Array(256);
      HM_CAMP[0].forEach(i => { b[i] = 1; }); HM_CAMP[1].forEach(i => { b[i] = 2; });
      this.b = b; this.ply = 0;
    },
    home(pl) { let n = 0; for (const i of HM_CAMP[1 - pl]) if (this.b[i] === pl + 1) n++; return n; },
    men(pl) { const out = []; for (let i = 0; i < 256; i++) if (this.b[i] === pl + 1) out.push(i); return out; },
    // Every square the man on i can end on, with the path that gets there.
    reach(i) {
      const b = this.b, pl = b[i] - 1, locked = HM_GOAL[pl][i], out = [];
      const r0 = i >> 4, c0 = i & 15;
      for (const [dr, dc] of HM_DIRS) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || r > 15 || c < 0 || c > 15) continue;
        const j = r * 16 + c;
        if (!b[j] && (!locked || HM_GOAL[pl][j])) out.push({ pl, from: i, to: j, path: [j] });
      }
      // Leaps: a search over landing squares, with the man lifted off its square.
      b[i] = 0;
      const seen = new Set([i]), queue = [[i, []]];
      while (queue.length) {
        const [at, path] = queue.shift(), r1 = at >> 4, c1 = at & 15;
        for (const [dr, dc] of HM_DIRS) {
          const mr = r1 + dr, mc = c1 + dc, lr = r1 + 2 * dr, lc = c1 + 2 * dc;
          if (lr < 0 || lr > 15 || lc < 0 || lc > 15) continue;
          const land = lr * 16 + lc;
          if (!b[mr * 16 + mc] || b[land] || seen.has(land)) continue;
          seen.add(land);
          const np = path.concat([land]);
          if (!locked || HM_GOAL[pl][land]) out.push({ pl, from: i, to: land, path: np });
          queue.push([land, np]);
        }
      }
      b[i] = pl + 1;
      return out;
    },
    legal(pl) {
      if (this.winner() !== null) return [];
      const out = [];
      for (const i of this.men(pl)) out.push(...this.reach(i));
      return out;
    },
    apply(m) {
      if (m.pass) { this.ply++; return { note: '' }; }
      const wasHome = HM_GOAL[m.pl][m.from];
      this.b[m.from] = 0; this.b[m.to] = m.pl + 1; this.ply++;
      const leaps = Math.max(Math.abs((m.path[0] >> 4) - (m.from >> 4)), Math.abs((m.path[0] & 15) - (m.from & 15))) === 2 ? m.path.length : 0;
      const parts = [];
      if (leaps > 1) parts.push(m.pl === 0 ? `You leap ${leaps} times.` : `The Scribe leaps ${leaps} times.`);
      if (!wasHome && HM_GOAL[m.pl][m.to]) {
        const n = this.home(m.pl);
        parts.push(m.pl === 0 ? `${n} of your men ${n === 1 ? 'is' : 'are'} home.` : `${n} of the Scribe's men ${n === 1 ? 'is' : 'are'} home.`);
      }
      return { note: parts.join(' ') };
    },
    winner() {
      for (const pl of [0, 1]) {
        const n = this.home(pl);
        if (n === HM_MEN) return pl;
        if (n && HM_CAMP[1 - pl].every(i => this.b[i])) return pl;
      }
      return null;
    },
    total(pl) { let d = 0; for (const i of this.men(pl)) d += hmDist(pl, i); return d; },
    skipTurn(pl) {
      if (this.winner() !== null || this.legal(pl).length || !this.legal(1 - pl).length) return '';
      return pl === 0 ? 'Your men are boxed in, so you pass.' : 'The Scribe\'s men are boxed in, and it passes.';
    },
    result() {
      const w = this.winner();
      if (w !== null) return { winner: w, text: w === 0 ? (this.home(0) === HM_MEN ? 'All your men reached the Scribe\'s camp.' : 'The Scribe\'s camp is full, and your men are in it.') : (this.home(1) === HM_MEN ? 'All the Scribe\'s men reached your camp.' : 'Your camp is full, and the Scribe\'s men are in it.') };
      if (this.ply >= HM_LIMIT || (!this.legal(0).length && !this.legal(1).length)) {
        const a = this.home(0), b = this.home(1), da = this.total(0), db = this.total(1);
        const winner = a !== b ? (a > b ? 0 : 1) : da !== db ? (da < db ? 0 : 1) : -1;
        const text = a !== b ? `Two hundred moves each. Men home: you ${a}, the Scribe ${b}.` : winner < 0 ? 'Two hundred moves each, dead level. The game is drawn.' : `Two hundred moves each, ${a} men home apiece; ${winner === 0 ? 'yours are' : 'the Scribe\'s are'} closer to home.`;
        return { winner, text };
      }
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply]; },
    restore(s) { this.b = s[0].slice(); this.ply = s[1]; },
    turns(pl) {
      const ms = this.legal(pl);
      if (!ms.length) return [[{ pl, pass: true }]];
      const gain = m => hmDist(pl, m.from) - hmDist(pl, m.to) + (HM_GOAL[pl][m.to] && !HM_GOAL[pl][m.from] ? 2 : 0);
      ms.sort((x, y) => gain(y) - gain(x));
      return ms.slice(0, 36).map(m => [m]);
    },
    terminal(pl, depth) {
      const w = this.winner();
      if (w !== null) return w === pl ? 1000 + depth : -1000 - depth;
      if (this.ply >= HM_LIMIT) { const d = this.home(pl) - this.home(1 - pl); return d * 50 + (this.total(1 - pl) - this.total(pl)); }
      return null;
    },
    // Distance still to travel, squared a little so no man is left behind.
    score(pl) {
      let s = 0;
      for (let i = 0; i < 256; i++) if (this.b[i] === pl + 1) { const d = hmDist(pl, i); s -= d + 0.05 * d * d; if (HM_GOAL[pl][i]) s += 3; }
      return s;
    },
    evaluate(pl) { return this.score(pl) - this.score(1 - pl); },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 3); },
  };

  /* ------------------------------------------------------------ Dots and Boxes
   * A 4 x 4 grid of boxes between 5 x 5 dots. Edges 0-19 are horizontal (row r
   * of dots 0-4, column c 0-3, index r*4+c); 20-39 are vertical (box row r 0-3,
   * dot column c 0-4, index 20 + r*5+c). Box (r, c) is index r*4+c. */
  // The grid size can change (4 x 4 or 5 x 5 boxes), so these tables are rebuilt by dbBuild().
  let DB_N, DB_EDGES, DB_BOX_EDGES, DB_EDGE_BOXES;
  function dbBuild(n) {
    DB_N = n;
    const dbH = (r, c) => r * n + c, dbV = (r, c) => n * (n + 1) + r * (n + 1) + c;
    DB_EDGES = 2 * n * (n + 1);
    DB_BOX_EDGES = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) DB_BOX_EDGES.push([dbH(r, c), dbH(r + 1, c), dbV(r, c), dbV(r, c + 1)]);
    DB_EDGE_BOXES = Array.from({ length: DB_EDGES }, () => []);
    DB_BOX_EDGES.forEach((es, b) => es.forEach(e => DB_EDGE_BOXES[e].push(b)));
  }
  dbBuild(4);
  const DOTSBOXES = {
    id: 'dotsboxes', name: 'Dots and Boxes', dice: false, first: 0, N: DB_N, EDGES: DB_EDGES,
    BOX_EDGES: DB_BOX_EDGES, EDGE_BOXES: DB_EDGE_BOXES,
    variants: [{ id: '4', label: '4 × 4' }, { id: '5', label: '5 × 5' }],
    variant: '4',
    setVariant(id) {
      const n = id === '5' ? 5 : 4;
      dbBuild(n); this.variant = String(n);
      this.N = DB_N; this.EDGES = DB_EDGES; this.BOX_EDGES = DB_BOX_EDGES; this.EDGE_BOXES = DB_EDGE_BOXES;
    },
    rules: [
      'Take turns drawing a line between two neighbouring dots, across or up and down.',
      'Close the fourth side of a box and it is yours: you score it and draw again.',
      'When every line is drawn, the player with more boxes wins.',
      'A tip: try not to draw the third side of a box, unless you have to.'
    ],
    source: 'The rules Édouard Lucas published as "la pipopipette", here on a grid of sixteen boxes.',
    followPrompt: 'You closed a box, so draw another line.',
    init() { this.drawn = Array(DB_EDGES).fill(false); this.owner = Array(DB_N * DB_N).fill(-1); this.score = [0, 0]; },
    sides(b) { let n = 0; for (const e of DB_BOX_EDGES[b]) if (this.drawn[e]) n++; return n; },
    gain(e) { let n = 0; for (const b of DB_EDGE_BOXES[e]) if (this.sides(b) === 3) n++; return n; },
    gift(e) { let n = 0; for (const b of DB_EDGE_BOXES[e]) if (this.sides(b) === 2) n++; return n; },
    left() { let n = 0; for (const d of this.drawn) if (!d) n++; return n; },
    legal(pl) { const out = []; for (let e = 0; e < DB_EDGES; e++) if (!this.drawn[e]) out.push({ pl, e }); return out; },
    apply(m) {
      this.drawn[m.e] = true;
      const boxes = [];
      for (const b of DB_EDGE_BOXES[m.e]) if (this.sides(b) === 4 && this.owner[b] < 0) { this.owner[b] = m.pl; this.score[m.pl]++; boxes.push(b); }
      let note = '';
      if (boxes.length) note = m.pl === 0 ? (boxes.length > 1 ? 'Two boxes for you.' : 'A box for you.') : (boxes.length > 1 ? 'The Scribe closes two boxes.' : 'The Scribe closes a box.');
      const followUp = boxes.length && this.left() ? this.legal(m.pl) : null;
      return { boxes, note, followUp };
    },
    result() {
      if (this.left()) return null;
      const [a, b] = this.score;
      return { winner: a > b ? 0 : b > a ? 1 : -1, text: a === b ? `${a} boxes each. The game is drawn.` : `Final count: you ${a} boxes, the Scribe ${b}.` };
    },
    snapshot() { return [this.drawn.slice(), this.owner.slice(), this.score.slice()]; },
    restore(s) { this.drawn = s[0].slice(); this.owner = s[1].slice(); this.score = s[2].slice(); },
    // Exact endgame: the best final margin for the player to move, over the remaining edges.
    solve(budgetMs) {
      const edges = []; for (let e = 0; e < DB_EDGES; e++) if (!this.drawn[e]) edges.push(e);
      const k = edges.length, memo = new Map(), stop = Date.now() + budgetMs;
      const sides = this.drawn.slice();
      const gainOf = (e) => { let n = 0; for (const b of DB_EDGE_BOXES[e]) { let s = 0; for (const x of DB_BOX_EDGES[b]) if (sides[x]) s++; if (s === 3) n++; } return n; };
      let nodes = 0;
      const f = (mask) => {
        if (mask === (1 << k) - 1) return 0;
        const hit = memo.get(mask); if (hit !== undefined) return hit;
        if ((++nodes & 1023) === 0 && Date.now() > stop) throw OUT_OF_TIME;
        let best = -Infinity;
        for (let j = 0; j < k; j++) {
          if (mask & (1 << j)) continue;
          const e = edges[j], g = gainOf(e);
          sides[e] = true;
          const v = g ? g + f(mask | (1 << j)) : -f(mask | (1 << j));
          sides[e] = false;
          if (v > best) best = v;
        }
        memo.set(mask, best); return best;
      };
      // Pick the edge with the best value, preferring captures on ties.
      let pickE = -1, pickV = -Infinity;
      for (let j = 0; j < k; j++) {
        const e = edges[j], g = gainOf(e);
        sides[e] = true;
        const v = g ? g + f(1 << j) : -f(1 << j);
        sides[e] = false;
        if (v > pickV || (v === pickV && g)) { pickV = v; pickE = e; }
      }
      return pickE;
    },
    // One move for the player to move, by level.
    pickEdge(budget = BUDGET_MS[LEVEL.name]) {
      const free = []; for (let e = 0; e < DB_EDGES; e++) if (!this.drawn[e]) free.push(e);
      const rnd = a => a[(Math.random() * a.length) | 0];
      const takes = free.filter(e => this.gain(e) > 0), safe = free.filter(e => !this.gain(e) && !this.gift(e));
      if (LEVEL.name === 'gentle') {
        if (takes.length && Math.random() < 0.75) return rnd(takes);
        if (safe.length && Math.random() < 0.7) return rnd(safe);
        return rnd(free);
      }
      const limit = LEVEL.name === 'sharp' ? 22 : 15;
      if (free.length <= limit && !safe.length && budget > 40) {
        try { return this.solve(budget); } catch (e) { if (e !== OUT_OF_TIME) throw e; }
      }
      if (takes.length) return takes[0];
      if (safe.length) return rnd(safe);
      // Every line gives boxes away: give away as few as possible.
      let best = free[0], bestLoss = Infinity;
      for (const e of free) {
        const s = this.snapshot(); this.drawn[e] = true;
        let loss = 0, again = true;
        while (again) { again = false; for (let x = 0; x < DB_EDGES; x++) if (!this.drawn[x] && this.gain(x)) { loss += this.gain(x); this.drawn[x] = true; again = true; } }
        this.restore(s);
        if (loss < bestLoss) { bestLoss = loss; best = e; }
      }
      return best;
    },
    aiPlan(pl) {
      const s = this.snapshot(), plan = [], t0 = Date.now(), budget = BUDGET_MS[LEVEL.name];
      for (;;) {
        if (!this.left()) break;
        // Every line in a turn shares the level's thinking budget.
        const m = { pl, e: this.pickEdge(budget - (Date.now() - t0)) };
        plan.push(m);
        const r = this.apply(m);
        if (!r.followUp) break;
      }
      this.restore(s);
      return plan;
    },
  };

  /* -------------------------------------------------------------- Chaturaji
     Four-handed chaturanga with dice, as al-Biruni described it about 1030 and
     Murray read him: each for himself, kings can be taken, captures score.
     Board cells are y * 8 + x, x the file from the visitor's left, y the rank
     away from the visitor. A cell holds 0 or (seat << 3 | type). */
  const CJ_KING = 1, CJ_ELEPHANT = 2, CJ_HORSE = 3, CJ_BOAT = 4, CJ_PAWN = 5;
  const CJ_VAL = [0, 5, 4, 3, 2, 1];
  const CJ_NAME = ['', 'king', 'elephant', 'horse', 'boat', 'pawn'];
  const CJ_SEAT = ['Yellow', 'Black', 'Red', 'Green']; // the visitor, then clockwise
  // [king, elephant, horse, boat] squares, the pawn row, and the pawns' step
  const CJ_SETUP = [
    { back: [[3, 0], [2, 0], [1, 0], [0, 0]], pawns: [[0, 1], [1, 1], [2, 1], [3, 1]], dir: [0, 1] },
    { back: [[0, 4], [0, 5], [0, 6], [0, 7]], pawns: [[1, 4], [1, 5], [1, 6], [1, 7]], dir: [1, 0] },
    { back: [[4, 7], [5, 7], [6, 7], [7, 7]], pawns: [[4, 6], [5, 6], [6, 6], [7, 6]], dir: [0, -1] },
    { back: [[7, 3], [7, 2], [7, 1], [7, 0]], pawns: [[6, 0], [6, 1], [6, 2], [6, 3]], dir: [-1, 0] },
  ];
  // Which pieces each face of a die moves: 1 and 5 king or pawn, 2 boat, 3 horse, 4 and 6 elephant.
  const CJ_FACE = [null, [CJ_KING, CJ_PAWN], [CJ_BOAT], [CJ_HORSE], [CJ_ELEPHANT], [CJ_KING, CJ_PAWN], [CJ_ELEPHANT]];
  const CJ_FACES_FOR = [null, [1, 5], [4, 6], [3], [2], [1, 5]]; // by piece type
  // A pawn on the far line becomes the piece whose line it reached: boat, horse, elephant, king, king, elephant, horse, boat.
  const CJ_PROMO = [CJ_BOAT, CJ_HORSE, CJ_ELEPHANT, CJ_KING, CJ_KING, CJ_ELEPHANT, CJ_HORSE, CJ_BOAT];
  const CJ_KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const CJ_K8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const CJ_ROUNDS = 30;
  const cjIn = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;
  const cjHit = k => 1 - Math.pow((6 - k) / 6, 2); // chance two dice show at least one of k faces

  const CHATURAJI = {
    id: 'chaturaji', name: 'Chaturaji', dice: true, pipDice: true, first: 0, extraNote: '', ROUNDS: CJ_ROUNDS, SEATS: CJ_SEAT, NAME: CJ_NAME, VAL: CJ_VAL,
    stopLabel: 'Skip',
    rules: [
      'Four armies, each for itself. You play yellow, nearest you; Black, Red and Green are three Scribes, and play passes clockwise, to your left.',
      'Throw two dice. Each die lets one piece of its kind move once: 1 or 5 the king or a pawn, 2 the boat, 3 the horse, 4 or 6 the elephant. Use the dice in either order, use one, or skip with the Skip button.',
      'The king moves one square any way, the elephant like a rook, the horse like a knight, and the boat jumps exactly two squares diagonally. Pawns step one square forward, away from your side, and take one square diagonally forward. There is no check: kings are taken like any other piece.',
      'A pawn that reaches the far edge becomes the piece that began on that line (boat, horse, elephant), but only if you have lost one of those. Otherwise it stays a pawn.',
      'If a boat\'s move makes a square of four boats, it takes the other three.',
      'Every capture scores: king 5, elephant 4, horse 3, boat 2, pawn 1. A player who loses the king is out, and the rest of that army stays on the board to be taken.',
      'Take all three kings and you win: that is chaturaji. Lose yours and you lose. After 30 rounds, the highest score among the kings still standing wins.'
    ],
    source: 'After al-Biruni\'s account of about 1030, as read by H. J. R. Murray (A History of Chess, 1913), with cubic dice. The throne rule (sinhasana) and the ransoming of kings are left out, and the 30-round limit is ours.',
    init() {
      this.b = new Int8Array(64);
      CJ_SETUP.forEach((s, seat) => {
        s.back.forEach(([x, y], k) => { this.b[y * 8 + x] = (seat << 3) | (k + 1); });
        s.pawns.forEach(([x, y]) => { this.b[y * 8 + x] = (seat << 3) | CJ_PAWN; });
      });
      this.alive = [true, true, true, true]; this.score = [0, 0, 0, 0]; this.kings = [[], [], [], []]; // whose kings each seat took
      this.seat = 0; this.round = 1; this.left = []; this.over = null; this.outNoted = [false, false, false, false];
    },
    seatOf(v) { return v >> 3; }, typeOf(v) { return v & 7; },
    count(seat, type) { let n = 0; for (let i = 0; i < 64; i++) { const v = this.b[i]; if (v && (v >> 3) === seat && (v & 7) === type) n++; } return n; },
    roll() { const a = 1 + ((Math.random() * 6) | 0), b = 1 + ((Math.random() * 6) | 0); return { faces: [a, b], value: a + b }; },
    rollName(r) {
      const say = f => `${f} (${CJ_FACE[f].map(t => CJ_NAME[t]).join(' or ')})`;
      return r.faces[0] === r.faces[1] ? `double ${say(r.faces[0])}` : `${say(r.faces[0])} and ${say(r.faces[1])}`;
    },
    // Every move one piece of the given types can make; the die is noted on each.
    pieceMoves(seat, i, die, face, out) {
      const v = this.b[i], t = v & 7, x = i & 7, y = i >> 3, own = j => this.b[j] && (this.b[j] >> 3) === seat;
      const add = (nx, ny) => { const j = ny * 8 + nx; if (!own(j)) out.push({ seat, from: i, to: j, die, face, cap: this.b[j] || 0 }); };
      if (t === CJ_KING) { for (const [dx, dy] of CJ_K8) if (cjIn(x + dx, y + dy)) add(x + dx, y + dy); }
      else if (t === CJ_HORSE) { for (const [dx, dy] of CJ_KN) if (cjIn(x + dx, y + dy)) add(x + dx, y + dy); }
      else if (t === CJ_BOAT) { for (const dx of [-2, 2]) for (const dy of [-2, 2]) if (cjIn(x + dx, y + dy)) add(x + dx, y + dy); }
      else if (t === CJ_ELEPHANT) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let nx = x + dx, ny = y + dy;
          while (cjIn(nx, ny)) { const j = ny * 8 + nx; if (own(j)) break; add(nx, ny); if (this.b[j]) break; nx += dx; ny += dy; }
        }
      } else if (t === CJ_PAWN) {
        const [dx, dy] = CJ_SETUP[seat].dir, fx = x + dx, fy = y + dy;
        if (cjIn(fx, fy) && !this.b[fy * 8 + fx]) add(fx, fy);
        const side = dx ? [[dx, 1], [dx, -1]] : [[1, dy], [-1, dy]];
        for (const [sx, sy] of side) { const nx = x + sx, ny = y + sy; if (cjIn(nx, ny)) { const w = this.b[ny * 8 + nx]; if (w && (w >> 3) !== seat) add(nx, ny); } }
      }
    },
    movesFor(seat, faces, pl) {
      const out = [], seen = new Set();
      faces.forEach((f, die) => {
        if (faces.indexOf(f) !== die) return; // a double: the second die offers the same moves
        const types = CJ_FACE[f], got = [];
        for (let i = 0; i < 64; i++) { const v = this.b[i]; if (v && (v >> 3) === seat && types.includes(v & 7)) this.pieceMoves(seat, i, die, f, got); }
        for (const m of got) { const k = m.from * 64 + m.to; if (!seen.has(k)) { seen.add(k); m.pl = pl; out.push(m); } }
      });
      return out;
    },
    // At the start of a turn: the moves the throw allows, plus a skip for the visitor.
    legal(pl, value, r) {
      if (this.over) return [];
      if (r) this.left = r.faces.slice();
      const seat = pl === 0 ? 0 : this.seat;
      const out = this.movesFor(seat, this.left, pl);
      if (out.length && pl === 0) out.push({ pl, seat, pass: true });
      return out;
    },
    get followPrompt() {
      const f = this.left[0];
      return f ? `Now move with your other die, ${f} (${CJ_FACE[f].map(t => 'the ' + CJ_NAME[t]).join(' or ')}), or press Skip.` : '';
    },
    who(seat) { return seat === 0 ? 'You' : CJ_SEAT[seat]; },
    pieceName(v) { return (v >> 3) === 0 ? 'your ' + CJ_NAME[v & 7] : `${CJ_SEAT[v >> 3]}'s ${CJ_NAME[v & 7]}`; },
    take(seat, j, words) {
      const v = this.b[j]; if (!v) return;
      this.b[j] = 0; this.score[seat] += CJ_VAL[v & 7];
      words.push(this.pieceName(v));
      if ((v & 7) === CJ_KING && this.alive[v >> 3] && !this.count(v >> 3, CJ_KING)) { this.alive[v >> 3] = false; this.kings[seat].push(v >> 3); }
    },
    apply(m) {
      const seat = m.seat, me = seat === 0;
      if (m.pass) {
        const first = this.left.length === 2; this.left = [];
        return { note: me ? (first ? 'You let the throw go.' : '') : `${CJ_SEAT[seat]} lets the throw go.`, moved: [] };
      }
      const k = this.left.indexOf(m.face); if (k >= 0) this.left.splice(k, 1);
      const v = this.b[m.from], words = [], captured = [], gained = this.score[seat];
      if (this.b[m.to]) captured.push(m.to);
      this.take(seat, m.to, words);
      this.b[m.to] = v; this.b[m.from] = 0;
      let triumph = false, promo = 0;
      if ((v & 7) === CJ_BOAT) { // the boat's triumph: four boats in a square
        const x = m.to & 7, y = m.to >> 3;
        for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
          const sq = [[x + ox, y + oy], [x + ox + 1, y + oy], [x + ox, y + oy + 1], [x + ox + 1, y + oy + 1]];
          if (!sq.every(([a, c]) => cjIn(a, c))) continue;
          const cells = sq.map(([a, c]) => c * 8 + a), others = cells.filter(j => j !== m.to);
          if (others.every(j => this.b[j] && (this.b[j] & 7) === CJ_BOAT && (this.b[j] >> 3) !== seat)) {
            for (const j of others) { captured.push(j); this.take(seat, j, words); }
            triumph = true; break;
          }
        }
      }
      if ((v & 7) === CJ_PAWN) {
        const [dx, dy] = CJ_SETUP[seat].dir, x = m.to & 7, y = m.to >> 3;
        const far = dx ? (dx > 0 ? x === 7 : x === 0) : (dy > 0 ? y === 7 : y === 0);
        if (far) {
          const t = CJ_PROMO[dx ? y : x];
          if (t !== CJ_KING && !this.count(seat, t)) { this.b[m.to] = (seat << 3) | t; promo = t; }
        }
      }
      const name = me ? 'You' : CJ_SEAT[seat];
      let note = '';
      if (triumph) note = `${me ? 'Your' : name + '\'s'} boat completes a square of four and takes ${words.join(', ')}. `;
      else if (words.length) note = `${name} ${me ? 'take' : 'takes'} ${words[0]} (${this.score[seat] - gained}). `;
      if (promo) note += `${me ? 'Your' : name + '\'s'} pawn becomes ${promo === CJ_ELEPHANT ? 'an' : 'a'} ${CJ_NAME[promo]}. `;
      for (const s of [1, 2, 3, 0]) if (!this.alive[s] && !this.outNoted[s]) { this.outNoted[s] = true; if (s) note += `${CJ_SEAT[s]} is out of the game. `; }
      this.check(seat);
      const res = { note: note.trim(), captured, caps: captured, promo, triumph, moved: [m.to] };
      if (!this.over && me && this.left.length) {
        const f = this.movesFor(0, this.left, 0);
        if (f.length) { f.push({ pl: 0, seat: 0, pass: true }); res.followUp = f; }
        else { this.left = []; res.note = (res.note + ' Your other die has no move.').trim(); }
      }
      return res;
    },
    check(seat) {
      if (this.over) return;
      if (!this.alive[0]) {
        const by = [1, 2, 3].find(s => this.kings[s].includes(0));
        this.over = { winner: 1, title: 'Your king is taken', text: `${CJ_SEAT[by]} took your king, and with it you are out. Scores: ${this.scoreLine()}.` };
      } else if (!this.alive[1] && !this.alive[2] && !this.alive[3]) {
        const all = this.kings[0].length === 3;
        this.over = { winner: 0, title: all ? 'Chaturaji' : 'You win', text: all ? `You took all three kings yourself: chaturaji, the full victory. Scores: ${this.scoreLine()}.` : `Yours is the last king standing. Scores: ${this.scoreLine()}.` };
      }
    },
    scoreLine() { return CJ_SEAT.map((n, s) => `${s ? n : 'you'} ${this.score[s]}`).join(', '); },
    // The turn passes clockwise to the next player with a king; returns 0 for the visitor, 1 for a Scribe.
    passTurn() {
      if (this.over) return 0;
      let s = this.seat;
      do { s = (s + 1) % 4; if (s === 0) this.round++; } while (!this.alive[s]);
      this.seat = s; this.left = [];
      if (s === 0 && this.round > CJ_ROUNDS) this.limit();
      return s === 0 ? 0 : 1;
    },
    limit() {
      const live = [0, 1, 2, 3].filter(s => this.alive[s]), top = Math.max(...live.map(s => this.score[s]));
      const best = live.filter(s => this.score[s] === top);
      const line = `After ${CJ_ROUNDS} rounds the scores are ${this.scoreLine()}.`;
      if (best.length === 1 && best[0] === 0) this.over = { winner: 0, title: 'You win on points', text: line };
      else if (best.includes(0)) this.over = { winner: -1, title: 'A tie on points', text: line + ' You share the top score.' };
      else this.over = { winner: 1, title: `${best.map(s => CJ_SEAT[s]).join(' and ')} ${best.length > 1 ? 'win' : 'wins'} on points`, text: line };
    },
    ended() { return !!this.over; },
    done() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over; },
    extra() { return false; },
    home() { return 0; },
    get scribeName() { return CJ_SEAT[this.seat]; },
    snapshot() { return { b: this.b.slice(), alive: this.alive.slice(), score: this.score.slice(), kings: this.kings.map(k => k.slice()), left: this.left.slice(), over: this.over, outNoted: this.outNoted.slice() }; },
    restore(s) { this.b = s.b.slice(); this.alive = s.alive.slice(); this.score = s.score.slice(); this.kings = s.kings.map(k => k.slice()); this.left = s.left.slice(); this.over = s.over; this.outNoted = s.outNoted.slice(); },
    // How well placed a seat is: its captures, minus what it stands to lose before its next turn, plus its threats.
    evaluate(seat, skipKing) {
      if (!this.alive[seat]) return -1000;
      const sharp = LEVEL.name === 'sharp';
      let e = this.score[seat] * 1.0 + (3 - [1, 2, 3, 0].filter(s => s !== seat && this.alive[s]).length) * 12;
      if (this.over) return e;
      // Who attacks each square, by seat, and with which types.
      const att = Array.from({ length: 4 }, () => new Map());
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v) continue;
        const s = v >> 3; if (!this.alive[s]) continue;
        const ms = []; this.pieceMoves(s, i, 0, 0, ms);
        for (const m of ms) {
          if ((v & 7) === CJ_PAWN && (m.to & 7) === (i & 7) && CJ_SETUP[s].dir[0] === 0) continue; // a pawn's forward step does not attack
          if ((v & 7) === CJ_PAWN && (m.to >> 3) === (i >> 3) && CJ_SETUP[s].dir[1] === 0) continue;
          const set = att[s].get(m.to) || new Set(); set.add(v & 7); att[s].set(m.to, set);
        }
      }
      const facesHit = types => { const f = new Set(); types.forEach(t => CJ_FACES_FOR[t].forEach(x => f.add(x))); return cjHit(f.size); };
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v) continue;
        const s = v >> 3, t = v & 7;
        if (s === seat) {
          let safe = 1;
          for (let o = 0; o < 4; o++) if (o !== seat && this.alive[o] && att[o].has(i)) safe *= 1 - facesHit(att[o].get(i));
          if (t === CJ_KING && skipKing) continue;
          const worth = t === CJ_KING ? (sharp ? 40 : 25) : CJ_VAL[t];
          e -= (1 - safe) * worth * (sharp ? 1 : 0.8);
          if (t === CJ_PAWN) { const [dx, dy] = CJ_SETUP[seat].dir, x = i & 7, y = i >> 3; e += 0.06 * (dx ? (dx > 0 ? x : 7 - x) : (dy > 0 ? y : 7 - y)); }
        } else if (sharp && att[seat].has(i)) {
          e += 0.18 * facesHit(att[seat].get(i)) * (t === CJ_KING && this.alive[s] ? 12 : CJ_VAL[t]);
        }
      }
      return e;
    },
    // The chance that some rival can take this seat's king with one throw, using both dice, before its next turn.
    kingRisk(seat) {
      let k = -1; for (let i = 0; i < 64; i++) if (this.b[i] && (this.b[i] >> 3) === seat && (this.b[i] & 7) === CJ_KING) { k = i; break; }
      if (k < 0) return 1;
      const saveB = this.b.slice(), hits = m => m.to === k;
      let safe = 1;
      for (let o = 0; o < 4; o++) {
        if (o === seat || !this.alive[o]) continue;
        let p = 0;
        for (let a = 1; a <= 6; a++) for (let c = a; c <= 6; c++) {
          let can = false;
          const first = this.movesFor(o, [a, c], 1);
          if (first.some(hits)) can = true;
          else for (const m1 of first) {
            const v = this.b[m1.from]; this.b[m1.to] = v; this.b[m1.from] = 0;
            const rest = m1.die === 0 ? [c] : [a];
            if (this.movesFor(o, rest, 1).some(hits)) can = true;
            this.b.set(saveB);
            if (can) break;
          }
          if (can) p += a === c ? 1 / 36 : 2 / 36;
        }
        safe *= 1 - p;
      }
      return 1 - safe;
    },
    // The Scribe whose turn it is tries every way to use its two dice, and keeps the best.
    // Sharp then looks again at its best few, counting two-move attacks on its king.
    aiPlan(pl, moves) {
      const seat = this.seat, root = this.snapshot(), faces = this.left.slice();
      const noise = pick(4, 0.5, 0.05), sharp = LEVEL.name === 'sharp', all = [];
      let best = [{ pl: 1, seat, pass: true }], bestV = this.evaluate(seat) + Math.random() * noise;
      const consider = (plan) => { const v = this.evaluate(seat) + Math.random() * noise; if (sharp) all.push({ plan: plan.slice(), v }); if (v > bestV) { bestV = v; best = plan.slice(); } };
      if (sharp) all.push({ plan: best, v: bestV });
      for (const m1 of this.movesFor(seat, faces, 1)) {
        this.apply(m1); const mid = this.snapshot();
        consider([m1]);
        if (!this.over && this.left.length) {
          for (const m2 of this.movesFor(seat, this.left, 1)) { this.apply(m2); consider([m1, m2]); this.restore(mid); }
        }
        this.restore(root);
      }
      this.restore(root);
      if (sharp) {
        all.sort((x, y) => y.v - x.v);
        let topV = -Infinity;
        for (const c of all.slice(0, 12)) {
          for (const m of c.plan) this.apply(m);
          const v = this.over ? c.v : this.evaluate(seat, true) - 45 * this.kingRisk(seat);
          this.restore(root);
          if (v > topV) { topV = v; best = c.plan; }
        }
      }
      if (LEVEL.name === 'gentle' && Math.random() < 0.35) { // the Gentle Scribe often just moves something
        const ms = this.movesFor(seat, faces, 1); if (ms.length) return [ms[(Math.random() * ms.length) | 0]];
      }
      return best;
    },
  };

  /* ------------------------------------------------------------------ Seega
     Lane's "khamsawee seega": a 5 x 5 board, twelve pieces each, placed two at
     a time; cells are y * 5 + x, x from the visitor's left, y away from them. */
  const SG_N = 5, SG_C = 12, SG_PIECES = 12, SG_QUIET = 40;
  const SG_D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const SEEGA = {
    id: 'seega', name: 'Seega', dice: false, first: 0,
    rules: [
      'You have twelve dark stones and the Scribe twelve pieces of red clay. Take turns placing two at a time on any empty square except the centre, you first.',
      'When all are placed, you move first, and your first move must go into the empty centre. After that, move one piece one square up, down or sideways onto an empty square.',
      'Trap an enemy piece between the piece you move and another of yours, along a row or column, and it is taken. One move can take up to three. You may move between two enemy pieces safely.',
      'After a capture, keep moving as long as you can capture again.',
      'If your move leaves the Scribe with no move, you must lift one of your own pieces to open a way, and the same holds for the Scribe.',
      'Take every enemy piece to win. If 20 moves each go by with no capture, whoever has more pieces wins.'
    ],
    source: 'Edward William Lane, Manners and Customs of the Modern Egyptians (1836), on the five-square seega. Lane gives no ending for a game that stalls; the 20-move rule is ours.',
    init() {
      this.b = new Int8Array(25); this.placed = [0, 0]; this.pairLeft = 0; this.started = false;
      this.chain = false; this.quiet = 0; this.over = null; this.moves = 0;
    },
    placing() { return this.placed[0] + this.placed[1] < 2 * SG_PIECES; },
    count(pl) { let n = 0; for (const v of this.b) if (v === pl + 1) n++; return n; },
    caps(pl, from, to) { // the enemy pieces a move from -> to would trap
      const me = pl + 1, foe = 2 - pl, x = to % 5, y = (to / 5) | 0, out = [];
      for (const [dx, dy] of SG_D4) {
        const ax = x + dx, ay = y + dy, bx = x + 2 * dx, by = y + 2 * dy;
        if (bx < 0 || bx >= 5 || by < 0 || by >= 5) continue;
        const a = ay * 5 + ax, c = by * 5 + bx;
        if (this.b[a] === foe && (this.b[c] === me && c !== from)) out.push(a);
      }
      return out;
    },
    steps(pl) {
      const out = [], me = pl + 1;
      for (let i = 0; i < 25; i++) {
        if (this.b[i] !== me) continue;
        const x = i % 5, y = (i / 5) | 0;
        for (const [dx, dy] of SG_D4) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= 5 || ny < 0 || ny >= 5) continue;
          const j = ny * 5 + nx; if (this.b[j]) continue;
          out.push({ pl, from: i, to: j, cap: this.caps(pl, i, j).length });
        }
      }
      return out;
    },
    // Own pieces whose lifting would give the blocked side a move.
    openings(pl) {
      const out = [];
      for (let i = 0; i < 25; i++) {
        if (this.b[i] !== pl + 1) continue;
        this.b[i] = 0; const ok = this.steps(1 - pl).length > 0; this.b[i] = pl + 1;
        if (ok) out.push({ pl, lift: i });
      }
      return out;
    },
    legal(pl) {
      if (this.over) return [];
      if (this.placing()) { const out = []; for (let i = 0; i < 25; i++) if (!this.b[i] && i !== SG_C) out.push({ pl, place: i }); return out; }
      let s = this.steps(pl);
      if (!this.started) s = s.filter(m => m.to === SG_C);
      if (this.chain) s = s.filter(m => m.cap);
      return s;
    },
    get followPrompt() {
      if (this.placing()) return 'Place your second stone.';
      if (this.lifting) return 'The Scribe is boxed in: pick one of your pieces to lift and open a way.';
      return 'Capture again: move a glowing piece.';
    },
    apply(m) {
      const pl = m.pl, me = pl === 0, who = me ? 'You' : 'The Scribe';
      if (m.place !== undefined) {
        this.b[m.place] = pl + 1; this.placed[pl]++;
        if (this.pairLeft === 0) this.pairLeft = 1; else this.pairLeft = 0;
        if (this.pairLeft === 1 && this.placed[pl] < SG_PIECES) { this.lifting = false; return { note: '', followUp: this.legal(pl) }; }
        this.pairLeft = 0;
        return { note: this.placing() ? '' : 'Every piece is placed. The centre square is the only empty one.' };
      }
      if (m.lift !== undefined) {
        this.b[m.lift] = 0; this.lifting = false;
        return { note: me ? 'You lift a piece to open a way for the Scribe.' : 'The Scribe lifts one of its pieces to open a way for you.', lifted: m.lift };
      }
      this.started = true; this.moves++;
      const taken = this.caps(pl, m.from, m.to);
      this.b[m.to] = this.b[m.from]; this.b[m.from] = 0;
      for (const j of taken) this.b[j] = 0;
      this.quiet = taken.length ? 0 : this.quiet + 1;
      const res = { note: '', taken, caps: taken };
      if (taken.length) res.note = `${who} ${me ? 'take' : 'takes'} ${taken.length === 1 ? 'a piece' : taken.length + ' pieces'}.`;
      if (!this.count(1 - pl)) { this.over = { winner: pl, text: me ? 'You have taken every one of the Scribe\'s pieces.' : 'The Scribe has taken every one of your pieces.' }; this.chain = false; return res; }
      if (taken.length) {
        this.chain = true;
        const more = this.steps(pl).filter(x => x.cap);
        if (more.length) { res.followUp = more; return res; }
      }
      this.chain = false;
      if (!this.steps(1 - pl).length) { // the other side is boxed in: open a way
        const o = this.openings(pl);
        if (o.length) { this.lifting = true; res.followUp = o; res.note = (res.note + (me ? ' The Scribe cannot move.' : ' You cannot move.')).trim(); return res; }
      }
      if (this.quiet >= SG_QUIET) {
        const a = this.count(0), c = this.count(1);
        this.over = { winner: a > c ? 0 : c > a ? 1 : -1, text: `Twenty moves each without a capture. You have ${a} pieces, the Scribe ${c}.` };
      }
      return res;
    },
    result(pl) {
      if (this.over) return this.over;
      if (!this.placing() && !this.legal(pl).length) { // boxed in by one's own pieces: the turn passes, and if neither can move it is over
        if (!this.steps(1 - pl).length) { const a = this.count(0), c = this.count(1); return { winner: a > c ? 0 : c > a ? 1 : -1, text: `Neither side can move. You have ${a} pieces, the Scribe ${c}.` }; }
      }
      return null;
    },
    skipTurn(pl) { return !this.over && !this.placing() && !this.legal(pl).length && this.steps(1 - pl).length ? (pl === 0 ? 'You cannot move, so the turn passes.' : 'The Scribe cannot move, so the turn passes.') : ''; },
    snapshot() { return [this.b.slice(), this.placed.slice(), this.pairLeft, this.started, this.chain, this.quiet, this.over, this.lifting, this.moves]; },
    restore(s) { this.b = s[0].slice(); this.placed = s[1].slice(); [, , this.pairLeft, this.started, this.chain, this.quiet, this.over, this.lifting, this.moves] = s; },
    turns(pl) {
      const out = [], walk = (seq) => {
        const ms = seq.length ? null : this.legal(pl);
        for (const m of ms || []) {
          const s = this.snapshot(); const r = this.apply(m);
          if (r.followUp && !this.over) this.extend([m], r.followUp, out); else out.push([m]);
          this.restore(s);
        }
      };
      walk([]);
      return out.sort((a, b) => b.reduce((n, m) => n + (m.cap || 0), 0) - a.reduce((n, m) => n + (m.cap || 0), 0));
    },
    extend(seq, follow, out) {
      for (const f of follow) {
        const s = this.snapshot(); const r = this.apply(f);
        if (r.followUp && !this.over && seq.length < 8) this.extend(seq.concat(f), r.followUp, out); else out.push(seq.concat(f));
        this.restore(s);
      }
    },
    terminal(pl, depth) { const r = this.over; if (!r) return null; return r.winner === -1 ? 0 : r.winner === pl ? 1000 + depth : -1000 - depth; },
    // Material first; then threats, room to move, and pieces that cannot be trapped (a friend or the edge on one side of each line).
    evaluate(pl) {
      const opp = 1 - pl, sp = this.steps(pl), so = this.steps(opp);
      let e = (this.count(pl) - this.count(opp)) * 10;
      e += (sp.filter(m => m.cap).length - so.filter(m => m.cap).length) * 2 + (sp.length - so.length) * 0.25;
      for (let i = 0; i < 25; i++) {
        const v = this.b[i]; if (!v) continue;
        const x = i % 5, y = (i / 5) | 0, side = v === pl + 1 ? 1 : -1;
        const firm = (ax, ay, bx, by) => { const a = ax < 0 || ax > 4 || ay < 0 || ay > 4 ? v : this.b[ay * 5 + ax], c = bx < 0 || bx > 4 || by < 0 || by > 4 ? v : this.b[by * 5 + bx]; return a === v || c === v; };
        if (firm(x - 1, y, x + 1, y) && firm(x, y - 1, x, y + 1)) e += 0.8 * side;
      }
      return e;
    },
    // Placing: build solid blocks, which cannot be trapped, and keep away from the centre's neighbours.
    placeScore(pl, i) {
      const x = i % 5, y = (i / 5) | 0; let s = 0;
      for (const [dx, dy] of SG_D4) { const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= 5 || ny < 0 || ny >= 5) { s += 0.6; continue; } const v = this.b[ny * 5 + nx]; if (v === pl + 1) s += 1; else if (v) s -= 0.4; }
      if (Math.abs(x - 2) + Math.abs(y - 2) === 1) s -= 0.8;
      return s;
    },
    aiPlan(pl, depth) {
      if (this.placing()) {
        const noise = pick(4, 0.8, 0.2), plan = [], s = this.snapshot();
        for (let k = 0; k < 2 && this.placing(); k++) {
          let best = null, bv = -Infinity;
          for (const m of this.legal(pl)) { const v = this.placeScore(pl, m.place) + Math.random() * noise; if (v > bv) { bv = v; best = m; } }
          plan.push(best); const r = this.apply(best); if (!r.followUp) break;
        }
        this.restore(s);
        return plan;
      }
      return bestPlan(this, pl, depth, 6);
    },
  };

  /* -------------------------------------------------------------------- Tâb
     Lane's Egyptian race-and-capture game: four rows of W squares, a row of
     pieces each, four palm-stick dice. Cells are r * W + c, row 0 the
     visitor's home, row 3 the Scribe's, c from the visitor's left. Each row
     runs one way for both players: rows 0 and 2 to the right, 1 and 3 left. */
  const TB_DIR = [1, -1, 1, -1];
  const TB_P = { 1: 4 / 16, 2: 6 / 16, 3: 4 / 16, 4: 1 / 16, 6: 1 / 16 }; // chances of each throw
  const TAB = {
    id: 'tab', name: 'Tâb', dice: true, first: 0, W: 9, extraNote: 'A tâb, a 4 or a 6: throw again.',
    rules: [
      'You have a row of nine dark stones nearest you; the Scribe has nine pieces of red tile at the far side. Pieces travel through the rows as the arrows show: along your own row, back along the next, out along the third, and then round the two middle rows.',
      'Throw four palm sticks and count the white sides: one white is a tâb (1), two count 2, three count 3, four count 4, and none counts 6. A tâb, a 4 or a 6 earns another throw. Each throw moves one piece.',
      'A piece that has never moved needs a tâb to start, and then moves one square.',
      'Land on an enemy piece to take it. You may not land on your own.',
      'Once in its life a piece may go on into the enemy\'s home row instead of round the middle; it then comes back to the middle rows. A piece in the enemy\'s row cannot move while you still have pieces in your own home row.',
      'Take all the Scribe\'s pieces to win.'
    ],
    source: 'After Edward William Lane, Manners and Customs of the Modern Egyptians (1836). Lane\'s stacking of pieces (\'eggeh) is left out, each throw is moved as it is made, and after 150 throws each the side with more pieces wins: those are our choices.',
    init() {
      const W = this.W; this.pc = [];
      for (let c = 0; c < W; c++) this.pc.push({ pl: 0, cell: c, conv: false, entered: false, back: false, alive: true });
      for (let c = 0; c < W; c++) this.pc.push({ pl: 1, cell: 3 * W + c, conv: false, entered: false, back: false, alive: true });
      this.at = new Int16Array(4 * W).fill(-1); this.pc.forEach((p, k) => { this.at[p.cell] = k; });
      this.throws = 0; this.over = null;
    },
    home(pl) { return pl === 0 ? 0 : 3; },
    count(pl) { return this.pc.filter(p => p.alive && p.pl === pl).length; },
    atHome(pl) { const h = this.home(pl), W = this.W; return this.pc.some(p => p.alive && p.pl === pl && ((p.cell / W) | 0) === h); },
    roll() { const f = [0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0)); const n = f.reduce((a, b) => a + b, 0); return { faces: f, value: n || 6 }; },
    rollName(r) { return r.value === 1 ? 'a tâb (1)' : String(r.value); },
    // Every square a piece could reach in exactly v steps, with the path, and whether it ends having entered the enemy row.
    walk(p, v) {
      const W = this.W, pl = p.pl, h = this.home(pl), a = pl ? 2 : 1, b = pl ? 1 : 2, e = pl ? 0 : 3, out = [];
      const go = (cell, left, entered, path) => {
        if (!left) { out.push({ cell, entered, path }); return; }
        const r = (cell / W) | 0, c = cell % W, nc = c + TB_DIR[r];
        if (nc >= 0 && nc < W) return go(r * W + nc, left - 1, entered, path.concat(r * W + nc));
        const next = r === h ? [a] : r === a ? [b] : r === e ? [b] : entered ? [a] : [e, a];
        for (const nr of next) go(nr * W + c, left - 1, entered || nr === e, path.concat(nr * W + c));
      };
      go(p.cell, v, p.entered, []);
      return out;
    },
    legal(pl, value) {
      if (this.over) return [];
      const W = this.W, out = [], homeLeft = this.atHome(pl);
      this.pc.forEach((p, k) => {
        if (!p.alive || p.pl !== pl) return;
        if (!p.conv && value !== 1) return;
        const r = (p.cell / W) | 0;
        if (r === (pl ? 0 : 3) && homeLeft) return; // stuck in the enemy row while pieces remain at home
        for (const d of this.walk(p, value)) {
          const o = this.at[d.cell];
          if (o >= 0 && this.pc[o].pl === pl) continue;
          out.push({ pl, piece: k, from: p.cell, to: d.cell, path: d.path, entered: d.entered, cap: o >= 0 ? 1 : 0, start: !p.conv });
        }
      });
      return out;
    },
    steps(m) { return m.path; },
    apply(m) {
      const p = this.pc[m.piece], W = this.W, me = m.pl === 0, res = { note: '' };
      this.throws++;
      const o = this.at[m.to];
      if (o >= 0) { this.pc[o].alive = false; res.taken = o; res.caps = [m.to]; res.note = me ? 'You take a Scribe\'s piece.' : 'The Scribe takes one of your pieces.'; }
      this.at[m.from] = -1; this.at[m.to] = m.piece; p.cell = m.to; p.entered = m.entered;
      if (!p.conv) { p.conv = true; if (!res.note) res.note = me ? 'A tâb: your piece sets out.' : ''; }
      const r = (m.to / W) | 0;
      if (r === (m.pl ? 0 : 3) && !res.note) res.note = me ? 'You enter the Scribe\'s home row.' : 'The Scribe enters your home row.';
      if (!this.count(1 - m.pl)) this.over = { winner: m.pl, text: me ? 'You have taken every one of the Scribe\'s pieces.' : 'The Scribe has taken every one of your pieces.' };
      else if (this.throws >= 300) { const a = this.count(0), c = this.count(1); this.over = { winner: a > c ? 0 : c > a ? 1 : -1, text: `After 150 throws each you have ${a} pieces and the Scribe ${c}.` }; }
      return res;
    },
    extra(m, value) { return !this.over && (value === 1 || value === 4 || value === 6); },
    done() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over; },
    // The chance an enemy piece can land on a square with its next throw.
    danger(pl, cell) {
      let p = 0; const opp = 1 - pl, homeLeft = this.atHome(opp), W = this.W;
      for (const v of [1, 2, 3, 4, 6]) {
        let hit = false;
        for (const q of this.pc) {
          if (!q.alive || q.pl !== opp || (!q.conv && v !== 1)) continue;
          if (((q.cell / W) | 0) === (opp ? 0 : 3) && homeLeft) continue;
          if (this.walk(q, v).some(d => d.cell === cell)) { hit = true; break; }
        }
        if (hit) p += TB_P[v];
      }
      return p;
    },
    // Sharp looks at the whole board after a move: what each side can hit with its next throw.
    exposure(pl) {
      let lose = 0, gain = 0;
      for (const q of this.pc) {
        if (!q.alive) continue;
        const d = this.danger(q.pl, q.cell), w = 1 + (q.conv ? 0 : 0.3); // a piece that has not set out cannot run
        if (q.pl === pl) lose += d * w; else gain += d * w;
      }
      return gain * 4 - lose * 9;
    },
    aiPlan(pl, moves) {
      if (!moves.length) return [];
      const lvl = LEVEL.name, W = this.W;
      if (lvl === 'gentle' && Math.random() < 0.4) return [moves[(Math.random() * moves.length) | 0]];
      let best = moves[0], bv = -Infinity;
      for (const m of moves) {
        const p = this.pc[m.piece];
        let v = m.cap ? 10 + (this.pc[this.at[m.to]].conv ? 0 : 2) : 0;
        if (m.start) v += 3;
        if (m.entered && !p.entered) v += 2.5; // a raid on the enemy's home row
        const r = (m.to / W) | 0; if (r === (pl ? 0 : 3)) v += 1;
        if (lvl !== 'gentle') {
          const save = this.at[m.to]; this.at[m.from] = -1; this.at[m.to] = m.piece; const was = p.cell, conv = p.conv, ent = p.entered;
          if (save >= 0) this.pc[save].alive = false;
          p.cell = m.to; p.conv = true; p.entered = m.entered;
          if (lvl === 'sharp') v += this.exposure(pl);
          else { v -= this.danger(pl, m.to) * 6; p.cell = was; v += this.danger(pl, was) * 3; } // moving out of danger
          if (save >= 0) this.pc[save].alive = true;
          p.cell = was; p.conv = conv; p.entered = ent; this.at[m.to] = save; this.at[m.from] = m.piece;
        }
        v += Math.random() * pick(3, 0.5, 0.1);
        if (v > bv) { bv = v; best = m; }
      }
      return [best];
    },
    snapshot() { return [this.pc.map(p => Object.assign({}, p)), this.at.slice(), this.throws, this.over]; },
    restore(s) { this.pc = s[0].map(p => Object.assign({}, p)); this.at = s[1].slice(); this.throws = s[2]; this.over = s[3]; },
  };

  /* -------------------------------------------------------------- Bagh-chal
     Nepal's tiger game on the 5 x 5 alquerque board (cells r * 5 + c): four
     tigers against twenty goats. The visitor picks a side. */
  const BC_GOAT = 1, BC_TIGER = 2, BC_GOATS = 20, BC_WIN = 5, BC_CAP = 200;
  const BAGHCHAL = {
    id: 'baghchal', name: 'Bagh-chal', dice: false, ADJ: AQ_ADJ,
    variants: [{ id: 'goats', label: 'You lead the goats' }, { id: 'tigers', label: 'You lead the tigers' }], variant: 'goats', variantLabel: 'Side',
    setVariant(id) { this.variant = id; this.goatPl = id === 'goats' ? 0 : 1; },
    goatPl: 0,
    get first() { return this.goatPl; },
    get rules() {
      return [
        `${this.goatPl === 0 ? 'You lead the twenty goats and the Scribe the four tigers' : 'You lead the four tigers and the Scribe the twenty goats'}. You can swap sides above. The tigers start on the four corners; the goats start off the board, and move first.`,
        'Pieces move along a line to the next empty point. Diagonal lines run only through some points.',
        'While goats remain off the board, each goat turn places one on any empty point; goats may not move until all twenty are down. Tigers move from the start.',
        'A tiger captures by jumping along a line over a goat next to it, to the empty point beyond. Capturing is never compulsory, and only one goat is taken a turn. Goats never capture.',
        'The tigers win by taking five goats. The goats win by leaving no tiger a move.',
        'Once all goats are placed, no move may bring back a position seen before. A side with no move loses; after 100 moves each with no result, the game is drawn.'
      ];
    },
    source: 'Traditional rules of Nepal, as commonly played today. The 100-move draw is our house rule.',
    init() {
      this.b = new Int8Array(25); for (const i of [0, 4, 20, 24]) this.b[i] = BC_TIGER;
      this.inHand = BC_GOATS; this.taken = 0; this.plies = 0; this.hist = []; this.seen = new Set(); this.over = null;
    },
    side(pl) { return pl === this.goatPl ? BC_GOAT : BC_TIGER; },
    key() { return this.b.join(''); },
    jumps(i) { // a tiger's captures from i
      const out = [], r = (i / 5) | 0, c = i % 5;
      for (const [dr, dc] of AQ_ADJ[i]) {
        const m = (r + dr) * 5 + c + dc;
        if (this.b[m] !== BC_GOAT || !AQ_ADJ[m].some(([a, b]) => a === dr && b === dc)) continue;
        const t = (r + 2 * dr) * 5 + c + 2 * dc;
        if (!this.b[t]) out.push({ over: m, to: t });
      }
      return out;
    },
    pseudo(pl) {
      const s = this.side(pl), out = [];
      if (s === BC_GOAT && this.inHand) { for (let i = 0; i < 25; i++) if (!this.b[i]) out.push({ pl, place: i }); return out; }
      for (let i = 0; i < 25; i++) {
        if (this.b[i] !== s) continue;
        const r = (i / 5) | 0, c = i % 5;
        for (const [dr, dc] of AQ_ADJ[i]) { const j = (r + dr) * 5 + c + dc; if (!this.b[j]) out.push({ pl, from: i, to: j }); }
        if (s === BC_TIGER) for (const j of this.jumps(i)) out.push({ pl, from: i, to: j.to, over: j.over, cap: 1 });
      }
      return out;
    },
    legal(pl) {
      if (this.over) return [];
      const ms = this.pseudo(pl);
      if (this.inHand) return ms;
      return ms.filter(m => { // no position may come back once all goats are down
        const v = this.b[m.from]; this.b[m.from] = 0; this.b[m.to] = v; if (m.over !== undefined) this.b[m.over] = 0;
        const ok = !this.seen.has(this.key());
        this.b[m.to] = 0; this.b[m.from] = v; if (m.over !== undefined) this.b[m.over] = BC_GOAT;
        return ok;
      });
    },
    apply(m) {
      const me = m.pl === 0, tigers = this.side(m.pl) === BC_TIGER, res = { note: '' };
      this.plies++;
      if (m.place !== undefined) { this.b[m.place] = BC_GOAT; this.inHand--; }
      else {
        this.b[m.to] = this.b[m.from]; this.b[m.from] = 0;
        if (m.over !== undefined) {
          this.b[m.over] = 0; this.taken++; res.caps = [m.over];
          res.note = me ? `Your tiger takes a goat (${this.taken} of ${BC_WIN}).` : `A tiger takes one of your goats (${this.taken} of ${BC_WIN}).`;
        }
      }
      if (!this.inHand) { const k = this.key(); this.hist.push(k); this.seen.add(k); }
      if (m.place !== undefined && !this.inHand) res.note = 'All twenty goats are on the board. From now on goats move too.';
      if (this.taken >= BC_WIN) this.over = { winner: tigers ? m.pl : 1 - m.pl, text: tigers ? (me ? 'Your tigers have taken five goats.' : 'The tigers have taken five of your goats.') : '' };
      return res;
    },
    result(pl) {
      if (this.over) return this.over;
      if (!this.legal(pl).length) {
        const tig = this.side(pl) === BC_TIGER;
        return { winner: 1 - pl, text: tig ? (pl === 0 ? 'The goats have hemmed in all your tigers.' : 'Your goats have hemmed in every tiger.') : (pl === 0 ? 'Your goats have no move left.' : 'The goats have no move left.') };
      }
      if (this.plies >= BC_CAP + BC_GOATS) return { winner: -1, text: 'A hundred moves each with no result. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.inHand, this.taken, this.plies, this.hist.length, this.over]; },
    restore(s) {
      this.b = s[0].slice(); [, this.inHand, this.taken, this.plies] = s; this.over = s[5];
      while (this.hist.length > s[4]) this.seen.delete(this.hist.pop());
    },
    turns(pl) { return this.legal(pl).sort((a, b) => (b.cap || 0) - (a.cap || 0)).map(m => [m]); },
    terminal(pl, depth) {
      if (this.over) return this.over.winner === pl ? 1000 + depth : -1000 - depth;
      if (this.plies >= BC_CAP + BC_GOATS) return 0;
      return null;
    },
    // Scored for the tigers: goats taken, goats open to capture, and room to move.
    tigerScore() {
      let open = 0, mob = 0, stuck = 0;
      for (let i = 0; i < 25; i++) {
        if (this.b[i] !== BC_TIGER) continue;
        const r = (i / 5) | 0, c = i % 5; let n = 0;
        for (const [dr, dc] of AQ_ADJ[i]) if (!this.b[(r + dr) * 5 + c + dc]) n++;
        const j = this.jumps(i).length; open += j; n += j;
        mob += n; if (!n) stuck++;
      }
      const all = stuck === 4 ? -500 : 0;
      return this.taken * 40 + open * 9 + mob * 1.2 - stuck * 14 + all;
    },
    evaluate(pl) { const t = this.tigerScore(); return this.side(pl) === BC_TIGER ? t : -t; },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 6); },
  };

  /* ------------------------------------------------------ Four Seasons chess
     Alfonso X's acedrex de los quatro tiempos (1283): four armies in the four
     corners of an 8 x 8 board. Cells are y * 8 + x, x the file from the
     visitor's left (a), y the rank away from the visitor (1). A cell holds 0 or
     owner << 5 | pawn direction << 3 | type. The visitor is Red, in a1. */
  const FS_K = 1, FS_R = 2, FS_N = 3, FS_B = 4, FS_P = 5, FS_G = 6;
  const FS_VAL = [0, 0, 5, 3, 1.5, 1, 2];
  const FS_NAME = ['', 'king', 'rook', 'knight', 'alfil', 'pawn', 'general'];
  const FS_SEAT = ['Red', 'Black', 'White', 'Green'];
  const FS_SEASON = ['summer', 'autumn', 'winter', 'spring'];
  const FS_DIR = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // up, right, down, left
  // [x, y, type, pawn direction] for each army: Red a1, Black h1, White h8, Green a8
  const FS_SETUP = [
    [[0, 0, FS_K], [1, 0, FS_R], [0, 1, FS_N], [1, 1, FS_B], [0, 2, FS_P, 0], [1, 2, FS_P, 0], [2, 0, FS_P, 1], [2, 1, FS_P, 1]],
    [[7, 0, FS_K], [6, 0, FS_R], [7, 1, FS_N], [6, 1, FS_B], [6, 2, FS_P, 0], [7, 2, FS_P, 0], [5, 0, FS_P, 3], [5, 1, FS_P, 3]],
    [[7, 7, FS_K], [6, 7, FS_R], [7, 6, FS_N], [6, 6, FS_B], [7, 5, FS_P, 2], [6, 5, FS_P, 2], [5, 7, FS_P, 3], [5, 6, FS_P, 3]],
    [[0, 7, FS_K], [1, 7, FS_R], [0, 6, FS_N], [1, 6, FS_B], [0, 5, FS_P, 2], [1, 5, FS_P, 2], [2, 7, FS_P, 1], [2, 6, FS_P, 1]],
  ];
  const FS_ROUNDS = 60;
  const fsIn = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;
  const FS_KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const FS_K8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const FS_DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const FS_ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const FOURSEASONS = {
    id: 'fourseasons', name: 'Four Seasons Chess', dice: false, SEATS: FS_SEAT, ROUNDS: FS_ROUNDS, NAME: FS_NAME,
    get first() { return this.seat === 0 ? 0 : 1; },
    rules: [
      'Four armies, one in each corner, each for itself. You are Red, summer, in the corner nearest your left hand. Green (spring) moves first, then play goes round: you, Black (autumn), White (winter).',
      'The king, rook and knight move as in chess. The alfil jumps exactly two squares diagonally, over anything between. Pawns step one square straight ahead, never two, and take one square diagonally ahead; two of your pawns march up the board and two across it.',
      'A pawn that reaches the edge of the board becomes a general, which moves one square diagonally.',
      'You may not leave your king in check from any army.',
      'A player who is checkmated is out: the king is removed and the whole army passes to the player who gave the mate. A player left with no move but not in check is stalemated: the whole army is removed. Taking a king counts as a mate.',
      'The last player left wins. If you are mated or stalemated you lose. After 60 rounds, the strongest army still in play wins (rook 5, knight 3, general 2, alfil 1½, pawn 1).'
    ],
    source: 'After the Libro de los juegos of Alfonso X (1283), as described by H. J. R. Murray and Hans Bodlaender. The game is played without dice, the diagonals in the centre of the board are decoration, and the 60-round limit is ours.',
    init() {
      this.b = new Int16Array(64);
      FS_SETUP.forEach((army, s) => army.forEach(([x, y, t, d]) => { this.b[y * 8 + x] = (s << 5) | ((d || 0) << 3) | t; }));
      this.alive = [true, true, true, true]; this.seat = 3; this.round = 1; this.over = null; this.news = '';
    },
    own(v) { return v >> 5; }, type(v) { return v & 7; }, dir(v) { return (v >> 3) & 3; },
    kingOf(s) { for (let i = 0; i < 64; i++) { const v = this.b[i]; if (v && (v >> 5) === s && (v & 7) === FS_K) return i; } return -1; },
    // Squares a piece attacks or moves to. Pawns: 'cap' squares only when capture is true.
    pmoves(i, out, attacksOnly) {
      const v = this.b[i], s = v >> 5, t = v & 7, x = i & 7, y = i >> 3;
      const add = (nx, ny, mode) => { // mode: 0 move or take, 1 move only, 2 take only
        if (!fsIn(nx, ny)) return; const j = ny * 8 + nx, w = this.b[j];
        if (attacksOnly) { if (mode !== 1) out.push(j); return; }
        if (w && (w >> 5) === s) return;
        if (mode === 1 && w) return; if (mode === 2 && !w) return;
        out.push(j);
      };
      if (t === FS_K) for (const [dx, dy] of FS_K8) add(x + dx, y + dy, 0);
      else if (t === FS_N) for (const [dx, dy] of FS_KN) add(x + dx, y + dy, 0);
      else if (t === FS_B) for (const [dx, dy] of FS_DIAG) add(x + 2 * dx, y + 2 * dy, 0);
      else if (t === FS_G) for (const [dx, dy] of FS_DIAG) add(x + dx, y + dy, 0);
      else if (t === FS_R) for (const [dx, dy] of FS_ORTH) {
        let nx = x + dx, ny = y + dy;
        while (fsIn(nx, ny)) { const w = this.b[ny * 8 + nx]; add(nx, ny, 0); if (w) break; nx += dx; ny += dy; }
      } else if (t === FS_P) {
        const [dx, dy] = FS_DIR[(v >> 3) & 3];
        add(x + dx, y + dy, 1);
        if (dx) { add(x + dx, y + 1, 2); add(x + dx, y - 1, 2); } else { add(x + 1, y + dy, 2); add(x - 1, y + dy, 2); }
      }
    },
    attackedBy(i, s) { // seats (other than s, still in play) attacking square i
      const who = new Set(), sq = [];
      for (let j = 0; j < 64; j++) {
        const v = this.b[j]; if (!v) continue; const o = v >> 5;
        if (o === s || !this.alive[o] || who.has(o)) continue;
        sq.length = 0; this.pmoves(j, sq, true);
        if (sq.includes(i)) who.add(o);
      }
      return who;
    },
    inCheck(s) { const k = this.kingOf(s); return k >= 0 && this.attackedBy(k, s).size > 0; },
    raw(s) {
      const out = [];
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v || (v >> 5) !== s) continue;
        const t = []; this.pmoves(i, t, false);
        for (const j of t) out.push({ seat: s, from: i, to: j, cap: this.b[j] || 0 });
      }
      return out;
    },
    movesOf(s) {
      return this.raw(s).filter(m => {
        const v = this.b[m.from], w = this.b[m.to];
        this.b[m.to] = v; this.b[m.from] = 0;
        const ok = !this.inCheck(s);
        this.b[m.from] = v; this.b[m.to] = w;
        return ok;
      });
    },
    legal(pl) { if (this.over) return []; const s = pl === 0 ? 0 : this.seat; return this.movesOf(s).map(m => Object.assign(m, { pl })); },
    who(s) { return s === 0 ? 'You' : FS_SEAT[s]; },
    whose(s) { return s === 0 ? 'your' : FS_SEAT[s] + '\'s'; },
    // Hand an army to the player who beat it (its king gone), or clear it from the board.
    fall(s, to, words) {
      this.alive[s] = false;
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v || (v >> 5) !== s) continue;
        if (to < 0 || (v & 7) === FS_K) this.b[i] = 0; else this.b[i] = (to << 5) | (v & 31);
      }
      return words;
    },
    settle(mover, notes, events) {
      for (let pass = 0; pass < 4; pass++) {
        let changed = false;
        for (const s of [1, 2, 3, 0].map(k => (mover + k) % 4)) {
          if (!this.alive[s] || s === mover) continue;
          if (this.kingOf(s) < 0) continue;
          if (this.movesOf(s).length) continue;
          const att = this.attackedBy(this.kingOf(s), s);
          if (att.size) {
            const by = att.has(mover) ? mover : [...att][0];
            this.fall(s, by); events.push({ seat: s, to: by });
            notes.push(s === 0 ? `${FS_SEAT[by]} checkmates you.` : `${by === 0 ? 'You checkmate' : FS_SEAT[by] + ' checkmates'} ${FS_SEAT[s]}, and ${by === 0 ? 'take' : 'takes'} over ${FS_SEAT[s] === 'White' ? 'the white' : 'the ' + FS_SEAT[s].toLowerCase()} army.`);
          } else {
            this.fall(s, -1); events.push({ seat: s, to: -1 });
            notes.push(s === 0 ? 'You are stalemated, and your army leaves the board.' : `${FS_SEAT[s]} is stalemated, and that army leaves the board.`);
          }
          changed = true;
        }
        if (!changed) break;
      }
    },
    apply(m) {
      const s = m.seat, me = s === 0, notes = [], events = [];
      if (this.news) { notes.push(this.news); this.news = ''; }
      const v = this.b[m.from], w = this.b[m.to];
      this.b[m.to] = v; this.b[m.from] = 0;
      let promo = false;
      if ((v & 7) === FS_P) {
        const [dx, dy] = FS_DIR[(v >> 3) & 3], x = m.to & 7, y = m.to >> 3;
        if (!fsIn(x + dx, y + dy)) { this.b[m.to] = (v & ~7) | FS_G; promo = true; }
      }
      if (w) {
        const o = w >> 5, t = w & 7;
        if (t === FS_K && this.alive[o]) {
          this.fall(o, s); events.push({ seat: o, to: s });
          notes.push(o === 0 ? `${FS_SEAT[s]} takes your king.` : `${this.who(s)} ${me ? 'take' : 'takes'} ${FS_SEAT[o]}'s king and the ${FS_SEAT[o].toLowerCase()} army with it.`);
        } else notes.push(`${this.who(s)} ${me ? 'take' : 'takes'} ${o === 0 ? 'your' : FS_SEAT[o] + '\'s'} ${FS_NAME[t]}.`);
      }
      if (promo) notes.push(`${me ? 'Your' : FS_SEAT[s] + '\'s'} pawn becomes a general.`);
      this.settle(s, notes, events);
      const checks = [0, 1, 2, 3].filter(o => o !== s && this.alive[o] && this.kingOf(o) >= 0 && this.attackedBy(this.kingOf(o), o).has(s));
      if (checks.length) notes.push(checks.includes(0) ? `${FS_SEAT[s]} gives you check.` : `Check to ${checks.map(o => FS_SEAT[o]).join(' and ')}.`);
      this.check();
      return { note: notes.join(' '), caps: w ? [m.to] : [], captured: w ? m.to : -1, promo, events };
    },
    check() {
      if (this.over) return;
      const live = [0, 1, 2, 3].filter(s => this.alive[s]);
      if (!this.alive[0]) this.over = { winner: 1, title: 'Your army is lost', text: 'You are out of the game.' };
      else if (live.length === 1) this.over = { winner: 0, title: 'You win', text: 'Yours is the last army standing: all four seasons are yours.' };
    },
    material(s) { let n = 0; for (let i = 0; i < 64; i++) { const v = this.b[i]; if (v && (v >> 5) === s) n += FS_VAL[v & 7]; } return n; },
    passTurn() {
      if (this.over) return 0;
      let s = this.seat;
      do { s = (s + 1) % 4; if (s === 3) this.round++; } while (!this.alive[s]);
      this.seat = s;
      if (this.round > FS_ROUNDS) this.limit();
      return s === 0 ? 0 : 1;
    },
    limit() {
      const live = [0, 1, 2, 3].filter(s => this.alive[s]), m = live.map(s => this.material(s)), top = Math.max(...m);
      const best = live.filter((s, k) => m[k] === top), line = `After ${FS_ROUNDS} rounds: ${live.map((s, k) => `${s ? FS_SEAT[s] : 'you'} ${m[k]}`).join(', ')}.`;
      if (best.length === 1 && best[0] === 0) this.over = { winner: 0, title: 'You win on strength', text: line };
      else if (best.includes(0)) this.over = { winner: -1, title: 'A tie on strength', text: line };
      else this.over = { winner: 1, title: `${best.map(s => FS_SEAT[s]).join(' and ')} ${best.length > 1 ? 'win' : 'wins'} on strength`, text: line };
    },
    ended() { return !!this.over; },
    final() { return this.over; },
    result(pl) {
      if (this.over) return this.over;
      if (pl === 0 && !this.movesOf(0).length) { this.fall(0, -1); this.check(); return this.over; }
      return null;
    },
    get scribeName() { return FS_SEAT[this.seat]; },
    snapshot() { return [this.b.slice(), this.alive.slice(), this.over, this.news]; },
    restore(s) { this.b = s[0].slice(); this.alive = s[1].slice(); this.over = s[2]; this.news = s[3]; },
    // How a seat stands: its own strength, rivals' strength, pieces left hanging, and the safety of its king.
    evaluate(s) {
      if (!this.alive[s]) return -1000;
      let e = this.material(s) * 1.0 + [0, 1, 2, 3].filter(o => o !== s && !this.alive[o]).length * 6;
      for (let o = 0; o < 4; o++) if (o !== s && this.alive[o]) e -= this.material(o) * 0.2;
      const sharp = LEVEL.name === 'sharp';
      // Which squares each seat attacks
      const att = [new Set(), new Set(), new Set(), new Set()], low = new Map();
      for (let j = 0; j < 64; j++) {
        const v = this.b[j]; if (!v) continue; const o = v >> 5; if (!this.alive[o]) continue;
        const sq = []; this.pmoves(j, sq, true);
        for (const q of sq) { att[o].add(q); if (o !== s) { const cur = low.get(q); if (cur === undefined || FS_VAL[v & 7] < cur) low.set(q, FS_VAL[v & 7]); } }
      }
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v || (v >> 5) !== s) continue; const t = v & 7;
        let hit = false; for (let o = 0; o < 4; o++) if (o !== s && this.alive[o] && att[o].has(i)) hit = true;
        if (t === FS_K) { if (hit) e -= 1.5; const x = i & 7, y = i >> 3; for (const [dx, dy] of FS_K8) if (fsIn(x + dx, y + dy)) { for (let o = 0; o < 4; o++) if (o !== s && att[o].has((y + dy) * 8 + x + dx)) e -= 0.15; } continue; }
        if (hit) {
          const defended = att[s].has(i);
          const loss = defended ? Math.max(0, FS_VAL[t] - (low.get(i) || 0)) : FS_VAL[t];
          e -= loss * (sharp ? 0.9 : 0.7);
        }
        if (t === FS_P) { const x = i & 7, y = i >> 3, d = (v >> 3) & 3; e += 0.05 * [y, x, 7 - y, 7 - x][d]; }
      }
      return e;
    },
    aiPlan() {
      const s = this.seat, root = this.snapshot(), lvl = LEVEL.name, noise = pick(2.5, 0.35, 0.05);
      const moves = this.movesOf(s).map(m => Object.assign(m, { pl: 1 }));
      if (!moves.length) return [];
      if (lvl === 'gentle' && Math.random() < 0.3) return [moves[(Math.random() * moves.length) | 0]];
      const scored = moves.map(m => { this.apply(m); const v = this.over && this.over.winner === 1 && !this.alive[0] ? 500 : this.evaluate(s); this.restore(root); return { m, v: v + Math.random() * noise }; });
      scored.sort((a, b) => b.v - a.v);
      if (lvl !== 'sharp') return [scored[0].m];
      // Sharp: for its best few, let the next player answer with its own best move, and judge again.
      let best = scored[0].m, bv = -Infinity;
      for (const c of scored.slice(0, 8)) {
        this.apply(c.m); const mid = this.snapshot();
        let nxt = s; do { nxt = (nxt + 1) % 4; } while (!this.alive[nxt] && nxt !== s);
        let worst = this.evaluate(s);
        if (!this.over && nxt !== s) {
          let rv = -Infinity, reply = null;
          for (const r of this.movesOf(nxt)) { this.apply(r); const v = this.evaluate(nxt); this.restore(mid); if (v > rv) { rv = v; reply = r; } }
          if (reply) { this.apply(reply); worst = this.evaluate(s); this.restore(mid); }
        }
        this.restore(root);
        if (worst + c.v * 0.15 > bv) { bv = worst + c.v * 0.15; best = c.m; }
      }
      return [best];
    },
  };

  /* ------------------------------------------------------ Hounds and Jackals
     Howard Carter's reconstruction (1912) on the 58-hole board: each side
     races five pins up its own track of 29 holes to the goal. Positions are
     0 (not yet on the board) to 29 (the goal). */
  const HJ_GOAL = 29, HJ_BACK = { 20: 6, 10: 8 }, HJ_AGAIN = [15, 25];
  const HOUNDS = {
    id: 'hounds', name: 'Hounds and Jackals', dice: true, first: 0, N: 5, sides: ['hounds', 'jackals'], extraNote: '',
    rules: [
      'This is a modern reconstruction. No ancient rules survive; the table follows the route Howard Carter proposed in 1912, when he found the set.',
      'You have five hounds on the left track, the Scribe five jackals on the right. Each side races up its own 29 holes to the goal at the top.',
      'Throw four sticks and count the white sides; no white side counts 5. Move one pin that many holes, entering at the bottom. Only one pin fits a hole, except the goal, and you must reach the goal exactly.',
      'Lines join hole 6 with 20 and 8 with 10. Land on 20 and you slide back to 6; land on 10 and you slide back to 8.',
      'Holes 15 and 25 are marked "good": landing there earns another throw.',
      'Bring all five pins to the goal first to win.'
    ],
    source: 'A modern reconstruction after Howard Carter (Carnarvon and Carter, Five Years\' Explorations at Thebes, 1912), as described in "Hounds and Jackals in Modern Times" (ISAW Papers 22.4). The stick dice are our choice; Carter thought of dice or knucklebones.',
    init() { this.pos = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]; this.over = null; },
    roll() { const f = [0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0)); const n = f.reduce((a, b) => a + b, 0); return { faces: f, value: n || 5 }; },
    home(pl) { return this.pos[pl].filter(p => p === HJ_GOAL).length; },
    land(pl, to) { const b = HJ_BACK[to]; return b !== undefined && !this.pos[pl].includes(b) ? b : to; },
    legal(pl, value) {
      if (this.over) return [];
      const out = [], seen = new Set();
      this.pos[pl].forEach((p, k) => {
        if (p === HJ_GOAL || seen.has(p)) return; // pins waiting off the board are all alike
        const to = p + value;
        if (to > HJ_GOAL || (to < HJ_GOAL && this.pos[pl].includes(to))) return;
        seen.add(p);
        out.push({ pl, k, from: p, to, end: to === HJ_GOAL ? to : this.land(pl, to) });
      });
      return out;
    },
    steps(m) { const s = []; for (let h = m.from + 1; h <= m.to; h++) s.push(h); if (m.end !== m.to) s.push(m.end); return s; },
    apply(m) {
      const me = m.pl === 0, res = { note: '' };
      this.pos[m.pl][m.k] = m.end;
      if (m.end !== m.to) res.note = `${me ? 'Your' : 'The Scribe\'s'} pin lands on ${m.to} and slides back down the line to ${m.end}.`;
      else if (HJ_AGAIN.includes(m.end)) res.note = `${me ? 'You land' : 'The Scribe lands'} on a "good" hole and ${me ? 'throw' : 'throws'} again.`;
      else if (m.end === HJ_GOAL) res.note = `${me ? 'Your pin reaches' : 'A jackal reaches'} the goal (${this.home(m.pl)} of 5 home).`;
      if (this.home(m.pl) === this.N) this.over = { winner: m.pl, text: me ? 'All five of your hounds are home.' : 'All five jackals reached the goal first.' };
      return res;
    },
    extra(m) { return !!m && !this.over && m.end === m.to && HJ_AGAIN.includes(m.end); },
    done() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over; },
    aiPlan(pl, moves) {
      if (!moves.length) return [];
      if (LEVEL.name === 'gentle' && Math.random() < 0.5) return [moves[(Math.random() * moves.length) | 0]];
      let best = moves[0], bv = -Infinity;
      for (const m of moves) {
        let v = m.end - m.from;
        if (m.end === HJ_GOAL) v += 6;
        if (HJ_AGAIN.includes(m.end) && m.end === m.to) v += 5;
        if (LEVEL.name === 'sharp') { // look one throw ahead: how much the best move after this one is worth, on average
          const save = this.pos[pl][m.k]; this.pos[pl][m.k] = m.end;
          let ev = 0;
          for (const [t, p] of [[1, 4 / 16], [2, 6 / 16], [3, 4 / 16], [4, 1 / 16], [5, 1 / 16]]) {
            let b2 = 0;
            for (const n of this.legal(pl, t)) b2 = Math.max(b2, n.end - n.from + (n.end === HJ_GOAL ? 6 : 0) + (HJ_AGAIN.includes(n.end) && n.end === n.to ? 5 : 0));
            ev += p * b2;
          }
          this.pos[pl][m.k] = save;
          v += 0.8 * ev;
        }
        v += Math.random() * pick(2, 0.3, 0.05);
        if (v > bv) { bv = v; best = m; }
      }
      return [best];
    },
  };

  /* -------------------------------------------------------- Ludus latrunculorum
     Locus Ludi's "Piso" reconstruction: an 8 x 8 board, twenty counters each,
     placed one at a time, then moved one step. Cells are y * 8 + x. */
  const LT_N = 8, LT_PIECES = 20, LT_QUIET = 60;
  const LT_D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const LT_CORNER = { 0: [1, 8], 7: [6, 15], 56: [48, 57], 63: [55, 62] };
  const LATRUNCULI = {
    id: 'latrunculi', name: 'Ludus Latrunculorum', dice: false, first: 0,
    rules: [
      'This is a modern reconstruction. Roman writers describe the board and the trapping of counters, but not the full rules; the table follows the "Piso" rules of the Locus Ludi project at the University of Fribourg.',
      'You have twenty blue glass counters and the Scribe twenty white. Take turns placing them one at a time on any empty square, you first. Nothing is captured while placing.',
      'Then move one counter one square up, down or sideways onto an empty square. A counter may not step straight back to the square it just left.',
      'Trap an enemy counter between the counter you move and another of yours, along a row or column, and it is taken. A counter in a corner is trapped by counters on the two squares beside it. One move can take several. You may move between two enemy counters safely.',
      'The game ends when a player is down to one counter or cannot move. Whoever has taken more counters wins. If 30 moves each go by with no capture, the game ends there.'
    ],
    source: 'A modern reconstruction: the "Piso" rules of Locus Ludi (University of Fribourg), drawn from Varro, Ovid, Martial and the Laus Pisonis, and from boards found across the Roman world. The 30-move limit is ours.',
    init() { this.b = new Int8Array(64); this.placed = [0, 0]; this.last = [null, null]; this.quiet = 0; this.taken = [0, 0]; this.over = null; },
    placing() { return this.placed[0] + this.placed[1] < 2 * LT_PIECES; },
    count(pl) { let n = 0; for (const v of this.b) if (v === pl + 1) n++; return n; },
    caps(pl, from, to) {
      const me = pl + 1, foe = 2 - pl, x = to & 7, y = to >> 3, out = [];
      const mine = j => j !== from && (j === to || this.b[j] === me);
      for (const [dx, dy] of LT_D4) {
        const ax = x + dx, ay = y + dy; if (ax < 0 || ax > 7 || ay < 0 || ay > 7) continue;
        const a = ay * 8 + ax; if (this.b[a] !== foe) continue;
        const corner = LT_CORNER[a];
        if (corner) { if (corner.every(mine)) out.push(a); continue; }
        const bx = x + 2 * dx, by = y + 2 * dy; if (bx < 0 || bx > 7 || by < 0 || by > 7) continue;
        if (mine(by * 8 + bx)) out.push(a);
      }
      return out;
    },
    steps(pl) {
      const out = [], me = pl + 1, back = this.last[pl];
      for (let i = 0; i < 64; i++) {
        if (this.b[i] !== me) continue;
        const x = i & 7, y = i >> 3;
        for (const [dx, dy] of LT_D4) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || nx > 7 || ny < 0 || ny > 7) continue;
          const j = ny * 8 + nx; if (this.b[j]) continue;
          if (back && back[0] === j && back[1] === i) continue; // no stepping straight back
          out.push({ pl, from: i, to: j, cap: this.caps(pl, i, j).length });
        }
      }
      return out;
    },
    legal(pl) {
      if (this.over) return [];
      if (this.placing()) { const out = []; for (let i = 0; i < 64; i++) if (!this.b[i]) out.push({ pl, place: i }); return out; }
      return this.steps(pl);
    },
    apply(m) {
      const pl = m.pl, me = pl === 0, res = { note: '', taken: [] };
      if (m.place !== undefined) {
        this.b[m.place] = pl + 1; this.placed[pl]++;
        if (!this.placing()) res.note = 'Every counter is placed. Now the counters move.';
        return res;
      }
      const t = this.caps(pl, m.from, m.to);
      this.b[m.to] = this.b[m.from]; this.b[m.from] = 0; this.last[pl] = [m.from, m.to];
      for (const j of t) this.b[j] = 0;
      this.taken[pl] += t.length; this.quiet = t.length ? 0 : this.quiet + 1;
      res.taken = t; res.caps = t;
      if (t.length) res.note = `${me ? 'You trap' : 'The Scribe traps'} ${t.length === 1 ? 'a counter' : t.length + ' counters'}.`;
      this.endCheck(1 - pl);
      return res;
    },
    endCheck(next) {
      const a = this.count(0), c = this.count(1), why = a <= 1 || c <= 1 ? 'down' : this.quiet >= LT_QUIET ? 'quiet' : !this.steps(next).length ? 'stuck' : '';
      if (!why) return;
      const t0 = this.taken[0], t1 = this.taken[1];
      const lead = why === 'down' ? (a <= 1 ? 'You are down to one counter.' : 'The Scribe is down to one counter.') : why === 'quiet' ? 'Thirty moves each without a capture.' : next === 0 ? 'You have no move left.' : 'The Scribe has no move left.';
      this.over = { winner: t0 > t1 ? 0 : t1 > t0 ? 1 : -1, text: `${lead} You took ${t0} counters, the Scribe ${t1}.` };
    },
    result() { return this.over; },
    snapshot() { return [this.b.slice(), this.placed.slice(), this.last.map(x => x && x.slice()), this.quiet, this.taken.slice(), this.over]; },
    restore(s) { this.b = s[0].slice(); this.placed = s[1].slice(); this.last = s[2].map(x => x && x.slice()); this.quiet = s[3]; this.taken = s[4].slice(); this.over = s[5]; },
    turns(pl) { return this.legal(pl).sort((a, b) => (b.cap || 0) - (a.cap || 0)).map(m => [m]); },
    terminal(pl, depth) { const r = this.over; if (!r) return null; return r.winner === -1 ? 0 : r.winner === pl ? 1000 + depth : -1000 - depth; },
    evaluate(pl) {
      const opp = 1 - pl, sp = this.steps(pl), so = this.steps(opp);
      let e = (this.taken[pl] - this.taken[opp]) * 10;
      e += (sp.filter(m => m.cap).length - so.filter(m => m.cap).length) * 2 + (sp.length - so.length) * 0.15;
      return e;
    },
    // Placing: keep counters in touch with friends, but in contact with the enemy and near the middle, where the fighting is.
    placeScore(pl, i) {
      const x = i & 7, y = i >> 3; let s = -0.12 * (Math.abs(x - 3.5) + Math.abs(y - 3.5));
      for (const [dx, dy] of LT_D4) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || nx > 7 || ny < 0 || ny > 7) continue;
        const v = this.b[ny * 8 + nx];
        if (v === pl + 1) s += 0.6;
        else if (v) { s += 0.5; const bx = x + 2 * dx, by = y + 2 * dy; if (bx >= 0 && bx < 8 && by >= 0 && by < 8 && !this.b[by * 8 + bx]) s += 0.4; } // an enemy that could be trapped from beyond
      }
      if (LT_CORNER[i]) s -= 1.5;
      return s;
    },
    aiPlan(pl, depth) {
      if (this.placing()) {
        let best = null, bv = -Infinity; const noise = pick(4, 0.8, 0.2);
        for (const m of this.legal(pl)) { const v = this.placeScore(pl, m.place) + Math.random() * noise; if (v > bv) { bv = v; best = m; } }
        return [best];
      }
      return bestPlan(this, pl, depth, 4);
    },
  };

  /* ---------------------------------------------------------------- Patolli
     A common modern reconstruction from Diego Durán's account: 52 houses in
     an X, six markers a side, five beans, and treasures staked. Houses are
     numbered round the circuit from the visitor's start; the Scribe starts
     opposite, at 26. Every 13th house (0, 13, 26, 39) is one of the four
     centre houses; within each arm, houses 6 and 7 are the tips and 4 and 9
     the dark houses. */
  const PT_N = 52, PT_MARKERS = 6, PT_TREASURE = 6, PT_LIMIT = 300;
  const PT_KIND = h => { const a = h % 13; return a === 0 ? 'centre' : a === 6 || a === 7 ? 'tip' : a === 4 || a === 9 ? 'dark' : ''; };
  const PATOLLI = {
    id: 'patolli', name: 'Patolli', dice: true, first: 0, START: [0, 26], KIND: PT_KIND, extraNote: '',
    rules: [
      'This is a modern reconstruction. Spanish writers such as Diego Durán describe the mat, the beans, the six markers and the stakes, but not every rule; the table follows the reconstruction most often given today.',
      'You have six red markers and six treasures; the Scribe has six blue markers and six treasures. Throw five beans and count the marked sides: 1 to 4 move that many houses, all five move 10, and none means you pay a treasure as an offering to the god Macuilxochitl.',
      'A throw of 1 may put a new marker on your starting house, in the centre. Markers run clockwise round all 52 houses and leave the mat on reaching the last house by an exact throw.',
      'A marker may not land on an occupied house, except in the four centre houses: land on an enemy marker there and it goes back to its owner, who pays you a treasure.',
      'Landing on one of the dark houses costs you a treasure, paid to the other player. Landing on a red tip at the end of an arm earns another throw. Each marker that completes the circuit earns a treasure from the other player.',
      'When one player has brought all six markers round, that player also takes the offerings and a last treasure, and whoever holds more treasures wins. A player who cannot pay loses at once.'
    ],
    source: 'A modern reconstruction, following the rules most often given today from Diego Durán\'s 16th-century account and the Aztec codices. Treasure paid for a completed circuit, the 150-throw limit and deciding the game on treasure after one round are our choices.',
    init() { this.pos = [Array(PT_MARKERS).fill(-1), Array(PT_MARKERS).fill(-1)]; this.treasure = [PT_TREASURE, PT_TREASURE]; this.pot = 0; this.throws = 0; this.over = null; },
    roll() { const f = [0, 0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0)); const n = f.reduce((a, b) => a + b, 0); return { faces: f, value: n === 5 ? 10 : n }; },
    rollName(r) { const n = r.faces.reduce((a, b) => a + b, 0); return n === 0 ? 'no marked beans' : n === 5 ? 'all five marked: 10' : `${n}`; },
    house(pl, rel) { return (this.START[pl] + rel) % PT_N; },
    at(h) { for (const pl of [0, 1]) for (let k = 0; k < PT_MARKERS; k++) { const r = this.pos[pl][k]; if (r >= 0 && r < PT_N - 1 && this.house(pl, r) === h) return [pl, k]; } return null; },
    home(pl) { return this.pos[pl].filter(r => r >= PT_N - 1).length; },
    legal(pl, value) {
      if (this.over) return [];
      if (value === 0) return [{ pl, offering: true, label: 'Pay the offering' }];
      const out = []; let entered = false;
      this.pos[pl].forEach((r, k) => {
        let to;
        if (r < 0) { if (value !== 1 || entered) return; to = 0; }
        else if (r >= PT_N - 1) return;
        else { to = r + value; if (to > PT_N - 1) return; }
        const h = this.house(pl, to), o = to === PT_N - 1 ? null : this.at(h);
        if (o && (o[0] === pl || PT_KIND(h) !== 'centre')) return;
        if (r < 0) entered = true;
        out.push({ pl, k, from: r, to, house: h, cap: o ? 1 : 0, enter: r < 0, off: to === PT_N - 1 });
      });
      return out;
    },
    steps(m) { const s = []; for (let r = Math.max(0, m.from + 1); r <= m.to; r++) s.push(this.house(m.pl, r)); if (m.enter) s.splice(0, s.length, this.house(m.pl, 0)); return s; },
    pay(from, to, words) {
      if (this.treasure[from] <= 0) { this.over = { winner: 1 - from, text: from === 0 ? 'You have no treasure left to pay with, and lose the game.' : 'The Scribe has no treasure left to pay with: you win.' }; return false; }
      this.treasure[from]--; if (to === 'pot') this.pot++; else this.treasure[to]++;
      return true;
    },
    apply(m) {
      const pl = m.pl, me = pl === 0, opp = 1 - pl, notes = [], res = { note: '' };
      this.throws++;
      this.again = false;
      if (m.offering) {
        this.pay(pl, 'pot');
        res.note = me ? 'No marked beans: you pay a treasure as an offering.' : 'The Scribe threw no marked beans and pays an offering.';
        return this.finishCheck(res);
      }
      if (m.cap) {
        const o = this.at(m.house); this.pos[o[0]][o[1]] = -1;
        notes.push(me ? 'You land on the Scribe\'s marker in the centre and send it back.' : 'The Scribe sends your marker back from the centre.');
        if (!this.pay(opp, pl)) return this.finishCheck(Object.assign(res, { note: notes.join(' '), sent: o }));
        res.sent = o;
      }
      this.pos[pl][m.k] = m.to;
      const kind = m.off ? '' : PT_KIND(m.house);
      if (m.off) { notes.push(me ? 'Your marker completes the circuit and leaves the mat; the Scribe pays you a treasure.' : 'A Scribe marker completes the circuit; you pay a treasure.'); this.pay(opp, pl); }
      else if (kind === 'dark') { notes.push(me ? 'A dark house: you pay the Scribe a treasure.' : 'The Scribe lands on a dark house and pays you a treasure.'); this.pay(pl, opp); }
      else if (kind === 'tip') notes.push(me ? 'The tip of an arm: throw again.' : 'The Scribe reaches the tip of an arm and throws again.');
      else if (m.enter) notes.push(me ? 'A marker enters the mat.' : '');
      res.note = notes.filter(Boolean).join(' ');
      this.again = kind === 'tip';
      return this.finishCheck(res);
    },
    finishCheck(res) {
      if (!this.over) {
        const done = [0, 1].find(p => this.home(p) === PT_MARKERS);
        if (done !== undefined || this.throws >= PT_LIMIT) {
          if (done !== undefined) { this.treasure[done] += this.pot; this.pot = 0; if (this.treasure[1 - done] > 0) { this.treasure[1 - done]--; this.treasure[done]++; } }
          const [a, c] = this.treasure, line = `You hold ${a} treasures, the Scribe ${c}.`;
          const lead = done === 0 ? 'All six of your markers are home, and the offerings are yours.' : done === 1 ? 'The Scribe has brought all six markers home and takes the offerings.' : 'After 150 throws each the game stops.';
          const w = a > c ? 0 : c > a ? 1 : done !== undefined ? done : -1;
          this.over = { winner: w, text: `${lead} ${line}` };
        }
      }
      return res;
    },
    extra(m) { return !!m && !m.offering && !this.over && !!this.again; },
    done() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over; },
    // Chance the other side can land on a centre house h with its next throw (only there can markers be hit).
    danger(pl, h) {
      const opp = 1 - pl, P = { 1: 5 / 32, 2: 10 / 32, 3: 10 / 32, 4: 5 / 32, 10: 1 / 32 };
      let p = 0;
      for (const v of [1, 2, 3, 4, 10]) if (this.pos[opp].some((r, k) => (r < 0 ? v === 1 && this.house(opp, 0) === h : r < PT_N - 1 && r + v < PT_N - 1 && this.house(opp, r + v) === h))) p += P[v];
      return p;
    },
    aiPlan(pl, moves) {
      if (!moves.length) return [];
      if (moves[0].offering) return [moves[0]];
      if (LEVEL.name === 'gentle' && Math.random() < 0.45) return [moves[(Math.random() * moves.length) | 0]];
      let best = moves[0], bv = -Infinity;
      for (const m of moves) {
        const kind = m.off ? '' : PT_KIND(m.house);
        let v = (m.to - Math.max(0, m.from)) * 0.15;
        if (m.off) v += 8; if (m.cap) v += 7; if (m.enter) v += 4;
        if (kind === 'tip') v += 3; if (kind === 'dark') v -= 4;
        if (LEVEL.name === 'sharp') {
          if (kind === 'centre' && !m.off) v -= this.danger(pl, m.house) * 9;
          const was = m.from >= 0 ? this.house(pl, m.from) : -1;
          if (was >= 0 && PT_KIND(was) === 'centre') v += this.danger(pl, was) * 6;
        }
        v += Math.random() * pick(2, 0.3, 0.05);
        if (v > bv) { bv = v; best = m; }
      }
      return [best];
    },
  };

  /* -------------------------------------------------- The Mansion of Happiness
     W. & S. B. Ives, Salem, 1843: 67 squares on a spiral, read from a scan of
     the board, played by the rules printed with the game. */
  const MH_SQ = {
    1: ['Justice', 'plain'], 2: ['Piety', 'virtue'], 4: ['Honesty', 'virtue'], 6: ['The Water', 'water'], 7: ['Audacity', 'vice'],
    9: ['The Inn', 'inn'], 11: ['Poverty', 'place'], 13: ['Temperance', 'virtue'], 14: ['Passion', 'crime'], 15: ['Gratitude', 'virtue'],
    17: ['Idleness', 'crime'], 18: ['Prudence', 'virtue'], 20: ['Cruelty', 'vice'], 22: ['Whipping Post', 'place'], 23: ['Truth', 'virtue'],
    25: ['Immodesty', 'vice'], 26: ['Road to Folly', 'crime'], 28: ['Sabbath Breaker', 'crime'], 30: ['House of Correction', 'jail'],
    31: ['Chastity', 'virtue'], 33: ['Sincerity', 'virtue'], 34: ['A Cheat', 'crime'], 36: ['The Pillory', 'place'], 38: ['Humility', 'virtue'],
    40: ['The Stocks', 'place'], 42: ['Industry', 'virtue'], 43: ['A Perjurer', 'crime'], 45: ['Charity', 'virtue'], 47: ['A Drunkard', 'crime'],
    50: ['Prison', 'place'], 52: ['Humanity', 'virtue'], 54: ['Generosity', 'virtue'], 55: ['Ruin', 'place'], 57: ['A Robber', 'crime'],
    60: ['Seat of Expectation', 'plain'], 61: ['Ingratitude', 'vice'], 63: ['Summit of Dissipation', 'crime'], 67: ['The Mansion of Happiness', 'goal'],
  };
  const MH_BLANK = [11, 22, 36, 40, 50, 55]; // places one is sent to, never counted when moving
  // Where each crime sends you, how many turns you stay, and whether you then begin again.
  const MH_CRIME = { 14: [6, 0], 17: [11, 0], 26: [18, 0], 28: [22, 0], 34: [30, 1, true], 43: [36, 0], 47: [40, 0], 57: [50, 2, true], 63: [55, 0] };
  const MH_SAY = {
    14: 'off to the Water for a ducking', 17: 'off to Poverty', 26: 'back to Prudence', 28: 'off to the Whipping Post',
    34: 'a month in the House of Correction, then back to the beginning', 43: 'into the Pillory', 47: 'into the Stocks',
    57: 'two months in Prison, then back to the beginning', 63: 'down to Ruin',
  };
  const MANSION = {
    id: 'mansion', name: 'The Mansion of Happiness', dice: true, pipDice: true, oneDie: true, autoMove: true, first: 0, N: 1, extraNote: 'Spin again.',
    SQ: MH_SQ, BLANK: MH_BLANK,
    rules: [
      'Spin the teetotum and move your counter that many squares along the spiral toward the Mansion of Happiness at its centre. Poverty, the Whipping Post, the Pillory, the Stocks, Prison and Ruin are not counted: you only go there when found guilty.',
      'Land on a virtue (Piety, Honesty, Temperance, Gratitude, Prudence, Truth, Chastity, Sincerity, Humility, Industry, Charity, Humanity, Generosity) and advance six more squares.',
      'Land on Audacity, Cruelty, Immodesty or Ingratitude and go back to where you were.',
      'The Water (6) carries you on to 10, and the Inn (9) on to 12.',
      'The guilty are punished: Passion to the Water, Idleness to Poverty, the Road to Folly back to Prudence, a Sabbath Breaker to the Whipping Post, a Perjurer to the Pillory, a Drunkard to the Stocks, the Summit of Dissipation to Ruin. A Cheat spends a month (a turn) in the House of Correction and a Robber two in Prison; both then begin again, unless another player guilty of the same crime sets them free sooner.',
      'Land where another counter stands and it goes back to the square you came from.',
      'Reach 67 by an exact count to win. Overshoot and you go back to the Seat of Expectation (60); overshoot again and you begin again.'
    ],
    source: 'The rules printed with the game (as reprinted for the 1894 edition), with every square read from the 1843 Ives board. Two clauses about crimes committed on an occupied square are left out, and the six squares a virtue gives you do not set off the square they reach.',
    init() { this.pos = [0, 0]; this.jail = [0, 0]; this.over = [false, false]; this.won = null; },
    roll() { const a = 1 + ((Math.random() * 6) | 0); return { faces: [a], value: a }; },
    count(from, n) { // n counted squares forward, skipping the places one is only sent to; returns [square, path] or null past 67
      let at = from; const path = [];
      while (n > 0) { at++; if (at > 67) return null; if (MH_BLANK.includes(at)) continue; path.push(at); n--; }
      return [at, path];
    },
    who(pl) { return pl === 0 ? 'You' : 'The Scribe'; },
    plan(pl, roll) {
      const from = this.pos[pl], v = roll.value, notes = [], me = pl === 0, who = this.who(pl);
      const m = { pl, from, path: [], to: from, jail: 0, again: false, bump: null, restart: false };
      const c = this.count(from, v);
      if (!c) {
        if (this.over[pl]) { m.to = 0; m.restart = true; m.overshoot = 2; notes.push(`${who} ${me ? 'overshoot' : 'overshoots'} the Mansion again and ${me ? 'begin' : 'begins'} again.`); }
        else { m.to = 60; m.overshoot = 1; notes.push(`${who} ${me ? 'overshoot' : 'overshoots'} the Mansion, and ${me ? 'go' : 'goes'} back to the Seat of Expectation.`); }
        m.path = [m.to]; m.notes = notes; return m;
      }
      let [at, path] = c; m.path = path;
      const sq = MH_SQ[at], kind = sq ? sq[1] : '';
      if (kind === 'virtue') { const d = this.count(at, 6); notes.push(`${sq[0]}! ${who} ${me ? 'advance' : 'advances'} six.`); if (d) { at = d[0]; m.path = path.concat(d[1]); } }
      else if (kind === 'vice') { notes.push(`${sq[0]}: ${me ? 'you go' : 'the Scribe goes'} back to where ${me ? 'you were' : 'it was'}.`); at = from; m.path = path.concat(from || []); }
      else if (kind === 'water') { notes.push(`The Water carries ${me ? 'you' : 'the Scribe'} on to 10.`); at = 10; m.path = path.concat(10); }
      else if (kind === 'inn') { notes.push(`${who} ${me ? 'rest' : 'rests'} at the Inn and ${me ? 'go' : 'goes'} on to 12.`); at = 12; m.path = path.concat(12); }
      else if (kind === 'crime') { const [to, turns, again] = MH_CRIME[at]; notes.push(`${sq[0]}! ${me ? 'You go' : 'The Scribe goes'} ${MH_SAY[at]}.`); at = to; m.path = path.concat(to); m.jail = turns; m.restart = !!again; }
      else if (at === 67) notes.push(me ? 'You reach the Mansion of Happiness!' : 'The Scribe reaches the Mansion of Happiness.');
      m.to = at;
      const o = 1 - pl;
      if (at !== 0 && at !== 67 && this.pos[o] === at) {
        if (this.jail[o] && m.jail) { m.free = true; notes.push(`${o === 0 ? 'You are' : 'The Scribe is'} set free, to begin again.`); }
        else if (this.jail[o]) { notes.push(`${me ? 'You cannot' : 'The Scribe cannot'} free the prisoner there, so ${me ? 'you go back and spin' : 'it goes back and spins'} again.`); m.to = from; m.path = m.path.concat(from || []); m.again = true; }
        else { m.bump = from; notes.push(`${o === 0 ? 'You are' : 'The Scribe is'} sent back to ${from || 'the start'}.`); }
      }
      m.notes = notes; return m;
    },
    legal(pl, value, roll) { return this.won ? [] : [this.plan(pl, roll || { faces: [value], value })]; },
    steps(m) { return m.path; },
    apply(m) {
      const pl = m.pl, o = 1 - pl;
      this.pos[pl] = m.to; this.jail[pl] = m.jail;
      if (m.overshoot === 1) this.over[pl] = true; if (m.overshoot === 2) this.over[pl] = false;
      if (m.bump !== null && m.bump !== undefined) this.pos[o] = m.bump;
      if (m.free) { this.jail[o] = 0; this.pos[o] = 0; }
      if (m.to === 67) this.won = { winner: pl, text: pl === 0 ? 'You have reached the Mansion of Happiness.' : 'The Scribe reached the Mansion of Happiness first.' };
      return { moved: [], note: m.notes.join(' '), bumped: m.bump !== null && m.bump !== undefined ? o : null, freed: m.free ? o : null };
    },
    // A player serving a sentence misses turns; when it is served, the counter goes back to the start.
    skipTurn(pl) {
      if (!this.jail[pl]) return '';
      const where = this.pos[pl] === 30 ? 'the House of Correction' : 'Prison';
      this.jail[pl]--;
      if (this.jail[pl]) return pl === 0 ? `You serve a month in ${where}.` : `The Scribe serves a month in ${where}.`;
      this.pos[pl] = 0; this.over[pl] = false;
      return pl === 0 ? `You serve your time in ${where}, and begin the game again.` : `The Scribe serves its time in ${where}, and begins again.`;
    },
    extra(m) { return !!m && m.again && !this.won; },
    done() { return !!this.won; },
    final() { return this.won; },
    result() { return this.won; },
    home(pl) { return this.pos[pl] === 67 ? 1 : 0; },
    aiPlan(pl, moves) { return [moves[0]]; },
  };

  /* ------------------------------------------------- The Checkered Game of Life
     Milton Bradley, 1860, as on the Milton Bradley Co. board of about 1911.
     Cells are r * 8 + c, row 0 the far side (Happy Old Age) and row 7 the near
     side (Infancy). Only the squares with (r + c) odd are played on. */
  const CL_SQ = {
    1: ['Wealth', 10], 3: ['Matrimony', 0], 5: ['Gambling', 0, 39], 7: ['Happy Old Age', 50],
    8: ['Perseverance', 0, 23], 10: ['Truth', 0], 12: ['Politics', 0, 24], 14: ['Intemperance', 0, 40],
    17: ['Crime', 0, 62], 19: ['Happiness', 5], 21: ['Idleness', 0, 58], 23: ['Success', 5],
    24: ['Congress', 5], 26: ['Honor', 5], 28: ['Cupid', 0, 3], 30: ['Speculation', 0],
    33: ['Honesty', 0, 19], 35: ['Industry', 0, 1], 37: ['Bravery', 0, 26], 39: ['Ruin', 0],
    40: ['Poverty', 0], 42: ['Ambition', 0, 53], 44: ['College', 5], 46: ['Suicide', 0],
    49: ['School', 0, 44], 51: ['Influence', 0, 55], 53: ['Fame', 0], 55: ['Fat Office', 5],
    56: ['Infancy', 0], 58: ['Disgrace', 0], 60: ['Jail', 0], 62: ['Prison', 0],
  };
  const CL_INFANCY = 56, CL_JAIL = 60, CL_PRISON = 62, CL_SUICIDE = 46, CL_SPEC = 30, CL_WEALTH = 1, CL_RUIN = 39, CL_WIN = 100;
  // What each number of the teetotum allows, as [rows, columns] steps on the board; one "square" is one playing square.
  const CL_MOVES = {
    1: [[-2, 0], [2, 0]], 2: [[0, -2], [0, 2]], 3: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
    4: [[-2, 0], [2, 0], [-4, 0], [4, 0]], 5: [[0, -2], [0, 2], [0, -4], [0, 4]],
    6: [[-1, -1], [-1, 1], [1, -1], [1, 1], [-2, -2], [-2, 2], [2, -2], [2, 2]],
  };
  const CL_SAY = { 1: 'one square up or down', 2: 'one square left or right', 3: 'one square diagonally', 4: 'one or two squares up or down', 5: 'one or two squares left or right', 6: 'one or two squares diagonally' };
  const LIFEGAME = {
    id: 'lifegame', name: 'The Checkered Game of Life', dice: true, pipDice: true, oneDie: true, first: 0, N: 1, extraNote: '',
    SQ: CL_SQ, SAY: CL_SAY,
    rules: [
      'Both players start at Infancy, bottom left. Only the pale squares are played on; the patterned squares between them are not counted.',
      'Spin the teetotum. 1: move one square up or down. 2: one square left or right. 3: one square diagonally. 4: one or two squares up or down. 5: one or two squares left or right. 6: one or two squares diagonally. When there is a choice, you choose.',
      'You can never stop on a square with a pointing hand: it carries you on at once (School to College, Industry to Wealth, Gambling to Ruin, Crime to Prison, and so on).',
      'A square with a number scores it each time you land there: Happy Old Age 50, Wealth 10, and 5 for Happiness, Success, Congress, Honor, College and Fat Office.',
      'Land on the other player\'s square and that counter is sent back to Jail. Prison costs you your next move. From Speculation, your next spin decides: a 3 or a 6 takes you to Wealth, anything else to Ruin.',
      'The square marked Suicide puts a player out of the game. The first to 100 points wins.'
    ],
    source: 'Milton Bradley\'s rules as described in his patent of 1866 (U.S. 53,561), on the board of about 1911 shown here. The patent does not list what each number allows; that table, and the Speculation rule, follow a modern reproduction of the original (Baldwin Games, 2024).',
    init() { this.pos = [CL_INFANCY, CL_INFANCY]; this.score = [0, 0]; this.miss = [0, 0]; this.over = null; },
    roll() { const a = 1 + ((Math.random() * 6) | 0); return { faces: [a], value: a }; },
    rollName(r) { return `${r.value} (${CL_SAY[r.value]})`; },
    who(pl) { return pl === 0 ? 'You' : 'The Scribe'; },
    dests(pl, v) {
      const from = this.pos[pl];
      if (from === CL_SPEC) return [{ pl, from, to: v === 3 || v === 6 ? CL_WEALTH : CL_RUIN, spec: true }];
      const r = from >> 3, c = from & 7, out = [], seen = new Set();
      for (const [dr, dc] of CL_MOVES[v]) {
        const nr = r + dr, nc = c + dc; if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
        const via = nr * 8 + nc, sq = CL_SQ[via], to = sq && sq[2] !== undefined ? sq[2] : via;
        if (seen.has(via)) continue; seen.add(via);
        out.push({ pl, from, via, to, hand: to !== via });
      }
      return out;
    },
    legal(pl, value) { return this.over ? [] : this.dests(pl, value); },
    steps(m) { return m.hand ? [m.via, m.to] : [m.to]; },
    apply(m) {
      const pl = m.pl, o = 1 - pl, me = pl === 0, who = this.who(pl), notes = [], res = { note: '', bumped: null };
      const name = s => CL_SQ[s][0];
      if (m.spec) notes.push(m.to === CL_WEALTH ? `${me ? 'Your' : 'The Scribe\'s'} speculation pays: on to Wealth.` : `${me ? 'Your' : 'The Scribe\'s'} speculation fails: down to Ruin.`);
      else if (m.hand) notes.push(`${name(m.via)} leads ${me ? 'you' : 'the Scribe'} to ${name(m.to)}.`);
      this.pos[pl] = m.to;
      if (m.to !== CL_INFANCY && this.pos[o] === m.to) { this.pos[o] = CL_JAIL; res.bumped = o; notes.push(`${o === 0 ? 'You are' : 'The Scribe is'} sent back to Jail.`); }
      const pts = CL_SQ[m.to][1];
      if (pts) { this.score[pl] += pts; notes.push(`${name(m.to)}: ${me ? 'you score' : 'the Scribe scores'} ${pts} (${this.score[pl]} in all).`); }
      if (m.to === CL_PRISON) { this.miss[pl] = 1; notes.push(`${who} ${me ? 'lose' : 'loses'} the next move in Prison.`); }
      if (m.to === CL_SPEC && !m.spec) notes.push(`Speculation: ${me ? 'your' : 'the Scribe\'s'} next spin decides between Wealth and Ruin.`);
      if (m.to === CL_SUICIDE) { this.over = { winner: o, text: me ? 'Your counter landed on the square marked Suicide, which puts a player out of the game.' : 'The Scribe\'s counter landed on the square marked Suicide, which puts a player out of the game.' }; notes.push(`${who} ${me ? 'are' : 'is'} out of the game.`); }
      else if (this.score[pl] >= CL_WIN) this.over = { winner: pl, text: me ? `You reach ${this.score[pl]} points.` : `The Scribe reaches ${this.score[pl]} points first.` };
      res.note = notes.join(' ');
      return res;
    },
    skipTurn(pl) {
      if (!this.miss[pl]) return '';
      this.miss[pl] = 0;
      return pl === 0 ? 'You lose this move in Prison.' : 'The Scribe loses this move in Prison.';
    },
    extra() { return false; },
    done() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over; },
    home(pl) { return this.score[pl] >= CL_WIN ? 1 : 0; },
    // How good a square is to stand on: its points, the rows above it, and the dangers next to it.
    worth(pl, s) {
      if (s === CL_SUICIDE) return -1000;
      let v = CL_SQ[s][1] * 1.2 + (7 - (s >> 3)) * 0.8;
      if (s === CL_PRISON) v -= 6; if (s === CL_RUIN || s === 40) v -= 2; if (s === CL_JAIL) v -= 2;
      if (s === CL_SPEC) v += 0.5 * 10 * 1.2 / 3 - 1; // a third of spins reach Wealth
      return v;
    },
    aiPlan(pl, moves) {
      if (!moves.length) return [];
      const lvl = LEVEL.name, o = 1 - pl;
      if (lvl === 'gentle' && Math.random() < 0.4) { const safe = moves.filter(m => m.to !== CL_SUICIDE); const pool = safe.length ? safe : moves; return [pool[(Math.random() * pool.length) | 0]]; }
      let best = moves[0], bv = -Infinity;
      for (const m of moves) {
        let v = this.worth(pl, m.to) + (this.pos[o] === m.to && m.to !== CL_INFANCY ? 3 : 0);
        if (this.score[pl] + CL_SQ[m.to][1] >= CL_WIN) v += 500;
        if (lvl === 'sharp') { // and what the next spin could bring from there
          const save = this.pos[pl]; this.pos[pl] = m.to; let ev = 0;
          for (let s = 1; s <= 6; s++) { const ds = this.dests(pl, s); ev += Math.max(...ds.map(d => CL_SQ[d.to][1] * 1.2 - (d.to === CL_SUICIDE ? 30 : 0) + (7 - (d.to >> 3)) * 0.3)) / 6; }
          this.pos[pl] = save; v += 0.7 * ev;
        }
        v += Math.random() * pick(2, 0.3, 0.05);
        if (v > bv) { bv = v; best = m; }
      }
      return [best];
    },
  };

  /* ------------------------------------------------------------- Chaturanga
   * A modern reconstruction: shatranj's rules under the Sanskrit names, as
   * H. J. R. Murray reconstructed the game. */
  const CR_NAMES = ['', 'raja', 'mantri', 'gaja', 'ashva', 'ratha', 'padati'];
  const CHATURANGA = Object.assign({}, SHATRANJ, {
    id: 'chaturanga', name: 'Chaturanga',
    rules: [
      'This is a modern reconstruction. No rules survive from chaturanga\'s own time, so we play it as H. J. R. Murray did: with the rules of its Persian successor, shatranj.',
      'The raja (king) moves one square in any direction. The ratha (chariot) moves like a rook and the ashva (horse) like a knight.',
      'The mantri (counsellor) steps one square diagonally. The gaja (elephant) jumps exactly two squares diagonally, over anything in between. Its true move is unknown; this is the shatranj alfil\'s.',
      'The padati (foot soldier) steps one square forward and takes one square diagonally forward, never two at once. On the far rank it becomes a mantri.',
      'You win by checkmate, by stalemating the Scribe, or by capturing everything but its raja, unless it can strip yours bare on the very next move. There is no castling, and a long stretch with no capture or padati move is a draw.'
    ],
    source: 'A modern reconstruction after H. J. R. Murray, A History of Chess (1913), which takes chaturanga\'s moves from shatranj. Other reconstructions move the gaja differently.',
    pieceName(v) { return CR_NAMES[this.type(v)]; },
    apply(m) {
      const res = SHATRANJ.apply.call(this, m);
      res.note = res.note.replace('The baidaq becomes a firzan.', 'The padati becomes a mantri.').replace('Shah! ', 'Check! ').replace(/king/g, 'raja');
      return res;
    },
    result(pl) {
      const res = SHATRANJ.result.call(this, pl);
      if (res) res.text = res.text.replace('Shah mat. ', 'Checkmate. ').replace('in shatranj', 'by these rules').replace(/kings/g, 'rajas').replace(/king/g, 'raja');
      return res;
    },
  });

  /* ---------------------------------------------------------- Medieval chess
   * Chess as Europe played it around 1200, for the Lewis chessmen: shatranj's
   * moves under European names, with only checkmate winning. */
  const LW_NAMES = ['', 'king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];
  const LEWISCHESS = Object.assign({}, SHATRANJ, {
    id: 'lewischess', name: 'Medieval chess',
    rules: [
      'This is a modern reconstruction of chess as Europe played it around 1200, when the Lewis chessmen were carved. The moves are those Europe took over from shatranj, after H. J. R. Murray.',
      'The king moves one square in any direction. The rook moves like a modern rook and the knight like a modern knight.',
      'The queen, still the old fers or counsellor, steps only one square diagonally. The bishop, the alfin, jumps exactly two squares diagonally, over anything in between.',
      'The pawn steps one square forward and takes one square diagonally forward, never two at once. On the far rank it becomes a queen.',
      'Only checkmate wins. A stalemate, a long stretch with no capture or pawn move, or two bare kings is a draw. There is no castling: the king\'s and queen\'s first-move leaps of the later Middle Ages are left out.'
    ],
    source: 'A modern reconstruction after H. J. R. Murray, A History of Chess (1913). Medieval rules for stalemate and the bare king varied from place to place; this table treats both as in modern chess.',
    pieceName(v) { return LW_NAMES[this.type(v)]; },
    apply(m) {
      const res = SHATRANJ.apply.call(this, m);
      res.note = res.note.replace('The baidaq becomes a firzan.', 'The pawn becomes a queen.').replace('Shah! ', 'Check! ');
      return res;
    },
    result(pl) {
      const moves = this.legal(pl);
      if (!moves.length) return this.inCheck(pl)
        ? { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate. The Scribe\'s king is taken in the net.' }
        : { winner: -1, text: pl === 0 ? 'You are stalemated: a draw.' : 'The Scribe is stalemated: a draw.' };
      if (!this.material(0) && !this.material(1)) return { winner: -1, text: 'Both kings stand bare. The game is drawn.' };
      if (this.quiet >= 100) return { winner: -1, text: 'A long stretch with no capture or pawn move. The game is drawn.' };
      return null;
    },
    terminal(pl, depth) {
      if (!this.pseudo(pl).some(m => { const s = this.snapshot(); this.raw(m); const ok = !this.inCheck(pl); this.restore(s); return ok; })) return this.inCheck(pl) ? -1000 - depth : 0;
      if (this.quiet >= 100 || (!this.material(0) && !this.material(1))) return 0;
      return null;
    },
  });

  /* ---------------------------------------------------------- Courier chess
   * A 12 x 8 board: square i = r * 12 + c, row 0 the visitor's back rank.
   * A piece is pl * 16 + type. The old opening leaps (the rook pawns, the
   * queen's pawn and the queen, two squares each) are already made. */
  const CO = { K: 1, F: 2, E: 3, C: 4, S: 5, M: 6, N: 7, R: 8, P: 9 };
  const CO_NAME = ['', 'king', 'queen', 'bishop', 'courier', 'schleich', 'sage', 'knight', 'rook', 'pawn'];
  const CO_VAL = [0, 0, 1.6, 1.3, 4.2, 1.7, 3, 3, 5, 1];
  const CO_KING8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const CO_DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], CO_ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const CO_KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const COURIER = {
    id: 'courier', name: 'Courier chess', dice: false, first: 0, CO, NAME: CO_NAME,
    rules: [
      'You play white and move first, on a board of twelve files. The old opening leaps are already made: your rook pawns and queen\'s pawn have jumped two squares, and so has your queen.',
      'The king moves one square any way, the rook and knight as in modern chess. The courier, the piece the game is named for, runs any distance diagonally like a modern bishop.',
      'The queen (fers) steps one square diagonally, and the bishop (alfil) jumps exactly two squares diagonally. The sage (Mann) moves like a king but is not royal. The schleich (fool) steps one square straight.',
      'Pawns step one square forward and take one square diagonally forward, never two at once. On the far rank a pawn becomes a queen.',
      'Checkmate wins. There is no castling. A stalemate, two bare kings, or a long stretch with no capture or pawn move is a draw.'
    ],
    source: 'Courier chess as Gustavus Selenus described it in 1616, as played at Ströbeck. Stalemate is not recorded, so it is a draw here, and a pawn becomes a queen at once rather than by the slower old procedures.',
    init() {
      const b = Array(96).fill(0);
      const back = [CO.R, CO.N, CO.E, CO.C, CO.M, CO.K, CO.F, CO.S, CO.C, CO.E, CO.N, CO.R];
      for (let c = 0; c < 12; c++) { b[c] = back[c]; b[12 + c] = CO.P; b[84 + c] = back[c] + 16; b[72 + c] = CO.P + 16; }
      for (const c of [0, 6, 11]) { b[12 + c] = 0; b[36 + c] = CO.P; b[72 + c] = 0; b[48 + c] = CO.P + 16; } // the opening leaps
      b[6] = 0; b[24 + 6] = CO.F; b[84 + 6] = 0; b[60 + 6] = CO.F + 16;
      this.b = b; this.quiet = 0; this.ply = 0;
    },
    owner: v => v >> 4,
    type: v => v & 15,
    on: (r, c) => r >= 0 && r < 8 && c >= 0 && c < 12,
    kingAt(pl) { return this.b.indexOf(CO.K + pl * 16); },
    attacked(sq, by) {
      const b = this.b, r = (sq / 12) | 0, c = sq % 12;
      const is = (rr, cc, ...ts) => { if (!this.on(rr, cc)) return false; const v = b[rr * 12 + cc]; return v && (v >> 4) === by && ts.includes(v & 15); };
      for (const [dr, dc] of CO_KNIGHT) if (is(r + dr, c + dc, CO.N)) return true;
      for (const [dr, dc] of CO_KING8) if (is(r + dr, c + dc, CO.K, CO.M)) return true;
      for (const [dr, dc] of CO_DIAG) if (is(r + dr, c + dc, CO.F) || is(r + 2 * dr, c + 2 * dc, CO.E)) return true;
      for (const [dr, dc] of CO_ORTH) if (is(r + dr, c + dc, CO.S)) return true;
      const pr = by === 0 ? r - 1 : r + 1;
      if (is(pr, c - 1, CO.P) || is(pr, c + 1, CO.P)) return true;
      for (const [dirs, t] of [[CO_DIAG, CO.C], [CO_ORTH, CO.R]]) for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (this.on(rr, cc)) { const v = b[rr * 12 + cc]; if (v) { if ((v >> 4) === by && (v & 15) === t) return true; break; } rr += dr; cc += dc; }
      }
      return false;
    },
    inCheck(pl) { const k = this.kingAt(pl); return k >= 0 && this.attacked(k, 1 - pl); },
    pseudo(pl) {
      const b = this.b, out = [];
      for (let i = 0; i < 96; i++) {
        const v = b[i]; if (!v || (v >> 4) !== pl) continue;
        const t = v & 15, r = (i / 12) | 0, c = i % 12;
        const add = (rr, cc, capOnly, quietOnly) => {
          if (!this.on(rr, cc)) return false;
          const j = rr * 12 + cc, w = b[j];
          if (w && (w >> 4) === pl) return false;
          if (w && quietOnly) return false;
          if (!w && capOnly) return true;
          const m = { pl, from: i, to: j, cap: w };
          if (t === CO.P && rr === (pl ? 0 : 7)) m.promo = true;
          out.push(m); return !w;
        };
        const slide = dirs => { for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (add(rr, cc)) { rr += dr; cc += dc; } } };
        if (t === CO.K || t === CO.M) CO_KING8.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === CO.F) CO_DIAG.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === CO.E) CO_DIAG.forEach(([dr, dc]) => add(r + 2 * dr, c + 2 * dc));
        else if (t === CO.S) CO_ORTH.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === CO.N) CO_KNIGHT.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === CO.C) slide(CO_DIAG);
        else if (t === CO.R) slide(CO_ORTH);
        else if (t === CO.P) { const f = pl ? -1 : 1; add(r + f, c, false, true); add(r + f, c - 1, true); add(r + f, c + 1, true); }
      }
      return out;
    },
    raw(m) {
      const b = this.b, v = b[m.from];
      b[m.to] = m.promo ? CO.F + 16 * m.pl : v; b[m.from] = 0;
      this.quiet = m.cap || (v & 15) === CO.P ? 0 : this.quiet + 1; this.ply++;
    },
    legal(pl) { return this.pseudo(pl).filter(m => { const s = this.snapshot(); this.raw(m); const ok = !this.inCheck(pl); this.restore(s); return ok; }); },
    material(pl) { let n = 0; for (const v of this.b) if (v && (v >> 4) === pl && (v & 15) !== CO.K) n++; return n; },
    apply(m) {
      this.raw(m);
      const parts = [], you = m.pl === 0;
      if (m.cap) parts.push(you ? `You take the Scribe's ${CO_NAME[m.cap & 15]}.` : `The Scribe takes your ${CO_NAME[m.cap & 15]}.`);
      if (m.promo) parts.push(you ? 'Your pawn becomes a queen.' : 'The Scribe\'s pawn becomes a queen.');
      if (this.inCheck(1 - m.pl)) parts.push(you ? 'Check.' : 'Check!');
      return { note: parts.join(' '), caps: m.cap ? [m.to] : [] };
    },
    result(pl) {
      if (!this.legal(pl).length) return this.inCheck(pl)
        ? { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate.' }
        : { winner: -1, text: pl === 0 ? 'You are stalemated: a draw.' : 'The Scribe is stalemated: a draw.' };
      if (!this.material(0) && !this.material(1)) return { winner: -1, text: 'Both kings stand bare. The game is drawn.' };
      if (this.quiet >= 100) return { winner: -1, text: 'Fifty moves each with no capture or pawn move. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.quiet, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.quiet = s[1]; this.ply = s[2]; },
    turns(pl) {
      const val = m => (m.cap ? 10 * CO_VAL[m.cap & 15] - CO_VAL[this.b[m.from] & 15] : 0) + (m.promo ? 5 : 0);
      return this.legal(pl).sort((a, b) => val(b) - val(a)).map(m => [m]);
    },
    terminal(pl, depth) {
      if (!this.pseudo(pl).some(m => { const s = this.snapshot(); this.raw(m); const ok = !this.inCheck(pl); this.restore(s); return ok; })) return this.inCheck(pl) ? -1000 - depth : 0;
      if (this.quiet >= 100) return 0;
      return null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 96; i++) {
        const v = this.b[i]; if (!v) continue;
        const o = v >> 4, t = v & 15, r = (i / 12) | 0, c = i % 12;
        let x = CO_VAL[t];
        if (t === CO.P) x += 0.05 * (o === 0 ? r - 1 : 6 - r);
        else if (t !== CO.K && t !== CO.R) x += 0.06 * (3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 5.5) / 1.5));
        s += o === pl ? x : -x;
      }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

  /* ---------------------------------------------------------------- Hazard
   * Two players, each with a purse of shillings. The caster stakes, calls a main
   * from 5 to 9, and throws two dice; the other player sets (covers) the stake.
   * The caster keeps the dice until losing three times running. */
  const HZ_START = 10, HZ_ROUNDS = 24, HZ_STAKES = [1, 2, 5];
  const HAZARD = {
    id: 'hazard', name: 'Hazard', dice: true, pipDice: true, first: 0, autoMove: true,
    N: 0, STAKES: HZ_STAKES, ROUNDS: HZ_ROUNDS,
    rules: [
      'You each begin with ten shillings. Whoever casts stakes 1, 2 or 5 shillings, which the other covers, then calls a main: any number from 5 to 9.',
      'On the first throw of two dice, the main wins (a nick). So does 11 with a main of 7, and 12 with a main of 6 or 8. A 2 or 3 always loses (throwing out), and so does any other 11 or 12.',
      'Any other total becomes your chance. Keep throwing: the chance wins, the main loses, and anything else is thrown again.',
      'The caster keeps the dice until losing three times in a row; then they pass. The game ends when a purse is empty, or after 24 mains, when the fuller purse wins.'
    ],
    source: 'English hazard as Hoyle\'s Games set it down by 1790. The bank\'s side bets and odds on the chance are left out: every cast is an even-money stake.',
    get followPrompt() { return 'Now call your main.'; },
    get extraNote() { return this.pending ? `Throw again: you need ${this.chance} before ${this.main}.` : ''; },
    init() {
      this.purse = [HZ_START, HZ_START]; this.caster = 0; this.losses = 0; this.rounds = 0;
      this.stage = 'stake'; this.stake = 0; this.main = 0; this.chance = 0; this.pending = false; this.over = null; this.last = null;
    },
    roll() { const a = 1 + ((Math.random() * 6) | 0), b = 1 + ((Math.random() * 6) | 0); return { faces: [a, b], value: a + b }; },
    who(pl, cap) { return pl === 0 ? (cap ? 'You' : 'you') : 'the Scribe'; },
    maxStake() { return Math.min(this.purse[this.caster], this.purse[1 - this.caster]); },
    preThrow(pl) {
      if (this.over || pl !== this.caster) return null;
      if (this.stage === 'stake') return HZ_STAKES.filter(n => n <= this.maxStake()).concat(this.maxStake() < 5 && !HZ_STAKES.includes(this.maxStake()) ? [this.maxStake()] : [])
        .map(n => ({ pl, pre: true, kind: 'stake', n, label: `Stake ${n} shilling${n > 1 ? 's' : ''}` }));
      if (this.stage === 'main') return [5, 6, 7, 8, 9].map(n => ({ pl, pre: true, kind: 'main', n, label: `Main ${n}` }));
      return null;
    },
    legal(pl, value, roll) { return this.stage === 'throw' && pl === this.caster ? [{ pl, kind: 'throw', value, faces: roll ? roll.faces : null }] : []; },
    nick(main, v) { return v === main || (v === 11 && main === 7) || (v === 12 && (main === 6 || main === 8)); },
    out(main, v) { return v === 2 || v === 3 || ((v === 11 || v === 12) && !this.nick(main, v)); },
    apply(m) {
      const pl = m.pl, Y = pl === 0;
      if (m.kind === 'stake') { this.stake = m.n; this.stage = 'main'; return { note: Y ? `You stake ${m.n}.` : `The Scribe stakes ${m.n} shilling${m.n > 1 ? 's' : ''}.`, followUp: Y ? this.preThrow(pl) : null }; }
      if (m.kind === 'main') { this.main = m.n; this.stage = 'throw'; this.pending = false; return { note: Y ? `Your main is ${m.n}.` : `The Scribe calls a main of ${m.n}.`, thenThrow: true }; }
      const v = m.value;
      if (!this.pending) {
        if (this.nick(this.main, v)) return this.settle(true, `${v}: a nick!`);
        if (this.out(this.main, v)) return this.settle(false, `${v}: thrown out.`);
        this.chance = v; this.pending = true;
        return { note: `${v}: ${Y ? 'your' : 'the Scribe\'s'} chance is ${v}, against a main of ${this.main}.` };
      }
      if (v === this.chance) return this.settle(true, `${v}: the chance comes up.`);
      if (v === this.main) return this.settle(false, `${v}: the main comes up first.`);
      return { note: `${v}.` };
    },
    settle(won, what) {
      const c = this.caster, s = this.stake, Y = c === 0;
      this.purse[c] += won ? s : -s; this.purse[1 - c] -= won ? s : -s;
      this.pending = false; this.stage = 'stake'; this.rounds++; this.last = { won, caster: c };
      let note = `${what} ${Y ? (won ? `You win ${s}.` : `You lose ${s}.`) : (won ? `The Scribe wins ${s}.` : `The Scribe loses ${s}.`)}`;
      this.losses = won ? 0 : this.losses + 1;
      if (this.losses === 3) { this.caster = 1 - c; this.losses = 0; note += Y ? ' Three losses running: the dice pass to the Scribe.' : ' Three losses running: the dice pass to you.'; }
      if (!this.purse[0]) this.over = { winner: 1, text: 'Your purse is empty. The Scribe sweeps up the shillings.' };
      else if (!this.purse[1]) this.over = { winner: 0, text: 'The Scribe\'s purse is empty. You win every shilling.' };
      else if (this.rounds >= HZ_ROUNDS) {
        const [a, b] = this.purse;
        this.over = { winner: a > b ? 0 : b > a ? 1 : -1, title: a > b ? 'You win' : b > a ? 'The Scribe wins' : 'Even purses', text: `After ${HZ_ROUNDS} mains you have ${a} shillings and the Scribe ${b}.` };
      }
      return { note, settled: true };
    },
    extra() { return this.pending && !this.over; },
    done() { return !!this.over; },
    ended() { return !!this.over; },
    final() { return this.over; },
    home() { return 0; },
    passTurn() { return this.caster; },
    // The Scribe calls 7, the main with the smallest disadvantage; Gentle calls any main.
    // Staking: the caster always has the worse of the bet, so Sharp stakes little unless it must catch up.
    aiPre(pl) {
      const max = this.maxStake(), opts = HZ_STAKES.filter(n => n <= max);
      if (!opts.length) opts.push(max);
      const left = HZ_ROUNDS - this.rounds, behind = this.purse[1 - pl] - this.purse[pl];
      const stake = LEVEL.name === 'gentle' ? opts[(Math.random() * opts.length) | 0]
        : LEVEL.name === 'sharp' ? (behind > 0 && left < 6 ? opts[opts.length - 1] : opts[0])
          : opts[Math.min(1, opts.length - 1)];
      const main = LEVEL.name === 'gentle' ? 5 + ((Math.random() * 5) | 0) : 7;
      return [{ pl, pre: true, kind: 'stake', n: stake }, { pl, pre: true, kind: 'main', n: main }];
    },
    aiPlan(pl, moves) { return [moves[0]]; },
  };

  /* ---------------------------------------------------------------- Piquet
   * 32 cards with the cribbage numbering (suit * 13 + rank, rank 0 the ace);
   * pqPow ranks 7 low to ace high. Player 0 is the visitor. Elder hand is the
   * non-dealer. A partie is six deals, or two in the short game. */
  const PQ_DECK = []; for (let su = 0; su < 4; su++) for (const rk of [0, 6, 7, 8, 9, 10, 11, 12]) PQ_DECK.push(su * 13 + rk);
  const pqSuit = c => (c / 13) | 0, pqRank = c => c % 13;
  const pqPow = c => (pqRank(c) === 0 ? 7 : pqRank(c) - 6); // 7 is 0 ... ace is 7
  const pqVal = c => (pqRank(c) === 0 ? 11 : pqRank(c) >= 9 ? 10 : pqRank(c) + 1);
  const PQ_RANK = ['seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace'];
  const PQ_RANKS = ['sevens', 'eights', 'nines', 'tens', 'jacks', 'queens', 'kings', 'aces'];
  const PQ_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const PQ_SEQ = ['', '', '', 'tierce', 'quart', 'quint', 'sixième', 'septième', 'huitième'];
  const pqSeqScore = n => (n < 3 ? 0 : n <= 4 ? n : n + 10);
  const pqName = c => `${PQ_RANK[pqPow(c)]} of ${PQ_SUIT[pqSuit(c)]}`;
  function pqDeclare(hand) { // the best of each kind a hand holds, and what all its sequences and sets are worth
    const bySuit = [0, 1, 2, 3].map(su => hand.filter(c => pqSuit(c) === su).map(pqPow).sort((a, b) => a - b));
    let point = { len: 0, val: 0, suit: -1 };
    bySuit.forEach((p, su) => { const val = hand.filter(c => pqSuit(c) === su).reduce((n, c) => n + pqVal(c), 0); if (p.length > point.len || (p.length === point.len && val > point.val)) point = { len: p.length, val, suit: su }; });
    const seqs = [];
    bySuit.forEach((p, su) => { let run = 1; for (let k = 1; k <= p.length; k++) { if (k < p.length && p[k] === p[k - 1] + 1) run++; else { if (run >= 3) seqs.push({ len: run, top: p[k - 1], suit: su }); run = 1; } } });
    seqs.sort((a, b) => b.len - a.len || b.top - a.top);
    const sets = [];
    for (let pw = 3; pw <= 7; pw++) { const n = hand.filter(c => pqPow(c) === pw).length; if (n >= 3) sets.push({ n, pw }); }
    sets.sort((a, b) => b.n - a.n || b.pw - a.pw);
    const blanche = !hand.some(c => pqRank(c) >= 10 && pqRank(c) <= 12);
    return { point, seqs, sets, blanche };
  }
  const PIQUET = {
    id: 'piquet', name: 'Piquet', dice: false, first: 0, cardName: pqName,
    variants: [{ id: '6', label: 'Partie of six' }, { id: '2', label: 'Two deals' }], variant: '6', variantLabel: 'Game',
    setVariant(id) { this.variant = id === '2' ? '2' : '6'; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'A 32-card pack, sevens up to aces. Each of you is dealt twelve cards; the other eight are the talon. The player who does not deal is elder hand. The deal alternates.',
      'Exchange: elder hand discards one to five cards and draws as many from the talon; younger hand may then discard up to as many as are left. Click cards to mark them, then exchange.',
      'Declarations are scored for you. Point: the longest suit scores a point a card (ties go to the higher card values). Sequence: three or more in a row in one suit; tierce 3, quart 4, quint 15, sixième 16 and so on. The best sequence scores all its holder\'s sequences. Sets: four aces, kings, queens, jacks or tens score 14, three of them 3; the best set scores all its holder\'s sets. A hand with no court card is carte blanche, 10. Equal declarations score nothing.',
      'Then twelve tricks with no trumps: follow suit if you can. You score 1 for each card you lead, 1 for winning a trick the other led, 1 more for the last trick, and 10 for winning more tricks, or 40 for winning them all (capot).',
      'Reaching 30 from declarations alone before the other scores anything is a repique, worth 60 more. Elder hand reaching 30 in declarations and play before younger scores anything makes a pique, worth 30 more. After six deals the higher total wins.'
    ],
    source: 'Piquet as Cavendish set out its rules in 1882, after pagat.com. Combinations are declared for you, in full, and a tie after the last deal is a draw.',
    init() { this.total = [0, 0]; this.deals = 0; this.dealer = 1; this.over = null; this.deal(); },
    deal() {
      const d = PQ_DECK.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      const sort = h => h.sort((a, b) => pqSuit(a) - pqSuit(b) || pqPow(a) - pqPow(b));
      this.hands = [sort(d.slice(0, 12)), sort(d.slice(12, 24))]; this.talon = d.slice(24);
      this.elder = 1 - this.dealer; this.deals++;
      this.stage = 'exchange'; this.toMove = this.elder; this.taken = 0; this.marked = []; this.discards = [[], []];
      this.score = [0, 0]; this.declScore = [0, 0]; this.trick = []; this.tricks = [0, 0]; this.played = []; this.notes = []; this.declNote = '';
      this.void = [[false, false, false, false], [false, false, false, false]]; this.piqueOpen = true; this.lastTrick = null;
    },
    get limit() { return +this.variant; },
    declareHand: pqDeclare,
    who(pl) { return pl === 0 ? 'You' : 'The Scribe'; },
    prompt0() {
      if (this.stage === 'exchange') {
        const max = this.toMove === this.elder ? 5 : this.talon.length;
        return `You are ${this.toMove === this.elder ? 'elder' : 'younger'} hand. Click up to ${max} cards to discard, then exchange.`;
      }
      if (this.stage === 'next') return this.notes.join(' ') + ' Press Next deal when you are ready.';
      return this.trick.length ? 'Follow suit if you can.' : 'Lead a card.';
    },
    legal(pl) {
      if (this.over || pl !== this.toMove) return [];
      if (this.stage === 'next') return [{ pl, kind: 'next', label: this.deals >= this.limit ? 'See the result' : 'Next deal' }];
      if (this.stage === 'exchange') {
        const max = pl === this.elder ? Math.min(5, this.talon.length) : this.talon.length, n = this.marked.length, out = this.hands[pl].map(c => ({ pl, kind: 'mark', c }));
        if (n >= 1 && n <= max) out.push({ pl, kind: 'exchange', cards: this.marked.slice(), label: `Exchange ${n} card${n > 1 ? 's' : ''}` });
        return out;
      }
      return this.legalCards(pl).map(c => ({ pl, kind: 'play', c }));
    },
    legalCards(pl) { const h = this.hands[pl]; if (!this.trick.length) return h.slice(); const su = pqSuit(this.trick[0].c), f = h.filter(c => pqSuit(c) === su); return f.length ? f : h.slice(); },
    add(pl, n, play) { // score, watching for pique: elder reaches 30 before younger scores anything
      if (!n) return '';
      this.score[pl] += n;
      if (play === 'trick' && pl !== this.elder) this.piqueOpen = false;
      if (play === 'trick' && pl === this.elder && this.piqueOpen && this.score[pl] >= 30 && !this.score[1 - pl]) { this.piqueOpen = false; this.score[pl] += 30; return pl === 0 ? ' Pique: 30 more to you!' : ' Pique: 30 more to the Scribe.'; }
      return '';
    },
    apply(m) {
      const pl = m.pl, Y = pl === 0;
      if (m.kind === 'next') {
        this.total[0] += this.score[0]; this.total[1] += this.score[1];
        if (this.deals >= this.limit) { this.finishPartie(); return { note: '' }; }
        this.dealer = 1 - this.dealer; this.deal();
        return { note: this.elder === 0 ? 'The Scribe deals. You are elder hand.' : 'You deal. The Scribe is elder hand.', events: [{ type: 'deal' }] };
      }
      if (m.kind === 'mark') {
        const i = this.marked.indexOf(m.c); if (i >= 0) this.marked.splice(i, 1); else this.marked.push(m.c);
        return { note: '', events: [{ type: 'mark', c: m.c, on: i < 0 }], followUp: this.legal(pl) };
      }
      if (m.kind === 'exchange') {
        const n = m.cards.length, h = this.hands[pl];
        for (const c of m.cards) { h.splice(h.indexOf(c), 1); this.discards[pl].push(c); }
        const drawn = this.talon.splice(0, n); h.push(...drawn); h.sort((a, b) => pqSuit(a) - pqSuit(b) || pqPow(a) - pqPow(b));
        this.marked = [];
        const events = [{ type: 'exchange', pl, out: m.cards, drawn }];
        let note = `${this.who(pl)} ${Y ? 'exchange' : 'exchanges'} ${n} card${n > 1 ? 's' : ''}.`;
        if (pl === this.elder) { this.toMove = 1 - pl; return { note, events }; }
        note += ' ' + this.declare(); this.stage = 'play'; this.toMove = this.elder;
        return { note, events };
      }
      // A card played to a trick.
      const h = this.hands[pl]; h.splice(h.indexOf(m.c), 1); this.played.push(m.c);
      const events = [{ type: 'play', pl, c: m.c }]; let note = '';
      if (!this.trick.length) { this.trick.push({ pl, c: m.c }); note = this.add(pl, 1, 'trick'); this.toMove = 1 - pl; return { note: note.trim(), events }; }
      const lead = this.trick[0]; if (pqSuit(m.c) !== pqSuit(lead.c)) this.void[pl][pqSuit(lead.c)] = true;
      this.trick.push({ pl, c: m.c });
      const w = pqSuit(m.c) === pqSuit(lead.c) && pqPow(m.c) > pqPow(lead.c) ? pl : lead.pl;
      this.tricks[w]++; this.lastTrick = { cards: this.trick.map(t => t.c), winner: w }; this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      if (w !== lead.pl) note += this.add(w, 1, 'trick');
      const notes = [`${this.who(w)} ${w ? 'takes' : 'take'} the trick.${note}`];
      if (!this.hands[0].length && !this.hands[1].length) this.endDeal(w, notes);
      return { note: notes.join(' '), events };
    },
    declare() { // compare both hands category by category, in the order they are counted
      const d = [this.hands[0], this.hands[1]].map(pqDeclare), parts = [], got = [0, 0];
      let repique = -1;
      const score = (pl, n) => { if (!n) return; got[pl] += n; this.add(pl, n); if (repique < 0 && got[pl] >= 30 && !got[1 - pl]) repique = pl; };
      const name = pl => (pl === 0 ? 'You' : 'The Scribe'), verb = pl => (pl === 0 ? 'score' : 'scores');
      for (const pl of [this.elder, 1 - this.elder]) if (d[pl].blanche) { score(pl, 10); parts.push(`${name(pl)} ${pl ? 'has' : 'have'} carte blanche: 10.`); }
      const pt = d.map(x => x.point), pw = pt[0].len - pt[1].len || pt[0].val - pt[1].val;
      if (pw) { const p = pw > 0 ? 0 : 1; score(p, pt[p].len); parts.push(`${name(p)} ${verb(p)} the point, ${pt[p].len} in ${PQ_SUIT[pt[p].suit]}: ${pt[p].len}.`); } else parts.push('The points are equal.');
      const s0 = d[0].seqs[0], s1 = d[1].seqs[0];
      const sw = !s0 && !s1 ? 0 : !s1 ? 1 : !s0 ? -1 : s0.len - s1.len || s0.top - s1.top;
      if (sw) { const p = sw > 0 ? 0 : 1, all = d[p].seqs, n = all.reduce((t, q) => t + pqSeqScore(q.len), 0); score(p, n); parts.push(`${name(p)} ${verb(p)} for sequences (${all.map(q => PQ_SEQ[Math.min(q.len, 8)] + ' to the ' + PQ_RANK[q.top]).join(', ')}): ${n}.`); } else if (s0) parts.push('The sequences are equal.');
      const t0 = d[0].sets[0], t1 = d[1].sets[0];
      const tw = !t0 && !t1 ? 0 : !t1 ? 1 : !t0 ? -1 : t0.n - t1.n || t0.pw - t1.pw;
      if (tw) { const p = tw > 0 ? 0 : 1, all = d[p].sets, n = all.reduce((t, q) => t + (q.n === 4 ? 14 : 3), 0); score(p, n); parts.push(`${name(p)} ${verb(p)} for sets (${all.map(q => (q.n === 4 ? 'four ' : 'three ') + PQ_RANKS[q.pw]).join(', ')}): ${n}.`); }
      if (repique >= 0) { this.add(repique, 60); parts.push(repique === 0 ? 'Repique: 60 more to you!' : 'Repique: 60 more to the Scribe.'); this.piqueOpen = false; }
      else if (got[1 - this.elder]) this.piqueOpen = false; // younger hand has scored, so elder cannot make a pique
      this.declScore = got; this.declNote = parts.join(' ');
      return this.declNote;
    },
    endDeal(last, notes) {
      this.score[last] += 1; notes.push(`${last ? 'The Scribe scores' : 'You score'} 1 for the last trick.`);
      const [a, b] = this.tricks;
      if (a === 12 || b === 12) { const p = a === 12 ? 0 : 1; this.score[p] += 40; notes.push(`Capot! ${p ? 'The Scribe takes' : 'You take'} every trick: 40.`); }
      else if (a !== b) { const p = a > b ? 0 : 1; this.score[p] += 10; notes.push(`${p ? 'The Scribe wins' : 'You win'} the cards, ${Math.max(a, b)} tricks to ${Math.min(a, b)}: 10.`); }
      else notes.push('Six tricks each: nobody scores for the cards.');
      notes.push(`This deal: you ${this.score[0]}, the Scribe ${this.score[1]}.`);
      this.notes = notes.slice(1); this.stage = 'next'; this.toMove = 0;
    },
    finishPartie() {
      const [a, b] = this.total;
      if (a === b) { this.over = { winner: -1, title: 'A drawn partie', text: `${a} points each after ${this.deals} deals.` }; return; }
      const w = a > b ? 0 : 1, lo = Math.min(a, b), hi = Math.max(a, b), owed = lo >= 100 ? hi - lo + 100 : hi + lo + 100;
      const rub = this.limit === 6 ? ` ${w ? 'You' : 'The Scribe'} ${lo >= 100 ? 'crossed' : 'did not cross'} the Rubicon of 100, so the loser owes ${owed}.` : '';
      this.over = { winner: w, title: w ? 'The Scribe wins the partie' : 'You win the partie', text: `${hi} points to ${lo} after ${this.deals} deals.${rub}` };
    },
    passTurn() { return this.over ? 0 : this.toMove; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    // What a card is worth keeping: high cards, sets in the making, and long suits.
    keepValue(h, c) {
      const su = pqSuit(c), pw = pqPow(c), len = h.filter(x => pqSuit(x) === su).length;
      const same = h.filter(x => pqPow(x) === pw).length;
      const nb = h.filter(x => pqSuit(x) === su && Math.abs(pqPow(x) - pw) === 1).length;
      return pw * 1.2 + (pw === 7 ? 4 : 0) + len * 1.5 + (pw >= 3 && same >= 2 ? same * 2 : 0) + nb * 1.3;
    },
    // Sharp tries every way to throw out its weakest cards, draws the talon at random many times for each,
    // and keeps the discard that leaves the strongest hand on average.
    strength(h) {
      const d = pqDeclare(h);
      return d.point.len * 1.4 + d.seqs.reduce((t, q) => t + pqSeqScore(q.len), 0) + d.sets.reduce((t, q) => t + (q.n === 4 ? 14 : 3), 0) * 0.8
        + h.filter(c => pqPow(c) === 7).length * 2.5 + h.filter(c => pqPow(c) === 6).length;
    },
    sharpExchange(pl, n) {
      const h = this.hands[pl], unseen = PQ_DECK.filter(c => !h.includes(c)), drawFrom = this.talon.length;
      const pool = h.map(c => [c, this.keepValue(h, c)]).sort((a, b) => a[1] - b[1]).slice(0, Math.min(h.length, n + 3)).map(x => x[0]);
      const combos = []; const pickc = (start, cur) => { if (cur.length === n) { combos.push(cur.slice()); return; } for (let i = start; i < pool.length; i++) { cur.push(pool[i]); pickc(i + 1, cur); cur.pop(); } };
      pickc(0, []);
      let best = combos[0], bv = -Infinity;
      for (const out of combos) {
        const keep = h.filter(c => !out.includes(c)); let tot = 0;
        for (let k = 0; k < 24; k++) {
          const u = unseen.slice(); for (let i = u.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [u[i], u[j]] = [u[j], u[i]]; }
          tot += this.strength(keep.concat(u.slice(0, Math.min(n, drawFrom))));
        }
        if (tot > bv) { bv = tot; best = out; }
      }
      return best;
    },
    aiExchange(pl) {
      const h = this.hands[pl], max = pl === this.elder ? Math.min(5, this.talon.length) : this.talon.length;
      if (LEVEL.name === 'sharp') return this.sharpExchange(pl, max);
      const n = LEVEL.name === 'gentle' ? Math.max(1, max - ((Math.random() * 3) | 0)) : max;
      const noise = pick(4, 1, 0);
      return h.map(c => [c, this.keepValue(h, c) + Math.random() * noise]).sort((a, b) => a[1] - b[1]).slice(0, n).map(x => x[0]);
    },
    aiCard(pl) {
      const ms = this.legalCards(pl), h = this.hands[pl], opp = 1 - pl;
      if (ms.length === 1) return ms[0];
      if (LEVEL.name === 'gentle' && Math.random() < 0.35) return ms[(Math.random() * ms.length) | 0];
      const seen = new Set(this.played.concat(h, this.discards[pl]));
      const master = c => { for (let p = pqPow(c) + 1; p < 8; p++) { const x = PQ_DECK.find(y => pqSuit(y) === pqSuit(c) && pqPow(y) === p); if (!seen.has(x)) return false; } return true; };
      const low = a => a.reduce((x, y) => (pqPow(y) < pqPow(x) ? y : x)), high = a => a.reduce((x, y) => (pqPow(y) > pqPow(x) ? y : x));
      if (!this.trick.length) {
        const cash = ms.filter(master); if (cash.length) return high(cash);
        const len = su => h.filter(c => pqSuit(c) === su).length;
        const suits = [0, 1, 2, 3].filter(su => len(su)).sort((a, b) => len(b) - len(a));
        const su = suits.find(s2 => !this.void[opp][s2]) ?? suits[0];
        return low(h.filter(c => pqSuit(c) === su)); // lead low from the longest suit, to set it up
      }
      const lead = this.trick[0].c, su = pqSuit(lead);
      const win = ms.filter(c => pqSuit(c) === su && pqPow(c) > pqPow(lead));
      if (win.length) return low(win);
      if (pqSuit(ms[0]) === su) return low(ms);
      const spare = ms.filter(c => !master(c)); // throw a card that will not take a trick later
      const pool = spare.length ? spare : ms;
      const shortest = pool.reduce((x, y) => (h.filter(c => pqSuit(c) === pqSuit(y)).length < h.filter(c => pqSuit(c) === pqSuit(x)).length ? y : x));
      return low(pool.filter(c => pqSuit(c) === pqSuit(shortest)));
    },
    aiPlan(pl) {
      if (this.stage === 'exchange') { const cards = this.aiExchange(pl); return [{ pl, kind: 'exchange', cards }]; }
      return [{ pl, kind: 'play', c: this.aiCard(pl) }];
    },
  };

  /* ----------------------------------------------------------------- Whist
   * Four seats round the table, clockwise: 0 you (South), 1 West, 2 North, your
   * partner, 3 East. Cards use the cribbage numbering, suit * 13 + rank with
   * rank 0 the ace; wsPow ranks them for play, ace high. Seats 0 and 2 are
   * side 0, seats 1 and 3 side 1. */
  const WS_SEAT = ['You', 'West', 'North', 'East'];
  const WS_SIDE = ['You and North', 'West and East'];
  const WS_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const WS_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
  const wsSuit = c => (c / 13) | 0, wsPow = c => (c % 13 + 12) % 13;
  const wsName = c => `${WS_RANK[c % 13]} of ${WS_SUIT[wsSuit(c)]}`;
  const wsCard = (suit, pow) => suit * 13 + (pow + 1) % 13;
  const WHIST = {
    id: 'whist', name: 'Whist', dice: false, first: 0, target: 5,
    SEATS: WS_SEAT, SIDES: WS_SIDE, SUITS: WS_SUIT, suit: wsSuit, pow: wsPow, cardName: wsName,
    rules: [
      'You sit South. North, opposite you, is your partner, played by the Scribe; West and East, also the Scribe, play against you both. Play goes clockwise.',
      'Each of you holds thirteen cards. The dealer\'s last card is turned face up, and its suit is trumps for the deal. The player on the dealer\'s left leads to the first trick.',
      'Follow suit if you can; if you cannot, play any card, a trump or not. The highest trump wins the trick, or with no trump in it, the highest card of the suit led, aces high. The winner leads to the next trick.',
      'After thirteen tricks, the side that took more scores a point for every trick over six. Then honours: a side that held the ace, king, queen and jack of trumps between them scores 4, and a side that held three of the four scores 2. A side that began the deal on 4 cannot score honours.',
      'Tricks score before honours. The first side to 5 points wins the game.'
    ],
    source: 'Short whist, the 5-point game that replaced long whist in Britain, as described by John McLeod at pagat.com. We play a single game rather than a rubber of three.',
    init(deck) { this.score = [0, 0]; this.over = null; this.dealer = 3; this.hand = 0; this.seat = 0; this.notes = []; this.deal(deck); },
    deal(deck) {
      if (!deck) { deck = Array.from({ length: 52 }, (_, i) => i); for (let i = 51; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; } }
      // Dealt one at a time from the dealer's left, so the 52nd card, the dealer's last, is turned for trumps.
      this.hands = [[], [], [], []];
      deck.forEach((c, k) => this.hands[(this.dealer + 1 + k) % 4].push(c));
      this.hands.forEach(h => h.sort((a, b) => wsSuit(a) - wsSuit(b) || wsPow(a) - wsPow(b)));
      this.turnUp = deck[51]; this.trump = wsSuit(this.turnUp); this.upShown = true;
      this.trick = []; this.tricks = [0, 0]; this.played = []; this.lastTrick = null;
      this.void = [0, 1, 2, 3].map(() => [false, false, false, false]);
      this.need = 'play'; this.toMove = (this.dealer + 1) % 4; this.seat = this.toMove;
      this.start = this.score.slice(); this.hand++;
      this.honours = [0, 0];
      this.hands.forEach((h, s) => h.forEach(c => { if (wsSuit(c) === this.trump && wsPow(c) >= 9) this.honours[s & 1]++; }));
    },
    who(s) { return s === 0 ? 'You' : WS_SEAT[s]; },
    ledSuit() { return this.trick.length ? wsSuit(this.trick[0].card) : -1; },
    legalCards(hand) {
      const led = this.ledSuit(); if (led < 0) return hand.slice();
      const follow = hand.filter(c => wsSuit(c) === led);
      return follow.length ? follow : hand.slice();
    },
    beats(a, b) { const sa = wsSuit(a), sb = wsSuit(b); return sa === sb ? wsPow(a) > wsPow(b) : sa === this.trump; },
    best() { let b = this.trick[0]; for (const t of this.trick) if (this.beats(t.card, b.card)) b = t; return b; },
    legal(pl) {
      if (this.over) return [];
      if (this.need === 'next') return pl === 0 ? [{ pl, kind: 'next', label: 'Next deal' }] : [];
      const s = this.toMove; if ((s === 0) !== (pl === 0)) return [];
      return this.legalCards(this.hands[s]).map(card => ({ pl, seat: s, kind: 'play', card }));
    },
    apply(m) {
      if (m.kind === 'next') {
        this.dealer = (this.dealer + 1) % 4; this.deal();
        const d = this.dealer;
        return { note: `${this.who(d)} ${d ? 'deals' : 'deal'}, and the ${wsName(this.turnUp)} is turned: ${WS_SUIT[this.trump]} are trumps.`, events: [{ type: 'deal' }] };
      }
      const s = m.seat, hand = this.hands[s], led = this.ledSuit(), events = [{ type: 'play', seat: s, card: m.card }];
      hand.splice(hand.indexOf(m.card), 1);
      if (led >= 0 && wsSuit(m.card) !== led) this.void[s][led] = true;
      if (s === this.dealer) this.upShown = false; // the turned card joins the dealer's hand once the dealer plays
      this.trick.push({ seat: s, card: m.card }); this.played.push(m.card);
      if (this.trick.length < 4) { this.toMove = (s + 1) % 4; return { note: '', events }; }
      const w = this.best().seat;
      this.tricks[w & 1]++; this.lastTrick = { cards: this.trick.map(t => t.card), winner: w };
      this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      const notes = [`${this.who(w)} ${w ? 'takes' : 'take'} the trick.`];
      if (this.hands.every(h => !h.length)) this.endHand(notes);
      return { note: notes.join(' '), events };
    },
    endHand(notes) {
      const side = this.tricks[0] > 6 ? 0 : 1, odd = this.tricks[side] - 6;
      notes.push(`${WS_SIDE[side]} took ${this.tricks[side]} tricks: ${odd} point${odd > 1 ? 's' : ''}.`);
      this.score[side] += odd;
      if (this.score[side] >= this.target) this.win(side);
      else for (const t of [0, 1]) {
        const h = this.honours[t], pts = h === 4 ? 4 : h === 3 ? 2 : 0;
        if (!pts) continue;
        if (this.start[t] >= 4) { notes.push(`${WS_SIDE[t]} held ${h === 4 ? 'all four' : 'three'} honours, but a side at four cannot score them.`); continue; }
        this.score[t] += pts; notes.push(`${WS_SIDE[t]} held ${h === 4 ? 'all four' : 'three'} honours: ${pts} points.`);
        if (this.score[t] >= this.target) { this.win(t); break; }
      }
      this.notes = notes.slice();
      if (!this.over) { this.need = 'next'; this.toMove = 0; }
    },
    win(t) {
      const deals = `${this.hand} deal${this.hand > 1 ? 's' : ''}`;
      this.over = { winner: t, title: t ? 'West and East win' : 'You and North win', text: `The game ends ${this.score[0]} to ${this.score[1]}, after ${deals}.` };
    },
    passTurn() { if (this.over) return 0; this.seat = this.toMove; return this.seat === 0 ? 0 : 1; },
    get scribeName() { return this.seat === 2 ? 'North, your partner' : WS_SEAT[this.seat]; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    snapshot() { return JSON.stringify([this.hands, this.trick, this.toMove, this.tricks, this.played, this.void, this.need, this.score, this.over, this.upShown, this.lastTrick, this.seat, this.notes]); },
    restore(x) { [this.hands, this.trick, this.toMove, this.tricks, this.played, this.void, this.need, this.score, this.over, this.upShown, this.lastTrick, this.seat, this.notes] = JSON.parse(x); },
    // A sound card for seat s: cash winners, draw trumps when long in them, let partner ruff,
    // second hand low, third hand high, and win as cheaply as possible when an opponent leads the trick.
    heuristic(s) {
      const hand = this.hands[s], ms = this.legalCards(hand), T = this.trump, partner = (s + 2) % 4;
      if (ms.length === 1) return ms[0];
      const gone = new Set(this.played.concat(hand));
      const master = c => { for (let p = wsPow(c) + 1; p < 13; p++) if (!gone.has(wsCard(wsSuit(c), p))) return false; return true; };
      const low = a => a.reduce((x, y) => (wsPow(y) < wsPow(x) ? y : x));
      const high = a => a.reduce((x, y) => (wsPow(y) > wsPow(x) ? y : x));
      const of = k => hand.filter(c => wsSuit(c) === k);
      let trumpsAbroad = 0; for (let p = 0; p < 13; p++) if (!gone.has(wsCard(T, p))) trumpsAbroad++;
      const oppVoid = k => this.void[(s + 1) % 4][k] || this.void[(s + 3) % 4][k];
      if (!this.trick.length) {
        const cash = ms.filter(c => wsSuit(c) !== T && master(c) && !(oppVoid(wsSuit(c)) && trumpsAbroad));
        if (cash.length) return cash[0];
        const tr = of(T);
        if (tr.length >= 5 && trumpsAbroad) return master(high(tr)) ? high(tr) : low(tr);
        for (let k = 0; k < 4; k++) if (k !== T && of(k).length && this.void[partner][k] && !this.void[partner][T] && trumpsAbroad && !oppVoid(k)) return low(of(k));
        let best = -1; for (let k = 0; k < 4; k++) if (k !== T && of(k).length && (best < 0 || of(k).length > of(best).length)) best = k;
        if (best < 0) return master(high(tr)) ? high(tr) : low(tr);
        return low(of(best));
      }
      const led = this.ledSuit(), win = this.best(), following = wsSuit(ms[0]) === led && hand.some(c => wsSuit(c) === led);
      const winners = ms.filter(c => this.beats(c, win.card)), pos = this.trick.length; // pos: 1 second hand, 2 third, 3 fourth
      const discard = () => {
        const plain = ms.filter(c => wsSuit(c) !== T), pool = plain.length ? plain : ms, spare = pool.filter(c => !master(c));
        return low(spare.length ? spare : pool);
      };
      const duck = () => (following ? low(ms) : discard());
      if (win.seat === partner) {
        if (pos === 3 || master(win.card) || wsSuit(win.card) === T) return duck();
        const top = winners.filter(master); // third hand: overtake partner only with a sure winner
        return following && top.length ? low(top) : duck();
      }
      if (!winners.length) return duck();
      if (pos === 1) {
        if (!following) return low(winners); // ruff in second seat
        const top = winners.filter(master);
        return top.length ? low(top) : duck();
      }
      if (pos === 2 && following) { const top = winners.filter(master); return top.length ? low(top) : high(winners); }
      return low(winners);
    },
    aiPlan() {
      const s = this.toMove, ms = this.legalCards(this.hands[s]);
      const card = Math.random() < pick(0.45, 0.15, 0) ? ms[(Math.random() * ms.length) | 0] : this.heuristic(s); // the gentler Scribes play some cards carelessly
      return [{ pl: 1, seat: s, kind: 'play', card }];
    },
  };

  /* ---------------------------------------------------------- Rithmomachia
   * An 8 x 16 board: square i = r * 8 + c, with row 0 the visitor's back row.
   * A piece is { pl, shape, v }: shape 'c' round, 't' triangle, 's' square, 'p' pyramid.
   * The opening array is Boissière's (1556), as set out by Richards and Joyner. */
  const RM_STEP = { c: [1], t: [2], s: [3], p: [1, 2, 3] };
  const RM_WIN = 5;
  const RM_HOME = [ // [row, col, shape, value] for the Evens; the Odds' rows are listed from their own back row
    [0, 0, 's', 289], [0, 1, 's', 169], [0, 6, 's', 81], [0, 7, 's', 25],
    [1, 0, 's', 153], [1, 1, 'p', 91], [1, 2, 't', 49], [1, 3, 't', 42], [1, 4, 't', 20], [1, 5, 't', 25], [1, 6, 's', 45], [1, 7, 's', 15],
    [2, 0, 't', 81], [2, 1, 't', 72], [2, 2, 'c', 64], [2, 3, 'c', 36], [2, 4, 'c', 16], [2, 5, 'c', 4], [2, 6, 't', 6], [2, 7, 't', 9],
    [3, 2, 'c', 8], [3, 3, 'c', 6], [3, 4, 'c', 4], [3, 5, 'c', 2]
  ];
  const RM_ODDS = [
    [15, 0, 's', 361], [15, 1, 's', 225], [15, 6, 's', 121], [15, 7, 's', 49],
    [14, 0, 'p', 190], [14, 1, 's', 120], [14, 2, 't', 64], [14, 3, 't', 56], [14, 4, 't', 30], [14, 5, 't', 36], [14, 6, 's', 66], [14, 7, 's', 28],
    [13, 0, 't', 100], [13, 1, 't', 90], [13, 2, 'c', 81], [13, 3, 'c', 49], [13, 4, 'c', 25], [13, 5, 'c', 9], [13, 6, 't', 12], [13, 7, 't', 16],
    [12, 2, 'c', 9], [12, 3, 'c', 7], [12, 4, 'c', 5], [12, 5, 'c', 3]
  ];
  const RM_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const RM_SHAPE = { c: 'round', t: 'triangle', s: 'square', p: 'pyramid' };
  const RITHMO = {
    id: 'rithmo', name: 'Rithmomachia', dice: false, first: 0, WIN: RM_WIN, SHAPE: RM_SHAPE,
    rules: [
      'This is a modern reconstruction: the medieval rules were never fixed. You play the Evens, the white pieces, and move first. Every piece carries a number.',
      'Pieces move straight along a row or a column, never diagonally and never over another piece. Rounds move exactly one square, triangles exactly two and squares exactly three. The pyramid may move one, two or three.',
      'Meeting: move onto an enemy piece of exactly your piece\'s value to take it.',
      'After your move, any enemy piece caught in these ways is taken as well. Assault: one of your pieces, times the number of empty squares between it and the enemy along a row or column, makes the enemy\'s value. Ambuscade: two of your pieces on either side of it, in a row or column, add up to its value. Siege: your pieces or the board\'s edge close it in on all four sides.',
      `The pyramid counts as one piece of its full value: 91 for the Evens, 190 for the Odds. Take the Scribe\'s pyramid, or any ${RM_WIN} of its pieces, to win: victory by bodies, de corpore. A side with no move loses, and after 150 moves each, whoever has taken more wins.`
    ],
    source: 'A modern reconstruction. The array and the moves follow Claude de Boissière\'s book of 1556, as set out by J. F. C. Richards and Jeff Joyner; the four captures are the classic meeting, assault, ambuscade and siege. Pyramids are taken only whole.',
    init() {
      const b = Array(128).fill(null);
      for (const [r, c, shape, v] of RM_HOME) b[r * 8 + c] = { pl: 0, shape, v };
      for (const [r, c, shape, v] of RM_ODDS) b[r * 8 + c] = { pl: 1, shape, v };
      this.b = b; this.taken = [0, 0]; this.ply = 0; this.over = null;
    },
    on: (r, c) => r >= 0 && r < 16 && c >= 0 && c < 8,
    count(pl) { let n = 0; for (const p of this.b) if (p && p.pl === pl) n++; return n; },
    hasPyramid(pl) { return this.b.some(p => p && p.pl === pl && p.shape === 'p'); },
    legal(pl) {
      if (this.over) return [];
      const b = this.b, out = [];
      for (let i = 0; i < 128; i++) {
        const p = b[i]; if (!p || p.pl !== pl) continue;
        const r = i >> 3, c = i & 7;
        for (const [dr, dc] of RM_DIRS) {
          for (let d = 1; d <= 3; d++) {
            const rr = r + dr * d, cc = c + dc * d; if (!this.on(rr, cc)) break;
            const j = rr * 8 + cc, q = b[j];
            if (RM_STEP[p.shape].includes(d)) {
              if (!q) out.push({ pl, from: i, to: j });
              else if (q.pl !== pl && q.v === p.v) out.push({ pl, from: i, to: j, meet: true });
            }
            if (q) break; // nothing leaps
          }
        }
      }
      return out;
    },
    // Enemy pieces that pl now catches by assault, ambuscade or siege.
    caught(pl) {
      const b = this.b, out = [];
      for (let i = 0; i < 128; i++) {
        const e = b[i]; if (!e || e.pl === pl) continue;
        const r = i >> 3, c = i & 7, nb = [];
        let hit = false, closed = true;
        for (const [dr, dc] of RM_DIRS) {
          let k = 0, rr = r + dr, cc = c + dc;
          const first = this.on(rr, cc) ? b[rr * 8 + cc] : undefined;
          nb.push(first);
          if (first === undefined) continue; // the edge closes this side
          if (!first || first.pl !== pl) closed = false;
          while (this.on(rr, cc) && !b[rr * 8 + cc]) { k++; rr += dr; cc += dc; }
          if (k && this.on(rr, cc)) { const q = b[rr * 8 + cc]; if (q.pl === pl && q.v * k === e.v) hit = 'assault'; }
        }
        if (!hit) for (const [a, z] of [[0, 1], [2, 3]]) { const x = nb[a], y = nb[z]; if (x && y && x.pl === pl && y.pl === pl && x.v + y.v === e.v) hit = 'ambuscade'; }
        if (!hit && closed) hit = 'siege';
        if (hit) out.push([i, hit]);
      }
      return out;
    },
    apply(m) {
      const b = this.b, p = b[m.from], notes = [], caps = [];
      const name = (q, mine) => `${mine ? 'your' : 'the Scribe\'s'} ${q.shape === 'p' ? 'pyramid' : RM_SHAPE[q.shape] + ' ' + q.v}`;
      if (m.meet) { const q = b[m.to]; caps.push(m.to); this.taken[m.pl]++; notes.push(`${m.pl ? 'The Scribe meets and takes' : 'You meet and take'} ${name(q, m.pl === 1)}.`); if (q.shape === 'p') this.pyr = true; }
      b[m.to] = p; b[m.from] = null; this.ply++;
      const lost = [];
      for (const [i, how] of this.caught(m.pl)) { lost.push(name(b[i], m.pl === 1) + ` (${how})`); if (b[i].shape === 'p') this.pyr = true; b[i] = null; caps.push(i); this.taken[m.pl]++; }
      if (lost.length) notes.push(`${m.pl ? 'The Scribe takes' : 'You take'} ${lost.join(', ')}.`);
      const you = m.pl === 0;
      if (this.pyr) { this.pyr = false; this.over = { winner: m.pl, text: you ? 'You have taken the Scribe\'s pyramid.' : 'The Scribe has taken your pyramid.' }; }
      else if (this.taken[m.pl] >= RM_WIN) this.over = { winner: m.pl, text: you ? `You have taken ${RM_WIN} of the Scribe's pieces: victory by bodies, de corpore.` : `The Scribe has taken ${RM_WIN} of your pieces.` };
      return { note: notes.join(' '), caps };
    },
    result(pl) {
      if (this.over) return this.over;
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no move left, and lose.' : 'The Scribe has no move left.' };
      if (this.ply >= 300) {
        const [a, z] = this.taken;
        return { winner: a > z ? 0 : z > a ? 1 : -1, text: `A hundred and fifty moves each, and the more pieces taken wins. You took ${a}, the Scribe ${z}.` };
      }
      return null;
    },
    snapshot() { return [this.b.slice(), this.taken.slice(), this.ply, this.over]; },
    restore(s) { this.b = s[0].slice(); this.taken = s[1].slice(); this.ply = s[2]; this.over = s[3]; this.pyr = false; },
    turns(pl) { // meetings first, then moves forward
      const fwd = m => (pl === 0 ? 1 : -1) * ((m.to >> 3) - (m.from >> 3));
      return this.legal(pl).sort((a, b) => (b.meet ? 10 : 0) + fwd(b) - (a.meet ? 10 : 0) - fwd(a)).map(m => [m]);
    },
    terminal(pl, depth) {
      if (this.over) return this.over.winner === pl ? 1000 + depth : -1000 - depth;
      return null;
    },
    evaluate(pl) {
      let s = (this.taken[pl] - this.taken[1 - pl]) * 3;
      for (let i = 0; i < 128; i++) { // a little credit for coming forward into contact
        const p = this.b[i]; if (!p || p.shape === 'p') continue;
        const adv = p.pl === 0 ? (i >> 3) : 15 - (i >> 3);
        s += (p.pl === pl ? 1 : -1) * Math.min(adv, 8) * 0.12;
      }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 3); },
  };

  /* ---------------------------------------------------------------- Jungle
   * Dou shou qi on a 7 x 9 board. Square i = r * 7 + c, with row 0 the visitor's
   * home row. A piece is pl * 10 + rank (1 rat ... 8 elephant). The rivers fill
   * rows 3-5 of columns 1-2 and 4-5; each den sits mid-row with three traps. */
  const JU_NAME = ['', 'rat', 'cat', 'dog', 'wolf', 'leopard', 'tiger', 'lion', 'elephant'];
  const JU_VAL = [0, 4.5, 2, 3, 4, 5, 8, 9, 10];
  const JU_DEN = [3, 59];
  const JU_TRAP = (() => { const t = Array(63).fill(-1); for (const i of [2, 4, 10]) t[i] = 0; for (const i of [58, 60, 52]) t[i] = 1; return t; })();
  const JU_WATER = (() => { const w = Array(63).fill(false); for (let r = 3; r <= 5; r++) for (const c of [1, 2, 4, 5]) w[r * 7 + c] = true; return w; })();
  const JU_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const JUNGLE = {
    id: 'jungle', name: 'Jungle', dice: false, first: 0,
    NAME: JU_NAME, DEN: JU_DEN, TRAP: JU_TRAP, WATER: JU_WATER,
    rules: [
      'You play blue and move first. Each side has eight animals, strongest first: elephant, lion, tiger, leopard, wolf, dog, cat and rat.',
      'An animal moves one square forward, back or sideways, and takes an enemy of the same rank or lower by moving onto it. The one exception runs both ways: the rat can take the elephant, and the elephant cannot take the rat.',
      'Only the rat may swim. A rat in a river can be taken only by the other rat, also in the water, and a rat cannot take anything as it enters or leaves the water.',
      'The lion and the tiger leap straight across a river, along a row or a column, and may take what they land on. A rat in the water on the way blocks the leap.',
      'Three traps guard each den. An animal standing in its enemy\'s trap loses all its rank, and any enemy animal may take it.',
      'Walk any animal into the Scribe\'s den, or take all its animals, to win. You may never enter your own den. A position repeated three times, a side left with no move, or 50 moves each without a capture, is a draw.'
    ],
    source: 'Dou shou qi as played in China today. Some sets let only the lion leap sideways across the rivers; here the tiger may too.',
    init() {
      const b = Array(63).fill(0);
      const home = [[0, 0, 6], [0, 6, 7], [1, 1, 2], [1, 5, 3], [2, 0, 8], [2, 2, 4], [2, 4, 5], [2, 6, 1]]; // [row, col, rank], blue's side
      for (const [r, c, k] of home) { b[r * 7 + c] = k; b[(8 - r) * 7 + (6 - c)] = 10 + k; } // red is the same, turned half round
      this.b = b; this.ply = 0; this.quiet = 0; this.over = null;
      this.seen = new Map(); this.trail = [];
      this.mark(0);
    },
    owner: v => (v > 10 ? 1 : 0),
    rank: v => v % 10,
    key(pl) { return this.b.join('') + pl; },
    mark(pl) { const k = this.key(pl); this.seen.set(k, (this.seen.get(k) || 0) + 1); this.trail.push(k); },
    takes(pl, from, to) { // may the piece on from take what stands on to?
      const a = this.rank(this.b[from]), t = this.rank(this.b[to]);
      if (JU_WATER[from] !== JU_WATER[to]) return false; // no capture while entering or leaving the water
      if (a === 1 && t === 8) return true;
      if (JU_TRAP[to] === pl) return true; // an animal in its enemy's trap has no rank
      if (a === 8 && t === 1) return false;
      return a >= t;
    },
    targets(i) {
      const b = this.b, v = b[i], pl = this.owner(v), k = this.rank(v), r = (i / 7) | 0, c = i % 7, out = [];
      for (const [dr, dc] of JU_DIRS) {
        let rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 8 || cc < 0 || cc > 6) continue;
        let j = rr * 7 + cc, leap = false;
        if (j === JU_DEN[pl]) continue;
        if (JU_WATER[j] && k !== 1) {
          if (k !== 6 && k !== 7) continue;
          let blocked = false;
          while (JU_WATER[j]) { if (b[j]) blocked = true; rr += dr; cc += dc; j = rr * 7 + cc; }
          if (blocked) continue;
          leap = true;
        }
        const w = b[j];
        if (w && this.owner(w) === pl) continue;
        if (w && !this.takes(pl, i, j)) continue;
        out.push({ pl, from: i, to: j, cap: !!w, leap });
      }
      return out;
    },
    legal(pl) {
      if (this.over) return [];
      const out = [];
      for (let i = 0; i < 63; i++) { const v = this.b[i]; if (v && this.owner(v) === pl) out.push(...this.targets(i)); }
      return out;
    },
    count(pl) { let n = 0; for (const v of this.b) if (v && this.owner(v) === pl) n++; return n; },
    apply(m) {
      const b = this.b, v = b[m.from], victim = b[m.to];
      b[m.from] = 0; b[m.to] = v; this.ply++;
      this.quiet = victim ? 0 : this.quiet + 1;
      const you = m.pl === 0, who = you ? 'Your' : 'The Scribe\'s';
      let note = '';
      if (victim) note = you ? `Your ${JU_NAME[this.rank(v)]} takes the Scribe's ${JU_NAME[this.rank(victim)]}.` : `The Scribe's ${JU_NAME[this.rank(v)]} takes your ${JU_NAME[this.rank(victim)]}.`;
      else if (m.leap) note = `${who} ${JU_NAME[this.rank(v)]} leaps the river.`;
      if (m.to === JU_DEN[1 - m.pl]) this.over = { winner: m.pl, text: you ? `Your ${JU_NAME[this.rank(v)]} walks into the Scribe's den. You win.` : `The Scribe's ${JU_NAME[this.rank(v)]} walks into your den. The Scribe wins.` };
      else if (victim && !this.count(1 - m.pl)) this.over = { winner: m.pl, text: you ? 'You have taken every one of the Scribe\'s animals. You win.' : 'The Scribe has taken all your animals.' };
      this.mark(1 - m.pl);
      return { note, caps: victim ? [m.to] : [] };
    },
    result(pl) {
      if (this.over) return this.over;
      if (!this.legal(pl).length) return { winner: -1, text: pl === 0 ? 'You have no move left: a draw.' : 'The Scribe has no move left: a draw.' };
      if ((this.seen.get(this.key(pl)) || 0) >= 3) return { winner: -1, text: 'The same position has come round three times: a draw.' };
      if (this.quiet >= 100) return { winner: -1, text: 'Fifty moves each without a capture: a draw.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply, this.quiet, this.over, this.trail.length]; },
    restore(s) {
      this.b = s[0].slice(); this.ply = s[1]; this.quiet = s[2]; this.over = s[3];
      while (this.trail.length > s[4]) { const k = this.trail.pop(), n = this.seen.get(k) - 1; if (n) this.seen.set(k, n); else this.seen.delete(k); }
    },
    turns(pl) {
      const den = JU_DEN[1 - pl], dr = (den / 7) | 0;
      const val = m => {
        if (m.to === den) return 1000;
        let s = m.cap ? 10 * JU_VAL[this.rank(this.b[m.to])] - JU_VAL[this.rank(this.b[m.from])] : 0;
        const d = i => Math.abs(((i / 7) | 0) - dr) + Math.abs(i % 7 - 3);
        return s + (d(m.from) - d(m.to)) * 0.5;
      };
      return this.legal(pl).map(m => [m, val(m)]).sort((a, b) => b[1] - a[1]).map(x => [x[0]]);
    },
    terminal(pl, depth) {
      if (this.over) return this.over.winner === pl ? 1000 + depth : this.over.winner < 0 ? 0 : -1000 - depth;
      if ((this.seen.get(this.key(pl)) || 0) >= 2) return 0; // a repetition inside the search is as good as a draw
      if (!this.legal(pl).length) return 0;
      return null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 63; i++) {
        const v = this.b[i]; if (!v) continue;
        const p = this.owner(v), k = this.rank(v), den = JU_DEN[1 - p];
        const d = Math.abs(((i / 7) | 0) - ((den / 7) | 0)) + Math.abs(i % 7 - 3);
        let x = JU_VAL[k] + (12 - d) * 0.07;
        if (d <= 2) x += 0.6 / d; // pressing on the enemy den
        if (JU_TRAP[i] === 1 - p) x += 0.3; // standing in an enemy trap, next to the den
        s += p === pl ? x : -x;
      }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 6); },
  };

  const api = { DICE_P, LEVELS, setLevel, level: () => LEVEL.name, ur: UR, senet: SENET, morris: MORRIS, oware: OWARE, brandubh: BRANDUBH, tables: TABLES, shatranj: SHATRANJ, foxgeese: FOXGEESE, draughts: DRAUGHTS, goose: GOOSE, reversi: REVERSI, dotsboxes: DOTSBOXES, halma: HALMA, go: GO, alquerque: ALQUERQUE, snakes: SNAKES, xiangqi: XIANGQI, tarocchi: TAROCCHI, mutorere: MUTORERE, konane: KONANE, fanorona: FANORONA, chess: CHESS, shogi: SHOGI, yut: YUT, pachisi: PACHISI, mahjong: MAHJONG, bao: BAO, landlord: LANDLORD, chinese: CHINESE, hex: HEX, gomoku: GOMOKU, dominoes: DOMINOES, tablut: TABLUT, makruk: MAKRUK, kalah: KALAH, cribbage: CRIBBAGE, morabaraba: MORABARABA, ludo: LUDO, janggi: JANGGI, chaturaji: CHATURAJI, seega: SEEGA, tab: TAB, baghchal: BAGHCHAL, fourseasons: FOURSEASONS, hounds: HOUNDS, latrunculi: LATRUNCULI, patolli: PATOLLI, mansion: MANSION, lifegame: LIFEGAME, jungle: JUNGLE, chaturanga: CHATURANGA, whist: WHIST, rithmo: RITHMO, lewischess: LEWISCHESS, courier: COURIER, hazard: HAZARD, piquet: PIQUET, nard: NARD, xii: XII, koikoi: KOIKOI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LibrariumRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
