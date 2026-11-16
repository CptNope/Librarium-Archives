const HALMA_P = {
  camW: 1.0, ringScale: 0.42,
  intro() { return 'You play red, from the near corner, and move first. ' + this.prompt(); },
  prompt: () => 'Pick a man, then a ring. Rings beyond a neighbouring piece are leaps.',
  setup(ex) {
    const G = GAMES.halma;
    (ex.group.userData.display || []).forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 19 }, () => { const m = halmaMan(pl); ex.group.add(m); return m; }));
    this.cell = Array(256).fill(null);
    const k = [0, 0];
    for (let i = 0; i < 256; i++) {
      if (!G.b[i]) continue;
      const pl = G.b[i] - 1, m = ex.pieces[pl][k[pl]++];
      this.cell[i] = m; m.position.copy(this.pos(i));
    }
  },
  pos(i) { const c = hmCell(i); return V3(c.x, GAMES.halma.surface, c.z); },
  meshesFor(m) { return m.pass ? [] : [this.cell[m.from]]; },
  ringFor(m) { return m.pass ? null : this.pos(m.to); },
  fromFor(m) { return m.pass ? null : this.pos(m.from); },
  async play(m) {
    const G = GAMES.halma, tok = play.token;
    if (m.pass) return G.apply(m);
    const mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const leap = Math.abs((m.path[0] >> 4) - (m.from >> 4)) === 2 || Math.abs((m.path[0] & 15) - (m.from & 15)) === 2;
    const res = G.apply(m);
    for (const sq of m.path) {
      if (tok !== play.token) return res;
      await hop(mesh, this.pos(sq), leap ? 0.22 : 0.18, leap ? 0.05 : 0.02);
    }
    return res;
  },
  score: () => { const G = GAMES.halma; return [['You', G.home(0)], ['Scribe', G.home(1)], 'men home of 19']; },
};
