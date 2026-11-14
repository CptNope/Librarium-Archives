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

