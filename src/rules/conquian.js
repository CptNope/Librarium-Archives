  /* -------------------------------------------------------------- Conquian
   * The Mexican game (first named in 1857) from which the rummies grew, two-handed in its Anglo-American form.
   * A 40-card French pack: ace to seven and the jack, queen and king of each suit, numbered suit * 13 + rank
   * (rank 0 the ace). In a run the ace is low and the seven goes next to the jack. Ten cards each; one card at a
   * time lies face up in the centre, and only that card can bring a meld down: you must use it, with cards from
   * your hand, or turn it down. You go out by melding all eleven: your ten and the centre card. */
  const CQ_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const CQ_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', '', '', '', 'jack', 'queen', 'king'];
  const CQ_RANKS = [0, 1, 2, 3, 4, 5, 6, 10, 11, 12];
  const CQ_PACK = []; for (let su = 0; su < 4; su++) for (const r of CQ_RANKS) CQ_PACK.push(su * 13 + r);
  const cqSuit = c => (c / 13) | 0, cqRank = c => c % 13, cqSeq = c => CQ_RANKS.indexOf(cqRank(c)); // 0-9, the seven and jack adjacent
  const cqName = c => `${CQ_RANK[cqRank(c)]} of ${CQ_SUIT[cqSuit(c)]}`;
  // Short names in words, so the Pack switch can translate them: 'six of hearts', '5-6-7 of hearts',
  // 'kings of spades, hearts and clubs'.
  const CQ_SHORT = ['ace', '2', '3', '4', '5', '6', '7', '', '', '', 'jack', 'queen', 'king'];
  const CQ_PLURAL = ['aces', 'twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', '', '', '', 'jacks', 'queens', 'kings'];
  const cqAnd = a => (a.length === 1 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const cqShort = c => `${CQ_SHORT[cqRank(c)]} of ${CQ_SUIT[cqSuit(c)]}`;
  const cqList = cs => {
    if (cs.length === 1) return 'the ' + cqShort(cs[0]);
    if (cs.every(c => cqRank(c) === cqRank(cs[0]))) return `the ${CQ_PLURAL[cqRank(cs[0])]} of ${cqAnd(cs.map(c => CQ_SUIT[cqSuit(c)]))}`;
    if (cs.every(c => cqSuit(c) === cqSuit(cs[0]))) return `the ${cs.slice().sort((a, b) => cqSeq(a) - cqSeq(b)).map(c => CQ_SHORT[cqRank(c)]).join('-')} of ${CQ_SUIT[cqSuit(cs[0])]}`;
    return cqAnd(cs.map(c => 'the ' + cqShort(c)));
  };
  // Is this a meld? A set of three or four of a rank, or a run of three to eight in one suit.
  function cqMeld(cs) {
    if (cs.length < 3) return null;
    if (cs.every(c => cqRank(c) === cqRank(cs[0]))) return cs.length <= 4 ? 'set' : null;
    if (cs.length > 8 || !cs.every(c => cqSuit(c) === cqSuit(cs[0]))) return null;
    const q = cs.map(cqSeq).sort((a, b) => a - b);
    return q.every((x, i) => !i || x === q[i - 1] + 1) ? 'run' : null;
  }
  const cqSort = cs => cs.slice().sort((a, b) => (cqMeld(cs) === 'run' ? cqSeq(a) - cqSeq(b) : cqSuit(a) - cqSuit(b)));
  const CONQUIAN = {
    id: 'conquian', name: 'Conquian', dice: false, first: 0, cardName: c => cqName(c),
    variants: [{ id: '1', label: 'One hand' }, { id: '3', label: 'First to 3' }], variant: '3', variantLabel: 'Game',
    setVariant(id) { this.variant = id === '1' ? '1' : '3'; },
    get target() { return +this.variant; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'Two players, a 40-card pack: ace to seven and the jack, queen and king. Ten cards each; the rest are the stock. A set is three or four cards of a rank; a run is three to eight in a row in one suit, with the ace low and the seven next to the jack (6-7-J is a run, Q-K-A is not).',
      'One card at a time lies face up in the centre. On your turn you may use it: meld it with cards from your hand (a new set or run, or added to one of yours), lay off any other cards that fit your melds, then discard a card face up, which becomes the centre card for the other player.',
      'Or turn it down: it goes face down out of play, and you turn up the top card of the stock. You may use that card the same way, or pass it, and it becomes the centre card for the other player.',
      'A card that fits one of your melds by itself, with no help from your hand, cannot be turned down: the other player forces it on you. You can only meld when you take the centre card.',
      'Go out by melding all eleven cards, your ten and the centre card, leaving nothing to discard: you win the hand. If the stock runs out first, the hand is drawn. The first to win three hands (or a single hand) wins the game.'
    ],
    source: 'Anglo-American two-handed Conquian after pagat.com, which follows R. F. Foster\'s Complete Hoyle (1897). Forcing, an option for the other player in the old game, always happens here.',
    init() { this.wins = [0, 0]; this.over = null; this.decided = null; this.dealer = 1; this.hand = 0; this.notes = []; this.deal(); },
    deal() {
      const d = CQ_PACK.slice();
      for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      this.hands = [[], []];
      for (let k = 0; k < 20; k++) this.hands[(this.dealer + 1 + k) % 2].push(d[k]);
      this.stock = d.slice(20); this.dead = []; this.melds = [[], []];
      this.toMove = 1 - this.dealer; this.centre = this.stock.pop(); this.fresh = true; this.from = 'stock';
      this.stage = 'centre'; this.hand++; this.notes = []; this.sortAll();
    },
    sortAll() { this.hands.forEach(h => h.sort((a, b) => cqSeq(a) - cqSeq(b) || cqSuit(a) - cqSuit(b))); },
    who(pl) { return pl ? 'The Scribe' : 'You'; },
    // Where a single card fits one of a player's melds on its own.
    fits(pl, c) { return this.melds[pl].map((m, i) => (cqMeld(m.concat(c)) ? i : -1)).filter(i => i >= 0); },
    // Every way to bring the centre card down: a new meld with hand cards, or added (with any hand cards it
    // needs to join up) to a meld already down.
    options(pl, c = this.centre) {
      const h = this.hands[pl], out = [], seen = new Set();
      const add = (into, cards) => { const key = into + ':' + cards.slice().sort((a, b) => a - b).join(','); if (seen.has(key)) return; seen.add(key); out.push({ into, cards }); };
      const same = h.filter(x => cqRank(x) === cqRank(c));
      for (let i = 0; i < same.length; i++) for (let j = i + 1; j < same.length; j++) { add(-1, [same[i], same[j]]); for (let k = j + 1; k < same.length; k++) add(-1, [same[i], same[j], same[k]]); }
      const suit = h.filter(x => cqSuit(x) === cqSuit(c)), at = new Map(suit.map(x => [cqSeq(x), x])), q = cqSeq(c);
      for (let lo = Math.max(0, q - 7); lo <= q; lo++) for (let hi = q; hi <= Math.min(9, lo + 7); hi++) {
        if (hi - lo < 2) continue; const cards = [];
        let ok = true; for (let x = lo; x <= hi; x++) if (x !== q) { if (!at.has(x)) { ok = false; break; } cards.push(at.get(x)); }
        if (ok) add(-1, cards);
      }
      this.melds[pl].forEach((m, i) => {
        if (cqMeld(m.concat(c))) add(i, []);
        if (cqMeld(m) !== 'run' || cqSuit(m[0]) !== cqSuit(c)) return;
        const qs = m.map(cqSeq), lo = Math.min(...qs), hi = Math.max(...qs);
        const gap = q > hi ? Array.from({ length: q - hi - 1 }, (_, k) => hi + 1 + k) : q < lo ? Array.from({ length: lo - q - 1 }, (_, k) => q + 1 + k) : [];
        if (gap.length && gap.every(x => at.has(x)) && cqMeld(m.concat(c, gap.map(x => at.get(x))))) add(i, gap.map(x => at.get(x)));
      });
      return out;
    },
    // Hand cards that fit a meld on their own, after the centre card has come down.
    layoffs(pl) { const out = []; for (const x of this.hands[pl]) for (const i of this.fits(pl, x)) out.push({ card: x, into: i }); return out; },
    forced(pl) { return !this.fresh && this.fits(pl, this.centre).length > 0; },
    label(pl, o) {
      if (o.into < 0) return `Meld ${cqList(cqSort(o.cards.concat(this.centre)))}`;
      return `Add ${cqList(cqSort(o.cards.concat(this.centre)))} to ${cqList(cqSort(this.melds[pl][o.into]))}`.replace('Add the ', 'Add the ');
    },
    prompt0() {
      const c = this.centre === null ? '' : cqName(this.centre);
      switch (this.stage) {
        case 'next': return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next hand when you are ready.');
        case 'lay': return 'Lay off any card that fits one of your melds, or discard a card: click it.';
        default:
          if (this.forced(0)) return `The ${c} fits one of your melds by itself, so you must take it.`;
          if (!this.options(0).length) return `The centre card is the ${c}. You cannot use it: ${this.fresh ? 'pass it to the Scribe' : 'turn it down and turn up a new card'}.`;
          return `The centre card is the ${c}. Meld it with cards from your hand, or ${this.fresh ? 'pass it' : 'turn it down'}.`;
      }
    },
    legal(pl) {
      if (this.over) return [];
      if (this.stage === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next hand' }] : [];
      if (this.toMove !== pl) return [];
      if (this.stage === 'lay') {
        return this.layoffs(pl).map(o => ({ pl, kind: 'lay', card: o.card, into: o.into, label: `Lay off the ${cqShort(o.card)} on ${cqList(cqSort(this.melds[pl][o.into]))}` }))
          .concat(this.hands[pl].map(card => ({ pl, kind: 'discard', card })));
      }
      const out = this.options(pl).map(o => ({ pl, kind: 'meld', into: o.into, cards: o.cards, label: this.label(pl, o) }));
      if (!this.forced(pl)) out.push(this.fresh ? { pl, kind: 'pass', label: 'Pass it' } : { pl, kind: 'turn', label: this.stock.length ? 'Turn it down' : 'Turn it down (the stock is empty: a draw)' });
      return out;
    },
    apply(m) {
      const pl = m.pl, events = [], Y = !pl;
      if (m.kind === 'next') {
        if (this.decided) { this.over = this.decided; return { note: '' }; }
        this.dealer = 1 - this.dealer; this.deal();
        return { note: `${this.dealer ? 'The Scribe deals; you turn up the first card.' : 'You deal; the Scribe turns up the first card.'}`, events: [{ type: 'deal' }] };
      }
      if (m.kind === 'meld') {
        const h = this.hands[pl], c = this.centre;
        m.cards.forEach(x => h.splice(h.indexOf(x), 1));
        if (m.into < 0) this.melds[pl].push(cqSort(m.cards.concat(c)));
        else this.melds[pl][m.into] = cqSort(this.melds[pl][m.into].concat(m.cards, c));
        this.centre = null;
        events.push({ type: 'meld', pl, card: c, cards: m.cards, into: m.into });
        if (!h.length) return { note: `${this.who(pl)} ${Y ? 'meld' : 'melds'} the ${cqName(c)}. ` + this.goOut(pl), events };
        this.stage = 'lay';
        return { note: `${this.who(pl)} ${Y ? 'meld' : 'melds'} the ${cqName(c)}${m.cards.length ? ' with ' + cqList(m.cards) : ''}.`, events };
      }
      if (m.kind === 'lay') {
        const h = this.hands[pl]; h.splice(h.indexOf(m.card), 1);
        this.melds[pl][m.into] = cqSort(this.melds[pl][m.into].concat(m.card));
        events.push({ type: 'lay', pl, card: m.card, into: m.into });
        if (!h.length) return { note: this.goOut(pl), events };
        return { note: '', events };
      }
      if (m.kind === 'discard') {
        const h = this.hands[pl]; h.splice(h.indexOf(m.card), 1);
        this.centre = m.card; this.fresh = false; this.from = 'discard'; this.stage = 'centre'; this.toMove = 1 - pl;
        events.push({ type: 'discard', pl, card: m.card });
        return { note: `${this.who(pl)} ${Y ? 'discard' : 'discards'} the ${cqName(m.card)}.`, events };
      }
      if (m.kind === 'turn') { // turn the centre card down and turn up a new one
        this.dead.push(this.centre); events.push({ type: 'dead', card: this.centre });
        if (!this.stock.length) return { note: this.drawn(), events };
        this.centre = this.stock.pop(); this.fresh = true; this.from = 'stock';
        events.push({ type: 'turnup', card: this.centre });
        return { note: `${this.who(pl)} ${Y ? 'turn' : 'turns'} it down and ${Y ? 'turn' : 'turns'} up the ${cqName(this.centre)}.`, events };
      }
      // pass: the card a player turned up goes to the other player
      this.fresh = false; this.from = 'pass'; this.toMove = 1 - pl;
      events.push({ type: 'pass', pl });
      return { note: `${this.who(pl)} ${Y ? 'pass' : 'passes'} the ${cqName(this.centre)}.`, events };
    },
    goOut(pl) {
      this.wins[pl]++;
      const t = `${this.who(pl)} ${pl ? 'goes' : 'go'} out with all eleven cards melded and ${pl ? 'wins' : 'win'} the hand. Hands: you ${this.wins[0]}, the Scribe ${this.wins[1]}.`;
      return this.endHand(t, pl);
    },
    drawn() { return this.endHand(`The stock is empty and the centre card is no use: the hand is drawn. Hands: you ${this.wins[0]}, the Scribe ${this.wins[1]}.`, -1); },
    endHand(t, w) {
      this.notes = [t]; this.stage = 'next'; this.toMove = 0; this.centre = null;
      if (w >= 0 && this.wins[w] >= this.target) this.decided = { winner: w, title: w ? 'The Scribe wins' : 'You win', text: `${this.wins[0]} hand${this.wins[0] === 1 ? '' : 's'} to ${this.wins[1]}, after ${this.hand} hand${this.hand > 1 ? 's' : ''}.` };
      return t;
    },
    passTurn() { return this.over ? 0 : this.toMove; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* The Scribe. A hand card's use: how many others of its rank, and of its suit nearby, it could meld with.
     * It takes the centre card when that brings the most cards down (or when forced), lays off whatever fits,
     * and discards the card it can least use, avoiding (at Fair and Sharp) one that fits the other's melds. */
    use(pl, x, hand = this.hands[pl]) {
      let v = 0;
      for (const y of hand) { if (y === x) continue; if (cqRank(y) === cqRank(x)) v += 1; else if (cqSuit(y) === cqSuit(x)) { const d = Math.abs(cqSeq(y) - cqSeq(x)); if (d === 1) v += 1.1; else if (d === 2) v += 0.5; } }
      return v + this.fits(pl, x).length * 2;
    },
    aiPlan(pl = 1) {
      if (this.stage === 'next') return [{ pl: 0, kind: 'next' }];
      const ms = this.legal(pl);
      if (this.stage === 'lay') {
        const lay = ms.find(m => m.kind === 'lay'); if (lay) return [lay];
        const disc = ms.filter(m => m.kind === 'discard');
        if (LEVEL.name === 'gentle' && Math.random() < 0.35) return [disc[(Math.random() * disc.length) | 0]];
        const risk = c => (LEVEL.name !== 'gentle' && this.fits(1 - pl, c).length ? 3 : 0);
        return [disc.reduce((a, b) => (this.use(pl, b.card) + risk(b.card) + Math.random() * pick(1.5, 0.4, 0.1) < this.use(pl, a.card) + risk(a.card) ? b : a))];
      }
      const melds = ms.filter(m => m.kind === 'meld');
      if (melds.length) {
        // Prefer the meld that brings most cards down while keeping the rest of the hand useful.
        const score = m => { const rest = this.hands[pl].filter(x => !m.cards.includes(x)); return m.cards.length + 1 + rest.reduce((t, x) => t + this.use(pl, x, rest), 0) * 0.15 + (rest.length === 0 ? 50 : 0); };
        const best = melds.reduce((a, b) => (score(b) > score(a) ? b : a));
        if (LEVEL.name !== 'gentle' || Math.random() < 0.8) return [best];
      }
      return [ms.find(m => m.kind !== 'meld') || melds[0]];
    },
  };

