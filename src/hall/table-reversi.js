const REVERSI_P = {
  camW: 1.06,
  intro() { return 'You play the dark discs and move first. ' + this.prompt(); },
  prompt: () => 'Choose a ring to place a disc. Every Scribe disc you trap in a line flips to dark.',
  setup(ex) {
    const G = GAMES.reversi;
    if (!ex.pieces) ex.pieces = Array.from({ length: 64 }, () => { const d = rvDisc(); d.visible = false; ex.group.add(d); return d; });
    this.ex = ex; this.cell = Array(64).fill(null); this.free = ex.pieces.slice();
    ex.pieces.forEach(d => { d.visible = false; });
    for (let i = 0; i < 64; i++) if (G.b[i]) this.put(i, G.b[i] - 1, false);
  },
  pos(i) { const c = rvCell(i); return V3(c.x, GAMES.reversi.surface + 0.006, c.z); },
  face: pl => (pl === 0 ? 0 : Math.PI),
  put(i, pl) { const d = this.free.pop(); d.visible = true; d.position.copy(this.pos(i)); d.rotation.set(this.face(pl), 0, 0); this.cell[i] = d; return d; },
  meshesFor() { return []; },
  ringFor(m) { return m.pass ? null : this.pos(m.at); },
  async play(m) {
    const G = GAMES.reversi, tok = play.token;
    if (m.pass) return G.apply(m);
    const res = G.apply(m);
    const d = this.put(m.at, m.pl);
    const to = d.position.clone(); d.position.y += 0.12;
    await tween(0.22, k => { d.position.y = to.y + 0.12 * (1 - k); });
    for (const f of m.flips) {
      if (tok !== play.token) return res;
      const disc = this.cell[f], base = disc.position.y, a0 = disc.rotation.x, a1 = this.face(m.pl);
      await tween(0.16, k => { disc.rotation.x = a0 + (a1 - a0) * k; disc.position.y = base + Math.sin(k * Math.PI) * 0.03; });
    }
    return res;
  },
  score: () => { const G = GAMES.reversi; return [['You', G.count(0)], ['Scribe', G.count(1)], 'discs']; },
};
