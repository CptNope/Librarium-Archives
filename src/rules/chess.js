  /* ------------------------------------------------------------------ Chess
   * The modern game, played on at the New Queen. Same board layout as
   * shatranj: index r*8+c, rank 0 nearest the visitor, a square holds
   * type + 8*player: 1 king, 2 queen, 3 bishop, 4 knight, 5 rook, 6 pawn. */
  const CH = { K: 1, Q: 2, B: 3, N: 4, R: 5, P: 6 };
  const CH_VALUE = [0, 0, 9, 3.2, 3, 5, 1];
  const CHESS = {
    id: 'chess', name: 'Chess', dice: false, first: 0, CH,
    rules: [
      'You play white and move first. The queen moves any distance in any direction, the bishop any distance diagonally: the two changes of the 1470s that made chess fast.',
      'The rook moves any distance across or up and down, the knight jumps in an L, and the king steps one square in any direction.',
      'A pawn steps forward one square, or two from its first square, and captures one square diagonally forward. It may take a pawn that has just passed it with a double step (en passant). On the far rank it becomes a queen.',
      'Castling: if neither the king nor that rook has moved, nothing stands between them, and the king is not in check or passing through an attacked square, move the king two squares toward the rook. The rook jumps to the king\'s other side.',
      'Checkmate wins. Stalemate, bare kings, or fifty moves each with no capture or pawn move are draws.'
    ],
    source: 'Modern rules, with pawns always promoting to a queen and no draw by repetition.',
    init() {
      const b = Array(64).fill(0);
      const back = [CH.R, CH.N, CH.B, CH.Q, CH.K, CH.B, CH.N, CH.R];
      for (let c = 0; c < 8; c++) { b[c] = back[c]; b[8 + c] = CH.P; b[48 + c] = CH.P + 8; b[56 + c] = back[c] + 8; }
      this.b = b; this.quiet = 0; this.ply = 0; this.ep = -1;
      this.castle = [[true, true], [true, true]]; // [queen side, king side] for each player
    },
    owner: v => (v > 8 ? 1 : 0),
    type: v => v & 7,
    on: (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8,
    count(pl) { let n = 0; for (const v of this.b) if (v && this.owner(v) === pl) n++; return n; },
    attacked(sq, by) {
      const b = this.b, r = sq >> 3, c = sq & 7;
      const is = (rr, cc, ...ts) => { if (!this.on(rr, cc)) return false; const v = b[rr * 8 + cc]; return v && this.owner(v) === by && ts.includes(this.type(v)); };
      for (const [dr, dc] of SH_KNIGHT) if (is(r + dr, c + dc, CH.N)) return true;
      for (const [dr, dc] of SH_KING) if (is(r + dr, c + dc, CH.K)) return true;
      const pr = by === 0 ? r - 1 : r + 1;
      if (is(pr, c - 1, CH.P) || is(pr, c + 1, CH.P)) return true;
      const slide = (dirs, ts) => { for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (this.on(rr, cc)) { const v = b[rr * 8 + cc]; if (v) { if (this.owner(v) === by && ts.includes(this.type(v))) return true; break; } rr += dr; cc += dc; } } return false; };
      return slide(SH_ORTHO, [CH.R, CH.Q]) || slide(SH_DIAG, [CH.B, CH.Q]);
    },
    inCheck(pl) { const k = this.b.indexOf(CH.K + 8 * pl); return k >= 0 && this.attacked(k, 1 - pl); },
    pseudo(pl) {
      const b = this.b, out = [];
      const add = (from, r, c, captureOnly, quietOnly) => {
        if (!this.on(r, c)) return false;
        const to = r * 8 + c, v = b[to];
        if (v && this.owner(v) === pl) return false;
        if (v && quietOnly) return false;
        if (!v && captureOnly) return false;
        out.push({ pl, from, to, cap: v });
        return !v;
      };
      const slide = (i, dirs) => { const r = i >> 3, c = i & 7; for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (add(i, rr, cc)) { rr += dr; cc += dc; } } };
      for (let i = 0; i < 64; i++) {
        const v = b[i]; if (!v || this.owner(v) !== pl) continue;
        const r = i >> 3, c = i & 7, t = this.type(v);
        if (t === CH.K) {
          for (const [dr, dc] of SH_KING) add(i, r + dr, c + dc);
          const home = pl === 0 ? 0 : 56;
          if (i === home + 4 && !this.inCheck(pl)) {
            if (this.castle[pl][1] && b[home + 7] === CH.R + 8 * pl && !b[home + 5] && !b[home + 6] && !this.attacked(home + 5, 1 - pl)) out.push({ pl, from: i, to: home + 6, cap: 0, castle: [home + 7, home + 5] });
            if (this.castle[pl][0] && b[home] === CH.R + 8 * pl && !b[home + 1] && !b[home + 2] && !b[home + 3] && !this.attacked(home + 3, 1 - pl)) out.push({ pl, from: i, to: home + 2, cap: 0, castle: [home, home + 3] });
          }
        }
        else if (t === CH.Q) { slide(i, SH_ORTHO); slide(i, SH_DIAG); }
        else if (t === CH.B) slide(i, SH_DIAG);
        else if (t === CH.R) slide(i, SH_ORTHO);
        else if (t === CH.N) for (const [dr, dc] of SH_KNIGHT) add(i, r + dr, c + dc);
        else if (t === CH.P) {
          const dr = pl === 0 ? 1 : -1, start = pl === 0 ? 1 : 6;
          if (add(i, r + dr, c, false, true) && r === start) { const n = out.length; add(i, r + 2 * dr, c, false, true); if (out.length > n) out[out.length - 1].double = (r + dr) * 8 + c; }
          add(i, r + dr, c - 1, true); add(i, r + dr, c + 1, true);
          for (const dc of [-1, 1]) if (this.on(r + dr, c + dc) && (r + dr) * 8 + c + dc === this.ep) out.push({ pl, from: i, to: this.ep, cap: CH.P + 8 * (1 - pl), epTake: r * 8 + c + dc });
        }
      }
      for (const m of out) if (this.type(b[m.from]) === CH.P && ((m.to >> 3) === (pl === 0 ? 7 : 0))) m.promo = true;
      return out;
    },
    legal(pl) {
      const out = [];
      for (const m of this.pseudo(pl)) { const s = this.snapshot(); this.raw(m); if (!this.inCheck(pl)) out.push(m); this.restore(s); }
      return out;
    },
    raw(m) {
      const b = this.b, v = b[m.from], t = this.type(v);
      b[m.to] = m.promo ? CH.Q + 8 * m.pl : v; b[m.from] = 0;
      if (m.epTake !== undefined) b[m.epTake] = 0;
      if (m.castle) { b[m.castle[1]] = b[m.castle[0]]; b[m.castle[0]] = 0; }
      if (t === CH.K) this.castle[m.pl] = [false, false];
      for (const [sq, pl, side] of [[0, 0, 0], [7, 0, 1], [56, 1, 0], [63, 1, 1]]) if (m.from === sq || m.to === sq) this.castle[pl][side] = false;
      this.ep = m.double !== undefined ? m.double : -1;
      this.quiet = m.cap || t === CH.P ? 0 : this.quiet + 1; this.ply++;
    },
    pieceName(v) { return ['', 'king', 'queen', 'bishop', 'knight', 'rook', 'pawn'][this.type(v)]; },
    apply(m) {
      this.raw(m);
      const parts = [];
      if (m.castle) parts.push(m.pl === 0 ? 'You castle.' : 'The Scribe castles.');
      if (m.cap) parts.push(m.pl === 0 ? `You take the Scribe's ${this.pieceName(m.cap)}${m.epTake !== undefined ? ' en passant' : ''}.` : `The Scribe takes your ${this.pieceName(m.cap)}${m.epTake !== undefined ? ' en passant' : ''}.`);
      if (m.promo) parts.push('The pawn becomes a queen.');
      if (this.inCheck(1 - m.pl)) parts.push(m.pl === 0 ? 'Check.' : 'Check! Your king is attacked.');
      return { caps: m.cap ? [m.epTake !== undefined ? m.epTake : m.to] : [], note: parts.join(' ') };
    },
    bare() { // only kings, or a king and one minor piece against a bare king
      const rest = this.b.filter(v => v && this.type(v) !== CH.K);
      return !rest.length || (rest.length === 1 && [CH.B, CH.N].includes(this.type(rest[0])));
    },
    result(pl) {
      if (!this.legal(pl).length) return this.inCheck(pl)
        ? { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate! You win.' }
        : { winner: -1, text: pl === 0 ? 'You have no legal move but are not in check: stalemate, a draw.' : 'The Scribe has no legal move but is not in check: stalemate, a draw.' };
      if (this.bare()) return { winner: -1, text: 'Neither side has enough left to checkmate. The game is drawn.' };
      if (this.quiet >= 100) return { winner: -1, text: 'Fifty moves each with no capture or pawn move. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.quiet, this.ply, this.ep, this.castle.map(x => x.slice())]; },
    restore(s) { this.b = s[0].slice(); this.quiet = s[1]; this.ply = s[2]; this.ep = s[3]; this.castle = s[4].map(x => x.slice()); },
    turns(pl) {
      const v = m => (m.cap ? CH_VALUE[this.type(m.cap)] * 10 - CH_VALUE[this.type(this.b[m.from])] : 0) + (m.promo ? 80 : 0);
      return this.legal(pl).sort((a, b) => v(b) - v(a)).map(m => [m]);
    },
    terminal(pl, depth) {
      // A side with no legal move: checkmate is a loss, stalemate a draw. Found by the move list itself.
      if (this.quiet >= 100 || this.bare()) return 0;
      return null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v) continue;
        const o = this.owner(v), t = this.type(v), r = i >> 3, c = i & 7, adv = o === 0 ? r : 7 - r;
        let val = CH_VALUE[t];
        const centre = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5));
        if (t === CH.P) val += 0.05 * adv + (c >= 2 && c <= 5 ? 0.02 * adv : 0);
        if (t === CH.N || t === CH.B) val += 0.1 * centre - (adv === 0 ? 0.15 : 0);
        if (t === CH.K) val += this.count(1 - o) > 7 ? (adv === 0 && (c <= 2 || c >= 6) ? 0.3 : -0.1 * adv) : 0.05 * centre;
        s += o === pl ? val : -val;
      }
      return s + (this.inCheck(1 - pl) ? 0.2 : 0);
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 5); },
  };

