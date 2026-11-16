/* --- Wing II: Ludus duodecim scriptorum, three rows of twelve, with a board's famous taunt */
function buildXii(group) {
  const W = 12 * XII_S + XII_GAP + 0.1, D = 3 * XII_S * 1.15 + 0.1;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, D), new THREE.MeshStandardMaterial({ color: 0xbdb3a0, roughness: 0.9 }));
  slab.position.y = TOP + 0.02; group.add(slab);
  // LEVATE DALOCV / LVDERE NESCIS / IDIOTA RECEDE: "Get up, make way! You don't know how to play: fool, go away!"
  const words = [['IDIOTA', 'RECEDE'], ['LVDERE', 'NESCIS'], ['LEVATE', 'DALOCV']];
  const pw = 1024, ph = Math.round(pw * D / W), sc = pw / W;
  topPlane(group, W, D, TOP + 0.0405, tex(pw, ph, (g) => {
    g.fillStyle = '#c4baa6'; g.fillRect(0, 0, pw, ph);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(70,60,48,${rand(0.03, 0.12)})`; g.fillRect(rand(0, pw), rand(0, ph), rand(1, 5), rand(1, 4)); }
    g.fillStyle = 'rgba(60,48,36,.85)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `600 ${(XII_S * sc * 0.6) | 0}px "Cinzel","Trajan Pro","Times New Roman",serif`;
    for (let row = 0; row < 3; row++) for (let col = 0; col < 12; col++) {
      const c = xiiCell(row, col), x = pw / 2 + c.x * sc, yy = ph / 2 + c.z * sc;
      g.fillText(words[row][col < 6 ? 0 : 1][col % 6], x, yy);
    }
    g.strokeStyle = 'rgba(60,48,36,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(pw / 2, 14); g.lineTo(pw / 2, ph - 14); g.stroke();
  }), { roughness: 0.9 });
  const y = TOP + 0.041, shown = [];
  for (const pl of [0, 1]) for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(xiiPieceGeo, new THREE.MeshStandardMaterial({ color: pl ? 0x23201c : 0xeee6d2, roughness: 0.35 }));
    m.position.set((pl ? -1 : 1) * (0.56 + (k % 3) * 0.055), TOP + 0.0055 + ((k / 3) | 0) * 0.012, pl ? -0.1 : 0.1); group.add(m); shown.push(m);
  }
  group.userData.display = shown;
  return y;
}

