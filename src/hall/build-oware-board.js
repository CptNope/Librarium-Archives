/* --- Oware board: two rows of six pits and a store at each end */
const OW_DX = 0.145;
function owPit(i) { const near = i < 6, col = near ? i : 11 - i; return { x: (col - 2.5) * OW_DX, z: near ? 0.078 : -0.078 }; }
function owStore(pl) { return { x: pl === 0 ? 0.5 : -0.5, z: 0 }; }
function buildOwareBoard(group) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x3b2110, roughness: 0.6 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.075, 0.36), wood); block.position.y = TOP + 0.05; group.add(block);
  topPlane(group, 1.16, 0.36, TOP + 0.0876, tex(1024, 320, (g, w, h) => woodGrain(g, w, h, '#4a2a14', '#120803')), { roughness: 0.6 });
  for (const s of [-1, 1]) { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.3), wood); foot.position.set(s * 0.42, TOP + 0.01, 0); group.add(foot); }
  const y = TOP + 0.089;
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x5e3619, roughness: 0.5 });
  const rimGeo = new THREE.TorusGeometry(0.058, 0.007, 8, 32);
  const pits = [];
  for (let i = 0; i < 12; i++) {
    const p = owPit(i);
    const mat = new THREE.MeshStandardMaterial({ color: 0x140a04, roughness: 0.85 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.004, 28), mat);
    disc.position.set(p.x, y, p.z); disc.userData.mats = [mat]; group.add(disc); pits.push(disc);
    const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.x = -Math.PI / 2; rim.position.set(p.x, y + 0.002, p.z); group.add(rim);
  }
  for (const pl of [0, 1]) {
    const p = owStore(pl);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.004, 28), new THREE.MeshStandardMaterial({ color: 0x140a04, roughness: 0.85 }));
    st.scale.z = 1.9; st.position.set(p.x, y, p.z); group.add(st);
  }
  group.userData.pits = pits;
  return y + 0.003;
}
const seedGeo = new THREE.SphereGeometry(0.0105, 10, 8);

