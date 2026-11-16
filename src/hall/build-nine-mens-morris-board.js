/* --- Nine Men's Morris board */
const MO_S = [0.36, 0.24, 0.12];
const MO_DIR = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
function moPoint(p) { const r = (p / 8) | 0, k = p % 8, s = MO_S[r]; return { x: MO_DIR[k][0] * s, z: MO_DIR[k][1] * s }; }
function buildMorrisBoard(group) {
  const W = 0.86;
  const block = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, W), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.55 }));
  block.position.y = TOP + 0.025; group.add(block);
  const px = 1024, sc = px / W, c = px / 2;
  const map = tex(px, px, (g) => {
    woodGrain(g, px, px, '#6e4728', '#2a170a');
    g.strokeStyle = '#e7d7b0'; g.lineWidth = 9; g.lineCap = 'square';
    for (const s of MO_S) g.strokeRect(c - s * sc, c - s * sc, 2 * s * sc, 2 * s * sc);
    g.beginPath();
    g.moveTo(c, c - MO_S[0] * sc); g.lineTo(c, c - MO_S[2] * sc); g.moveTo(c, c + MO_S[2] * sc); g.lineTo(c, c + MO_S[0] * sc);
    g.moveTo(c - MO_S[0] * sc, c); g.lineTo(c - MO_S[2] * sc, c); g.moveTo(c + MO_S[2] * sc, c); g.lineTo(c + MO_S[0] * sc, c);
    g.stroke();
    g.fillStyle = '#e7d7b0';
    for (let p = 0; p < 24; p++) { const q = moPoint(p); g.beginPath(); g.arc(c + q.x * sc, c + q.z * sc, 17, 0, TAU); g.fill(); }
    g.fillStyle = '#3a2412';
    for (let p = 0; p < 24; p++) { const q = moPoint(p); g.beginPath(); g.arc(c + q.x * sc, c + q.z * sc, 8, 0, TAU); g.fill(); }
  });
  topPlane(group, W, W, TOP + 0.0505, map, { roughness: 0.5 });
  return TOP + 0.051;
}
const morrisPieceGeo = new THREE.LatheGeometry([[0, 0], [0.034, 0], [0.036, 0.006], [0.034, 0.014], [0.024, 0.02], [0, 0.022]].map(([a, b]) => new THREE.Vector2(a, b)), 28);

