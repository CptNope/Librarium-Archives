
// The Goose is a race game: it borrows the race presenter, with its own pieces and spiral.
const GOOSE = Object.assign(R.goose, {
  camW: 1.12, pieceH: 0,
  makePieces(group) { return [[goosePawn(0xd4a23a)], [goosePawn(0xc8ccd2)]].map(a => { a.forEach(m => group.add(m)); return a; }); },
  local(pl, sq) { const c = gsCell(sq); return V3(c.x + (pl ? 0.022 : -0.022), this.surface, c.z + (pl ? 0.016 : -0.016)); },
  score() { return [['You', 'square ' + this.pos[0][0]], ['Scribe', 'square ' + this.pos[1][0]], '· land on 63 to win']; },
  winText: pl => (pl === 0 ? 'You reached the garden at 63 first.' : 'The Scribe reached the garden at 63 first.'),
});
