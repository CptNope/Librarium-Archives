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

