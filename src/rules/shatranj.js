  /* --------------------------------------------------------------- Shatranj
   * 64 squares, index r*8+c with rank 0 on the visitor's side. A square holds
   * 0 or type + 8*player: 1 shah (king), 2 firzan, 3 alfil, 4 faras (knight),
   * 5 rukh (rook), 6 baidaq (pawn). The visitor (player 0) moves up the board. */
  const SH = { K: 1, F: 2, E: 3, N: 4, R: 5, P: 6 };
  const SH_VALUE = [0, 0, 1.6, 1.25, 3, 5, 1];
  const SH_KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const SH_KING = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const SH_DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const SH_ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const SHATRANJ = {
    id: 'shatranj', name: 'Shatranj', dice: false, first: 0, SH,
    rules: [
      'The shah (king) moves one square in any direction, and the rukh (rook) and faras (knight) move as in modern chess.',
      'The firzan, ancestor of the queen, moves only one square diagonally.',
      'The alfil, ancestor of the bishop, jumps exactly two squares diagonally, over anything in between.',
      'The baidaq (pawn) steps one square forward and captures one square diagonally forward. It never moves two at once, and on the far rank it becomes a firzan.',
      'You win by checkmate (shah mat), by stalemating the Scribe, or by capturing everything but its king, unless it can strip yours bare on the very next move.',
      'There is no castling. A long stretch with no capture or pawn move is a draw.'
    ],
    source: 'Rules as recorded by medieval Arabic writers such as al-Adli and as-Suli (9th–10th centuries).',
    init() {
      const b = Array(64).fill(0);
      const back = [SH.R, SH.N, SH.E, SH.F, SH.K, SH.E, SH.N, SH.R];
      for (let c = 0; c < 8; c++) { b[c] = back[c]; b[8 + c] = SH.P; b[48 + c] = SH.P + 8; b[56 + c] = back[c] + 8; }
      this.b = b; this.quiet = 0; this.ply = 0;
    },
    owner: v => (v > 8 ? 1 : 0),
    type: v => v & 7,
    on: (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8,
    material(pl) { let n = 0; for (const v of this.b) if (v && this.owner(v) === pl && this.type(v) !== SH.K) n++; return n; },
    score(pl) { let n = 0; for (const v of this.b) if (v && this.owner(v) === pl) n += SH_VALUE[this.type(v)]; return n; },
    attacked(sq, by) {
      const b = this.b, r = sq >> 3, c = sq & 7;
      const is = (rr, cc, t) => { if (!this.on(rr, cc)) return false; const v = b[rr * 8 + cc]; return v && this.owner(v) === by && this.type(v) === t; };
      for (const [dr, dc] of SH_KNIGHT) if (is(r + dr, c + dc, SH.N)) return true;
      for (const [dr, dc] of SH_KING) if (is(r + dr, c + dc, SH.K)) return true;
      for (const [dr, dc] of SH_DIAG) { if (is(r + dr, c + dc, SH.F)) return true; if (is(r + 2 * dr, c + 2 * dc, SH.E)) return true; }
      const pr = by === 0 ? r - 1 : r + 1;
      if (is(pr, c - 1, SH.P) || is(pr, c + 1, SH.P)) return true;
      for (const [dr, dc] of SH_ORTHO) {
        let rr = r + dr, cc = c + dc;
        while (this.on(rr, cc)) { const v = b[rr * 8 + cc]; if (v) { if (this.owner(v) === by && this.type(v) === SH.R) return true; break; } rr += dr; cc += dc; }
      }
      return false;
    },
    inCheck(pl) { const k = this.b.indexOf(SH.K + 8 * pl); return k >= 0 && this.attacked(k, 1 - pl); },
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
      for (let i = 0; i < 64; i++) {
        const v = b[i]; if (!v || this.owner(v) !== pl) continue;
        const r = i >> 3, c = i & 7, t = this.type(v);
        if (t === SH.K) for (const [dr, dc] of SH_KING) add(i, r + dr, c + dc);
        else if (t === SH.F) for (const [dr, dc] of SH_DIAG) add(i, r + dr, c + dc);
        else if (t === SH.E) for (const [dr, dc] of SH_DIAG) add(i, r + 2 * dr, c + 2 * dc);
        else if (t === SH.N) for (const [dr, dc] of SH_KNIGHT) add(i, r + dr, c + dc);
        else if (t === SH.R) for (const [dr, dc] of SH_ORTHO) { let rr = r + dr, cc = c + dc; while (add(i, rr, cc)) { rr += dr; cc += dc; } }
        else if (t === SH.P) {
          const dr = pl === 0 ? 1 : -1;
          add(i, r + dr, c, false, true); add(i, r + dr, c - 1, true); add(i, r + dr, c + 1, true);
        }
      }
      for (const m of out) { const t = this.type(b[m.from]); if (t === SH.P && ((m.to >> 3) === (pl === 0 ? 7 : 0))) m.promo = true; }
      return out;
    },
    legal(pl) {
      const out = [];
      for (const m of this.pseudo(pl)) {
        const s = this.snapshot(); this.raw(m);
        if (!this.inCheck(pl)) out.push(m);
        this.restore(s);
      }
      return out;
    },
    raw(m) {
      const b = this.b, v = b[m.from];
      b[m.to] = m.promo ? SH.F + 8 * m.pl : v; b[m.from] = 0;
      this.quiet = m.cap || this.type(v) === SH.P ? 0 : this.quiet + 1; this.ply++;
    },
    apply(m) {
      this.raw(m);
      const opp = 1 - m.pl;
      const parts = [];
      if (m.cap) parts.push(m.pl === 0 ? 'You capture the Scribe\'s ' + this.pieceName(m.cap) + '.' : 'The Scribe captures your ' + this.pieceName(m.cap) + '.');
      if (m.promo) parts.push('The baidaq becomes a firzan.');
      if (this.inCheck(opp)) parts.push(opp === 1 ? 'Shah! The Scribe\'s king is in check.' : 'Shah! Your king is in check.');
      return { note: parts.join(' ') };
    },
    pieceName(v) { return ['', 'shah', 'firzan', 'alfil', 'faras', 'rukh', 'baidaq'][this.type(v)]; },
    result(pl) {
      const moves = this.legal(pl);
      if (!moves.length) {
        return this.inCheck(pl)
          ? { winner: 1 - pl, text: pl === 0 ? 'Shah mat. Your king is checkmated.' : 'Shah mat. The Scribe\'s king is checkmated.' }
          : { winner: 1 - pl, text: pl === 0 ? 'Your king is stalemated, and in shatranj that loses.' : 'You stalemated the Scribe, and in shatranj that wins.' };
      }
      const mine = this.material(pl), theirs = this.material(1 - pl);
      if (!mine && !theirs) return { winner: -1, text: 'Both kings stand bare. The game is drawn.' };
      if (!mine) {
        const strip = theirs === 1 && moves.some(m => m.cap && this.type(m.cap) !== SH.K);
        if (!strip) return { winner: 1 - pl, text: pl === 0 ? 'Your king is bare, and you cannot strip the Scribe\'s in reply.' : 'The Scribe\'s king is bare.' };
      }
      if (this.quiet >= 100) return { winner: -1, text: 'A long stretch with no capture or pawn move. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.quiet, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.quiet = s[1]; this.ply = s[2]; },
    turns(pl) {
      return this.legal(pl).sort((a, b) => (b.cap ? SH_VALUE[this.type(b.cap)] * 10 : 0) - (a.cap ? SH_VALUE[this.type(a.cap)] * 10 : 0)).map(m => [m]);
    },
    terminal(pl, depth) {
      const mine = this.material(pl), theirs = this.material(1 - pl);
      if (!this.pseudo(pl).some(m => { const s = this.snapshot(); this.raw(m); const ok = !this.inCheck(pl); this.restore(s); return ok; })) return -1000 - depth;
      if (!mine && !theirs) return 0;
      if (!mine && theirs > 1) return -900 - depth;
      if (this.quiet >= 100) return 0;
      return null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v) continue;
        const o = this.owner(v), t = this.type(v), r = i >> 3, c = i & 7;
        let val = SH_VALUE[t];
        if (t === SH.P) val += 0.06 * (o === 0 ? r : 7 - r);
        if (t === SH.N || t === SH.F) val += 0.08 * (3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5)));
        s += o === pl ? val : -val;
      }
      if (!this.material(1 - pl)) s += 6;
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 5); },
  };

