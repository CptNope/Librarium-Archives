/* --- Brandubh board, after the yew board from Ballinderry */
const BR_S = 0.118;
function brCell(i) { const r = (i / 7) | 0, c = i % 7; return { x: (c - 3) * BR_S, z: (r - 3) * BR_S }; }
function buildBrandubhBoard(group) {
  const W = 0.92;
  const yew = new THREE.MeshStandardMaterial({ color: 0x8a5228, roughness: 0.55 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, W), yew); block.position.y = TOP + 0.025; group.add(block);
  const px = 1024, sc = px / W, c = px / 2;
  const map = tex(px, px, (g) => {
    woodGrain(g, px, px, '#94592b', '#3a1d08');
    // Interlace border
    g.strokeStyle = 'rgba(40,20,6,.75)'; g.lineWidth = 7;
    const inset = 46;
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      for (let x = inset; x <= px - inset; x += 4) g.lineTo(x, inset + Math.sin(x / 26 + k * Math.PI) * 14);
      g.stroke(); g.beginPath();
      for (let x = inset; x <= px - inset; x += 4) g.lineTo(x, px - inset + Math.sin(x / 26 + k * Math.PI) * 14);
      g.stroke(); g.beginPath();
      for (let y = inset; y <= px - inset; y += 4) g.lineTo(inset + Math.sin(y / 26 + k * Math.PI) * 14, y);
      g.stroke(); g.beginPath();
      for (let y = inset; y <= px - inset; y += 4) g.lineTo(px - inset + Math.sin(y / 26 + k * Math.PI) * 14, y);
      g.stroke();
    }
    for (let i = 0; i < 49; i++) {
      const q = brCell(i), x = c + q.x * sc, y = c + q.z * sc;
      g.fillStyle = '#1a0d04'; g.beginPath(); g.arc(x, y, 15, 0, TAU); g.fill();
      if (i === 24 || [0, 6, 42, 48].includes(i)) { g.strokeStyle = 'rgba(30,15,4,.85)'; g.lineWidth = 6; g.beginPath(); g.arc(x, y, 40, 0, TAU); g.stroke(); }
    }
  });
  topPlane(group, W, W, TOP + 0.0505, map, { roughness: 0.5 });
  for (const [x, z] of [[0, -W / 2 - 0.03], [0, W / 2 + 0.03], [-W / 2 - 0.03, 0], [W / 2 + 0.03, 0]]) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), yew); head.scale.set(1, 0.7, 1); head.position.set(x, TOP + 0.025, z); group.add(head);
  }
  return TOP + 0.051;
}
const brPawnGeo = new THREE.LatheGeometry([[0, 0], [0.03, 0], [0.032, 0.008], [0.018, 0.02], [0.014, 0.04], [0.022, 0.05], [0.02, 0.058], [0, 0.064]].map(([a, b]) => new THREE.Vector2(a, b)), 24);
const brKingGeo = new THREE.LatheGeometry([[0, 0], [0.036, 0], [0.038, 0.01], [0.022, 0.026], [0.017, 0.06], [0.028, 0.072], [0.026, 0.084], [0.012, 0.092], [0.016, 0.1], [0, 0.104]].map(([a, b]) => new THREE.Vector2(a, b)), 28);

