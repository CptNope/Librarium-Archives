/* --- Wing III: Chaturanga on an ashtapada board */
const CR_MAKE = {
  raja(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.06, 14), m); b.position.y = 0.03; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), m); h.position.y = 0.068; g.add(h); const u = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.014, 16), m); u.position.y = 0.088; g.add(u); return g; },
  mantri(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.05, 14), m); b.position.y = 0.025; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), m); h.scale.y = 1.2; h.position.y = 0.062; g.add(h); return g; },
  gaja(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.032), m); b.position.y = 0.04; g.add(b); for (const [x, z] of [[-0.016, -0.011], [-0.016, 0.011], [0.016, -0.011], [0.016, 0.011]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.026, 8), m); l.position.set(x, 0.013, z); g.add(l); } const h = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), m); h.position.set(0.03, 0.05, 0); g.add(h); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.035, 8), m); t.position.set(0.04, 0.032, 0); t.rotation.z = 0.25; g.add(t); return g; },
  ashva(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 0.018), m); b.position.y = 0.036; g.add(b); for (const [x, z] of [[-0.016, -0.006], [-0.016, 0.006], [0.016, -0.006], [0.016, 0.006]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.027, 6), m); l.position.set(x, 0.013, z); g.add(l); } const n = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.012), m); n.position.set(0.022, 0.054, 0); n.rotation.z = -0.4; g.add(n); const h = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.01, 0.01), m); h.position.set(0.032, 0.068, 0); g.add(h); return g; },
  ratha(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.026, 0.03), m); b.position.y = 0.03; g.add(b); for (const z of [-0.018, 0.018]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 6, 16), m); w.position.set(-0.004, 0.017, z); g.add(w); } const p = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.04, 6), m); p.position.set(0.012, 0.06, 0); g.add(p); return g; },
  padati(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 10), m); b.position.y = 0.02; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), m); h.position.y = 0.045; g.add(h); return g; },
  // A boat for chaturaji: a hull with a raised prow and stern, and a short mast.
  nauka(m) { const g = new THREE.Group(); const keel = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.008, 0.016), m); keel.position.y = 0.004; g.add(keel); const hull = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.014, 0.026), m); hull.position.y = 0.015; g.add(hull); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.03, 8), m); p.position.set(s * 0.027, 0.026, 0); p.rotation.z = -s * 0.6; g.add(p); } const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.05, 6), m); mast.position.y = 0.045; g.add(mast); const sail = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.026, 0.028), m); sail.position.set(0.003, 0.05, 0); g.add(sail); return g; },
};
function buildChaturanga(group) {
  const S = 0.088, W = 8 * S + 0.06;
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, W), new THREE.MeshStandardMaterial({ color: 0x7a3b1c, roughness: 0.9 }));
  cloth.position.y = TOP + 0.01; group.add(cloth);
  const px = 1024, sc = px / W, c0 = px / 2 - 4 * S * sc;
  const map = tex(px, px, (g) => {
    g.fillStyle = '#9a4a22'; g.fillRect(0, 0, px, px);
    speckle(g, px, px, 6000, ['#6e2f12', '#b9643a', '#5a240c'], 1.6);
    g.strokeStyle = '#f0d58a'; g.lineWidth = 5;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(c0, c0 + i * S * sc); g.lineTo(c0 + 8 * S * sc, c0 + i * S * sc); g.stroke();
      g.beginPath(); g.moveTo(c0 + i * S * sc, c0); g.lineTo(c0 + i * S * sc, c0 + 8 * S * sc); g.stroke();
    }
    g.lineWidth = 4;
    for (const [r, c] of [[0, 0], [0, 7], [7, 0], [7, 7], [3, 3], [3, 4], [4, 3], [4, 4]]) {
      const x = c0 + c * S * sc, y = c0 + r * S * sc, d = S * sc;
      g.beginPath(); g.moveTo(x + 10, y + 10); g.lineTo(x + d - 10, y + d - 10); g.moveTo(x + d - 10, y + 10); g.lineTo(x + 10, y + d - 10); g.stroke();
    }
  });
  topPlane(group, W, W, TOP + 0.0205, map, { roughness: 0.9 });
  const y0 = TOP + 0.021;
  const cell = (r, c) => V3((c - 3.5) * S, y0, (r - 3.5) * S);
  const mats = [new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: 0x8e2a1e, roughness: 0.45 })];
  const back = ['ratha', 'ashva', 'gaja', 'raja', 'mantri', 'gaja', 'ashva', 'ratha'], shown = [];
  for (const side of [0, 1]) {
    const m = mats[side], r0 = side ? 7 : 0, r1 = side ? 6 : 1, face = side ? Math.PI / 2 : -Math.PI / 2;
    back.forEach((k, c) => { const o = CR_MAKE[k](m); o.position.copy(cell(r0, c)); o.rotation.y = face; group.add(o); shown.push(o); });
    for (let c = 0; c < 8; c++) { const o = CR_MAKE.padati(m); o.position.copy(cell(r1, c)); group.add(o); shown.push(o); }
  }
  group.userData.display = shown;
  return y0;
}
const CRG_S = 0.088;
const CRG_KIND = [null, 'raja', 'mantri', 'gaja', 'ashva', 'ratha', 'padati']; // in the shatranj engine's order
const CRG_MATS = [new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: 0x8e2a1e, roughness: 0.45 })];

