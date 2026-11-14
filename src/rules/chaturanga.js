  /* ------------------------------------------------------------- Chaturanga
   * A modern reconstruction: shatranj's rules under the Sanskrit names, as
   * H. J. R. Murray reconstructed the game. */
  const CR_NAMES = ['', 'raja', 'mantri', 'gaja', 'ashva', 'ratha', 'padati'];
  const CHATURANGA = Object.assign({}, SHATRANJ, {
    id: 'chaturanga', name: 'Chaturanga',
    rules: [
      'This is a modern reconstruction. No rules survive from chaturanga\'s own time, so we play it as H. J. R. Murray did: with the rules of its Persian successor, shatranj.',
      'The raja (king) moves one square in any direction. The ratha (chariot) moves like a rook and the ashva (horse) like a knight.',
      'The mantri (counsellor) steps one square diagonally. The gaja (elephant) jumps exactly two squares diagonally, over anything in between. Its true move is unknown; this is the shatranj alfil\'s.',
      'The padati (foot soldier) steps one square forward and takes one square diagonally forward, never two at once. On the far rank it becomes a mantri.',
      'You win by checkmate, by stalemating the Scribe, or by capturing everything but its raja, unless it can strip yours bare on the very next move. There is no castling, and a long stretch with no capture or padati move is a draw.'
    ],
    source: 'A modern reconstruction after H. J. R. Murray, A History of Chess (1913), which takes chaturanga\'s moves from shatranj. Other reconstructions move the gaja differently.',
    pieceName(v) { return CR_NAMES[this.type(v)]; },
    apply(m) {
      const res = SHATRANJ.apply.call(this, m);
      res.note = res.note.replace('The baidaq becomes a firzan.', 'The padati becomes a mantri.').replace('Shah! ', 'Check! ').replace(/king/g, 'raja');
      return res;
    },
    result(pl) {
      const res = SHATRANJ.result.call(this, pl);
      if (res) res.text = res.text.replace('Shah mat. ', 'Checkmate. ').replace('in shatranj', 'by these rules').replace(/kings/g, 'rajas').replace(/king/g, 'raja');
      return res;
    },
  });

