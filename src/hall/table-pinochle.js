// Pinochle: laid out as Bézique, its parent. Each hand of twelve, the melds laid face up in front of it, the stock with the
// trump card turned across it at the side, the trick in the middle and each player's tricks in a pile on the right.
const PINOCHLE_P = {
  camW: 1.25, camElev: 62,
  intro() { const G = GAMES.pinochle; return (G.toMove === 0 ? 'The Scribe deals. You lead. ' : 'You deal. ') + (G.dixNote ? G.dixNote + ' ' : '') + this.prompt(); },
  prompt() { return GAMES.pinochle.prompt0(); },
  choosePrompt() { return GAMES.pinochle.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.pinochle.surface + 0.001,
  card(b) { let m = this.mesh.get(b); if (!m) { m = crCard(GAMES.pinochle.face(b), b); this.ex.group.add(m); this.cards.push(m); this.mesh.set(b, m); } return m; },
  handSpot(pl, i, n) { return V3((i - (n - 1) / 2) * (pl ? 0.04 : 0.058), this.y() + i * 0.0004, pl ? -0.31 : 0.31); },
  meldSpot(pl, i, n) { return V3((i - (n - 1) / 2) * Math.min(0.058, 0.62 / Math.max(1, n)) + 0.02, this.y() + i * 0.0004, pl ? -0.17 : 0.17); },
  stockSpot: k => V3(-0.52, GAMES.pinochle.surface + 0.001 + k * 0.0012, -0.02),
  turnSpot() { return V3(-0.47, this.y() - 0.0005, 0.02); },
  pileSpot(pl, k) { return V3(0.5, this.y() + k * 0.0012, pl ? -0.08 : 0.08); },
  down(m) { m.rotation.set(0, Math.PI / 2, Math.PI); },
  redeal() {
    const G = GAMES.pinochle;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.piled = [0, 0];
    G.stock.forEach((b, k) => { const m = this.card(b); this.down(m); m.position.copy(this.stockSpot(k)); });
    this.layTurnUp();
    for (const pl of [0, 1]) G.won[pl].forEach(b => { const m = this.card(b); this.down(m); m.position.copy(this.pileSpot(pl, this.piled[pl]++)); });
    G.trick.forEach((t, j) => { const m = this.card(t.c); m.rotation.set(0, 0, 0); m.position.copy(this.trickSpot(t.pl, j)); });
    this.layAll(true);
  },
  layTurnUp() {
    const G = GAMES.pinochle; if (G.turnUp === null) return;
    const m = this.card(G.turnUp); m.rotation.set(0, Math.PI / 2, 0); m.position.copy(this.turnSpot());
  },
  trickSpot(pl, j) { return V3(j ? 0.04 : -0.04, this.y() + 0.003 + j * 0.0006, pl ? -0.04 : 0.06); },
  layAll(instant) { return Promise.all([this.layHand(0, instant), this.layHand(1, instant), this.layMelds(0, instant), this.layMelds(1, instant)]); },
  layHand(pl, instant) {
    const G = GAMES.pinochle, h = G.hands[pl];
    return Promise.all(h.map((b, i) => { const m = this.card(b), to = this.handSpot(pl, i, h.length); m.rotation.set(0, pl ? Math.PI : 0, pl ? Math.PI : 0); if (instant) { m.position.copy(to); return null; } return hop(m, to, 0.22, 0.008); }));
  },
  layMelds(pl, instant) {
    const G = GAMES.pinochle, h = G.melds[pl];
    return Promise.all(h.map((b, i) => { const m = this.card(b), to = this.meldSpot(pl, i, h.length); m.rotation.set(0, pl ? Math.PI : 0, 0); if (instant) { m.position.copy(to); return null; } return hop(m, to, 0.25, 0.02); }));
  },
  meshesFor(m) { return m.kind === 'play' && m.pl === 0 ? [this.mesh.get(m.c)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.pinochle, tok = play.token, before = G.trick.length;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); continue; }
      if (e.type === 'play') {
        const mc = this.card(e.c); sfx.card();
        if (e.pl === 1 && !e.fromMeld) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        await hop(mc, this.trickSpot(e.pl, before), 0.3, 0.05);
        mc.rotation.set(0, (Math.random() - 0.5) * 0.2, 0);
        await (e.fromMeld ? this.layMelds(e.pl) : this.layHand(e.pl));
        continue;
      }
      if (e.type === 'trick') {
        await wait(700); if (tok !== play.token) return res;
        await Promise.all(G.lastTrick.cards.map(b => { const mc = this.card(b); tween(0.3, t => { mc.rotation.z = Math.PI * t; }); return hop(mc, this.pileSpot(e.winner, this.piled[e.winner]++), 0.3, 0.03); }));
        G.lastTrick.cards.forEach(b => this.down(this.card(b)));
        continue;
      }
      if (e.type === 'meld') { sfx.card(); await this.layMelds(e.pl); await this.layHand(e.pl); continue; }
      if (e.type === 'swap') { // the dix (the nine of trumps) goes under the stock; the old turn-up comes into the hand
        const nine = this.card(e.gave); nine.rotation.set(0, Math.PI / 2, 0); await hop(nine, this.turnSpot(), 0.3, 0.03);
        await this.layHand(e.pl); continue;
      }
      if (e.type === 'draw') {
        sfx.card();
        for (const [pl] of e.cards) await this.layHand(pl);
        G.stock.forEach((b, k) => this.card(b).position.copy(this.stockSpot(k)));
        continue;
      }
      if (e.type === 'close') { await this.layAll(); }
    }
    return res;
  },
  score() {
    const G = GAMES.pinochle, live = G.stage === 'next' || G.over ? 0 : 1;
    const trumps = asPack(['spades', 'hearts', 'diamonds', 'clubs'][G.trump]);
    return [['You', G.total[0] + live * G.score[0]], ['Scribe', G.total[1] + live * G.score[1]], `${G.variant === 'deal' ? 'one deal' : 'to 1,000'} · trumps ${trumps} · stock ${G.stock.length + (G.turnUp === null ? 0 : 1)}`];
  },
};
