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

