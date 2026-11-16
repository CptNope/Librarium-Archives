/* --- Wing IV: Fox and Geese, a pegged cross board */
const FG_S = 0.118;
function fgCell(i) { const r = (i / 7) | 0, c = i % 7; return { x: (c - 3) * FG_S, z: (r - 3) * FG_S }; }
const fgOnBoard = (r, c) => r >= 0 && r < 7 && c >= 0 && c < 7 && ((r >= 2 && r <= 4) || (c >= 2 && c <= 4));
function buildFoxGeeseBoard(group) {
  const arm = 3 * FG_S + 0.07, len = 7 * FG_S + 0.05;
  const oak = new THREE.MeshStandardMaterial({ color: 0x6a4424, roughness: 0.6 });
  for (const [w, d] of [[len, arm], [arm, len]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), oak); b.position.y = TOP + 0.025; group.add(b);
  }
  const px = 1024, W = len, sc = px / W, c0 = px / 2;
  const map = tex(px, px, (g) => {
    g.fillStyle = '#0000'; g.clearRect(0, 0, px, px);
    // Only the cross is drawn; the corners stay transparent over the plinth.
    g.save(); g.beginPath();
    const a = arm / 2 * sc, l = len / 2 * sc;
    g.rect(c0 - l, c0 - a, 2 * l, 2 * a); g.rect(c0 - a, c0 - l, 2 * a, 2 * l); g.clip();
    woodGrain(g, px, px, '#7a5030', '#2a1508');
    g.strokeStyle = '#e8d6ac'; g.lineWidth = 6; g.lineCap = 'round';
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      if (!fgOnBoard(r, c)) continue;
      const x = c0 + (c - 3) * FG_S * sc, y = c0 + (r - 3) * FG_S * sc;
      if (fgOnBoard(r, c + 1)) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + FG_S * sc, y); g.stroke(); }
      if (fgOnBoard(r + 1, c)) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + FG_S * sc); g.stroke(); }
    }
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      if (!fgOnBoard(r, c)) continue;
      const x = c0 + (c - 3) * FG_S * sc, y = c0 + (r - 3) * FG_S * sc;
      g.fillStyle = '#e8d6ac'; g.beginPath(); g.arc(x, y, 15, 0, TAU); g.fill();
      g.fillStyle = '#2a1508'; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill();
    }
    g.restore();
  });
  topPlane(group, W, W, TOP + 0.0505, map, { roughness: 0.55, transparent: true });
  return TOP + 0.051;
}
function foxPiece() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0xb4521e, roughness: 0.55 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), fur); body.scale.set(1.25, 0.85, 0.9); body.position.y = 0.03; g.add(body);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 12), fur); head.rotation.z = -Math.PI / 2; head.position.set(0.045, 0.045, 0); g.add(head);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.022, 8), fur); ear.position.set(0.03, 0.068, s * 0.01); g.add(ear); }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), fur); tail.scale.set(1.8, 0.8, 0.8); tail.position.set(-0.045, 0.035, 0); g.add(tail);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), white); tip.position.set(-0.07, 0.038, 0); g.add(tip);
  g.userData.mats = [fur];
  return g;
}
function goosePiece() {
  const g = new THREE.Group();
  const feather = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.45 });
  const beak = new THREE.MeshStandardMaterial({ color: 0xe08a1e, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), feather); body.scale.set(1.3, 0.85, 0.9); body.position.y = 0.026; g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.038, 8), feather); neck.position.set(0.024, 0.05, 0); neck.rotation.z = -0.35; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), feather); head.position.set(0.032, 0.07, 0); g.add(head);
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.016, 8), beak); bill.rotation.z = -Math.PI / 2; bill.position.set(0.046, 0.069, 0); g.add(bill);
  g.userData.mats = [feather];
  return g;
}

