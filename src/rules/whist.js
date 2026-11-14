  /* ----------------------------------------------------------------- Whist
   * Four seats round the table, clockwise: 0 you (South), 1 West, 2 North, your
   * partner, 3 East. Cards use the cribbage numbering, suit * 13 + rank with
   * rank 0 the ace; wsPow ranks them for play, ace high. Seats 0 and 2 are
   * side 0, seats 1 and 3 side 1. */
  const WS_SEAT = ['You', 'West', 'North', 'East'];
  const WS_SIDE = ['You and North', 'West and East'];
  const WS_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const WS_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
  const wsSuit = c => (c / 13) | 0, wsPow = c => (c % 13 + 12) % 13;
  const wsName = c => `${WS_RANK[c % 13]} of ${WS_SUIT[wsSuit(c)]}`;
  const wsCard = (suit, pow) => suit * 13 + (pow + 1) % 13;
  const WHIST = {
    id: 'whist', name: 'Whist', dice: false, first: 0, target: 5,
    SEATS: WS_SEAT, SIDES: WS_SIDE, SUITS: WS_SUIT, suit: wsSuit, pow: wsPow, cardName: wsName,
    rules: [
      'You sit South. North, opposite you, is your partner, played by the Scribe; West and East, also the Scribe, play against you both. Play goes clockwise.',
      'Each of you holds thirteen cards. The dealer\'s last card is turned face up, and its suit is trumps for the deal. The player on the dealer\'s left leads to the first trick.',
      'Follow suit if you can; if you cannot, play any card, a trump or not. The highest trump wins the trick, or with no trump in it, the highest card of the suit led, aces high. The winner leads to the next trick.',
      'After thirteen tricks, the side that took more scores a point for every trick over six. Then honours: a side that held the ace, king, queen and jack of trumps between them scores 4, and a side that held three of the four scores 2. A side that began the deal on 4 cannot score honours.',
      'Tricks score before honours. The first side to 5 points wins the game.'
    ],
    source: 'Short whist, the 5-point game that replaced long whist in Britain, as described by John McLeod at pagat.com. We play a single game rather than a rubber of three.',
    init(deck) { this.score = [0, 0]; this.over = null; this.dealer = 3; this.hand = 0; this.seat = 0; this.notes = []; this.deal(deck); },
    deal(deck) {
      if (!deck) { deck = Array.from({ length: 52 }, (_, i) => i); for (let i = 51; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; } }
      // Dealt one at a time from the dealer's left, so the 52nd card, the dealer's last, is turned for trumps.
      this.hands = [[], [], [], []];
      deck.forEach((c, k) => this.hands[(this.dealer + 1 + k) % 4].push(c));
      this.hands.forEach(h => h.sort((a, b) => wsSuit(a) - wsSuit(b) || wsPow(a) - wsPow(b)));
      this.turnUp = deck[51]; this.trump = wsSuit(this.turnUp); this.upShown = true;
      this.trick = []; this.tricks = [0, 0]; this.played = []; this.lastTrick = null;
      this.void = [0, 1, 2, 3].map(() => [false, false, false, false]);
      this.need = 'play'; this.toMove = (this.dealer + 1) % 4; this.seat = this.toMove;
      this.start = this.score.slice(); this.hand++;
      this.honours = [0, 0];
      this.hands.forEach((h, s) => h.forEach(c => { if (wsSuit(c) === this.trump && wsPow(c) >= 9) this.honours[s & 1]++; }));
    },
    who(s) { return s === 0 ? 'You' : WS_SEAT[s]; },
    ledSuit() { return this.trick.length ? wsSuit(this.trick[0].card) : -1; },
    legalCards(hand) {
      const led = this.ledSuit(); if (led < 0) return hand.slice();
      const follow = hand.filter(c => wsSuit(c) === led);
      return follow.length ? follow : hand.slice();
    },
    beats(a, b) { const sa = wsSuit(a), sb = wsSuit(b); return sa === sb ? wsPow(a) > wsPow(b) : sa === this.trump; },
    best() { let b = this.trick[0]; for (const t of this.trick) if (this.beats(t.card, b.card)) b = t; return b; },
    legal(pl) {
      if (this.over) return [];
      if (this.need === 'next') return pl === 0 ? [{ pl, kind: 'next', label: 'Next deal' }] : [];
      const s = this.toMove; if ((s === 0) !== (pl === 0)) return [];
      return this.legalCards(this.hands[s]).map(card => ({ pl, seat: s, kind: 'play', card }));
    },
    apply(m) {
      if (m.kind === 'next') {
        this.dealer = (this.dealer + 1) % 4; this.deal();
        const d = this.dealer;
        return { note: `${this.who(d)} ${d ? 'deals' : 'deal'}, and the ${wsName(this.turnUp)} is turned: ${WS_SUIT[this.trump]} are trumps.`, events: [{ type: 'deal' }] };
      }
      const s = m.seat, hand = this.hands[s], led = this.ledSuit(), events = [{ type: 'play', seat: s, card: m.card }];
      hand.splice(hand.indexOf(m.card), 1);
      if (led >= 0 && wsSuit(m.card) !== led) this.void[s][led] = true;
      if (s === this.dealer) this.upShown = false; // the turned card joins the dealer's hand once the dealer plays
      this.trick.push({ seat: s, card: m.card }); this.played.push(m.card);
      if (this.trick.length < 4) { this.toMove = (s + 1) % 4; return { note: '', events }; }
      const w = this.best().seat;
      this.tricks[w & 1]++; this.lastTrick = { cards: this.trick.map(t => t.card), winner: w };
      this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      const notes = [`${this.who(w)} ${w ? 'takes' : 'take'} the trick.`];
      if (this.hands.every(h => !h.length)) this.endHand(notes);
      return { note: notes.join(' '), events };
    },
    endHand(notes) {
      const side = this.tricks[0] > 6 ? 0 : 1, odd = this.tricks[side] - 6;
      notes.push(`${WS_SIDE[side]} took ${this.tricks[side]} tricks: ${odd} point${odd > 1 ? 's' : ''}.`);
      this.score[side] += odd;
      if (this.score[side] >= this.target) this.win(side);
      else for (const t of [0, 1]) {
        const h = this.honours[t], pts = h === 4 ? 4 : h === 3 ? 2 : 0;
        if (!pts) continue;
        if (this.start[t] >= 4) { notes.push(`${WS_SIDE[t]} held ${h === 4 ? 'all four' : 'three'} honours, but a side at four cannot score them.`); continue; }
        this.score[t] += pts; notes.push(`${WS_SIDE[t]} held ${h === 4 ? 'all four' : 'three'} honours: ${pts} points.`);
        if (this.score[t] >= this.target) { this.win(t); break; }
      }
      this.notes = notes.slice();
      if (!this.over) { this.need = 'next'; this.toMove = 0; }
    },
    win(t) {
      const deals = `${this.hand} deal${this.hand > 1 ? 's' : ''}`;
      this.over = { winner: t, title: t ? 'West and East win' : 'You and North win', text: `The game ends ${this.score[0]} to ${this.score[1]}, after ${deals}.` };
    },
    passTurn() { if (this.over) return 0; this.seat = this.toMove; return this.seat === 0 ? 0 : 1; },
    get scribeName() { return this.seat === 2 ? 'North, your partner' : WS_SEAT[this.seat]; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    snapshot() { return JSON.stringify([this.hands, this.trick, this.toMove, this.tricks, this.played, this.void, this.need, this.score, this.over, this.upShown, this.lastTrick, this.seat, this.notes]); },
    restore(x) { [this.hands, this.trick, this.toMove, this.tricks, this.played, this.void, this.need, this.score, this.over, this.upShown, this.lastTrick, this.seat, this.notes] = JSON.parse(x); },
    // A sound card for seat s: cash winners, draw trumps when long in them, let partner ruff,
    // second hand low, third hand high, and win as cheaply as possible when an opponent leads the trick.
    heuristic(s) {
      const hand = this.hands[s], ms = this.legalCards(hand), T = this.trump, partner = (s + 2) % 4;
      if (ms.length === 1) return ms[0];
      const gone = new Set(this.played.concat(hand));
      const master = c => { for (let p = wsPow(c) + 1; p < 13; p++) if (!gone.has(wsCard(wsSuit(c), p))) return false; return true; };
      const low = a => a.reduce((x, y) => (wsPow(y) < wsPow(x) ? y : x));
      const high = a => a.reduce((x, y) => (wsPow(y) > wsPow(x) ? y : x));
      const of = k => hand.filter(c => wsSuit(c) === k);
      let trumpsAbroad = 0; for (let p = 0; p < 13; p++) if (!gone.has(wsCard(T, p))) trumpsAbroad++;
      const oppVoid = k => this.void[(s + 1) % 4][k] || this.void[(s + 3) % 4][k];
      if (!this.trick.length) {
        const cash = ms.filter(c => wsSuit(c) !== T && master(c) && !(oppVoid(wsSuit(c)) && trumpsAbroad));
        if (cash.length) return cash[0];
        const tr = of(T);
        if (tr.length >= 5 && trumpsAbroad) return master(high(tr)) ? high(tr) : low(tr);
        for (let k = 0; k < 4; k++) if (k !== T && of(k).length && this.void[partner][k] && !this.void[partner][T] && trumpsAbroad && !oppVoid(k)) return low(of(k));
        let best = -1; for (let k = 0; k < 4; k++) if (k !== T && of(k).length && (best < 0 || of(k).length > of(best).length)) best = k;
        if (best < 0) return master(high(tr)) ? high(tr) : low(tr);
        return low(of(best));
      }
      const led = this.ledSuit(), win = this.best(), following = wsSuit(ms[0]) === led && hand.some(c => wsSuit(c) === led);
      const winners = ms.filter(c => this.beats(c, win.card)), pos = this.trick.length; // pos: 1 second hand, 2 third, 3 fourth
      const discard = () => {
        const plain = ms.filter(c => wsSuit(c) !== T), pool = plain.length ? plain : ms, spare = pool.filter(c => !master(c));
        return low(spare.length ? spare : pool);
      };
      const duck = () => (following ? low(ms) : discard());
      if (win.seat === partner) {
        if (pos === 3 || master(win.card) || wsSuit(win.card) === T) return duck();
        const top = winners.filter(master); // third hand: overtake partner only with a sure winner
        return following && top.length ? low(top) : duck();
      }
      if (!winners.length) return duck();
      if (pos === 1) {
        if (!following) return low(winners); // ruff in second seat
        const top = winners.filter(master);
        return top.length ? low(top) : duck();
      }
      if (pos === 2 && following) { const top = winners.filter(master); return top.length ? low(top) : high(winners); }
      return low(winners);
    },
    aiPlan() {
      const s = this.toMove, ms = this.legalCards(this.hands[s]);
      const card = Math.random() < pick(0.45, 0.15, 0) ? ms[(Math.random() * ms.length) | 0] : this.heuristic(s); // the gentler Scribes play some cards carelessly
      return [{ pl: 1, seat: s, kind: 'play', card }];
    },
  };

