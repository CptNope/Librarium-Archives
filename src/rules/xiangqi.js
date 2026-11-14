  /* ------------------------------------------------------------------ Xiangqi
   * 9 files x 10 ranks of points, index r*9+c, rank 0 nearest the visitor.
   * A piece is its type, plus 8 for the Scribe's black pieces. The visitor plays red. */
  const XQ = { K: 1, A: 2, E: 3, H: 4, R: 5, C: 6, P: 7 };
  const XQ_VAL = [0, 0, 2, 2, 4, 9, 4.5, 1];
  const XQ_ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const XQ_DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const XQ_HORSE = [[2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0], [1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1]];
  const xqOwner = v => (v >= 8 ? 1 : 0), xqType = v => v & 7;
  const xqPalace = (pl, r, c) => c >= 3 && c <= 5 && (pl === 0 ? r <= 2 : r >= 7);
  const xqOwnSide = (pl, r) => (pl === 0 ? r <= 4 : r >= 5);
  const XIANGQI = {
    id: 'xiangqi', name: 'Xiangqi', dice: false, first: 0, T: XQ,
    rules: [
      'You play red and move first. Checkmate the Scribe\'s general to win. A player with no legal move also loses.',
      'The general and his two advisors stay inside the palace, the square marked with a cross. The general steps one point along a line, an advisor one point diagonally. The two generals may never face each other on an open file.',
      'Elephants move exactly two points diagonally, never across the river, and are stopped by a piece in between. Horses move one point straight and one diagonally outward, and are stopped by a piece next to them in the straight direction.',
      'Chariots move any distance in a straight line. Cannons move the same way, but capture only by jumping exactly one piece, of either colour, on the way.',
      'Soldiers step one point forward; once across the river they may also step sideways. They never retreat.',
      'House rule: sixty moves each with no capture is a draw.'
    ],
    source: 'The modern rules, which have been settled since the Song dynasty. The rules against perpetual check are replaced here by the sixty-move rule.',
    init() {
      const b = Array(90).fill(0), back = [XQ.R, XQ.H, XQ.E, XQ.A, XQ.K, XQ.A, XQ.E, XQ.H, XQ.R];
      back.forEach((t, c) => { b[c] = t; b[81 + c] = t + 8; });
      for (const c of [1, 7]) { b[2 * 9 + c] = XQ.C; b[7 * 9 + c] = XQ.C + 8; }
      for (const c of [0, 2, 4, 6, 8]) { b[3 * 9 + c] = XQ.P; b[6 * 9 + c] = XQ.P + 8; }
      this.b = b; this.quiet = 0; this.ply = 0;
    },
    count(pl) { let n = 0; for (const v of this.b) if (v && xqOwner(v) === pl) n++; return n; },
    general(pl) { const g = XQ.K + (pl ? 8 : 0); return this.b.indexOf(g); },
    // Is pl's general attacked, or facing the other general?
    inCheck(pl) {
      const b = this.b, k = this.general(pl); if (k < 0) return true;
      const r = (k / 9) | 0, c = k % 9, foe = pl ? 0 : 8;
      for (const [dr, dc] of XQ_ORTH) {
        let rr = r + dr, cc = c + dc, screens = 0;
        while (rr >= 0 && rr < 10 && cc >= 0 && cc < 9) {
          const v = b[rr * 9 + cc];
          if (v) {
            if (screens === 0) {
              if (v === XQ.R + foe || (v === XQ.K + foe && dc === 0)) return true;
              if (v === XQ.P + foe && rr === r + (pl ? -1 : 1) && cc === c) return true;
              if (v === XQ.P + foe && rr === r && Math.abs(cc - c) === 1) return true;
              screens = 1;
            } else { if (v === XQ.C + foe) return true; break; }
          }
          rr += dr; cc += dc;
        }
      }
      for (const [dr, dc, lr, lc] of XQ_HORSE) {
        // A horse at k - (dr, dc) reaches k unless its leg, one step from the horse, is blocked.
        const hr = r - dr, hc = c - dc;
        if (hr < 0 || hr > 9 || hc < 0 || hc > 8 || b[hr * 9 + hc] !== XQ.H + foe) continue;
        if (!b[(hr + lr) * 9 + hc + lc]) return true;
      }
      return false;
    },
    pseudo(pl) {
      const b = this.b, out = [];
      const add = (from, r, c) => {
        if (r < 0 || r > 9 || c < 0 || c > 8) return false;
        const to = r * 9 + c, v = b[to];
        if (v && xqOwner(v) === pl) return false;
        out.push({ pl, from, to, cap: v }); return !v;
      };
      for (let i = 0; i < 90; i++) {
        const v = b[i]; if (!v || xqOwner(v) !== pl) continue;
        const t = xqType(v), r = (i / 9) | 0, c = i % 9;
        if (t === XQ.K) { for (const [dr, dc] of XQ_ORTH) if (xqPalace(pl, r + dr, c + dc)) add(i, r + dr, c + dc); }
        else if (t === XQ.A) { for (const [dr, dc] of XQ_DIAG) if (xqPalace(pl, r + dr, c + dc)) add(i, r + dr, c + dc); }
        else if (t === XQ.E) {
          for (const [dr, dc] of XQ_DIAG) {
            const rr = r + 2 * dr, cc = c + 2 * dc;
            if (rr < 0 || rr > 9 || cc < 0 || cc > 8 || !xqOwnSide(pl, rr) || b[(r + dr) * 9 + c + dc]) continue;
            add(i, rr, cc);
          }
        } else if (t === XQ.H) {
          for (const [dr, dc, lr, lc] of XQ_HORSE) {
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || rr > 9 || cc < 0 || cc > 8 || b[(r + lr) * 9 + c + lc]) continue;
            add(i, rr, cc);
          }
        } else if (t === XQ.R) {
          for (const [dr, dc] of XQ_ORTH) { let rr = r + dr, cc = c + dc; while (add(i, rr, cc)) { rr += dr; cc += dc; } }
        } else if (t === XQ.C) {
          for (const [dr, dc] of XQ_ORTH) {
            let rr = r + dr, cc = c + dc;
            while (rr >= 0 && rr < 10 && cc >= 0 && cc < 9 && !b[rr * 9 + cc]) { out.push({ pl, from: i, to: rr * 9 + cc, cap: 0 }); rr += dr; cc += dc; }
            rr += dr; cc += dc; // jump the screen
            while (rr >= 0 && rr < 10 && cc >= 0 && cc < 9) {
              const w = b[rr * 9 + cc];
              if (w) { if (xqOwner(w) !== pl) out.push({ pl, from: i, to: rr * 9 + cc, cap: w }); break; }
              rr += dr; cc += dc;
            }
          }
        } else if (t === XQ.P) {
          const f = pl ? -1 : 1;
          add(i, r + f, c);
          if (!xqOwnSide(pl, r)) { add(i, r, c - 1); add(i, r, c + 1); }
        }
      }
      return out;
    },
    legal(pl) {
      const out = [];
      for (const m of this.pseudo(pl)) {
        const v = this.b[m.from]; this.b[m.to] = v; this.b[m.from] = 0;
        if (!this.inCheck(pl)) out.push(m);
        this.b[m.from] = v; this.b[m.to] = m.cap;
      }
      return out;
    },
    apply(m) {
      const v = this.b[m.from]; this.b[m.from] = 0; this.b[m.to] = v;
      this.ply++; this.quiet = m.cap ? 0 : this.quiet + 1;
      const names = ['', 'general', 'advisor', 'elephant', 'horse', 'chariot', 'cannon', 'soldier'];
      const parts = [];
      if (m.cap) parts.push(m.pl === 0 ? `You take the Scribe's ${names[xqType(m.cap)]}.` : `The Scribe takes your ${names[xqType(m.cap)]}.`);
      if (this.inCheck(1 - m.pl)) parts.push(m.pl === 0 ? 'Check.' : 'Check! Your general is attacked.');
      return { caps: m.cap ? [m.to] : [], note: parts.join(' ') };
    },
    result(pl) {
      if (!this.legal(pl).length) {
        const mate = this.inCheck(pl);
        return { winner: 1 - pl, text: pl === 0 ? (mate ? 'Checkmate. Your general is taken.' : 'You have no legal move, and in xiangqi that loses.') : (mate ? 'Checkmate! The Scribe\'s general cannot escape.' : 'The Scribe has no legal move, and in xiangqi that loses.') };
      }
      if (this.quiet >= 120) return { winner: -1, text: 'Sixty moves each with no capture. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.quiet, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.quiet = s[1]; this.ply = s[2]; },
    turns(pl) { return this.legal(pl).sort((a, b) => (b.cap ? XQ_VAL[xqType(b.cap)] * 10 - XQ_VAL[xqType(this.b[b.from])] : 0) - (a.cap ? XQ_VAL[xqType(a.cap)] * 10 - XQ_VAL[xqType(this.b[a.from])] : 0)).map(m => [m]); },
    terminal(pl, depth) {
      // A side with no move is found by the search itself (no turns: the worst score).
      return this.quiet >= 120 ? 0 : null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 90; i++) {
        const v = this.b[i]; if (!v) continue;
        const o = xqOwner(v), t = xqType(v), r = (i / 9) | 0, c = i % 9;
        let val = XQ_VAL[t];
        if (t === XQ.P && !xqOwnSide(o, r)) val = c >= 2 && c <= 6 ? 2.2 : 1.8;
        if (t === XQ.H || t === XQ.C) val += 0.1 * (4 - Math.abs(c - 4)) / 4;
        if (t === XQ.R && !xqOwnSide(o, r)) val += 0.3;
        s += o === pl ? val : -val;
      }
      if (this.inCheck(1 - pl)) s += 0.3;
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

