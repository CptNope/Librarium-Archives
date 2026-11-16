  /* ------------------------------------------------------------------ Tablut
   * Linnaeus's Lapland tafl, 9x9, index r*9+c. 0 empty, 1 Muscovite, 2 Swede, 3 king.
   * The visitor commands the Swedes and the king; the Scribe the Muscovites, who move first. */
  const TB_N = 9, TB_THRONE = 40, TB_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const TABLUT = {
    id: 'tablut', name: 'Tablut', dice: false, first: 1, THRONE: TB_THRONE, N: TB_N,
    rules: [
      'The Scribe commands the sixteen Muscovites and moves first. You command the king and his eight Swedes.',
      'Every piece moves like a chess rook: any distance in a straight line, without jumping. Only the king may stop on the throne in the centre; others may pass over it when it is empty.',
      'Trap an enemy piece between two of yours to capture it. The empty throne counts as an enemy to both sides, and the king helps the Swedes capture.',
      'The king is captured like any other piece, by two Muscovites on opposite sides, except on the throne, where it takes four, and beside it, where it takes three with the throne as the fourth.',
      'You win when the king reaches any square on the edge of the board. The Scribe wins by capturing him.',
      'House rule: after a hundred moves each with no result, the game is drawn.'
    ],
    source: 'Linnaeus\'s account of 1732, read as most modern players do: the king escapes to any edge square and is armed, and is captured by two except on or beside the throne.',
    init() {
      const b = Array(81).fill(0);
      [3, 4, 5, 13, 27, 36, 45, 37, 35, 44, 53, 43, 75, 76, 77, 67].forEach(i => { b[i] = 1; });
      [22, 31, 38, 39, 41, 42, 49, 58].forEach(i => { b[i] = 2; });
      b[TB_THRONE] = 3;
      this.b = b; this.win = null; this.ply = 0;
    },
    owns(pl, v) { return pl === 1 ? v === 1 : v === 2 || v === 3; },
    count(pl) { let n = 0; for (const v of this.b) if (this.owns(pl, v)) n++; return n; },
    edge(i) { const r = (i / 9) | 0, c = i % 9; return r === 0 || r === 8 || c === 0 || c === 8; },
    legal(pl) {
      if (this.win) return [];
      const b = this.b, out = [];
      for (let i = 0; i < 81; i++) {
        const v = b[i]; if (!this.owns(pl, v)) continue;
        const r0 = (i / 9) | 0, c0 = i % 9;
        for (const [dr, dc] of TB_DIRS) {
          let r = r0 + dr, c = c0 + dc;
          while (r >= 0 && r < 9 && c >= 0 && c < 9) {
            const j = r * 9 + c;
            if (b[j]) break;
            if (j !== TB_THRONE || v === 3) out.push({ pl, from: i, to: j });
            r += dr; c += dc;
          }
        }
      }
      return out;
    },
    anvil(j, pl) { const v = this.b[j]; return this.owns(pl, v) || (v === 0 && j === TB_THRONE); },
    nb(k) { const r = (k / 9) | 0, c = k % 9; return TB_DIRS.map(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr < 0 || rr > 8 || cc < 0 || cc > 8 ? -1 : rr * 9 + cc; }); },
    apply(m) {
      const b = this.b, v = b[m.from];
      b[m.from] = 0; b[m.to] = v; this.ply++;
      const caps = [];
      if (v === 3 && this.edge(m.to)) { this.win = { winner: 0, text: 'The king reaches the edge of the board and escapes.' }; return { caps, note: 'The king escapes.' }; }
      const r = (m.to / 9) | 0, c = m.to % 9;
      for (const [dr, dc] of TB_DIRS) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 8 || cc < 0 || cc > 8) continue;
        const n = rr * 9 + cc, t = b[n];
        if (!t || this.owns(m.pl, t)) continue;
        const fr = rr + dr, fc = cc + dc, far = fr < 0 || fr > 8 || fc < 0 || fc > 8 ? -1 : fr * 9 + fc;
        if (t === 3) {
          const nb = this.nb(n); let caught;
          if (n === TB_THRONE) caught = nb.every(j => j >= 0 && b[j] === 1);
          else if (nb.includes(TB_THRONE)) caught = nb.every(j => j === TB_THRONE || (j >= 0 && b[j] === 1));
          else caught = far >= 0 && this.anvil(far, m.pl);
          if (caught) { b[n] = 0; caps.push(n); this.win = { winner: 1, text: 'The king is surrounded and captured.' }; }
          continue;
        }
        if (far >= 0 && this.anvil(far, m.pl)) { b[n] = 0; caps.push(n); }
      }
      let note = '';
      if (this.win) note = 'The king is captured.';
      else if (caps.length) note = m.pl === 0 ? (caps.length > 1 ? `You capture ${caps.length} Muscovites.` : 'You capture a Muscovite.') : (caps.length > 1 ? `The Scribe captures ${caps.length} of your Swedes.` : 'The Scribe captures one of your Swedes.');
      return { caps, note };
    },
    result(pl) {
      if (this.win) return this.win;
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no legal move.' : 'The Scribe has no legal move.' };
      if (this.ply >= 200) return { winner: -1, text: 'A hundred moves each without a result. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.win, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.win = s[1]; this.ply = s[2]; },
    // Open lines from the king to the edge: one is a threat, two cannot both be blocked.
    kingRuns() {
      const k = this.b.indexOf(3); if (k < 0) return 0;
      let n = 0; const r = (k / 9) | 0, c = k % 9;
      for (const [dr, dc] of TB_DIRS) {
        let rr = r + dr, cc = c + dc, open = true;
        while (rr >= 0 && rr < 9 && cc >= 0 && cc < 9) { if (this.b[rr * 9 + cc]) { open = false; break; } rr += dr; cc += dc; }
        if (open) n++;
      }
      return n;
    },
    turns(pl) {
      const k = this.b.indexOf(3), kr = (k / 9) | 0, kc = k % 9;
      const near = m => Math.abs(((m.to / 9) | 0) - kr) + Math.abs((m.to % 9) - kc);
      const ms = this.legal(pl);
      ms.sort((a, b) => near(a) - near(b));
      return ms.slice(0, 40).map(m => [m]);
    },
    terminal(pl, depth) {
      if (this.win) return this.win.winner === pl ? 1000 + depth : -1000 - depth;
      if (this.ply >= 200) return 0;
      return null;
    },
    evaluate(pl) {
      const k = this.b.indexOf(3); if (k < 0) return pl === 1 ? 900 : -900;
      const runs = this.kingRuns(), r = (k / 9) | 0, c = k % 9, toEdge = Math.min(r, c, 8 - r, 8 - c);
      let around = 0; for (const j of this.nb(k)) if (j >= 0 && this.b[j] === 1) around++;
      const sw = (this.count(0) - 1) * 1.6 - this.count(1) + runs * (runs > 1 ? 30 : 6) - toEdge * 0.8 - around * 2.5;
      return pl === 0 ? sw : -sw;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

