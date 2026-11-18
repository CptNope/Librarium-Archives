  /* ---------------------------------------------------------------- Primero
   * The vying game of the 16th century, in the English form John Florio set out for two players in 1591, with
   * the forty-card pack, the point values and the order of hands that Cardano and Minsheu record. You (0)
   * against the Scribe (1). Cards are numbered suit * 13 + rank, as on every card table here (rank 0 the ace);
   * only aces, twos to sevens and the three courts are in the pack. Spades, hearts, diamonds, clubs. */
  const PR_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const PR_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', '', '', '', 'jack', 'queen', 'king'];
  const PR_RANKS = [0, 1, 2, 3, 4, 5, 6, 10, 11, 12];
  const PR_VAL = [16, 12, 13, 14, 15, 18, 21, 0, 0, 0, 10, 10, 10]; // ace 16, two 12 ... six 18, seven 21, courts 10
  const prSuit = c => (c / 13) | 0, prRank = c => c % 13, prVal = c => PR_VAL[prRank(c)];
  const prName = c => `${PR_RANK[prRank(c)]} of ${PR_SUIT[prSuit(c)]}`;
  const PR_TYPE = ['numerus', 'primero', 'supremus', 'fluxus', 'chorus'];
  const PR_TYPE_NAME = ['a point (numerus)', 'a prime (primero)', 'a fifty-five (supremus)', 'a flush (fluxus)', 'four of a kind (chorus)'];
  // A hand of four, valued: its kind (0 numerus ... 4 chorus) and its points. Fewer than four cards count as a point.
  function prValue(hand) {
    const by = [[], [], [], []]; hand.forEach(c => by[prSuit(c)].push(c));
    const sum = cs => cs.reduce((t, c) => t + prVal(c), 0);
    if (hand.length === 4 && hand.every(c => prRank(c) === prRank(hand[0]))) return { type: 4, pts: sum(hand) };
    if (hand.length === 4 && by.some(s => s.length === 4)) return { type: 3, pts: sum(hand) };
    if (by.some(s => [0, 5, 6].every(r => s.some(c => prRank(c) === r)))) return { type: 2, pts: 55 };
    if (hand.length === 4 && by.every(s => s.length === 1)) return { type: 1, pts: sum(hand) };
    // A point: the best suit of two or three cards; with no two of a suit, the best single card.
    let best = 0; for (const s of by) if (s.length >= 2) best = Math.max(best, sum(s));
    if (!best) best = Math.max(0, ...hand.map(prVal));
    return { type: 0, pts: best };
  }
  const prKey = h => { const v = prValue(h); return v.type * 100 + v.pts; };
  const PR_PACK = [0, 1, 2, 3].flatMap(s => PR_RANKS.map(r => s * 13 + r));
  const prShuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const PRIMERO = {
    id: 'primero', name: 'Primero', dice: false, cardName: prName,
    SUITS: PR_SUIT, value: prValue, key: prKey, typeName: t => PR_TYPE_NAME[t],
    get first() { return this.toMove === undefined ? 0 : this.toMove; },
    variants: [{ id: 'ten', label: 'Ten hands' }, { id: 'out', label: 'Until one is out' }], variant: 'ten', variantLabel: 'Game',
    setVariant(id) { this.variant = id === 'out' ? 'out' : 'ten'; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'You and the Scribe each start with 30 counters, and each hand both put one in the pot. The pack has forty cards: aces, twos to sevens and the three courts of each suit.',
      'Two cards each, then a round of vying. Vie to put a counter in; the other must see you (match it), vie again, or fold and lose the pot. If neither vies, both pass.',
      'Two more cards each. You may then discard up to two and draw as many: click the cards, then exchange them, or keep your hand.',
      'A second round of vying, where you may also vie the rest: three counters, after which there is no more vying. Then both hands are shown.',
      'Hands, high to low: chorus (four of a kind), fluxus (all four of one suit), supremus (the ace, six and seven of one suit, 55), primero (one of each suit), and numerus (the best two or three of one suit). Within a kind, the higher total wins: seven 21, six 18, ace 16, five 15, four 14, three 13, two 12, courts 10. If both are equal, the elder hand (not the dealer) wins.',
      'The game is ten hands (or until one of you has no counters left). Whoever has more counters wins.'
    ],
    source: 'Primero in the English form John Florio describes for two players (1591), with the hands, values and vying of Cardano and Minsheu, after the reconstructions of Justin du Coeur and pagat.com. The hall plays one exchange and limits each round to two vies.',
    init() { this.purse = [30, 30]; this.handNo = 0; this.dealer = 1; this.over = null; this.decided = null; this.notes = []; this.deal(); },
    deal() {
      this.stock = prShuffle(PR_PACK.slice()); this.handNo++; this.dealer = 1 - this.dealer; this.eldest = 1 - this.dealer;
      this.hands = [[], []]; this.discards = [[], []];
      this.pot = 0; this.marked = []; this.swapped = [false, false]; this.shown = false; this.notes = [];
      for (const p of [0, 1]) { const a = Math.min(1, this.purse[p]); this.purse[p] -= a; this.pot += a; }
      for (let k = 0; k < 2; k++) for (const p of [this.eldest, this.dealer]) this.hands[p].push(this.stock.pop());
      this.vies = [0, 0]; // what each player has put in during this round of vying
      this.startRound('bet1');
    },
    startRound(stage) { this.stage = stage; this.inRound = [0, 0]; this.acted = [false, false]; this.raises = 0; this.rest = false; this.toMove = this.eldest; },
    who(p) { return p === 0 ? 'You' : 'The Scribe'; },
    owe(p) { return this.inRound[1 - p] - this.inRound[p]; },
    put(p, n) { const a = Math.min(n, this.purse[p]); this.purse[p] -= a; this.pot += a; this.inRound[p] += a; return a; },
    prompt0() {
      switch (this.stage) {
        case 'next': return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next hand when you are ready.');
        case 'swap': return `You may discard up to two cards and draw as many: click them, then exchange.${this.marked.length ? ` (${this.marked.length} marked)` : ''}`;
        default: {
          const o = this.owe(0), now = prValue(this.hands[0]);
          const hand = this.hands[0].length === 4 ? ` You hold ${PR_TYPE_NAME[now.type]} of ${now.pts}.` : '';
          return (o > 0 ? `The Scribe has vied ${o}. See it, vie again, or fold.` : 'Vie, or pass.') + hand;
        }
      }
    },
    legal(pl) {
      if (this.over) return [];
      if (this.stage === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next hand' }] : [];
      if ((this.toMove === 0) !== (pl === 0)) return [];
      const p = this.toMove;
      if (this.stage === 'swap') {
        const out = this.hands[p].filter(c => this.marked.includes(c) || this.marked.length < 2).map(card => ({ pl, kind: 'mark', card }));
        out.push({ pl, kind: 'swap', cards: this.marked.slice(), label: this.marked.length ? `Exchange ${this.marked.length === 1 ? 'one card' : 'two cards'}` : 'Keep this hand' });
        return out;
      }
      const o = this.owe(p), out = [];
      if (o > 0) {
        out.push({ pl, kind: 'see', label: `See (${Math.min(o, this.purse[p])})` });
        if (!this.rest && this.raises < 2 && this.purse[p] > o && this.purse[1 - p] > 0) out.push({ pl, kind: 'vie', label: 'Vie again (+1)' });
        out.push({ pl, kind: 'fold', label: 'Fold' });
      } else {
        out.push({ pl, kind: 'pass', label: 'Pass' });
        if (this.purse[p] > 0 && this.purse[1 - p] > 0 && this.raises < 2) {
          out.push({ pl, kind: 'vie', label: 'Vie (1)' });
          if (this.stage === 'bet2' && this.purse[p] >= 3) out.push({ pl, kind: 'rest', label: 'Vie the rest (3)' });
        }
      }
      return out;
    },
    apply(m) {
      const p = m.pl === 0 ? 0 : 1, events = [];
      if (m.kind === 'next') { if (this.decided) { this.over = this.decided; return { note: '' }; } this.deal(); return { note: `Hand ${this.handNo}: ${this.dealer ? 'the Scribe deals' : 'you deal'}, and both put a counter in the pot.`, events: [{ type: 'deal' }] }; }
      if (m.kind === 'mark') { const i = this.marked.indexOf(m.card); if (i >= 0) this.marked.splice(i, 1); else this.marked.push(m.card); return { note: '', events: [{ type: 'mark' }] }; }
      const s = this.toMove;
      if (m.kind === 'swap') {
        const out = m.cards.slice(), h = this.hands[s];
        out.forEach(c => { h.splice(h.indexOf(c), 1); this.discards[s].push(c); });
        const got = out.map(() => this.stock.pop()); h.push(...got);
        this.swapped[s] = true; this.marked = [];
        events.push({ type: 'swap', seat: s, out, got });
        const note = s === 0 ? (out.length ? `You discard ${out.length} and draw the ${got.map(prName).join(' and the ')}.` : 'You keep your hand.') : (out.length ? `The Scribe exchanges ${out.length === 1 ? 'one card' : 'two cards'}.` : 'The Scribe keeps its hand.');
        if (!this.swapped[1 - s]) this.toMove = 1 - s; else this.startRound('bet2');
        return { note, events };
      }
      let note = '';
      if (m.kind === 'fold') { this.acted[s] = true; return this.endHand(1 - s, `${this.who(s)} ${s ? 'folds' : 'fold'}.`, events); }
      if (m.kind === 'pass') note = `${this.who(s)} ${s ? 'passes' : 'pass'}.`;
      if (m.kind === 'see') { const a = this.put(s, this.owe(s)); note = `${this.who(s)} ${s ? 'sees' : 'see'}${a ? ` with ${a}` : ''}.`; events.push({ type: 'chips', seat: s, n: a }); }
      if (m.kind === 'vie' || m.kind === 'rest') {
        const extra = m.kind === 'rest' ? 3 : 1, before = this.owe(s), a = this.put(s, before + extra);
        if (this.owe(s) < 0) { // the other cannot cover more than they hold: the excess comes back
          const over = Math.max(0, this.inRound[s] - this.inRound[1 - s] - this.purse[1 - s]);
          if (over) { this.purse[s] += over; this.pot -= over; this.inRound[s] -= over; }
        }
        this.raises++;
        if (m.kind === 'rest') this.rest = true;
        note = m.kind === 'rest' ? `${this.who(s)} ${s ? 'vies' : 'vie'} the rest: three counters, and no more vying.` : `${this.who(s)} ${s ? 'vies' : 'vie'}${before ? ' again' : ''}.`;
        events.push({ type: 'chips', seat: s, n: a });
      }
      this.acted[s] = true;
      // The round ends when both have acted and nothing is owed.
      if (this.acted[0] && this.acted[1] && this.owe(0) === 0 && this.owe(1) === 0) {
        if (this.stage === 'bet1') {
          for (let k = 0; k < 2; k++) for (const q of [this.eldest, this.dealer]) this.hands[q].push(this.stock.pop());
          this.stage = 'swap'; this.toMove = this.eldest; this.marked = [];
          events.push({ type: 'deal2' });
          return { note: note + ' Two more cards each.', events };
        }
        return this.showdown(note, events);
      }
      // Someone all in: no more can be vied, so a matched bet goes straight on.
      this.toMove = 1 - s;
      return { note, events };
    },
    showdown(note, events) {
      const v = [0, 1].map(p => prValue(this.hands[p])), k = [0, 1].map(p => prKey(this.hands[p]));
      const w = k[0] === k[1] ? this.eldest : k[0] > k[1] ? 0 : 1;
      const tell = `You show ${PR_TYPE_NAME[v[0].type]} of ${v[0].pts}; the Scribe shows ${PR_TYPE_NAME[v[1].type]} of ${v[1].pts}.`;
      this.shown = true; events.push({ type: 'show' });
      return this.endHand(w, `${note} ${tell}${k[0] === k[1] ? ' Equal: the elder hand wins.' : ''}`, events);
    },
    endHand(w, note, events) {
      const pot = this.pot; this.purse[w] += pot; this.pot = 0;
      events.push({ type: 'pot', winner: w, n: pot });
      const notes = [note.trim(), `${w ? 'The Scribe takes' : 'You take'} the pot of ${pot}.`, `Counters: you ${this.purse[0]}, the Scribe ${this.purse[1]}.`];
      const out = this.purse.indexOf(0);
      if (out >= 0 || (this.variant === 'ten' && this.handNo >= 10)) {
        const win = this.purse[0] === this.purse[1] ? 2 : this.purse[0] > this.purse[1] ? 0 : 1;
        this.decided = { winner: win, title: win === 2 ? 'Even' : win === 0 ? 'You win' : 'The Scribe wins', text: (out >= 0 ? `${out ? 'The Scribe has' : 'You have'} no counters left. ` : 'Ten hands played. ') + `You finish with ${this.purse[0]} counters, the Scribe with ${this.purse[1]}.` };
      }
      this.notes = notes; this.stage = 'next'; this.toMove = 0;
      return { note: notes.join(' '), events };
    },
    passTurn() { if (this.over) return 0; return this.stage === 'next' ? 0 : this.toMove; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* The Scribe judges its hand by dealing out the unseen cards many times: its own cards still to come, and a
     * hand for you, each improved by the same exchange. It vies when it expects to win well over half the
     * time, sees when the pot pays for the risk, and now and then vies on nothing. Sharp deals more often,
     * reads your vies (a player who vies twice is seldom weak) and chooses its exchange by trying each one. */
    quickSwap(h, pool) { // the exchange a player makes without thinking hard: keep the best-scoring pair or trio
      if (h.length < 4) return h;
      const v = prValue(h); if (v.type >= 1 && v.pts >= 40) return h;
      const by = [0, 1, 2, 3].map(s => h.filter(c => prSuit(c) === s)), long = by.reduce((a, b) => (b.length > a.length || (b.length === a.length && b.reduce((t, c) => t + prVal(c), 0) > a.reduce((t, c) => t + prVal(c), 0)) ? b : a));
      let keep;
      if (long.length >= 3) keep = long.slice(0, 3);
      else { // two suits paired, or one pair: chase a prime by keeping one of each suit, highest
        keep = by.filter(s => s.length).map(s => s.reduce((a, b) => (prVal(b) > prVal(a) ? b : a)));
        if (keep.length < 2) keep = h.slice().sort((a, b) => prVal(b) - prVal(a)).slice(0, 2);
      }
      while (h.length - keep.length > 2) keep.push(h.find(c => !keep.includes(c)));
      const out = h.filter(c => !keep.includes(c));
      return keep.concat(out.map(() => pool.pop()));
    },
    equity(s, n) {
      const known = new Set(this.hands[s].concat(this.discards[s])), pool0 = PR_PACK.filter(c => !known.has(c));
      const sharp = LEVEL.name === 'sharp' && !this.rollout, opVies = sharp ? this.oppVies || 0 : 0;
      let wins = 0, tries = 0, guard = 0;
      while (tries < n && guard++ < n * 6) {
        const d = prShuffle(pool0.slice());
        let mine = this.hands[s].slice(), his = d.splice(0, this.hands[1 - s].length);
        while (mine.length < 4) mine.push(d.pop());
        while (his.length < 4) his.push(d.pop());
        if (!this.swapped[s]) mine = this.quickSwap(mine, d);
        if (!this.swapped[1 - s]) his = this.quickSwap(his, d);
        // Read the other's vying: a strong showing makes weak hands for them less likely.
        if (opVies) { const hv = prValue(his); if (hv.type === 0 && hv.pts < 40 && Math.random() < 0.35 * opVies) continue; }
        const a = prKey(mine), b = prKey(his);
        wins += a > b || (a === b && this.eldest === s) ? 1 : 0; tries++;
      }
      return tries ? wins / tries : 0.5;
    },
    swapChoice(s) {
      const h = this.hands[s];
      if (LEVEL.name === 'gentle' && !this.rollout) return h.filter(() => Math.random() < 0.25).slice(0, 2);
      const known = new Set(h.concat(this.discards[s])), pool = PR_PACK.filter(c => !known.has(c));
      // Opponents' likely hands, for a percentile.
      const opp = []; for (let k = 0; k < 160; k++) { const d = prShuffle(pool.slice()); opp.push(prKey(this.quickSwap(d.slice(0, 4), d.slice(4)))); }
      opp.sort((a, b) => a - b);
      const pct = key => { let lo = 0, hi = opp.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (opp[mid] < key) lo = mid + 1; else hi = mid; } return lo / opp.length; };
      const sets = [[]]; h.forEach((c, i) => { sets.push([c]); h.forEach((d, j) => { if (j > i) sets.push([c, d]); }); });
      const N = LEVEL.name === 'sharp' ? 40 : 14;
      let best = [], bestV = -1;
      for (const out of sets) {
        const keep = h.filter(c => !out.includes(c)); let t = 0;
        for (let k = 0; k < (out.length ? N : 1); k++) { const d = pool.slice(); const got = out.map(() => d.splice((Math.random() * d.length) | 0, 1)[0]); t += pct(prKey(keep.concat(got))); }
        const v = t / (out.length ? N : 1);
        if (v > bestV + 1e-9) { bestV = v; best = out; }
      }
      return best;
    },
    aiPlan() {
      if (this.stage === 'next') return [{ pl: 0, kind: 'next' }];
      const s = this.toMove;
      if (this.stage === 'swap') { const out = this.swapChoice(s); return out.map(card => ({ pl: s, kind: 'mark', card })).concat([{ pl: s, kind: 'swap', cards: out }]); }
      const ms = this.legal(s), has = k => ms.find(m => m.kind === k), pick = k => [Object.assign({}, has(k), { pl: s })];
      if (LEVEL.name === 'gentle' && !this.rollout && Math.random() < 0.3) return [Object.assign({}, ms[(Math.random() * ms.length) | 0], { pl: s })];
      const sharp = LEVEL.name === 'sharp';
      this.oppVies = this.inRound[1 - s] > this.inRound[s] ? 1 + this.raises : 0;
      const e = this.equity(s, sharp ? 260 : 90), o = this.owe(s), odds = o / (this.pot + o), bluff = Math.random() < (sharp ? 0.1 : 0.05);
      if (o > 0) {
        if (has('vie') && (e > (sharp ? 0.74 : 0.8) || (bluff && e > 0.35))) return pick('vie');
        if (e >= odds - (sharp ? 0.04 : 0) || e > 0.42) return pick('see');
        return pick('fold');
      }
      if (has('rest') && e > (sharp ? 0.8 : 0.86)) return pick('rest');
      if (has('vie') && (e > (sharp ? 0.6 : 0.64) || bluff)) return pick('vie');
      return pick('pass');
    },
  };

