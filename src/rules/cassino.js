  /* --------------------------------------------------------------- Cassino
   * The English fishing game, first in print in 1792. A full French pack, numbered suit * 13 + rank (rank 0 the
   * ace, 1-9 the two to the ten, 10-12 jack, queen, king); spades, hearts, diamonds, clubs. Number cards count
   * their pips, the ace 1; court cards count nothing and pair only one at a time. The table holds items: a loose
   * card, a build (cards that add up to a value, which can still be raised) or a multiple build (cards that
   * each make the same value, which can't). Every build has an owner, the last player to make or raise it. */
  const CA_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const CA_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
  const caSuit = c => (c / 13) | 0, caRank = c => c % 13, caFace = c => caRank(c) >= 10, caVal = c => (caFace(c) ? 0 : caRank(c) + 1);
  const CA_BIG = 2 * 13 + 9, CA_LITTLE = 1; // the ten of diamonds and the two of spades
  const caName = c => `${CA_RANK[caRank(c)]} of ${CA_SUIT[caSuit(c)]}`;
  const caShort = c => `${['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'][caRank(c)]} of ${CA_SUIT[caSuit(c)]}`; // in words, for the Pack switch
  const CASSINO = {
    id: 'cassino', name: 'Cassino', dice: false, first: 0, cardName: c => caName(c),
    variants: [{ id: 'plain', label: 'No sweeps' }, { id: 'sweeps', label: 'With sweeps' }], variant: 'plain', variantLabel: 'Sweeps',
    setVariant(id) { this.variant = id === 'sweeps' ? 'sweeps' : 'plain'; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'Two players, a full pack. Four cards each and four face up on the table; when both hands are empty, four more each, until the pack is used up. Each turn, play one card from your hand.',
      'Take: a card takes every table card of its rank (a court card only one at a time), every build of its value, and any sets of number cards that add up to it: a 9 takes a 4 and a 5. Aces count 1; court cards count nothing and only pair.',
      'Build: put a card on a table card or build so the total is the value of another card you hold (a 3 on a 5 to build 8, holding an 8), or on one of the same value to make a multiple build of that value. Either player may take a build with a card of its value; a plain build can be raised by anyone holding the new total, a multiple build cannot. While you own a build you may not trail.',
      'Trail: lay your card face up on the table. When the pack is spent, the last player to take anything takes what is left on the table.',
      'Each deal scores 11: most cards 3, most spades 1, big cassino (the ten of diamonds) 2, little cassino (the two of spades) 1, and each ace 1; with sweeps, 1 more for clearing the table. The first to 21 at the end of a deal wins.'
    ],
    source: 'Two-handed Cassino as in the Hoyles that followed Robert Long\'s rules of 1792, after Wikipedia\'s Cassino and pagat.com. A player who owns a build may not trail, as Hoyle recommends; combining a build with loose cards is left out.',
    init() { this.total = [0, 0]; this.over = null; this.decided = null; this.dealer = 1; this.deals = 0; this.notes = []; this.deal(); },
    deal() {
      const d = Array.from({ length: 52 }, (_, i) => i);
      for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      this.pack = d; this.hands = [[], []]; this.table = []; this.piles = [[], []]; this.sweeps = [0, 0]; this.lastTaker = -1; this.nid = 0;
      this.dealHands(); for (let k = 0; k < 4; k++) this.table.push(this.loose(this.pack.pop()));
      this.toMove = 1 - this.dealer; this.stage = 'pick'; this.picked = null; this.deals++; this.notes = [];
    },
    dealHands() { for (let k = 0; k < 4; k++) for (const pl of [1 - this.dealer, this.dealer]) this.hands[pl].push(this.pack.pop()); this.hands.forEach(h => h.sort((a, b) => caRank(a) - caRank(b) || a - b)); },
    loose(c) { return { id: this.nid++, cards: [c], kind: 'card', value: caVal(c), owner: -1 }; },
    who(pl) { return pl ? 'The Scribe' : 'You'; },
    itemName(t) { return t.kind === 'card' ? 'the ' + caShort(t.cards[0]) : t.kind === 'multi' ? `the build of ${t.value}s` : `the build of ${t.value}`; },
    owns(pl) { return this.table.some(t => t.kind !== 'card' && t.owner === pl); },
    holds(pl, v, not) { return this.hands[pl].some(x => x !== not && !caFace(x) && caVal(x) === v); },
    // What a card takes: its pairs and builds, and the largest set of disjoint sums of loose number cards.
    capture(c) {
      if (caFace(c)) { const t = this.table.find(x => x.kind === 'card' && caRank(x.cards[0]) === caRank(c)); return t ? [t] : []; }
      const v = caVal(c), take = this.table.filter(t => t.value === v && (t.kind !== 'card' || !caFace(t.cards[0])));
      const rest = this.table.filter(t => t.kind === 'card' && !caFace(t.cards[0]) && t.value < v && !take.includes(t));
      let best = [];
      const go = (pool, chosen) => { // pick sums greedily from the smallest card up, keeping the largest packing
        if (chosen.length > best.length) best = chosen.slice();
        if (!pool.length) return;
        const [first, ...others] = pool;
        const sums = [];
        const find = (i, sum, set) => { if (sum === v && set.length >= 2) { sums.push(set.slice()); return; } if (sum >= v) return; for (let j = i; j < others.length; j++) { set.push(others[j]); find(j + 1, sum + others[j].value, set); set.pop(); } };
        find(0, first.value, [first]);
        for (const s of sums) go(others.filter(t => !s.includes(t)), chosen.concat(s));
        go(others, chosen);
      };
      go(rest, []);
      return take.concat(best);
    },
    // Every play for one card from hand.
    plays(pl, c) {
      const out = [], v = caVal(c), cap = this.capture(c);
      if (cap.length) out.push({ pl, kind: 'take', card: c, items: cap.map(t => t.id), label: `Take ${cap.map(t => this.itemName(t)).join(', ')} with the ${caShort(c)}` });
      if (!caFace(c)) for (const t of this.table) {
        if (t.kind === 'card' && caFace(t.cards[0])) continue;
        const nv = t.value + v;
        if (t.kind !== 'multi' && nv <= 10 && this.holds(pl, nv, c)) out.push({ pl, kind: 'build', card: c, item: t.id, value: nv, label: `Build ${nv}: the ${caShort(c)} on ${this.itemName(t)}` });
        if (t.value === v && this.holds(pl, v, c)) out.push({ pl, kind: 'multi', card: c, item: t.id, value: v, label: `Build ${v}s: the ${caShort(c)} on ${this.itemName(t)}` });
      }
      if (!this.owns(pl)) out.push({ pl, kind: 'trail', card: c, label: `Trail the ${caShort(c)}` });
      return out;
    },
    prompt0() {
      if (this.stage === 'next') return this.notes.join(' ') + (this.decided ? ' Press See the result.' : ' Press Next deal when you are ready.');
      if (this.stage === 'how') return `What will the ${caName(this.picked)} do?`;
      return this.owns(0) ? 'You own a build, so you may not trail: take, build or raise. Pick a card.' : 'Pick a card to play: to take, to build or to trail.';
    },
    legal(pl) {
      if (this.over) return [];
      if (this.stage === 'next') return pl === 0 ? [{ pl, kind: 'next', label: this.decided ? 'See the result' : 'Next deal' }] : [];
      if (this.toMove !== pl) return [];
      if (this.stage === 'how') return this.plays(pl, this.picked).concat([{ pl, kind: 'back', label: 'Another card' }]);
      const out = [];
      for (const c of this.hands[pl]) {
        const ps = this.plays(pl, c);
        if (ps.length === 1) out.push(Object.assign({}, ps[0], { label: undefined, one: true }));
        else if (ps.length) out.push({ pl, kind: 'pick', card: c });
      }
      // A build owned with no card left to take it: trailing is allowed again rather than leave no play.
      if (!out.length) return this.hands[pl].map(c => ({ pl, kind: 'trail', card: c, one: true }));
      return out;
    },
    apply(m) {
      const pl = m.pl, events = [], Y = !pl;
      if (m.kind === 'next') {
        if (this.decided) { this.over = this.decided; return { note: '' }; }
        this.dealer = 1 - this.dealer; this.deal();
        return { note: `${this.dealer ? 'The Scribe deals; you play first.' : 'You deal; the Scribe plays first.'}`, events: [{ type: 'deal' }] };
      }
      if (m.kind === 'pick') { this.picked = m.card; this.stage = 'how'; return { note: '', events: [{ type: 'pick', card: m.card }] }; }
      if (m.kind === 'back') { this.picked = null; this.stage = 'pick'; return { note: '', events: [{ type: 'pick', card: null }] }; }
      const h = this.hands[pl], c = m.card; h.splice(h.indexOf(c), 1);
      this.picked = null; this.stage = 'pick';
      let note;
      if (m.kind === 'take') {
        const got = this.table.filter(t => m.items.includes(t.id)), cards = [c, ...got.flatMap(t => t.cards)];
        this.table = this.table.filter(t => !m.items.includes(t.id));
        this.piles[pl].push(...cards); this.lastTaker = pl;
        const last = !this.pack.length && !this.hands[0].length && !this.hands[1].length;
        const sweep = !this.table.length && !last && this.variant === 'sweeps';
        if (sweep) this.sweeps[pl]++;
        events.push({ type: 'take', pl, card: c, cards: got.flatMap(t => t.cards), sweep });
        note = `${this.who(pl)} ${Y ? 'take' : 'takes'} ${got.map(t => this.itemName(t)).join(', ')} with the ${caName(c)}${sweep ? ': a sweep!' : '.'}`;
      } else if (m.kind === 'build' || m.kind === 'multi') {
        const t = this.table.find(x => x.id === m.item);
        t.cards.push(c); t.kind = m.kind === 'multi' ? 'multi' : 'build'; t.value = m.value; t.owner = pl;
        events.push({ type: 'build', pl, card: c, item: t.id });
        note = `${this.who(pl)} ${Y ? 'build' : 'builds'} ${m.kind === 'multi' ? m.value + 's' : m.value}.`;
      } else {
        const t = this.loose(c); this.table.push(t);
        events.push({ type: 'trail', pl, card: c });
        note = `${this.who(pl)} ${Y ? 'trail' : 'trails'} the ${caName(c)}.`;
      }
      this.toMove = 1 - pl;
      if (!this.hands[0].length && !this.hands[1].length) {
        if (this.pack.length) { this.dealHands(); events.push({ type: 'deal4' }); this.toMove = 1 - this.dealer; note += ` Four more cards each${this.pack.length ? '' : ', the last of the pack'}.`; }
        else note += ' ' + this.endDeal(events);
      }
      return { note, events };
    },
    endDeal(events) {
      const notes = [];
      if (this.table.length && this.lastTaker >= 0) {
        const cards = this.table.flatMap(t => t.cards); this.piles[this.lastTaker].push(...cards); this.table = [];
        events.push({ type: 'sweepUp', pl: this.lastTaker, cards });
        notes.push(`${this.who(this.lastTaker)} took last, and ${this.lastTaker ? 'takes' : 'take'} what is left.`);
      }
      const P = this.piles, pts = [0, 0], why = [[], []];
      const most = (f, n, what) => { const a = f(P[0]), b = f(P[1]); if (a !== b) { const w = a > b ? 0 : 1; pts[w] += n; why[w].push(what); } };
      most(p => p.length, 3, 'cards'); most(p => p.filter(c => caSuit(c) === 0).length, 1, 'spades');
      for (const pl of [0, 1]) {
        if (P[pl].includes(CA_BIG)) { pts[pl] += 2; why[pl].push('big cassino'); }
        if (P[pl].includes(CA_LITTLE)) { pts[pl] += 1; why[pl].push('little cassino'); }
        const aces = P[pl].filter(c => caRank(c) === 0).length; if (aces) { pts[pl] += aces; why[pl].push(aces + (aces > 1 ? ' aces' : ' ace')); }
        if (this.sweeps[pl]) { pts[pl] += this.sweeps[pl]; why[pl].push(this.sweeps[pl] + (this.sweeps[pl] > 1 ? ' sweeps' : ' sweep')); }
        this.total[pl] += pts[pl];
      }
      notes.push(`You score ${pts[0]}${why[0].length ? ' (' + why[0].join(', ') + ')' : ''}; the Scribe ${pts[1]}${why[1].length ? ' (' + why[1].join(', ') + ')' : ''}. Total: ${this.total[0]} to ${this.total[1]}.`);
      const [a, b] = this.total;
      if ((a >= 21 || b >= 21) && a !== b) { const w = a > b ? 0 : 1; this.decided = { winner: w, title: w ? 'The Scribe wins' : 'You win', text: `${a} to ${b}, after ${this.deals} deal${this.deals > 1 ? 's' : ''}.` }; }
      this.notes = notes; this.stage = 'next'; this.toMove = 0;
      return notes.join(' ');
    },
    passTurn() { return this.over ? 0 : this.toMove; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    /* The Scribe weighs each play: what a take is worth (cards, spades, the cassinos, aces, a sweep), what a
     * build should bring next turn, and what a card left on the table could give away. Sharp also counts the
     * cards it has not seen to judge whether the other player can take what it leaves. */
    cardWorth(c) { return 0.25 + (caSuit(c) === 0 ? 0.3 : 0) + (caRank(c) === 0 ? 1 : 0) + (c === CA_BIG ? 2 : 0) + (c === CA_LITTLE ? 1 : 0); },
    aiPlan(pl = 1) {
      if (this.stage === 'next') return [{ pl: 0, kind: 'next' }];
      const all = this.hands[pl].flatMap(c => this.plays(pl, c));
      if (LEVEL.name === 'gentle' && Math.random() < 0.35) { const takes = all.filter(m => m.kind === 'take'); const pool = takes.length && Math.random() < 0.7 ? takes : all; return this.asPlan(pool[(Math.random() * pool.length) | 0]); }
      const seen = new Set(this.hands[pl].concat(this.table.flatMap(t => t.cards), LEVEL.name === 'sharp' ? this.piles[0].concat(this.piles[1]) : []));
      const unseen = Array.from({ length: 52 }, (_, i) => i).filter(c => !seen.has(c)), oppN = this.hands[1 - pl].length;
      const chance = v => { const k = unseen.filter(c => !caFace(c) && caVal(c) === v).length; return 1 - Math.pow(1 - k / Math.max(1, unseen.length), Math.max(1, oppN)); };
      const score = m => {
        let s = 0;
        if (m.kind === 'take') {
          const got = this.table.filter(t => m.items.includes(t.id)).flatMap(t => t.cards);
          s += [m.card, ...got].reduce((t, c) => t + this.cardWorth(c), 0) + 1;
          if (got.length === this.table.flatMap(t => t.cards).length && this.variant === 'sweeps') s += 1.5;
        } else if (m.kind === 'build' || m.kind === 'multi') {
          const t = this.table.find(x => x.id === m.item), cards = [m.card, ...t.cards];
          s += cards.reduce((a, c) => a + this.cardWorth(c), 0) * 0.85 - chance(m.value) * cards.reduce((a, c) => a + this.cardWorth(c), 0) * 0.6 + 0.4;
        } else {
          s -= this.cardWorth(m.card) * 1.2 + (caFace(m.card) ? 0 : chance(caVal(m.card)) * 0.4) + (caVal(m.card) >= 6 ? 0.1 : 0);
        }
        return s + Math.random() * pick(1.2, 0.3, 0.05);
      };
      return this.asPlan(all.reduce((a, b) => (score(b) > score(a) ? b : a)));
    },
    // A play as the hall needs it: a card with one play is played at once, otherwise picked first.
    asPlan(m) { return this.plays(m.pl, m.card).length === 1 ? [Object.assign({}, m, { label: undefined, one: true })] : [{ pl: m.pl, kind: 'pick', card: m.card }, m]; },
  };

