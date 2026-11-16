const TAROCCHI_P = {
  camW: 1.18,
  intro() { return 'You lead the first trick. ' + this.prompt(); },
  prompt: () => (GAMES.tarocchi.trick.length ? 'Follow suit if you can, otherwise play a trump. The Fool may always be played.' : 'Choose a card to lead.'),
  setup(ex) {
    const G = GAMES.tarocchi, d = ex.group.userData;
    d.display.forEach(m => { m.visible = false; }); d.baize.visible = true;
    (ex.pieces || []).forEach(m => { ex.group.remove(m); });
    ex.pieces = [];
    this.ex = ex; this.mesh = new Map(); this.trick = []; this.pile = [0, 0];
    for (const pl of [0, 1]) for (const c of G.hands[pl]) { const m = tcCard(c); ex.group.add(m); ex.pieces.push(m); this.mesh.set(c, m); }
    this.layout(0, true); this.layout(1, true);
  },
  leave(ex) {
    const d = ex.group.userData;
    d.display.forEach(m => { m.visible = true; }); d.baize.visible = false;
    (ex.pieces || []).forEach(m => { m.visible = false; });
  },
  handSpot(pl, i, n) { return V3((i - (n - 1) / 2) * 0.074, GAMES.tarocchi.surface + 0.001 + i * 0.0002, pl ? -0.205 : 0.205); },
  trickSpot(pl) { return V3(pl ? 0.045 : -0.045, GAMES.tarocchi.surface + 0.004, pl ? -0.035 : 0.035); },
  pileSpot(pl, k) { return V3(0.5, GAMES.tarocchi.surface + 0.002 + k * 0.0017, pl ? -0.16 : 0.16); },
  layout(pl, instant) {
    const hand = GAMES.tarocchi.hands[pl];
    hand.forEach((c, i) => {
      const m = this.mesh.get(c), to = this.handSpot(pl, i, hand.length);
      m.rotation.set(0, 0, pl ? Math.PI : 0); // the Scribe's cards lie face down
      if (instant) m.position.copy(to); else hop(m, to, 0.25, 0.01);
    });
  },
  meshesFor(m) { return [this.mesh.get(m.card)]; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.tarocchi, tok = play.token, mesh = this.mesh.get(m.card);
    const res = G.apply(m);
    this.trick.push({ pl: m.pl, card: m.card });
    sfx.card();
    if (m.pl === 1) tween(0.3, k => { mesh.rotation.z = Math.PI * (1 - k); });
    await hop(mesh, this.trickSpot(m.pl), 0.32, 0.06);
    if (tok !== play.token) return res;
    this.layout(m.pl, false);
    if (res.trick) {
      await wait(900); if (tok !== play.token) return res;
      // Both cards go face down to the winner's pile; the Fool goes back to whoever played it.
      for (const t of this.trick) {
        const to = t.card === G.FOOL ? t.pl : res.winner, cm = this.mesh.get(t.card);
        tween(0.25, k => { cm.rotation.z = Math.PI * k; });
        hop(cm, this.pileSpot(to, this.pile[to]++), 0.35, 0.05);
      }
      this.trick = [];
      await wait(380);
    }
    return res;
  },
  score: () => { const G = GAMES.tarocchi; return [['You', G.score(0)], ['Scribe', G.score(1)], 'points']; },
};
