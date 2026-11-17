// Skat is played three-handed too, at the same kind of three-cornered table, but play goes to the left: West, on
// your left, sits at the side Ombre gives its West. The skat lies face down toward the far corner.
const SK_AT = [0, 2, 1]; // Skat's seat to the side of the table it sits at
const SKAT_P = {
  camW: 1.4,
  intro() { const G = GAMES.skat; return `You sit South; West is on your left and East on your right, and play goes to the left. ${G.who(G.dealer)} ${G.dealer ? 'deals' : 'deal'}. ` + this.prompt(); },
  prompt() { return GAMES.skat.prompt0(); },
  choosePrompt() { return GAMES.skat.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.skat.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  talonSpot(k) { return V3((k % 2) * 0.004, this.y() + k * 0.0016, -0.24); },
  discardSpot(s, k) { return omSpot(SK_AT[s], -0.26, 0.27, this.y() + k * 0.0016); },
  pileSpot(s, k) { return omSpot(SK_AT[s], 0.26, 0.27, this.y() + k * 0.0016); },
  down(m) { m.rotation.set(0, Math.PI / 2, Math.PI); },
  redeal() {
    const G = GAMES.skat;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.piles = [0, 0, 0]; this.dis = [0, 0, 0];
    G.skat.forEach((c, k) => { const m = this.card(c); this.down(m); m.position.copy(this.talonSpot(k)); });
    if (G.declarer >= 0) G.discards.forEach(c => { const m = this.card(c); this.down(m); m.position.copy(this.discardSpot(G.declarer, this.dis[G.declarer]++)); });
    for (let s = 0; s < 3; s++) this.layHand(s, true);
    // A resumed game: each player's taken cards go back on their pile.
    G.taken.forEach((cs, s) => cs.forEach(c => { const m = this.card(c), to = this.pileSpot(s, this.piles[s]++ / 3); m.position.copy(to); this.down(m); }));
    G.trick.forEach((t, j) => { const m = this.card(t.card); m.position.copy(omTrickSpot(SK_AT[t.seat], this.y() + 0.002 + j * 0.0005)); m.rotation.set(0, OM_YAW[SK_AT[t.seat]], 0); });
  },
  layHand(seat, instant) {
    const G = GAMES.skat, h = G.hands[seat], jobs = [];
    h.forEach((c, i) => {
      const m = this.card(c), to = omHandSpot(SK_AT[seat], i, h.length, this.y());
      if (seat === 0 && G.need === 'discard' && G.toMove === 0 && G.marked.includes(c)) { to.z -= 0.035; to.y += 0.006; } // marked to lay away
      m.rotation.set(0, OM_YAW[SK_AT[seat]], seat === 0 ? 0 : Math.PI);
      if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.2, 0.008));
    });
    return Promise.all(jobs);
  },
  meshesFor(m) { return (m.kind === 'play' || m.kind === 'mark') && m.seat === 0 ? [this.mesh.get(m.card)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.skat, tok = play.token, before = G.trick.length;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); continue; }
      if (e.type === 'mark') { if (e.seat === 0) await this.layHand(0); continue; }
      if (e.type === 'game') { await Promise.all([0, 1, 2].map(s => this.layHand(s))); continue; }
      if (e.type === 'pickup') { sfx.card(); await this.layHand(e.seat); continue; }
      if (e.type === 'discard') {
        sfx.card();
        await Promise.all(e.cards.map(c => { const mc = this.card(c); this.down(mc); return hop(mc, this.discardSpot(e.seat, this.dis[e.seat]++), 0.3, 0.03); }));
        await this.layHand(e.seat);
        continue;
      }
      if (e.type === 'play') {
        const mc = this.card(e.card), flip = mc.rotation.z !== 0, at = omTrickSpot(SK_AT[e.seat], this.y() + 0.002 + before * 0.0005);
        sfx.card();
        if (flip) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        await hop(mc, at, 0.3, 0.05);
        mc.rotation.set(0, OM_YAW[SK_AT[e.seat]] + (Math.random() - 0.5) * 0.2, 0);
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
    const G = GAMES.skat, game = G.game === null ? (G.bid ? `bid ${G.bid}` : 'bidding') : asPack(G.gameName(G.game)) + (G.hand ? ' hand' : '');
    const who = G.declarer < 0 ? '' : ` · declarer: ${G.declarer ? G.SEATS[G.declarer] : 'you'}`;
    const pts = G.declarer < 0 || G.game === 'null' ? '' : ` · ${G.taken[G.declarer].reduce((t, c) => t + ({ 0: 11, 9: 10, 12: 4, 11: 3, 10: 2 }[c % 13] || 0), 0)} taken`;
    return [['You', G.score[0]], ['West', G.score[1]], ['East', G.score[2]], `deal ${Math.min(G.deals + 1, G.limit)} of ${G.limit} · ${game}${who}${pts}`];
  },
};
