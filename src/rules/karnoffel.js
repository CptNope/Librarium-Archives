  /* ------------------------------------------------------------- Karnöffel
   * The oldest card game whose rules can be pieced together: first named at Nördlingen in 1426. Four seats as at
   * Whist (0 you, South; 1 West; 2 North, your partner; 3 East), partners opposite. A 48-card German pack with no
   * aces, numbered as every card table numbers its cards (suit * 13 + rank): ranks 1-9 are the two to the ten
   * (the Banner), 10 the Unter, 11 the Ober, 12 the king. Suits in pack order: leaves, hearts, bells, acorns.
   * Each player's first card is dealt face up, and the suit of the lowest of them is chosen. In the chosen suit
   * a few cards have powers: the Unter is the Karnöffel, which beats everything; the seven is the Devil, which
   * beats everything but the Karnöffel when it is led; the six (the Pope) and the two (the Emperor) beat
   * everything below them; the three beats all but kings, the four all but kings and Obers, the five all but
   * kings, Obers and Unters. The chosen king, Ober and the rest have no powers. Nobody need follow suit. */
  const KN_SEAT = ['You', 'West', 'North', 'East'];
  const KN_SIDE = ['You and North', 'West and East'];
  const KN_SUIT = ['leaves', 'hearts', 'bells', 'acorns'];
  const KN_RANK = ['', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'Unter', 'Ober', 'king'];
  const KN_PACK = []; for (let su = 0; su < 4; su++) for (let r = 1; r <= 12; r++) KN_PACK.push(su * 13 + r);
  const knSuit = c => (c / 13) | 0, knRank = c => c % 13;
  const knName = c => `${KN_RANK[knRank(c)]} of ${KN_SUIT[knSuit(c)]}`;
  // How strong a plain card is when it follows the suit led: kings, Obers and Unters sit between the powers.
  const KN_TIER = r => (r === 12 ? 60 : r === 11 ? 45 : r === 10 ? 35 : 16 + r);
  const KN_POWER = { 10: 100, 6: 90, 5: 80, 1: 70, 2: 50, 3: 40, 4: 30 }; // Karnöffel, Devil (led), Pope, Emperor, the three, four and five
  const KN_TITLE = { 10: 'the Karnöffel', 6: 'the Devil', 5: 'the Pope', 1: 'the Emperor', 2: 'the chosen three', 3: 'the chosen four', 4: 'the chosen five' };
  const KARNOFFEL = {
    id: 'karnoffel', name: 'Karnöffel', dice: false, first: 0, cardName: c => knName(c),
    SEATS: KN_SEAT, SIDES: KN_SIDE, SUITS: KN_SUIT,
    variants: [{ id: '5', label: 'To 5' }, { id: '7', label: 'To 7' }], variant: '5', variantLabel: 'Game',
    setVariant(id) { this.variant = id === '7' ? '7' : '5'; },
    get target() { return +this.variant; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'Four players in two partnerships: you sit South with North, played by the Scribe, against West and East. Each gets five cards from a 48-card German pack with no aces; the first card each player gets is dealt face up, and the suit of the lowest of them is chosen for the deal. Partners play with their hands open to each other: you can see North\'s cards.',
      'Nobody has to follow suit: play any card. A trick goes to the highest card of the suit led (king, Ober, Unter, ten down to two) unless a card of the chosen suit with a power beats it.',
      'The chosen suit\'s powers: its Unter, the Karnöffel, beats every card. Its seven, the Devil, beats everything but the Karnöffel when it is led, and is a plain seven otherwise; it may not be played to the first trick. Its six, the Pope, and its two, the Emperor, beat everything below them.',
      'The chosen three beats every card but the kings and the cards above; the four every card but kings and Obers; the five every card but kings, Obers and Unters. The chosen king, Ober, ten, nine and eight have no powers.',
      'The first side to take three tricks wins the deal and scores a point; play stops there. The player who led first deals next. The first side to 5 points (or 7) wins.'
    ],
    source: 'After the reconstruction of the Swiss Kaiserspiel and the oldest descriptions (Wikipedia\'s Karnöffel and David Parlett\'s history). The old game raised the stake by offers made during the deal; here every deal is worth one point.',
    init() { this.score = [0, 0]; this.over = null; this.decided = null; this.dealer = 3; this.deals = 0; this.notes = []; this.deal(); },
    deal() {
      const d = KN_PACK.slice();
      for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      this.hands = [[], [], [], []]; this.shown = [];
      for (let k = 0; k < 20; k++) { const s = (this.dealer + 1 + k) % 4; this.hands[s].push(d[k]); if (k < 4) this.shown.push(d[k]); }
      // The lowest face-up card names the chosen suit; of equal cards, the first dealt.
      const low = this.shown.reduce((a, b) => (knRank(b) < knRank(a) ? b : a));
      this.chosen = knSuit(low); this.lowCard = low;
      this.trick = []; this.tricks = [0, 0]; this.played = []; this.lastTrick = null; this.nTricks = 0;
      this.toMove = (this.dealer + 1) % 4; this.leader = this.toMove; this.need = 'play'; this.deals++; this.notes = [];
      this.sortAll();
    },
    who(s) { return s === 0 ? 'You' : KN_SEAT[s]; },
    isDevil(c) { return knSuit(c) === this.chosen && knRank(c) === 6; },
    // A card's strength in the trick: a power if it has one, its rank if it follows the suit led, else nothing.
    eff(c, ledCard) {
      const su = knSuit(c), r = knRank(c);
      if (su === this.chosen && KN_POWER[r] !== undefined) {
        if (r === 6) { if (c === ledCard) return KN_POWER[6]; } else return KN_POWER[r];
      }
      return su === knSuit(ledCard) ? KN_TIER(r) : -1;
    },
    best() { const led = this.trick[0].card; let b = this.trick[0]; for (const t of this.trick) if (this.eff(t.card, led) > this.eff(b.card, led)) b = t; return b; },
    // How good a card is to hold, for sorting and for the Scribe: its power, or its rank as if it led.
    worth(c) { return this.eff(c, c); },
    sortAll() { this.hands.forEach(h => h.sort((a, b) => this.worth(a) - this.worth(b) || a - b)); },
    legalCards(hand) { return this.nTricks === 0 ? hand.filter(c => !this.isDevil(c)) : hand.slice(); },
    title(c) { return knSuit(c) === this.chosen && KN_TITLE[knRank(c)] ? KN_TITLE[knRank(c)] : null; },
    prompt0() {
      if (this.need === 'next') return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next deal when you are ready.');
      const ch = KN_SUIT[this.chosen];
      if (!this.trick.length) return `${ch[0].toUpperCase() + ch.slice(1)} are chosen (the ${knName(this.lowCard)} was lowest). Lead any card${this.nTricks ? '' : ', but not the Devil to the first trick'}.`;
      const b = this.best(), mine = b.seat === 0 || b.seat === 2;
      const t = this.title(b.card), named = t && (t !== 'the Devil' || b.card === this.trick[0].card) ? `${t} (the ${knName(b.card)})` : `the ${knName(b.card)}`;
      return `${mine ? (b.seat ? 'North holds' : 'You hold') : this.who(b.seat) + ' holds'} the trick with ${named}. Play any card: nobody need follow suit. ${ch[0].toUpperCase() + ch.slice(1)} are chosen.`;
    },
    legal(pl) {
      if (this.over) return [];
      if (this.need === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next deal' }] : [];
      const s = this.toMove; if ((s === 0) !== (pl === 0)) return [];
      return this.legalCards(this.hands[s]).map(card => ({ pl, seat: s, kind: 'play', card }));
    },
    apply(m) {
      const events = [];
      if (m.kind === 'next') {
        if (this.decided) { this.over = this.decided; return { note: '' }; }
        this.dealer = (this.dealer + 1) % 4; this.deal();
        return { note: `${this.who(this.dealer)} ${this.dealer ? 'deals' : 'deal'}. The ${knName(this.lowCard)} is the lowest card turned up, so ${KN_SUIT[this.chosen]} are chosen.`, events: [{ type: 'deal' }] };
      }
      const s = m.seat, hand = this.hands[s];
      hand.splice(hand.indexOf(m.card), 1);
      this.trick.push({ seat: s, card: m.card }); this.played.push(m.card);
      events.push({ type: 'play', seat: s, card: m.card });
      const t = this.title(m.card), ledDevil = this.trick.length === 1 && this.isDevil(m.card), big = t && [10, 6, 5, 1].includes(knRank(m.card));
      const note = big && (t !== 'the Devil' || ledDevil) ? `${this.who(s)} ${s ? 'plays' : 'play'} ${t}!` : '';
      if (this.trick.length < 4) { this.toMove = (s + 1) % 4; return { note, events }; }
      const w = this.best().seat;
      this.tricks[w & 1]++; this.nTricks++; this.lastTrick = { cards: this.trick.map(x => x.card), winner: w };
      this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      const notes = [`${this.who(w)} ${w ? 'takes' : 'take'} the trick.`];
      if (this.tricks[0] === 3 || this.tricks[1] === 3) this.endDeal(notes);
      return { note: (note ? note + ' ' : '') + notes.join(' '), events };
    },
    endDeal(notes) {
      const side = this.tricks[0] === 3 ? 0 : 1;
      this.score[side]++;
      notes.push(`${KN_SIDE[side]} take three tricks and win the deal. Score: ${this.score[0]} to ${this.score[1]}.`);
      if (this.score[side] >= this.target) this.decided = { winner: side, title: side ? 'West and East win' : 'You and North win', text: `${this.score[0]} to ${this.score[1]}, after ${this.deals} deal${this.deals > 1 ? 's' : ''}.` };
      this.notes = notes.slice(); this.need = 'next'; this.toMove = 0;
    },
    passTurn() { if (this.over) return 0; this.seat = this.toMove; return this.seat === 0 ? 0 : 1; },
    get scribeName() { return this.seat === 2 ? 'North, your partner' : KN_SEAT[this.seat]; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* Sharp: deal the cards it cannot see between the other side at random, many times over, play each deal
     * out with Fair's judgement for everyone, and pick the card that wins the deal most often. */
    sample(s, ms) {
      const partner = (s + 2) % 4, known = new Set(this.played.concat(this.hands[s], this.hands[partner]));
      const pool = KN_PACK.filter(c => !known.has(c)), opp = [(s + 1) % 4, (s + 3) % 4], side = s & 1;
      const tally = new Map(ms.map(c => [c, 0])), N = 48;
      for (let k = 0; k < N; k++) {
        const d = pool.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
        const hands = this.hands.map(h => h.slice()); let at = 0;
        for (const o of opp) { hands[o] = d.slice(at, at + this.hands[o].length); at += this.hands[o].length; }
        for (const c of ms) {
          const w = Object.create(KARNOFFEL);
          Object.assign(w, { rollout: true, chosen: this.chosen, hands: hands.map(h => h.slice()), trick: this.trick.map(t => ({ ...t })), tricks: this.tricks.slice(), played: this.played.slice(), nTricks: this.nTricks, toMove: s, need: 'play', score: [0, 0], deals: 0, variant: '5' });
          w.apply({ pl: 1, seat: s, kind: 'play', card: c });
          let guard = 0;
          while (w.tricks[0] < 3 && w.tricks[1] < 3 && guard++ < 40) w.apply(w.aiPlan()[0]);
          if (w.tricks[side] >= 3) tally.set(c, tally.get(c) + 1);
        }
      }
      return ms.reduce((a, b) => (tally.get(b) > tally.get(a) ? b : a));
    },
    /* The Scribe. Partners see each other's hands, so each Scribe knows its side's cards and those already
     * played. It leads the Devil once it may, keeps its powers for tricks it must win, lets a partner's sure
     * trick stand, and otherwise wins as cheaply as it can or throws its least useful card. */
    aiPlan() {
      if (this.need === 'next') return [{ pl: 0, kind: 'next' }];
      const s = this.toMove, ms = this.legalCards(this.hands[s]), mv = card => [{ pl: 1, seat: s, kind: 'play', card }];
      if (ms.length === 1) return mv(ms[0]);
      if (LEVEL.name === 'gentle' && Math.random() < 0.45) return mv(ms[(Math.random() * ms.length) | 0]);
      if (LEVEL.name === 'sharp' && !this.rollout) return mv(this.sample(s, ms));
      const partner = (s + 2) % 4, known = new Set(this.played.concat(this.hands[s], this.hands[partner]));
      const unseen = KN_PACK.filter(c => !known.has(c));
      const low = a => a.reduce((x, y) => (this.worth(y) < this.worth(x) ? y : x));
      const beatable = (card, ledCard) => unseen.some(c => this.eff(c, ledCard) > this.eff(card, ledCard));
      if (!this.trick.length) {
        const devil = ms.find(c => this.isDevil(c));
        if (devil && (LEVEL.name !== 'sharp' || unseen.some(c => knSuit(c) === this.chosen && knRank(c) === 10) === false || this.tricks[s & 1] >= 1)) return mv(devil);
        const sure = ms.filter(c => !beatable(c, c) && this.worth(c) >= 30);
        if (sure.length) return mv(low(sure));
        // Lead a king of a suit, or the weakest card if the hand has nothing to press with.
        const kings = ms.filter(c => knRank(c) === 12 && !(knSuit(c) === this.chosen));
        return mv(kings.length ? kings[0] : low(ms));
      }
      const led = this.trick[0].card, b = this.best(), last = this.trick.length === 3;
      const partnerHolds = b.seat === partner && (last || !beatable(b.card, led));
      if (partnerHolds) return mv(low(ms));
      const winners = ms.filter(c => this.eff(c, led) > this.eff(b.card, led));
      if (winners.length) {
        const safe = last ? winners : winners.filter(c => !beatable(c, led));
        const pool = safe.length ? safe : winners;
        const sideNeeds = this.tricks[s & 1] === 2 || this.tricks[1 - (s & 1)] === 2;
        if (safe.length || sideNeeds || LEVEL.name === 'gentle') return mv(pool.reduce((x, y) => (this.eff(y, led) < this.eff(x, led) ? y : x)));
      }
      return mv(low(ms));
    },
  };

