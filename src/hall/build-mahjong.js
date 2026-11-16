/* --- Wing IV: Mahjong (display) */
function mjFace(kind, n) {
  return tex(128, 172, (g, w, h) => {
    g.fillStyle = '#f6f1e4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8cfb8'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    const cols = ['#1e5a8a', '#2a7a3a', '#b23a2a'];
    if (kind === 'dots') {
      const grid = { 1: [[0.5, 0.5]], 2: [[0.5, 0.3], [0.5, 0.7]], 3: [[0.3, 0.25], [0.5, 0.5], [0.7, 0.75]], 4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]], 5: [[0.3, 0.27], [0.7, 0.27], [0.5, 0.5], [0.3, 0.73], [0.7, 0.73]], 6: [[0.3, 0.22], [0.7, 0.22], [0.3, 0.5], [0.7, 0.5], [0.3, 0.78], [0.7, 0.78]] }[n];
      grid.forEach(([x, y], k) => { const r = n === 1 ? 38 : 16; g.fillStyle = cols[k % 3]; g.beginPath(); g.arc(x * w, y * h, r, 0, TAU); g.fill(); g.fillStyle = '#f6f1e4'; g.beginPath(); g.arc(x * w, y * h, r * 0.45, 0, TAU); g.fill(); });
    } else if (kind === 'bamboo') {
      for (let k = 0; k < n; k++) {
        const col = k % 3, row = (k / 3) | 0, x = w * (0.28 + 0.22 * col), y = h * (0.2 + 0.3 * row);
        g.fillStyle = k === 0 && n === 1 ? '#b23a2a' : '#2a7a3a'; g.fillRect(x - 7, y, 14, h * 0.24);
        g.fillStyle = '#f6f1e4'; g.fillRect(x - 7, y + h * 0.11, 14, 3);
      }
    } else if (kind === 'white') {
      g.strokeStyle = '#1e5a8a'; g.lineWidth = 7; g.strokeRect(w * 0.2, h * 0.18, w * 0.6, h * 0.64);
    } else if (kind === 'flower') {
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.fillStyle = '#b23a2a'; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * 20, h / 2 + Math.sin(a) * 20, 16, 10, a, 0, TAU); g.fill(); }
      g.fillStyle = '#e8b23a'; g.beginPath(); g.arc(w / 2, h / 2, 12, 0, TAU); g.fill();
      g.strokeStyle = '#2a7a3a'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, h / 2 + 18); g.lineTo(w / 2 - 10, h * 0.9); g.stroke();
    }
  });
}
function buildMahjong(group) {
  const felt = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.8), new THREE.MeshLambertMaterial({ color: 0x1e4a32 }));
  felt.position.y = TOP + 0.01; group.add(felt);
  const before = group.children.length;
  const tw = 0.034, th = 0.046, td = 0.024;
  const bone = new THREE.MeshStandardMaterial({ color: 0xf2ecdc, roughness: 0.3 });
  const back = new THREE.MeshStandardMaterial({ color: 0x2a7a5a, roughness: 0.35 });
  const geo = new THREE.BoxGeometry(tw, td, th);
  // The wall: two layers of face-down tiles along the back.
  for (let layer = 0; layer < 2; layer++) for (let k = 0; k < 17; k++) {
    const t = new THREE.Mesh(geo, [bone, bone, back, bone, bone, bone]);
    t.position.set((k - 8) * (tw + 0.002), TOP + 0.02 + td / 2 + layer * td, -0.26); group.add(t);
  }
  // A hand of fourteen face-up tiles at the front, standing on edge.
  const hand = [['dots', 1], ['dots', 2], ['dots', 3], ['bamboo', 4], ['bamboo', 5], ['bamboo', 6], ['dots', 5], ['dots', 5], ['dots', 5], ['white', 0], ['white', 0], ['white', 0], ['bamboo', 1], ['bamboo', 1]];
  hand.forEach(([kind, n], k) => {
    const face = new THREE.MeshStandardMaterial({ map: mjFace(kind, n), roughness: 0.3 });
    const t = new THREE.Mesh(new THREE.BoxGeometry(tw, th, td), [bone, bone, bone, bone, face, back]);
    t.position.set((k - 6.5) * (tw + 0.003), TOP + 0.02 + th / 2, 0.2); t.rotation.x = -0.12; group.add(t);
  });
  const flower = new THREE.Mesh(new THREE.BoxGeometry(tw, td, th), [bone, bone, new THREE.MeshStandardMaterial({ map: mjFace('flower', 0), roughness: 0.3 }), bone, bone, bone]);
  flower.position.set(0.42, TOP + 0.02 + td / 2, 0.05); flower.rotation.y = 0.3; group.add(flower);
  for (let k = 0; k < 2; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.018), new THREE.MeshStandardMaterial({ color: 0xf6f1e4, roughness: 0.3 })); d.position.set(-0.4 + k * 0.035, TOP + 0.029, 0.04); d.rotation.y = k * 0.6; group.add(d); }
  glassCase(group, 1.25, 0.3, 0.85);
  group.userData.display = group.children.slice(before); // put away while a hand is played
  return TOP + 0.02;
}
/* Mahjong tiles for the table: every face, with a small corner index for readers of either script. */
const MJ_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const mjTileCache = {};
function mjTile(t) {
  if (mjTileCache[t]) return mjTileCache[t];
  const map = tex(128, 172, (g, w, h) => {
    g.fillStyle = '#f6f1e4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8cfb8'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    const suit = (t / 9) | 0, n = (t % 9) + 1, cols = ['#1e5a8a', '#2a7a3a', '#b23a2a'];
    let idx = '';
    if (t < 9) {
      const grid = { 1: [[0.5, 0.5]], 2: [[0.5, 0.3], [0.5, 0.7]], 3: [[0.3, 0.25], [0.5, 0.5], [0.7, 0.75]], 4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]], 5: [[0.3, 0.27], [0.7, 0.27], [0.5, 0.5], [0.3, 0.73], [0.7, 0.73]], 6: [[0.3, 0.22], [0.7, 0.22], [0.3, 0.5], [0.7, 0.5], [0.3, 0.78], [0.7, 0.78]], 7: [[0.25, 0.18], [0.5, 0.25], [0.75, 0.32], [0.3, 0.6], [0.7, 0.6], [0.3, 0.82], [0.7, 0.82]], 8: [[0.3, 0.16], [0.7, 0.16], [0.3, 0.39], [0.7, 0.39], [0.3, 0.62], [0.7, 0.62], [0.3, 0.85], [0.7, 0.85]], 9: [[0.22, 0.2], [0.5, 0.2], [0.78, 0.2], [0.22, 0.5], [0.5, 0.5], [0.78, 0.5], [0.22, 0.8], [0.5, 0.8], [0.78, 0.8]] }[n];
      const r = n === 1 ? 38 : n <= 6 ? 16 : 12;
      grid.forEach(([x, y], k) => { g.fillStyle = cols[k % 3]; g.beginPath(); g.arc(x * w, y * h, r, 0, TAU); g.fill(); g.fillStyle = '#f6f1e4'; g.beginPath(); g.arc(x * w, y * h, r * 0.45, 0, TAU); g.fill(); });
      idx = String(n);
    } else if (t < 18) {
      if (n === 1) { g.fillStyle = '#2a7a3a'; g.beginPath(); g.ellipse(w / 2, h / 2, 26, 40, 0, 0, TAU); g.fill(); g.fillStyle = '#b23a2a'; g.beginPath(); g.arc(w / 2, h / 2 - 30, 12, 0, TAU); g.fill(); }
      else for (let k = 0; k < n; k++) {
        const per = n <= 3 ? n : n <= 6 ? 3 : 3, rows = Math.ceil(n / per), col = k % per, row = (k / per) | 0;
        const x = w * (0.5 + (col - (Math.min(per, n - row * per) - 1) / 2) * 0.24), y = h * (0.12 + row * (0.76 / rows));
        g.fillStyle = k === 0 && n % 2 ? '#b23a2a' : '#2a7a3a'; g.fillRect(x - 6, y, 12, h * 0.76 / rows - 8);
        g.fillStyle = '#f6f1e4'; g.fillRect(x - 6, y + (h * 0.76 / rows - 8) / 2 - 1, 12, 3);
      }
      idx = String(n);
    } else if (t < 27) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#1a1a1a'; g.font = `600 52px ${W6_CJK}`; g.fillText(MJ_NUM[n - 1], w / 2, h * 0.32);
      g.fillStyle = '#b23a2a'; g.font = `600 56px ${W6_CJK}`; g.fillText('萬', w / 2, h * 0.7);
      idx = String(n);
    } else if (t < 31) {
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1a1a1a'; g.font = `600 78px ${W6_CJK}`;
      g.fillText('東南西北'[t - 27], w / 2, h / 2 + 4); idx = 'ESWN'[t - 27];
    } else if (t === 31) { g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#b23a2a'; g.font = `700 80px ${W6_CJK}`; g.fillText('中', w / 2, h / 2 + 4); idx = 'R'; }
    else if (t === 32) { g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2a7a3a'; g.font = `700 76px ${W6_CJK}`; g.fillText('發', w / 2, h / 2 + 4); idx = 'G'; }
    else { g.strokeStyle = '#1e5a8a'; g.lineWidth = 7; g.strokeRect(w * 0.2, h * 0.18, w * 0.6, h * 0.64); idx = 'W'; }
    g.fillStyle = 'rgba(40,30,20,.75)'; g.font = '700 20px "Montserrat",sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(idx, 9, 8);
  });
  mjTileCache[t] = map; return map;
}

