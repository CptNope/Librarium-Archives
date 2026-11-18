  /* -------------------------------------------------------------- Pope Joan
   * The 18th-century English round game on its staking board of eight compartments. Four players (0 you, South;
   * 1 West; 2 North; 3 East) and a dead hand (4) nobody plays from; play goes to the left. A French pack without
   * the eight of diamonds, numbered suit * 13 + rank (rank 0 the ace, which is low here; king 12 highest).
   * Spades, hearts, diamonds, clubs. The nine of diamonds is the Pope. */
  const PJ_SEAT = ['You', 'West', 'North', 'East'];
  const PJ_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const PJ_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
  const pjSuit = c => (c / 13) | 0, pjRank = c => c % 13;
  const PJ_POPE = 2 * 13 + 8, PJ_GONE = 2 * 13 + 7; // the nine of diamonds; the eight of diamonds, taken out
  const pjName = c => (c === PJ_POPE ? 'nine of diamonds, the Pope' : `${PJ_RANK[pjRank(c)]} of ${PJ_SUIT[pjSuit(c)]}`);
  // The board's compartments, in the order they are painted round it, and what the dealer puts on each.
  const PJ_BOX = ['pope', 'matrimony', 'intrigue', 'ace', 'king', 'queen', 'jack', 'game'];
  const PJ_BOX_NAME = { pope: 'Pope', matrimony: 'Matrimony', intrigue: 'Intrigue', ace: 'Ace', king: 'King', queen: 'Queen', jack: 'Jack', game: 'Game' };
  const PJ_DRESS = { pope: 6, matrimony: 2, intrigue: 2, ace: 1, king: 1, queen: 1, jack: 1, game: 1 };
  const PJ_HONOUR = { 0: 'ace', 12: 'king', 11: 'queen', 10: 'jack' };
  const pjShuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const POPEJOAN = {
    id: 'popejoan', name: 'Pope Joan', dice: false, cardName: pjName,
    SEATS: PJ_SEAT, SUITS: PJ_SUIT, BOX: PJ_BOX, BOX_NAME: PJ_BOX_NAME, POPE: PJ_POPE,
    get first() { return this.toMove === undefined || this.toMove === 0 ? 0 : 1; },
    variants: [{ id: '4', label: 'Four deals' }, { id: '8', label: 'Eight deals' }], variant: '4', variantLabel: 'Game',
    setVariant(id) { this.variant = id === '8' ? '8' : '4'; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'Four players with 30 counters each, and a board of eight compartments. Each dealer dresses the board: six counters on Pope, two each on Matrimony and Intrigue, one each on Ace, King, Queen, Jack and Game. Counters not won stay for the next deal.',
      'The pack has no eight of diamonds. Ten cards each, ten to a dead hand that nobody plays, and the last card turned up for trumps. If it is the ace, king, queen or jack of trumps, or the nine of diamonds (the Pope), the dealer takes that compartment at once.',
      'The player left of the dealer leads the lowest card they hold of any suit they choose. Whoever holds the next card up in that suit plays it, and so on, aces low, kings high. The run stops at a king, or when the next card is in the dead hand or out of the pack (the seven of diamonds always stops, since there is no eight). Whoever played the last card leads again, the lowest card of any suit. Here the cards that follow are played for you.',
      'Play the ace, king, queen or jack of trumps and take that compartment; play the Pope and take Pope. Play both the queen and jack of trumps for Intrigue, both the king and queen for Matrimony.',
      'The first to play their last card takes Game, and a counter from each other player for every card they still hold; whoever still holds the Pope pays nothing.',
      'After four deals (or eight), whoever has most counters wins.'
    ],
    source: 'Pope Joan as David Parlett gives it from the Victorian sources, with Wikipedia\'s account of the deal and the turn-up. The hall deals ten to each player and ten and the turn-up to the dead hand.',
    init() { this.purse = [30, 30, 30, 30]; this.board = Object.fromEntries(PJ_BOX.map(b => [b, 0])); this.dealNo = 0; this.dealer = 3; this.over = null; this.decided = null; this.notes = []; this.deal(); },
    get limit() { return +this.variant; },
    deal() {
      this.dealer = (this.dealer + 1) % 4; this.dealNo++;
      const d = pjShuffle(Array.from({ length: 52 }, (_, i) => i).filter(c => c !== PJ_GONE));
      this.hands = [0, 1, 2, 3, 4].map(k => d.slice(k * 10, k * 10 + 10));
      this.turnUp = d[50]; this.hands[4].push(this.turnUp); this.trump = pjSuit(this.turnUp);
      this.played = []; this.playedBy = []; this.honours = {}; this.claimed = []; this.notes = []; this.run = [];
      this.dressed = {};
      for (const b of PJ_BOX) { const a = Math.min(PJ_DRESS[b], this.purse[this.dealer]); this.purse[this.dealer] -= a; this.board[b] += a; this.dressed[b] = a; }
      this.sortAll();
      const r = pjRank(this.turnUp), won = this.turnUp === PJ_POPE ? 'pope' : PJ_HONOUR[r];
      this.turnNote = '';
      if (won) { const n = this.take(this.dealer, won); this.turnNote = `The ${pjName(this.turnUp)} is turned up: ${this.dealer ? PJ_SEAT[this.dealer] + ' takes' : 'you take'} ${PJ_BOX_NAME[won]} (${n}).`; }
      this.need = 'lead'; this.toMove = (this.dealer + 1) % 4;
    },
    sortAll() { this.hands.forEach(h => h.sort((a, b) => a - b)); },
    who(s) { return s === 0 ? 'You' : PJ_SEAT[s]; },
    take(s, box) { const n = this.board[box]; this.purse[s] += n; this.board[box] = 0; this.claimed.push({ seat: s, box, n }); return n; },
    holder(c) { for (let k = 0; k < 5; k++) if (this.hands[k].includes(c)) return k; return -1; },
    leads(s) { // the lowest card of each suit the player holds
      const out = []; for (let su = 0; su < 4; su++) { const cs = this.hands[s].filter(c => pjSuit(c) === su); if (cs.length) out.push(Math.min(...cs)); }
      return out;
    },
    prompt0() {
      if (this.need === 'next') return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next deal when you are ready.');
      return `${PJ_SUIT[this.trump][0].toUpperCase() + PJ_SUIT[this.trump].slice(1)} are trumps. Lead the lowest card of any suit: click it.`;
    },
    legal(pl) {
      if (this.over) return [];
      if (this.need === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next deal' }] : [];
      const s = this.toMove; if ((s === 0) !== (pl === 0)) return [];
      return this.leads(s).map(card => ({ pl, seat: s, kind: 'lead', card }));
    },
    // Play one card from a hand, and take what it wins.
    playCard(s, c, events, notes) {
      const h = this.hands[s]; h.splice(h.indexOf(c), 1); this.played.push(c); if (this.playedBy) this.playedBy.push({ seat: s, card: c });
      events.push({ type: 'play', seat: s, card: c });
      const r = pjRank(c);
      const wins = [];
      if (c === PJ_POPE) wins.push('pope');
      if (pjSuit(c) === this.trump && PJ_HONOUR[r]) {
        wins.push(PJ_HONOUR[r]); this.honours[PJ_HONOUR[r]] = s;
        const H = this.honours;
        if ((r === 11 || r === 10) && H.queen === s && H.jack === s) wins.push('intrigue');
        if ((r === 12 || r === 11) && H.king === s && H.queen === s) wins.push('matrimony');
      }
      for (const b of wins) { const n = this.take(s, b); events.push({ type: 'win', seat: s, box: b, n }); notes.push(`${this.who(s)} ${s ? 'takes' : 'take'} ${PJ_BOX_NAME[b]}${n ? ` (${n})` : ', which is empty'}.`); }
    },
    apply(m) {
      if (m.kind === 'next') {
        if (this.decided) { this.over = this.decided; return { note: '' }; }
        this.deal();
        return { note: `Deal ${this.dealNo}. ${this.dealer ? PJ_SEAT[this.dealer] + ' deals' : 'You deal'} and dresses the board; ${PJ_SUIT[this.trump]} are trumps. ${this.turnNote}`.trim(), events: [{ type: 'deal' }] };
      }
      const events = [], notes = [];
      let s = m.seat, c = m.card;
      this.run = [];
      this.playCard(s, c, events, notes); this.run.push({ seat: s, card: c });
      // The run goes on while someone at the table holds the next card up.
      while (this.hands[s].length) {
        const nx = c + 1, su = pjSuit(c);
        if (pjRank(c) === 12 || nx === PJ_GONE || pjSuit(nx) !== su) break;
        const k = this.holder(nx);
        if (k < 0 || k === 4) break;
        s = k; c = nx; this.playCard(s, c, events, notes); this.run.push({ seat: s, card: c });
      }
      events.push({ type: 'stop', seat: s, card: c });
      const why = pjRank(c) === 12 ? 'a king' : c + 1 === PJ_GONE ? 'there is no eight of diamonds' : 'the next card is in the dead hand';
      let note = `${this.who(m.seat)} ${m.seat ? 'leads' : 'lead'} the ${pjName(m.card)}${this.run.length > 1 ? `, and the run goes to the ${pjName(c)}` : ''}${this.hands[s].length ? `: stop, ${why}` : ''}.`;
      if (notes.length) note += ' ' + notes.join(' ');
      if (!this.hands[s].length) { note += ' ' + this.endDeal(s, events); return { note, events }; }
      this.toMove = s;
      note += ` ${this.who(s)} ${s ? 'leads' : 'lead'} next.`;
      return { note, events };
    },
    endDeal(w, events) {
      const n0 = this.take(w, 'game'); let got = 0; const lines = [];
      for (let s = 0; s < 4; s++) {
        if (s === w) continue;
        if (this.hands[s].includes(PJ_POPE)) { lines.push(`${this.who(s)} ${s ? 'holds' : 'hold'} the Pope and ${s ? 'pays' : 'pay'} nothing.`); continue; }
        const n = Math.min(this.hands[s].length, this.purse[s]); this.purse[s] -= n; this.purse[w] += n; got += n;
      }
      events.push({ type: 'out', seat: w, n: got + n0 });
      const notes = [`${this.who(w)} ${w ? 'is' : 'are'} out of cards and ${w ? 'takes' : 'take'} Game (${n0}), and ${got} for the cards still held.`].concat(lines);
      const left = PJ_BOX.filter(b => this.board[b]).map(b => `${PJ_BOX_NAME[b]} ${this.board[b]}`);
      if (left.length) notes.push(`Left on the board: ${left.join(', ')}.`);
      notes.push(`Counters: you ${this.purse[0]}, West ${this.purse[1]}, North ${this.purse[2]}, East ${this.purse[3]}.`);
      if (this.dealNo >= this.limit) {
        const hi = Math.max(...this.purse), top = [0, 1, 2, 3].filter(s => this.purse[s] === hi);
        const text = `Final counters: you ${this.purse[0]}, West ${this.purse[1]}, North ${this.purse[2]}, East ${this.purse[3]}.`;
        this.decided = top.length > 1 ? (top.includes(0) ? { winner: 2, title: 'A shared win', text } : { winner: 1, title: `${top.map(s => PJ_SEAT[s]).join(' and ')} share the win`, text })
          : { winner: top[0] === 0 ? 0 : 1, title: top[0] === 0 ? 'You win' : `${PJ_SEAT[top[0]]} wins`, text };
      }
      this.notes = notes; this.need = 'next'; this.toMove = 0;
      return notes.join(' ');
    },
    passTurn() { if (this.over) return 0; this.seat = this.toMove; return this.seat === 0 ? 0 : 1; },
    get scribeName() { return PJ_SEAT[this.seat] || 'The Scribe'; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* The only choice is which suit to lead. The Scribe leads the suit that lets it play the most cards in a
     * row, above all one that runs up to its own king (so it keeps the lead) or through the honours it holds,
     * and it saves the Pope for a run of diamonds. Sharp deals the unseen cards (the other hands and the dead
     * hand) many times and plays the deal out from each choice, to see which wins it most counters. */
    choose(s, ms) {
      const h = this.hands[s], seen = new Set(this.played.concat(h));
      const score = c => {
        let n = 0, x = c, tops = 0;
        while (h.includes(x)) { n++; if (x === PJ_POPE || (pjSuit(x) === this.trump && PJ_HONOUR[pjRank(x)])) tops += 3; if (pjRank(x) === 12 || x + 1 === PJ_GONE) { tops += 2; break; } x++; }
        const nx = x; // the first card after the run: where it might go
        if (pjSuit(nx) === pjSuit(c) && pjRank(nx) <= 12 && !seen.has(nx) && nx !== PJ_GONE) tops -= 0.5;
        return n + tops + Math.random() * 0.3;
      };
      return ms.reduce((a, b) => (score(b) > score(a) ? b : a));
    },
    aiPlan() {
      if (this.need === 'next') return [{ pl: 0, kind: 'next' }];
      const s = this.toMove, ms = this.leads(s), mv = card => [{ pl: 1, seat: s, kind: 'lead', card }];
      if (ms.length === 1) return mv(ms[0]);
      if (LEVEL.name === 'gentle' && !this.rollout && Math.random() < 0.5) return mv(ms[(Math.random() * ms.length) | 0]);
      if (LEVEL.name === 'sharp' && !this.rollout) return mv(this.sample(s, ms));
      return mv(this.choose(s, ms));
    },
    sample(s, ms) {
      const known = new Set(this.hands[s].concat(this.played, [this.turnUp]));
      const pool = Array.from({ length: 52 }, (_, i) => i).filter(c => c !== PJ_GONE && !known.has(c));
      const tally = new Map(ms.map(c => [c, 0])), N = 40;
      for (let k = 0; k < N; k++) {
        const d = pjShuffle(pool.slice()), hands = this.hands.map((h, o) => (o === s ? h.slice() : []));
        for (let o = 0; o < 5; o++) if (o !== s) { const need = this.hands[o].length - (o === 4 ? 1 : 0); hands[o] = d.splice(0, need); if (o === 4) hands[o].push(this.turnUp); }
        for (const c of ms) {
          const w = Object.create(POPEJOAN);
          Object.assign(w, { rollout: true, hands: hands.map(h => h.slice()), played: this.played.slice(), honours: { ...this.honours }, claimed: [], board: { ...this.board }, purse: this.purse.slice(), trump: this.trump, turnUp: this.turnUp, toMove: s, need: 'lead', dealNo: 1, variant: '8', notes: [], run: [] });
          const before = w.purse[s];
          w.apply({ pl: 1, seat: s, kind: 'lead', card: c });
          let guard = 0;
          while (w.need === 'lead' && guard++ < 60) w.apply(w.aiPlan()[0]);
          tally.set(c, tally.get(c) + w.purse[s] - before);
        }
      }
      return ms.reduce((a, b) => (tally.get(b) > tally.get(a) ? b : a));
    },
  };

