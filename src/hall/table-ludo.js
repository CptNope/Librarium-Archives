const LUDO_P = {
  camW: 1.05, ringScale: 0.6,
  intro() { return 'You play red, from the yard nearest you on the left. ' + this.prompt(); },
  prompt: () => 'Throw the die. A six brings a token out and earns another throw.',
  choosePrompt: () => 'Pick a glowing token, then its ring.',
  setup(ex) {
    const G = GAMES.ludo;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.tokens) ex.tokens = [LD_COL.red, LD_COL.yellow].map(col => Array.from({ length: 4 }, () => { const m = goosePawn(col); m.scale.setScalar(0.8); ex.group.add(m); return m; }));
    ex.tokens.flat().forEach(m => { m.visible = true; });
    this.ex = ex;
    [0, 1].forEach(pl => G.pos[pl].forEach((rel, k) => ex.tokens[pl][k].position.copy(this.spot(pl, rel, k))));
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.tokens || []).flat().forEach(m => { m.visible = false; }); },
  spot(pl, rel, k) {
    const p = ldSpot(pl, rel, k), G = GAMES.ludo;
    // Tokens sharing a square stand a little apart.
    let dx = 0; if (rel >= 0 && rel < 56) { const same = G.pos[pl].map((r, j) => (r === rel ? j : -1)).filter(j => j >= 0); if (same.length > 1) dx = (same.indexOf(k) - (same.length - 1) / 2) * 0.016; }
    return V3(p.x + dx, G.surface, p.z + (pl ? -0.006 : 0.006));
  },
  meshesFor(m) { return [this.ex.tokens[m.pl][m.k]]; },
  ringFor(m) { const p = ldSpot(m.pl, m.to, m.k); return V3(p.x, GAMES.ludo.surface, p.z); },
  fromFor: () => null,
  async play(m) {
    const G = GAMES.ludo, tok = play.token, t = this.ex.tokens[m.pl][m.k];
    for (const rel of G.steps(m)) { if (tok !== play.token) return {}; const p = ldSpot(m.pl, rel, m.k); await hop(t, V3(p.x, G.surface, p.z), 0.14, 0.03); }
    const res = G.apply(m);
    await hop(t, this.spot(m.pl, m.to, m.k), 0.12, 0.01);
    for (const k of res.caps) hop(this.ex.tokens[1 - m.pl][k], this.spot(1 - m.pl, -1, k), 0.55, 0.12);
    return res;
  },
  score: () => { const G = GAMES.ludo; return [['You', G.home(0)], ['Scribe', G.home(1)], 'tokens home of 4']; },
};
