/* --- The Games Desk, at the entrance
 * A librarian's counter on the left as you come in, where online rooms are opened and saved games brought
 * back. A notice board hangs behind it with the four steps of playing online; on the counter lie an open
 * register of rooms and a brass bell. It is the 'lobby' stop: clicking it opens its placard, whose button
 * opens the Games Desk panel (23b-online.js). */
let gamesDesk;
function buildGamesDesk() {
  const g = new THREE.Group();
  g.position.set(-3.05, 0, -1.7);
  g.rotation.y = Math.PI / 2; // local +z faces the aisle
  // The counter: a dark case with a lighter top and a plinth's brass plaque on its front.
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 0.62), MAT.woodDark); body.position.y = 0.45; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.05, 0.76), MAT.wood); top.position.set(0, 0.925, 0.03); g.add(top);
  const kick = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.08, 0.66), MAT.wood); kick.position.y = 0.04; g.add(kick);
  for (const x of [-0.62, 0, 0.62]) { // panelled front
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.56, 0.02), MAT.wood); p.position.set(x, 0.42, 0.315); g.add(p);
  }
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.14), new THREE.MeshStandardMaterial({ map: plaqueTex('Games Desk', 'Play online'), metalness: 0.6, roughness: 0.4 }));
  plaque.position.set(0, 0.78, 0.327); g.add(plaque);
  // The register: two pages, the rooms of the day on the left, a game in progress sketched on the right.
  const regT = tex(512, 320, (c, w, h) => {
    c.fillStyle = '#efe2c4'; c.fillRect(0, 0, w, h); speckle(c, w, h, 700, ['#c9b68e', '#fff8e6'], 1.2);
    c.fillStyle = '#e2d1aa'; c.fillRect(w / 2 - 5, 0, 10, h);
    c.fillStyle = '#7a4a10'; c.textAlign = 'center'; c.font = '30px "Almendra SC", serif'; c.fillText('Rooms', w / 4, 46);
    c.fillStyle = '#3b2a18'; c.font = '19px "Amethysta", serif'; c.textAlign = 'left';
    ['K7MXQ2 · Chess', 'R4TNW8 · Ur', 'HB3ZP6 · Go', 'Q9DLC5 · Gin'].forEach((t, i) => { c.fillText(t, 28, 92 + i * 44); c.fillRect(28, 100 + i * 44, w / 2 - 60, 1); });
    c.strokeStyle = '#5a3b1c'; c.lineWidth = 2; // a little board on the right-hand page
    const x0 = w * 0.58, y0 = 60, s = 26;
    for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(x0, y0 + i * s); c.lineTo(x0 + 8 * s, y0 + i * s); c.stroke(); c.beginPath(); c.moveTo(x0 + i * s, y0); c.lineTo(x0 + i * s, y0 + 8 * s); c.stroke(); }
    for (const [i, j, col] of [[3, 3, '#1b120c'], [4, 4, '#1b120c'], [3, 4, '#f4ead4'], [4, 3, '#f4ead4'], [2, 4, '#1b120c']]) { c.fillStyle = col; c.beginPath(); c.arc(x0 + (i + 0.5) * s, y0 + (j + 0.5) * s, s * 0.38, 0, TAU); c.fill(); c.stroke(); }
  });
  const reg = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.025, 0.36), [MAT.woodDark, MAT.woodDark, new THREE.MeshLambertMaterial({ map: regT }), MAT.woodDark, MAT.woodDark, MAT.woodDark]);
  reg.position.set(-0.3, 0.963, 0.06); reg.rotation.y = 0.12; g.add(reg);
  // The bell: a brass dome on a small foot, and a lamp at the other end.
  const bellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.02, 24), MAT.woodDark); bellBase.position.set(0.55, 0.96, 0.12); g.add(bellBase);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 10, 0, TAU, 0, Math.PI / 2), MAT.brass); bell.position.set(0.55, 0.97, 0.12); g.add(bell);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), MAT.brass); knob.position.set(0.55, 1.025, 0.12); g.add(knob);
  const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 10), MAT.brass); lampPost.position.set(0.82, 1.12, -0.18); g.add(lampPost);
  const lampFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.03, 18), MAT.brass); lampFoot.position.set(0.82, 0.965, -0.18); g.add(lampFoot);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.1, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0x3f6b4a, side: THREE.DoubleSide })); shade.position.set(0.82, 1.3, -0.18); g.add(shade);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.1, 18), new THREE.MeshBasicMaterial({ color: 0xffd68a })); glow.rotation.x = Math.PI / 2; glow.position.set(0.82, 1.252, -0.18); g.add(glow);
  // The notice board, hung on the shelves behind: how to play online, in four steps.
  const boardT = tex(768, 512, (c, w, h) => {
    c.fillStyle = '#e9dcbc'; c.fillRect(0, 0, w, h); speckle(c, w, h, 1400, ['#c4ad80', '#fbf2dc'], 1.4);
    c.strokeStyle = '#7a4a10'; c.lineWidth = 3; c.strokeRect(22, 22, w - 44, h - 44);
    c.textAlign = 'center'; c.fillStyle = '#7a4a10'; c.font = '56px "Almendra SC", serif'; c.fillText('Play Online', w / 2, 96);
    c.fillStyle = '#3b2a18'; c.font = '22px "Amethysta", serif'; c.fillText('with a friend on another phone or computer', w / 2, 132);
    c.textAlign = 'left';
    [['I', 'Open a room at this desk'], ['II', 'Send your friend its code or link'], ['III', 'Suggest a game, or accept one'], ['IV', 'Save to a file, and carry on later']].forEach(([n, t], i) => {
      const y = 208 + i * 72;
      c.fillStyle = '#7a4a10'; c.font = '34px "Almendra SC", serif'; c.fillText(n, 92, y);
      c.fillStyle = '#2b1a0c'; c.font = '30px "Amethysta", serif'; c.fillText(t, 176, y);
    });
  });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.62, 1.1, 0.05), MAT.woodDark); frame.position.set(0, 1.82, -1.56); g.add(frame);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshLambertMaterial({ map: boardT })); board.position.set(0, 1.82, -1.53); g.add(board);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 0.9), MAT.hit); hit.position.y = 0.75; g.add(hit); g.userData.hit = hit;
  const sh = contactShadow(2.8, 1.6); sh.position.y = 0.004; g.add(sh);
  scene.add(g); g.updateMatrixWorld(true); gamesDesk = g;
  spotSources.push({ pos: g.localToWorld(V3(0, 0.95, 0)), lightPos: g.localToWorld(V3(0, 3.6, 1.0)) });
  return g;
}
