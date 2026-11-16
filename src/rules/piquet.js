  /* ---------------------------------------------------------------- Piquet
   * 32 cards with the cribbage numbering (suit * 13 + rank, rank 0 the ace);
   * pqPow ranks 7 low to ace high. Player 0 is the visitor. Elder hand is the
   * non-dealer. A partie is six deals, or two in the short game. */
  const PQ_DECK = []; for (let su = 0; su < 4; su++) for (const rk of [0, 6, 7, 8, 9, 10, 11, 12]) PQ_DECK.push(su * 13 + rk);
  const pqSuit = c => (c / 13) | 0, pqRank = c => c % 13;
  const pqPow = c => (pqRank(c) === 0 ? 7 : pqRank(c) - 6); // 7 is 0 ... ace is 7
  const pqVal = c => (pqRank(c) === 0 ? 11 : pqRank(c) >= 9 ? 10 : pqRank(c) + 1);
  const PQ_RANK = ['seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace'];
  const PQ_RANKS = ['sevens', 'eights', 'nines', 'tens', 'jacks', 'queens', 'kings', 'aces'];
  const PQ_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const PQ_SEQ = ['', '', '', 'tierce', 'quart', 'quint', 'sixième', 'septième', 'huitième'];
  const pqSeqScore = n => (n < 3 ? 0 : n <= 4 ? n : n + 10);
  const pqName = c => `${PQ_RANK[pqPow(c)]} of ${PQ_SUIT[pqSuit(c)]}`;
  function pqDeclare(hand) { // the best of each kind a hand holds, and what all its sequences and sets are worth
    const bySuit = [0, 1, 2, 3].map(su => hand.filter(c => pqSuit(c) === su).map(pqPow).sort((a, b) => a - b));
    let point = { len: 0, val: 0, suit: -1 };
    bySuit.forEach((p, su) => { const val = hand.filter(c => pqSuit(c) === su).reduce((n, c) => n + pqVal(c), 0); if (p.length > point.len || (p.length === point.len && val > point.val)) point = { len: p.length, val, suit: su }; });
    const seqs = [];
    bySuit.forEach((p, su) => { let run = 1; for (let k = 1; k <= p.length; k++) { if (k < p.length && p[k] === p[k - 1] + 1) run++; else { if (run >= 3) seqs.push({ len: run, top: p[k - 1], suit: su }); run = 1; } } });
    seqs.sort((a, b) => b.len - a.len || b.top - a.top);
    const sets = [];
    for (let pw = 3; pw <= 7; pw++) { const n = hand.filter(c => pqPow(c) === pw).length; if (n >= 3) sets.push({ n, pw }); }
    sets.sort((a, b) => b.n - a.n || b.pw - a.pw);
    const blanche = !hand.some(c => pqRank(c) >= 10 && pqRank(c) <= 12);
    return { point, seqs, sets, blanche };
  }
  const PIQUET = {
    id: 'piquet', name: 'Piquet', dice: false, first: 0, cardName: pqName,
    variants: [{ id: '6', label: 'Partie of six' }, { id: '2', label: 'Two deals' }], variant: '6', variantLabel: 'Game',
    setVariant(id) { this.variant = id === '2' ? '2' : '6'; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'A 32-card pack, sevens up to aces. Each of you is dealt twelve cards; the other eight are the talon. The player who does not deal is elder hand. The deal alternates.',
      'Exchange: elder hand discards one to five cards and draws as many from the talon; younger hand may then discard up to as many as are left. Click cards to mark them, then exchange.',
      'Declarations are scored for you. Point: the longest suit scores a point a card (ties go to the higher card values). Sequence: three or more in a row in one suit; tierce 3, quart 4, quint 15, sixième 16 and so on. The best sequence scores all its holder\'s sequences. Sets: four aces, kings, queens, jacks or tens score 14, three of them 3; the best set scores all its holder\'s sets. A hand with no court card is carte blanche, 10. Equal declarations score nothing.',
      'Then twelve tricks with no trumps: follow suit if you can. You score 1 for each card you lead, 1 for winning a trick the other led, 1 more for the last trick, and 10 for winning more tricks, or 40 for winning them all (capot).',
      'Reaching 30 from declarations alone before the other scores anything is a repique, worth 60 more. Elder hand reaching 30 in declarations and play before younger scores anything makes a pique, worth 30 more. After six deals the higher total wins.'
    ],
    source: 'Piquet as Cavendish set out its rules in 1882, after pagat.com. Combinations are declared for you, in full, and a tie after the last deal is a draw.',
    init() { this.total = [0, 0]; this.deals = 0; this.dealer = 1; this.over = null; this.deal(); },
    deal() {
      const d = PQ_DECK.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      const sort = h => h.sort((a, b) => pqSuit(a) - pqSuit(b) || pqPow(a) - pqPow(b));
      this.hands = [sort(d.slice(0, 12)), sort(d.slice(12, 24))]; this.talon = d.slice(24);
      this.elder = 1 - this.dealer; this.deals++;
      this.stage = 'exchange'; this.toMove = this.elder; this.taken = 0; this.marked = []; this.discards = [[], []];
      this.score = [0, 0]; this.declScore = [0, 0]; this.trick = []; this.tricks = [0, 0]; this.played = []; this.notes = []; this.declNote = '';
      this.void = [[false, false, false, false], [false, false, false, false]]; this.piqueOpen = true; this.lastTrick = null;
    },
    get limit() { return +this.variant; },
    declareHand: pqDeclare,
    who(pl) { return pl === 0 ? 'You' : 'The Scribe'; },
    prompt0() {
      if (this.stage === 'exchange') {
        const max = this.toMove === this.elder ? 5 : this.talon.length;
        return `You are ${this.toMove === this.elder ? 'elder' : 'younger'} hand. Click up to ${max} cards to discard, then exchange.`;
      }
      if (this.stage === 'next') return this.notes.join(' ') + ' Press Next deal when you are ready.';
      return this.trick.length ? 'Follow suit if you can.' : 'Lead a card.';
    },
    legal(pl) {
      if (this.over || pl !== this.toMove) return [];
      if (this.stage === 'next') return [{ pl, kind: 'next', label: this.deals >= this.limit ? 'See the result' : 'Next deal' }];
      if (this.stage === 'exchange') {
        const max = pl === this.elder ? Math.min(5, this.talon.length) : this.talon.length, n = this.marked.length, out = this.hands[pl].map(c => ({ pl, kind: 'mark', c }));
        if (n >= 1 && n <= max) out.push({ pl, kind: 'exchange', cards: this.marked.slice(), label: `Exchange ${n} card${n > 1 ? 's' : ''}` });
        return out;
      }
      return this.legalCards(pl).map(c => ({ pl, kind: 'play', c }));
    },
    legalCards(pl) { const h = this.hands[pl]; if (!this.trick.length) return h.slice(); const su = pqSuit(this.trick[0].c), f = h.filter(c => pqSuit(c) === su); return f.length ? f : h.slice(); },
    add(pl, n, play) { // score, watching for pique: elder reaches 30 before younger scores anything
      if (!n) return '';
      this.score[pl] += n;
      if (play === 'trick' && pl !== this.elder) this.piqueOpen = false;
      if (play === 'trick' && pl === this.elder && this.piqueOpen && this.score[pl] >= 30 && !this.score[1 - pl]) { this.piqueOpen = false; this.score[pl] += 30; return pl === 0 ? ' Pique: 30 more to you!' : ' Pique: 30 more to the Scribe.'; }
      return '';
    },
    apply(m) {
      const pl = m.pl, Y = pl === 0;
      if (m.kind === 'next') {
        this.total[0] += this.score[0]; this.total[1] += this.score[1];
        if (this.deals >= this.limit) { this.finishPartie(); return { note: '' }; }
        this.dealer = 1 - this.dealer; this.deal();
        return { note: this.elder === 0 ? 'The Scribe deals. You are elder hand.' : 'You deal. The Scribe is elder hand.', events: [{ type: 'deal' }] };
      }
      if (m.kind === 'mark') {
        const i = this.marked.indexOf(m.c); if (i >= 0) this.marked.splice(i, 1); else this.marked.push(m.c);
        return { note: '', events: [{ type: 'mark', c: m.c, on: i < 0 }], followUp: this.legal(pl) };
      }
      if (m.kind === 'exchange') {
        const n = m.cards.length, h = this.hands[pl];
        for (const c of m.cards) { h.splice(h.indexOf(c), 1); this.discards[pl].push(c); }
        const drawn = this.talon.splice(0, n); h.push(...drawn); h.sort((a, b) => pqSuit(a) - pqSuit(b) || pqPow(a) - pqPow(b));
        this.marked = [];
        const events = [{ type: 'exchange', pl, out: m.cards, drawn }];
        let note = `${this.who(pl)} ${Y ? 'exchange' : 'exchanges'} ${n} card${n > 1 ? 's' : ''}.`;
        if (pl === this.elder) { this.toMove = 1 - pl; return { note, events }; }
        note += ' ' + this.declare(); this.stage = 'play'; this.toMove = this.elder;
        return { note, events };
      }
      // A card played to a trick.
      const h = this.hands[pl]; h.splice(h.indexOf(m.c), 1); this.played.push(m.c);
      const events = [{ type: 'play', pl, c: m.c }]; let note = '';
      if (!this.trick.length) { this.trick.push({ pl, c: m.c }); note = this.add(pl, 1, 'trick'); this.toMove = 1 - pl; return { note: note.trim(), events }; }
      const lead = this.trick[0]; if (pqSuit(m.c) !== pqSuit(lead.c)) this.void[pl][pqSuit(lead.c)] = true;
      this.trick.push({ pl, c: m.c });
      const w = pqSuit(m.c) === pqSuit(lead.c) && pqPow(m.c) > pqPow(lead.c) ? pl : lead.pl;
      this.tricks[w]++; this.lastTrick = { cards: this.trick.map(t => t.c), winner: w }; this.trick = []; this.toMove = w;
      events.push({ type: 'trick', winner: w });
      if (w !== lead.pl) note += this.add(w, 1, 'trick');
      const notes = [`${this.who(w)} ${w ? 'takes' : 'take'} the trick.${note}`];
      if (!this.hands[0].length && !this.hands[1].length) this.endDeal(w, notes);
      return { note: notes.join(' '), events };
    },
    declare() { // compare both hands category by category, in the order they are counted
      const d = [this.hands[0], this.hands[1]].map(pqDeclare), parts = [], got = [0, 0];
      let repique = -1;
      const score = (pl, n) => { if (!n) return; got[pl] += n; this.add(pl, n); if (repique < 0 && got[pl] >= 30 && !got[1 - pl]) repique = pl; };
      const name = pl => (pl === 0 ? 'You' : 'The Scribe'), verb = pl => (pl === 0 ? 'score' : 'scores');
      for (const pl of [this.elder, 1 - this.elder]) if (d[pl].blanche) { score(pl, 10); parts.push(`${name(pl)} ${pl ? 'has' : 'have'} carte blanche: 10.`); }
      const pt = d.map(x => x.point), pw = pt[0].len - pt[1].len || pt[0].val - pt[1].val;
      if (pw) { const p = pw > 0 ? 0 : 1; score(p, pt[p].len); parts.push(`${name(p)} ${verb(p)} the point, ${pt[p].len} in ${PQ_SUIT[pt[p].suit]}: ${pt[p].len}.`); } else parts.push('The points are equal.');
      const s0 = d[0].seqs[0], s1 = d[1].seqs[0];
      const sw = !s0 && !s1 ? 0 : !s1 ? 1 : !s0 ? -1 : s0.len - s1.len || s0.top - s1.top;
      if (sw) { const p = sw > 0 ? 0 : 1, all = d[p].seqs, n = all.reduce((t, q) => t + pqSeqScore(q.len), 0); score(p, n); parts.push(`${name(p)} ${verb(p)} for sequences (${all.map(q => PQ_SEQ[Math.min(q.len, 8)] + ' to the ' + PQ_RANK[q.top]).join(', ')}): ${n}.`); } else if (s0) parts.push('The sequences are equal.');
      const t0 = d[0].sets[0], t1 = d[1].sets[0];
      const tw = !t0 && !t1 ? 0 : !t1 ? 1 : !t0 ? -1 : t0.n - t1.n || t0.pw - t1.pw;
      if (tw) { const p = tw > 0 ? 0 : 1, all = d[p].sets, n = all.reduce((t, q) => t + (q.n === 4 ? 14 : 3), 0); score(p, n); parts.push(`${name(p)} ${verb(p)} for sets (${all.map(q => (q.n === 4 ? 'four ' : 'three ') + PQ_RANKS[q.pw]).join(', ')}): ${n}.`); }
      if (repique >= 0) { this.add(repique, 60); parts.push(repique === 0 ? 'Repique: 60 more to you!' : 'Repique: 60 more to the Scribe.'); this.piqueOpen = false; }
      else if (got[1 - this.elder]) this.piqueOpen = false; // younger hand has scored, so elder cannot make a pique
      this.declScore = got; this.declNote = parts.join(' ');
      return this.declNote;
    },
    endDeal(last, notes) {
      this.score[last] += 1; notes.push(`${last ? 'The Scribe scores' : 'You score'} 1 for the last trick.`);
      const [a, b] = this.tricks;
      if (a === 12 || b === 12) { const p = a === 12 ? 0 : 1; this.score[p] += 40; notes.push(`Capot! ${p ? 'The Scribe takes' : 'You take'} every trick: 40.`); }
      else if (a !== b) { const p = a > b ? 0 : 1; this.score[p] += 10; notes.push(`${p ? 'The Scribe wins' : 'You win'} the cards, ${Math.max(a, b)} tricks to ${Math.min(a, b)}: 10.`); }
      else notes.push('Six tricks each: nobody scores for the cards.');
      notes.push(`This deal: you ${this.score[0]}, the Scribe ${this.score[1]}.`);
      this.notes = notes.slice(1); this.stage = 'next'; this.toMove = 0;
    },
    finishPartie() {
      const [a, b] = this.total;
      if (a === b) { this.over = { winner: -1, title: 'A drawn partie', text: `${a} points each after ${this.deals} deals.` }; return; }
      const w = a > b ? 0 : 1, lo = Math.min(a, b), hi = Math.max(a, b), owed = lo >= 100 ? hi - lo + 100 : hi + lo + 100;
      const rub = this.limit === 6 ? ` ${w ? 'You' : 'The Scribe'} ${lo >= 100 ? 'crossed' : 'did not cross'} the Rubicon of 100, so the loser owes ${owed}.` : '';
      this.over = { winner: w, title: w ? 'The Scribe wins the partie' : 'You win the partie', text: `${hi} points to ${lo} after ${this.deals} deals.${rub}` };
    },
    passTurn() { return this.over ? 0 : this.toMove; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    // What a card is worth keeping: high cards, sets in the making, and long suits.
    keepValue(h, c) {
      const su = pqSuit(c), pw = pqPow(c), len = h.filter(x => pqSuit(x) === su).length;
      const same = h.filter(x => pqPow(x) === pw).length;
      const nb = h.filter(x => pqSuit(x) === su && Math.abs(pqPow(x) - pw) === 1).length;
      return pw * 1.2 + (pw === 7 ? 4 : 0) + len * 1.5 + (pw >= 3 && same >= 2 ? same * 2 : 0) + nb * 1.3;
    },
    // Sharp tries every way to throw out its weakest cards, draws the talon at random many times for each,
    // and keeps the discard that leaves the strongest hand on average.
    strength(h) {
      const d = pqDeclare(h);
      return d.point.len * 1.4 + d.seqs.reduce((t, q) => t + pqSeqScore(q.len), 0) + d.sets.reduce((t, q) => t + (q.n === 4 ? 14 : 3), 0) * 0.8
        + h.filter(c => pqPow(c) === 7).length * 2.5 + h.filter(c => pqPow(c) === 6).length;
    },
    sharpExchange(pl, n) {
      const h = this.hands[pl], unseen = PQ_DECK.filter(c => !h.includes(c)), drawFrom = this.talon.length;
      const pool = h.map(c => [c, this.keepValue(h, c)]).sort((a, b) => a[1] - b[1]).slice(0, Math.min(h.length, n + 3)).map(x => x[0]);
      const combos = []; const pickc = (start, cur) => { if (cur.length === n) { combos.push(cur.slice()); return; } for (let i = start; i < pool.length; i++) { cur.push(pool[i]); pickc(i + 1, cur); cur.pop(); } };
      pickc(0, []);
      let best = combos[0], bv = -Infinity;
      for (const out of combos) {
        const keep = h.filter(c => !out.includes(c)); let tot = 0;
        for (let k = 0; k < 24; k++) {
          const u = unseen.slice(); for (let i = u.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [u[i], u[j]] = [u[j], u[i]]; }
          tot += this.strength(keep.concat(u.slice(0, Math.min(n, drawFrom))));
        }
        if (tot > bv) { bv = tot; best = out; }
      }
      return best;
    },
    aiExchange(pl) {
      const h = this.hands[pl], max = pl === this.elder ? Math.min(5, this.talon.length) : this.talon.length;
      if (LEVEL.name === 'sharp') return this.sharpExchange(pl, max);
      const n = LEVEL.name === 'gentle' ? Math.max(1, max - ((Math.random() * 3) | 0)) : max;
      const noise = pick(4, 1, 0);
      return h.map(c => [c, this.keepValue(h, c) + Math.random() * noise]).sort((a, b) => a[1] - b[1]).slice(0, n).map(x => x[0]);
    },
    aiCard(pl) {
      const ms = this.legalCards(pl), h = this.hands[pl], opp = 1 - pl;
      if (ms.length === 1) return ms[0];
      if (LEVEL.name === 'gentle' && Math.random() < 0.35) return ms[(Math.random() * ms.length) | 0];
      const seen = new Set(this.played.concat(h, this.discards[pl]));
      const master = c => { for (let p = pqPow(c) + 1; p < 8; p++) { const x = PQ_DECK.find(y => pqSuit(y) === pqSuit(c) && pqPow(y) === p); if (!seen.has(x)) return false; } return true; };
      const low = a => a.reduce((x, y) => (pqPow(y) < pqPow(x) ? y : x)), high = a => a.reduce((x, y) => (pqPow(y) > pqPow(x) ? y : x));
      if (!this.trick.length) {
        const cash = ms.filter(master); if (cash.length) return high(cash);
        const len = su => h.filter(c => pqSuit(c) === su).length;
        const suits = [0, 1, 2, 3].filter(su => len(su)).sort((a, b) => len(b) - len(a));
        const su = suits.find(s2 => !this.void[opp][s2]) ?? suits[0];
        return low(h.filter(c => pqSuit(c) === su)); // lead low from the longest suit, to set it up
      }
      const lead = this.trick[0].c, su = pqSuit(lead);
      const win = ms.filter(c => pqSuit(c) === su && pqPow(c) > pqPow(lead));
      if (win.length) return low(win);
      if (pqSuit(ms[0]) === su) return low(ms);
      const spare = ms.filter(c => !master(c)); // throw a card that will not take a trick later
      const pool = spare.length ? spare : ms;
      const shortest = pool.reduce((x, y) => (h.filter(c => pqSuit(c) === pqSuit(y)).length < h.filter(c => pqSuit(c) === pqSuit(x)).length ? y : x));
      return low(pool.filter(c => pqSuit(c) === pqSuit(shortest)));
    },
    aiPlan(pl) {
      if (this.stage === 'exchange') { const cards = this.aiExchange(pl); return [{ pl, kind: 'exchange', cards }]; }
      return [{ pl, kind: 'play', c: this.aiCard(pl) }];
    },
  };

