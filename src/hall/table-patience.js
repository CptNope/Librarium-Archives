// Patience: the stock and waste top left, the four foundations top right, the seven columns fanned towards you.
// Cards are drawn a size larger than at the two-player tables, since all fifty-two are out at once.
const PT_SCALE = 1.22;
const PATIENCE_P = {
  camW: 1.0, camElev: 70, oneClick: true,
  intro() { return 'Patience, alone: there is no Scribe at this table. ' + this.prompt(); },
  prompt() { return GAMES.patience.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.patience.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); m.scale.set(PT_SCALE, 1, PT_SCALE); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  colX: i => (i - 3) * 0.1,
  stockSpot(k) { return V3(-0.3, this.y() + k * 0.0012, -0.31); },
  wasteSpot(k, n) { const fan = GAMES.patience.variant === 'three' ? Math.max(0, k - (n - 3)) : 0; return V3(-0.2 + Math.max(0, fan) * 0.022, this.y() + k * 0.0012, -0.31); },
  foundSpot(s, k) { return V3(0 + s * 0.1, this.y() + k * 0.0012, -0.31); },
  // A column fans towards you: face-down cards close together, face-up ones further apart, closer still when the column is long.
  tabSpot(i, j) {
    const G = GAMES.patience, col = G.tab[i], down = G.down[i], up = Math.max(1, col.length - down);
    const gapUp = Math.min(0.034, (0.5 - down * 0.02) / up);
    const z = -0.17 + Math.min(j, down) * 0.02 + Math.max(0, j - down) * gapUp;
    return V3(this.colX(i), this.y() + j * 0.0012, z);
  },
  face(m, up) { m.rotation.set(0, 0, up ? 0 : Math.PI); },
  spotOf(place, k, n) { return place === 'w' ? this.wasteSpot(k, n) : place[0] === 'f' ? this.foundSpot(+place[1], k) : this.tabSpot(+place[1], k); },
  redeal() {
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.marks = null;
    this.layAll(true);
    this.emptySpots();
  },
  // Faint outlines where the foundations and empty columns are, so there is somewhere to aim.
  emptySpots() {
    if (this.marks) return;
    const geo = new THREE.PlaneGeometry(CR_W * PT_SCALE, CR_H * PT_SCALE), mat = new THREE.MeshBasicMaterial({ color: 0xecdfc3, transparent: true, opacity: 0.12, depthWrite: false });
    this.marks = [];
    const at = v => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(v.x, this.y() - 0.0004, v.z); this.ex.group.add(m); this.marks.push(m); this.cards.push(m); };
    for (let s = 0; s < 4; s++) at(this.foundSpot(s, 0));
    for (let i = 0; i < 7; i++) at(V3(this.colX(i), 0, -0.17));
    at(this.stockSpot(0)); at(V3(-0.2, 0, -0.31));
  },
  layAll(instant) {
    const G = GAMES.patience, jobs = [];
    const put = (c, to, up) => { const m = this.card(c); this.face(m, up); if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.16, 0.012)); };
    G.stock.forEach((c, k) => put(c, this.stockSpot(k), false));
    G.waste.forEach((c, k) => put(c, this.wasteSpot(k, G.waste.length), true));
    G.found.forEach((f, s) => f.forEach((c, k) => put(c, this.foundSpot(s, k), true)));
    G.tab.forEach((col, i) => col.forEach((c, j) => put(c, this.tabSpot(i, j), j >= G.down[i])));
    return Promise.all(jobs);
  },
  meshesFor(m) {
    if (m.kind === 'draw') return [this.mesh.get(m.card)];
    return m.kind === 'move' ? [this.mesh.get(m.card)] : [];
  },
  // Where a picked card can go: on top of a column or foundation, or into an empty column.
  ringFor(m) {
    if (m.kind === 'draw') return V3(-0.2, this.y() + 0.004, -0.31);
    if (m.kind !== 'move') return null;
    const G = GAMES.patience, dst = G.pile(m.to), at = m.to[0] === 'f' ? this.foundSpot(+m.to[1], dst.length) : this.tabSpot(+m.to[1], dst.length);
    at.y += 0.004; return at;
  },
  ringScale: 0.8,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.patience, tok = play.token;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'draw' || e.type === 'recycle') { sfx.card(); await this.layAll(); continue; }
      if (e.type === 'move') {
        sfx.card();
        const dst = G.pile(e.to), base = dst.length - e.cards.length;
        await Promise.all(e.cards.map((c, j) => { const mc = this.card(c); this.face(mc, true); return hop(mc, this.spotOf(e.to, base + j, dst.length), e.auto ? 0.12 : 0.24, 0.03); }));
        continue;
      }
      if (e.type === 'flip') { const mc = this.card(e.card); tween(0.25, k => { mc.rotation.z = Math.PI * (1 - k); }); await wait(250); await this.layAll(); }
    }
    await this.layAll();
    return res;
  },
  score() {
    const G = GAMES.patience;
    return [['Up', `${G.onFound}/52`], ['Moves', G.moves], `${G.variant === 'three' ? 'draw three' : 'draw one'} · pass ${G.passes + 1}`];
  },
};
