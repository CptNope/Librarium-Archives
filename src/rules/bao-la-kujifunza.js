  /* ------------------------------------------------------- Bao la Kujifunza
   * Each player owns a loop of 16 pits: 8 in the outer row and 8 in the inner
   * row facing the other player. A pit is identified as player*16 + L, where
   * L runs round the player's loop anticlockwise seen from above:
   *   visitor:  L 0-7 = outer row, columns 0-7 (left to right as seen by
   *             the visitor); L 8-15 = inner row, columns 7 down to 0.
   *   Scribe:   L 0-7 = outer row, columns 7 down to 0; L 8-15 = inner row,
   *             columns 0-7.
   * Direction +1 is anticlockwise, -1 clockwise. */
  const BAO_INNER = (pl, c) => pl * 16 + (pl === 0 ? 15 - c : 8 + c); // the inner-row pit in column c
  const baoCol = pit => { const pl = pit >> 4, L = pit & 15; return L < 8 ? (pl === 0 ? L : 7 - L) : (pl === 0 ? 15 - L : L - 8); };
  const baoInner = pit => (pit & 15) >= 8;
  const BAO = {
    id: 'bao', name: 'Bao la Kujifunza', dice: false, first: 0, INNER: BAO_INNER, col: baoCol,
    rules: [
      'You own the two rows nearest you: sixteen pits that you sow round as a loop, never into the Scribe\'s side. Every pit starts with two seeds.',
      'Pick up all the seeds of one of your pits holding two or more, and sow them one by one into the following pits, in either direction: pick a pit, then the ring on the side you want to sow toward.',
      'Capture: if your last seed lands in an occupied pit of your inner row, and the Scribe\'s pit opposite has seeds, take them. Sow them into your own pits starting from an end of your inner row (a kichwa): the nearer end if the capture was in one of the two pits at either end, otherwise the end that keeps your direction. If you can capture, you must.',
      'If your last seed lands in any other occupied pit, pick up everything there and keep sowing. The turn ends when a last seed falls into an empty pit. A turn that does not start with a capture captures nothing, and must start from your inner row if it can.',
      'You lose if your inner row is empty, or if you cannot move.'
    ],
    source: 'Bao la Kujifunza, the beginners\' Bao, as transcribed from Zanzibari masters: every seed starts on the board and the house (nyumba) has no special powers.',
    init() { this.p = new Array(32).fill(2); this.ply = 0; },
    count(pl) { let n = 0; for (let k = 0; k < 16; k++) n += this.p[pl * 16 + k]; return n; },
    innerCount(pl) { let n = 0; for (let k = 8; k < 16; k++) n += this.p[pl * 16 + k]; return n; },
    opposite(pit) { const pl = pit >> 4, c = baoCol(pit); return BAO_INNER(1 - pl, c); },
    next(pit, dir) { const pl = pit >> 4; return pl * 16 + (((pit & 15) + dir + 16) % 16); },
    // Where captured seeds start: the kichwa nearest a capture made at either end, else the one that keeps the direction.
    kichwa(pl, capPit, dir) {
      const c = baoCol(capPit);
      // Right kichwa (from the player's own seat) sows anticlockwise, left kichwa clockwise.
      const right = BAO_INNER(pl, pl === 0 ? 7 : 0), left = BAO_INNER(pl, pl === 0 ? 0 : 7);
      if (c <= 1 || c >= 6) { const near = BAO_INNER(pl, c <= 1 ? 0 : 7); return { pit: near, dir: near === right ? 1 : -1 }; }
      return dir === 1 ? { pit: right, dir: 1 } : { pit: left, dir: -1 };
    },
    // Play out a sowing from pit in dir. Returns the trace of pit changes; with apply false, the board is restored.
    sow(pl, pit, dir, capturing, trace) {
      let hand = this.p[pit]; this.p[pit] = 0; trace.push([pit, 0]);
      let at = pit, steps = 0, caps = 0, first = true, mtaji = capturing;
      for (;;) {
        while (hand > 0) { at = this.next(at, dir); this.p[at]++; hand--; trace.push([at, this.p[at]]); }
        if (++steps > 200) break; // a sowing that would never end
        if (this.p[at] === 1) break; // the last seed fell into an empty pit
        const opp = this.opposite(at);
        if (baoInner(at) && this.p[opp] > 0 && (mtaji === null ? first : mtaji)) {
          if (mtaji === null) mtaji = true;
          hand = this.p[opp]; caps += hand; this.p[opp] = 0; trace.push([opp, 0]);
          const k = this.kichwa(pl, at, dir); dir = k.dir;
          // The first captured seed goes into the kichwa itself.
          this.p[k.pit]++; hand--; at = k.pit; trace.push([at, this.p[at]]);
          first = false; continue;
        }
        if (mtaji === null) mtaji = false;
        hand = this.p[at]; this.p[at] = 0; trace.push([at, 0]); first = false;
      }
      return { mtaji: !!mtaji, caps };
    },
    capturesFirst(pl, pit, dir) { // does the opening sowing end in a capture?
      const n = this.p[pit], q = this.p.slice(); q[pit] = 0; let at = pit;
      for (let k = 0; k < n; k++) { at = this.next(at, dir); q[at]++; }
      return q[at] > 1 && baoInner(at) && q[this.opposite(at)] > 0;
    },
    legal(pl) {
      const starts = [];
      for (let L = 0; L < 16; L++) { const pit = pl * 16 + L; if (this.p[pit] >= 2) for (const dir of [1, -1]) starts.push({ pl, pit, dir }); }
      const cap = starts.filter(m => this.capturesFirst(pl, m.pit, m.dir));
      if (cap.length) return cap.map(m => Object.assign(m, { mtaji: true }));
      const inner = starts.filter(m => baoInner(m.pit));
      return (inner.length ? inner : starts).map(m => Object.assign(m, { mtaji: false }));
    },
    apply(m) {
      const trace = [], r = this.sow(m.pl, m.pit, m.dir, m.mtaji ? null : false, trace);
      this.ply++;
      return { trace, note: r.caps ? (m.pl === 0 ? `You capture ${r.caps} seeds.` : `The Scribe captures ${r.caps} of your seeds.`) : '' };
    },
    result(pl) {
      if (!this.innerCount(pl)) return { winner: 1 - pl, text: pl === 0 ? 'Your inner row is empty.' : 'The Scribe\'s inner row is empty.' };
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no pit with two seeds to sow.' : 'The Scribe has no pit with two seeds to sow.' };
      if (this.ply >= 200) { const a = this.count(0), b = this.count(1); return { winner: a > b ? 0 : b > a ? 1 : -1, text: `A hundred moves each. Seeds: you ${a}, the Scribe ${b}.` }; }
      return null;
    },
    snapshot() { return [this.p.slice(), this.ply]; },
    restore(s) { this.p = s[0].slice(); this.ply = s[1]; },
    turns(pl) { return this.legal(pl).map(m => [m]); },
    terminal(pl, depth) {
      if (!this.innerCount(pl) || !this.legal(pl).length) return -1000 - depth;
      if (this.ply >= 200) return 0;
      return null;
    },
    evaluate(pl) { // seeds, then the inner row, then the best capture on offer to the side to move
      let threat = 0;
      for (let L = 0; L < 16; L++) {
        const pit = pl * 16 + L, n = this.p[pit]; if (n < 2) continue;
        for (const dir of [1, -1]) if (this.capturesFirst(pl, pit, dir)) { let at = pit; for (let k = 0; k < n; k++) at = this.next(at, dir); threat = Math.max(threat, this.p[this.opposite(at)]); }
      }
      return this.count(pl) - this.count(1 - pl) + 0.3 * (this.innerCount(pl) - this.innerCount(1 - pl)) + 0.6 * threat;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, pick(4, 4, 10)); }, // Bao is cheap to search: Sharp looks twelve plies ahead
  };

