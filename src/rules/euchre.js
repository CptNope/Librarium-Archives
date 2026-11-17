  /* ---------------------------------------------------------------- Euchre
   * Four seats as at Whist: 0 you (South), 1 West, 2 North, your partner, 3 East; seats 0 and 2 against 1
   * and 3. The pack is the nines up of every suit, in the cribbage numbering (suit * 13 + rank, rank 0 the ace:
   * nine 8, ten 9, jack 10, queen 11, king 12), and with the Joker, card 52, the Best Bower, as the top trump.
   * The jack of trumps is the right bower; the other jack of the same colour, the left bower, becomes a trump. */
  const EU_SEAT = ['You', 'West', 'North', 'East'];
  const EU_SIDE = ['You and North', 'West and East'];
  const EU_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const EU_RANK = ['ace', '', '', '', '', '', '', '', 'nine', 'ten', 'jack', 'queen', 'king'];
  const EU_JOKER = 52, EU_J = 10;
  const EU_PACK = []; for (let su = 0; su < 4; su++) for (const r of [8, 9, 10, 11, 12, 0]) EU_PACK.push(su * 13 + r);
  const euMate = su => [3, 2, 1, 0][su]; // the other suit of the same colour
  const euRaw = c => (c === EU_JOKER ? -1 : (c / 13) | 0), euRank = c => c % 13;
  const euName = c => (c === EU_JOKER ? 'Joker' : `${EU_RANK[euRank(c)]} of ${EU_SUIT[euRaw(c)]}`);
  const EU_ORDER = { 0: 6, 12: 5, 11: 4, 10: 3, 9: 2, 8: 1 }; // ace, king, queen, jack, ten, nine
  const EUCHRE = {
    id: 'euchre', name: 'Euchre', dice: false, first: 0, target: 10, cardName: euName,
    SEATS: EU_SEAT, SIDES: EU_SIDE, SUITS: EU_SUIT,
    variants: [{ id: 'joker', label: 'With the Joker' }, { id: 'plain', label: '24 cards' }], variant: 'joker', variantLabel: 'Pack',
    setVariant(id) { this.variant = id === 'plain' ? 'plain' : 'joker'; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'You sit South; North, your partner, and West and East against you, are played by the Scribe. Each of you holds five cards from a pack of nines to aces, with the Joker as an extra card (or without it, at 24 cards). One card is turned up.',
      'Making trumps: in turn from the dealer\'s left, each player may order the turned card\'s suit as trumps or pass; if they order it, the dealer takes the card and discards one. If all four pass, each in turn may name another suit, or pass again; if everyone passes twice, the deal is thrown in. If the Joker is turned up, the dealer names trumps.',
      'Trumps rank: the Joker (the Best Bower), the jack of trumps (the right bower), the other jack of the same colour (the left bower, which counts as a trump), then ace, king, queen, ten and nine. Other suits rank ace, king, queen, jack, ten, nine.',
      'The side that made trumps must take three of the five tricks. The maker may play alone, without a partner. Follow suit if you can, otherwise play anything; the highest trump wins, or the highest card of the suit led.',
      'Makers take three or four tricks: 1 point; all five, a march: 2, or 4 played alone. Makers who take fewer than three are euchred: the other side scores 2. The first side to 10 wins.'
    ],
    source: 'Four-handed Euchre, after the rules at pagat.com, with American scoring to 10. Going alone is declared once trumps are made; the Joker, when turned up, makes the dealer\'s side the makers.',
    init() { this.score = [0, 0]; this.over = null; this.decided = null; this.dealer = 3; this.hand = 0; this.notes = []; this.deal(); },
    deal() {
      const d = EU_PACK.slice(); if (this.variant === 'joker') d.push(EU_JOKER);
      for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      this.hands = [[], [], [], []];
      for (let k = 0; k < 20; k++) this.hands[(this.dealer + 1 + k) % 4].push(d[k]);
      this.up = d[20]; this.kitty = d.slice(21); this.upSuit = euRaw(this.up);
      this.trump = -1; this.maker = -1; this.alone = -1; this.out = -1;
      this.trick = []; this.tricks = [0, 0]; this.played = []; this.lastTrick = null; this.buried = null;
      this.void = [0, 1, 2, 3].map(() => [false, false, false, false]);
      this.hand++; this.notes = [];
      if (this.up === EU_JOKER) { this.need = 'joker'; this.toMove = this.dealer; }
      else { this.need = 'order1'; this.toMove = (this.dealer + 1) % 4; }
      this.sortAll();
    },
    who(s) { return s === 0 ? 'You' : EU_SEAT[s]; },
    side: s => s & 1,
    // The suit a card belongs to now: the Joker and the left bower are trumps.
    suitOf(c, T = this.trump) { if (c === EU_JOKER) return T; if (T >= 0 && euRank(c) === EU_J && euRaw(c) === euMate(T)) return T; return euRaw(c); },
    power(c, T = this.trump) {
      if (c === EU_JOKER) return 100;
      if (T >= 0 && euRank(c) === EU_J) { if (euRaw(c) === T) return 90; if (euRaw(c) === euMate(T)) return 80; }
      return (this.suitOf(c, T) === T ? 50 : 0) + EU_ORDER[euRank(c)];
    },
    sortAll() { const T = this.trump; this.hands.forEach(h => h.sort((a, b) => ((this.suitOf(a, T) === T) - (this.suitOf(b, T) === T)) || (this.suitOf(a, T) - this.suitOf(b, T)) || this.power(a, T) - this.power(b, T))); },
    beats(a, b) { const T = this.trump, sa = this.suitOf(a), sb = this.suitOf(b); if (sa === sb) return this.power(a) > this.power(b); return sa === T; },
    best() { let b = this.trick[0]; for (const t of this.trick) if (this.beats(t.card, b.card)) b = t; return b; },
    ledSuit() { return this.trick.length ? this.suitOf(this.trick[0].card) : -1; },
    legalCards(hand) { const led = this.ledSuit(); if (led < 0) return hand.slice(); const f = hand.filter(c => this.suitOf(c) === led); return f.length ? f : hand.slice(); },
    nextSeat(s) { let n = (s + 1) % 4; if (n === this.out) n = (n + 1) % 4; return n; },
    get active() { return this.out >= 0 ? 3 : 4; },
    prompt0() {
      const up = euName(this.up), T = EU_SUIT[this.trump];
      switch (this.need) {
        case 'order1': return this.toMove === this.dealer ? `The ${up} is turned up. You deal: pick it up to make ${EU_SUIT[this.upSuit]} trumps, or turn it down.` : `The ${up} is turned up. Order it up to make ${EU_SUIT[this.upSuit]} trumps (the dealer takes the card), or pass.`;
        case 'order2': return `Everyone passed on ${EU_SUIT[this.upSuit]}. Name another suit as trumps, or pass.`;
        case 'joker': return 'The Joker is turned up, so your side makes trumps: name the suit. You take the Joker into your hand.';
        case 'alone': return `${T[0].toUpperCase() + T.slice(1)} are trumps, made by you. Play with North, or alone for 4 points if you take all five tricks?`;
        case 'discard': return `${T[0].toUpperCase() + T.slice(1)} are trumps. You took the turned card: choose a card to discard.`;
        case 'next': return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next deal when you are ready.');
        default: {
          if (!this.trick.length) return `${T[0].toUpperCase() + T.slice(1)} are trumps. Lead any card.`;
          const led = this.ledSuit(), has = this.hands[0].some(c => this.suitOf(c) === led);
          return has ? `${T[0].toUpperCase() + T.slice(1)} are trumps. Follow with a ${led === this.trump ? 'trump' : EU_SUIT[led].slice(0, -1)}${led === this.trump ? ' (the bowers and the Joker count)' : ''}.` : `You cannot follow: play any card. ${T[0].toUpperCase() + T.slice(1)} are trumps.`;
        }
      }
    },
    legal(pl) {
      if (this.over) return [];
      if (this.need === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next deal' }] : [];
      const s = this.toMove; if ((s === 0) !== (pl === 0)) return [];
      const dealer = s === this.dealer;
      switch (this.need) {
        case 'order1': return [{ pl, seat: s, kind: 'order', label: dealer ? 'Pick it up' : 'Order it up' }, { pl, seat: s, kind: 'pass', label: dealer ? 'Turn it down' : 'Pass' }];
        case 'order2': return EU_SUIT.map((n, su) => ({ pl, seat: s, kind: 'name', suit: su, label: n[0].toUpperCase() + n.slice(1) })).filter(m => m.suit !== this.upSuit).concat([{ pl, seat: s, kind: 'pass', label: 'Pass' }]);
        case 'joker': return EU_SUIT.map((n, su) => ({ pl, seat: s, kind: 'name', suit: su, label: n[0].toUpperCase() + n.slice(1) }));
        case 'alone': return [{ pl, seat: s, kind: 'alone', on: false, label: 'Play with North' }, { pl, seat: s, kind: 'alone', on: true, label: 'Play alone' }];
        case 'discard': return this.hands[s].map(card => ({ pl, seat: s, kind: 'discard', card }));
        default: return this.legalCards(this.hands[s]).map(card => ({ pl, seat: s, kind: 'play', card }));
      }
    },
    // Trumps are made: the maker then says whether to play alone.
    make(s, T, events, round) {
      this.trump = T; this.maker = s; this.round = round; this.sortAll();
      events.push({ type: 'trumps', seat: s, suit: T });
      this.need = 'alone'; this.toMove = s;
    },
    startPlay() { this.need = 'play'; this.toMove = this.nextSeat(this.dealer); if (this.alone >= 0 && this.out === this.toMove) this.toMove = this.nextSeat(this.toMove); },
    apply(m) {
      const s = m.seat, events = [], Y = s === 0;
      if (m.kind === 'next') {
        if (this.decided) { this.over = this.decided; return { note: '' }; }
        this.dealer = (this.dealer + 1) % 4; this.deal();
        return { note: `${this.who(this.dealer)} ${this.dealer ? 'deals' : 'deal'}, and the ${euName(this.up)} is turned up.`, events: [{ type: 'deal' }] };
      }
      if (m.kind === 'pass') {
        events.push({ type: 'pass', seat: s });
        if (this.need === 'order1') {
          if (s === this.dealer) { this.need = 'order2'; this.toMove = (this.dealer + 1) % 4; events.push({ type: 'turnDown' }); return { note: `${this.who(s)} ${Y ? 'turn' : 'turns'} the ${euName(this.up)} down.`, events }; }
          this.toMove = (s + 1) % 4; return { note: `${this.who(s)} ${Y ? 'pass' : 'passes'}.`, events };
        }
        if (s === this.dealer) { // everyone passed twice
          this.notes = ['Everyone passed twice: the deal is thrown in.']; this.need = 'next'; this.toMove = 0;
          return { note: this.notes[0], events };
        }
        this.toMove = (s + 1) % 4; return { note: `${this.who(s)} ${Y ? 'pass' : 'passes'}.`, events };
      }
      if (m.kind === 'order') { this.make(s, this.upSuit, events, 1); return { note: `${this.who(s)} ${s === this.dealer ? (Y ? 'pick it up' : 'picks it up') : (Y ? 'order it up' : 'orders it up')}: ${EU_SUIT[this.upSuit]} are trumps.`, events }; }
      if (m.kind === 'name') { this.make(s, m.suit, events, this.need === 'joker' ? 1 : 2); return { note: `${this.who(s)} ${Y ? 'name' : 'names'} ${EU_SUIT[m.suit]} as trumps.`, events }; }
      if (m.kind === 'alone') {
        if (m.on) { this.alone = s; this.out = (s + 2) % 4; events.push({ type: 'alone', seat: s, out: this.out }); }
        // Trumps made in the first round (or on the Joker): the dealer takes the turned card, unless the dealer is the partner sitting out.
        const note = m.on ? `${this.who(s)} ${Y ? 'play' : 'plays'} alone; ${this.who(this.out).replace('You', 'you')} ${this.out === 0 ? 'sit' : 'sits'} this one out.` : '';
        if (this.round === 1 && this.dealer !== this.out) {
          this.hands[this.dealer].push(this.up); this.sortAll();
          events.push({ type: 'pickup', seat: this.dealer, card: this.up });
          this.need = 'discard'; this.toMove = this.dealer;
        } else this.startPlay();
        return { note, events };
      }
      if (m.kind === 'discard') {
        const h = this.hands[s]; h.splice(h.indexOf(m.card), 1); this.buried = m.card;
        events.push({ type: 'discard', seat: s, card: m.card });
        this.startPlay();
        return { note: `${this.who(s)} ${Y ? 'discard' : 'discards'} a card.`, events };
      }
      // A card to the trick.
      const hand = this.hands[s], led = this.ledSuit();
      hand.splice(hand.indexOf(m.card), 1);
      if (led >= 0 && this.suitOf(m.card) !== led) this.void[s][led] = true;
      this.trick.push({ seat: s, card: m.card }); this.played.push(m.card);
      events.push({ type: 'play', seat: s, card: m.card });
      if (this.trick.length < this.active) { this.toMove = this.nextSeat(s); return { note: '', events }; }
      const w = this.best().seat;
      this.tricks[w & 1]++; this.lastTrick = { cards: this.trick.map(t => t.card), winner: w };
      this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      const notes = [`${this.who(w)} ${w ? 'takes' : 'take'} the trick.`];
      if (this.tricks[0] + this.tricks[1] === 5) this.endHand(notes);
      return { note: notes.join(' '), events };
    },
    endHand(notes) {
      const ms = this.maker & 1, mt = this.tricks[ms], alone = this.alone >= 0;
      let side, pts;
      if (mt >= 3) { side = ms; pts = mt === 5 ? (alone ? 4 : 2) : 1; notes.push(`${EU_SIDE[ms]} made trumps and took ${mt}${mt === 5 ? ', a march' + (alone ? ' alone' : '') : ''}: ${pts} point${pts > 1 ? 's' : ''}.`); }
      else { side = 1 - ms; pts = 2; notes.push(`${EU_SIDE[ms]} made trumps but took only ${mt}: euchred! ${EU_SIDE[side]} score 2.`); }
      this.score[side] += pts;
      notes.push(`Score: ${this.score[0]} to ${this.score[1]}.`);
      if (this.score[side] >= this.target) this.decided = { winner: side, title: side ? 'West and East win' : 'You and North win', text: `${this.score[0]} to ${this.score[1]}, after ${this.hand} deal${this.hand > 1 ? 's' : ''}.` };
      this.notes = notes.slice(); this.need = 'next'; this.toMove = 0;
    },
    passTurn() { if (this.over) return 0; this.seat = this.toMove; return this.seat === 0 ? 0 : 1; },
    get scribeName() { return this.seat === 2 ? 'North, your partner' : EU_SEAT[this.seat]; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* The Scribe's judgement. A hand's worth in a trump suit: the Joker and the bowers count most, then the
     * trump ace and the rest; side aces help, and so do empty suits when there are trumps to ruff with. */
    worth(hand, T) {
      let v = 0, n = 0;
      for (const c of hand) {
        if (this.suitOf(c, T) === T) { n++; const p = this.power(c, T); v += p >= 100 ? 3.6 : p >= 90 ? 3.2 : p >= 80 ? 2.6 : [0, 1.0, 1.2, 0, 1.5, 1.8, 2.2][p - 50] || 1; }
        else if (euRank(c) === 0) v += 1.0;
      }
      if (n >= 2) for (let su = 0; su < 4; su++) if (su !== T && !hand.some(c => this.suitOf(c, T) === su)) v += 0.6;
      return v;
    },
    worstCard(hand, T) { // the card to throw away: no trump, no ace, and best a lone card, to leave a suit empty
      const plain = hand.filter(c => this.suitOf(c, T) !== T && euRank(c) !== 0), pool = plain.length ? plain : hand;
      const count = c => hand.filter(x => this.suitOf(x, T) === this.suitOf(c, T)).length;
      return pool.reduce((a, b) => (count(b) < count(a) || (count(b) === count(a) && this.power(b, T) < this.power(a, T)) ? b : a));
    },
    aiPlan() {
      if (this.need === 'next') return [{ pl: 0, kind: 'next' }];
      const s = this.toMove, hand = this.hands[s], side = s & 1, dSide = this.dealer & 1, level = LEVEL.name;
      const bar = pick(7.2, 6.6, 6.2) - (this.variant === 'plain' ? 0.6 : 0) + (Math.random() - 0.5) * pick(1.6, 0.6, 0.2); // without the Joker every hand is weaker
      const mv = o => [Object.assign({ pl: 1, seat: s }, o)];
      if (this.need === 'order1') {
        const T = this.upSuit;
        let v;
        if (s === this.dealer) { const h = hand.concat(this.up); h.splice(h.indexOf(this.worstCard(h, T)), 1); v = this.worth(h, T); }
        else v = this.worth(hand, T) + (side === dSide ? 0.8 : -0.8); // the turned card goes to the dealer's side
        return v >= bar ? mv({ kind: 'order' }) : mv({ kind: 'pass' });
      }
      if (this.need === 'order2' || this.need === 'joker') {
        let best = -1, bv = -1;
        for (let su = 0; su < 4; su++) { if (this.need === 'order2' && su === this.upSuit) continue; const v = this.worth(this.need === 'joker' ? hand.concat(EU_JOKER) : hand, su); if (v > bv) { bv = v; best = su; } }
        if (this.need === 'joker' || bv >= bar) return mv({ kind: 'name', suit: best });
        return mv({ kind: 'pass' });
      }
      if (this.need === 'alone') {
        const T = this.trump, h = s === this.dealer && (this.up === EU_JOKER || T === this.upSuit) ? (() => { const x = hand.concat(this.up); x.splice(x.indexOf(this.worstCard(x, T)), 1); return x; })() : hand;
        const sure = h.filter(c => this.power(c, T) >= 80).length, v = this.worth(h, T);
        return mv({ kind: 'alone', on: level !== 'gentle' && v >= pick(99, 11.4, 10.6) && sure >= 2 });
      }
      if (this.need === 'discard') return mv({ kind: 'discard', card: this.worstCard(hand, this.trump) });
      const ms = this.legalCards(hand);
      if (ms.length === 1 || (level === 'gentle' && Math.random() < 0.4)) return mv({ kind: 'play', card: ms[(Math.random() * ms.length) | 0] });
      return mv({ kind: 'play', card: this.choose(s, ms) });
    },
    choose(s, ms) {
      const T = this.trump, partner = (s + 2) % 4, gone = new Set(this.played.concat(this.hands[s]));
      const all = EU_PACK.concat(this.variant === 'joker' ? [EU_JOKER] : []);
      const master = c => !all.some(x => !gone.has(x) && x !== c && this.suitOf(x) === this.suitOf(c) && this.power(x) > this.power(c));
      const low = a => a.reduce((x, y) => (this.power(y) < this.power(x) ? y : x)), high = a => a.reduce((x, y) => (this.power(y) > this.power(x) ? y : x));
      const trumps = ms.filter(c => this.suitOf(c) === T), plain = ms.filter(c => this.suitOf(c) !== T);
      if (!this.trick.length) {
        const makers = (this.maker & 1) === (s & 1), abroad = all.some(x => !gone.has(x) && this.suitOf(x) === T);
        if (makers && trumps.length && abroad && master(high(trumps))) return high(trumps); // draw trumps with a winner
        const aces = plain.filter(master); if (aces.length) return aces[0];
        return plain.length ? low(plain) : low(trumps);
      }
      const win = this.best(), winners = ms.filter(c => this.beats(c, win.card));
      if (win.seat === partner && (master(win.card) || this.trick.length === this.active - 1)) return low(plain.length ? plain : ms); // partner has it: throw the least card
      if (winners.length) return low(winners);
      return plain.length ? low(plain) : low(ms);
    },
  };

