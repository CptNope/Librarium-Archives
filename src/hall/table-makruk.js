const MAKRUK_P = {
  camW: 1.0,
  intro() { return 'You play white and move first. ' + this.prompt(); },
  prompt() {
    const c = GAMES.makruk.count;
    const counting = c ? ` The count is ${c.n} of ${c.lim}.` : '';
    return 'Pick a piece, then a ring.' + counting;
  },
  setup(ex) {
    const G = GAMES.makruk;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(64).fill(null); this.lost = [0, 0];
    G.b.forEach((v, i) => { if (v) this.cell[i] = this.make(v, i); });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  make(v, i) { const o = mkPiece(v); o.position.copy(this.pos(i)); this.ex.group.add(o); this.ex.pieces.push(o); return o; },
  pos(i) { const c = mkCell(i); return V3(c.x, GAMES.makruk.surface, c.z); },
  lostSpot(owner, k) { return V3(owner ? -0.45 : 0.45, TOP, (owner ? -0.3 : 0.3) * (1 - (k % 8) / 8 * 2) * 0.9); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.makruk, tok = play.token, mesh = this.cell[m.from], victim = this.cell[m.to];
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.32, (G.b[m.to] & 7) === 4 ? 0.08 : 0.03);
    if (tok !== play.token) return res;
    if (victim) { const owner = 1 - m.pl; hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12); }
    if (m.promo) { mesh.visible = false; this.cell[m.to] = this.make(G.b[m.to], m.to); }
    return res;
  },
  score: () => { const G = GAMES.makruk; return [['You', G.pieces(0)], ['Scribe', G.pieces(1)], 'pieces']; },
};
