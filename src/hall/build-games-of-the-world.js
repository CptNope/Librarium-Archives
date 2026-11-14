/* --- Wing VI: Games of the World */
const W6_CJK = '"Noto Serif CJK JP","Noto Serif CJK SC","Hiragino Mincho ProN","Yu Mincho","SimSun",serif';
function stoneMesh(color, r, flat, rough) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), new THREE.MeshStandardMaterial({ color, roughness: rough == null ? 0.5 : rough }));
  m.scale.y = flat; m.userData.mats = [m.material]; return m;
}
const MT_R = 0.3;
function mtPos(i) { if (i === 8) return { x: 0, z: 0 }; const a = Math.PI + (i + 0.5) * Math.PI / 4; return { x: MT_R * Math.cos(a), z: -MT_R * Math.sin(a) }; }
function buildMuTorere(group) {
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.44, 0.035, 48), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.6 }));
  disc.position.y = TOP + 0.0175; group.add(disc);
  const px = 1024, W = 0.86, sc = px / W, c = px / 2;
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.43, 48), new THREE.MeshStandardMaterial({ roughness: 0.6, map: tex(px, px, (g) => {
    woodGrain(g, px, px, '#a9763e', '#5a3a20');
    // The star: eight arms (kewai) from the centre (pūtahi), like an octopus.
    g.fillStyle = 'rgba(40,22,10,.82)';
    for (let i = 0; i < 8; i++) {
      const p = mtPos(i), x = c + p.x * sc, y = c + p.z * sc, a = Math.atan2(y - c, x - c);
      g.beginPath(); g.moveTo(c + Math.cos(a - 0.32) * 46, c + Math.sin(a - 0.32) * 46);
      g.quadraticCurveTo(c + Math.cos(a - 0.12) * 220, c + Math.sin(a - 0.12) * 220, x + Math.cos(a - 1.4) * 40, y + Math.sin(a - 1.4) * 40);
      g.arc(x, y, 40, a - 1.4, a + 1.4);
      g.quadraticCurveTo(c + Math.cos(a + 0.12) * 220, c + Math.sin(a + 0.12) * 220, c + Math.cos(a + 0.32) * 46, c + Math.sin(a + 0.32) * 46);
      g.closePath(); g.fill();
    }
    g.beginPath(); g.arc(c, c, 58, 0, TAU); g.fill();
    g.strokeStyle = '#e8c890'; g.lineWidth = 4;
    for (let i = 0; i <= 8; i++) { const p = mtPos(i); g.beginPath(); g.arc(c + p.x * sc, c + p.z * sc, i === 8 ? 44 : 30, 0, TAU); g.stroke(); }
  }) }));
  top.rotation.x = -Math.PI / 2; top.position.y = TOP + 0.0355; group.add(top);
  return TOP + 0.036;
}
const KN_S = 0.084;
function knCell(i) { const r = (i / 8) | 0, c = i % 8; return { x: (c - 3.5) * KN_S, z: (3.5 - r) * KN_S }; }
function buildKonane(group) {
  // A papamū: a flat stone with rows of small hollows.
  const W = 8 * KN_S + 0.08;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, W), new THREE.MeshStandardMaterial({ color: 0x5c5650, roughness: 0.95 }));
  slab.position.y = TOP + 0.03; group.add(slab);
  const px = 1024, sc = px / W;
  topPlane(group, W, W, TOP + 0.0605, tex(px, px, (g) => {
    g.fillStyle = '#6a645c'; g.fillRect(0, 0, px, px);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${rand(20, 60) | 0},${rand(20, 55) | 0},${rand(20, 50) | 0},${rand(0.05, 0.25)})`; g.fillRect(rand(0, px), rand(0, px), rand(1, 5), rand(1, 5)); }
    for (let i = 0; i < 64; i++) {
      const p = knCell(i), x = px / 2 + p.x * sc, y = px / 2 + p.z * sc;
      const gr = g.createRadialGradient(x - 4, y - 4, 2, x, y, 26); gr.addColorStop(0, '#2a2622'); gr.addColorStop(1, '#58524b');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 24, 0, TAU); g.fill();
    }
  }), { roughness: 0.95 });
  return TOP + 0.061;
}
const FN_S = 0.098;
function fnCell(i) { const r = (i / 9) | 0, c = i % 9; return { x: (c - 4) * FN_S, z: (2 - r) * FN_S }; }
function buildFanorona(group) {
  const W = 8 * FN_S + 0.12, D = 4 * FN_S + 0.12;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, D), new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.55 }));
  board.position.y = TOP + 0.02; group.add(board);
  const pw = 1024, ph = Math.round(pw * D / W), sc = pw / W;
  topPlane(group, W, D, TOP + 0.0405, tex(pw, ph, (g) => {
    woodGrain(g, pw, ph, '#c08a50', '#7a4a24');
    const P = (r, c) => { const p = fnCell(r * 9 + c); return [pw / 2 + p.x * sc, ph / 2 + p.z * sc]; };
    const line = (a, b) => { g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.stroke(); };
    g.strokeStyle = '#2a170b'; g.lineWidth = 4; g.lineCap = 'round';
    for (let r = 0; r < 5; r++) line([r, 0], [r, 8]);
    for (let c = 0; c < 9; c++) line([0, c], [4, c]);
    // Diagonals through the strong points.
    for (let k = -8; k <= 8; k += 2) {
      const a = [], b = [];
      for (let r = 0; r < 5; r++) { const c1 = r + k, c2 = k - r + 4; if (c1 >= 0 && c1 < 9) a.push([r, c1]); if (c2 >= 0 && c2 < 9) b.push([r, c2]); }
      if (a.length > 1) line(a[0], a[a.length - 1]); if (b.length > 1) line(b[0], b[b.length - 1]);
    }
  }), { roughness: 0.55 });
  return TOP + 0.041;
}
const SHOGI_S = 0.072;
// Pentagonal pieces, all one colour: the way a piece points shows whose it is.
const shogiShape = new THREE.Shape(); shogiShape.moveTo(-0.022, -0.026); shogiShape.lineTo(0.022, -0.026); shogiShape.lineTo(0.026, 0.012); shogiShape.lineTo(0, 0.028); shogiShape.lineTo(-0.026, 0.012); shogiShape.closePath();
const shogiGeo = new THREE.ExtrudeGeometry(shogiShape, { depth: 0.01, bevelEnabled: false });
const shogiLabelGeo = new THREE.PlaneGeometry(0.03, 0.03);
const shogiKanji = {};
function shogiFace(ch, red) {
  const key = ch + (red ? 'r' : '');
  return shogiKanji[key] || (shogiKanji[key] = tex(64, 64, (g) => { g.fillStyle = '#ead2a0'; g.fillRect(0, 0, 64, 64); g.fillStyle = red ? '#b0201a' : '#1a1008'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `600 40px ${W6_CJK}`; g.fillText(ch, 32, 34); }));
}
function shogiPiece(ch, far, red) {
  const wood = new THREE.MeshStandardMaterial({ color: 0xead2a0, roughness: 0.5 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(shogiGeo, wood); body.rotation.x = -Math.PI / 2; g.add(body);
  const label = new THREE.Mesh(shogiLabelGeo, new THREE.MeshStandardMaterial({ map: shogiFace(ch, red), roughness: 0.5 }));
  label.rotation.x = -Math.PI / 2; label.position.set(0, 0.0105, -0.002); g.add(label);
  g.rotation.y = far ? Math.PI : 0; g.userData.mats = [wood, label.material]; g.userData.label = label;
  return g;
}
function buildShogi(group) {
  const S = SHOGI_S, W = 9 * S + 0.05;
  const block = new THREE.Mesh(new THREE.BoxGeometry(W, 0.11, W + 0.04), new THREE.MeshStandardMaterial({ color: 0xc9a060, roughness: 0.5 }));
  block.position.y = TOP + 0.055; group.add(block);
  const px = 1024, sc = px / W;
  topPlane(group, W, W + 0.04, TOP + 0.1105, tex(px, Math.round(px * (W + 0.04) / W), (g, w, h) => {
    woodGrain(g, w, h, '#e0bc7a', '#b08848');
    g.strokeStyle = '#2a1a0a'; g.lineWidth = 3;
    const o = (w - 9 * S * sc) / 2, oy = (h - 9 * S * sc) / 2;
    for (let i = 0; i <= 9; i++) { g.beginPath(); g.moveTo(o + i * S * sc, oy); g.lineTo(o + i * S * sc, oy + 9 * S * sc); g.stroke(); g.beginPath(); g.moveTo(o, oy + i * S * sc); g.lineTo(o + 9 * S * sc, oy + i * S * sc); g.stroke(); }
    g.fillStyle = '#2a1a0a'; for (const [a, b] of [[3, 3], [3, 6], [6, 3], [6, 6]]) { g.beginPath(); g.arc(o + a * S * sc, oy + b * S * sc, 6, 0, TAU); g.fill(); }
  }), { roughness: 0.5 });
  const back = ['香', '桂', '銀', '金', '王', '金', '銀', '桂', '香'], display = [];
  const put = (ch, r, c, far) => { const p = shogiPiece(ch, far); p.position.set((c - 4) * SHOGI_S, TOP + 0.111, (r - 4) * SHOGI_S); group.add(p); display.push(p); };
  back.forEach((ch, c) => { put(ch, 4 + 4, c, false); put(ch === '王' ? '玉' : ch, 0, c, true); });
  put('角', 7, 1, false); put('飛', 7, 7, false); put('飛', 1, 1, true); put('角', 1, 7, true);
  for (let c = 0; c < 9; c++) { put('歩', 6, c, false); put('歩', 2, c, true); }
  group.userData.display = display; // put away while a game is played
  return TOP + 0.111;
}
function buildYut(group) {
  // A cloth board of 29 stations: twenty round the square, nine on the two diagonals.
  const W = 0.62, px = 1024, sc = px / W;
  topPlane(group, W + 0.08, W + 0.08, TOP + 0.003, tex(px, px, (g) => {
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, px, px);
    g.strokeStyle = '#7a2a1c'; g.lineWidth = 10; g.strokeRect(14, 14, px - 28, px - 28);
    const h = W / 2 * sc * 0.86, c = px / 2, P = [];
    for (let k = 0; k < 20; k++) { const side = (k / 5) | 0, t = (k % 5) / 5; const pts = [[h, h], [h, -h], [-h, -h], [-h, h], [h, h]]; const [a, b] = [pts[side], pts[side + 1]]; P.push([c + a[0] + (b[0] - a[0]) * t, c + a[1] + (b[1] - a[1]) * t]); }
    for (const t of [1 / 3, 2 / 3]) for (const [x, y] of [[h, h], [h, -h], [-h, -h], [-h, h]]) P.push([c + x * (1 - t), c + y * (1 - t)]);
    P.push([c, c]);
    g.strokeStyle = 'rgba(90,40,20,.6)'; g.lineWidth = 4;
    g.strokeRect(c - h, c - h, 2 * h, 2 * h);
    g.beginPath(); g.moveTo(c - h, c - h); g.lineTo(c + h, c + h); g.moveTo(c + h, c - h); g.lineTo(c - h, c + h); g.stroke();
    P.forEach(([x, y], k) => { const big = k % 5 === 0 || k === P.length - 1; g.fillStyle = big ? '#7a2a1c' : '#2a3a5a'; g.beginPath(); g.arc(x, y, big ? 26 : 18, 0, TAU); g.fill(); });
  }), { roughness: 0.9 });
  // Four sticks, flat on one side and round on the other.
  const stick = new THREE.CylinderGeometry(0.014, 0.014, 0.16, 14, 1, false, 0, Math.PI);
  const sm = new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 0.6, side: THREE.DoubleSide });
  const R = seeded(57), display = [];
  for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(stick, sm); display.push(st); st.rotation.set(-Math.PI / 2, 0, R() < 0.5 ? 0 : Math.PI); st.rotation.order = 'XZY'; st.rotation.y = (R() - 0.5) * 0.6; st.position.set(0.42 + (R() - 0.5) * 0.06, TOP + 0.01, -0.15 + k * 0.08); group.add(st); }
  // Four pieces each, two of them riding stacked.
  const mats = [new THREE.MeshStandardMaterial({ color: 0xa8322a, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0x2a3a6a, roughness: 0.4 })];
  const pg = new THREE.CylinderGeometry(0.018, 0.02, 0.022, 16);
  [[0, -0.27, 0.27], [0, -0.27, 0.27, 1], [0, 0.0, 0.0], [1, 0.27, -0.27], [1, -0.27, -0.09], [1, -0.4, 0.4]].forEach(([pl, x, z, up]) => { const m = new THREE.Mesh(pg, mats[pl]); m.position.set(x, TOP + 0.014 + (up ? 0.023 : 0), z); group.add(m); display.push(m); });
  group.userData.display = display;
  return TOP + 0.004;
}
// Where each of the 29 stations sits on the cloth (see the drawing above).
const YT_H = 0.301;
function ytPos(st) {
  const C = { x: 0, z: 0 }, corner = k => [{ x: YT_H, z: YT_H }, { x: YT_H, z: -YT_H }, { x: -YT_H, z: -YT_H }, { x: -YT_H, z: YT_H }][k];
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  if (st < 20) { const side = (st / 5) | 0, t = (st % 5) / 5; return lerp(corner(side), corner((side + 1) % 4), t); }
  if (st === 22) return C;
  if (st === 20 || st === 21) return lerp(corner(1), C, (st - 19) / 3);
  if (st === 23 || st === 24) return lerp(C, corner(3), (st - 22) / 3);
  if (st === 25 || st === 26) return lerp(corner(2), C, (st - 24) / 3);
  return lerp(C, corner(0), (st - 26) / 3); // 27, 28
}
const BAO_DX = 0.098;
function baoPos(pit) { // pit = player*16 + L, as in the rules
  const pl = pit >> 4, inner = (pit & 15) >= 8, c = window.LibrariumRules.bao.col(pit);
  const r = pl === 0 ? (inner ? 2 : 3) : (inner ? 1 : 0);
  return { x: (c - 3.5) * BAO_DX, z: (r - 1.5) * BAO_DX };
}
function buildBao(group) {
  const W = 0.86, D = 0.46;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.07, D), new THREE.MeshStandardMaterial({ color: 0x6a3e1c, roughness: 0.55 }));
  board.position.y = TOP + 0.035; group.add(board);
  const pw = 1024, ph = Math.round(pw * D / W), sc = pw / W;
  const pit = (x, z) => [pw / 2 + x * sc, ph / 2 + z * sc];
  const PX = c => (c - 3.5) * BAO_DX, PZ = r => (r - 1.5) * BAO_DX;
  topPlane(group, W, D, TOP + 0.0705, tex(pw, ph, (g) => {
    woodGrain(g, pw, ph, '#9a6430', '#5a3416');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
      const [x, y] = pit(PX(c), PZ(r)), house = (r === 1 && c === 4) || (r === 2 && c === 3);
      const gr = g.createRadialGradient(x, y, 4, x, y, 40); gr.addColorStop(0, '#2a1608'); gr.addColorStop(1, '#5a3416');
      g.fillStyle = gr;
      if (house) { g.fillRect(x - 38, y - 38, 76, 76); } else { g.beginPath(); g.arc(x, y, 38, 0, TAU); g.fill(); }
    }
    g.strokeStyle = 'rgba(30,15,5,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(16, ph / 2); g.lineTo(pw - 16, ph / 2); g.stroke();
  }), { roughness: 0.55 });
  // Click targets for play: a thin dark disc in each pit, which glows when it can be sown.
  const y = TOP + 0.0712, pits = [], discGeo = new THREE.CylinderGeometry(0.031, 0.031, 0.002, 24);
  for (let k = 0; k < 32; k++) {
    const p = baoPos(k), mat = new THREE.MeshStandardMaterial({ color: 0x2a1608, roughness: 0.9, transparent: true, opacity: 0.55 });
    const disc = new THREE.Mesh(discGeo, mat); disc.position.set(p.x, y, p.z); disc.userData.mats = [mat]; group.add(disc); pits.push(disc);
  }
  group.userData.pits = pits;
  // Seeds on display: a few in most pits, a heap in each house. Put away while a game is played.
  const before = group.children.length;
  const seed = new THREE.SphereGeometry(0.009, 8, 6), sm = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.4 });
  const Rn = seeded(1820);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    const house = (r === 1 && c === 4) || (r === 2 && c === 3), n = house ? 9 : (Rn() * 4) | 0;
    for (let k = 0; k < n; k++) { const s = new THREE.Mesh(seed, sm); s.position.set(PX(c) + (Rn() - 0.5) * 0.04, TOP + 0.064 + (k > 4 ? 0.012 : 0), PZ(r) + (Rn() - 0.5) * 0.04); group.add(s); }
  }
  group.userData.display = group.children.slice(before);
  return y + 0.001;
}

