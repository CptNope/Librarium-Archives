  /* ----------------------------------------------------------------- Écarté
   * The 19th-century French game for two: five cards each from a 32-card pack, trumps turned up, and the
   * exchange that gives the game its name. You (0) against the Scribe (1). Cards are numbered suit * 13 + rank
   * as on every card table here; the pack keeps the sevens to tens, the aces and the courts. In play the king
   * ranks highest, then queen, jack, ace, ten, nine, eight, seven. */
  const EC_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const EC_RANK = ['ace', '', '', '', '', '', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
  const EC_RANKS = [6, 7, 8, 9, 0, 10, 11, 12]; // low to high
  const ecSuit = c => (c / 13) | 0, ecRank = c => c % 13, ecPow = c => EC_RANKS.indexOf(ecRank(c));
  const ecName = c => `${EC_RANK[ecRank(c)]} of ${EC_SUIT[ecSuit(c)]}`;
  const EC_PACK = [0, 1, 2, 3].flatMap(s => EC_RANKS.map(r => s * 13 + r));
  const ecShuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // The cards a player may play: follow suit and win the trick if you can; if you cannot follow, trump if you can.
  function ecLegal(hand, lead, trump) {
    if (lead === null) return hand.slice();
    const su = ecSuit(lead), follow = hand.filter(c => ecSuit(c) === su);
    if (follow.length) { const over = follow.filter(c => ecPow(c) > ecPow(lead)); return over.length ? over : follow; }
    const tr = hand.filter(c => ecSuit(c) === trump);
    return tr.length ? tr : hand.slice();
  }
  const ecWins = (a, b, trump) => (ecSuit(b) === ecSuit(a) ? ecPow(b) > ecPow(a) : ecSuit(b) === trump); // does b, played second, beat a?
  // Tricks the side to move can make from here with every card known, both playing their best.
  function ecSolve(h0, h1, toMove, lead, trump, me) {
    const key = new Map();
    const go = (a, b, mover, ld, leader) => {
      if (!a.length && ld === null) return 0;
      const k = a.join(',') + '|' + b.join(',') + '|' + mover + '|' + ld + '|' + leader; if (key.has(k)) return key.get(k);
      const hand = mover === me ? a : b, opts = ecLegal(hand, ld, trump);
      let best = mover === me ? -1 : 99;
      for (const c of opts) {
        const na = mover === me ? a.filter(x => x !== c) : a, nb = mover === me ? b : b.filter(x => x !== c);
        let v;
        if (ld === null) v = go(na, nb, 1 - mover, c, mover);
        else { const w = ecWins(ld, c, trump) ? mover : leader; v = (w === me ? 1 : 0) + go(na, nb, w, null, w); }
        if (mover === me ? v > best : v < best) best = v;
      }
      key.set(k, best); return best;
    };
    return go(me === toMove ? h0 : h0, h1, toMove, lead, lead === null ? toMove : 1 - toMove);
  }
  const ECARTE = {
    id: 'ecarte', name: 'Écarté', dice: false, cardName: ecName, SUITS: EC_SUIT, power: ecPow, legalCards: ecLegal,
    get first() { return this.toMove === undefined ? 0 : this.toMove; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'Five cards each from a pack of 32 (sevens to kings and the aces), and the next card turned up for trumps. In every suit the king is highest, then the queen, jack, ace, ten, nine, eight and seven. A turned-up king scores 1 for the dealer.',
      'Before play, the player who did not deal may propose an exchange, or play at once. If the dealer accepts, the proposer discards any number of cards and draws as many, then the dealer must exchange at least one; the proposer may then propose again. If the dealer refuses, play begins.',
      'Holding the king of trumps scores 1; it is announced for you before the first card.',
      'The non-dealer leads. You must follow suit if you can, and win the trick if you can; if you cannot follow, you must trump if you can. The winner leads the next trick.',
      'Three or four tricks score 1 point, all five (the vole) 2. If you played without proposing, or refused the first proposal, and then lose, the other player scores 2. The first to 5 points wins.'
    ],
    source: 'Écarté as Wikipedia gives the French game: the pack and its order, the turned king, the proposal and exchange, the duty to head the trick, the vole and the penalties for playing or refusing and losing.',
    init() { this.score = [0, 0]; this.dealer = 1; this.handNo = 0; this.over = null; this.decided = null; this.notes = []; this.deal(); },
    deal() {
      const d = ecShuffle(EC_PACK.slice());
      this.dealer = 1 - this.dealer; this.handNo++; this.elder = 1 - this.dealer;
      this.hands = [[], []];
      for (const n of [3, 2]) for (const p of [this.elder, this.dealer]) for (let k = 0; k < n; k++) this.hands[p].push(d.pop());
      this.turnUp = d.pop(); this.trump = ecSuit(this.turnUp); this.stock = d;
      this.discards = [[], []]; this.marked = []; this.proposals = 0; this.vulnerable = -1; this.exchanged = [0, 0];
      this.trick = []; this.tricks = [0, 0]; this.played = []; this.lastTrick = null; this.kingSaid = false; this.notes = [];
      this.sortAll();
      let note = '';
      if (ecRank(this.turnUp) === 12) { this.score[this.dealer]++; note = `The king of ${EC_SUIT[this.trump]} is turned up: 1 to ${this.dealer ? 'the Scribe' : 'you'}.`; }
      this.dealNote = note;
      this.stage = 'propose'; this.toMove = this.elder;
      this.checkWin();
    },
    sortAll() { for (const h of this.hands) h.sort((a, b) => ecSuit(a) - ecSuit(b) || ecPow(a) - ecPow(b)); },
    who(p) { return p === 0 ? 'You' : 'The Scribe'; },
    prompt0(p = 0) { // p: the player reading it (online, either seat)
      const T = EC_SUIT[this.trump];
      switch (this.stage) {
        case 'next': return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next deal when you are ready.');
        case 'propose': return `${T[0].toUpperCase() + T.slice(1)} are trumps. Propose an exchange, or play at once.`;
        case 'respond': return 'The Scribe proposes an exchange. Accept it, or refuse and play.';
        case 'exchange': return `Click the cards to discard (${this.toMove === this.dealer ? 'at least one' : 'one or more'}), then exchange them.${this.marked.length ? ` ${this.marked.length} marked.` : ''}`;
        default: {
          if (!this.trick.length) return `${T[0].toUpperCase() + T.slice(1)} are trumps. Lead any card.`;
          const lead = this.trick[0].card, ms = ecLegal(this.hands[p], lead, this.trump);
          return ecSuit(ms[0]) === ecSuit(lead) ? (ms.some(c => ecPow(c) > ecPow(lead)) ? 'Follow suit, and win the trick: you must if you can.' : 'Follow suit.') : ecSuit(ms[0]) === this.trump ? 'You cannot follow: you must trump.' : 'You can neither follow nor trump: play any card.';
        }
      }
    },
    legal(pl) {
      if (this.over) return [];
      if (this.stage === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next deal' }] : [];
      if ((this.toMove === 0) !== (pl === 0)) return [];
      const p = this.toMove;
      if (this.stage === 'propose') { const out = [{ pl, kind: 'play', label: 'Play' }]; if (this.stock.length >= 2) out.unshift({ pl, kind: 'propose', label: 'Propose an exchange' }); return out; }
      if (this.stage === 'respond') return [{ pl, kind: 'accept', label: 'Accept' }, { pl, kind: 'refuse', label: 'Refuse: play' }];
      if (this.stage === 'exchange') {
        const max = Math.min(5, this.stock.length - (p === this.elder ? 1 : 0)); // leave the dealer at least one card to take
        const out = this.hands[p].filter(c => this.marked.includes(c) || this.marked.length < max).map(card => ({ pl, kind: 'mark', card }));
        if (this.marked.length) out.push({ pl, kind: 'exchange', cards: this.marked.slice(), label: `Exchange ${this.marked.length === 1 ? 'one card' : this.marked.length + ' cards'}` });
        return out;
      }
      return ecLegal(this.hands[p], this.trick.length ? this.trick[0].card : null, this.trump).map(card => ({ pl, kind: 'card', card }));
    },
    startPlay(events) {
      this.stage = 'play'; this.toMove = this.elder;
      const k = this.trump * 13 + 12, holder = this.hands[0].includes(k) ? 0 : this.hands[1].includes(k) ? 1 : -1;
      let note = '';
      if (holder >= 0) { this.score[holder]++; this.kingSaid = holder; note = ` ${holder ? 'The Scribe announces' : 'You announce'} the king of trumps: 1 point.`; events.push({ type: 'king', seat: holder }); }
      this.checkWin();
      return note;
    },
    checkWin() {
      const w = this.score[0] >= 5 ? 0 : this.score[1] >= 5 ? 1 : -1;
      if (w < 0) return false;
      this.decided = { winner: w, title: w ? 'The Scribe wins' : 'You win', text: `The game ends ${this.score[0]} to ${this.score[1]}, after ${this.handNo} deal${this.handNo > 1 ? 's' : ''}.` };
      this.notes = [`${w ? 'The Scribe reaches' : 'You reach'} 5.`]; this.stage = 'next'; this.toMove = 0;
      return true;
    },
    apply(m) {
      const events = [];
      if (m.kind === 'next') { if (this.decided) { this.over = this.decided; return { note: '' }; } this.deal(); return { note: `${this.dealer ? 'The Scribe deals' : 'You deal'}; the ${ecName(this.turnUp)} is turned up. ${this.dealNote}`.trim(), events: [{ type: 'deal' }] }; }
      const p = this.toMove;
      if (m.kind === 'propose') { this.proposals++; this.stage = 'respond'; this.toMove = this.dealer; return { note: `${this.who(p)} ${p ? 'proposes' : 'propose'} an exchange.`, events }; }
      if (m.kind === 'play') {
        if (this.proposals === 0) this.vulnerable = p;
        const note = `${this.who(p)} ${p ? 'plays' : 'play'}${this.proposals === 0 ? ' without proposing' : ''}.` + this.startPlay(events);
        return { note, events };
      }
      if (m.kind === 'refuse') {
        if (this.proposals === 1) this.vulnerable = p;
        return { note: `${this.who(p)} ${p ? 'refuses' : 'refuse'}.` + this.startPlay(events), events };
      }
      if (m.kind === 'accept') { this.stage = 'exchange'; this.toMove = this.elder; this.marked = []; return { note: `${this.who(p)} ${p ? 'accepts' : 'accept'}.`, events }; }
      if (m.kind === 'mark') { const i = this.marked.indexOf(m.card); if (i >= 0) this.marked.splice(i, 1); else this.marked.push(m.card); return { note: '', events: [{ type: 'mark' }] }; }
      if (m.kind === 'exchange') {
        const h = this.hands[p], out = m.cards.slice();
        out.forEach(c => { h.splice(h.indexOf(c), 1); this.discards[p].push(c); });
        const got = out.map(() => this.stock.pop()); h.push(...got); this.sortAll(); this.marked = []; this.exchanged[p] += out.length;
        events.push({ type: 'exchange', seat: p, out, got });
        const note = p ? `The Scribe discards ${out.length} and draws ${out.length}.` : `You discard ${out.length} and draw the ${got.map(ecName).join(', the ')}.`;
        const pub = `${this.who(p)} ${p ? 'discards' : 'discard'} ${out.length} and ${p ? 'draws' : 'draw'} ${out.length}.`; // for the other player, online
        if (p === this.elder) { this.toMove = this.dealer; return { note, publicNote: pub, events }; }
        this.stage = 'propose'; this.toMove = this.elder;
        if (this.stock.length < 2) { const more = ' The stock is spent.' + this.startPlay(events); return { note: note + more, publicNote: pub + more, events }; }
        return { note, publicNote: pub, events };
      }
      // A card played.
      const c = m.card, h = this.hands[p]; h.splice(h.indexOf(c), 1);
      this.trick.push({ seat: p, card: c }); this.played.push(c);
      events.push({ type: 'play', seat: p, card: c });
      if (this.trick.length < 2) { this.toMove = 1 - p; return { note: '', events }; }
      const [a, b] = this.trick, w = ecWins(a.card, b.card, this.trump) ? b.seat : a.seat;
      this.tricks[w]++; this.lastTrick = { cards: [a.card, b.card], winner: w }; this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      let note = `${this.who(w)} ${w ? 'takes' : 'take'} the trick.`;
      if (!this.hands[0].length) note += ' ' + this.endDeal();
      return { note, events };
    },
    endDeal() {
      const w = this.tricks[0] >= 3 ? 0 : 1, l = 1 - w, vole = this.tricks[w] === 5;
      const pts = this.vulnerable === l ? 2 : vole ? 2 : 1;
      this.score[w] += pts;
      const why = this.vulnerable === l ? (l === this.elder ? ` ${l ? 'The Scribe' : 'You'} played without proposing, and lost.` : ` ${l ? 'The Scribe' : 'You'} refused the proposal, and lost.`) : vole ? ' The vole!' : '';
      const notes = [`${this.who(w)} ${w ? 'takes' : 'take'} ${this.tricks[w]} tricks: ${pts} point${pts > 1 ? 's' : ''}.${why}`, `Score: you ${this.score[0]}, the Scribe ${this.score[1]}.`];
      this.notes = notes; this.stage = 'next'; this.toMove = 0;
      this.checkWin(); if (this.decided) this.notes = notes;
      return notes.join(' ');
    },
    passTurn() { if (this.over) return 0; return this.stage === 'next' ? 0 : this.toMove; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* The Scribe counts its hand: trumps by rank, side kings, and queens guarded by another card of their suit. It
     * plays without proposing, or refuses, when that count promises three tricks; in an exchange it keeps trumps
     * and kings and throws the rest. In play the rules leave few choices: it leads its best trump when long in
     * them, otherwise its strongest side card, and follows as cheaply as the rules allow. Sharp deals your hand
     * at random many times, plays each deal out perfectly from both sides, and plays the card (or makes the
     * choice) that wins most often. */
    strength(h) {
      const T = this.trump; let v = 0;
      for (const c of h) {
        if (ecSuit(c) === T) v += [0.45, 0.5, 0.55, 0.6, 0.7, 0.8, 0.95, 1.1][ecPow(c)];
        else if (ecRank(c) === 12) v += 0.75;
        else if (ecRank(c) === 11 && h.some(x => x !== c && ecSuit(x) === ecSuit(c))) v += 0.35;
      }
      return v;
    },
    unseen(p) { const known = new Set(this.hands[p].concat(this.discards[p], this.played, [this.turnUp])); return EC_PACK.filter(c => !known.has(c)); },
    // Sharp: how often the hand as it stands wins the point, against random hands for the other player.
    chance(p, n = 60) {
      const pool = this.unseen(p); let wins = 0;
      for (let k = 0; k < n; k++) {
        const opp = ecShuffle(pool.slice()).slice(0, this.hands[1 - p].length);
        const mine = ecSolve(this.hands[p], opp, this.elder === p ? 0 : 1, null, this.trump, 0);
        if (mine >= 3) wins++;
      }
      return wins / n;
    },
    aiPlan() {
      if (this.stage === 'next') return [{ pl: 0, kind: 'next' }];
      const p = this.toMove, h = this.hands[p], sharp = LEVEL.name === 'sharp' && !this.rollout, gentle = LEVEL.name === 'gentle' && !this.rollout;
      const go = kind => [{ pl: p, kind }];
      if (this.stage === 'propose') {
        if (this.stock.length < 2) return go('play');
        const s = sharp ? this.chance(p) : this.strength(h) / 3.2;
        return go(s >= (gentle ? 0.9 : sharp ? 0.6 : 0.82) ? 'play' : 'propose');
      }
      if (this.stage === 'respond') {
        const s = sharp ? this.chance(p) : this.strength(h) / 3.2;
        return go(s >= (gentle ? 0.95 : sharp ? 0.62 : 0.85) ? 'refuse' : 'accept');
      }
      if (this.stage === 'exchange') {
        const T = this.trump, max = Math.min(5, this.stock.length - (p === this.elder ? 1 : 0));
        let out = h.filter(c => ecSuit(c) !== T && ecRank(c) !== 12);
        if (!out.length) out = [h.reduce((a, b) => (ecSuit(b) !== T && ecSuit(a) === T ? b : ecSuit(a) === ecSuit(b) || (ecSuit(a) !== T && ecSuit(b) !== T) ? (ecPow(b) < ecPow(a) ? b : a) : a))];
        out = out.slice(0, Math.max(1, max));
        return out.map(card => ({ pl: p, kind: 'mark', card })).concat([{ pl: p, kind: 'exchange', cards: out }]);
      }
      const lead = this.trick.length ? this.trick[0].card : null, ms = ecLegal(h, lead, this.trump), mv = c => [{ pl: p, kind: 'card', card: c }];
      if (ms.length === 1) return mv(ms[0]);
      if (gentle && Math.random() < 0.35) return mv(ms[(Math.random() * ms.length) | 0]);
      if (sharp) {
        const pool = this.unseen(p), tally = new Map(ms.map(c => [c, 0]));
        for (let k = 0; k < 40; k++) {
          const opp = ecShuffle(pool.slice()).slice(0, this.hands[1 - p].length);
          for (const c of ms) {
            const a = h.filter(x => x !== c);
            let v;
            if (lead === null) v = ecSolve(a, opp, 1, c, this.trump, 0); // the other must answer c
            else { const w = ecWins(lead, c, this.trump); v = (w ? 1 : 0) + ecSolve(a, opp, w ? 0 : 1, null, this.trump, 0); }
            const total = this.tricks[p] + v;
            tally.set(c, tally.get(c) + (total >= 3 ? 10 : 0) + (total === 5 ? 5 : 0) + v * 0.1);
          }
        }
        return mv(ms.reduce((a, b) => (tally.get(b) > tally.get(a) ? b : a)));
      }
      if (lead === null) {
        const T = this.trump, tr = ms.filter(c => ecSuit(c) === T);
        if (tr.length >= 3 || tr.some(c => ecRank(c) === 12)) return mv(tr.reduce((a, b) => (ecPow(b) > ecPow(a) ? b : a)));
        const kings = ms.filter(c => ecRank(c) === 12); if (kings.length) return mv(kings[0]);
        const side = ms.filter(c => ecSuit(c) !== T);
        return mv((side.length ? side : ms).reduce((a, b) => (ecPow(b) > ecPow(a) ? b : a)));
      }
      return mv(ms.reduce((a, b) => (ecPow(b) < ecPow(a) ? b : a)));
    },
  };

