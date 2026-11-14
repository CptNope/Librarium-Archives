  /* ---------------------------------------------------------------- Cribbage
   * Two-player six-card cribbage. Card c: rank c % 13 (0 ace ... 12 king), suit
   * (c / 13) | 0 (spades, hearts, diamonds, clubs). The turn order is not simple
   * alternation, so need says who acts next and how: discard, play, or next (the
   * visitor reads the show and asks for the next deal). */
  const CR_RANK = 'A 2 3 4 5 6 7 8 9 10 J Q K'.split(' '), CR_SUIT = ['♠', '♥', '♦', '♣'];
  const crRank = c => c % 13, crSuit = c => (c / 13) | 0, crVal = c => Math.min(10, (c % 13) + 1);
  const crName = c => CR_RANK[crRank(c)] + CR_SUIT[crSuit(c)];
  // Score a hand of four with the starter: fifteens, pairs, runs, flush and nobs, with the words for each.
  function crShow(hand, starter, crib) {
    const all = starter >= 0 ? hand.concat([starter]) : hand.slice(), n = all.length, parts = []; let total = 0;
    let fif = 0;
    for (let mask = 1; mask < 1 << n; mask++) { let sum = 0; for (let k = 0; k < n; k++) if (mask & (1 << k)) sum += crVal(all[k]); if (sum === 15) fif++; }
    if (fif) { total += 2 * fif; parts.push(`${fif === 1 ? 'fifteen' : fif + ' fifteens'} for ${2 * fif}`); }
    let pairs = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (crRank(all[i]) === crRank(all[j])) pairs++;
    if (pairs) { total += 2 * pairs; parts.push(`${pairs === 1 ? 'a pair' : pairs === 3 ? 'a pair royal' : pairs === 6 ? 'a double pair royal' : pairs + ' pairs'} for ${2 * pairs}`); }
    const cnt = new Array(13).fill(0); all.forEach(c => cnt[crRank(c)]++);
    let runPts = 0;
    for (let r = 0; r < 13;) {
      if (!cnt[r]) { r++; continue; }
      let e = r, mult = 1; while (e < 13 && cnt[e]) { mult *= cnt[e]; e++; }
      if (e - r >= 3) { runPts += (e - r) * mult; parts.push(`${mult > 1 ? mult + ' runs' : 'a run'} of ${e - r} for ${(e - r) * mult}`); }
      r = e;
    }
    total += runPts;
    const fs = crSuit(hand[0]);
    if (hand.every(c => crSuit(c) === fs)) {
      if (starter >= 0 && crSuit(starter) === fs) { total += 5; parts.push('a flush of five for 5'); }
      else if (!crib) { total += 4; parts.push('a flush for 4'); }
    }
    if (starter >= 0 && hand.some(c => crRank(c) === 10 && crSuit(c) === crSuit(starter))) { total += 1; parts.push('his nobs for 1'); }
    return { total, parts };
  }
  // Points for the card just played onto the run of play.
  function crPeg(seq, count) {
    let pts = 0; const why = [];
    if (count === 15) { pts += 2; why.push('fifteen for 2'); }
    if (count === 31) { pts += 2; why.push('thirty-one for 2'); }
    let k = 1; const last = crRank(seq[seq.length - 1]);
    while (k < seq.length && crRank(seq[seq.length - 1 - k]) === last) k++;
    if (k >= 2) { const p = [0, 0, 2, 6, 12][k]; pts += p; why.push(k === 2 ? 'a pair for 2' : k === 3 ? 'a pair royal for 6' : 'a double pair royal for 12'); }
    for (let n = seq.length; n >= 3; n--) {
      const ranks = seq.slice(-n).map(crRank), lo = Math.min(...ranks), hi = Math.max(...ranks);
      if (hi - lo === n - 1 && new Set(ranks).size === n) { pts += n; why.push(`a run of ${n} for ${n}`); break; }
    }
    return { pts, why };
  }
  const CRIBBAGE = {
    id: 'cribbage', name: 'Cribbage', dice: false, first: 0, target: 61,
    variants: [{ id: '61', label: 'To 61' }, { id: '121', label: 'To 121' }],
    variant: '61', variantLabel: 'Game',
    setVariant(id) { this.variant = id === '121' ? '121' : '61'; this.target = +this.variant; },
    show: crShow, peg: crPeg, name_: crName, cardName: crName, rank: crRank, suit: crSuit, val: crVal,
    get followPrompt() {
      const t = this.need.type;
      if (t === 'discard') return `Lay one more card aside for ${this.dealer === 0 ? 'your' : 'the Scribe\'s'} crib.`;
      if (t === 'next') return 'Press Next deal when you are ready.';
      return `The count is ${this.count}. Click a card to play.`;
    },
    rules: [
      'Each deal, you each get six cards and lay two aside, face down, for the crib, which scores for the dealer. The deal alternates; the Scribe deals first. Then a starter card is turned up, and if it is a jack the dealer pegs 2 for his heels.',
      'The play: starting with the player who did not deal, you take turns laying a card and calling the running total, which may not pass 31. Score 2 for making 15 or 31, 2 for a pair with the card before (6 for three of a kind, 12 for four), and 1 a card for a run of three or more. When neither of you can play without passing 31, the last to play pegs 1 for the go and the count starts again from nothing. The last card of all pegs 1.',
      'The show: each hand of four, with the starter, counts 2 for every combination making 15, 2 for every pair, 1 a card for runs, 4 for a flush (5 if the starter matches; the crib needs all five) and 1 for his nobs, a jack of the starter\'s suit. The non-dealer counts first, then the dealer\'s hand, then the crib.',
      'The first to peg out wins: 61 points here by default, or the full 121.'
    ],
    source: 'Cribbage as Sir John Suckling is said to have devised it in the 1630s from the older game of noddy, in its modern two-player six-card form.',
    init() { this.score = [0, 0]; this.dealer = 1; this.over = -1; this.deals = 0; this.lastShow = null; this.deal(); },
    deal() {
      const d = Array.from({ length: 52 }, (_, k) => k);
      for (let k = 51; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [d[k], d[j]] = [d[j], d[k]]; }
      this.deck = d; this.hands = [d.slice(0, 6), d.slice(6, 12)]; this.crib = []; this.starter = -1; this.deals++;
      this.seq = []; this.count = 0; this.played = [[], []]; this.kept = null; this.lastShow = null; this.lastPlayer = -1; this.resets = 0;
      // The Scribe lays its two for the crib at once; the visitor chooses theirs.
      const lay = this.aiDiscard(1);
      lay.forEach(c => { this.hands[1].splice(this.hands[1].indexOf(c), 1); this.crib.push(c); });
      this.need = { pl: 0, type: 'discard' };
    },
    add(pl, pts, notes, why) {
      if (!pts || this.over >= 0) return;
      this.score[pl] = Math.min(this.target, this.score[pl] + pts);
      if (why) notes.push(why);
      if (this.score[pl] >= this.target) { this.over = pl; notes.push(pl === 0 ? 'You peg out!' : 'The Scribe pegs out.'); }
    },
    canPlay(pl) { return this.hands[pl].some(c => this.count + crVal(c) <= 31); },
    legal(pl) {
      if (this.over >= 0 || this.need.pl !== pl) return [];
      if (this.need.type === 'discard') return this.hands[pl].map(c => ({ pl, kind: 'discard', c }));
      if (this.need.type === 'next') return [{ pl, kind: 'next', label: this.over >= 0 ? 'Done' : 'Next deal' }];
      return this.hands[pl].filter(c => this.count + crVal(c) <= 31).map(c => ({ pl, kind: 'play', c }));
    },
    who(pl) { return pl === 0 ? 'You' : 'The Scribe'; },
    apply(m) {
      const pl = m.pl, notes = [], res = { note: '', events: [] };
      if (m.kind === 'discard') {
        this.hands[pl].splice(this.hands[pl].indexOf(m.c), 1); this.crib.push(m.c);
        res.events.push({ type: 'crib', c: m.c, pl });
        if (this.crib.length === 4) {
          this.kept = [this.hands[0].slice(), this.hands[1].slice()];
          const rest = this.deck.filter(c => !this.hands[0].includes(c) && !this.hands[1].includes(c) && !this.crib.includes(c));
          this.starter = rest[(Math.random() * rest.length) | 0];
          res.events.push({ type: 'starter', c: this.starter });
          notes.push(`The starter is the ${crName(this.starter)}.`);
          if (crRank(this.starter) === 10) this.add(this.dealer, 2, notes, `${this.who(this.dealer)} ${this.dealer === 0 ? 'peg' : 'pegs'} 2 for his heels.`);
          this.need = { pl: 1 - this.dealer, type: 'play' };
          this.settle(notes, res);
        }
      } else if (m.kind === 'play') {
        this.hands[pl].splice(this.hands[pl].indexOf(m.c), 1); this.played[pl].push(m.c);
        this.seq.push(m.c); this.count += crVal(m.c); this.lastPlayer = pl;
        res.events.push({ type: 'play', c: m.c, pl, count: this.count });
        const pg = crPeg(this.seq, this.count);
        notes.push(`${this.count}.`);
        if (pg.pts) this.add(pl, pg.pts, notes, `${this.who(pl)}: ${pg.why.join(', ')}.`);
        if (this.count === 31) this.reset(res);
        this.need = { pl: 1 - pl, type: 'play' };
        this.settle(notes, res);
      } else if (m.kind === 'next') {
        if (this.over < 0) { this.dealer = 1 - this.dealer; this.deal(); res.events.push({ type: 'deal' }); notes.push(this.dealer === 0 ? 'Your deal: the crib is yours.' : 'The Scribe deals: the crib is its.'); }
      }
      res.note = notes.join(' ');
      if (pl === 0 && this.need.pl === 0 && this.over < 0) res.followUp = this.legal(0);
      return res;
    },
    reset(res) { this.seq = []; this.count = 0; this.resets++; res.events.push({ type: 'reset' }); },
    // After a card: pass the turn over anyone who cannot play, score the go, and run the show when the cards are out.
    settle(notes, res) {
      if (this.over >= 0) return;
      for (let guard = 0; guard < 6; guard++) {
        const q = this.need.pl;
        if (!this.hands[0].length && !this.hands[1].length) {
          if (this.count && this.count < 31) this.add(this.lastPlayer, 1, notes, `${this.who(this.lastPlayer)}: 1 for the last card.`);
          if (this.over < 0) this.showAll(notes, res);
          return;
        }
        if (this.canPlay(q)) return;
        if (this.canPlay(1 - q)) { if (this.hands[q].length) notes.push(q === 0 ? 'You say go.' : 'The Scribe says go.'); this.need = { pl: 1 - q, type: 'play' }; return; }
        // Neither can play: a go for the last to play, and a fresh count.
        if (this.count && this.count < 31) this.add(this.lastPlayer, 1, notes, `${this.who(this.lastPlayer)}: 1 for the go.`);
        if (this.over >= 0) return;
        this.reset(res);
        const next = 1 - this.lastPlayer;
        this.need = { pl: this.hands[next].length ? next : this.lastPlayer, type: 'play' };
      }
    },
    showAll(notes, res) {
      const pone = 1 - this.dealer, out = [];
      for (const [pl, cards, crib] of [[pone, this.kept[pone], false], [this.dealer, this.kept[this.dealer], false], [this.dealer, this.crib, true]]) {
        const sh = crShow(cards, this.starter, crib);
        const label = crib ? (pl === 0 ? 'Your crib' : 'The Scribe\'s crib') : (pl === 0 ? 'Your hand' : 'The Scribe\'s hand');
        out.push({ pl, crib, cards, total: sh.total, text: `${label}: ${sh.parts.length ? sh.parts.join(', ') : 'nineteen (nothing)'}${sh.total ? `, ${sh.total} in all` : ''}.` });
        this.add(pl, sh.total, []);
        if (this.over >= 0) break;
      }
      this.lastShow = out;
      res.events.push({ type: 'show', show: out });
      notes.push(out.map(x => x.text).join(' '));
      if (this.over >= 0) notes.push(this.over === 0 ? 'You peg out!' : 'The Scribe pegs out.');
      this.need = { pl: 0, type: 'next' };
    },
    result() {
      if (this.over < 0) return null;
      const w = this.over, l = 1 - w, lurch = this.score[l] < (this.target === 121 ? 91 : 31);
      return { winner: w, text: `${w === 0 ? 'You' : 'The Scribe'} reached ${this.target}; ${w === 0 ? 'the Scribe' : 'you'} had ${this.score[l]}.${lurch ? ' A lurch: a double game.' : ''}` };
    },
    snapshot() { return JSON.stringify({ score: this.score, dealer: this.dealer, over: this.over, deals: this.deals, deck: this.deck, hands: this.hands, crib: this.crib, starter: this.starter, seq: this.seq, count: this.count, played: this.played, kept: this.kept, lastPlayer: this.lastPlayer, need: this.need, lastShow: this.lastShow, resets: this.resets }); },
    restore(s) { Object.assign(this, JSON.parse(s)); },
    // The Scribe's two for the crib: the four it keeps should score well with any starter.
    aiDiscard(pl) {
      const h = this.hands[pl], mine = this.dealer === pl;
      if (LEVEL.name === 'gentle') { const a = h.slice().sort(() => Math.random() - 0.5); return a.slice(0, 2); }
      let best = null, bv = -Infinity;
      const others = Array.from({ length: 52 }, (_, k) => k).filter(c => !h.includes(c));
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
        const keep = h.filter((_, k) => k !== i && k !== j), lay = [h[i], h[j]];
        let v;
        if (LEVEL.name === 'fair') v = crShow(keep, -1, false).total; // no starter: score what is held
        else { v = 0; for (const st of others) v += crShow(keep, st, false).total; v /= others.length; }
        // What the two laid aside are worth in the crib: a pair, a fifteen or fives help whoever owns it.
        let c = 0; if (crRank(lay[0]) === crRank(lay[1])) c += 2; if (crVal(lay[0]) + crVal(lay[1]) === 15) c += 2; c += lay.filter(x => crRank(x) === 4).length * 1.5;
        if (Math.abs(crRank(lay[0]) - crRank(lay[1])) === 1) c += 0.8;
        v += mine ? c : -c;
        if (v > bv) { bv = v; best = lay; }
      }
      return best;
    },
    // The Scribe's card in the play: take points, and avoid leaving 5 or 21 or an easy pair or run.
    aiCard(pl, ms) {
      if (ms.length === 1 || LEVEL.name === 'gentle') return ms[(Math.random() * ms.length) | 0];
      let best = ms[0], bv = -Infinity;
      for (const m of ms) {
        const seq = this.seq.concat([m.c]), count = this.count + crVal(m.c);
        let v = crPeg(seq, count).pts * 10;
        if (LEVEL.name === 'sharp') {
          if (count === 5 || count === 21) v -= 6;
          if (count < 31 && 31 - count <= 10) v -= 1; // leaves the other a likely 31
          if (count < 15 && count + 10 >= 15 && count !== 5) v -= 1.5;
          if (this.seq.length === 0 && crVal(m.c) < 5) v += 2; // a low lead cannot be made fifteen
          if (this.hands[pl].some(x => x !== m.c && crRank(x) === crRank(m.c))) v += 0.8; // a pair in hand can answer a pair
          v += crVal(m.c) * 0.05;
        } else if (count === 5 || count === 21) v -= 3;
        if (v > bv) { bv = v; best = m; }
      }
      return best;
    },
    aiPlan(pl) {
      const plan = [], snap = this.snapshot();
      for (let k = 0; k < 20 && this.over < 0 && this.need.pl === pl; k++) {
        const ms = this.legal(pl); if (!ms.length) break;
        const m = ms[0].kind === 'play' ? this.aiCard(pl, ms) : ms[0];
        plan.push(m); this.apply(m);
      }
      this.restore(snap);
      return plan;
    },
  };

