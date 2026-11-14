const SNAKES = Object.assign(R.snakes, {
  camW: 1.08, pieceH: 0, sides: ['red pawn', 'blue pawn'],
  makePieces(group) { return [[goosePawn(0xb0302a)], [goosePawn(0x2a4a8a)]].map(a => { a.forEach(m => group.add(m)); return a; }); },
  local(pl, sq) { const c = slCell(sq); return V3(c.x + (pl ? 0.016 : -0.016), this.surface, c.z + (pl ? 0.012 : -0.012)); },
  bigHop: (m, s) => s === m.to && m.path.length > 1 && Math.abs(m.path[m.path.length - 1] - m.path[m.path.length - 2]) > 1,
  score() { return [['You', 'square ' + this.pos[0][0]], ['Scribe', 'square ' + this.pos[1][0]], '· land on 100 to win']; },
  winText: pl => (pl === 0 ? 'You reached 100, liberation, first.' : 'The Scribe reached 100 first.'),
});
