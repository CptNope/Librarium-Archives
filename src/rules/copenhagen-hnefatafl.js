  /* --------------------------------------------------- Copenhagen hnefatafl
   * 11 x 11, square i = r * 11 + c. 0 empty, 1 attacker, 2 defender, 3 king.
   * The visitor holds the king and his twelve defenders; the Scribe's 24
   * attackers move first. The throne is the centre, the corners the king's goals. */
  const HN_N = 11, HN_THRONE = 60, HN_CORNERS = [0, 10, 110, 120], HN_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const HNEFATAFL = {
    id: 'hnefatafl', name: 'Hnefatafl', dice: false, first: 1, THRONE: HN_THRONE, CORNERS: HN_CORNERS, N: HN_N,
    rules: [
      'The Scribe commands the twenty-four attackers and moves first. You command the king and his twelve defenders, in the centre.',
      'Every piece moves like a chess rook, any distance in a straight line without jumping. Only the king may stop on the throne in the centre or on the four corner squares; any piece may pass over the empty throne.',
      'Capture an enemy by trapping it between two of your pieces, in a row or a column, with the move you make. A corner can stand in for one of your pieces, and so can the throne: always against attackers, and against defenders when it is empty. The king may help capture.',
      'The king is taken only when attackers surround him on all four sides, or on three beside the throne. He cannot be taken on the edge of the board.',
      'You win when the king reaches a corner. The Scribe wins by taking the king, or by closing an unbroken ring around him and all his defenders. A side with no move loses.',
      'House rule: after 150 moves each the game is drawn. The shieldwall capture and the exit fort of the full Copenhagen rules are left out.'
    ],
    source: 'A modern reconstruction: the Copenhagen rules of the Fetlar and Copenhagen Hnefatafl clubs, after aagenielsen.dk, without the shieldwall and exit fort and with a move limit in place of the ban on repetition.',
    init() {
      const b = Array(121).fill(0), at = (r, c) => r * 11 + c;
      for (let k = 3; k <= 7; k++) { b[at(0, k)] = 1; b[at(10, k)] = 1; b[at(k, 0)] = 1; b[at(k, 10)] = 1; }
      b[at(1, 5)] = 1; b[at(9, 5)] = 1; b[at(5, 1)] = 1; b[at(5, 9)] = 1;
      for (const [r, c] of [[3, 5], [4, 4], [4, 5], [4, 6], [5, 3], [5, 4], [5, 6], [5, 7], [6, 4], [6, 5], [6, 6], [7, 5]]) b[at(r, c)] = 2;
      b[HN_THRONE] = 3;
      this.b = b; this.win = null; this.ply = 0;
    },
    owns(pl, v) { return pl === 1 ? v === 1 : v === 2 || v === 3; },
    count(pl) { let n = 0; for (const v of this.b) if (this.owns(pl, v)) n++; return n; },
    restricted(i) { return i === HN_THRONE || HN_CORNERS.includes(i); },
    edge(i) { const r = (i / 11) | 0, c = i % 11; return r === 0 || r === 10 || c === 0 || c === 10; },
    nb(k) { const r = (k / 11) | 0, c = k % 11; return HN_DIRS.map(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr < 0 || rr > 10 || cc < 0 || cc > 10 ? -1 : rr * 11 + cc; }); },
    legal(pl) {
      if (this.win) return [];
      const b = this.b, out = [];
      for (let i = 0; i < 121; i++) {
        const v = b[i]; if (!this.owns(pl, v)) continue;
        const r0 = (i / 11) | 0, c0 = i % 11;
        for (const [dr, dc] of HN_DIRS) {
          let r = r0 + dr, c = c0 + dc;
          while (r >= 0 && r < 11 && c >= 0 && c < 11) {
            const j = r * 11 + c;
            if (b[j]) break;
            if (HN_CORNERS.includes(j) && v !== 3) break;
            if (j !== HN_THRONE || v === 3) out.push({ pl, from: i, to: j });
            r += dr; c += dc;
          }
        }
      }
      return out;
    },
    // Can square j close a trap for the capturing side pl?
    anvil(j, pl) {
      const v = this.b[j];
      if (this.owns(pl, v)) return true;
      if (HN_CORNERS.includes(j)) return true;
      if (j === HN_THRONE) return pl === 0 || v === 0; // hostile to attackers always, to defenders when empty
      return false;
    },
    // The attackers' ring: no defender can reach the edge through empty squares.
    enclosed() {
      const b = this.b, seen = new Uint8Array(121), stack = [];
      for (let i = 0; i < 121; i++) if (b[i] === 2 || b[i] === 3) { seen[i] = 1; stack.push(i); }
      while (stack.length) {
        const k = stack.pop(); if (this.edge(k)) return false;
        for (const j of this.nb(k)) if (j >= 0 && !seen[j] && b[j] !== 1) { seen[j] = 1; stack.push(j); }
      }
      return true;
    },
    apply(m) {
      const b = this.b, v = b[m.from];
      b[m.from] = 0; b[m.to] = v; this.ply++;
      const caps = [];
      if (v === 3 && HN_CORNERS.includes(m.to)) { this.win = { winner: 0, text: 'The king reaches a corner and escapes.' }; return { caps, note: 'The king escapes.' }; }
      const r = (m.to / 11) | 0, c = m.to % 11;
      for (const [dr, dc] of HN_DIRS) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 10 || cc < 0 || cc > 10) continue;
        const n = rr * 11 + cc, t = b[n];
        if (!t || this.owns(m.pl, t)) continue;
        if (t === 3) { // the king: four attackers, or three and the throne; never on the edge
          if (this.edge(n)) continue;
          const caught = this.nb(n).every(j => j === HN_THRONE || (j >= 0 && b[j] === 1));
          if (caught && this.nb(n).filter(j => j === HN_THRONE).length <= 1) { b[n] = 0; caps.push(n); this.win = { winner: 1, text: 'The king is surrounded and taken.' }; }
          continue;
        }
        const fr = rr + dr, fc = cc + dc;
        if (fr < 0 || fr > 10 || fc < 0 || fc > 10) continue;
        if (this.anvil(fr * 11 + fc, m.pl)) { b[n] = 0; caps.push(n); }
      }
      if (!this.win && m.pl === 1 && this.enclosed()) this.win = { winner: 1, text: 'The attackers have closed an unbroken ring around the king and all his defenders.' };
      let note = '';
      if (this.win) note = this.win.text;
      else if (caps.length) note = m.pl === 0 ? (caps.length > 1 ? `You capture ${caps.length} attackers.` : 'You capture an attacker.') : (caps.length > 1 ? `The Scribe captures ${caps.length} of your defenders.` : 'The Scribe captures a defender.');
      return { caps, note };
    },
    result(pl) {
      if (this.win) return this.win;
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no legal move.' : 'The Scribe has no legal move.' };
      if (this.ply >= 300) return { winner: -1, text: 'A hundred and fifty moves each without a result. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.win, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.win = s[1]; this.ply = s[2]; },
    // How many corners the king could reach next move, and how far he is from the nearest.
    kingLines() {
      const k = this.b.indexOf(3); if (k < 0) return { open: 0, dist: 20 };
      const r = (k / 11) | 0, c = k % 11; let open = 0;
      for (const [dr, dc] of HN_DIRS) {
        let rr = r + dr, cc = c + dc, clear = true, last = -1;
        while (rr >= 0 && rr < 11 && cc >= 0 && cc < 11) { const j = rr * 11 + cc; if (this.b[j]) { clear = false; break; } last = j; rr += dr; cc += dc; }
        if (clear && HN_CORNERS.includes(last)) open++;
      }
      const dist = Math.min(...HN_CORNERS.map(q => Math.abs(((q / 11) | 0) - r) + Math.abs((q % 11) - c)));
      return { open, dist };
    },
    turns(pl) {
      const k = this.b.indexOf(3), kr = (k / 11) | 0, kc = k % 11;
      const score = m => { // near the king first, and moves onto the lines to the corners
        const r = (m.to / 11) | 0, c = m.to % 11;
        return Math.abs(r - kr) + Math.abs(c - kc) - (r === 1 || r === 9 || c === 1 || c === 9 ? 2 : 0) - (this.b[m.from] === 3 ? 6 : 0);
      };
      return this.legal(pl).sort((a, b) => score(a) - score(b)).slice(0, 36).map(m => [m]);
    },
    terminal(pl, depth) {
      if (this.win) return this.win.winner === pl ? 1000 + depth : -1000 - depth;
      if (this.ply >= 300) return 0;
      return null;
    },
    // Squares the king can reach in one move.
    kingReach(k) {
      const r0 = (k / 11) | 0, c0 = k % 11, out = [];
      for (const [dr, dc] of HN_DIRS) {
        let r = r0 + dr, c = c0 + dc;
        while (r >= 0 && r < 11 && c >= 0 && c < 11 && !this.b[r * 11 + c]) { out.push(r * 11 + c); r += dr; c += dc; }
      }
      return out;
    },
    evaluate(pl) {
      const k = this.b.indexOf(3); if (k < 0) return pl === 1 ? 900 : -900;
      const { open, dist } = this.kingLines(), reach = this.kingReach(k);
      // A square one king move away from which two corners are open is a threat the attackers must meet.
      let threat = 0;
      for (const q of reach) {
        if (HN_CORNERS.includes(q)) continue;
        this.b[k] = 0; this.b[q] = 3; const n = this.kingLines().open; this.b[q] = 0; this.b[k] = 3;
        if (n > threat) threat = n;
      }
      let around = 0; for (const j of this.nb(k)) if (j >= 0 && this.b[j] === 1) around++;
      let guard = 0; for (const q of [2, 12, 22, 8, 20, 32, 88, 100, 112, 98, 108, 118]) if (this.b[q] === 1) guard++; // the squares that seal each corner
      const sw = (this.count(0) - 1) * 1.4 - this.count(1) * 0.9 + open * (open > 1 ? 40 : 9) + threat * (threat > 1 ? 7 : 2)
        + reach.length * 0.12 - dist * 0.5 - around * 2.2 - guard * 1.1;
      return pl === 0 ? sw : -sw;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

