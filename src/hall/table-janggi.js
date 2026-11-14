const JANGGI_P = {
  camW: 0.9, ringScale: 0.6,
  intro() { return 'You play Cho, in blue, and move first. ' + this.prompt(); },
  prompt: () => 'Pick a piece, then a ring, or pass. Checkmate Han\'s general to win.',
  setup(ex) {
    const G = GAMES.janggi;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(90).fill(null); this.lost = [0, 0];
    G.b.forEach((v, i) => { if (!v) return; const m = jgPiece(v > 8 ? 1 : 0, v & 7); m.position.copy(this.pos(i)); ex.group.add(m); ex.pieces.push(m); this.cell[i] = m; });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  pos(i) { const c = xqCell(i); return V3(c.x, GAMES.janggi.surface + 0.009, c.z); },
  lostSpot(owner, k) { return V3(owner === 1 ? 0.44 : -0.44, TOP + 0.009 + (k % 8) * 0.019, -0.28 + ((k / 8) | 0) * 0.08); },
  meshesFor(m) { return m.pass ? [] : [this.cell[m.from]]; },
  ringFor(m) { return m.pass ? null : this.pos(m.to); },
  fromFor(m) { return m.pass ? null : this.pos(m.from); },
  async play(m) {
    const G = GAMES.janggi, tok = play.token;
    if (m.pass) return G.apply(m);
    const mesh = this.cell[m.from], victim = this.cell[m.to];
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.3, (mesh.userData.t === 6 || mesh.userData.t === 3 || mesh.userData.t === 4) ? 0.07 : 0.03);
    if (tok !== play.token) return res;
    if (victim) { const owner = 1 - m.pl; hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.14); }
    return res;
  },
  score: () => { const G = GAMES.janggi; return [['You', G.points(0)], ['Scribe', G.points(1)], 'points']; },
};
