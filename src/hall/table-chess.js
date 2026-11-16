const CHESS_P = {
  camW: 1.0,
  intro() { return 'You play white and move first. ' + this.prompt(); },
  prompt: () => 'Pick a piece, then a ring. To castle, pick the king and the ring two squares over.',
  setup(ex) {
    const G = GAMES.chess, d = ex.group.userData;
    d.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m));
    ex.pieces = []; this.ex = ex;
    this.cell = Array(64).fill(null); this.lost = [0, 0];
    for (let i = 0; i < 64; i++) { const v = G.b[i]; if (v) this.cell[i] = this.make(v, i); }
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => { m.visible = false; }); },
  make(v, i) {
    const pl = v > 8 ? 1 : 0, t = 'xkqbnrp'[v & 7];
    const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x241810 : 0xeee0c0, roughness: pl ? 0.35 : 0.4 });
    const o = CHESS_SHAPES[t](mat); o.userData.mats = [mat]; o.rotation.y = pl ? -Math.PI / 2 : Math.PI / 2;
    if (i !== undefined) o.position.copy(this.pos(i));
    this.ex.group.add(o); this.ex.pieces.push(o); return o;
  },
  pos(i) { return V3(((i & 7) - 3.5) * 0.085, GAMES.chess.surface, (3.5 - (i >> 3)) * 0.085); },
  lostSpot(owner, k) { return V3(owner ? -0.47 : 0.47, TOP, (owner ? -0.3 : 0.3) * (1 - (k % 8) / 8 * 2) * 0.9); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.chess, tok = play.token;
    const mesh = this.cell[m.from], vSq = m.epTake !== undefined ? m.epTake : m.to, victim = m.cap ? this.cell[vSq] : null;
    this.cell[m.from] = null; if (victim) this.cell[vSq] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.32, (G.b[m.to] & 7) === 4 ? 0.08 : 0.03);
    if (tok !== play.token) return res;
    if (victim) { const owner = 1 - m.pl; hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12); }
    if (m.castle) { const rook = this.cell[m.castle[0]]; this.cell[m.castle[0]] = null; this.cell[m.castle[1]] = rook; await hop(rook, this.pos(m.castle[1]), 0.3, 0.06); }
    if (m.promo) { mesh.visible = false; this.cell[m.to] = this.make(G.b[m.to], m.to); }
    return res;
  },
  score: () => { const G = GAMES.chess; return [['You', G.count(0)], ['Scribe', G.count(1)], 'pieces']; },
};
