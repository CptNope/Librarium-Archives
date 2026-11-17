// Hearts sits like Whist, four hands round the table, but every player keeps their own tricks, in a pile at
// their right hand. Before a hand, the three cards you mark to pass are lifted out of the hand.
const HEARTS_P = {
  camW: 1.15,
  intro() { return 'Four players, each for themselves: you, West, North and East. ' + this.prompt(); },
  prompt() { return GAMES.hearts.prompt0(); },
  choosePrompt() { return GAMES.hearts.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.hearts.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  pileSpot(seat, k) { const a = WS_YAW[seat], r = 0.27, t = 0.3; return V3(r * Math.sin(a) + t * Math.cos(a), this.y() + 0.001 + k * 0.0018, r * Math.cos(a) - t * Math.sin(a)); },
  down(m) { m.rotation.set(0, Math.PI / 2, Math.PI); },
  redeal() {
    const G = GAMES.hearts;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.piles = [0, 0, 0, 0];
    for (let s = 0; s < 4; s++) this.layHand(s, true);
    // A resumed game: each player's taken cards go back on their pile.
    G.taken.forEach((cs, s) => cs.forEach(c => { const m = this.card(c), to = this.pileSpot(s, this.piles[s]++ / 4); m.position.copy(to); this.down(m); }));
    G.trick.forEach((t, j) => { const m = this.card(t.card); m.position.copy(wsTrickSpot(t.seat, this.y() + 0.002 + j * 0.0005)); m.rotation.set(0, WS_YAW[t.seat], 0); });
  },
  layHand(seat, instant) {
    const G = GAMES.hearts, h = G.hands[seat], jobs = [];
    h.forEach((c, i) => {
      const m = this.card(c), to = wsHandSpot(seat, i, h.length, this.y());
      if (seat === 0 && G.need === 'pass' && G.marked.includes(c)) { to.z -= 0.035; to.y += 0.006; } // marked to pass
      m.rotation.set(0, WS_YAW[seat], seat === 0 ? 0 : Math.PI);
      if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.2, 0.008));
    });
    return Promise.all(jobs);
  },
  meshesFor(m) { return (m.kind === 'play' || m.kind === 'mark') && m.seat === 0 ? [this.mesh.get(m.card)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.hearts, tok = play.token, before = G.trick.length;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); continue; }
      if (e.type === 'mark') { await this.layHand(0); continue; }
      if (e.type === 'passed') { sfx.card(); await Promise.all([0, 1, 2, 3].map(s => this.layHand(s))); continue; }
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
        const k = this.piles[e.winner]++, to = this.pileSpot(e.winner, k);
        const cards = G.lastTrick.cards.map(c => this.card(c));
        await Promise.all(cards.map((mc, j) => { tween(0.3, t => { mc.rotation.z = Math.PI * t; }); return hop(mc, V3(to.x, to.y + j * 0.0004, to.z), 0.35, 0.03); }));
        cards.forEach(mc => this.down(mc));
      }
    }
    return res;
  },
  score() {
    const G = GAMES.hearts, pts = G.taken.map(cs => cs.reduce((t, c) => t + (c === 11 ? 13 : ((c / 13) | 0) === 1 ? 1 : 0), 0));
    return [['You', G.score[0]], ['West', G.score[1]], ['North', G.score[2]], ['East', G.score[3]], `to ${G.limit}, lowest wins · this hand ${pts.join('–')}${G.broken ? ' · hearts broken' : ''}`];
  },
};
