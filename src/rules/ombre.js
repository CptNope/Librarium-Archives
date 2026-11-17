  /* ----------------------------------------------------------------- Ombre
   * The Spanish game of the 1600s, the first in which trumps were bid for. Three seats round a three-cornered
   * table: 0 you (South), 1 East, on your right, and 2 West; play goes to the right (counter-clockwise), 0, 1, 2.
   * A 40-card French pack without eights, nines and tens, numbered suit * 13 + rank (rank 0 the ace, 1-6 the
   * two to the seven, 10-12 jack, queen, king); suits spades, hearts, diamonds, clubs, so 0 and 3 are black.
   * The ace of spades (spadille) and the ace of clubs (basta) are always trumps. Manille, second best, is the
   * trump two when black is trumps and the trump seven when red is; punto is the trump ace when red is. */
  const OM_SEAT = ['You', 'East', 'West'];
  const OM_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const OM_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', '', '', '', 'jack', 'queen', 'king'];
  const OM_PACK = []; for (let su = 0; su < 4; su++) for (const r of [0, 1, 2, 3, 4, 5, 6, 10, 11, 12]) OM_PACK.push(su * 13 + r);
  const omSuit = c => (c / 13) | 0, omRank = c => c % 13, omBlack = su => su === 0 || su === 3;
  const OM_SPADILLE = 0, OM_BASTA = 39;
  const omName = c => `${OM_RANK[omRank(c)]} of ${OM_SUIT[omSuit(c)]}`;
  const OM_BID = ['', 'Entrada', 'Solo'];
  // Trumps, best first, for each suit; and the plain suits' order, best first.
  const omTrumps = T => {
    const b = T * 13;
    if (omBlack(T)) return [OM_SPADILLE, b + 1, OM_BASTA, b + 12, b + 11, b + 10, b + 6, b + 5, b + 4, b + 3, b + 2].filter((c, i, a) => a.indexOf(c) === i);
    return [OM_SPADILLE, b + 6, OM_BASTA, b, b + 12, b + 11, b + 10, b + 1, b + 2, b + 3, b + 4, b + 5];
  };
  const OM_PLAIN_BLACK = [12, 11, 10, 6, 5, 4, 3, 2, 1], OM_PLAIN_RED = [12, 11, 10, 0, 1, 2, 3, 4, 5, 6];
  const OMBRE = {
    id: 'ombre', name: 'Ombre', dice: false, first: 0, cardName: c => omName(c),
    SEATS: OM_SEAT, SUITS: OM_SUIT,
    variants: [{ id: '6', label: '6 deals' }, { id: '12', label: '12 deals' }], variant: '6', variantLabel: 'Game',
    setVariant(id) { this.variant = id === '12' ? '12' : '6'; },
    get limit() { return +this.variant; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'Three players: you, and East and West, both played by the Scribe. A 40-card pack without eights, nines and tens; each player gets nine cards and thirteen are left face down. Play goes to the right, and the player on the dealer\'s right (forehand) bids first and leads first.',
      'Bidding: pass, or bid Entrada (you will name trumps and exchange cards) or Solo (you name trumps and play the hand as dealt). Each bid must beat the last; a pass is final. The winning bidder is the Ombre, and plays alone against the other two. If all three pass, the next player deals.',
      'Trumps: the ace of spades (spadille) and the ace of clubs (basta) are always trumps. With black trumps they rank spadille, the two (manille), basta, king, queen, jack, seven down to three. With red trumps: spadille, the seven (manille), basta, the ace (punto), king, queen, jack, two up to six. In plain suits, black runs king, queen, jack, seven down to two; red runs king, queen, jack, ace, two up to seven.',
      'The exchange: the Ombre at Entrada throws away any cards and draws as many from the thirteen, then each defender in turn may do the same with what is left. Click cards to mark them, then exchange. Follow suit if you can. When a trump is led you must play a trump, but a matador (spadille, manille or basta) need never be played unless a higher matador was led and you have no other trump.',
      'The Ombre must take more tricks than either defender: sacada, and each defender pays 1 (3 at Solo). Tying the defender with most is puesta: the Ombre pays each of them. If a defender takes more, it is codille: the Ombre pays both, and that defender twice. After 6 deals (or 12) the most counters wins.'
    ],
    source: 'Classic three-handed Ombre after pagat.com and Wikipedia, with two of the old bids, Entrada and Solo, and payments in counters. Vuelta, the lower bids and the vole are left out.',
    init() { this.bank = [0, 0, 0]; this.over = null; this.decided = null; this.dealer = 2; this.deals = 0; this.notes = []; this.deal(); },
    deal() {
      const d = OM_PACK.slice();
      for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      this.hands = [[], [], []];
      for (let k = 0; k < 27; k++) this.hands[(this.dealer + 1 + ((k / 3) | 0)) % 3].push(d[k]); // three at a time, forehand first
      this.talon = d.slice(27); this.discards = [[], [], []];
      this.trump = -1; this.ombre = -1; this.bid = 0; this.passed = [false, false, false]; this.marked = [];
      this.trick = []; this.tricks = [0, 0, 0]; this.played = []; this.lastTrick = null; this.nTricks = 0;
      this.forehand = (this.dealer + 1) % 3; this.toMove = this.forehand; this.need = 'bid'; this.notes = [];
      this.exchangers = []; this.plan = null; this.sortAll();
    },
    who(s) { return s === 0 ? 'You' : OM_SEAT[s]; },
    isTrump(c, T = this.trump) { return c === OM_SPADILLE || c === OM_BASTA || (T >= 0 && omSuit(c) === T); },
    suitOf(c, T = this.trump) { return this.isTrump(c, T) ? 4 : omSuit(c); }, // 4: the trump suit
    // A card's strength: trumps above every plain card; plain cards by their suit's order.
    power(c, T = this.trump) {
      if (T >= 0 && this.isTrump(c, T)) return 100 - omTrumps(T).indexOf(c);
      const order = omBlack(omSuit(c)) ? OM_PLAIN_BLACK : OM_PLAIN_RED;
      return 50 - order.indexOf(omRank(c));
    },
    isMatador(c, T = this.trump) { const t = omTrumps(T); return t.indexOf(c) >= 0 && t.indexOf(c) < 3; },
    title(c, T = this.trump) { if (T < 0) return null; const i = omTrumps(T).indexOf(c); return i === 0 ? 'spadille' : i === 1 ? 'manille' : i === 2 ? 'basta' : i === 3 && !omBlack(T) ? 'punto' : null; },
    sortAll() { const T = this.trump; this.hands.forEach(h => h.sort((a, b) => (T >= 0 ? (this.isTrump(a) - this.isTrump(b)) : 0) || (this.suitOf(a, T) - this.suitOf(b, T)) || this.power(a, T) - this.power(b, T))); },
    beats(a, b) { const sa = this.suitOf(a), sb = this.suitOf(b); if (sa === sb) return this.power(a) > this.power(b); return sa === 4; },
    best() { let b = this.trick[0]; for (const t of this.trick) if (this.beats(t.card, b.card)) b = t; return b; },
    legalCards(hand) {
      if (!this.trick.length) return hand.slice();
      const led = this.trick[0].card, ls = this.suitOf(led);
      if (ls !== 4) { const f = hand.filter(c => this.suitOf(c) === ls); return f.length ? f : hand.slice(); }
      // A trump led: a trump must be played, but a matador is only forced out by a higher matador.
      const T = this.trump, rank = c => omTrumps(T).indexOf(c), trumps = hand.filter(c => this.isTrump(c));
      const forced = trumps.filter(c => !this.isMatador(c) || (this.isMatador(led) && rank(led) < rank(c)));
      return forced.length ? trumps : hand.slice();
    },
    talonLeft() { return this.talon.length; },
    prompt0() {
      const T = this.trump >= 0 ? OM_SUIT[this.trump] : '', Tc = T && T[0].toUpperCase() + T.slice(1);
      switch (this.need) {
        case 'bid': return this.bid ? `${this.who(this.ombre)} ${this.ombre ? 'has' : 'have'} bid ${OM_BID[this.bid]}. Bid higher, or pass.` : `${this.toMove === this.forehand ? 'You are forehand: bid' : 'Bid'} Entrada (name trumps and exchange) or Solo (no exchange), or pass.`;
        case 'trumps': return `You are the Ombre, at ${OM_BID[this.bid]}. Name trumps.`;
        case 'exchange': {
          const n = this.marked.length, max = Math.min(this.talon.length, 9);
          return `${Tc} are trumps. ${this.ombre === 0 ? 'Exchange' : 'Defending: exchange'} up to ${max} cards: click cards to mark them, then exchange${n ? ` (${n} marked)` : ''}.`;
        }
        case 'next': return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next deal when you are ready.');
        default: {
          const role = this.ombre === 0 ? 'you are the Ombre' : `${this.who(this.ombre)} is the Ombre`;
          if (!this.trick.length) return `${Tc} are trumps; ${role} at ${OM_BID[this.bid]}. Lead any card.`;
          const led = this.trick[0].card, ls = this.suitOf(led);
          const can = ls === 4 ? this.hands[0].some(c => this.isTrump(c)) : this.hands[0].some(c => this.suitOf(c) === ls);
          if (!can) return `You cannot follow: play any card. ${Tc} are trumps.`;
          return ls === 4 ? `A trump was led: play a trump (a matador need not be played unless a higher one was led). ${Tc} are trumps.` : `Follow with a ${OM_SUIT[ls].slice(0, -1)}. ${Tc} are trumps.`;
        }
      }
    },
    legal(pl) {
      if (this.over) return [];
      if (this.need === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next deal' }] : [];
      const s = this.toMove; if ((s === 0) !== (pl === 0)) return [];
      switch (this.need) {
        case 'bid': return [1, 2].filter(b => b > this.bid).map(b => ({ pl, seat: s, kind: 'bid', bid: b, label: OM_BID[b] })).concat([{ pl, seat: s, kind: 'pass', label: 'Pass' }]);
        case 'trumps': return OM_SUIT.map((n, su) => ({ pl, seat: s, kind: 'trumps', suit: su, label: n[0].toUpperCase() + n.slice(1) }));
        case 'exchange': {
          const max = Math.min(this.talon.length, 9), out = [];
          for (const c of this.hands[s]) if (this.marked.includes(c) || this.marked.length < max) out.push({ pl, seat: s, kind: 'mark', card: c });
          const n = this.marked.length;
          out.push({ pl, seat: s, kind: 'exchange', cards: this.marked.slice(), label: n ? `Exchange ${n} card${n > 1 ? 's' : ''}` : 'Keep my hand' });
          return out;
        }
        default: return this.legalCards(this.hands[s]).map(card => ({ pl, seat: s, kind: 'play', card }));
      }
    },
    endAuction(events) {
      if (this.ombre < 0) {
        this.notes = ['All three pass: nobody plays this hand, and the deal moves on.']; this.need = 'next'; this.toMove = 0; this.washed = true;
        return this.notes[0];
      }
      this.need = 'trumps'; this.toMove = this.ombre; events.push({ type: 'ombre', seat: this.ombre });
      return `${this.who(this.ombre)} ${this.ombre ? 'is' : 'are'} the Ombre, at ${OM_BID[this.bid]}.`;
    },
    nextBidder(s) { for (let k = 1; k <= 3; k++) { const n = (s + k) % 3; if (!this.passed[n]) return n; } return -1; },
    startExchange() {
      // Entrada: the Ombre exchanges first, then the defenders in turn; at Solo only the defenders do.
      const d1 = (this.ombre + 1) % 3, d2 = (this.ombre + 2) % 3;
      this.exchangers = (this.bid === 1 ? [this.ombre] : []).concat([d1, d2]);
      this.nextExchange();
    },
    nextExchange() {
      while (this.exchangers.length && !this.talon.length) this.exchangers.shift();
      if (!this.exchangers.length) { this.need = 'play'; this.toMove = this.forehand; this.marked = []; return; }
      this.need = 'exchange'; this.toMove = this.exchangers.shift(); this.marked = [];
    },
    apply(m) {
      const s = m.seat, events = [], Y = s === 0;
      if (m.kind === 'next') {
        if (this.decided) { this.over = this.decided; return { note: '' }; }
        this.dealer = (this.dealer + 1) % 3; this.deal();
        return { note: `${this.who(this.dealer)} ${this.dealer ? 'deals' : 'deal'}; ${this.who(this.forehand).replace('You', 'you')} ${this.forehand ? 'is' : 'are'} forehand.`, events: [{ type: 'deal' }] };
      }
      if (m.kind === 'pass') {
        this.passed[s] = true; events.push({ type: 'pass', seat: s });
        const left = [0, 1, 2].filter(k => !this.passed[k]);
        let note = `${this.who(s)} ${Y ? 'pass' : 'passes'}.`;
        if (!left.length || (left.length === 1 && this.ombre === left[0])) note += ' ' + this.endAuction(events);
        else this.toMove = this.nextBidder(s);
        return { note, events };
      }
      if (m.kind === 'bid') {
        this.bid = m.bid; this.ombre = s; events.push({ type: 'bid', seat: s, bid: m.bid });
        let note = `${this.who(s)} ${Y ? 'bid' : 'bids'} ${OM_BID[m.bid]}.`;
        const left = [0, 1, 2].filter(k => !this.passed[k]);
        if (left.length === 1) note += ' ' + this.endAuction(events);
        else this.toMove = this.nextBidder(s);
        return { note, events };
      }
      if (m.kind === 'trumps') {
        this.trump = m.suit; this.sortAll(); events.push({ type: 'trumps', seat: s, suit: m.suit });
        this.startExchange();
        return { note: `${this.who(s)} ${Y ? 'name' : 'names'} ${OM_SUIT[m.suit]} as trumps.`, events };
      }
      if (m.kind === 'mark') {
        const i = this.marked.indexOf(m.card); if (i >= 0) this.marked.splice(i, 1); else this.marked.push(m.card);
        events.push({ type: 'mark', seat: s }); return { note: '', events };
      }
      if (m.kind === 'exchange') {
        const out = m.cards.filter(c => this.hands[s].includes(c)).slice(0, this.talon.length), h = this.hands[s];
        out.forEach(c => { h.splice(h.indexOf(c), 1); this.discards[s].push(c); });
        const inn = this.talon.splice(0, out.length); h.push(...inn); this.sortAll();
        events.push({ type: 'exchange', seat: s, out, in: inn });
        this.marked = []; this.nextExchange();
        return { note: out.length ? `${this.who(s)} ${Y ? 'exchange' : 'exchanges'} ${out.length} card${out.length > 1 ? 's' : ''}.` : `${this.who(s)} ${Y ? 'keep your' : 'keeps its'} hand.`, events };
      }
      // A card to the trick.
      const hand = this.hands[s]; hand.splice(hand.indexOf(m.card), 1);
      this.trick.push({ seat: s, card: m.card }); this.played.push(m.card);
      events.push({ type: 'play', seat: s, card: m.card });
      const t = this.title(m.card), note = t && this.trick.length === 1 && ['spadille', 'manille', 'basta'].includes(t) ? `${this.who(s)} ${Y ? 'lead' : 'leads'} ${t}.` : '';
      if (this.trick.length < 3) { this.toMove = (s + 1) % 3; return { note, events }; }
      const w = this.best().seat;
      this.tricks[w]++; this.nTricks++; this.lastTrick = { cards: this.trick.map(x => x.card), winner: w };
      this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      const notes = [`${this.who(w)} ${w ? 'takes' : 'take'} the trick.`];
      if (this.nTricks === 9) this.endDeal(notes);
      return { note: (note ? note + ' ' : '') + notes.join(' '), events };
    },
    endDeal(notes) {
      const o = this.ombre, d = [(o + 1) % 3, (o + 2) % 3], stake = this.bid === 2 ? 3 : 1, ot = this.tricks[o];
      const top = Math.max(this.tricks[d[0]], this.tricks[d[1]]);
      const pay = (from, to, n) => { this.bank[from] -= n; this.bank[to] += n; };
      const line = `Tricks: ${this.who(o)} ${ot}, ${this.who(d[0])} ${this.tricks[d[0]]}, ${this.who(d[1])} ${this.tricks[d[1]]}.`;
      if (ot > top) { d.forEach(x => pay(x, o, stake)); notes.push(line, `Sacada: ${this.who(o).replace('You', 'you')} ${o ? 'wins' : 'win'}, and each defender pays ${stake}.`); }
      else if (ot === top) { d.forEach(x => pay(o, x, stake)); notes.push(line, `Puesta: a tie, so ${this.who(o).replace('You', 'you')} ${o ? 'pays' : 'pay'} each defender ${stake}.`); }
      else {
        const w = this.tricks[d[0]] > this.tricks[d[1]] ? d[0] : d[1];
        d.forEach(x => pay(o, x, stake)); pay(o, w, stake);
        notes.push(line, `Codille! ${this.who(w)} ${w ? 'takes' : 'take'} more than the Ombre and ${w ? 'is' : 'are'} paid ${stake * 2}; the other defender ${stake}.`);
      }
      this.deals++;
      notes.push(`Counters: you ${this.bank[0]}, East ${this.bank[1]}, West ${this.bank[2]}.`);
      if (this.deals >= this.limit) {
        const hi = Math.max(...this.bank), win = this.bank.indexOf(hi), tie = this.bank.filter(x => x === hi).length > 1;
        this.decided = { winner: tie && this.bank[0] === hi ? 2 : win === 0 ? 0 : 1, title: tie ? 'Level at the top' : win === 0 ? 'You win the game' : `${OM_SEAT[win]} wins the game`, text: `After ${this.deals} deals: you ${this.bank[0]}, East ${this.bank[1]}, West ${this.bank[2]}.` };
      }
      this.notes = notes.slice(); this.need = 'next'; this.toMove = 0;
    },
    passTurn() { if (this.over) return 0; this.seat = this.toMove; return this.seat === 0 ? 0 : 1; },
    get scribeName() { return OM_SEAT[this.seat] || 'The Scribe'; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* The Scribe. A hand's worth with a given trump: the matadors most, then the high trumps and the side kings.
     * It bids when the worth clears a bar (Solo when it clears a higher one), keeps trumps and kings in the
     * exchange, and in play leads trumps from strength as Ombre; as a defender it lets the other defender's
     * winning card stand and spends its high cards against the Ombre. */
    worth(hand, T) {
      let v = 0, nT = 0;
      for (const c of hand) {
        if (this.isTrump(c, T)) { nT++; const i = omTrumps(T).indexOf(c); v += [3.4, 3.0, 2.6, 1.9, 1.5, 1.2, 1.0][i] || 0.75; }
        else if (omRank(c) === 12) v += 1.0;
        else if (omRank(c) === 11 && hand.includes(omSuit(c) * 13 + 12)) v += 0.4;
      }
      for (let su = 0; su < 4; su++) if (su !== T && nT >= 3 && !hand.some(c => !this.isTrump(c, T) && omSuit(c) === su)) v += 0.5;
      return v;
    },
    bestTrump(hand) { let best = 0, bv = -1; for (let T = 0; T < 4; T++) { const v = this.worth(hand, T); if (v > bv) { bv = v; best = T; } } return [best, bv]; },
    keepValue(c, T) { return this.isTrump(c, T) ? 10 + this.power(c, T) / 10 : omRank(c) === 12 ? 6 : 0; },
    aiPlan() {
      if (this.need === 'next') return [{ pl: 0, kind: 'next' }];
      const s = this.toMove, hand = this.hands[s], mv = o => [Object.assign({ pl: 1, seat: s }, o)];
      if (this.need === 'bid' && LEVEL.name === 'sharp' && !this.rollout) {
        // Sharp tries each bid it may make in each suit, against many deals of the cards it cannot see.
        let best = null, bv = 0.05;
        for (const b of [1, 2].filter(x => x > this.bid)) for (let T = 0; T < 4; T++) { const v = this.bidValue(s, T, b); if (v > bv) { bv = v; best = [b, T]; } }
        if (!best) return mv({ kind: 'pass' });
        this.plan = { seat: s, trump: best[1] };
        return mv({ kind: 'bid', bid: best[0] });
      }
      if (this.need === 'trumps' && this.plan && this.plan.seat === s && !this.rollout) return mv({ kind: 'trumps', suit: this.plan.trump });
      if (this.need === 'bid') {
        const [, v] = this.bestTrump(hand), jit = (Math.random() - 0.5) * pick(1.4, 0.5, 0.15);
        const entrada = pick(7.8, 7.0, 6.6) + jit, solo = pick(14, 12.2, 11.6) + jit;
        if (v >= solo && this.bid < 2) return mv({ kind: 'bid', bid: 2 });
        if (v >= entrada && this.bid < 1) return mv({ kind: 'bid', bid: 1 });
        return mv({ kind: 'pass' });
      }
      if (this.need === 'trumps') return mv({ kind: 'trumps', suit: this.bestTrump(hand)[0] });
      if (this.need === 'exchange') {
        const T = this.trump, max = Math.min(this.talon.length, 9), defender = s !== this.ombre;
        // The Ombre throws everything but trumps and kings; a defender keeps a little of the talon for its partner.
        const cap = defender && this.exchangers.length ? Math.min(max, Math.ceil(this.talon.length / 2)) : max;
        const out = hand.filter(c => this.keepValue(c, T) < (defender ? 6 : 6)).sort((a, b) => this.keepValue(a, T) - this.keepValue(b, T) || this.power(a, T) - this.power(b, T)).slice(0, cap);
        return out.map(card => ({ pl: 1, seat: s, kind: 'mark', card })).concat([{ pl: 1, seat: s, kind: 'exchange', cards: out }]);
      }
      const ms = this.legalCards(hand);
      if (ms.length === 1 || (LEVEL.name === 'gentle' && !this.rollout && Math.random() < 0.35)) return mv({ kind: 'play', card: ms[(Math.random() * ms.length) | 0] });
      if (LEVEL.name === 'sharp' && !this.rollout) return mv({ kind: 'play', card: this.sample(s, ms) });
      return mv({ kind: 'play', card: this.choose(s, ms) });
    },
    // What a bid is worth to its maker on average: the unseen cards dealt at random, the exchange and the play
    // made with Fair's judgement.
    bidValue(s, T, b) {
      const pool = OM_PACK.filter(c => !this.hands[s].includes(c)), N = 14; let total = 0;
      for (let k = 0; k < N; k++) {
        const d = pool.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
        const hands = [[], [], []]; hands[s] = this.hands[s].slice(); let at = 0;
        for (const o of [(s + 1) % 3, (s + 2) % 3]) { hands[o] = d.slice(at, at + 9); at += 9; }
        const w = Object.create(OMBRE);
        Object.assign(w, { rollout: true, trump: T, ombre: s, bid: b, forehand: this.forehand, hands, talon: d.slice(at), discards: [[], [], []], marked: [], passed: [false, false, false], trick: [], tricks: [0, 0, 0], played: [], nTricks: 0, bank: [0, 0, 0], deals: 0, variant: '12', notes: [], exchangers: [] });
        w.sortAll(); w.startExchange();
        let guard = 0;
        while (w.nTricks < 9 && guard++ < 200) for (const m of w.aiPlan()) w.apply(m);
        total += w.bank[s];
      }
      return total / N;
    },
    /* Sharp in play: share out the cards it cannot see (the others' hands, from everything not in its own hand
     * or played) at random many times, play each deal out with Fair's judgement, and pick the card that does
     * best on average for its own counters. */
    sample(s, ms) {
      const known = new Set(this.played.concat(this.hands[s])), pool = OM_PACK.filter(c => !known.has(c));
      const others = [(s + 1) % 3, (s + 2) % 3], tally = new Map(ms.map(c => [c, 0])), N = 40;
      for (let k = 0; k < N; k++) {
        const d = pool.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
        const hands = this.hands.map(h => h.slice()); let at = 0;
        for (const o of others) { hands[o] = d.slice(at, at + this.hands[o].length); at += this.hands[o].length; }
        for (const c of ms) {
          const w = Object.create(OMBRE);
          Object.assign(w, { rollout: true, trump: this.trump, ombre: this.ombre, bid: this.bid, forehand: this.forehand, hands: hands.map(h => h.slice()), trick: this.trick.map(t => ({ ...t })), tricks: this.tricks.slice(), played: this.played.slice(), nTricks: this.nTricks, toMove: s, need: 'play', bank: [0, 0, 0], deals: 0, variant: '12', notes: [] });
          w.apply({ pl: 1, seat: s, kind: 'play', card: c });
          let guard = 0;
          while (w.nTricks < 9 && guard++ < 40) w.apply(w.aiPlan()[0]);
          tally.set(c, tally.get(c) + w.bank[s]);
        }
      }
      return ms.reduce((a, b) => (tally.get(b) > tally.get(a) ? b : a));
    },
    choose(s, ms) {
      const T = this.trump, o = this.ombre, gone = new Set(this.played.concat(this.hands[s]));
      const low = a => a.reduce((x, y) => (this.power(y) < this.power(x) ? y : x)), high = a => a.reduce((x, y) => (this.power(y) > this.power(x) ? y : x));
      const master = c => !OM_PACK.some(x => !gone.has(x) && x !== c && this.suitOf(x) === this.suitOf(c) && this.power(x) > this.power(c));
      const trumps = ms.filter(c => this.isTrump(c)), plain = ms.filter(c => !this.isTrump(c));
      if (!this.trick.length) {
        if (s === o) {
          const out = OM_PACK.some(x => !gone.has(x) && this.isTrump(x));
          if (trumps.length && out && master(high(trumps))) return high(trumps); // draw trumps with a sure winner
          const sure = plain.filter(master); if (sure.length) return sure[0];
          if (trumps.length >= 3 && out) return high(trumps);
          return plain.length ? low(plain) : low(trumps);
        }
        const sure = plain.filter(master); if (sure.length) return sure[0];
        return plain.length ? low(plain) : low(ms);
      }
      const b = this.best(), last = this.trick.length === 2, winners = ms.filter(c => this.beats(c, b.card));
      if (s !== o && b.seat !== o && (last || master(b.card) || this.trick.length === 2)) return low(plain.length && ms.some(c => !this.isTrump(c)) ? ms.filter(c => !this.isTrump(c)) : ms); // the other defender holds it
      if (winners.length) {
        if (last) return low(winners);
        const sure = winners.filter(master); if (sure.length) return low(sure);
        return low(winners);
      }
      return low(ms);
    },
  };

