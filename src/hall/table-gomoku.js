const GOMOKU_P = {
  camW: 0.98, ringScale: 0.4, ringOpacity: 0.3,
  intro() { return 'You play black and move first. ' + this.prompt(); },
  prompt: () => 'Choose a ring to place a stone. Five in a row wins.',
  setup(ex) {
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [];
    ex.pieces.forEach(m => { ex.group.remove(m); }); ex.pieces = []; this.ex = ex; this.cell = Array(225).fill(null);
    const G = GAMES.gomoku;
    for (let i = 0; i < 225; i++) if (G.b[i]) this.stone(G.b[i] - 1, i);
  },
  stone(pl, i) {
    const s = new THREE.Mesh(gmStoneGeo, GO9_MATS[pl]); s.scale.y = 0.42; this.ex.group.add(s); this.ex.pieces.push(s); this.cell[i] = s;
    const to = this.pos(i); s.position.set(to.x, to.y + 0.0095, to.z); return s;
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => { ex.group.remove(m); }); ex.pieces = []; },
  pos(i) { const c = gmCell(i); return V3(c.x, GAMES.gomoku.surface, c.z); },
  meshesFor: () => [],
  ringFor(m) { return this.pos(m.at); },
  fromFor: () => null,
  async play(m) {
    const G = GAMES.gomoku, res = G.apply(m);
    const s = this.stone(m.pl, m.at), to = s.position.clone(); s.position.y = to.y + 0.07;
    await tween(0.16, k => { s.position.y = to.y + 0.07 * (1 - k); }, k => k * k);
    return res;
  },
  onFinish() { // lift the winning line a little
    const G = GAMES.gomoku; if (!G.line) return;
    G.line.forEach(i => { const s = this.cell[i]; if (s) hop(s, V3(s.position.x, s.position.y + 0.012, s.position.z), 0.4, 0.02); });
  },
  score: () => { const G = GAMES.gomoku; return [['Stones', G.ply], ['Points left', 225 - G.ply], '']; },
};
