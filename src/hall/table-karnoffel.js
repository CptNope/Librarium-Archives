// Karnöffel sits like Whist, four hands round the table. Partners play with their hands open to each other, so
// North's cards lie face up across from yours.
const KARNOFFEL_P = {
  camW: 1.15,
  intro() { const G = GAMES.karnoffel; return `You sit South with North, your partner, whose cards you can see. ${G.who(G.dealer)} ${G.dealer ? 'deals' : 'deal'}; the ${G.cardName(G.lowCard)} was the lowest card turned up, so ${G.SUITS[G.chosen]} are chosen. ` + this.prompt(); },
  prompt() { return GAMES.karnoffel.prompt0(); },
  choosePrompt() { return GAMES.karnoffel.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.karnoffel.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  pileSpot(side, k) { return V3(0.24 + (k % 5) * 0.016, this.y() + 0.001 + k * 0.0018, side ? -0.25 : 0.25); },
  down(m) { m.rotation.set(0, Math.PI / 2, Math.PI); },
  redeal() {
    const G = GAMES.karnoffel;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.piles = [0, 0];
    for (let s = 0; s < 4; s++) this.layHand(s, true);
    // A resumed game: tricks already taken go back on their piles, in the order they were won.
    const done = G.played.slice(0, G.played.length - G.trick.length);
    let won = [0, 0];
    for (let t = 0; t * 4 < done.length; t++) {
      const side = won[0] < G.tricks[0] ? 0 : 1; won[side]++;
      const k = this.piles[side]++, to = this.pileSpot(side, k);
      done.slice(t * 4, t * 4 + 4).forEach((c, j) => { const m = this.card(c); m.position.set(to.x, to.y + j * 0.0004, to.z); this.down(m); });
    }
    G.trick.forEach((t, j) => { const m = this.card(t.card); m.position.copy(wsTrickSpot(t.seat, this.y() + 0.002 + j * 0.0005)); m.rotation.set(0, WS_YAW[t.seat], 0); });
  },
  layHand(seat, instant) {
    const G = GAMES.karnoffel, h = G.hands[seat], jobs = [], open = seat === 0 || seat === 2;
    h.forEach((c, i) => {
      const m = this.card(c), to = wsHandSpot(seat, i, h.length, this.y());
      // North's cards face you, so they read the right way up from your seat.
      m.rotation.set(0, seat === 2 ? 0 : WS_YAW[seat], open ? 0 : Math.PI);
      if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.2, 0.008));
    });
    return Promise.all(jobs);
  },
  meshesFor(m) { return m.kind === 'play' && m.seat === 0 ? [this.mesh.get(m.card)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.karnoffel, tok = play.token, before = G.trick.length;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); continue; }
      if (e.type === 'play') {
        const mc = this.card(e.card), flip = mc.rotation.z !== 0, at = wsTrickSpot(e.seat, this.y() + 0.002 + before * 0.0005);
        sfx.card();
        if (flip) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        await hop(mc, at, 0.3, 0.05);
        mc.rotation.set(0, WS_YAW[e.seat] + (Math.random() - 0.5) * 0.2, 0);
        await this.layHand(e.seat);
      }
      if (e.type === 'trick') {
        await wait(750); if (tok !== play.token) return res;
        const side = e.winner & 1, k = this.piles[side]++, to = this.pileSpot(side, k);
        const cards = G.lastTrick.cards.map(c => this.card(c));
        await Promise.all(cards.map((mc, j) => { tween(0.3, t => { mc.rotation.z = Math.PI * t; }); return hop(mc, V3(to.x, to.y + j * 0.0004, to.z), 0.35, 0.03); }));
        cards.forEach(mc => this.down(mc));
      }
    }
    return res;
  },
  score() {
    const G = GAMES.karnoffel;
    return [['You and North', G.score[0]], ['West and East', G.score[1]], `to ${G.target} · tricks ${G.tricks[0]}–${G.tricks[1]} · ${asPack(G.SUITS[G.chosen])} chosen`];
  },
};
