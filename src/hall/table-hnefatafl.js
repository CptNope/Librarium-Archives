const HNEFATAFL_P = {
  camW: 1.15, ringScale: 0.62,
  intro() { return 'The Scribe\'s attackers move first. ' + this.prompt(); },
  prompt: () => 'Pick one of your pieces, then where it should go. Bring the king to a corner.',
  setup(ex) {
    const G = GAMES.hnefatafl;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(121).fill(null); this.lost = [0, 0];
    G.b.forEach((v, i) => { if (!v) return; const m = hnPiece(v); m.position.copy(this.pos(i)); ex.group.add(m); ex.pieces.push(m); this.cell[i] = m; m.userData.v = v; });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  pos(i) { const c = hnCell(i); return V3(c.x, GAMES.hnefatafl.surface, c.z); },
  lostSpot: (owner, k) => V3(owner === 1 ? 0.52 : -0.52, TOP, -0.38 + (k % 12) * 0.068),
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.hnefatafl, mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m), from = mesh.position.clone(), to = this.pos(m.to);
    await tween(0.2 + from.distanceTo(to) * 0.5, k => { mesh.position.lerpVectors(from, to, k); mesh.position.y += Math.sin(k * Math.PI) * 0.025; });
    for (const c of res.caps) {
      const cm = this.cell[c]; this.cell[c] = null;
      if (cm.userData.v === 3) { await tween(0.6, k => { cm.rotation.z = k * 1.45; }); continue; }
      const owner = cm.userData.v === 1 ? 1 : 0;
      await hop(cm, this.lostSpot(owner, this.lost[owner]++), 0.42, 0.14);
    }
    return res;
  },
  score: () => [['Your side', GAMES.hnefatafl.count(0)], ['Attackers', GAMES.hnefatafl.count(1)], 'pieces'],
};
