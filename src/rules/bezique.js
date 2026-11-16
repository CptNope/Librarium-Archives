  /* --------------------------------------------------------------- Bézique
   * Two piquet packs, 64 cards, each with its own id 0-63: id & 31 is the card (suit * 8 + power), id >> 5 the
   * pack it came from. Power runs seven, eight, nine, jack, queen, king, ten, ace (0-7). Suits are spades,
   * hearts, diamonds, clubs. bzFace turns an id into the number the other card tables use (suit * 13 + rank,
   * rank 0 the ace), so the same faces are drawn. Player 0 is the visitor; the non-dealer leads first. */
  const BZ_POW = ['seven', 'eight', 'nine', 'jack', 'queen', 'king', 'ten', 'ace'];
  const BZ_POWS = ['sevens', 'eights', 'nines', 'jacks', 'queens', 'kings', 'tens', 'aces'];
  const BZ_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const BZ_FACE_RANK = [6, 7, 8, 10, 11, 12, 9, 0];
  const bzSuit = b => (b & 31) >> 3, bzPow = b => b & 7;
  const bzFace = b => bzSuit(b) * 13 + BZ_FACE_RANK[bzPow(b)];
  const bzName = b => `${BZ_POW[bzPow(b)]} of ${BZ_SUIT[bzSuit(b)]}`;
  const BZ_J = 3, BZ_Q = 4, BZ_K = 5, BZ_T = 6, BZ_A = 7, BZ_7 = 0;
  const bzBrisque = b => bzPow(b) >= BZ_T;
  const isBzQS = b => bzSuit(b) === 0 && bzPow(b) === BZ_Q, isBzJD = b => bzSuit(b) === 2 && bzPow(b) === BZ_J;
  const BZ_FOUR = { [BZ_A]: 100, [BZ_K]: 80, [BZ_Q]: 60, [BZ_J]: 40 };
  const BEZIQUE = {
    id: 'bezique', name: 'Bézique', dice: false, first: 1, cardName: bzName, face: bzFace,
    variants: [{ id: '1000', label: 'To 1,000' }, { id: 'deal', label: 'One deal' }], variant: '1000', variantLabel: 'Game',
    setVariant(id) { this.variant = id === 'deal' ? 'deal' : '1000'; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'Two 32-card packs shuffled together, 64 cards. Cards rank ace, ten, king, queen, jack, nine, eight, seven. Each of you gets eight; the next card is turned up for trumps and the rest are the stock. If the turn-up is a seven, the dealer scores 10.',
      'While the stock lasts you need not follow suit. The higher card of the suit led wins, a trump beats any other suit, and of two identical cards the first played wins. The winner may then meld once, and draws first; the loser draws next.',
      'Melds are laid face up and can still be played to tricks. Bézique (queen of spades and jack of diamonds) 40, double bézique 500. Marriage (king and queen of a suit) 20, in trumps 40. Sequence (ace, ten, king, queen, jack of trumps) 250. Four aces 100, four kings 80, four queens 60, four jacks 40. A card may be used again in another kind of meld but not the same kind, and every meld needs at least one card from your hand. The seven of trumps can be swapped for the turn-up, or shown, for 10.',
      'When the stock is gone (the loser of that trick takes the turn-up), melds return to the hand and the last eight tricks are played strictly: follow suit and win the trick if you can; if you cannot follow, trump if you can.',
      'At the end of the deal each ace and ten you took in tricks (a brisque) scores 10, and the last trick 10. The first to 1,000 at the end of a deal wins.'
    ],
    source: 'Two-handed Bézique as played in England from the 1860s, after pagat.com. One meld after each trick won; melds are chosen from a list rather than laid out by hand.',
    init() { this.total = [0, 0]; this.deals = 0; this.dealer = 0; this.over = null; this.decided = null; this.deal(); },
    deal() {
      const d = Array.from({ length: 64 }, (_, i) => i);
      for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      const leader = 1 - this.dealer;
      this.hands = [[], []]; this.hands[leader] = d.slice(0, 8); this.hands[this.dealer] = d.slice(8, 16);
      this.turnUp = d[16]; this.trump = bzSuit(this.turnUp); this.stock = d.slice(17);
      this.melds = [[], []]; this.used = {}; this.won = [[], []]; this.score = [0, 0]; this.trick = []; this.lastTrick = null;
      this.closed = false; this.stage = 'play'; this.toMove = leader; this.played = []; this.notes = []; this.deals++; this.log = [];
      if (bzPow(this.turnUp) === BZ_7) { this.score[this.dealer] += 10; this.dixNote = `The turn-up is the seven of ${BZ_SUIT[this.trump]}: 10 to ${this.dealer ? 'the Scribe' : 'you'}.`; }
      else this.dixNote = '';
    },
    sortHand(pl) { const t = this.trump; this.hands[pl].sort((a, b) => ((bzSuit(a) === t) - (bzSuit(b) === t)) || bzSuit(a) - bzSuit(b) || bzPow(a) - bzPow(b) || a - b); },
    who(pl) { return pl === 0 ? 'You' : 'The Scribe'; },
    get limit() { return this.variant === 'deal' ? 0 : 1000; },
    prompt0() {
      if (this.stage === 'next') return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next deal when you are ready.');
      if (this.stage === 'meld') return 'You won the trick. Choose a meld to score, or none.';
      const t = BZ_SUIT[this.trump];
      if (this.closed) return this.trick.length ? `Follow suit and beat the card if you can; if you have none of its suit, trump (${t}) if you can.` : `The stock is gone: lead a card. Trumps are ${t}.`;
      return this.trick.length ? `Play any card: the higher of its suit wins, or a trump. Trumps are ${t}.` : `Lead a card. Trumps are ${t}.`;
    },
    // Every card a player can play from: the hand and, while the stock lasts, the melds on the table.
    holding(pl) { return this.hands[pl].concat(this.melds[pl]); },
    legalCards(pl) {
      const all = this.holding(pl);
      if (!this.closed || !this.trick.length) return all;
      const lead = this.trick[0].c, su = bzSuit(lead), follow = all.filter(b => bzSuit(b) === su);
      if (follow.length) { const beat = follow.filter(b => bzPow(b) > bzPow(lead)); return beat.length ? beat : follow; }
      const trumps = all.filter(b => bzSuit(b) === this.trump);
      return trumps.length ? trumps : all;
    },
    usedIn(b, kind) { return (this.used[b] || []).includes(kind); },
    // The melds a player could make now, each with the cards it uses: one of every kind and suit that is open.
    meldOptions(pl) {
      if (this.closed) return [];
      const hand = this.hands[pl], table = this.melds[pl], all = hand.concat(table), out = [], t = this.trump;
      // Pick one card for each need, preferring cards already on the table, so long as one comes from the hand.
      const choose = (needs, kind, extra) => {
        const opts = needs.map(f => all.filter(b => f(b) && !this.usedIn(b, kind) && (!extra || extra(b))));
        if (opts.some(o => !o.length)) return null;
        const pickT = opts.map(o => o.find(b => table.includes(b)) ?? o[0]);
        if (new Set(pickT).size < pickT.length) { // two needs met by one card: only the doubles (four of a kind, double bézique) can do that
          const seen = new Set(), res = [];
          for (const o of opts) { const b = o.find(x => !seen.has(x)); if (b === undefined) return null; seen.add(b); res.push(b); }
          return res.some(b => hand.includes(b)) ? res : null;
        }
        if (pickT.some(b => hand.includes(b))) return pickT;
        for (let i = 0; i < opts.length; i++) { const h = opts[i].find(b => hand.includes(b) && !pickT.includes(b)); if (h !== undefined) { const r = pickT.slice(); r[i] = h; return r; } }
        return null;
      };
      const is = (su, pw) => b => bzSuit(b) === su && bzPow(b) === pw;
      const seq = choose([BZ_A, BZ_T, BZ_K, BZ_Q, BZ_J].map(pw => is(t, pw)), 'sequence');
      if (seq) out.push({ kind: 'meld', type: 'sequence', cards: seq, pts: 250, label: `Sequence in ${BZ_SUIT[t]} (250)` });
      for (let su = 0; su < 4; su++) {
        const mar = choose([is(su, BZ_K), is(su, BZ_Q)], 'marriage', b => !this.usedIn(b, 'sequence'));
        if (mar) out.push({ kind: 'meld', type: 'marriage', cards: mar, pts: su === t ? 40 : 20, label: `${su === t ? 'Royal marriage' : 'Marriage'} in ${BZ_SUIT[su]} (${su === t ? 40 : 20})` });
      }
      for (const pw of [BZ_A, BZ_K, BZ_Q, BZ_J]) {
        const pool = all.filter(b => bzPow(b) === pw && !this.usedIn(b, 'four'));
        if (pool.length < 4) continue;
        const pickF = pool.filter(b => table.includes(b)).concat(pool.filter(b => hand.includes(b))).slice(0, 4);
        const four = pickF.some(b => hand.includes(b)) ? pickF : pickF.slice(0, 3).concat(pool.find(b => hand.includes(b)) ?? []);
        if (four.length === 4 && four.some(b => hand.includes(b))) out.push({ kind: 'meld', type: 'four', cards: four, pts: BZ_FOUR[pw], label: `Four ${BZ_POWS[pw]} (${BZ_FOUR[pw]})` });
      }
      const qs = all.filter(b => isBzQS(b)), jd = all.filter(b => isBzJD(b));
      if (qs.length === 2 && jd.length === 2 && ![...qs, ...jd].some(b => this.usedIn(b, 'double')) && [...qs, ...jd].some(b => hand.includes(b))) out.push({ kind: 'meld', type: 'double', cards: [...qs, ...jd], pts: 500, label: 'Double bézique (500)' });
      const bez = choose([isBzQS, isBzJD], 'bezique');
      if (bez) out.push({ kind: 'meld', type: 'bezique', cards: bez, pts: 40, label: 'Bézique (40)' });
      const dix = hand.find(b => bzSuit(b) === t && bzPow(b) === BZ_7 && !this.usedIn(b, 'dix'));
      if (dix !== undefined) {
        const swap = this.stock.length && this.turnUp !== null && bzPow(this.turnUp) !== BZ_7;
        out.push({ kind: 'meld', type: 'dix', cards: [dix], pts: 10, swap: !!swap, label: swap ? `Swap the seven of trumps for the ${bzName(this.turnUp)} (10)` : 'Show the seven of trumps (10)' });
      }
      return out.sort((a, b) => b.pts - a.pts);
    },
    legal(pl) {
      if (this.over || pl !== this.toMove) return [];
      if (this.stage === 'next') return [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next deal' }];
      if (this.stage === 'meld') return this.meldOptions(pl).map(m => Object.assign({ pl }, m)).concat([{ pl, kind: 'meld', type: 'none', cards: [], pts: 0, label: 'No meld' }]);
      return this.legalCards(pl).map(c => ({ pl, kind: 'play', c }));
    },
    // Drawing after a trick: the winner first. The last card of the stock goes to the winner and the turn-up to the loser.
    draw(w, events) {
      if (this.closed || !this.stock.length) return '';
      const a = this.stock.shift(); let b;
      if (this.stock.length) b = this.stock.shift(); else { b = this.turnUp; this.turnUp = null; }
      this.hands[w].push(a); this.hands[1 - w].push(b);
      events.push({ type: 'draw', cards: [[w, a], [1 - w, b]] });
      if (!this.stock.length && this.turnUp === null) { // the close: melds go back to the hand, and play turns strict
        this.closed = true;
        for (const pl of [0, 1]) { this.hands[pl].push(...this.melds[pl]); this.melds[pl] = []; }
        events.push({ type: 'close' });
        this.sortHand(0); this.sortHand(1);
        return ' The stock is gone: melds go back to the hand, and now you must follow suit and win if you can.';
      }
      this.sortHand(0); this.sortHand(1);
      return '';
    },
    apply(m) {
      const pl = m.pl, Y = pl === 0;
      if (m.kind === 'next') {
        if (this.decided) { this.over = this.decided; return { note: '' }; }
        this.dealer = 1 - this.dealer; this.deal(); this.sortHand(0); this.sortHand(1);
        return { note: (this.toMove === 0 ? 'The Scribe deals. You lead.' : 'You deal. The Scribe leads.') + (this.dixNote ? ' ' + this.dixNote : ''), events: [{ type: 'deal' }] };
      }
      if (m.kind === 'meld') {
        const events = []; let note = '';
        if (m.type !== 'none') {
          for (const b of m.cards) {
            (this.used[b] = this.used[b] || []).push(m.type);
            if (m.type !== 'dix' && this.hands[pl].includes(b)) { this.hands[pl].splice(this.hands[pl].indexOf(b), 1); this.melds[pl].push(b); }
          }
          if (m.type === 'dix' && m.swap) { const h = this.hands[pl], i = h.indexOf(m.cards[0]); h[i] = this.turnUp; this.turnUp = m.cards[0]; events.push({ type: 'swap', pl, got: h[i], gave: m.cards[0] }); }
          this.score[pl] += m.pts;
          events.push({ type: 'meld', pl, cards: m.cards.slice(), meld: m.type });
          const what = { sequence: `a sequence in ${BZ_SUIT[this.trump]}`, double: 'double bézique', bezique: 'bézique', four: m.label.replace(/ \(\d+\)$/, '').toLowerCase(), marriage: 'a ' + m.label.replace(/ \(\d+\)$/, '').toLowerCase() }[m.type];
          note = m.type === 'dix' ? `${this.who(pl)} ${m.swap ? (Y ? 'swap' : 'swaps') + ' the seven of trumps for the turn-up' : (Y ? 'show' : 'shows') + ' the seven of trumps'}: 10.` : `${this.who(pl)} ${Y ? 'meld' : 'melds'} ${what}: ${m.pts}.`;
          this.log.push([pl, m.label]);
        }
        this.sortHand(pl);
        note += this.draw(pl, events);
        this.stage = 'play'; this.toMove = pl;
        return { note: note.trim(), events };
      }
      // A card played to a trick, from the hand or from the melds on the table.
      const fromMeld = this.melds[pl].includes(m.c), src = fromMeld ? this.melds[pl] : this.hands[pl];
      src.splice(src.indexOf(m.c), 1); this.played.push(m.c);
      const events = [{ type: 'play', pl, c: m.c, fromMeld }];
      if (!this.trick.length) { this.trick.push({ pl, c: m.c }); this.toMove = 1 - pl; return { note: '', events }; }
      const lead = this.trick[0]; this.trick.push({ pl, c: m.c });
      const beats = (bzSuit(m.c) === bzSuit(lead.c) && bzPow(m.c) > bzPow(lead.c)) || (bzSuit(m.c) === this.trump && bzSuit(lead.c) !== this.trump);
      const w = beats ? pl : lead.pl;
      const cards = this.trick.map(t => t.c);
      this.won[w].push(...cards); this.lastTrick = { cards, winner: w }; this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      const br = cards.filter(bzBrisque).length;
      let note = `${this.who(w)} ${w ? 'takes' : 'take'} the trick${br ? ` (${br === 1 ? 'a brisque' : 'two brisques'})` : ''}.`;
      if (!this.holding(0).length && !this.holding(1).length) { note += ' ' + this.endDeal(w); return { note, events }; }
      if (!this.closed && this.meldOptions(w).length) { this.stage = 'meld'; return { note, events }; }
      note += this.draw(w, events);
      return { note, events };
    },
    endDeal(last) {
      const notes = [];
      this.score[last] += 10; notes.push(`10 to ${last ? 'the Scribe' : 'you'} for the last trick.`);
      const b = this.won.map(cs => cs.filter(bzBrisque).length);
      this.score[0] += b[0] * 10; this.score[1] += b[1] * 10;
      notes.push(`Brisques: you ${b[0]}, the Scribe ${b[1]}.`);
      this.total[0] += this.score[0]; this.total[1] += this.score[1];
      notes.push(`This deal: you ${this.score[0]}, the Scribe ${this.score[1]}.` + (this.variant === 'deal' ? '' : ` Game: you ${this.total[0]}, the Scribe ${this.total[1]}.`));
      const [x, y] = this.total, done = this.variant === 'deal' || Math.max(x, y) >= this.limit;
      if (done && x !== y) {
        const w = x > y ? 0 : 1;
        this.decided = { winner: w, title: w ? 'The Scribe wins at Bézique' : 'You win at Bézique', text: `${Math.max(x, y)} points to ${Math.min(x, y)}${this.deals > 1 ? ` after ${this.deals} deals` : ''}.` };
      } else if (done) {
        if (this.variant === 'deal') this.decided = { winner: -1, title: 'A drawn game', text: `${x} points each.` };
        else notes.push('Level past 1,000: another deal.');
      }
      this.notes = notes; this.stage = 'next'; this.toMove = 0;
      return notes.join(' ');
    },
    passTurn() { return this.over ? 0 : this.toMove; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return null; },
    /* The Scribe keeps what scores: aces and tens are brisques, trumps win tricks, and kings, queens, the
     * queen of spades and the jack of diamonds make melds. It plays from what it can see: its own hand,
     * both players' melds and the cards already played. */
    keep(pl, b) {
      const all = this.holding(pl), pw = bzPow(b), su = bzSuit(b), tr = su === this.trump;
      let v = pw * 0.6 + (bzBrisque(b) ? 6 : 0) + (tr ? 4 : 0);
      if (!this.closed) {
        if (pw === BZ_K || pw === BZ_Q) { const mate = all.some(x => bzSuit(x) === su && bzPow(x) === (pw === BZ_K ? BZ_Q : BZ_K) && !this.usedIn(x, 'marriage')); v += !this.usedIn(b, 'marriage') ? (mate ? 7 : 3) * (tr ? 1.6 : 1) : 0; }
        if (isBzQS(b) || isBzJD(b)) v += this.usedIn(b, 'bezique') && this.usedIn(b, 'double') ? 0 : 6;
        if (pw >= BZ_J && pw !== BZ_T) { const n = all.filter(x => bzPow(x) === pw).length; if (n >= 2 && !this.usedIn(b, 'four')) v += n * 1.5; }
        if (tr && pw >= BZ_J && !this.usedIn(b, 'sequence')) v += 2;
        if (tr && pw === BZ_7 && !this.usedIn(b, 'dix')) v += 5;
      }
      return v;
    },
    aiPlan(pl) {
      if (this.stage === 'next') return [{ pl, kind: 'next' }];
      if (this.stage === 'meld') {
        const opts = this.meldOptions(pl);
        if (!opts.length || (LEVEL.name === 'gentle' && Math.random() < 0.25)) return [{ pl, kind: 'meld', type: 'none', cards: [], pts: 0, label: 'No meld' }];
        return [Object.assign({ pl }, opts[0])];
      }
      const ms = this.legalCards(pl);
      if (ms.length === 1) return [{ pl, kind: 'play', c: ms[0] }];
      if (LEVEL.name === 'gentle' && Math.random() < 0.4) return [{ pl, kind: 'play', c: ms[(Math.random() * ms.length) | 0] }];
      const noise = pick(3, 1.5, 0.3), kv = b => this.keep(pl, b) + Math.random() * noise;
      const low = cs => cs.reduce((x, y) => (kv(y) < kv(x) ? y : x));
      const lead = this.trick.length ? this.trick[0].c : null;
      const wins = b => lead !== null && ((bzSuit(b) === bzSuit(lead) && bzPow(b) > bzPow(lead)) || (bzSuit(b) === this.trump && bzSuit(lead) !== this.trump));
      if (this.closed) {
        if (lead === null) { // lead a card nothing left unseen can beat, else a low one
          const gone = new Set(this.played.concat(this.holding(pl)));
          const master = b => { for (let p = bzPow(b) + 1; p < 8; p++) for (const cp of [0, 32]) { const x = cp + bzSuit(b) * 8 + p; if (!gone.has(x)) return false; } return true; };
          const cash = ms.filter(master); if (cash.length) return [{ pl, kind: 'play', c: cash[0] }];
          return [{ pl, kind: 'play', c: ms.reduce((x, y) => (bzPow(y) < bzPow(x) ? y : x)) }];
        }
        return [{ pl, kind: 'play', c: ms.reduce((x, y) => (bzPow(y) < bzPow(x) ? y : x)) }]; // the rules already demand a winner if there is one
      }
      if (lead === null) return [{ pl, kind: 'play', c: low(ms) }];
      // Following: take a brisque, or win the trick to meld, when it can be done cheaply; otherwise throw the least useful card.
      const winners = ms.filter(wins);
      const meldNow = this.meldOptions(pl).reduce((t, o) => Math.max(t, o.pts), 0);
      const prize = (bzBrisque(lead) ? 10 : 0) + Math.min(meldNow, LEVEL.name === 'sharp' ? 250 : 60) * 0.5;
      if (winners.length && prize) { const w = low(winners); if (this.keep(pl, w) < prize + 4) return [{ pl, kind: 'play', c: w }]; }
      const losers = ms.filter(b => !wins(b) && !bzBrisque(b));
      return [{ pl, kind: 'play', c: low(losers.length ? losers : ms) }];
    },
  };

