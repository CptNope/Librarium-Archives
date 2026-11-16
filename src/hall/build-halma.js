/* --- Wing V: Halma (display) */
const HM_S = 0.05;
// Row 0 is nearest the visitor; the visitor's camp is the near-left corner.
function hmCell(i) { const r = i >> 4, c = i & 15; return { x: (c - 7.5) * HM_S, z: (7.5 - r) * HM_S }; }
const hmManGeo = new THREE.LatheGeometry([[0, 0], [0.015, 0], [0.016, 0.004], [0.008, 0.012], [0.006, 0.026], [0.011, 0.032], [0.007, 0.04], [0, 0.042]].map(([a, b]) => new THREE.Vector2(a, b)), 16);
const hmHitGeo = new THREE.CylinderGeometry(0.023, 0.023, 0.046, 10);
function halmaMan(pl) {
  const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x1e3a6a : 0x8a1e1e, roughness: 0.4 });
  const m = new THREE.Mesh(hmManGeo, mat); m.userData.mats = [mat];
  const hit = new THREE.Mesh(hmHitGeo, MAT.hit); hit.position.y = 0.023; m.add(hit); // small men are easy to miss
  return m;
}
function buildHalma(group) {
  const S = HM_S, W = 16 * S + 0.05;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, W), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.55 }));
  frame.position.y = TOP + 0.015; group.add(frame);
  const px = 1024, sc = px / W, c0 = px / 2 - 8 * S * sc, cs = S * sc;
  const G = window.LibrariumRules.halma;
  const camp = i => (G.CAMP[0].includes(i) ? 1 : G.CAMP[1].includes(i) ? 2 : 0);
  topPlane(group, W, W, TOP + 0.0305, tex(px, px, (g) => {
    g.fillStyle = '#2a1a10'; g.fillRect(0, 0, px, px);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) {
      const k = camp(r * 16 + c), odd = (r + c) % 2;
      g.fillStyle = k === 1 ? (odd ? '#b07a5a' : '#cf9c7a') : k === 2 ? (odd ? '#7f8ea4' : '#a3b0c2') : (odd ? '#c9b38a' : '#e9dcbc');
      g.fillRect(c0 + c * cs, c0 + (15 - r) * cs, cs, cs);
    }
    g.strokeStyle = '#2a1a10'; g.lineWidth = 3;
    for (const k of [1, 2]) for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) {
      if (camp(r * 16 + c) !== k) continue;
      const x = c0 + c * cs, y = c0 + (15 - r) * cs, nb = (rr, cc) => rr >= 0 && rr < 16 && cc >= 0 && cc < 16 && camp(rr * 16 + cc) === k;
      g.beginPath();
      if (!nb(r + 1, c)) { g.moveTo(x, y); g.lineTo(x + cs, y); }
      if (!nb(r - 1, c)) { g.moveTo(x, y + cs); g.lineTo(x + cs, y + cs); }
      if (!nb(r, c - 1)) { g.moveTo(x, y); g.lineTo(x, y + cs); }
      if (!nb(r, c + 1)) { g.moveTo(x + cs, y); g.lineTo(x + cs, y + cs); }
      g.stroke();
    }
    g.strokeStyle = '#7a2a1c'; g.lineWidth = 4;
    g.strokeRect(c0, c0, 16 * cs, 16 * cs);
  }), { roughness: 0.6 });
  // On display: a game a few moves in. The table replaces these men when play starts.
  const R = seeded(1883), display = [], placed = new Set();
  for (const pl of [0, 1]) for (const i of G.CAMP[pl]) {
    let r = i >> 4, c = i & 15;
    if (R() < 0.18) { const d = pl ? -1 : 1; r += d * (2 + ((R() * 3) | 0)); c += d * (2 + ((R() * 3) | 0)); }
    const key = r * 16 + c; if (placed.has(key) || r < 0 || r > 15 || c < 0 || c > 15) continue; placed.add(key);
    const m = halmaMan(pl), p = hmCell(key); m.position.set(p.x, TOP + 0.031, p.z); group.add(m); display.push(m);
  }
  group.userData.display = display;
  return TOP + 0.031;
}

