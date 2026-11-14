/* --- More tables: Tablut, Makruk, Kalah and Cribbage */
const TB_S = 0.088;
function tbCell(i) { const r = (i / 9) | 0, c = i % 9; return { x: (c - 4) * TB_S, z: (4 - r) * TB_S }; }
function tbPiece(v) {
  const mat = new THREE.MeshStandardMaterial({ color: v === 1 ? 0x2a1d14 : 0xe6d8b6, roughness: 0.4 });
  const m = new THREE.Mesh(v === 3 ? brKingGeo : brPawnGeo, mat); m.scale.setScalar(v === 3 ? 0.8 : 0.78); m.userData.mats = [mat];
  if (v === 1) { // Linnaeus drew the Muscovites notched, not coloured; ours are dark with a notched collar
    const notch = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 6), mat); notch.rotation.x = Math.PI / 2; notch.position.y = 0.05; m.add(notch);
  }
  if (v === 3) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.005, 8, 24), MAT.brass); band.rotation.x = Math.PI / 2; band.position.y = 0.074; m.add(band); }
  return m;
}
function buildTablut(group) {
  const W = 9 * TB_S + 0.06;
  const hide = new THREE.Mesh(new THREE.BoxGeometry(W, 0.012, W), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95 }));
  hide.position.y = TOP + 0.006; group.add(hide);
  const N = 1024, sc = N / W;
  topPlane(group, W, W, TOP + 0.0125, tex(N, N, (g) => {
    // Reindeer hide, with the grid embroidered in thread as Linnaeus saw it.
    g.fillStyle = '#9a7650'; g.fillRect(0, 0, N, N); speckle(g, N, N, 5000, ['#8a6640', '#a8845c', '#7a5634'], 1.6);
    const o = N / 2 - 4.5 * TB_S * sc, step = TB_S * sc;
    g.strokeStyle = '#efe2c4'; g.lineWidth = 3; g.setLineDash([9, 6]);
    for (let k = 0; k <= 9; k++) { g.beginPath(); g.moveTo(o, o + k * step); g.lineTo(o + 9 * step, o + k * step); g.stroke(); g.beginPath(); g.moveTo(o + k * step, o); g.lineTo(o + k * step, o + 9 * step); g.stroke(); }
    g.setLineDash([]);
    // The throne (konakis) and the Muscovites' squares are stitched with crosses.
    const cross = (r, c, col) => { const x = o + (c + 0.5) * step, y = o + (r + 0.5) * step; g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 18, y - 18); g.lineTo(x + 18, y + 18); g.moveTo(x + 18, y - 18); g.lineTo(x - 18, y + 18); g.stroke(); };
    cross(4, 4, '#b8402a');
    [3, 4, 5, 13, 27, 36, 45, 37, 35, 44, 53, 43, 75, 76, 77, 67].forEach(i => { const x = o + ((i % 9) + 0.5) * step, y = o + (((i / 9) | 0) + 0.5) * step; g.fillStyle = 'rgba(60,30,15,.25)'; g.beginPath(); g.arc(x, y, 30, 0, TAU); g.fill(); });
  }), { roughness: 0.95 });
  const shown = [], y = TOP + 0.013, G = window.LibrariumRules.tablut;
  G.init(); G.b.forEach((v, i) => { if (!v) return; const m = tbPiece(v), c = tbCell(i); m.position.set(c.x, y, c.z); group.add(m); shown.push(m); });
  group.userData.display = shown;
  return y;
}

