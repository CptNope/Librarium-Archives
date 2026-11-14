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

