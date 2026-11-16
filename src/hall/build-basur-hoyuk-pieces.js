/* --- Başur Höyük pieces */
function buildTokens(group) {
  const velvet = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.75), new THREE.MeshLambertMaterial({ color: 0x2b0f0c }));
  velvet.position.y = TOP + 0.02; group.add(velvet);
  const colors = [0xb14a32, 0xe3d8c2, 0x2a2622, 0x6b7a5a, 0xc88f3c];
  const mats = colors.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }));
  const items = [];
  for (let i = 0; i < 7; i++) items.push(['pyr', i]);
  for (let i = 0; i < 6; i++) items.push(['disc', i]);
  for (let i = 0; i < 4; i++) items.push(['ball', i]);
  for (let i = 0; i < 4; i++) items.push(['pig', i]);
  for (let i = 0; i < 3; i++) items.push(['dog', i]);
  items.forEach(([k, i], n) => {
    const m = mats[(n * 7 + i) % mats.length];
    let o;
    if (k === 'pyr') { o = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), m); o.position.y = 0.03; o.rotation.y = rand(0, 1); }
    else if (k === 'disc') { o = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.016, 18), m); o.position.y = 0.008; }
    else if (k === 'ball') { o = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), m); o.position.y = 0.02; }
    else {
      o = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), m); b.scale.set(1.5, 0.9, 0.9); b.position.y = 0.02; o.add(b);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), m); h.position.set(0.034, 0.026, 0); o.add(h);
      if (k === 'dog') { const e = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.02, 6), m); e.position.set(0.034, 0.045, 0); o.add(e); }
      o.rotation.y = rand(0, TAU);
    }
    const col = n % 6, row = Math.floor(n / 6);
    const holder = new THREE.Group(); holder.add(o);
    holder.position.set(-0.45 + col * 0.18 + rand(-0.03, 0.03), TOP + 0.04, -0.22 + row * 0.15 + rand(-0.02, 0.02));
    group.add(holder);
  });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 0.85), new THREE.MeshStandardMaterial({ color: 0x9fc4c8, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.2, depthWrite: false }));
  glass.position.y = TOP + 0.25; group.add(glass);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: 0xb98a30 }));
  edges.position.copy(glass.position); group.add(edges);
}

