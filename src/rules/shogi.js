  /* ------------------------------------------------------------------ Shogi
   * 9 x 9, index r*9+c, rank 0 nearest the visitor (sente, moving up). A
   * square holds 0 or type (1-8) + 16 if promoted + 32 if the Scribe's.
   * Types: 1 pawn, 2 lance, 3 knight, 4 silver, 5 gold, 6 bishop, 7 rook,
   * 8 king. hands[pl][type - 1] counts captured pieces ready to drop. */
  const SG = { P: 1, L: 2, N: 3, S: 4, G: 5, B: 6, R: 7, K: 8 };
  const SG_VAL = [0, 1, 3, 4, 5, 6, 8, 10, 0];
  const SG_PROMO_VAL = [0, 5, 6, 6, 6, 6, 10, 12, 0];
  const sgType = v => v & 15, sgPro = v => (v & 16) !== 0, sgOwner = v => (v & 32 ? 1 : 0);
  const SG_ALL8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  // Step moves for a piece of this kind, with f = +1 for the visitor, -1 for the Scribe.
  function sgSteps(t, pro, f) {
    const gold = [[f, 0], [f, -1], [f, 1], [0, -1], [0, 1], [-f, 0]];
    if (pro && t <= 4) return gold;
    if (t === SG.G) return gold;
    if (t === SG.S) return [[f, 0], [f, -1], [f, 1], [-f, -1], [-f, 1]];
    if (t === SG.K) return SG_ALL8;
    if (t === SG.P) return [[f, 0]];
    if (t === SG.N) return [[2 * f, -1], [2 * f, 1]];
    if (t === SG.B && pro) return [[1, 0], [-1, 0], [0, 1], [0, -1]];
    if (t === SG.R && pro) return [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    return [];
  }
  function sgSlides(t, pro, f) {
    if (t === SG.L && !pro) return [[f, 0]];
    if (t === SG.B) return [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    if (t === SG.R) return [[1, 0], [-1, 0], [0, 1], [0, -1]];
    return [];
  }
  const SHOGI = {
    id: 'shogi', name: 'Shogi', dice: false, first: 0, SG,
    rules: [
      'You move first, with the pieces pointing away from you. Checkmate the Scribe\'s king to win.',
      'King: one step any way. Gold: one step any way but diagonally back. Silver: one step forward or diagonally. Knight: two forward and one across, jumping. Lance: any distance straight forward. Bishop and rook: as in chess. Pawn: one step forward, and it captures the same way.',
      'A piece that moves into, out of or within the far three ranks is promoted. Pawns, lances, knights and silvers then move like golds; bishops and rooks gain the king\'s step as well. Here a piece always promotes when it can.',
      'Drops: a piece you capture becomes yours. On a later turn, instead of moving, you can put it on any empty square: pick it from your hand at the right, then a ring. You may not drop a pawn on a file where you already have an unpromoted pawn, drop a piece where it could never move, or give checkmate by dropping a pawn.',
      'House rule: after 150 moves each the game is drawn.'
    ],
    source: 'Modern shogi, except that promotion is automatic and repetition (sennichite) is replaced by a move limit.',
    init() {
      const b = Array(81).fill(0), back = [SG.L, SG.N, SG.S, SG.G, SG.K, SG.G, SG.S, SG.N, SG.L];
      back.forEach((t, c) => { b[c] = t; b[72 + c] = t + 32; });
      b[9 + 1] = SG.B; b[9 + 7] = SG.R; b[63 + 1] = SG.R + 32; b[63 + 7] = SG.B + 32;
      for (let c = 0; c < 9; c++) { b[18 + c] = SG.P; b[54 + c] = SG.P + 32; }
      this.b = b; this.hands = [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]]; this.ply = 0;
    },
    zone: (pl, r) => (pl === 0 ? r >= 6 : r <= 2),
    count(pl) { let n = 0; for (const v of this.b) if (v && sgOwner(v) === pl) n++; return n + this.hands[pl].reduce((a, b) => a + b, 0); },
    // Is square sq attacked by player `by`? Looks outward from sq for anything that could reach it.
    attacked(sq, by) {
      const b = this.b, r = (sq / 9) | 0, c = sq % 9, f = by === 0 ? 1 : -1;
      for (const [dr, dc] of SG_ALL8.concat([[2 * f, -1], [2 * f, 1]])) {
        const ar = r - dr, ac = c - dc; if (ar < 0 || ar > 8 || ac < 0 || ac > 8) continue;
        const v = b[ar * 9 + ac]; if (!v || sgOwner(v) !== by) continue;
        if (sgSteps(sgType(v), sgPro(v), f).some(([x, y]) => x === dr && y === dc)) return true;
      }
      for (const [dr, dc] of SG_ALL8) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 9 && cc >= 0 && cc < 9) {
          const v = b[rr * 9 + cc];
          if (v) {
            if (sgOwner(v) === by && sgSlides(sgType(v), sgPro(v), f).some(([x, y]) => x === -dr && y === -dc)) return true;
            break;
          }
          rr += dr; cc += dc;
        }
      }
      return false;
    },
    king(pl) { return this.b.indexOf(SG.K + (pl ? 32 : 0)); },
    inCheck(pl) { const k = this.king(pl); return k < 0 || this.attacked(k, 1 - pl); },
    pseudo(pl) {
      const b = this.b, f = pl === 0 ? 1 : -1, out = [];
      for (let i = 0; i < 81; i++) {
        const v = b[i]; if (!v || sgOwner(v) !== pl) continue;
        const t = sgType(v), pro = sgPro(v), r = (i / 9) | 0, c = i % 9;
        const add = (rr, cc) => {
          if (rr < 0 || rr > 8 || cc < 0 || cc > 8) return false;
          const to = rr * 9 + cc, w = b[to];
          if (w && sgOwner(w) === pl) return false;
          const promo = !pro && t !== SG.G && t !== SG.K && (this.zone(pl, r) || this.zone(pl, rr));
          out.push({ pl, from: i, to, cap: w, promo });
          return !w;
        };
        for (const [dr, dc] of sgSteps(t, pro, f)) add(r + dr, c + dc);
        for (const [dr, dc] of sgSlides(t, pro, f)) { let rr = r + dr, cc = c + dc; while (add(rr, cc)) { rr += dr; cc += dc; } }
      }
      const hand = this.hands[pl], last = pl === 0 ? 8 : 0, last2 = pl === 0 ? 7 : 1;
      for (let t = 1; t <= 7; t++) {
        if (!hand[t - 1]) continue;
        for (let i = 0; i < 81; i++) {
          if (b[i]) continue;
          const r = (i / 9) | 0, c = i % 9;
          if ((t === SG.P || t === SG.L) && r === last) continue;
          if (t === SG.N && (r === last || r === last2)) continue;
          if (t === SG.P) { let two = false; for (let rr = 0; rr < 9; rr++) if (b[rr * 9 + c] === SG.P + (pl ? 32 : 0)) { two = true; break; } if (two) continue; }
          out.push({ pl, drop: t, to: i, cap: 0 });
        }
      }
      return out;
    },
    raw(m) {
      const b = this.b, pl = m.pl;
      if (m.drop) { b[m.to] = m.drop + (pl ? 32 : 0); this.hands[pl][m.drop - 1]--; }
      else {
        const v = b[m.from];
        if (m.cap) this.hands[pl][sgType(m.cap) - 1]++;
        b[m.to] = m.promo ? v | 16 : v; b[m.from] = 0;
      }
      this.ply++;
    },
    legal(pl) {
      const out = [], check = this.inCheck(pl);
      for (const m of this.pseudo(pl)) {
        if (m.drop && !check && m.drop !== SG.P) { out.push(m); continue; }
        const s = this.snapshot(); this.raw(m);
        let ok = !this.inCheck(pl);
        // No checkmate by dropping a pawn.
        if (ok && m.drop === SG.P && this.inCheck(1 - pl) && !this.legal(1 - pl).length) ok = false;
        this.restore(s);
        if (ok) out.push(m);
      }
      return out;
    },
    pieceName(v) { const t = sgType(v), pro = sgPro(v); return pro ? ['', 'tokin', 'promoted lance', 'promoted knight', 'promoted silver', '', 'horse', 'dragon'][t] : ['', 'pawn', 'lance', 'knight', 'silver', 'gold', 'bishop', 'rook', 'king'][t]; },
    apply(m) {
      const name = m.cap ? this.pieceName(m.cap) : '';
      this.raw(m);
      const parts = [];
      if (m.cap) parts.push(m.pl === 0 ? `You take the Scribe's ${name}; it joins your hand.` : `The Scribe takes your ${name}.`);
      if (m.drop && m.pl === 1) parts.push(`The Scribe drops a ${this.pieceName(m.drop)}.`);
      if (m.promo) parts.push(m.pl === 0 ? 'Your piece is promoted.' : 'The Scribe\'s piece is promoted.');
      if (this.inCheck(1 - m.pl)) parts.push(m.pl === 0 ? 'Check.' : 'Check! Your king is attacked.');
      return { caps: m.cap ? [m.to] : [], note: parts.join(' ') };
    },
    result(pl) {
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate! You win.' };
      if (this.ply >= 300) return { winner: -1, text: 'A hundred and fifty moves each. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.hands.map(h => h.slice()), this.ply]; },
    restore(s) { this.b = s[0].slice(); this.hands = s[1].map(h => h.slice()); this.ply = s[2]; },
    value(v) { return sgPro(v) ? SG_PROMO_VAL[sgType(v)] : SG_VAL[sgType(v)]; },
    turns(pl) {
      const key = m => (m.cap ? this.value(m.cap) * 10 : 0) + (m.promo ? 3 : 0) - (m.drop ? 1 : 0);
      const ms = this.legal(pl).sort((a, b) => key(b) - key(a));
      // Keep the search to the likelier drops: those near the action.
      const kings = [this.king(0), this.king(1)];
      return ms.filter(m => !m.drop || ms.length < 60 || kings.some(k => k >= 0 && Math.abs(((k / 9) | 0) - ((m.to / 9) | 0)) <= 2 && Math.abs((k % 9) - (m.to % 9)) <= 2)).map(m => [m]);
    },
    terminal(pl) { return this.ply >= 300 ? 0 : null; },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 81; i++) {
        const v = this.b[i]; if (!v) continue;
        const o = sgOwner(v), r = (i / 9) | 0, adv = o === 0 ? r : 8 - r;
        let val = this.value(v);
        if (sgType(v) !== SG.K) val += 0.03 * adv;
        s += o === pl ? val : -val;
      }
      for (const o of [0, 1]) this.hands[o].forEach((n, k) => { s += (o === pl ? 1 : -1) * n * SG_VAL[k + 1] * 1.1; });
      // A king with gold and silver guards beside it.
      for (const o of [0, 1]) { const k = this.king(o); if (k < 0) continue; let g = 0; const r = (k / 9) | 0, c = k % 9; for (const [dr, dc] of SG_ALL8) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 9 && cc >= 0 && cc < 9) { const v = this.b[rr * 9 + cc]; if (v && sgOwner(v) === o) g++; } } s += (o === pl ? 1 : -1) * 0.25 * Math.min(g, 4); }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

