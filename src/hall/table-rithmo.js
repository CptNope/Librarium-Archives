const RITHMO_P = {
  camW: 0.7, camD: 0.8, camElev: 70, ringScale: 0.62,
  intro() { return 'A modern reconstruction. You play the white Evens and move first. ' + this.prompt(); },
  prompt() { const G = GAMES.rithmo; return `Pick a piece, then a ring. Take the Scribe's pyramid (190) or any ${G.WIN} pieces to win.`; },
  setup(ex) {
    const G = GAMES.rithmo;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(128).fill(null); this.lost = [0, 0];
    G.b.forEach((p, i) => { if (!p) return; const o = rmPiece(p); o.position.copy(this.pos(i)); ex.group.add(o); ex.pieces.push(o); this.cell[i] = o; });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  pos(i) { const c = rmCell(i); return V3(c.x, GAMES.rithmo.surface, c.z); },
  // Taken pieces line up beside the board, on the side of the player who lost them.
  lostSpot(owner, k) { return V3((owner ? -1 : 1) * (0.33 + (k % 2) * 0.06), TOP, (owner ? -1 : 1) * (0.4 - ((k / 2) | 0) * 0.065)); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  ringTone: m => (m.meet ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES.rithmo, tok = play.token, mesh = this.cell[m.from];
    const res = G.apply(m);
    const victims = res.caps.map(i => [i, i === m.to ? this.cell[m.to] : this.cell[i]]);
    this.cell[m.from] = null;
    await hop(mesh, this.pos(m.to), 0.3, 0.025);
    if (tok !== play.token) return res;
    this.cell[m.to] = mesh;
    for (const [i, v] of victims) { if (i !== m.to) this.cell[i] = null; const owner = 1 - m.pl; if (v) hop(v, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12); }
    return res;
  },
  score: () => { const G = GAMES.rithmo; return [['You took', G.taken[0]], ['Scribe took', G.taken[1]], `of ${G.WIN}`]; },
};
