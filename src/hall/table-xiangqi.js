const XIANGQI_P = {
  camW: 0.9, ringScale: 0.62,
  intro() { return 'You play red and move first. ' + this.prompt(); },
  prompt: () => 'Pick a piece, then a ring. Protect your general: checkmate wins.',
  setup(ex) {
    const G = GAMES.xiangqi;
    if (!ex.pieces) { ex.pieces = []; for (let i = 0; i < 90; i++) { const v = G.b[i]; if (v) { const m = xqPiece(v >= 8 ? 1 : 0, v & 7); ex.group.add(m); ex.pieces.push(m); } } }
    this.cell = Array(90).fill(null); this.lost = [0, 0];
    const pool = ex.pieces.slice();
    ex.pieces.forEach(m => { m.visible = true; });
    for (let i = 0; i < 90; i++) {
      const v = G.b[i]; if (!v) continue;
      const k = pool.findIndex(m => m.userData.pl === (v >= 8 ? 1 : 0) && m.userData.t === (v & 7));
      const m = pool.splice(k, 1)[0]; this.cell[i] = m; m.position.copy(this.pos(i));
    }
  },
  pos(i) { const c = xqCell(i); return V3(c.x, GAMES.xiangqi.surface + 0.008, c.z); },
  lostSpot(owner, k) { return V3(owner === 1 ? 0.44 : -0.44, TOP + 0.008 + (k % 8) * 0.0165, -0.28 + ((k / 8) | 0) * 0.07); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.xiangqi, tok = play.token;
    const mesh = this.cell[m.from], victim = this.cell[m.to];
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.3, 0.06);
    if (tok !== play.token) return res;
    if (victim) { const owner = 1 - m.pl; hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.14); }
    return res;
  },
  score: () => { const G = GAMES.xiangqi; return [['You', G.count(0)], ['Scribe', G.count(1)], 'pieces']; },
};
