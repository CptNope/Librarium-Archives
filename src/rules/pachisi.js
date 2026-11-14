  /* ----------------------------------------------------------------- Pachisi
   * A cross of four arms (0 near, 1 right, 2 far, 3 left: anticlockwise seen
   * from above), each 3 columns wide and 8 squares long, round the Charkoni.
   * A cell is arm*24 + k*3 + (j+1): k counts out from the centre (0-7), j is
   * -1, 0 or +1 across the arm, +1 being the side toward the next arm.
   * Each piece's route has 84 steps: 0 is the Charkoni before it sets out,
   * 1-83 the squares, 84 home again. Two players: the visitor plays the near
   * and far colours (partners), the Scribe the left and right. */
  const PC_HOME = 84;
  const pcCell = (a, k, j) => (((a % 4) + 4) % 4) * 24 + k * 3 + (j + 1);
  const PC_ROUTE = [0, 1, 2, 3].map(a => {
    const r = [null];
    for (let k = 0; k <= 7; k++) r.push(pcCell(a, k, 0));
    for (let k = 7; k >= 0; k--) r.push(pcCell(a, k, 1));
    for (let n = 1; n <= 3; n++) { const b = a + n; for (let k = 0; k <= 7; k++) r.push(pcCell(b, k, -1)); r.push(pcCell(b, 7, 0)); for (let k = 7; k >= 0; k--) r.push(pcCell(b, k, 1)); }
    for (let k = 0; k <= 7; k++) r.push(pcCell(a, k, -1));
    r.push(pcCell(a, 7, 0));
    for (let k = 6; k >= 0; k--) r.push(pcCell(a, k, 0));
    return r; // r[84] is undefined: home
  });
  const pcCastle = cell => { const k = ((cell % 24) / 3) | 0, j = (cell % 3) - 1; return (k === 7 && j === 0) || (k === 4 && j !== 0); };
  const PC_ARMS = [[0, 2], [1, 3]]; // the visitor's two colours, the Scribe's two
  const PC_VAL = [25, 10, 2, 3, 4, 5, 6]; // by the number of cowries landing mouth up
  const PACHISI = {
    id: 'pachisi', name: 'Pachisi', dice: true, N: 4, first: 0, HOME: PC_HOME, ROUTE: PC_ROUTE, castle: pcCastle, ARMS: PC_ARMS,
    sides: ['yellow and blue pieces', 'green and cream pieces'],
    variants: [{ id: 'short', label: 'Short game' }, { id: 'full', label: 'Full game' }],
    variant: 'short', variantLabel: 'Pieces',
    per: 2, // pieces per colour: 2 in the short game, 4 in the full one
    setVariant(id) { this.variant = id === 'full' ? 'full' : 'short'; this.per = this.variant === 'full' ? 4 : 2; this.N = 2 * this.per; },
    rules: [
      'You play two colours as partners: yellow, from the near arm, and blue, from the far arm. The Scribe plays green and cream.',
      'Throw six cowries and count those landing mouth up: 2, 3, 4 or 5 move that many squares; one up is 10, none is 25 and all six is 6. A 6, 10 or 25 is a grace: it can bring a piece out of the Charkoni onto the first square, and it earns another throw.',
      'Each piece goes down the middle of its own arm, anticlockwise round the outside of the cross, and back up its own middle into the Charkoni, which needs an exact throw. No throw is 1, so a piece may not stop on the last square before home.',
      'Land on an enemy piece to send it back to the Charkoni, and throw again. Pieces on the twelve castle squares, marked with a cross, are safe, and you may not land on a castle held by the enemy.',
      'Bring all your pieces home first to win. The short game gives each colour two pieces, the full game four.'
    ],
    source: 'The common rules with six cowries (pachisi has no single standard). As in some versions, each colour\'s first piece may come out on any throw; later ones need a grace. Each throw is moved at once rather than collected first, and the short game uses two pieces per colour so it fits a visit to the Archives.',
    init() { this.pos = [Array(this.N).fill(0), Array(this.N).fill(0)]; },
    arm(pl, i) { return PC_ARMS[pl][i < this.per ? 0 : 1]; },
    cellOf(pl, i, idx) { return idx <= 0 || idx >= PC_HOME ? -1 : PC_ROUTE[this.arm(pl, i)][idx]; },
    roll() {
      const f = [0, 0, 0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0)), n = f.reduce((a, b) => a + b, 0);
      return { faces: f, value: PC_VAL[n] };
    },
    rollName: r => `${r.value}${[6, 10, 25].includes(r.value) ? ', a grace' : ''}`,
    grace: v => v === 6 || v === 10 || v === 25,
    enemiesAt(pl, cell) { const out = []; this.pos[1 - pl].forEach((q, k) => { if (this.cellOf(1 - pl, k, q) === cell) out.push(k); }); return out; },
    legal(pl, v) {
      const moves = [], seen = new Set();
      this.pos[pl].forEach((p, i) => {
        if (p === PC_HOME) return;
        const key = this.arm(pl, i) + ':' + p; if (seen.has(key)) return; seen.add(key);
        let to;
        if (p === 0) {
          // A colour's first piece out may use any throw; after that, coming out needs a grace.
          const colourOut = this.pos[pl].some((q, k) => k !== i && this.arm(pl, k) === this.arm(pl, i) && q !== 0);
          if (colourOut && !this.grace(v)) return;
          to = 1;
        } else to = p + v;
        if (to > PC_HOME || to === PC_HOME - 1) return; // no throw is 1, so the last square before home is a dead end
        const cell = this.cellOf(pl, i, to), foes = cell < 0 ? [] : this.enemiesAt(pl, cell);
        if (foes.length && pcCastle(cell)) return; // an enemy castle cannot be entered
        moves.push({ pl, i, from: p, to, cap: foes, value: v });
      });
      return moves;
    },
    steps(m) { const s = []; for (let k = Math.max(1, m.from + 1); k <= m.to; k++) s.push(k); return s.length ? s : [m.to]; },
    apply(m) {
      this.pos[m.pl][m.i] = m.to; const moved = [];
      for (const k of m.cap) { this.pos[1 - m.pl][k] = 0; moved.push({ pl: 1 - m.pl, i: k }); }
      let note = '';
      if (m.cap.length) note = m.pl === 0 ? `Captured! ${m.cap.length > 1 ? 'Those pieces go' : 'The piece goes'} back to the Charkoni.` : 'The Scribe sends your piece back to the Charkoni.';
      else if (m.to === PC_HOME) note = m.pl === 0 ? 'Home in the Charkoni.' : 'The Scribe brings a piece home.';
      else if (m.from === 0) note = m.pl === 0 ? 'A piece comes out.' : 'The Scribe brings a piece out.';
      return { moved, note };
    },
    extra(m) { return this.grace(m.value) || m.cap.length > 0; },
    extraNote: 'Throw again.',
    done(pl) { return this.pos[pl].every(p => p === PC_HOME); },
    home(pl) { return this.pos[pl].filter(p => p === PC_HOME).length; },
    danger(pl, i, idx) { // chance an enemy can land here next throw
      const cell = this.cellOf(pl, i, idx); if (cell < 0 || pcCastle(cell)) return 0;
      const P = { 2: 0.234, 3: 0.312, 4: 0.234, 5: 0.094, 6: 0.016, 10: 0.094, 25: 0.016 };
      let d = 0;
      this.pos[1 - pl].forEach((q, k) => { if (q <= 0 || q >= PC_HOME) return; for (const v in P) if (this.cellOf(1 - pl, k, q + +v) === cell) d += P[v]; });
      return Math.min(1, d);
    },
    ai(moves) {
      let best = moves[0], bs = -1e9;
      for (const m of moves) {
        let s = (m.to - Math.max(0, m.from)) * 0.4;
        if (m.from === 0) s += 14;
        if (m.to === PC_HOME) s += 40;
        s += m.cap.reduce((a, k) => a + 20 + this.pos[1 - m.pl][k] * 0.5, 0);
        const cell = this.cellOf(m.pl, m.i, m.to);
        if (cell >= 0 && pcCastle(cell)) s += 8;
        s -= this.danger(m.pl, m.i, m.to) * (12 + m.to * 0.35);
        if (m.from > 0) s += this.danger(m.pl, m.i, m.from) * (10 + m.from * 0.3);
        s += Math.random() * pick(30, 5, 0.5);
        if (s > bs) { bs = s; best = m; }
      }
      return best;
    },
    aiPlan(pl, moves) { return [this.ai(moves)]; },
  };

