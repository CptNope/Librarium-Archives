/* --- Wing IV: Draughts */
const DR_S = 0.094;
function drCell(i) { const r = i >> 3, c = i & 7; return { x: (c - 3.5) * DR_S, z: (3.5 - r) * DR_S }; }
function buildDraughtsBoard(group) {
  const W = 8 * DR_S + 0.08;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, W), new THREE.MeshStandardMaterial({ color: 0x2a170b, roughness: 0.5 }));
  frame.position.y = TOP + 0.02; group.add(frame);
  const px = 1024, sc = px / W, c0 = px / 2 - 4 * DR_S * sc;
  const map = tex(px, px, (g) => {
    g.fillStyle = '#2a170b'; g.fillRect(0, 0, px, px);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const dark = (r + c) % 2 === 1; // dark squares match the rules' (r + c) odd, seen from the visitor's side
      const x = c0 + c * DR_S * sc, y = c0 + (7 - r) * DR_S * sc;
      g.fillStyle = dark ? '#3d5a3a' : '#e6d4ac'; g.fillRect(x, y, DR_S * sc, DR_S * sc);
    }
    g.strokeStyle = '#c9a24e'; g.lineWidth = 5; g.strokeRect(c0 - 4, c0 - 4, 8 * DR_S * sc + 8, 8 * DR_S * sc + 8);
  });
  topPlane(group, W, W, TOP + 0.0405, map, { roughness: 0.5 });
  return TOP + 0.041;
}
const drManGeo = new THREE.LatheGeometry([[0, 0], [0.038, 0], [0.04, 0.004], [0.04, 0.012], [0.035, 0.016], [0.02, 0.016], [0.018, 0.014], [0, 0.014]].map(([a, b]) => new THREE.Vector2(a, b)), 30);

