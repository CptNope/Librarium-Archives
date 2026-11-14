/* --- Wing III: Courier chess, on a board of twelve files, after Selenus (1616) */
const CO_S = 0.068;
function coCell(i) { const r = (i / 12) | 0, c = i % 12; return { x: (c - 5.5) * CO_S, z: (3.5 - r) * CO_S }; }
// Shatranj's turned pieces serve for the king, queen, bishop, knight, rook and pawn; the courier, sage and schleich are new.
const CO_SJ = [0, 1, 2, 3, 0, 0, 0, 4, 5, 6];
function coPiece(t, mat) {
  if (CO_SJ[t]) { const g = sjPiece(CO_SJ[t], mat); g.scale.setScalar(0.85); return g; }
  const g = new THREE.Group();
  const lathe = pts => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 20), mat); g.add(m); return m; };
  const base = [[0, 0], [0.026, 0], [0.027, 0.006], [0.02, 0.012]];
  if (t === 4) { // courier: a tall runner with his horn
    lathe([...base, [0.014, 0.05], [0.018, 0.056], [0.01, 0.064], [0, 0.066]]);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.03, 10), mat); horn.position.set(0.008, 0.07, 0); horn.rotation.z = -0.9; g.add(horn);
  } else if (t === 5) { // schleich, the fool: a cap with two drooping points and bells
    lathe([...base, [0.016, 0.034], [0.018, 0.04], [0.012, 0.046], [0, 0.048]]);
    for (const sd of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.026, 8), mat); p.position.set(sd * 0.012, 0.052, 0); p.rotation.z = sd * 1.1; g.add(p);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), mat); bell.position.set(sd * 0.024, 0.046, 0); g.add(bell);
    }
  } else { // sage: a hooded counsellor
    lathe([...base, [0.017, 0.042], [0.02, 0.046], [0.014, 0.05], [0, 0.052]]);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.012, 14, 10), mat); head.position.y = 0.06; g.add(head);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.02, 14), mat); hood.position.y = 0.074; g.add(hood);
  }
  g.userData.mats = [mat];
  return g;
}
const CO_MATS = [0xe2cfa2, 0x2a1c12];
function buildCourier(group) {
  const W = 12 * CO_S + 0.07, D = 8 * CO_S + 0.07;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, D), new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.55 }));
  board.position.y = TOP + 0.015; group.add(board);
  const pw = 1024, ph = Math.round(pw * D / W), sx = CO_S * pw / W, ox = pw / 2 - 6 * sx, oy = ph / 2 - 4 * sx;
  topPlane(group, W, D, TOP + 0.0305, tex(pw, ph, (g) => {
    g.fillStyle = '#5a3418'; g.fillRect(0, 0, pw, ph);
    woodGrain(g, pw, ph, '#6a3e1e', '#4a2a12');
    for (let r = 0; r < 8; r++) for (let c = 0; c < 12; c++) { g.fillStyle = (r + c) % 2 ? '#e8d6a8' : '#8e2a1e'; g.fillRect(ox + c * sx, oy + r * sx, sx, sx); } // red and white, as in Lucas van Leyden's painting
    g.strokeStyle = '#2a170b'; g.lineWidth = 6; g.strokeRect(ox, oy, 12 * sx, 8 * sx);
  }), { roughness: 0.55 });
  const y = TOP + 0.031, shown = [], R = window.LibrariumRules.courier;
  R.init(); R.b.forEach((v, i) => { if (!v) return; const pl = v >> 4, o = coPiece(v & 15, new THREE.MeshStandardMaterial({ color: CO_MATS[pl], roughness: pl ? 0.35 : 0.5 })), c = coCell(i); o.position.set(c.x, y, c.z); o.rotation.y = pl ? -Math.PI / 2 : Math.PI / 2; group.add(o); shown.push(o); });
  group.userData.display = shown;
  return y;
}

