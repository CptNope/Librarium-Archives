const ALQUERQUE_P = {
  camW: 1.0,
  intro() { return 'You play the dark pieces and move first. ' + this.prompt(); },
  prompt: () => 'Pick a piece, then a ring. Pieces never move backwards, and if you can capture, you must.',
  setup(ex) {
    const G = GAMES.alquerque;
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 12 }, () => {
      const mat = new THREE.MeshStandardMaterial({ color: pl ? 0xe8dcc0 : 0x3a1f12, roughness: 0.4 });
      const m = new THREE.Mesh(drManGeo, mat); m.userData.mats = [mat]; ex.group.add(m); return m;
    }));
    this.cell = Array(25).fill(null); this.lost = [0, 0];
    const k = [0, 0];
    ex.pieces.flat().forEach(m => { m.visible = true; });
    for (let i = 0; i < 25; i++) { const v = G.b[i]; if (!v) continue; const m = ex.pieces[v - 1][k[v - 1]++]; this.cell[i] = m; m.position.copy(this.pos(i)); }
    for (const pl of [0, 1]) ex.pieces[pl].slice(k[pl]).forEach(m => m.position.copy(this.lostSpot(pl, this.lost[pl]++)));
  },
  pos(i) { const c = aqCell(i); return V3(c.x, GAMES.alquerque.surface, c.z); },
  lostSpot(owner, k) { return V3(owner === 1 ? 0.5 : -0.5, TOP + (k % 6) * 0.0165, -0.25 + ((k / 6) | 0) * 0.09); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.alquerque, tok = play.token;
    const mesh = this.cell[m.from]; this.cell[m.from] = null;
    const victims = m.caps.map(c => this.cell[c]); m.caps.forEach(c => { this.cell[c] = null; });
    this.cell[m.to] = mesh;
    const res = G.apply(m);
    let k = 0;
    for (const sq of m.path) {
      if (tok !== play.token) return res;
      await hop(mesh, this.pos(sq), m.caps.length ? 0.3 : 0.24, m.caps.length ? 0.08 : 0.025);
      const v = victims[k++];
      if (v) { const owner = 1 - m.pl; hop(v, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.14); }
    }
    return res;
  },
  score: () => { const G = GAMES.alquerque; return [['You', G.count(0)], ['Scribe', G.count(1)], 'pieces']; },
};
