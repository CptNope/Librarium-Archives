/* --- Round five: Morabaraba, Ludo and Janggi */
function buildMorabaraba(group) {
  const W = 0.86;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, W), new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.95 }));
  slab.position.y = TOP + 0.02; group.add(slab);
  const px = 1024, sc = px / W, c = px / 2;
  // Scratched into hard earth and chalked, as herders draw it.
  topPlane(group, W, W, TOP + 0.0405, tex(px, px, (g) => {
    g.fillStyle = '#5a3e2a'; g.fillRect(0, 0, px, px); speckle(g, px, px, 9000, ['#4e3422', '#6a4c36', '#43301f', '#725640'], 2.2);
    g.strokeStyle = '#efe6d2'; g.lineWidth = 8; g.lineCap = 'round';
    for (const sz of MO_S) g.strokeRect(c - sz * sc, c - sz * sc, 2 * sz * sc, 2 * sz * sc);
    g.beginPath();
    g.moveTo(c, c - MO_S[0] * sc); g.lineTo(c, c - MO_S[2] * sc); g.moveTo(c, c + MO_S[2] * sc); g.lineTo(c, c + MO_S[0] * sc);
    g.moveTo(c - MO_S[0] * sc, c); g.lineTo(c - MO_S[2] * sc, c); g.moveTo(c + MO_S[2] * sc, c); g.lineTo(c + MO_S[0] * sc, c);
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.moveTo(c + dx * MO_S[0] * sc, c + dz * MO_S[0] * sc); g.lineTo(c + dx * MO_S[2] * sc, c + dz * MO_S[2] * sc); }
    g.stroke();
    g.fillStyle = '#efe6d2';
    for (let p = 0; p < 24; p++) { const q = moPoint(p); g.beginPath(); g.arc(c + q.x * sc, c + q.z * sc, 15, 0, TAU); g.fill(); }
  }), { roughness: 0.95 });
  return TOP + 0.041;
}

const LD_C = 0.056;
function ldXZ(gx, gy) { return { x: (gx - 7) * LD_C, z: (7 - gy) * LD_C }; }
const LD_COL = { red: 0xb3261e, green: 0x2f7a3a, yellow: 0xd9a520, blue: 0x1f4f9a };
function ldSpot(pl, rel, k) {
  const R = window.LibrariumRules.ludo;
  if (rel < 0) { const base = pl ? [10.5, 10.5] : [1.5, 1.5], o = [[0, 0], [2, 0], [0, 2], [2, 2]][k]; return ldXZ(base[0] + o[0], base[1] + o[1]); }
  if (rel <= 50) { const [gx, gy] = R.TRACK[(rel + R.START[pl]) % 52]; return ldXZ(gx, gy); }
  if (rel <= 55) { const d = rel - 50; return pl ? ldXZ(14 - d, 7) : ldXZ(d, 7); }
  const o = (k - 1.5) * 0.3; return pl ? ldXZ(7.9, 7 + o) : ldXZ(6.1, 7 + o);
}
function buildLudo(group) {
  const W = 15 * LD_C + 0.04;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.025, W), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.6 }));
  board.position.y = TOP + 0.0125; group.add(board);
  const N = 1080, sc = N / W, R = window.LibrariumRules.ludo, hex = v => '#' + v.toString(16).padStart(6, '0');
  topPlane(group, W, W, TOP + 0.0255, tex(N, N, (g) => {
    g.fillStyle = '#f2ead6'; g.fillRect(0, 0, N, N);
    const cell = (gx, gy, fill) => { const p = ldXZ(gx, gy), x = N / 2 + (p.x - LD_C / 2) * sc, y = N / 2 + (p.z - LD_C / 2) * sc, w = LD_C * sc; g.fillStyle = fill; g.fillRect(x, y, w, w); g.strokeStyle = '#3a2a1c'; g.lineWidth = 2; g.strokeRect(x, y, w, w); };
    // Yards in the four corners: red near left, green near right, yellow far right, blue far left.
    const yard = (gx, gy, col) => { const p = ldXZ(gx + 2.5, gy + 2.5), w = 6 * LD_C * sc; g.fillStyle = hex(col); g.fillRect(N / 2 + p.x * sc - w / 2, N / 2 + p.z * sc - w / 2, w, w); g.fillStyle = '#f2ead6'; g.fillRect(N / 2 + p.x * sc - w * 0.36, N / 2 + p.z * sc - w * 0.36, w * 0.72, w * 0.72);
      g.fillStyle = hex(col); for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.arc(N / 2 + (p.x + ox * LD_C) * sc, N / 2 + (p.z - oy * LD_C) * sc, LD_C * sc * 0.38, 0, TAU); g.fill(); } };
    yard(0, 0, LD_COL.red); yard(9, 0, LD_COL.green); yard(9, 9, LD_COL.yellow); yard(0, 9, LD_COL.blue);
    R.TRACK.forEach(([gx, gy], k) => cell(gx, gy, k === 0 ? hex(LD_COL.red) : k === 13 ? hex(LD_COL.green) : k === 26 ? hex(LD_COL.yellow) : k === 39 ? hex(LD_COL.blue) : '#fbf7ec'));
    for (let d = 1; d <= 5; d++) { cell(d, 7, hex(LD_COL.red)); cell(14 - d, 7, hex(LD_COL.yellow)); cell(7, d, hex(LD_COL.green)); cell(7, 14 - d, hex(LD_COL.blue)); }
    // The centre: four triangles pointing home.
    const ctr = ldXZ(7, 7), cx = N / 2 + ctr.x * sc, cy = N / 2 + ctr.z * sc, h = 1.5 * LD_C * sc;
    [[LD_COL.red, [-1, -1], [-1, 1]], [LD_COL.green, [-1, 1], [1, 1]], [LD_COL.yellow, [1, 1], [1, -1]], [LD_COL.blue, [1, -1], [-1, -1]]].forEach(([col, a, b]) => {
      g.fillStyle = hex(col); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + a[0] * h, cy + a[1] * h); g.lineTo(cx + b[0] * h, cy + b[1] * h); g.closePath(); g.fill();
    });
  }), { roughness: 0.6 });
  // On display: four tokens of each colour in their yards.
  const shown = [], y = TOP + 0.026;
  [[LD_COL.red, 0, [1.5, 1.5]], [LD_COL.green, 0, [10.5, 1.5]], [LD_COL.yellow, 1, [10.5, 10.5]], [LD_COL.blue, 1, [1.5, 10.5]]].forEach(([col, , base]) => {
    [[0, 0], [2, 0], [0, 2], [2, 2]].forEach(([ox, oy]) => { const m = goosePawn(col), p = ldXZ(base[0] + ox, base[1] + oy); m.scale.setScalar(0.8); m.position.set(p.x, y, p.z); group.add(m); shown.push(m); });
  });
  group.userData.display = shown;
  return y;
}

const JG_CHARS = [[null, '楚', '士', '象', '馬', '車', '包', '卒'], [null, '漢', '士', '象', '馬', '車', '包', '兵']];
const JG_R = [0, 0.036, 0.024, 0.03, 0.03, 0.031, 0.03, 0.024];
const jgTex = {};
function jgFace(pl, t) {
  const key = pl * 8 + t;
  if (!jgTex[key]) jgTex[key] = tex(128, 128, (g, w) => {
    g.fillStyle = '#f0e6cc'; g.fillRect(0, 0, w, w);
    const ink = pl ? '#b0201a' : '#14506a';
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${t === 1 ? 'bold 74px' : '62px'} "Noto Serif CJK KR","Noto Serif CJK SC","Batang","SimSun",serif`;
    g.fillText(JG_CHARS[pl][t], 64, 60);
    g.font = '600 15px "Montserrat",sans-serif'; g.fillText(XQ_LATIN[t], 64, 108);
  });
  return jgTex[key];
}
const jgSideMat = new THREE.MeshStandardMaterial({ color: 0xd9c9a0, roughness: 0.5 });
function jgPiece(pl, t) {
  const r = JG_R[t], top = new THREE.MeshStandardMaterial({ map: jgFace(pl, t), roughness: 0.45 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.018, 8), [jgSideMat, top, jgSideMat]);
  m.rotation.y = Math.PI / 8; m.userData.mats = [top]; m.userData.pl = pl; m.userData.t = t; return m;
}
function buildJanggi(group) {
  const W = 8 * XQ_S + 0.12, D = 9 * XQ_S + 0.12;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.035, D), new THREE.MeshStandardMaterial({ color: 0x9a6a32, roughness: 0.5 }));
  board.position.y = TOP + 0.0175; group.add(board);
  const pw = 1024, ph = Math.round(pw * D / W), sc = pw / W, ox = pw / 2 - 4 * XQ_S * sc, oy = ph / 2 - 4.5 * XQ_S * sc, st = XQ_S * sc;
  topPlane(group, W, D, TOP + 0.0355, tex(pw, ph, (g) => {
    woodGrain(g, pw, ph, '#e8c488', '#9a6a32');
    g.strokeStyle = '#3a1a0a'; g.lineWidth = 4;
    const P = (r, c) => [ox + c * st, oy + (9 - r) * st];
    const line = (a, b) => { g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.stroke(); };
    for (let r = 0; r < 10; r++) line([r, 0], [r, 8]);
    for (let c = 0; c < 9; c++) line([0, c], [9, c]); // no river: the files run the whole way
    line([0, 3], [2, 5]); line([0, 5], [2, 3]); line([7, 3], [9, 5]); line([7, 5], [9, 3]);
    g.lineWidth = 8; g.strokeRect(ox - 10, oy - 10, 8 * st + 20, 9 * st + 20);
  }), { roughness: 0.5 });
  const y = TOP + 0.036, shown = [], G = window.LibrariumRules.janggi;
  G.init(); G.b.forEach((v, i) => { if (!v) return; const m = jgPiece(v > 8 ? 1 : 0, v & 7), c = xqCell(i); m.position.set(c.x, y + 0.009, c.z); group.add(m); shown.push(m); });
  group.userData.display = shown;
  return y;
}

