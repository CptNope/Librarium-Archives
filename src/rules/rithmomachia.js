  /* ---------------------------------------------------------- Rithmomachia
   * An 8 x 16 board: square i = r * 8 + c, with row 0 the visitor's back row.
   * A piece is { pl, shape, v }: shape 'c' round, 't' triangle, 's' square, 'p' pyramid.
   * The opening array is Boissière's (1556), as set out by Richards and Joyner. */
  const RM_STEP = { c: [1], t: [2], s: [3], p: [1, 2, 3] };
  const RM_WIN = 5;
  const RM_HOME = [ // [row, col, shape, value] for the Evens; the Odds' rows are listed from their own back row
    [0, 0, 's', 289], [0, 1, 's', 169], [0, 6, 's', 81], [0, 7, 's', 25],
    [1, 0, 's', 153], [1, 1, 'p', 91], [1, 2, 't', 49], [1, 3, 't', 42], [1, 4, 't', 20], [1, 5, 't', 25], [1, 6, 's', 45], [1, 7, 's', 15],
    [2, 0, 't', 81], [2, 1, 't', 72], [2, 2, 'c', 64], [2, 3, 'c', 36], [2, 4, 'c', 16], [2, 5, 'c', 4], [2, 6, 't', 6], [2, 7, 't', 9],
    [3, 2, 'c', 8], [3, 3, 'c', 6], [3, 4, 'c', 4], [3, 5, 'c', 2]
  ];
  const RM_ODDS = [
    [15, 0, 's', 361], [15, 1, 's', 225], [15, 6, 's', 121], [15, 7, 's', 49],
    [14, 0, 'p', 190], [14, 1, 's', 120], [14, 2, 't', 64], [14, 3, 't', 56], [14, 4, 't', 30], [14, 5, 't', 36], [14, 6, 's', 66], [14, 7, 's', 28],
    [13, 0, 't', 100], [13, 1, 't', 90], [13, 2, 'c', 81], [13, 3, 'c', 49], [13, 4, 'c', 25], [13, 5, 'c', 9], [13, 6, 't', 12], [13, 7, 't', 16],
    [12, 2, 'c', 9], [12, 3, 'c', 7], [12, 4, 'c', 5], [12, 5, 'c', 3]
  ];
  const RM_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const RM_SHAPE = { c: 'round', t: 'triangle', s: 'square', p: 'pyramid' };
  const RITHMO = {
    id: 'rithmo', name: 'Rithmomachia', dice: false, first: 0, WIN: RM_WIN, SHAPE: RM_SHAPE,
    rules: [
      'This is a modern reconstruction: the medieval rules were never fixed. You play the Evens, the white pieces, and move first. Every piece carries a number.',
      'Pieces move straight along a row or a column, never diagonally and never over another piece. Rounds move exactly one square, triangles exactly two and squares exactly three. The pyramid may move one, two or three.',
      'Meeting: move onto an enemy piece of exactly your piece\'s value to take it.',
      'After your move, any enemy piece caught in these ways is taken as well. Assault: one of your pieces, times the number of empty squares between it and the enemy along a row or column, makes the enemy\'s value. Ambuscade: two of your pieces on either side of it, in a row or column, add up to its value. Siege: your pieces or the board\'s edge close it in on all four sides.',
      `The pyramid counts as one piece of its full value: 91 for the Evens, 190 for the Odds. Take the Scribe\'s pyramid, or any ${RM_WIN} of its pieces, to win: victory by bodies, de corpore. A side with no move loses, and after 150 moves each, whoever has taken more wins.`
    ],
    source: 'A modern reconstruction. The array and the moves follow Claude de Boissière\'s book of 1556, as set out by J. F. C. Richards and Jeff Joyner; the four captures are the classic meeting, assault, ambuscade and siege. Pyramids are taken only whole.',
    init() {
      const b = Array(128).fill(null);
      for (const [r, c, shape, v] of RM_HOME) b[r * 8 + c] = { pl: 0, shape, v };
      for (const [r, c, shape, v] of RM_ODDS) b[r * 8 + c] = { pl: 1, shape, v };
      this.b = b; this.taken = [0, 0]; this.ply = 0; this.over = null;
    },
    on: (r, c) => r >= 0 && r < 16 && c >= 0 && c < 8,
    count(pl) { let n = 0; for (const p of this.b) if (p && p.pl === pl) n++; return n; },
    hasPyramid(pl) { return this.b.some(p => p && p.pl === pl && p.shape === 'p'); },
    legal(pl) {
      if (this.over) return [];
      const b = this.b, out = [];
      for (let i = 0; i < 128; i++) {
        const p = b[i]; if (!p || p.pl !== pl) continue;
        const r = i >> 3, c = i & 7;
        for (const [dr, dc] of RM_DIRS) {
          for (let d = 1; d <= 3; d++) {
            const rr = r + dr * d, cc = c + dc * d; if (!this.on(rr, cc)) break;
            const j = rr * 8 + cc, q = b[j];
            if (RM_STEP[p.shape].includes(d)) {
              if (!q) out.push({ pl, from: i, to: j });
              else if (q.pl !== pl && q.v === p.v) out.push({ pl, from: i, to: j, meet: true });
            }
            if (q) break; // nothing leaps
          }
        }
      }
      return out;
    },
    // Enemy pieces that pl now catches by assault, ambuscade or siege.
    caught(pl) {
      const b = this.b, out = [];
      for (let i = 0; i < 128; i++) {
        const e = b[i]; if (!e || e.pl === pl) continue;
        const r = i >> 3, c = i & 7, nb = [];
        let hit = false, closed = true;
        for (const [dr, dc] of RM_DIRS) {
          let k = 0, rr = r + dr, cc = c + dc;
          const first = this.on(rr, cc) ? b[rr * 8 + cc] : undefined;
          nb.push(first);
          if (first === undefined) continue; // the edge closes this side
          if (!first || first.pl !== pl) closed = false;
          while (this.on(rr, cc) && !b[rr * 8 + cc]) { k++; rr += dr; cc += dc; }
          if (k && this.on(rr, cc)) { const q = b[rr * 8 + cc]; if (q.pl === pl && q.v * k === e.v) hit = 'assault'; }
        }
        if (!hit) for (const [a, z] of [[0, 1], [2, 3]]) { const x = nb[a], y = nb[z]; if (x && y && x.pl === pl && y.pl === pl && x.v + y.v === e.v) hit = 'ambuscade'; }
        if (!hit && closed) hit = 'siege';
        if (hit) out.push([i, hit]);
      }
      return out;
    },
    apply(m) {
      const b = this.b, p = b[m.from], notes = [], caps = [];
      const name = (q, mine) => `${mine ? 'your' : 'the Scribe\'s'} ${q.shape === 'p' ? 'pyramid' : RM_SHAPE[q.shape] + ' ' + q.v}`;
      if (m.meet) { const q = b[m.to]; caps.push(m.to); this.taken[m.pl]++; notes.push(`${m.pl ? 'The Scribe meets and takes' : 'You meet and take'} ${name(q, m.pl === 1)}.`); if (q.shape === 'p') this.pyr = true; }
      b[m.to] = p; b[m.from] = null; this.ply++;
      const lost = [];
      for (const [i, how] of this.caught(m.pl)) { lost.push(name(b[i], m.pl === 1) + ` (${how})`); if (b[i].shape === 'p') this.pyr = true; b[i] = null; caps.push(i); this.taken[m.pl]++; }
      if (lost.length) notes.push(`${m.pl ? 'The Scribe takes' : 'You take'} ${lost.join(', ')}.`);
      const you = m.pl === 0;
      if (this.pyr) { this.pyr = false; this.over = { winner: m.pl, text: you ? 'You have taken the Scribe\'s pyramid.' : 'The Scribe has taken your pyramid.' }; }
      else if (this.taken[m.pl] >= RM_WIN) this.over = { winner: m.pl, text: you ? `You have taken ${RM_WIN} of the Scribe's pieces: victory by bodies, de corpore.` : `The Scribe has taken ${RM_WIN} of your pieces.` };
      return { note: notes.join(' '), caps };
    },
    result(pl) {
      if (this.over) return this.over;
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no move left, and lose.' : 'The Scribe has no move left.' };
      if (this.ply >= 300) {
        const [a, z] = this.taken;
        return { winner: a > z ? 0 : z > a ? 1 : -1, text: `A hundred and fifty moves each, and the more pieces taken wins. You took ${a}, the Scribe ${z}.` };
      }
      return null;
    },
    snapshot() { return [this.b.slice(), this.taken.slice(), this.ply, this.over]; },
    restore(s) { this.b = s[0].slice(); this.taken = s[1].slice(); this.ply = s[2]; this.over = s[3]; this.pyr = false; },
    turns(pl) { // meetings first, then moves forward
      const fwd = m => (pl === 0 ? 1 : -1) * ((m.to >> 3) - (m.from >> 3));
      return this.legal(pl).sort((a, b) => (b.meet ? 10 : 0) + fwd(b) - (a.meet ? 10 : 0) - fwd(a)).map(m => [m]);
    },
    terminal(pl, depth) {
      if (this.over) return this.over.winner === pl ? 1000 + depth : -1000 - depth;
      return null;
    },
    evaluate(pl) {
      let s = (this.taken[pl] - this.taken[1 - pl]) * 3;
      for (let i = 0; i < 128; i++) { // a little credit for coming forward into contact
        const p = this.b[i]; if (!p || p.shape === 'p') continue;
        const adv = p.pl === 0 ? (i >> 3) : 15 - (i >> 3);
        s += (p.pl === pl ? 1 : -1) * Math.min(adv, 8) * 0.12;
      }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 3); },
  };

