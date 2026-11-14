/* --- Wing IV: Whist, four hands round a baize card table */
// Seats clockwise from you: 0 South (near), 1 West (left), 2 North (far), 3 East (right).
const WS_YAW = [0, -Math.PI / 2, Math.PI, Math.PI / 2];
function wsHandSpot(seat, i, n, y) {
  if (seat === 0) return V3((i - (n - 1) / 2) * 0.058, y + i * 0.0004, 0.36);
  const t = (i - (n - 1) / 2) * 0.036;
  if (seat === 2) return V3(-t, y + i * 0.0004, -0.36);
  return seat === 1 ? V3(-0.44, y + i * 0.0004, t) : V3(0.44, y + i * 0.0004, -t);
}
function wsTrickSpot(seat, y) { return [V3(0, y, 0.1), V3(-0.1, y, 0), V3(0, y, -0.1), V3(0.1, y, 0)][seat]; }
function buildWhist(group) {
  const W = 1.1, D = 0.96;
  const table = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, D), new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.5 }));
  table.position.y = TOP + 0.015; group.add(table);
  topPlane(group, W - 0.06, D - 0.06, TOP + 0.0305, tex(512, 448, (g, w, h) => {
    g.fillStyle = '#1d4a2a'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, ['#163d22', '#245834', '#12351d'], 1.2);
    g.strokeStyle = 'rgba(220,200,140,.35)'; g.lineWidth = 3; g.strokeRect(14, 14, w - 28, h - 28);
  }), { roughness: 0.95 });
  const y = TOP + 0.031, shown = [];
  // Display: four hands dealt face down, and a trick of four cards in the middle.
  for (let s = 0; s < 4; s++) for (let i = 0; i < 12; i++) {
    const m = crCard(s * 13 + i), at = wsHandSpot(s, i, 12, y + 0.001);
    m.position.copy(at); m.rotation.set(0, WS_YAW[s], Math.PI); group.add(m); shown.push(m);
  }
  [26 + 12, 26 + 0, 26 + 10, 13 + 4].forEach((c, s) => { const m = crCard(c); m.position.copy(wsTrickSpot(s, y + 0.001 + s * 0.0004)); m.rotation.set(0, WS_YAW[s] + (s - 1.5) * 0.12, 0); group.add(m); shown.push(m); });
  group.userData.display = shown;
  return y;
}

