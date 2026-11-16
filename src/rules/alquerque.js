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

