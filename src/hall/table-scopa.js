// Scopa is played at its own table, with a 40-card Italian pack: three cards in each hand, the open cards
// between, the stock at the side, and each player's takings in a pile on their right, any scope turned across it.
const SCOPA_P = {
  camW: 1.15,
  intro() { const G = GAMES.scopa; return (G.toMove === 0 ? 'The Scribe deals. You play first. ' : 'You deal. ') + this.prompt(); },
  prompt() { return GAMES.scopa.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.scopa.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } m.visible = true; return m; },
  handSpot(pl, i, n) { return V3((i - (n - 1) / 2) * (pl ? 0.05 : 0.075), this.y() + i * 0.0004, pl ? -0.29 : 0.29); },
  tableSpot(i, n) { // up to six in a row, then a second row
    const row = n > 6 ? (i < Math.ceil(n / 2) ? 0 : 1) : 0, per = n > 6 ? Math.ceil(n / 2) : n, k = row ? i - per : i, cnt = row ? n - per : per;
    return V3((k - (cnt - 1) / 2) * 0.075, this.y(), n > 6 ? (row ? 0.06 : -0.06) : 0);
  },
  stockSpot: k => V3(-0.5, GAMES.scopa.surface + 0.001 + k * 0.0016, 0),
  pileSpot(pl, k) { return V3(0.46, this.y() + k * 0.0016, pl ? -0.16 : 0.16); },
  faceDown(m) { m.rotation.set(0, Math.PI / 2, Math.PI); },
  redeal() {
    const G = GAMES.scopa;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.piled = [0, 0];
    G.stock.forEach((c, k) => { const m = this.card(c); this.faceDown(m); m.position.copy(this.stockSpot(k)); });
    for (const pl of [0, 1]) G.piles[pl].forEach(c => this.toPile(pl, c, true));
    this.layTable(true); this.layHand(0, true); this.layHand(1, true);
  },
  toPile(pl, c, instant) {
    const G = GAMES.scopa, m = this.card(c), to = this.pileSpot(pl, this.piled[pl]++);
    const sweep = G.sweeps.includes(c) && G.piles[pl].includes(c);
    if (sweep) { to.x += 0.03; to.y += 0.02; } // a scopa is kept face up, across the pile
    const rot = sweep ? [0, Math.PI / 2 + 0.1, 0] : [0, Math.PI / 2, Math.PI];
    if (instant) { m.position.copy(to); m.rotation.set(...rot); return null; }
    return hop(m, to, 0.3, 0.03).then(() => m.rotation.set(...rot));
  },
  layTable(instant) {
    const G = GAMES.scopa, n = G.table.length;
    return Promise.all(G.table.map((c, i) => { const m = this.card(c), to = this.tableSpot(i, n); m.rotation.set(0, 0, 0); if (instant) { m.position.copy(to); return null; } return hop(m, to, 0.25, 0.01); }));
  },
  layHand(pl, instant) {
    const G = GAMES.scopa, h = G.hands[pl];
    return Promise.all(h.map((c, i) => { const m = this.card(c), to = this.handSpot(pl, i, h.length); m.rotation.set(0, pl ? Math.PI : 0, pl ? Math.PI : 0); if (instant) { m.position.copy(to); return null; } return hop(m, to, 0.25, 0.01); }));
  },
  meshesFor(m) { return m.kind === 'play' && m.pl === 0 ? [this.mesh.get(m.c)] : []; },
  // When one card can take in more than one way, a ring sits over the middle of each set it could take.
  ringFor(m) {
    if (m.kind !== 'play') return null;
    if (!m.take.length) { const n = GAMES.scopa.table.length, at = this.tableSpot(n, n + 1); at.y += 0.004; return at; } // laid on the table
    const at = V3(0, 0, 0); m.take.forEach(c => at.add(this.card(c).position)); at.divideScalar(m.take.length);
    at.y = this.y() + 0.004; return at;
  },
  fromFor: () => null,
  async play(m) {
    const G = GAMES.scopa, tok = play.token;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); continue; }
      if (e.type === 'take' || e.type === 'lay') {
        const mc = this.card(e.c); sfx.card();
        if (e.pl === 1) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        if (e.type === 'lay') { await this.layTable(); await this.layHand(e.pl); continue; }
        const over = this.card(e.take[0]).position.clone(); over.y += 0.004;
        await hop(mc, over, 0.3, 0.04); mc.rotation.set(0, 0, 0);
        await wait(e.sweep ? 700 : 350); if (tok !== play.token) return res;
        await Promise.all([e.c, ...e.take].map(c => this.toPile(e.pl, c)));
        await this.layTable(); await this.layHand(e.pl);
        continue;
      }
      if (e.type === 'deal3') {
        sfx.card();
        for (const pl of [1 - G.dealer, G.dealer]) await this.layHand(pl);
        G.stock.forEach((c, k) => this.card(c).position.copy(this.stockSpot(k)));
        continue;
      }
      if (e.type === 'sweepUp') { await wait(400); await Promise.all(e.cards.map(c => this.toPile(e.pl, c))); }
    }
    return res;
  },
  score() {
    const G = GAMES.scopa;
    return [['You', G.total[0]], ['Scribe', G.total[1]], `to ${G.target} · hand ${G.hands0} · cards ${G.piles[0].length}–${G.piles[1].length} · scope ${G.scope[0]}–${G.scope[1]}`];
  },
};
