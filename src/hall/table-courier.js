const COURIER_P = {
  camW: 1.25,
  intro() { return 'You play white and move first. The opening leaps are already made. ' + this.prompt(); },
  prompt: () => 'Pick one of your pieces, then where it should go.',
  setup(ex) {
    const G = GAMES.courier;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(96).fill(null); this.lost = [0, 0];
    G.b.forEach((v, i) => { if (v) this.cell[i] = this.spawn(v & 15, v >> 4, i); });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  spawn(t, pl, i) {
    const o = coPiece(t, new THREE.MeshStandardMaterial({ color: CO_MATS[pl], roughness: pl ? 0.35 : 0.5 }));
    o.position.copy(this.pos(i)); o.rotation.y = pl ? -Math.PI / 2 : Math.PI / 2;
    this.ex.group.add(o); this.ex.pieces.push(o);
    return o;
  },
  pos(i) { const c = coCell(i); return V3(c.x, GAMES.courier.surface, c.z); },
  lostSpot(owner, k) { return V3((owner ? -1 : 1) * (0.25 - (k % 8) * 0.06), TOP, (owner ? -1 : 1) * (0.36 + ((k / 8) | 0) * 0.06)); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  ringScale: 0.8,
  async play(m) {
    const G = GAMES.courier, tok = play.token, mesh = this.cell[m.from], victim = this.cell[m.to];
    const t = G.b[m.from] & 15;
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.3, t === G.CO.N || t === G.CO.E ? 0.07 : 0.02);
    if (tok !== play.token) return res;
    if (victim) { const owner = 1 - m.pl; hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12); }
    if (m.promo) { mesh.visible = false; this.cell[m.to] = this.spawn(G.CO.F, m.pl, m.to); }
    return res;
  },
  score: () => { const G = GAMES.courier; return [['You', G.material(0) + 1], ['Scribe', G.material(1) + 1], 'pieces']; },
};
