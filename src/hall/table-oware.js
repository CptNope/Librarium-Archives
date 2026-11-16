
const OWARE_P = {
  camW: 1.34, ringScale: 1.4,
  intro() { return 'Your six pits are the row nearest you. ' + this.prompt(); },
  setup(ex) {
    this.ex = ex; this.pitMeshes = ex.group.userData.pits;
    if (!ex.seeds) {
      const cols = [0x7d6a52, 0x5f5040, 0x93826a, 0x4e4236, 0xa8977c];
      ex.seeds = Array.from({ length: 48 }, (_, i) => {
        const s = new THREE.Mesh(seedGeo, new THREE.MeshStandardMaterial({ color: cols[i % 5], roughness: 0.45 }));
        s.scale.set(1, 0.8, 1.15); s.rotation.y = rand(0, TAU); ex.group.add(s); return s;
      });
    }
    this.sync(true);
  },
  slot(kind, idx, k) {
    const base = kind === 'pit' ? owPit(idx) : owStore(idx), y = GAMES.oware.surface;
    const per = kind === 'pit' ? 11 : 20, layer = Math.floor(k / per), j = k % per;
    const a = j * 2.39996 + layer * 1.3, rr = Math.min(kind === 'pit' ? 0.04 : 0.055, 0.0115 * Math.sqrt(j + 0.6));
    return V3(base.x + Math.cos(a) * rr * (kind === 'store' ? 0.85 : 1), y + 0.008 + layer * 0.013, base.z + Math.sin(a) * rr * (kind === 'store' ? 1.7 : 1));
  },
  sync(instant) {
    const G = GAMES.oware, all = this.ex.seeds.slice();
    this.pit = Array.from({ length: 12 }, () => []); this.store = [[], []];
    let k = 0;
    for (let i = 0; i < 12; i++) for (let n = 0; n < G.pits[i]; n++) this.pit[i].push(all[k++]);
    for (const pl of [0, 1]) for (let n = 0; n < G.store[pl]; n++) this.store[pl].push(all[k++]);
    const jobs = [];
    this.pit.forEach((arr, i) => arr.forEach((s, j) => jobs.push([s, this.slot('pit', i, j)])));
    this.store.forEach((arr, pl) => arr.forEach((s, j) => jobs.push([s, this.slot('store', pl, j)])));
    if (instant) { jobs.forEach(([s, v]) => s.position.copy(v)); return Promise.resolve(); }
    return Promise.all(jobs.map(([s, v]) => (s.position.distanceTo(v) > 0.001 ? hop(s, v, 0.6, 0.08) : null)));
  },
  meshesFor(m) { return [this.pitMeshes[m.pit]]; },
  ringFor(m) { const p = owPit(m.pit); return V3(p.x, GAMES.oware.surface, p.z); },
  async play(m) {
    const G = GAMES.oware, tok = play.token;
    const res = G.apply(m), hand = this.pit[m.pit].splice(0);
    for (const q of res.path) {
      if (tok !== play.token) return res;
      const s = hand.shift(), v = this.slot('pit', q, this.pit[q].length);
      this.pit[q].push(s); await hop(s, v, 0.13, 0.05);
    }
    if (res.caps.length) {
      await wait(280);
      const jobs = [];
      for (const c of res.caps) for (const s of this.pit[c].splice(0)) {
        const v = this.slot('store', m.pl, this.store[m.pl].length); this.store[m.pl].push(s); jobs.push(hop(s, v, 0.5, 0.1));
      }
      await Promise.all(jobs);
    }
    return res;
  },
  score: () => [['You', GAMES.oware.store[0]], ['Scribe', GAMES.oware.store[1]], 'seeds · 25 wins'],
  prompt: () => 'Choose one of your six pits to sow.',
  onFinish(res) { if (res.sweep) this.sync(false); },
};
