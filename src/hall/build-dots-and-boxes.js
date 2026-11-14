/* --- Wing V: Dots and Boxes, on a writing slope */
// The dots span the same 0.62 m whatever the grid size; DB_S is the gap for the current size.
const DB_SPAN = 0.62;
let DB_S = DB_SPAN / 4;
function dbN() { return window.LibrariumRules.dotsboxes.N; }
function dbDot(r, c) { const h = dbN() / 2; return V3((c - h) * DB_S, 0, (r - h) * DB_S); }
function dbPaper(n) {
  const W = 0.86, px = 1024, sc = px / W, s = DB_SPAN / n;
  return tex(px, px, (g) => {
    g.fillStyle = '#f2ead6'; g.fillRect(0, 0, px, px);
    speckle(g, px, px, 1500, ['#d8ccb0'], 1.2);
    g.strokeStyle = 'rgba(70,110,170,.25)'; g.lineWidth = 2;
    for (let y = 40; y < px; y += 34) { g.beginPath(); g.moveTo(0, y); g.lineTo(px, y); g.stroke(); }
    g.strokeStyle = 'rgba(190,60,60,.35)'; g.beginPath(); g.moveTo(90, 0); g.lineTo(90, px); g.stroke();
    g.fillStyle = '#1d1a16';
    for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) { g.beginPath(); g.arc(px / 2 + (c - n / 2) * s * sc, px / 2 + (r - n / 2) * s * sc, 9, 0, TAU); g.fill(); }
  });
}
function dbEdgeMid(e) {
  const N = dbN();
  if (e < N * (N + 1)) { const r = (e / N) | 0, c = e % N; const a = dbDot(r, c), b = dbDot(r, c + 1); return { pos: a.add(b).multiplyScalar(0.5), horiz: true }; }
  const k = e - N * (N + 1), r = (k / (N + 1)) | 0, c = k % (N + 1); const a = dbDot(r, c), b = dbDot(r + 1, c); return { pos: a.add(b).multiplyScalar(0.5), horiz: false };
}
function buildDotsBoard(group) {
  const W = 0.86;
  const desk = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.03, W + 0.06), new THREE.MeshStandardMaterial({ color: 0x3a2312, roughness: 0.55 }));
  desk.position.y = TOP + 0.015; group.add(desk);
  const paper = topPlane(group, W, W, TOP + 0.0305, dbPaper(4), { roughness: 0.9 });
  group.userData.dots = { paper, maps: { 4: paper.material.map } };
  // An inkwell and a pencil beside the sheet.
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.045, 18), new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.2 }));
  glass.position.set(W / 2 + 0.1, TOP + 0.0225, -0.22); group.add(glass);
  const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.18, 6), new THREE.MeshStandardMaterial({ color: 0xd4a23a, roughness: 0.5 }));
  pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.4; pencil.position.set(W / 2 + 0.1, TOP + 0.005, 0.15); group.add(pencil);
  return TOP + 0.031;
}
const dbLineMats = [new THREE.MeshStandardMaterial({ color: 0x8a5a12, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.6 })];

