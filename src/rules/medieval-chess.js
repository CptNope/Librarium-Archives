  /* ---------------------------------------------------------- Medieval chess
   * Chess as Europe played it around 1200, for the Lewis chessmen: shatranj's
   * moves under European names, with only checkmate winning. */
  const LW_NAMES = ['', 'king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];
  const LEWISCHESS = Object.assign({}, SHATRANJ, {
    id: 'lewischess', name: 'Medieval chess',
    rules: [
      'This is a modern reconstruction of chess as Europe played it around 1200, when the Lewis chessmen were carved. The moves are those Europe took over from shatranj, after H. J. R. Murray.',
      'The king moves one square in any direction. The rook moves like a modern rook and the knight like a modern knight.',
      'The queen, still the old fers or counsellor, steps only one square diagonally. The bishop, the alfin, jumps exactly two squares diagonally, over anything in between.',
      'The pawn steps one square forward and takes one square diagonally forward, never two at once. On the far rank it becomes a queen.',
      'Only checkmate wins. A stalemate, a long stretch with no capture or pawn move, or two bare kings is a draw. There is no castling: the king\'s and queen\'s first-move leaps of the later Middle Ages are left out.'
    ],
    source: 'A modern reconstruction after H. J. R. Murray, A History of Chess (1913). Medieval rules for stalemate and the bare king varied from place to place; this table treats both as in modern chess.',
    pieceName(v) { return LW_NAMES[this.type(v)]; },
    apply(m) {
      const res = SHATRANJ.apply.call(this, m);
      res.note = res.note.replace('The baidaq becomes a firzan.', 'The pawn becomes a queen.').replace('Shah! ', 'Check! ');
      return res;
    },
    result(pl) {
      const moves = this.legal(pl);
      if (!moves.length) return this.inCheck(pl)
        ? { winner: 1 - pl, text: pl === 0 ? 'Checkmate. The Scribe wins.' : 'Checkmate. The Scribe\'s king is taken in the net.' }
        : { winner: -1, text: pl === 0 ? 'You are stalemated: a draw.' : 'The Scribe is stalemated: a draw.' };
      if (!this.material(0) && !this.material(1)) return { winner: -1, text: 'Both kings stand bare. The game is drawn.' };
      if (this.quiet >= 100) return { winner: -1, text: 'A long stretch with no capture or pawn move. The game is drawn.' };
      return null;
    },
    terminal(pl, depth) {
      if (!this.pseudo(pl).some(m => { const s = this.snapshot(); this.raw(m); const ok = !this.inCheck(pl); this.restore(s); return ok; })) return this.inCheck(pl) ? -1000 - depth : 0;
      if (this.quiet >= 100 || (!this.material(0) && !this.material(1))) return 0;
      return null;
    },
  });

