/* --- Wing V: Reversi */
const RV_S = 0.09;
function rvCell(i) { const r = i >> 3, c = i & 7; return { x: (c - 3.5) * RV_S, z: (3.5 - r) * RV_S }; }
function buildReversiBoard(group) {
  const W = 8 * RV_S + 0.07;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, W), new THREE.MeshStandardMaterial({ color: 0x1e140c, roughness: 0.5 }));
  frame.position.y = TOP + 0.02; group.add(frame);
  const px = 1024, sc = px / W, c0 = px / 2 - 4 * RV_S * sc;
  topPlane(group, W, W, TOP + 0.0405, tex(px, px, (g) => {
    g.fillStyle = '#1e140c'; g.fillRect(0, 0, px, px);
    g.fillStyle = '#2f6a3e'; g.fillRect(c0, c0, 8 * RV_S * sc, 8 * RV_S * sc);
    speckle(g, px, px, 3000, ['#24563a', '#3a7a4a'], 1.2);
    g.strokeStyle = '#173a22'; g.lineWidth = 4;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(c0, c0 + i * RV_S * sc); g.lineTo(c0 + 8 * RV_S * sc, c0 + i * RV_S * sc); g.stroke();
      g.beginPath(); g.moveTo(c0 + i * RV_S * sc, c0); g.lineTo(c0 + i * RV_S * sc, c0 + 8 * RV_S * sc); g.stroke();
    }
    g.fillStyle = '#173a22'; for (const a of [2, 6]) for (const b of [2, 6]) { g.beginPath(); g.arc(c0 + a * RV_S * sc, c0 + b * RV_S * sc, 7, 0, TAU); g.fill(); }
  }), { roughness: 0.8 });
  return TOP + 0.041;
}
// A two-coloured disc: dark on top for the visitor, flipped over for the Scribe.
const rvDiscGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.012, 32);
const RV_MATS = [new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: 0xeee6d6, roughness: 0.35 })];
function rvDisc() { const m = new THREE.Mesh(rvDiscGeo, [new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 0.5 }), RV_MATS[0], RV_MATS[1]]); return m; }

