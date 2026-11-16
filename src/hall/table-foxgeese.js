const FOXGEESE_P = {
  camW: 1.0,
  intro() { return 'You are the fox, in the centre. The geese move first.'; },
  prompt: () => 'Choose a ring to move the fox. A ring beyond a goose is a jump.',
  setup(ex) {
    const G = GAMES.foxgeese;
    if (!ex.pieces) ex.pieces = { fox: foxPiece(), geese: Array.from({ length: G.GEESE }, () => goosePiece()) };
    ex.pieces.fox.parent || ex.group.add(ex.pieces.fox);
    ex.pieces.geese.forEach(g => { g.parent || ex.group.add(g); g.visible = true; g.rotation.set(0, Math.PI / 2, 0); });
    this.ex = ex; this.cell = Array(49).fill(null); this.lost = 0;
    let k = 0;
    for (let i = 0; i < 49; i++) {
      const v = G.b[i]; if (!v) continue;
      const m = v === 1 ? ex.pieces.fox : ex.pieces.geese[k++];
      this.cell[i] = m; m.position.copy(this.pos(i));
    }
    ex.pieces.geese.slice(k).forEach(g => g.position.copy(this.lostSpot(this.lost++)));
    ex.pieces.fox.rotation.set(0, Math.PI / 2, 0);
  },
  pos(i) { const c = fgCell(i); return V3(c.x, GAMES.foxgeese.surface, c.z); },
  lostSpot(k) { return V3(0.5 + (k % 2) * 0.07, TOP, -0.34 + ((k / 2) | 0) * 0.07); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.foxgeese, tok = play.token;
    const mesh = this.cell[m.from]; this.cell[m.from] = null;
    const victims = m.caps.map(c => this.cell[c]);
    m.caps.forEach(c => { this.cell[c] = null; });
    this.cell[m.to] = mesh;
    const res = G.apply(m);
    let k = 0;
    for (const sq of m.path) {
      if (tok !== play.token) return res;
      const to = this.pos(sq), from = mesh.position.clone();
      mesh.rotation.y = Math.atan2(-(to.z - from.z), to.x - from.x);
      await hop(mesh, to, m.caps.length ? 0.3 : 0.24, m.caps.length ? 0.09 : 0.03);
      const v = victims[k++];
      if (v) hop(v, this.lostSpot(this.lost++), 0.4, 0.14);
    }
    await wait(150);
    return res;
  },
  score: () => { const G = GAMES.foxgeese; return [['Geese left', G.geese()], ['Fox wins at', G.FOX_WINS_AT], '']; },
};
