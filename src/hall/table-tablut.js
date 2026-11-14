const TABLUT_P = {
  camW: 1.12, ringScale: 0.7,
  intro() { return 'The Scribe\'s Muscovites move first. ' + this.prompt(); },
  prompt: () => 'Pick one of your pieces, then where it should go. Get the king to any edge square.',
  setup(ex) {
    const G = GAMES.tablut;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(81).fill(null); this.lost = [0, 0];
    G.b.forEach((v, i) => { if (!v) return; const m = tbPiece(v); m.position.copy(this.pos(i)); ex.group.add(m); ex.pieces.push(m); this.cell[i] = m; m.userData.v = v; });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  pos(i) { const c = tbCell(i); return V3(c.x, GAMES.tablut.surface, c.z); },
  lostSpot: (owner, k) => V3(owner === 1 ? 0.5 : -0.5, TOP, -0.36 + (k % 9) * 0.08),
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.tablut, mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
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
  score: () => [['Your side', GAMES.tablut.count(0)], ['Muscovites', GAMES.tablut.count(1)], 'pieces'],
};
