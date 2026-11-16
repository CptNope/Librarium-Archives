  /* ---------------------------------------------------------------- Tarocchi
   * A 78-card tarot pack: cards 0-55 are the four suits (suit*14 + rank-1;
   * ranks 1-10, then Jack 11, Knight 12, Queen 13, King 14), 56-76 are the
   * trumps I-XXI, and 77 is the Fool. Two players, thirteen cards each. */
  const TC_FOOL = 77, TC_N = 13;
  const tcSuit = c => (c < 56 ? (c / 14) | 0 : c < 77 ? 4 : 5); // 4 trumps, 5 the Fool
  const tcRank = c => (c < 56 ? (c % 14) + 1 : c < 77 ? c - 55 : 0);
  // Card points: kings 5, queens 4, knights 3, jacks 2, and 5 for the three great trumps (I, XXI and the Fool).
  const tcPts = c => (c === 56 || c === 76 || c === TC_FOOL ? 5 : c < 56 && (c % 14) + 1 > 10 ? (c % 14) + 1 - 9 : 0);
  const TAROCCHI = {
    id: 'tarocchi', name: 'Tarocchi', dice: false, first: 0, FOOL: TC_FOOL, suit: tcSuit, rank: tcRank, points: tcPts,
    followPrompt: 'You won the trick, so you lead the next card.',
    rules: [
      'Each player holds thirteen cards. You lead the first trick; whoever wins a trick leads the next.',
      'Follow the suit that was led if you can. If you cannot, you must play a trump if you have one. Otherwise play anything.',
      'The highest trump wins the trick; with no trump in it, the highest card of the suit led wins. In the suits, the king is highest, then the queen, knight and jack, then 10 down to 1.',
      'The Fool can be played at any time instead of following. It never wins a trick, but you keep it for its points. If you lead the Fool, the other player\'s card wins.',
      'At the end, count your cards: kings 5, queens 4, knights 3, jacks 2, and trumps I and XXI and the Fool 5 each. Each trick you won adds 1. The higher total wins.'
    ],
    source: 'The rules of the first tarocchi games, played in Milan and Ferrara in the 1440s, were never written down. This is a simplified two-player game built on what every tarot game still shares: following suit, the duty to trump, and the Fool as an excuse. In old Italian packs the pip cards of cups and coins ranked in reverse; here every suit ranks the same way.',
    init(deal) {
      const deck = deal ? deal.slice() : Array.from({ length: 78 }, (_, i) => i);
      if (!deal) for (let i = deck.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [deck[i], deck[j]] = [deck[j], deck[i]]; }
      this.hands = [deck.slice(0, TC_N).sort((a, b) => a - b), deck.slice(TC_N, 2 * TC_N).sort((a, b) => a - b)];
      this.trick = []; this.leader = 0; this.toMove = 0;
      this.won = [[], []]; this.tricks = [0, 0]; this.played = [];
      this.void = [[false, false, false, false, false], [false, false, false, false, false]]; // what each player has shown they lack
    },
    // Which suit must be followed: the first card that is not the Fool.
    ledSuit() { const c = this.trick.find(t => t.card !== TC_FOOL); return c ? tcSuit(c.card) : -1; },
    legalCards(hand) {
      const led = this.ledSuit();
      if (led < 0) return hand.slice();
      const follow = hand.filter(c => tcSuit(c) === led);
      let ok = follow.length ? follow : hand.filter(c => tcSuit(c) === 4);
      if (!ok.length) ok = hand.slice();
      if (hand.includes(TC_FOOL) && !ok.includes(TC_FOOL)) ok = ok.concat([TC_FOOL]);
      return ok;
    },
    legal(pl) { if (pl !== this.toMove) return []; return this.legalCards(this.hands[pl]).map(card => ({ pl, card })); },
    beats(a, b, led) { // does card a beat card b, with suit led?
      if (a === TC_FOOL) return false; if (b === TC_FOOL) return true;
      const sa = tcSuit(a), sb = tcSuit(b);
      if (sa === 4 || sb === 4) return sa === 4 && (sb !== 4 || tcRank(a) > tcRank(b));
      if (sa !== sb) return sa === led;
      return tcRank(a) > tcRank(b);
    },
    trickWinner() {
      const led = this.ledSuit(); let best = this.trick[0];
      for (const t of this.trick.slice(1)) if (this.beats(t.card, best.card, led)) best = t;
      if (best.card === TC_FOOL) best = this.trick.find(t => t.card !== TC_FOOL) || best;
      return best.pl;
    },
    apply(m) {
      const hand = this.hands[m.pl], led = this.ledSuit();
      hand.splice(hand.indexOf(m.card), 1);
      if (led >= 0 && m.card !== TC_FOOL && tcSuit(m.card) !== led) { this.void[m.pl][led] = true; if (tcSuit(m.card) !== 4) this.void[m.pl][4] = true; }
      this.trick.push({ pl: m.pl, card: m.card }); this.played.push(m.card);
      if (this.trick.length < 2) { this.toMove = 1 - m.pl; return { note: '' }; }
      const w = this.trickWinner(), cards = this.trick.map(t => t.card);
      for (const t of this.trick) { if (t.card === TC_FOOL) this.won[t.pl].push(TC_FOOL); else this.won[w].push(t.card); }
      this.tricks[w]++; this.trick = []; this.leader = w; this.toMove = w;
      const pts = cards.reduce((n, c) => n + (c === TC_FOOL ? 0 : tcPts(c)), 0) + 1;
      const note = w === 0 ? `You take the trick (${pts} point${pts === 1 ? '' : 's'}).` : `The Scribe takes the trick (${pts} point${pts === 1 ? '' : 's'}).`;
      const out = { note, trick: cards, winner: w };
      if (w === m.pl && this.hands[m.pl].length) out.followUp = this.legal(m.pl);
      return out;
    },
    score(pl) { return this.won[pl].reduce((n, c) => n + tcPts(c), 0) + this.tricks[pl]; },
    result() {
      if (this.hands[0].length || this.hands[1].length || this.trick.length) return null;
      const a = this.score(0), b = this.score(1);
      return { winner: a > b ? 0 : b > a ? 1 : -1, text: a === b ? `${a} points each. The game is drawn.` : `You ${a} points, the Scribe ${b}.` };
    },
    snapshot() { return JSON.stringify({ h: this.hands, t: this.trick, l: this.leader, m: this.toMove, w: this.won, k: this.tricks, p: this.played, v: this.void }); },
    restore(s) { const o = JSON.parse(s); this.hands = o.h; this.trick = o.t; this.leader = o.l; this.toMove = o.m; this.won = o.w; this.tricks = o.k; this.played = o.p; this.void = o.v; },
    // A sensible card for pl to play now: win a trick worth taking as cheaply as possible, otherwise throw the least useful card.
    heuristic(pl) {
      const ms = this.legalCards(this.hands[pl]);
      const val = c => (c === TC_FOOL ? 0 : tcPts(c) * 3 + (tcSuit(c) === 4 ? 2 + tcRank(c) / 10 : tcRank(c) / 14));
      if (!this.trick.length) {
        // Leading: a plain low card from a suit, keeping honours and trumps back.
        const plain = ms.filter(c => c !== TC_FOOL && tcSuit(c) < 4 && tcPts(c) === 0);
        const pool = plain.length ? plain : ms.filter(c => c !== TC_FOOL).length ? ms.filter(c => c !== TC_FOOL) : ms;
        return pool.reduce((a, b) => (val(b) < val(a) ? b : a));
      }
      const first = this.trick[0].card, led = this.ledSuit(), onTable = tcPts(first);
      const winners = ms.filter(c => first === TC_FOOL ? c !== TC_FOOL : this.beats(c, first, led));
      if (winners.length && (onTable > 0 || winners.some(c => tcSuit(c) !== 4 || tcRank(c) < 12))) {
        // Take it with the cheapest winning card; a point card is worth spending only to win points.
        return winners.reduce((a, b) => (val(b) < val(a) ? b : a));
      }
      if (ms.includes(TC_FOOL) && onTable >= 3 && !winners.length) return TC_FOOL; // save points with the excuse
      const losers = ms.filter(c => c !== TC_FOOL);
      return (losers.length ? losers : ms).reduce((a, b) => (val(b) < val(a) ? b : a));
    },
    // Sharp: deal the unseen cards out at random many times, consistent with what the visitor has shown,
    // play each deal to the end with the heuristic, and pick the card that scores best on average.
    sample(pl) {
      const opp = 1 - pl, mine = new Set(this.hands[pl]), seen = new Set(this.played);
      const unseen = []; for (let c = 0; c < 78; c++) if (!mine.has(c) && !seen.has(c)) unseen.push(c);
      for (let tries = 0; tries < 20; tries++) {
        for (let i = unseen.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [unseen[i], unseen[j]] = [unseen[j], unseen[i]]; }
        const hand = [], rest = [];
        for (const c of unseen) { if (hand.length < this.hands[opp].length && !(c !== TC_FOOL && this.void[opp][tcSuit(c)])) hand.push(c); else rest.push(c); }
        if (hand.length === this.hands[opp].length) return hand;
      }
      return unseen.slice(0, this.hands[opp].length);
    },
    aiPlan(pl, budget) {
      const plan = [];
      const pickOne = () => {
        const ms = this.legalCards(this.hands[pl]);
        if (ms.length === 1) return ms[0];
        if (LEVEL.name === 'gentle') return Math.random() < 0.5 ? ms[(Math.random() * ms.length) | 0] : this.heuristic(pl);
        if (LEVEL.name === 'fair') return this.heuristic(pl);
        const t0 = Date.now(), limit = budget || BUDGET_MS.sharp, root = this.snapshot(), real = this.hands[1 - pl];
        const total = new Map(ms.map(c => [c, 0])); let deals = 0;
        while (Date.now() - t0 < limit && deals < 400) {
          this.restore(root); // sample from the real position, not the last playout's end
          const guess = this.sample(pl);
          for (const c of ms) {
            this.restore(root); this.hands[1 - pl] = guess.slice();
            this.apply({ pl, card: c });
            while (!this.result()) { const who = this.toMove; this.apply({ pl: who, card: this.heuristic(who) }); }
            total.set(c, total.get(c) + this.score(pl) - this.score(1 - pl));
          }
          deals++;
        }
        this.restore(root); this.hands[1 - pl] = real;
        return [...total].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
      };
      // The Scribe keeps playing while it is still its turn: answering a trick and, if it wins, leading the next.
      const root = this.snapshot();
      do { const card = pickOne(); plan.push({ pl, card }); this.apply({ pl, card }); } while (this.toMove === pl && this.hands[pl].length && !this.result());
      this.restore(root);
      return plan;
    },
  };

