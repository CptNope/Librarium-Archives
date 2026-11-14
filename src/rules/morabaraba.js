  /* -------------------------------------------------------------- Morabaraba
   * The morris board with diagonals joining the corners of the three squares,
   * and twelve cows a side. The diagonals are lines of the board: they carry moves and make mills. */
  const MB_ADJ = MORRIS_ADJ.map(a => a.slice());
  for (const k of [0, 2, 4, 6]) { MB_ADJ[k].push(k + 8); MB_ADJ[k + 8].push(k, k + 16); MB_ADJ[k + 16].push(k + 8); }
  const MB_MILLS = MORRIS_MILLS.concat([0, 2, 4, 6].map(k => [k, k + 8, k + 16]));
  const MORABARABA = Object.assign({}, MORRIS, {
    id: 'morabaraba', name: 'Morabaraba', N: 12, ADJ: MB_ADJ, MILLS: MB_MILLS,
    rules: [
      'Take turns placing your twelve cows on empty points. You play the pale cows and go first.',
      'Three of your cows in a row along any line, the diagonals included, make a mill. Each new mill lets you shoot one of the Scribe\'s cows. Cows in a mill are safe unless every one of them is in a mill.',
      'Once every cow is placed, move one cow along a line to a neighbouring empty point.',
      'A player down to three cows may fly them to any empty point.',
      'You lose when you have two cows left or cannot move. If both sides are down to three and no cow is shot in ten moves each, the game is drawn.'
    ],
    source: 'Morabaraba as Mind Sports South Africa plays it, on the board with diagonals, without the rule that stops a broken mill being remade at once.',
    result(pl) {
      for (const p of [0, 1]) if (this.count(p) < 3) return { winner: 1 - p, text: p === 0 ? 'You are down to two cows.' : 'The Scribe is down to two cows.' };
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no legal move.' : 'The Scribe has no legal move.' };
      if (this.count(0) === 3 && this.count(1) === 3 && !this.hand[0] && !this.hand[1] && this.quiet >= 20) return { winner: -1, text: 'Three cows each and no shot in ten moves. The game is drawn.' };
      if (this.quiet >= 160) return { winner: -1, text: 'A long stretch with no shots. The game is drawn.' };
      return null;
    },
  });
  MORABARABA.apply = function (m) {
    const r = MORRIS.apply.call(this, m);
    if (m.type === 'remove') r.note = m.pl === 0 ? 'You shoot one of the Scribe\'s cows.' : 'The Scribe shoots one of your cows.';
    return r;
  };

