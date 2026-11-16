/* --- Wing II: shared helpers */
function seeded(seed) { // mulberry32, so display boards look the same on every visit
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function topPlane(group, w, d, y, map, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial(Object.assign({ map, roughness: 0.6 }, opts)));
  m.rotation.x = -Math.PI / 2; m.position.y = y; group.add(m); return m;
}
function woodGrain(g, w, h, base, line) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = line; g.globalAlpha = rand(0.04, 0.14); g.lineWidth = rand(1, 3);
    const y = rand(0, h); g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += w / 8) g.lineTo(x, y + Math.sin(x / w * 6 + i) * rand(2, 9));
    g.stroke();
  }
  g.globalAlpha = 1;
}

