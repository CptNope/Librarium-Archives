/* --- Wing VI: Bagh-chal, the tiger game of Nepal, on a lined board */
const BC_S = 0.11;
function bcCell(i) { const r = (i / 5) | 0, c = i % 5; return { x: (c - 2) * BC_S, z: (2 - r) * BC_S }; }
const bcStripe = tex(128, 64, (g, w, h) => { g.fillStyle = '#d9822b'; g.fillRect(0, 0, w, h); g.fillStyle = '#1e1208'; for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(k * 16, 0); g.lineTo(k * 16 + 7, 0); g.lineTo(k * 16 + 3, h); g.lineTo(k * 16 - 3, h); g.fill(); } });
function bcTiger() {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ map: bcStripe, roughness: 0.55 }), plain = new THREE.MeshStandardMaterial({ color: 0xd9822b, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.05, 20), mat); body.position.y = 0.025; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), plain); head.position.y = 0.064; g.add(head);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.014, 8), plain); e.position.set(s * 0.013, 0.081, 0); g.add(e); }
  g.userData.mats = [mat, plain]; return g;
}
function bcGoat() {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0xf0e9da, roughness: 0.7 }), horn = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.021, 0.03, 16), mat); body.position.y = 0.015; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.013, 14, 10), mat); head.position.y = 0.04; g.add(head);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.0035, 0.016, 6), horn); h.position.set(s * 0.007, 0.054, 0); h.rotation.z = -s * 0.35; g.add(h); }
  g.userData.mats = [mat]; return g;
}
function buildBaghchal(group) {
  const W = 4 * BC_S + 0.14;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.035, W), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.6 }));
  board.position.y = TOP + 0.0175; group.add(board);
  const px = 1024, sc = px / W, o = px / 2 - 2 * BC_S * sc, st = BC_S * sc;
  topPlane(group, W, W, TOP + 0.0355, tex(px, px, (g) => {
    g.fillStyle = '#9c6b3c'; g.fillRect(0, 0, px, px);
    woodGrain(g, px, px, '#a8743f', '#7a4f2a');
    g.strokeStyle = '#8a1e14'; g.lineWidth = 16; g.strokeRect(10, 10, px - 20, px - 20); // a red painted border, as on Nepali brass boards
    g.strokeStyle = '#2a170b'; g.lineWidth = 7; g.lineCap = 'round';
    const P = (r, c) => [o + c * st, o + (4 - r) * st];
    const line = (a, b) => { g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.stroke(); };
    for (let k = 0; k < 5; k++) { line([k, 0], [k, 4]); line([0, k], [4, k]); }
    line([0, 0], [4, 4]); line([0, 4], [4, 0]); line([2, 0], [0, 2]); line([0, 2], [2, 4]); line([2, 4], [4, 2]); line([4, 2], [2, 0]);
    g.fillStyle = '#2a170b';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const [x, y] = P(r, c); g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill(); }
  }), { roughness: 0.6 });
  const y = TOP + 0.036, shown = [];
  for (const i of [0, 4, 20, 24]) { const t = bcTiger(), c = bcCell(i); t.position.set(c.x, y, c.z); group.add(t); shown.push(t); }
  for (const i of [7, 11, 12, 13, 17]) { const t = bcGoat(), c = bcCell(i); t.position.set(c.x, y, c.z); group.add(t); shown.push(t); }
  group.userData.display = shown;
  return y;
}

