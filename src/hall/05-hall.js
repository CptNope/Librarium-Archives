/* ------------------------------------------------------------------ hall
 * One long gallery split into wings by open arches: Wing I runs from the
 * entrance to z = -41, Wing II to z = -86, Wing III to the closed arch at
 * the far end. */
// zFar and the dividers between wings are worked out from the exhibits by layoutHall().
const HALL = { half: 5, zNear: 4, zFar: -221, h: 5, dividers: [] };
const LAYOUT = { first: 12, step: 5.5, toArch: 10.5, afterArch: 7 };
/* Exhibits stand in STOPS order down the hall, alternating sides LAYOUT.step
 * apart. Each wing's arch comes LAYOUT.toArch after its last exhibit, and the
 * next wing starts LAYOUT.afterArch beyond it, so adding a game is one entry. */
function layoutHall() {
  let z = HALL.zNear - LAYOUT.first + LAYOUT.step, wing = 1, k = 0;
  HALL.dividers = [];
  for (const s of STOPS) {
    if (!s.build) continue;
    if (s.wing !== wing) {
      const arch = z - LAYOUT.toArch;
      for (let w = wing; w < s.wing; w++) HALL.dividers.push(arch);
      z = arch - LAYOUT.afterArch + LAYOUT.step; wing = s.wing; k = 0;
    }
    z -= LAYOUT.step; s.z = z; s.side = k++ % 2 ? 1 : -1;
  }
  HALL.zFar = z - LAYOUT.toArch;
}
let floorMesh = null;
const wingOf = z => HALL.dividers.filter(d => z < d).length; // 0-based wing index
function buildHall() {
  const len = HALL.zNear - HALL.zFar, midZ = (HALL.zNear + HALL.zFar) / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.half * 2, len), MAT.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.z = midZ; scene.add(floor); floorMesh = floor;
  MAT.runner.map.repeat.set(1, 8 * len / 45);
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.6, len - 6), MAT.runner);
  runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.005, midZ - 1); scene.add(runner);
  MAT.floor.map.repeat.set(5, 24 * len / 45);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALL.half * 2, len), MAT.ceiling);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, HALL.h, midZ); scene.add(ceil);
  for (let z = HALL.zNear - 1; z > HALL.zFar; z -= 3.2) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(HALL.half * 2, 0.28, 0.3), MAT.woodDark);
    beam.position.set(0, HALL.h - 0.14, z); scene.add(beam);
  }
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, HALL.h), MAT.wall);
    wall.rotation.y = -s * Math.PI / 2; wall.position.set(s * HALL.half, HALL.h / 2, midZ); scene.add(wall);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(HALL.half * 2, HALL.h), MAT.wall);
  back.rotation.y = Math.PI; back.position.set(0, HALL.h / 2, HALL.zNear); scene.add(back);
  const end = new THREE.Mesh(new THREE.PlaneGeometry(HALL.half * 2, HALL.h), MAT.wall);
  end.position.set(0, HALL.h / 2, HALL.zFar); scene.add(end);
  buildShelves(len, midZ);
  buildDivider(HALL.dividers[0], 'Wing II', 'STRATEGY TAKES THE TABLE');
  buildDivider(HALL.dividers[1], 'Wing III', 'KINGS, CARDS AND COURTS');
  buildDivider(HALL.dividers[2], 'Wing IV', 'PRINTED BOARDS AND PARLOUR TABLES');
  buildDivider(HALL.dividers[3], 'Wing V', 'THE MODERN BOARD GAME');
  buildDivider(HALL.dividers[4], 'Wing VI', 'GAMES OF THE WORLD');
  buildEndArch();
  buildBanner(-2.6, 'The Dawn of Play', 'Wing I  ·  c. 3100 – 2000 BCE');
  buildBanner(HALL.dividers[0] - 3.6, 'Strategy Takes the Table', 'Wing II  ·  c. 500 BCE – 1000 CE');
  buildBanner(HALL.dividers[1] - 3.6, 'Kings, Cards and Courts', 'Wing III  ·  c. 480 – 1450 CE');
  buildBanner(HALL.dividers[2] - 3.6, 'Printed Boards and Parlour Tables', 'Wing IV  ·  c. 1300 – 1900 CE');
  buildBanner(HALL.dividers[3] - 3.6, 'The Modern Board Game', 'Wing V  ·  c. 1840 CE – today');
  buildBanner(HALL.dividers[4] - 3.6, 'Games of the World', 'Wing VI  ·  across the oceans');
}

function buildShelves(len, midZ) {
  const rows = [0.32, 0.98, 1.64, 2.3, 2.96, 3.62];
  const shelfGeo = new THREE.BoxGeometry(0.34, 0.035, len);
  const upGeo = new THREE.BoxGeometry(0.36, 4.0, 0.05);
  for (const s of [-1, 1]) {
    const x = s * (HALL.half - 0.17);
    for (const y of [...rows, 4.28]) {
      const sh = new THREE.Mesh(shelfGeo, MAT.wood); sh.position.set(x, y - 0.02, midZ); scene.add(sh);
    }
    for (let z = HALL.zNear; z >= HALL.zFar; z -= 1.6) {
      const up = new THREE.Mesh(upGeo, MAT.woodDark); up.position.set(x, 2.3, z); scene.add(up);
    }
  }
  const colors = ['#5a2a1c', '#3f1d16', '#2f3a2a', '#253042', '#6b4a2a', '#4a2f1d', '#7a5a2c', '#211b17', '#6e2f22', '#3d3324', '#542a33'].map(c => new THREE.Color(c));
  const buckets = HALL.dividers.concat([0]).map(() => ({ mats: [], cols: [] }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  for (const s of [-1, 1]) {
    for (const y of rows) {
      let z = HALL.zNear - 0.05;
      while (z > HALL.zFar + 0.05) {
        // Leave the divider walls clear of books.
        if (HALL.dividers.some(d => z < d + 0.3 && z > d - 0.3)) { z -= 0.05; continue; }
        const t = rand(0.03, 0.075), h = rand(0.34, 0.54), d = rand(0.19, 0.25);
        if (Math.random() < 0.035) { z -= rand(0.08, 0.3); continue; }
        const lean = Math.random() < 0.06 ? rand(-0.25, 0.25) : 0;
        p.set(s * (HALL.half - 0.05 - d / 2), y + h / 2 + 0.002, z - t / 2);
        e.set(lean, 0, 0); q.setFromEuler(e); sc.set(d, h, t);
        m4.compose(p, q, sc);
        const bk = buckets[wingOf(z)];
        bk.mats.push(m4.clone());
        bk.cols.push(colors[(Math.random() * colors.length) | 0].clone().multiplyScalar(rand(0.7, 1.15)));
        z -= t + 0.002;
      }
    }
  }
  // One instanced mesh per wing, each with a bounding sphere around its own
  // stretch of shelves, so wings out of view are skipped entirely.
  const bookMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const edges = [HALL.zNear, ...HALL.dividers, HALL.zFar];
  buckets.forEach((bk, w) => {
    if (!bk.mats.length) return;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const half = (edges[w] - edges[w + 1]) / 2;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2.2, (edges[w] + edges[w + 1]) / 2), Math.hypot(half, HALL.half, 2.5) + 0.5);
    const books = new THREE.InstancedMesh(geo, bookMat, bk.mats.length);
    bk.mats.forEach((m, i) => { books.setMatrixAt(i, m); books.setColorAt(i, bk.cols[i]); });
    books.instanceMatrix.needsUpdate = true; books.instanceColor.needsUpdate = true;
    scene.add(books);
  });
}

function archFrame(z) {
  const frame = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.09, 8, 40, Math.PI), MAT.stone);
  frame.position.set(0, 3.2, z); scene.add(frame);
  for (const s of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), MAT.stone);
    col.position.set(s * 1.3, 1.6, z); scene.add(col);
  }
}
function signTex(title, sub) {
  return tex(720, 180, (g, w, h) => {
    g.fillStyle = '#1a120c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a3782c'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#e8c27a'; g.textAlign = 'center';
    g.font = '54px "Almendra SC", serif'; g.fillText(title, w / 2, 90, w - 40);
    g.font = '28px "Montserrat", sans-serif'; g.fillStyle = '#a8977a'; g.fillText(sub, w / 2, 140);
  });
}
// An open arch between two wings.
function buildDivider(z, title, sub) {
  const wallMat = MAT.woodDark;
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(3.5, HALL.h, 0.4), wallMat);
    w.position.set(s * 3.25, HALL.h / 2, z); scene.add(w);
  }
  const shape = new THREE.Shape();
  shape.moveTo(-1.5, 3.2); shape.lineTo(1.5, 3.2); shape.lineTo(1.5, HALL.h); shape.lineTo(-1.5, HALL.h); shape.lineTo(-1.5, 3.2);
  const hole = new THREE.Path();
  hole.moveTo(1.3, 3.2); hole.absarc(0, 3.2, 1.3, 0, Math.PI, false); hole.lineTo(1.3, 3.2);
  shape.holes.push(hole);
  const span = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: false, curveSegments: 24 }), wallMat);
  span.position.z = z - 0.2; scene.add(span);
  archFrame(z + 0.22); archFrame(z - 0.22);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: signTex(title, sub) }));
  sign.position.set(0, 4.62, z + 0.21); scene.add(sign);
}
// The closed arch at the far end, waiting for the next wing.
function buildEndArch() {
  const z = HALL.zFar + 0.02;
  const recess = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), new THREE.MeshBasicMaterial({ color: 0x050403 }));
  recess.position.set(0, 1.6, z); scene.add(recess);
  const top = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32, 0, Math.PI), recess.material);
  top.position.set(0, 3.2, z); scene.add(top);
  archFrame(z + 0.05);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 8), new THREE.MeshLambertMaterial({ color: 0x6a1a12 }));
  rope.rotation.z = Math.PI / 2; rope.position.set(0, 0.95, z + 0.6); scene.add(rope);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: signTex('Librarium Games', 'DIFFERENT FABLES FOR DIFFERENT TABLES') }));
  sign.position.set(0, 1.55, z + 0.3); scene.add(sign);
}

function buildBanner(z, title, sub) {
  const t = tex(1400, 300, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a0f0b'); gr.addColorStop(1, '#170806');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c38a2a'; g.lineWidth = 5; g.strokeRect(18, 18, w - 36, h - 36);
    g.lineWidth = 1.5; g.strokeRect(30, 30, w - 60, h - 60);
    g.fillStyle = '#f6a01a'; g.textAlign = 'center';
    g.font = '112px "Almendra SC", serif'; g.fillText(title, w / 2, 160, w - 90);
    g.fillStyle = '#d9c7a2'; g.font = '40px "Almendra SC", serif';
    g.fillText(sub, w / 2, 232);
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.2), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
  banner.position.set(0, 3.75, z); scene.add(banner);
  for (const s of [-1, 1]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.65, 4), MAT.brass);
    chain.position.set(s * 2.5, 4.68, z); scene.add(chain);
  }
}

