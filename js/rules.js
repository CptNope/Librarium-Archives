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
        s += m.to * 0.6 + Math.random() * 3;
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
        s += (m.to === 31 ? 30 : m.water ? 0 : m.to) * 0.5 + Math.random() * 3;
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
  function negamax(G, pl, depth, alpha, beta) {
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
  function bestPlan(G, pl, depth) {
    let best = null, bv = -Infinity;
    for (const seq of G.turns(pl)) {
      const s = G.snapshot();
      for (const m of seq) G.apply(m);
      const v = -negamax(G, 1 - pl, depth - 1, -Infinity, Infinity) + Math.random() * 0.6;
      G.restore(s);
      if (v > bv) { bv = v; best = seq; }
    }
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
    aiPlan(pl, depth) { return bestPlan(this, pl, depth || (this.hand[pl] > 0 ? 3 : 4)); },
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
    aiPlan(pl, depth) { return bestPlan(this, pl, depth || 8); },
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
    aiPlan(pl, depth) { return bestPlan(this, pl, depth || 4); },
  };

  /* ----------------------------------------------------- Tables (backgammon)
   * Each player counts points from their own side: 24 is where they start,
   * 1-6 is their home board, 25 is the bar and 0 is borne off. A player's
   * point p is the opponent's point 25 - p. A turn is a sequence of single
   * moves; legal() works out every full sequence, and apply() narrows them
   * as moves are made, returning the next choices as a follow-up. */
  const TABLES = {
    id: 'tables', name: 'Tables', dice: true, first: 0, N: 15, sides: ['pale checkers', 'dark checkers'],
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
        const v = this.evaluate(pl) + Math.random() * 0.3;
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
    aiPlan(pl, depth) { return bestPlan(this, pl, depth || 4); },
  };

  const api = { DICE_P, ur: UR, senet: SENET, morris: MORRIS, oware: OWARE, brandubh: BRANDUBH, tables: TABLES, shatranj: SHATRANJ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LibrariumRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
