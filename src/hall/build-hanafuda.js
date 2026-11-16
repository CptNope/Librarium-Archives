/* --- Wing VI: Hanafuda, a game of koi-koi laid out on a low lacquered table */
function buildKoikoi(group) {
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.03, 0.82), new THREE.MeshStandardMaterial({ color: 0x2a0e0a, roughness: 0.35 }));
  table.position.y = TOP + 0.015; group.add(table);
  topPlane(group, 1.08, 0.76, TOP + 0.0305, tex(512, 384, (g, w, h) => { g.fillStyle = '#3a120c'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(200,160,80,.45)'; g.lineWidth = 3; g.strokeRect(12, 12, w - 24, h - 24); }), { roughness: 0.35 });
  const y = TOP + 0.031, shown = [];
  // On display: one card of each month, fanned.
  for (let mo = 0; mo < 12; mo++) { const m = hfCard(mo * 4); m.position.set((mo - 5.5) * 0.06, y + mo * 0.0004, 0.02 + Math.abs(mo - 5.5) * 0.01); m.rotation.y = (mo - 5.5) * -0.05; group.add(m); shown.push(m); }
  group.userData.display = shown;
  return y;
}

const SHATRANJ_P = {
  camW: 1.24,
  intro() { return 'You play the pale pieces and move first. ' + this.prompt(); },
  prompt: () => 'Pick one of your pieces, then where it should go.',
  setup(ex) {
    const G = GAMES.shatranj;
    if (ex.pieces) ex.pieces.forEach(p => ex.group.remove(p));
    ex.pieces = [];
    this.ex = ex; this.cell = Array(64).fill(null); this.lost = [0, 0];
    this.mats = [0xe8dcc0, 0x24180f];
    for (let i = 0; i < 64; i++) {
      const v = G.b[i]; if (!v) continue;
      this.cell[i] = this.spawn(G.type(v), G.owner(v), i);
    }
  },
  spawn(type, pl, i) {
    const mat = new THREE.MeshStandardMaterial({ color: this.mats[pl], roughness: pl ? 0.35 : 0.45 });
    const p = sjPiece(type, mat);
    p.position.copy(this.pos(i)); p.rotation.y = pl ? -Math.PI / 2 : Math.PI / 2;
    this.ex.group.add(p); this.ex.pieces.push(p);
    return p;
  },
  pos(i) { const c = sjCell(i); return V3(c.x, GAMES.shatranj.surface, c.z); },
  lostSpot(owner, k) { const col = k % 2, row = (k / 2) | 0; return V3((owner === 1 ? 0.48 : -0.48) + (owner === 1 ? 1 : -1) * col * 0.065, TOP, -0.3 + row * 0.075); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.shatranj;
    const mesh = this.cell[m.from], victim = this.cell[m.to];
    const type = G.type(G.b[m.from]);
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    const from = mesh.position.clone(), to = this.pos(m.to);
    const leaps = type === G.SH.N || type === G.SH.E;
    await tween(0.22 + from.distanceTo(to) * 0.5, k => { mesh.position.lerpVectors(from, to, k); mesh.position.y += Math.sin(k * Math.PI) * (leaps ? 0.06 : 0.015); });
    if (victim) { const owner = 1 - m.pl; await hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.14); }
    if (m.promo) {
      const p = this.spawn(G.SH.F, m.pl, m.to);
      p.scale.setScalar(0.01); mesh.visible = false; this.cell[m.to] = p;
      await tween(0.35, k => { p.scale.setScalar(Math.max(0.01, k)); });
    }
    return res;
  },
  score: () => { const G = GAMES.shatranj; return [['You', G.material(0) + 1], ['Scribe', G.material(1) + 1], 'pieces']; },
};
