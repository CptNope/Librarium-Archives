const MANSION_P = {
  camW: 1.0,
  intro() { return 'You have the red counter, the Scribe the blue. Spin the teetotum and follow the spiral to the Mansion of Happiness.'; },
  prompt() { return 'Spin the teetotum.'; },
  choosePrompt: () => 'Pick your counter to move it.',
  setup(ex) {
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => { const p = mhPawn(pl); ex.group.add(p); return p; });
    ex.pieces.forEach((p, pl) => { p.visible = true; p.position.copy(this.pos(pl, 0)); });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(p => { p.visible = false; }); },
  pos(pl, n) { if (!n) return mhStart(pl); const c = mhSquare(n); return V3(c.x + (pl ? 0.012 : -0.012), GAMES.mansion.surface, c.z); },
  meshesFor(m) { return [play.ex.pieces[m.pl]]; },
  ringFor(m) { return this.pos(m.pl, m.to); },
  fromFor(m) { return m.from ? this.pos(m.pl, m.from) : null; },
  async play(m) {
    const G = GAMES.mansion, tok = play.token, pawn = play.ex.pieces[m.pl];
    const res = G.apply(m);
    for (const n of m.path) { if (tok !== play.token) return res; await hop(pawn, this.pos(m.pl, n), 0.14, 0.03); }
    if (res.bumped !== null) await hop(play.ex.pieces[res.bumped], this.pos(res.bumped, G.pos[res.bumped]), 0.35, 0.08);
    if (res.freed !== null) await hop(play.ex.pieces[res.freed], this.pos(res.freed, 0), 0.4, 0.1);
    return res;
  },
  // Keep the counters where the rules put them (a served sentence sends one back to the start between moves).
  sync() { const G = GAMES.mansion, ex = play.ex; if (!ex || !ex.pieces || play.game !== G) return; ex.pieces.forEach((p, pl) => { const to = this.pos(pl, G.pos[pl]); if (p.position.distanceTo(to) > 0.03 && play.phase !== 'anim' && play.phase !== 'ai') p.position.copy(to); }); },
  score() { this.sync(); const G = GAMES.mansion; return [['You', G.pos[0]], ['Scribe', G.pos[1]], 'of 67']; },
};
