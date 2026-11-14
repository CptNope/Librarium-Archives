const FANORONA_P = {
  camW: 1.06, ringScale: 0.62,
  intro() { return 'You play white and move first. ' + this.prompt(); },
  prompt: () => (GAMES.fanorona.chain ? 'Capture again with the same stone, or choose Stop.' : 'Pick a stone, then the ring on the enemy stone you want to capture, or a ring on an empty point to move.'),
  setup(ex) {
    const G = GAMES.fanorona;
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 22 }, () => { const m = stoneMesh(pl ? 0x100c0a : 0xeee6d2, 0.03, 0.55, 0.4); ex.group.add(m); return m; }));
    this.cell = Array(45).fill(null); this.lost = [0, 0]; const k = [0, 0];
    ex.pieces.flat().forEach(m => { m.visible = true; });
    for (let i = 0; i < 45; i++) { const v = G.b[i]; if (!v) continue; const m = ex.pieces[v - 1][k[v - 1]++]; this.cell[i] = m; m.position.copy(this.pos(i)); }
    for (const pl of [0, 1]) ex.pieces[pl].slice(k[pl]).forEach(m => m.position.copy(this.lostSpot(pl, this.lost[pl]++)));
  },
  pos(i) { const p = fnCell(i); return V3(p.x, GAMES.fanorona.surface + 0.016, p.z); },
  lostSpot(owner, k) { return V3(-0.4 + (k % 11) * 0.08, TOP + 0.017, owner ? -0.34 - ((k / 11) | 0) * 0.07 : 0.34 + ((k / 11) | 0) * 0.07); },
  ringTone: m => (m.cap ? 'ember' : 'gold'),
  meshesFor(m) { return m.pass ? [] : [this.cell[m.from]]; },
  // A capture is chosen by the stone it takes first, which tells approach from withdrawal.
  ringFor(m) { return m.pass ? null : this.pos(m.caps.length ? m.caps[0] : m.to); },
  fromFor(m) { return m.pass ? null : this.pos(m.from); },
  ringTone: m => (m.caps && m.caps.length ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES.fanorona, tok = play.token;
    if (m.pass) return G.apply(m);
    const mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const victims = m.caps.map(c => { const v = this.cell[c]; this.cell[c] = null; return v; });
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.26, 0.03);
    if (tok !== play.token) return res;
    victims.forEach((v, k) => { const owner = 1 - m.pl; setTimeout(() => hop(v, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12), k * 70); });
    if (victims.length) await wait(200 + victims.length * 70);
    return res;
  },
  score: () => { const G = GAMES.fanorona; return [['You', G.count(0)], ['Scribe', G.count(1)], 'stones']; },
};
