// Euchre sits like Whist: four hands round the table, the trick in the middle. While trumps are being made the
// turned card lies face up beside the undealt cards; the dealer takes it, or it is turned down.
const EUCHRE_P = {
  camW: 1.15,
  intro() { const G = GAMES.euchre; return `You sit South; North, across the table, is your partner. ${G.who(G.dealer)} ${G.dealer ? 'deals' : 'deal'}. ` + this.prompt(); },
  prompt() { return GAMES.euchre.prompt0(); },
  choosePrompt() { return GAMES.euchre.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.euchre.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  pileSpot(side, k) { return V3(0.24 + (k % 5) * 0.016, this.y() + 0.001 + k * 0.0018, side ? -0.25 : 0.25); },
  kittySpot(k) { return V3(-0.3, this.y() + k * 0.0016, -0.02); },
  upSpot() { return V3(-0.2, this.y() + 0.002, -0.02); },
  down(m) { m.rotation.set(0, Math.PI / 2, Math.PI); },
  redeal() {
    const G = GAMES.euchre;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.piles = [0, 0];
    G.kitty.forEach((c, k) => { const m = this.card(c); this.down(m); m.position.copy(this.kittySpot(k)); });
    if (G.buried !== null) { const m = this.card(G.buried); this.down(m); m.position.copy(this.kittySpot(G.kitty.length)); }
    if (!G.hands.some(h => h.includes(G.up))) { // the turned card is still on the table (face down once turned down)
      const m = this.card(G.up); m.position.copy(this.upSpot()); m.rotation.set(0, 0, G.need === 'order1' || G.need === 'joker' ? 0 : Math.PI);
    }
    for (let s = 0; s < 4; s++) this.layHand(s, true);
    const done = G.played.slice(0, G.played.length - G.trick.length), per = G.active;
    for (let t = 0; t * per < done.length; t++) {
      const side = t < G.tricks[0] ? 0 : 1, k = this.piles[side]++, to = this.pileSpot(side, k);
      done.slice(t * per, t * per + per).forEach((c, j) => { const m = this.card(c); m.position.set(to.x, to.y + j * 0.0004, to.z); this.down(m); });
    }
    G.trick.forEach((t, j) => { const m = this.card(t.card); m.position.copy(wsTrickSpot(t.seat, this.y() + 0.002 + j * 0.0005)); m.rotation.set(0, WS_YAW[t.seat], 0); });
  },
  layHand(seat, instant) {
    const G = GAMES.euchre, h = G.hands[seat], jobs = [];
    h.forEach((c, i) => {
      const m = this.card(c), to = wsHandSpot(seat, i, h.length, this.y());
      m.rotation.set(0, WS_YAW[seat], seat === 0 && G.out !== 0 ? 0 : Math.PI);
      if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.2, 0.008));
    });
    return Promise.all(jobs);
  },
  meshesFor(m) { return (m.kind === 'play' || m.kind === 'discard') && m.seat === 0 ? [this.mesh.get(m.card)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.euchre, tok = play.token, trickBefore = G.trick.length;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); continue; }
      if (e.type === 'turnDown') { const mc = this.card(G.up); tween(0.3, k => { mc.rotation.z = Math.PI * k; }); await wait(300); continue; }
      if (e.type === 'pickup') { sfx.card(); await this.layHand(e.seat); continue; }
      if (e.type === 'discard') { const mc = this.card(e.card); sfx.card(); this.down(mc); await hop(mc, this.kittySpot(G.kitty.length), 0.3, 0.03); await this.layHand(e.seat); continue; }
      if (e.type === 'alone') { await this.layHand(e.out); continue; } // the partner's hand goes face down
      if (e.type === 'play') {
        const mc = this.card(e.card), flip = mc.rotation.z !== 0, at = wsTrickSpot(e.seat, this.y() + 0.002 + trickBefore * 0.0005);
        sfx.card();
        if (flip) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        await hop(mc, at, 0.3, 0.05);
        mc.rotation.set(0, WS_YAW[e.seat] + (Math.random() - 0.5) * 0.2, 0);
        await this.layHand(e.seat);
      }
      if (e.type === 'trick') {
        await wait(700); if (tok !== play.token) return res;
        const side = e.winner & 1, k = this.piles[side]++, to = this.pileSpot(side, k);
        const cards = G.lastTrick.cards.map(c => this.card(c));
        await Promise.all(cards.map((mc, j) => { tween(0.3, t => { mc.rotation.z = Math.PI * t; }); return hop(mc, V3(to.x, to.y + j * 0.0004, to.z), 0.35, 0.03); }));
        cards.forEach(mc => this.down(mc));
      }
    }
    return res;
  },
  score() {
    const G = GAMES.euchre, T = G.trump >= 0 ? asPack(G.SUITS[G.trump]) + ' trumps' : 'making trumps';
    return [['You and North', G.score[0]], ['West and East', G.score[1]], `to 10 · tricks ${G.tricks[0]}–${G.tricks[1]} · ${T}`];
  },
};
