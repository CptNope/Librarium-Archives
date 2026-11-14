const CHATURANGA_P = {
  camW: 1.2,
  intro() { return 'A modern reconstruction, played with shatranj\'s rules. You play the ivory pieces and move first. ' + this.prompt(); },
  prompt: () => 'Pick one of your pieces, then where it should go.',
  setup(ex) {
    const G = GAMES.chaturanga;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(64).fill(null); this.lost = [0, 0];
    G.b.forEach((v, i) => { if (v) this.cell[i] = this.spawn(G.type(v), G.owner(v), i); });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  spawn(type, pl, i) {
    const o = CR_MAKE[CRG_KIND[type]](CRG_MATS[pl]);
    o.position.copy(this.pos(i)); o.rotation.y = pl ? -Math.PI / 2 : Math.PI / 2;
    this.ex.group.add(o); this.ex.pieces.push(o);
    return o;
  },
  pos(i) { const r = i >> 3, c = i & 7; return V3((c - 3.5) * CRG_S, GAMES.chaturanga.surface, (3.5 - r) * CRG_S); },
  lostSpot(owner, k) { return V3((owner ? -1 : 1) * (0.43 + (k % 2) * 0.065), TOP, (owner ? -1 : 1) * (0.3 - ((k / 2) | 0) * 0.075)); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.chaturanga, tok = play.token, mesh = this.cell[m.from], victim = this.cell[m.to];
    const type = G.type(G.b[m.from]);
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.3, type === G.SH.N || type === G.SH.E ? 0.07 : 0.025);
    if (tok !== play.token) return res;
    if (victim) { const owner = 1 - m.pl; hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12); }
    if (m.promo) { mesh.visible = false; this.cell[m.to] = this.spawn(G.SH.F, m.pl, m.to); }
    return res;
  },
  score: () => { const G = GAMES.chaturanga; return [['You', G.material(0) + 1], ['Scribe', G.material(1) + 1], 'pieces']; },
};
