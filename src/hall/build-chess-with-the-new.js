/* --- Wing IV: chess with the new queen (display) */
/* Chess pieces in the Staunton manner, shared by the display and the table. */
const chessLathe = (pts, m) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 22), m);
const CHESS_BASE = [[0, 0], [0.024, 0], [0.025, 0.006], [0.017, 0.012]];
const CHESS_SHAPES = {
    p: m => chessLathe([...CHESS_BASE, [0.009, 0.028], [0.013, 0.032], [0.012, 0.042], [0, 0.046]], m),
    r: m => chessLathe([...CHESS_BASE, [0.015, 0.05], [0.019, 0.054], [0.019, 0.064], [0.014, 0.064], [0, 0.062]], m),
    b: m => { const g = new THREE.Group(); g.add(chessLathe([...CHESS_BASE, [0.01, 0.045], [0.015, 0.052], [0.012, 0.068], [0.004, 0.076], [0, 0.078]], m)); return g; },
    n: m => { const g = new THREE.Group(); g.add(chessLathe([...CHESS_BASE, [0.014, 0.022], [0, 0.024]], m)); const h = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.045, 0.016), m); h.position.set(0.004, 0.044, 0); h.rotation.z = -0.25; g.add(h); const sn = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.014, 0.014), m); sn.position.set(0.016, 0.06, 0); g.add(sn); return g; },
    q: m => { const g = new THREE.Group(); g.add(chessLathe([...CHESS_BASE, [0.01, 0.06], [0.018, 0.07], [0.016, 0.084], [0, 0.084]], m)); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, ball = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), m); ball.position.set(Math.cos(a) * 0.015, 0.088, Math.sin(a) * 0.015); g.add(ball); } return g; },
    k: m => { const g = new THREE.Group(); g.add(chessLathe([...CHESS_BASE, [0.011, 0.064], [0.018, 0.074], [0.014, 0.088], [0, 0.088]], m)); const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.026, 0.005), m); c1.position.y = 0.1; g.add(c1); const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.005, 0.005), m); c2.position.y = 0.104; g.add(c2); return g; },
  };
function buildNewChess(group) {
  const S = 0.085, W = 8 * S + 0.07;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, W), new THREE.MeshStandardMaterial({ color: 0x2a170b, roughness: 0.5 }));
  frame.position.y = TOP + 0.02; group.add(frame);
  const px = 1024, sc = px / W, c0 = px / 2 - 4 * S * sc;
  topPlane(group, W, W, TOP + 0.0405, tex(px, px, (g) => {
    g.fillStyle = '#2a170b'; g.fillRect(0, 0, px, px);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { g.fillStyle = (r + c) % 2 ? '#6b3f24' : '#e3cfa2'; g.fillRect(c0 + c * S * sc, c0 + r * S * sc, S * sc, S * sc); }
  }), { roughness: 0.5 });
  const y0 = TOP + 0.041;
  const mats = [new THREE.MeshStandardMaterial({ color: 0xeee0c0, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0x241810, roughness: 0.35 })];
  const shapes = CHESS_SHAPES;
  // A position from a fast attacking game: the queen has swept out early.
  const layout = [
    [0, 0, 'r', 0], [0, 4, 'k', 0], [0, 5, 'b', 0], [0, 7, 'r', 0], [1, 0, 'p', 0], [1, 1, 'p', 0], [1, 5, 'p', 0], [1, 6, 'p', 0], [1, 7, 'p', 0], [2, 2, 'n', 0], [3, 3, 'p', 0], [3, 4, 'p', 0], [2, 5, 'n', 0],
    [4, 7, 'q', 0], [3, 2, 'b', 0],
    [7, 0, 'r', 1], [7, 2, 'b', 1], [7, 3, 'q', 1], [7, 4, 'k', 1], [7, 7, 'r', 1], [6, 0, 'p', 1], [6, 1, 'p', 1], [6, 2, 'p', 1], [6, 3, 'p', 1], [5, 5, 'n', 1], [6, 6, 'p', 1], [6, 7, 'p', 1], [4, 4, 'p', 1], [5, 2, 'n', 1], [4, 1, 'b', 1],
  ];
  const display = [];
  for (const [r, c, t, side] of layout) {
    const o = shapes[t](mats[side]); o.position.set((c - 3.5) * S, y0, (3.5 - r) * S); o.rotation.y = side ? -Math.PI / 2 : Math.PI / 2; group.add(o); display.push(o);
  }
  group.userData.display = display; // put away while a game is played on this board
  // A small gilded crown beside the board marks the piece that changed.
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a23a, metalness: 0.8, roughness: 0.3 });
  const q = shapes.q(gold); q.scale.setScalar(1.6); q.position.set(W / 2 + 0.11, TOP, -0.12); group.add(q);
  const old = sjPiece(2, new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.5 })); old.scale.setScalar(1.6); old.position.set(W / 2 + 0.11, TOP, 0.12); group.add(old);
  return y0;
}

