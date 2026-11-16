/* --- Backfill displays: early dice, petteia, liubo and patolli */
function pipFace(n, base, dot) {
  return tex(128, 128, (g, w) => {
    g.fillStyle = base; g.fillRect(0, 0, w, w);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, w, 6); g.fillRect(0, 0, 6, w);
    const P = { 1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]], 4: [[34, 34], [94, 34], [34, 94], [94, 94]], 5: [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]], 6: [[36, 28], [92, 28], [36, 64], [92, 64], [36, 100], [92, 100]] }[n];
    g.fillStyle = dot;
    for (const [x, y] of P) { g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill(); }
  });
}
function cubeDie(size, base, dot) {
  // Faces in BoxGeometry order (+x, -x, +y, -y, +z, -z), opposite faces adding to seven.
  const mats = [1, 6, 2, 5, 3, 4].map(n => new THREE.MeshStandardMaterial({ map: pipFace(n, base, dot), roughness: 0.75 }));
  return new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mats);
}
function buildDice(group) {
  const n0 = group.children.length;
  topPlane(group, 0.86, 0.6, TOP + 0.002, tex(512, 360, (g, w, h) => {
    g.fillStyle = '#5a3a24'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${rand(20, 60) | 0},${rand(10, 30) | 0},5,.25)`; g.fillRect(rand(0, w), rand(0, h), rand(1, 4), rand(1, 3)); }
  }), { roughness: 0.95 });
  // Terracotta dice in the Indus manner, and darker ones like those from the Burnt City.
  const R = seeded(2500);
  const put = (d, x, z) => { d.position.set(x, TOP + d.geometry.parameters.height / 2 + 0.002, z); d.rotation.y = R() * TAU; group.add(d); };
  put(cubeDie(0.06, '#b8693a', '#3a1a0a'), -0.24, 0.06);
  put(cubeDie(0.052, '#a95e33', '#2e1408'), -0.12, -0.08);
  put(cubeDie(0.056, '#c27a48', '#3a1a0a'), -0.02, 0.1);
  put(cubeDie(0.045, '#3c2a1c', '#e8d8b0'), 0.16, -0.06);
  put(cubeDie(0.045, '#45301f', '#e8d8b0'), 0.25, 0.07);
  const counter = new THREE.ConeGeometry(0.018, 0.04, 14);
  const cm = new THREE.MeshStandardMaterial({ color: 0x2a201a, roughness: 0.5 });
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(counter, cm); c.position.set(0.12 + (i % 3) * 0.05, TOP + 0.022, 0.18 + ((i / 3) | 0) * 0.05); group.add(c); }
  group.userData.display = group.children.slice(n0 + 1); // the dice and counters, not the cloth
  return TOP + 0.002;
}
function buildPetteia(group) {
  // The board's size is unknown: this is a guess, a stone slab cut into an 8 x 8 grid.
  const W = 0.62;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, W), new THREE.MeshStandardMaterial({ color: 0xb8ad98, roughness: 0.9 }));
  slab.position.y = TOP + 0.025; group.add(slab);
  topPlane(group, W, W, TOP + 0.0505, tex(512, 512, (g, w) => {
    g.fillStyle = '#bdb29c'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(80,70,55,${rand(0.03, 0.12)})`; g.fillRect(rand(0, w), rand(0, w), rand(1, 6), rand(1, 6)); }
    g.strokeStyle = 'rgba(60,50,38,.75)'; g.lineWidth = 3;
    const m = 36, c = (w - 2 * m) / 8;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(m, m + i * c); g.lineTo(w - m, m + i * c); g.stroke(); g.beginPath(); g.moveTo(m + i * c, m); g.lineTo(m + i * c, w - m); g.stroke(); }
  }), { roughness: 0.9 });
  const peb = new THREE.SphereGeometry(0.022, 14, 10);
  const mats = [new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.45 })];
  const R = seeded(442);
  const at = (r, cc) => [(cc - 3.5) * (W - 0.088) / 8, (r - 3.5) * (W - 0.088) / 8];
  const taken = new Set();
  for (const [pl, rows] of [[0, [6, 7]], [1, [0, 1]]]) for (const r of rows) for (let k = 0; k < 8; k++) {
    let rr = r, cc = k;
    if (R() < 0.22) { rr += pl ? 2 + ((R() * 2) | 0) : -2 - ((R() * 2) | 0); }
    if (taken.has(rr * 8 + cc) || R() < 0.12) continue; taken.add(rr * 8 + cc);
    const m = new THREE.Mesh(peb, mats[pl]); m.scale.y = 0.55; const [x, z] = at(rr, cc);
    m.position.set(x + (R() - 0.5) * 0.008, TOP + 0.062, z + (R() - 0.5) * 0.008); group.add(m);
  }
}
function buildLiubo(group) {
  const W = 0.56;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, W), new THREE.MeshStandardMaterial({ color: 0x1c100c, roughness: 0.35 }));
  board.position.y = TOP + 0.03; group.add(board);
  topPlane(group, W, W, TOP + 0.0605, tex(512, 512, (g, w) => {
    g.fillStyle = '#1c100c'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#b8402a'; g.lineWidth = 7; g.lineCap = 'square';
    const m = 40, inner = 150;
    g.strokeRect(m, m, w - 2 * m, w - 2 * m);
    g.strokeRect(inner, inner, w - 2 * inner, w - 2 * inner);
    const c = w / 2;
    // T marks on the central square, L marks on the edges, V marks at the corners.
    for (let k = 0; k < 4; k++) {
      g.save(); g.translate(c, c); g.rotate(k * Math.PI / 2);
      g.beginPath(); g.moveTo(0, -(c - inner)); g.lineTo(0, -(c - inner) - 34); g.moveTo(-24, -(c - inner) - 34); g.lineTo(24, -(c - inner) - 34); g.stroke();
      g.beginPath(); g.moveTo(-26, -(c - m)); g.lineTo(-26, -(c - m) + 34); g.lineTo(8, -(c - m) + 34); g.stroke();
      g.beginPath(); g.moveTo(-(c - m) + 30, -(c - m) + 74); g.lineTo(-(c - m) + 30, -(c - m) + 30); g.lineTo(-(c - m) + 74, -(c - m) + 30); g.stroke();
      g.restore();
    }
    g.fillStyle = '#b8402a'; for (const [x, y] of [[c - 60, c - 60], [c + 60, c - 60], [c - 60, c + 60], [c + 60, c + 60]]) { g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); }
  }), { roughness: 0.3 });
  const piece = new THREE.BoxGeometry(0.03, 0.026, 0.022);
  const mats = [new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0x141010, roughness: 0.35 })];
  for (const [pl, z] of [[0, 0.2], [1, -0.2]]) for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(piece, mats[pl]); m.position.set((k - 2.5) * 0.06, TOP + 0.074, z + (k % 2 ? 0.012 : -0.012)); group.add(m);
  }
  // One piece stood on end: an 'owl'.
  const owl = new THREE.Mesh(piece, mats[0]); owl.rotation.z = Math.PI / 2; owl.position.set(0.05, TOP + 0.076, 0.06); group.add(owl);
  const stick = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 10, 1, false, 0, Math.PI);
  const sm = new THREE.MeshStandardMaterial({ color: 0x8a6030, roughness: 0.6, side: THREE.DoubleSide });
  // Six throwing sticks laid side by side, flat face down.
  for (let k = 0; k < 6; k++) { const st = new THREE.Mesh(stick, sm); st.rotation.set(-Math.PI / 2, 0, 0); st.position.set(W / 2 + 0.06 + k * 0.022, TOP, 0); group.add(st); }
}
// The 52 houses of the patolli mat in circuit order, clockwise, starting at the visitor's centre house.
// The mat is drawn rotated 45 degrees; each arm is two lanes of six houses.
const PT_W = 0.84;
const ptHouses = (() => {
  const px = 1024, c = px / 2, sq = 50, rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const at = (k, j, i) => { let [x, y] = [j * sq + sq / 2, i * sq + sq / 2]; if (k >= 0) [x, y] = rot(x, y, k * Math.PI / 2); [x, y] = rot(x, y, Math.PI / 4); return [(c + x) / px * PT_W - PT_W / 2, (c + y) / px * PT_W - PT_W / 2]; };
  const centres = [[-1, -1], [-1, 0], [0, -1], [0, 0]].map(([j, i]) => at(-1, j, i));
  const cells = [];
  for (let k = 0; k < 4; k++) {
    for (let i = 1; i <= 6; i++) cells.push(at(k, 0, i));
    for (let i = 6; i >= 1; i--) cells.push(at(k, -1, i));
    cells.push(null);
  }
  for (let n = 0; n < cells.length; n++) if (!cells[n]) {
    const a = cells[n - 1], b = cells[(n + 1) % cells.length];
    cells[n] = centres.reduce((best, ce) => { const d = Math.hypot(ce[0] - a[0], ce[1] - a[1]) + Math.hypot(ce[0] - b[0], ce[1] - b[1]); return d < best[0] ? [d, ce] : best; }, [1e9, null])[1];
  }
  return [cells[51], ...cells.slice(0, 51)];
})();
const ptStoneGeo = new THREE.SphereGeometry(0.017, 14, 10);
function ptStone(pl) { const m = new THREE.MeshStandardMaterial({ color: pl ? 0x2a4a8a : 0xa8322a, roughness: 0.45 }); const o = new THREE.Mesh(ptStoneGeo, m); o.scale.y = 0.6; o.userData.mats = [m]; return o; }
function buildPatolli(group) {
  const W = PT_W;
  const px = 1024;
  topPlane(group, W, W, TOP + 0.004, tex(px, px, (g, w) => {
    // A reed mat, with the X-shaped track of 52 houses painted on it.
    g.fillStyle = '#c8a86a'; g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 10) { g.fillStyle = y % 20 ? 'rgba(120,85,40,.25)' : 'rgba(255,240,200,.12)'; g.fillRect(0, y, w, 5); }
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(90,60,25,.25)'; g.fillRect(x, 0, 3, w); }
    const c = w / 2, sq = 50;
    g.save(); g.translate(c, c); g.rotate(Math.PI / 4);
    g.strokeStyle = '#2a1a0a'; g.lineWidth = 7;
    const cell = (x, y, fill) => { g.fillStyle = fill || '#ead6a4'; g.fillRect(x, y, sq, sq); g.strokeRect(x, y, sq, sq); };
    for (let k = 0; k < 4; k++) {
      g.save(); g.rotate(k * Math.PI / 2);
      for (let i = 1; i <= 6; i++) for (const j of [-1, 0]) {
        const fill = i === 6 ? '#8a2a1c' : i === 4 ? '#2a1a0a' : null;
        cell(j * sq, i * sq, fill);
      }
      g.restore();
    }
    for (const j of [-1, 0]) for (const i of [-1, 0]) cell(j * sq, i * sq, '#d8b878');
    g.restore();
  }), { roughness: 0.95 });
  const shown = [];
  const bean = new THREE.SphereGeometry(0.014, 12, 8);
  const bm = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.5 }), wm = new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.5 });
  const R = seeded(1521);
  for (let k = 0; k < 5; k++) {
    const b = new THREE.Mesh(bean, bm); b.scale.set(1.3, 0.6, 0.9); b.position.set(0.3 + R() * 0.08, TOP + 0.013, 0.24 + k * 0.03); b.rotation.y = R() * TAU; group.add(b);
    if (R() < 0.5) { const dot = new THREE.Mesh(new THREE.CircleGeometry(0.005, 10), wm); dot.rotation.x = -Math.PI / 2; dot.position.set(b.position.x, TOP + 0.022, b.position.z); group.add(dot); }
  }
  for (let pl = 0; pl < 2; pl++) for (let k = 0; k < 6; k++) {
    const m = ptStone(pl); m.position.set((pl ? 0.33 : -0.33) + (k % 2) * 0.035, TOP + 0.014, -0.3 + ((k / 2) | 0) * 0.035); group.add(m); shown.push(m);
  }
  group.userData.display = shown;
  return TOP + 0.014;
}

