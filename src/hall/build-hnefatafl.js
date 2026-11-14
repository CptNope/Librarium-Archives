/* --- Wing II: Hnefatafl, 11 x 11, after the Copenhagen rules */
const HN_S = 0.072;
function hnCell(i) { const r = (i / 11) | 0, c = i % 11; return { x: (c - 5) * HN_S, z: (5 - r) * HN_S }; }
function hnPiece(v) { const m = tbPiece(v); m.scale.multiplyScalar(0.84); return m; }
function buildHnefatafl(group) {
  const W = 11 * HN_S + 0.07;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.036, W), new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.7 }));
  slab.position.y = TOP + 0.018; group.add(slab);
  const N = 1024, sc = N / W, o = N / 2 - 5.5 * HN_S * sc, s = HN_S * sc;
  topPlane(group, W, W, TOP + 0.0365, tex(N, N, (g) => {
    // Oak, with the grid cut into it like the 11 x 11 board fragment from Trondheim.
    woodGrain(g, N, N, '#9c7446', '#6a4a26');
    g.strokeStyle = 'rgba(40,22,8,.85)'; g.lineWidth = 4;
    for (let k = 0; k <= 11; k++) { g.beginPath(); g.moveTo(o, o + k * s); g.lineTo(o + 11 * s, o + k * s); g.stroke(); g.beginPath(); g.moveTo(o + k * s, o); g.lineTo(o + k * s, o + 11 * s); g.stroke(); }
    const knot = (r, c) => { // the throne and the four corners are cut with a cross in a ring
      const x = o + (c + 0.5) * s, y = o + (r + 0.5) * s;
      g.fillStyle = 'rgba(40,22,8,.35)'; g.fillRect(x - s / 2 + 3, y - s / 2 + 3, s - 6, s - 6);
      g.strokeStyle = 'rgba(30,16,6,.9)'; g.lineWidth = 4;
      g.beginPath(); g.arc(x, y, s * 0.3, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(x - s * 0.36, y); g.lineTo(x + s * 0.36, y); g.moveTo(x, y - s * 0.36); g.lineTo(x, y + s * 0.36); g.stroke();
    };
    [[0, 0], [0, 10], [10, 0], [10, 10], [5, 5]].forEach(([r, c]) => knot(r, c));
  }), { roughness: 0.75 });
  const y = TOP + 0.037, shown = [], G = window.LibrariumRules.hnefatafl;
  G.init(); G.b.forEach((v, i) => { if (!v) return; const m = hnPiece(v), c = hnCell(i); m.position.set(c.x, y, c.z); group.add(m); shown.push(m); });
  group.userData.display = shown;
  return y;
}

const MK_S = 0.088;
function mkCell(i) { return { x: ((i & 7) - 3.5) * MK_S, z: (3.5 - (i >> 3)) * MK_S }; }
const mkLathe = (pts, m) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 22), m);
const MK_BASE = [[0, 0], [0.026, 0], [0.027, 0.006], [0.02, 0.012]];
const MK_SHAPES = { // Thai pieces: a tall khun, a small met, a domed khon, a boat-like ruea, a horse, and cowrie shells
  1: m => { const g = new THREE.Group(); g.add(mkLathe([...MK_BASE, [0.014, 0.05], [0.02, 0.062], [0.016, 0.074], [0.008, 0.086], [0.003, 0.094], [0, 0.096]], m)); return g; },
  2: m => mkLathe([...MK_BASE, [0.013, 0.034], [0.017, 0.042], [0.009, 0.054], [0, 0.058]], m),
  3: m => mkLathe([...MK_BASE, [0.014, 0.04], [0.019, 0.05], [0.017, 0.062], [0.008, 0.072], [0, 0.074]], m),
  4: m => CHESS_SHAPES.n(m),
  5: m => { const g = new THREE.Group(); g.add(mkLathe([...MK_BASE, [0.017, 0.04], [0.021, 0.046], [0.021, 0.054], [0, 0.054]], m)); return g; },
  6: m => { const c = new THREE.Mesh(new THREE.SphereGeometry(0.019, 18, 10), m); c.scale.set(0.8, 0.55, 1.15); c.position.y = 0.01; const g = new THREE.Group(); g.add(c); return g; },
  7: m => { const c = new THREE.Mesh(new THREE.SphereGeometry(0.019, 18, 10), m); c.scale.set(0.8, 0.55, 1.15); c.position.y = 0.01; c.rotation.z = Math.PI; const g = new THREE.Group(); g.add(c); const r = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 16), MAT.brass); r.rotation.x = Math.PI / 2; r.position.y = 0.021; g.add(r); return g; },
};
function mkPiece(v) {
  const pl = v > 8 ? 1 : 0, mat = new THREE.MeshStandardMaterial({ color: pl ? 0x8a2a1a : 0xe9dcbc, roughness: 0.4 });
  const o = MK_SHAPES[v & 7](mat); o.userData.mats = [mat]; o.rotation.y = pl ? -Math.PI / 2 : Math.PI / 2; return o;
}
function buildMakruk(group) {
  const W = 8 * MK_S + 0.07, frame = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, W), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.5 }));
  frame.position.y = TOP + 0.02; group.add(frame);
  const N = 1024, sc = N / W;
  topPlane(group, W, W, TOP + 0.0405, tex(N, N, (g) => {
    woodGrain(g, N, N, '#c8a064', '#7a5428');
    const o = N / 2 - 4 * MK_S * sc, step = MK_S * sc;
    g.strokeStyle = '#2a1608'; g.lineWidth = 3; // a makruk board is not checkered: only lines
    for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(o, o + k * step); g.lineTo(o + 8 * step, o + k * step); g.stroke(); g.beginPath(); g.moveTo(o + k * step, o); g.lineTo(o + k * step, o + 8 * step); g.stroke(); }
  }), { roughness: 0.55 });
  const y = TOP + 0.041, shown = [], G = window.LibrariumRules.makruk;
  G.init(); G.b.forEach((v, i) => { if (!v) return; const m = mkPiece(v), c = mkCell(i); m.position.set(c.x, y, c.z); group.add(m); shown.push(m); });
  group.userData.display = shown;
  return y;
}

const KL_DX = 0.118;
function klPit(i) { // 0-5 the visitor's row left to right, 7-12 the Scribe's row right to left
  if (i < 6) return { x: (i - 2.5) * KL_DX, z: 0.075 };
  return { x: (12 - i - 2.5) * KL_DX, z: -0.075 };
}
function klStore(pl) { return { x: pl === 0 ? 0.47 : -0.47, z: 0 }; }
function buildKalah(group) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4222, roughness: 0.55 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.06, 0.34), wood); block.position.y = TOP + 0.03; group.add(block);
  topPlane(group, 1.08, 0.34, TOP + 0.0605, tex(1024, 320, (g, w, h) => woodGrain(g, w, h, '#8a5a2e', '#3a2210')), { roughness: 0.55 });
  const y = TOP + 0.062, rimMat = new THREE.MeshStandardMaterial({ color: 0x4a2c14, roughness: 0.5 }), pits = [];
  for (let i = 0; i < 14; i++) {
    if (i === 6 || i === 13) continue;
    const p = klPit(i), mat = new THREE.MeshStandardMaterial({ color: 0x1e0f06, roughness: 0.85 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.004, 28), mat); disc.position.set(p.x, y, p.z); disc.userData.mats = [mat]; group.add(disc); pits[i] = disc;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 8, 32), rimMat); rim.rotation.x = -Math.PI / 2; rim.position.set(p.x, y + 0.002, p.z); group.add(rim);
  }
  for (const pl of [0, 1]) { const p = klStore(pl); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 28), new THREE.MeshStandardMaterial({ color: 0x1e0f06, roughness: 0.85 })); st.scale.z = 2.3; st.position.set(p.x, y, p.z); group.add(st); }
  group.userData.pits = pits;
  // On display: four seeds to a pit, ready to play.
  const shown = [], cols = [0x6a8aa8, 0x8aa86a, 0xa86a6a, 0xa8986a];
  for (let i = 0; i < 14; i++) { if (i === 6 || i === 13) continue; const p = klPit(i); for (let k = 0; k < 4; k++) { const sd = new THREE.Mesh(seedGeo, new THREE.MeshStandardMaterial({ color: cols[(i + k) % 4], roughness: 0.25 })); const a = k * 1.6 + i; sd.position.set(p.x + Math.cos(a) * 0.018, y + 0.009, p.z + Math.sin(a) * 0.018); group.add(sd); shown.push(sd); } }
  group.userData.display = shown;
  return y + 0.002;
}

// Cribbage: French-suited cards and a pegging board.
const CR_W = 0.062, CR_H = 0.092;
const crGeo = new THREE.BoxGeometry(CR_W, 0.0016, CR_H);
const crBackMat = new THREE.MeshStandardMaterial({ roughness: 0.6, map: cardTex((g, w, h) => {
  g.fillStyle = '#1f3a6a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8dcc0'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  g.lineWidth = 2; g.strokeStyle = 'rgba(232,220,192,.5)';
  for (let k = -h; k < w + h; k += 18) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); }
}, 140, 210) });
const crFaceCache = new Map();
function crFace(c) {
  if (crFaceCache.has(c)) return crFaceCache.get(c);
  const R = window.LibrariumRules.cribbage, rk = R.rank(c), su = R.suit(c), red = su === 1 || su === 2, col = red ? '#b3261e' : '#1c1c1c';
  const label = 'A 2 3 4 5 6 7 8 9 10 J Q K'.split(' ')[rk], sym = ['♠', '♥', '♦', '♣'][su];
  const map = cardTex((g, w, h) => {
    g.fillStyle = '#f7f2e6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 34px "Montserrat",sans-serif'; g.fillText(label, 26, 30); g.font = '30px serif'; g.fillText(sym, 26, 62);
    g.save(); g.translate(w, h); g.rotate(Math.PI); g.font = '700 34px "Montserrat",sans-serif'; g.fillText(label, 26, 30); g.font = '30px serif'; g.fillText(sym, 26, 62); g.restore();
    if (rk >= 10) { g.font = '600 64px "Amethysta",Georgia,serif'; g.fillText(label, w / 2, h / 2 - 8); g.font = '40px serif'; g.fillText(sym, w / 2, h / 2 + 46); }
    else { g.font = (rk === 0 ? '96px' : '64px') + ' serif'; g.fillText(sym, w / 2, h / 2 + 4); }
  }, 140, 210);
  crFaceCache.set(c, map); return map;
}
function crCard(c) { const face = new THREE.MeshStandardMaterial({ map: crFace(c), roughness: 0.55 }); const m = new THREE.Mesh(crGeo, [tcEdgeMat, tcEdgeMat, face, crBackMat, tcEdgeMat, tcEdgeMat]); m.userData.mats = [face]; m.userData.c = c; return m; }
// Pegging holes: each player has a lane of sixty, thirty up the board and thirty back.
const CRB_X0 = -0.5, CRB_Z0 = 0.3, CRB_DZ = 0.0205;
function crHole(pl, s) {
  if (s <= 0) return { x: CRB_X0 + pl * 0.07 + 0.0125, z: CRB_Z0 + 0.035 };
  if (s >= 61) return { x: CRB_X0 + 0.0475, z: CRB_Z0 - 30 * CRB_DZ - 0.03 };
  const k = (s - 1) % 60, back = k >= 30, x = CRB_X0 + pl * 0.07 + (back ? 0.025 : 0);
  return { x, z: back ? CRB_Z0 - (59 - k) * CRB_DZ : CRB_Z0 - k * CRB_DZ };
}
function buildCribbage(group) {
  const W = 1.12, D = 0.86;
  const baize = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), new THREE.MeshStandardMaterial({ color: 0x0b2214, roughness: 1 }));
  baize.position.y = TOP + 0.01; group.add(baize);
  // The board: a long plank of light wood with two lanes of holes.
  const L = 31 * CRB_DZ + 0.09, bw = 0.15, board = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.022, L), new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 0.5 }));
  const cz = CRB_Z0 - 15 * CRB_DZ;
  board.position.set(CRB_X0 + 0.0475, TOP + 0.031, cz); group.add(board);
  const N = 256, Nz = Math.round(256 * L / bw), sc = N / bw;
  const face = topPlane(group, bw, L, TOP + 0.0422, tex(N, Nz, (g) => {
    woodGrain(g, N, Nz, '#d4a868', '#8a6030');
    const hole = (x, z, col) => { const px = N / 2 + (x - (CRB_X0 + 0.0475)) * sc, pz = Nz / 2 + (z - cz) * sc; g.fillStyle = col; g.beginPath(); g.arc(px, pz, 4.5, 0, TAU); g.fill(); };
    for (const pl of [0, 1]) for (let s = 0; s <= 60; s++) { const h = crHole(pl, s); hole(h.x, h.z, s % 5 === 0 && s ? '#3a1a08' : '#5a3418'); }
    const gh = crHole(0, 61); hole(gh.x, gh.z, '#1a0a02');
    g.strokeStyle = 'rgba(58,26,8,.6)'; g.lineWidth = 2; for (let k = 5; k < 30; k += 5) { const z = Nz / 2 + (CRB_Z0 - (k - 0.5) * CRB_DZ - cz) * sc; g.beginPath(); g.moveTo(8, z); g.lineTo(N - 8, z); g.stroke(); }
  }), { roughness: 0.5 });
  face.position.x = CRB_X0 + 0.0475; face.position.z = cz;
  const pegs = [0, 1].map(pl => [0, 1].map(k => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.028, 10), new THREE.MeshStandardMaterial({ color: pl ? 0x1f3a6a : 0xb3261e, roughness: 0.3, metalness: 0.3 })); const h = crHole(pl, 0); m.position.set(h.x + (k ? 0.006 : -0.006), TOP + 0.052, h.z); group.add(m); return m; }));
  group.userData.pegs = pegs; group.userData.pegY = TOP + 0.052;
  // On display: a hand of 29, the best there is, fanned beside the board.
  const R = window.LibrariumRules.cribbage, shown = [], cd = (r, su) => su * 13 + r;
  [cd(4, 0), cd(4, 1), cd(4, 2), cd(10, 3), cd(4, 3)].forEach((c, k) => { const m = crCard(c); m.position.set(-0.12 + k * 0.07, TOP + 0.021 + k * 0.0003, 0.05); m.rotation.y = (k - 2) * -0.06; group.add(m); shown.push(m); });
  group.userData.display = shown;
  return TOP + 0.021;
}

