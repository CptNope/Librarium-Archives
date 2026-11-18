// Écarté: your five cards near you and the Scribe's across the table, the talon on the left with the turned-up
// trump beside it, and the discards on the right. Tricks go to the winner's side.
const ECARTE_P = {
  camW: 1.05,
  intro() { const G = GAMES.ecarte; return `${G.dealer ? 'The Scribe deals' : 'You deal'}; the ${G.cardName(G.turnUp)} is turned up. ${G.dealNote} ` + this.prompt(); },
  prompt() { return GAMES.ecarte.prompt0(); },
  choosePrompt() { return GAMES.ecarte.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.ecarte.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); m.scale.set(1.2, 1, 1.2); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  handSpot(pl, i, n) { return V3((i - (n - 1) / 2) * (pl ? 0.072 : 0.092), this.y() + i * 0.0004, pl ? -0.28 : 0.3); },
  talonSpot: k => V3(-0.42, GAMES.ecarte.surface + 0.001 + k * 0.0012, 0),
  discardSpot(k) { return V3(0.44, this.y() + k * 0.0012, -0.02 + k * 0.003); },
  pileSpot(pl, k) { return V3(0.22 + k * 0.012, this.y() + 0.001 + k * 0.0016, pl ? -0.13 : 0.13); },
  trickSpot(pl) { return V3(0.02, this.y() + 0.002, pl ? -0.06 : 0.06); },
  down(m) { m.rotation.set(0, Math.PI / 2, Math.PI); },
  redeal() {
    const G = GAMES.ecarte;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.nDis = 0; this.piles = [0, 0];
    G.stock.forEach((c, k) => { const m = this.card(c); this.down(m); m.position.copy(this.talonSpot(k)); });
    const up = this.card(G.turnUp); up.position.copy(V3(-0.3, this.y() + 0.001, 0)); up.rotation.set(0, 0.15, 0);
    [0, 1].forEach(p => G.discards[p].forEach(c => { const m = this.card(c); this.down(m); m.position.copy(this.discardSpot(this.nDis++)); }));
    const done = G.played.slice(0, G.played.length - G.trick.length);
    let won = [0, 0]; for (let t = 0; t * 2 < done.length; t++) { const w = won[0] < G.tricks[0] ? 0 : 1; won[w]++; done.slice(t * 2, t * 2 + 2).forEach(c => { const m = this.card(c); m.position.copy(this.pileSpot(w, this.piles[w])); this.down(m); }); this.piles[w]++; }
    G.trick.forEach(t => { const m = this.card(t.card); m.position.copy(this.trickSpot(t.seat)); m.rotation.set(0, 0, 0); });
    this.layHand(0, true); this.layHand(1, true);
  },
  layHand(pl, instant) {
    const G = GAMES.ecarte, h = G.hands[pl];
    return Promise.all(h.map((c, i) => {
      const m = this.card(c), to = this.handSpot(pl, i, h.length);
      if (pl === 0 && G.stage === 'exchange' && G.toMove === 0 && G.marked.includes(c)) { to.z -= 0.045; to.y += 0.006; }
      m.rotation.set(0, pl ? Math.PI : 0, pl ? Math.PI : 0);
      if (instant) { m.position.copy(to); return null; }
      return hop(m, to, 0.22, 0.01);
    }));
  },
  meshesFor(m) { return (m.kind === 'card' || m.kind === 'mark') && m.pl === 0 ? [this.mesh.get(m.card)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.ecarte, tok = play.token;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); sfx.card(); continue; }
      if (e.type === 'mark') { if (G.toMove === 0) await this.layHand(0); continue; }
      if (e.type === 'exchange') {
        sfx.card();
        await Promise.all(e.out.map(c => { const mc = this.card(c); this.down(mc); return hop(mc, this.discardSpot(this.nDis++), 0.3, 0.03); }));
        await this.layHand(e.seat);
        continue;
      }
      if (e.type === 'king') { const k = this.card(G.trump * 13 + 12); await hop(k, k.position.clone().add(V3(0, 0.03, e.seat ? 0.04 : -0.04)), 0.3, 0.02); if (e.seat) { tween(0.3, t => { k.rotation.z = Math.PI * (1 - t); }); await wait(900); tween(0.3, t => { k.rotation.z = Math.PI * t; }); } await this.layHand(e.seat); continue; }
      if (e.type === 'play') {
        const mc = this.card(e.card); sfx.card();
        if (mc.rotation.z !== 0) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        await hop(mc, this.trickSpot(e.seat), 0.3, 0.05); mc.rotation.set(0, (Math.random() - 0.5) * 0.15, 0);
        await this.layHand(e.seat);
      }
      if (e.type === 'trick') {
        await wait(650); if (tok !== play.token) return res;
        const k = this.piles[e.winner]++;
        await Promise.all(G.lastTrick.cards.map((c, j) => { const mc = this.card(c); tween(0.3, t => { mc.rotation.z = Math.PI * t; }); return hop(mc, this.pileSpot(e.winner, k).add(V3(0, j * 0.0004, 0)), 0.32, 0.03); }));
        G.lastTrick.cards.forEach(c => this.down(this.card(c)));
      }
    }
    return res;
  },
  score() {
    const G = GAMES.ecarte, T = G.SUITS[G.trump];
    return [['You', G.score[0]], ['Scribe', G.score[1]], `to 5 · ${T} trumps · tricks ${G.tricks[0]}–${G.tricks[1]}${G.vulnerable >= 0 ? ` · ${G.vulnerable ? 'the Scribe' : 'you'} at risk` : ''}`];
  },
};

// Gin Rummy: your hand near you, sorted melds first then deadwood, the Scribe's across the table, and the stock
// and discard pile between. At a knock both hands are laid out face up, melds apart from deadwood.
const GIN_P = {
  camW: 1.15,
  intro() { const G = GAMES.gin; return `${G.dealer ? 'The Scribe deals' : 'You deal'}. ` + this.prompt(); },
  prompt() { return GAMES.gin.prompt0(); },
  choosePrompt() { return GAMES.gin.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.gin.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); m.scale.set(1.1, 1, 1.1); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  stockSpot: k => V3(-0.1, GAMES.gin.surface + 0.001 + k * 0.0012, -0.02),
  pileSpot(k) { return V3(0.1, this.y() + k * 0.0009, -0.02); },
  // Your hand in the order the best melds suggest: each meld together, then the deadwood, with gaps between.
  order(p) {
    const G = GAMES.gin, h = G.hands[p], b = G.best(h), groups = b.melds.map(m => m.slice().sort((x, y) => x - y)), dead = b.deadwood.slice().sort((x, y) => (x % 13) - (y % 13) || x - y);
    groups.push(dead); return groups.filter(g => g.length);
  },
  layHand(p, instant) {
    const G = GAMES.gin, open = p === 0 || (G.stage === 'next' && G.show), jobs = [];
    const groups = p === 0 || open ? this.order(p) : [G.hands[p].slice()], gap = 0.025, w = p ? 0.05 : 0.062;
    const n = groups.reduce((t, g) => t + g.length, 0), total = (n - 1) * w + (groups.length - 1) * gap;
    let x = -total / 2, i = 0;
    for (const g of groups) {
      for (const c of g) {
        const m = this.card(c), to = V3(x, this.y() + i * 0.0004, p ? -0.3 : 0.32);
        if (p === 0 && G.taken === c) to.z -= 0.02; // the card just taken
        m.rotation.set(0, p ? Math.PI : 0, open ? 0 : Math.PI);
        if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.2, 0.008));
        x += w; i++;
      }
      x += gap;
    }
    return Promise.all(jobs);
  },
  redeal() {
    const G = GAMES.gin;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map();
    G.stock.forEach((c, k) => { const m = this.card(c); m.rotation.set(0, 0, Math.PI); m.position.copy(this.stockSpot(k)); });
    G.pile.forEach((c, k) => { const m = this.card(c); m.rotation.set(0, (k % 3 - 1) * 0.05, 0); m.position.copy(this.pileSpot(k)); });
    this.layHand(0, true); this.layHand(1, true);
  },
  meshesFor(m) {
    const G = GAMES.gin;
    if (m.pl !== 0) return [];
    if (m.kind === 'draw') return [this.mesh.get(G.stock[G.stock.length - 1])];
    if (m.kind === 'take') return [this.mesh.get(G.pile[G.pile.length - 1])];
    if (m.kind === 'discard' || m.kind === 'knock') return [this.mesh.get(m.card)];
    return [];
  },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.gin, tok = play.token;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); sfx.card(); continue; }
      if (e.type === 'draw') {
        const mc = this.card(e.card); sfx.card();
        if (e.seat === 0 && !e.fromPile) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        if (e.seat === 1 && e.fromPile) tween(0.3, k => { mc.rotation.z = Math.PI * k; });
        await this.layHand(e.seat);
        continue;
      }
      if (e.type === 'discard') {
        const mc = this.card(e.card); sfx.card();
        if (e.seat === 1) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        await hop(mc, this.pileSpot(G.pile.length - 1), 0.3, 0.04); mc.rotation.set(0, (Math.random() - 0.5) * 0.12, 0);
        await this.layHand(e.seat);
        continue;
      }
      if (e.type === 'knock') { const mc = this.card(e.card); sfx.card(); mc.rotation.set(0, 0.3, Math.PI); await hop(mc, this.pileSpot(G.pile.length).add(V3(0.05, 0, 0.02)), 0.3, 0.04); continue; }
      if (e.type === 'show') { await Promise.all([this.layHand(0), this.layHand(1)]); }
    }
    return res;
  },
  score() {
    const G = GAMES.gin, d = G.best(G.hands[0]).dead;
    return [['You', G.score[0]], ['Scribe', G.score[1]], `to ${G.limit} · hand ${G.handNo} · your deadwood ${d} · stock ${G.stock.length}`];
  },
};

// Spades and Bridge: four hands round a whist table, each side's tricks in a pile on the right.
function fourHandsPresenter(id, opts) {
  return Object.assign({
    camW: 1.25,
    prompt() { return GAMES[id].prompt0(); },
    choosePrompt() { return GAMES[id].prompt0(); },
    setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
    leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
    y: () => GAMES[id].surface + 0.001,
    card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
    pileSpot(side, k) { return V3(0.22 + (k % 7) * 0.016, this.y() + 0.001 + k * 0.0018, side ? -0.25 : 0.25); },
    faceUp(seat) { return seat === 0; },
    handSpot(seat, i, n) { return wsHandSpot(seat, i, n, this.y()); },
    handYaw(seat) { return WS_YAW[seat]; },
    redeal() {
      const G = GAMES[id];
      (this.cards || []).forEach(m => this.ex.group.remove(m));
      this.cards = []; this.mesh = new Map(); this.piles = [0, 0];
      for (let s = 0; s < 4; s++) this.layHand(s, true);
      const done = G.played.slice(0, G.played.length - G.trick.length);
      const taken = this.sideTricks(G); let won = [0, 0];
      for (let t = 0; t * 4 < done.length; t++) { const side = won[0] < taken[0] ? 0 : 1; won[side]++; const k = this.piles[side]++, to = this.pileSpot(side, k); done.slice(t * 4, t * 4 + 4).forEach((c, j) => { const m = this.card(c); m.position.set(to.x, to.y + j * 0.0004, to.z); m.rotation.set(0, Math.PI / 2, Math.PI); }); }
      G.trick.forEach((t, j) => { const m = this.card(t.card); m.position.copy(wsTrickSpot(t.seat, this.y() + 0.002 + j * 0.0005)); m.rotation.set(0, WS_YAW[t.seat], 0); });
    },
    layHand(seat, instant) {
      const G = GAMES[id], h = G.hands[seat], jobs = [];
      h.forEach((c, i) => {
        const m = this.card(c), to = this.handSpot(seat, i, h.length);
        m.rotation.set(0, this.handYaw(seat), this.faceUp(seat) ? 0 : Math.PI);
        if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.2, 0.008));
      });
      return Promise.all(jobs);
    },
    meshesFor(m) { return m.kind === 'play' && m.pl === 0 ? [this.mesh.get(m.card)] : []; },
    ringFor: () => null,
    fromFor: () => null,
    async play(m) {
      const G = GAMES[id], tok = play.token, before = G.trick.length;
      const res = G.apply(m);
      for (const e of res.events || []) {
        if (tok !== play.token) return res;
        if (e.type === 'deal') { this.redeal(); sfx.card(); continue; }
        if (e.type === 'contract' || e.type === 'dummy') { sfx.card(); await Promise.all([0, 1, 2, 3].map(s => this.layHand(s))); continue; }
        if (e.type === 'play') {
          const mc = this.card(e.card), flip = mc.rotation.z !== 0, at = wsTrickSpot(e.seat, this.y() + 0.002 + before * 0.0005);
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
  }, opts);
}
const SPADES_P = fourHandsPresenter('spades', {
  intro() { const G = GAMES.spades; return `You sit South with North, your partner. ${G.dealer ? G.SEATS[G.dealer] + ' deals' : 'You deal'}. ` + this.prompt(); },
  sideTricks: G => [G.taken[0] + G.taken[2], G.taken[1] + G.taken[3]],
  score() {
    const G = GAMES.spades, b = s => (G.bids[s] === null ? '–' : G.bids[s] === 0 ? 'nil' : G.bids[s]);
    return [['You and North', G.score[0]], ['West and East', G.score[1]], `to ${G.limit} · bids ${b(0)}+${b(2)} v ${b(1)}+${b(3)} · tricks ${G.taken[0] + G.taken[2]}–${G.taken[1] + G.taken[3]} · bags ${G.bags[0]}–${G.bags[1]}`];
  },
});
const BRIDGE_P = fourHandsPresenter('bridge', {
  intro() { const G = GAMES.bridge; return `You sit South, with North as your partner. ${G.dealer ? G.SEATS[G.dealer] + ' deals' : 'You deal'}. ` + this.prompt(); },
  sideTricks: G => G.tricks,
  // Face up: your own hand; North's whenever your side has the contract; and the dummy once the first card is led.
  faceUp(seat) { const G = GAMES.bridge; return seat === 0 || (G.need === 'play' && G.declarer >= 0 && (G.declarer & 1) === 0 && seat === 2) || (G.dummyShown && seat === G.dummy) || (G.need === 'next' && G.nTricks === 13); },
  handSpot(seat, i, n) { const G = GAMES.bridge; return G.dummyShown && seat === G.dummy && seat !== 0 ? bridgeDummySpot(seat, i, n, this.y()) : wsHandSpot(seat, i, n, this.y()); },
  handYaw(seat) { const G = GAMES.bridge; return seat === 2 && this.faceUp(2) ? 0 : WS_YAW[seat]; },
  score() {
    const G = GAMES.bridge, f = n => n.toLocaleString('en-GB');
    const c = G.contract ? `${G.bidName(G.contract.bid)}${G.doubled === 2 ? 'XX' : G.doubled === 1 ? 'X' : ''} by ${G.declarer === 0 ? 'you' : G.SEATS[G.declarer]}` : 'the auction';
    const v = G.variant === 'chicago' ? `deal ${G.dealNo} of 4` : `games ${G.games[0]}–${G.games[1]}`;
    return [['You and North', f(G.total[0])], ['West and East', f(G.total[1])], `${v} · ${c} · tricks ${G.tricks[0]}–${G.tricks[1]}`];
  },
});
