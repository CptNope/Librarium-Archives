/* --- Card batch five: Primero (Wing IV), Faro (Wing IV), Pope Joan (Wing IV) and Ma Diao (Wing VI). */

/* Counters, checks and stakes. Every chip on a table is one instance of a single mesh, so a table full of them
 * is one draw call (the threejs-performance skill's instancing). A ChipSet is laid out from a list of stacks:
 * { x, z, n, col } with col an index into CHIP_COLS; y is the table top. */
const CHIP_COLS = [0xe8dcc0, 0xb84a2a, 0x2a4a7a, 0x2f6b2a, 0xc8901e, 0x1c1c1c];
const CHIP_H = 0.0032, chipGeo = new THREE.CylinderGeometry(0.015, 0.015, CHIP_H - 0.0002, 18);
const chipMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
function chipSet(group, max = 240) {
  const m = new THREE.InstancedMesh(chipGeo, chipMat, max);
  // The colour buffer is made at full size before the count drops to nothing (setColorAt sizes it by count).
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  m.count = 0; m.frustumCulled = false; group.add(m);
  const mat = new THREE.Matrix4(), col = new THREE.Color();
  m.userData.lay = (stacks, y) => {
    let i = 0;
    for (const s of stacks) for (let k = 0; k < s.n && i < max; k++, i++) {
      // A little wobble, so a stack looks counted out by hand.
      const j = ((i * 7919) % 13) / 13 - 0.5;
      mat.makeTranslation(s.x + j * 0.0015, y + CHIP_H / 2 + k * CHIP_H, s.z + ((i * 104729) % 11 / 11 - 0.5) * 0.0015);
      m.setMatrixAt(i, mat); m.setColorAt(i, col.setHex(CHIP_COLS[s.col || 0]));
    }
    m.count = i; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  };
  return m;
}
// A pile of n counters as stacks of up to ten, side by side.
function chipStacks(x, z, n, col, dx = 0.033) {
  const out = []; for (let k = 0; n > 0; k++) { out.push({ x: x + (k % 4) * dx, z: z + Math.floor(k / 4) * dx, n: Math.min(10, n), col }); n -= 10; }
  return out;
}

// Primero: an Elizabethan card party for two. On display, a prime (one card of each suit) beside a fifty-five,
// the pot between them, and each player's counters.
function buildPrimero(group) {
  const y = cardTable(group, ['#24452c', '#1f3c26', '#2c5034', '#1a3420']), shown = [];
  const put = (c, x, z, ry, down) => { const m = crCard(c, c, 'french'); m.position.set(x, y + 0.001 + shown.length * 0.0002, z); m.rotation.set(0, ry, down ? Math.PI : 0); group.add(m); shown.push(m); return m; };
  [6, 13 + 5, 26 + 0, 39 + 6].forEach((c, i) => put(c, -0.12 + i * 0.07, 0.3, 0, false)); // a prime: seven, six, ace, seven
  [0, 5, 6, 13 + 11].forEach((c, i) => put(c, -0.12 + i * 0.07, -0.3, Math.PI, i === 3)); // a fifty-five in spades
  for (let k = 0; k < 10; k++) put(0, -0.46, 0.0 + k * 0.0002, Math.PI / 2, true);
  const chips = chipSet(group, 80); chips.userData.lay([...chipStacks(-0.03, -0.02, 9, 4), ...chipStacks(0.3, 0.18, 26, 0), ...chipStacks(-0.36, -0.2, 22, 1)], y);
  shown.push(chips);
  group.userData.display = shown;
  return y;
}

/* Ma Diao: the forty money cards of late Ming China. Long, narrow cards, as the real ones were. The faces are
 * our own drawings: a coin with a square hole for Cash, a string of coins for Strings, the character for ten
 * thousand for Myriads and Tens, and a figure for the high cards, which on real packs show the heroes of the
 * Water Margin. The ten cards that score bonuses carry red. Where the visitor's computer has no Chinese font,
 * the numbers are written in Western figures instead. */
const MD_W = 0.036, MD_H = 0.104;
const mdGeo = new THREE.BoxGeometry(MD_W, 0.0016, MD_H);
const mdBackMat = new THREE.MeshStandardMaterial({ roughness: 0.6, map: cardTex((g, w, h) => {
  g.fillStyle = '#2a1a10'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8901e'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
  g.strokeStyle = 'rgba(200,144,30,.5)'; g.lineWidth = 2; for (let y = 24; y < h - 12; y += 22) { g.beginPath(); g.arc(w / 2, y, 7, 0, TAU); g.stroke(); }
}, 90, 260) });
const MD_RED = new Set([39, 38, 37, 29, 28, 20, 19, 11, 10, 0]);
let mdCJK = null;
function mdHasCJK() { // does a Chinese font exist here? Draw 萬 and an unassigned code point; if they match, no.
  if (mdCJK !== null) return mdCJK;
  try {
    const c = document.createElement('canvas'); c.width = 40; c.height = 40; const g = c.getContext('2d');
    const draw = ch => { g.clearRect(0, 0, 40, 40); g.font = '32px serif'; g.fillStyle = '#000'; g.fillText(ch, 2, 32); return g.getImageData(0, 0, 40, 40).data.join(','); };
    mdCJK = draw('萬') !== draw('￿') && draw('萬') !== draw('͸');
  } catch (e) { mdCJK = false; }
  return mdCJK;
}
const MD_DIGIT = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function mdCoin(g, x, y, r, col) {
  g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(30,18,8,.8)'; g.lineWidth = Math.max(1, r * 0.12); g.stroke();
  g.fillStyle = '#f2e8cf'; g.fillRect(x - r * 0.32, y - r * 0.32, r * 0.64, r * 0.64);
}
function mdFigure(g, x, y, s, col) { // a hero, our own simple figure: head, topknot, robe, a staff
  g.save(); g.translate(x, y); g.fillStyle = col; g.strokeStyle = 'rgba(30,18,8,.85)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-s * 0.42, s * 0.6); g.quadraticCurveTo(-s * 0.4, -s * 0.05, 0, -s * 0.08); g.quadraticCurveTo(s * 0.4, -s * 0.05, s * 0.42, s * 0.6); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ecd2ae'; g.beginPath(); g.arc(0, -s * 0.26, s * 0.17, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = '#1c1c1c'; g.beginPath(); g.arc(0, -s * 0.46, s * 0.07, 0, TAU); g.fill();
  g.strokeStyle = '#5a3a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(s * 0.5, -s * 0.5); g.lineTo(s * 0.3, s * 0.6); g.stroke();
  g.restore();
}
const mdFaceCache = new Map();
function mdFace(c) {
  if (mdFaceCache.has(c)) return mdFaceCache.get(c);
  const R = window.LibrariumRules.madiao, su = R.suit(c), p = R.power(c), red = MD_RED.has(c), cjk = mdHasCJK();
  const ink = '#1c120a', hi = red ? '#a3261e' : ink;
  const map = cardTex((g, w, h) => {
    g.fillStyle = '#f2e8cf'; g.fillRect(0, 0, w, h); speckle(g, w, h, 90, ['#d9c89e'], 1);
    g.strokeStyle = red ? '#a3261e' : '#3a2a1a'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
    const word = (txt, y, size, col = hi) => { g.fillStyle = col; g.font = `700 ${size}px ${cjk ? '"Noto Serif SC","Songti SC","SimSun","Noto Sans CJK SC",serif' : '"Montserrat",sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, y); };
    if (su === 0) { // Cash
      const n = [9, 8, 7, 6, 5, 4, 3, 2, 1][p];
      if (p === 10) { word(cjk ? '空' : '0', 40, 30); mdFigure(g, w / 2, 160, 70, '#a3261e'); word(cjk ? '空湯' : 'ZERO', 238, 18); }
      else if (p === 9) { word(cjk ? '半' : '½', 40, 30); g.strokeStyle = '#2f6b2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, 220); g.quadraticCurveTo(w / 2 - 20, 150, w / 2 + 6, 90); g.stroke(); g.fillStyle = '#b3261e'; for (const [dx, dy] of [[-12, 110], [14, 130], [-8, 160], [10, 185]]) { g.beginPath(); g.arc(w / 2 + dx, dy, 7, 0, TAU); g.fill(); } }
      else {
        word(cjk ? MD_DIGIT[n] + '文' : n + ' cash', 30, cjk ? 22 : 15);
        for (let i = 0; i < n; i++) { const col = n > 4 ? 2 : 1, row = Math.floor(i / col), k = i % col; mdCoin(g, n > 4 ? w / 2 + (k ? 16 : -16) : w / 2, 70 + row * (n > 4 ? 40 : 46), 14, red ? '#c8901e' : '#b88a3a'); }
      }
    } else if (su === 1) { // Strings: a cord of coins
      const n = p + 1;
      word(cjk ? MD_DIGIT[n] + '索' : n + ' strings', 30, cjk ? 22 : 15);
      const cols = n > 5 ? 2 : 1;
      for (let k = 0; k < cols; k++) {
        const x = cols > 1 ? w / 2 + (k ? 16 : -16) : w / 2, cnt = cols > 1 ? (k ? Math.floor(n / 2) : Math.ceil(n / 2)) : n;
        g.strokeStyle = '#5a3a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 56); g.lineTo(x, 236); g.stroke();
        for (let i = 0; i < cnt; i++) mdCoin(g, x, 66 + i * (166 / Math.max(cnt, 1)), 9, red ? '#c8901e' : '#a87a3a');
      }
    } else if (su === 2) { // Myriads: the numeral over 萬, with a figure
      const n = p + 1;
      word(cjk ? MD_DIGIT[n] : String(n), 34, 28);
      mdFigure(g, w / 2, 140, 64, red ? '#a3261e' : '#2a4a7a');
      word(cjk ? '萬' : '×10,000', 230, cjk ? 30 : 13);
    } else { // Tens of myriads
      const lab = cjk ? [...'二三四五六七八九'].map(d => d + '十')[p] || ['百', '千', '萬'][p - 8] : ['20', '30', '40', '50', '60', '70', '80', '90', 'Hundred', 'Thousand', 'Myriad'][p];
      word(lab, 34, cjk ? 24 : (p >= 8 ? 13 : 24));
      mdFigure(g, w / 2, 140, 70, red ? '#a3261e' : '#2f6b2a');
      word(cjk ? '萬' : 'myriads', 230, cjk ? 30 : 14);
    }
  }, 90, 260);
  mdFaceCache.set(c, map);
  return map;
}
function mdCard(c) { const face = new THREE.MeshStandardMaterial({ map: mdFace(c), roughness: 0.55 }); const m = new THREE.Mesh(mdGeo, [tcEdgeMat, tcEdgeMat, face, mdBackMat, tcEdgeMat, tcEdgeMat]); m.userData.mats = [face]; m.userData.c = c; return m; }
function mdHandSpot(seat, i, n, y) {
  if (seat === 0) return V3((i - (n - 1) / 2) * 0.042, y + i * 0.0004, 0.36);
  const t = (i - (n - 1) / 2) * 0.026;
  if (seat === 2) return V3(-t, y + i * 0.0004, -0.36);
  return seat === 1 ? V3(-0.44, y + i * 0.0004, t) : V3(0.44, y + i * 0.0004, -t);
}
function mdTrickSpot(seat, y) { return [V3(0, y, 0.12), V3(-0.12, y, 0), V3(0, y, -0.12), V3(0.12, y, 0)][seat]; }
// A banker's token: a lacquered disc with a gold rim, in front of the banker.
function mdBankerToken() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 24), new THREE.MeshStandardMaterial({ color: 0x8a1e14, roughness: 0.3 }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0025, 6, 24), new THREE.MeshStandardMaterial({ color: 0xc8901e, roughness: 0.35, metalness: 0.4 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.003; g.add(disc, rim); return g;
}
function mdBankerSpot(seat, y) { return [V3(-0.24, y, 0.26), V3(-0.3, y, -0.24), V3(0.24, y, -0.26), V3(0.3, y, 0.24)][seat]; }
function buildMadiao(group) {
  // A square table in red-brown lacquer, without a cloth.
  const W = 1.08, top = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, W * 0.92), new THREE.MeshStandardMaterial({ color: 0x1c0604, roughness: 0.3, metalness: 0.05 }));
  top.position.y = TOP + 0.015; group.add(top);
  const inlay = new THREE.Mesh(new THREE.BoxGeometry(W - 0.08, 0.002, W * 0.92 - 0.08), new THREE.MeshStandardMaterial({ color: 0x120304, roughness: 0.4 }));
  inlay.position.y = TOP + 0.0305; group.add(inlay);
  const y = TOP + 0.032, shown = [];
  const put = (c, at, ry, down) => { const m = mdCard(c); m.position.copy(at); m.position.y += shown.length * 0.0002; m.rotation.set(0, ry, down ? Math.PI : 0); group.add(m); shown.push(m); return m; };
  // The four top cards face up: Zero Cash, 9 Strings, 9 Myriads, Myriad Myriads; and the Hundred Myriads.
  [10, 19, 28, 39, 37].forEach((c, i) => put(c, V3((i - 2) * 0.05, y + 0.001, 0.02), (i - 2) * -0.05, false));
  for (let s = 0; s < 4; s++) for (let i = 0; i < 8; i++) put(0, mdHandSpot(s, i, 8, y + 0.001), WS_YAW[s], true);
  for (let k = 0; k < 8; k++) put(0, V3(0.4, y + 0.001 + k * 0.0016, -0.34), 0.3, true);
  const tok = mdBankerToken(); tok.position.copy(mdBankerSpot(0, y + 0.003)); group.add(tok); shown.push(tok);
  group.userData.display = shown;
  return y;
}

/* Pope Joan: the board. Victorian boards were round, turned and lacquered, often revolving, with eight wells
 * round a centre. Ours is our own: a lacquered tray with eight compartments, each painted with its name. */
const PJ_BOARD_R = 0.17;
function buildPjBoard(group, y) {
  const R = PJ_BOARD_R, wood = new THREE.MeshStandardMaterial({ color: 0x2a0e08, roughness: 0.25, metalness: 0.05 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.006, 0.014, 48), wood); base.position.y = y + 0.007; group.add(base);
  const names = ['Pope', 'Matrimony', 'Intrigue', 'Ace', 'King', 'Queen', 'Jack', 'Game'];
  const face = new THREE.Mesh(new THREE.CircleGeometry(R - 0.008, 48), new THREE.MeshStandardMaterial({ roughness: 0.4, map: tex(512, 512, (g, w, h) => {
    const cx = w / 2, cy = h / 2, r = w / 2;
    g.fillStyle = '#1a0a06'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 8; k++) {
      // Each well: a sector in its own colour, the name painted along it in gold.
      const a0 = (k / 8) * TAU, a1 = ((k + 1) / 8) * TAU;
      g.fillStyle = k % 2 ? '#5a1a14' : '#1e3a2a'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r - 6, a0 - Math.PI / 2, a1 - Math.PI / 2); g.closePath(); g.fill();
      g.strokeStyle = '#c8901e'; g.lineWidth = 6; g.stroke();
      const am = (a0 + a1) / 2 - Math.PI / 2;
      g.save(); g.translate(cx + Math.cos(am) * r * 0.82, cy + Math.sin(am) * r * 0.82); g.rotate(am + Math.PI / 2);
      g.fillStyle = '#e8c45a'; g.font = '600 34px "Almendra SC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(names[k], 0, 0); g.restore();
    }
    g.fillStyle = '#2a0e08'; g.beginPath(); g.arc(cx, cy, r * 0.2, 0, TAU); g.fill(); g.strokeStyle = '#c8901e'; g.lineWidth = 6; g.stroke();
    g.fillStyle = '#e8c45a'; g.font = '600 26px "Almendra SC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Pope Joan', cx, cy);
  }) }));
  // The canvas runs clockwise from the top; lying flat and seen from above, the board must too.
  face.rotation.x = -Math.PI / 2; face.position.y = y + 0.0145; group.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.002, 0.005, 8, 48), new THREE.MeshStandardMaterial({ color: 0xc8901e, roughness: 0.35, metalness: 0.4 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = y + 0.015; group.add(rim);
  return y + 0.015;
}
// The board's compartments in the engine's order (pope, matrimony, intrigue, ace, king, queen, jack, game) are
// painted in that order clockwise from the top; the spot for compartment k is in the middle of its well.
function pjWell(k, y) { const a = (k + 0.5) / 8 * TAU; return V3(Math.sin(a) * PJ_BOARD_R * 0.5, y, -Math.cos(a) * PJ_BOARD_R * 0.5); }
function buildPopejoan(group) {
  const y = cardTable(group, ['#3a2a48', '#33243f', '#433052', '#2c1f38'], 1.1, 0.96), shown = [];
  const by = buildPjBoard(group, y); group.userData.boardY = by;
  const put = (c, at, ry, down) => { const m = crCard(c, c, 'french'); m.position.copy(at); m.position.y += shown.length * 0.0002; m.rotation.set(0, ry, down ? Math.PI : 0); group.add(m); shown.push(m); return m; };
  for (let s = 0; s < 4; s++) for (let i = 0; i < 8; i++) put(0, wsHandSpot(s, i, 8, y + 0.001), WS_YAW[s], true);
  put(2 * 13 + 8, V3(-0.4, y + 0.003, -0.36), 0.2, false); // the Pope, turned up
  for (let k = 0; k < 6; k++) put(0, V3(-0.46, y + 0.001 + k * 0.0016, -0.36), 0.1, true);
  const chips = chipSet(group, 60), dress = [6, 2, 2, 1, 1, 1, 1, 1];
  chips.userData.lay(dress.map((n, k) => { const p = pjWell(k, 0); return { x: p.x, z: p.z, n: n + (k === 1 ? 3 : 0), col: k % 3 }; }), by);
  shown.push(chips);
  group.userData.display = shown;
  return y;
}

/* Faro: the layout, a suit of spades enamelled on the cloth (ace to six in one row, eight to king in the other,
 * the seven at the end), the dealing box, and the case keeper, an abacus with a wire for each rank. */
function faLayoutSpot(r) {
  if (r === 6) return V3(0.29, 0, 0.07);
  return r < 6 ? V3(-0.22 + r * 0.084, 0, 0.13) : V3(-0.22 + (12 - r) * 0.084, 0, 0.01);
}
const FA_HIGH = new THREE.Vector3(0.03, 0, -0.08); // the high card bar
function faBox() { // a dealing box of German silver, open at the top so the next card shows
  const g = new THREE.Group(), metal = new THREE.MeshStandardMaterial({ color: 0xc8c4b8, roughness: 0.3, metalness: 0.7 });
  const W = CR_W + 0.012, D = CR_H + 0.012, H = 0.03;
  for (const [w, d, x, z] of [[W, 0.004, 0, D / 2], [W, 0.004, 0, -D / 2], [0.004, D, W / 2, 0], [0.004, D, -W / 2, 0]]) { const s = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), metal); s.position.set(x, H / 2, z); g.add(s); }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.003, D), metal); floor.position.y = 0.0015; g.add(floor);
  return g;
}
function faCaseKeeper(group, x, z, y) {
  const g = new THREE.Group(); g.position.set(x, y, z); group.add(g);
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.4 }), wire = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, metalness: 0.6, roughness: 0.35 });
  const L = 0.2, Dp = 0.3;
  for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, Dp), wood); rail.position.set(s * L / 2, 0.009, 0); g.add(rail); }
  for (const s of [-1, 1]) { const end = new THREE.Mesh(new THREE.BoxGeometry(L, 0.018, 0.012), wood); end.position.set(0, 0.009, s * Dp / 2); g.add(end); }
  const beadGeo = new THREE.SphereGeometry(0.0062, 10, 8), beadMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.4 });
  const beads = new THREE.InstancedMesh(beadGeo, beadMat, 52); beads.frustumCulled = false; g.add(beads);
  const labels = new THREE.Mesh(new THREE.PlaneGeometry(0.03, Dp - 0.02), new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: true, map: tex(64, 640, (c, w, h) => {
    c.fillStyle = '#e8dcc0'; c.font = '700 26px "Montserrat",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    window.LibrariumRules.faro.SHORT.forEach((t, r) => c.fillText(t, w / 2, (r + 0.5) * h / 13));
  }) }));
  labels.rotation.x = -Math.PI / 2; labels.position.set(-L / 2 - 0.024, 0.002, 0); g.add(labels);
  const rowZ = r => -Dp / 2 + 0.01 + (r + 0.5) * (Dp - 0.02) / 13;
  for (let r = 0; r < 13; r++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, L, 5), wire); w.rotation.z = Math.PI / 2; w.position.set(0, 0.012, rowZ(r)); g.add(w); }
  const m4 = new THREE.Matrix4();
  // Beads still to come sit at the left; one moves right for each card of that rank out of the box.
  g.userData.show = left => {
    let i = 0;
    for (let r = 0; r < 13; r++) for (let k = 0; k < 4; k++, i++) {
      const out = k >= left[r], x = out ? L / 2 - 0.012 - (3 - k) * 0.0128 : -L / 2 + 0.012 + k * 0.0128;
      m4.makeTranslation(x, 0.012, rowZ(r)); beads.setMatrixAt(i, m4);
    }
    beads.instanceMatrix.needsUpdate = true;
  };
  g.userData.show([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
  return g;
}
function buildFaro(group) {
  const y = cardTable(group, ['#1f4a32', '#1a422c', '#24523a', '#173a26'], 1.2, 0.86), shown = [];
  // The layout cards are part of the table, played on, so they are kept (and not merged away).
  const layout = [];
  for (let r = 0; r < 13; r++) { const m = crCard(r, r, 'french'); const at = faLayoutSpot(r); m.position.set(at.x, y + 0.0009, at.z); group.add(m); layout.push(m); }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.002, 0.026), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6, map: tex(512, 32, (g, w, h) => { g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f3a2a'; g.font = '700 20px "Montserrat",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HIGH CARD', w / 2, h / 2 + 1); }) }));
  bar.position.set(FA_HIGH.x, y + 0.001, FA_HIGH.z); group.add(bar);
  const box = faBox(); box.position.set(0, y, -0.3); group.add(box);
  const keeper = faCaseKeeper(group, 0.44, -0.14, y);
  group.userData.layout = layout; group.userData.keeper = keeper; group.userData.box = box;
  // On display: checks on the layout, one bet coppered, a turn showing.
  const chips = chipSet(group, 60); chips.userData.lay([{ x: faLayoutSpot(2).x, z: faLayoutSpot(2).z, n: 3 }, { x: faLayoutSpot(10).x, z: faLayoutSpot(10).z, n: 5, col: 1 }, ...chipStacks(0.3, 0.33, 30, 2)], y + 0.002);
  shown.push(chips);
  const copper = faCopper(); copper.position.set(faLayoutSpot(10).x, y + 0.002 + 5 * CHIP_H + 0.001, faLayoutSpot(10).z); group.add(copper); shown.push(copper);
  const put = (c, x, z) => { const m = crCard(c, c, 'french'); m.position.set(x, y + 0.002 + shown.length * 0.0002, z); group.add(m); shown.push(m); return m; };
  put(13 + 9, -0.12, -0.3); put(39 + 4, 0.12, -0.3);
  group.userData.display = shown;
  return y;
}
// The copper: a hexagonal token laid on a bet to reverse it.
function faCopper() { return new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.002, 6), new THREE.MeshStandardMaterial({ color: 0xb06a3a, roughness: 0.35, metalness: 0.6 })); }
