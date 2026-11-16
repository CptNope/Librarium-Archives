/* ---------------------------------------------------------------- dust */
let dust;
function buildDust() {
  const n = coarse ? 320 : 700, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = rand(-4.5, 4.5); pos[i * 3 + 1] = rand(0.2, 4.6); pos[i * 3 + 2] = rand(HALL.zFar, HALL.zNear); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex, size: 0.035, color: 0xffd8a0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.userData.base = pos.slice();
  scene.add(dust);
}

