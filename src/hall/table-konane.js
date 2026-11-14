const KONANE_P = {
  camW: 0.98, ringScale: 0.7,
  intro() { return 'You play black. Begin by lifting one of your stones from the centre or a corner. ' ; },
  prompt: () => { const G = GAMES.konane; return G.ply === 0 ? 'Lift one of your stones from the centre or a corner.' : 'Pick a stone, then a ring: jump a white stone into the gap beyond. You may run on in a straight line.'; },
  setup(ex) {
    const G = GAMES.konane;
    if (!ex.pieces) ex.pieces = Array.from({ length: 64 }, (_, i) => { const pl = G.b[i] - 1; const m = stoneMesh(pl ? 0xe8e4da : 0x0e0c0b, 0.03, 0.62, pl ? 0.35 : 0.7); ex.group.add(m); return m; });
    this.cell = Array(64).fill(null); this.lost = [0, 0];
    const pools = [ex.pieces.filter((_, i) => (((i / 8) | 0) + (i % 8)) % 2 === 0), ex.pieces.filter((_, i) => (((i / 8) | 0) + (i % 8)) % 2 === 1)], k = [0, 0];
    for (let i = 0; i < 64; i++) { const v = G.b[i]; if (!v) continue; const m = pools[v - 1][k[v - 1]++]; m.visible = true; m.scale.set(1, 0.62, 1); this.cell[i] = m; m.position.copy(this.pos(i)); }
    for (const pl of [0, 1]) pools[pl].slice(k[pl]).forEach(m => { m.visible = true; m.position.copy(this.lostSpot(pl, this.lost[pl]++)); });
  },
  pos(i) { const p = knCell(i); return V3(p.x, GAMES.konane.surface + 0.012, p.z); },
  lostSpot(owner, k) { return V3(owner ? 0.46 : -0.46, TOP + 0.015 + ((k / 16) | 0) * 0.02, -0.3 + (k % 16) * 0.04); },
  meshesFor(m) { return [this.cell[m.remove !== undefined ? m.remove : m.from]]; },
  ringFor(m) { return m.remove !== undefined ? null : this.pos(m.to); },
  fromFor(m) { return m.remove !== undefined ? null : this.pos(m.from); },
  async play(m) {
    const G = GAMES.konane, tok = play.token;
    if (m.remove !== undefined) {
      const v = this.cell[m.remove]; this.cell[m.remove] = null; const owner = m.pl;
      const res = G.apply(m); await hop(v, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12); return res;
    }
    const mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const victims = m.caps.map(c => { const v = this.cell[c]; this.cell[c] = null; return v; });
    const res = G.apply(m);
    for (let k = 0; k < m.path.length; k++) {
      if (tok !== play.token) return res;
      await hop(mesh, this.pos(m.path[k]), 0.28, 0.07);
      const owner = 1 - m.pl; hop(victims[k], this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12);
    }
    return res;
  },
  score: () => { const G = GAMES.konane; return [['You', G.count(0)], ['Scribe', G.count(1)], 'stones']; },
};
