/* --- Hounds and Jackals */
// A hound or jackal pin: s < 0 the gold hounds (the visitor's), s > 0 the dark jackals.
const hjMats = { '-1': new THREE.MeshStandardMaterial({ color: 0xcaa24e, metalness: 0.5, roughness: 0.35 }), '1': new THREE.MeshStandardMaterial({ color: 0x2b211a, roughness: 0.45 }) };
function hjPin(s) {
  const m = hjMats[s].clone(), pin = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.12, 8), m); stick.position.y = 0.06; pin.add(stick);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), m); head.scale.set(1.5, 0.9, 0.9); head.position.set(0.006, 0.124, 0); pin.add(head);
  if (s < 0) { for (const e of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), m); ear.scale.set(0.6, 1.4, 0.6); ear.position.set(-0.004, 0.132, e * 0.008); pin.add(ear); } }
  else { for (const e of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.005, 0.026, 6), m); ear.position.set(-0.004, 0.145, e * 0.006); pin.add(ear); } }
  pin.rotation.y = s < 0 ? 0 : Math.PI; pin.userData.mats = [m];
  return pin;
}
function buildHounds(group) {
  const ivory = new THREE.MeshStandardMaterial({ color: 0xe0d0aa, roughness: 0.55 });
  const ebony = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.5 });
  const W = 0.44, H = 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, 0); shape.lineTo(W / 2, 0); shape.lineTo(W / 2, H); shape.absarc(0, H, W / 2, 0, Math.PI, false); shape.lineTo(-W / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 });
  const board = new THREE.Mesh(geo, ivory);
  board.rotation.x = -Math.PI / 2; board.position.set(0, TOP, (H + W / 2) / 2); group.add(board);
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.03, 0.06), ebony); base.position.set(0, TOP + 0.015, (H + W / 2) / 2 + 0.01); group.add(base);
  const topY = TOP + 0.079;
  const hz = z => (H + W / 2) / 2 - z; // board-local y → group z
  const holeGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.004, 10);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x1a120c });
  const holes = { '-1': [], '1': [] };
  for (const s of [-1, 1]) {
    const track = [];
    for (let i = 0; i < 18; i++) track.push([s * (W / 2 - 0.035), 0.04 + i * (H - 0.04) / 17]);
    for (let i = 1; i <= 11; i++) { const a = Math.PI / 2 - s * (Math.PI / 2) * (1 - i / 12); track.push([Math.cos(a) * (W / 2 - 0.035), H + Math.sin(a) * (W / 2 - 0.035)]); }
    track.forEach(([x, y], i) => {
      const h = new THREE.Mesh(i === 28 ? new THREE.CylinderGeometry(0.013, 0.013, 0.004, 14) : holeGeo, holeMat);
      h.position.set(x, topY, hz(y)); group.add(h); holes[s].push(V3(x, topY, hz(y)));
    });
    // The lines joining holes 6 and 20, and 8 and 10, and the "good" signs by holes 15 and 25.
    for (const [a, b] of [[5, 19], [7, 9]]) {
      const p = holes[s][a], q = holes[s][b], mid = p.clone().add(q).multiplyScalar(0.5), len = p.distanceTo(q);
      const bow = V3(-s * (a === 5 ? 0.07 : 0.03), 0, 0);
      const curve = new THREE.QuadraticBezierCurve3(p.clone().setY(topY + 0.001), mid.clone().add(bow).setY(topY + 0.001), q.clone().setY(topY + 0.001));
      const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0025, 6, false), holeMat); group.add(line); void len;
    }
    for (const k of [14, 24]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0025, 6, 18), new THREE.MeshStandardMaterial({ color: 0xc9962e, metalness: 0.4, roughness: 0.4 })); ring.rotation.x = -Math.PI / 2; ring.position.copy(holes[s][k]).add(V3(-s * 0.024, 0.001, 0)); group.add(ring); }
  }
  group.userData.holes = holes;
  const palmM = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.6 });
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.004, 0.36), palmM); trunk.position.set(0, topY, hz(0.26)); group.add(trunk);
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k - 3) * 0.42;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6), new THREE.MeshStandardMaterial({ color: 0x3d5a32, roughness: 0.6 }));
    leaf.scale.set(1, 0.06, 0.28); leaf.rotation.y = -a; leaf.position.set(Math.cos(a) * 0.05, topY, hz(0.46) + Math.sin(a) * 0.05); group.add(leaf);
  }
  const shown = [];
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) { const pin = hjPin(s); pin.position.copy(holes[s][k * 2 + 1]); group.add(pin); shown.push(pin); }
  group.userData.display = shown;
  return topY;
}

