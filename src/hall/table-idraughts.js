const IDRAUGHTS_P = {
  camW: 1.12,
  intro() { return 'You play white and move first. ' + this.prompt(); },
  prompt: () => 'Pick a piece, then a ring. You must capture when you can, and take as many pieces as possible.',
  setup(ex) {
    const G = GAMES.idraughts;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(100).fill(null); this.lost = [0, 0];
    const left = [20, 20];
    G.b.forEach((v, i) => {
      if (!v) return; const pl = G.owner(v), m = idPiece(pl);
      m.position.copy(this.pos(i)); this.crown(m, G.king(v)); ex.group.add(m); ex.pieces.push(m); this.cell[i] = m; left[pl]--;
    });
    // A resumed or taken-back game: the pieces already taken wait beside the board.
    for (const pl of [0, 1]) for (let j = 0; j < left[pl]; j++) { const m = idPiece(pl); m.position.copy(this.lostSpot(pl, this.lost[pl]++)); ex.group.add(m); ex.pieces.push(m); }
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  crown(m, on) { m.userData.crown.visible = on; m.userData.band.visible = on; },
  pos(i) { const c = idCell(i); return V3(c.x, GAMES.idraughts.surface, c.z); },
  lostSpot(owner, k) { return V3(owner === 1 ? 0.53 : -0.53, TOP + (k % 7) * 0.0165, -0.33 + ((k / 7) | 0) * 0.085); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.idraughts, tok = play.token;
    const mesh = this.cell[m.from]; this.cell[m.from] = null;
    const victims = m.caps.map(c => this.cell[c]);
    m.caps.forEach(c => { this.cell[c] = null; });
    this.cell[m.to] = mesh;
    const res = G.apply(m);
    const jump = m.caps.length > 0;
    for (const sq of m.path) {
      if (tok !== play.token) return res;
      const d = mesh.position.distanceTo(this.pos(sq));
      await hop(mesh, this.pos(sq), 0.2 + d * 0.6, jump ? 0.07 : 0.025);
    }
    // Taken pieces are lifted only when the whole move is over.
    for (const v of victims) { if (tok !== play.token) return res; const owner = 1 - m.pl; await hop(v, this.lostSpot(owner, this.lost[owner]++), 0.26, 0.12); }
    if (m.crown) { this.crown(mesh, true); await tween(0.3, q => { mesh.userData.crown.scale.setScalar(Math.max(0.01, q)); }); }
    return res;
  },
  score: () => { const G = GAMES.idraughts; return [['You', G.count(0)], ['Scribe', G.count(1)], 'pieces']; },
};
