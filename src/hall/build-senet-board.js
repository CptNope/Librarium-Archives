/* --- Senet board */
const SE_S = 0.132;
function seCell(n) { const row = Math.floor((n - 1) / 10), idx = (n - 1) % 10; const col = row === 1 ? 9 - idx : idx; return { x: (col - 4.5) * SE_S, z: (row - 1) * SE_S }; }
function senetSquareTex(n) {
  return tex(160, 160, (g, w) => {
    g.fillStyle = '#e4d3ac'; g.fillRect(0, 0, w, w);
    speckle(g, w, w, 260, ['#b9a57c', '#fff4dc'], 1.2);
    g.strokeStyle = '#2a1a0c'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
    const c = w / 2;
    if (n === 15) { // ankh
      g.beginPath(); g.ellipse(c, 52, 17, 24, 0, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(c, 76); g.lineTo(c, 128); g.moveTo(c - 30, 84); g.lineTo(c + 30, 84); g.stroke();
    } else if (n === 26) { // nefer: good, beautiful
      g.beginPath(); g.arc(c, 106, 24, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(c, 82); g.lineTo(c, 26); g.moveTo(c - 14, 40); g.lineTo(c + 14, 40); g.moveTo(c - 10, 54); g.lineTo(c + 10, 54); g.stroke();
    } else if (n === 27) { // water
      g.strokeStyle = '#1f4c86';
      for (let r = 0; r < 3; r++) { g.beginPath(); for (let i = 0; i <= 8; i++) g.lineTo(26 + i * 13.5, 52 + r * 30 + (i % 2 ? -9 : 9)); g.stroke(); }
    } else if (n >= 28 && n <= 30) {
      const k = 31 - n;
      for (let i = 0; i < k; i++) { const x = c + (i - (k - 1) / 2) * 30; g.beginPath(); g.moveTo(x, 52); g.lineTo(x, 118); g.stroke(); }
      if (n === 30) { g.beginPath(); g.arc(c, 34, 12, 0, TAU); g.stroke(); }
    }
    g.fillStyle = 'rgba(60,40,20,.42)'; g.font = '22px "Montserrat", sans-serif'; g.textAlign = 'left'; g.fillText(String(n), 10, 28);
  });
}
function buildSenetBoard(group) {
  const ebony = new THREE.MeshStandardMaterial({ color: 0x17100b, roughness: 0.45, metalness: 0.05 });
  const w = 10 * SE_S + 0.07, d = 3 * SE_S + 0.07;
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, 0.11, d), ebony); box.position.y = TOP + 0.055; group.add(box);
  const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: 0xd8c6a0, roughness: 0.5 }));
  drawer.position.set(0.42, TOP + 0.055, d / 2 + 0.005); group.add(drawer);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), MAT.brass); knob.position.set(0.42, TOP + 0.055, d / 2 + 0.02); group.add(knob);
  const geo = new THREE.BoxGeometry(SE_S * 0.9, 0.008, SE_S * 0.9);
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xc9b68e });
  for (let n = 1; n <= 30; n++) {
    const { x, z } = seCell(n);
    const t = new THREE.Mesh(geo, [sideMat, sideMat, new THREE.MeshStandardMaterial({ map: senetSquareTex(n), roughness: 0.55 }), sideMat, sideMat, sideMat]);
    t.position.set(x, TOP + 0.112, z); group.add(t);
  }
  return TOP + 0.116;
}
function spoolGeo() { // Tutankhamun-style reel piece
  const pts = [[0, 0], [0.032, 0], [0.034, 0.008], [0.02, 0.018], [0.016, 0.036], [0.02, 0.054], [0.03, 0.062], [0.03, 0.068], [0, 0.068]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 24);
}
function coneGeo() {
  const pts = [[0, 0], [0.032, 0], [0.033, 0.01], [0.022, 0.03], [0.012, 0.062], [0.016, 0.07], [0.008, 0.08], [0, 0.082]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 24);
}

