  /* -------------------------------------------------------- Ludus latrunculorum
     Locus Ludi's "Piso" reconstruction: an 8 x 8 board, twenty counters each,
     placed one at a time, then moved one step. Cells are y * 8 + x. */
  const LT_N = 8, LT_PIECES = 20, LT_QUIET = 60;
  const LT_D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const LT_CORNER = { 0: [1, 8], 7: [6, 15], 56: [48, 57], 63: [55, 62] };
  const LATRUNCULI = {
    id: 'latrunculi', name: 'Ludus Latrunculorum', dice: false, first: 0,
    rules: [
      'This is a modern reconstruction. Roman writers describe the board and the trapping of counters, but not the full rules; the table follows the "Piso" rules of the Locus Ludi project at the University of Fribourg.',
      'You have twenty blue glass counters and the Scribe twenty white. Take turns placing them one at a time on any empty square, you first. Nothing is captured while placing.',
      'Then move one counter one square up, down or sideways onto an empty square. A counter may not step straight back to the square it just left.',
      'Trap an enemy counter between the counter you move and another of yours, along a row or column, and it is taken. A counter in a corner is trapped by counters on the two squares beside it. One move can take several. You may move between two enemy counters safely.',
      'The game ends when a player is down to one counter or cannot move. Whoever has taken more counters wins. If 30 moves each go by with no capture, the game ends there.'
    ],
    source: 'A modern reconstruction: the "Piso" rules of Locus Ludi (University of Fribourg), drawn from Varro, Ovid, Martial and the Laus Pisonis, and from boards found across the Roman world. The 30-move limit is ours.',
    init() { this.b = new Int8Array(64); this.placed = [0, 0]; this.last = [null, null]; this.quiet = 0; this.taken = [0, 0]; this.over = null; },
    placing() { return this.placed[0] + this.placed[1] < 2 * LT_PIECES; },
    count(pl) { let n = 0; for (const v of this.b) if (v === pl + 1) n++; return n; },
    caps(pl, from, to) {
      const me = pl + 1, foe = 2 - pl, x = to & 7, y = to >> 3, out = [];
      const mine = j => j !== from && (j === to || this.b[j] === me);
      for (const [dx, dy] of LT_D4) {
        const ax = x + dx, ay = y + dy; if (ax < 0 || ax > 7 || ay < 0 || ay > 7) continue;
        const a = ay * 8 + ax; if (this.b[a] !== foe) continue;
        const corner = LT_CORNER[a];
        if (corner) { if (corner.every(mine)) out.push(a); continue; }
        const bx = x + 2 * dx, by = y + 2 * dy; if (bx < 0 || bx > 7 || by < 0 || by > 7) continue;
        if (mine(by * 8 + bx)) out.push(a);
      }
      return out;
    },
    steps(pl) {
      const out = [], me = pl + 1, back = this.last[pl];
      for (let i = 0; i < 64; i++) {
        if (this.b[i] !== me) continue;
        const x = i & 7, y = i >> 3;
        for (const [dx, dy] of LT_D4) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || nx > 7 || ny < 0 || ny > 7) continue;
          const j = ny * 8 + nx; if (this.b[j]) continue;
          if (back && back[0] === j && back[1] === i) continue; // no stepping straight back
          out.push({ pl, from: i, to: j, cap: this.caps(pl, i, j).length });
        }
      }
      return out;
    },
    legal(pl) {
      if (this.over) return [];
      if (this.placing()) { const out = []; for (let i = 0; i < 64; i++) if (!this.b[i]) out.push({ pl, place: i }); return out; }
      return this.steps(pl);
    },
    apply(m) {
      const pl = m.pl, me = pl === 0, res = { note: '', taken: [] };
      if (m.place !== undefined) {
        this.b[m.place] = pl + 1; this.placed[pl]++;
        if (!this.placing()) res.note = 'Every counter is placed. Now the counters move.';
        return res;
      }
      const t = this.caps(pl, m.from, m.to);
      this.b[m.to] = this.b[m.from]; this.b[m.from] = 0; this.last[pl] = [m.from, m.to];
      for (const j of t) this.b[j] = 0;
      this.taken[pl] += t.length; this.quiet = t.length ? 0 : this.quiet + 1;
      res.taken = t; res.caps = t;
      if (t.length) res.note = `${me ? 'You trap' : 'The Scribe traps'} ${t.length === 1 ? 'a counter' : t.length + ' counters'}.`;
      this.endCheck(1 - pl);
      return res;
    },
    endCheck(next) {
      const a = this.count(0), c = this.count(1), why = a <= 1 || c <= 1 ? 'down' : this.quiet >= LT_QUIET ? 'quiet' : !this.steps(next).length ? 'stuck' : '';
      if (!why) return;
      const t0 = this.taken[0], t1 = this.taken[1];
      const lead = why === 'down' ? (a <= 1 ? 'You are down to one counter.' : 'The Scribe is down to one counter.') : why === 'quiet' ? 'Thirty moves each without a capture.' : next === 0 ? 'You have no move left.' : 'The Scribe has no move left.';
      this.over = { winner: t0 > t1 ? 0 : t1 > t0 ? 1 : -1, text: `${lead} You took ${t0} counters, the Scribe ${t1}.` };
    },
    result() { return this.over; },
    snapshot() { return [this.b.slice(), this.placed.slice(), this.last.map(x => x && x.slice()), this.quiet, this.taken.slice(), this.over]; },
    restore(s) { this.b = s[0].slice(); this.placed = s[1].slice(); this.last = s[2].map(x => x && x.slice()); this.quiet = s[3]; this.taken = s[4].slice(); this.over = s[5]; },
    turns(pl) { return this.legal(pl).sort((a, b) => (b.cap || 0) - (a.cap || 0)).map(m => [m]); },
    noisy(pl) { return this.placing() ? [] : this.steps(pl).filter(m => m.cap).sort((a, b) => b.cap - a.cap).map(m => [m]); }, // captures, for the end of the search
    terminal(pl, depth) { const r = this.over; if (!r) return null; return r.winner === -1 ? 0 : r.winner === pl ? 1000 + depth : -1000 - depth; },
    evaluate(pl) {
      const opp = 1 - pl, sp = this.steps(pl), so = this.steps(opp);
      let e = (this.taken[pl] - this.taken[opp]) * 10;
      e += (sp.filter(m => m.cap).length - so.filter(m => m.cap).length) * 2 + (sp.length - so.length) * 0.15;
      return e;
    },
    // Placing: keep counters in touch with friends, but in contact with the enemy and near the middle, where the fighting is.
    placeScore(pl, i) {
      const x = i & 7, y = i >> 3; let s = -0.12 * (Math.abs(x - 3.5) + Math.abs(y - 3.5));
      for (const [dx, dy] of LT_D4) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || nx > 7 || ny < 0 || ny > 7) continue;
        const v = this.b[ny * 8 + nx];
        if (v === pl + 1) s += 0.6;
        else if (v) { s += 0.5; const bx = x + 2 * dx, by = y + 2 * dy; if (bx >= 0 && bx < 8 && by >= 0 && by < 8 && !this.b[by * 8 + bx]) s += 0.4; } // an enemy that could be trapped from beyond
      }
      if (LT_CORNER[i]) s -= 1.5;
      return s;
    },
    aiPlan(pl, depth) {
      if (this.placing()) {
        let best = null, bv = -Infinity; const noise = pick(4, 0.8, 0.2);
        for (const m of this.legal(pl)) { const v = this.placeScore(pl, m.place) + Math.random() * noise; if (v > bv) { bv = v; best = m; } }
        return [best];
      }
      return bestPlan(this, pl, depth, 4);
    },
  };

