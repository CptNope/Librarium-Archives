/* --- Backfill tables: Alquerque, Xiangqi, Snakes and Ladders */
const AQ_S = 0.15;
function aqCell(i) { const r = (i / 5) | 0, c = i % 5; return { x: (c - 2) * AQ_S, z: (2 - r) * AQ_S }; }
function buildAlquerque(group) {
  const W = 4 * AQ_S + 0.16;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.035, W), new THREE.MeshStandardMaterial({ color: 0x6a4424, roughness: 0.55 }));
  board.position.y = TOP + 0.0175; group.add(board);
  const px = 1024, sc = px / W, o = px / 2 - 2 * AQ_S * sc, st = AQ_S * sc;
  topPlane(group, W, W, TOP + 0.0355, tex(px, px, (g) => {
    woodGrain(g, px, px, '#b98a52', '#6a4424');
    g.strokeStyle = '#2a170b'; g.lineWidth = 6; g.lineCap = 'round';
    const P = (r, c) => [o + c * st, o + (4 - r) * st];
    const line = (a, b) => { g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.stroke(); };
    for (let k = 0; k < 5; k++) { line([k, 0], [k, 4]); line([0, k], [4, k]); }
    line([0, 0], [4, 4]); line([0, 4], [4, 0]); line([2, 0], [0, 2]); line([0, 2], [2, 4]); line([2, 4], [4, 2]); line([4, 2], [2, 0]);
    g.fillStyle = '#2a170b';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const [x, y] = P(r, c); g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill(); }
  }), { roughness: 0.55 });
  return TOP + 0.036;
}
const XQ_S = 0.068;
function xqCell(i) { const r = (i / 9) | 0, c = i % 9; return { x: (c - 4) * XQ_S, z: (4.5 - r) * XQ_S }; }
const XQ_CHARS = [[null, '帥', '仕', '相', '傌', '俥', '炮', '兵'], [null, '將', '士', '象', '馬', '車', '砲', '卒']];
const XQ_LATIN = [null, 'G', 'A', 'E', 'H', 'R', 'C', 'S'];
const xqTexCache = {};
function xqFace(pl, t) {
  const key = pl * 8 + t;
  if (!xqTexCache[key]) xqTexCache[key] = tex(128, 128, (g, w) => {
    g.fillStyle = '#efe2c2'; g.fillRect(0, 0, w, w);
    const ink = pl ? '#1a1a1a' : '#b0201a';
    g.strokeStyle = ink; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke();
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 64px "Noto Serif CJK SC","Noto Sans CJK SC","Songti SC","SimSun","PingFang SC","Microsoft YaHei",serif';
    g.fillText(XQ_CHARS[pl][t], 64, 62);
    g.font = '600 15px "Montserrat",sans-serif'; g.fillText(XQ_LATIN[t], 64, 106); // a small letter for readers without Chinese fonts
  });
  return xqTexCache[key];
}
const xqDiscGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.016, 32);
const xqSideMat = new THREE.MeshStandardMaterial({ color: 0xd8c49a, roughness: 0.5 });
function xqPiece(pl, t) {
  const top = new THREE.MeshStandardMaterial({ map: xqFace(pl, t), roughness: 0.45 });
  const m = new THREE.Mesh(xqDiscGeo, [xqSideMat, top, xqSideMat]);
  m.userData.mats = [top]; m.userData.pl = pl; m.userData.t = t;
  return m;
}
function buildXiangqi(group) {
  const W = 8 * XQ_S + 0.12, D = 9 * XQ_S + 0.12;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.035, D), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.5 }));
  board.position.y = TOP + 0.0175; group.add(board);
  const pw = 1024, ph = Math.round(pw * D / W), sc = pw / W, ox = pw / 2 - 4 * XQ_S * sc, oy = ph / 2 - 4.5 * XQ_S * sc, st = XQ_S * sc;
  topPlane(group, W, D, TOP + 0.0355, tex(pw, ph, (g) => {
    woodGrain(g, pw, ph, '#e0b878', '#8a5a2a');
    g.strokeStyle = '#3a1a0a'; g.lineWidth = 4;
    const P = (r, c) => [ox + c * st, oy + (9 - r) * st];
    const line = (a, b) => { g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.stroke(); };
    for (let r = 0; r < 10; r++) line([r, 0], [r, 8]);
    for (let c = 0; c < 9; c++) { if (c === 0 || c === 8) line([0, c], [9, c]); else { line([0, c], [4, c]); line([5, c], [9, c]); } }
    line([0, 3], [2, 5]); line([0, 5], [2, 3]); line([7, 3], [9, 5]); line([7, 5], [9, 3]);
    g.lineWidth = 8; g.strokeRect(ox - 10, oy - 10, 8 * st + 20, 9 * st + 20);
    g.fillStyle = '#3a1a0a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${(st * 0.55) | 0}px "Noto Serif CJK SC","Songti SC","SimSun",serif`;
    const [, ry] = P(4.5, 0);
    g.fillText('楚 河', ox + 2 * st, ry); g.fillText('漢 界', ox + 6 * st, ry);
  }), { roughness: 0.5 });
  return TOP + 0.036;
}
const SL_S = 0.074;
function slCell(n) { // squares 1-100 in rows of ten, turning at each end; 0 is the start, off the near-left corner
  if (n === 0) return { x: -5.2 * SL_S, z: 5.0 * SL_S };
  const r = ((n - 1) / 10) | 0, k = (n - 1) % 10, c = r % 2 ? 9 - k : k;
  return { x: (c - 4.5) * SL_S, z: (4.5 - r) * SL_S };
}
function buildSnakesBoard(group) {
  const W = 10 * SL_S + 0.06;
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(W, 0.012, W), new THREE.MeshStandardMaterial({ color: 0x7a2a1c, roughness: 0.85 }));
  cloth.position.y = TOP + 0.006; group.add(cloth);
  const G = window.LibrariumRules.snakes, px = 1024, sc = px / W, o = px / 2 - 5 * SL_S * sc, cs = SL_S * sc;
  const P = n => { const c = slCell(n); return [px / 2 + c.x * sc, px / 2 + c.z * sc]; };
  topPlane(group, W, W, TOP + 0.0125, tex(px, px, (g) => {
    g.fillStyle = '#7a2a1c'; g.fillRect(0, 0, px, px);
    const tones = ['#f1dfae', '#e8c98a', '#f3d9a0', '#e2bd7c'];
    for (let n = 1; n <= 100; n++) {
      const [x, y] = P(n);
      g.fillStyle = n === 100 ? '#f7efd8' : tones[(n * 7) % 4]; g.fillRect(x - cs / 2, y - cs / 2, cs, cs);
      g.strokeStyle = 'rgba(90,40,20,.6)'; g.lineWidth = 1.5; g.strokeRect(x - cs / 2, y - cs / 2, cs, cs);
      g.fillStyle = '#5a2a14'; g.font = `600 ${(cs * 0.22) | 0}px "Montserrat",sans-serif`; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(String(n), x - cs / 2 + 4, y - cs / 2 + 3);
      const label = (G.LADDERS[n] || G.SNAKES[n] || [])[1];
      if (label) { g.font = `${(cs * 0.16) | 0}px "Amethysta",serif`; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillStyle = G.LADDERS[n] ? '#2a5a2a' : '#7a1a1a'; g.fillText(label, x, y + cs / 2 - 3, cs - 6); }
      if (n === 100) { g.font = `${(cs * 0.17) | 0}px "Amethysta",serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#7a4a10'; g.fillText('Liberation', x, y + 6, cs - 6); }
    }
    // Ladders: two rails and rungs. Snakes: a curving body with a head.
    for (const [a, [b]] of Object.entries(G.LADDERS)) {
      const [x1, y1] = P(+a), [x2, y2] = P(b), dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L * 11, ny = dx / L * 11;
      g.strokeStyle = '#6a4220'; g.lineWidth = 5;
      for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(x1 + nx * sgn, y1 + ny * sgn); g.lineTo(x2 + nx * sgn, y2 + ny * sgn); g.stroke(); }
      g.lineWidth = 4; for (let t = 0.08; t < 1; t += 22 / L) { g.beginPath(); g.moveTo(x1 + dx * t - nx, y1 + dy * t - ny); g.lineTo(x1 + dx * t + nx, y1 + dy * t + ny); g.stroke(); }
    }
    for (const [a, [b]] of Object.entries(G.SNAKES)) {
      const [x1, y1] = P(+a), [x2, y2] = P(b), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
      const c1 = [mx - dy * 0.25 + dx * -0.15, my + dx * 0.25 + dy * -0.15], c2 = [mx + dy * 0.25 + dx * 0.15, my - dx * 0.25 + dy * 0.15];
      g.lineCap = 'round';
      for (const [w, col] of [[16, '#1e3a1a'], [11, '#4a8a3a']]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], x2, y2); g.stroke(); }
      g.fillStyle = '#1e3a1a'; g.beginPath(); g.ellipse(x1, y1, 13, 10, Math.atan2(dy, dx), 0, TAU); g.fill();
      g.fillStyle = '#e8d070'; g.beginPath(); g.arc(x1 - 3, y1 - 3, 2.5, 0, TAU); g.fill();
    }
  }), { roughness: 0.85 });
  // A die on the cloth beside the board.
  const d = cubeDie(0.03, '#efe6d2', '#2a1a10'); d.position.set(W / 2 + 0.08, TOP + 0.015, -0.1); d.rotation.y = 0.4; group.add(d);
  return TOP + 0.013;
}

