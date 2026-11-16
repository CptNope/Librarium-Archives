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

