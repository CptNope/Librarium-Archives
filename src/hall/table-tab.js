
const TAB_P = {
  camW: 0.95,
  intro() { return 'You have the dark stones nearest you. Throw the sticks: you need a tâb (one white side) to start a piece.'; },
  prompt() { return 'Throw the sticks.'; },
  choosePrompt: moves => (moves.length > 1 ? 'Pick a glowing piece, then its ring.' : 'Pick the glowing piece to move it.'),
  setup(ex) {
    const G = GAMES.tab;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = G.pc.map(p => { const m = tabPiece(p.pl); ex.group.add(m); return m; });
    this.lost = [0, 0];
    ex.pieces.forEach((m, k) => { m.visible = true; m.userData.band.visible = false; m.position.copy(this.pos(G.pc[k].cell)); });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => { m.visible = false; }); },
  pos(i) { const c = tabCell(i); return V3(c.x, GAMES.tab.surface + 0.007, c.z); },
  lostSpot(owner, k) { return V3(-0.32 + (k % 9) * 0.08, TOP + 0.008, owner ? -0.28 : 0.28); },
  meshesFor(m) { return [play.ex.pieces[m.piece]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  ringTone: m => (m.cap ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES.tab, tok = play.token, mesh = play.ex.pieces[m.piece];
    const victim = G.at[m.to] >= 0 ? play.ex.pieces[G.at[m.to]] : null;
    const res = G.apply(m);
    for (const sq of m.path) { if (tok !== play.token) return res; await hop(mesh, this.pos(sq), 0.16, 0.03); }
    mesh.userData.band.visible = true; // a piece that has set out wears a pale ring
    if (victim) { const owner = 1 - m.pl; hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12); }
    return res;
  },
  score: () => { const G = GAMES.tab; return [['You', G.count(0)], ['Scribe', G.count(1)], 'pieces']; },
};
