// Piquet is played at the playing-cards exhibit, with a 32-card French pack.
const PIQUET_P = {
  camW: 1.2,
  intro() { return 'The Scribe deals first. ' + this.prompt(); },
  prompt() {
    const G = GAMES.piquet, first = G.stage === 'play' && G.tricks[0] + G.tricks[1] === 0 && G.declNote;
    return (first ? G.declNote + ' ' : '') + G.prompt0();
  },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.piquet.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  handSpot(pl, i, n) { return V3((i - (n - 1) / 2) * (pl ? 0.042 : 0.06), this.y() + i * 0.0004, pl ? -0.28 : 0.28); },
  talonSpot: k => V3(-0.5, GAMES.piquet.surface + 0.001 + k * 0.0018, 0),
  discardSpot(pl, k) { return V3(-0.36, this.y() + k * 0.0018, pl ? -0.1 : 0.1); },
  pileSpot(pl, k) { return V3(0.44 + (k % 6) * 0.012, this.y() + k * 0.0018, pl ? -0.1 : 0.1); },
  redeal() {
    const G = GAMES.piquet;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.piles = [0, 0]; this.dis = [0, 0];
    G.talon.forEach((c, k) => { const m = this.card(c); m.rotation.set(0, Math.PI / 2, Math.PI); m.position.copy(this.talonSpot(k)); });
    this.layHand(0, true); this.layHand(1, true);
    // A resumed game: discards and the tricks already taken go back where they were.
    for (const pl of [0, 1]) G.discards[pl].forEach(c => { const m = this.card(c); m.rotation.set(0, Math.PI / 2, Math.PI); m.position.copy(this.discardSpot(pl, this.dis[pl]++)); });
    const done = G.played.slice(0, G.played.length - G.trick.length);
    for (let t = 0; t * 2 < done.length; t++) {
      const w = t < G.tricks[0] ? 0 : 1, to = this.pileSpot(w, this.piles[w]++);
      done.slice(t * 2, t * 2 + 2).forEach((c, j) => { const m = this.card(c); m.position.set(to.x, to.y + j * 0.0005, to.z); m.rotation.set(0, Math.PI / 2, Math.PI); });
    }
  },
  layHand(pl, instant) {
    const G = GAMES.piquet, h = G.hands[pl], jobs = [];
    h.forEach((c, i) => {
      const m = this.card(c), to = this.handSpot(pl, i, h.length);
      if (pl === 0 && G.marked.includes(c)) { to.z -= 0.035; to.y += 0.006; } // a marked card is lifted toward the discard
      m.rotation.set(0, pl ? Math.PI : 0, pl ? Math.PI : 0);
      if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.18, 0.006));
    });
    return Promise.all(jobs);
  },
  meshesFor(m) { return (m.kind === 'mark' || m.kind === 'play') && m.pl === 0 ? [this.mesh.get(m.c)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.piquet, tok = play.token, before = G.trick.length;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); continue; }
      if (e.type === 'mark') { await this.layHand(0); continue; }
      if (e.type === 'exchange') {
        sfx.card();
        await Promise.all(e.out.map(c => { const mc = this.card(c); mc.rotation.set(0, Math.PI / 2, Math.PI); return hop(mc, this.discardSpot(e.pl, this.dis[e.pl]++), 0.3, 0.03); }));
        await this.layHand(e.pl);
        continue;
      }
      if (e.type === 'play') {
        const mc = this.card(e.c); sfx.card();
        if (e.pl === 1) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        await hop(mc, V3(before ? 0.04 : -0.04, this.y() + 0.003 + before * 0.0006, e.pl ? -0.07 : 0.07), 0.3, 0.05);
        mc.rotation.set(0, (Math.random() - 0.5) * 0.2, 0);
        await this.layHand(e.pl);
      }
      if (e.type === 'trick') {
        await wait(650); if (tok !== play.token) return res;
        const k = this.piles[e.winner]++, to = this.pileSpot(e.winner, k);
        await Promise.all(G.lastTrick.cards.map((c, j) => { const mc = this.card(c); tween(0.3, t => { mc.rotation.z = Math.PI * t; }); return hop(mc, V3(to.x, to.y + j * 0.0005, to.z), 0.32, 0.03); }));
        G.lastTrick.cards.forEach(c => this.card(c).rotation.set(0, Math.PI / 2, Math.PI));
      }
    }
    return res;
  },
  score() {
    const G = GAMES.piquet;
    return [['You', G.total[0] + (G.stage === 'next' || G.over ? 0 : G.score[0])], ['Scribe', G.total[1] + (G.stage === 'next' || G.over ? 0 : G.score[1])], `deal ${G.deals} of ${G.limit} · tricks ${G.tricks[0]}–${G.tricks[1]}`];
  },
};
