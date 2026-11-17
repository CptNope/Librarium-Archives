  /* ----------------------------------------------------------------- Hearts
   * The American game of the 1880s in its modern form, Black Lady: four players each for themselves, seated as
   * at Whist (0 you, South; 1 West; 2 North; 3 East), play to the left. A full French pack numbered suit * 13 +
   * rank, rank 0 the ace, which ranks high; spades, hearts, diamonds, clubs. Every heart taken costs a point and
   * the queen of spades thirteen; the lowest score wins. */
  const HT_SEAT = ['You', 'West', 'North', 'East'];
  const HT_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const HT_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
  const htSuit = c => (c / 13) | 0, htRank = c => c % 13, htPow = c => (htRank(c) === 0 ? 13 : htRank(c)); // two 1 ... ace 13
  const HT_QS = 11, HT_2C = 3 * 13 + 1, HT_H = 1;
  const htName = c => `${HT_RANK[htRank(c)]} of ${HT_SUIT[htSuit(c)]}`;
  const htPoints = c => (c === HT_QS ? 13 : htSuit(c) === HT_H ? 1 : 0);
  const HT_PASS = ['left', 'right', 'across', 'none'];
  const HEARTS = {
    id: 'hearts', name: 'Hearts', dice: false, cardName: htName,
    get first() { return this.toMove === undefined || this.toMove === 0 ? 0 : 1; }, // a Scribe may open the bidding, or hold the two of clubs
    SEATS: HT_SEAT, SUITS: HT_SUIT,
    variants: [{ id: '100', label: 'To 100' }, { id: '50', label: 'To 50' }], variant: '100', variantLabel: 'Game',
    setVariant(id) { this.variant = id === '50' ? '50' : '100'; },
    get limit() { return +this.variant; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'Four players, each for themselves: you against West, North and East, all played by the Scribe. Thirteen cards each. Before each hand, pass three cards: to the left, then the right, then across, then keep them, and round again. Click three cards, then pass them.',
      'Whoever holds the two of clubs leads it. Follow suit if you can; if you cannot, play any card. The highest card of the suit led wins the trick (aces high), and the winner leads next. There are no trumps.',
      'No heart and not the queen of spades may be played to the first trick, unless you have nothing else. Hearts may not be led until a heart has been played to a trick, unless you have only hearts.',
      'Each heart you take costs 1 point and the queen of spades 13. Take all thirteen hearts and the queen, shooting the moon, and every other player takes 26 instead.',
      'When anyone reaches 100 (or 50) at the end of a hand, the lowest score wins.'
    ],
    source: 'Hearts as usually played today, the Black Lady form with passing, the queen of spades and shooting the moon, after Wikipedia and pagat.com.',
    init() { this.score = [0, 0, 0, 0]; this.over = null; this.decided = null; this.handNo = 0; this.notes = []; this.deal(); },
    deal() {
      const d = Array.from({ length: 52 }, (_, i) => i);
      for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      this.hands = [0, 1, 2, 3].map(s => d.slice(s * 13, s * 13 + 13));
      this.pass = HT_PASS[this.handNo % 4]; this.handNo++;
      this.picks = [null, null, null, null]; this.marked = []; this.received = [[], [], [], []];
      this.trick = []; this.taken = [[], [], [], []]; this.played = []; this.lastTrick = null; this.nTricks = 0; this.broken = false;
      this.void = [0, 1, 2, 3].map(() => [false, false, false, false]); this.notes = [];
      this.sortAll();
      if (this.pass === 'none') this.startPlay(); else { this.need = 'pass'; this.toMove = 0; }
    },
    sortAll() { this.hands.forEach(h => h.sort((a, b) => [3, 2, 0, 1].indexOf(htSuit(a)) - [3, 2, 0, 1].indexOf(htSuit(b)) || htPow(a) - htPow(b))); },
    who(s) { return s === 0 ? 'You' : HT_SEAT[s]; },
    target(s) { return this.pass === 'left' ? (s + 1) % 4 : this.pass === 'right' ? (s + 3) % 4 : (s + 2) % 4; },
    startPlay() {
      this.need = 'play'; this.toMove = this.hands.findIndex(h => h.includes(HT_2C)); this.leader = this.toMove;
    },
    best() { const led = htSuit(this.trick[0].card); let b = this.trick[0]; for (const t of this.trick) if (htSuit(t.card) === led && htPow(t.card) > htPow(b.card)) b = t; return b; },
    legalCards(s) {
      const h = this.hands[s];
      if (!this.trick.length) {
        if (this.nTricks === 0) return h.includes(HT_2C) ? [HT_2C] : h.slice();
        if (this.broken) return h.slice();
        const nonHearts = h.filter(c => htSuit(c) !== HT_H);
        return nonHearts.length ? nonHearts : h.slice();
      }
      const led = htSuit(this.trick[0].card), follow = h.filter(c => htSuit(c) === led);
      if (follow.length) return follow;
      if (this.nTricks === 0) { const clean = h.filter(c => !htPoints(c)); if (clean.length) return clean; }
      return h.slice();
    },
    prompt0() {
      switch (this.need) {
        case 'pass': return `Pass three cards ${this.pass === 'across' ? 'across, to North' : `to the ${this.pass}, to ${this.pass === 'left' ? 'West' : 'East'}`}: click three cards, then pass them${this.marked.length ? ` (${this.marked.length} marked)` : ''}.`;
        case 'next': return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next hand when you are ready.');
        default: {
          if (!this.trick.length) return this.nTricks === 0 ? 'You hold the two of clubs: lead it.' : `Lead any card${this.broken ? '' : ', but not a heart: hearts are not broken yet'}.`;
          const led = htSuit(this.trick[0].card), can = this.hands[0].some(c => htSuit(c) === led);
          return can ? `Follow with a ${HT_SUIT[led].slice(0, -1)}.` : `You have no ${HT_SUIT[led]}: play any card${this.nTricks === 0 ? ' except a heart or the queen of spades' : ''}.`;
        }
      }
    },
    legal(pl) {
      if (this.over) return [];
      if (this.need === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next hand' }] : [];
      const s = this.toMove; if ((s === 0) !== (pl === 0)) return [];
      if (this.need === 'pass') {
        const out = this.hands[0].filter(c => this.marked.includes(c) || this.marked.length < 3).map(card => ({ pl, seat: 0, kind: 'mark', card }));
        if (this.marked.length === 3) out.push({ pl, seat: 0, kind: 'pass', cards: this.marked.slice(), label: 'Pass these three' });
        return out;
      }
      return this.legalCards(s).map(card => ({ pl, seat: s, kind: 'play', card }));
    },
    apply(m) {
      const events = [], s = m.seat;
      if (m.kind === 'next') {
        if (this.decided) { this.over = this.decided; return { note: '' }; }
        this.deal();
        return { note: this.pass === 'none' ? 'No passing this hand.' : `This hand, three cards go ${this.pass === 'across' ? 'across' : 'to the ' + this.pass}.`, events: [{ type: 'deal' }] };
      }
      if (m.kind === 'mark') { const i = this.marked.indexOf(m.card); if (i >= 0) this.marked.splice(i, 1); else this.marked.push(m.card); events.push({ type: 'mark' }); return { note: '', events }; }
      if (m.kind === 'pass') {
        // The Scribes choose theirs, and all four pass at once.
        this.picks[0] = m.cards.slice();
        for (let k = 1; k < 4; k++) this.picks[k] = this.passChoice(k);
        for (let k = 0; k < 4; k++) { const t = this.target(k); this.picks[k].forEach(c => { this.hands[k].splice(this.hands[k].indexOf(c), 1); this.hands[t].push(c); }); this.received[t] = this.picks[k].slice(); }
        this.marked = []; this.sortAll(); this.startPlay();
        events.push({ type: 'passed' });
        return { note: `You pass three cards and receive the ${this.received[0].map(htName).join(', the ')}.`, events };
      }
      const hand = this.hands[s]; hand.splice(hand.indexOf(m.card), 1);
      if (this.trick.length && htSuit(m.card) !== htSuit(this.trick[0].card)) this.void[s][htSuit(this.trick[0].card)] = true;
      this.trick.push({ seat: s, card: m.card }); this.played.push(m.card);
      let note = '';
      if (htSuit(m.card) === HT_H && !this.broken) { this.broken = true; note = 'Hearts are broken.'; }
      if (m.card === HT_QS) note = `${this.who(s)} ${s ? 'plays' : 'play'} the queen of spades!`;
      events.push({ type: 'play', seat: s, card: m.card });
      if (this.trick.length < 4) { this.toMove = (s + 1) % 4; return { note, events }; }
      const w = this.best().seat, cards = this.trick.map(t => t.card), pts = cards.reduce((t, c) => t + htPoints(c), 0);
      this.taken[w].push(...cards); this.nTricks++; this.lastTrick = { cards, winner: w };
      this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      const notes = [`${this.who(w)} ${w ? 'takes' : 'take'} the trick${pts ? `, and ${pts} point${pts > 1 ? 's' : ''}` : ''}.`];
      if (this.nTricks === 13) this.endHand(notes);
      return { note: (note ? note + ' ' : '') + notes.join(' '), events };
    },
    endHand(notes) {
      const pts = this.taken.map(cs => cs.reduce((t, c) => t + htPoints(c), 0)), moon = pts.indexOf(26);
      if (moon >= 0) { for (let k = 0; k < 4; k++) if (k !== moon) this.score[k] += 26; notes.push(`${this.who(moon)} ${moon ? 'shoots' : 'shoot'} the moon: everyone else takes 26!`); }
      else { pts.forEach((p, k) => { this.score[k] += p; }); notes.push(`This hand: you ${pts[0]}, West ${pts[1]}, North ${pts[2]}, East ${pts[3]}.`); }
      notes.push(`Scores: you ${this.score[0]}, West ${this.score[1]}, North ${this.score[2]}, East ${this.score[3]}.`);
      if (Math.max(...this.score) >= this.limit) {
        const lo = Math.min(...this.score), winners = [0, 1, 2, 3].filter(k => this.score[k] === lo);
        if (winners.length === 1) this.decided = { winner: winners[0] === 0 ? 0 : 1, title: winners[0] === 0 ? 'You win, with the lowest score' : `${HT_SEAT[winners[0]]} wins, with the lowest score`, text: `Final scores: you ${this.score[0]}, West ${this.score[1]}, North ${this.score[2]}, East ${this.score[3]}.` };
        else notes.push('The lowest scores are level: another hand.');
      }
      this.notes = notes.slice(); this.need = 'next'; this.toMove = 0;
    },
    passTurn() { if (this.over) return 0; this.seat = this.toMove; return this.seat === 0 ? 0 : 1; },
    get scribeName() { return HT_SEAT[this.seat] || 'The Scribe'; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* The Scribe passes the queen of spades (unless it holds enough spades to hide her), the ace and king of
     * spades, high hearts and the high cards of a short suit. In play it ducks under the winning card when the
     * trick carries points, wins tricks it can win cleanly to shed high cards, and when it cannot follow it
     * throws the queen of spades first, then its highest heart, then its highest card. Sharp deals the unseen
     * cards among the others many times and plays each hand out, to take as few points as it can. */
    passChoice(s) {
      const h = this.hands[s], spades = h.filter(c => htSuit(c) === 0), lowSpades = spades.filter(c => htPow(c) < 11).length;
      const danger = c => {
        if (c === HT_QS) return lowSpades >= 4 ? 2 : 30;
        if (htSuit(c) === 0 && htPow(c) > 11) return h.includes(HT_QS) || lowSpades >= 4 ? 3 : 20;
        if (htSuit(c) === HT_H) return htPow(c) + 2;
        const n = h.filter(x => htSuit(x) === htSuit(c)).length;
        return htPow(c) + (n <= 3 ? 6 - n : 0);
      };
      const noise = LEVEL.name === 'gentle' ? 8 : 0.5;
      return h.slice().sort((a, b) => danger(b) + Math.random() * noise - (danger(a) + Math.random() * noise)).slice(0, 3);
    },
    aiPlan() {
      if (this.need === 'next') return [{ pl: 0, kind: 'next' }];
      if (this.need === 'pass') { const cs = this.passChoice(0); return cs.map(card => ({ pl: 0, seat: 0, kind: 'mark', card })).concat([{ pl: 0, seat: 0, kind: 'pass', cards: cs }]); }
      const s = this.toMove, ms = this.legalCards(s), mv = card => [{ pl: 1, seat: s, kind: 'play', card }];
      if (ms.length === 1) return mv(ms[0]);
      if (LEVEL.name === 'gentle' && !this.rollout && Math.random() < 0.35) return mv(ms[(Math.random() * ms.length) | 0]);
      if (LEVEL.name === 'sharp' && !this.rollout) return mv(this.sample(s, ms));
      return mv(this.choose(s, ms));
    },
    choose(s, ms) {
      const hi = a => a.reduce((x, y) => (htPow(y) > htPow(x) ? y : x)), lo = a => a.reduce((x, y) => (htPow(y) < htPow(x) ? y : x));
      const gone = new Set(this.played.concat(this.hands[s]));
      if (!this.trick.length) {
        // Lead low; flush the queen with low spades when she is still out and not in hand.
        const qsOut = !gone.has(HT_QS), spades = ms.filter(c => htSuit(c) === 0 && htPow(c) < 11);
        if (qsOut && spades.length && !this.hands[s].some(c => htSuit(c) === 0 && htPow(c) >= 11)) return lo(spades);
        const safe = ms.filter(c => htSuit(c) !== HT_H && c !== HT_QS && !(htSuit(c) === 0 && htPow(c) > 11 && qsOut));
        return lo(safe.length ? safe : ms);
      }
      const led = htSuit(this.trick[0].card), b = this.best(), last = this.trick.length === 3;
      const pts = this.trick.reduce((t, x) => t + htPoints(x.card), 0);
      if (htSuit(ms[0]) === led) {
        const under = ms.filter(c => htPow(c) < htPow(b.card));
        if (led === 0 && ms.includes(HT_QS) && htPow(b.card) > 12) return HT_QS; // the king or ace is out in front: drop her on it
        if (under.length) return hi(under.filter(c => c !== HT_QS).length ? under.filter(c => c !== HT_QS) : under);
        if (last && !pts) return hi(ms.filter(c => c !== HT_QS).length ? ms.filter(c => c !== HT_QS) : ms); // a clean trick: win it with the highest
        return lo(ms.filter(c => c !== HT_QS).length ? ms.filter(c => c !== HT_QS) : ms);
      }
      if (ms.includes(HT_QS)) return HT_QS;
      const highSpades = ms.filter(c => htSuit(c) === 0 && htPow(c) > 11 && !gone.has(HT_QS));
      if (highSpades.length) return hi(highSpades);
      const hearts = ms.filter(c => htSuit(c) === HT_H);
      return hi(hearts.length ? hearts : ms);
    },
    sample(s, ms) {
      const known = new Set(this.played.concat(this.hands[s], this.received[s] || [])), pool = Array.from({ length: 52 }, (_, i) => i).filter(c => !known.has(c));
      const tally = new Map(ms.map(c => [c, 0])), N = 30, others = [1, 2, 3].map(k => (s + k) % 4);
      for (let k = 0; k < N; k++) {
        const hands = this.hands.map(h => h.slice());
        // Deal the unseen cards to the others, keeping each one's known voids, and the cards passed to them where they went.
        let d = pool.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
        const mine = (this.picks && this.picks[s]) ? this.picks[s].filter(c => !this.played.includes(c)) : [];
        const tgt = this.pass !== 'none' && this.picks && this.picks[s] ? this.target(s) : -1;
        for (const o of others) hands[o] = o === tgt ? mine.slice() : [];
        d = d.filter(c => !mine.includes(c));
        for (const o of others) {
          const need = this.hands[o].length - hands[o].length;
          const fits = d.filter(c => !this.void[o][htSuit(c)]), take = (fits.length >= need ? fits : d).slice(0, need);
          hands[o].push(...take); d = d.filter(c => !take.includes(c));
        }
        for (const c of ms) {
          const w = Object.create(HEARTS);
          Object.assign(w, { rollout: true, hands: hands.map(h => h.slice()), trick: this.trick.map(t => ({ ...t })), taken: this.taken.map(t => t.slice()), played: this.played.slice(), nTricks: this.nTricks, broken: this.broken, toMove: s, need: 'play', score: [0, 0, 0, 0], handNo: 1, variant: '100', void: this.void.map(v => v.slice()), notes: [], picks: [null, null, null, null], received: [[], [], [], []], pass: 'none' });
          w.apply({ pl: 1, seat: s, kind: 'play', card: c });
          let guard = 0;
          while (w.nTricks < 13 && guard++ < 60) w.apply(w.aiPlan()[0]);
          const p = w.taken.map(cs => cs.reduce((t, x) => t + htPoints(x), 0)), mineP = p.indexOf(26) >= 0 ? (p[s] === 26 ? 0 : 26) : p[s];
          tally.set(c, tally.get(c) + mineP);
        }
      }
      return ms.reduce((a, b) => (tally.get(b) < tally.get(a) ? b : a));
    },
  };

