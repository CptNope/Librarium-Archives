/* --- Wing III: the Lewis chessmen (simplified figures, not copies) */
// Simplified Lewis-style figures (our own carving, not copies), each built round its base at y = 0.
const LW_S = 0.088;
const lwSeated = (m, opts) => {
  const g = new THREE.Group();
  const throne = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.06), m); throne.position.y = 0.04; g.add(throne);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.012), m); back.position.set(0, 0.11, -0.026); g.add(back);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.07, 14), m); body.position.set(0, 0.115, 0.004); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.019, 14, 12), m); head.scale.y = 1.15; head.position.set(0, 0.168, 0.006); g.add(head);
  if (opts.crown) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.012, 14, 1, true), m); c.position.set(0, 0.188, 0.006); g.add(c); }
  if (opts.mitre) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.03, 4), m); c.position.set(0, 0.198, 0.006); c.rotation.y = Math.PI / 4; g.add(c); }
  if (opts.sword) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.004, 0.07), m); s.position.set(0, 0.09, 0.04); s.rotation.y = 0.9; g.add(s); }
  if (opts.cheek) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 8), m); a.position.set(0.016, 0.145, 0.022); a.rotation.x = -0.6; g.add(a); }
  if (opts.crozier) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.17, 6), m); c.position.set(0.03, 0.1, 0.03); g.add(c); const t = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.003, 6, 12, Math.PI * 1.5), m); t.position.set(0.03, 0.19, 0.03); g.add(t); }
  return g;
};
const lwWarder = (m, biting) => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.12, 14), m); body.position.y = 0.06; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 12), m); head.position.y = biting ? 0.128 : 0.135; g.add(head);
  const helm = new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.024, 14), m); helm.position.y = 0.155; g.add(helm);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.008, 3), m); shield.rotation.x = Math.PI / 2; shield.rotation.z = Math.PI; shield.position.set(0, biting ? 0.1 : 0.075, 0.026); g.add(shield);
  return g;
};
const lwKnight = m => {
  const g = new THREE.Group();
  const horse = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.03), m); horse.position.y = 0.05; g.add(horse);
  for (const [x, z] of [[-0.026, -0.01], [-0.026, 0.01], [0.026, -0.01], [0.026, 0.01]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.034, 6), m); l.position.set(x, 0.017, z); g.add(l); }
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.04, 0.018), m); neck.position.set(0.04, 0.075, 0); neck.rotation.z = -0.3; g.add(neck);
  const rider = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.06, 12), m); rider.position.set(-0.004, 0.098, 0); g.add(rider);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), m); head.position.set(-0.004, 0.137, 0); g.add(head);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.006, 3), m); shield.rotation.x = Math.PI / 2; shield.position.set(-0.004, 0.09, -0.024); g.add(shield);
  const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.13, 6), m); spear.position.set(0.012, 0.13, 0.018); g.add(spear);
  return g;
};
const lwPawn = m => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.06, 8), m); p.position.y = 0.03; const g = new THREE.Group(); g.add(p); return g; };
function buildLewis(group) {
  const velvet = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 0.78), new THREE.MeshLambertMaterial({ color: 0x1d2a3a }));
  velvet.position.y = TOP + 0.02; group.add(velvet);
  const ivory = new THREE.MeshStandardMaterial({ color: 0xe6d9bd, roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0x9a4b3a, roughness: 0.55 });
  const y0 = TOP + 0.04;
  const set = [
    [lwSeated(ivory, { crown: true, sword: true }), -0.45, -0.14], [lwSeated(red, { crown: true, cheek: true }), -0.3, -0.16],
    [lwSeated(ivory, { mitre: true, crozier: true }), -0.14, -0.15], [lwKnight(ivory), 0.03, -0.16],
    [lwWarder(ivory, true), 0.2, -0.15], [lwWarder(red, false), 0.33, -0.15], [lwSeated(red, { crown: true, sword: true }), 0.48, -0.15],
    [lwPawn(ivory), -0.36, 0.17], [lwPawn(red), -0.24, 0.18], [lwPawn(ivory), -0.12, 0.17],
  ];
  for (const [o, x, z] of set) { o.position.set(x, y0, z); o.rotation.y = rand(-0.2, 0.2); group.add(o); }
  for (let k = 0; k < 6; k++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 20), ivory); d.position.set(0.12 + (k % 3) * 0.055, y0 + 0.006 + Math.floor(k / 3) * 0.012, 0.18); group.add(d); }
  glassCase(group, 1.3, 0.48, 0.85);
  // Everything but the velvet is the display; a checkered board waits, hidden, for a game.
  group.userData.display = group.children.slice(group.children.indexOf(velvet) + 1);
  const S = LW_S, W = 8 * S + 0.05;
  const board = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, W), new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.6 }));
  slab.position.y = y0 + 0.01; board.add(slab);
  topPlane(board, W, W, y0 + 0.0205, tex(512, 512, (g, w) => {
    const d = w * S / W, o = (w - 8 * d) / 2;
    g.fillStyle = '#4a3020'; g.fillRect(0, 0, w, w);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { g.fillStyle = (r + c) % 2 ? '#e3d3b0' : '#6e4a2c'; g.fillRect(o + c * d, o + r * d, d, d); }
    speckle(g, w, w, 2500, ['#3a2414', '#f2e6cc'], 1.1);
  }), { roughness: 0.6 });
  board.visible = false; group.add(board);
  group.userData.board = board;
  return y0 + 0.021;
}
function glassCase(group, w, h, d) {
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x9fc4c8, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.2, depthWrite: false }));
  glass.position.y = TOP + h / 2 + 0.02; group.add(glass);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: 0xb98a30 }));
  edges.position.copy(glass.position); group.add(edges);
}

