const HEX_P = {
  camW: 1.0, ringOpacity: 0.45,
  get ringScale() { return GAMES.hex.n > 9 ? 0.5 : GAMES.hex.n > 7 ? 0.6 : 0.75; },
  intro() { return 'You play red: join the red edges nearest and farthest from you. The Scribe joins the blue sides. ' + this.prompt(); },
  prompt: () => 'Choose a ring to place a stone.',
  setup(ex) {
    const G = GAMES.hex, h = ex.group.userData.hex;
    h.display.forEach(m => { m.visible = false; }); h.face(G.n);
    if (!ex.pieces) ex.pieces = [];
    ex.pieces.forEach(m => { ex.group.remove(m); }); ex.pieces = [];
    this.ex = ex; this.cell = Array(G.n * G.n).fill(null);
    for (let i = 0; i < G.n * G.n; i++) if (G.b[i]) { const s = this.stone(G.b[i] - 1, i); s.position.y = G.surface + 0.006; }
  },
  leave(ex) { const h = ex.group.userData.hex; h.display.forEach(m => { m.visible = true; }); h.face(11); (ex.pieces || []).forEach(m => { ex.group.remove(m); }); ex.pieces = []; },
  pos(i) { const c = hxCell(GAMES.hex.n, i); return V3(c.x, GAMES.hex.surface, c.z); },
  meshesFor: () => [],
  ringFor(m) { return m.swap ? null : this.pos(m.at); },
  fromFor: () => null,
  stone(pl, i) {
    const d = hxD(GAMES.hex.n), m = new THREE.Mesh(hxStoneGeo, HX_MATS[pl]); m.scale.set(d * 0.42, 0.03, d * 0.42);
    const p = this.pos(i); m.position.set(p.x, p.y + 0.06, p.z); this.ex.group.add(m); this.ex.pieces.push(m); this.cell[i] = m; return m;
  },
  async play(m) {
    const G = GAMES.hex, res = G.apply(m);
    if (res.swap) {
      const s = this.cell[res.swap.from]; this.cell[res.swap.from] = null; this.cell[res.swap.to] = s;
      s.material = HX_MATS[1]; await hop(s, V3(this.pos(res.swap.to).x, G.surface + 0.006, this.pos(res.swap.to).z), 0.5, 0.08);
      return res;
    }
    const s = this.stone(m.pl, m.at), y = G.surface + 0.006;
    await tween(0.18, k => { s.position.y = y + 0.06 * (1 - k); }, k => k * k);
    return res;
  },
  score: () => { const G = GAMES.hex; let a = 0, b = 0; G.b.forEach(v => { if (v === 1) a++; else if (v === 2) b++; }); return [['You', a], ['Scribe', b], `stones · ${G.n} × ${G.n}`]; },
};
