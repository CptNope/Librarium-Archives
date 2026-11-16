/* --- Wing III: Four Seasons chess, after Alfonso X's book of games */
const FS_S = 0.085;
const FS_COL = [0x5e0c06, 0x161210, 0xd8cdb4, 0x163d16]; // red (you), black, white, green
const FS_KIND = [null, 'raja', 'ratha', 'ashva', 'gaja', 'padati', 'mantri'];
function fsCell(i) { const x = i & 7, y = i >> 3; return { x: (x - 3.5) * FS_S, z: (3.5 - y) * FS_S }; }
function fsPiece(v) {
  const s = v >> 5, mat = new THREE.MeshStandardMaterial({ color: FS_COL[s], roughness: s === 2 ? 0.5 : 0.4 });
  const o = CR_MAKE[FS_KIND[v & 7]](mat); o.userData.mats = [mat]; o.userData.seat = s;
  o.rotation.y = [Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4, -Math.PI / 4][s]; // facing the centre from each corner
  o.scale.setScalar(0.92);
  return o;
}
function buildFourSeasons(group) {
  const W = 8 * FS_S + 0.08;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, W), new THREE.MeshStandardMaterial({ color: 0x4a2e1a, roughness: 0.6 }));
  board.position.y = TOP + 0.015; group.add(board);
  const px = 1024, sc = px / W, d = FS_S * sc, c0 = px / 2 - 4 * d;
  topPlane(group, W, W, TOP + 0.0305, tex(px, px, (g) => {
    g.fillStyle = '#4a2e1a'; g.fillRect(0, 0, px, px);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { g.fillStyle = (r + c) % 2 ? '#c9a46a' : '#7a5232'; g.fillRect(c0 + c * d, c0 + r * d, d, d); }
    // The four seasons' corners: summer (red), autumn (black), winter (white), spring (green). Canvas y runs down, so rank 1 is at the bottom.
    const tint = [['rgba(170,40,25,.28)', 0, 6], ['rgba(10,10,10,.30)', 6, 6], ['rgba(250,245,230,.30)', 6, 0], ['rgba(40,110,40,.30)', 0, 0]];
    for (const [col, cx, cy] of tint) { g.fillStyle = col; g.fillRect(c0 + cx * d, c0 + cy * d, 2 * d, 2 * d); }
    g.strokeStyle = 'rgba(40,22,10,.75)'; g.lineWidth = 4; // the two diagonals across the centre
    g.beginPath(); g.moveTo(c0 + 2 * d, c0 + 6 * d); g.lineTo(c0 + 6 * d, c0 + 2 * d); g.moveTo(c0 + 2 * d, c0 + 2 * d); g.lineTo(c0 + 6 * d, c0 + 6 * d); g.stroke();
    g.strokeStyle = '#2a170b'; g.lineWidth = 5; g.strokeRect(c0, c0, 8 * d, 8 * d);
  }), { roughness: 0.55 });
  const y = TOP + 0.031, shown = [], G = window.LibrariumRules.fourseasons;
  G.init(); G.b.forEach((v, i) => { if (!v) return; const o = fsPiece(v), c = fsCell(i); o.position.set(c.x, y, c.z); group.add(o); shown.push(o); });
  group.userData.display = shown;
  return y;
}

