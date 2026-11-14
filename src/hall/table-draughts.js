
const DRAUGHTS_P = {
  camW: 1.1,
  intro() { return 'You play the dark pieces and move first. ' + this.prompt(); },
  prompt: () => 'Pick a piece, then a ring. If a capture is possible, you must take it.',
  setup(ex) {
    const G = GAMES.draughts;
    if (!ex.pieces) {
      ex.pieces = [0, 1].map(pl => Array.from({ length: 12 }, () => {
        const mat = new THREE.MeshStandardMaterial({ color: pl ? 0xe8dcc0 : 0x3a1f12, roughness: 0.4 });
        const m = new THREE.Mesh(drManGeo, mat); m.userData.mats = [mat];
        const crown = new THREE.Mesh(drManGeo, mat); crown.position.y = 0.016; crown.visible = false; m.add(crown); m.userData.crown = crown;
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.003, 6, 24), MAT.brass); band.rotation.x = Math.PI / 2; band.position.y = 0.024; band.visible = false; m.add(band); m.userData.band = band;
        ex.group.add(m); return m;
      }));
    }
    this.ex = ex; this.cell = Array(64).fill(null); this.lost = [0, 0];
    const k = [0, 0];
    ex.pieces.flat().forEach(m => { m.visible = true; this.crown(m, false); });
    for (let i = 0; i < 64; i++) {
      const v = G.b[i]; if (!v) continue;
      const pl = G.owner(v), m = ex.pieces[pl][k[pl]++];
      this.cell[i] = m; m.position.copy(this.pos(i)); this.crown(m, G.king(v));
    }
    // A resumed or taken-back game: pieces no longer on the board wait beside it.
    for (const pl of [0, 1]) for (let j = k[pl]; j < 12; j++) ex.pieces[pl][j].position.copy(this.lostSpot(pl, this.lost[pl]++));
  },
  crown(m, on) { m.userData.crown.visible = on; m.userData.band.visible = on; },
  pos(i) { const c = drCell(i); return V3(c.x, GAMES.draughts.surface, c.z); },
  lostSpot(owner, k) { return V3((owner === 1 ? 0.5 : -0.5), TOP + (k % 6) * 0.0165, -0.3 + ((k / 6) | 0) * 0.09); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.draughts, tok = play.token;
    const mesh = this.cell[m.from]; this.cell[m.from] = null;
    const victims = m.caps.map(c => this.cell[c]);
    m.caps.forEach(c => { this.cell[c] = null; });
    this.cell[m.to] = mesh;
    const res = G.apply(m);
    let k = 0;
    for (const sq of m.path) {
      if (tok !== play.token) return res;
      await hop(mesh, this.pos(sq), m.caps.length ? 0.3 : 0.26, m.caps.length ? 0.08 : 0.025);
      const v = victims[k++];
      if (v) { const owner = 1 - m.pl; hop(v, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.14); }
    }
    if (m.crown) { this.crown(mesh, true); await tween(0.3, q => { mesh.userData.crown.scale.setScalar(Math.max(0.01, q)); }); }
    return res;
  },
  score: () => { const G = GAMES.draughts; return [['You', G.count(0)], ['Scribe', G.count(1)], 'pieces']; },
};
