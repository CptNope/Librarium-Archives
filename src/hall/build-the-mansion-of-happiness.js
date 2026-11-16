/* --- Wing V: The Mansion of Happiness (display) */
// The 67 squares of the 1843 board on a spiral running clockwise and inward from the top left,
// with the Mansion of Happiness in the middle. Positions are in canvas pixels of the board texture.
const MH_W = 0.92, MH_D = 0.74, MH_PX = 2048, MH_PY = Math.round(2048 * 0.74 / 0.92);
const mhLayout = (() => {
  // Sample the spiral finely, then space the squares evenly along it, as on the printed board.
  const cx = MH_PX / 2, cy = MH_PY / 2 + 20, rx = MH_PX * 0.46, ry = MH_PY * 0.43, turns = 3, a0 = -Math.PI * 0.78, inner = 0.3;
  const at = t => { const a = a0 + t * turns * TAU, sc = 1 - t * (1 - inner); return [cx + Math.cos(a) * rx * sc, cy + Math.sin(a) * ry * sc]; };
  const N = 6000, pts = [], len = [0];
  for (let i = 0; i <= N; i++) { pts.push(at(i / N)); if (i) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
  const out = [null], total = len[N];
  for (let k = 0, i = 0; k < 66; k++) { const want = total * k / 65; while (i < N && len[i] < want) i++; out.push(pts[i]); }
  out.push([cx, cy]);
  return out;
})();
function mhSquare(n) { const [x, y] = mhLayout[n]; return { x: (x / MH_PX - 0.5) * MH_W, z: (y / MH_PY - 0.5) * MH_D }; }
const MH_FILL = { virtue: '#d4e3b4', vice: '#f1cfa9', crime: '#e8a99a', place: '#cdbfa6', jail: '#bba489', water: '#b2d0e2', inn: '#e8d59f', plain: '#f0e4c6', goal: '#f4e7c4' };
function buildMansion(group) {
  const W = MH_W, D = MH_D, G = window.LibrariumRules.mansion;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.02, D + 0.04), new THREE.MeshStandardMaterial({ color: 0x3a2312, roughness: 0.6 }));
  board.position.y = TOP + 0.01; group.add(board);
  topPlane(group, W, D, TOP + 0.0205, tex(MH_PX, MH_PY, (g) => {
    agedPaper(g, MH_PX, MH_PY);
    // The track: a band joining the squares in order.
    g.strokeStyle = 'rgba(110,120,60,.35)'; g.lineWidth = 190; g.lineJoin = 'round'; g.beginPath();
    for (let k = 1; k <= 66; k++) { const [x, y] = mhLayout[k]; if (k === 1) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
    const oct = (x, y, r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); };
    for (let k = 1; k <= 66; k++) {
      const [x, y] = mhLayout[k], nx = mhLayout[k + 1] || mhLayout[k - 1], gap = Math.hypot(nx[0] - x, nx[1] - y);
      const r = Math.min(86, gap * 0.5), sq = G.SQ[k];
      oct(x, y, r); g.fillStyle = sq ? MH_FILL[sq[1]] : '#9c9a62'; g.fill();
      g.lineWidth = 4; g.strokeStyle = '#4a3a1c'; g.stroke();
      g.fillStyle = '#2a1c0c'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `bold ${Math.round(r * 0.46)}px Georgia, serif`; g.fillText(String(k), x, sq ? y + r * 0.52 : y);
      if (sq) {
        const words = sq[0].replace(/^(The|A) /, '').split(' '), fs = Math.round(r * (words.length > 1 ? 0.27 : 0.31));
        g.font = `${fs}px Georgia, serif`;
        const lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : words.length === 2 && sq[0].length > 11 ? words : [words.join(' ')];
        lines.forEach((ln, i) => g.fillText(ln.toUpperCase(), x, y - r * 0.18 + (i - (lines.length - 1) / 2) * fs * 1.1, r * 1.7));
      }
    }
    // The Mansion of Happiness at the centre.
    const [mx, my] = mhLayout[67];
    g.fillStyle = '#f4e7c4'; g.strokeStyle = '#4a3a1c'; g.lineWidth = 6; g.fillRect(mx - 150, my - 120, 300, 240); g.strokeRect(mx - 150, my - 120, 300, 240);
    g.fillStyle = '#d9c08a'; g.fillRect(mx - 80, my - 30, 160, 90);
    g.fillStyle = '#8a3a22'; g.beginPath(); g.moveTo(mx - 96, my - 30); g.lineTo(mx, my - 92); g.lineTo(mx + 96, my - 30); g.fill();
    g.fillStyle = '#4a2c14'; g.fillRect(mx - 14, my + 14, 28, 46); for (const dx of [-60, 34]) g.fillRect(mx + dx, my - 14, 26, 22);
    g.fillStyle = '#2a1c0c'; g.font = 'italic 30px Georgia, serif'; g.fillText('The Mansion of Happiness', mx, my + 92); g.font = 'bold 30px Georgia, serif'; g.fillText('67', mx, my - 104 + 10);
    g.fillStyle = '#3a2412'; g.font = 'italic 44px Georgia, serif';
    g.fillText('The Mansion of Happiness: An Instructive, Moral and Entertaining Amusement', MH_PX / 2, 46, MH_PX - 120);
  }), { roughness: 0.85 });
  const tt = teetotum(); tt.position.set(W / 2 + 0.1, TOP, 0.12); group.add(tt);
  const shown = [];
  [0, 1].forEach(pl => { const p = mhPawn(pl); p.position.copy(mhStart(pl)); group.add(p); shown.push(p); });
  group.userData.display = shown;
  return TOP + 0.021;
}
function mhPawn(pl) { const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x1e3a7a : 0x8a1e1e, roughness: 0.5 }); const m = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.046, 14), mat); m.position.y = 0.023; const g = new THREE.Group(); g.add(m); const head = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), mat); head.position.y = 0.05; g.add(head); g.userData.mats = [mat]; return g; }
function mhStart(pl) { return V3(-MH_W / 2 - 0.06, TOP, -0.18 + pl * 0.06); }

