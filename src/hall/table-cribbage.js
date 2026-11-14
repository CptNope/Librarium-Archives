const CRIBBAGE_P = {
  camW: 1.2,
  intro() { return 'The Scribe deals first, so the crib is its. ' + this.prompt(); },
  prompt() {
    const G = GAMES.cribbage, t = G.need.type;
    if (t === 'discard') return `Lay ${6 - G.hands[0].length === 0 ? 'two cards' : 'one more card'} aside for ${G.dealer === 0 ? 'your' : 'the Scribe\'s'} crib: click ${6 - G.hands[0].length === 0 ? 'them' : 'it'}.`;
    if (t === 'next') return (G.lastShow ? G.lastShow.map(x => x.text).join(' ') + ' ' : '') + 'Press Next deal when you are ready.';
    return `The count is ${G.count}. Click a card to play.`;
  },
  setup(ex) {
    const G = GAMES.cribbage;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    this.ex = ex; this.pegAt = [[0, 0], [0, 0]];
    ex.group.userData.pegs.forEach((pp, pl) => pp.forEach((pg, k) => { const h = crHole(pl, 0); pg.position.set(h.x + (k ? 0.006 : -0.006), ex.group.userData.pegY, h.z); }));
    this.redeal(true);
  },
  leave(ex) {
    ex.group.userData.display.forEach(m => { m.visible = true; });
    (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = [];
    ex.group.userData.pegs.forEach((pp, pl) => pp.forEach((pg, k) => { const h = crHole(pl, 0); pg.position.set(h.x + (k ? 0.006 : -0.006), ex.group.userData.pegY, h.z); }));
  },
  y: () => GAMES.cribbage.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  handSpot(pl, i, n) { return V3(0.06 + (i - (n - 1) / 2) * 0.07, this.y() + i * 0.0003, pl ? -0.32 : 0.32); },
  playSpot(pl, k) { return V3(-0.17 + k * 0.05, this.y() + 0.002 + k * 0.0003, pl ? -0.1 : 0.1); },
  cribSpot(k) { const G = GAMES.cribbage; return V3(0.42 + k * 0.004, this.y() + 0.003 + k * 0.0016, G.dealer ? -0.2 : 0.2); },
  deckSpot: () => V3(0.42, GAMES.cribbage.surface + 0.012, 0),
  redeal(instant) {
    const G = GAMES.cribbage;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.inPlay = [0, 0];
    this.deck = new THREE.Mesh(new THREE.BoxGeometry(CR_W, 0.02, CR_H), [tcEdgeMat, tcEdgeMat, crBackMat, crBackMat, tcEdgeMat, tcEdgeMat]);
    this.deck.position.copy(this.deckSpot()); this.ex.group.add(this.deck); this.cards.push(this.deck);
    for (const pl of [0, 1]) this.layHand(pl, true);
    G.crib.forEach((c, k) => { const m = this.card(c); m.rotation.set(0, 0, Math.PI); m.position.copy(this.cribSpot(k)); });
    return instant ? Promise.resolve() : wait(200);
  },
  layHand(pl, instant) {
    const G = GAMES.cribbage, h = G.hands[pl].slice().sort((a, b) => G.rank(a) - G.rank(b) || G.suit(a) - G.suit(b)), jobs = [];
    h.forEach((c, i) => { const m = this.card(c), to = this.handSpot(pl, i, h.length); m.rotation.set(0, 0, pl ? Math.PI : 0); if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.22, 0.01)); });
    return Promise.all(jobs);
  },
  movePegs() { // the back peg leapfrogs the front one to the new score
    const G = GAMES.cribbage, pegs = this.ex.group.userData.pegs, jobs = [];
    for (const pl of [0, 1]) {
      const [a, b] = this.pegAt[pl], s = G.score[pl];
      if (s === Math.max(a, b)) continue;
      const k = a <= b ? 0 : 1; this.pegAt[pl][k] = s;
      const h = crHole(pl, s >= G.target ? 61 : s);
      jobs.push(hop(pegs[pl][k], V3(h.x, this.ex.group.userData.pegY, h.z), 0.5, 0.05));
    }
    return Promise.all(jobs);
  },
  meshesFor(m) { return m.c !== undefined ? [this.mesh.get(m.c)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.cribbage, tok = play.token, res = G.apply(m);
    for (const e of res.events) {
      if (tok !== play.token) return res;
      if (e.type === 'crib') { const mc = this.card(e.c); sfx.card(); tween(0.25, k => { mc.rotation.z = Math.PI * k; }); await hop(mc, this.cribSpot(G.crib.indexOf(e.c)), 0.3, 0.05); await this.layHand(e.pl); }
      else if (e.type === 'starter') { const mc = this.card(e.c); mc.rotation.set(0, 0, Math.PI); mc.position.copy(this.deckSpot()); mc.position.y += 0.012; await tween(0.35, k => { mc.rotation.z = Math.PI * (1 - k); mc.position.y = this.deckSpot().y + 0.012 + Math.sin(k * Math.PI) * 0.04; }); }
      else if (e.type === 'play') {
        const mc = this.card(e.c); sfx.card();
        if (e.pl === 1) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        await hop(mc, this.playSpot(e.pl, this.inPlay[e.pl]++), 0.3, 0.05); await this.layHand(e.pl);
      }
      else if (e.type === 'reset') { await wait(500); const live = this.cards.filter(x => x.userData.c !== undefined && G.played.some(a => a.includes(x.userData.c)) && x.rotation.z === 0 && x.position.y < this.y() + 0.01 && Math.abs(x.position.z) < 0.15); live.forEach(x => tween(0.3, k => { x.rotation.z = Math.PI * k; })); }
      else if (e.type === 'show') {
        // Every played card turns face up again, and the crib is spread out.
        this.cards.forEach(x => { if (x.userData.c !== undefined && G.played.some(a => a.includes(x.userData.c))) x.rotation.z = 0; });
        G.crib.forEach((c, k) => { const mc = this.card(c); mc.rotation.z = 0; hop(mc, V3(0.3 + k * 0.05, this.y() + 0.002 + k * 0.0003, G.dealer ? -0.2 : 0.2), 0.4, 0.04); });
      }
      else if (e.type === 'deal') { await this.redeal(false); }
      await this.movePegs();
    }
    await this.movePegs();
    return res;
  },
  score: () => { const G = GAMES.cribbage; return [['You', G.score[0]], ['Scribe', G.score[1]], `of ${G.target}`]; },
};
