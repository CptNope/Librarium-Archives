
// Duodecim scripta: route positions to cells on the three rows. Row 0 is nearest you.
const XII_S = 0.068, XII_GAP = 0.05;
function xiiCell(row, col) { return { x: (col - 5.5) * XII_S + (col >= 6 ? XII_GAP / 2 : -XII_GAP / 2), z: (1 - row) * XII_S * 1.15 }; }
function xiiRoute(pl, p) {
  if (p <= 6) return xiiCell(1, pl === 0 ? 5 + p : p - 1); // each side's own half of the middle row
  if (p <= 18) return xiiCell(2, 18 - p); // the far row, right to left
  return xiiCell(0, p - 19); // the near row, left to right, to the finish
}
const xiiPieceGeo = new THREE.CylinderGeometry(0.024, 0.026, 0.011, 24);
const XII_P = {
  camW: 1.15,
  intro: () => 'A modern reconstruction. Bring your fifteen white pieces onto the right half of the middle row, then race along the far row and back along the near row. Throw to begin.',
  prompt: () => 'Throw when you are ready.',
  choosePrompt: moves => (moves.length > 1 ? 'Pick a glowing piece (or a waiting one beside the board), then a ring.' : 'Pick the glowing piece to move it.'),
  setup(ex) {
    const G = GAMES.xii;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 15 }, () => { const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x23201c : 0xeee6d2, roughness: 0.35 }); const m = new THREE.Mesh(xiiPieceGeo, mat); m.userData.mats = [mat]; ex.group.add(m); return m; }));
    ex.pieces.flat().forEach(m => { m.visible = true; });
    this.ex = ex; this.stacks = [0, 1].map(() => Array.from({ length: 32 }, () => []));
    for (const pl of [0, 1]) { let k = 0; for (let p = 0; p <= 31; p++) for (let n = 0; n < G.p[pl][p]; n++) this.stacks[pl][p].push(ex.pieces[pl][k++]); for (let p = 0; p <= 31; p++) this.relay(pl, p, true); }
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); if (ex.pieces) ex.pieces.flat().forEach(m => { m.visible = false; }); },
  slot(pl, p, k) {
    const y = GAMES.xii.surface + 0.0055;
    if (p === 0) return V3((pl ? -1 : 1) * (0.56 + (k % 3) * 0.055), TOP + 0.0055 + ((k / 3) | 0) * 0.012, 0.1 - (pl ? 1 : 0) * 0.2); // waiting beside the board
    if (p === 31) return V3(0.56 + (k % 3) * 0.055, TOP + 0.0055 + ((k / 3) | 0) * 0.012, pl ? -0.22 : 0.26); // finished
    const c = xiiRoute(pl, p);
    return V3(c.x, y + k * 0.0115, c.z);
  },
  relay(pl, p, instant) { const jobs = []; this.stacks[pl][p].forEach((m, k) => { const v = this.slot(pl, p, k); if (instant) m.position.copy(v); else if (m.position.distanceTo(v) > 0.002) jobs.push(tween(0.2, t => m.position.lerp(v, t))); }); return Promise.all(jobs); },
  meshesFor(m) { const st = this.stacks[m.pl][m.from]; return [st[st.length - 1]]; },
  fromFor(m) { const st = this.stacks[m.pl][m.from]; return this.slot(m.pl, m.from, st.length - 1); },
  ringFor(m) { return this.slot(m.pl, m.to, this.stacks[m.pl][m.to].length); },
  async play(m) {
    const G = GAMES.xii, opp = 1 - m.pl;
    const mesh = this.stacks[m.pl][m.from].pop(); this.stacks[m.pl][m.to].push(mesh);
    let victim = null; if (m.hit) { victim = this.stacks[opp][m.to].pop(); this.stacks[opp][0].push(victim); }
    const res = G.apply(m);
    await hop(mesh, this.slot(m.pl, m.to, this.stacks[m.pl][m.to].length - 1), 0.3, 0.06);
    if (victim) await hop(victim, this.slot(opp, 0, this.stacks[opp][0].length - 1), 0.4, 0.12);
    await this.relay(m.pl, m.from);
    return res;
  },
  score: () => { const G = GAMES.xii; return [['You', G.home(0) + '/15'], ['Scribe', G.home(1) + '/15'], 'borne off']; },
};
