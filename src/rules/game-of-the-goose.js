  /* ------------------------------------------------------- Game of the Goose
   * A race along a spiral of 63 squares with two dice. Each player has one
   * piece; pos[pl][0] is its square (0 = not yet on the board). */
  const GOOSE_SQ = new Set([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);
  const GOOSE = {
    id: 'goose', name: 'The Game of the Goose', dice: true, pipDice: true, autoMove: true, first: 0, N: 1,
    sides: ['gold piece', 'silver piece'],
    rules: [
      'Throw two dice and move your piece that many squares along the spiral. The first to land exactly on 63 wins; overshoot and you bounce back.',
      'Land on a goose and you fly on again by the same throw.',
      'Throwing 9 from the start would ride the geese all the way home, so 6 and 3 takes you to 26 and 5 and 4 to 53 instead.',
      'The Bridge (6) carries you to 12. The Maze (42) sends you back to 39. Death (58) sends you back to the start.',
      'The Inn (19) costs one turn, the Well (31) two and the Prison (52) three.',
      'Land on the other player\'s square and you swap places with them.'
    ],
    source: 'The traditional squares. In the old game the Well and the Prison held a player until someone else landed there; with only two players we use a set number of turns instead.',
    init() { this.pos = [[0], [0]]; this.skip = [0, 0]; this.fresh = [true, true]; },
    roll() { const a = 1 + ((Math.random() * 6) | 0), b = 1 + ((Math.random() * 6) | 0); return { faces: [a, b], value: a + b }; },
    who: pl => (pl === 0 ? 'You' : 'The Scribe'),
    skipTurn(pl) {
      if (!this.skip[pl]) return '';
      this.skip[pl]--;
      const where = this.pos[pl][0] === 19 ? 'the Inn' : this.pos[pl][0] === 31 ? 'the Well' : 'the Prison';
      return pl === 0 ? `You are still in ${where} and miss this turn.` : `The Scribe is still in ${where} and misses a turn.`;
    },
    plan(pl, roll) {
      const from = this.pos[pl][0], v = roll.value, notes = [], path = [];
      const you = pl === 0 ? 'you' : 'the Scribe', miss = n => (pl === 0 ? `miss ${n}` : `the Scribe misses ${n}`);
      let at = from, dir = 1;
      const walk = n => {
        for (let k = 0; k < n; k++) {
          if (at === 63) dir = -1;
          at += dir; path.push(at);
        }
      };
      let skip = 0;
      // With a goose every nine squares, a 9 from the start would fly all the way home,
      // so the old rules send it to 26 or 53 instead, whenever the piece is at the start.
      if (from === 0 && roll.faces.includes(6) && roll.faces.includes(3)) { at = 26; path.push(26); notes.push('6 and 3 from the start: straight to 26.'); }
      else if (from === 0 && roll.faces.includes(5) && roll.faces.includes(4)) { at = 53; path.push(53); notes.push('5 and 4 from the start: straight to 53.'); }
      else {
        walk(v);
        for (let guard = 0; GOOSE_SQ.has(at) && guard < 10; guard++) { notes.push('A goose! On again by ' + v + '.'); walk(v); }
      }
      if (at === 6) { at = 12; path.push(12); notes.push(`The Bridge carries ${you} to 12.`); }
      else if (at === 42) { at = 39; path.push(39); notes.push('Lost in the Maze: back to 39.'); }
      else if (at === 58) { at = 0; path.push(0); notes.push('Death! Back to the start.'); }
      else if (at === 19) { skip = 1; notes.push(`A night at the Inn: ${miss('a turn')}.`); }
      else if (at === 31) { skip = 2; notes.push(`Down the Well: ${miss('two turns')}.`); }
      else if (at === 52) { skip = 3; notes.push(`Into the Prison: ${miss('three turns')}.`); }
      else if (at === 63) notes.push(pl === 0 ? 'Home to the garden at 63!' : 'The Scribe reaches 63.');
      const opp = 1 - pl, swap = at > 0 && at < 63 && this.pos[opp][0] === at;
      if (swap) notes.push(pl === 0 ? 'You land on the Scribe and swap places.' : 'The Scribe lands on you and you swap places.');
      return { pl, i: 0, from, to: at, path, skip, swap, notes };
    },
    legal(pl, value, roll) { return [this.plan(pl, roll || { faces: [value, 0], value })]; },
    steps(m) { return m.path; },
    apply(m) {
      const opp = 1 - m.pl;
      this.pos[m.pl][0] = m.to; this.fresh[m.pl] = false; this.skip[m.pl] = m.skip;
      const moved = [];
      if (m.swap) { this.pos[opp][0] = m.from; moved.push({ pl: opp, i: 0 }); }
      return { moved, note: m.notes.join(' ') };
    },
    extra() { return false; },
    extraNote: '',
    done(pl) { return this.pos[pl][0] === 63; },
    home(pl) { return this.pos[pl][0] === 63 ? 1 : 0; },
    ai(moves) { return moves[0]; },
    aiPlan(pl, moves) { return [moves[0]]; },
  };

