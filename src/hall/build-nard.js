/* --- Wing VI: Nard, on a tables board with every checker on its head */
function buildNard(group) {
  const y = buildTablesBoard(group, { felt: '#4a1a16', light: '#e7d6b0', dark: '#1d3550' });
  const shown = [], cols = [0xe8dcc0, 0x2a1c14];
  for (const pl of [0, 1]) for (let k = 0; k < 15; k++) {
    const m = new THREE.Mesh(tbCheckerGeo, new THREE.MeshStandardMaterial({ color: cols[pl], roughness: 0.4 }));
    const abs = pl ? 12 : 24, sp = 0.34 / 14;
    m.position.set(tbPointX(abs), y + k * 0.0009, abs <= 12 ? 0.4 - k * sp : -0.4 + k * sp); group.add(m); shown.push(m);
  }
  group.userData.display = shown;
  return y;
}

