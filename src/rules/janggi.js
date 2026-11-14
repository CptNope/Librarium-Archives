  /* ------------------------------------------------------------------ Janggi
   * Korean chess on 9 files x 10 rows, index r*9+c, row 0 nearest the visitor (Cho, blue).
   * Codes: 1 general, 2 guard, 3 elephant, 4 horse, 5 chariot, 6 cannon, 7 soldier; +8 for Han (the Scribe). */
  const JG_VAL = [0, 0, 3, 3, 5, 13, 7, 2];
  const jgPal = i => { const r = (i / 9) | 0, c = i % 9; return c >= 3 && c <= 5 && (r <= 2 || r >= 7); };
  // Palace diagonals: the corners join the centre.
  const JG_DIAG = (() => {
    const d = Array.from({ length: 90 }, () => []);
    for (const [r0, cr] of [[0, 1], [7, 8]]) {
      const ctr = cr * 9 + 4;
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) { const k = (cr + dr) * 9 + 4 + dc; d[ctr].push(k); d[k].push(ctr); }
    }
    return d;
  })();
  const JANGGI = {
    id: 'janggi', name: 'Janggi', dice: false, first: 0, VAL: JG_VAL,
    rules: [
      'You play Cho (blue) and move first. Checkmate Han\'s general to win. Pieces stand on the points, as in Chinese chess, but there is no river.',
      'General and guards: one step along the lines of their palace, diagonals included, never leaving it. Chariot: any distance in a straight line, and along the palace diagonals. Horse: one step straight then one diagonal, blocked by a piece on the first step. Elephant: one step straight then two diagonal, blocked by any piece on the way.',
      'Cannon: must jump over exactly one piece to move or to capture, landing anywhere beyond. It can neither jump over nor take another cannon. In a palace it may jump along a diagonal over the centre.',
      'Soldier: one step forward or sideways, and diagonally forward inside the enemy palace.',
      'You may pass instead of moving, unless you are in check. If the generals face each other on an open file and the next player does not block it, the game ends and is decided on points (chariot 13, cannon 7, horse 5, elephant 3, guard 3, soldier 2, and 1.5 to Han for moving second). Two passes in a row, or two hundred moves each, are decided the same way.'
    ],
    source: 'Janggi as played in Korea today, with the inner elephants setup for both sides and bikjang decided on points.',
    init() {
      const b = new Array(90).fill(0), back = [5, 4, 3, 2, 0, 2, 3, 4, 5];
      for (let c = 0; c < 9; c++) { b[c] = back[c]; if (back[c]) b[81 + c] = back[c] + 8; }
      b[13] = 1; b[76] = 9;
      for (const c of [1, 7]) { b[18 + c] = 6; b[63 + c] = 14; }
      for (const c of [0, 2, 4, 6, 8]) { b[27 + c] = 7; b[54 + c] = 15; }
      this.b = b; this.ply = 0; this.passes = 0; this.over = null;
    },
    side: v => (v ? (v > 8 ? 1 : 0) : -1),
    gen(pl) { return this.b.indexOf(pl ? 9 : 1); },
    facing() { const a = this.gen(0), b = this.gen(1); if (a < 0 || b < 0 || a % 9 !== b % 9) return false; for (let i = a + 9; i < b; i += 9) if (this.b[i]) return false; return true; },
    points(pl) { let s = pl ? 1.5 : 0; for (const v of this.b) if (v && this.side(v) === pl) s += JG_VAL[v & 7]; return s; },
    pseudo(pl) {
      const b = this.b, out = [];
      const own = j => b[j] && this.side(b[j]) === pl;
      const at = (r, c) => (r < 0 || r > 9 || c < 0 || c > 8 ? -1 : r * 9 + c);
      for (let i = 0; i < 90; i++) {
        const v = b[i]; if (!v || this.side(v) !== pl) continue;
        const t = v & 7, r = (i / 9) | 0, c = i % 9, add = j => { if (j >= 0 && !own(j)) out.push({ pl, from: i, to: j }); };
        if (t === 1 || t === 2) {
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = at(r + dr, c + dc); if (j >= 0 && jgPal(j) && (r <= 2) === (((j / 9) | 0) <= 2)) add(j); }
          for (const j of JG_DIAG[i]) add(j);
        } else if (t === 4 || t === 3) {
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const s1 = at(r + dr, c + dc); if (s1 < 0 || b[s1]) continue;
            for (const side of [-1, 1]) {
              const ddr = dr || side, ddc = dc || side;
              if (t === 4) add(at(r + dr + ddr, c + dc + ddc));
              else { const s2 = at(r + dr + ddr, c + dc + ddc); if (s2 < 0 || b[s2]) continue; add(at(r + dr + 2 * ddr, c + dc + 2 * ddc)); }
            }
          }
        } else if (t === 5) {
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { let rr = r + dr, cc = c + dc; for (;;) { const j = at(rr, cc); if (j < 0) break; add(j); if (b[j]) break; rr += dr; cc += dc; } }
          for (const j of JG_DIAG[i]) { add(j); if (!b[j] && JG_DIAG[j].length === 4) { const far = 2 * j - i; add(far); } }
        } else if (t === 6) {
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            let rr = r + dr, cc = c + dc, screen = false;
            for (;;) {
              const j = at(rr, cc); if (j < 0) break;
              if (!screen) { if (b[j]) { if ((b[j] & 7) === 6) break; screen = true; } }
              else { if (b[j]) { if ((b[j] & 7) !== 6) add(j); break; } add(j); }
              rr += dr; cc += dc;
            }
          }
          for (const j of JG_DIAG[i]) { if (JG_DIAG[j].length !== 4 || !b[j] || (b[j] & 7) === 6) continue; const far = 2 * j - i; if (!b[far] || ((b[far] & 7) !== 6 && !own(far))) add(far); }
        } else if (t === 7) {
          const f = pl === 0 ? 1 : -1;
          add(at(r + f, c)); add(at(r, c - 1)); add(at(r, c + 1));
          for (const j of JG_DIAG[i]) if (((j / 9) | 0) - r === f && jgPal(i)) add(j);
        }
      }
      return out;
    },
    attacked(pl) { // is pl's general attacked?
      const g = this.gen(pl); if (g < 0) return true;
      return this.pseudo(1 - pl).some(m => m.to === g);
    },
    legal(pl) {
      if (this.over) return [];
      const out = this.pseudo(pl).filter(m => { const s = this.snapshot(); this.move(m); const ok = !this.attacked(pl); this.restore(s); return ok; });
      if (!this.attacked(pl)) out.push({ pl, pass: true, label: 'Pass' });
      return out;
    },
    move(m) { if (!m.pass) { this.b[m.to] = this.b[m.from]; this.b[m.from] = 0; } this.ply++; },
    apply(m) {
      const before = this.facing(), cap = m.pass ? 0 : this.b[m.to];
      this.move(m);
      this.passes = m.pass ? this.passes + 1 : 0;
      let note = m.pass ? (m.pl === 0 ? 'You pass.' : 'The Scribe passes.') : '';
      const byPoints = why => { const a = this.points(0), b = this.points(1); this.over = { winner: a > b ? 0 : 1, text: `${why} On points: you ${a}, the Scribe ${b}.` }; };
      if (before && this.facing()) byPoints('The generals face each other and no one blocked them (bikjang).');
      else if (this.passes >= 2) byPoints('Both sides passed.');
      else if (this.ply >= 400) byPoints('Two hundred moves each.');
      else if (this.facing()) note = (note ? note + ' ' : '') + (m.pl === 0 ? 'Bikjang: the generals face each other. The Scribe must block, or the game goes to points.' : 'Bikjang: the generals face each other. Block the file, or the game goes to points.');
      else if (this.attacked(1 - m.pl)) note = (note ? note + ' ' : '') + (m.pl === 0 ? 'Janggun! Check.' : 'Janggun! Your general is in check.');
      return { note, caps: cap ? [m.to] : [] };
    },
    result(pl) {
      if (this.over) return this.over;
      const ms = this.legal(pl);
      if (ms.length === 1 && ms[0].pass && this.attacked(pl)) return { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate.' };
      if (!ms.length) return { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply, this.passes, this.over]; },
    restore(s) { this.b = s[0].slice(); this.ply = s[1]; this.passes = s[2]; this.over = s[3]; },
    turns(pl) {
      const all = this.legal(pl), moves = all.filter(m => !m.pass || this.passes === 0), ms = moves.length ? moves : all; // a pass after a pass only when nothing else is legal
      const val = m => (m.pass ? -5 : this.b[m.to] ? 10 * JG_VAL[this.b[m.to] & 7] - JG_VAL[this.b[m.from] & 7] : 0);
      ms.sort((a, b) => val(b) - val(a));
      return ms.map(m => [m]);
    },
    terminal(pl, depth) {
      if (this.over) return this.over.winner === pl ? 1000 + depth : -1000 - depth;
      const ms = this.legal(pl);
      if (!ms.length || (ms.length === 1 && ms[0].pass && this.attacked(pl))) return -1000 - depth;
      return null;
    },
    evaluate(pl) {
      let s = this.points(pl) - this.points(1 - pl);
      for (let i = 0; i < 90; i++) { const v = this.b[i]; if ((v & 7) === 7) { const p = this.side(v), r = (i / 9) | 0, adv = p === 0 ? r - 3 : 6 - r; s += (p === pl ? 1 : -1) * 0.15 * adv; } }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

