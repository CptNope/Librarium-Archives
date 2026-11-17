  /* -------------------------------------------------------------- Pinochle
   * Two-handed pinochle, the American game descended from bézique by way of the German binokel. A 48-card
   * pack, two of each card from the nine up, each with its own id 0-47: id % 24 is the card (suit * 6 + power),
   * id >= 24 the second copy. Power runs nine, jack, queen, king, ten, ace (0-5). Suits spades, hearts,
   * diamonds, clubs. pnFace turns an id into the number the other card tables use (suit * 13 + rank). The
   * engine is Bézique's, with pinochle's melds and its card points. */
  const PN_POW = ['nine', 'jack', 'queen', 'king', 'ten', 'ace'];
  const PN_POWS = ['nines', 'jacks', 'queens', 'kings', 'tens', 'aces'];
  const PN_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const PN_FACE_RANK = [8, 10, 11, 12, 9, 0];
  const pnSuit = b => ((b % 24) / 6) | 0, pnPow = b => b % 6;
  const pnFace = b => pnSuit(b) * 13 + PN_FACE_RANK[pnPow(b)];
  const pnName = b => `${PN_POW[pnPow(b)]} of ${PN_SUIT[pnSuit(b)]}`;
  const PN_9 = 0, PN_J = 1, PN_Q = 2, PN_K = 3, PN_T = 4, PN_A = 5;
  const PN_POINTS = [0, 2, 3, 4, 10, 11];
  const pnPoints = b => PN_POINTS[pnPow(b)];
  const isPnQS = b => pnSuit(b) === 0 && pnPow(b) === PN_Q, isPnJD = b => pnSuit(b) === 2 && pnPow(b) === PN_J;
  const PN_AROUND = { [PN_A]: 100, [PN_K]: 80, [PN_Q]: 60, [PN_J]: 40 };
  const PINOCHLE = {
    id: 'pinochle', name: 'Pinochle', dice: false, first: 1, cardName: pnName, face: pnFace,
    variants: [{ id: '1000', label: 'To 1,000' }, { id: 'deal', label: 'One deal' }], variant: '1000', variantLabel: 'Game',
    setVariant(id) { this.variant = id === 'deal' ? 'deal' : '1000'; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'A 48-card pinochle pack: two of every card from the nine to the ace in each suit, ranking ace, ten, king, queen, jack, nine. Each of you gets twelve; the next card is turned up for trumps and the rest are the stock.',
      'While the stock lasts you need not follow suit. The higher card of the suit led wins, a trump beats any other suit, and of two identical cards the first played wins. The winner may then meld once, and draws first; the loser draws next.',
      'Melds are laid face up and can still be played to tricks. Run (ace, ten, king, queen, jack of trumps) 150. Royal marriage (king and queen of trumps) 40, other marriages 20. Aces around (one of each suit) 100, kings around 80, queens around 60, jacks around 40. Pinochle (queen of spades and jack of diamonds) 40, double pinochle 300. The dix (nine of trumps) 10; the first one shown is exchanged for the turned-up card. A card may count again in another kind of meld, never the same kind.',
      'When the stock is gone (the loser of that trick takes the turned-up card), melds return to the hand and the last twelve tricks are played strictly: follow suit and win the trick if you can; if you cannot follow, trump if you can.',
      'Cards taken in tricks count: ace 11, ten 10, king 4, queen 3, jack 2, and 10 for the last trick. The first to 1,000 at the end of a deal wins.'
    ],
    source: 'Two-handed pinochle after pagat.com, which follows the American books. One meld after each trick won, chosen from a list; the run on a royal marriage already down scores the 110 it adds, and double pinochle on a pinochle already down 260.',
    init() { this.total = [0, 0]; this.deals = 0; this.dealer = 0; this.over = null; this.decided = null; this.deal(); },
    deal() {
      const d = Array.from({ length: 48 }, (_, i) => i);
      for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      const leader = 1 - this.dealer;
      this.hands = [[], []]; this.hands[leader] = d.slice(0, 12); this.hands[this.dealer] = d.slice(12, 24);
      this.turnUp = d[24]; this.trump = pnSuit(this.turnUp); this.stock = d.slice(25);
      this.melds = [[], []]; this.used = {}; this.won = [[], []]; this.score = [0, 0]; this.trick = []; this.lastTrick = null; this.dixDone = false;
      this.closed = false; this.stage = 'play'; this.toMove = leader; this.played = []; this.notes = []; this.deals++; this.log = []; this.dixNote = '';
    },
    sortHand(pl) { const t = this.trump; this.hands[pl].sort((a, b) => ((pnSuit(a) === t) - (pnSuit(b) === t)) || pnSuit(a) - pnSuit(b) || pnPow(a) - pnPow(b) || a - b); },
    who(pl) { return pl === 0 ? 'You' : 'The Scribe'; },
    get limit() { return this.variant === 'deal' ? 0 : 1000; },
    prompt0() {
      if (this.stage === 'next') return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next deal when you are ready.');
      if (this.stage === 'meld') return 'You won the trick. Choose a meld to score, or none.';
      const t = PN_SUIT[this.trump];
      if (this.closed) return this.trick.length ? `Follow suit and beat the card if you can; if you have none of its suit, trump (${t}) if you can.` : `The stock is gone: lead a card. Trumps are ${t}.`;
      return this.trick.length ? `Play any card: the higher of its suit wins, or a trump. Trumps are ${t}.` : `Lead a card. Trumps are ${t}.`;
    },
    // Every card a player can play from: the hand and, while the stock lasts, the melds on the table.
    holding(pl) { return this.hands[pl].concat(this.melds[pl]); },
    legalCards(pl) {
      const all = this.holding(pl);
      if (!this.closed || !this.trick.length) return all;
      const lead = this.trick[0].c, su = pnSuit(lead), follow = all.filter(b => pnSuit(b) === su);
      if (follow.length) { const beat = follow.filter(b => pnPow(b) > pnPow(lead)); return beat.length ? beat : follow; }
      const trumps = all.filter(b => pnSuit(b) === this.trump);
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
        if (new Set(pickT).size < pickT.length) { // two needs met by one card: only double pinochle can do that
          const seen = new Set(), res = [];
          for (const o of opts) { const b = o.find(x => !seen.has(x)); if (b === undefined) return null; seen.add(b); res.push(b); }
          return res.some(b => hand.includes(b)) ? res : null;
        }
        if (pickT.some(b => hand.includes(b))) return pickT;
        for (let i = 0; i < opts.length; i++) { const h = opts[i].find(b => hand.includes(b) && !pickT.includes(b)); if (h !== undefined) { const r = pickT.slice(); r[i] = h; return r; } }
        return null;
      };
      const is = (su, pw) => b => pnSuit(b) === su && pnPow(b) === pw;
      const seq = choose([PN_A, PN_T, PN_K, PN_Q, PN_J].map(pw => is(t, pw)), 'sequence');
      // A run built on a royal marriage already down scores only the 110 it adds.
      if (seq) { const onMarriage = seq.filter(b => this.usedIn(b, 'marriage') && table.includes(b)).length === 2; const p = onMarriage ? 110 : 150; out.push({ kind: 'meld', type: 'sequence', cards: seq, pts: p, label: `Run in ${PN_SUIT[t]} (${p})` }); }
      for (let su = 0; su < 4; su++) {
        const mar = choose([is(su, PN_K), is(su, PN_Q)], 'marriage', b => !this.usedIn(b, 'sequence'));
        if (mar) out.push({ kind: 'meld', type: 'marriage', cards: mar, pts: su === t ? 40 : 20, label: `${su === t ? 'Royal marriage' : 'Marriage'} in ${PN_SUIT[su]} (${su === t ? 40 : 20})` });
      }
      for (const pw of [PN_A, PN_K, PN_Q, PN_J]) { // one of each suit
        const four = choose([0, 1, 2, 3].map(su => is(su, pw)), 'four');
        if (four) out.push({ kind: 'meld', type: 'four', cards: four, pts: PN_AROUND[pw], label: `${PN_POWS[pw][0].toUpperCase() + PN_POWS[pw].slice(1)} around (${PN_AROUND[pw]})` });
      }
      const qs = all.filter(b => isPnQS(b)), jd = all.filter(b => isPnJD(b));
      if (qs.length === 2 && jd.length === 2 && ![...qs, ...jd].some(b => this.usedIn(b, 'double')) && [...qs, ...jd].some(b => hand.includes(b))) {
        const p = [...qs, ...jd].filter(b => this.usedIn(b, 'bezique') && table.includes(b)).length >= 2 ? 260 : 300; // on a pinochle already down
        out.push({ kind: 'meld', type: 'double', cards: [...qs, ...jd], pts: p, label: `Double pinochle (${p})` });
      }
      const bez = choose([isPnQS, isPnJD], 'bezique');
      if (bez) out.push({ kind: 'meld', type: 'bezique', cards: bez, pts: 40, label: 'Pinochle (40)' });
      const dix = hand.find(b => pnSuit(b) === t && pnPow(b) === PN_9 && !this.usedIn(b, 'dix'));
      if (dix !== undefined) {
        const swap = this.stock.length && this.turnUp !== null && pnPow(this.turnUp) !== PN_9 && !this.dixDone; // only the first dix is exchanged
        out.push({ kind: 'meld', type: 'dix', cards: [dix], pts: 10, swap: !!swap, label: swap ? `Exchange the nine of trumps for the ${pnName(this.turnUp)} (10)` : 'Show the nine of trumps (10)' });
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
          if (m.type === 'dix') this.dixDone = true;
          if (m.type === 'dix' && m.swap) { const h = this.hands[pl], i = h.indexOf(m.cards[0]); h[i] = this.turnUp; this.turnUp = m.cards[0]; events.push({ type: 'swap', pl, got: h[i], gave: m.cards[0] }); }
          this.score[pl] += m.pts;
          events.push({ type: 'meld', pl, cards: m.cards.slice(), meld: m.type });
          const what = { sequence: `a run in ${PN_SUIT[this.trump]}`, double: 'double pinochle', bezique: 'a pinochle', four: m.label.replace(/ \(\d+\)$/, '').toLowerCase(), marriage: 'a ' + m.label.replace(/ \(\d+\)$/, '').toLowerCase() }[m.type];
          note = m.type === 'dix' ? `${this.who(pl)} ${m.swap ? (Y ? 'exchange' : 'exchanges') + ' the dix, the nine of trumps, for the turn-up' : (Y ? 'show' : 'shows') + ' the dix'}: 10.` : `${this.who(pl)} ${Y ? 'meld' : 'melds'} ${what}: ${m.pts}.`;
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
      const beats = (pnSuit(m.c) === pnSuit(lead.c) && pnPow(m.c) > pnPow(lead.c)) || (pnSuit(m.c) === this.trump && pnSuit(lead.c) !== this.trump);
      const w = beats ? pl : lead.pl;
      const cards = this.trick.map(t => t.c);
      this.won[w].push(...cards); this.lastTrick = { cards, winner: w }; this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      const pts = cards.reduce((t, c) => t + pnPoints(c), 0);
      let note = `${this.who(w)} ${w ? 'takes' : 'take'} the trick${pts ? ` (${pts} in cards)` : ''}.`;
      if (!this.holding(0).length && !this.holding(1).length) { note += ' ' + this.endDeal(w); return { note, events }; }
      if (!this.closed && this.meldOptions(w).length) { this.stage = 'meld'; return { note, events }; }
      note += this.draw(w, events);
      return { note, events };
    },
    endDeal(last) {
      const notes = [];
      this.score[last] += 10; notes.push(`10 to ${last ? 'the Scribe' : 'you'} for the last trick.`);
      const b = this.won.map(cs => cs.reduce((t, c) => t + pnPoints(c), 0));
      this.score[0] += b[0]; this.score[1] += b[1];
      notes.push(`Cards taken: you ${b[0]}, the Scribe ${b[1]}.`);
      this.total[0] += this.score[0]; this.total[1] += this.score[1];
      notes.push(`This deal: you ${this.score[0]}, the Scribe ${this.score[1]}.` + (this.variant === 'deal' ? '' : ` Game: you ${this.total[0]}, the Scribe ${this.total[1]}.`));
      const [x, y] = this.total, done = this.variant === 'deal' || Math.max(x, y) >= this.limit;
      if (done && x !== y) {
        const w = x > y ? 0 : 1;
        this.decided = { winner: w, title: w ? 'The Scribe wins at Pinochle' : 'You win at Pinochle', text: `${Math.max(x, y)} points to ${Math.min(x, y)}${this.deals > 1 ? ` after ${this.deals} deals` : ''}.` };
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
    /* The Scribe keeps what scores: aces and tens count most in tricks, trumps win them, and kings, queens, the
     * queen of spades and the jack of diamonds make melds. It plays from what it can see: its own hand,
     * both players' melds and the cards already played. */
    keep(pl, b) {
      const all = this.holding(pl), pw = pnPow(b), su = pnSuit(b), tr = su === this.trump;
      let v = pw * 0.6 + pnPoints(b) * 0.5 + (tr ? 4 : 0);
      if (!this.closed) {
        if (pw === PN_K || pw === PN_Q) { const mate = all.some(x => pnSuit(x) === su && pnPow(x) === (pw === PN_K ? PN_Q : PN_K) && !this.usedIn(x, 'marriage')); v += !this.usedIn(b, 'marriage') ? (mate ? 7 : 3) * (tr ? 1.6 : 1) : 0; }
        if (isPnQS(b) || isPnJD(b)) v += this.usedIn(b, 'bezique') && this.usedIn(b, 'double') ? 0 : 6;
        if (pw >= PN_J && pw !== PN_T && !this.usedIn(b, 'four')) { const suits = new Set(all.filter(x => pnPow(x) === pw).map(pnSuit)).size; if (suits >= 2) v += suits * 1.5; }
        if (tr && pw >= PN_J && !this.usedIn(b, 'sequence')) v += 2;
        if (tr && pw === PN_9 && !this.usedIn(b, 'dix')) v += 5;
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
      const wins = b => lead !== null && ((pnSuit(b) === pnSuit(lead) && pnPow(b) > pnPow(lead)) || (pnSuit(b) === this.trump && pnSuit(lead) !== this.trump));
      if (this.closed) {
        if (lead === null) { // lead a card nothing left unseen can beat, else a low one
          const gone = new Set(this.played.concat(this.holding(pl)));
          const master = b => { for (let p = pnPow(b) + 1; p < 6; p++) for (const cp of [0, 24]) { const x = cp + pnSuit(b) * 6 + p; if (!gone.has(x)) return false; } return true; };
          const cash = ms.filter(master); if (cash.length) return [{ pl, kind: 'play', c: cash[0] }];
          return [{ pl, kind: 'play', c: ms.reduce((x, y) => (pnPow(y) < pnPow(x) ? y : x)) }];
        }
        return [{ pl, kind: 'play', c: ms.reduce((x, y) => (pnPow(y) < pnPow(x) ? y : x)) }]; // the rules already demand a winner if there is one
      }
      if (lead === null) return [{ pl, kind: 'play', c: low(ms) }];
      // Following: take an ace or ten, or win the trick to meld, when it can be done cheaply; otherwise throw the least useful card.
      const winners = ms.filter(wins);
      const meldNow = this.meldOptions(pl).reduce((t, o) => Math.max(t, o.pts), 0);
      const prize = pnPoints(lead) + Math.min(meldNow, LEVEL.name === 'sharp' ? 150 : 60) * 0.5;
      if (winners.length && prize) { const w = low(winners); if (this.keep(pl, w) < prize + 4) return [{ pl, kind: 'play', c: w }]; }
      const losers = ms.filter(b => !wins(b) && pnPoints(b) < 10);
      return [{ pl, kind: 'play', c: low(losers.length ? losers : ms) }];
    },
  };

