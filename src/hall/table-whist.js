const WHIST_P = {
  camW: 1.25,
  intro() { return 'You sit South, nearest you. North, across the table, is your partner; West and East play against you. ' + this.prompt(); },
  prompt() {
    const G = GAMES.whist, T = G.SUITS[G.trump];
    if (G.need === 'next') return (G.notes.length ? G.notes.slice(1).join(' ') + ' ' : '') + 'Press Next deal when you are ready.';
    if (!G.trick.length) return `${T[0].toUpperCase() + T.slice(1)} are trumps. Lead any card.`;
    const led = G.SUITS[G.suit(G.trick[0].card)];
    return G.hands[0].some(c => G.suit(c) === G.suit(G.trick[0].card)) ? `${T[0].toUpperCase() + T.slice(1)} are trumps. Follow with a ${led.slice(0, -1)}.` : `You have no ${led}: play any card. ${T[0].toUpperCase() + T.slice(1)} are trumps.`;
  },
  setup(ex) {
    ex.group.userData.display.forEach(m => { m.visible = false; });
    this.ex = ex; this.redeal();
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.whist.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  // Tricks won stack face down on the right: your side's nearer you, theirs further away.
  pileSpot(side, k) { return V3(0.22 + (k % 7) * 0.016, this.y() + 0.001 + k * 0.0018, side ? -0.25 : 0.25); },
  redeal() {
    const G = GAMES.whist;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.piles = [0, 0];
    for (let s = 0; s < 4; s++) this.layHand(s, true);
    // A resumed game: the tricks already taken go back on their piles.
    const done = G.played.slice(0, G.played.length - G.trick.length);
    for (let t = 0; t * 4 < done.length; t++) {
      const side = t < G.tricks[0] ? 0 : 1, k = this.piles[side]++, to = this.pileSpot(side, k);
      done.slice(t * 4, t * 4 + 4).forEach((c, j) => { const m = this.card(c); m.position.set(to.x, to.y + j * 0.0004, to.z); m.rotation.set(0, Math.PI / 2, Math.PI); });
    }
  },
  layHand(seat, instant) {
    const G = GAMES.whist, h = G.hands[seat], jobs = [];
    h.forEach((c, i) => {
      const m = this.card(c), to = wsHandSpot(seat, i, h.length, this.y());
      const up = seat === 0 || (G.upShown && c === G.turnUp); // the turned trump stays face up until the dealer plays
      m.rotation.set(0, WS_YAW[seat], up ? 0 : Math.PI);
      if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.2, 0.008));
    });
    return Promise.all(jobs);
  },
  meshesFor(m) { return m.kind === 'play' && m.seat === 0 ? [this.mesh.get(m.card)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.whist, tok = play.token, trickBefore = G.trick.length;
    const res = G.apply(m);
    for (const e of res.events) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); continue; }
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
        cards.forEach(mc => { mc.rotation.set(0, Math.PI / 2 + (k % 2) * 0.08, Math.PI); });
      }
    }
    return res;
  },
  score() {
    const G = GAMES.whist, T = G.SUITS[G.trump];
    return [['You and North', G.score[0]], ['West and East', G.score[1]], `of 5 · tricks ${G.tricks[0]}–${G.tricks[1]} · ${T} trumps`];
  },
};
