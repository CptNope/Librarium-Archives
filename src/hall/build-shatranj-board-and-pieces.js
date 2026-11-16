/* --- Wing III: Shatranj board and pieces */
const SJ_S = 0.09;
function sjCell(i) { const r = i >> 3, c = i & 7; return { x: (c - 3.5) * SJ_S, z: (3.5 - r) * SJ_S }; }
function buildShatranjBoard(group) {
  const W = 8 * SJ_S + 0.08;
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, W), new THREE.MeshStandardMaterial({ color: 0x3a120c, roughness: 0.8 }));
  base.position.y = TOP + 0.015; group.add(base);
  const px = 1024, sc = px / W, c0 = px / 2 - 4 * SJ_S * sc;
  const map = tex(px, px, (g) => {
    g.fillStyle = '#6a1c14'; g.fillRect(0, 0, px, px);
    speckle(g, px, px, 5000, ['#4a100a', '#8a2e1e'], 1.4);
    g.strokeStyle = '#d8b25a'; g.lineWidth = 4;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(c0, c0 + i * SJ_S * sc); g.lineTo(c0 + 8 * SJ_S * sc, c0 + i * SJ_S * sc); g.stroke();
      g.beginPath(); g.moveTo(c0 + i * SJ_S * sc, c0); g.lineTo(c0 + i * SJ_S * sc, c0 + 8 * SJ_S * sc); g.stroke();
    }
    g.lineWidth = 2; g.strokeStyle = 'rgba(216,178,90,.6)';
    g.strokeRect(c0 - 16, c0 - 16, 8 * SJ_S * sc + 32, 8 * SJ_S * sc + 32);
    for (let k = 0; k < 40; k++) { const a = k / 40 * TAU; g.beginPath(); g.arc(px / 2 + Math.cos(a) * (px * 0.47), px / 2 + Math.sin(a) * (px * 0.47), 3, 0, TAU); }
  });
  topPlane(group, W, W, TOP + 0.0305, map, { roughness: 0.85 });
  return TOP + 0.031;
}
// Aniconic piece shapes in the style of early Islamic chessmen.
function sjPiece(type, mat) {
  const g = new THREE.Group();
  const lathe = (pts, y = 0) => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 20), mat); m.position.y = y; g.add(m); return m; };
  const base = [[0, 0], [0.026, 0], [0.027, 0.006], [0.02, 0.012]];
  if (type === 1) { lathe([...base, [0.019, 0.045], [0.024, 0.05], [0.016, 0.066], [0.005, 0.074], [0, 0.075]]); }
  else if (type === 2) { lathe([...base, [0.017, 0.034], [0.019, 0.04], [0.011, 0.052], [0, 0.056]]); }
  else if (type === 3) { lathe([...base, [0.018, 0.032], [0.016, 0.04], [0, 0.042]]); for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.022, 8), mat); t.position.set(0, 0.048, s * 0.008); t.rotation.x = s * 0.35; g.add(t); } }
  else if (type === 4) { lathe([...base, [0.018, 0.03], [0.014, 0.036], [0, 0.038]]); const w = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.012), mat); w.position.set(0.006, 0.046, 0); w.rotation.z = 0.5; g.add(w); }
  else if (type === 5) { lathe([...base, [0.02, 0.036], [0.024, 0.04], [0, 0.04]]); for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.03), mat); h.position.set(s * 0.01, 0.047, 0); h.rotation.z = -s * 0.25; g.add(h); } }
  else { lathe([[0, 0], [0.02, 0], [0.021, 0.005], [0.015, 0.01], [0.014, 0.024], [0.008, 0.032], [0, 0.034]]); }
  g.userData.mats = [mat];
  return g;
}

