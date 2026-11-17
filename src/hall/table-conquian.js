// Conquian: your hand near you and the Scribe's across the table, each player's melds laid out in front of
// them, the stock on the right, the cards turned down beside it, and the centre card face up in the middle.
const CONQUIAN_P = {
  camW: 1.15,
  intro() { const G = GAMES.conquian; return (G.toMove === 0 ? 'The Scribe deals; you see the first card. ' : 'You deal; the Scribe sees the first card. ') + this.prompt(); },
  prompt() { return GAMES.conquian.prompt0(); },
  choosePrompt() { return GAMES.conquian.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.conquian.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); m.scale.set(1.1, 1, 1.1); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } m.visible = true; return m; },
  handSpot(pl, i, n) { return V3((i - (n - 1) / 2) * (pl ? 0.042 : 0.064), this.y() + i * 0.0004, pl ? -0.34 : 0.34); },
  // Melds in a row across the table, each a fan of overlapping cards.
  meldSpot(pl, mi, j) {
    const G = GAMES.conquian, ms = G.melds[pl], widths = ms.map(m => 0.09 + (m.length - 1) * 0.03), total = widths.reduce((a, b) => a + b, 0) + (ms.length - 1) * 0.03;
    let x = -total / 2; for (let k = 0; k < mi; k++) x += widths[k] + 0.03;
    return V3(x + 0.045 + j * 0.03, this.y() + j * 0.0005, pl ? -0.14 : 0.14);
  },
  centreSpot() { return V3(0, this.y() + 0.004, 0); },
  stockSpot(k) { return V3(0.5, this.y() + k * 0.0014, 0); },
  deadSpot(k) { return V3(-0.5, this.y() + k * 0.0014, 0); },
  down(m) { m.rotation.set(0, Math.PI / 2, Math.PI); },
  redeal() {
    const G = GAMES.conquian;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map();
    G.stock.forEach((c, k) => { const m = this.card(c); this.down(m); m.position.copy(this.stockSpot(k)); });
    G.dead.forEach((c, k) => { const m = this.card(c); this.down(m); m.position.copy(this.deadSpot(k)); });
    if (G.centre !== null) { const m = this.card(G.centre); m.rotation.set(0, 0.08, 0); m.position.copy(this.centreSpot()); }
    this.layMelds(0, true); this.layMelds(1, true); this.layHand(0, true); this.layHand(1, true);
  },
  layHand(pl, instant) {
    const G = GAMES.conquian, h = G.hands[pl];
    return Promise.all(h.map((c, i) => { const m = this.card(c), to = this.handSpot(pl, i, h.length); m.rotation.set(0, pl ? Math.PI : 0, pl ? Math.PI : 0); if (instant) { m.position.copy(to); return null; } return hop(m, to, 0.22, 0.008); }));
  },
  layMelds(pl, instant) {
    const G = GAMES.conquian, jobs = [];
    G.melds[pl].forEach((ms, mi) => ms.forEach((c, j) => { const m = this.card(c), to = this.meldSpot(pl, mi, j); m.rotation.set(0, 0, 0); if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.25, 0.02)); }));
    return Promise.all(jobs);
  },
  meshesFor(m) { return m.kind === 'discard' && m.pl === 0 ? [this.mesh.get(m.card)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.conquian, tok = play.token;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); continue; }
      if (e.type === 'meld' || e.type === 'lay') {
        sfx.card();
        if (e.pl === 1) (e.cards || [e.card]).forEach(c => { const mc = this.card(c); tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); }); });
        await this.layMelds(e.pl); await this.layHand(e.pl);
        continue;
      }
      if (e.type === 'discard') {
        const mc = this.card(e.card); sfx.card();
        if (e.pl === 1) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        await hop(mc, this.centreSpot(), 0.3, 0.04); mc.rotation.set(0, 0.08, 0);
        await this.layHand(e.pl);
        continue;
      }
      if (e.type === 'dead') { const mc = this.card(e.card); sfx.card(); tween(0.3, k => { mc.rotation.z = Math.PI * k; }); await hop(mc, this.deadSpot(G.dead.length - 1), 0.3, 0.03); this.down(mc); continue; }
      if (e.type === 'turnup') { const mc = this.card(e.card); sfx.card(); tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); }); await hop(mc, this.centreSpot(), 0.3, 0.04); mc.rotation.set(0, 0.08, 0); continue; }
      if (e.type === 'pass') { await wait(250); continue; }
    }
    return res;
  },
  score() {
    const G = GAMES.conquian, melded = pl => G.melds[pl].reduce((t, m) => t + m.length, 0);
    return [['You', G.wins[0]], ['Scribe', G.wins[1]], `hands to win ${G.target} · melded ${melded(0)}–${melded(1)} of 11 · stock ${G.stock.length}`];
  },
};
