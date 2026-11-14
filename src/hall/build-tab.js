/* --- Wing VI: Tâb, four rows of squares scratched in a plank, stone and tile pieces */
const TAB_S = 0.088;
function tabCell(i) { const W = 9, r = (i / W) | 0, c = i % W; return { x: (c - 4) * TAB_S, z: (1.5 - r) * TAB_S }; }
const tabPieceGeo = new THREE.CylinderGeometry(0.03, 0.032, 0.016, 20);
function tabPiece(pl) {
  const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x9c3e1c : 0x121010, roughness: pl ? 0.8 : 0.4 });
  const m = new THREE.Mesh(tabPieceGeo, mat); m.userData.mats = [mat];
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.003, 6, 20), new THREE.MeshStandardMaterial({ color: 0xf1e3bf, roughness: 0.5 }));
  band.rotation.x = -Math.PI / 2; band.position.y = 0.0075; band.visible = false; m.add(band); m.userData.band = band;
  return m;
}
function buildTab(group) {
  const W = 9 * TAB_S + 0.08, D = 4 * TAB_S + 0.08;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, D), new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 0.7 }));
  board.position.y = TOP + 0.015; group.add(board);
  const px = 1536, py = Math.round(px * D / W), sc = px / W, d = TAB_S * sc, x0 = px / 2 - 4.5 * d, y0 = py / 2 - 2 * d;
  topPlane(group, W, D, TOP + 0.0305, tex(px, py, (g) => {
    woodGrain(g, px, py, '#a87c4c', '#6e4a28');
    g.strokeStyle = '#3a2412'; g.lineWidth = 5;
    for (let r = 0; r <= 4; r++) { g.beginPath(); g.moveTo(x0, y0 + r * d); g.lineTo(x0 + 9 * d, y0 + r * d); g.stroke(); }
    for (let c = 0; c <= 9; c++) { g.beginPath(); g.moveTo(x0 + c * d, y0); g.lineTo(x0 + c * d, y0 + 4 * d); g.stroke(); }
    // Arrows: each row runs one way for both players (row 0 is nearest the visitor, drawn at the bottom)
    g.fillStyle = 'rgba(58,36,18,.55)';
    for (let r = 0; r < 4; r++) {
      const dir = [1, -1, 1, -1][r], cy = y0 + (3 - r + 0.5) * d;
      for (let c = 0; c < 9; c += 2) {
        const cx = x0 + (c + 0.5) * d + dir * d * 0.36;
        g.beginPath(); g.moveTo(cx + dir * 9, cy); g.lineTo(cx - dir * 7, cy - 8); g.lineTo(cx - dir * 7, cy + 8); g.closePath(); g.fill();
      }
    }
  }), { roughness: 0.75 });
  const y = TOP + 0.031, shown = [];
  for (let c = 0; c < 9; c++) for (const pl of [0, 1]) { const p = tabPiece(pl), at = tabCell(pl ? 27 + c : c); p.position.set(at.x, y + 0.007, at.z); group.add(p); shown.push(p); }
  group.userData.display = shown;
  return y;
}

