  /* ------------------------------------------------------- Snakes and Ladders
   * The Indian game of knowledge (gyan chaupar, or moksha patam): a 100-square
   * track where virtues are ladders and vices are snakes. */
  const SL_LADDERS = { 12: [31, 'Faith'], 51: [68, 'Reliability'], 57: [83, 'Generosity'], 76: [91, 'Knowledge'], 78: [97, 'Asceticism'] };
  const SL_SNAKES = { 41: [20, 'Disobedience'], 52: [30, 'Theft'], 69: [47, 'Debt'], 73: [7, 'Murder'], 88: [46, 'Anger'], 99: [61, 'Lust'] };
  const SNAKES = {
    id: 'snakes', name: 'Snakes and Ladders', dice: true, pipDice: true, oneDie: true, autoMove: true, first: 0, N: 1,
    LADDERS: SL_LADDERS, SNAKES: SL_SNAKES,
    rules: [
      'Throw the die and move your piece that many squares, along each row and up to the next.',
      'Land at the foot of a ladder, a virtue, and you climb it. Land on a snake\'s head, a vice, and you slide down to its tail.',
      'There are more snakes than ladders: the old boards taught that the way down is easier than the way up.',
      'The first to land exactly on 100, liberation, wins. A throw that would go past 100 is lost.'
    ],
    source: 'The squares of Faith (12), Disobedience (41), Reliability (51), Theft (52), Generosity (57), Debt (69), Murder (73), Knowledge (76), Asceticism (78) and Lust (99) follow an old Indian board. The snake of Anger at 88, and where each ladder and snake ends, are our own.',
    init() { this.pos = [[0], [0]]; },
    roll() { const a = 1 + ((Math.random() * 6) | 0); return { faces: [a], value: a }; },
    plan(pl, roll) {
      const from = this.pos[pl][0], v = roll.value, notes = [], path = [];
      const you = pl === 0 ? 'You' : 'The Scribe';
      if (from + v > 100) {
        notes.push(pl === 0 ? `You need exactly ${100 - from} to reach 100.` : `The Scribe needs exactly ${100 - from}.`);
        return { pl, i: 0, from, to: from, path, notes };
      }
      for (let k = from + 1; k <= from + v; k++) path.push(k);
      let at = from + v;
      if (SL_LADDERS[at]) { const [top, name] = SL_LADDERS[at]; notes.push(`${you} climb${pl ? 's' : ''} the ladder of ${name} to ${top}.`); at = top; path.push(at); }
      else if (SL_SNAKES[at]) { const [tail, name] = SL_SNAKES[at]; notes.push(`The snake of ${name}! ${you} slide${pl ? 's' : ''} down to ${tail}.`); at = tail; path.push(at); }
      if (at === 100) notes.push(pl === 0 ? 'You reach 100: liberation.' : 'The Scribe reaches 100.');
      return { pl, i: 0, from, to: at, path, notes };
    },
    legal(pl, value, roll) { return [this.plan(pl, roll || { faces: [value], value })]; },
    steps(m) { return m.path; },
    apply(m) { this.pos[m.pl][0] = m.to; return { moved: [], note: m.notes.join(' ') }; },
    extra() { return false; },
    extraNote: '',
    done(pl) { return this.pos[pl][0] === 100; },
    home(pl) { return this.pos[pl][0] === 100 ? 1 : 0; },
    ai(moves) { return moves[0]; },
    aiPlan(pl, moves) { return [moves[0]]; },
  };

