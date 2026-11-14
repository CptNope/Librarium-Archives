{ const setup = YUT_P.setup; YUT_P.setup = function (ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); (ex.pieces || []).flat().forEach(m => { m.visible = true; }); setup.call(this, ex); }; }
// Pachisi: cell positions on the cross. Arms 0 near, 1 right, 2 far, 3 left.
const PC_SQ = 0.046, PC_D = [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: -1, z: 0 }];
function pcPos(cell) {
  const a = (cell / 24) | 0, k = ((cell % 24) / 3) | 0, j = (cell % 3) - 1, d = PC_D[a], n = PC_D[(a + 1) % 4], along = 1.5 * PC_SQ + (k + 0.5) * PC_SQ;
  return { x: d.x * along + n.x * j * PC_SQ, z: d.z * along + n.z * j * PC_SQ };
}
const PC_COL = [[0xe8b23a, 0x1e3a7a], [0xe8e0c8, 0x2a6a4a]];
const PACHISI = Object.assign(R.pachisi, {
  camW: 1.05, pieceH: 0,
  makePieces(group) {
    const geo = new THREE.LatheGeometry([[0, 0], [0.016, 0], [0.017, 0.004], [0.015, 0.016], [0.01, 0.028], [0.004, 0.034], [0, 0.035]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
    return [0, 1].map(pl => Array.from({ length: this.N }, (_, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: PC_COL[pl][i < this.per ? 0 : 1], roughness: 0.4 });
      const m = new THREE.Mesh(geo, mat); m.userData.mats = [mat]; group.add(m); return m;
    }));
  },
  local(pl, idx, i) {
    const y = this.surface, a = this.arm(pl, i), d = PC_D[a], n = PC_D[(a + 1) % 4];
    const k = i % this.per;
    if (idx === 0) return V3(d.x * 0.05 + n.x * (k - (this.per - 1) / 2) * 0.03, y, d.z * 0.05 + n.z * (k - (this.per - 1) / 2) * 0.03);
    if (idx === this.HOME) return V3(d.x * 0.018 + n.x * (k - (this.per - 1) / 2) * 0.026, y, d.z * 0.018 + n.z * (k - (this.per - 1) / 2) * 0.026);
    const cell = this.cellOf(pl, i, idx), p = pcPos(cell);
    // Pieces sharing a square sit side by side.
    let under = 0; for (const q of [0, 1]) this.pos[q].forEach((v, j) => { if ((q < pl || (q === pl && j < i)) && this.cellOf(q, j, v) === cell) under++; });
    return V3(p.x + (under % 2 ? 0.012 : under ? -0.012 : 0), y, p.z + (under > 1 ? 0.012 : 0));
  },
  bigHop: (m, s) => s === m.to && m.cap.length > 0,
  score() { return [['You', this.home(0) + '/' + this.N], ['Scribe', this.home(1) + '/' + this.N], 'home']; },
  winText: pl => (pl === 0 ? 'All your pieces are home in the Charkoni.' : 'The Scribe brought all its pieces home first.'),
});
