/* --- Royal Game of Ur board */
const UR_S = 0.17;
const urTiles = {};
function buildUrTextures() {
  const shell = '#eadcbc', lapis = '#24407e', red = '#a8392a', dark = '#1a1410';
  const base = (g, w) => { g.fillStyle = shell; g.fillRect(0, 0, w, w); speckle(g, w, w, 500, ['#b8a782', '#fff7e6'], 1.4); g.strokeStyle = 'rgba(40,25,10,.55)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, w - 6); };
  urTiles.rosette = tex(256, 256, (g, w) => {
    base(g, w); const c = w / 2;
    g.fillStyle = red; g.beginPath(); g.arc(c, c, 96, 0, TAU); g.fill();
    g.fillStyle = shell; g.beginPath(); g.arc(c, c, 84, 0, TAU); g.fill();
    for (let i = 0; i < 8; i++) { g.save(); g.translate(c, c); g.rotate(i * TAU / 8); g.fillStyle = lapis; g.beginPath(); g.ellipse(0, -44, 17, 36, 0, 0, TAU); g.fill(); g.restore(); }
    g.fillStyle = red; g.beginPath(); g.arc(c, c, 18, 0, TAU); g.fill();
  });
  urTiles.eyes = tex(256, 256, (g, w) => {
    base(g, w);
    for (const [x, y] of [[70, 70], [186, 70], [70, 186], [186, 186], [128, 128]]) {
      g.fillStyle = dark; g.beginPath(); g.arc(x, y, 30, 0, TAU); g.fill();
      g.fillStyle = shell; g.beginPath(); g.arc(x, y, 20, 0, TAU); g.fill();
      g.fillStyle = lapis; g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill();
    }
  });
  urTiles.five = tex(256, 256, (g, w) => {
    base(g, w);
    for (const [x, y] of [[64, 64], [192, 64], [64, 192], [192, 192], [128, 128]]) {
      g.fillStyle = red; g.beginPath(); g.arc(x, y, 26, 0, TAU); g.fill();
      g.fillStyle = lapis; g.beginPath(); g.arc(x, y, 14, 0, TAU); g.fill();
    }
  });
  urTiles.grid = tex(256, 256, (g, w) => {
    base(g, w);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? lapis : red; g.beginPath(); g.arc(50 + i * 52, 50 + j * 52, 13, 0, TAU); g.fill(); }
  });
  urTiles.zig = tex(256, 256, (g, w) => {
    base(g, w); g.strokeStyle = lapis; g.lineWidth = 12;
    for (let r = 0; r < 4; r++) { g.beginPath(); for (let i = 0; i <= 8; i++) g.lineTo(28 + i * 25, 52 + r * 50 + (i % 2 ? -14 : 14)); g.stroke(); }
  });
}
const UR_ROS = new Set(['0,0', '2,0', '1,3', '0,6', '2,6']);
function urCellX(c) { return (c - 3.5) * UR_S; }
function urCellZ(r) { return (r - 1) * UR_S; }
function buildUrBoard(group) {
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.7 });
  const y0 = TOP;
  const blocks = [[0, 3, 0, 2], [4, 5, 1, 1], [6, 7, 0, 2]];
  for (const [c0, c1, r0, r1] of blocks) {
    const w = (c1 - c0 + 1) * UR_S + 0.03, d = (r1 - r0 + 1) * UR_S + 0.03;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), boardMat);
    b.position.set((urCellX(c0) + urCellX(c1)) / 2, y0 + 0.025, (urCellZ(r0) + urCellZ(r1)) / 2); group.add(b);
  }
  const mid = ['eyes', 'five', 'grid', null, 'eyes', 'five', 'zig', 'eyes'];
  const outer = ['rosette', 'eyes', 'grid', 'five', null, null, 'rosette', 'grid'];
  const tileGeo = new THREE.BoxGeometry(UR_S * 0.93, 0.012, UR_S * 0.93);
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xcdbd99, roughness: 0.6 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
    if (r !== 1 && (c === 4 || c === 5)) continue;
    let k = UR_ROS.has(r + ',' + c) ? 'rosette' : (r === 1 ? mid[c] : outer[c]);
    if (r === 2 && k === 'eyes') k = 'zig';
    const top = new THREE.MeshStandardMaterial({ map: urTiles[k], roughness: 0.55 });
    const t = new THREE.Mesh(tileGeo, [sideMat, sideMat, top, sideMat, sideMat, sideMat]);
    t.position.set(urCellX(c), y0 + 0.056, urCellZ(r)); group.add(t);
  }
  return y0 + 0.062;
}
function urPieceTop(light) {
  return tex(128, 128, (g, w) => {
    g.fillStyle = light ? '#efe4c8' : '#1c2a52'; g.fillRect(0, 0, w, w);
    g.fillStyle = light ? '#24407e' : '#efe4c8';
    for (const [x, y] of [[64, 64], [64, 30], [64, 98], [30, 64], [98, 64]]) { g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill(); }
  });
}

