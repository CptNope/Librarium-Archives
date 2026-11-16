const LIFEGAME_P = {
  camW: 1.0,
  intro() { return 'You have the red counter, the Scribe the blue; both start at Infancy. Spin the teetotum: its number says how you may move.'; },
  prompt() { return 'Spin the teetotum.'; },
  choosePrompt: moves => (moves.length > 1 ? 'Pick your counter, then one of the rings.' : 'Pick your counter to move it.'),
  setup(ex) {
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => { const p = mhPawn(pl); ex.group.add(p); return p; });
    ex.pieces.forEach((p, pl) => { p.visible = true; p.position.copy(this.pos(pl, 56)); });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(p => { p.visible = false; }); },
  pos(pl, i) { const c = clCell(i), G = GAMES.lifegame, both = G.pos[0] === G.pos[1]; return V3(c.x + (both ? (pl ? 0.016 : -0.016) : 0), G.surface, c.z); },
  meshesFor(m) { return [play.ex.pieces[m.pl]]; },
  ringFor(m) { const c = clCell(m.via !== undefined ? m.via : m.to); return V3(c.x, GAMES.lifegame.surface, c.z); },
  fromFor(m) { const c = clCell(m.from); return V3(c.x, GAMES.lifegame.surface, c.z); },
  ringTone: m => (m.hand ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES.lifegame, tok = play.token, pawn = play.ex.pieces[m.pl];
    const res = G.apply(m);
    for (const i of G.steps(m)) { if (tok !== play.token) return res; await hop(pawn, this.pos(m.pl, i), 0.32, 0.05); }
    if (res.bumped !== null) await hop(play.ex.pieces[res.bumped], this.pos(res.bumped, G.pos[res.bumped]), 0.45, 0.1);
    play.ex.pieces.forEach((p, pl) => p.position.copy(this.pos(pl, G.pos[pl]))); // side by side when sharing Infancy
    return res;
  },
  score: () => { const G = GAMES.lifegame; return [['You', G.score[0]], ['Scribe', G.score[1]], 'points of 100']; },
};
