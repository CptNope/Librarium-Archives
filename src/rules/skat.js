  /* ------------------------------------------------------------------- Skat
   * Germany's game, from Altenburg around 1810. Three seats round the three-cornered table: 0 you (South), 1 on
   * your left, 2 on your right; play goes to the left, 0, 1, 2. A 32-card pack numbered suit * 13 + rank (rank 0
   * the ace, 6-9 the seven to the ten, 10-12 jack, queen, king); suits spades, hearts, diamonds, clubs. In suit
   * games and grand the four jacks are the top trumps, clubs, spades, hearts, diamonds, and belong to the trump
   * suit; in null there are no trumps and the cards rank in their natural order. */
  const SK_SEAT = ['You', 'West', 'East'];
  const SK_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const SK_RANK = ['ace', '', '', '', '', '', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
  const SK_PACK = []; for (let su = 0; su < 4; su++) for (const r of [0, 6, 7, 8, 9, 10, 11, 12]) SK_PACK.push(su * 13 + r);
  const skSuit = c => (c / 13) | 0, skRank = c => c % 13;
  const skName = c => `${SK_RANK[skRank(c)]} of ${SK_SUIT[skSuit(c)]}`;
  const SK_JACKS = [3 * 13 + 10, 10, 13 + 10, 2 * 13 + 10]; // clubs, spades, hearts, diamonds
  const SK_ORDER = [0, 9, 12, 11, 8, 7, 6]; // ace, ten, king, queen, nine, eight, seven: suit order in suit games and grand
  const SK_NULL = [0, 12, 11, 10, 9, 8, 7, 6]; // ace, king, queen, jack, ten ... seven: null order
  const SK_POINTS = { 0: 11, 9: 10, 12: 4, 11: 3, 10: 2 };
  const skPoints = c => SK_POINTS[skRank(c)] || 0;
  const SK_BASE = { 2: 9, 1: 10, 0: 11, 3: 12, grand: 24 }; // diamonds, hearts, spades, clubs, grand
  const SK_BIDS = [18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50, 54, 55, 59, 60, 63, 66, 70, 72, 77, 80, 81, 84, 88, 90, 96, 99, 100, 108, 110, 117, 120, 121, 126, 130, 132, 135, 140, 143, 144, 150, 153, 154, 156, 160, 162, 165, 168, 170, 176, 180, 187, 192, 198, 204, 216, 240, 264];
  const SK_GAMES = [{ id: 2, label: 'Diamonds' }, { id: 1, label: 'Hearts' }, { id: 0, label: 'Spades' }, { id: 3, label: 'Clubs' }, { id: 'grand', label: 'Grand' }, { id: 'null', label: 'Null' }];
  const SKAT = {
    id: 'skat', name: 'Skat', dice: false, cardName: skName,
    get first() { return this.toMove === undefined || this.toMove === 0 ? 0 : 1; }, // a Scribe may open the bidding, or hold the two of clubs
    SEATS: SK_SEAT, SUITS: SK_SUIT,
    variants: [{ id: '6', label: '6 deals' }, { id: '12', label: '12 deals' }], variant: '6', variantLabel: 'Game',
    setVariant(id) { this.variant = id === '12' ? '12' : '6'; },
    get limit() { return +this.variant; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'Three players: you, and West and East, both played by the Scribe. A 32-card pack; ten cards each, and two face down in the middle, the skat. Play goes to the left. The player on the dealer\'s left is forehand, then middlehand, then the dealer, rearhand.',
      'Bidding: middlehand names numbers to forehand (18, 20, 22, 23, 24, 27, 30 ...), who says yes or passes; then rearhand bids to whoever is left. The last bidder standing is the declarer and must play a game worth at least the bid. If nobody bids, forehand may play at 18 or throw the cards in.',
      'The declarer may pick up the skat and lay two cards away, or play hand. Then names the game: a suit (diamonds 9, hearts 10, spades 11, clubs 12), grand (24, only the jacks are trumps) or null (23, or 35 hand: lose every trick). The jacks are the top trumps, clubs, spades, hearts, diamonds, then the trump suit\'s ace, ten, king, queen, nine, eight, seven.',
      'Forehand leads. Follow suit if you can (a jack counts as a trump, not its suit). Cards count: ace 11, ten 10, king 4, queen 3, jack 2. The declarer, with the skat, needs 61 of the 120.',
      'A suit or grand game is worth its base times: the matadors (top trumps held, or missing, in an unbroken run from the jack of clubs), plus 1 for game, 1 for hand, 1 for schneider (90 points) and 1 for schwarz (every trick). Won, the declarer scores it; lost, twice as much is taken off; worth less than the bid, it is lost anyway. After 6 deals (or 12) the highest score wins.'
    ],
    source: 'The international rules of 1999 after pagat.com, without the announced schneider, schwarz and open games or null ouvert. Scores are the declarer\'s game values, without the extra 50 a won game earns in tournament scoring.',
    init() { this.score = [0, 0, 0]; this.over = null; this.decided = null; this.dealer = 2; this.deals = 0; this.notes = []; this.deal(); },
    deal() {
      const d = SK_PACK.slice();
      for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      this.hands = [[], [], []];
      const fore = (this.dealer + 1) % 3;
      // Three each, two to the skat, four each, three each, starting with forehand.
      let k = 0; const give = n => { for (let r = 0; r < 3; r++) { const s = (fore + r) % 3; for (let i = 0; i < n; i++) this.hands[s].push(d[k++]); } };
      give(3); this.skat = d.slice(k, k + 2); k += 2; give(4); give(3);
      this.fore = fore; this.middle = (fore + 1) % 3; this.rear = this.dealer;
      this.bid = 0; this.asker = this.middle; this.holder = this.fore; this.phase = 'A'; this.out = [false, false, false];
      this.declarer = -1; this.game = null; this.hand = false; this.discards = []; this.marked = [];
      this.trick = []; this.taken = [[], [], []]; this.played = []; this.lastTrick = null; this.nTricks = 0;
      this.need = 'bid'; this.toMove = this.asker; this.notes = []; this.plan = null;
      this.sortAll();
    },
    who(s) { return s === 0 ? 'You' : SK_SEAT[s]; },
    nextBid() { return SK_BIDS.find(v => v > this.bid); },
    isTrump(c, g = this.game) { if (g === null || g === 'null') return false; return SK_JACKS.includes(c) || (g !== 'grand' && skSuit(c) === g); },
    suitOf(c, g = this.game) { return this.isTrump(c, g) ? 4 : skSuit(c); },
    power(c, g = this.game) {
      if (g === 'null') return 20 - SK_NULL.indexOf(skRank(c));
      if (this.isTrump(c, g)) { const j = SK_JACKS.indexOf(c); return j >= 0 ? 100 - j : 80 - SK_ORDER.indexOf(skRank(c)); }
      return 50 - SK_ORDER.indexOf(skRank(c));
    },
    sortAll(g = this.game) { this.hands.forEach(h => h.sort((a, b) => (this.isTrump(a, g) - this.isTrump(b, g)) || (this.suitOf(a, g) - this.suitOf(b, g)) || this.power(a, g) - this.power(b, g))); },
    beats(a, b) { const sa = this.suitOf(a), sb = this.suitOf(b); if (sa === sb) return this.power(a) > this.power(b); return sa === 4; },
    best() { let b = this.trick[0]; for (const t of this.trick) if (this.beats(t.card, b.card)) b = t; return b; },
    legalCards(s) {
      const h = this.hands[s]; if (!this.trick.length) return h.slice();
      const led = this.suitOf(this.trick[0].card), f = h.filter(c => this.suitOf(c) === led);
      return f.length ? f : h.slice();
    },
    // The matadors: the top trumps in an unbroken run from the jack of clubs, held ("with") or missing ("without").
    matadors(cards, g) {
      const order = g === 'grand' ? SK_JACKS : SK_JACKS.concat(SK_ORDER.map(r => g * 13 + r));
      const has = cards.includes(order[0]); let n = 0;
      for (const c of order) { if (cards.includes(c) === has) n++; else break; }
      return { has, n };
    },
    value(g, cards, hand, schneider = false, schwarz = false) {
      if (g === 'null') return hand ? 35 : 23;
      const m = this.matadors(cards, g);
      return SK_BASE[g] * (m.n + 1 + (hand ? 1 : 0) + (schneider ? 1 : 0) + (schwarz ? 1 : 0));
    },
    gameName(g) { return g === 'grand' ? 'grand' : g === 'null' ? 'null' : SK_SUIT[g]; },
    prompt0() {
      const B = this.bid;
      switch (this.need) {
        case 'bid': return this.phase === 'A' ? `You are middlehand: bid to forehand (${this.who(this.holder)}), or pass.` : `You are rearhand: bid to ${this.who(this.holder).replace('You', 'you')}${B ? `, more than ${B}` : ''}, or pass.`;
        case 'answer': return `${this.who(this.asker)} ${this.asker ? 'bids' : 'bid'} ${B}. Say yes to hold it, or pass.`;
        case 'fore18': return 'Nobody bid. You are forehand: play at 18, or throw the cards in.';
        case 'skat': return `You are the declarer at ${B}. Pick up the skat, or play hand (with one more multiplier).`;
        case 'discard': return `Lay away two cards: click two, then put them in the skat${this.marked.length ? ` (${this.marked.length} marked)` : ''}. Points you lay away count for you.`;
        case 'game': return `Name your game: it must be worth at least ${B}.`;
        case 'next': return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next deal when you are ready.');
        default: {
          const g = this.gameName(this.game), role = this.declarer === 0 ? `You play ${g}` : `${this.who(this.declarer)} plays ${g}`;
          if (!this.trick.length) return `${role}${this.hand ? ' hand' : ''}. Lead any card.`;
          const led = this.suitOf(this.trick[0].card), can = this.hands[0].some(c => this.suitOf(c) === led);
          if (!can) return `${role}. You cannot follow: play any card.`;
          return `${role}. Follow with ${led === 4 ? 'a trump (the jacks count)' : `a ${SK_SUIT[led].slice(0, -1)}${this.game !== 'null' ? ' (not a jack)' : ''}`}.`;
        }
      }
    },
    legal(pl) {
      if (this.over) return [];
      if (this.need === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next deal' }] : [];
      const s = this.toMove; if ((s === 0) !== (pl === 0)) return [];
      switch (this.need) {
        case 'bid': { const v = this.nextBid(); return (v ? [{ pl, seat: s, kind: 'bid', value: v, label: String(v) }] : []).concat([{ pl, seat: s, kind: 'pass', label: 'Pass' }]); }
        case 'answer': return [{ pl, seat: s, kind: 'yes', label: `Yes, ${this.bid}` }, { pl, seat: s, kind: 'pass', label: 'Pass' }];
        case 'fore18': return [{ pl, seat: s, kind: 'play18', label: 'Play at 18' }, { pl, seat: s, kind: 'throw', label: 'Throw in' }];
        case 'skat': return [{ pl, seat: s, kind: 'pickup', label: 'Pick up the skat' }, { pl, seat: s, kind: 'handgame', label: 'Play hand' }];
        case 'discard': {
          const out = this.hands[s].filter(c => this.marked.includes(c) || this.marked.length < 2).map(card => ({ pl, seat: s, kind: 'mark', card }));
          if (this.marked.length === 2) out.push({ pl, seat: s, kind: 'discard', cards: this.marked.slice(), label: 'Lay these two away' });
          return out;
        }
        case 'game': return SK_GAMES.map(x => ({ pl, seat: s, kind: 'game', game: x.id, label: `${x.label} (${this.value(x.id, this.hands[s].concat(this.hand ? this.skat : this.discards), this.hand)})${this.hand ? ' hand' : ''}` }));
        default: return this.legalCards(s).map(card => ({ pl, seat: s, kind: 'play', card }));
      }
    },
    // After a pass: the other player in the pair survives; the second part of the auction, or the end of it.
    afterPass(s, events) {
      this.out[s] = true; const surv = s === this.asker ? this.holder : this.asker;
      if (this.phase === 'A') { this.phase = 'B'; this.asker = this.rear; this.holder = surv; this.need = 'bid'; this.toMove = this.asker; return ''; }
      if (!this.bid) { // nobody bid: forehand may play at 18
        if (this.out[this.fore]) return this.throwIn(events);
        this.need = 'fore18'; this.toMove = this.fore; return '';
      }
      return this.won(surv, events);
    },
    won(s, events) { this.declarer = s; this.need = 'skat'; this.toMove = s; events.push({ type: 'declarer', seat: s }); return `${this.who(s)} ${s ? 'is' : 'are'} the declarer at ${this.bid}.`; },
    throwIn(events) { this.notes = ['Nobody bid: the cards are thrown in, and the deal passes on.']; this.need = 'next'; this.toMove = 0; this.thrown = true; events.push({ type: 'throw' }); return this.notes[0]; },
    apply(m) {
      const s = m.seat, events = [], Y = s === 0;
      if (m.kind === 'next') {
        if (this.decided) { this.over = this.decided; return { note: '' }; }
        this.dealer = (this.dealer + 1) % 3; this.thrown = false; this.deal();
        return { note: `${this.who(this.dealer)} ${this.dealer ? 'deals' : 'deal'}; ${this.who(this.fore).replace('You', 'you')} ${this.fore ? 'is' : 'are'} forehand.`, events: [{ type: 'deal' }] };
      }
      if (m.kind === 'bid') { this.bid = m.value; this.need = 'answer'; this.toMove = this.holder; events.push({ type: 'bid', seat: s, value: m.value }); return { note: `${this.who(s)}: ${m.value}.`, events }; }
      if (m.kind === 'yes') { this.need = 'bid'; this.toMove = this.asker; return { note: `${this.who(s)}: yes.`, events }; }
      if (m.kind === 'pass') {
        let note = `${this.who(s)} ${Y ? 'pass' : 'passes'}.`;
        // A pass with nothing bid: the first part ends the same way.
        const extra = this.afterPass(s, events);
        return { note: (note + ' ' + extra).trim(), events };
      }
      if (m.kind === 'play18') { this.bid = 18; return { note: `${this.who(s)} ${Y ? 'play' : 'plays'} at 18. ` + this.won(s, events), events }; }
      if (m.kind === 'throw') return { note: this.throwIn(events), events };
      if (m.kind === 'pickup') { this.hands[s].push(...this.skat); this.skat = []; this.need = 'discard'; this.marked = []; this.sortAll(null); events.push({ type: 'pickup', seat: s }); return { note: `${this.who(s)} ${Y ? 'pick' : 'picks'} up the skat.`, events }; }
      if (m.kind === 'handgame') { this.hand = true; this.need = 'game'; return { note: `${this.who(s)} ${Y ? 'play' : 'plays'} hand.`, events }; }
      if (m.kind === 'mark') { const i = this.marked.indexOf(m.card); if (i >= 0) this.marked.splice(i, 1); else this.marked.push(m.card); events.push({ type: 'mark', seat: s }); return { note: '', events }; }
      if (m.kind === 'discard') {
        m.cards.forEach(c => { const h = this.hands[s]; h.splice(h.indexOf(c), 1); this.discards.push(c); });
        this.marked = []; this.need = 'game'; events.push({ type: 'discard', seat: s, cards: m.cards });
        return { note: `${this.who(s)} ${Y ? 'lay' : 'lays'} two cards away.`, events };
      }
      if (m.kind === 'game') {
        this.game = m.game; this.dcards = this.hands[s].concat(this.hand ? this.skat : this.discards); // the declarer's twelve, for the matadors
        this.sortAll(); this.need = 'play'; this.toMove = this.fore;
        events.push({ type: 'game', seat: s, game: m.game });
        return { note: `${this.who(s)} ${Y ? 'play' : 'plays'} ${this.gameName(m.game)}${this.hand ? ' hand' : ''}.`, events };
      }
      // A card to the trick.
      const hand = this.hands[s]; hand.splice(hand.indexOf(m.card), 1);
      this.trick.push({ seat: s, card: m.card }); this.played.push(m.card);
      events.push({ type: 'play', seat: s, card: m.card });
      if (this.trick.length < 3) { this.toMove = (s + 1) % 3; return { note: '', events }; }
      const w = this.best().seat, cards = this.trick.map(t => t.card), pts = cards.reduce((t, c) => t + skPoints(c), 0);
      this.taken[w].push(...cards); this.nTricks++; this.lastTrick = { cards, winner: w };
      this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      const notes = [`${this.who(w)} ${w ? 'takes' : 'take'} the trick${this.game !== 'null' && pts ? ` (${pts})` : ''}.`];
      if (this.nTricks === 10 || (this.game === 'null' && w === this.declarer)) this.endDeal(notes);
      return { note: notes.join(' '), events };
    },
    endDeal(notes) {
      const d = this.declarer, g = this.game, all = this.dcards;
      const mine = this.taken[d].reduce((t, c) => t + skPoints(c), 0) + this.discards.concat(this.hand ? this.skat : []).reduce((t, c) => t + skPoints(c), 0);
      let won, val, line;
      if (g === 'null') {
        won = this.taken[d].length === 0; val = this.value('null', all, this.hand);
        line = won ? `${this.who(d)} ${d ? 'takes' : 'take'} no trick: null is won.` : `${this.who(d)} ${d ? 'takes' : 'take'} a trick: null is lost.`;
      } else {
        const schneider = mine >= 90 || mine <= 30, schwarz = this.taken[d].length === 30 || this.taken[d].length === 0;
        won = mine >= 61; val = this.value(g, this.dcards, this.hand, schneider, schwarz);
        const m = this.matadors(this.dcards, g);
        line = `${this.who(d)} ${d ? 'takes' : 'take'} ${mine} card points: ${won ? 'won' : 'lost'}${schneider ? ', schneider' : ''}${schwarz ? ', schwarz' : ''}. ${m.has ? 'With' : 'Without'} ${m.n}, ${this.gameName(g)}${this.hand ? ' hand' : ''}: ${val}.`;
      }
      if (val < this.bid) { // overbid: lost, at the lowest multiple of the base value that reaches the bid
        won = false; const base = g === 'null' ? val : SK_BASE[g]; val = g === 'null' ? val : Math.ceil(this.bid / base) * base;
        line += ` That is less than the bid of ${this.bid}: lost, at ${val}.`;
      }
      this.score[d] += won ? val : -2 * val;
      this.deals++;
      notes.push(line, `${this.who(d)} ${won ? 'score' + (d ? 's' : '') + ' ' + val : 'lose' + (d ? 's' : '') + ' ' + 2 * val}. Scores: you ${this.score[0]}, West ${this.score[1]}, East ${this.score[2]}.`);
      if (this.deals >= this.limit) {
        const hi = Math.max(...this.score), win = this.score.indexOf(hi), tie = this.score.filter(x => x === hi).length > 1;
        this.decided = { winner: tie && this.score[0] === hi ? 2 : win === 0 ? 0 : 1, title: tie ? 'Level at the top' : win === 0 ? 'You win the game' : `${SK_SEAT[win]} wins the game`, text: `After ${this.deals} deals: you ${this.score[0]}, West ${this.score[1]}, East ${this.score[2]}.` };
      }
      this.notes = notes.slice(); this.need = 'next'; this.toMove = 0;
    },
    passTurn() { if (this.over) return 0; this.seat = this.toMove; return this.seat === 0 ? 0 : 1; },
    get scribeName() { return SK_SEAT[this.seat] || 'The Scribe'; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* The Scribe. A hand's strength for a game: the jacks most, then high trumps, side aces and tens with their
     * aces, and empty suits. It bids up to what its best game is worth when the strength clears a bar by level,
     * picks up the skat unless the hand is strong enough to play hand, lays away the pair of cards that best
     * empties a suit and banks points, and names the strongest game that reaches the bid. In play the declarer
     * draws trumps with sure winners; the defenders let each other's tricks stand and throw points on them.
     * Sharp also samples the hidden hands to choose each card. */
    strength(cards, g) {
      if (g === 'null') {
        let v = 6; for (let su = 0; su < 4; su++) { const cs = cards.filter(c => skSuit(c) === su).map(c => SK_NULL.indexOf(skRank(c))).sort((a, b) => b - a); cs.forEach((p, i) => { if (p < 7 - 2 * i) v -= (7 - 2 * i - p) * 0.6; }); }
        return v;
      }
      let v = 0, nT = 0;
      for (const c of cards) {
        if (this.isTrump(c, g)) { nT++; const j = SK_JACKS.indexOf(c); v += j >= 0 ? [3.2, 2.8, 2.4, 2.1][j] : [2.0, 1.6, 1.0, 0.8, 0.6, 0.6, 0.6][SK_ORDER.indexOf(skRank(c))]; }
        else if (skRank(c) === 0) v += g === 'grand' ? 2.2 : 1.6;
        else if (skRank(c) === 9) v += cards.includes(skSuit(c) * 13) ? (g === 'grand' ? 1.6 : 1.0) : 0.2;
      }
      if (g !== 'grand') for (let su = 0; su < 4; su++) if (su !== g && nT >= 5 && !cards.some(c => !this.isTrump(c, g) && skSuit(c) === su)) v += 0.6;
      if (g === 'grand' && cards.filter(c => SK_JACKS.includes(c)).length < 2) v -= 3;
      return v;
    },
    bestGame(cards, hand) {
      let best = null;
      for (const x of SK_GAMES) { const st = this.strength(cards, x.id) + (x.id === 'grand' ? -1.2 : 0); const val = this.value(x.id, cards, hand); if (!best || st > best.st) best = { g: x.id, st, val }; }
      return best;
    },
    aiPlan() {
      if (this.need === 'next') return [{ pl: 0, kind: 'next' }];
      const s = this.toMove, hand = this.hands[s], mv = o => [Object.assign({ pl: 1, seat: s }, o)];
      const bar = pick(10.4, 9.6, 9.2), jit = (Math.random() - 0.5) * pick(1.4, 0.5, 0.15);
      if (this.need === 'bid' || this.need === 'answer' || this.need === 'fore18') {
        if (!this.plan || this.plan.seat !== s || this.plan.deal !== this.deals) {
          // How high to go: the best game's value, when it is strong enough; a third suit card may come from the skat.
          let max = 0;
          for (const x of SK_GAMES) {
            const st = this.strength(hand, x.id) + (x.id === 'null' ? 0 : 0.8) + jit, need = x.id === 'null' ? 5.6 : x.id === 'grand' ? bar + 1.5 : bar;
            if (st >= need) max = Math.max(max, this.value(x.id, hand, false));
          }
          this.plan = { seat: s, deal: this.deals, max };
        }
        const max = this.plan.max;
        if (this.need === 'fore18') return mv({ kind: max >= 18 ? 'play18' : 'throw' });
        if (this.need === 'answer') return mv({ kind: this.bid <= max ? 'yes' : 'pass' });
        const v = this.nextBid(); return mv(v && v <= max ? { kind: 'bid', value: v } : { kind: 'pass' });
      }
      if (this.need === 'skat') { const b = this.bestGame(hand, true); return mv({ kind: b.st >= bar + 3.6 && b.val >= this.bid ? 'handgame' : 'pickup' }); }
      if (this.need === 'discard') {
        let best = null, bv = -1e9;
        for (let i = 0; i < hand.length; i++) for (let j = i + 1; j < hand.length; j++) {
          const rest = hand.filter((_, k) => k !== i && k !== j), b = this.bestGame(rest, false);
          const v = b.st + (skPoints(hand[i]) + skPoints(hand[j])) * 0.05 + (b.val >= this.bid ? 2 : 0);
          if (v > bv) { bv = v; best = [hand[i], hand[j]]; }
        }
        return best.map(card => ({ pl: 1, seat: s, kind: 'mark', card })).concat([{ pl: 1, seat: s, kind: 'discard', cards: best }]);
      }
      if (this.need === 'game') {
        const cards = hand.concat(this.hand ? this.skat : this.discards);
        let best = null, bv = -1e9;
        for (const x of SK_GAMES) { const st = this.strength(hand, x.id) + (x.id === 'grand' ? -1.2 : 0), val = this.value(x.id, cards, this.hand), v = st + (val >= this.bid ? 4 : 0); if (v > bv) { bv = v; best = x.id; } }
        return mv({ kind: 'game', game: best });
      }
      const ms = this.legalCards(s);
      if (ms.length === 1 || (LEVEL.name === 'gentle' && !this.rollout && Math.random() < 0.35)) return mv({ kind: 'play', card: ms[(Math.random() * ms.length) | 0] });
      if (LEVEL.name === 'sharp' && !this.rollout) return mv({ kind: 'play', card: this.sample(s, ms) });
      return mv({ kind: 'play', card: this.choose(s, ms) });
    },
    choose(s, ms) {
      const d = this.declarer, g = this.game, gone = new Set(this.played.concat(this.hands[s]));
      const low = a => a.reduce((x, y) => (this.power(y) < this.power(x) ? y : x)), high = a => a.reduce((x, y) => (this.power(y) > this.power(x) ? y : x));
      const cheap = a => a.reduce((x, y) => (skPoints(y) * 3 + this.power(y) / 10 < skPoints(x) * 3 + this.power(x) / 10 ? y : x));
      const master = c => !SK_PACK.some(x => !gone.has(x) && x !== c && this.suitOf(x) === this.suitOf(c) && this.power(x) > this.power(c));
      if (g === 'null') {
        if (s === d) { // stay under
          if (!this.trick.length) return low(ms);
          const b = this.best(), under = ms.filter(c => this.suitOf(c) === this.suitOf(b.card) && this.power(c) < this.power(b.card));
          return under.length ? high(under) : (this.suitOf(ms[0]) === this.suitOf(this.trick[0].card) ? low(ms) : high(ms));
        }
        if (!this.trick.length) return low(ms);
        const b = this.best();
        if (b.seat === d) return high(ms); // the declarer is winning: no need to beat
        return low(ms);
      }
      const trumps = ms.filter(c => this.isTrump(c)), plain = ms.filter(c => !this.isTrump(c));
      if (!this.trick.length) {
        if (s === d) {
          const out = SK_PACK.some(x => !gone.has(x) && this.isTrump(x));
          if (trumps.length && out && master(high(trumps))) return high(trumps);
          const sure = plain.filter(master); if (sure.length) return sure[0];
          if (trumps.length >= 3 && out) return high(trumps);
          return plain.length ? cheap(plain) : low(trumps);
        }
        const sure = plain.filter(master); if (sure.length) return sure[0];
        return plain.length ? cheap(plain) : cheap(ms);
      }
      const b = this.best(), last = this.trick.length === 2, winners = ms.filter(c => this.beats(c, b.card));
      if (s !== d && b.seat !== d && (last || master(b.card))) { // the other defender holds it: throw points on
        return ms.reduce((x, y) => (skPoints(y) > skPoints(x) || (skPoints(y) === skPoints(x) && this.power(y) < this.power(x)) ? y : x));
      }
      if (winners.length) {
        const pts = this.trick.reduce((t, x) => t + skPoints(x.card), 0);
        if (last) return (pts || s === d) ? low(winners) : cheap(ms);
        const sure = winners.filter(master); if (sure.length) return low(sure);
        if (pts >= 10) return low(winners);
      }
      return cheap(ms);
    },
    sample(s, ms) {
      const known = new Set(this.played.concat(this.hands[s], s === this.declarer ? this.discards : [])), pool = SK_PACK.filter(c => !known.has(c));
      const others = [(s + 1) % 3, (s + 2) % 3], tally = new Map(ms.map(c => [c, 0])), N = 30, d = this.declarer;
      for (let k = 0; k < N; k++) {
        const deck = pool.slice(); for (let i = deck.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; }
        const hands = this.hands.map(h => h.slice()); let at = 0;
        for (const o of others) { hands[o] = deck.slice(at, at + this.hands[o].length); at += this.hands[o].length; }
        const rest = deck.slice(at);
        for (const c of ms) {
          const w = Object.create(SKAT);
          Object.assign(w, { rollout: true, game: this.game, declarer: d, dcards: this.dcards, hand: this.hand, bid: this.bid, fore: this.fore, hands: hands.map(h => h.slice()), skat: this.hand ? rest.slice(0, 2) : [], discards: this.discards.length ? this.discards.slice() : (this.hand ? [] : rest.slice(0, 2)), trick: this.trick.map(t => ({ ...t })), taken: this.taken.map(t => t.slice()), played: this.played.slice(), nTricks: this.nTricks, toMove: s, need: 'play', score: [0, 0, 0], deals: 0, variant: '12', notes: [] });
          w.apply({ pl: 1, seat: s, kind: 'play', card: c });
          let guard = 0;
          while (w.need === 'play' && guard++ < 40) w.apply(w.aiPlan()[0]);
          tally.set(c, tally.get(c) + (s === d ? w.score[d] : -w.score[d]));
        }
      }
      return ms.reduce((a, b) => (tally.get(b) > tally.get(a) ? b : a));
    },
  };

