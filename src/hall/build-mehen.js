/* --- Mehen */
function buildMehen(group) {
  const lime = new THREE.MeshStandardMaterial({ color: 0xcfbf9c, roughness: 0.85 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.05, 64), lime); disc.position.y = TOP + 0.025; group.add(disc);
  const segMat = new THREE.MeshStandardMaterial({ color: 0xb59f74, roughness: 0.8 });
  const segMat2 = new THREE.MeshStandardMaterial({ color: 0x8f7a54, roughness: 0.8 });
  let th = 2.2, i = 0;
  while (true) {
    const r = 0.055 + 0.052 * (th / TAU);
    if (r > 0.47) break;
    const step = 0.045 / r;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.022, 0.034), i % 2 ? segMat : segMat2);
    seg.position.set(Math.cos(th) * r, TOP + 0.06, Math.sin(th) * r);
    seg.rotation.y = -th; group.add(seg);
    th += step; i++;
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), segMat2); head.scale.set(1.3, 0.5, 0.85); head.position.set(0, TOP + 0.07, 0); group.add(head);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), eyeM); e.position.set(0.035, TOP + 0.085, s * 0.022); group.add(e); }
  const lionMat = new THREE.MeshStandardMaterial({ color: 0xcaa25a, roughness: 0.5, metalness: 0.15 });
  const lionMat2 = new THREE.MeshStandardMaterial({ color: 0x6e7f8e, roughness: 0.5 });
  [[0.66, 0.26, lionMat], [0.74, 0.02, lionMat2], [0.66, -0.22, lionMat]].forEach(([x, z, m], k) => {
    const L = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), m); body.scale.set(1.5, 0.75, 0.75); body.position.y = 0.022; L.add(body);
    const mane = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), m); mane.position.set(0.042, 0.04, 0); L.add(mane);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), m); snout.position.set(0.062, 0.036, 0); L.add(snout);
    L.position.set(x, TOP, z); L.rotation.y = rand(-0.6, 0.6) + Math.PI / 2 * (k % 2 ? 1 : -1);
    group.add(L);
  });
  const marbleMats = [0xe9e2d0, 0x3b2a20, 0xb8432e].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 }));
  for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), marbleMats[k % 3]);
    m.position.set(-0.7 + (k % 3) * 0.05, TOP + 0.016, 0.35 + Math.floor(k / 3) * 0.06); group.add(m);
  }
}

