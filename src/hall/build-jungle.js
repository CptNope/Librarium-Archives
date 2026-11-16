/* --- Wing VI: Jungle (dou shou qi), on a 7 x 9 board with two rivers */
const JU_S = 0.078;
function juCell(i) { const r = (i / 7) | 0, c = i % 7; return { x: (c - 3) * JU_S, z: (4 - r) * JU_S }; }
const JU_CHARS = [null, '鼠', '貓', '狗', '狼', '豹', '虎', '獅', '象'];
const JU_LATIN = [null, 'RAT', 'CAT', 'DOG', 'WOLF', 'LEOPARD', 'TIGER', 'LION', 'ELEPHANT'];
const juTexCache = {};
function juFace(pl, k) {
  const key = pl * 10 + k;
  if (!juTexCache[key]) juTexCache[key] = tex(128, 128, (g, w) => {
    g.fillStyle = '#f2ead6'; g.fillRect(0, 0, w, w);
    const ink = pl ? '#a8231b' : '#1f4f9a';
    g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 54, 0, TAU); g.stroke();
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 58px "Noto Serif CJK TC","Noto Serif CJK SC","Noto Sans CJK TC","Songti TC","PMingLiU","Microsoft JhengHei",serif';
    g.fillText(JU_CHARS[k], 64, 54);
    g.font = '700 13px "Montserrat",sans-serif'; g.fillText(`${k} ${JU_LATIN[k]}`, 64, 101); // rank and name for readers without Chinese fonts
  });
  return juTexCache[key];
}
const juDiscGeo = new THREE.CylinderGeometry(0.03, 0.031, 0.016, 32);
const juSideMat = [new THREE.MeshStandardMaterial({ color: 0x2c5aa0, roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: 0xa8281e, roughness: 0.45 })];
function juPiece(v) {
  const pl = v > 10 ? 1 : 0, k = v % 10;
  const top = new THREE.MeshStandardMaterial({ map: juFace(pl, k), roughness: 0.45 });
  const m = new THREE.Mesh(juDiscGeo, [juSideMat[pl], top, juSideMat[pl]]);
  m.rotation.y = pl ? Math.PI : 0; // each side reads its own pieces
  m.userData.mats = [top];
  return m;
}
function buildJungle(group) {
  const W = 7 * JU_S + 0.1, D = 9 * JU_S + 0.1;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, D), new THREE.MeshStandardMaterial({ color: 0x3c2a18, roughness: 0.6 }));
  board.position.y = TOP + 0.015; group.add(board);
  const pw = 896, ph = Math.round(pw * D / W), sc = pw / W, st = JU_S * sc, ox = pw / 2 - 3.5 * st, oy = ph / 2 - 4.5 * st;
  const R = window.LibrariumRules.jungle;
  topPlane(group, W, D, TOP + 0.0305, tex(pw, ph, (g) => {
    g.fillStyle = '#3c2a18'; g.fillRect(0, 0, pw, ph);
    for (let i = 0; i < 63; i++) {
      const r = (i / 7) | 0, c = i % 7, x = ox + c * st, y = oy + (8 - r) * st; // canvas y runs down, so row 0 is at the bottom
      g.fillStyle = R.WATER[i] ? '#3f7fae' : (r + c) % 2 ? '#8fae5a' : '#9cba66';
      g.fillRect(x, y, st, st);
      if (R.WATER[i]) { // ripples
        g.strokeStyle = 'rgba(220,240,255,.5)'; g.lineWidth = 3;
        for (const f of [0.35, 0.65]) { g.beginPath(); for (let k = 0; k <= 8; k++) { const xx = x + 8 + k * (st - 16) / 8, yy = y + f * st + Math.sin(k * 1.6) * 4; k ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); }
      }
      if (R.TRAP[i] >= 0) { // a pit of crossed stakes
        g.strokeStyle = '#5a3a1c'; g.lineWidth = 5;
        for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + k * st / 4, y + 10); g.lineTo(x + k * st / 4, y + st - 10); g.moveTo(x + 10, y + k * st / 4); g.lineTo(x + st - 10, y + k * st / 4); g.stroke(); }
      }
      if (R.DEN.includes(i)) {
        g.fillStyle = '#4a2c14'; g.beginPath(); g.ellipse(x + st / 2, y + st * 0.6, st * 0.36, st * 0.28, 0, Math.PI, 0); g.lineTo(x + st * 0.86, y + st * 0.84); g.lineTo(x + st * 0.14, y + st * 0.84); g.closePath(); g.fill();
        g.fillStyle = '#f2ead6'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `bold ${(st * 0.3) | 0}px "Noto Serif CJK TC","Noto Serif CJK SC",serif`; g.fillText('獸穴', x + st / 2, y + st * 0.68);
      }
      g.strokeStyle = 'rgba(40,30,12,.55)'; g.lineWidth = 2; g.strokeRect(x, y, st, st);
    }
    g.strokeStyle = '#21160b'; g.lineWidth = 6; g.strokeRect(ox, oy, 7 * st, 9 * st);
  }), { roughness: 0.65 });
  const y = TOP + 0.031, shown = [];
  R.init(); R.b.forEach((v, i) => { if (!v) return; const p = juPiece(v), c = juCell(i); p.position.set(c.x, y + 0.008, c.z); group.add(p); shown.push(p); });
  group.userData.display = shown;
  return y;
}

