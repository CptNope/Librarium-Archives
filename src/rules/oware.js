  /* --------------------------------------------------------------- Oware
   * Pits 0-5 are the visitor's row (left to right as they sit), 6-11 the
   * Scribe's row; sowing runs 0 → 11 and wraps (counterclockwise). */
  const OWARE = {
    id: 'oware', name: 'Oware', dice: false, first: 0, N: 25,
    rules: [
      'Take every seed from one of your six pits (the row nearest you) and sow them one at a time into the following pits, counterclockwise.',
      'If a pit holds 12 or more seeds, skip the pit you emptied as you go around.',
      'If your last seed lands in one of the Scribe\'s pits and makes 2 or 3, capture them, along with any unbroken run of 2s and 3s just before it on the Scribe\'s side.',
      'A move that would capture every seed on the Scribe\'s side captures nothing.',
      'If the Scribe\'s side is empty you must sow into it if you can. If you cannot, the game ends and you keep the seeds on your side.',
      'The first to capture 25 seeds wins.'
    ],
    source: 'Abapa rules, the standard form of Oware played in competitions.',
    init() { this.pits = Array(12).fill(4); this.store = [0, 0]; this.quiet = 0; this.over = null; },
    side(pl) { let n = 0; for (let i = pl * 6; i < pl * 6 + 6; i++) n += this.pits[i]; return n; },
    own(pl, i) { return (i < 6) === (pl === 0); },
    feeds(pl, i) { return this.pits[i] >= (pl === 0 ? 6 - i : 12 - i); },
    legal(pl) {
      if (this.over) return [];
      const must = this.side(1 - pl) === 0, out = [];
      for (let i = pl * 6; i < pl * 6 + 6; i++) {
        if (!this.pits[i]) continue;
        if (must && !this.feeds(pl, i)) continue;
        out.push({ pl, pit: i });
      }
      return out;
    },
    apply(m) {
      const p = this.pits; let n = p[m.pit]; p[m.pit] = 0;
      const path = []; let q = m.pit;
      while (n > 0) { q = (q + 1) % 12; if (q === m.pit) continue; p[q]++; n--; path.push(q); }
      let caps = []; let k = q;
      while (!this.own(m.pl, k) && (p[k] === 2 || p[k] === 3)) { caps.push(k); k = (k + 11) % 12; }
      let note = '';
      if (caps.length) {
        const total = caps.reduce((a, c) => a + p[c], 0);
        if (total === this.side(1 - m.pl)) { caps = []; note = 'That would take every seed on the other side, so nothing is captured.'; }
        else {
          for (const c of caps) { this.store[m.pl] += p[c]; p[c] = 0; }
          note = (m.pl === 0 ? 'You capture ' : 'The Scribe captures ') + total + ' seeds.';
        }
      }
      this.quiet = caps.length ? 0 : this.quiet + 1;
      return { path, caps, note };
    },
    result(pl) {
      if (this.over) return this.over;
      let r = null;
      if (this.store[0] >= 25) r = { winner: 0, text: 'You captured ' + this.store[0] + ' seeds.' };
      else if (this.store[1] >= 25) r = { winner: 1, text: 'The Scribe captured ' + this.store[1] + ' seeds.' };
      else if (this.store[0] === 24 && this.store[1] === 24) r = { winner: -1, text: '24 seeds each. The game is drawn.' };
      else if (!this.legal(pl).length || this.quiet >= 100) {
        if (this.quiet >= 100) { this.store[0] += this.side(0); this.store[1] += this.side(1); }
        else if (this.side(pl) === 0) this.store[1 - pl] += this.side(1 - pl);
        else this.store[pl] += this.side(pl);
        this.pits.fill(0);
        const w = this.store[0] > this.store[1] ? 0 : this.store[1] > this.store[0] ? 1 : -1;
        r = { winner: w, text: `The board is cleared. Final count: you ${this.store[0]}, the Scribe ${this.store[1]}.`, sweep: true };
      }
      if (r) this.over = r;
      return r;
    },
    snapshot() { return [this.pits.slice(), this.store.slice(), this.quiet]; },
    restore(s) { this.pits = s[0].slice(); this.store = s[1].slice(); this.quiet = s[2]; this.over = null; },
    turns(pl) { return this.legal(pl).map(m => [m]); },
    terminal(pl, depth) {
      if (this.store[pl] >= 25) return 1000 + depth;
      if (this.store[1 - pl] >= 25) return -1000 - depth;
      if (!this.legal(pl).length) {
        let a = this.store[pl], b = this.store[1 - pl];
        if (this.side(pl) === 0) b += this.side(1 - pl); else a += this.side(pl);
        return a > b ? 900 : a < b ? -900 : 0;
      }
      return null;
    },
    evaluate(pl) { return this.store[pl] - this.store[1 - pl]; },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 10); },
  };

