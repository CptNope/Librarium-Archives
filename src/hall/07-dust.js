/* ---------------------------------------------------------------- dust */
let dust;
function buildDust() {
  const n = coarse ? 320 : 700, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = rand(-4.5, 4.5); pos[i * 3 + 1] = rand(0.2, 4.6); pos[i * 3 + 2] = rand(HALL.zFar, HALL.zNear); }
  const seed = new Float32Array(n); for (let i = 0; i < n; i++) seed[i] = i;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  // The motes drift in the vertex shader, from a time uniform: nothing is moved or re-uploaded on the CPU each frame.
  const mat = new THREE.PointsMaterial({ map: glowTex, size: 0.035, color: 0xffd8a0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const uTime = { value: 0 };
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\nattribute float seed;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ntransformed.x += sin(uTime * 0.15 + seed) * 0.25;\ntransformed.y += sin(uTime * 0.1 + seed * 1.7) * 0.3;');
  };
  dust = new THREE.Points(geo, mat);
  dust.userData.time = uTime;
  dust.frustumCulled = false; // the drift happens on the GPU, past the CPU's bounding sphere; the motes fill the hall anyway
  scene.add(dust);
}

