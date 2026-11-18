  /* -------------------------------------------------------------------- Faro
   * The banking game of 18th-century Europe and the American West, "bucking the tiger". You punt against the
   * bank, played by the Scribe, which only deals. A full French pack in the dealing box, numbered suit * 13 +
   * rank (rank 0 the ace, low; king 12). The layout is a suit of spades, ace to king; bets are on ranks. */
  const FA_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
  const FA_SHORT = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const FA_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const faRank = c => c % 13, faName = c => `${FA_RANK[faRank(c)]} of ${FA_SUIT[(c / 13) | 0]}`;
  const FA_MAX = 10; // checks on one rank
  const FARO = {
    id: 'faro', name: 'Faro', dice: false, solo: true, first: 0, cardName: faName,
    RANKS: FA_RANK, SHORT: FA_SHORT, rank: faRank,
    get followPrompt() { return this.prompt0(); },
    rules: [
      'You punt against the bank, which deals from a box. You have 50 checks. The layout shows one suit, ace to king: click a card to put a check on that rank (up to ten). The case keeper beside the box shows how many of each rank are still to come.',
      'Deal a turn and the dealer draws two cards. The first is the bank\'s card: bets on its rank lose. The second is yours: bets on its rank win, paid even money. If both are the same rank, a split, the bank takes half the bets on it (at least one check).',
      'A coppered bet is reversed: it wins on the bank\'s card and loses on yours. Switch Copper on, then click a card, to copper the bet there. The high card bet wins if your card outranks the bank\'s.',
      'The first card out of the box, the soda, counts for nothing. Bets stay on the layout until they win or lose, and you may add to them or take them back between turns.',
      'When three cards are left, you may call the turn: guess the order of the bank\'s card, yours, and the last card (the hock). It pays four for one, or one for one when two of the three are a pair.',
      'The game ends when the box is empty. Finish with more than 50 checks and you have beaten the bank.'
    ],
    source: 'Faro as Wikipedia and pagat.com describe the American banking game: the layout, flat and coppered bets, splits, the high card bet and calling the turn. Splits between two ranks are left out.',
    init() {
      const d = Array.from({ length: 52 }, (_, i) => i);
      for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      this.box = d; this.out = []; this.left = Array(13).fill(4);
      this.checks = 50; this.bets = Array.from({ length: 13 }, () => ({ n: 0, copper: false })); this.high = 0;
      this.copper = false; this.turnNo = 0; this.last = null; this.over = null; this.called = null; this.won = 0; this.lost = 0;
      this.soda = this.box.shift(); this.out.push(this.soda); this.left[faRank(this.soda)]--;
      this.stage = 'bet'; this.toMove = 0; this.notes = [];
    },
    staked() { return this.bets.reduce((t, b) => t + b.n, 0) + this.high; },
    prompt0() {
      if (this.stage === 'turn') return `Three cards are left: ${this.callNames()}. Call the turn, or let it go.`;
      if (this.stage === 'done') return this.notes.join(' ') + ' Press See the result.';
      const left = this.box.length;
      return `${this.checks} checks in hand, ${this.staked()} on the layout. Click a rank to bet${this.copper ? ' (coppered)' : ''}, then deal. ${Math.floor((left - 1) / 2)} turns left.`;
    },
    callNames() { const ranks = [...new Set(this.box.map(faRank))]; return ranks.map(r => FA_RANK[r] + (this.box.filter(c => faRank(c) === r).length > 1 ? ` (${this.box.filter(c => faRank(c) === r).length})` : '')).join(', '); },
    // The orders a turn can be called in: distinct orders of the three ranks still in the box.
    calls() {
      const rs = this.box.map(faRank), out = new Set(), keys = [];
      for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) for (const c of [0, 1, 2]) {
        if (a === b || b === c || a === c) continue;
        const k = [rs[a], rs[b], rs[c]].join('-'); if (!out.has(k)) { out.add(k); keys.push([rs[a], rs[b], rs[c]]); }
      }
      return keys;
    },
    legal(pl) {
      if (this.over || pl !== 0) return [];
      if (this.stage === 'done') return [{ pl, kind: 'end', label: 'See the result' }];
      if (this.stage === 'turn') {
        const out = [];
        if (this.checks > 0 && new Set(this.box.map(faRank)).size > 1) for (const k of this.calls()) out.push({ pl, kind: 'call', order: k, label: `Call ${k.map(r => FA_SHORT[r]).join(', ')}` });
        out.push({ pl, kind: 'deal', label: this.called ? 'Deal the turn' : 'Let it go: deal' });
        return out;
      }
      const out = [];
      for (let r = 0; r < 13; r++) if (this.left[r] > 0 && this.checks > 0 && this.bets[r].n < FA_MAX) out.push({ pl, kind: 'bet', rank: r });
      out.push({ pl, kind: 'copper', label: this.copper ? 'Copper: on' : 'Copper: off' });
      if (this.checks > 0 && this.high < FA_MAX) out.push({ pl, kind: 'high', label: `High card (${this.high})` });
      if (this.staked()) out.push({ pl, kind: 'clear', label: 'Take bets back' });
      out.push({ pl, kind: 'deal', label: 'Deal a turn' });
      return out;
    },
    apply(m) {
      const events = [];
      if (m.kind === 'end') { this.over = this.result0(); return { note: '' }; }
      if (m.kind === 'copper') { this.copper = !this.copper; return { note: this.copper ? 'Copper on: the bets you place now are coppered.' : 'Copper off.', events }; }
      if (m.kind === 'bet') {
        const b = this.bets[m.rank];
        if (b.n && b.copper !== this.copper) { b.copper = this.copper; events.push({ type: 'bets' }); return { note: `The bet on the ${FA_RANK[m.rank]} is ${b.copper ? 'coppered' : 'open again'}.`, events }; }
        b.n++; b.copper = this.copper; this.checks--; events.push({ type: 'bets' });
        return { note: '', events };
      }
      if (m.kind === 'high') { this.high++; this.checks--; events.push({ type: 'bets' }); return { note: '', events }; }
      if (m.kind === 'clear') { this.checks += this.staked(); this.bets.forEach(b => { b.n = 0; b.copper = false; }); this.high = 0; events.push({ type: 'bets' }); return { note: 'You take your bets back.', events }; }
      if (m.kind === 'call') { this.called = m.order; this.checks--; events.push({ type: 'bets' }); return { note: `You call the turn: ${m.order.map(r => FA_RANK[r]).join(', ')}.`, events }; }
      // The deal: two cards, the bank's then yours.
      const notes = [];
      if (this.stage === 'bet' && this.box.length === 3) { this.stage = 'turn'; this.called = null; return { note: 'Three cards are left: the turn.', events: [{ type: 'turnup' }] }; }
      const L = this.box.shift(), W = this.box.shift(), lr = faRank(L), wr = faRank(W);
      this.out.push(L, W); this.left[lr]--; this.left[wr]--; this.turnNo++;
      events.push({ type: 'draw', lose: L, win: W });
      let gain = 0;
      const settle = (r, n) => { if (!n) return; gain += n; };
      if (lr === wr) {
        const b = this.bets[lr];
        if (b.n) { const take = Math.max(1, Math.floor(b.n / 2)); b.n -= take; this.lost += take; notes.push(`A split in ${FA_RANK[lr]}s: the bank takes ${take} of your ${take + b.n}.`); settle(lr, -take); events.push({ type: 'lose', rank: lr, n: take }); }
        else notes.push(`A split in ${FA_RANK[lr]}s.`);
      } else {
        for (const [r, banks] of [[lr, true], [wr, false]]) {
          const b = this.bets[r]; if (!b.n) continue;
          const wins = banks === b.copper; // a coppered bet wins on the bank's card
          if (wins) { this.checks += b.n * 2; this.won += b.n; notes.push(`Your ${b.copper ? 'coppered ' : ''}bet on the ${FA_RANK[r]} wins ${b.n}.`); events.push({ type: 'win', rank: r, n: b.n }); }
          else { this.lost += b.n; notes.push(`Your ${b.copper ? 'coppered ' : ''}bet on the ${FA_RANK[r]} loses ${b.n}.`); events.push({ type: 'lose', rank: r, n: b.n }); }
          b.n = 0; b.copper = false;
        }
      }
      if (this.high) {
        if (wr > lr) { this.checks += this.high * 2; this.won += this.high; notes.push(`High card wins ${this.high}.`); events.push({ type: 'win', rank: 'high', n: this.high }); this.high = 0; }
        else if (wr < lr) { this.lost += this.high; notes.push(`High card loses ${this.high}.`); events.push({ type: 'lose', rank: 'high', n: this.high }); this.high = 0; }
      }
      // Dead ranks: bets on a rank with no card left come back.
      this.bets.forEach((b, r) => { if (b.n && !this.left[r]) { this.checks += b.n; b.n = 0; b.copper = false; } });
      let head = `The bank's card: the ${faName(L)}. Yours: the ${faName(W)}.`;
      if (this.stage === 'turn') {
        const hock = this.box.shift(); this.out.push(hock); this.left[faRank(hock)]--;
        head += ` The hock: the ${faName(hock)}.`; events.push({ type: 'hock', card: hock });
        if (this.called) {
          const got = [lr, wr, faRank(hock)].join('-') === this.called.join('-'), cat = new Set([lr, wr, faRank(hock)]).size < 3, pay = cat ? 1 : 4;
          if (got) { this.checks += 1 + pay; this.won += pay; notes.push(`You called the turn right: paid ${pay} for one.`); }
          else { this.lost += 1; notes.push('Your call was wrong.'); }
        }
        // Whatever is still on the layout comes back.
        this.checks += this.staked(); this.bets.forEach(b => { b.n = 0; b.copper = false; }); this.high = 0;
        this.stage = 'done';
        this.notes = [`The box is empty. You finish with ${this.checks} checks.`];
        return { note: [head].concat(notes, this.notes).join(' '), events };
      }
      this.last = { lose: L, win: W };
      if (this.checks + this.staked() === 0) { this.stage = 'done'; this.notes = ['You have no checks left.']; return { note: [head].concat(notes, this.notes).join(' '), events }; }
      if (this.box.length === 3) { this.stage = 'turn'; this.called = null; notes.push('Three cards are left: the turn.'); events.push({ type: 'turnup' }); }
      return { note: [head].concat(notes).join(' '), events };
    },
    result0() {
      const c = this.checks;
      return c > 50 ? { winner: 0, title: 'You beat the bank', text: `You finish with ${c} checks, ${c - 50} up on the bank.` }
        : c < 50 ? { winner: 1, title: 'The bank wins', text: `You finish with ${c} checks, ${50 - c} down to the bank.` }
          : { winner: 2, title: 'Even with the bank', text: 'You finish with the 50 checks you started with.' };
    },
    passTurn() { return 0; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    // For the tests and the guide: a punter who puts a check on a rank with cards left, now and then, and deals.
    aiPlan() {
      const ms = this.legal(0);
      if (this.stage === 'done') return [ms[0]];
      if (this.stage === 'turn') return [ms[ms.length - 1]];
      const bets = ms.filter(m => m.kind === 'bet');
      if (bets.length && this.staked() < 3 && Math.random() < 0.6) { const live = bets.filter(m => this.left[m.rank] >= 2); return [(live.length ? live : bets)[(Math.random() * (live.length || bets.length)) | 0]]; }
      return [ms.find(m => m.kind === 'deal')];
    },
  };

