/* --- Wing III: Chaturaji, four-handed chaturanga with dice */
const CJ_S = 0.09;
const CJ_COL = [0xa06c06, 0x1a1714, 0x6e140a, 0x1d4a1c]; // yellow (you), black, red, green
const CJ_KIND = [null, 'raja', 'gaja', 'ashva', 'nauka', 'padati'];
const CJ_DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
function cjCell(i) { const x = i & 7, y = i >> 3; return { x: (x - 3.5) * CJ_S, z: (3.5 - y) * CJ_S }; }
function cjPiece(v) {
  const seat = v >> 3, mat = new THREE.MeshStandardMaterial({ color: CJ_COL[seat], roughness: seat === 1 ? 0.35 : 0.45, metalness: seat === 0 ? 0.15 : 0 });
  const o = CR_MAKE[CJ_KIND[v & 7]](mat); o.userData.mats = [mat]; o.userData.seat = seat;
  const [dx, dy] = CJ_DIRS[seat]; o.rotation.y = Math.atan2(dy, dx); o.scale.setScalar(1.2);
  return o;
}
function buildChaturaji(group) {
  const W = 8 * CJ_S + 0.07;
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, W), new THREE.MeshStandardMaterial({ color: 0x2c3854, roughness: 0.9 }));
  cloth.position.y = TOP + 0.01; group.add(cloth);
  const px = 1024, sc = px / W, c0 = px / 2 - 4 * CJ_S * sc, d = CJ_S * sc;
  topPlane(group, W, W, TOP + 0.0205, tex(px, px, (g) => {
    g.fillStyle = '#3c4a6a'; g.fillRect(0, 0, px, px);
    speckle(g, px, px, 6000, ['#33405e', '#47567a', '#2c3854'], 1.6);
    g.strokeStyle = '#e8dcbc'; g.lineWidth = 4;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(c0, c0 + i * d); g.lineTo(c0 + 8 * d, c0 + i * d); g.stroke();
      g.beginPath(); g.moveTo(c0 + i * d, c0); g.lineTo(c0 + i * d, c0 + 8 * d); g.stroke();
    }
    g.lineWidth = 3; // the ashtapada's marked squares
    for (const [r, c] of [[0, 0], [0, 7], [7, 0], [7, 7], [3, 3], [3, 4], [4, 3], [4, 4]]) {
      const x = c0 + c * d, y = c0 + r * d;
      g.beginPath(); g.moveTo(x + 12, y + 12); g.lineTo(x + d - 12, y + d - 12); g.moveTo(x + d - 12, y + 12); g.lineTo(x + 12, y + d - 12); g.stroke();
    }
    g.strokeStyle = 'rgba(232,220,188,.5)'; g.lineWidth = 2; g.strokeRect(c0 - 14, c0 - 14, 8 * d + 28, 8 * d + 28);
  }), { roughness: 0.9 });
  const y = TOP + 0.021, shown = [], G = window.LibrariumRules.chaturaji;
  G.init(); G.b.forEach((v, i) => { if (!v) return; const o = cjPiece(v), c = cjCell(i); o.position.set(c.x, y, c.z); group.add(o); shown.push(o); });
  group.userData.display = shown;
  return y;
}

