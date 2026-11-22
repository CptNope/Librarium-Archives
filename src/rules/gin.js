  /* -------------------------------------------------------------- Gin Rummy
   * The two-handed rummy of 1909 New York. You (0) against the Scribe (1), with a French pack numbered
   * suit * 13 + rank (rank 0 the ace, low here; king 12). Spades, hearts, diamonds, clubs. */
  const GN_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const GN_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
  const gnSuit = c => (c / 13) | 0, gnRank = c => c % 13, gnVal = c => Math.min(10, gnRank(c) + 1);
  const gnName = c => `${GN_RANK[gnRank(c)]} of ${GN_SUIT[gnSuit(c)]}`;
  const gnShuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Every meld a hand holds: sets of three or four of a rank, and runs of three or more in a suit.
  function gnMelds(hand) {
    const out = [], has = new Set(hand);
    for (let r = 0; r < 13; r++) {
      const cs = hand.filter(c => gnRank(c) === r);
      if (cs.length >= 3) { out.push(cs.slice()); if (cs.length === 4) for (let k = 0; k < 4; k++) out.push(cs.filter((_, i) => i !== k)); }
    }
    for (let s = 0; s < 4; s++) for (let a = 0; a < 11; a++) {
      let b = a; while (b < 13 && has.has(s * 13 + b)) { if (b - a >= 2) { const run = []; for (let k = a; k <= b; k++) run.push(s * 13 + k); out.push(run); } b++; }
    }
    return out;
  }
  // The arrangement of melds that leaves the least deadwood.
  function gnBest(hand) {
    const melds = gnMelds(hand), total = hand.reduce((t, c) => t + gnVal(c), 0);
    let best = { melds: [], dead: total }, seen = 0;
    const go = (start, used, chosen, saved) => {
      if (++seen > 20000) return;
      if (total - saved < best.dead) best = { melds: chosen.slice(), dead: total - saved };
      for (let i = start; i < melds.length; i++) {
        const m = melds[i]; if (m.some(c => used.has(c))) continue;
        m.forEach(c => used.add(c)); chosen.push(m);
        go(i + 1, used, chosen, saved + m.reduce((t, c) => t + gnVal(c), 0));
        chosen.pop(); m.forEach(c => used.delete(c));
      }
    };
    go(0, new Set(), [], 0);
    const inMeld = new Set(best.melds.flat());
    return { melds: best.melds, dead: best.dead, deadwood: hand.filter(c => !inMeld.has(c)) };
  }
  // Can card c go onto meld m (a set short of four, or either end of a run)?
  function gnFits(c, m) {
    if (m.includes(c)) return false;
    if (new Set(m.map(gnRank)).size === 1) return m.length < 4 && gnRank(c) === gnRank(m[0]);
    if (gnSuit(c) !== gnSuit(m[0])) return false;
    const rs = m.map(gnRank), lo = Math.min(...rs), hi = Math.max(...rs);
    return gnRank(c) === lo - 1 || gnRank(c) === hi + 1;
  }
  const GIN = {
    id: 'gin', name: 'Gin Rummy', dice: false, cardName: gnName, SUITS: GN_SUIT, best: gnBest, melds: gnMelds, value: gnVal,
    get first() { return this.toMove === undefined ? 0 : this.toMove; },
    variants: [{ id: '100', label: 'To 100' }, { id: '50', label: 'To 50' }], variant: '100', variantLabel: 'Game',
    setVariant(id) { this.variant = id === '50' ? '50' : '100'; },
    get limit() { return +this.variant; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'Ten cards each. The next card is turned up to start the discard pile; the rest are the stock. Melds are sets of three or four of a rank, and runs of three or more in one suit (aces low). Cards outside your melds are deadwood: aces 1, courts 10, the rest as numbered.',
      'On the first turn the player who did not deal may take the turned-up card or pass; then the dealer may. If both pass, the first player draws from the stock.',
      'Each turn, draw the top card of the stock or of the discard pile (click it), then discard a card (click it). You may not throw back a card you just took from the pile.',
      'When your deadwood after discarding is 10 or less, you may knock: press Knock, then click the card to discard face down. Melds are laid out, and the other player lays off deadwood on your melds. You score the difference in deadwood; with none at all, you are gin, score 25 more, and nothing may be laid off. If the other player\'s deadwood is as low or lower, they undercut you and score the difference and 25.',
      'If only two cards are left in the stock and nobody has knocked, the hand is void. The first to 100 (or 50) wins the game and scores 100 more, and each side scores 25 for every hand it won.'
    ],
    source: 'Gin rummy as Wikipedia describes the standard game, with its gin and undercut bonuses of 25, the box bonus of 25 a hand and the game bonus of 100; pagat.com for the play.',
    init() { this.score = [0, 0]; this.boxes = [0, 0]; this.dealer = 1; this.handNo = 0; this.over = null; this.decided = null; this.notes = []; this.deal(); },
    deal() {
      const d = gnShuffle(Array.from({ length: 52 }, (_, i) => i));
      this.dealer = 1 - this.dealer; this.handNo++;
      const first = 1 - this.dealer;
      this.hands = [[], []]; for (let k = 0; k < 10; k++) { this.hands[first].push(d.pop()); this.hands[this.dealer].push(d.pop()); }
      this.pile = [d.pop()]; this.stock = d;
      this.stage = 'upcard'; this.passes = 0; this.toMove = first; this.taken = null; this.knocking = false;
      this.seen = [[], []]; // the cards each player is known to have taken from the pile
      this.show = null; this.notes = [];
      this.sort(0); this.sort(1);
    },
    sort(p) { const h = this.hands[p]; h.sort((a, b) => gnSuit(a) - gnSuit(b) || gnRank(a) - gnRank(b)); },
    who(p) { return p === 0 ? 'You' : 'The Scribe'; },
    canKnock(p, c) { const h = this.hands[p].filter(x => x !== c); return gnBest(h).dead <= 10; },
    prompt0(p = 0) { // p: the player reading it (online, either seat)
      const up = this.pile[this.pile.length - 1];
      if (this.stage === 'next') return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next hand when you are ready.');
      if (this.stage === 'upcard') return `The ${gnName(up)} is turned up. Take it (click it), or pass.`;
      if (this.stage === 'draw') return `Draw from the stock or take the ${gnName(up)}: click one.`;
      if (this.knocking) return 'Click the card to discard face down and knock.';
      const h = this.hands[p], d = Math.min(...h.filter(c => c !== this.taken).map(c => gnBest(h.filter(x => x !== c)).dead));
      return `Discard a card: click it. Your best discard leaves ${d} in deadwood${d <= 10 ? ', low enough to knock' : ' (10 or less to knock)'}.`;
    },
    legal(pl) {
      if (this.over) return [];
      if (this.stage === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next hand' }] : [];
      if ((this.toMove === 0) !== (pl === 0)) return [];
      const p = this.toMove;
      if (this.stage === 'upcard') return [{ pl, kind: 'take' }, { pl, kind: 'pass', label: 'Pass' }];
      if (this.stage === 'draw') return [{ pl, kind: 'draw' }, { pl, kind: 'take' }];
      const h = this.hands[p], ok = h.filter(c => c !== this.taken);
      const out = [];
      if (this.knocking) { ok.filter(c => this.canKnock(p, c)).forEach(card => out.push({ pl, kind: 'knock', card })); out.push({ pl, kind: 'unknock', label: 'Don\'t knock' }); return out; }
      ok.forEach(card => out.push({ pl, kind: 'discard', card }));
      if (ok.some(c => this.canKnock(p, c))) out.push({ pl, kind: 'knockmode', label: ok.some(c => gnBest(h.filter(x => x !== c)).dead === 0) ? 'Knock (gin!)' : 'Knock' });
      return out;
    },
    apply(m) {
      const events = [];
      if (m.kind === 'next') { if (this.decided) { this.over = this.decided; return { note: '' }; } this.deal(); return { note: `Hand ${this.handNo}. ${this.dealer ? 'The Scribe deals' : 'You deal'}; the ${gnName(this.pile[0])} is turned up.`, events: [{ type: 'deal' }] }; }
      const p = this.toMove;
      if (m.kind === 'knockmode') { this.knocking = true; return { note: '', events }; }
      if (m.kind === 'unknock') { this.knocking = false; return { note: '', events }; }
      if (m.kind === 'pass') {
        this.passes++;
        if (this.passes === 1) { this.toMove = 1 - p; return { note: `${this.who(p)} ${p ? 'passes' : 'pass'} on the ${gnName(this.pile[this.pile.length - 1])}.`, events }; }
        // Both passed: the first player draws from the stock.
        this.toMove = 1 - p; this.stage = 'draw';
        return this.apply({ pl: this.toMove, kind: 'draw', why: 'both passed' });
      }
      if (m.kind === 'take' || m.kind === 'draw') {
        const fromPile = m.kind === 'take', c = fromPile ? this.pile.pop() : this.stock.pop();
        this.hands[p].push(c); this.sort(p); this.taken = fromPile ? c : null;
        if (fromPile) this.seen[p].push(c);
        this.stage = 'discard'; this.knocking = false;
        events.push({ type: 'draw', seat: p, card: c, fromPile });
        const note = fromPile ? `${this.who(p)} ${p ? 'takes' : 'take'} the ${gnName(c)}.` : `${m.why ? 'Both passed. ' : ''}${this.who(p)} ${p ? 'draws' : 'draw'} from the stock${p ? '' : `: the ${gnName(c)}`}.`;
        // publicNote: what the other player is told (online), without the card drawn blind.
        return { note, publicNote: fromPile ? note : `${m.why ? 'Both passed. ' : ''}${this.who(p)} ${p ? 'draws' : 'draw'} from the stock.`, events };
      }
      // A discard, or a knock.
      const c = m.card, h = this.hands[p]; h.splice(h.indexOf(c), 1);
      if (m.kind === 'knock') { this.knocked = c; events.push({ type: 'knock', seat: p, card: c }); return this.showdown(p, events); }
      this.pile.push(c); this.taken = null; this.knocking = false;
      // A player who threw back what the other took from the pile is not still collecting that rank.
      events.push({ type: 'discard', seat: p, card: c });
      if (this.stock.length <= 2) {
        this.notes = ['Only two cards are left in the stock: the hand is void, and the same dealer deals again.'];
        this.dealer = 1 - this.dealer; this.handNo--; this.stage = 'next'; this.toMove = 0;
        events.push({ type: 'void' });
        return { note: `${this.who(p)} ${p ? 'discards' : 'discard'} the ${gnName(c)}. ` + this.notes[0], events };
      }
      this.toMove = 1 - p; this.stage = 'draw';
      return { note: `${this.who(p)} ${p ? 'discards' : 'discard'} the ${gnName(c)}.`, events };
    },
    showdown(k, events) {
      const d = 1 - k, K = gnBest(this.hands[k]), D = gnBest(this.hands[d]), gin = K.dead === 0;
      // The defender lays off deadwood on the knocker's melds, until nothing more fits.
      const melds = K.melds.map(m => m.slice()); let dw = D.deadwood.slice(), laid = [];
      if (!gin) {
        let moved = true;
        while (moved) { moved = false; for (const c of dw) { const m = melds.find(mm => gnFits(c, mm)); if (m) { m.push(c); laid.push(c); dw = dw.filter(x => x !== c); moved = true; break; } } }
      }
      const kd = K.dead, dd = dw.reduce((t, c) => t + gnVal(c), 0);
      let w, pts, how;
      if (gin) { w = k; pts = dd + 25; how = `${this.who(k)} ${k ? 'goes' : 'go'} gin: ${dd} in deadwood and 25 for gin.`; }
      else if (dd <= kd) { w = d; pts = kd - dd + 25; how = `${this.who(d)} ${d ? 'undercuts' : 'undercut'}: ${dd} against ${kd}, and 25.`; }
      else { w = k; pts = dd - kd; how = `${this.who(k)} ${k ? 'knocks' : 'knock'} with ${kd}; ${this.who(d).toLowerCase()} ${d ? 'has' : 'have'} ${dd} after laying off.`; }
      this.score[w] += pts; this.boxes[w]++;
      this.show = { knocker: k, melds: [K.melds, D.melds], deadwood: [K.deadwood, D.deadwood], laid, gin };
      events.push({ type: 'show', knocker: k });
      const notes = [how, `${w ? 'The Scribe scores' : 'You score'} ${pts}.`, `Scores: you ${this.score[0]}, the Scribe ${this.score[1]}.`];
      if (laid.length) notes.splice(1, 0, `Laid off: the ${laid.map(gnName).join(', the ')}.`);
      if (this.score[w] >= this.limit) {
        const total = [0, 1].map(p => this.score[p] + 25 * this.boxes[p] + (p === w ? 100 : 0));
        this.decided = { winner: w === 0 ? 0 : 1, title: w ? 'The Scribe wins' : 'You win', text: `${w ? 'The Scribe reaches' : 'You reach'} ${this.score[w]}. With 100 for the game and 25 for each hand won: you ${total[0]}, the Scribe ${total[1]}.` };
      }
      this.notes = notes; this.stage = 'next'; this.toMove = 0;
      return { note: notes.join(' '), events };
    },
    passTurn() { if (this.over) return 0; return this.stage === 'next' ? 0 : this.toMove; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* The Scribe takes the turned-up or discarded card when it fits a meld or nearly does, and otherwise draws
     * blind. It throws the card that leaves the least deadwood, the highest when that ties, and avoids feeding
     * you: a card next to one you took from the pile, or of a rank you took, keeping pairs and near-runs. It knocks
     * as soon as it can. Sharp plays as Fair: a one-draw look-ahead, and searches that played whole hands out,
     * were tried and played no better. */
    useful(p, c) { const h = this.hands[p]; const before = gnBest(h).dead, after = Math.min(...h.map(x => gnBest(h.concat(c).filter(y => y !== x)).dead)); return before - after; },
    danger(p, c) {
      let d = 0;
      for (const t of this.seen[1 - p]) { if (gnRank(t) === gnRank(c)) d += 3; if (gnSuit(t) === gnSuit(c) && Math.abs(gnRank(t) - gnRank(c)) <= 2) d += 2; }
      return d;
    },
    discardScore(p, c) {
      const left = this.hands[p].filter(x => x !== c), b = gnBest(left);
      // Cards that could still make melds are worth keeping: a near-run or a pair.
      let near = 0; for (const x of b.deadwood) for (const y of b.deadwood) if (x < y && ((gnRank(x) === gnRank(y)) || (gnSuit(x) === gnSuit(y) && Math.abs(gnRank(x) - gnRank(y)) <= 2))) near++;
      return b.dead - near * 1.5 + this.danger(p, c) - gnVal(c) * 0.05;
    },
    discardChoice(p) {
      const ok = this.hands[p].filter(c => c !== this.taken);
      let best = null, bv = Infinity;
      for (const c of ok) { const v = this.discardScore(p, c); if (v < bv) { bv = v; best = c; } }
      return best;
    },
    aiPlan() {
      if (this.stage === 'next') return [{ pl: 0, kind: 'next' }];
      const p = this.toMove, up = this.pile[this.pile.length - 1], gentle = LEVEL.name === 'gentle' && !this.rollout;
      if (this.stage === 'upcard' || this.stage === 'draw') {
        const want = this.useful(p, up) >= (gentle ? 6 : 3) || gnBest(this.hands[p].concat(up)).melds.some(m => m.includes(up));
        if (this.stage === 'upcard') return [{ pl: p, kind: want ? 'take' : 'pass' }];
        return [{ pl: p, kind: want ? 'take' : 'draw' }];
      }
      const c = gentle && Math.random() < 0.15 ? this.hands[p].filter(x => x !== this.taken)[(Math.random() * (this.hands[p].length - 1)) | 0] : this.discardChoice(p);
      const after = gnBest(this.hands[p].filter(x => x !== c)).dead;
      if (after <= 10) return [{ pl: p, kind: 'knockmode' }, { pl: p, kind: 'knock', card: c }];
      return [{ pl: p, kind: 'discard', card: c }];
    },
  };

