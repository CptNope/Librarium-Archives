
// Nard is played on a tables board; both sides run counterclockwise, so the Scribe's points sit twelve along.
const NARD_P = Object.assign({}, TABLES_P, {
  intro: () => 'All fifteen of your pale checkers start on your head, the far right point, and race counterclockwise to the near right. Nobody hits. Throw to begin.',
  setup(ex) {
    const G = GAMES.nard;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) {
      const cols = [0xe8dcc0, 0x2a1c14];
      ex.pieces = [0, 1].map(pl => Array.from({ length: 15 }, () => {
        const mat = new THREE.MeshStandardMaterial({ color: cols[pl], roughness: pl ? 0.35 : 0.45 });
        const m = new THREE.Mesh(tbCheckerGeo, mat); m.userData.mats = [mat]; ex.group.add(m); return m;
      }));
    }
    ex.pieces.flat().forEach(m => { m.visible = true; });
    this.stacks = [0, 1].map(() => Array.from({ length: 26 }, () => []));
    for (const pl of [0, 1]) {
      let k = 0;
      for (let rel = 0; rel <= 24; rel++) for (let n = 0; n < G.c[pl][rel]; n++) this.stacks[pl][rel].push(ex.pieces[pl][k++]);
      for (let rel = 0; rel <= 24; rel++) this.layout(pl, rel).forEach(([m, v]) => m.position.copy(v));
    }
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); if (ex.pieces) ex.pieces.flat().forEach(m => { m.visible = false; }); },
  slot(pl, rel, k, n) {
    const y = GAMES.nard.surface;
    if (rel === 0) return V3(0.76, TOP + k * 0.0152, pl === 0 ? 0.3 : -0.3);
    const abs = pl === 0 ? rel : (rel > 12 ? rel - 12 : rel + 12);
    const sp = n > 5 ? 0.34 / (n - 1) : 0.084;
    const bottom = abs <= 12;
    return V3(tbPointX(abs), y + k * 0.0009, bottom ? 0.4 - k * sp : -0.4 + k * sp);
  },
  async play(m) {
    const G = GAMES.nard;
    const mesh = this.stacks[m.pl][m.from].pop();
    this.stacks[m.pl][m.to].push(mesh);
    const res = G.apply(m);
    const st = this.stacks[m.pl][m.to];
    await hop(mesh, this.slot(m.pl, m.to, st.length - 1, st.length), m.to === 0 ? 0.36 : 0.3, 0.1);
    const jobs = [];
    for (const rel of [m.from, m.to]) for (const [mm, v] of this.layout(m.pl, rel)) if (mm.position.distanceTo(v) > 0.002) jobs.push(tween(0.2, k => mm.position.lerp(v, k)));
    await Promise.all(jobs);
    return res;
  },
  score: () => { const G = GAMES.nard; return [['You', G.home(0) + '/15'], ['Scribe', G.home(1) + '/15'], `borne off · pips ${G.pip(0)} to ${G.pip(1)}`]; },
});
