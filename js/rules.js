/*
 * Librarium Museum of Play: game rules.
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
    init() { this.board = Array(24).fill(-1); this.hand = [9, 9]; this.quiet = 0; },
    onBoard(pl) { let n = 0; for (const v of this.board) if (v === pl) n++; return n; },
    count(pl) { return this.hand[pl] + this.onBoard(pl); },
    inMill(p, pl) { return MORRIS_MILLS.some(m => m.includes(p) && m.every(q => this.board[q] === pl)); },
    legal(pl) {
      const b = this.board, out = [];
      if (this.hand[pl] > 0) { for (let p = 0; p < 24; p++) if (b[p] < 0) out.push({ type: 'place', pl, to: p }); return out; }
      const fly = this.onBoard(pl) === 3;
      for (let p = 0; p < 24; p++) {
        if (b[p] !== pl) continue;
        const targets = fly ? b.map((v, q) => (v < 0 ? q : -1)).filter(q => q >= 0) : MORRIS_ADJ[p].filter(q => b[q] < 0);
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
      for (const mill of MORRIS_MILLS) {
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
      'Museum rule: after 150 moves each the game is drawn.'
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
    source: 'The common rules with six cowries (pachisi has no single standard). As in some versions, each colour\'s first piece may come out on any throw; later ones need a grace. Each throw is moved at once rather than collected first, and the short game uses two pieces per colour so it fits a museum visit.',
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
   * museum's two-sided turns, "player 1" is the three Scribes together:
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
      'The first to go out wins the hand. If the wall runs out first, the hand is drawn. Scoring varies so much between rule sets that the museum leaves it out.'
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
      'Museum rule: if the geese go twenty moves without moving forward or losing a goose, the fox slips away and wins.'
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
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 6); },
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
      'Museum rule: sixty moves each with no capture is a draw.'
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
      'Museum rule: after thirty moves each the game is drawn. With perfect play mū tōrere is a draw.'
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
      'Take every enemy stone to win. Museum rule: twenty moves each with no capture is a draw.'
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
      'Museum rule: after two hundred moves each, whoever has more men home wins, then whoever is closer overall.'
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

  const api = { DICE_P, LEVELS, setLevel, level: () => LEVEL.name, ur: UR, senet: SENET, morris: MORRIS, oware: OWARE, brandubh: BRANDUBH, tables: TABLES, shatranj: SHATRANJ, foxgeese: FOXGEESE, draughts: DRAUGHTS, goose: GOOSE, reversi: REVERSI, dotsboxes: DOTSBOXES, halma: HALMA, go: GO, alquerque: ALQUERQUE, snakes: SNAKES, xiangqi: XIANGQI, tarocchi: TAROCCHI, mutorere: MUTORERE, konane: KONANE, fanorona: FANORONA, chess: CHESS, shogi: SHOGI, yut: YUT, pachisi: PACHISI, mahjong: MAHJONG, bao: BAO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LibrariumRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
