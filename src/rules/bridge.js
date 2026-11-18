  /* --------------------------------------------------------- Contract Bridge
   * Vanderbilt's contract bridge of 1925: an auction for the contract, a dummy laid face up, and scoring that
   * counts only the tricks bid towards game. Seats as at Whist (0 you, South; 1 West; 2 North, your partner;
   * 3 East), play clockwise. Cards are numbered suit * 13 + rank (rank 0 the ace, high): spades 0, hearts 1,
   * diamonds 2, clubs 3. Strains are numbered in bidding order: clubs 0, diamonds 1, hearts 2, spades 3,
   * no trumps 4; a bid is (level - 1) * 5 + strain. */
  const BR_SEAT = ['You', 'West', 'North', 'East'];
  const BR_SIDE = ['North–South', 'East–West'];
  const BR_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const BR_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
  const BR_STRAIN = ['clubs', 'diamonds', 'hearts', 'spades', 'no trumps'];
  const BR_SIGN = ['♣', '♦', '♥', '♠', 'NT'];
  const STRAIN_SUIT = [3, 2, 1, 0, -1], SUIT_STRAIN = [3, 2, 1, 0];
  const brSuit = c => (c / 13) | 0, brPow = c => (c % 13 + 12) % 13; // two 0 ... ace 12
  const brName = c => `${BR_RANK[c % 13]} of ${BR_SUIT[brSuit(c)]}`;
  const brCard = (su, pow) => su * 13 + (pow + 1) % 13;
  const brHcp = c => Math.max(0, brPow(c) - 8); // jack 1, queen 2, king 3, ace 4
  const bidName = b => `${((b / 5) | 0) + 1}${BR_SIGN[b % 5]}`;
  const bidWords = b => `${((b / 5) | 0) + 1} ${BR_STRAIN[b % 5]}`;
  const brShuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const BRIDGE = {
    id: 'bridge', name: 'Contract Bridge', dice: false, cardName: brName,
    SEATS: BR_SEAT, SIDES: BR_SIDE, SUITS: BR_SUIT, STRAINS: BR_STRAIN, SIGN: BR_SIGN, bidName, suit: brSuit, pow: brPow,
    get first() { return this.toMove === undefined || this.toMove === 0 ? 0 : 1; },
    variants: [{ id: 'chicago', label: 'Four deals (Chicago)' }, { id: 'rubber', label: 'A rubber' }], variant: 'chicago', variantLabel: 'Game',
    setVariant(id) { this.variant = id === 'rubber' ? 'rubber' : 'chicago'; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'You sit South, with North, played by the Scribe, as your partner, against West and East. Thirteen cards each.',
      'The auction goes round from the dealer. Each player passes, bids, doubles an opponent\'s bid or redoubles a double. A bid names a number of tricks over six (one to seven) and trumps: clubs, diamonds, hearts, spades or no trumps, in that order, and must outrank the last bid. To bid, choose the level, then the strain. Three passes after a bid end the auction; four passes at the start throw the deal in.',
      'The last bid is the contract. Of the side that won it, the player who first named its trumps is declarer. The player on declarer\'s left leads, then declarer\'s partner lays their hand face up as dummy, and declarer plays both hands. When your side wins the contract, you play both your hand and North\'s.',
      'Follow suit if you can; the highest trump wins the trick, or the highest card of the suit led. Aces are high.',
      'Only the tricks bid count towards game: 20 a trick in clubs and diamonds, 30 in hearts and spades, 40 for the first in no trumps and 30 after; doubled twice that, redoubled four times. A hundred of these makes a game. Extra tricks, slams (twelve or thirteen tricks bid and made) and honours score besides. A side that falls short pays for each trick it is down, more when vulnerable or doubled.',
      'Chicago (the default) plays four deals: the first with neither side vulnerable, the second and third with the dealer\'s side vulnerable, the fourth with both; a game made scores 300, or 500 vulnerable, and a part score 50. A rubber is the best of three games, with 700 or 500 for winning it. The higher total wins.'
    ],
    source: 'Contract bridge as Wikipedia gives its laws: the auction, the dummy, Vanderbilt\'s contract scoring with vulnerability, doubles, slams and honours, and the Chicago and rubber forms.',
    init() { this.total = [0, 0]; this.below = [0, 0]; this.games = [0, 0]; this.vulnerable = [false, false]; this.dealNo = 0; this.dealer = 3; this.over = null; this.decided = null; this.notes = []; this.history = []; this.deal(); },
    deal(again) {
      if (!again) { this.dealer = (this.dealer + 1) % 4; this.dealNo++; }
      const d = brShuffle(Array.from({ length: 52 }, (_, i) => i));
      this.hands = [0, 1, 2, 3].map(s => d.slice(s * 13, s * 13 + 13));
      this.dealt = this.hands.map(h => h.slice());
      this.sortAll();
      this.calls = []; this.last = null; this.doubled = 0; this.contract = null; this.declarer = -1; this.dummy = -1;
      this.trick = []; this.played = []; this.tricks = [0, 0]; this.nTricks = 0; this.lastTrick = null; this.dummyShown = false;
      this.void = [0, 1, 2, 3].map(() => [false, false, false, false]);
      if (this.variant === 'chicago') { const ds = this.dealer & 1, n = this.dealNo; this.vulnerable = n === 1 ? [false, false] : n === 4 ? [true, true] : [ds === 0, ds === 1]; }
      this.need = 'auction'; this.toMove = this.dealer; this.notes = [];
    },
    sortAll() { this.hands.forEach(h => h.sort((a, b) => [0, 1, 3, 2].indexOf(brSuit(a)) - [0, 1, 3, 2].indexOf(brSuit(b)) || brPow(b) - brPow(a))); },
    who(s) { return s === 0 ? 'You' : BR_SEAT[s]; },
    side: s => s & 1,
    trump() { return this.contract ? STRAIN_SUIT[this.contract.bid % 5] : -1; },
    // Who plays a seat's cards: you play your own, and North's too when your side has the contract.
    controls(s) { return s === 0 || (s === 2 && this.need === 'play' && this.declarer >= 0 && (this.declarer & 1) === 0); },
    legalCalls(s) {
      const out = [{ type: 'pass' }], lastSide = this.last ? this.last.seat & 1 : -1;
      if (this.last && lastSide !== (s & 1) && this.doubled === 0) out.push({ type: 'double' });
      if (this.last && lastSide === (s & 1) && this.doubled === 1) out.push({ type: 'redouble' });
      for (let b = this.last ? this.last.bid + 1 : 0; b < 35; b++) out.push({ type: 'bid', bid: b });
      return out;
    },
    legalCards(s) {
      const h = this.hands[s]; if (!this.trick.length) return h.slice();
      const led = brSuit(this.trick[0].card), f = h.filter(c => brSuit(c) === led);
      return f.length ? f : h.slice();
    },
    beats(a, b) { const T = this.trump(), sa = brSuit(a), sb = brSuit(b); return sa === sb ? brPow(a) > brPow(b) : sa === T; },
    best() { let b = this.trick[0]; for (const t of this.trick) if (this.beats(t.card, b.card)) b = t; return b; },
    auctionText() { return this.calls.map(c => `${c.seat === 0 ? 'you' : BR_SEAT[c.seat]} ${c.type === 'bid' ? bidName(c.bid) : c.type}`).join(', '); },
    contractName() { if (!this.contract) return ''; return bidWords(this.contract.bid) + (this.doubled === 2 ? ', redoubled' : this.doubled === 1 ? ', doubled' : ''); },
    prompt0() {
      if (this.need === 'next') return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next deal when you are ready.');
      const vul = `Vulnerable: ${this.vulnerable[0] && this.vulnerable[1] ? 'both sides' : this.vulnerable[0] ? 'your side' : this.vulnerable[1] ? 'East–West' : 'neither side'}.`;
      if (this.need === 'auction') return `${this.calls.length ? 'The auction: ' + this.auctionText() + '. ' : ''}${vul} Pass, or choose a level to bid.`;
      const c = `${this.declarer === 0 ? 'You are' : this.declarer === 2 ? 'North is' : BR_SEAT[this.declarer] + ' is'} declarer in ${this.contractName()}. `;
      const s = this.toMove, north = s === 2 && this.controls(2), sideT = this.tricks[0];
      if (!this.trick.length) return c + `Your side has ${sideT} trick${sideT === 1 ? '' : 's'}. Lead ${north ? 'from North\'s hand, the dummy' : 'any card'}.`;
      const led = brSuit(this.trick[0].card), can = this.hands[s].some(x => brSuit(x) === led);
      return c + (north ? 'From North\'s hand: ' : '') + (can ? `${north ? 'f' : 'F'}ollow with a ${BR_SUIT[led].slice(0, -1)}.` : `${north ? 'n' : 'N'}o ${BR_SUIT[led]}, so play any card.`);
    },
    legal(pl) {
      if (this.over) return [];
      if (this.need === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next deal' }] : [];
      const s = this.toMove, mine = this.need === 'auction' ? s === 0 : this.controls(s);
      if (mine !== (pl === 0)) return [];
      if (this.need === 'auction') {
        const calls = this.legalCalls(s), out = [];
        for (const c of calls) {
          if (c.type === 'pass') out.push({ pl, seat: s, kind: 'call', type: 'pass', label: 'Pass' });
          else if (c.type === 'double') out.push({ pl, seat: s, kind: 'call', type: 'double', label: 'Double' });
          else if (c.type === 'redouble') out.push({ pl, seat: s, kind: 'call', type: 'redouble', label: 'Redouble' });
          else out.push({ pl, seat: s, kind: 'call', type: 'bid', bid: c.bid }); // chosen through a level, below
        }
        if (pl === 0) { const lo = this.last ? ((this.last.bid + 1) / 5 | 0) + 1 : 1; for (let n = lo; n <= 7; n++) if (n <= 7 && (n - 1) * 5 + 4 > (this.last ? this.last.bid : -1)) out.push({ pl, seat: s, kind: 'level', n, label: `Bid ${n}…` }); }
        return out;
      }
      return this.legalCards(s).map(card => ({ pl, seat: s, kind: 'play', card }));
    },
    apply(m) {
      const events = [];
      if (m.kind === 'next') { if (this.decided) { this.over = this.decided; return { note: '' }; } this.deal(); return { note: `Deal ${this.dealNo}. ${this.dealer ? BR_SEAT[this.dealer] + ' deals' : 'You deal'}.`, events: [{ type: 'deal' }] }; }
      if (m.kind === 'level') {
        const lo = this.last ? this.last.bid + 1 : 0, out = [];
        for (let st = 0; st < 5; st++) { const b = (m.n - 1) * 5 + st; if (b >= lo) out.push({ pl: 0, seat: m.seat, kind: 'call', type: 'bid', bid: b, label: bidName(b) }); }
        out.push({ pl: 0, seat: m.seat, kind: 'back', label: 'Back' });
        return { note: '', followUp: out, events };
      }
      if (m.kind === 'back') return { note: '', events };
      const s = m.seat;
      if (m.kind === 'call') {
        this.calls.push({ seat: s, type: m.type, bid: m.bid });
        events.push({ type: 'call', seat: s });
        let note = `${this.who(s)} ${m.type === 'bid' ? (s ? 'bids ' : 'bid ') + bidWords(m.bid) : m.type === 'pass' ? (s ? 'passes' : 'pass') : (s ? m.type + 's' : m.type)}.`;
        if (m.type === 'bid') { this.last = { bid: m.bid, seat: s }; this.doubled = 0; }
        if (m.type === 'double') this.doubled = 1;
        if (m.type === 'redouble') this.doubled = 2;
        const n = this.calls.length, tail = this.calls.slice(-3);
        if (!this.last && n === 4) { // passed out
          this.notes = ['All four pass: the deal is thrown in, and dealt again.']; this.need = 'next'; this.toMove = 0; this.dealNo--; this.dealer = (this.dealer + 3) % 4;
          return { note: note + ' ' + this.notes[0], events };
        }
        if (this.last && n >= 4 && tail.length === 3 && tail.every(c => c.type === 'pass')) { note += ' ' + this.startPlay(events); return { note, events }; }
        this.toMove = (s + 1) % 4;
        return { note, events };
      }
      // A card.
      const h = this.hands[s]; h.splice(h.indexOf(m.card), 1);
      if (this.trick.length && brSuit(m.card) !== brSuit(this.trick[0].card)) this.void[s][brSuit(this.trick[0].card)] = true;
      this.trick.push({ seat: s, card: m.card }); this.played.push(m.card);
      events.push({ type: 'play', seat: s, card: m.card });
      if (!this.dummyShown) { this.dummyShown = true; events.push({ type: 'dummy', seat: this.dummy }); }
      if (this.trick.length < 4) { this.toMove = (s + 1) % 4; return { note: '', events }; }
      const w = this.best().seat;
      this.tricks[w & 1]++; this.nTricks++; this.lastTrick = { cards: this.trick.map(t => t.card), winner: w }; this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      let note = `${this.who(w)} ${w ? 'takes' : 'take'} the trick.`;
      if (this.nTricks === 13) note += ' ' + this.endDeal();
      return { note, events };
    },
    startPlay(events) {
      const b = this.last.bid, side = this.last.seat & 1, st = b % 5;
      this.contract = { bid: b, side };
      this.declarer = this.calls.find(c => c.type === 'bid' && (c.seat & 1) === side && c.bid % 5 === st).seat;
      this.dummy = (this.declarer + 2) % 4; this.need = 'play'; this.toMove = (this.declarer + 1) % 4;
      events.push({ type: 'contract' });
      const dec = this.declarer === 0 ? 'you are' : (this.declarer === 2 ? 'North is' : BR_SEAT[this.declarer] + ' is');
      return `The contract is ${this.contractName()}; ${dec} declarer${side === 0 ? ', and you play both hands' : ''}. ${this.who(this.toMove)} ${this.toMove ? 'leads' : 'lead'}.`;
    },
    // The score for a contract: points below the line (towards game) and above it, for the declaring side
    // when made, for the defenders when not.
    scoreDeal(bid, doubled, vul, tricks) {
      const level = ((bid / 5) | 0) + 1, st = bid % 5, need = level + 6, mult = doubled === 2 ? 4 : doubled === 1 ? 2 : 1;
      const per = st < 2 ? 20 : 30, first = st === 4 ? 40 : per;
      if (tricks >= need) {
        const below = (first + (level - 1) * per) * mult, over = tricks - need;
        let above = over * (doubled ? (vul ? 200 : 100) * (doubled === 2 ? 2 : 1) : per);
        if (doubled) above += doubled === 2 ? 100 : 50;
        if (level === 6) above += vul ? 750 : 500;
        if (level === 7) above += vul ? 1500 : 1000;
        return { made: true, below, above, over };
      }
      const down = need - tricks; let pen = 0;
      for (let k = 1; k <= down; k++) {
        if (!doubled) pen += vul ? 100 : 50;
        else { const d = vul ? (k === 1 ? 200 : 300) : (k === 1 ? 100 : k <= 3 ? 200 : 300); pen += d * (doubled === 2 ? 2 : 1); }
      }
      return { made: false, below: 0, above: pen, down };
    },
    honours() { // for the side holding them: four or five trump honours in one hand, or all four aces at no trumps
      const T = this.trump(), out = [0, 0];
      for (let s = 0; s < 4; s++) {
        const h = this.dealt[s];
        if (T < 0) { if (h.filter(c => c % 13 === 0).length === 4) out[s & 1] += 150; }
        else { const n = h.filter(c => brSuit(c) === T && brPow(c) >= 8).length; if (n === 5) out[s & 1] += 150; else if (n === 4) out[s & 1] += 100; }
      }
      return out;
    },
    endDeal() {
      const side = this.contract.side, r = this.scoreDeal(this.contract.bid, this.doubled, this.vulnerable[side], this.tricks[side]);
      const notes = [], fmt = n => n.toLocaleString('en-GB');
      const hon = this.honours();
      if (r.made) notes.push(`${BR_SIDE[side]} ${side ? 'make' : 'make'} ${this.contractName()}${r.over ? ` with ${r.over} over` : ''}.`);
      else notes.push(`${BR_SIDE[side]} ${r.down === 1 ? 'go one down' : `go ${r.down} down`} in ${this.contractName()}.`);
      let gain = [0, 0];
      if (this.variant === 'chicago') {
        if (r.made) { gain[side] += r.below + r.above + (r.below >= 100 ? (this.vulnerable[side] ? 500 : 300) : 50); }
        else gain[1 - side] += r.above;
        gain = gain.map((g, t) => g + hon[t]);
        this.total[0] += gain[0]; this.total[1] += gain[1];
        notes.push(`${BR_SIDE[0]} ${fmt(gain[0])}, ${BR_SIDE[1]} ${fmt(gain[1])}${hon[0] || hon[1] ? ' (with honours)' : ''}. Totals: ${fmt(this.total[0])} to ${fmt(this.total[1])}.`);
        if (this.dealNo >= 4) this.finish(notes);
      } else {
        if (r.made) { this.below[side] += r.below; this.total[side] += r.below + r.above; } else this.total[1 - side] += r.above;
        this.total[0] += hon[0]; this.total[1] += hon[1];
        if (r.made && this.below[side] >= 100) {
          this.games[side]++; this.below = [0, 0]; this.vulnerable[side] = true;
          notes.push(`A game to ${BR_SIDE[side]}.`);
          if (this.games[side] === 2) { const bonus = this.games[1 - side] ? 500 : 700; this.total[side] += bonus; notes.push(`The rubber, and ${bonus}.`); this.finish(notes); }
        }
        if (!this.decided) notes.push(`Totals: ${fmt(this.total[0])} to ${fmt(this.total[1])}; games ${this.games[0]}–${this.games[1]}.`);
      }
      this.history.push({ contract: this.contract, doubled: this.doubled, declarer: this.declarer, tricks: this.tricks.slice() });
      this.notes = notes; this.need = 'next'; this.toMove = 0;
      return notes.join(' ');
    },
    finish(notes) {
      const [a, b] = this.total, w = a === b ? 2 : a > b ? 0 : 1, f = n => n.toLocaleString('en-GB');
      this.decided = { winner: w, title: w === 2 ? 'Level' : w ? 'East and West win' : 'You and North win', text: `Final totals: ${f(a)} to ${f(b)}, after ${this.dealNo} deals.` };
      notes.push(`Final totals: ${f(a)} to ${f(b)}.`);
    },
    passTurn() { if (this.over) return 0; this.seat = this.toMove; return this.need === 'next' ? 0 : (this.need === 'auction' ? this.toMove === 0 : this.controls(this.toMove)) ? 0 : 1; },
    get scribeName() { return this.seat === 2 ? 'North, your partner' : BR_SEAT[this.seat] || 'The Scribe'; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* Bidding: each Scribe counts its high-card points (ace 4, king 3, queen 2, jack 1) and a point for each card
     * over four in a suit, and reads its partner's calls for the least they promise. It opens with 12 or more
     * (1NT with 15-17 and an even hand, a five-card major first), overcalls a good five-card suit, and from there
     * aims at the contract the two hands together should make: a part score below 23 points, an invitation to 25,
     * game at 26 (3NT, four of a major, five of a minor at 29), a small slam at 33 and a grand at 37, in the suit
     * where the partnership has eight cards, or no trumps without one. It bids towards that contract one step at
     * a time and stops when the next bid would go past it; it doubles opponents who have bid well beyond what the
     * points left for them suggest. In play it follows Whist's book; Sharp, as declarer or defender, deals the
     * hidden hands many times and plays each deal out. */
    eval(s) {
      const h = this.hands[s].length === 13 ? this.hands[s] : this.dealt[s], len = [0, 0, 0, 0];
      let hcp = 0; for (const c of h) { hcp += brHcp(c); len[brSuit(c)]++; }
      const dist = len.reduce((t, n) => t + Math.max(0, n - 4), 0), balanced = len.every(n => n >= 2) && len.filter(n => n === 2).length <= 1;
      return { hcp, pts: hcp + dist, len, balanced };
    },
    // What a seat's calls promise: the least points and the length shown in each suit.
    shown(s) {
      const out = { min: 0, len: [0, 0, 0, 0], nt: false };
      this.calls.forEach((c, i) => {
        if (c.seat !== s || c.type !== 'bid') return;
        const before = this.calls.slice(0, i), opened = before.some(x => x.type === 'bid'), partnerBid = before.some(x => x.type === 'bid' && x.seat === (s + 2) % 4);
        const st = c.bid % 5, level = ((c.bid / 5) | 0) + 1;
        if (st === 4) { out.nt = true; out.min = Math.max(out.min, !opened ? (level === 1 ? 15 : 20) : partnerBid ? (level === 1 ? 6 : level === 2 ? 11 : 13) : 15); }
        else {
          const su = STRAIN_SUIT[st];
          out.len[su] = Math.max(out.len[su] + (out.len[su] ? 1 : 0), !opened ? (st >= 2 ? 5 : 3) : partnerBid ? 4 : 5);
          out.min = Math.max(out.min, !opened ? 12 : partnerBid ? (level === 1 ? 6 : level === 2 ? 10 : 13) : (level === 1 ? 8 : 11));
          if (partnerBid && this.calls.slice(0, i).some(x => x.type === 'bid' && x.seat === (s + 2) % 4 && x.bid % 5 === st)) out.len[su] = Math.max(out.len[su], 3); // a raise
        }
      });
      return out;
    },
    target(s) { // the contract this seat believes its side should play: { strain, level }
      const me = this.eval(s), p = this.shown((s + 2) % 4), pts = me.pts + p.min;
      let strain = -1, fit = 0;
      for (const su of [0, 1, 2, 3]) { const f = me.len[su] + p.len[su]; const st = SUIT_STRAIN[su]; if (f >= 8 && (f > fit || (f === fit && st > strain))) { fit = f; strain = st; } }
      if (strain < 0) {
        // No fit known: no trumps if even enough, else our longest suit.
        if (me.balanced || p.nt || pts >= 25) strain = 4;
        else { let su = 0; for (let k = 1; k < 4; k++) if (me.len[k] > me.len[su] || (me.len[k] === me.len[su] && SUIT_STRAIN[k] > SUIT_STRAIN[su])) su = k; strain = SUIT_STRAIN[su]; }
      }
      if (strain === 4) { const hc = me.hcp + p.min; const lv = hc >= 37 ? 7 : hc >= 33 ? 6 : hc >= 25 ? 3 : hc >= 23 ? 2 : hc >= 19 ? 1 : 0; return { strain, level: lv, pts: hc }; } // no trumps: high cards only
      const game = strain >= 2 ? 4 : 5, gameAt = strain <= 1 ? 29 : 26;
      const level = pts >= 37 ? 7 : pts >= 33 ? 6 : pts >= gameAt ? game : pts >= 23 ? Math.max(1, game - 1) : pts >= 20 ? (strain === 4 ? 1 : 2) : pts >= 17 ? 1 : 0;
      return { strain, level, pts };
    },
    callFor(s) {
      const me = this.eval(s), legal = this.legalCalls(s), pass = { type: 'pass' };
      const canBid = b => legal.some(c => c.type === 'bid' && c.bid === b);
      const bids = this.calls.filter(c => c.type === 'bid'), partner = (s + 2) % 4;
      const ourBids = bids.filter(c => (c.seat & 1) === (s & 1)), theirBids = bids.filter(c => (c.seat & 1) !== (s & 1));
      const gentle = LEVEL.name === 'gentle' && !this.rollout;
      // Opening.
      if (!bids.length) {
        if (me.balanced && me.hcp >= 15 && me.hcp <= 17) return { type: 'bid', bid: 4 };
        if (me.balanced && me.hcp >= 20 && me.hcp <= 21) return { type: 'bid', bid: 9 };
        if (me.hcp >= 12 || (me.pts >= 13 && me.hcp >= 10)) {
          let su = me.len[0] >= 5 && me.len[0] >= me.len[1] ? 0 : me.len[1] >= 5 ? 1 : me.len[2] > me.len[3] || (me.len[2] === me.len[3] && me.len[2] >= 4) ? 2 : 3;
          return { type: 'bid', bid: SUIT_STRAIN[su] };
        }
        const long = me.len.findIndex(n => n >= 7);
        if (long >= 0 && me.hcp >= 5 && me.hcp <= 10 && !gentle) { const b = 10 + SUIT_STRAIN[long]; if (canBid(b)) return { type: 'bid', bid: b }; } // a pre-empt at three
        return pass;
      }
      // Opponents opened and our side has not bid: overcall a good suit, or 1NT with a strong even hand.
      if (!ourBids.length) {
        const top = theirBids[theirBids.length - 1];
        if (me.balanced && me.hcp >= 15 && me.hcp <= 18 && canBid(4)) return { type: 'bid', bid: 4 };
        if (me.hcp >= 8 && me.hcp <= 17) {
          for (const su of [0, 1, 2, 3].sort((a, b) => me.len[b] - me.len[a])) {
            if (me.len[su] < 5) break;
            const quality = this.hands[s].filter(c => brSuit(c) === su && brPow(c) >= 9).length;
            if (quality < 2 && me.hcp < 11) continue;
            let b = SUIT_STRAIN[su]; while (!canBid(b) && b < 35) b += 5;
            if (b < 35 && ((b / 5) | 0) + 1 <= (me.hcp >= 12 ? 2 : 1 + (me.len[su] >= 6 ? 1 : 0))) return { type: 'bid', bid: b };
          }
        }
        if (top && this.doubled === 0 && ((top.bid / 5) | 0) + 1 >= 3 && me.hcp >= 15 && legal.some(c => c.type === 'double') && !gentle) return { type: 'double' };
        return pass;
      }
      // Our side is in the auction: bid towards our target.
      const t = this.target(s);
      if (gentle) t.level = Math.max(0, t.level - (Math.random() < 0.5 ? 1 : 0));
      const lastOurs = ourBids[ourBids.length - 1], lastBid = this.last;
      // Penalty double: they have outbid what the points let them make.
      if (lastBid && (lastBid.seat & 1) !== (s & 1) && this.doubled === 0 && !gentle) {
        const theirLevel = ((lastBid.bid / 5) | 0) + 1, ourPts = t.pts, T = STRAIN_SUIT[lastBid.bid % 5];
        const trumpsHeld = T >= 0 ? this.hands[s].filter(c => brSuit(c) === T).length : 0;
        if (theirLevel >= 3 && ourPts >= 20 + (theirLevel - 3) * 3 && (T < 0 || trumpsHeld >= 3) && theirLevel + 6 > 13 - Math.floor((ourPts - 4) / 3)) return { type: 'double' };
      }
      if (t.level < 1) return pass;
      // Stay in partner's strain unless ours is clearly better.
      let strain = t.strain;
      if (lastOurs && lastOurs.seat === partner && lastOurs.bid % 5 !== strain) {
        const ps = lastOurs.bid % 5, su = STRAIN_SUIT[ps], pShown = this.shown(partner).len[su] || 0;
        if (ps === 4 || (su >= 0 && me.len[su] + pShown >= 7)) strain = ps;
      }
      let b = (t.level - 1) * 5 + strain;
      if (canBid(b)) {
        // Bid one step at a time below game; jump straight to game or slam when we know enough.
        const cheapest = (() => { let x = strain; while (!canBid(x) && x < 35) x += 5; return x; })();
        const gameLevel = strain === 4 ? 3 : strain >= 2 ? 4 : 5;
        if (t.level >= gameLevel || !lastOurs) return { type: 'bid', bid: t.level >= gameLevel ? b : cheapest };
        return { type: 'bid', bid: cheapest <= b ? cheapest : b };
      }
      return pass;
    },
    // Card play: Whist's book, with no trumps when the contract has none, and the dummy's cards in view.
    heuristic(s) {
      const hand = this.hands[s], ms = this.legalCards(s), T = this.trump(), partner = (s + 2) % 4;
      if (ms.length === 1) return ms[0];
      const gone = new Set(this.played.concat(hand, this.dummyShown && this.dummy !== s ? this.hands[this.dummy] : []));
      const master = c => { for (let p = brPow(c) + 1; p < 13; p++) if (!gone.has(brCard(brSuit(c), p))) return false; return true; };
      const low = a => a.reduce((x, y) => (brPow(y) < brPow(x) ? y : x)), high = a => a.reduce((x, y) => (brPow(y) > brPow(x) ? y : x));
      const of = k => hand.filter(c => brSuit(c) === k);
      let trumpsAbroad = 0; if (T >= 0) for (let p = 0; p < 13; p++) if (!gone.has(brCard(T, p))) trumpsAbroad++;
      const oppVoid = k => this.void[(s + 1) % 4][k] || this.void[(s + 3) % 4][k];
      const declaring = (s & 1) === (this.declarer & 1);
      if (!this.trick.length) {
        if (this.nTricks === 0 && !this.played.length && !declaring) { // the opening lead: partner's suit, else the fourth best of the longest
          const pBid = this.calls.filter(c => c.seat === partner && c.type === 'bid' && c.bid % 5 < 4).map(c => STRAIN_SUIT[c.bid % 5]).pop();
          if (pBid !== undefined && of(pBid).length) return high(of(pBid));
          let best = -1; for (let k = 0; k < 4; k++) if (k !== T && of(k).length && (best < 0 || of(k).length > of(best).length)) best = k;
          if (best < 0) return low(ms);
          const cs = of(best).sort((a, b) => brPow(b) - brPow(a));
          return cs.length >= 4 ? cs[3] : cs[0];
        }
        const cash = ms.filter(c => brSuit(c) !== T && master(c) && !(T >= 0 && oppVoid(brSuit(c)) && trumpsAbroad));
        if (cash.length) return cash[0];
        if (declaring && T >= 0 && trumpsAbroad && of(T).length) return master(high(of(T))) ? high(of(T)) : low(of(T)); // draw trumps
        let best = -1; for (let k = 0; k < 4; k++) if (k !== T && of(k).length && (best < 0 || of(k).length > of(best).length)) best = k;
        if (best < 0) return low(ms);
        return low(of(best));
      }
      const led = brSuit(this.trick[0].card), win = this.best(), following = brSuit(ms[0]) === led && hand.some(c => brSuit(c) === led);
      const winners = ms.filter(c => this.beats(c, win.card)), pos = this.trick.length;
      const discard = () => { const plain = ms.filter(c => brSuit(c) !== T), pool = plain.length ? plain : ms, spare = pool.filter(c => !master(c)); return low(spare.length ? spare : pool); };
      const duck = () => (following ? low(ms) : discard());
      if (win.seat === partner) { if (pos === 3 || master(win.card) || brSuit(win.card) === T) return duck(); const top = winners.filter(master); return following && top.length ? low(top) : duck(); }
      if (!winners.length) return duck();
      if (pos === 1) { if (!following) return low(winners); const top = winners.filter(master); return top.length ? low(top) : duck(); }
      if (pos === 2 && following) { const top = winners.filter(master); return top.length ? low(top) : high(winners); }
      return low(winners);
    },
    aiPlan() {
      if (this.need === 'next') return [{ pl: 0, kind: 'next' }];
      const s = this.toMove;
      if (this.need === 'auction') { const c = this.callFor(s); return [Object.assign({ pl: 1, seat: s, kind: 'call' }, c)]; }
      const ms = this.legalCards(s), mv = card => [{ pl: 1, seat: s, kind: 'play', card }];
      if (ms.length === 1) return mv(ms[0]);
      if (LEVEL.name === 'gentle' && !this.rollout && Math.random() < 0.3) return mv(ms[(Math.random() * ms.length) | 0]);
      if (LEVEL.name === 'sharp' && !this.rollout) return mv(this.sample(s, ms));
      return mv(this.heuristic(s));
    },
    sample(s, ms) {
      // Seen: one's own hand, the dummy once shown, and declarer sees both of its side's hands.
      const team = s & 1, visible = new Set([s]); if (this.dummyShown) visible.add(this.dummy); if (s === this.dummy || s === this.declarer) { visible.add(this.declarer); visible.add(this.dummy); }
      const known = new Set(this.played); visible.forEach(v => this.hands[v].forEach(c => known.add(c)));
      const pool = Array.from({ length: 52 }, (_, i) => i).filter(c => !known.has(c));
      const tally = new Map(ms.map(c => [c, 0])), N = 20, need = this.contract.side === team ? ((this.contract.bid / 5) | 0) + 7 : 14 - (((this.contract.bid / 5) | 0) + 7);
      for (let k = 0; k < N; k++) {
        let d = brShuffle(pool.slice()); const hands = this.hands.map((h, o) => (visible.has(o) ? h.slice() : []));
        for (let o = 0; o < 4; o++) if (!visible.has(o)) { const n = this.hands[o].length, fits = d.filter(c => !this.void[o][brSuit(c)]), take = (fits.length >= n ? fits : d).slice(0, n); hands[o] = take; d = d.filter(c => !take.includes(c)); }
        for (const c of ms) {
          const w = Object.create(BRIDGE);
          Object.assign(w, { rollout: true, hands: hands.map(h => h.slice()), dealt: this.dealt, trick: this.trick.map(t => ({ ...t })), played: this.played.slice(), tricks: this.tricks.slice(), nTricks: this.nTricks, toMove: s, need: 'play', contract: this.contract, declarer: this.declarer, dummy: this.dummy, dummyShown: true, doubled: this.doubled, calls: this.calls, void: this.void.map(v => v.slice()), notes: [], total: [0, 0], below: [0, 0], games: [0, 0], vulnerable: this.vulnerable.slice(), dealNo: 1, variant: 'chicago', history: [] });
          w.apply({ pl: 1, seat: s, kind: 'play', card: c });
          let guard = 0; while (w.nTricks < 13 && guard++ < 60) w.apply(w.aiPlan()[0]);
          const got = w.tricks[team];
          tally.set(c, tally.get(c) + got + (got >= need ? 4 : 0));
        }
      }
      return ms.reduce((a, b) => (tally.get(b) > tally.get(a) ? b : a));
    },
  };

