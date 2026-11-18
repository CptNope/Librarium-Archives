  /* ----------------------------------------------------------------- Spades
   * The partnership game of 1930s America: spades are always trumps, and each player bids the tricks they
   * will take. Seats as at Whist (0 you, South; 1 West; 2 North, your partner; 3 East), play to the left.
   * Cards are numbered suit * 13 + rank (rank 0 the ace, high). Spades, hearts, diamonds, clubs; spades are 0. */
  const SP_SEAT = ['You', 'West', 'North', 'East'];
  const SP_SIDE = ['You and North', 'West and East'];
  const SP_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const SP_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
  const spSuit = c => (c / 13) | 0, spPow = c => (c % 13 + 12) % 13; // two 0 ... ace 12
  const spName = c => `${SP_RANK[c % 13]} of ${SP_SUIT[spSuit(c)]}`;
  const spCard = (su, pow) => su * 13 + (pow + 1) % 13;
  const spShuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const SPADES = {
    id: 'spades', name: 'Spades', dice: false, cardName: spName,
    SEATS: SP_SEAT, SIDES: SP_SIDE, SUITS: SP_SUIT, suit: spSuit, pow: spPow,
    get first() { return this.toMove === undefined || this.toMove === 0 ? 0 : 1; },
    variants: [{ id: '500', label: 'To 500' }, { id: '250', label: 'To 250' }], variant: '500', variantLabel: 'Game',
    setVariant(id) { this.variant = id === '250' ? '250' : '500'; },
    get limit() { return +this.variant; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'You and North, your partner, against West and East, all played by the Scribe. Thirteen cards each. Spades are always trumps; aces are high.',
      'Each player bids the number of tricks they expect to take, starting left of the dealer. Your side\'s bid is yours and North\'s together. A bid of nil promises to take no tricks at all.',
      'The player left of the dealer leads. Follow suit if you can; if you cannot, play any card. The highest spade wins, or with no spade in the trick, the highest card of the suit led. Spades may not be led until one has been played on another suit, unless you hold nothing else.',
      'A side that takes at least its bid scores 10 a trick bid and 1 for each extra trick, a bag; every tenth bag costs 100. A side that falls short loses 10 a trick bid. Nil scores 100 if made and loses 100 if not; the nil bidder\'s tricks count as bags for the side, not towards the partner\'s bid.',
      'The first side to 500 (or 250) wins; a side that falls to −200 loses.'
    ],
    source: 'Spades with the standard partnership rules Wikipedia and pagat.com give: bidding with nil, spades broken before they are led, 10 a trick, bags with a penalty at ten, and 500 to win. Blind nil is left out.',
    init() { this.score = [0, 0]; this.bags = [0, 0]; this.dealer = 3; this.handNo = 0; this.over = null; this.decided = null; this.notes = []; this.deal(); },
    deal() {
      const d = spShuffle(Array.from({ length: 52 }, (_, i) => i));
      this.dealer = (this.dealer + 1) % 4; this.handNo++;
      this.hands = [0, 1, 2, 3].map(s => d.slice(s * 13, s * 13 + 13));
      this.hands.forEach(h => h.sort((a, b) => [1, 3, 2, 0].indexOf(spSuit(a)) - [1, 3, 2, 0].indexOf(spSuit(b)) || spPow(a) - spPow(b)));
      this.bids = [null, null, null, null]; this.taken = [0, 0, 0, 0]; this.trick = []; this.played = []; this.lastTrick = null; this.broken = false; this.nTricks = 0;
      this.void = [0, 1, 2, 3].map(() => [false, false, false, false]);
      this.need = 'bid'; this.toMove = (this.dealer + 1) % 4; this.notes = [];
    },
    who(s) { return s === 0 ? 'You' : SP_SEAT[s]; },
    sideBid(t) { return [t, t + 2].reduce((a, s) => a + (this.bids[s] || 0), 0); },
    sideTricks(t) { return [t, t + 2].reduce((a, s) => a + this.taken[s], 0); },
    best() { let b = this.trick[0]; for (const t of this.trick) if (this.beats(t.card, b.card)) b = t; return b; },
    beats(a, b) { return spSuit(a) === spSuit(b) ? spPow(a) > spPow(b) : spSuit(a) === 0; },
    legalCards(s) {
      const h = this.hands[s];
      if (!this.trick.length) { if (this.broken) return h.slice(); const no = h.filter(c => spSuit(c) !== 0); return no.length ? no : h.slice(); }
      const led = spSuit(this.trick[0].card), follow = h.filter(c => spSuit(c) === led);
      return follow.length ? follow : h.slice();
    },
    prompt0() {
      if (this.need === 'next') return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next hand when you are ready.');
      if (this.need === 'bid') { const made = this.bids.map((b, s) => (b === null ? null : `${this.who(s)} ${b === 0 ? 'nil' : b}`)).filter(Boolean); return `${made.length ? 'Bids so far: ' + made.join(', ') + '. ' : ''}Bid the tricks you expect to take.`; }
      const mine = this.sideBid(0), got = this.sideTricks(0);
      const head = `Your side bid ${mine} and has ${got}${this.bids[0] === 0 ? ` (you bid nil: ${this.taken[0] ? 'broken' : 'so far so good'})` : ''}. `;
      if (!this.trick.length) return head + `Lead any card${this.broken ? '' : ', but not a spade: spades are not broken yet'}.`;
      const led = spSuit(this.trick[0].card);
      return head + (this.hands[0].some(c => spSuit(c) === led) ? `Follow with a ${SP_SUIT[led].slice(0, -1)}.` : `You have no ${SP_SUIT[led]}: play any card.`);
    },
    legal(pl) {
      if (this.over) return [];
      if (this.need === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next hand' }] : [];
      const s = this.toMove; if ((s === 0) !== (pl === 0)) return [];
      if (this.need === 'bid') return Array.from({ length: 14 }, (_, n) => ({ pl, seat: s, kind: 'bid', n, label: n === 0 ? 'Nil' : String(n) }));
      return this.legalCards(s).map(card => ({ pl, seat: s, kind: 'play', card }));
    },
    apply(m) {
      const events = [];
      if (m.kind === 'next') { if (this.decided) { this.over = this.decided; return { note: '' }; } this.deal(); return { note: `${this.dealer ? SP_SEAT[this.dealer] + ' deals' : 'You deal'}.`, events: [{ type: 'deal' }] }; }
      const s = m.seat;
      if (m.kind === 'bid') {
        this.bids[s] = m.n; events.push({ type: 'bid', seat: s, n: m.n });
        const note = `${this.who(s)} ${s ? 'bids' : 'bid'} ${m.n === 0 ? 'nil' : m.n}.`;
        if (this.bids.every(b => b !== null)) { this.need = 'play'; this.toMove = (this.dealer + 1) % 4; return { note: note + ` Your side bids ${this.sideBid(0)}, theirs ${this.sideBid(1)}.`, events }; }
        this.toMove = (s + 1) % 4; return { note, events };
      }
      const h = this.hands[s]; h.splice(h.indexOf(m.card), 1);
      if (this.trick.length && spSuit(m.card) !== spSuit(this.trick[0].card)) this.void[s][spSuit(this.trick[0].card)] = true;
      this.trick.push({ seat: s, card: m.card }); this.played.push(m.card);
      let note = '';
      if (spSuit(m.card) === 0 && !this.broken) { this.broken = true; if (this.trick.length > 1) note = 'Spades are broken.'; }
      events.push({ type: 'play', seat: s, card: m.card });
      if (this.trick.length < 4) { this.toMove = (s + 1) % 4; return { note, events }; }
      const w = this.best().seat;
      this.taken[w]++; this.nTricks++; this.lastTrick = { cards: this.trick.map(t => t.card), winner: w };
      this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      note = (note ? note + ' ' : '') + `${this.who(w)} ${w ? 'takes' : 'take'} the trick.`;
      if (this.bids[w] === 0 && this.taken[w] === 1) note += ` ${w ? SP_SEAT[w] + '\'s' : 'Your'} nil is broken.`;
      if (this.nTricks === 13) note += ' ' + this.endHand();
      return { note, events };
    },
    // What a hand scores for side t: the contract, bags, and any nil.
    handScore(t) {
      const seats = [t, t + 2], bid = this.sideBid(t), got = seats.filter(s => this.bids[s] !== 0).reduce((a, s) => a + this.taken[s], 0);
      const nilTricks = seats.filter(s => this.bids[s] === 0).reduce((a, s) => a + this.taken[s], 0);
      let pts = 0, bags = 0; const parts = [];
      if (bid > 0) { if (got >= bid) { pts += bid * 10 + (got - bid); bags += got - bid; parts.push(`made ${bid}${got > bid ? ` with ${got - bid} over` : ''}`); } else { pts -= bid * 10; parts.push(`went down on ${bid}`); } }
      for (const s of seats) if (this.bids[s] === 0) { const ok = !this.taken[s]; pts += ok ? 100 : -100; parts.push(`${this.who(s)}'s nil ${ok ? 'made' : 'failed'}`); }
      bags += nilTricks; pts += nilTricks;
      return { pts, bags, parts };
    },
    endHand() {
      const notes = [];
      for (const t of [0, 1]) {
        const r = this.handScore(t); this.score[t] += r.pts; this.bags[t] += r.bags;
        let line = `${SP_SIDE[t]} ${r.parts.join(', ') || 'bid nothing'}: ${r.pts >= 0 ? '+' : ''}${r.pts}.`;
        if (this.bags[t] >= 10) { this.bags[t] -= 10; this.score[t] -= 100; line += ' Ten bags: −100.'; }
        notes.push(line);
      }
      notes.push(`Scores: you and North ${this.score[0]}, West and East ${this.score[1]}.`);
      const [a, b] = this.score, L = this.limit;
      if ((a >= L || b >= L || a <= -200 || b <= -200) && a !== b) {
        const w = a <= -200 ? 1 : b <= -200 ? 0 : a > b ? 0 : 1;
        this.decided = { winner: w, title: w ? 'West and East win' : 'You and North win', text: `The game ends ${a} to ${b}, after ${this.handNo} hand${this.handNo > 1 ? 's' : ''}.` };
      }
      this.notes = notes; this.need = 'next'; this.toMove = 0;
      return notes.join(' ');
    },
    passTurn() { if (this.over) return 0; this.seat = this.toMove; return this.seat === 0 ? 0 : 1; },
    get scribeName() { return this.seat === 2 ? 'North, your partner' : SP_SEAT[this.seat] || 'The Scribe'; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* Bidding: the Scribe counts sure and likely tricks: aces, guarded kings, the high spades and long spades,
     * and a void or singleton to ruff with when it holds spades. With almost nothing (no ace, no king, no high
     * spade) it bids nil. In play it follows Whist's book (cash winners, second hand low, third hand high, win
     * cheaply), and keeps count: once its side has made the bid it ducks to avoid bags, it covers a partner who
     * bid nil, and it leads low into an opponent's nil. Sharp deals the unseen cards round many times and plays
     * each deal out, to pick the card that scores its side best. */
    bidFor(s) {
      const h = this.hands[s], of = su => h.filter(c => spSuit(c) === su);
      let t = 0;
      for (let su = 1; su < 4; su++) {
        const cs = of(su), n = cs.length, has = p => cs.some(c => spPow(c) === p);
        if (has(12)) t += 1; if (has(11) && n >= 2) t += n >= 6 ? 0.5 : 0.8; if (has(10) && n >= 3 && n <= 5) t += 0.3;
      }
      const sp = of(0), ns = sp.length;
      for (const c of sp) { const p = spPow(c); if (p === 12) t += 1; else if (p === 11 && ns >= 2) t += 0.9; else if (p === 10 && ns >= 3) t += 0.7; }
      if (ns > 3) t += (ns - 3) * 0.8;
      if (ns >= 2) for (let su = 1; su < 4; su++) { const n = of(su).length; if (n === 0) t += Math.min(ns - 1, 2) * 0.6; else if (n === 1) t += 0.5; }
      const nilOk = !sp.some(c => spPow(c) >= 9) && ns <= 3 && ![1, 2, 3].some(su => of(su).some(c => spPow(c) >= 11) && of(su).length <= 3) && t < 1.6;
      const partner = this.bids[(s + 2) % 4];
      if (nilOk && LEVEL.name !== 'gentle' && partner !== 0) return 0;
      return Math.max(1, Math.round(t - (LEVEL.name === 'gentle' ? 0 : 0.2)));
    },
    choose(s, ms) {
      if (ms.length === 1) return ms[0];
      const partner = (s + 2) % 4, team = s & 1, myNil = this.bids[s] === 0, pNil = this.bids[partner] === 0;
      const opps = [(s + 1) % 4, (s + 3) % 4], oppNil = opps.filter(o => this.bids[o] === 0 && !this.taken[o]);
      const gone = new Set(this.played.concat(this.hands[s]));
      const master = c => { for (let p = spPow(c) + 1; p < 13; p++) if (!gone.has(spCard(spSuit(c), p))) return false; return true; };
      const low = a => a.reduce((x, y) => (spPow(y) < spPow(x) ? y : x)), high = a => a.reduce((x, y) => (spPow(y) > spPow(x) ? y : x));
      const need = this.sideBid(team) - this.sideTricks(team), made = need <= 0;
      if (myNil && !this.taken[s]) { // stay under: play the highest card that cannot win, or the lowest
        if (!this.trick.length) return low(ms);
        const b = this.best(), under = ms.filter(c => !this.beats(c, b.card));
        return under.length ? high(under) : low(ms);
      }
      if (!this.trick.length) {
        if (oppNil.length) { const lows = ms.filter(c => spSuit(c) !== 0); return low(lows.length ? lows : ms); } // lead low into a nil
        const cash = ms.filter(c => spSuit(c) !== 0 && master(c));
        if (cash.length && !made) return cash[0];
        if (made) return low(ms);
        const plain = ms.filter(c => spSuit(c) !== 0);
        if (!plain.length) return master(high(ms)) ? high(ms) : low(ms);
        let best = -1; for (let su = 1; su < 4; su++) { const n = plain.filter(c => spSuit(c) === su).length; if (n && (best < 0 || n > plain.filter(c => spSuit(c) === best).length)) best = su; }
        return low(plain.filter(c => spSuit(c) === best));
      }
      const b = this.best(), led = spSuit(this.trick[0].card), following = spSuit(ms[0]) === led && this.hands[s].some(c => spSuit(c) === led);
      const winners = ms.filter(c => this.beats(c, b.card)), pos = this.trick.length;
      const shed = () => { if (following) return low(ms); const plain = ms.filter(c => spSuit(c) !== 0); return low(plain.length ? plain : ms); };
      // Covering a partner's nil: win the trick over the partner if it is winning.
      if (pNil && !this.taken[partner] && b.seat === partner) { if (winners.length) return low(winners); return shed(); }
      if (oppNil.includes(b.seat) && pos === 3) return shed(); // the nil bidder is winning it: let them
      if (b.seat === partner) return shed();
      if (made && LEVEL.name !== 'gentle') return shed(); // the bid is in: no bags
      if (!winners.length) return shed();
      if (pos === 1 && following) { const top = winners.filter(master); return top.length ? low(top) : shed(); }
      return low(winners);
    },
    aiPlan() {
      if (this.need === 'next') return [{ pl: 0, kind: 'next' }];
      const s = this.toMove;
      if (this.need === 'bid') return [{ pl: 1, seat: s, kind: 'bid', n: this.bidFor(s) }];
      const ms = this.legalCards(s), mv = card => [{ pl: 1, seat: s, kind: 'play', card }];
      if (ms.length === 1) return mv(ms[0]);
      if (LEVEL.name === 'gentle' && !this.rollout && Math.random() < 0.35) return mv(ms[(Math.random() * ms.length) | 0]);
      if (LEVEL.name === 'sharp' && !this.rollout) return mv(this.sample(s, ms));
      return mv(this.choose(s, ms));
    },
    sample(s, ms) {
      const known = new Set(this.played.concat(this.hands[s])), pool = Array.from({ length: 52 }, (_, i) => i).filter(c => !known.has(c));
      const tally = new Map(ms.map(c => [c, 0])), N = 24, team = s & 1;
      for (let k = 0; k < N; k++) {
        let d = spShuffle(pool.slice()); const hands = this.hands.map((h, o) => (o === s ? h.slice() : []));
        for (const o of [1, 2, 3].map(x => (s + x) % 4)) {
          const need = this.hands[o].length, fits = d.filter(c => !this.void[o][spSuit(c)]), take = (fits.length >= need ? fits : d).slice(0, need);
          hands[o] = take; d = d.filter(c => !take.includes(c));
        }
        for (const c of ms) {
          const w = Object.create(SPADES);
          Object.assign(w, { rollout: true, hands: hands.map(h => h.slice()), trick: this.trick.map(t => ({ ...t })), taken: this.taken.slice(), played: this.played.slice(), bids: this.bids.slice(), broken: this.broken, nTricks: this.nTricks, toMove: s, need: 'play', score: [0, 0], bags: [0, 0], handNo: 1, variant: '500', void: this.void.map(v => v.slice()), notes: [] });
          w.apply({ pl: 1, seat: s, kind: 'play', card: c });
          let guard = 0; while (w.nTricks < 13 && guard++ < 60) w.apply(w.aiPlan()[0]);
          tally.set(c, tally.get(c) + w.handScore(team).pts - w.handScore(1 - team).pts);
        }
      }
      return ms.reduce((a, b) => (tally.get(b) > tally.get(a) ? b : a));
    },
  };

