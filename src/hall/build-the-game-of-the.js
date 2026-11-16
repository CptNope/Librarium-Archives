/* --- Wing IV: the Game of the Goose, a printed spiral */
const GS_S = 0.104;
// Squares 0 (the start) to 63 follow a clockwise spiral of an 8 x 8 grid, from the
// visitor's near-left corner inward, so 63 lands near the middle.
const GOOSE_CELLS = (() => {
  const cells = []; let top = 0, left = 0, bottom = 7, right = 7;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) cells.push([bottom, c]); bottom--;
    for (let r = bottom; r >= top; r--) cells.push([r, right]); right--;
    if (top <= bottom) { for (let c = right; c >= left; c--) cells.push([top, c]); top++; }
    if (left <= right) { for (let r = top; r <= bottom; r++) cells.push([r, left]); left++; }
  }
  return cells;
})();
function gsCell(n) { const [r, c] = GOOSE_CELLS[n]; return { x: (c - 3.5) * GS_S, z: (r - 3.5) * GS_S }; }
const GOOSE_MARKS = { 6: 'bridge', 19: 'inn', 31: 'well', 42: 'maze', 52: 'prison', 58: 'death', 63: 'garden' };
function drawGooseIcon(g, kind, x, y, s) {
  g.save(); g.translate(x, y); g.lineWidth = s * 0.07; g.strokeStyle = '#3a2412'; g.fillStyle = '#3a2412';
  if (kind === 'goose' || kind === 'garden') {
    g.fillStyle = kind === 'garden' ? '#fffaf0' : '#ffffff'; g.strokeStyle = '#3a2412';
    g.beginPath(); g.ellipse(-s * 0.05, s * 0.12, s * 0.28, s * 0.17, 0, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(s * 0.15, s * 0.05); g.quadraticCurveTo(s * 0.26, -s * 0.18, s * 0.16, -s * 0.28); g.stroke();
    g.beginPath(); g.arc(s * 0.16, -s * 0.3, s * 0.07, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#e08a1e'; g.beginPath(); g.moveTo(s * 0.22, -s * 0.31); g.lineTo(s * 0.34, -s * 0.28); g.lineTo(s * 0.22, -s * 0.26); g.fill();
  } else if (kind === 'bridge') {
    g.beginPath(); g.arc(0, s * 0.2, s * 0.32, Math.PI, 0); g.stroke(); g.fillRect(-s * 0.36, s * 0.2, s * 0.72, s * 0.06);
  } else if (kind === 'inn') {
    g.fillStyle = '#8a3a22'; g.beginPath(); g.moveTo(-s * 0.3, 0); g.lineTo(0, -s * 0.3); g.lineTo(s * 0.3, 0); g.fill();
    g.fillStyle = '#c9a26e'; g.fillRect(-s * 0.24, 0, s * 0.48, s * 0.3); g.fillStyle = '#3a2412'; g.fillRect(-s * 0.06, s * 0.1, s * 0.12, s * 0.2);
  } else if (kind === 'well') {
    g.beginPath(); g.ellipse(0, s * 0.1, s * 0.3, s * 0.12, 0, 0, TAU); g.stroke(); g.fillStyle = '#2a4a7a'; g.fill();
    g.beginPath(); g.moveTo(-s * 0.28, s * 0.08); g.lineTo(-s * 0.28, -s * 0.28); g.lineTo(s * 0.28, -s * 0.28); g.lineTo(s * 0.28, s * 0.08); g.stroke();
  } else if (kind === 'maze') {
    for (let k = 1; k <= 3; k++) { const d = s * 0.11 * k; g.strokeRect(-d, -d, 2 * d, 2 * d); }
  } else if (kind === 'prison') {
    g.strokeRect(-s * 0.28, -s * 0.28, s * 0.56, s * 0.56);
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(k * s * 0.13, -s * 0.28); g.lineTo(k * s * 0.13, s * 0.28); g.stroke(); }
  } else if (kind === 'death') {
    g.fillStyle = '#f0e6d2'; g.beginPath(); g.arc(0, -s * 0.06, s * 0.22, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#3a2412'; for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * s * 0.08, -s * 0.08, s * 0.05, 0, TAU); g.fill(); }
    g.fillRect(-s * 0.12, s * 0.12, s * 0.24, s * 0.1);
  }
  g.restore();
}
function buildGooseBoard(group) {
  const W = 8 * GS_S + 0.08;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, W), new THREE.MeshStandardMaterial({ color: 0x4a2c16, roughness: 0.55 }));
  panel.position.y = TOP + 0.015; group.add(panel);
  const px = 1024, sc = px / W, c0 = px / 2 - 4 * GS_S * sc, cs = GS_S * sc;
  const geese = new Set([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);
  const map = tex(px, px, (g) => {
    g.fillStyle = '#efe1bd'; g.fillRect(0, 0, px, px);
    speckle(g, px, px, 2500, ['#c9b383', '#fff8e4'], 1.4);
    for (let n = 0; n <= 63; n++) {
      const [r, c] = GOOSE_CELLS[n], x = c0 + c * cs, y = c0 + r * cs;
      const special = GOOSE_MARKS[n];
      g.fillStyle = n === 0 ? '#d9c08a' : special === 'death' ? '#bfa88a' : special ? '#e8cf9a' : (n % 2 ? '#f4e8c8' : '#ead9b0');
      if (n === 63) g.fillStyle = '#e6c25e';
      g.fillRect(x + 2, y + 2, cs - 4, cs - 4);
      g.strokeStyle = '#7a5a30'; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
      if (geese.has(n)) drawGooseIcon(g, 'goose', x + cs / 2, y + cs / 2 + 6, cs * 0.8);
      else if (special) drawGooseIcon(g, special, x + cs / 2, y + cs / 2 + 6, cs * 0.75);
      g.fillStyle = '#3a2412'; g.font = `${Math.round(cs * 0.24)}px "Almendra SC", Georgia, serif`; g.textAlign = 'left';
      g.fillText(n === 0 ? 'Start' : String(n), x + 7, y + cs * 0.26);
    }
    g.strokeStyle = '#7a5a30'; g.lineWidth = 6; g.strokeRect(c0 - 8, c0 - 8, 8 * cs + 16, 8 * cs + 16);
  });
  topPlane(group, W, W, TOP + 0.0305, map, { roughness: 0.75 });
  return TOP + 0.031;
}
function goosePawn(color) {
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.3 });
  const m = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.024, 0], [0.025, 0.006], [0.014, 0.012], [0.011, 0.04], [0.017, 0.046], [0.012, 0.058], [0, 0.062]].map(([a, b]) => new THREE.Vector2(a, b)), 24), mat);
  m.userData.mats = [mat];
  return m;
}

