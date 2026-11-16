const CHINESE_P = {
  camW: 1.08, ringScale: 0.45,
  intro() { return 'You play red, from the point of the star nearest you, and move first. ' + this.prompt(); },
  prompt: () => 'Pick a marble, then a ring. Rings beyond a neighbouring marble are hops, and a chain of hops is one move.',
  setup(ex) {
    const G = GAMES.chinese;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 10 }, () => { const m = ccMarble(CC_COLS[pl]); ex.group.add(m); return m; }));
    ex.pieces.flat().forEach(m => { m.visible = true; });
    this.cell = Array(G.N).fill(null); const k = [0, 0];
    for (let i = 0; i < G.N; i++) { if (!G.b[i]) continue; const pl = G.b[i] - 1, m = ex.pieces[pl][k[pl]++]; this.cell[i] = m; m.position.copy(this.pos(i)); }
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).flat().forEach(m => { m.visible = false; }); },
  pos(i) { const c = ccCell(i); return V3(c.x, GAMES.chinese.surface + 0.016, c.z); },
  meshesFor(m) { return m.pass ? [] : [this.cell[m.from]]; },
  ringFor(m) { return m.pass ? null : V3(ccCell(m.to).x, GAMES.chinese.surface, ccCell(m.to).z); },
  fromFor(m) { return m.pass ? null : V3(ccCell(m.from).x, GAMES.chinese.surface, ccCell(m.from).z); },
  async play(m) {
    const G = GAMES.chinese, tok = play.token;
    if (m.pass) return G.apply(m);
    const mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    for (const sq of m.path) { if (tok !== play.token) return res; await hop(mesh, this.pos(sq), m.hop ? 0.22 : 0.18, m.hop ? 0.05 : 0.02); }
    return res;
  },
  score: () => { const G = GAMES.chinese; return [['You', G.home(0)], ['Scribe', G.home(1)], 'marbles home of 10']; },
};
