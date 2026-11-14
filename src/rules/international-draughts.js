  /* ------------------------------------------------- International draughts
   * 10 x 10, square i = r * 10 + c on the dark squares, (r + c) even. Player 0,
   * the visitor, plays white from rows 0-3 and moves first. Values as DRAUGHTS:
   * 1 man, 2 king for white; 3 man, 4 king for black. A move is a whole turn,
   * with every square it lands on and every piece it takes. */
  const ID_N = 10, ID_DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const IDRAUGHTS = {
    id: 'idraughts', name: 'International draughts', dice: false, first: 0, N: ID_N,
    rules: [
      'You play white and move first, on the dark squares of a board of ten by ten. Each side has twenty men.',
      'A man steps one square diagonally forward. It captures by jumping an enemy piece next to it into the empty square beyond, forwards or backwards, and keeps jumping while it can.',
      'Capturing is compulsory, and you must take the largest number of pieces you can. Pieces taken are lifted only when the move is over, and none may be jumped twice.',
      'A man that ends its move on the far row becomes a king. Kings fly: they move any distance diagonally, and capture an enemy piece at any distance along a diagonal, landing on any empty square beyond it.',
      'You win when the Scribe has no pieces or no legal move. Twenty-five moves each with only kings moving and nothing taken is a draw.'
    ],
    source: 'The rules of the World Draughts Federation (FMJD), with the draw rules simplified to one: twenty-five moves each of kings alone, with no capture.',
    init() {
      const b = Array(100).fill(0);
      for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if ((r + c) % 2 === 0) { if (r <= 3) b[r * 10 + c] = 1; else if (r >= 6) b[r * 10 + c] = 3; }
      this.b = b; this.quiet = 0; this.ply = 0;
    },
    owner: v => (v >= 3 ? 1 : 0),
    king: v => v === 2 || v === 4,
    on: (r, c) => r >= 0 && r < ID_N && c >= 0 && c < ID_N,
    count(pl) { let n = 0; for (const v of this.b) if (v && this.owner(v) === pl) n++; return n; },
    captures(pl) {
      const b = this.b, out = [];
      for (let i = 0; i < 100; i++) {
        const v = b[i]; if (!v || this.owner(v) !== pl) continue;
        const king = this.king(v);
        const walk = (at, path, caps) => {
          const r = (at / 10) | 0, c = at % 10; let more = false;
          for (const [dr, dc] of ID_DIAG) {
            let rr = r + dr, cc = c + dc;
            if (king) while (this.on(rr, cc) && (!b[rr * 10 + cc] || rr * 10 + cc === i)) { rr += dr; cc += dc; } // a flying king looks down the diagonal
            if (!this.on(rr, cc)) continue;
            const mid = rr * 10 + cc, mv = b[mid];
            if (!mv || mid === i || this.owner(mv) === pl || caps.includes(mid)) continue;
            let lr = rr + dr, lc = cc + dc;
            while (this.on(lr, lc)) {
              const land = lr * 10 + lc;
              if (b[land] && land !== i) break;
              more = true; walk(land, path.concat([land]), caps.concat([mid]));
              if (!king) break;
              lr += dr; lc += dc;
            }
          }
          if (!more && caps.length) out.push({ pl, from: i, to: at, path, caps });
        };
        walk(i, [], []);
      }
      if (!out.length) return out;
      const most = Math.max(...out.map(m => m.caps.length));
      return out.filter(m => m.caps.length === most);
    },
    legal(pl) {
      const caps = this.captures(pl);
      const fin = m => { const v = this.b[m.from]; if (!this.king(v) && ((m.to / 10) | 0) === (pl ? 0 : 9)) m.crown = true; return m; };
      if (caps.length) return caps.map(fin);
      const b = this.b, out = [];
      for (let i = 0; i < 100; i++) {
        const v = b[i]; if (!v || this.owner(v) !== pl) continue;
        const r = (i / 10) | 0, c = i % 10, king = this.king(v);
        for (const [dr, dc] of ID_DIAG) {
          if (!king && dr !== (pl ? -1 : 1)) continue;
          let rr = r + dr, cc = c + dc;
          while (this.on(rr, cc) && !b[rr * 10 + cc]) { out.push(fin({ pl, from: i, to: rr * 10 + cc, path: [rr * 10 + cc], caps: [] })); if (!king) break; rr += dr; cc += dc; }
        }
      }
      return out;
    },
    apply(m) {
      const b = this.b, v = b[m.from], kingMove = this.king(v);
      b[m.from] = 0; for (const k of m.caps) b[k] = 0;
      b[m.to] = m.crown ? (m.pl ? 4 : 2) : v;
      this.ply++; this.quiet = m.caps.length || !kingMove ? 0 : this.quiet + 1;
      const you = m.pl === 0, n = m.caps.length;
      let note = n ? (you ? `You take ${n === 1 ? 'a piece' : n + ' pieces'}.` : `The Scribe takes ${n === 1 ? 'one of your pieces' : n + ' of your pieces'}.`) : '';
      if (m.crown) note += you ? ' Your man is crowned.' : ' The Scribe crowns a king.';
      return { note: note.trim(), caps: m.caps.slice() };
    },
    result(pl) {
      if (!this.count(pl) || !this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no move left. The Scribe wins.' : 'The Scribe has no move left. You win.' };
      if (this.quiet >= 50) return { winner: -1, text: 'Twenty-five moves each of kings alone, with nothing taken: a draw.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.quiet, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.quiet = s[1]; this.ply = s[2]; },
    turns(pl) { return this.legal(pl).sort((a, b) => b.caps.length - a.caps.length || (b.crown ? 1 : 0) - (a.crown ? 1 : 0)).map(m => [m]); },
    terminal(pl, depth) {
      if (!this.count(pl) || !this.legal(pl).length) return -1000 - depth;
      if (this.quiet >= 50) return 0;
      return null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 100; i++) {
        const v = this.b[i]; if (!v) continue;
        const o = this.owner(v), r = (i / 10) | 0, c = i % 10;
        let x = this.king(v) ? 3.3 : 1 + 0.03 * (o === 0 ? r : 9 - r);
        if (!this.king(v) && c >= 3 && c <= 6) x += 0.04; // the centre
        if (!this.king(v) && (o === 0 ? r === 0 : r === 9)) x += 0.05; // the back row guards the crowning squares
        s += o === pl ? x : -x;
      }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 6); },
  };

