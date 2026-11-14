/* --- Wing VI: Seega, on a slab of Egyptian limestone with twenty-five cups */
const SG_S = 0.1;
function sgCell(i) { const x = i % 5, y = (i / 5) | 0; return { x: (x - 2) * SG_S, z: (2 - y) * SG_S }; }
const sgStoneGeo = new THREE.SphereGeometry(0.032, 20, 12);
function sgStone(pl) {
  const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x9c3e1c : 0x121010, roughness: pl ? 0.75 : 0.4 });
  const m = new THREE.Mesh(sgStoneGeo, mat); m.scale.set(1, 0.5, 0.88); m.userData.mats = [mat]; return m;
}
function buildSeega(group) {
  const W = 5 * SG_S + 0.08;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, W), new THREE.MeshStandardMaterial({ color: 0xcdb894, roughness: 0.95 }));
  slab.position.y = TOP + 0.02; group.add(slab);
  const px = 1024, sc = px / W, d = SG_S * sc, c0 = px / 2 - 2.5 * d;
  topPlane(group, W, W, TOP + 0.0405, tex(px, px, (g) => {
    g.fillStyle = '#d6c39e'; g.fillRect(0, 0, px, px);
    speckle(g, px, px, 9000, ['#c4ae86', '#e2d2b0', '#b9a37c', '#cdb894'], 2.2);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const cx = c0 + (x + 0.5) * d, cy = c0 + (y + 0.5) * d, r = d * 0.36;
      const grd = g.createRadialGradient(cx, cy - r * 0.2, r * 0.2, cx, cy, r);
      grd.addColorStop(0, '#8a7656'); grd.addColorStop(0.75, '#a48e68'); grd.addColorStop(1, '#c2ab84');
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    }
    const cx = c0 + 2.5 * d, cy = cx, k = d * 0.42; // the centre cup is marked
    g.strokeStyle = '#6e5a3e'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - k, cy - k); g.lineTo(cx + k, cy + k); g.moveTo(cx + k, cy - k); g.lineTo(cx - k, cy + k); g.stroke();
  }), { roughness: 0.95 });
  const y = TOP + 0.041, shown = [];
  [[0, 1], [3, 1], [6, 0], [8, 0], [16, 1], [18, 0], [21, 1], [23, 1], [11, 0], [13, 1]].forEach(([i, pl]) => { const s = sgStone(pl), c = sgCell(i); s.position.set(c.x, y + 0.012, c.z); group.add(s); shown.push(s); });
  group.userData.display = shown;
  return y;
}

