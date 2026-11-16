  /* --------------------------------------------------------- Nine Men's Morris
   * 24 points on three nested squares. Each ring is numbered clockwise from its
   * top-left corner: 0 TL, 1 top, 2 TR, 3 right, 4 BR, 5 bottom, 6 BL, 7 left;
   * ring r adds 8*r (0 outer, 1 middle, 2 inner). */
  const MORRIS_ADJ = (() => {
    const adj = Array.from({ length: 24 }, () => []);
    const link = (a, b) => { adj[a].push(b); adj[b].push(a); };
    for (let r = 0; r < 3; r++) for (let k = 0; k < 8; k++) link(r * 8 + k, r * 8 + (k + 1) % 8);
    for (const k of [1, 3, 5, 7]) { link(k, k + 8); link(k + 8, k + 16); }
    return adj;
  })();
  const MORRIS_MILLS = (() => {
    const m = [];
    for (let r = 0; r < 3; r++) for (const k of [0, 2, 4, 6]) m.push([r * 8 + k, r * 8 + k + 1, r * 8 + (k + 2) % 8]);
    for (const k of [1, 3, 5, 7]) m.push([k, k + 8, k + 16]);
    return m;
  })();
  const MORRIS = {
    id: 'morris', name: "Nine Men's Morris", dice: false, first: 0, N: 9,
    rules: [
      'Take turns placing your nine pieces on empty points.',
      'Three of your pieces in a row along a drawn line make a mill. Each new mill lets you remove one of the Scribe\'s pieces. Pieces in a mill are protected unless every piece is in one.',
      'Once every piece is placed, move one piece along a line to a neighboring empty point.',
      'When you are down to three pieces, you may fly to any empty point.',
      'You lose when you have two pieces left or cannot move. A long stretch with no captures is a draw.'
    ],
    source: 'Traditional rules, as played across Europe since the Middle Ages.',
    followPrompt: 'Pick one of the Scribe\'s pieces to remove.',
    ADJ: MORRIS_ADJ, MILLS: MORRIS_MILLS,
    init() { this.board = Array(24).fill(-1); this.hand = [this.N, this.N]; this.quiet = 0; },
    onBoard(pl) { let n = 0; for (const v of this.board) if (v === pl) n++; return n; },
    count(pl) { return this.hand[pl] + this.onBoard(pl); },
    inMill(p, pl) { return this.MILLS.some(m => m.includes(p) && m.every(q => this.board[q] === pl)); },
    legal(pl) {
      const b = this.board, out = [];
      if (this.hand[pl] > 0) { for (let p = 0; p < 24; p++) if (b[p] < 0) out.push({ type: 'place', pl, to: p }); return out; }
      const fly = this.onBoard(pl) === 3;
      for (let p = 0; p < 24; p++) {
        if (b[p] !== pl) continue;
        const targets = fly ? b.map((v, q) => (v < 0 ? q : -1)).filter(q => q >= 0) : this.ADJ[p].filter(q => b[q] < 0);
        for (const q of targets) out.push({ type: 'move', pl, from: p, to: q, fly });
      }
      return out;
    },
    removals(pl) {
      const opp = 1 - pl, pts = [];
      for (let p = 0; p < 24; p++) if (this.board[p] === opp) pts.push(p);
      const free = pts.filter(p => !this.inMill(p, opp));
      return (free.length ? free : pts).map(p => ({ type: 'remove', pl, at: p }));
    },
    apply(m) {
      const b = this.board;
      if (m.type === 'remove') {
        b[m.at] = -1; this.quiet = 0;
        return { note: m.pl === 0 ? 'You remove one of the Scribe\'s pieces.' : 'The Scribe removes one of your pieces.' };
      }
      if (m.type === 'place') { b[m.to] = m.pl; this.hand[m.pl]--; } else { b[m.from] = -1; b[m.to] = m.pl; }
      this.quiet++;
      if (this.inMill(m.to, m.pl)) {
        const f = this.removals(m.pl);
        if (f.length) return { note: m.pl === 0 ? 'A mill.' : 'The Scribe makes a mill.', followUp: f };
      }
      return { note: '' };
    },
    result(pl) {
      for (const p of [0, 1]) if (this.count(p) < 3) return { winner: 1 - p, text: p === 0 ? 'You are down to two pieces.' : 'The Scribe is down to two pieces.' };
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no legal move.' : 'The Scribe has no legal move.' };
      if (this.quiet >= 120) return { winner: -1, text: 'A long stretch with no captures. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.board.slice(), this.hand.slice(), this.quiet]; },
    restore(s) { this.board = s[0].slice(); this.hand = s[1].slice(); this.quiet = s[2]; },
    turns(pl) {
      const out = [];
      for (const m of this.legal(pl)) {
        const s = this.snapshot(); const r = this.apply(m); this.restore(s);
        if (r.followUp) for (const f of r.followUp) out.push([m, f]); else out.push([m]);
      }
      // Mills and blocks first, so alpha-beta prunes more.
      return out.sort((a, b) => b.length - a.length);
    },
    terminal(pl, depth) {
      const r = this.result(pl);
      if (!r) return null;
      return r.winner === -1 ? 0 : r.winner === pl ? 1000 + depth : -1000 - depth;
    },
    evaluate(pl) {
      const opp = 1 - pl;
      let s = (this.count(pl) - this.count(opp)) * 12;
      for (const mill of this.MILLS) {
        let a = 0, o = 0, e = 0;
        for (const q of mill) { const v = this.board[q]; if (v === pl) a++; else if (v === opp) o++; else e++; }
        if (a === 2 && e === 1) s += 3; if (o === 2 && e === 1) s -= 3;
        if (a === 3) s += 1; if (o === 3) s -= 1;
      }
      if (!this.hand[pl] && !this.hand[opp]) s += (this.legal(pl).length - this.legal(opp).length) * 0.4;
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

