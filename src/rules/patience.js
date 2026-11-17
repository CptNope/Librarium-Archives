  /* -------------------------------------------------------------- Patience
   * Klondike, the best known of the patience games, and the hall's one table without the Scribe. Cards use the
   * cribbage numbering, suit * 13 + rank, rank 0 the ace; hearts and diamonds (suits 1 and 2) are red. Seven
   * columns (tab), each with its face-down cards first (down[i] of them); the stock, the waste, and four
   * foundations, one for each suit. Places are named 'w' (the waste), 't0'-'t6' and 'f0'-'f3'. */
  const PT_SUIT = ['spades', 'hearts', 'diamonds', 'clubs'];
  const PT_RANK = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
  const ptSuit = c => (c / 13) | 0, ptRank = c => c % 13, ptRed = c => ptSuit(c) === 1 || ptSuit(c) === 2;
  const ptName = c => `${PT_RANK[ptRank(c)]} of ${PT_SUIT[ptSuit(c)]}`;
  const PATIENCE = {
    id: 'patience', name: 'Patience', dice: false, solo: true, first: 0, cardName: ptName,
    variants: [{ id: 'one', label: 'Draw one' }, { id: 'three', label: 'Draw three' }], variant: 'one', variantLabel: 'Stock',
    setVariant(id) { this.variant = id === 'three' ? 'three' : 'one'; },
    get followPrompt() { return this.prompt0(); },
    rules: [
      'Klondike, played alone. Twenty-eight cards are dealt in seven columns, one to seven cards each, the top card of each face up. The rest are the stock.',
      'Build the four foundations up by suit from the ace to the king. Pick a card, then the place it goes; a card with only one place to go goes there at once.',
      'In the columns, build down in alternating colours: a red six on a black seven. You may move any face-up run together. When a column\'s face-up cards are gone, its next card turns over; only a king (with any run below it) may go into an empty column.',
      'Click the stock to turn a card (or three, in Draw three) onto the waste; its top card can be played. When the stock runs out, turn the waste over and go through it again, as often as you like. You can also take a card back down from a foundation.',
      'You win when all fifty-two cards are on the foundations. Once every card is face up and the stock is spent, the rest go up by themselves.'
    ],
    source: 'Klondike as usually played, with unlimited passes through the stock. Undo and Hint are open to you; there is no Scribe at this table.',
    init() { this.over = null; this.deal(); },
    deal() {
      const d = Array.from({ length: 52 }, (_, i) => i);
      for (let i = 51; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
      this.tab = []; this.down = []; let k = 0;
      for (let i = 0; i < 7; i++) { this.tab.push(d.slice(k, k + i + 1)); this.down.push(i); k += i + 1; }
      this.stock = d.slice(k); this.waste = []; this.found = [[], [], [], []];
      this.moves = 0; this.passes = 0; this.idle = 0; this.toMove = 0;
    },
    get onFound() { return this.found.reduce((t, f) => t + f.length, 0); },
    pile(p) { return p === 'w' ? this.waste : p[0] === 't' ? this.tab[+p[1]] : this.found[+p[1]]; },
    // Where a card (with n - 1 cards on top of it) may go.
    fitsTab(c, i) { const col = this.tab[i]; if (!col.length) return ptRank(c) === 12; const top = col[col.length - 1]; return this.down[i] < col.length && ptRed(top) !== ptRed(c) && ptRank(top) === ptRank(c) + 1; },
    fitsFound(c) { const f = this.found[ptSuit(c)]; return f.length ? ptRank(f[f.length - 1]) === ptRank(c) - 1 : ptRank(c) === 0; },
    stuck() { return this.idle > this.stock.length + this.waste.length; }, // a whole pass through the stock without another move
    prompt0() {
      if (this.stuck()) return 'A whole pass through the stock and nothing to play. Undo a few moves, or give up and deal again.';
      return `${this.onFound} of 52 cards on the foundations. Pick a card to move, or click the stock.`;
    },
    legal(pl) {
      if (this.over || pl !== 0) return [];
      const out = [];
      const add = (from, n, card) => {
        if (n === 1 && from[0] !== 'f' && this.fitsFound(card)) out.push({ pl, kind: 'move', from, n, to: 'f' + ptSuit(card), card });
        for (let i = 0; i < 7; i++) if ('t' + i !== from && this.fitsTab(card, i) && !(ptRank(card) === 12 && from[0] === 't' && this.tab[+from[1]].length === n && this.down[+from[1]] === 0 && !this.tab[i].length)) out.push({ pl, kind: 'move', from, n, to: 't' + i, card });
      };
      if (this.waste.length) add('w', 1, this.waste[this.waste.length - 1]);
      for (let i = 0; i < 7; i++) { const col = this.tab[i]; for (let j = this.down[i]; j < col.length; j++) add('t' + i, col.length - j, col[j]); }
      for (let s = 0; s < 4; s++) if (this.found[s].length) { const c = this.found[s][this.found[s].length - 1]; for (let i = 0; i < 7; i++) if (this.tab[i].length && this.fitsTab(c, i)) out.push({ pl, kind: 'move', from: 'f' + s, n: 1, to: 't' + i, card: c }); }
      if (this.stock.length) out.push({ pl, kind: 'draw', card: this.stock[this.stock.length - 1] });
      else if (this.waste.length) out.push({ pl, kind: 'recycle', label: 'Turn the waste over' });
      out.push({ pl, kind: 'giveup', label: 'Give up' });
      return out;
    },
    apply(m) {
      const events = [];
      if (m.kind === 'giveup') {
        this.over = { winner: 1, title: 'The cards won this time', text: `${this.onFound} of 52 cards reached the foundations, in ${this.moves} moves.` };
        return { note: '', events };
      }
      if (m.kind === 'draw') {
        const n = this.variant === 'three' ? Math.min(3, this.stock.length) : 1, cards = [];
        for (let k = 0; k < n; k++) { const c = this.stock.pop(); this.waste.push(c); cards.push(c); }
        this.idle++; this.moves++; events.push({ type: 'draw', cards });
        return { note: '', events };
      }
      if (m.kind === 'recycle') {
        this.stock = this.waste.reverse(); this.waste = []; this.passes++; this.moves++;
        events.push({ type: 'recycle' });
        return { note: `The waste goes back face down: pass ${this.passes + 1}.`, events };
      }
      const src = this.pile(m.from), cards = src.splice(src.length - m.n, m.n), dst = this.pile(m.to);
      dst.push(...cards); this.moves++; this.idle = 0;
      events.push({ type: 'move', cards, from: m.from, to: m.to });
      let note = m.to[0] === 'f' ? `The ${ptName(cards[0])} goes up.` : '';
      if (m.from[0] === 't') { const i = +m.from[1]; if (this.down[i] && this.down[i] >= this.tab[i].length) { this.down[i] = this.tab[i].length - 1; events.push({ type: 'flip', col: i, card: this.tab[i][this.tab[i].length - 1] }); } }
      this.finishOff(events);
      if (this.onFound === 52) { this.over = { winner: 0, title: 'Patience is rewarded', text: `All fifty-two cards up, in ${this.moves} moves${this.passes ? ` and ${this.passes + 1} passes through the stock` : ''}.` }; note = ''; }
      return { note, events };
    },
    // With every card face up and the stock and waste spent, nothing can go wrong: put everything up.
    finishOff(events) {
      if (this.stock.length || this.waste.length || this.down.some(d => d) || this.onFound === 52) return;
      let moved = true;
      while (moved) {
        moved = false;
        for (let i = 0; i < 7; i++) {
          const col = this.tab[i]; if (!col.length) continue; const c = col[col.length - 1];
          if (this.fitsFound(c)) { col.pop(); this.found[ptSuit(c)].push(c); events.push({ type: 'move', cards: [c], from: 't' + i, to: 'f' + ptSuit(c), auto: true }); moved = true; }
        }
      }
    },
    passTurn() { return 0; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return null; },
    // For the Hint button: a card up to a foundation, then a move that turns over a hidden card, then the waste, then the stock.
    aiPlan(pl = 0) {
      const ms = this.legal(0), score = m => {
        if (m.kind === 'giveup') return -100;
        if (m.kind === 'recycle') return -5;
        if (m.kind === 'draw') return -1;
        if (m.from[0] === 'f') return -50;
        let v = 0; const src = this.pile(m.from);
        if (m.to[0] === 'f') v += 30 - ptRank(m.card);
        if (m.from[0] === 't') { const i = +m.from[1], left = src.length - m.n; if (left > 0 && this.down[i] >= left) v += 25 + this.down[i]; if (left === 0 && this.down[i] === 0 && m.to[0] === 't' && !this.tab[+m.to[1]].length) v -= 40; if (left === 0 && m.to[0] === 't') v += 4; }
        if (m.from === 'w') v += 12;
        if (m.to[0] === 't' && m.from[0] === 't' && !(this.down[+m.from[1]] >= src.length - m.n)) v -= 8; // shuffling runs between columns for nothing
        return v;
      };
      return [ms.reduce((a, b) => (score(b) > score(a) ? b : a))];
    },
  };

