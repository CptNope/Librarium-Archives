/* --- Wing III: Tables board (backgammon layout) */
const TB_W = 0.0967, TB_HALF = 0.62, TB_BAR = 0.04;
function tbPointX(abs) {
  if (abs <= 6) return TB_HALF - (abs - 0.5) * TB_W;
  if (abs <= 12) return -TB_BAR - (abs - 6 - 0.5) * TB_W;
  if (abs <= 18) return -TB_HALF + (abs - 12 - 0.5) * TB_W;
  return TB_BAR + (abs - 18 - 0.5) * TB_W;
}
function buildTablesBoard(group, look = {}) {
  const W = 1.42, D = 0.98;
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2312, roughness: 0.5 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, D), wood); box.position.y = TOP + 0.025; group.add(box);
  const px = 1420, py = 980, sc = px / W;
  const map = tex(px, py, (g) => {
    woodGrain(g, px, py, '#5a3a1e', '#1e1006');
    // Felt fields either side of the bar
    for (const s of [-1, 1]) {
      const x0 = px / 2 + s * TB_BAR * sc, x1 = px / 2 + s * (TB_HALF + 0.02) * sc;
      g.fillStyle = look.felt || '#21402e'; g.fillRect(Math.min(x0, x1), 0.05 * sc, Math.abs(x1 - x0), py - 0.1 * sc);
    }
    for (let abs = 1; abs <= 24; abs++) {
      const x = px / 2 + tbPointX(abs) * sc, top = abs > 12;
      const yBase = top ? 0.05 * sc : py - 0.05 * sc, yTip = top ? yBase + 0.36 * sc : yBase - 0.36 * sc;
      g.fillStyle = abs % 2 ? (look.light || '#e7d6b0') : (look.dark || '#7a2a1c');
      g.beginPath(); g.moveTo(x - TB_W / 2 * sc + 3, yBase); g.lineTo(x + TB_W / 2 * sc - 3, yBase); g.lineTo(x, yTip); g.closePath(); g.fill();
    }
    g.fillStyle = '#2a170a'; g.fillRect(px / 2 - TB_BAR * sc, 0, 2 * TB_BAR * sc, py);
  });
  topPlane(group, W, D, TOP + 0.0505, map, { roughness: 0.6 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2a170a, roughness: 0.45 });
  for (const [x, z, w, d] of [[0, -D / 2, W, 0.03], [0, D / 2, W, 0.03], [-W / 2, 0, 0.03, D], [W / 2, 0, 0.03, D], [0, 0, 0.06, D]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), rimMat); r.position.set(x, TOP + 0.062, z); group.add(r);
  }
  return TOP + 0.052;
}
const tbCheckerGeo = new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.042, 0.005], [0.042, 0.011], [0.038, 0.015], [0, 0.015]].map(([a, b]) => new THREE.Vector2(a, b)), 28);

