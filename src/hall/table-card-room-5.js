// Primero: your four cards near you and the Scribe's across the table, face down until the show. The pot sits in
// the middle, each player's counters at their right hand, the stock on the left and the discards on the right.
const PRIMERO_P = {
  camW: 1.1,
  intro() { const G = GAMES.primero; return `${G.dealer ? 'The Scribe deals' : 'You deal'}; both put a counter in the pot. ` + this.prompt(); },
  prompt() { return GAMES.primero.prompt0(); },
  choosePrompt() { return GAMES.primero.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.chips = chipSet(ex.group, 120); this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; if (this.chips) ex.group.remove(this.chips); this.chips = null; },
  y: () => GAMES.primero.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); m.scale.set(1.15, 1, 1.15); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } m.visible = true; return m; },
  handSpot(pl, i, n) { return V3((i - (n - 1) / 2) * (pl ? 0.07 : 0.085), this.y() + i * 0.0004, pl ? -0.28 : 0.3); },
  stockSpot: k => V3(-0.44, GAMES.primero.surface + 0.001 + k * 0.0012, 0),
  discardSpot(k) { return V3(0.44, this.y() + k * 0.0012, -0.02 + k * 0.004); },
  down(m) { m.rotation.set(0, Math.PI / 2, Math.PI); },
  counters() {
    const G = GAMES.primero, y = G.surface + 0.001;
    this.chips.userData.lay([...chipStacks(-0.03, -0.03, G.pot, 4), ...chipStacks(0.3, 0.17, G.purse[0], 0), ...chipStacks(-0.38, -0.2, G.purse[1], 1)], y);
  },
  redeal() {
    const G = GAMES.primero;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.nDis = 0;
    G.stock.forEach((c, k) => { const m = this.card(c); this.down(m); m.position.copy(this.stockSpot(k)); });
    [0, 1].forEach(p => G.discards[p].forEach(c => { const m = this.card(c); this.down(m); m.position.copy(this.discardSpot(this.nDis++)); }));
    this.layHand(0, true); this.layHand(1, true); this.counters();
  },
  layHand(pl, instant) {
    const G = GAMES.primero, h = G.hands[pl], open = pl === 0 || G.shown;
    return Promise.all(h.map((c, i) => {
      const m = this.card(c), to = this.handSpot(pl, i, h.length);
      if (pl === 0 && G.stage === 'swap' && G.toMove === 0 && G.marked.includes(c)) { to.z -= 0.04; to.y += 0.006; } // marked to discard
      m.rotation.set(0, pl ? Math.PI : 0, open ? 0 : Math.PI);
      if (instant) { m.position.copy(to); return null; }
      return hop(m, to, 0.22, 0.01);
    }));
  },
  meshesFor(m) { return m.kind === 'mark' && m.pl === 0 ? [this.mesh.get(m.card)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.primero, tok = play.token;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); sfx.card(); continue; }
      if (e.type === 'mark') { if (G.toMove === 0) await this.layHand(0); continue; }
      if (e.type === 'chips') { sfx.card(); this.counters(); continue; }
      if (e.type === 'deal2') { sfx.card(); await this.layHand(G.eldest); await this.layHand(G.dealer); continue; }
      if (e.type === 'swap') {
        sfx.card();
        await Promise.all(e.out.map(c => { const mc = this.card(c); this.down(mc); return hop(mc, this.discardSpot(this.nDis++), 0.3, 0.03); }));
        await this.layHand(e.seat);
        continue;
      }
      if (e.type === 'show') { const h = G.hands[1].map(c => this.card(c)); await Promise.all(h.map(mc => tween(0.35, k => { mc.rotation.z = Math.PI * (1 - k); }))); await this.layHand(1, true); continue; }
      if (e.type === 'pot') { await wait(500); if (tok !== play.token) return res; this.counters(); }
    }
    return res;
  },
  score() {
    const G = GAMES.primero;
    return [['You', G.purse[0]], ['Scribe', G.purse[1]], `pot ${G.pot} · hand ${G.handNo}${G.variant === 'ten' ? ' of 10' : ''} · ${G.dealer ? 'Scribe' : 'you'} dealt`];
  },
};

// Ma Diao sits four round a square lacquer table. Cards played face up are in the trick; cards thrown away lie
// face down beside them. Each player's tricks go to a pile at their right; the banker's token sits before the banker.
const MADIAO_P = {
  camW: 1.15,
  intro() { return GAMES.madiao.cutNote() + ' ' + this.prompt(); },
  prompt() { return GAMES.madiao.prompt0(); },
  choosePrompt() { return GAMES.madiao.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.token = mdBankerToken(); ex.group.add(this.token); this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; if (this.token) ex.group.remove(this.token); this.token = null; },
  y: () => GAMES.madiao.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = mdCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  pileSpot(seat, k) { const a = WS_YAW[seat], r = 0.27, t = 0.3; return V3(r * Math.sin(a) + t * Math.cos(a), this.y() + 0.001 + k * 0.0018, r * Math.cos(a) - t * Math.sin(a)); },
  stockSpot: k => V3(0.42, GAMES.madiao.surface + 0.001 + k * 0.0016, -0.36),
  down(m, yaw = 0.3) { m.rotation.set(0, yaw, Math.PI); },
  redeal() {
    const G = GAMES.madiao;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.piles = [0, 0, 0, 0];
    G.stock.forEach((c, k) => { const m = this.card(c); this.down(m); m.position.copy(this.stockSpot(k)); });
    for (let s = 0; s < 4; s++) this.layHand(s, true);
    G.won.forEach((ws, s) => ws.forEach(w => w.cards.forEach(c => { const m = this.card(c); m.position.copy(this.pileSpot(s, this.piles[s]++ / 4)); this.down(m, WS_YAW[s]); })));
    G.trick.forEach((t, j) => { const m = this.card(t.card); m.position.copy(this.trickAt(t, j)); m.rotation.set(0, WS_YAW[t.seat], t.up ? 0 : Math.PI); });
    this.token.position.copy(mdBankerSpot(G.banker, G.surface + 0.004));
  },
  trickAt(t, j) { const p = mdTrickSpot(t.seat, this.y() + 0.002 + j * 0.0005); if (!t.up) { const a = WS_YAW[t.seat]; p.x += 0.05 * Math.cos(a); p.z -= 0.05 * Math.sin(a); } return p; },
  layHand(seat, instant) {
    const G = GAMES.madiao, h = G.hands[seat], jobs = [];
    h.forEach((c, i) => {
      const m = this.card(c), to = mdHandSpot(seat, i, h.length, this.y());
      m.rotation.set(0, WS_YAW[seat], seat === 0 ? 0 : Math.PI);
      if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.2, 0.008));
    });
    return Promise.all(jobs);
  },
  meshesFor(m) { return m.kind === 'play' && m.seat === 0 ? [this.mesh.get(m.card)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.madiao, tok = play.token, before = G.trick.length;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); sfx.card(); continue; }
      if (e.type === 'play') {
        const mc = this.card(e.card), t = { seat: e.seat, up: e.up }, at = this.trickAt(t, before);
        sfx.card();
        const from = mc.rotation.z, to = e.up ? 0 : Math.PI;
        if (from !== to) tween(0.3, k => { mc.rotation.z = from + (to - from) * k; });
        await hop(mc, at, 0.3, 0.05);
        mc.rotation.set(0, WS_YAW[e.seat] + (Math.random() - 0.5) * 0.15, to);
        await this.layHand(e.seat);
      }
      if (e.type === 'trick') {
        await wait(800); if (tok !== play.token) return res;
        const k = this.piles[e.winner]++, to = this.pileSpot(e.winner, k);
        const cards = G.lastTrick.cards.map(c => this.card(c));
        await Promise.all(cards.map((mc, j) => { const z0 = mc.rotation.z; tween(0.3, t => { mc.rotation.z = z0 + (Math.PI - z0) * t; }); return hop(mc, V3(to.x, to.y + j * 0.0004, to.z), 0.35, 0.03); }));
        cards.forEach(mc => this.down(mc, WS_YAW[e.winner]));
      }
    }
    return res;
  },
  score() {
    const G = GAMES.madiao;
    return [['You', G.score[0]], ['East', G.score[3]], ['North', G.score[2]], ['West', G.score[1]], `deal ${G.dealNo} of 4 · banker ${G.banker ? G.SEATS[G.banker] : 'you'} · tricks ${[0, 3, 2, 1].map(s => G.tricks[s]).join('–')}`];
  },
};

// Pope Joan: the board in the middle, four hands round it, the dead hand and the turned-up trump in the far
// corner. Each card played is laid face up in front of its player; each player's counters sit at their left.
const POPEJOAN_P = {
  camW: 1.15,
  intro() { const G = GAMES.popejoan; return `${G.dealer ? G.SEATS[G.dealer] + ' deals' : 'You deal'} and dresses the board; ${G.SUITS[G.trump]} are trumps. ${G.turnNote} ` + this.prompt(); },
  prompt() { return GAMES.popejoan.prompt0(); },
  choosePrompt() { return GAMES.popejoan.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.chips = chipSet(ex.group, 240); this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; if (this.chips) ex.group.remove(this.chips); this.chips = null; },
  y: () => GAMES.popejoan.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } m.visible = true; return m; },
  deadSpot: k => V3(-0.46, GAMES.popejoan.surface + 0.001 + k * 0.0016, -0.36),
  turnSpot() { return V3(-0.38, this.y() + 0.003, -0.36); },
  // Played cards: a short overlapping row in front of each player, between the hand and the board.
  playedSpot(seat, k) { const a = WS_YAW[seat], r = 0.235, t = -0.12 + k * 0.024; return V3(r * Math.sin(a) + t * Math.cos(a), this.y() + 0.001 + k * 0.0004, r * Math.cos(a) - t * Math.sin(a)); },
  purseSpot(seat) { const a = WS_YAW[seat], r = 0.3, t = -0.36; return V3(r * Math.sin(a) + t * Math.cos(a), 0, r * Math.cos(a) - t * Math.sin(a)); },
  counters() {
    const G = GAMES.popejoan, y = G.surface + 0.001, by = this.ex.group.userData.boardY;
    const purses = [0, 1, 2, 3].flatMap(s => { const p = this.purseSpot(s); return chipStacks(p.x - 0.03, p.z - 0.012, G.purse[s], s === 0 ? 0 : 1, 0.03).map(st => Object.assign(st, { y })); });
    const wells = G.BOX.map((b, k) => { const p = pjWell(k, 0); return { x: p.x, z: p.z, n: Math.min(G.board[b], 12), col: k % 3 + 2 }; });
    // Two layers: the purses on the cloth, the stakes on the board.
    this.chips.userData.lay(purses, y);
    if (!this.boardChips) { this.boardChips = chipSet(this.ex.group, 100); }
    this.boardChips.userData.lay(wells, by);
  },
  redeal() {
    const G = GAMES.popejoan;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    if (this.boardChips) { this.ex.group.remove(this.boardChips); this.boardChips = null; }
    this.cards = []; this.mesh = new Map(); this.nPlayed = [0, 0, 0, 0];
    G.hands[4].filter(c => c !== G.turnUp).forEach((c, k) => { const m = this.card(c); m.position.copy(this.deadSpot(k)); m.rotation.set(0, 0.1, Math.PI); });
    const t = this.card(G.turnUp); t.position.copy(this.turnSpot()); t.rotation.set(0, 0.2, 0);
    for (let s = 0; s < 4; s++) this.layHand(s, true);
    // A resumed deal: the played cards go back before their players.
    (G.playedBy || []).forEach(p => { const m = this.card(p.card); m.position.copy(this.playedSpot(p.seat, this.nPlayed[p.seat]++)); m.rotation.set(0, WS_YAW[p.seat], 0); });
    this.counters();
  },
  layHand(seat, instant) {
    const G = GAMES.popejoan, h = G.hands[seat], jobs = [];
    h.forEach((c, i) => {
      const m = this.card(c), to = wsHandSpot(seat, i, h.length, this.y());
      m.rotation.set(0, WS_YAW[seat], seat === 0 ? 0 : Math.PI);
      if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.18, 0.008));
    });
    return Promise.all(jobs);
  },
  meshesFor(m) { return m.kind === 'lead' && m.seat === 0 ? [this.mesh.get(m.card)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.popejoan, tok = play.token;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); sfx.card(); continue; }
      if (e.type === 'play') {
        const mc = this.card(e.card), flip = mc.rotation.z !== 0;
        sfx.card();
        if (flip) tween(0.25, k => { mc.rotation.z = Math.PI * (1 - k); });
        await hop(mc, this.playedSpot(e.seat, this.nPlayed[e.seat]++), 0.26, 0.04);
        mc.rotation.set(0, WS_YAW[e.seat], 0);
        await wait(140); if (tok !== play.token) return res;
      }
      if (e.type === 'win' || e.type === 'out') { this.counters(); await wait(350); if (tok !== play.token) return res; }
      if (e.type === 'stop') { for (let s = 0; s < 4; s++) this.layHand(s); await wait(300); }
    }
    return res;
  },
  score() {
    const G = GAMES.popejoan, pope = G.board.pope, mat = G.board.matrimony, intr = G.board.intrigue;
    return [['You', G.purse[0]], ['West', G.purse[1]], ['North', G.purse[2]], ['East', G.purse[3]], `deal ${G.dealNo} of ${G.limit} · ${G.SUITS[G.trump]} trumps · Pope ${pope}, Matrimony ${mat}, Intrigue ${intr}`];
  },
};

// Faro: you sit at the near side of the layout; the dealer, across the table, draws from the box. The bank's
// cards go on a pile on your left of the box, your winning cards on your right. Checks stand on the layout,
// coppered ones with a copper on top; the case keeper on the right shows what is still to come.
const FARO_P = {
  camW: 1.15,
  intro() { const G = GAMES.faro; return `The soda, the first card out of the box, is the ${G.cardName(G.soda)}: it counts for nothing. ` + this.prompt(); },
  prompt() { return GAMES.faro.prompt0(); },
  choosePrompt() { return GAMES.faro.prompt0(); },
  setup(ex) {
    ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex;
    this.chips = chipSet(ex.group, 200); this.coppers = []; this.redeal();
  },
  leave(ex) {
    ex.group.userData.display.forEach(m => { m.visible = true; });
    (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = [];
    (this.coppers || []).forEach(m => ex.group.remove(m)); this.coppers = [];
    if (this.chips) ex.group.remove(this.chips); this.chips = null;
    ex.group.userData.keeper.userData.show(Array(13).fill(4));
  },
  y: () => GAMES.faro.surface + 0.001,
  pileSpot(bank, k) { return V3(bank ? -0.13 : 0.13, this.y() + 0.001 + k * 0.0012, -0.3); },
  boxSpot(k) { return V3(0, this.y() + 0.004 + k * 0.0004, -0.3); },
  card(c) { const m = crCard(c); this.ex.group.add(m); this.cards.push(m); return m; },
  bets() {
    const G = GAMES.faro, y = G.surface + 0.002, stacks = [];
    (this.coppers || []).forEach(m => this.ex.group.remove(m)); this.coppers = [];
    G.bets.forEach((b, r) => {
      if (!b.n) return;
      const p = faLayoutSpot(r); stacks.push({ x: p.x, z: p.z + 0.012, n: b.n, col: 2 });
      if (b.copper) { const c = faCopper(); c.position.set(p.x, y + b.n * CHIP_H + 0.001, p.z + 0.012); this.ex.group.add(c); this.coppers.push(c); }
    });
    if (G.high) stacks.push({ x: FA_HIGH.x + 0.17, z: FA_HIGH.z, n: G.high, col: 4 });
    if (G.stage === 'turn' && G.called) stacks.push({ x: -0.3, z: -0.12, n: 1, col: 1 });
    stacks.push(...chipStacks(0.24, 0.33, G.checks, 0, 0.026));
    this.chips.userData.lay(stacks, y);
  },
  redeal() {
    const G = GAMES.faro;
    (this.cards || []).forEach(m => this.ex.group.remove(m)); this.cards = [];
    // The box holds what is left, face down but for the top card; the soda and the drawn cards lie beside it.
    this.boxed = G.box.slice().reverse().map((c, k) => { const m = this.card(c); m.position.copy(this.boxSpot(k)); m.rotation.set(0, 0, k === G.box.length - 1 ? 0 : Math.PI); return m; });
    this.nPile = [0, 0];
    const drawn = G.out.slice(1); // after the soda, in pairs: the bank's card then yours
    const soda = this.card(G.soda); soda.position.copy(V3(-0.27, this.y() + 0.001, -0.3)); soda.rotation.set(0, 0.15, Math.PI);
    drawn.forEach((c, i) => { const m = this.card(c); m.position.copy(this.pileSpot(i % 2 === 0, this.nPile[i % 2]++)); });
    this.ex.group.userData.keeper.userData.show(G.left);
    this.bets();
  },
  meshesFor(m) { return m.kind === 'bet' ? [this.ex.group.userData.layout[m.rank]] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.faro, tok = play.token;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'bets') { sfx.card(); this.bets(); continue; }
      if (e.type === 'draw' || e.type === 'hock') {
        const cs = e.type === 'draw' ? [[e.lose, true], [e.win, false]] : [[e.card, null]];
        for (const [c, bank] of cs) {
          const mc = this.boxed.pop(); if (!mc) continue;
          sfx.card();
          if (mc.rotation.z !== 0) mc.rotation.z = 0;
          const to = bank === null ? V3(0, this.y() + 0.04, -0.2) : this.pileSpot(bank, this.nPile[bank ? 0 : 1]++);
          await hop(mc, to, 0.32, 0.06);
          // The next card in the box shows face up.
          const top = this.boxed[this.boxed.length - 1]; if (top) tween(0.2, k => { top.rotation.z = Math.PI * (1 - k); });
          await wait(250); if (tok !== play.token) return res;
        }
        this.ex.group.userData.keeper.userData.show(G.left);
        continue;
      }
      if (e.type === 'win' || e.type === 'lose') { await wait(200); if (tok !== play.token) return res; this.bets(); }
    }
    this.bets();
    return res;
  },
  score() {
    const G = GAMES.faro;
    return [['Checks', G.checks], ['On the layout', G.staked()], `turn ${G.turnNo} of 25 · won ${G.won}, lost ${G.lost}`];
  },
};
