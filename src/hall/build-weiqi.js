/* --- Weiqi (Go): a 17 x 17 board like the Eastern Han stone board */
const GO9_S = 0.08; // the 9 x 9 grid fills the same block as the 17 x 17 one
function goCell(p) { const r = (p / 9) | 0, c = p % 9; return { x: (c - 4) * GO9_S, z: (4 - r) * GO9_S }; }
const go9StoneGeo = new THREE.SphereGeometry(0.036, 24, 12);
const GO9_MATS = [new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.32 }), new THREE.MeshStandardMaterial({ color: 0xefe9dc, roughness: 0.28 })];
function buildGo(group) {
  const N = 17, S = 0.04, W = (N - 1) * S + 0.08;
  const kaya = new THREE.MeshStandardMaterial({ color: 0xc79a5c, roughness: 0.55 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, W), kaya); block.position.y = TOP + 0.06; group.add(block);
  const px = 1024, cell = px * S / W, off = px * 0.04 / W;
  const map = tex(px, px, (g) => {
    woodGrain(g, px, px, '#d2a565', '#7a5226');
    g.strokeStyle = '#1d140c'; g.lineWidth = 2.2;
    for (let i = 0; i < N; i++) {
      g.beginPath(); g.moveTo(off, off + i * cell); g.lineTo(off + (N - 1) * cell, off + i * cell); g.stroke();
      g.beginPath(); g.moveTo(off + i * cell, off); g.lineTo(off + i * cell, off + (N - 1) * cell); g.stroke();
    }
    g.fillStyle = '#1d140c';
    for (const a of [3, 8, 13]) for (const b of [3, 8, 13]) { g.beginPath(); g.arc(off + a * cell, off + b * cell, 6, 0, TAU); g.fill(); }
  });
  const face17 = topPlane(group, W, W, TOP + 0.1205, map);
  // The playing face: a 9 x 9 grid on the same block, shown only while a game is on.
  const map9 = tex(px, px, (g) => {
    woodGrain(g, px, px, '#d2a565', '#7a5226');
    const c9 = px * GO9_S / W, o9 = px * 0.04 / W;
    g.strokeStyle = '#1d140c'; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      g.beginPath(); g.moveTo(o9, o9 + i * c9); g.lineTo(o9 + 8 * c9, o9 + i * c9); g.stroke();
      g.beginPath(); g.moveTo(o9 + i * c9, o9); g.lineTo(o9 + i * c9, o9 + 8 * c9); g.stroke();
    }
    g.fillStyle = '#1d140c';
    for (const [a, b] of [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]]) { g.beginPath(); g.arc(o9 + a * c9, o9 + b * c9, 8, 0, TAU); g.fill(); }
  });
  const face9 = topPlane(group, W, W, TOP + 0.1206, map9); face9.visible = false;
  const display = [];
  group.userData.go = { face17, face9, display };
  const stoneGeo = new THREE.SphereGeometry(0.0185, 18, 10);
  const black = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.32 });
  const white = new THREE.MeshStandardMaterial({ color: 0xefe9dc, roughness: 0.28 });
  const R = seeded(548), board = new Map();
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= N || y >= N || board.has(x + ',' + y)) return false;
    board.set(x + ',' + y, c);
    const s = new THREE.Mesh(stoneGeo, c ? white : black); s.scale.y = 0.42;
    s.position.set((x - (N - 1) / 2) * S + (R() - 0.5) * 0.004, TOP + 0.128, (y - (N - 1) / 2) * S + (R() - 0.5) * 0.004);
    group.add(s); display.push(s); return true;
  };
  [[3, 3, 0], [13, 13, 1], [13, 3, 0], [3, 13, 1], [8, 8, 0]].forEach(([x, y, c]) => put(x, y, c));
  const steps = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [2, 0], [0, 2], [1, -1], [-2, 1]];
  let color = 1, guard = 0;
  while (board.size < 62 && guard++ < 2000) {
    const mine = [...board].filter(([, c]) => c === color);
    const [k] = mine[(R() * mine.length) | 0];
    const [x, y] = k.split(',').map(Number);
    const [dx, dy] = steps[(R() * steps.length) | 0];
    if (put(x + dx, y + dy, color)) color = 1 - color;
  }
  const bowlGeo = new THREE.LatheGeometry([[0, 0], [0.05, 0.004], [0.072, 0.03], [0.07, 0.07], [0.06, 0.085], [0, 0.085]].map(([a, b]) => new THREE.Vector2(a, b)), 28);
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(bowlGeo, bowlMat); b.position.set(s * (W / 2 + 0.14), TOP, s * 0.2); group.add(b);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.066, 0.012, 28), bowlMat); lid.position.set(s * (W / 2 + 0.14), TOP + 0.006, s * 0.2 - s * 0.17); lid.rotation.x = 0.08; group.add(lid);
  }
  return TOP + 0.1206;
}

