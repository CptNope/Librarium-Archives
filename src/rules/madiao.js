  /* ---------------------------------------------------------------- Ma Diao
   * The trick-taking game of late Ming China, played with the forty money cards: Cash, Strings, Myriads and
   * Tens of Myriads. One banker against three, eight cards each; the banker must take two tricks. Seats as at
   * Whist (0 you, South; 1 West; 2 North; 3 East), but play goes the other way round, counter-clockwise:
   * you, East, North, West. Cards are numbered 0-39: Cash 0-10, Strings 11-19, Myriads 20-28, Tens 29-39,
   * each suit from its lowest card to its highest. */
  const MD_SEAT = ['You', 'West', 'North', 'East'];
  const MD_SUIT = ['Cash', 'Strings', 'Myriads', 'Tens'];
  const MD_START = [0, 11, 20, 29], MD_LEN = [11, 9, 9, 11];
  // Names, from each suit's lowest card up. Cash runs backwards: nine is lowest, Zero (Kongwen) highest.
  const MD_NAMES = [
    ['9 Cash', '8 Cash', '7 Cash', '6 Cash', '5 Cash', '4 Cash', '3 Cash', '2 Cash', '1 Cash', 'Half Cash', 'Zero Cash'],
    ['1 String', '2 Strings', '3 Strings', '4 Strings', '5 Strings', '6 Strings', '7 Strings', '8 Strings', '9 Strings'],
    ['1 Myriad', '2 Myriads', '3 Myriads', '4 Myriads', '5 Myriads', '6 Myriads', '7 Myriads', '8 Myriads', '9 Myriads'],
    ['20 Myriads', '30 Myriads', '40 Myriads', '50 Myriads', '60 Myriads', '70 Myriads', '80 Myriads', '90 Myriads', 'Hundred Myriads', 'Thousand Myriads', 'Myriad Myriads'],
  ];
  // The number a card shows, for the cut: Zero, Half and the three great Tens count as none of 2-8.
  const MD_NUM = [[9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0], [1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9], [2, 3, 4, 5, 6, 7, 8, 9, 0, 0, 0]];
  const mdSuit = c => (c >= 29 ? 3 : c >= 20 ? 2 : c >= 11 ? 1 : 0), mdPow = c => c - MD_START[mdSuit(c)];
  const mdName = c => MD_NAMES[mdSuit(c)][mdPow(c)];
  const MD_TOP = [10, 19, 28, 39]; // Zero Cash, 9 Strings, 9 Myriads, Myriad Myriads
  const MD_HUNDRED = 37;
  const mdNext = s => (s + 3) % 4; // counter-clockwise: you, East, North, West
  const mdShuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const MADIAO = {
    id: 'madiao', name: 'Ma Diao', dice: false, cardName: mdName,
    SEATS: MD_SEAT, SUITS: MD_SUIT, suit: mdSuit, power: mdPow, TOP: MD_TOP, HUNDRED: MD_HUNDRED,
    get first() { return this.toMove === undefined || this.toMove === 0 ? 0 : 1; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'Four players with forty money cards in four suits: Cash, Strings, Myriads and Tens of Myriads. In Cash the order runs backwards, so Zero Cash is highest and 9 Cash lowest; in Strings and Myriads the 9 is highest; in Tens, Myriad Myriads is highest. Eight cards each; eight stay in the stock.',
      'One player is the banker and plays against the other three. Each of the four banks once, and play goes counter-clockwise: you, East, North, West.',
      'The cut decides who leads first. Lead any card. The others may play any card: you need not follow suit. A card of the suit led that beats the highest so far is played face up; any other card goes face down. The highest card of the suit led takes the trick, and its taker leads next.',
      'The banker must take at least two of the eight tricks, or pays each player a stake. Whoever takes three or more tricks is paid a stake: the banker by each player, a player by the banker. A trick taken with the top card of a suit (Zero Cash, 9 Strings, 9 Myriads, Myriad Myriads) is paid a stake the same way, the banker only if it made its two. Win a trick with the Hundred Myriads and take exactly two tricks, and the banker pays you three and each other player one; the banker who does it is paid three by each. Taking all eight is paid eight.',
      'After four deals, the highest total wins.'
    ],
    source: 'Ma Diao as described by Pan Zhiheng and Feng Menglong in the early 17th century, after the summaries of Andrew Lo\'s studies on Wikipedia and The World of Playing Cards. The hall plays the heart of the game and its main payments; the special hands that end a deal at once, and the bonus for the card under the stock, are left out.',
    init() { this.score = [0, 0, 0, 0]; this.dealNo = 0; this.banker = 3; this.over = null; this.decided = null; this.notes = []; this.deal(); },
    deal() {
      this.banker = mdNext(this.banker); this.dealNo++;
      const d = mdShuffle(Array.from({ length: 40 }, (_, i) => i));
      // The cut: a card turned from the shuffled pack names who is dealt to, and so leads, first.
      const cut = d[(Math.random() * 40) | 0], n = MD_NUM[mdSuit(cut)][mdPow(cut)];
      const dealer = mdNext(this.banker), shuffler = (this.banker + 1) % 4, opposite = (this.banker + 2) % 4;
      this.cut = cut; this.leader = n === 4 || n === 8 ? dealer : n === 3 || n === 7 ? this.banker : n === 2 || n === 6 ? shuffler : opposite;
      this.hands = [0, 1, 2, 3].map(s => d.slice(s * 8, s * 8 + 8)); this.stock = d.slice(32);
      this.trick = []; this.won = [[], [], [], []]; this.tricks = [0, 0, 0, 0]; this.played = []; this.faceUp = []; this.nTricks = 0; this.lastTrick = null;
      this.need = 'play'; this.toMove = this.leader; this.notes = [];
      this.sortAll();
    },
    sortAll() { this.hands.forEach(h => h.sort((a, b) => a - b)); },
    who(s) { return s === 0 ? 'You' : MD_SEAT[s]; },
    side(s) { return s === this.banker ? 'banker' : 'player'; },
    best() { const led = mdSuit(this.trick[0].card); let b = this.trick[0]; for (const t of this.trick) if (mdSuit(t.card) === led && mdPow(t.card) > mdPow(b.card)) b = t; return b; },
    beats(c) { if (!this.trick.length) return true; const b = this.best().card; return mdSuit(c) === mdSuit(b) && mdPow(c) > mdPow(b); },
    prompt0() {
      if (this.need === 'next') return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next deal when you are ready.');
      const role = this.banker === 0 ? 'You are the banker: take at least two tricks.' : `${MD_SEAT[this.banker]} is the banker: keep it under two tricks.`;
      if (!this.trick.length) return `${role} Lead any card.`;
      const b = this.best();
      return `${role} The ${mdName(b.card)} holds the trick${b.seat ? ` for ${MD_SEAT[b.seat]}` : ''}. Beat it with a higher card of ${MD_SUIT[mdSuit(b.card)]}, or play any card face down.`;
    },
    legal(pl) {
      if (this.over) return [];
      if (this.need === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next deal' }] : [];
      const s = this.toMove; if ((s === 0) !== (pl === 0)) return [];
      return this.hands[s].map(card => ({ pl, seat: s, kind: 'play', card }));
    },
    apply(m) {
      const events = [];
      if (m.kind === 'next') {
        if (this.decided) { this.over = this.decided; return { note: '' }; }
        this.deal();
        return { note: this.cutNote(), events: [{ type: 'deal' }] };
      }
      const s = m.seat, hand = this.hands[s]; hand.splice(hand.indexOf(m.card), 1);
      const up = this.beats(m.card);
      this.trick.push({ seat: s, card: m.card, up }); this.played.push(m.card); if (up) this.faceUp.push(m.card);
      events.push({ type: 'play', seat: s, card: m.card, up });
      let note = '';
      if (this.trick.length < 4) { this.toMove = mdNext(s); return { note, events }; }
      const b = this.best(), w = b.seat, cards = this.trick.map(t => t.card);
      this.won[w].push({ card: b.card, cards }); this.tricks[w]++; this.nTricks++; this.lastTrick = { cards, winner: w, top: b.card, ups: this.trick.map(t => t.up) };
      this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      note = `${this.who(w)} ${w ? 'takes' : 'take'} the trick with the ${mdName(b.card)}.`;
      if (this.nTricks === 8) note += ' ' + this.endDeal();
      return { note, events };
    },
    cutNote() { return `Deal ${this.dealNo} of 4. ${this.banker === 0 ? 'You are' : MD_SEAT[this.banker] + ' is'} the banker. The cut turns up the ${mdName(this.cut)}: ${this.leader === 0 ? 'you lead' : MD_SEAT[this.leader] + ' leads'}.`; },
    // What the deal pays, between the banker and each player.
    payments() {
      const B = this.banker, pay = [0, 0, 0, 0], lines = [], t = this.tricks;
      const flow = (from, to, n) => { pay[from] -= n; pay[to] += n; };
      const others = [0, 1, 2, 3].filter(s => s !== B), made = t[B] >= 2;
      if (!made) { others.forEach(s => flow(B, s, 1)); lines.push(`The banker took ${t[B]}: it pays each player a stake.`); }
      for (let s = 0; s < 4; s++) {
        if (t[s] === 8) { if (s === B) others.forEach(o => flow(o, B, 8)); else flow(B, s, 8); lines.push(`${this.who(s)} took all eight tricks.`); continue; }
        if (t[s] >= 3) { if (s === B) others.forEach(o => flow(o, B, 1)); else flow(B, s, 1); }
        const tops = this.won[s].filter(w => MD_TOP.includes(w.card)).length;
        if (tops && (s !== B || made)) { if (s === B) others.forEach(o => flow(o, B, tops)); else flow(B, s, tops); }
        if (t[s] === 2 && this.won[s].some(w => w.card === MD_HUNDRED)) {
          if (s === B) others.forEach(o => flow(o, B, 3)); else { flow(B, s, 3); others.filter(o => o !== s).forEach(o => flow(o, s, 1)); }
          lines.push(`${this.who(s)} won a trick with the Hundred Myriads and took exactly two.`);
        }
      }
      return { pay, lines };
    },
    endDeal() {
      const { pay, lines } = this.payments();
      pay.forEach((p, s) => { this.score[s] += p; });
      const fmt = n => (n > 0 ? '+' + n : String(n));
      const notes = lines.concat([`Tricks: you ${this.tricks[0]}, East ${this.tricks[3]}, North ${this.tricks[2]}, West ${this.tricks[1]}.`, `This deal: you ${fmt(pay[0])}, East ${fmt(pay[3])}, North ${fmt(pay[2])}, West ${fmt(pay[1])}.`, `Totals: you ${this.score[0]}, East ${this.score[3]}, North ${this.score[2]}, West ${this.score[1]}.`]);
      if (this.dealNo >= 4) {
        const hi = Math.max(...this.score), top = [0, 1, 2, 3].filter(s => this.score[s] === hi);
        const text = `Final totals: you ${this.score[0]}, East ${this.score[3]}, North ${this.score[2]}, West ${this.score[1]}.`;
        this.decided = top.length > 1 ? (top.includes(0) ? { winner: 2, title: 'A shared win', text } : { winner: 1, title: `${top.map(s => MD_SEAT[s]).join(' and ')} share the win`, text })
          : { winner: top[0] === 0 ? 0 : 1, title: top[0] === 0 ? 'You win' : `${MD_SEAT[top[0]]} wins`, text };
      }
      this.notes = notes; this.need = 'next'; this.toMove = 0;
      return notes.join(' ');
    },
    passTurn() { if (this.over) return 0; this.seat = this.toMove; return this.seat === 0 ? 0 : 1; },
    get scribeName() { return MD_SEAT[this.seat] || 'The Scribe'; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* The three players work together against the banker. A player beats the banker's card whenever it can,
     * with its cheapest winning card, and leaves a partner's winning card alone, throwing its weakest card face
     * down. The banker wins tricks cheaply until it has its two, then plays for three. Anyone leads a top card
     * when it holds one, as a sure trick, and otherwise leads from its longest suit. Sharp deals the unseen
     * cards to the others many times and plays each deal out, to pick the card that pays it most. */
    isSure(c) { const su = mdSuit(c); for (let k = c + 1; k < MD_START[su] + MD_LEN[su]; k++) if (!this.faceUp.includes(k)) return false; return true; },
    choose(s, ms) {
      const B = this.banker, cheap = a => a.reduce((x, y) => (mdPow(y) < mdPow(x) ? y : x)), weak = a => a.reduce((x, y) => (this.isSure(y) && !this.isSure(x) ? x : !this.isSure(y) && this.isSure(x) ? y : mdPow(y) < mdPow(x) ? y : x));
      if (!this.trick.length) {
        const sure = ms.filter(c => this.isSure(c) || MD_TOP.includes(c));
        if (sure.length && (s !== B || this.tricks[B] < 3)) return sure[0];
        // From the longest suit, its highest card that is not a sure winner.
        const by = [0, 1, 2, 3].map(su => ms.filter(c => mdSuit(c) === su)), long = by.reduce((a, b) => (b.length > a.length ? b : a));
        return long.reduce((x, y) => (mdPow(y) > mdPow(x) ? y : x));
      }
      const b = this.best(), mates = s !== B && b.seat !== B, beat = ms.filter(c => this.beats(c));
      if (mates && (this.isSure(b.card) || this.trick.length === 3)) return weak(ms); // a partner has it: throw away
      if (s === B && b.seat !== B && beat.length) return cheap(beat);
      if (s !== B && b.seat === B && beat.length) return cheap(beat);
      if (beat.length && this.trick.length === 3) return cheap(beat); // last to play: a trick for oneself
      if (beat.length && s !== B && this.tricks[s] < 2) { const sure = beat.filter(c => this.isSure(c)); if (sure.length) return cheap(sure); }
      return weak(ms);
    },
    aiPlan() {
      if (this.need === 'next') return [{ pl: 0, kind: 'next' }];
      const s = this.toMove, ms = this.hands[s], mv = card => [{ pl: 1, seat: s, kind: 'play', card }];
      if (ms.length === 1) return mv(ms[0]);
      if (LEVEL.name === 'gentle' && !this.rollout && Math.random() < 0.4) return mv(ms[(Math.random() * ms.length) | 0]);
      if (LEVEL.name === 'sharp' && !this.rollout) return mv(this.sample(s, ms));
      return mv(this.choose(s, ms));
    },
    sample(s, ms) {
      // The cards nobody has seen: in the other hands, in the stock, or played face down by others.
      const known = new Set(this.hands[s].concat(this.faceUp, this.trick.map(t => t.card)));
      const pool = Array.from({ length: 40 }, (_, i) => i).filter(c => !known.has(c));
      const tally = new Map(ms.map(c => [c, 0])), N = 60;
      for (let k = 0; k < N; k++) {
        const d = mdShuffle(pool.slice()), hands = this.hands.map((h, o) => (o === s ? h.slice() : []));
        for (let o = 0; o < 4; o++) if (o !== s) hands[o] = d.splice(0, this.hands[o].length);
        for (const c of ms) {
          const w = Object.create(MADIAO);
          Object.assign(w, { rollout: true, hands: hands.map(h => h.slice()), trick: this.trick.map(t => ({ ...t })), won: this.won.map(a => a.map(x => ({ card: x.card, cards: x.cards.slice() }))), tricks: this.tricks.slice(), played: this.played.slice(), faceUp: this.faceUp.slice(), nTricks: this.nTricks, toMove: s, need: 'play', banker: this.banker, score: [0, 0, 0, 0], dealNo: 1, notes: [] });
          w.apply({ pl: 1, seat: s, kind: 'play', card: c });
          let guard = 0;
          while (w.nTricks < 8 && guard++ < 40) w.apply(w.aiPlan()[0]);
          const pay = w.payments().pay[s];
          tally.set(c, tally.get(c) + pay);
        }
      }
      return ms.reduce((a, b) => (tally.get(b) > tally.get(a) ? b : a));
    },
  };

