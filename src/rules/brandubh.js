  /* ------------------------------------------------------------- Brandubh
   * 7x7 board, index r*7+c. 0 empty, 1 attacker, 2 defender, 3 king.
   * Player 0 (the visitor) commands the king's side, player 1 the attackers. */
  const BR_THRONE = 24, BR_CORNERS = [0, 6, 42, 48];
  const BR_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const BRANDUBH = {
    id: 'brandubh', name: 'Brandubh', dice: false, first: 1,
    rules: [
      'The Scribe commands the eight attackers and moves first. You command the king and his four defenders.',
      'Every piece moves like a chess rook: any distance in a straight line, without jumping.',
      'Only the king may stop on the central throne or the four corners. Other pieces may pass over the empty throne.',
      'Trap an enemy piece between two of yours to capture it. The corners and the empty throne count as an enemy to both sides, and the king can help capture.',
      'The king is caught by two attackers on opposite sides, by three when he stands beside the throne, and by four on the throne.',
      'You win when the king reaches a corner. The Scribe wins by capturing him.'
    ],
    source: 'A modern reconstruction. The ancient Irish rules did not survive.',
    THRONE: BR_THRONE, CORNERS: BR_CORNERS,
    init() {
      const b = Array(49).fill(0);
      [3, 10, 21, 22, 26, 27, 38, 45].forEach(i => { b[i] = 1; });
      [17, 23, 25, 31].forEach(i => { b[i] = 2; });
      b[BR_THRONE] = 3;
      this.b = b; this.win = null; this.ply = 0;
    },
    owns(pl, v) { return pl === 1 ? v === 1 : v === 2 || v === 3; },
    restricted(i) { return i === BR_THRONE || BR_CORNERS.includes(i); },
    count(pl) { let n = 0; for (const v of this.b) if (this.owns(pl, v)) n++; return n; },
    legal(pl) {
      if (this.win) return [];
      const b = this.b, out = [];
      for (let i = 0; i < 49; i++) {
        const v = b[i]; if (!this.owns(pl, v)) continue;
        const r0 = (i / 7) | 0, c0 = i % 7;
        for (const [dr, dc] of BR_DIRS) {
          let r = r0 + dr, c = c0 + dc;
          while (r >= 0 && r < 7 && c >= 0 && c < 7) {
            const j = r * 7 + c;
            if (b[j]) break;
            if (this.restricted(j) && v !== 3) { if (j === BR_THRONE) { r += dr; c += dc; continue; } break; }
            out.push({ pl, from: i, to: j });
            r += dr; c += dc;
          }
        }
      }
      return out;
    },
    anvil(j, pl) { const v = this.b[j]; return this.owns(pl, v) || (v === 0 && this.restricted(j)); },
    neighbors(k) {
      const r = (k / 7) | 0, c = k % 7;
      return BR_DIRS.map(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr < 0 || rr > 6 || cc < 0 || cc > 6 ? -1 : rr * 7 + cc; });
    },
    apply(m) {
      const b = this.b, v = b[m.from];
      b[m.from] = 0; b[m.to] = v; this.ply++;
      const caps = [];
      if (v === 3 && BR_CORNERS.includes(m.to)) { this.win = { winner: 0, text: 'The king reaches a corner and escapes.' }; return { caps, note: 'The king escapes.' }; }
      const r = (m.to / 7) | 0, c = m.to % 7;
      for (const [dr, dc] of BR_DIRS) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 6 || cc < 0 || cc > 6) continue;
        const n = rr * 7 + cc, t = b[n];
        if (!t || this.owns(m.pl, t)) continue;
        const fr = rr + dr, fc = cc + dc;
        const far = fr < 0 || fr > 6 || fc < 0 || fc > 6 ? -1 : fr * 7 + fc;
        if (t === 3) {
          const nb = this.neighbors(n);
          let caught;
          if (n === BR_THRONE) caught = nb.every(j => j >= 0 && b[j] === 1);
          else if (nb.includes(BR_THRONE)) caught = nb.every(j => j === BR_THRONE || (j >= 0 && b[j] === 1));
          else caught = far >= 0 && this.anvil(far, m.pl);
          if (caught) { b[n] = 0; caps.push(n); this.win = { winner: 1, text: 'The king is surrounded and captured.' }; }
          continue;
        }
        if (far >= 0 && this.anvil(far, m.pl)) { b[n] = 0; caps.push(n); }
      }
      let note = '';
      if (this.win) note = 'The king is captured.';
      else if (caps.length) note = m.pl === 0
        ? (caps.length > 1 ? `You capture ${caps.length} attackers.` : 'You capture an attacker.')
        : (caps.length > 1 ? `The Scribe captures ${caps.length} of your pieces.` : 'The Scribe captures one of your pieces.');
      return { caps, note };
    },
    result(pl) {
      if (this.win) return this.win;
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no legal move.' : 'The Scribe has no legal move.' };
      if (this.ply >= 200) return { winner: -1, text: 'Two hundred moves without a result. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.win, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.win = s[1]; this.ply = s[2]; },
    turns(pl) {
      const ms = this.legal(pl).map(m => [m]);
      const k = this.b.indexOf(3);
      // Look at king moves and moves near the king first.
      const near = m => { const a = m[0].to, kr = (k / 7) | 0, kc = k % 7; return Math.abs(((a / 7) | 0) - kr) + Math.abs((a % 7) - kc); };
      return k < 0 ? ms : ms.sort((a, b) => near(a) - near(b));
    },
    terminal(pl, depth) {
      if (this.win) return this.win.winner === pl ? 1000 + depth : -1000 - depth;
      if (this.ply >= 200) return 0;
      if (pl === 0 && this.kingRuns()) return 999 + depth; // the king is to move with a corner open: he is out next move
      return null;
    },
    kingRuns() {
      const k = this.b.indexOf(3); if (k < 0) return 0;
      let n = 0; const r = (k / 7) | 0, c = k % 7;
      for (const [dr, dc] of BR_DIRS) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 7 && cc >= 0 && cc < 7) {
          const j = rr * 7 + cc;
          if (this.b[j]) break;
          if (BR_CORNERS.includes(j)) { n++; break; }
          rr += dr; cc += dc;
        }
      }
      return n;
    },
    evaluate(pl) {
      const k = this.b.indexOf(3);
      let s;
      if (k < 0) s = -1000;
      else {
        let att = 0, def = 0; for (const v of this.b) { if (v === 1) att++; else if (v === 2) def++; }
        const adj = this.neighbors(k).filter(j => j >= 0 && this.b[j] === 1).length;
        const kr = (k / 7) | 0, kc = k % 7;
        const dist = Math.min(...BR_CORNERS.map(q => Math.abs(((q / 7) | 0) - kr) + Math.abs((q % 7) - kc)));
        // Attackers beside a corner shut it; on the square diagonally in from it they also bar row and column 1 or 5,
        // the king's road to the corners, and cannot be trapped against the corner there.
        const guards = [1, 7, 5, 13, 35, 43, 41, 47].filter(j => this.b[j] === 1).length + 2 * [8, 12, 36, 40].filter(j => this.b[j] === 1).length;
        let kingMoves = 0;
        for (const [dr, dc] of BR_DIRS) {
          let rr = kr + dr, cc = kc + dc;
          while (rr >= 0 && rr < 7 && cc >= 0 && cc < 7 && !this.b[rr * 7 + cc]) { kingMoves++; rr += dr; cc += dc; }
        }
        // A king with room to run is dangerous; with two corners open he cannot be stopped.
        const runs = this.kingRuns();
        s = def * 3 - att * 2.5 + runs * (runs > 1 ? 60 : 25) - adj * 6 - dist - guards * 3 + kingMoves * 0.8;
      }
      return pl === 0 ? s : -s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 5); },
  };

