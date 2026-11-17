// Ombre is played three-handed at a three-cornered table: you at the near side, East at the side on your right
// and West at the side on your left; the thirteen-card talon lies face down toward the far corner.
const OMBRE_P = {
  camW: 1.4,
  intro() { const G = GAMES.ombre; return `You sit South; East is on your right and West on your left, and play goes to the right. ${G.who(G.dealer)} ${G.dealer ? 'deals' : 'deal'}. ` + this.prompt(); },
  prompt() { return GAMES.ombre.prompt0(); },
  choosePrompt() { return GAMES.ombre.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.ombre.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  talonSpot(k) { return V3((k % 2) * 0.004, this.y() + k * 0.0016, -0.24); },
  discardSpot(s, k) { return omSpot(s, -0.26, 0.27, this.y() + k * 0.0016); },
  pileSpot(s, k) { return omSpot(s, 0.26, 0.27, this.y() + k * 0.0016); },
  down(m) { m.rotation.set(0, Math.PI / 2, Math.PI); },
  redeal() {
    const G = GAMES.ombre;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.piles = [0, 0, 0]; this.dis = [0, 0, 0];
    G.talon.forEach((c, k) => { const m = this.card(c); this.down(m); m.position.copy(this.talonSpot(k)); });
    for (let s = 0; s < 3; s++) { G.discards[s].forEach(c => { const m = this.card(c); this.down(m); m.position.copy(this.discardSpot(s, this.dis[s]++)); }); this.layHand(s, true); }
    // A resumed game: each trick goes back to the pile of the seat that won it.
    const done = G.played.slice(0, G.played.length - G.trick.length), left = G.tricks.slice();
    for (let t = 0; t * 3 < done.length; t++) {
      let w = left.findIndex(n => n > 0); if (w < 0) w = 0; left[w]--;
      const to = this.pileSpot(w, this.piles[w]++);
      done.slice(t * 3, t * 3 + 3).forEach((c, j) => { const m = this.card(c); m.position.set(to.x, to.y + j * 0.0004, to.z); this.down(m); });
    }
    G.trick.forEach((t, j) => { const m = this.card(t.card); m.position.copy(omTrickSpot(t.seat, this.y() + 0.002 + j * 0.0005)); m.rotation.set(0, OM_YAW[t.seat], 0); });
  },
  layHand(seat, instant) {
    const G = GAMES.ombre, h = G.hands[seat], jobs = [];
    h.forEach((c, i) => {
      const m = this.card(c), to = omHandSpot(seat, i, h.length, this.y());
      if (seat === 0 && G.need === 'exchange' && G.toMove === 0 && G.marked.includes(c)) { to.z -= 0.035; to.y += 0.006; } // marked to throw
      m.rotation.set(0, OM_YAW[seat], seat === 0 ? 0 : Math.PI);
      if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.2, 0.008));
    });
    return Promise.all(jobs);
  },
  meshesFor(m) { return (m.kind === 'play' || m.kind === 'mark') && m.seat === 0 ? [this.mesh.get(m.card)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.ombre, tok = play.token, before = G.trick.length;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); continue; }
      if (e.type === 'mark') { if (e.seat === 0) await this.layHand(0); continue; }
      if (e.type === 'trumps') { await this.layHand(0); continue; }
      if (e.type === 'exchange') {
        sfx.card();
        await Promise.all(e.out.map(c => { const mc = this.card(c); this.down(mc); return hop(mc, this.discardSpot(e.seat, this.dis[e.seat]++), 0.3, 0.03); }));
        await this.layHand(e.seat);
        G.talon.forEach((c, k) => this.card(c).position.copy(this.talonSpot(k)));
        continue;
      }
      if (e.type === 'play') {
        const mc = this.card(e.card), flip = mc.rotation.z !== 0, at = omTrickSpot(e.seat, this.y() + 0.002 + before * 0.0005);
        sfx.card();
        if (flip) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        await hop(mc, at, 0.3, 0.05);
        mc.rotation.set(0, OM_YAW[e.seat] + (Math.random() - 0.5) * 0.2, 0);
        await this.layHand(e.seat);
      }
      if (e.type === 'trick') {
        await wait(700); if (tok !== play.token) return res;
        const k = this.piles[e.winner]++, to = this.pileSpot(e.winner, k);
        const cards = G.lastTrick.cards.map(c => this.card(c));
        await Promise.all(cards.map((mc, j) => { tween(0.3, t => { mc.rotation.z = Math.PI * t; }); return hop(mc, V3(to.x, to.y + j * 0.0004, to.z), 0.35, 0.03); }));
        cards.forEach(mc => this.down(mc));
      }
    }
    return res;
  },
  score() {
    const G = GAMES.ombre, T = G.trump >= 0 ? asPack(G.SUITS[G.trump]) + ' trumps' : 'bidding';
    const who = G.ombre < 0 ? '' : ` · Ombre: ${G.ombre ? G.SEATS[G.ombre] : 'you'}`;
    return [['You', G.bank[0]], ['East', G.bank[1]], ['West', G.bank[2]], `deal ${Math.min(G.deals + 1, G.limit)} of ${G.limit} · ${T}${who} · tricks ${G.tricks.join('–')}`];
  },
};
