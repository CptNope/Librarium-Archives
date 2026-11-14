  /* ---------------------------------------------------------- Courier chess
   * A 12 x 8 board: square i = r * 12 + c, row 0 the visitor's back rank.
   * A piece is pl * 16 + type. The old opening leaps (the rook pawns, the
   * queen's pawn and the queen, two squares each) are already made. */
  const CO = { K: 1, F: 2, E: 3, C: 4, S: 5, M: 6, N: 7, R: 8, P: 9 };
  const CO_NAME = ['', 'king', 'queen', 'bishop', 'courier', 'schleich', 'sage', 'knight', 'rook', 'pawn'];
  const CO_VAL = [0, 0, 1.6, 1.3, 4.2, 1.7, 3, 3, 5, 1];
  const CO_KING8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const CO_DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], CO_ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const CO_KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const COURIER = {
    id: 'courier', name: 'Courier chess', dice: false, first: 0, CO, NAME: CO_NAME,
    rules: [
      'You play white and move first, on a board of twelve files. The old opening leaps are already made: your rook pawns and queen\'s pawn have jumped two squares, and so has your queen.',
      'The king moves one square any way, the rook and knight as in modern chess. The courier, the piece the game is named for, runs any distance diagonally like a modern bishop.',
      'The queen (fers) steps one square diagonally, and the bishop (alfil) jumps exactly two squares diagonally. The sage (Mann) moves like a king but is not royal. The schleich (fool) steps one square straight.',
      'Pawns step one square forward and take one square diagonally forward, never two at once. On the far rank a pawn becomes a queen.',
      'Checkmate wins. There is no castling. A stalemate, two bare kings, or a long stretch with no capture or pawn move is a draw.'
    ],
    source: 'Courier chess as Gustavus Selenus described it in 1616, as played at Ströbeck. Stalemate is not recorded, so it is a draw here, and a pawn becomes a queen at once rather than by the slower old procedures.',
    init() {
      const b = Array(96).fill(0);
      const back = [CO.R, CO.N, CO.E, CO.C, CO.M, CO.K, CO.F, CO.S, CO.C, CO.E, CO.N, CO.R];
      for (let c = 0; c < 12; c++) { b[c] = back[c]; b[12 + c] = CO.P; b[84 + c] = back[c] + 16; b[72 + c] = CO.P + 16; }
      for (const c of [0, 6, 11]) { b[12 + c] = 0; b[36 + c] = CO.P; b[72 + c] = 0; b[48 + c] = CO.P + 16; } // the opening leaps
      b[6] = 0; b[24 + 6] = CO.F; b[84 + 6] = 0; b[60 + 6] = CO.F + 16;
      this.b = b; this.quiet = 0; this.ply = 0;
    },
    owner: v => v >> 4,
    type: v => v & 15,
    on: (r, c) => r >= 0 && r < 8 && c >= 0 && c < 12,
    kingAt(pl) { return this.b.indexOf(CO.K + pl * 16); },
    attacked(sq, by) {
      const b = this.b, r = (sq / 12) | 0, c = sq % 12;
      const is = (rr, cc, ...ts) => { if (!this.on(rr, cc)) return false; const v = b[rr * 12 + cc]; return v && (v >> 4) === by && ts.includes(v & 15); };
      for (const [dr, dc] of CO_KNIGHT) if (is(r + dr, c + dc, CO.N)) return true;
      for (const [dr, dc] of CO_KING8) if (is(r + dr, c + dc, CO.K, CO.M)) return true;
      for (const [dr, dc] of CO_DIAG) if (is(r + dr, c + dc, CO.F) || is(r + 2 * dr, c + 2 * dc, CO.E)) return true;
      for (const [dr, dc] of CO_ORTH) if (is(r + dr, c + dc, CO.S)) return true;
      const pr = by === 0 ? r - 1 : r + 1;
      if (is(pr, c - 1, CO.P) || is(pr, c + 1, CO.P)) return true;
      for (const [dirs, t] of [[CO_DIAG, CO.C], [CO_ORTH, CO.R]]) for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (this.on(rr, cc)) { const v = b[rr * 12 + cc]; if (v) { if ((v >> 4) === by && (v & 15) === t) return true; break; } rr += dr; cc += dc; }
      }
      return false;
    },
    inCheck(pl) { const k = this.kingAt(pl); return k >= 0 && this.attacked(k, 1 - pl); },
    pseudo(pl) {
      const b = this.b, out = [];
      for (let i = 0; i < 96; i++) {
        const v = b[i]; if (!v || (v >> 4) !== pl) continue;
        const t = v & 15, r = (i / 12) | 0, c = i % 12;
        const add = (rr, cc, capOnly, quietOnly) => {
          if (!this.on(rr, cc)) return false;
          const j = rr * 12 + cc, w = b[j];
          if (w && (w >> 4) === pl) return false;
          if (w && quietOnly) return false;
          if (!w && capOnly) return true;
          const m = { pl, from: i, to: j, cap: w };
          if (t === CO.P && rr === (pl ? 0 : 7)) m.promo = true;
          out.push(m); return !w;
        };
        const slide = dirs => { for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (add(rr, cc)) { rr += dr; cc += dc; } } };
        if (t === CO.K || t === CO.M) CO_KING8.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === CO.F) CO_DIAG.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === CO.E) CO_DIAG.forEach(([dr, dc]) => add(r + 2 * dr, c + 2 * dc));
        else if (t === CO.S) CO_ORTH.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === CO.N) CO_KNIGHT.forEach(([dr, dc]) => add(r + dr, c + dc));
        else if (t === CO.C) slide(CO_DIAG);
        else if (t === CO.R) slide(CO_ORTH);
        else if (t === CO.P) { const f = pl ? -1 : 1; add(r + f, c, false, true); add(r + f, c - 1, true); add(r + f, c + 1, true); }
      }
      return out;
    },
    raw(m) {
      const b = this.b, v = b[m.from];
      b[m.to] = m.promo ? CO.F + 16 * m.pl : v; b[m.from] = 0;
      this.quiet = m.cap || (v & 15) === CO.P ? 0 : this.quiet + 1; this.ply++;
    },
    legal(pl) { return this.pseudo(pl).filter(m => { const s = this.snapshot(); this.raw(m); const ok = !this.inCheck(pl); this.restore(s); return ok; }); },
    material(pl) { let n = 0; for (const v of this.b) if (v && (v >> 4) === pl && (v & 15) !== CO.K) n++; return n; },
    apply(m) {
      this.raw(m);
      const parts = [], you = m.pl === 0;
      if (m.cap) parts.push(you ? `You take the Scribe's ${CO_NAME[m.cap & 15]}.` : `The Scribe takes your ${CO_NAME[m.cap & 15]}.`);
      if (m.promo) parts.push(you ? 'Your pawn becomes a queen.' : 'The Scribe\'s pawn becomes a queen.');
      if (this.inCheck(1 - m.pl)) parts.push(you ? 'Check.' : 'Check!');
      return { note: parts.join(' '), caps: m.cap ? [m.to] : [] };
    },
    result(pl) {
      if (!this.legal(pl).length) return this.inCheck(pl)
        ? { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate.' }
        : { winner: -1, text: pl === 0 ? 'You are stalemated: a draw.' : 'The Scribe is stalemated: a draw.' };
      if (!this.material(0) && !this.material(1)) return { winner: -1, text: 'Both kings stand bare. The game is drawn.' };
      if (this.quiet >= 100) return { winner: -1, text: 'Fifty moves each with no capture or pawn move. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.quiet, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.quiet = s[1]; this.ply = s[2]; },
    turns(pl) {
      const val = m => (m.cap ? 10 * CO_VAL[m.cap & 15] - CO_VAL[this.b[m.from] & 15] : 0) + (m.promo ? 5 : 0);
      return this.legal(pl).sort((a, b) => val(b) - val(a)).map(m => [m]);
    },
    terminal(pl, depth) {
      if (!this.pseudo(pl).some(m => { const s = this.snapshot(); this.raw(m); const ok = !this.inCheck(pl); this.restore(s); return ok; })) return this.inCheck(pl) ? -1000 - depth : 0;
      if (this.quiet >= 100) return 0;
      return null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 96; i++) {
        const v = this.b[i]; if (!v) continue;
        const o = v >> 4, t = v & 15, r = (i / 12) | 0, c = i % 12;
        let x = CO_VAL[t];
        if (t === CO.P) x += 0.05 * (o === 0 ? r - 1 : 6 - r);
        else if (t !== CO.K && t !== CO.R) x += 0.06 * (3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 5.5) / 1.5));
        s += o === pl ? x : -x;
      }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

