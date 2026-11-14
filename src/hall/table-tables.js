const TABLES_P = {
  camW: 1.6,
  intro: () => 'You play the pale checkers, racing counterclockwise to your home board at the near right. Throw to begin.',
  prompt: () => 'Throw when you are ready.',
  setup(ex) {
    const G = GAMES.tables;
    if (!ex.pieces) {
      const cols = [0xe8dcc0, 0x2a1c14];
      ex.pieces = [0, 1].map(pl => Array.from({ length: 15 }, () => {
        const mat = new THREE.MeshStandardMaterial({ color: cols[pl], roughness: pl ? 0.35 : 0.45 });
        const m = new THREE.Mesh(tbCheckerGeo, mat); m.userData.mats = [mat]; ex.group.add(m); return m;
      }));
    }
    this.stacks = [0, 1].map(() => Array.from({ length: 26 }, () => []));
    for (const pl of [0, 1]) {
      let k = 0;
      for (let rel = 0; rel <= 25; rel++) for (let n = 0; n < G.c[pl][rel]; n++) this.stacks[pl][rel].push(ex.pieces[pl][k++]);
      for (let rel = 0; rel <= 25; rel++) this.layout(pl, rel).forEach(([m, v]) => m.position.copy(v));
    }
  },
  slot(pl, rel, k, n) {
    const y = GAMES.tables.surface;
    if (rel === 25) return V3(0, y + 0.01 + k * 0.016, pl === 0 ? 0.1 + 0 : -0.1);
    if (rel === 0) return V3(0.76, TOP + k * 0.0152, pl === 0 ? 0.3 : -0.3);
    const abs = pl === 0 ? rel : 25 - rel;
    const sp = n > 5 ? 0.34 / (n - 1) : 0.084;
    const bottom = abs <= 12;
    return V3(tbPointX(abs), y + k * 0.0009, bottom ? 0.4 - k * sp : -0.4 + k * sp);
  },
  layout(pl, rel) { const st = this.stacks[pl][rel]; return st.map((m, k) => [m, this.slot(pl, rel, k, st.length)]); },
  meshesFor(m) { const st = this.stacks[m.pl][m.from]; return [st[st.length - 1]]; },
  fromFor(m) { const st = this.stacks[m.pl][m.from]; return this.slot(m.pl, m.from, st.length - 1, st.length); },
  ringFor(m) {
    if (m.to === 0) return this.slot(m.pl, 0, this.stacks[m.pl][0].length, 0);
    const n = this.stacks[m.pl][m.to].length;
    return this.slot(m.pl, m.to, n, n + 1);
  },
  async play(m) {
    const G = GAMES.tables, opp = 1 - m.pl;
    const mesh = this.stacks[m.pl][m.from].pop();
    let hitMesh = null;
    if (m.hit) { hitMesh = this.stacks[opp][25 - m.to].pop(); this.stacks[opp][25].push(hitMesh); }
    this.stacks[m.pl][m.to].push(mesh);
    const res = G.apply(m);
    const st = this.stacks[m.pl][m.to];
    await hop(mesh, this.slot(m.pl, m.to, st.length - 1, st.length), m.to === 0 ? 0.36 : 0.3, 0.1);
    if (hitMesh) { const b = this.stacks[opp][25]; await hop(hitMesh, this.slot(opp, 25, b.length - 1, b.length), 0.4, 0.14); }
    // Re-space any stacks whose spacing changed.
    const jobs = [];
    for (const [pl, rel] of [[m.pl, m.from], [m.pl, m.to]]) for (const [mm, v] of this.layout(pl, rel)) if (mm.position.distanceTo(v) > 0.002) jobs.push(tween(0.2, k => mm.position.lerp(v, k)));
    await Promise.all(jobs);
    return res;
  },
  score: () => { const G = GAMES.tables; return [['You', G.home(0) + '/15'], ['Scribe', G.home(1) + '/15'], `borne off · pips ${G.pip(0)} to ${G.pip(1)}`]; },
};
