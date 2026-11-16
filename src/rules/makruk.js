  /* ------------------------------------------------------------------ Makruk
   * Thai chess. Index r*8+c, row 0 nearest the visitor (white). Piece codes:
   * 1 khun (king), 2 met, 3 khon, 4 ma, 5 ruea, 6 bia (pawn), 7 promoted bia; +8 for the Scribe. */
  const MK_K = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], MK_D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const MK_N = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]], MK_R = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const MK_VAL = [0, 0, 2, 3, 3.2, 5, 1, 2];
  const MAKRUK = {
    id: 'makruk', name: 'Makruk', dice: false, first: 0,
    rules: [
      'You play white and move first. Checkmate the Scribe\'s khun (king) to win.',
      'Khun: one square any way. Ruea (boat): like a rook. Ma (horse): like a knight. Khon (nobleman): one square diagonally, or one straight forward. Met (seed): one square diagonally.',
      'Bia (cowrie, the pawn): one square forward, capturing one square diagonally forward. No double first step. A bia reaching the sixth rank turns over and moves like a met.',
      'There is no castling. Stalemate is a draw.',
      'Counting: when no unpromoted bia is left, the side behind may count, and mate must come within 64 moves. When a side is down to its khun alone, the other must mate within a limit set by its pieces (8 moves with two rueas, 16 with one, and so on), counted from the number of pieces on the board. Otherwise the game is drawn.'
    ],
    source: 'Makruk as played in Thailand today, with the counting rules simplified: the count is kept for you.',
    init() {
      const b = new Array(64).fill(0), back = [5, 4, 3, 1, 2, 3, 4, 5], top = [5, 4, 3, 2, 1, 3, 4, 5];
      for (let c = 0; c < 8; c++) { b[c] = back[c]; b[16 + c] = 6; b[40 + c] = 14; b[56 + c] = top[c] + 8; }
      this.b = b; this.ply = 0; this.count = null; this.over = null;
    },
    side(v) { return v ? (v > 8 ? 1 : 0) : -1; },
    kingAt(pl) { const k = pl ? 9 : 1; return this.b.indexOf(k); },
    attacked(i, by) { // is square i attacked by player by?
      const b = this.b, r = i >> 3, c = i & 7, own = v => v && this.side(v) === by, t = v => v & 7;
      for (const [dr, dc] of MK_N) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { const v = b[rr * 8 + cc]; if (own(v) && t(v) === 4) return true; } }
      for (const [dr, dc] of MK_R) { let rr = r + dr, cc = c + dc; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { const v = b[rr * 8 + cc]; if (v) { if (own(v) && t(v) === 5) return true; break; } rr += dr; cc += dc; } }
      for (const [dr, dc] of MK_K) {
        const rr = r + dr, cc = c + dc; if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
        const v = b[rr * 8 + cc]; if (!own(v)) continue;
        const tt = t(v), fwd = by === 0 ? 1 : -1, diag = dr !== 0 && dc !== 0;
        if (tt === 1) return true;
        if ((tt === 2 || tt === 7) && diag) return true;
        if (tt === 3 && (diag || (dc === 0 && dr === -fwd))) return true; // a khon attacks diagonally and straight forward
        if (tt === 6 && diag && dr === -fwd) return true;
      }
      return false;
    },
    pseudo(pl) {
      const b = this.b, out = [], fwd = pl === 0 ? 1 : -1;
      for (let i = 0; i < 64; i++) {
        const v = b[i]; if (!v || this.side(v) !== pl) continue;
        const t = v & 7, r = i >> 3, c = i & 7;
        const add = (rr, cc, capOnly, quietOnly) => {
          if (rr < 0 || rr > 7 || cc < 0 || cc > 7) return false;
          const j = rr * 8 + cc, w = b[j];
          if (w && this.side(w) === pl) return false;
          if (w && quietOnly) return false;
          if (!w && capOnly) return true;
          out.push({ pl, from: i, to: j, cap: !!w }); return !w;
        };
        if (t === 1) MK_K.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === 2 || t === 7) MK_D.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === 3) { MK_D.forEach(([dr, dc]) => add(r + dr, c + dc)); add(r + fwd, c); }
        else if (t === 4) MK_N.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === 5) MK_R.forEach(([dr, dc]) => { let rr = r + dr, cc = c + dc; while (add(rr, cc)) { rr += dr; cc += dc; } });
        else if (t === 6) { add(r + fwd, c, false, true); add(r + fwd, c - 1, true); add(r + fwd, c + 1, true); }
      }
      return out;
    },
    legal(pl) {
      if (this.over) return [];
      return this.pseudo(pl).filter(m => { const s = this.snapshot(); this.move(m); const ok = !this.attacked(this.kingAt(pl), 1 - pl); this.restore(s); return ok; });
    },
    move(m) {
      const b = this.b, v = b[m.from]; b[m.from] = 0; b[m.to] = v;
      const promoRow = m.pl === 0 ? 5 : 2;
      if ((v & 7) === 6 && (m.to >> 3) === promoRow) { b[m.to] = 7 + (m.pl ? 8 : 0); m.promo = true; }
      this.ply++;
    },
    material(pl) { let s = 0; for (const v of this.b) if (v && this.side(v) === pl) s += MK_VAL[v & 7]; return s; },
    pieces(pl) { let n = 0; for (const v of this.b) if (v && this.side(v) === pl) n++; return n; },
    apply(m) {
      const captured = this.b[m.to];
      this.move(m);
      // The counts: start them when their conditions first hold, and step them each move.
      const pawns = this.b.some(v => (v & 7) === 6);
      for (const lone of [0, 1]) {
        if (this.pieces(lone) === 1 && (!this.count || this.count.kind !== 'pieces')) {
          const strong = 1 - lone, has = t => this.b.filter(v => v && this.side(v) === strong && (v & 7) === t).length;
          const lim = has(5) >= 2 ? 8 : has(5) === 1 ? 16 : has(3) >= 2 ? 22 : has(4) >= 2 ? 32 : has(3) === 1 ? 44 : 64;
          this.count = { kind: 'pieces', lone, n: this.pieces(0) + this.pieces(1), lim };
        }
      }
      if (!pawns && !this.count) this.count = { kind: 'board', n: 0, lim: 64 };
      let note = '';
      if (this.count && m.pl === (this.count.kind === 'pieces' ? this.count.lone : this.behind())) { this.count.n++; }
      const opp = 1 - m.pl, check = this.attacked(this.kingAt(opp), m.pl);
      if (m.promo) note = m.pl === 0 ? 'Your bia turns over: it now moves like a met.' : 'The Scribe\'s bia turns over.';
      if (check) note = (note ? note + ' ' : '') + (m.pl === 0 ? 'Check.' : 'Check!');
      return { note, caps: captured ? [m.to] : [] };
    },
    behind() { return this.material(0) <= this.material(1) ? 0 : 1; },
    result(pl) {
      const ms = this.legal(pl);
      if (!ms.length) {
        if (this.attacked(this.kingAt(pl), 1 - pl)) return { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate.' };
        return { winner: -1, text: 'Stalemate. In makruk that is a draw.' };
      }
      if (this.count && this.count.n >= this.count.lim) return { winner: -1, text: this.count.kind === 'pieces' ? 'The count ran out before mate: a draw.' : 'Sixty-four moves counted without mate: a draw.' };
      if (this.pieces(0) === 1 && this.pieces(1) === 1) return { winner: -1, text: 'Only the two khuns are left: a draw.' };
      if (this.ply >= 400) return { winner: -1, text: 'Two hundred moves each: a draw.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply, this.count ? Object.assign({}, this.count) : null]; },
    restore(s) { this.b = s[0].slice(); this.ply = s[1]; this.count = s[2] ? Object.assign({}, s[2]) : null; },
    turns(pl) {
      const ms = this.legal(pl);
      const val = m => (this.b[m.to] ? 10 * MK_VAL[this.b[m.to] & 7] - MK_VAL[this.b[m.from] & 7] : 0);
      ms.sort((a, b) => val(b) - val(a));
      return ms.map(m => [m]);
    },
    terminal(pl, depth) {
      if (!this.legal(pl).length) return this.attacked(this.kingAt(pl), 1 - pl) ? -1000 - depth : 0;
      if (this.count && this.count.n >= this.count.lim) return 0;
      return null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v) continue;
        const p = this.side(v), t = v & 7, r = i >> 3, c = i & 7;
        let x = MK_VAL[t] + (t !== 1 && t !== 5 ? 0.05 * (3.5 - Math.abs(c - 3.5)) : 0);
        if (t === 6) x += 0.08 * (p === 0 ? r - 2 : 5 - r);
        s += p === pl ? x : -x;
      }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 5); },
  };

