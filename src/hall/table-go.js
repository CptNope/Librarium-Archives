const GO_P = {
  camW: 0.95, ringScale: 0.6, ringOpacity: 0.4,
  intro() { return 'You play black and move first. ' + this.prompt(); },
  prompt: () => 'Choose a ring to place a stone, or Pass when nothing useful is left.',
  setup(ex) {
    const G = GAMES.go, d = ex.group.userData.go;
    d.face17.visible = false; d.display.forEach(m => { m.visible = false; }); d.face9.visible = true;
    if (!ex.pieces) ex.pieces = [];
    ex.pieces.forEach(m => { m.visible = false; });
    this.ex = ex; this.cell = Array(81).fill(null); this.free = ex.pieces.slice();
    for (let p = 0; p < 81; p++) if (G.b[p]) { const s = this.stone(G.b[p] - 1); s.position.copy(this.pos(p)); s.visible = true; this.cell[p] = s; }
  },
  leave(ex) {
    const d = ex.group.userData.go;
    d.face17.visible = true; d.display.forEach(m => { m.visible = true; }); d.face9.visible = false;
    (ex.pieces || []).forEach(m => { m.visible = false; });
  },
  stone(pl) {
    let m = this.free.findIndex(x => x.userData.pl === pl);
    if (m >= 0) return this.free.splice(m, 1)[0];
    const s = new THREE.Mesh(go9StoneGeo, GO9_MATS[pl]); s.scale.y = 0.42; s.userData.pl = pl;
    this.ex.group.add(s); this.ex.pieces.push(s); return s;
  },
  pos(p) { const c = goCell(p); return V3(c.x, GAMES.go.surface + 0.012, c.z); },
  meshesFor: () => [],
  ringFor(m) { return m.pass ? null : this.pos(m.p); },
  fromFor: () => null,
  async play(m) {
    const G = GAMES.go;
    const res = G.apply(m);
    if (m.pass) return res;
    const s = this.stone(m.pl); this.cell[m.p] = s;
    const to = this.pos(m.p);
    s.position.set(to.x, to.y + 0.08, to.z); s.visible = true;
    await tween(0.18, k => { s.position.y = to.y + 0.08 * (1 - k); }, k => k * k);
    if (res.caps.length) {
      const gone = res.caps.map(p => { const g = this.cell[p]; this.cell[p] = null; return g; }).filter(Boolean);
      await tween(0.3, k => { gone.forEach(g => { g.scale.set(1 - k * 0.9, 0.42 * (1 - k * 0.9), 1 - k * 0.9); }); });
      gone.forEach(g => { g.visible = false; g.scale.set(1, 0.42, 1); this.free.push(g); });
    }
    return res;
  },
  score: () => { const G = GAMES.go; return [['You', G.count(0)], ['Scribe', G.count(1)], 'stones · komi 7']; },
};
