  /* -------------------------------------------------------------- Bagh-chal
     Nepal's tiger game on the 5 x 5 alquerque board (cells r * 5 + c): four
     tigers against twenty goats. The visitor picks a side. */
  const BC_GOAT = 1, BC_TIGER = 2, BC_GOATS = 20, BC_WIN = 5, BC_CAP = 200;
  const BAGHCHAL = {
    id: 'baghchal', name: 'Bagh-chal', dice: false, ADJ: AQ_ADJ,
    variants: [{ id: 'goats', label: 'You lead the goats' }, { id: 'tigers', label: 'You lead the tigers' }], variant: 'goats', variantLabel: 'Side',
    setVariant(id) { this.variant = id; this.goatPl = id === 'goats' ? 0 : 1; },
    goatPl: 0,
    get first() { return this.goatPl; },
    get rules() {
      return [
        `${this.goatPl === 0 ? 'You lead the twenty goats and the Scribe the four tigers' : 'You lead the four tigers and the Scribe the twenty goats'}. You can swap sides above. The tigers start on the four corners; the goats start off the board, and move first.`,
        'Pieces move along a line to the next empty point. Diagonal lines run only through some points.',
        'While goats remain off the board, each goat turn places one on any empty point; goats may not move until all twenty are down. Tigers move from the start.',
        'A tiger captures by jumping along a line over a goat next to it, to the empty point beyond. Capturing is never compulsory, and only one goat is taken a turn. Goats never capture.',
        'The tigers win by taking five goats. The goats win by leaving no tiger a move.',
        'Once all goats are placed, no move may bring back a position seen before. A side with no move loses; after 100 moves each with no result, the game is drawn.'
      ];
    },
    source: 'Traditional rules of Nepal, as commonly played today. The 100-move draw is our house rule.',
    init() {
      this.b = new Int8Array(25); for (const i of [0, 4, 20, 24]) this.b[i] = BC_TIGER;
      this.inHand = BC_GOATS; this.taken = 0; this.plies = 0; this.hist = []; this.seen = new Set(); this.over = null;
    },
    side(pl) { return pl === this.goatPl ? BC_GOAT : BC_TIGER; },
    key() { return this.b.join(''); },
    jumps(i) { // a tiger's captures from i
      const out = [], r = (i / 5) | 0, c = i % 5;
      for (const [dr, dc] of AQ_ADJ[i]) {
        const m = (r + dr) * 5 + c + dc;
        if (this.b[m] !== BC_GOAT || !AQ_ADJ[m].some(([a, b]) => a === dr && b === dc)) continue;
        const t = (r + 2 * dr) * 5 + c + 2 * dc;
        if (!this.b[t]) out.push({ over: m, to: t });
      }
      return out;
    },
    pseudo(pl) {
      const s = this.side(pl), out = [];
      if (s === BC_GOAT && this.inHand) { for (let i = 0; i < 25; i++) if (!this.b[i]) out.push({ pl, place: i }); return out; }
      for (let i = 0; i < 25; i++) {
        if (this.b[i] !== s) continue;
        const r = (i / 5) | 0, c = i % 5;
        for (const [dr, dc] of AQ_ADJ[i]) { const j = (r + dr) * 5 + c + dc; if (!this.b[j]) out.push({ pl, from: i, to: j }); }
        if (s === BC_TIGER) for (const j of this.jumps(i)) out.push({ pl, from: i, to: j.to, over: j.over, cap: 1 });
      }
      return out;
    },
    legal(pl) {
      if (this.over) return [];
      const ms = this.pseudo(pl);
      if (this.inHand) return ms;
      return ms.filter(m => { // no position may come back once all goats are down
        const v = this.b[m.from]; this.b[m.from] = 0; this.b[m.to] = v; if (m.over !== undefined) this.b[m.over] = 0;
        const ok = !this.seen.has(this.key());
        this.b[m.to] = 0; this.b[m.from] = v; if (m.over !== undefined) this.b[m.over] = BC_GOAT;
        return ok;
      });
    },
    apply(m) {
      const me = m.pl === 0, tigers = this.side(m.pl) === BC_TIGER, res = { note: '' };
      this.plies++;
      if (m.place !== undefined) { this.b[m.place] = BC_GOAT; this.inHand--; }
      else {
        this.b[m.to] = this.b[m.from]; this.b[m.from] = 0;
        if (m.over !== undefined) {
          this.b[m.over] = 0; this.taken++; res.caps = [m.over];
          res.note = me ? `Your tiger takes a goat (${this.taken} of ${BC_WIN}).` : `A tiger takes one of your goats (${this.taken} of ${BC_WIN}).`;
        }
      }
      if (!this.inHand) { const k = this.key(); this.hist.push(k); this.seen.add(k); }
      if (m.place !== undefined && !this.inHand) res.note = 'All twenty goats are on the board. From now on goats move too.';
      if (this.taken >= BC_WIN) this.over = { winner: tigers ? m.pl : 1 - m.pl, text: tigers ? (me ? 'Your tigers have taken five goats.' : 'The tigers have taken five of your goats.') : '' };
      return res;
    },
    result(pl) {
      if (this.over) return this.over;
      if (!this.legal(pl).length) {
        const tig = this.side(pl) === BC_TIGER;
        return { winner: 1 - pl, text: tig ? (pl === 0 ? 'The goats have hemmed in all your tigers.' : 'Your goats have hemmed in every tiger.') : (pl === 0 ? 'Your goats have no move left.' : 'The goats have no move left.') };
      }
      if (this.plies >= BC_CAP + BC_GOATS) return { winner: -1, text: 'A hundred moves each with no result. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.inHand, this.taken, this.plies, this.hist.length, this.over]; },
    restore(s) {
      this.b = s[0].slice(); [, this.inHand, this.taken, this.plies] = s; this.over = s[5];
      while (this.hist.length > s[4]) this.seen.delete(this.hist.pop());
    },
    turns(pl) { return this.legal(pl).sort((a, b) => (b.cap || 0) - (a.cap || 0)).map(m => [m]); },
    terminal(pl, depth) {
      if (this.over) return this.over.winner === pl ? 1000 + depth : -1000 - depth;
      if (this.plies >= BC_CAP + BC_GOATS) return 0;
      return null;
    },
    // Scored for the tigers: goats taken, goats open to capture, and room to move.
    tigerScore() {
      let open = 0, mob = 0, stuck = 0;
      for (let i = 0; i < 25; i++) {
        if (this.b[i] !== BC_TIGER) continue;
        const r = (i / 5) | 0, c = i % 5; let n = 0;
        for (const [dr, dc] of AQ_ADJ[i]) if (!this.b[(r + dr) * 5 + c + dc]) n++;
        const j = this.jumps(i).length; open += j; n += j;
        mob += n; if (!n) stuck++;
      }
      const all = stuck === 4 ? -500 : 0;
      return this.taken * 40 + open * 9 + mob * 1.2 - stuck * 14 + all;
    },
    evaluate(pl) { const t = this.tigerScore(); return this.side(pl) === BC_TIGER ? t : -t; },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 6); },
  };

