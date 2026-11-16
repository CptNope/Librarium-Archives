/* --- New tables: Chinese checkers, Hex, Gomoku and Dominoes */
const CC_D = 0.058;
function ccCell(i) { const [x, , z] = window.LibrariumRules.chinese.CELLS[i]; return { x: CC_D * (x + z / 2), z: CC_D * z * 0.866 }; }
const ccMarbleGeo = new THREE.SphereGeometry(0.019, 18, 12);
const CC_COLS = [0xb3261e, 0x1f4f9a, 0x2f8a3a, 0xd9a520, 0x6b2f8a, 0xf2efe6];
function ccMarble(col) { const mat = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.12, clearcoat: 0.8, transparent: true, opacity: 0.92 }); const m = new THREE.Mesh(ccMarbleGeo, mat); m.userData.mats = [mat]; return m; }
function buildChinese(group) {
  const R = 0.47, board = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.01, 0.03, 6), new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.5 }));
  board.position.y = TOP + 0.015; group.add(board); // corners point at the six points of the star
  const N = 1024, sc = N / (2 * R), CELLS = window.LibrariumRules.chinese.CELLS;
  // The six points are tinted the colours of the marbles that start in them.
  const tip = ([x, y, z]) => (z > 4 ? 0 : z < -4 ? 1 : x > 4 ? 2 : x < -4 ? 3 : y > 4 ? 4 : y < -4 ? 5 : -1);
  const top = topPlane(group, 2 * R, 2 * R, TOP + 0.0305, tex(N, N, (g) => {
    g.clearRect(0, 0, N, N);
    g.save(); g.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(N / 2 + Math.sin(a) * (R - 0.003) * sc, N / 2 + Math.cos(a) * (R - 0.003) * sc); }
    g.closePath(); g.clip(); woodGrain(g, N, N, '#b07a44', '#6a4422'); g.restore();
    CELLS.forEach((cell, i) => {
      const p = ccCell(i), x = N / 2 + p.x * sc, y = N / 2 + p.z * sc, t = tip(cell);
      if (t >= 0) { g.fillStyle = '#' + CC_COLS[t].toString(16).padStart(6, '0'); g.globalAlpha = 0.4; g.beginPath(); g.arc(x, y, 30, 0, TAU); g.fill(); g.globalAlpha = 1; }
      const gr = g.createRadialGradient(x, y, 2, x, y, 13); gr.addColorStop(0, '#2a160a'); gr.addColorStop(1, '#5a3418');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 12, 0, TAU); g.fill();
    });
  }), { roughness: 0.55, transparent: true });
  top.renderOrder = 1;
  // On display: all six points filled, as for a six-player game.
  const shown = [];
  CELLS.forEach((cell, i) => { const t = tip(cell); if (t < 0) return; const m = ccMarble(CC_COLS[t]); const p = ccCell(i); m.position.set(p.x, TOP + 0.045, p.z); group.add(m); shown.push(m); });
  group.userData.display = shown;
  return TOP + 0.031;
}

const hxStoneGeo = new THREE.CylinderGeometry(1, 1, 0.3, 6);
const HX_MATS = [new THREE.MeshStandardMaterial({ color: 0x9e1b14, roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: 0x15397a, roughness: 0.3 })];
function hxD(n) { return Math.min(0.075, 0.84 / (1.5 * (n - 1) + 1.3)); }
function hxCell(n, i) { const r = (i / n) | 0, c = i % n, d = hxD(n), h = (n - 1) / 2; return { x: (c - h) * d + (r - h) * d / 2, z: (h - r) * d * 0.866 }; }
function hxFace(n) { // the rhombus of hexagons for an n x n board, with red near and far edges and blue sides
  const W = 0.92, D = 0.62, N = 1280, sc = N / W, Nh = Math.round(N * D / W), d = hxD(n), rr = d / Math.sqrt(3) * 1.0;
  return topPlane(new THREE.Group(), W, D, 0, tex(N, Nh, (g) => {
    woodGrain(g, N, Nh, '#5a3a20', '#2e1c0e');
    const hexPath = (x, y, R) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); } g.closePath(); };
    for (let i = 0; i < n * n; i++) {
      const p = hxCell(n, i), x = N / 2 + p.x * sc, y = Nh / 2 + p.z * sc, r = (i / n) | 0, c = i % n;
      const edge = r === 0 || r === n - 1 ? '#b3261e' : c === 0 || c === n - 1 ? '#1f4f9a' : null;
      hexPath(x, y, rr * sc * 1.02); g.fillStyle = edge ? edge : '#e9dcc0'; g.fill();
      if ((r === 0 || r === n - 1) && (c === 0 || c === n - 1)) { g.fillStyle = '#6a3a7a'; g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1; }
      hexPath(x, y, rr * sc * 0.86); g.fillStyle = edge === '#b3261e' ? '#e9b4a6' : edge ? '#adc2e4' : '#f3ead6'; g.fill();
      hexPath(x, y, rr * sc * 1.02); g.strokeStyle = '#3a2a1c'; g.lineWidth = 2; g.stroke();
    }
  }), { roughness: 0.7, transparent: true });
}
function buildHex(group) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.025, 0.66), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.6 }));
  base.position.y = TOP + 0.0125; group.add(base);
  const faces = {}, y = TOP + 0.0255;
  const face = n => { if (!faces[n]) { const f = hxFace(n); f.position.y = y; group.add(f); faces[n] = f; } Object.entries(faces).forEach(([k, f]) => { f.visible = +k === n; }); };
  face(11);
  // On display: the end of an 11 x 11 game, with red's winning chain.
  const R = seeded(1942), shown = [], d = hxD(11);
  const chain = [5, 16, 26, 37, 48, 58, 69, 79, 90, 101, 111];
  for (let i = 0; i < 121; i++) {
    const inChain = chain.includes(i), v = inChain ? 0 : R() < 0.38 ? (R() < 0.45 ? 0 : 1) : -1;
    if (v < 0) continue;
    const m = new THREE.Mesh(hxStoneGeo, HX_MATS[v]); const p = hxCell(11, i);
    m.scale.set(d * 0.42, 0.03, d * 0.42); m.position.set(p.x, y + 0.006, p.z); group.add(m); shown.push(m);
  }
  group.userData.hex = { face, display: shown };
  return y;
}

const GM_S = 0.052;
function gmCell(i) { const r = (i / 15) | 0, c = i % 15; return { x: (c - 7) * GM_S, z: (7 - r) * GM_S }; }
const gmStoneGeo = new THREE.SphereGeometry(0.0235, 22, 10);
function buildGomoku(group) {
  const W = 14 * GM_S + 0.07, ban = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, W), new THREE.MeshStandardMaterial({ color: 0xd2a868, roughness: 0.5 }));
  ban.position.y = TOP + 0.025; group.add(ban);
  const N = 1024, sc = N / W;
  topPlane(group, W, W, TOP + 0.0505, tex(N, N, (g) => {
    woodGrain(g, N, N, '#d9b273', '#9a7038');
    g.strokeStyle = '#2a1a0a'; g.lineWidth = 2;
    for (let k = 0; k < 15; k++) {
      const a = N / 2 + (k - 7) * GM_S * sc, lo = N / 2 - 7 * GM_S * sc, hi = N / 2 + 7 * GM_S * sc;
      g.beginPath(); g.moveTo(lo, a); g.lineTo(hi, a); g.stroke(); g.beginPath(); g.moveTo(a, lo); g.lineTo(a, hi); g.stroke();
    }
    g.fillStyle = '#2a1a0a';
    for (const [r, c] of [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]]) { g.beginPath(); g.arc(N / 2 + (c - 7) * GM_S * sc, N / 2 + (r - 7) * GM_S * sc, 6, 0, TAU); g.fill(); }
  }), { roughness: 0.5 });
  // On display: a game just won by black on the diagonal.
  const shown = [], put = (r, c, pl) => { const m = new THREE.Mesh(gmStoneGeo, GO9_MATS[pl]); m.scale.y = 0.42; const p = gmCell(r * 15 + c); m.position.set(p.x, TOP + 0.06, p.z); group.add(m); shown.push(m); };
  [[5, 5], [6, 6], [7, 7], [8, 8], [9, 9], [7, 8], [6, 8], [8, 6], [10, 7]].forEach(([r, c]) => put(r, c, 0));
  [[4, 4], [10, 10], [7, 6], [6, 7], [8, 7], [5, 8], [9, 8], [6, 5]].forEach(([r, c]) => put(r, c, 1));
  group.userData.display = shown;
  return TOP + 0.0505;
}

// Domino tiles: ebony backs, ivory faces with the two halves' pips.
const DM_L = 0.066, DM_Wd = 0.033, DM_H = 0.01;
const dmGeo = new THREE.BoxGeometry(DM_L, DM_H, DM_Wd);
const dmSide = new THREE.MeshStandardMaterial({ color: 0xe9e1cc, roughness: 0.4 }), dmBack = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.35 });
const DM_FACE = [];
function dmFace(t) {
  if (DM_FACE[t]) return DM_FACE[t];
  const [a, b] = window.LibrariumRules.dominoes.TILES[t];
  const P = { 0: [], 1: [[0.5, 0.5]], 2: [[0.25, 0.25], [0.75, 0.75]], 3: [[0.22, 0.22], [0.5, 0.5], [0.78, 0.78]], 4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], 6: [[0.27, 0.2], [0.73, 0.2], [0.27, 0.5], [0.73, 0.5], [0.27, 0.8], [0.73, 0.8]] };
  const map = tex(256, 128, (g) => {
    g.fillStyle = '#efe7d2'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#1c1410'; g.fillRect(126, 14, 4, 100);
    [[a, 0], [b, 128]].forEach(([n, ox]) => { for (const [px, py] of P[n]) { g.beginPath(); g.arc(ox + 14 + px * 100, 14 + py * 100, 11, 0, TAU); g.fill(); } });
  });
  return (DM_FACE[t] = new THREE.MeshStandardMaterial({ map, roughness: 0.4 }));
}
function dmTile(t) { const m = new THREE.Mesh(dmGeo, [dmSide, dmSide, dmFace(t), dmBack, dmSide, dmSide]); m.userData.mats = [dmSide]; m.userData.t = t; return m; }
function buildDominoes(group) {
  const W = 1.12, D = 0.88;
  const top = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), new THREE.MeshStandardMaterial({ color: 0x0b2214, roughness: 1 }));
  top.position.y = TOP + 0.01; group.add(top);
  const rim = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.5 });
  for (const [x, z, w, d] of [[0, D / 2, W + 0.04, 0.02], [0, -D / 2, W + 0.04, 0.02], [W / 2, 0, 0.02, D], [-W / 2, 0, 0.02, D]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), rim); b.position.set(x, TOP + 0.015, z); group.add(b); }
  // On display: a short line of play and the box the set came in.
  const shown = [], T = window.LibrariumRules.dominoes.TILES, id = (a, b) => T.findIndex(([x, y]) => x === a && y === b);
  [[2, 5], [5, 5], [5, 1], [1, 6], [6, 6], [6, 3]].forEach(([a, b], k) => {
    const m = dmTile(id(Math.min(a, b), Math.max(a, b))); m.position.set(-0.17 + k * (DM_L + 0.004), TOP + 0.02 + DM_H / 2, 0); if (a > b) m.rotation.y = Math.PI; group.add(m); shown.push(m);
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.07), new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.5 }));
  box.position.set(0.3, TOP + 0.0375, -0.22); box.rotation.y = 0.3; group.add(box); shown.push(box);
  group.userData.display = shown;
  return TOP + 0.02;
}

