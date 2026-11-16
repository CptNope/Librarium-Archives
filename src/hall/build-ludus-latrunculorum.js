/* --- Ludus latrunculorum: an incised stone board with glass counters */
const LT_CS = 0.085;
const ltGlass = [0x2f5fb3, 0xe6eef2];
const ltCounterGeo = new THREE.SphereGeometry(0.03, 20, 12); // squashed into a bun-shaped counter
function ltCounter(pl) { const m = new THREE.MeshStandardMaterial({ color: ltGlass[pl], roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.9 }); const c = new THREE.Mesh(ltCounterGeo, m); c.scale.set(1, 0.42, 1); c.userData.mats = [m]; return c; }
function ltCell(i) { const x = i & 7, y = i >> 3; return { x: (x - 3.5) * LT_CS, z: (3.5 - y) * LT_CS }; }
function buildLatrunculi(group) {
  const W = 0.84, D = 0.74, n = 8, cs = LT_CS;
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xb3a68f, roughness: 0.9, map: stoneTex() });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, D), slabMat); slab.position.y = TOP + 0.03; group.add(slab);
  const px = 1024;
  const map = tex(px, Math.round(px * D / W), (g, w, h) => {
    g.fillStyle = '#b8ab93'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 4000, ['#857a68', '#d8ccb4', '#6f6555'], 2.2);
    const sx = w / W, x0 = w / 2 - (n / 2) * cs * sx, y0 = h / 2 - (n / 2) * cs * sx;
    g.strokeStyle = 'rgba(60,50,38,.75)'; g.lineCap = 'round';
    for (let i = 0; i <= n; i++) {
      for (const pass of [0, 1]) {
        g.lineWidth = pass ? 1.5 : 4.5; g.strokeStyle = pass ? 'rgba(220,210,190,.35)' : 'rgba(55,46,35,.7)';
        g.beginPath(); g.moveTo(x0 + rand(-3, 3), y0 + i * cs * sx + rand(-2, 2)); g.lineTo(x0 + n * cs * sx + rand(-3, 3), y0 + i * cs * sx + rand(-2, 2)); g.stroke();
        g.beginPath(); g.moveTo(x0 + i * cs * sx + rand(-2, 2), y0 + rand(-3, 3)); g.lineTo(x0 + i * cs * sx + rand(-2, 2), y0 + n * cs * sx + rand(-3, 3)); g.stroke();
      }
    }
  });
  topPlane(group, W, D, TOP + 0.0605, map, { roughness: 0.9 });
  const R = seeded(116), taken = new Set(), shown = [];
  const place = (c, r, side) => {
    if (taken.has(c + ',' + r)) return; taken.add(c + ',' + r);
    const m = ltCounter(side); m.position.set((c - 3.5) * cs, TOP + 0.072, (r - 3.5) * cs); group.add(m); shown.push(m);
  };
  for (let c = 0; c < 8; c++) { if (R() > 0.3) place(c, 0, 0); if (R() > 0.5) place(c, 1, 0); if (R() > 0.3) place(c, 7, 1); if (R() > 0.5) place(c, 6, 1); }
  for (let k = 0; k < 6; k++) place((R() * 8) | 0, 2 + ((R() * 4) | 0), k % 2);
  for (let k = 0; k < 5; k++) { const m = ltCounter(k % 2); m.position.set(W / 2 + 0.1 + (k % 2) * 0.07, TOP + 0.013, -0.2 + k * 0.08); group.add(m); shown.push(m); }
  group.userData.display = shown;
  return TOP + 0.072;
}

