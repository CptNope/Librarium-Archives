/* --- Wing IV: Pachisi (display) */
function buildPachisi(group) {
  const sq = 0.046, armLen = 8 * sq, armW = 3 * sq, ctr = 3 * sq;
  const total = ctr + 2 * armLen;
  const px = 1024, sc = px / total, c0 = px / 2;
  const map = tex(px, px, (g) => {
    g.clearRect(0, 0, px, px);
    const a = armW / 2 * sc, l = total / 2 * sc;
    g.save(); g.beginPath(); g.rect(c0 - l, c0 - a, 2 * l, 2 * a); g.rect(c0 - a, c0 - l, 2 * a, 2 * l); g.clip();
    g.fillStyle = '#8a1e1e'; g.fillRect(0, 0, px, px);
    speckle(g, px, px, 6000, ['#5a0e0e', '#b23a2a'], 1.4);
    const s = sq * sc, colours = ['#e8b23a', '#2a6a4a', '#1e3a7a', '#e8e0c8'];
    for (let arm = 0; arm < 4; arm++) {
      g.save(); g.translate(c0, c0); g.rotate(arm * Math.PI / 2);
      for (let k = 0; k < 8; k++) for (let j = -1; j <= 1; j++) {
        const x = j * s - s / 2, y = ctr / 2 * sc + k * s;
        g.strokeStyle = '#f0d58a'; g.lineWidth = 2.5; g.strokeRect(x + 2, y + 2, s - 4, s - 4);
        if ((k === 4 && j !== 0) || (k === 7 && j === 0)) { g.strokeStyle = '#f0d58a'; g.beginPath(); g.moveTo(x + 8, y + 8); g.lineTo(x + s - 8, y + s - 8); g.moveTo(x + s - 8, y + 8); g.lineTo(x + 8, y + s - 8); g.stroke(); }
      }
      g.fillStyle = colours[arm]; g.globalAlpha = 0.55; g.fillRect(-s * 1.5, ctr / 2 * sc + 8 * s - 10, s * 3, 10); g.globalAlpha = 1;
      g.restore();
    }
    g.fillStyle = '#5a0e0e'; g.fillRect(c0 - ctr / 2 * sc, c0 - ctr / 2 * sc, ctr * sc, ctr * sc);
    g.strokeStyle = '#f0d58a'; g.lineWidth = 4; g.strokeRect(c0 - ctr / 2 * sc + 6, c0 - ctr / 2 * sc + 6, ctr * sc - 12, ctr * sc - 12);
    g.restore();
  });
  topPlane(group, total, total, TOP + 0.004, map, { roughness: 0.95, transparent: true });
  // Cowrie shells, a few mouth up, and beehive-shaped pawns in four colours.
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.35 });
  const slit = new THREE.MeshStandardMaterial({ color: 0x5a4a3a });
  const R = seeded(25), display = [];
  for (let k = 0; k < 7; k++) {
    const sh = new THREE.Group(); display.push(sh);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), shellMat); b.scale.set(1.4, 0.7, 1); sh.add(b);
    if (k % 2) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.002, 0.002), slit); l.position.y = 0.0085; sh.add(l); }
    sh.position.set(0.1 + R() * 0.12, TOP + 0.012, 0.1 + R() * 0.12); sh.rotation.y = R() * TAU; group.add(sh);
  }
  const pawn = new THREE.LatheGeometry([[0, 0], [0.016, 0], [0.017, 0.004], [0.015, 0.016], [0.01, 0.028], [0.004, 0.034], [0, 0.035]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
  [0xe8b23a, 0x2a6a4a, 0x1e3a7a, 0xe8e0c8].forEach((col, arm) => {
    const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 });
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(pawn, m);
      const along = ctr / 2 + (k === 3 ? 5.5 : 0.5 + k) * sq, across = (k % 2 ? 1 : -1) * sq;
      const ang = arm * Math.PI / 2, x = Math.sin(ang) * along + Math.cos(ang) * across, z = Math.cos(ang) * along - Math.sin(ang) * across;
      p.position.set(x, TOP + 0.005, z); group.add(p); display.push(p);
    }
  });
  group.userData.display = display;
  return TOP + 0.005;
}

