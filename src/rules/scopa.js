  /* ---------------------------------------------------------------- Scopa
   * A 40-card Italian pack, numbered as the other card tables number theirs (suit * 13 + rank, rank 0 the ace):
   * ace to seven are ranks 0-6, the fante (knave) 10, the cavallo (knight) 11 and the re (king) 12. The suits,
   * in pack order, are swords, cups, coins and batons, which line up with spades, hearts, diamonds and clubs.
   * Player 0 is the visitor. The player who does not deal plays first; the deal alternates. */
  const SC_RANKS = [0, 1, 2, 3, 4, 5, 6, 10, 11, 12];
  const SC_DECK = []; for (let su = 0; su < 4; su++) for (const rk of SC_RANKS) SC_DECK.push(su * 13 + rk);
  const scSuit = c => (c / 13) | 0, scRank = c => c % 13;
  const scVal = c => (scRank(c) <= 6 ? scRank(c) + 1 : scRank(c) - 2); // fante 8, cavallo 9, re 10
  const SC_PRIME = [16, 12, 13, 14, 15, 18, 21]; // ace to seven; every court card counts 10
  const scPrime = c => (scRank(c) <= 6 ? SC_PRIME[scRank(c)] : 10);
  const SC_SUIT = ['swords', 'cups', 'coins', 'batons'];
  const SC_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', '', '', '', 'knave', 'knight', 'king'];
  const SC_COIN = 2, SC_SETTEBELLO = SC_COIN * 13 + 6;
  const scName = c => `${SC_RANK[scRank(c)]} of ${SC_SUIT[scSuit(c)]}`;
  const scList = cs => (cs.length === 1 ? 'the ' + scName(cs[0]) : cs.slice(0, -1).map(c => 'the ' + scName(c)).join(', ') + ' and the ' + scName(cs[cs.length - 1]));
  function scSubsets(table, v) { // every set of two or more table cards adding up to v
    const out = [], n = table.length;
    for (let mask = 1; mask < 1 << n; mask++) {
      if ((mask & (mask - 1)) === 0) continue; // a single card is a match, not a sum
      let s = 0; const pick = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) { s += scVal(table[i]); pick.push(table[i]); if (s > v) break; }
      if (s === v) out.push(pick);
    }
    return out;
  }
  function scCaptures(table, c) { // what the card must take: a single card of its value if there is one, otherwise any set that adds up to it
    const v = scVal(c), single = table.filter(x => scVal(x) === v);
    return single.length ? single.map(x => [x]) : scSubsets(table, v);
  }
  function scPrimiera(pile) { // the best card of each suit, added up; nothing unless all four suits are there
    let t = 0;
    for (let su = 0; su < 4; su++) { const best = Math.max(0, ...pile.filter(c => scSuit(c) === su).map(scPrime)); if (!best) return 0; t += best; }
    return t;
  }
  const SCOPA = {
    id: 'scopa', name: 'Scopa', dice: false, first: 1, cardName: scName,
    variants: [{ id: '11', label: 'To 11' }, { id: '21', label: 'To 21' }], variant: '11', variantLabel: 'Game',
    setVariant(id) { this.variant = id === '21' ? '21' : '11'; },
    get target() { return +this.variant; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'A 40-card Italian pack: ace to seven in four suits (coins, cups, swords and batons), with the fante (knave) worth 8, the cavallo (knight) 9 and the re (king) 10. Each of you gets three cards and four go face up on the table.',
      'Play one card. If a table card has the same value, you must take it. If none does but two or more add up to your card\'s value, you take them instead (a single card always comes first). If you take nothing, your card stays on the table. You may always choose which card to play.',
      'Clearing the table is a scopa, a point at once. The last play of the hand never counts as a scopa. When both hands are empty, three more cards each are dealt until the pack runs out; then whatever is left on the table goes to whoever took last.',
      'After each hand: a point for most cards, a point for most coins, a point for the settebello (the seven of coins), and a point for the primiera, the better set of one card from each suit (sevens 21, sixes 18, aces 16, fives 15, fours 14, threes 13, twos 12, court cards 10). Ties score nothing. The first to 11 wins; if both get there in the same hand, the higher score wins.'
    ],
    source: 'Scopa for two players, after the rules at pagat.com. A deal with three or four kings on the table is dealt again, as there.',
    init() { this.total = [0, 0]; this.hands0 = 0; this.dealer = 0; this.over = null; this.decided = null; this.deal(); },
    shuffle() { const d = SC_DECK.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; } return d; },
    deal() {
      let d;
      do { d = this.shuffle(); } while (d.slice(6, 10).filter(c => scRank(c) === 12).length >= 3); // a table no sweep could ever clear is dealt again
      this.hands = [d.slice(0, 3), d.slice(3, 6)]; this.table = d.slice(6, 10); this.stock = d.slice(10);
      this.piles = [[], []]; this.scope = [0, 0]; this.sweeps = []; this.lastTaker = -1; this.hands0++;
      this.toMove = 1 - this.dealer; this.stage = 'play'; this.notes = []; this.score = [0, 0];
    },
    who(pl) { return pl === 0 ? 'You' : 'The Scribe'; },
    prompt0() {
      if (this.stage === 'next') return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next hand when you are ready.');
      return this.table.length ? 'Play a card: it takes a table card of the same value, or cards that add up to it.' : 'The table is empty: play a card to start it again.';
    },
    legal(pl) {
      if (this.over || pl !== this.toMove) return [];
      if (this.stage === 'next') return [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next hand' }];
      const out = [];
      for (const c of this.hands[pl]) {
        const caps = scCaptures(this.table, c);
        // A card that can take in more than one way is offered as a choice for each way, by name.
        if (caps.length > 1) for (const take of caps) out.push({ pl, kind: 'play', c, take, label: `Take ${scList(take)} with the ${scName(c)}` });
        else if (caps.length) out.push({ pl, kind: 'play', c, take: caps[0] });
        else out.push({ pl, kind: 'play', c, take: [] });
      }
      return out;
    },
    apply(m) {
      const pl = m.pl;
      if (m.kind === 'next') {
        if (this.decided) { this.over = this.decided; return { note: '' }; }
        this.dealer = 1 - this.dealer; this.deal();
        return { note: this.toMove === 0 ? 'The Scribe deals. You play first.' : 'You deal. The Scribe plays first.', events: [{ type: 'deal' }] };
      }
      const h = this.hands[pl]; h.splice(h.indexOf(m.c), 1);
      const events = [], Y = pl === 0; let note;
      if (m.take.length) {
        for (const x of m.take) this.table.splice(this.table.indexOf(x), 1);
        this.piles[pl].push(m.c, ...m.take); this.lastTaker = pl;
        const last = !this.stock.length && !this.hands[0].length && !this.hands[1].length;
        const sweep = !this.table.length && !last;
        if (sweep) { this.scope[pl]++; this.sweeps.push(m.c); }
        events.push({ type: 'take', pl, c: m.c, take: m.take.slice(), sweep });
        note = `${this.who(pl)} ${Y ? 'take' : 'takes'} ${scList(m.take)} with the ${scName(m.c)}.${sweep ? ' Scopa!' : ''}`;
      } else {
        this.table.push(m.c); events.push({ type: 'lay', pl, c: m.c });
        note = `${this.who(pl)} ${Y ? 'lay' : 'lays'} the ${scName(m.c)} on the table.`;
      }
      this.toMove = 1 - pl;
      if (!this.hands[0].length && !this.hands[1].length) {
        if (this.stock.length) {
          const first = 1 - this.dealer; // the non-dealer is dealt first and plays first again
          this.hands[first] = this.stock.splice(0, 3); this.hands[1 - first] = this.stock.splice(0, 3); this.toMove = first;
          events.push({ type: 'deal3' });
        } else note += ' ' + this.endHand(events);
      }
      return { note, events };
    },
    endHand(events) {
      const notes = [];
      if (this.table.length && this.lastTaker >= 0) {
        notes.push(`The last ${this.table.length === 1 ? 'card goes' : this.table.length + ' cards go'} to ${this.lastTaker ? 'the Scribe' : 'you'}, who took last.`);
        events.push({ type: 'sweepUp', pl: this.lastTaker, cards: this.table.slice() });
        this.piles[this.lastTaker].push(...this.table); this.table = [];
      }
      const pts = [this.scope[0], this.scope[1]], p = this.piles, best = (a, b, what) => { if (a === b) { notes.push(`${what}: tied, no point.`); return; } const w = a > b ? 0 : 1; pts[w]++; notes.push(`${what}: ${w ? 'the Scribe' : 'you'}, ${Math.max(a, b)} to ${Math.min(a, b)}.`); };
      if (this.scope[0] || this.scope[1]) notes.push(`Scope: you ${this.scope[0]}, the Scribe ${this.scope[1]}.`);
      best(p[0].length, p[1].length, 'Most cards');
      best(p[0].filter(c => scSuit(c) === SC_COIN).length, p[1].filter(c => scSuit(c) === SC_COIN).length, 'Most coins');
      const sb = p[0].includes(SC_SETTEBELLO) ? 0 : 1; pts[sb]++; notes.push(`The settebello: ${sb ? 'the Scribe' : 'you'}.`);
      best(scPrimiera(p[0]), scPrimiera(p[1]), 'Primiera');
      this.score = pts; this.total[0] += pts[0]; this.total[1] += pts[1];
      notes.push(`This hand: you ${pts[0]}, the Scribe ${pts[1]}. Game: you ${this.total[0]}, the Scribe ${this.total[1]}.`);
      const [a, b] = this.total;
      if (Math.max(a, b) >= this.target && a !== b) {
        const w = a > b ? 0 : 1;
        this.decided = { winner: w, title: w ? 'The Scribe wins at Scopa' : 'You win at Scopa', text: `${Math.max(a, b)} points to ${Math.min(a, b)} after ${this.hands0} hand${this.hands0 > 1 ? 's' : ''}.` };
      } else if (a === b && a >= this.target) notes.push('Level at the target: another hand.');
      this.notes = notes; this.stage = 'next'; this.toMove = 0;
      return notes.join(' ');
    },
    passTurn() { return this.over ? 0 : this.toMove; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return null; },
    // The Scribe weighs what a play takes against what it leaves the other player: a table it could sweep, or a seven.
    worth(cs) { return cs.length + cs.filter(c => scSuit(c) === SC_COIN).length * 1.2 + (cs.includes(SC_SETTEBELLO) ? 12 : 0) + cs.filter(c => scRank(c) === 6).length * 3 + cs.filter(c => scRank(c) === 5).length * 1.5 + cs.filter(c => scRank(c) === 0).length; },
    aiPlan(pl) {
      if (this.stage === 'next') return [{ pl, kind: 'next' }];
      const moves = this.legal(pl);
      if (moves.length === 1) return moves;
      if (LEVEL.name === 'gentle' && Math.random() < 0.4) { const takes = moves.filter(m => m.take.length); const pool = takes.length && Math.random() < 0.7 ? takes : moves; return [pool[(Math.random() * pool.length) | 0]]; }
      const opp = 1 - pl, oppN = this.hands[opp].length;
      // Cards the Scribe cannot see. Fair forgets what has been taken; Sharp counts every card gone.
      const seen = new Set(this.hands[pl].concat(this.table, LEVEL.name === 'sharp' ? this.piles[0].concat(this.piles[1]) : []));
      const unseen = SC_DECK.filter(c => !seen.has(c)), U = Math.max(1, unseen.length);
      const chance = v => { const k = unseen.filter(c => scVal(c) === v).length; return 1 - Math.pow(1 - k / U, Math.max(1, oppN)); };
      const last = !this.stock.length && this.hands[0].length + this.hands[1].length <= 2;
      const noise = pick(3, 1.2, 0.2);
      let best = moves[0], bv = -Infinity;
      for (const m of moves) {
        let v = 0;
        const left = m.take.length ? this.table.filter(x => !m.take.includes(x)) : this.table.concat(m.c);
        if (m.take.length) { v += this.worth([m.c, ...m.take]); if (!left.length && !last) v += 10; }
        else v -= this.worth([m.c]) * 0.8;
        if (left.length && oppN > 0) {
          const sum = left.reduce((t, c) => t + scVal(c), 0);
          if (sum <= 10) v -= chance(sum) * 10; // the other player could sweep it
          const seven = left.filter(c => scRank(c) === 6);
          for (const s of seven) v -= chance(7) * (s === SC_SETTEBELLO ? 12 : 3);
        }
        v += Math.random() * noise;
        if (v > bv) { bv = v; best = m; }
      }
      return [best];
    },
  };

