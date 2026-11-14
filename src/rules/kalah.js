  /* ------------------------------------------------------------------- Kalah
   * Pits 0-5 are the visitor's, left to right; 6 is the visitor's store (kalah, on
   * their right); 7-12 the Scribe's, running back the other way; 13 the Scribe's store. */
  const KALAH = {
    id: 'kalah', name: 'Kalah', dice: false, first: 0, seeds: 4, followPrompt: 'Choose another pit to sow.',
    variants: [{ id: '3', label: '3 seeds' }, { id: '4', label: '4 seeds' }, { id: '6', label: '6 seeds' }],
    variant: '4', variantLabel: 'Seeds',
    setVariant(id) { this.variant = ['3', '4', '6'].includes(id) ? id : '4'; this.seeds = +this.variant; },
    rules: [
      'Each of you owns the six pits on your side and the store (kalah) on your right. You move first.',
      'Take all the seeds from one of your pits and sow them one by one, anticlockwise, into the following pits and your own store, but never the Scribe\'s store.',
      'If your last seed falls in your store, you move again.',
      'If it falls in an empty pit on your side and the Scribe\'s pit opposite has seeds, you capture both: that seed and everything opposite go to your store.',
      'When one side\'s pits are all empty, the game ends and the other side puts its remaining seeds in its own store. The fuller store wins.'
    ],
    source: 'Kalah as William Julius Champion Jr. sold it from 1944, with the usual modern rules.',
    init() { const p = new Array(14).fill(this.seeds); p[6] = 0; p[13] = 0; this.p = p; this.over = false; this.ply = 0; },
    pit(pl, k) { return pl * 7 + k; }, store(pl) { return pl * 7 + 6; },
    side(pl) { let n = 0; for (let k = 0; k < 6; k++) n += this.p[pl * 7 + k]; return n; },
    legal(pl) { if (this.over) return []; const out = []; for (let k = 0; k < 6; k++) if (this.p[pl * 7 + k]) out.push({ pl, pit: pl * 7 + k }); return out; },
    apply(m) {
      const p = this.p, pl = m.pl, skip = this.store(1 - pl), trace = [];
      let n = p[m.pit], at = m.pit; p[m.pit] = 0; trace.push([m.pit, 0]);
      while (n) { at = (at + 1) % 14; if (at === skip) continue; p[at]++; n--; trace.push([at, p[at]]); }
      this.ply++;
      let again = at === this.store(pl), caps = 0, note = '';
      const mine = at >= pl * 7 && at < pl * 7 + 6;
      if (mine && p[at] === 1) {
        const opp = 12 - at;
        if (p[opp]) { caps = p[opp] + 1; p[this.store(pl)] += caps; trace.push([opp, 0], [at, 0], [this.store(pl), p[this.store(pl)]]); p[opp] = 0; p[at] = 0; note = pl === 0 ? `You capture ${caps} seeds.` : `The Scribe captures ${caps} seeds.`; }
      }
      // The end: the side with seeds left keeps them.
      if (!this.side(0) || !this.side(1)) {
        for (const q of [0, 1]) { let rest = 0; for (let k = 0; k < 6; k++) { const i = q * 7 + k; if (p[i]) { rest += p[i]; p[i] = 0; trace.push([i, 0]); } } if (rest) { p[this.store(q)] += rest; trace.push([this.store(q), p[this.store(q)]]); } }
        this.over = true; again = false;
      }
      if (again) note = (note ? note + ' ' : '') + (pl === 0 ? 'Your last seed lands in your store: move again.' : 'The Scribe\'s last seed lands in its store, and it moves again.');
      const r = { trace, note, again, caps: caps ? [1] : [] };
      if (again && pl === 0) r.followUp = this.legal(0);
      return r;
    },
    result() {
      if (!this.over) return null;
      const a = this.p[6], b = this.p[13];
      return { winner: a > b ? 0 : b > a ? 1 : -1, text: `Stores: you ${a}, the Scribe ${b}.` };
    },
    snapshot() { return [this.p.slice(), this.over, this.ply]; },
    restore(s) { this.p = s[0].slice(); this.over = s[1]; this.ply = s[2]; },
    // A turn is a whole chain of sowings while the last seed keeps landing in the store.
    turns(pl) {
      const out = [], rec = (prefix, depth) => {
        for (const m of this.legal(pl)) {
          const s = this.snapshot(), r = this.apply(m);
          if (r.again && depth < 8 && this.legal(pl).length) rec(prefix.concat([m]), depth + 1);
          else out.push(prefix.concat([m]));
          this.restore(s);
        }
      };
      rec([], 0);
      return out.length ? out : [[]];
    },
    terminal(pl, depth) {
      if (this.over) { const d = this.p[this.store(pl)] - this.p[this.store(1 - pl)]; return d > 0 ? 1000 + depth : d < 0 ? -1000 - depth : 0; }
      const half = this.seeds * 6;
      if (this.p[this.store(pl)] > half) return 1000 + depth;
      if (this.p[this.store(1 - pl)] > half) return -1000 - depth;
      return null;
    },
    evaluate(pl) { return this.p[this.store(pl)] - this.p[this.store(1 - pl)] + 0.25 * (this.side(pl) - this.side(1 - pl)); },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 8); },
  };

