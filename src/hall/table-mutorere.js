const MUTORERE_P = {
  camW: 1.0,
  intro() { return 'You play the light stones and move first. ' + this.prompt(); },
  prompt: () => 'Pick a stone that can move into the empty point. A stone may enter the centre only beside one of the Scribe\'s.',
  setup(ex) {
    const G = GAMES.mutorere;
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 4 }, () => { const m = stoneMesh(pl ? 0x100c0a : 0xe8e0cc, 0.04, 0.5, 0.4); ex.group.add(m); return m; }));
    this.cell = Array(9).fill(null); const k = [0, 0];
    for (let i = 0; i < 9; i++) { const v = G.b[i]; if (!v) continue; const m = ex.pieces[v - 1][k[v - 1]++]; this.cell[i] = m; m.position.copy(this.pos(i)); }
  },
  pos(i) { const p = mtPos(i); return V3(p.x, GAMES.mutorere.surface + 0.02, p.z); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.mutorere, mesh = this.cell[m.from];
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.3, 0.04);
    return res;
  },
  score: () => { const G = GAMES.mutorere; return [['You', G.legal(0).length], ['Scribe', G.legal(1).length], 'moves open']; },
};
