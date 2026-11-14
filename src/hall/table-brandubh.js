
const BRANDUBH_P = {
  camW: 1.36,
  intro() { return this.prompt(); },
  setup(ex) {
    const G = GAMES.brandubh;
    if (!ex.pieces) {
      const mk = (geo, color) => { const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 }); const m = new THREE.Mesh(geo, mat); m.userData.mats = [mat]; ex.group.add(m); return m; };
      ex.pieces = { att: Array.from({ length: 8 }, () => mk(brPawnGeo, 0x231a14)), def: Array.from({ length: 4 }, () => mk(brPawnGeo, 0xe6d8b6)), king: mk(brKingGeo, 0xf0e2bd) };
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.005, 8, 24), MAT.brass); band.rotation.x = Math.PI / 2; band.position.y = 0.074; ex.pieces.king.add(band);
    }
    this.ex = ex; this.cell = Array(49).fill(null); this.lost = [0, 0];
    let a = 0, d = 0;
    for (let i = 0; i < 49; i++) {
      const v = G.b[i]; const m = v === 1 ? ex.pieces.att[a++] : v === 2 ? ex.pieces.def[d++] : v === 3 ? ex.pieces.king : null;
      if (m) { this.cell[i] = m; m.position.copy(this.pos(i)); m.rotation.set(0, 0, 0); }
    }
    // Pieces already taken, in a game taken back or resumed, wait beside the board.
    ex.pieces.att.slice(a).forEach(m => m.position.copy(this.lostSpot(1, this.lost[1]++)));
    ex.pieces.def.slice(d).forEach(m => m.position.copy(this.lostSpot(0, this.lost[0]++)));
  },
  pos(i) { const c = brCell(i); return V3(c.x, GAMES.brandubh.surface, c.z); },
  lostSpot: (owner, k) => V3(owner === 1 ? 0.64 : -0.64, TOP, -0.36 + k * 0.09),
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.brandubh, P = this.ex.pieces;
    const mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    const from = mesh.position.clone(), to = this.pos(m.to);
    await tween(0.2 + from.distanceTo(to) * 0.5, k => { mesh.position.lerpVectors(from, to, k); mesh.position.y += Math.sin(k * Math.PI) * 0.025; });
    for (const c of res.caps) {
      const cm = this.cell[c]; this.cell[c] = null;
      if (cm === P.king) { await tween(0.6, k => { cm.rotation.z = k * 1.45; }); continue; }
      const owner = P.att.includes(cm) ? 1 : 0;
      await hop(cm, this.lostSpot(owner, this.lost[owner]++), 0.42, 0.14);
    }
    return res;
  },
  score: () => [['Your side', GAMES.brandubh.count(0)], ['Attackers', GAMES.brandubh.count(1)], 'pieces'],
  prompt: () => 'Pick one of your pieces, then where it should go. Get the king to a corner.',
};
