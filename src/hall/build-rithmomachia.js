/* --- Wing III: Rithmomachia, the philosophers' game, on a board of 8 x 16 */
const RM_S = 0.054;
function rmCell(i) { const r = i >> 3, c = i & 7; return { x: (c - 3.5) * RM_S, z: (7.5 - r) * RM_S }; }
const rmTexCache = {};
function rmFace(pl, v) {
  const key = pl + ':' + v;
  if (!rmTexCache[key]) rmTexCache[key] = tex(128, 128, (g, w) => {
    g.fillStyle = pl ? '#1c1814' : '#efe6d2'; g.fillRect(0, 0, w, w);
    g.fillStyle = pl ? '#efe6d2' : '#1c1814'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${v >= 100 ? 50 : 60}px "Amethysta",Georgia,serif`; g.fillText(String(v), 64, 66);
  });
  return rmTexCache[key];
}
const rmGeo = {
  c: new THREE.CylinderGeometry(0.021, 0.021, 0.014, 28),
  t: new THREE.CylinderGeometry(0.027, 0.027, 0.014, 3),
  s: new THREE.CylinderGeometry(0.026, 0.026, 0.014, 4),
};
const rmSideMat = [new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: 0x2a221b, roughness: 0.4 })];
function rmPiece(p) {
  const top = new THREE.MeshStandardMaterial({ map: rmFace(p.pl, p.v), roughness: 0.45 });
  let o;
  if (p.shape === 'p') { // the pyramid: a stepped stack of square, triangle and round, its total on a plaque at the top
    o = new THREE.Group();
    [[0.026, 4, 0], [0.022, 3, 0.012], [0.017, 28, 0.024]].forEach(([rad, seg, y]) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.012, seg), [rmSideMat[p.pl], seg === 28 ? top : rmSideMat[p.pl], rmSideMat[p.pl]]);
      m.position.y = y + 0.006; if (seg === 4) m.rotation.y = Math.PI / 4; if (seg === 3) m.rotation.y = p.pl ? Math.PI : 0; o.add(m);
    });
  } else {
    o = new THREE.Mesh(rmGeo[p.shape], [rmSideMat[p.pl], top, rmSideMat[p.pl]]);
    o.position.y = 0.007;
    const pivot = new THREE.Group(); pivot.add(o);
    if (p.shape === 's') o.rotation.y = Math.PI / 4;
    if (p.shape === 't') o.rotation.y = p.pl ? Math.PI : 0; // triangles point at the enemy
    o = pivot;
  }
  o.userData.mats = [top];
  return o;
}
function buildRithmo(group) {
  const W = 8 * RM_S + 0.08, D = 16 * RM_S + 0.08;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, D), new THREE.MeshStandardMaterial({ color: 0x3e2614, roughness: 0.55 }));
  board.position.y = TOP + 0.015; group.add(board);
  const pw = 512, ph = 1024, sx = RM_S * pw / W, sy = RM_S * ph / D, ox = pw / 2 - 4 * sx, oy = ph / 2 - 8 * sy;
  topPlane(group, W, D, TOP + 0.0305, tex(pw, ph, (g) => {
    g.fillStyle = '#3e2614'; g.fillRect(0, 0, pw, ph);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) { g.fillStyle = (r + c) % 2 ? '#d9c39a' : '#8c6a42'; g.fillRect(ox + c * sx, oy + r * sy, sx, sy); }
    g.strokeStyle = '#1e1208'; g.lineWidth = 4; g.strokeRect(ox, oy, 8 * sx, 16 * sy);
    g.strokeStyle = 'rgba(30,18,8,.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(ox, oy + 8 * sy); g.lineTo(ox + 8 * sx, oy + 8 * sy); g.stroke(); // the line between the two halves
  }), { roughness: 0.55 });
  const y = TOP + 0.031, shown = [], R = window.LibrariumRules.rithmo;
  R.init(); R.b.forEach((p, i) => { if (!p) return; const o = rmPiece(p), c = rmCell(i); o.position.set(c.x, y, c.z); group.add(o); shown.push(o); });
  group.userData.display = shown;
  return y;
}

