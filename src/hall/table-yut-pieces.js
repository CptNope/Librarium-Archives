const YUT = Object.assign(R.yut, {
  camW: 1.12, pieceH: 0.011,
  makePieces(group) {
    return [0x8a2a22, 0x22346a].map(col => Array.from({ length: 4 }, () => {
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.022, 18), mat); m.userData.mats = [mat]; group.add(m); return m;
    }));
  },
  local(pl, sq, i) {
    const y = this.surface;
    if (sq === -1) return V3(pl ? -0.45 : 0.45, y, (pl ? -1 : 1) * (0.2 - i * 0.05));
    if (sq === this.HOME) return V3((pl ? -1 : 1) * (0.14 + i * 0.045), y, pl ? -0.42 : 0.42);
    const p = ytPos(sq), k = this.pos[pl].filter((q, j) => q === sq && j < i).length; // stacked pieces sit on top of each other
    return V3(p.x + (pl ? -0.008 : 0.008), y + k * 0.023, p.z);
  },
  bigHop: (m, s) => s === m.to && m.cap.length > 0,
  score() { return [['You', this.home(0) + '/4'], ['Scribe', this.home(1) + '/4'], 'home']; },
  winText: pl => (pl === 0 ? 'All four of your pieces are home.' : 'The Scribe brought all four home first.'),
});
