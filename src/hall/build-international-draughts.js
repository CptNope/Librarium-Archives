/* --- Wing IV: International draughts, a 10 x 10 board numbered 1 to 50 */
const ID_S = 0.076;
function idCell(i) { const r = (i / 10) | 0, c = i % 10; return { x: (c - 4.5) * ID_S, z: (4.5 - r) * ID_S }; }
// The FMJD numbers the 50 dark squares from Black's side, left to right as White sees them: 1 is far left, 46 near left.
function idNumber(i) { const r = (i / 10) | 0, c = i % 10; return (9 - r) * 5 + ((c / 2) | 0) + 1; }
function idPiece(pl) {
  const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x24160e : 0xeee4cc, roughness: 0.38 });
  const m = new THREE.Mesh(drManGeo, mat); m.scale.set(0.86, 1, 0.86); m.userData.mats = [mat];
  const crown = new THREE.Mesh(drManGeo, mat); crown.position.y = 0.016; crown.visible = false; m.add(crown); m.userData.crown = crown;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.003, 6, 24), MAT.brass); band.rotation.x = Math.PI / 2; band.position.y = 0.024; band.visible = false; m.add(band); m.userData.band = band;
  return m;
}
function buildIDraughts(group) {
  const W = 10 * ID_S + 0.08;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, W), new THREE.MeshStandardMaterial({ color: 0x2b1a0e, roughness: 0.5 }));
  frame.position.y = TOP + 0.02; group.add(frame);
  const px = 1024, sc = px / W, c0 = px / 2 - 5 * ID_S * sc, s = ID_S * sc;
  topPlane(group, W, W, TOP + 0.0405, tex(px, px, (g) => {
    g.fillStyle = '#2b1a0e'; g.fillRect(0, 0, px, px);
    g.font = `600 ${Math.round(s * 0.2)}px Georgia, serif`; g.textAlign = 'right'; g.textBaseline = 'top';
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
      const dark = (r + c) % 2 === 0, x = c0 + c * s, y = c0 + (9 - r) * s; // the visitor's near-left corner is dark, as the rules ask
      g.fillStyle = dark ? '#6b4426' : '#ead7ae'; g.fillRect(x, y, s, s);
      if (dark) { g.fillStyle = 'rgba(240,220,180,.55)'; g.fillText(String(idNumber(r * 10 + c)), x + s - 5, y + 4); }
    }
    g.strokeStyle = '#c9a24e'; g.lineWidth = 5; g.strokeRect(c0 - 4, c0 - 4, 10 * s + 8, 10 * s + 8);
  }), { roughness: 0.5 });
  const y = TOP + 0.041, shown = [], G = window.LibrariumRules.idraughts;
  G.init(); G.b.forEach((v, i) => { if (!v) return; const m = idPiece(G.owner(v)), c = idCell(i); m.position.set(c.x, y, c.z); group.add(m); shown.push(m); });
  group.userData.display = shown;
  return y;
}

