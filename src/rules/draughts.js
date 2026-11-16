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

