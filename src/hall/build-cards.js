/* --- Wing III: cards. Every face here is an original design in an old style. */
function cardTex(draw, w = 200, h = 320) {
  return tex(w, h, (g) => { draw(g, w, h); });
}
function suitMark(g, suit, x, y, s, col) {
  g.save(); g.translate(x, y); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.12;
  if (suit === 'coin') { g.beginPath(); g.arc(0, 0, s * 0.5, 0, TAU); g.fill(); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(0, 0, s * 0.22, 0, TAU); g.fill(); }
  else if (suit === 'cup') { g.beginPath(); g.moveTo(-s * 0.4, -s * 0.4); g.quadraticCurveTo(0, s * 0.35, s * 0.4, -s * 0.4); g.closePath(); g.fill(); g.fillRect(-s * 0.06, -s * 0.05, s * 0.12, s * 0.4); g.fillRect(-s * 0.25, s * 0.35, s * 0.5, s * 0.1); }
  else if (suit === 'sword') { g.beginPath(); g.moveTo(-s * 0.55, s * 0.55); g.lineTo(s * 0.5, -s * 0.5); g.stroke(); g.beginPath(); g.moveTo(-s * 0.45, s * 0.2); g.lineTo(-s * 0.2, s * 0.45); g.stroke(); }
  else { g.beginPath(); g.moveTo(-s * 0.5, s * 0.5); g.lineTo(s * 0.45, -s * 0.45); g.stroke(); g.beginPath(); g.arc(s * 0.45, -s * 0.45, s * 0.12, 0, TAU); g.fill(); }
  g.restore();
}
function buildCards(group) {
  const velvet = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 0.78), new THREE.MeshLambertMaterial({ color: 0x2a0f0c }));
  velvet.position.y = TOP + 0.02; group.add(velvet);
  const y0 = TOP + 0.042;
  const card = (map, w, h, x, z, rot, back) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.002, h), [back, back, new THREE.MeshStandardMaterial({ map, roughness: 0.6 }), back, back, back]);
    m.position.set(x, y0 + Math.random() * 0.002, z); m.rotation.y = rot; group.add(m); return m;
  };
  const backMat = new THREE.MeshStandardMaterial({ color: 0x5a2a1a, roughness: 0.7 });
  // Mamluk-style: tall, gold and blue, ornament instead of figures.
  ['coin', 'cup', 'sword', 'stick'].forEach((suit, k) => {
    const map = cardTex((g, w, h) => {
      g.fillStyle = '#1d3a6e'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d9b04a'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
      g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
      for (let i = 0; i < 3; i++) suitMark(g, suit, w / 2, 80 + i * 80, 52, '#e2bd5a');
      g.strokeStyle = 'rgba(226,189,90,.5)'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(w / 2, h / 2, 30 + i * 18, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
    }, 180, 420);
    card(map, 0.085, 0.2, -0.47 + k * 0.1, -0.12, -0.15 + k * 0.1, backMat);
  });
  // A Chinese-style narrow money card.
  [3, 7].forEach((n, k) => {
    const map = cardTex((g, w, h) => {
      g.fillStyle = '#efe3c5'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
      for (let i = 0; i < n; i++) { const y = 40 + i * ((h - 80) / Math.max(1, n - 1)); g.strokeStyle = '#7a2a1c'; g.lineWidth = 5; g.beginPath(); g.arc(w / 2, y, 16, 0, TAU); g.stroke(); g.strokeRect(w / 2 - 5, y - 5, 10, 10); }
    }, 120, 420);
    card(map, 0.05, 0.17, 0.0 + k * 0.065, -0.14, 0.05 - k * 0.12, backMat);
  });
  // Early European Latin-suited pip cards.
  [['coin', 3], ['cup', 4], ['sword', 2], ['stick', 5], ['coin', 6]].forEach(([suit, n], k) => {
    const map = cardTex((g, w, h) => {
      g.fillStyle = '#f2e8cf'; g.fillRect(0, 0, w, h); speckle(g, w, h, 300, ['#c9b68e'], 1.2);
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16);
      const col = { coin: '#c48a1e', cup: '#a3301e', sword: '#2a4a7a', stick: '#3a6a2a' }[suit];
      for (let i = 0; i < n; i++) { const cols = n > 3 ? 2 : 1, cx = cols === 2 ? w / 2 + (i % 2 ? 40 : -40) : w / 2, rows = Math.ceil(n / cols), ry = Math.floor(i / cols); suitMark(g, suit, cx, (h / (rows + 1)) * (ry + 1), 54, col); }
    }, 200, 320);
    card(map, 0.11, 0.17, 0.2 + k * 0.075, 0.12, -0.25 + k * 0.12, backMat);
  });
  glassCase(group, 1.3, 0.3, 0.85);
  group.userData.display = group.children.slice(group.children.indexOf(velvet) + 1); // a game of piquet clears the velvet
  return y0;
}
function buildTarot(group) {
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.6), new THREE.MeshLambertMaterial({ color: 0x1d2a1a }));
  stand.position.y = TOP + 0.02; group.add(stand);
  const before = group.children.length;
  const easel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 0.02), MAT.woodDark); easel.position.set(0, TOP + 0.13, -0.1); easel.rotation.x = -0.25; group.add(easel);
  const designs = [
    (g, w, h) => { g.fillStyle = '#c0392b'; g.beginPath(); g.arc(w / 2, h * 0.38, 46, 0, TAU); g.fill(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.strokeStyle = '#c0392b'; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 56, h * 0.38 + Math.sin(a) * 56); g.lineTo(w / 2 + Math.cos(a) * 80, h * 0.38 + Math.sin(a) * 80); g.stroke(); } },
    (g, w, h) => { g.fillStyle = '#e8e2d0'; g.beginPath(); g.arc(w / 2, h * 0.38, 52, 0, TAU); g.fill(); g.fillStyle = '#d9b04a'; g.beginPath(); g.arc(w / 2 + 22, h * 0.36, 50, 0, TAU); g.fill(); },
    (g, w, h) => { g.fillStyle = '#2a5aa0'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU - Math.PI / 2, r = i % 2 ? 22 : 58; g.lineTo(w / 2 + Math.cos(a) * r, h * 0.38 + Math.sin(a) * r); } g.closePath(); g.fill(); },
    (g, w, h) => { g.strokeStyle = '#6a3a1a'; g.lineWidth = 9; g.beginPath(); g.arc(w / 2, h * 0.4, 62, 0, TAU); g.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(w / 2, h * 0.4); g.lineTo(w / 2 + Math.cos(a) * 62, h * 0.4 + Math.sin(a) * 62); g.stroke(); } },
    (g, w, h) => { g.fillStyle = '#7a6a5a'; g.fillRect(w / 2 - 34, h * 0.22, 68, 150); for (let i = 0; i < 4; i++) g.fillRect(w / 2 - 34 + i * 20, h * 0.18, 12, 20); g.fillStyle = '#e8a33a'; g.beginPath(); g.moveTo(w / 2 + 20, h * 0.1); g.lineTo(w / 2 + 6, h * 0.2); g.lineTo(w / 2 + 18, h * 0.2); g.lineTo(w / 2 + 2, h * 0.3); g.lineTo(w / 2 + 34, h * 0.16); g.lineTo(w / 2 + 22, h * 0.16); g.closePath(); g.fill(); },
    (g, w, h) => { g.fillStyle = '#3a6a2a'; g.beginPath(); g.arc(w / 2, h * 0.26, 18, 0, TAU); g.fill(); g.fillRect(w / 2 - 16, h * 0.31, 32, 90); g.strokeStyle = '#3a6a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2 + 16, h * 0.36); g.lineTo(w / 2 + 52, h * 0.24); g.stroke(); g.fillStyle = '#c48a1e'; g.beginPath(); g.arc(w / 2 + 56, h * 0.22, 12, 0, TAU); g.fill(); },
  ];
  designs.forEach((draw, k) => {
    const map = cardTex((g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e9c766'); gr.addColorStop(0.5, '#c79a34'); gr.addColorStop(1, '#e2bb5a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(120,80,20,.35)';
      for (let x = 14; x < w; x += 14) for (let y = 14; y < h; y += 14) { g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); }
      g.strokeStyle = '#6a4a14'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
      draw(g, w, h);
      g.fillStyle = 'rgba(90,60,20,.5)'; g.fillRect(24, h * 0.78, w - 48, 6);
    }, 200, 400);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.003), [MAT.woodDark, MAT.woodDark, MAT.woodDark, MAT.woodDark, new THREE.MeshStandardMaterial({ map, roughness: 0.35, metalness: 0.35 }), MAT.woodDark]);
    m.position.set(-0.45 + k * 0.18, TOP + 0.16, -0.08); m.rotation.x = -0.25; m.rotation.z = rand(-0.03, 0.03); group.add(m);
  });
  glassCase(group, 1.25, 0.42, 0.7);
  // The easel and its case are put away while a game of tarocchi is played on the stand.
  group.userData.display = group.children.slice(before);
  const baize = topPlane(group, 1.16, 0.56, TOP + 0.0405, tex(256, 128, (g, w, h) => {
    g.fillStyle = '#1f3a24'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${rand(0.03, 0.1)})`; g.fillRect(rand(0, w), rand(0, h), 1, 1); }
  }), { roughness: 0.95 });
  baize.visible = false; group.userData.baize = baize;
  return TOP + 0.041;
}
