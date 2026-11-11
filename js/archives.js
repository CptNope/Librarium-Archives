/*
 * Librarium Archives: the 3D hall, exhibits, camera and play table.
 * Needs three.js r128 (global THREE) and js/rules.js (global LibrariumRules).
 */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const wait = ms => new Promise(r => setTimeout(r, reduceMotion ? ms * 0.5 : ms));

/* ------------------------------------------------------------------ host
 * The Archives fill the window on its own page, or a box when embedded in
 * another page (the WordPress plugin wraps it in .lm-embed). Settings come
 * from data attributes on #lm-app: data-start (an exhibit id to open on) and
 * data-shop (where the closing "Visit Librarium Games" link points). */
const root = $('#lm-app');
if (!root) return; // no Archives markup on this page
const embedded = !!root.closest('.lm-embed');
const hostSize = () => ({ w: root.clientWidth || window.innerWidth, h: root.clientHeight || window.innerHeight });
const narrowHost = () => (root.clientWidth || window.innerWidth) <= 720;

// Touch and zoom state (the handlers live in the input section).
const joyEl = $('#lm-joy');
const joy = { id: null, x: 0, y: 0 };
let touchUI = coarse;                       // show touch controls; turns on at the first touch too
const view = { zoom: 1, zoomTo: 1, panX: 0, panY: 0 };

/* ------------------------------------------------------------------ renderer */
const canvas = $('#lm-scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.4 : 1.75));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0807);
scene.fog = new THREE.FogExp2(0x0a0807, 0.042);
const camera = new THREE.PerspectiveCamera(58, 1, 0.03, 90);
camera.rotation.order = 'YXZ';

function resize() {
  const { w, h } = hostSize();
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.8 ? 72 : 58;
  camera.updateProjectionMatrix();
  if (mode === 'play' && play.ex) flyToPlay(play.ex, 0.4);
  updateJoy();
}

/* ------------------------------------------------------------- textures */
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function speckle(g, w, h, n, colors, rMax = 1.6) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    g.globalAlpha = rand(0.05, 0.22);
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rand(0.4, rMax), 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
}
const floorTex = () => tex(512, 512, (g, w, h) => {
  g.fillStyle = '#17110d'; g.fillRect(0, 0, w, h);
  const rows = 4; let y = 0;
  for (let r = 0; r < rows; r++) {
    const rh = h / rows; let x = r % 2 ? -w / 6 : 0;
    while (x < w) {
      const sw = rand(w / 3.2, w / 2.2);
      const v = rand(36, 52) | 0;
      g.fillStyle = `rgb(${v + 6},${v},${v - 6})`;
      g.fillRect(x + 3, y + 3, sw - 6, rh - 6);
      x += sw;
    }
    y += rh;
  }
  speckle(g, w, h, 5000, ['#000', '#5a4c40', '#2a2018'], 2.2);
}, [5, 24]);
const stoneTex = () => tex(256, 256, (g, w, h) => {
  g.fillStyle = '#4a4036'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 3000, ['#2b241e', '#6b5e50', '#3a3129'], 1.8);
});
const runnerTex = () => tex(256, 1024, (g, w, h) => {
  g.fillStyle = '#3a1410'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#a0742c'; g.lineWidth = 6; g.strokeRect(14, -10, w - 28, h + 20);
  g.strokeStyle = '#1a0806'; g.lineWidth = 10; g.strokeRect(30, -10, w - 60, h + 20);
  for (let y = 60; y < h; y += 128) {
    g.save(); g.translate(w / 2, y); g.rotate(Math.PI / 4);
    g.strokeStyle = '#8a5a26'; g.lineWidth = 4; g.strokeRect(-26, -26, 52, 52);
    g.fillStyle = '#5c1f16'; g.fillRect(-14, -14, 28, 28); g.restore();
  }
  speckle(g, w, h, 4000, ['#000', '#6a2a1e'], 1.4);
}, [1, 8]);

/* -------------------------------------------------------------- materials */
const MAT = {
  floor: new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.85, metalness: 0 }),
  wall: new THREE.MeshLambertMaterial({ color: 0x140e0a }),
  wood: new THREE.MeshLambertMaterial({ color: 0x2e1d12 }),
  woodDark: new THREE.MeshLambertMaterial({ color: 0x1b120c }),
  stone: new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.95, color: 0xb8a894 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb98a30, metalness: 0.85, roughness: 0.35 }),
  ceiling: new THREE.MeshLambertMaterial({ color: 0x0c0907 }),
  runner: new THREE.MeshLambertMaterial({ map: runnerTex() }),
  hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
};

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

/* --------------------------------------------------------------- lights
 * The hall has dozens of candles and spotlights, but the renderer only
 * gets a small, fixed pool of real lights. Each pool light follows one of
 * the nearest sources, so the shader never recompiles as you walk. */
scene.add(new THREE.HemisphereLight(0x5a4535, 0x0b0806, 0.55));
scene.add(new THREE.AmbientLight(0x2a1d14, 0.45));
const glowTex = tex(64, 64, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,220,160,.7)'); r.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
const candles = [];      // { pos, lightPos, flame, halo, seed }
const spotSources = [];  // { pos, lightPos }
const POOL = { point: [], spot: [] };
function addCandle(x, z) {
  const s = Math.sign(x);
  const g = new THREE.Group(); g.position.set(x, 2.15, z);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.1), MAT.brass); bracket.position.x = -s * 0.08; g.add(bracket);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.025, 16), MAT.brass); dish.position.set(-s * 0.2, 0.02, 0); g.add(dish);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.2, 12), new THREE.MeshLambertMaterial({ color: 0xe8dcc0, emissive: 0x3a2410 })); wax.position.set(-s * 0.2, 0.13, 0); g.add(wax);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flame.scale.set(0.16, 0.26, 1); flame.position.set(-s * 0.2, 0.3, 0); g.add(flame);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff7a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
  halo.scale.set(0.9, 0.9, 1); halo.position.copy(flame.position); g.add(halo);
  scene.add(g);
  candles.push({ pos: new THREE.Vector3(x - s * 0.2, 2.45, z), lightPos: new THREE.Vector3(x - s * 0.35, 2.5, z), flame, halo, seed: Math.random() * 100 });
}
function buildLightPools() {
  const nP = coarse ? 3 : 5, nS = coarse ? 3 : 4;
  for (let i = 0; i < nP; i++) { const l = new THREE.PointLight(0xff9a4a, 0, 9, 1.6); scene.add(l); POOL.point.push({ light: l, src: null }); }
  for (let i = 0; i < nS; i++) { const l = new THREE.SpotLight(0xffdcae, 0, 7.5, 0.5, 0.65, 1.3); scene.add(l); scene.add(l.target); POOL.spot.push({ light: l, src: null }); }
}
function assignPool(pool, sources, at) {
  const ranked = sources.map(s => ({ s, d: s.pos.distanceTo(at) })).sort((a, b) => a.d - b.d).slice(0, pool.length);
  const want = new Set(ranked.map(r => r.s));
  pool.forEach(slot => { if (slot.src && !want.has(slot.src)) slot.src = null; });
  for (const r of ranked) {
    if (pool.some(sl => sl.src === r.s)) continue;
    const free = pool.find(sl => !sl.src);
    if (!free) break;
    free.src = r.s; free.light.position.copy(r.s.lightPos);
    if (free.light.target) { free.light.target.position.copy(r.s.pos); free.light.target.updateMatrixWorld(); }
  }
}
const fade = d => Math.max(0, Math.min(1, (22 - d) / 8));
let poolClock = 0;
function updateLights(dt, time) {
  poolClock -= dt;
  if (poolClock <= 0) { poolClock = 0.25; assignPool(POOL.point, candles, cam.pos); assignPool(POOL.spot, spotSources, cam.pos); }
  for (const slot of POOL.point) {
    if (!slot.src) { slot.light.intensity = 0; continue; }
    const c = slot.src;
    const f = reduceMotion ? 0.9 : 0.82 + 0.1 * Math.sin(time * 11 + c.seed) + 0.08 * Math.sin(time * 23.7 + c.seed * 2);
    slot.light.intensity = 1.25 * f * fade(c.pos.distanceTo(cam.pos));
  }
  for (const slot of POOL.spot) slot.light.intensity = slot.src ? 2.6 * fade(slot.src.pos.distanceTo(cam.pos)) : 0;
  if (!reduceMotion) for (const c of candles) {
    const f = 0.82 + 0.1 * Math.sin(time * 11 + c.seed) + 0.08 * Math.sin(time * 23.7 + c.seed * 2);
    c.flame.scale.set(0.15 * f, 0.26 * (0.9 + 0.2 * f), 1); c.halo.material.opacity = 0.3 * f;
  }
}

/* ---------------------------------------------------------------- dust */
let dust;
function buildDust() {
  const n = coarse ? 320 : 700, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = rand(-4.5, 4.5); pos[i * 3 + 1] = rand(0.2, 4.6); pos[i * 3 + 2] = rand(HALL.zFar, HALL.zNear); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex, size: 0.035, color: 0xffd8a0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.userData.base = pos.slice();
  scene.add(dust);
}

/* ------------------------------------------------------------- exhibits */
function plaqueTex(title, date) {
  return tex(512, 160, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#c99a3e'); gr.addColorStop(0.5, '#a87a2a'); gr.addColorStop(1, '#8a6220');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,35,8,.8)'; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#2b1a06'; g.textAlign = 'center';
    g.font = '50px "Almendra SC", serif'; g.fillText(title, w / 2, 76, w - 40);
    g.font = '30px "Almendra SC", serif'; g.fillText(date, w / 2, 122, w - 40);
  });
}
function contactShadow(w, d) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.75 }));
  m.rotation.x = -Math.PI / 2; return m;
}
const shadowTex = tex(128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(0,0,0,.85)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w);
});
const TOP = 1.0; // plinth top height
function makePlinth(ex) {
  const g = new THREE.Group();
  const side = ex.side;
  g.position.set(side * 2.55, 0, ex.z);
  g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; // local +z faces the aisle
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.3), MAT.stone); base.position.y = 0.06; g.add(base);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, TOP - 0.16, 1.15), MAT.stone); body.position.y = 0.12 + (TOP - 0.16) / 2; g.add(body);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 1.3), MAT.stone); cap.position.y = TOP - 0.025; g.add(cap);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.19), new THREE.MeshStandardMaterial({ map: plaqueTex(ex.short || ex.title, ex.date), metalness: 0.6, roughness: 0.4 }));
  plaque.position.set(0, 0.68, 0.578); g.add(plaque);
  const sh = contactShadow(2.6, 2.0); sh.position.y = 0.004; g.add(sh);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.7, 1.35), MAT.hit); hit.position.y = 0.85; g.add(hit);
  g.userData.hit = hit;
  scene.add(g);
  g.updateMatrixWorld(true);
  spotSources.push({ pos: g.localToWorld(new THREE.Vector3(0, TOP, 0)), lightPos: g.localToWorld(new THREE.Vector3(0, 3.9, 0.9)) });
  return g;
}

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

/* --- Senet board */
const SE_S = 0.132;
function seCell(n) { const row = Math.floor((n - 1) / 10), idx = (n - 1) % 10; const col = row === 1 ? 9 - idx : idx; return { x: (col - 4.5) * SE_S, z: (row - 1) * SE_S }; }
function senetSquareTex(n) {
  return tex(160, 160, (g, w) => {
    g.fillStyle = '#e4d3ac'; g.fillRect(0, 0, w, w);
    speckle(g, w, w, 260, ['#b9a57c', '#fff4dc'], 1.2);
    g.strokeStyle = '#2a1a0c'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
    const c = w / 2;
    if (n === 15) { // ankh
      g.beginPath(); g.ellipse(c, 52, 17, 24, 0, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(c, 76); g.lineTo(c, 128); g.moveTo(c - 30, 84); g.lineTo(c + 30, 84); g.stroke();
    } else if (n === 26) { // nefer: good, beautiful
      g.beginPath(); g.arc(c, 106, 24, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(c, 82); g.lineTo(c, 26); g.moveTo(c - 14, 40); g.lineTo(c + 14, 40); g.moveTo(c - 10, 54); g.lineTo(c + 10, 54); g.stroke();
    } else if (n === 27) { // water
      g.strokeStyle = '#1f4c86';
      for (let r = 0; r < 3; r++) { g.beginPath(); for (let i = 0; i <= 8; i++) g.lineTo(26 + i * 13.5, 52 + r * 30 + (i % 2 ? -9 : 9)); g.stroke(); }
    } else if (n >= 28 && n <= 30) {
      const k = 31 - n;
      for (let i = 0; i < k; i++) { const x = c + (i - (k - 1) / 2) * 30; g.beginPath(); g.moveTo(x, 52); g.lineTo(x, 118); g.stroke(); }
      if (n === 30) { g.beginPath(); g.arc(c, 34, 12, 0, TAU); g.stroke(); }
    }
    g.fillStyle = 'rgba(60,40,20,.42)'; g.font = '22px "Montserrat", sans-serif'; g.textAlign = 'left'; g.fillText(String(n), 10, 28);
  });
}
function buildSenetBoard(group) {
  const ebony = new THREE.MeshStandardMaterial({ color: 0x17100b, roughness: 0.45, metalness: 0.05 });
  const w = 10 * SE_S + 0.07, d = 3 * SE_S + 0.07;
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, 0.11, d), ebony); box.position.y = TOP + 0.055; group.add(box);
  const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: 0xd8c6a0, roughness: 0.5 }));
  drawer.position.set(0.42, TOP + 0.055, d / 2 + 0.005); group.add(drawer);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), MAT.brass); knob.position.set(0.42, TOP + 0.055, d / 2 + 0.02); group.add(knob);
  const geo = new THREE.BoxGeometry(SE_S * 0.9, 0.008, SE_S * 0.9);
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xc9b68e });
  for (let n = 1; n <= 30; n++) {
    const { x, z } = seCell(n);
    const t = new THREE.Mesh(geo, [sideMat, sideMat, new THREE.MeshStandardMaterial({ map: senetSquareTex(n), roughness: 0.55 }), sideMat, sideMat, sideMat]);
    t.position.set(x, TOP + 0.112, z); group.add(t);
  }
  return TOP + 0.116;
}
function spoolGeo() { // Tutankhamun-style reel piece
  const pts = [[0, 0], [0.032, 0], [0.034, 0.008], [0.02, 0.018], [0.016, 0.036], [0.02, 0.054], [0.03, 0.062], [0.03, 0.068], [0, 0.068]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 24);
}
function coneGeo() {
  const pts = [[0, 0], [0.032, 0], [0.033, 0.01], [0.022, 0.03], [0.012, 0.062], [0.016, 0.07], [0.008, 0.08], [0, 0.082]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 24);
}

/* --- Mehen */
function buildMehen(group) {
  const lime = new THREE.MeshStandardMaterial({ color: 0xcfbf9c, roughness: 0.85 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.05, 64), lime); disc.position.y = TOP + 0.025; group.add(disc);
  const segMat = new THREE.MeshStandardMaterial({ color: 0xb59f74, roughness: 0.8 });
  const segMat2 = new THREE.MeshStandardMaterial({ color: 0x8f7a54, roughness: 0.8 });
  let th = 2.2, i = 0;
  while (true) {
    const r = 0.055 + 0.052 * (th / TAU);
    if (r > 0.47) break;
    const step = 0.045 / r;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.022, 0.034), i % 2 ? segMat : segMat2);
    seg.position.set(Math.cos(th) * r, TOP + 0.06, Math.sin(th) * r);
    seg.rotation.y = -th; group.add(seg);
    th += step; i++;
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), segMat2); head.scale.set(1.3, 0.5, 0.85); head.position.set(0, TOP + 0.07, 0); group.add(head);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), eyeM); e.position.set(0.035, TOP + 0.085, s * 0.022); group.add(e); }
  const lionMat = new THREE.MeshStandardMaterial({ color: 0xcaa25a, roughness: 0.5, metalness: 0.15 });
  const lionMat2 = new THREE.MeshStandardMaterial({ color: 0x6e7f8e, roughness: 0.5 });
  [[0.66, 0.26, lionMat], [0.74, 0.02, lionMat2], [0.66, -0.22, lionMat]].forEach(([x, z, m], k) => {
    const L = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), m); body.scale.set(1.5, 0.75, 0.75); body.position.y = 0.022; L.add(body);
    const mane = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), m); mane.position.set(0.042, 0.04, 0); L.add(mane);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), m); snout.position.set(0.062, 0.036, 0); L.add(snout);
    L.position.set(x, TOP, z); L.rotation.y = rand(-0.6, 0.6) + Math.PI / 2 * (k % 2 ? 1 : -1);
    group.add(L);
  });
  const marbleMats = [0xe9e2d0, 0x3b2a20, 0xb8432e].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 }));
  for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), marbleMats[k % 3]);
    m.position.set(-0.7 + (k % 3) * 0.05, TOP + 0.016, 0.35 + Math.floor(k / 3) * 0.06); group.add(m);
  }
}

/* --- Başur Höyük pieces */
function buildTokens(group) {
  const velvet = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.75), new THREE.MeshLambertMaterial({ color: 0x2b0f0c }));
  velvet.position.y = TOP + 0.02; group.add(velvet);
  const colors = [0xb14a32, 0xe3d8c2, 0x2a2622, 0x6b7a5a, 0xc88f3c];
  const mats = colors.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }));
  const items = [];
  for (let i = 0; i < 7; i++) items.push(['pyr', i]);
  for (let i = 0; i < 6; i++) items.push(['disc', i]);
  for (let i = 0; i < 4; i++) items.push(['ball', i]);
  for (let i = 0; i < 4; i++) items.push(['pig', i]);
  for (let i = 0; i < 3; i++) items.push(['dog', i]);
  items.forEach(([k, i], n) => {
    const m = mats[(n * 7 + i) % mats.length];
    let o;
    if (k === 'pyr') { o = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), m); o.position.y = 0.03; o.rotation.y = rand(0, 1); }
    else if (k === 'disc') { o = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.016, 18), m); o.position.y = 0.008; }
    else if (k === 'ball') { o = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), m); o.position.y = 0.02; }
    else {
      o = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), m); b.scale.set(1.5, 0.9, 0.9); b.position.y = 0.02; o.add(b);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), m); h.position.set(0.034, 0.026, 0); o.add(h);
      if (k === 'dog') { const e = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.02, 6), m); e.position.set(0.034, 0.045, 0); o.add(e); }
      o.rotation.y = rand(0, TAU);
    }
    const col = n % 6, row = Math.floor(n / 6);
    const holder = new THREE.Group(); holder.add(o);
    holder.position.set(-0.45 + col * 0.18 + rand(-0.03, 0.03), TOP + 0.04, -0.22 + row * 0.15 + rand(-0.02, 0.02));
    group.add(holder);
  });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.42, 0.85), new THREE.MeshStandardMaterial({ color: 0x9fc4c8, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.2, depthWrite: false }));
  glass.position.y = TOP + 0.25; group.add(glass);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: 0xb98a30 }));
  edges.position.copy(glass.position); group.add(edges);
}

/* --- Hounds and Jackals */
function buildHounds(group) {
  const ivory = new THREE.MeshStandardMaterial({ color: 0xe0d0aa, roughness: 0.55 });
  const ebony = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.5 });
  const W = 0.44, H = 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, 0); shape.lineTo(W / 2, 0); shape.lineTo(W / 2, H); shape.absarc(0, H, W / 2, 0, Math.PI, false); shape.lineTo(-W / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 });
  const board = new THREE.Mesh(geo, ivory);
  board.rotation.x = -Math.PI / 2; board.position.set(0, TOP, (H + W / 2) / 2); group.add(board);
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.03, 0.06), ebony); base.position.set(0, TOP + 0.015, (H + W / 2) / 2 + 0.01); group.add(base);
  const topY = TOP + 0.079;
  const hz = z => (H + W / 2) / 2 - z; // board-local y → group z
  const holeGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.004, 10);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x1a120c });
  const holes = [];
  for (const s of [-1, 1]) {
    const track = [];
    for (let i = 0; i < 18; i++) track.push([s * (W / 2 - 0.035), 0.04 + i * (H - 0.04) / 17]);
    for (let i = 1; i <= 11; i++) { const a = Math.PI / 2 - s * (Math.PI / 2) * (1 - i / 12); track.push([Math.cos(a) * (W / 2 - 0.035), H + Math.sin(a) * (W / 2 - 0.035)]); }
    track.forEach(([x, y], i) => {
      const h = new THREE.Mesh(i === 28 ? new THREE.CylinderGeometry(0.013, 0.013, 0.004, 14) : holeGeo, holeMat);
      h.position.set(x, topY, hz(y)); group.add(h); holes.push({ x, y, s, i });
    });
  }
  const palmM = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.6 });
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.004, 0.36), palmM); trunk.position.set(0, topY, hz(0.26)); group.add(trunk);
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k - 3) * 0.42;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6), new THREE.MeshStandardMaterial({ color: 0x3d5a32, roughness: 0.6 }));
    leaf.scale.set(1, 0.06, 0.28); leaf.rotation.y = -a; leaf.position.set(Math.cos(a) * 0.05, topY, hz(0.46) + Math.sin(a) * 0.05); group.add(leaf);
  }
  const pinMat = new THREE.MeshStandardMaterial({ color: 0xcaa24e, metalness: 0.5, roughness: 0.35 });
  const pinMat2 = new THREE.MeshStandardMaterial({ color: 0x2b211a, roughness: 0.45 });
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      const h = holes.find(o => o.s === s && o.i === k * 2 + 1);
      const m = s < 0 ? pinMat : pinMat2;
      const pin = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.12, 8), m); stick.position.y = 0.06; pin.add(stick);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), m); head.scale.set(1.5, 0.9, 0.9); head.position.set(0.006, 0.124, 0); pin.add(head);
      if (s < 0) { for (const e of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), m); ear.scale.set(0.6, 1.4, 0.6); ear.position.set(-0.004, 0.132, e * 0.008); pin.add(ear); } }
      else { for (const e of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.005, 0.026, 6), m); ear.position.set(-0.004, 0.145, e * 0.006); pin.add(ear); } }
      pin.position.set(h.x, topY, hz(h.y)); pin.rotation.y = s < 0 ? 0 : Math.PI; group.add(pin);
    }
  }
}

/* --- Wing II: shared helpers */
function seeded(seed) { // mulberry32, so display boards look the same on every visit
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function topPlane(group, w, d, y, map, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial(Object.assign({ map, roughness: 0.6 }, opts)));
  m.rotation.x = -Math.PI / 2; m.position.y = y; group.add(m); return m;
}
function woodGrain(g, w, h, base, line) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = line; g.globalAlpha = rand(0.04, 0.14); g.lineWidth = rand(1, 3);
    const y = rand(0, h); g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += w / 8) g.lineTo(x, y + Math.sin(x / w * 6 + i) * rand(2, 9));
    g.stroke();
  }
  g.globalAlpha = 1;
}

/* --- Weiqi (Go): a 17 x 17 board like the Eastern Han stone board */
const GO9_S = 0.08; // the 9 x 9 grid fills the same block as the 17 x 17 one
function goCell(p) { const r = (p / 9) | 0, c = p % 9; return { x: (c - 4) * GO9_S, z: (4 - r) * GO9_S }; }
const go9StoneGeo = new THREE.SphereGeometry(0.036, 24, 12);
const GO9_MATS = [new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.32 }), new THREE.MeshStandardMaterial({ color: 0xefe9dc, roughness: 0.28 })];
function buildGo(group) {
  const N = 17, S = 0.04, W = (N - 1) * S + 0.08;
  const kaya = new THREE.MeshStandardMaterial({ color: 0xc79a5c, roughness: 0.55 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, W), kaya); block.position.y = TOP + 0.06; group.add(block);
  const px = 1024, cell = px * S / W, off = px * 0.04 / W;
  const map = tex(px, px, (g) => {
    woodGrain(g, px, px, '#d2a565', '#7a5226');
    g.strokeStyle = '#1d140c'; g.lineWidth = 2.2;
    for (let i = 0; i < N; i++) {
      g.beginPath(); g.moveTo(off, off + i * cell); g.lineTo(off + (N - 1) * cell, off + i * cell); g.stroke();
      g.beginPath(); g.moveTo(off + i * cell, off); g.lineTo(off + i * cell, off + (N - 1) * cell); g.stroke();
    }
    g.fillStyle = '#1d140c';
    for (const a of [3, 8, 13]) for (const b of [3, 8, 13]) { g.beginPath(); g.arc(off + a * cell, off + b * cell, 6, 0, TAU); g.fill(); }
  });
  const face17 = topPlane(group, W, W, TOP + 0.1205, map);
  // The playing face: a 9 x 9 grid on the same block, shown only while a game is on.
  const map9 = tex(px, px, (g) => {
    woodGrain(g, px, px, '#d2a565', '#7a5226');
    const c9 = px * GO9_S / W, o9 = px * 0.04 / W;
    g.strokeStyle = '#1d140c'; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      g.beginPath(); g.moveTo(o9, o9 + i * c9); g.lineTo(o9 + 8 * c9, o9 + i * c9); g.stroke();
      g.beginPath(); g.moveTo(o9 + i * c9, o9); g.lineTo(o9 + i * c9, o9 + 8 * c9); g.stroke();
    }
    g.fillStyle = '#1d140c';
    for (const [a, b] of [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]]) { g.beginPath(); g.arc(o9 + a * c9, o9 + b * c9, 8, 0, TAU); g.fill(); }
  });
  const face9 = topPlane(group, W, W, TOP + 0.1206, map9); face9.visible = false;
  const display = [];
  group.userData.go = { face17, face9, display };
  const stoneGeo = new THREE.SphereGeometry(0.0185, 18, 10);
  const black = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.32 });
  const white = new THREE.MeshStandardMaterial({ color: 0xefe9dc, roughness: 0.28 });
  const R = seeded(548), board = new Map();
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= N || y >= N || board.has(x + ',' + y)) return false;
    board.set(x + ',' + y, c);
    const s = new THREE.Mesh(stoneGeo, c ? white : black); s.scale.y = 0.42;
    s.position.set((x - (N - 1) / 2) * S + (R() - 0.5) * 0.004, TOP + 0.128, (y - (N - 1) / 2) * S + (R() - 0.5) * 0.004);
    group.add(s); display.push(s); return true;
  };
  [[3, 3, 0], [13, 13, 1], [13, 3, 0], [3, 13, 1], [8, 8, 0]].forEach(([x, y, c]) => put(x, y, c));
  const steps = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [2, 0], [0, 2], [1, -1], [-2, 1]];
  let color = 1, guard = 0;
  while (board.size < 62 && guard++ < 2000) {
    const mine = [...board].filter(([, c]) => c === color);
    const [k] = mine[(R() * mine.length) | 0];
    const [x, y] = k.split(',').map(Number);
    const [dx, dy] = steps[(R() * steps.length) | 0];
    if (put(x + dx, y + dy, color)) color = 1 - color;
  }
  const bowlGeo = new THREE.LatheGeometry([[0, 0], [0.05, 0.004], [0.072, 0.03], [0.07, 0.07], [0.06, 0.085], [0, 0.085]].map(([a, b]) => new THREE.Vector2(a, b)), 28);
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(bowlGeo, bowlMat); b.position.set(s * (W / 2 + 0.14), TOP, s * 0.2); group.add(b);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.066, 0.012, 28), bowlMat); lid.position.set(s * (W / 2 + 0.14), TOP + 0.006, s * 0.2 - s * 0.17); lid.rotation.x = 0.08; group.add(lid);
  }
  return TOP + 0.1206;
}

/* --- Ludus latrunculorum: an incised stone board with glass counters */
function buildLatrunculi(group) {
  const W = 0.84, D = 0.74, n = 8, cs = 0.085;
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xb3a68f, roughness: 0.9, map: stoneTex() });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, D), slabMat); slab.position.y = TOP + 0.03; group.add(slab);
  const px = 1024;
  const map = tex(px, Math.round(px * D / W), (g, w, h) => {
    g.fillStyle = '#b8ab93'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 4000, ['#857a68', '#d8ccb4', '#6f6555'], 2.2);
    const sx = w / W, x0 = w / 2 - (n / 2) * cs * sx, y0 = h / 2 - (n / 2) * cs * sx;
    g.strokeStyle = 'rgba(60,50,38,.75)'; g.lineCap = 'round';
    for (let i = 0; i <= n; i++) {
      for (const pass of [0, 1]) {
        g.lineWidth = pass ? 1.5 : 4.5; g.strokeStyle = pass ? 'rgba(220,210,190,.35)' : 'rgba(55,46,35,.7)';
        g.beginPath(); g.moveTo(x0 + rand(-3, 3), y0 + i * cs * sx + rand(-2, 2)); g.lineTo(x0 + n * cs * sx + rand(-3, 3), y0 + i * cs * sx + rand(-2, 2)); g.stroke();
        g.beginPath(); g.moveTo(x0 + i * cs * sx + rand(-2, 2), y0 + rand(-3, 3)); g.lineTo(x0 + i * cs * sx + rand(-2, 2), y0 + n * cs * sx + rand(-3, 3)); g.stroke();
      }
    }
  });
  topPlane(group, W, D, TOP + 0.0605, map, { roughness: 0.9 });
  const glass = [0x2f5fb3, 0xe6eef2].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.88 }));
  const cGeo = new THREE.SphereGeometry(0.03, 20, 12); // squashed into a bun-shaped counter
  const R = seeded(116);
  const taken = new Set();
  const place = (c, r, side) => {
    if (taken.has(c + ',' + r)) return; taken.add(c + ',' + r);
    const m = new THREE.Mesh(cGeo, glass[side]); m.scale.set(1, 0.42, 1);
    m.position.set((c - 3.5) * cs, TOP + 0.072, (r - 3.5) * cs); group.add(m);
  };
  for (let c = 0; c < 8; c++) { if (R() > 0.3) place(c, 0, 0); if (R() > 0.5) place(c, 1, 0); if (R() > 0.3) place(c, 7, 1); if (R() > 0.5) place(c, 6, 1); }
  for (let k = 0; k < 6; k++) place((R() * 8) | 0, 2 + ((R() * 4) | 0), k % 2);
  for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(cGeo, glass[k % 2]); m.scale.set(1, 0.42, 1); m.position.set(W / 2 + 0.1 + (k % 2) * 0.07, TOP + 0.013, -0.2 + k * 0.08); group.add(m); }
}

/* --- Nine Men's Morris board */
const MO_S = [0.36, 0.24, 0.12];
const MO_DIR = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
function moPoint(p) { const r = (p / 8) | 0, k = p % 8, s = MO_S[r]; return { x: MO_DIR[k][0] * s, z: MO_DIR[k][1] * s }; }
function buildMorrisBoard(group) {
  const W = 0.86;
  const block = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, W), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.55 }));
  block.position.y = TOP + 0.025; group.add(block);
  const px = 1024, sc = px / W, c = px / 2;
  const map = tex(px, px, (g) => {
    woodGrain(g, px, px, '#6e4728', '#2a170a');
    g.strokeStyle = '#e7d7b0'; g.lineWidth = 9; g.lineCap = 'square';
    for (const s of MO_S) g.strokeRect(c - s * sc, c - s * sc, 2 * s * sc, 2 * s * sc);
    g.beginPath();
    g.moveTo(c, c - MO_S[0] * sc); g.lineTo(c, c - MO_S[2] * sc); g.moveTo(c, c + MO_S[2] * sc); g.lineTo(c, c + MO_S[0] * sc);
    g.moveTo(c - MO_S[0] * sc, c); g.lineTo(c - MO_S[2] * sc, c); g.moveTo(c + MO_S[2] * sc, c); g.lineTo(c + MO_S[0] * sc, c);
    g.stroke();
    g.fillStyle = '#e7d7b0';
    for (let p = 0; p < 24; p++) { const q = moPoint(p); g.beginPath(); g.arc(c + q.x * sc, c + q.z * sc, 17, 0, TAU); g.fill(); }
    g.fillStyle = '#3a2412';
    for (let p = 0; p < 24; p++) { const q = moPoint(p); g.beginPath(); g.arc(c + q.x * sc, c + q.z * sc, 8, 0, TAU); g.fill(); }
  });
  topPlane(group, W, W, TOP + 0.0505, map, { roughness: 0.5 });
  return TOP + 0.051;
}
const morrisPieceGeo = new THREE.LatheGeometry([[0, 0], [0.034, 0], [0.036, 0.006], [0.034, 0.014], [0.024, 0.02], [0, 0.022]].map(([a, b]) => new THREE.Vector2(a, b)), 28);

/* --- Oware board: two rows of six pits and a store at each end */
const OW_DX = 0.145;
function owPit(i) { const near = i < 6, col = near ? i : 11 - i; return { x: (col - 2.5) * OW_DX, z: near ? 0.078 : -0.078 }; }
function owStore(pl) { return { x: pl === 0 ? 0.5 : -0.5, z: 0 }; }
function buildOwareBoard(group) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x3b2110, roughness: 0.6 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.075, 0.36), wood); block.position.y = TOP + 0.05; group.add(block);
  topPlane(group, 1.16, 0.36, TOP + 0.0876, tex(1024, 320, (g, w, h) => woodGrain(g, w, h, '#4a2a14', '#120803')), { roughness: 0.6 });
  for (const s of [-1, 1]) { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.3), wood); foot.position.set(s * 0.42, TOP + 0.01, 0); group.add(foot); }
  const y = TOP + 0.089;
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x5e3619, roughness: 0.5 });
  const rimGeo = new THREE.TorusGeometry(0.058, 0.007, 8, 32);
  const pits = [];
  for (let i = 0; i < 12; i++) {
    const p = owPit(i);
    const mat = new THREE.MeshStandardMaterial({ color: 0x140a04, roughness: 0.85 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.004, 28), mat);
    disc.position.set(p.x, y, p.z); disc.userData.mats = [mat]; group.add(disc); pits.push(disc);
    const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.x = -Math.PI / 2; rim.position.set(p.x, y + 0.002, p.z); group.add(rim);
  }
  for (const pl of [0, 1]) {
    const p = owStore(pl);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.004, 28), new THREE.MeshStandardMaterial({ color: 0x140a04, roughness: 0.85 }));
    st.scale.z = 1.9; st.position.set(p.x, y, p.z); group.add(st);
  }
  group.userData.pits = pits;
  return y + 0.003;
}
const seedGeo = new THREE.SphereGeometry(0.0105, 10, 8);

/* --- Brandubh board, after the yew board from Ballinderry */
const BR_S = 0.118;
function brCell(i) { const r = (i / 7) | 0, c = i % 7; return { x: (c - 3) * BR_S, z: (r - 3) * BR_S }; }
function buildBrandubhBoard(group) {
  const W = 0.92;
  const yew = new THREE.MeshStandardMaterial({ color: 0x8a5228, roughness: 0.55 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, W), yew); block.position.y = TOP + 0.025; group.add(block);
  const px = 1024, sc = px / W, c = px / 2;
  const map = tex(px, px, (g) => {
    woodGrain(g, px, px, '#94592b', '#3a1d08');
    // Interlace border
    g.strokeStyle = 'rgba(40,20,6,.75)'; g.lineWidth = 7;
    const inset = 46;
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      for (let x = inset; x <= px - inset; x += 4) g.lineTo(x, inset + Math.sin(x / 26 + k * Math.PI) * 14);
      g.stroke(); g.beginPath();
      for (let x = inset; x <= px - inset; x += 4) g.lineTo(x, px - inset + Math.sin(x / 26 + k * Math.PI) * 14);
      g.stroke(); g.beginPath();
      for (let y = inset; y <= px - inset; y += 4) g.lineTo(inset + Math.sin(y / 26 + k * Math.PI) * 14, y);
      g.stroke(); g.beginPath();
      for (let y = inset; y <= px - inset; y += 4) g.lineTo(px - inset + Math.sin(y / 26 + k * Math.PI) * 14, y);
      g.stroke();
    }
    for (let i = 0; i < 49; i++) {
      const q = brCell(i), x = c + q.x * sc, y = c + q.z * sc;
      g.fillStyle = '#1a0d04'; g.beginPath(); g.arc(x, y, 15, 0, TAU); g.fill();
      if (i === 24 || [0, 6, 42, 48].includes(i)) { g.strokeStyle = 'rgba(30,15,4,.85)'; g.lineWidth = 6; g.beginPath(); g.arc(x, y, 40, 0, TAU); g.stroke(); }
    }
  });
  topPlane(group, W, W, TOP + 0.0505, map, { roughness: 0.5 });
  for (const [x, z] of [[0, -W / 2 - 0.03], [0, W / 2 + 0.03], [-W / 2 - 0.03, 0], [W / 2 + 0.03, 0]]) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), yew); head.scale.set(1, 0.7, 1); head.position.set(x, TOP + 0.025, z); group.add(head);
  }
  return TOP + 0.051;
}
const brPawnGeo = new THREE.LatheGeometry([[0, 0], [0.03, 0], [0.032, 0.008], [0.018, 0.02], [0.014, 0.04], [0.022, 0.05], [0.02, 0.058], [0, 0.064]].map(([a, b]) => new THREE.Vector2(a, b)), 24);
const brKingGeo = new THREE.LatheGeometry([[0, 0], [0.036, 0], [0.038, 0.01], [0.022, 0.026], [0.017, 0.06], [0.028, 0.072], [0.026, 0.084], [0.012, 0.092], [0.016, 0.1], [0, 0.104]].map(([a, b]) => new THREE.Vector2(a, b)), 28);

/* --- Wing III: Tables board (backgammon layout) */
const TB_W = 0.0967, TB_HALF = 0.62, TB_BAR = 0.04;
function tbPointX(abs) {
  if (abs <= 6) return TB_HALF - (abs - 0.5) * TB_W;
  if (abs <= 12) return -TB_BAR - (abs - 6 - 0.5) * TB_W;
  if (abs <= 18) return -TB_HALF + (abs - 12 - 0.5) * TB_W;
  return TB_BAR + (abs - 18 - 0.5) * TB_W;
}
function buildTablesBoard(group) {
  const W = 1.42, D = 0.98;
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2312, roughness: 0.5 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, D), wood); box.position.y = TOP + 0.025; group.add(box);
  const px = 1420, py = 980, sc = px / W;
  const map = tex(px, py, (g) => {
    woodGrain(g, px, py, '#5a3a1e', '#1e1006');
    // Felt fields either side of the bar
    for (const s of [-1, 1]) {
      const x0 = px / 2 + s * TB_BAR * sc, x1 = px / 2 + s * (TB_HALF + 0.02) * sc;
      g.fillStyle = '#21402e'; g.fillRect(Math.min(x0, x1), 0.05 * sc, Math.abs(x1 - x0), py - 0.1 * sc);
    }
    for (let abs = 1; abs <= 24; abs++) {
      const x = px / 2 + tbPointX(abs) * sc, top = abs > 12;
      const yBase = top ? 0.05 * sc : py - 0.05 * sc, yTip = top ? yBase + 0.36 * sc : yBase - 0.36 * sc;
      g.fillStyle = abs % 2 ? '#e7d6b0' : '#7a2a1c';
      g.beginPath(); g.moveTo(x - TB_W / 2 * sc + 3, yBase); g.lineTo(x + TB_W / 2 * sc - 3, yBase); g.lineTo(x, yTip); g.closePath(); g.fill();
    }
    g.fillStyle = '#2a170a'; g.fillRect(px / 2 - TB_BAR * sc, 0, 2 * TB_BAR * sc, py);
  });
  topPlane(group, W, D, TOP + 0.0505, map, { roughness: 0.6 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2a170a, roughness: 0.45 });
  for (const [x, z, w, d] of [[0, -D / 2, W, 0.03], [0, D / 2, W, 0.03], [-W / 2, 0, 0.03, D], [W / 2, 0, 0.03, D], [0, 0, 0.06, D]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), rimMat); r.position.set(x, TOP + 0.062, z); group.add(r);
  }
  return TOP + 0.052;
}
const tbCheckerGeo = new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.042, 0.005], [0.042, 0.011], [0.038, 0.015], [0, 0.015]].map(([a, b]) => new THREE.Vector2(a, b)), 28);

/* --- Wing III: Chaturanga on an ashtapada board */
const CR_MAKE = {
  raja(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.06, 14), m); b.position.y = 0.03; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), m); h.position.y = 0.068; g.add(h); const u = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.014, 16), m); u.position.y = 0.088; g.add(u); return g; },
  mantri(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.05, 14), m); b.position.y = 0.025; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), m); h.scale.y = 1.2; h.position.y = 0.062; g.add(h); return g; },
  gaja(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.032), m); b.position.y = 0.04; g.add(b); for (const [x, z] of [[-0.016, -0.011], [-0.016, 0.011], [0.016, -0.011], [0.016, 0.011]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.026, 8), m); l.position.set(x, 0.013, z); g.add(l); } const h = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), m); h.position.set(0.03, 0.05, 0); g.add(h); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.035, 8), m); t.position.set(0.04, 0.032, 0); t.rotation.z = 0.25; g.add(t); return g; },
  ashva(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 0.018), m); b.position.y = 0.036; g.add(b); for (const [x, z] of [[-0.016, -0.006], [-0.016, 0.006], [0.016, -0.006], [0.016, 0.006]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.027, 6), m); l.position.set(x, 0.013, z); g.add(l); } const n = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.012), m); n.position.set(0.022, 0.054, 0); n.rotation.z = -0.4; g.add(n); const h = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.01, 0.01), m); h.position.set(0.032, 0.068, 0); g.add(h); return g; },
  ratha(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.026, 0.03), m); b.position.y = 0.03; g.add(b); for (const z of [-0.018, 0.018]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 6, 16), m); w.position.set(-0.004, 0.017, z); g.add(w); } const p = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.04, 6), m); p.position.set(0.012, 0.06, 0); g.add(p); return g; },
  padati(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 10), m); b.position.y = 0.02; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), m); h.position.y = 0.045; g.add(h); return g; },
  // A boat for chaturaji: a hull with a raised prow and stern, and a short mast.
  nauka(m) { const g = new THREE.Group(); const keel = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.008, 0.016), m); keel.position.y = 0.004; g.add(keel); const hull = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.014, 0.026), m); hull.position.y = 0.015; g.add(hull); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.03, 8), m); p.position.set(s * 0.027, 0.026, 0); p.rotation.z = -s * 0.6; g.add(p); } const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.05, 6), m); mast.position.y = 0.045; g.add(mast); const sail = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.026, 0.028), m); sail.position.set(0.003, 0.05, 0); g.add(sail); return g; },
};
function buildChaturanga(group) {
  const S = 0.088, W = 8 * S + 0.06;
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, W), new THREE.MeshStandardMaterial({ color: 0x7a3b1c, roughness: 0.9 }));
  cloth.position.y = TOP + 0.01; group.add(cloth);
  const px = 1024, sc = px / W, c0 = px / 2 - 4 * S * sc;
  const map = tex(px, px, (g) => {
    g.fillStyle = '#9a4a22'; g.fillRect(0, 0, px, px);
    speckle(g, px, px, 6000, ['#6e2f12', '#b9643a', '#5a240c'], 1.6);
    g.strokeStyle = '#f0d58a'; g.lineWidth = 5;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(c0, c0 + i * S * sc); g.lineTo(c0 + 8 * S * sc, c0 + i * S * sc); g.stroke();
      g.beginPath(); g.moveTo(c0 + i * S * sc, c0); g.lineTo(c0 + i * S * sc, c0 + 8 * S * sc); g.stroke();
    }
    g.lineWidth = 4;
    for (const [r, c] of [[0, 0], [0, 7], [7, 0], [7, 7], [3, 3], [3, 4], [4, 3], [4, 4]]) {
      const x = c0 + c * S * sc, y = c0 + r * S * sc, d = S * sc;
      g.beginPath(); g.moveTo(x + 10, y + 10); g.lineTo(x + d - 10, y + d - 10); g.moveTo(x + d - 10, y + 10); g.lineTo(x + 10, y + d - 10); g.stroke();
    }
  });
  topPlane(group, W, W, TOP + 0.0205, map, { roughness: 0.9 });
  const y0 = TOP + 0.021;
  const cell = (r, c) => V3((c - 3.5) * S, y0, (r - 3.5) * S);
  const mats = [new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: 0x8e2a1e, roughness: 0.45 })];
  const back = ['ratha', 'ashva', 'gaja', 'raja', 'mantri', 'gaja', 'ashva', 'ratha'];
  for (const side of [0, 1]) {
    const m = mats[side], r0 = side ? 7 : 0, r1 = side ? 6 : 1, face = side ? Math.PI / 2 : -Math.PI / 2;
    back.forEach((k, c) => { const o = CR_MAKE[k](m); o.position.copy(cell(r0, c)); o.rotation.y = face; group.add(o); });
    for (let c = 0; c < 8; c++) { const o = CR_MAKE.padati(m); o.position.copy(cell(r1, c)); group.add(o); }
  }
}

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

/* --- Wing VI: Seega, on a slab of Egyptian limestone with twenty-five cups */
const SG_S = 0.1;
function sgCell(i) { const x = i % 5, y = (i / 5) | 0; return { x: (x - 2) * SG_S, z: (2 - y) * SG_S }; }
const sgStoneGeo = new THREE.SphereGeometry(0.032, 20, 12);
function sgStone(pl) {
  const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x9c3e1c : 0x121010, roughness: pl ? 0.75 : 0.4 });
  const m = new THREE.Mesh(sgStoneGeo, mat); m.scale.set(1, 0.5, 0.88); m.userData.mats = [mat]; return m;
}
function buildSeega(group) {
  const W = 5 * SG_S + 0.08;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, W), new THREE.MeshStandardMaterial({ color: 0xcdb894, roughness: 0.95 }));
  slab.position.y = TOP + 0.02; group.add(slab);
  const px = 1024, sc = px / W, d = SG_S * sc, c0 = px / 2 - 2.5 * d;
  topPlane(group, W, W, TOP + 0.0405, tex(px, px, (g) => {
    g.fillStyle = '#d6c39e'; g.fillRect(0, 0, px, px);
    speckle(g, px, px, 9000, ['#c4ae86', '#e2d2b0', '#b9a37c', '#cdb894'], 2.2);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      const cx = c0 + (x + 0.5) * d, cy = c0 + (y + 0.5) * d, r = d * 0.36;
      const grd = g.createRadialGradient(cx, cy - r * 0.2, r * 0.2, cx, cy, r);
      grd.addColorStop(0, '#8a7656'); grd.addColorStop(0.75, '#a48e68'); grd.addColorStop(1, '#c2ab84');
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    }
    const cx = c0 + 2.5 * d, cy = cx, k = d * 0.42; // the centre cup is marked
    g.strokeStyle = '#6e5a3e'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - k, cy - k); g.lineTo(cx + k, cy + k); g.moveTo(cx + k, cy - k); g.lineTo(cx - k, cy + k); g.stroke();
  }), { roughness: 0.95 });
  const y = TOP + 0.041, shown = [];
  [[0, 1], [3, 1], [6, 0], [8, 0], [16, 1], [18, 0], [21, 1], [23, 1], [11, 0], [13, 1]].forEach(([i, pl]) => { const s = sgStone(pl), c = sgCell(i); s.position.set(c.x, y + 0.012, c.z); group.add(s); shown.push(s); });
  group.userData.display = shown;
  return y;
}

/* --- Wing VI: Tâb, four rows of squares scratched in a plank, stone and tile pieces */
const TAB_S = 0.07;
function tabCell(i) { const W = 9, r = (i / W) | 0, c = i % W; return { x: (c - 4) * TAB_S, z: (1.5 - r) * TAB_S }; }
const tabPieceGeo = new THREE.CylinderGeometry(0.024, 0.026, 0.014, 18);
function tabPiece(pl) {
  const mat = new THREE.MeshStandardMaterial({ color: pl ? 0xb04a26 : 0x2a2622, roughness: pl ? 0.8 : 0.5 });
  const m = new THREE.Mesh(tabPieceGeo, mat); m.userData.mats = [mat];
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.003, 6, 20), new THREE.MeshStandardMaterial({ color: 0xf1e3bf, roughness: 0.5 }));
  band.rotation.x = -Math.PI / 2; band.position.y = 0.0075; band.visible = false; m.add(band); m.userData.band = band;
  return m;
}
function buildTab(group) {
  const W = 9 * TAB_S + 0.08, D = 4 * TAB_S + 0.08;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, D), new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 0.7 }));
  board.position.y = TOP + 0.015; group.add(board);
  const px = 1536, py = Math.round(px * D / W), sc = px / W, d = TAB_S * sc, x0 = px / 2 - 4.5 * d, y0 = py / 2 - 2 * d;
  topPlane(group, W, D, TOP + 0.0305, tex(px, py, (g) => {
    woodGrain(g, px, py, '#a87c4c', '#6e4a28');
    g.strokeStyle = '#3a2412'; g.lineWidth = 5;
    for (let r = 0; r <= 4; r++) { g.beginPath(); g.moveTo(x0, y0 + r * d); g.lineTo(x0 + 9 * d, y0 + r * d); g.stroke(); }
    for (let c = 0; c <= 9; c++) { g.beginPath(); g.moveTo(x0 + c * d, y0); g.lineTo(x0 + c * d, y0 + 4 * d); g.stroke(); }
    // Arrows: each row runs one way for both players (row 0 is nearest the visitor, drawn at the bottom)
    g.fillStyle = 'rgba(58,36,18,.55)';
    for (let r = 0; r < 4; r++) {
      const dir = [1, -1, 1, -1][r], cy = y0 + (3 - r + 0.5) * d;
      for (let c = 0; c < 9; c += 2) {
        const cx = x0 + (c + 0.5) * d + dir * d * 0.36;
        g.beginPath(); g.moveTo(cx + dir * 9, cy); g.lineTo(cx - dir * 7, cy - 8); g.lineTo(cx - dir * 7, cy + 8); g.closePath(); g.fill();
      }
    }
  }), { roughness: 0.75 });
  const y = TOP + 0.031, shown = [];
  for (let c = 0; c < 9; c++) for (const pl of [0, 1]) { const p = tabPiece(pl), at = tabCell(pl ? 27 + c : c); p.position.set(at.x, y + 0.007, at.z); group.add(p); shown.push(p); }
  group.userData.display = shown;
  return y;
}

/* --- Wing VI: Bagh-chal, the tiger game of Nepal, on a lined board */
const BC_S = 0.11;
function bcCell(i) { const r = (i / 5) | 0, c = i % 5; return { x: (c - 2) * BC_S, z: (2 - r) * BC_S }; }
const bcStripe = tex(128, 64, (g, w, h) => { g.fillStyle = '#d9822b'; g.fillRect(0, 0, w, h); g.fillStyle = '#1e1208'; for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(k * 16, 0); g.lineTo(k * 16 + 7, 0); g.lineTo(k * 16 + 3, h); g.lineTo(k * 16 - 3, h); g.fill(); } });
function bcTiger() {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ map: bcStripe, roughness: 0.55 }), plain = new THREE.MeshStandardMaterial({ color: 0xd9822b, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.05, 20), mat); body.position.y = 0.025; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), plain); head.position.y = 0.064; g.add(head);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.014, 8), plain); e.position.set(s * 0.013, 0.081, 0); g.add(e); }
  g.userData.mats = [mat, plain]; return g;
}
function bcGoat() {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0xf0e9da, roughness: 0.7 }), horn = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.021, 0.03, 16), mat); body.position.y = 0.015; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.013, 14, 10), mat); head.position.y = 0.04; g.add(head);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.0035, 0.016, 6), horn); h.position.set(s * 0.007, 0.054, 0); h.rotation.z = -s * 0.35; g.add(h); }
  g.userData.mats = [mat]; return g;
}
function buildBaghchal(group) {
  const W = 4 * BC_S + 0.14;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.035, W), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.6 }));
  board.position.y = TOP + 0.0175; group.add(board);
  const px = 1024, sc = px / W, o = px / 2 - 2 * BC_S * sc, st = BC_S * sc;
  topPlane(group, W, W, TOP + 0.0355, tex(px, px, (g) => {
    g.fillStyle = '#9c6b3c'; g.fillRect(0, 0, px, px);
    woodGrain(g, px, px, '#a8743f', '#7a4f2a');
    g.strokeStyle = '#8a1e14'; g.lineWidth = 16; g.strokeRect(10, 10, px - 20, px - 20); // a red painted border, as on Nepali brass boards
    g.strokeStyle = '#2a170b'; g.lineWidth = 7; g.lineCap = 'round';
    const P = (r, c) => [o + c * st, o + (4 - r) * st];
    const line = (a, b) => { g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.stroke(); };
    for (let k = 0; k < 5; k++) { line([k, 0], [k, 4]); line([0, k], [4, k]); }
    line([0, 0], [4, 4]); line([0, 4], [4, 0]); line([2, 0], [0, 2]); line([0, 2], [2, 4]); line([2, 4], [4, 2]); line([4, 2], [2, 0]);
    g.fillStyle = '#2a170b';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const [x, y] = P(r, c); g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill(); }
  }), { roughness: 0.6 });
  const y = TOP + 0.036, shown = [];
  for (const i of [0, 4, 20, 24]) { const t = bcTiger(), c = bcCell(i); t.position.set(c.x, y, c.z); group.add(t); shown.push(t); }
  for (const i of [7, 11, 12, 13, 17]) { const t = bcGoat(), c = bcCell(i); t.position.set(c.x, y, c.z); group.add(t); shown.push(t); }
  group.userData.display = shown;
  return y;
}

/* --- Wing III: Four Seasons chess, after Alfonso X's book of games */
const FS_S = 0.085;
const FS_COL = [0x8c1d12, 0x1a1714, 0xe6dcc6, 0x1d4a1c]; // red (you), black, white, green
const FS_KIND = [null, 'raja', 'ratha', 'ashva', 'gaja', 'padati', 'mantri'];
function fsCell(i) { const x = i & 7, y = i >> 3; return { x: (x - 3.5) * FS_S, z: (3.5 - y) * FS_S }; }
function fsPiece(v) {
  const s = v >> 5, mat = new THREE.MeshStandardMaterial({ color: FS_COL[s], roughness: s === 2 ? 0.5 : 0.4 });
  const o = CR_MAKE[FS_KIND[v & 7]](mat); o.userData.mats = [mat]; o.userData.seat = s;
  o.rotation.y = [Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4, -Math.PI / 4][s]; // facing the centre from each corner
  o.scale.setScalar(1.15);
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

/* --- Wing III: Shatranj board and pieces */
const SJ_S = 0.09;
function sjCell(i) { const r = i >> 3, c = i & 7; return { x: (c - 3.5) * SJ_S, z: (3.5 - r) * SJ_S }; }
function buildShatranjBoard(group) {
  const W = 8 * SJ_S + 0.08;
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, W), new THREE.MeshStandardMaterial({ color: 0x3a120c, roughness: 0.8 }));
  base.position.y = TOP + 0.015; group.add(base);
  const px = 1024, sc = px / W, c0 = px / 2 - 4 * SJ_S * sc;
  const map = tex(px, px, (g) => {
    g.fillStyle = '#6a1c14'; g.fillRect(0, 0, px, px);
    speckle(g, px, px, 5000, ['#4a100a', '#8a2e1e'], 1.4);
    g.strokeStyle = '#d8b25a'; g.lineWidth = 4;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(c0, c0 + i * SJ_S * sc); g.lineTo(c0 + 8 * SJ_S * sc, c0 + i * SJ_S * sc); g.stroke();
      g.beginPath(); g.moveTo(c0 + i * SJ_S * sc, c0); g.lineTo(c0 + i * SJ_S * sc, c0 + 8 * SJ_S * sc); g.stroke();
    }
    g.lineWidth = 2; g.strokeStyle = 'rgba(216,178,90,.6)';
    g.strokeRect(c0 - 16, c0 - 16, 8 * SJ_S * sc + 32, 8 * SJ_S * sc + 32);
    for (let k = 0; k < 40; k++) { const a = k / 40 * TAU; g.beginPath(); g.arc(px / 2 + Math.cos(a) * (px * 0.47), px / 2 + Math.sin(a) * (px * 0.47), 3, 0, TAU); }
  });
  topPlane(group, W, W, TOP + 0.0305, map, { roughness: 0.85 });
  return TOP + 0.031;
}
// Aniconic piece shapes in the style of early Islamic chessmen.
function sjPiece(type, mat) {
  const g = new THREE.Group();
  const lathe = (pts, y = 0) => { const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 20), mat); m.position.y = y; g.add(m); return m; };
  const base = [[0, 0], [0.026, 0], [0.027, 0.006], [0.02, 0.012]];
  if (type === 1) { lathe([...base, [0.019, 0.045], [0.024, 0.05], [0.016, 0.066], [0.005, 0.074], [0, 0.075]]); }
  else if (type === 2) { lathe([...base, [0.017, 0.034], [0.019, 0.04], [0.011, 0.052], [0, 0.056]]); }
  else if (type === 3) { lathe([...base, [0.018, 0.032], [0.016, 0.04], [0, 0.042]]); for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.022, 8), mat); t.position.set(0, 0.048, s * 0.008); t.rotation.x = s * 0.35; g.add(t); } }
  else if (type === 4) { lathe([...base, [0.018, 0.03], [0.014, 0.036], [0, 0.038]]); const w = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.012), mat); w.position.set(0.006, 0.046, 0); w.rotation.z = 0.5; g.add(w); }
  else if (type === 5) { lathe([...base, [0.02, 0.036], [0.024, 0.04], [0, 0.04]]); for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.03), mat); h.position.set(s * 0.01, 0.047, 0); h.rotation.z = -s * 0.25; g.add(h); } }
  else { lathe([[0, 0], [0.02, 0], [0.021, 0.005], [0.015, 0.01], [0.014, 0.024], [0.008, 0.032], [0, 0.034]]); }
  g.userData.mats = [mat];
  return g;
}

/* --- Wing III: the Lewis chessmen (simplified figures, not copies) */
function buildLewis(group) {
  const velvet = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 0.78), new THREE.MeshLambertMaterial({ color: 0x1d2a3a }));
  velvet.position.y = TOP + 0.02; group.add(velvet);
  const ivory = new THREE.MeshStandardMaterial({ color: 0xe6d9bd, roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0x9a4b3a, roughness: 0.55 });
  const y0 = TOP + 0.04;
  const seated = (m, opts) => {
    const g = new THREE.Group();
    const throne = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.06), m); throne.position.y = 0.04; g.add(throne);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.012), m); back.position.set(0, 0.11, -0.026); g.add(back);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.07, 14), m); body.position.set(0, 0.115, 0.004); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.019, 14, 12), m); head.scale.y = 1.15; head.position.set(0, 0.168, 0.006); g.add(head);
    if (opts.crown) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.012, 14, 1, true), m); c.position.set(0, 0.188, 0.006); g.add(c); }
    if (opts.mitre) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.03, 4), m); c.position.set(0, 0.198, 0.006); c.rotation.y = Math.PI / 4; g.add(c); }
    if (opts.sword) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.004, 0.07), m); s.position.set(0, 0.09, 0.04); s.rotation.y = 0.9; g.add(s); }
    if (opts.cheek) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 8), m); a.position.set(0.016, 0.145, 0.022); a.rotation.x = -0.6; g.add(a); }
    if (opts.crozier) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.17, 6), m); c.position.set(0.03, 0.1, 0.03); g.add(c); const t = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.003, 6, 12, Math.PI * 1.5), m); t.position.set(0.03, 0.19, 0.03); g.add(t); }
    return g;
  };
  const warder = (m, biting) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.12, 14), m); body.position.y = 0.06; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 12), m); head.position.y = biting ? 0.128 : 0.135; g.add(head);
    const helm = new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.024, 14), m); helm.position.y = 0.155; g.add(helm);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.008, 3), m); shield.rotation.x = Math.PI / 2; shield.rotation.z = Math.PI; shield.position.set(0, biting ? 0.1 : 0.075, 0.026); g.add(shield);
    return g;
  };
  const knight = m => {
    const g = new THREE.Group();
    const horse = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.03), m); horse.position.y = 0.05; g.add(horse);
    for (const [x, z] of [[-0.026, -0.01], [-0.026, 0.01], [0.026, -0.01], [0.026, 0.01]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.034, 6), m); l.position.set(x, 0.017, z); g.add(l); }
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.04, 0.018), m); neck.position.set(0.04, 0.075, 0); neck.rotation.z = -0.3; g.add(neck);
    const rider = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.06, 12), m); rider.position.set(-0.004, 0.098, 0); g.add(rider);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), m); head.position.set(-0.004, 0.137, 0); g.add(head);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.006, 3), m); shield.rotation.x = Math.PI / 2; shield.position.set(-0.004, 0.09, -0.024); g.add(shield);
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.13, 6), m); spear.position.set(0.012, 0.13, 0.018); g.add(spear);
    return g;
  };
  const pawn = m => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.06, 8), m); p.position.y = 0.03; const g = new THREE.Group(); g.add(p); return g; };
  const set = [
    [seated(ivory, { crown: true, sword: true }), -0.45, -0.14], [seated(red, { crown: true, cheek: true }), -0.3, -0.16],
    [seated(ivory, { mitre: true, crozier: true }), -0.14, -0.15], [knight(ivory), 0.03, -0.16],
    [warder(ivory, true), 0.2, -0.15], [warder(red, false), 0.33, -0.15], [seated(red, { crown: true, sword: true }), 0.48, -0.15],
    [pawn(ivory), -0.36, 0.17], [pawn(red), -0.24, 0.18], [pawn(ivory), -0.12, 0.17],
  ];
  for (const [o, x, z] of set) { o.position.set(x, y0, z); o.rotation.y = rand(-0.2, 0.2); group.add(o); }
  for (let k = 0; k < 6; k++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 20), ivory); d.position.set(0.12 + (k % 3) * 0.055, y0 + 0.006 + Math.floor(k / 3) * 0.012, 0.18); group.add(d); }
  glassCase(group, 1.3, 0.48, 0.85);
}
function glassCase(group, w, h, d) {
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x9fc4c8, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.2, depthWrite: false }));
  glass.position.y = TOP + h / 2 + 0.02; group.add(glass);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: 0xb98a30 }));
  edges.position.copy(glass.position); group.add(edges);
}

/* --- Wing III: cards. Every face here is an original design in an old style. */
function cardTex(draw, w = 200, h = 320) {
  return tex(w, h, (g) => { draw(g, w, h); });
}
function suitMark(g, suit, x, y, s, col) {
  g.save(); g.translate(x, y); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = s * 0.12;
  if (suit === 'coin') { g.beginPath(); g.arc(0, 0, s * 0.5, 0, TAU); g.fill(); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(0, 0, s * 0.22, 0, TAU); g.fill(); }
  else if (suit === 'cup') { g.beginPath(); g.moveTo(-s * 0.4, -s * 0.4); g.quadraticCurveTo(0, s * 0.35, s * 0.4, -s * 0.4); g.closePath(); g.fill(); g.fillRect(-s * 0.06, -s * 0.05, s * 0.12, s * 0.4); g.fillRect(-s * 0.25, s * 0.35, s * 0.5, s * 0.1); }
  else if (suit === 'sword') { g.beginPath(); g.moveTo(-s * 0.55, s * 0.55); g.lineTo(s * 0.5, -s * 0.5); g.stroke(); g.beginPath(); g.moveTo(-s * 0.45, s * 0.2); g.lineTo(-s * 0.2, s * 0.45); g.stroke(); }
  else { g.beginPath(); g.moveTo(-s * 0.5, s * 0.5); g.lineTo(s * 0.45, -s * 0.45); g.stroke(); g.beginPath(); g.arc(s * 0.45, -s * 0.45, s * 0.12, 0, TAU); g.fill(); }
  g.restore();
}
function buildCards(group) {
  const velvet = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 0.78), new THREE.MeshLambertMaterial({ color: 0x2a0f0c }));
  velvet.position.y = TOP + 0.02; group.add(velvet);
  const y0 = TOP + 0.042;
  const card = (map, w, h, x, z, rot, back) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.002, h), [back, back, new THREE.MeshStandardMaterial({ map, roughness: 0.6 }), back, back, back]);
    m.position.set(x, y0 + Math.random() * 0.002, z); m.rotation.y = rot; group.add(m); return m;
  };
  const backMat = new THREE.MeshStandardMaterial({ color: 0x5a2a1a, roughness: 0.7 });
  // Mamluk-style: tall, gold and blue, ornament instead of figures.
  ['coin', 'cup', 'sword', 'stick'].forEach((suit, k) => {
    const map = cardTex((g, w, h) => {
      g.fillStyle = '#1d3a6e'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d9b04a'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
      g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
      for (let i = 0; i < 3; i++) suitMark(g, suit, w / 2, 80 + i * 80, 52, '#e2bd5a');
      g.strokeStyle = 'rgba(226,189,90,.5)'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(w / 2, h / 2, 30 + i * 18, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
    }, 180, 420);
    card(map, 0.085, 0.2, -0.47 + k * 0.1, -0.12, -0.15 + k * 0.1, backMat);
  });
  // A Chinese-style narrow money card.
  [3, 7].forEach((n, k) => {
    const map = cardTex((g, w, h) => {
      g.fillStyle = '#efe3c5'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
      for (let i = 0; i < n; i++) { const y = 40 + i * ((h - 80) / Math.max(1, n - 1)); g.strokeStyle = '#7a2a1c'; g.lineWidth = 5; g.beginPath(); g.arc(w / 2, y, 16, 0, TAU); g.stroke(); g.strokeRect(w / 2 - 5, y - 5, 10, 10); }
    }, 120, 420);
    card(map, 0.05, 0.17, 0.0 + k * 0.065, -0.14, 0.05 - k * 0.12, backMat);
  });
  // Early European Latin-suited pip cards.
  [['coin', 3], ['cup', 4], ['sword', 2], ['stick', 5], ['coin', 6]].forEach(([suit, n], k) => {
    const map = cardTex((g, w, h) => {
      g.fillStyle = '#f2e8cf'; g.fillRect(0, 0, w, h); speckle(g, w, h, 300, ['#c9b68e'], 1.2);
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16);
      const col = { coin: '#c48a1e', cup: '#a3301e', sword: '#2a4a7a', stick: '#3a6a2a' }[suit];
      for (let i = 0; i < n; i++) { const cols = n > 3 ? 2 : 1, cx = cols === 2 ? w / 2 + (i % 2 ? 40 : -40) : w / 2, rows = Math.ceil(n / cols), ry = Math.floor(i / cols); suitMark(g, suit, cx, (h / (rows + 1)) * (ry + 1), 54, col); }
    }, 200, 320);
    card(map, 0.11, 0.17, 0.2 + k * 0.075, 0.12, -0.25 + k * 0.12, backMat);
  });
  glassCase(group, 1.3, 0.3, 0.85);
}
function buildTarot(group) {
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.6), new THREE.MeshLambertMaterial({ color: 0x1d2a1a }));
  stand.position.y = TOP + 0.02; group.add(stand);
  const before = group.children.length;
  const easel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 0.02), MAT.woodDark); easel.position.set(0, TOP + 0.13, -0.1); easel.rotation.x = -0.25; group.add(easel);
  const designs = [
    (g, w, h) => { g.fillStyle = '#c0392b'; g.beginPath(); g.arc(w / 2, h * 0.38, 46, 0, TAU); g.fill(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.strokeStyle = '#c0392b'; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 56, h * 0.38 + Math.sin(a) * 56); g.lineTo(w / 2 + Math.cos(a) * 80, h * 0.38 + Math.sin(a) * 80); g.stroke(); } },
    (g, w, h) => { g.fillStyle = '#e8e2d0'; g.beginPath(); g.arc(w / 2, h * 0.38, 52, 0, TAU); g.fill(); g.fillStyle = '#d9b04a'; g.beginPath(); g.arc(w / 2 + 22, h * 0.36, 50, 0, TAU); g.fill(); },
    (g, w, h) => { g.fillStyle = '#2a5aa0'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU - Math.PI / 2, r = i % 2 ? 22 : 58; g.lineTo(w / 2 + Math.cos(a) * r, h * 0.38 + Math.sin(a) * r); } g.closePath(); g.fill(); },
    (g, w, h) => { g.strokeStyle = '#6a3a1a'; g.lineWidth = 9; g.beginPath(); g.arc(w / 2, h * 0.4, 62, 0, TAU); g.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(w / 2, h * 0.4); g.lineTo(w / 2 + Math.cos(a) * 62, h * 0.4 + Math.sin(a) * 62); g.stroke(); } },
    (g, w, h) => { g.fillStyle = '#7a6a5a'; g.fillRect(w / 2 - 34, h * 0.22, 68, 150); for (let i = 0; i < 4; i++) g.fillRect(w / 2 - 34 + i * 20, h * 0.18, 12, 20); g.fillStyle = '#e8a33a'; g.beginPath(); g.moveTo(w / 2 + 20, h * 0.1); g.lineTo(w / 2 + 6, h * 0.2); g.lineTo(w / 2 + 18, h * 0.2); g.lineTo(w / 2 + 2, h * 0.3); g.lineTo(w / 2 + 34, h * 0.16); g.lineTo(w / 2 + 22, h * 0.16); g.closePath(); g.fill(); },
    (g, w, h) => { g.fillStyle = '#3a6a2a'; g.beginPath(); g.arc(w / 2, h * 0.26, 18, 0, TAU); g.fill(); g.fillRect(w / 2 - 16, h * 0.31, 32, 90); g.strokeStyle = '#3a6a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2 + 16, h * 0.36); g.lineTo(w / 2 + 52, h * 0.24); g.stroke(); g.fillStyle = '#c48a1e'; g.beginPath(); g.arc(w / 2 + 56, h * 0.22, 12, 0, TAU); g.fill(); },
  ];
  designs.forEach((draw, k) => {
    const map = cardTex((g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e9c766'); gr.addColorStop(0.5, '#c79a34'); gr.addColorStop(1, '#e2bb5a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(120,80,20,.35)';
      for (let x = 14; x < w; x += 14) for (let y = 14; y < h; y += 14) { g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); }
      g.strokeStyle = '#6a4a14'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
      draw(g, w, h);
      g.fillStyle = 'rgba(90,60,20,.5)'; g.fillRect(24, h * 0.78, w - 48, 6);
    }, 200, 400);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.003), [MAT.woodDark, MAT.woodDark, MAT.woodDark, MAT.woodDark, new THREE.MeshStandardMaterial({ map, roughness: 0.35, metalness: 0.35 }), MAT.woodDark]);
    m.position.set(-0.45 + k * 0.18, TOP + 0.16, -0.08); m.rotation.x = -0.25; m.rotation.z = rand(-0.03, 0.03); group.add(m);
  });
  glassCase(group, 1.25, 0.42, 0.7);
  // The easel and its case are put away while a game of tarocchi is played on the stand.
  group.userData.display = group.children.slice(before);
  const baize = topPlane(group, 1.16, 0.56, TOP + 0.0405, tex(256, 128, (g, w, h) => {
    g.fillStyle = '#1f3a24'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${rand(0.03, 0.1)})`; g.fillRect(rand(0, w), rand(0, h), 1, 1); }
  }), { roughness: 0.95 });
  baize.visible = false; group.userData.baize = baize;
  return TOP + 0.041;
}
/* --- Tarocchi cards for the table: original faces in an old Italian manner */
const TC_W = 0.07, TC_H = 0.11;
const tcGeo = new THREE.BoxGeometry(TC_W, 0.0016, TC_H);
const tcEdgeMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.7 });
const TC_SUITS = ['coin', 'cup', 'sword', 'stick'];
const TC_SUIT_COL = { coin: '#c48a1e', cup: '#a3301e', sword: '#2a4a7a', stick: '#3a6a2a' };
const TC_TRUMPS = ['Il Bagatto', 'La Papessa', 'L\'Imperatrice', 'L\'Imperatore', 'Il Papa', 'Gli Amanti', 'Il Carro', 'La Giustizia', 'L\'Eremita', 'La Ruota', 'La Forza', 'L\'Appeso', 'La Morte', 'La Temperanza', 'Il Diavolo', 'La Torre', 'La Stella', 'La Luna', 'Il Sole', 'Il Giudizio', 'Il Mondo'];
const ROMAN = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'][n];
const tcBackMat = new THREE.MeshStandardMaterial({ roughness: 0.6, map: cardTex((g, w, h) => {
  g.fillStyle = '#6a1e14'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d9b04a'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  g.lineWidth = 2; g.strokeStyle = 'rgba(217,176,74,.6)';
  for (let k = -h; k < w + h; k += 22) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); }
}, 140, 220) });
const tcFaceCache = new Map();
function tcFace(c) {
  if (tcFaceCache.has(c)) return tcFaceCache.get(c);
  const T = window.LibrariumRules.tarocchi, su = T.suit(c), rk = T.rank(c);
  const map = cardTex((g, w, h) => {
    if (su === 4 || c === T.FOOL) {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ecd08a'); gr.addColorStop(1, '#c99a3e');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#6a4a14'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#3a2410'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '600 40px "Amethysta",Georgia,serif'; g.fillText(c === T.FOOL ? '0' : ROMAN(rk), w / 2, 42);
      // A simple emblem: a sun, a star or a circle, not a copy of any painted trump.
      g.strokeStyle = '#7a2a1c'; g.fillStyle = 'rgba(122,42,28,.15)'; g.lineWidth = 4;
      g.beginPath(); g.arc(w / 2, h * 0.52, 34, 0, TAU); g.fill(); g.stroke();
      for (let i = 0; i < (rk % 8) + 4; i++) { const a = i / ((rk % 8) + 4) * TAU; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 40, h * 0.52 + Math.sin(a) * 40); g.lineTo(w / 2 + Math.cos(a) * 52, h * 0.52 + Math.sin(a) * 52); g.stroke(); }
      g.font = '17px "Amethysta",Georgia,serif'; g.fillStyle = '#3a2410';
      g.fillText(c === T.FOOL ? 'Il Matto' : TC_TRUMPS[rk - 1], w / 2, h - 30, w - 20);
      return;
    }
    const suit = TC_SUITS[su], col = TC_SUIT_COL[suit];
    g.fillStyle = '#f2e8cf'; g.fillRect(0, 0, w, h); speckle(g, w, h, 200, ['#c9b68e'], 1.2);
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'top';
    const label = rk > 10 ? ['F', 'C', 'D', 'R'][rk - 11] : String(rk); // fante, cavallo, donna, re
    g.font = '700 30px "Montserrat",sans-serif'; g.fillText(label, 16, 14);
    if (rk > 10) {
      g.textAlign = 'center'; g.font = '600 26px "Amethysta",Georgia,serif';
      g.fillText(['Fante', 'Cavallo', 'Regina', 'Re'][rk - 11], w / 2, h - 52);
      suitMark(g, suit, w / 2, h * 0.45, 70, col);
      g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2 - 40, h * 0.2); g.lineTo(w / 2 - 22, h * 0.13); g.lineTo(w / 2, h * 0.19); g.lineTo(w / 2 + 22, h * 0.13); g.lineTo(w / 2 + 40, h * 0.2); g.stroke();
    } else {
      const cols = rk > 3 ? 2 : 1, rows = Math.ceil(rk / cols);
      for (let i = 0; i < rk; i++) {
        const cx = cols === 2 ? w / 2 + (i % 2 ? 30 : -30) : w / 2, ry = cols === 2 ? (i / 2) | 0 : i;
        suitMark(g, suit, cx, 70 + (ry + 0.5) * ((h - 100) / rows), Math.min(44, (h - 120) / rows), col);
      }
    }
  }, 140, 220);
  tcFaceCache.set(c, map); return map;
}
function tcCard(c) {
  const face = new THREE.MeshStandardMaterial({ map: tcFace(c), roughness: 0.55 });
  const m = new THREE.Mesh(tcGeo, [tcEdgeMat, tcEdgeMat, face, tcBackMat, tcEdgeMat, tcEdgeMat]);
  m.userData.mats = [face]; // only this card's face glows, not the backs it shares with others
  return m;
}

/* --- Wing IV: Fox and Geese, a pegged cross board */
const FG_S = 0.118;
function fgCell(i) { const r = (i / 7) | 0, c = i % 7; return { x: (c - 3) * FG_S, z: (r - 3) * FG_S }; }
const fgOnBoard = (r, c) => r >= 0 && r < 7 && c >= 0 && c < 7 && ((r >= 2 && r <= 4) || (c >= 2 && c <= 4));
function buildFoxGeeseBoard(group) {
  const arm = 3 * FG_S + 0.07, len = 7 * FG_S + 0.05;
  const oak = new THREE.MeshStandardMaterial({ color: 0x6a4424, roughness: 0.6 });
  for (const [w, d] of [[len, arm], [arm, len]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), oak); b.position.y = TOP + 0.025; group.add(b);
  }
  const px = 1024, W = len, sc = px / W, c0 = px / 2;
  const map = tex(px, px, (g) => {
    g.fillStyle = '#0000'; g.clearRect(0, 0, px, px);
    // Only the cross is drawn; the corners stay transparent over the plinth.
    g.save(); g.beginPath();
    const a = arm / 2 * sc, l = len / 2 * sc;
    g.rect(c0 - l, c0 - a, 2 * l, 2 * a); g.rect(c0 - a, c0 - l, 2 * a, 2 * l); g.clip();
    woodGrain(g, px, px, '#7a5030', '#2a1508');
    g.strokeStyle = '#e8d6ac'; g.lineWidth = 6; g.lineCap = 'round';
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      if (!fgOnBoard(r, c)) continue;
      const x = c0 + (c - 3) * FG_S * sc, y = c0 + (r - 3) * FG_S * sc;
      if (fgOnBoard(r, c + 1)) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + FG_S * sc, y); g.stroke(); }
      if (fgOnBoard(r + 1, c)) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + FG_S * sc); g.stroke(); }
    }
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      if (!fgOnBoard(r, c)) continue;
      const x = c0 + (c - 3) * FG_S * sc, y = c0 + (r - 3) * FG_S * sc;
      g.fillStyle = '#e8d6ac'; g.beginPath(); g.arc(x, y, 15, 0, TAU); g.fill();
      g.fillStyle = '#2a1508'; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill();
    }
    g.restore();
  });
  topPlane(group, W, W, TOP + 0.0505, map, { roughness: 0.55, transparent: true });
  return TOP + 0.051;
}
function foxPiece() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0xb4521e, roughness: 0.55 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), fur); body.scale.set(1.25, 0.85, 0.9); body.position.y = 0.03; g.add(body);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 12), fur); head.rotation.z = -Math.PI / 2; head.position.set(0.045, 0.045, 0); g.add(head);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.022, 8), fur); ear.position.set(0.03, 0.068, s * 0.01); g.add(ear); }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), fur); tail.scale.set(1.8, 0.8, 0.8); tail.position.set(-0.045, 0.035, 0); g.add(tail);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), white); tip.position.set(-0.07, 0.038, 0); g.add(tip);
  g.userData.mats = [fur];
  return g;
}
function goosePiece() {
  const g = new THREE.Group();
  const feather = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.45 });
  const beak = new THREE.MeshStandardMaterial({ color: 0xe08a1e, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), feather); body.scale.set(1.3, 0.85, 0.9); body.position.y = 0.026; g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.038, 8), feather); neck.position.set(0.024, 0.05, 0); neck.rotation.z = -0.35; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), feather); head.position.set(0.032, 0.07, 0); g.add(head);
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.016, 8), beak); bill.rotation.z = -Math.PI / 2; bill.position.set(0.046, 0.069, 0); g.add(bill);
  g.userData.mats = [feather];
  return g;
}

/* --- Wing IV: Draughts */
const DR_S = 0.094;
function drCell(i) { const r = i >> 3, c = i & 7; return { x: (c - 3.5) * DR_S, z: (3.5 - r) * DR_S }; }
function buildDraughtsBoard(group) {
  const W = 8 * DR_S + 0.08;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, W), new THREE.MeshStandardMaterial({ color: 0x2a170b, roughness: 0.5 }));
  frame.position.y = TOP + 0.02; group.add(frame);
  const px = 1024, sc = px / W, c0 = px / 2 - 4 * DR_S * sc;
  const map = tex(px, px, (g) => {
    g.fillStyle = '#2a170b'; g.fillRect(0, 0, px, px);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const dark = (r + c) % 2 === 1; // dark squares match the rules' (r + c) odd, seen from the visitor's side
      const x = c0 + c * DR_S * sc, y = c0 + (7 - r) * DR_S * sc;
      g.fillStyle = dark ? '#3d5a3a' : '#e6d4ac'; g.fillRect(x, y, DR_S * sc, DR_S * sc);
    }
    g.strokeStyle = '#c9a24e'; g.lineWidth = 5; g.strokeRect(c0 - 4, c0 - 4, 8 * DR_S * sc + 8, 8 * DR_S * sc + 8);
  });
  topPlane(group, W, W, TOP + 0.0405, map, { roughness: 0.5 });
  return TOP + 0.041;
}
const drManGeo = new THREE.LatheGeometry([[0, 0], [0.038, 0], [0.04, 0.004], [0.04, 0.012], [0.035, 0.016], [0.02, 0.016], [0.018, 0.014], [0, 0.014]].map(([a, b]) => new THREE.Vector2(a, b)), 30);

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

/* --- Wing IV: Pachisi (display) */
function buildPachisi(group) {
  const sq = 0.046, armLen = 8 * sq, armW = 3 * sq, ctr = 3 * sq;
  const total = ctr + 2 * armLen;
  const px = 1024, sc = px / total, c0 = px / 2;
  const map = tex(px, px, (g) => {
    g.clearRect(0, 0, px, px);
    const a = armW / 2 * sc, l = total / 2 * sc;
    g.save(); g.beginPath(); g.rect(c0 - l, c0 - a, 2 * l, 2 * a); g.rect(c0 - a, c0 - l, 2 * a, 2 * l); g.clip();
    g.fillStyle = '#8a1e1e'; g.fillRect(0, 0, px, px);
    speckle(g, px, px, 6000, ['#5a0e0e', '#b23a2a'], 1.4);
    const s = sq * sc, colours = ['#e8b23a', '#2a6a4a', '#1e3a7a', '#e8e0c8'];
    for (let arm = 0; arm < 4; arm++) {
      g.save(); g.translate(c0, c0); g.rotate(arm * Math.PI / 2);
      for (let k = 0; k < 8; k++) for (let j = -1; j <= 1; j++) {
        const x = j * s - s / 2, y = ctr / 2 * sc + k * s;
        g.strokeStyle = '#f0d58a'; g.lineWidth = 2.5; g.strokeRect(x + 2, y + 2, s - 4, s - 4);
        if ((k === 4 && j !== 0) || (k === 7 && j === 0)) { g.strokeStyle = '#f0d58a'; g.beginPath(); g.moveTo(x + 8, y + 8); g.lineTo(x + s - 8, y + s - 8); g.moveTo(x + s - 8, y + 8); g.lineTo(x + 8, y + s - 8); g.stroke(); }
      }
      g.fillStyle = colours[arm]; g.globalAlpha = 0.55; g.fillRect(-s * 1.5, ctr / 2 * sc + 8 * s - 10, s * 3, 10); g.globalAlpha = 1;
      g.restore();
    }
    g.fillStyle = '#5a0e0e'; g.fillRect(c0 - ctr / 2 * sc, c0 - ctr / 2 * sc, ctr * sc, ctr * sc);
    g.strokeStyle = '#f0d58a'; g.lineWidth = 4; g.strokeRect(c0 - ctr / 2 * sc + 6, c0 - ctr / 2 * sc + 6, ctr * sc - 12, ctr * sc - 12);
    g.restore();
  });
  topPlane(group, total, total, TOP + 0.004, map, { roughness: 0.95, transparent: true });
  // Cowrie shells, a few mouth up, and beehive-shaped pawns in four colours.
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.35 });
  const slit = new THREE.MeshStandardMaterial({ color: 0x5a4a3a });
  const R = seeded(25), display = [];
  for (let k = 0; k < 7; k++) {
    const sh = new THREE.Group(); display.push(sh);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), shellMat); b.scale.set(1.4, 0.7, 1); sh.add(b);
    if (k % 2) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.002, 0.002), slit); l.position.y = 0.0085; sh.add(l); }
    sh.position.set(0.1 + R() * 0.12, TOP + 0.012, 0.1 + R() * 0.12); sh.rotation.y = R() * TAU; group.add(sh);
  }
  const pawn = new THREE.LatheGeometry([[0, 0], [0.016, 0], [0.017, 0.004], [0.015, 0.016], [0.01, 0.028], [0.004, 0.034], [0, 0.035]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
  [0xe8b23a, 0x2a6a4a, 0x1e3a7a, 0xe8e0c8].forEach((col, arm) => {
    const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 });
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(pawn, m);
      const along = ctr / 2 + (k === 3 ? 5.5 : 0.5 + k) * sq, across = (k % 2 ? 1 : -1) * sq;
      const ang = arm * Math.PI / 2, x = Math.sin(ang) * along + Math.cos(ang) * across, z = Math.cos(ang) * along - Math.sin(ang) * across;
      p.position.set(x, TOP + 0.005, z); group.add(p); display.push(p);
    }
  });
  group.userData.display = display;
  return TOP + 0.005;
}

/* --- Wing IV: Mahjong (display) */
function mjFace(kind, n) {
  return tex(128, 172, (g, w, h) => {
    g.fillStyle = '#f6f1e4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8cfb8'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    const cols = ['#1e5a8a', '#2a7a3a', '#b23a2a'];
    if (kind === 'dots') {
      const grid = { 1: [[0.5, 0.5]], 2: [[0.5, 0.3], [0.5, 0.7]], 3: [[0.3, 0.25], [0.5, 0.5], [0.7, 0.75]], 4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]], 5: [[0.3, 0.27], [0.7, 0.27], [0.5, 0.5], [0.3, 0.73], [0.7, 0.73]], 6: [[0.3, 0.22], [0.7, 0.22], [0.3, 0.5], [0.7, 0.5], [0.3, 0.78], [0.7, 0.78]] }[n];
      grid.forEach(([x, y], k) => { const r = n === 1 ? 38 : 16; g.fillStyle = cols[k % 3]; g.beginPath(); g.arc(x * w, y * h, r, 0, TAU); g.fill(); g.fillStyle = '#f6f1e4'; g.beginPath(); g.arc(x * w, y * h, r * 0.45, 0, TAU); g.fill(); });
    } else if (kind === 'bamboo') {
      for (let k = 0; k < n; k++) {
        const col = k % 3, row = (k / 3) | 0, x = w * (0.28 + 0.22 * col), y = h * (0.2 + 0.3 * row);
        g.fillStyle = k === 0 && n === 1 ? '#b23a2a' : '#2a7a3a'; g.fillRect(x - 7, y, 14, h * 0.24);
        g.fillStyle = '#f6f1e4'; g.fillRect(x - 7, y + h * 0.11, 14, 3);
      }
    } else if (kind === 'white') {
      g.strokeStyle = '#1e5a8a'; g.lineWidth = 7; g.strokeRect(w * 0.2, h * 0.18, w * 0.6, h * 0.64);
    } else if (kind === 'flower') {
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.fillStyle = '#b23a2a'; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * 20, h / 2 + Math.sin(a) * 20, 16, 10, a, 0, TAU); g.fill(); }
      g.fillStyle = '#e8b23a'; g.beginPath(); g.arc(w / 2, h / 2, 12, 0, TAU); g.fill();
      g.strokeStyle = '#2a7a3a'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, h / 2 + 18); g.lineTo(w / 2 - 10, h * 0.9); g.stroke();
    }
  });
}
function buildMahjong(group) {
  const felt = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.8), new THREE.MeshLambertMaterial({ color: 0x1e4a32 }));
  felt.position.y = TOP + 0.01; group.add(felt);
  const before = group.children.length;
  const tw = 0.034, th = 0.046, td = 0.024;
  const bone = new THREE.MeshStandardMaterial({ color: 0xf2ecdc, roughness: 0.3 });
  const back = new THREE.MeshStandardMaterial({ color: 0x2a7a5a, roughness: 0.35 });
  const geo = new THREE.BoxGeometry(tw, td, th);
  // The wall: two layers of face-down tiles along the back.
  for (let layer = 0; layer < 2; layer++) for (let k = 0; k < 17; k++) {
    const t = new THREE.Mesh(geo, [bone, bone, back, bone, bone, bone]);
    t.position.set((k - 8) * (tw + 0.002), TOP + 0.02 + td / 2 + layer * td, -0.26); group.add(t);
  }
  // A hand of fourteen face-up tiles at the front, standing on edge.
  const hand = [['dots', 1], ['dots', 2], ['dots', 3], ['bamboo', 4], ['bamboo', 5], ['bamboo', 6], ['dots', 5], ['dots', 5], ['dots', 5], ['white', 0], ['white', 0], ['white', 0], ['bamboo', 1], ['bamboo', 1]];
  hand.forEach(([kind, n], k) => {
    const face = new THREE.MeshStandardMaterial({ map: mjFace(kind, n), roughness: 0.3 });
    const t = new THREE.Mesh(new THREE.BoxGeometry(tw, th, td), [bone, bone, bone, bone, face, back]);
    t.position.set((k - 6.5) * (tw + 0.003), TOP + 0.02 + th / 2, 0.2); t.rotation.x = -0.12; group.add(t);
  });
  const flower = new THREE.Mesh(new THREE.BoxGeometry(tw, td, th), [bone, bone, new THREE.MeshStandardMaterial({ map: mjFace('flower', 0), roughness: 0.3 }), bone, bone, bone]);
  flower.position.set(0.42, TOP + 0.02 + td / 2, 0.05); flower.rotation.y = 0.3; group.add(flower);
  for (let k = 0; k < 2; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.018), new THREE.MeshStandardMaterial({ color: 0xf6f1e4, roughness: 0.3 })); d.position.set(-0.4 + k * 0.035, TOP + 0.029, 0.04); d.rotation.y = k * 0.6; group.add(d); }
  glassCase(group, 1.25, 0.3, 0.85);
  group.userData.display = group.children.slice(before); // put away while a hand is played
  return TOP + 0.02;
}
/* Mahjong tiles for the table: every face, with a small corner index for readers of either script. */
const MJ_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const mjTileCache = {};
function mjTile(t) {
  if (mjTileCache[t]) return mjTileCache[t];
  const map = tex(128, 172, (g, w, h) => {
    g.fillStyle = '#f6f1e4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8cfb8'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    const suit = (t / 9) | 0, n = (t % 9) + 1, cols = ['#1e5a8a', '#2a7a3a', '#b23a2a'];
    let idx = '';
    if (t < 9) {
      const grid = { 1: [[0.5, 0.5]], 2: [[0.5, 0.3], [0.5, 0.7]], 3: [[0.3, 0.25], [0.5, 0.5], [0.7, 0.75]], 4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]], 5: [[0.3, 0.27], [0.7, 0.27], [0.5, 0.5], [0.3, 0.73], [0.7, 0.73]], 6: [[0.3, 0.22], [0.7, 0.22], [0.3, 0.5], [0.7, 0.5], [0.3, 0.78], [0.7, 0.78]], 7: [[0.25, 0.18], [0.5, 0.25], [0.75, 0.32], [0.3, 0.6], [0.7, 0.6], [0.3, 0.82], [0.7, 0.82]], 8: [[0.3, 0.16], [0.7, 0.16], [0.3, 0.39], [0.7, 0.39], [0.3, 0.62], [0.7, 0.62], [0.3, 0.85], [0.7, 0.85]], 9: [[0.22, 0.2], [0.5, 0.2], [0.78, 0.2], [0.22, 0.5], [0.5, 0.5], [0.78, 0.5], [0.22, 0.8], [0.5, 0.8], [0.78, 0.8]] }[n];
      const r = n === 1 ? 38 : n <= 6 ? 16 : 12;
      grid.forEach(([x, y], k) => { g.fillStyle = cols[k % 3]; g.beginPath(); g.arc(x * w, y * h, r, 0, TAU); g.fill(); g.fillStyle = '#f6f1e4'; g.beginPath(); g.arc(x * w, y * h, r * 0.45, 0, TAU); g.fill(); });
      idx = String(n);
    } else if (t < 18) {
      if (n === 1) { g.fillStyle = '#2a7a3a'; g.beginPath(); g.ellipse(w / 2, h / 2, 26, 40, 0, 0, TAU); g.fill(); g.fillStyle = '#b23a2a'; g.beginPath(); g.arc(w / 2, h / 2 - 30, 12, 0, TAU); g.fill(); }
      else for (let k = 0; k < n; k++) {
        const per = n <= 3 ? n : n <= 6 ? 3 : 3, rows = Math.ceil(n / per), col = k % per, row = (k / per) | 0;
        const x = w * (0.5 + (col - (Math.min(per, n - row * per) - 1) / 2) * 0.24), y = h * (0.12 + row * (0.76 / rows));
        g.fillStyle = k === 0 && n % 2 ? '#b23a2a' : '#2a7a3a'; g.fillRect(x - 6, y, 12, h * 0.76 / rows - 8);
        g.fillStyle = '#f6f1e4'; g.fillRect(x - 6, y + (h * 0.76 / rows - 8) / 2 - 1, 12, 3);
      }
      idx = String(n);
    } else if (t < 27) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#1a1a1a'; g.font = `600 52px ${W6_CJK}`; g.fillText(MJ_NUM[n - 1], w / 2, h * 0.32);
      g.fillStyle = '#b23a2a'; g.font = `600 56px ${W6_CJK}`; g.fillText('萬', w / 2, h * 0.7);
      idx = String(n);
    } else if (t < 31) {
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1a1a1a'; g.font = `600 78px ${W6_CJK}`;
      g.fillText('東南西北'[t - 27], w / 2, h / 2 + 4); idx = 'ESWN'[t - 27];
    } else if (t === 31) { g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#b23a2a'; g.font = `700 80px ${W6_CJK}`; g.fillText('中', w / 2, h / 2 + 4); idx = 'R'; }
    else if (t === 32) { g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2a7a3a'; g.font = `700 76px ${W6_CJK}`; g.fillText('發', w / 2, h / 2 + 4); idx = 'G'; }
    else { g.strokeStyle = '#1e5a8a'; g.lineWidth = 7; g.strokeRect(w * 0.2, h * 0.18, w * 0.6, h * 0.64); idx = 'W'; }
    g.fillStyle = 'rgba(40,30,20,.75)'; g.font = '700 20px "Montserrat",sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(idx, 9, 8);
  });
  mjTileCache[t] = map; return map;
}

/* --- Wing V: shared pieces */
// A teetotum: the numbered spinning top that moral games used instead of gambling dice.
function teetotum(color = 0xd8c49a) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 8), [wood, wood, new THREE.MeshStandardMaterial({ map: tex(128, 128, (c, w) => {
    c.fillStyle = '#e8d6ac'; c.fillRect(0, 0, w, w);
    c.fillStyle = '#3a2412'; c.font = '20px Georgia, serif'; c.textAlign = 'center';
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * TAU; c.fillText(String(k + 1), w / 2 + Math.cos(a) * 44, w / 2 + Math.sin(a) * 44 + 7); }
    c.strokeStyle = '#3a2412'; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; c.beginPath(); c.moveTo(w / 2, w / 2); c.lineTo(w / 2 + Math.cos(a) * 62, w / 2 + Math.sin(a) * 62); c.stroke(); }
  }) })]);
  top.rotation.y = Math.PI / 8; top.position.y = 0.03; g.add(top);
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 8), wood); spindle.position.y = 0.05; g.add(spindle);
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.024, 8), wood); point.rotation.x = Math.PI; point.position.y = 0.012; g.add(point);
  g.rotation.z = 0.35; // resting on its side, as it fell
  return g;
}
function paperSheet(group, w, d, map, y = TOP + 0.003) {
  const m = topPlane(group, w, d, y, map, { roughness: 0.9 });
  return m;
}
function agedPaper(g, w, h) {
  g.fillStyle = '#ecdcb4'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 3000, ['#c9b07c', '#f8ecd0', '#b89a68'], 1.6);
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(110,70,20,.35)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}

/* --- Wing V: The Mansion of Happiness (display) */
function buildMansion(group) {
  const W = 0.78;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.02, W + 0.04), new THREE.MeshStandardMaterial({ color: 0x3a2312, roughness: 0.6 }));
  board.position.y = TOP + 0.01; group.add(board);
  const px = 1024;
  topPlane(group, W, W, TOP + 0.0205, tex(px, px, (g) => {
    agedPaper(g, px, px);
    const cx = px / 2, cy = px / 2, R = px * 0.46, turns = 3.2, n = 60;
    // Hand-coloured squares along a spiral, virtues in green and gold, vices in red.
    for (let k = 0; k < n; k++) {
      const t = k / n, a = t * turns * TAU, r = R * (1 - t * 0.78);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2);
      const s = 44 * (1 - t * 0.45);
      g.fillStyle = k % 7 === 3 ? '#b8432e' : k % 5 === 1 ? '#6a8a3a' : k % 4 === 0 ? '#d4a23a' : '#e9d9b0';
      g.fillRect(-s / 2, -s / 2, s, s); g.strokeStyle = '#4a2c14'; g.lineWidth = 2; g.strokeRect(-s / 2, -s / 2, s, s);
      g.restore();
    }
    // The mansion at the centre.
    g.fillStyle = '#d9c08a'; g.fillRect(cx - 52, cy - 20, 104, 64);
    g.fillStyle = '#8a3a22'; g.beginPath(); g.moveTo(cx - 64, cy - 20); g.lineTo(cx, cy - 66); g.lineTo(cx + 64, cy - 20); g.fill();
    g.fillStyle = '#4a2c14'; g.fillRect(cx - 10, cy + 10, 20, 34);
    for (const dx of [-34, 24]) g.fillRect(cx + dx, cy - 6, 12, 14);
    g.fillStyle = '#3a2412'; g.font = 'italic 34px Georgia, serif'; g.textAlign = 'center';
    g.fillText('An Instructive, Moral and Entertaining Amusement', cx, px - 36, px - 80);
  }), { roughness: 0.85 });
  const tt = teetotum(); tt.position.set(W / 2 + 0.12, TOP, 0.1); group.add(tt);
  const pawn = c => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })); m.position.y = 0.02; const g = new THREE.Group(); g.add(m); return g; };
  [0x8a1e1e, 0x1e3a7a].forEach((c, k) => { const p = pawn(c); p.position.set(W / 2 + 0.1 + k * 0.05, TOP, -0.12); group.add(p); });
}

/* --- Wing V: The Checkered Game of Life (display) */
function buildCheckeredLife(group) {
  const W = 0.78;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.02, W + 0.04), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.6 }));
  board.position.y = TOP + 0.01; group.add(board);
  const px = 1024, cs = px / 8;
  topPlane(group, W, W, TOP + 0.0205, tex(px, px, (g) => {
    agedPaper(g, px, px);
    const R = seeded(1860);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const x = c * cs, y = r * cs;
      if ((r + c) % 2) { g.fillStyle = '#7a2a1c'; g.fillRect(x, y, cs, cs); continue; }
      g.fillStyle = '#efe0b8'; g.fillRect(x, y, cs, cs);
      // Small coloured vignettes stand for the virtues and vices on the squares.
      if (R() < 0.6) {
        g.fillStyle = ['#6a8a3a', '#d4a23a', '#2a4a7a', '#8a3a22'][(R() * 4) | 0];
        g.beginPath(); g.arc(x + cs / 2, y + cs / 2 - 8, cs * 0.18, 0, TAU); g.fill();
        g.fillStyle = '#3a2412'; g.fillRect(x + cs * 0.25, y + cs * 0.72, cs * 0.5, 4); g.fillRect(x + cs * 0.32, y + cs * 0.8, cs * 0.36, 3);
      }
    }
    g.strokeStyle = '#3a2412'; g.lineWidth = 6; g.strokeRect(3, 3, px - 6, px - 6);
  }), { roughness: 0.85 });
  const tt = teetotum(0xcdb98a); tt.position.set(W / 2 + 0.12, TOP, -0.05); group.add(tt);
}

/* --- Wing V: Reversi */
const RV_S = 0.09;
function rvCell(i) { const r = i >> 3, c = i & 7; return { x: (c - 3.5) * RV_S, z: (3.5 - r) * RV_S }; }
function buildReversiBoard(group) {
  const W = 8 * RV_S + 0.07;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, W), new THREE.MeshStandardMaterial({ color: 0x1e140c, roughness: 0.5 }));
  frame.position.y = TOP + 0.02; group.add(frame);
  const px = 1024, sc = px / W, c0 = px / 2 - 4 * RV_S * sc;
  topPlane(group, W, W, TOP + 0.0405, tex(px, px, (g) => {
    g.fillStyle = '#1e140c'; g.fillRect(0, 0, px, px);
    g.fillStyle = '#2f6a3e'; g.fillRect(c0, c0, 8 * RV_S * sc, 8 * RV_S * sc);
    speckle(g, px, px, 3000, ['#24563a', '#3a7a4a'], 1.2);
    g.strokeStyle = '#173a22'; g.lineWidth = 4;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(c0, c0 + i * RV_S * sc); g.lineTo(c0 + 8 * RV_S * sc, c0 + i * RV_S * sc); g.stroke();
      g.beginPath(); g.moveTo(c0 + i * RV_S * sc, c0); g.lineTo(c0 + i * RV_S * sc, c0 + 8 * RV_S * sc); g.stroke();
    }
    g.fillStyle = '#173a22'; for (const a of [2, 6]) for (const b of [2, 6]) { g.beginPath(); g.arc(c0 + a * RV_S * sc, c0 + b * RV_S * sc, 7, 0, TAU); g.fill(); }
  }), { roughness: 0.8 });
  return TOP + 0.041;
}
// A two-coloured disc: dark on top for the visitor, flipped over for the Scribe.
const rvDiscGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.012, 32);
const RV_MATS = [new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: 0xeee6d6, roughness: 0.35 })];
function rvDisc() { const m = new THREE.Mesh(rvDiscGeo, [new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 0.5 }), RV_MATS[0], RV_MATS[1]]); return m; }

/* --- Wing V: Halma (display) */
const HM_S = 0.05;
// Row 0 is nearest the visitor; the visitor's camp is the near-left corner.
function hmCell(i) { const r = i >> 4, c = i & 15; return { x: (c - 7.5) * HM_S, z: (7.5 - r) * HM_S }; }
const hmManGeo = new THREE.LatheGeometry([[0, 0], [0.015, 0], [0.016, 0.004], [0.008, 0.012], [0.006, 0.026], [0.011, 0.032], [0.007, 0.04], [0, 0.042]].map(([a, b]) => new THREE.Vector2(a, b)), 16);
const hmHitGeo = new THREE.CylinderGeometry(0.023, 0.023, 0.046, 10);
function halmaMan(pl) {
  const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x1e3a6a : 0x8a1e1e, roughness: 0.4 });
  const m = new THREE.Mesh(hmManGeo, mat); m.userData.mats = [mat];
  const hit = new THREE.Mesh(hmHitGeo, MAT.hit); hit.position.y = 0.023; m.add(hit); // small men are easy to miss
  return m;
}
function buildHalma(group) {
  const S = HM_S, W = 16 * S + 0.05;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, W), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.55 }));
  frame.position.y = TOP + 0.015; group.add(frame);
  const px = 1024, sc = px / W, c0 = px / 2 - 8 * S * sc, cs = S * sc;
  const G = window.LibrariumRules.halma;
  const camp = i => (G.CAMP[0].includes(i) ? 1 : G.CAMP[1].includes(i) ? 2 : 0);
  topPlane(group, W, W, TOP + 0.0305, tex(px, px, (g) => {
    g.fillStyle = '#2a1a10'; g.fillRect(0, 0, px, px);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) {
      const k = camp(r * 16 + c), odd = (r + c) % 2;
      g.fillStyle = k === 1 ? (odd ? '#b07a5a' : '#cf9c7a') : k === 2 ? (odd ? '#7f8ea4' : '#a3b0c2') : (odd ? '#c9b38a' : '#e9dcbc');
      g.fillRect(c0 + c * cs, c0 + (15 - r) * cs, cs, cs);
    }
    g.strokeStyle = '#2a1a10'; g.lineWidth = 3;
    for (const k of [1, 2]) for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) {
      if (camp(r * 16 + c) !== k) continue;
      const x = c0 + c * cs, y = c0 + (15 - r) * cs, nb = (rr, cc) => rr >= 0 && rr < 16 && cc >= 0 && cc < 16 && camp(rr * 16 + cc) === k;
      g.beginPath();
      if (!nb(r + 1, c)) { g.moveTo(x, y); g.lineTo(x + cs, y); }
      if (!nb(r - 1, c)) { g.moveTo(x, y + cs); g.lineTo(x + cs, y + cs); }
      if (!nb(r, c - 1)) { g.moveTo(x, y); g.lineTo(x, y + cs); }
      if (!nb(r, c + 1)) { g.moveTo(x + cs, y); g.lineTo(x + cs, y + cs); }
      g.stroke();
    }
    g.strokeStyle = '#7a2a1c'; g.lineWidth = 4;
    g.strokeRect(c0, c0, 16 * cs, 16 * cs);
  }), { roughness: 0.6 });
  // On display: a game a few moves in. The table replaces these men when play starts.
  const R = seeded(1883), display = [], placed = new Set();
  for (const pl of [0, 1]) for (const i of G.CAMP[pl]) {
    let r = i >> 4, c = i & 15;
    if (R() < 0.18) { const d = pl ? -1 : 1; r += d * (2 + ((R() * 3) | 0)); c += d * (2 + ((R() * 3) | 0)); }
    const key = r * 16 + c; if (placed.has(key) || r < 0 || r > 15 || c < 0 || c > 15) continue; placed.add(key);
    const m = halmaMan(pl), p = hmCell(key); m.position.set(p.x, TOP + 0.031, p.z); group.add(m); display.push(m);
  }
  group.userData.display = display;
  return TOP + 0.031;
}

/* --- Wing V: Dots and Boxes, on a writing slope */
// The dots span the same 0.62 m whatever the grid size; DB_S is the gap for the current size.
const DB_SPAN = 0.62;
let DB_S = DB_SPAN / 4;
function dbN() { return window.LibrariumRules.dotsboxes.N; }
function dbDot(r, c) { const h = dbN() / 2; return V3((c - h) * DB_S, 0, (r - h) * DB_S); }
function dbPaper(n) {
  const W = 0.86, px = 1024, sc = px / W, s = DB_SPAN / n;
  return tex(px, px, (g) => {
    g.fillStyle = '#f2ead6'; g.fillRect(0, 0, px, px);
    speckle(g, px, px, 1500, ['#d8ccb0'], 1.2);
    g.strokeStyle = 'rgba(70,110,170,.25)'; g.lineWidth = 2;
    for (let y = 40; y < px; y += 34) { g.beginPath(); g.moveTo(0, y); g.lineTo(px, y); g.stroke(); }
    g.strokeStyle = 'rgba(190,60,60,.35)'; g.beginPath(); g.moveTo(90, 0); g.lineTo(90, px); g.stroke();
    g.fillStyle = '#1d1a16';
    for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) { g.beginPath(); g.arc(px / 2 + (c - n / 2) * s * sc, px / 2 + (r - n / 2) * s * sc, 9, 0, TAU); g.fill(); }
  });
}
function dbEdgeMid(e) {
  const N = dbN();
  if (e < N * (N + 1)) { const r = (e / N) | 0, c = e % N; const a = dbDot(r, c), b = dbDot(r, c + 1); return { pos: a.add(b).multiplyScalar(0.5), horiz: true }; }
  const k = e - N * (N + 1), r = (k / (N + 1)) | 0, c = k % (N + 1); const a = dbDot(r, c), b = dbDot(r + 1, c); return { pos: a.add(b).multiplyScalar(0.5), horiz: false };
}
function buildDotsBoard(group) {
  const W = 0.86;
  const desk = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.03, W + 0.06), new THREE.MeshStandardMaterial({ color: 0x3a2312, roughness: 0.55 }));
  desk.position.y = TOP + 0.015; group.add(desk);
  const paper = topPlane(group, W, W, TOP + 0.0305, dbPaper(4), { roughness: 0.9 });
  group.userData.dots = { paper, maps: { 4: paper.material.map } };
  // An inkwell and a pencil beside the sheet.
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.045, 18), new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.2 }));
  glass.position.set(W / 2 + 0.1, TOP + 0.0225, -0.22); group.add(glass);
  const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.18, 6), new THREE.MeshStandardMaterial({ color: 0xd4a23a, roughness: 0.5 }));
  pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.4; pencil.position.set(W / 2 + 0.1, TOP + 0.005, 0.15); group.add(pencil);
  return TOP + 0.031;
}
const dbLineMats = [new THREE.MeshStandardMaterial({ color: 0x8a5a12, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.6 })];

/* --- Wing V: The Landlord's Game, as its patent drawing (display) */
// The Landlord's Game board, laid out as in the drawing of U.S. Patent 748,626 (1904).
const LL_B = 0.86, LL_C = 0.13, LL_W = (LL_B - 2 * LL_C) / 9;
function llSpace(k) { // centre of space k, and the unit vector pointing from it to the board's edge
  const h = LL_B / 2, c = LL_C / 2;
  if (k === 0) return { x: h - c, z: -h + c, ox: 0.7, oz: -0.7 };
  if (k < 10) return { x: h - c, z: -h + LL_C + (k - 0.5) * LL_W, ox: 1, oz: 0 };
  if (k === 10) return { x: h - c, z: h - c, ox: 0.7, oz: 0.7 };
  if (k < 20) return { x: h - LL_C - (k - 10.5) * LL_W, z: h - c, ox: 0, oz: 1 };
  if (k === 20) return { x: -h + c, z: h - c, ox: -0.7, oz: 0.7 };
  if (k < 30) return { x: -h + c, z: h - LL_C - (k - 20.5) * LL_W, ox: -1, oz: 0 };
  if (k === 30) return { x: -h + c, z: -h + c, ox: -0.7, oz: -0.7 };
  return { x: -h + LL_C + (k - 30.5) * LL_W, z: -h + c, ox: 0, oz: -1 };
}
function buildLandlord(group) {
  const B = LL_B, base = new THREE.Mesh(new THREE.BoxGeometry(B + 0.03, 0.02, B + 0.03), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.7 }));
  base.position.y = TOP + 0.01; group.add(base);
  const N = 1280, sc = N / B, SP = window.LibrariumRules.landlord.SPACES;
  const FILL = { lot: '#a9cf9d', need: '#a9c3e0', lux: '#c4abd8', franchise: '#ecd77e' };
  topPlane(group, B, B, TOP + 0.0205, tex(N, N, (g) => {
    g.fillStyle = '#efe7d2'; g.fillRect(0, 0, N, N); speckle(g, N, N, 2600, ['#d9cdb0'], 1.3);
    g.strokeStyle = '#1f1d1a'; g.fillStyle = '#1f1d1a'; g.lineWidth = 3; g.textAlign = 'center'; g.textBaseline = 'middle';
    const C = LL_C * sc, Wd = LL_W * sc;
    g.strokeRect(6, 6, N - 12, N - 12); g.strokeRect(C, C, N - 2 * C, N - 2 * C);
    const font = (px, it) => { g.font = `${it ? 'italic ' : ''}${px}px Georgia, "Times New Roman", serif`; };
    for (let k = 0; k < 40; k++) {
      if (k % 10 === 0) continue;
      const sp = SP[k], p = llSpace(k), cx = N / 2 + p.x * sc, cy = N / 2 + p.z * sc;
      const ang = p.oz === 1 ? 0 : p.oz === -1 ? Math.PI : p.ox === -1 ? Math.PI / 2 : -Math.PI / 2;
      g.save(); g.translate(cx, cy); g.rotate(ang);
      // In the rotated frame the space is Wd wide and C deep, with the board's edge at +C/2.
      if (FILL[sp.t]) { g.fillStyle = FILL[sp.t]; g.globalAlpha = 0.55; g.fillRect(-Wd / 2, -C / 2, Wd, C); g.globalAlpha = 1; }
      g.strokeStyle = '#1f1d1a'; g.lineWidth = 2.5; g.strokeRect(-Wd / 2, -C / 2, Wd, C);
      g.fillStyle = '#1f1d1a';
      const lines = sp.t === 'lot' ? [['LOT ' + sp.n, 16], ['FOR SALE', 12], ['$' + sp.price, 22], ['FOR RENT', 12], ['$' + sp.rent, 20]]
        : sp.t === 'need' ? [['ABSOLUTE', 11], ['NECESSITY', 11], [sp.name.toUpperCase(), 15], ['TAXES $5', 13]]
        : sp.t === 'rr' ? [['R. R.', 24], ['$5', 22]]
        : sp.t === 'lux' ? [['LUXURY', 15], ['$50', 22]]
        : sp.t === 'franchise' ? [[sp.key === 'light' ? 'LIGHT' : 'WATER', 15], ['FRANCHISE', 11], ['$5', 20]]
        : sp.t === 'legacy' ? [['LEGACY', 15], ['$100', 22]]
        : sp.t === 'trespass' ? [['NO', 13], ['TRES-', 13], ['PASSING', 13], ['GO TO', 11], ['JAIL', 15]] : [[sp.name, 13]];
      const total = lines.reduce((a, [, px]) => a + px * 1.25, 0); let y = -total / 2;
      for (const [t, px] of lines) { font(px); y += px * 0.625; g.fillText(t, 0, y, Wd - 8); y += px * 0.625; }
      g.restore();
    }
    // The corners, as the patent draws them.
    const corner = (k, draw) => { const p = llSpace(k), cx = N / 2 + p.x * sc, cy = N / 2 + p.z * sc; g.save(); g.translate(cx, cy); draw(); g.restore(); };
    corner(0, () => { // Mother Earth
      g.fillStyle = '#c9dcc0'; g.beginPath(); g.arc(0, 0, C * 0.3, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#86a676'; for (const [x, y, r] of [[-10, -9, 12], [9, 5, 14], [-3, 15, 7]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      g.fillStyle = '#1f1d1a'; font(15); g.fillText('MOTHER EARTH', 0, 0, C * 0.8);
      font(10); g.fillText('LABOR UPON MOTHER EARTH', 0, -C * 0.39, C * 0.95); g.fillText('PRODUCES WAGES', 0, C * 0.39, C * 0.95);
    });
    corner(10, () => { // Coal, with the jail
      g.save(); g.beginPath(); g.arc(C * 0.18, C * 0.18, C * 0.36, 0, TAU); g.clip();
      g.fillStyle = '#d8d0bc'; g.fillRect(-C, -C, 2 * C, 2 * C); g.lineWidth = 5; for (let x = -C / 2; x < C; x += 14) { g.beginPath(); g.moveTo(x, -C); g.lineTo(x, C); g.stroke(); }
      g.restore(); g.lineWidth = 2.5; g.beginPath(); g.arc(C * 0.18, C * 0.18, C * 0.36, 0, TAU); g.stroke();
      g.fillStyle = '#efe7d2'; g.fillRect(C * 0.18 - 30, C * 0.18 - 13, 60, 26); g.fillStyle = '#1f1d1a'; font(20); g.fillText('JAIL', C * 0.18, C * 0.18);
      font(10); g.fillText('ABSOLUTE NECESSITY', -C * 0.12, -C * 0.36); font(14); g.fillText('COAL  $5', -C * 0.12, -C * 0.24);
    });
    corner(20, () => { // Public Park and the poorhouse
      g.fillStyle = '#b9d3a8'; g.beginPath(); g.arc(0, 0, C * 0.2, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#1f1d1a'; font(14); g.fillText('PUBLIC PARK', 0, -C * 0.3); font(12); g.fillText('POOR HOUSE', 0, C * 0.32);
    });
    corner(30, () => { // Lord Blueblood's estate
      g.fillStyle = '#1f1d1a'; font(12); g.fillText('NO TRESPASSING', 0, -C * 0.22); g.fillText('GO TO JAIL', 0, -C * 0.1);
      font(9, true); g.fillText('Owner Lord Blueblood,', 0, C * 0.1); g.fillText('London, England', 0, C * 0.2);
    });
    // The centre: the four boxes of the patent.
    const m = C + 40, cw = (N - 2 * m - 30) / 2;
    [['R. R.', 0, 0], ['WAGES', 1, 0], ['BANK', 0, 1], ['PUBLIC TREASURY', 1, 1]].forEach(([t, cxi, cyi]) => {
      const x = m + cxi * (cw + 30), y = m + cyi * (cw + 30);
      g.lineWidth = 2.5; g.strokeRect(x, y, cw, cw); font(t.length > 8 ? 30 : 40); g.fillText(t, x + cw / 2, y + cw / 2, cw - 20);
    });
    font(16, true); g.fillText('THE LANDLORD\'S GAME · L. J. MAGIE · PAT. No. 748,626, 1904', N / 2, N / 2);
  }), { roughness: 0.8 });
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 }));
  pen.rotation.z = Math.PI / 2; pen.rotation.y = -0.5; pen.position.set(B / 2 + 0.09, TOP + 0.006, 0.3); group.add(pen);
  group.userData.display = [];
  return TOP + 0.021;
}

/* --- New tables: Chinese checkers, Hex, Gomoku and Dominoes */
const CC_D = 0.058;
function ccCell(i) { const [x, , z] = window.LibrariumRules.chinese.CELLS[i]; return { x: CC_D * (x + z / 2), z: CC_D * z * 0.866 }; }
const ccMarbleGeo = new THREE.SphereGeometry(0.019, 18, 12);
const CC_COLS = [0xb3261e, 0x1f4f9a, 0x2f8a3a, 0xd9a520, 0x6b2f8a, 0xf2efe6];
function ccMarble(col) { const mat = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.12, clearcoat: 0.8, transparent: true, opacity: 0.92 }); const m = new THREE.Mesh(ccMarbleGeo, mat); m.userData.mats = [mat]; return m; }
function buildChinese(group) {
  const R = 0.47, board = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.01, 0.03, 6), new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.5 }));
  board.position.y = TOP + 0.015; group.add(board); // corners point at the six points of the star
  const N = 1024, sc = N / (2 * R), CELLS = window.LibrariumRules.chinese.CELLS;
  // The six points are tinted the colours of the marbles that start in them.
  const tip = ([x, y, z]) => (z > 4 ? 0 : z < -4 ? 1 : x > 4 ? 2 : x < -4 ? 3 : y > 4 ? 4 : y < -4 ? 5 : -1);
  const top = topPlane(group, 2 * R, 2 * R, TOP + 0.0305, tex(N, N, (g) => {
    g.clearRect(0, 0, N, N);
    g.save(); g.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(N / 2 + Math.sin(a) * (R - 0.003) * sc, N / 2 + Math.cos(a) * (R - 0.003) * sc); }
    g.closePath(); g.clip(); woodGrain(g, N, N, '#b07a44', '#6a4422'); g.restore();
    CELLS.forEach((cell, i) => {
      const p = ccCell(i), x = N / 2 + p.x * sc, y = N / 2 + p.z * sc, t = tip(cell);
      if (t >= 0) { g.fillStyle = '#' + CC_COLS[t].toString(16).padStart(6, '0'); g.globalAlpha = 0.4; g.beginPath(); g.arc(x, y, 30, 0, TAU); g.fill(); g.globalAlpha = 1; }
      const gr = g.createRadialGradient(x, y, 2, x, y, 13); gr.addColorStop(0, '#2a160a'); gr.addColorStop(1, '#5a3418');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 12, 0, TAU); g.fill();
    });
  }), { roughness: 0.55, transparent: true });
  top.renderOrder = 1;
  // On display: all six points filled, as for a six-player game.
  const shown = [];
  CELLS.forEach((cell, i) => { const t = tip(cell); if (t < 0) return; const m = ccMarble(CC_COLS[t]); const p = ccCell(i); m.position.set(p.x, TOP + 0.045, p.z); group.add(m); shown.push(m); });
  group.userData.display = shown;
  return TOP + 0.031;
}

const hxStoneGeo = new THREE.CylinderGeometry(1, 1, 0.3, 6);
const HX_MATS = [new THREE.MeshStandardMaterial({ color: 0x9e1b14, roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: 0x15397a, roughness: 0.3 })];
function hxD(n) { return Math.min(0.075, 0.84 / (1.5 * (n - 1) + 1.3)); }
function hxCell(n, i) { const r = (i / n) | 0, c = i % n, d = hxD(n), h = (n - 1) / 2; return { x: (c - h) * d + (r - h) * d / 2, z: (h - r) * d * 0.866 }; }
function hxFace(n) { // the rhombus of hexagons for an n x n board, with red near and far edges and blue sides
  const W = 0.92, D = 0.62, N = 1280, sc = N / W, Nh = Math.round(N * D / W), d = hxD(n), rr = d / Math.sqrt(3) * 1.0;
  return topPlane(new THREE.Group(), W, D, 0, tex(N, Nh, (g) => {
    woodGrain(g, N, Nh, '#5a3a20', '#2e1c0e');
    const hexPath = (x, y, R) => { g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); } g.closePath(); };
    for (let i = 0; i < n * n; i++) {
      const p = hxCell(n, i), x = N / 2 + p.x * sc, y = Nh / 2 + p.z * sc, r = (i / n) | 0, c = i % n;
      const edge = r === 0 || r === n - 1 ? '#b3261e' : c === 0 || c === n - 1 ? '#1f4f9a' : null;
      hexPath(x, y, rr * sc * 1.02); g.fillStyle = edge ? edge : '#e9dcc0'; g.fill();
      if ((r === 0 || r === n - 1) && (c === 0 || c === n - 1)) { g.fillStyle = '#6a3a7a'; g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1; }
      hexPath(x, y, rr * sc * 0.86); g.fillStyle = edge === '#b3261e' ? '#e9b4a6' : edge ? '#adc2e4' : '#f3ead6'; g.fill();
      hexPath(x, y, rr * sc * 1.02); g.strokeStyle = '#3a2a1c'; g.lineWidth = 2; g.stroke();
    }
  }), { roughness: 0.7, transparent: true });
}
function buildHex(group) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.025, 0.66), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.6 }));
  base.position.y = TOP + 0.0125; group.add(base);
  const faces = {}, y = TOP + 0.0255;
  const face = n => { if (!faces[n]) { const f = hxFace(n); f.position.y = y; group.add(f); faces[n] = f; } Object.entries(faces).forEach(([k, f]) => { f.visible = +k === n; }); };
  face(11);
  // On display: the end of an 11 x 11 game, with red's winning chain.
  const R = seeded(1942), shown = [], d = hxD(11);
  const chain = [5, 16, 26, 37, 48, 58, 69, 79, 90, 101, 111];
  for (let i = 0; i < 121; i++) {
    const inChain = chain.includes(i), v = inChain ? 0 : R() < 0.38 ? (R() < 0.45 ? 0 : 1) : -1;
    if (v < 0) continue;
    const m = new THREE.Mesh(hxStoneGeo, HX_MATS[v]); const p = hxCell(11, i);
    m.scale.set(d * 0.42, 0.03, d * 0.42); m.position.set(p.x, y + 0.006, p.z); group.add(m); shown.push(m);
  }
  group.userData.hex = { face, display: shown };
  return y;
}

const GM_S = 0.052;
function gmCell(i) { const r = (i / 15) | 0, c = i % 15; return { x: (c - 7) * GM_S, z: (7 - r) * GM_S }; }
const gmStoneGeo = new THREE.SphereGeometry(0.0235, 22, 10);
function buildGomoku(group) {
  const W = 14 * GM_S + 0.07, ban = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, W), new THREE.MeshStandardMaterial({ color: 0xd2a868, roughness: 0.5 }));
  ban.position.y = TOP + 0.025; group.add(ban);
  const N = 1024, sc = N / W;
  topPlane(group, W, W, TOP + 0.0505, tex(N, N, (g) => {
    woodGrain(g, N, N, '#d9b273', '#9a7038');
    g.strokeStyle = '#2a1a0a'; g.lineWidth = 2;
    for (let k = 0; k < 15; k++) {
      const a = N / 2 + (k - 7) * GM_S * sc, lo = N / 2 - 7 * GM_S * sc, hi = N / 2 + 7 * GM_S * sc;
      g.beginPath(); g.moveTo(lo, a); g.lineTo(hi, a); g.stroke(); g.beginPath(); g.moveTo(a, lo); g.lineTo(a, hi); g.stroke();
    }
    g.fillStyle = '#2a1a0a';
    for (const [r, c] of [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]]) { g.beginPath(); g.arc(N / 2 + (c - 7) * GM_S * sc, N / 2 + (r - 7) * GM_S * sc, 6, 0, TAU); g.fill(); }
  }), { roughness: 0.5 });
  // On display: a game just won by black on the diagonal.
  const shown = [], put = (r, c, pl) => { const m = new THREE.Mesh(gmStoneGeo, GO9_MATS[pl]); m.scale.y = 0.42; const p = gmCell(r * 15 + c); m.position.set(p.x, TOP + 0.06, p.z); group.add(m); shown.push(m); };
  [[5, 5], [6, 6], [7, 7], [8, 8], [9, 9], [7, 8], [6, 8], [8, 6], [10, 7]].forEach(([r, c]) => put(r, c, 0));
  [[4, 4], [10, 10], [7, 6], [6, 7], [8, 7], [5, 8], [9, 8], [6, 5]].forEach(([r, c]) => put(r, c, 1));
  group.userData.display = shown;
  return TOP + 0.0505;
}

// Domino tiles: ebony backs, ivory faces with the two halves' pips.
const DM_L = 0.066, DM_Wd = 0.033, DM_H = 0.01;
const dmGeo = new THREE.BoxGeometry(DM_L, DM_H, DM_Wd);
const dmSide = new THREE.MeshStandardMaterial({ color: 0xe9e1cc, roughness: 0.4 }), dmBack = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.35 });
const DM_FACE = [];
function dmFace(t) {
  if (DM_FACE[t]) return DM_FACE[t];
  const [a, b] = window.LibrariumRules.dominoes.TILES[t];
  const P = { 0: [], 1: [[0.5, 0.5]], 2: [[0.25, 0.25], [0.75, 0.75]], 3: [[0.22, 0.22], [0.5, 0.5], [0.78, 0.78]], 4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], 6: [[0.27, 0.2], [0.73, 0.2], [0.27, 0.5], [0.73, 0.5], [0.27, 0.8], [0.73, 0.8]] };
  const map = tex(256, 128, (g) => {
    g.fillStyle = '#efe7d2'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#1c1410'; g.fillRect(126, 14, 4, 100);
    [[a, 0], [b, 128]].forEach(([n, ox]) => { for (const [px, py] of P[n]) { g.beginPath(); g.arc(ox + 14 + px * 100, 14 + py * 100, 11, 0, TAU); g.fill(); } });
  });
  return (DM_FACE[t] = new THREE.MeshStandardMaterial({ map, roughness: 0.4 }));
}
function dmTile(t) { const m = new THREE.Mesh(dmGeo, [dmSide, dmSide, dmFace(t), dmBack, dmSide, dmSide]); m.userData.mats = [dmSide]; m.userData.t = t; return m; }
function buildDominoes(group) {
  const W = 1.12, D = 0.88;
  const top = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), new THREE.MeshStandardMaterial({ color: 0x0b2214, roughness: 1 }));
  top.position.y = TOP + 0.01; group.add(top);
  const rim = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.5 });
  for (const [x, z, w, d] of [[0, D / 2, W + 0.04, 0.02], [0, -D / 2, W + 0.04, 0.02], [W / 2, 0, 0.02, D], [-W / 2, 0, 0.02, D]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), rim); b.position.set(x, TOP + 0.015, z); group.add(b); }
  // On display: a short line of play and the box the set came in.
  const shown = [], T = window.LibrariumRules.dominoes.TILES, id = (a, b) => T.findIndex(([x, y]) => x === a && y === b);
  [[2, 5], [5, 5], [5, 1], [1, 6], [6, 6], [6, 3]].forEach(([a, b], k) => {
    const m = dmTile(id(Math.min(a, b), Math.max(a, b))); m.position.set(-0.17 + k * (DM_L + 0.004), TOP + 0.02 + DM_H / 2, 0); if (a > b) m.rotation.y = Math.PI; group.add(m); shown.push(m);
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.07), new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.5 }));
  box.position.set(0.3, TOP + 0.0375, -0.22); box.rotation.y = 0.3; group.add(box); shown.push(box);
  group.userData.display = shown;
  return TOP + 0.02;
}

/* --- More tables: Tablut, Makruk, Kalah and Cribbage */
const TB_S = 0.088;
function tbCell(i) { const r = (i / 9) | 0, c = i % 9; return { x: (c - 4) * TB_S, z: (4 - r) * TB_S }; }
function tbPiece(v) {
  const mat = new THREE.MeshStandardMaterial({ color: v === 1 ? 0x2a1d14 : 0xe6d8b6, roughness: 0.4 });
  const m = new THREE.Mesh(v === 3 ? brKingGeo : brPawnGeo, mat); m.scale.setScalar(v === 3 ? 0.8 : 0.78); m.userData.mats = [mat];
  if (v === 1) { // Linnaeus drew the Muscovites notched, not coloured; ours are dark with a notched collar
    const notch = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 6), mat); notch.rotation.x = Math.PI / 2; notch.position.y = 0.05; m.add(notch);
  }
  if (v === 3) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.005, 8, 24), MAT.brass); band.rotation.x = Math.PI / 2; band.position.y = 0.074; m.add(band); }
  return m;
}
function buildTablut(group) {
  const W = 9 * TB_S + 0.06;
  const hide = new THREE.Mesh(new THREE.BoxGeometry(W, 0.012, W), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95 }));
  hide.position.y = TOP + 0.006; group.add(hide);
  const N = 1024, sc = N / W;
  topPlane(group, W, W, TOP + 0.0125, tex(N, N, (g) => {
    // Reindeer hide, with the grid embroidered in thread as Linnaeus saw it.
    g.fillStyle = '#9a7650'; g.fillRect(0, 0, N, N); speckle(g, N, N, 5000, ['#8a6640', '#a8845c', '#7a5634'], 1.6);
    const o = N / 2 - 4.5 * TB_S * sc, step = TB_S * sc;
    g.strokeStyle = '#efe2c4'; g.lineWidth = 3; g.setLineDash([9, 6]);
    for (let k = 0; k <= 9; k++) { g.beginPath(); g.moveTo(o, o + k * step); g.lineTo(o + 9 * step, o + k * step); g.stroke(); g.beginPath(); g.moveTo(o + k * step, o); g.lineTo(o + k * step, o + 9 * step); g.stroke(); }
    g.setLineDash([]);
    // The throne (konakis) and the Muscovites' squares are stitched with crosses.
    const cross = (r, c, col) => { const x = o + (c + 0.5) * step, y = o + (r + 0.5) * step; g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 18, y - 18); g.lineTo(x + 18, y + 18); g.moveTo(x + 18, y - 18); g.lineTo(x - 18, y + 18); g.stroke(); };
    cross(4, 4, '#b8402a');
    [3, 4, 5, 13, 27, 36, 45, 37, 35, 44, 53, 43, 75, 76, 77, 67].forEach(i => { const x = o + ((i % 9) + 0.5) * step, y = o + (((i / 9) | 0) + 0.5) * step; g.fillStyle = 'rgba(60,30,15,.25)'; g.beginPath(); g.arc(x, y, 30, 0, TAU); g.fill(); });
  }), { roughness: 0.95 });
  const shown = [], y = TOP + 0.013, G = window.LibrariumRules.tablut;
  G.init(); G.b.forEach((v, i) => { if (!v) return; const m = tbPiece(v), c = tbCell(i); m.position.set(c.x, y, c.z); group.add(m); shown.push(m); });
  group.userData.display = shown;
  return y;
}

const MK_S = 0.088;
function mkCell(i) { return { x: ((i & 7) - 3.5) * MK_S, z: (3.5 - (i >> 3)) * MK_S }; }
const mkLathe = (pts, m) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 22), m);
const MK_BASE = [[0, 0], [0.026, 0], [0.027, 0.006], [0.02, 0.012]];
const MK_SHAPES = { // Thai pieces: a tall khun, a small met, a domed khon, a boat-like ruea, a horse, and cowrie shells
  1: m => { const g = new THREE.Group(); g.add(mkLathe([...MK_BASE, [0.014, 0.05], [0.02, 0.062], [0.016, 0.074], [0.008, 0.086], [0.003, 0.094], [0, 0.096]], m)); return g; },
  2: m => mkLathe([...MK_BASE, [0.013, 0.034], [0.017, 0.042], [0.009, 0.054], [0, 0.058]], m),
  3: m => mkLathe([...MK_BASE, [0.014, 0.04], [0.019, 0.05], [0.017, 0.062], [0.008, 0.072], [0, 0.074]], m),
  4: m => CHESS_SHAPES.n(m),
  5: m => { const g = new THREE.Group(); g.add(mkLathe([...MK_BASE, [0.017, 0.04], [0.021, 0.046], [0.021, 0.054], [0, 0.054]], m)); return g; },
  6: m => { const c = new THREE.Mesh(new THREE.SphereGeometry(0.019, 18, 10), m); c.scale.set(0.8, 0.55, 1.15); c.position.y = 0.01; const g = new THREE.Group(); g.add(c); return g; },
  7: m => { const c = new THREE.Mesh(new THREE.SphereGeometry(0.019, 18, 10), m); c.scale.set(0.8, 0.55, 1.15); c.position.y = 0.01; c.rotation.z = Math.PI; const g = new THREE.Group(); g.add(c); const r = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 16), MAT.brass); r.rotation.x = Math.PI / 2; r.position.y = 0.021; g.add(r); return g; },
};
function mkPiece(v) {
  const pl = v > 8 ? 1 : 0, mat = new THREE.MeshStandardMaterial({ color: pl ? 0x8a2a1a : 0xe9dcbc, roughness: 0.4 });
  const o = MK_SHAPES[v & 7](mat); o.userData.mats = [mat]; o.rotation.y = pl ? -Math.PI / 2 : Math.PI / 2; return o;
}
function buildMakruk(group) {
  const W = 8 * MK_S + 0.07, frame = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, W), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.5 }));
  frame.position.y = TOP + 0.02; group.add(frame);
  const N = 1024, sc = N / W;
  topPlane(group, W, W, TOP + 0.0405, tex(N, N, (g) => {
    woodGrain(g, N, N, '#c8a064', '#7a5428');
    const o = N / 2 - 4 * MK_S * sc, step = MK_S * sc;
    g.strokeStyle = '#2a1608'; g.lineWidth = 3; // a makruk board is not checkered: only lines
    for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(o, o + k * step); g.lineTo(o + 8 * step, o + k * step); g.stroke(); g.beginPath(); g.moveTo(o + k * step, o); g.lineTo(o + k * step, o + 8 * step); g.stroke(); }
  }), { roughness: 0.55 });
  const y = TOP + 0.041, shown = [], G = window.LibrariumRules.makruk;
  G.init(); G.b.forEach((v, i) => { if (!v) return; const m = mkPiece(v), c = mkCell(i); m.position.set(c.x, y, c.z); group.add(m); shown.push(m); });
  group.userData.display = shown;
  return y;
}

const KL_DX = 0.118;
function klPit(i) { // 0-5 the visitor's row left to right, 7-12 the Scribe's row right to left
  if (i < 6) return { x: (i - 2.5) * KL_DX, z: 0.075 };
  return { x: (12 - i - 2.5) * KL_DX, z: -0.075 };
}
function klStore(pl) { return { x: pl === 0 ? 0.47 : -0.47, z: 0 }; }
function buildKalah(group) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4222, roughness: 0.55 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.06, 0.34), wood); block.position.y = TOP + 0.03; group.add(block);
  topPlane(group, 1.08, 0.34, TOP + 0.0605, tex(1024, 320, (g, w, h) => woodGrain(g, w, h, '#8a5a2e', '#3a2210')), { roughness: 0.55 });
  const y = TOP + 0.062, rimMat = new THREE.MeshStandardMaterial({ color: 0x4a2c14, roughness: 0.5 }), pits = [];
  for (let i = 0; i < 14; i++) {
    if (i === 6 || i === 13) continue;
    const p = klPit(i), mat = new THREE.MeshStandardMaterial({ color: 0x1e0f06, roughness: 0.85 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.004, 28), mat); disc.position.set(p.x, y, p.z); disc.userData.mats = [mat]; group.add(disc); pits[i] = disc;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 8, 32), rimMat); rim.rotation.x = -Math.PI / 2; rim.position.set(p.x, y + 0.002, p.z); group.add(rim);
  }
  for (const pl of [0, 1]) { const p = klStore(pl); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 28), new THREE.MeshStandardMaterial({ color: 0x1e0f06, roughness: 0.85 })); st.scale.z = 2.3; st.position.set(p.x, y, p.z); group.add(st); }
  group.userData.pits = pits;
  // On display: four seeds to a pit, ready to play.
  const shown = [], cols = [0x6a8aa8, 0x8aa86a, 0xa86a6a, 0xa8986a];
  for (let i = 0; i < 14; i++) { if (i === 6 || i === 13) continue; const p = klPit(i); for (let k = 0; k < 4; k++) { const sd = new THREE.Mesh(seedGeo, new THREE.MeshStandardMaterial({ color: cols[(i + k) % 4], roughness: 0.25 })); const a = k * 1.6 + i; sd.position.set(p.x + Math.cos(a) * 0.018, y + 0.009, p.z + Math.sin(a) * 0.018); group.add(sd); shown.push(sd); } }
  group.userData.display = shown;
  return y + 0.002;
}

// Cribbage: French-suited cards and a pegging board.
const CR_W = 0.062, CR_H = 0.092;
const crGeo = new THREE.BoxGeometry(CR_W, 0.0016, CR_H);
const crBackMat = new THREE.MeshStandardMaterial({ roughness: 0.6, map: cardTex((g, w, h) => {
  g.fillStyle = '#1f3a6a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8dcc0'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  g.lineWidth = 2; g.strokeStyle = 'rgba(232,220,192,.5)';
  for (let k = -h; k < w + h; k += 18) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); }
}, 140, 210) });
const crFaceCache = new Map();
function crFace(c) {
  if (crFaceCache.has(c)) return crFaceCache.get(c);
  const R = window.LibrariumRules.cribbage, rk = R.rank(c), su = R.suit(c), red = su === 1 || su === 2, col = red ? '#b3261e' : '#1c1c1c';
  const label = 'A 2 3 4 5 6 7 8 9 10 J Q K'.split(' ')[rk], sym = ['♠', '♥', '♦', '♣'][su];
  const map = cardTex((g, w, h) => {
    g.fillStyle = '#f7f2e6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 34px "Montserrat",sans-serif'; g.fillText(label, 26, 30); g.font = '30px serif'; g.fillText(sym, 26, 62);
    g.save(); g.translate(w, h); g.rotate(Math.PI); g.font = '700 34px "Montserrat",sans-serif'; g.fillText(label, 26, 30); g.font = '30px serif'; g.fillText(sym, 26, 62); g.restore();
    if (rk >= 10) { g.font = '600 64px "Amethysta",Georgia,serif'; g.fillText(label, w / 2, h / 2 - 8); g.font = '40px serif'; g.fillText(sym, w / 2, h / 2 + 46); }
    else { g.font = (rk === 0 ? '96px' : '64px') + ' serif'; g.fillText(sym, w / 2, h / 2 + 4); }
  }, 140, 210);
  crFaceCache.set(c, map); return map;
}
function crCard(c) { const face = new THREE.MeshStandardMaterial({ map: crFace(c), roughness: 0.55 }); const m = new THREE.Mesh(crGeo, [tcEdgeMat, tcEdgeMat, face, crBackMat, tcEdgeMat, tcEdgeMat]); m.userData.mats = [face]; m.userData.c = c; return m; }
// Pegging holes: each player has a lane of sixty, thirty up the board and thirty back.
const CRB_X0 = -0.5, CRB_Z0 = 0.3, CRB_DZ = 0.0205;
function crHole(pl, s) {
  if (s <= 0) return { x: CRB_X0 + pl * 0.07 + 0.0125, z: CRB_Z0 + 0.035 };
  if (s >= 61) return { x: CRB_X0 + 0.0475, z: CRB_Z0 - 30 * CRB_DZ - 0.03 };
  const k = (s - 1) % 60, back = k >= 30, x = CRB_X0 + pl * 0.07 + (back ? 0.025 : 0);
  return { x, z: back ? CRB_Z0 - (59 - k) * CRB_DZ : CRB_Z0 - k * CRB_DZ };
}
function buildCribbage(group) {
  const W = 1.12, D = 0.86;
  const baize = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, D), new THREE.MeshStandardMaterial({ color: 0x0b2214, roughness: 1 }));
  baize.position.y = TOP + 0.01; group.add(baize);
  // The board: a long plank of light wood with two lanes of holes.
  const L = 31 * CRB_DZ + 0.09, bw = 0.15, board = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.022, L), new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 0.5 }));
  const cz = CRB_Z0 - 15 * CRB_DZ;
  board.position.set(CRB_X0 + 0.0475, TOP + 0.031, cz); group.add(board);
  const N = 256, Nz = Math.round(256 * L / bw), sc = N / bw;
  const face = topPlane(group, bw, L, TOP + 0.0422, tex(N, Nz, (g) => {
    woodGrain(g, N, Nz, '#d4a868', '#8a6030');
    const hole = (x, z, col) => { const px = N / 2 + (x - (CRB_X0 + 0.0475)) * sc, pz = Nz / 2 + (z - cz) * sc; g.fillStyle = col; g.beginPath(); g.arc(px, pz, 4.5, 0, TAU); g.fill(); };
    for (const pl of [0, 1]) for (let s = 0; s <= 60; s++) { const h = crHole(pl, s); hole(h.x, h.z, s % 5 === 0 && s ? '#3a1a08' : '#5a3418'); }
    const gh = crHole(0, 61); hole(gh.x, gh.z, '#1a0a02');
    g.strokeStyle = 'rgba(58,26,8,.6)'; g.lineWidth = 2; for (let k = 5; k < 30; k += 5) { const z = Nz / 2 + (CRB_Z0 - (k - 0.5) * CRB_DZ - cz) * sc; g.beginPath(); g.moveTo(8, z); g.lineTo(N - 8, z); g.stroke(); }
  }), { roughness: 0.5 });
  face.position.x = CRB_X0 + 0.0475; face.position.z = cz;
  const pegs = [0, 1].map(pl => [0, 1].map(k => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.028, 10), new THREE.MeshStandardMaterial({ color: pl ? 0x1f3a6a : 0xb3261e, roughness: 0.3, metalness: 0.3 })); const h = crHole(pl, 0); m.position.set(h.x + (k ? 0.006 : -0.006), TOP + 0.052, h.z); group.add(m); return m; }));
  group.userData.pegs = pegs; group.userData.pegY = TOP + 0.052;
  // On display: a hand of 29, the best there is, fanned beside the board.
  const R = window.LibrariumRules.cribbage, shown = [], cd = (r, su) => su * 13 + r;
  [cd(4, 0), cd(4, 1), cd(4, 2), cd(10, 3), cd(4, 3)].forEach((c, k) => { const m = crCard(c); m.position.set(-0.12 + k * 0.07, TOP + 0.021 + k * 0.0003, 0.05); m.rotation.y = (k - 2) * -0.06; group.add(m); shown.push(m); });
  group.userData.display = shown;
  return TOP + 0.021;
}

/* --- Round five: Morabaraba, Ludo and Janggi */
function buildMorabaraba(group) {
  const W = 0.86;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, W), new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.95 }));
  slab.position.y = TOP + 0.02; group.add(slab);
  const px = 1024, sc = px / W, c = px / 2;
  // Scratched into hard earth and chalked, as herders draw it.
  topPlane(group, W, W, TOP + 0.0405, tex(px, px, (g) => {
    g.fillStyle = '#5a3e2a'; g.fillRect(0, 0, px, px); speckle(g, px, px, 9000, ['#4e3422', '#6a4c36', '#43301f', '#725640'], 2.2);
    g.strokeStyle = '#efe6d2'; g.lineWidth = 8; g.lineCap = 'round';
    for (const sz of MO_S) g.strokeRect(c - sz * sc, c - sz * sc, 2 * sz * sc, 2 * sz * sc);
    g.beginPath();
    g.moveTo(c, c - MO_S[0] * sc); g.lineTo(c, c - MO_S[2] * sc); g.moveTo(c, c + MO_S[2] * sc); g.lineTo(c, c + MO_S[0] * sc);
    g.moveTo(c - MO_S[0] * sc, c); g.lineTo(c - MO_S[2] * sc, c); g.moveTo(c + MO_S[2] * sc, c); g.lineTo(c + MO_S[0] * sc, c);
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.moveTo(c + dx * MO_S[0] * sc, c + dz * MO_S[0] * sc); g.lineTo(c + dx * MO_S[2] * sc, c + dz * MO_S[2] * sc); }
    g.stroke();
    g.fillStyle = '#efe6d2';
    for (let p = 0; p < 24; p++) { const q = moPoint(p); g.beginPath(); g.arc(c + q.x * sc, c + q.z * sc, 15, 0, TAU); g.fill(); }
  }), { roughness: 0.95 });
  return TOP + 0.041;
}

const LD_C = 0.056;
function ldXZ(gx, gy) { return { x: (gx - 7) * LD_C, z: (7 - gy) * LD_C }; }
const LD_COL = { red: 0xb3261e, green: 0x2f7a3a, yellow: 0xd9a520, blue: 0x1f4f9a };
function ldSpot(pl, rel, k) {
  const R = window.LibrariumRules.ludo;
  if (rel < 0) { const base = pl ? [10.5, 10.5] : [1.5, 1.5], o = [[0, 0], [2, 0], [0, 2], [2, 2]][k]; return ldXZ(base[0] + o[0], base[1] + o[1]); }
  if (rel <= 50) { const [gx, gy] = R.TRACK[(rel + R.START[pl]) % 52]; return ldXZ(gx, gy); }
  if (rel <= 55) { const d = rel - 50; return pl ? ldXZ(14 - d, 7) : ldXZ(d, 7); }
  const o = (k - 1.5) * 0.3; return pl ? ldXZ(7.9, 7 + o) : ldXZ(6.1, 7 + o);
}
function buildLudo(group) {
  const W = 15 * LD_C + 0.04;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.025, W), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.6 }));
  board.position.y = TOP + 0.0125; group.add(board);
  const N = 1080, sc = N / W, R = window.LibrariumRules.ludo, hex = v => '#' + v.toString(16).padStart(6, '0');
  topPlane(group, W, W, TOP + 0.0255, tex(N, N, (g) => {
    g.fillStyle = '#f2ead6'; g.fillRect(0, 0, N, N);
    const cell = (gx, gy, fill) => { const p = ldXZ(gx, gy), x = N / 2 + (p.x - LD_C / 2) * sc, y = N / 2 + (p.z - LD_C / 2) * sc, w = LD_C * sc; g.fillStyle = fill; g.fillRect(x, y, w, w); g.strokeStyle = '#3a2a1c'; g.lineWidth = 2; g.strokeRect(x, y, w, w); };
    // Yards in the four corners: red near left, green near right, yellow far right, blue far left.
    const yard = (gx, gy, col) => { const p = ldXZ(gx + 2.5, gy + 2.5), w = 6 * LD_C * sc; g.fillStyle = hex(col); g.fillRect(N / 2 + p.x * sc - w / 2, N / 2 + p.z * sc - w / 2, w, w); g.fillStyle = '#f2ead6'; g.fillRect(N / 2 + p.x * sc - w * 0.36, N / 2 + p.z * sc - w * 0.36, w * 0.72, w * 0.72);
      g.fillStyle = hex(col); for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.arc(N / 2 + (p.x + ox * LD_C) * sc, N / 2 + (p.z - oy * LD_C) * sc, LD_C * sc * 0.38, 0, TAU); g.fill(); } };
    yard(0, 0, LD_COL.red); yard(9, 0, LD_COL.green); yard(9, 9, LD_COL.yellow); yard(0, 9, LD_COL.blue);
    R.TRACK.forEach(([gx, gy], k) => cell(gx, gy, k === 0 ? hex(LD_COL.red) : k === 13 ? hex(LD_COL.green) : k === 26 ? hex(LD_COL.yellow) : k === 39 ? hex(LD_COL.blue) : '#fbf7ec'));
    for (let d = 1; d <= 5; d++) { cell(d, 7, hex(LD_COL.red)); cell(14 - d, 7, hex(LD_COL.yellow)); cell(7, d, hex(LD_COL.green)); cell(7, 14 - d, hex(LD_COL.blue)); }
    // The centre: four triangles pointing home.
    const ctr = ldXZ(7, 7), cx = N / 2 + ctr.x * sc, cy = N / 2 + ctr.z * sc, h = 1.5 * LD_C * sc;
    [[LD_COL.red, [-1, -1], [-1, 1]], [LD_COL.green, [-1, 1], [1, 1]], [LD_COL.yellow, [1, 1], [1, -1]], [LD_COL.blue, [1, -1], [-1, -1]]].forEach(([col, a, b]) => {
      g.fillStyle = hex(col); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + a[0] * h, cy + a[1] * h); g.lineTo(cx + b[0] * h, cy + b[1] * h); g.closePath(); g.fill();
    });
  }), { roughness: 0.6 });
  // On display: four tokens of each colour in their yards.
  const shown = [], y = TOP + 0.026;
  [[LD_COL.red, 0, [1.5, 1.5]], [LD_COL.green, 0, [10.5, 1.5]], [LD_COL.yellow, 1, [10.5, 10.5]], [LD_COL.blue, 1, [1.5, 10.5]]].forEach(([col, , base]) => {
    [[0, 0], [2, 0], [0, 2], [2, 2]].forEach(([ox, oy]) => { const m = goosePawn(col), p = ldXZ(base[0] + ox, base[1] + oy); m.scale.setScalar(0.8); m.position.set(p.x, y, p.z); group.add(m); shown.push(m); });
  });
  group.userData.display = shown;
  return y;
}

const JG_CHARS = [[null, '楚', '士', '象', '馬', '車', '包', '卒'], [null, '漢', '士', '象', '馬', '車', '包', '兵']];
const JG_R = [0, 0.036, 0.024, 0.03, 0.03, 0.031, 0.03, 0.024];
const jgTex = {};
function jgFace(pl, t) {
  const key = pl * 8 + t;
  if (!jgTex[key]) jgTex[key] = tex(128, 128, (g, w) => {
    g.fillStyle = '#f0e6cc'; g.fillRect(0, 0, w, w);
    const ink = pl ? '#b0201a' : '#14506a';
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${t === 1 ? 'bold 74px' : '62px'} "Noto Serif CJK KR","Noto Serif CJK SC","Batang","SimSun",serif`;
    g.fillText(JG_CHARS[pl][t], 64, 60);
    g.font = '600 15px "Montserrat",sans-serif'; g.fillText(XQ_LATIN[t], 64, 108);
  });
  return jgTex[key];
}
const jgSideMat = new THREE.MeshStandardMaterial({ color: 0xd9c9a0, roughness: 0.5 });
function jgPiece(pl, t) {
  const r = JG_R[t], top = new THREE.MeshStandardMaterial({ map: jgFace(pl, t), roughness: 0.45 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.018, 8), [jgSideMat, top, jgSideMat]);
  m.rotation.y = Math.PI / 8; m.userData.mats = [top]; m.userData.pl = pl; m.userData.t = t; return m;
}
function buildJanggi(group) {
  const W = 8 * XQ_S + 0.12, D = 9 * XQ_S + 0.12;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.035, D), new THREE.MeshStandardMaterial({ color: 0x9a6a32, roughness: 0.5 }));
  board.position.y = TOP + 0.0175; group.add(board);
  const pw = 1024, ph = Math.round(pw * D / W), sc = pw / W, ox = pw / 2 - 4 * XQ_S * sc, oy = ph / 2 - 4.5 * XQ_S * sc, st = XQ_S * sc;
  topPlane(group, W, D, TOP + 0.0355, tex(pw, ph, (g) => {
    woodGrain(g, pw, ph, '#e8c488', '#9a6a32');
    g.strokeStyle = '#3a1a0a'; g.lineWidth = 4;
    const P = (r, c) => [ox + c * st, oy + (9 - r) * st];
    const line = (a, b) => { g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.stroke(); };
    for (let r = 0; r < 10; r++) line([r, 0], [r, 8]);
    for (let c = 0; c < 9; c++) line([0, c], [9, c]); // no river: the files run the whole way
    line([0, 3], [2, 5]); line([0, 5], [2, 3]); line([7, 3], [9, 5]); line([7, 5], [9, 3]);
    g.lineWidth = 8; g.strokeRect(ox - 10, oy - 10, 8 * st + 20, 9 * st + 20);
  }), { roughness: 0.5 });
  const y = TOP + 0.036, shown = [], G = window.LibrariumRules.janggi;
  G.init(); G.b.forEach((v, i) => { if (!v) return; const m = jgPiece(v > 8 ? 1 : 0, v & 7), c = xqCell(i); m.position.set(c.x, y + 0.009, c.z); group.add(m); shown.push(m); });
  group.userData.display = shown;
  return y;
}

/* --- Backfill displays: early dice, petteia, liubo and patolli */
function pipFace(n, base, dot) {
  return tex(128, 128, (g, w) => {
    g.fillStyle = base; g.fillRect(0, 0, w, w);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, w, 6); g.fillRect(0, 0, 6, w);
    const P = { 1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]], 4: [[34, 34], [94, 34], [34, 94], [94, 94]], 5: [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]], 6: [[36, 28], [92, 28], [36, 64], [92, 64], [36, 100], [92, 100]] }[n];
    g.fillStyle = dot;
    for (const [x, y] of P) { g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill(); }
  });
}
function cubeDie(size, base, dot) {
  // Faces in BoxGeometry order (+x, -x, +y, -y, +z, -z), opposite faces adding to seven.
  const mats = [1, 6, 2, 5, 3, 4].map(n => new THREE.MeshStandardMaterial({ map: pipFace(n, base, dot), roughness: 0.75 }));
  return new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mats);
}
function buildDice(group) {
  topPlane(group, 0.86, 0.6, TOP + 0.002, tex(512, 360, (g, w, h) => {
    g.fillStyle = '#5a3a24'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${rand(20, 60) | 0},${rand(10, 30) | 0},5,.25)`; g.fillRect(rand(0, w), rand(0, h), rand(1, 4), rand(1, 3)); }
  }), { roughness: 0.95 });
  // Terracotta dice in the Indus manner, and darker ones like those from the Burnt City.
  const R = seeded(2500);
  const put = (d, x, z) => { d.position.set(x, TOP + d.geometry.parameters.height / 2 + 0.002, z); d.rotation.y = R() * TAU; group.add(d); };
  put(cubeDie(0.06, '#b8693a', '#3a1a0a'), -0.24, 0.06);
  put(cubeDie(0.052, '#a95e33', '#2e1408'), -0.12, -0.08);
  put(cubeDie(0.056, '#c27a48', '#3a1a0a'), -0.02, 0.1);
  put(cubeDie(0.045, '#3c2a1c', '#e8d8b0'), 0.16, -0.06);
  put(cubeDie(0.045, '#45301f', '#e8d8b0'), 0.25, 0.07);
  const counter = new THREE.ConeGeometry(0.018, 0.04, 14);
  const cm = new THREE.MeshStandardMaterial({ color: 0x2a201a, roughness: 0.5 });
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(counter, cm); c.position.set(0.12 + (i % 3) * 0.05, TOP + 0.022, 0.18 + ((i / 3) | 0) * 0.05); group.add(c); }
}
function buildPetteia(group) {
  // The board's size is unknown: this is a guess, a stone slab cut into an 8 x 8 grid.
  const W = 0.62;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, W), new THREE.MeshStandardMaterial({ color: 0xb8ad98, roughness: 0.9 }));
  slab.position.y = TOP + 0.025; group.add(slab);
  topPlane(group, W, W, TOP + 0.0505, tex(512, 512, (g, w) => {
    g.fillStyle = '#bdb29c'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(80,70,55,${rand(0.03, 0.12)})`; g.fillRect(rand(0, w), rand(0, w), rand(1, 6), rand(1, 6)); }
    g.strokeStyle = 'rgba(60,50,38,.75)'; g.lineWidth = 3;
    const m = 36, c = (w - 2 * m) / 8;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(m, m + i * c); g.lineTo(w - m, m + i * c); g.stroke(); g.beginPath(); g.moveTo(m + i * c, m); g.lineTo(m + i * c, w - m); g.stroke(); }
  }), { roughness: 0.9 });
  const peb = new THREE.SphereGeometry(0.022, 14, 10);
  const mats = [new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.45 })];
  const R = seeded(442);
  const at = (r, cc) => [(cc - 3.5) * (W - 0.088) / 8, (r - 3.5) * (W - 0.088) / 8];
  const taken = new Set();
  for (const [pl, rows] of [[0, [6, 7]], [1, [0, 1]]]) for (const r of rows) for (let k = 0; k < 8; k++) {
    let rr = r, cc = k;
    if (R() < 0.22) { rr += pl ? 2 + ((R() * 2) | 0) : -2 - ((R() * 2) | 0); }
    if (taken.has(rr * 8 + cc) || R() < 0.12) continue; taken.add(rr * 8 + cc);
    const m = new THREE.Mesh(peb, mats[pl]); m.scale.y = 0.55; const [x, z] = at(rr, cc);
    m.position.set(x + (R() - 0.5) * 0.008, TOP + 0.062, z + (R() - 0.5) * 0.008); group.add(m);
  }
}
function buildLiubo(group) {
  const W = 0.56;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, W), new THREE.MeshStandardMaterial({ color: 0x1c100c, roughness: 0.35 }));
  board.position.y = TOP + 0.03; group.add(board);
  topPlane(group, W, W, TOP + 0.0605, tex(512, 512, (g, w) => {
    g.fillStyle = '#1c100c'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#b8402a'; g.lineWidth = 7; g.lineCap = 'square';
    const m = 40, inner = 150;
    g.strokeRect(m, m, w - 2 * m, w - 2 * m);
    g.strokeRect(inner, inner, w - 2 * inner, w - 2 * inner);
    const c = w / 2;
    // T marks on the central square, L marks on the edges, V marks at the corners.
    for (let k = 0; k < 4; k++) {
      g.save(); g.translate(c, c); g.rotate(k * Math.PI / 2);
      g.beginPath(); g.moveTo(0, -(c - inner)); g.lineTo(0, -(c - inner) - 34); g.moveTo(-24, -(c - inner) - 34); g.lineTo(24, -(c - inner) - 34); g.stroke();
      g.beginPath(); g.moveTo(-26, -(c - m)); g.lineTo(-26, -(c - m) + 34); g.lineTo(8, -(c - m) + 34); g.stroke();
      g.beginPath(); g.moveTo(-(c - m) + 30, -(c - m) + 74); g.lineTo(-(c - m) + 30, -(c - m) + 30); g.lineTo(-(c - m) + 74, -(c - m) + 30); g.stroke();
      g.restore();
    }
    g.fillStyle = '#b8402a'; for (const [x, y] of [[c - 60, c - 60], [c + 60, c - 60], [c - 60, c + 60], [c + 60, c + 60]]) { g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); }
  }), { roughness: 0.3 });
  const piece = new THREE.BoxGeometry(0.03, 0.026, 0.022);
  const mats = [new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0x141010, roughness: 0.35 })];
  for (const [pl, z] of [[0, 0.2], [1, -0.2]]) for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(piece, mats[pl]); m.position.set((k - 2.5) * 0.06, TOP + 0.074, z + (k % 2 ? 0.012 : -0.012)); group.add(m);
  }
  // One piece stood on end: an 'owl'.
  const owl = new THREE.Mesh(piece, mats[0]); owl.rotation.z = Math.PI / 2; owl.position.set(0.05, TOP + 0.076, 0.06); group.add(owl);
  const stick = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 10, 1, false, 0, Math.PI);
  const sm = new THREE.MeshStandardMaterial({ color: 0x8a6030, roughness: 0.6, side: THREE.DoubleSide });
  // Six throwing sticks laid side by side, flat face down.
  for (let k = 0; k < 6; k++) { const st = new THREE.Mesh(stick, sm); st.rotation.set(-Math.PI / 2, 0, 0); st.position.set(W / 2 + 0.06 + k * 0.022, TOP, 0); group.add(st); }
}
function buildPatolli(group) {
  const W = 0.84;
  const px = 1024;
  topPlane(group, W, W, TOP + 0.004, tex(px, px, (g, w) => {
    // A reed mat, with the X-shaped track of 52 houses painted on it.
    g.fillStyle = '#c8a86a'; g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 10) { g.fillStyle = y % 20 ? 'rgba(120,85,40,.25)' : 'rgba(255,240,200,.12)'; g.fillRect(0, y, w, 5); }
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(90,60,25,.25)'; g.fillRect(x, 0, 3, w); }
    const c = w / 2, sq = 50;
    g.save(); g.translate(c, c); g.rotate(Math.PI / 4);
    g.strokeStyle = '#2a1a0a'; g.lineWidth = 7;
    const cell = (x, y, fill) => { g.fillStyle = fill || '#ead6a4'; g.fillRect(x, y, sq, sq); g.strokeRect(x, y, sq, sq); };
    for (let k = 0; k < 4; k++) {
      g.save(); g.rotate(k * Math.PI / 2);
      for (let i = 1; i <= 6; i++) for (const j of [-1, 0]) {
        const fill = i === 6 ? '#8a2a1c' : i === 4 ? '#2a1a0a' : null;
        cell(j * sq, i * sq, fill);
      }
      g.restore();
    }
    for (const j of [-1, 0]) for (const i of [-1, 0]) cell(j * sq, i * sq, '#d8b878');
    g.restore();
  }), { roughness: 0.95 });
  const bean = new THREE.SphereGeometry(0.014, 12, 8);
  const bm = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.5 }), wm = new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.5 });
  const R = seeded(1521);
  for (let k = 0; k < 5; k++) {
    const b = new THREE.Mesh(bean, bm); b.scale.set(1.3, 0.6, 0.9); b.position.set(0.3 + R() * 0.08, TOP + 0.013, 0.24 + k * 0.03); b.rotation.y = R() * TAU; group.add(b);
    if (R() < 0.5) { const dot = new THREE.Mesh(new THREE.CircleGeometry(0.005, 10), wm); dot.rotation.x = -Math.PI / 2; dot.position.set(b.position.x, TOP + 0.022, b.position.z); group.add(dot); }
  }
  const stone = new THREE.SphereGeometry(0.016, 12, 8);
  const sm = [new THREE.MeshStandardMaterial({ color: 0xa8322a, roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: 0x2a4a8a, roughness: 0.45 })];
  for (let pl = 0; pl < 2; pl++) for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(stone, sm[pl]); m.scale.y = 0.6;
    m.position.set((pl ? 0.33 : -0.33) + (k % 2) * 0.035, TOP + 0.014, -0.3 + ((k / 2) | 0) * 0.035); group.add(m);
  }
}

/* --- Backfill tables: Alquerque, Xiangqi, Snakes and Ladders */
const AQ_S = 0.15;
function aqCell(i) { const r = (i / 5) | 0, c = i % 5; return { x: (c - 2) * AQ_S, z: (2 - r) * AQ_S }; }
function buildAlquerque(group) {
  const W = 4 * AQ_S + 0.16;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.035, W), new THREE.MeshStandardMaterial({ color: 0x6a4424, roughness: 0.55 }));
  board.position.y = TOP + 0.0175; group.add(board);
  const px = 1024, sc = px / W, o = px / 2 - 2 * AQ_S * sc, st = AQ_S * sc;
  topPlane(group, W, W, TOP + 0.0355, tex(px, px, (g) => {
    woodGrain(g, px, px, '#b98a52', '#6a4424');
    g.strokeStyle = '#2a170b'; g.lineWidth = 6; g.lineCap = 'round';
    const P = (r, c) => [o + c * st, o + (4 - r) * st];
    const line = (a, b) => { g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.stroke(); };
    for (let k = 0; k < 5; k++) { line([k, 0], [k, 4]); line([0, k], [4, k]); }
    line([0, 0], [4, 4]); line([0, 4], [4, 0]); line([2, 0], [0, 2]); line([0, 2], [2, 4]); line([2, 4], [4, 2]); line([4, 2], [2, 0]);
    g.fillStyle = '#2a170b';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const [x, y] = P(r, c); g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill(); }
  }), { roughness: 0.55 });
  return TOP + 0.036;
}
const XQ_S = 0.068;
function xqCell(i) { const r = (i / 9) | 0, c = i % 9; return { x: (c - 4) * XQ_S, z: (4.5 - r) * XQ_S }; }
const XQ_CHARS = [[null, '帥', '仕', '相', '傌', '俥', '炮', '兵'], [null, '將', '士', '象', '馬', '車', '砲', '卒']];
const XQ_LATIN = [null, 'G', 'A', 'E', 'H', 'R', 'C', 'S'];
const xqTexCache = {};
function xqFace(pl, t) {
  const key = pl * 8 + t;
  if (!xqTexCache[key]) xqTexCache[key] = tex(128, 128, (g, w) => {
    g.fillStyle = '#efe2c2'; g.fillRect(0, 0, w, w);
    const ink = pl ? '#1a1a1a' : '#b0201a';
    g.strokeStyle = ink; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke();
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 64px "Noto Serif CJK SC","Noto Sans CJK SC","Songti SC","SimSun","PingFang SC","Microsoft YaHei",serif';
    g.fillText(XQ_CHARS[pl][t], 64, 62);
    g.font = '600 15px "Montserrat",sans-serif'; g.fillText(XQ_LATIN[t], 64, 106); // a small letter for readers without Chinese fonts
  });
  return xqTexCache[key];
}
const xqDiscGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.016, 32);
const xqSideMat = new THREE.MeshStandardMaterial({ color: 0xd8c49a, roughness: 0.5 });
function xqPiece(pl, t) {
  const top = new THREE.MeshStandardMaterial({ map: xqFace(pl, t), roughness: 0.45 });
  const m = new THREE.Mesh(xqDiscGeo, [xqSideMat, top, xqSideMat]);
  m.userData.mats = [top]; m.userData.pl = pl; m.userData.t = t;
  return m;
}
function buildXiangqi(group) {
  const W = 8 * XQ_S + 0.12, D = 9 * XQ_S + 0.12;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.035, D), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.5 }));
  board.position.y = TOP + 0.0175; group.add(board);
  const pw = 1024, ph = Math.round(pw * D / W), sc = pw / W, ox = pw / 2 - 4 * XQ_S * sc, oy = ph / 2 - 4.5 * XQ_S * sc, st = XQ_S * sc;
  topPlane(group, W, D, TOP + 0.0355, tex(pw, ph, (g) => {
    woodGrain(g, pw, ph, '#e0b878', '#8a5a2a');
    g.strokeStyle = '#3a1a0a'; g.lineWidth = 4;
    const P = (r, c) => [ox + c * st, oy + (9 - r) * st];
    const line = (a, b) => { g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.stroke(); };
    for (let r = 0; r < 10; r++) line([r, 0], [r, 8]);
    for (let c = 0; c < 9; c++) { if (c === 0 || c === 8) line([0, c], [9, c]); else { line([0, c], [4, c]); line([5, c], [9, c]); } }
    line([0, 3], [2, 5]); line([0, 5], [2, 3]); line([7, 3], [9, 5]); line([7, 5], [9, 3]);
    g.lineWidth = 8; g.strokeRect(ox - 10, oy - 10, 8 * st + 20, 9 * st + 20);
    g.fillStyle = '#3a1a0a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${(st * 0.55) | 0}px "Noto Serif CJK SC","Songti SC","SimSun",serif`;
    const [, ry] = P(4.5, 0);
    g.fillText('楚 河', ox + 2 * st, ry); g.fillText('漢 界', ox + 6 * st, ry);
  }), { roughness: 0.5 });
  return TOP + 0.036;
}
const SL_S = 0.074;
function slCell(n) { // squares 1-100 in rows of ten, turning at each end; 0 is the start, off the near-left corner
  if (n === 0) return { x: -5.2 * SL_S, z: 5.0 * SL_S };
  const r = ((n - 1) / 10) | 0, k = (n - 1) % 10, c = r % 2 ? 9 - k : k;
  return { x: (c - 4.5) * SL_S, z: (4.5 - r) * SL_S };
}
function buildSnakesBoard(group) {
  const W = 10 * SL_S + 0.06;
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(W, 0.012, W), new THREE.MeshStandardMaterial({ color: 0x7a2a1c, roughness: 0.85 }));
  cloth.position.y = TOP + 0.006; group.add(cloth);
  const G = window.LibrariumRules.snakes, px = 1024, sc = px / W, o = px / 2 - 5 * SL_S * sc, cs = SL_S * sc;
  const P = n => { const c = slCell(n); return [px / 2 + c.x * sc, px / 2 + c.z * sc]; };
  topPlane(group, W, W, TOP + 0.0125, tex(px, px, (g) => {
    g.fillStyle = '#7a2a1c'; g.fillRect(0, 0, px, px);
    const tones = ['#f1dfae', '#e8c98a', '#f3d9a0', '#e2bd7c'];
    for (let n = 1; n <= 100; n++) {
      const [x, y] = P(n);
      g.fillStyle = n === 100 ? '#f7efd8' : tones[(n * 7) % 4]; g.fillRect(x - cs / 2, y - cs / 2, cs, cs);
      g.strokeStyle = 'rgba(90,40,20,.6)'; g.lineWidth = 1.5; g.strokeRect(x - cs / 2, y - cs / 2, cs, cs);
      g.fillStyle = '#5a2a14'; g.font = `600 ${(cs * 0.22) | 0}px "Montserrat",sans-serif`; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(String(n), x - cs / 2 + 4, y - cs / 2 + 3);
      const label = (G.LADDERS[n] || G.SNAKES[n] || [])[1];
      if (label) { g.font = `${(cs * 0.16) | 0}px "Amethysta",serif`; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillStyle = G.LADDERS[n] ? '#2a5a2a' : '#7a1a1a'; g.fillText(label, x, y + cs / 2 - 3, cs - 6); }
      if (n === 100) { g.font = `${(cs * 0.17) | 0}px "Amethysta",serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#7a4a10'; g.fillText('Liberation', x, y + 6, cs - 6); }
    }
    // Ladders: two rails and rungs. Snakes: a curving body with a head.
    for (const [a, [b]] of Object.entries(G.LADDERS)) {
      const [x1, y1] = P(+a), [x2, y2] = P(b), dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L * 11, ny = dx / L * 11;
      g.strokeStyle = '#6a4220'; g.lineWidth = 5;
      for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(x1 + nx * sgn, y1 + ny * sgn); g.lineTo(x2 + nx * sgn, y2 + ny * sgn); g.stroke(); }
      g.lineWidth = 4; for (let t = 0.08; t < 1; t += 22 / L) { g.beginPath(); g.moveTo(x1 + dx * t - nx, y1 + dy * t - ny); g.lineTo(x1 + dx * t + nx, y1 + dy * t + ny); g.stroke(); }
    }
    for (const [a, [b]] of Object.entries(G.SNAKES)) {
      const [x1, y1] = P(+a), [x2, y2] = P(b), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
      const c1 = [mx - dy * 0.25 + dx * -0.15, my + dx * 0.25 + dy * -0.15], c2 = [mx + dy * 0.25 + dx * 0.15, my - dx * 0.25 + dy * 0.15];
      g.lineCap = 'round';
      for (const [w, col] of [[16, '#1e3a1a'], [11, '#4a8a3a']]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], x2, y2); g.stroke(); }
      g.fillStyle = '#1e3a1a'; g.beginPath(); g.ellipse(x1, y1, 13, 10, Math.atan2(dy, dx), 0, TAU); g.fill();
      g.fillStyle = '#e8d070'; g.beginPath(); g.arc(x1 - 3, y1 - 3, 2.5, 0, TAU); g.fill();
    }
  }), { roughness: 0.85 });
  // A die on the cloth beside the board.
  const d = cubeDie(0.03, '#efe6d2', '#2a1a10'); d.position.set(W / 2 + 0.08, TOP + 0.015, -0.1); d.rotation.y = 0.4; group.add(d);
  return TOP + 0.013;
}

/* --- Wing VI: Games of the World */
const W6_CJK = '"Noto Serif CJK JP","Noto Serif CJK SC","Hiragino Mincho ProN","Yu Mincho","SimSun",serif';
function stoneMesh(color, r, flat, rough) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), new THREE.MeshStandardMaterial({ color, roughness: rough == null ? 0.5 : rough }));
  m.scale.y = flat; m.userData.mats = [m.material]; return m;
}
const MT_R = 0.3;
function mtPos(i) { if (i === 8) return { x: 0, z: 0 }; const a = Math.PI + (i + 0.5) * Math.PI / 4; return { x: MT_R * Math.cos(a), z: -MT_R * Math.sin(a) }; }
function buildMuTorere(group) {
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.44, 0.035, 48), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.6 }));
  disc.position.y = TOP + 0.0175; group.add(disc);
  const px = 1024, W = 0.86, sc = px / W, c = px / 2;
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.43, 48), new THREE.MeshStandardMaterial({ roughness: 0.6, map: tex(px, px, (g) => {
    woodGrain(g, px, px, '#a9763e', '#5a3a20');
    // The star: eight arms (kewai) from the centre (pūtahi), like an octopus.
    g.fillStyle = 'rgba(40,22,10,.82)';
    for (let i = 0; i < 8; i++) {
      const p = mtPos(i), x = c + p.x * sc, y = c + p.z * sc, a = Math.atan2(y - c, x - c);
      g.beginPath(); g.moveTo(c + Math.cos(a - 0.32) * 46, c + Math.sin(a - 0.32) * 46);
      g.quadraticCurveTo(c + Math.cos(a - 0.12) * 220, c + Math.sin(a - 0.12) * 220, x + Math.cos(a - 1.4) * 40, y + Math.sin(a - 1.4) * 40);
      g.arc(x, y, 40, a - 1.4, a + 1.4);
      g.quadraticCurveTo(c + Math.cos(a + 0.12) * 220, c + Math.sin(a + 0.12) * 220, c + Math.cos(a + 0.32) * 46, c + Math.sin(a + 0.32) * 46);
      g.closePath(); g.fill();
    }
    g.beginPath(); g.arc(c, c, 58, 0, TAU); g.fill();
    g.strokeStyle = '#e8c890'; g.lineWidth = 4;
    for (let i = 0; i <= 8; i++) { const p = mtPos(i); g.beginPath(); g.arc(c + p.x * sc, c + p.z * sc, i === 8 ? 44 : 30, 0, TAU); g.stroke(); }
  }) }));
  top.rotation.x = -Math.PI / 2; top.position.y = TOP + 0.0355; group.add(top);
  return TOP + 0.036;
}
const KN_S = 0.084;
function knCell(i) { const r = (i / 8) | 0, c = i % 8; return { x: (c - 3.5) * KN_S, z: (3.5 - r) * KN_S }; }
function buildKonane(group) {
  // A papamū: a flat stone with rows of small hollows.
  const W = 8 * KN_S + 0.08;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, W), new THREE.MeshStandardMaterial({ color: 0x5c5650, roughness: 0.95 }));
  slab.position.y = TOP + 0.03; group.add(slab);
  const px = 1024, sc = px / W;
  topPlane(group, W, W, TOP + 0.0605, tex(px, px, (g) => {
    g.fillStyle = '#6a645c'; g.fillRect(0, 0, px, px);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${rand(20, 60) | 0},${rand(20, 55) | 0},${rand(20, 50) | 0},${rand(0.05, 0.25)})`; g.fillRect(rand(0, px), rand(0, px), rand(1, 5), rand(1, 5)); }
    for (let i = 0; i < 64; i++) {
      const p = knCell(i), x = px / 2 + p.x * sc, y = px / 2 + p.z * sc;
      const gr = g.createRadialGradient(x - 4, y - 4, 2, x, y, 26); gr.addColorStop(0, '#2a2622'); gr.addColorStop(1, '#58524b');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 24, 0, TAU); g.fill();
    }
  }), { roughness: 0.95 });
  return TOP + 0.061;
}
const FN_S = 0.098;
function fnCell(i) { const r = (i / 9) | 0, c = i % 9; return { x: (c - 4) * FN_S, z: (2 - r) * FN_S }; }
function buildFanorona(group) {
  const W = 8 * FN_S + 0.12, D = 4 * FN_S + 0.12;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, D), new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.55 }));
  board.position.y = TOP + 0.02; group.add(board);
  const pw = 1024, ph = Math.round(pw * D / W), sc = pw / W;
  topPlane(group, W, D, TOP + 0.0405, tex(pw, ph, (g) => {
    woodGrain(g, pw, ph, '#c08a50', '#7a4a24');
    const P = (r, c) => { const p = fnCell(r * 9 + c); return [pw / 2 + p.x * sc, ph / 2 + p.z * sc]; };
    const line = (a, b) => { g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...b)); g.stroke(); };
    g.strokeStyle = '#2a170b'; g.lineWidth = 4; g.lineCap = 'round';
    for (let r = 0; r < 5; r++) line([r, 0], [r, 8]);
    for (let c = 0; c < 9; c++) line([0, c], [4, c]);
    // Diagonals through the strong points.
    for (let k = -8; k <= 8; k += 2) {
      const a = [], b = [];
      for (let r = 0; r < 5; r++) { const c1 = r + k, c2 = k - r + 4; if (c1 >= 0 && c1 < 9) a.push([r, c1]); if (c2 >= 0 && c2 < 9) b.push([r, c2]); }
      if (a.length > 1) line(a[0], a[a.length - 1]); if (b.length > 1) line(b[0], b[b.length - 1]);
    }
  }), { roughness: 0.55 });
  return TOP + 0.041;
}
const SHOGI_S = 0.072;
// Pentagonal pieces, all one colour: the way a piece points shows whose it is.
const shogiShape = new THREE.Shape(); shogiShape.moveTo(-0.022, -0.026); shogiShape.lineTo(0.022, -0.026); shogiShape.lineTo(0.026, 0.012); shogiShape.lineTo(0, 0.028); shogiShape.lineTo(-0.026, 0.012); shogiShape.closePath();
const shogiGeo = new THREE.ExtrudeGeometry(shogiShape, { depth: 0.01, bevelEnabled: false });
const shogiLabelGeo = new THREE.PlaneGeometry(0.03, 0.03);
const shogiKanji = {};
function shogiFace(ch, red) {
  const key = ch + (red ? 'r' : '');
  return shogiKanji[key] || (shogiKanji[key] = tex(64, 64, (g) => { g.fillStyle = '#ead2a0'; g.fillRect(0, 0, 64, 64); g.fillStyle = red ? '#b0201a' : '#1a1008'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `600 40px ${W6_CJK}`; g.fillText(ch, 32, 34); }));
}
function shogiPiece(ch, far, red) {
  const wood = new THREE.MeshStandardMaterial({ color: 0xead2a0, roughness: 0.5 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(shogiGeo, wood); body.rotation.x = -Math.PI / 2; g.add(body);
  const label = new THREE.Mesh(shogiLabelGeo, new THREE.MeshStandardMaterial({ map: shogiFace(ch, red), roughness: 0.5 }));
  label.rotation.x = -Math.PI / 2; label.position.set(0, 0.0105, -0.002); g.add(label);
  g.rotation.y = far ? Math.PI : 0; g.userData.mats = [wood, label.material]; g.userData.label = label;
  return g;
}
function buildShogi(group) {
  const S = SHOGI_S, W = 9 * S + 0.05;
  const block = new THREE.Mesh(new THREE.BoxGeometry(W, 0.11, W + 0.04), new THREE.MeshStandardMaterial({ color: 0xc9a060, roughness: 0.5 }));
  block.position.y = TOP + 0.055; group.add(block);
  const px = 1024, sc = px / W;
  topPlane(group, W, W + 0.04, TOP + 0.1105, tex(px, Math.round(px * (W + 0.04) / W), (g, w, h) => {
    woodGrain(g, w, h, '#e0bc7a', '#b08848');
    g.strokeStyle = '#2a1a0a'; g.lineWidth = 3;
    const o = (w - 9 * S * sc) / 2, oy = (h - 9 * S * sc) / 2;
    for (let i = 0; i <= 9; i++) { g.beginPath(); g.moveTo(o + i * S * sc, oy); g.lineTo(o + i * S * sc, oy + 9 * S * sc); g.stroke(); g.beginPath(); g.moveTo(o, oy + i * S * sc); g.lineTo(o + 9 * S * sc, oy + i * S * sc); g.stroke(); }
    g.fillStyle = '#2a1a0a'; for (const [a, b] of [[3, 3], [3, 6], [6, 3], [6, 6]]) { g.beginPath(); g.arc(o + a * S * sc, oy + b * S * sc, 6, 0, TAU); g.fill(); }
  }), { roughness: 0.5 });
  const back = ['香', '桂', '銀', '金', '王', '金', '銀', '桂', '香'], display = [];
  const put = (ch, r, c, far) => { const p = shogiPiece(ch, far); p.position.set((c - 4) * SHOGI_S, TOP + 0.111, (r - 4) * SHOGI_S); group.add(p); display.push(p); };
  back.forEach((ch, c) => { put(ch, 4 + 4, c, false); put(ch === '王' ? '玉' : ch, 0, c, true); });
  put('角', 7, 1, false); put('飛', 7, 7, false); put('飛', 1, 1, true); put('角', 1, 7, true);
  for (let c = 0; c < 9; c++) { put('歩', 6, c, false); put('歩', 2, c, true); }
  group.userData.display = display; // put away while a game is played
  return TOP + 0.111;
}
function buildYut(group) {
  // A cloth board of 29 stations: twenty round the square, nine on the two diagonals.
  const W = 0.62, px = 1024, sc = px / W;
  topPlane(group, W + 0.08, W + 0.08, TOP + 0.003, tex(px, px, (g) => {
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, px, px);
    g.strokeStyle = '#7a2a1c'; g.lineWidth = 10; g.strokeRect(14, 14, px - 28, px - 28);
    const h = W / 2 * sc * 0.86, c = px / 2, P = [];
    for (let k = 0; k < 20; k++) { const side = (k / 5) | 0, t = (k % 5) / 5; const pts = [[h, h], [h, -h], [-h, -h], [-h, h], [h, h]]; const [a, b] = [pts[side], pts[side + 1]]; P.push([c + a[0] + (b[0] - a[0]) * t, c + a[1] + (b[1] - a[1]) * t]); }
    for (const t of [1 / 3, 2 / 3]) for (const [x, y] of [[h, h], [h, -h], [-h, -h], [-h, h]]) P.push([c + x * (1 - t), c + y * (1 - t)]);
    P.push([c, c]);
    g.strokeStyle = 'rgba(90,40,20,.6)'; g.lineWidth = 4;
    g.strokeRect(c - h, c - h, 2 * h, 2 * h);
    g.beginPath(); g.moveTo(c - h, c - h); g.lineTo(c + h, c + h); g.moveTo(c + h, c - h); g.lineTo(c - h, c + h); g.stroke();
    P.forEach(([x, y], k) => { const big = k % 5 === 0 || k === P.length - 1; g.fillStyle = big ? '#7a2a1c' : '#2a3a5a'; g.beginPath(); g.arc(x, y, big ? 26 : 18, 0, TAU); g.fill(); });
  }), { roughness: 0.9 });
  // Four sticks, flat on one side and round on the other.
  const stick = new THREE.CylinderGeometry(0.014, 0.014, 0.16, 14, 1, false, 0, Math.PI);
  const sm = new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 0.6, side: THREE.DoubleSide });
  const R = seeded(57), display = [];
  for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(stick, sm); display.push(st); st.rotation.set(-Math.PI / 2, 0, R() < 0.5 ? 0 : Math.PI); st.rotation.order = 'XZY'; st.rotation.y = (R() - 0.5) * 0.6; st.position.set(0.42 + (R() - 0.5) * 0.06, TOP + 0.01, -0.15 + k * 0.08); group.add(st); }
  // Four pieces each, two of them riding stacked.
  const mats = [new THREE.MeshStandardMaterial({ color: 0xa8322a, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0x2a3a6a, roughness: 0.4 })];
  const pg = new THREE.CylinderGeometry(0.018, 0.02, 0.022, 16);
  [[0, -0.27, 0.27], [0, -0.27, 0.27, 1], [0, 0.0, 0.0], [1, 0.27, -0.27], [1, -0.27, -0.09], [1, -0.4, 0.4]].forEach(([pl, x, z, up]) => { const m = new THREE.Mesh(pg, mats[pl]); m.position.set(x, TOP + 0.014 + (up ? 0.023 : 0), z); group.add(m); display.push(m); });
  group.userData.display = display;
  return TOP + 0.004;
}
// Where each of the 29 stations sits on the cloth (see the drawing above).
const YT_H = 0.301;
function ytPos(st) {
  const C = { x: 0, z: 0 }, corner = k => [{ x: YT_H, z: YT_H }, { x: YT_H, z: -YT_H }, { x: -YT_H, z: -YT_H }, { x: -YT_H, z: YT_H }][k];
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  if (st < 20) { const side = (st / 5) | 0, t = (st % 5) / 5; return lerp(corner(side), corner((side + 1) % 4), t); }
  if (st === 22) return C;
  if (st === 20 || st === 21) return lerp(corner(1), C, (st - 19) / 3);
  if (st === 23 || st === 24) return lerp(C, corner(3), (st - 22) / 3);
  if (st === 25 || st === 26) return lerp(corner(2), C, (st - 24) / 3);
  return lerp(C, corner(0), (st - 26) / 3); // 27, 28
}
const BAO_DX = 0.098;
function baoPos(pit) { // pit = player*16 + L, as in the rules
  const pl = pit >> 4, inner = (pit & 15) >= 8, c = window.LibrariumRules.bao.col(pit);
  const r = pl === 0 ? (inner ? 2 : 3) : (inner ? 1 : 0);
  return { x: (c - 3.5) * BAO_DX, z: (r - 1.5) * BAO_DX };
}
function buildBao(group) {
  const W = 0.86, D = 0.46;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.07, D), new THREE.MeshStandardMaterial({ color: 0x6a3e1c, roughness: 0.55 }));
  board.position.y = TOP + 0.035; group.add(board);
  const pw = 1024, ph = Math.round(pw * D / W), sc = pw / W;
  const pit = (x, z) => [pw / 2 + x * sc, ph / 2 + z * sc];
  const PX = c => (c - 3.5) * BAO_DX, PZ = r => (r - 1.5) * BAO_DX;
  topPlane(group, W, D, TOP + 0.0705, tex(pw, ph, (g) => {
    woodGrain(g, pw, ph, '#9a6430', '#5a3416');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
      const [x, y] = pit(PX(c), PZ(r)), house = (r === 1 && c === 4) || (r === 2 && c === 3);
      const gr = g.createRadialGradient(x, y, 4, x, y, 40); gr.addColorStop(0, '#2a1608'); gr.addColorStop(1, '#5a3416');
      g.fillStyle = gr;
      if (house) { g.fillRect(x - 38, y - 38, 76, 76); } else { g.beginPath(); g.arc(x, y, 38, 0, TAU); g.fill(); }
    }
    g.strokeStyle = 'rgba(30,15,5,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(16, ph / 2); g.lineTo(pw - 16, ph / 2); g.stroke();
  }), { roughness: 0.55 });
  // Click targets for play: a thin dark disc in each pit, which glows when it can be sown.
  const y = TOP + 0.0712, pits = [], discGeo = new THREE.CylinderGeometry(0.031, 0.031, 0.002, 24);
  for (let k = 0; k < 32; k++) {
    const p = baoPos(k), mat = new THREE.MeshStandardMaterial({ color: 0x2a1608, roughness: 0.9, transparent: true, opacity: 0.55 });
    const disc = new THREE.Mesh(discGeo, mat); disc.position.set(p.x, y, p.z); disc.userData.mats = [mat]; group.add(disc); pits.push(disc);
  }
  group.userData.pits = pits;
  // Seeds on display: a few in most pits, a heap in each house. Put away while a game is played.
  const before = group.children.length;
  const seed = new THREE.SphereGeometry(0.009, 8, 6), sm = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.4 });
  const Rn = seeded(1820);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    const house = (r === 1 && c === 4) || (r === 2 && c === 3), n = house ? 9 : (Rn() * 4) | 0;
    for (let k = 0; k < n; k++) { const s = new THREE.Mesh(seed, sm); s.position.set(PX(c) + (Rn() - 0.5) * 0.04, TOP + 0.064 + (k > 4 ? 0.012 : 0), PZ(r) + (Rn() - 0.5) * 0.04); group.add(s); }
  }
  group.userData.display = group.children.slice(before);
  return y + 0.001;
}

/* --- Finale lectern */
let lectern;
function buildLectern(z) {
  const g = new THREE.Group(); g.position.set(0, 0, z);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.0, 0.22), MAT.wood); post.position.y = 0.5; g.add(post);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.5), MAT.wood); foot.position.y = 0.03; g.add(foot);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.56), MAT.woodDark); top.position.y = 1.08; top.rotation.x = 0.35; g.add(top);
  const pageT = tex(512, 340, (c, w, h) => {
    c.fillStyle = '#efe2c4'; c.fillRect(0, 0, w, h); speckle(c, w, h, 900, ['#c9b68e', '#fff8e6'], 1.3);
    c.fillStyle = '#e6d6b2'; c.fillRect(w / 2 - 6, 0, 12, h);
    c.fillStyle = '#7a4a10'; c.textAlign = 'center';
    c.font = '40px "Almendra SC", serif'; c.fillText('Librarium', w / 4, 70);
    c.fillStyle = '#3b2a18'; c.font = '20px "Amethysta", serif';
    ['Different fables', 'for different tables'].forEach((t, i) => c.fillText(t, w / 4, 110 + i * 26));
    c.font = '28px "Almendra SC", serif'; c.fillStyle = '#7a4a10';
    ['Calendra', 'Phoenix Farm', 'Royal Threadcount', 'The Great Chase'].forEach((t, i) => c.fillText(t, w * 0.75, 80 + i * 56));
  });
  const page = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.03, 0.44), [MAT.woodDark, MAT.woodDark, new THREE.MeshLambertMaterial({ map: pageT }), MAT.woodDark, MAT.woodDark, MAT.woodDark]);
  page.position.y = 1.115; page.rotation.x = 0.35; g.add(page);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1, 1.4, 0.8), MAT.hit); hit.position.y = 0.7; g.add(hit); g.userData.hit = hit;
  const sh = contactShadow(1.5, 1.2); sh.position.y = 0.004; g.add(sh);
  scene.add(g); lectern = g;
  spotSources.push({ pos: new THREE.Vector3(0, 1.1, z), lightPos: new THREE.Vector3(0, 3.6, z + 0.9) });
}

/* ---------------------------------------------------------- exhibit data */
const STOPS = [
  { id: 'hall', wing: 1, title: 'The Dawn of Play', short: 'Welcome', date: 'Wing I', rail: 'Entrance',
    eyebrow: 'Wing I · Librarium Archives', status: null, begin: 'senet',
    body: [
      'Long before anyone wrote rules down, people were already sitting across a board from each other, moving pieces and trusting their luck. This wing gathers the oldest board games we know of, from the Nile valley to the city of Ur.',
      'Two of them are ready to play. Walk up to a plinth, read its story, and take a seat at the table. The rules of the others are lost, so we show them as they were found. Beyond the arch, Wing II turns from luck to strategy.'
    ],
    facts: [['Look', 'Drag the view'], ['Walk', 'WASD or arrow keys'], ['Visit', 'Click an exhibit or use the timeline']],
  },
  { id: 'senet', wing: 1, title: 'Senet', date: 'c. 3100 BCE', rail: 'Senet',
    eyebrow: 'Egypt · Early Dynastic period', status: ['recon', 'Rules reconstructed'], game: 'senet',
    body: [
      'Pieces of what may be Senet boards turn up in First Dynasty burials around 3100 BCE, and the first unmistakable painting of the game appears in the tomb of Hesy-Re, about 2620 BCE. It is one of the oldest board games we know by name.',
      'The board has 30 squares, called houses, in three rows of ten. Players threw four flat sticks instead of dice. Over the centuries the game took on religious meaning: its name means "passing", and by the New Kingdom a match stood for the soul\'s journey through the underworld. Tutankhamun was buried with several sets.',
      'No rulebook survives. We play a popular modern reconstruction that follows Timothy Kendall\'s 1979 work.'
    ],
    facts: [['Board', '30 houses, 3 rows of 10'], ['Pieces', '5 each, spools and cones'], ['Moves', '4 throw sticks, 1 to 5'], ['Goal', 'Bear every piece off the board']],
    build: buildSenetBoard },
  { id: 'mehen', wing: 1, title: 'Mehen', date: 'c. 3100–2300 BCE', rail: 'Mehen',
    eyebrow: 'Egypt · Early Dynastic to Old Kingdom', status: ['lost', 'Rules lost'],
    body: [
      'The Mehen board is a snake coiled around itself, with its head at the center and its tail at the rim. It shares its name with a serpent god who wrapped around the sun god Ra to protect him on his night journey.',
      'Up to six players moved small lion figures and marbles along the coils. The game faded after the Old Kingdom, and no text explains how it worked. Scholars have suggested the lions raced toward the snake\'s head, but every version played today is a guess.'
    ],
    facts: [['Board', 'Coiled serpent, segmented'], ['Pieces', 'Lions and marbles'], ['Players', 'Up to six'], ['Rules', 'Unknown']],
    build: buildMehen },
  { id: 'basur', wing: 1, title: 'The Başur Höyük Pieces', short: 'Başur Höyük Pieces', date: 'c. 3000 BCE', rail: 'Başur Höyük',
    eyebrow: 'Southeast Turkey · Early Bronze Age', status: ['lost', 'Game unknown'],
    note: 'On display. No board survives to play on.',
    body: [
      'In 2013, archaeologists excavating a Bronze Age burial mound at Başur Höyük found a set of small carved and painted stones: pyramids, round tokens and little animal figures. At around 5,000 years old, they are often called the oldest gaming pieces yet found.',
      'Nobody knows the game they belonged to. Their different shapes and colors may have marked opposing sides or kept score. They are a reminder that the oldest boards we know are only the ones that happened to survive.'
    ],
    facts: [['Found', '2013, in a burial mound'], ['Pieces', 'Pyramids, tokens, animals'], ['Board', 'None survives']],
    build: buildTokens },
  { id: 'ur', wing: 1, title: 'The Royal Game of Ur', short: 'Royal Game of Ur', date: 'c. 2600–2400 BCE', rail: 'Royal Game of Ur',
    eyebrow: 'Mesopotamia · Sumer', status: ['known', 'Rules survive in writing'], game: 'ur',
    body: [
      'Sir Leonard Woolley found five of these boards while excavating the Royal Cemetery at Ur between 1922 and 1934. The finest are inlaid with shell, red limestone and lapis lazuli. The game, also called Twenty Squares, spread across the ancient Near East, and more than a hundred boards have been found since.',
      'It is the oldest board game whose rules survive in writing. A Babylonian scribe, Itti-Marduk-balāṭu, copied them onto a clay tablet around 177 BCE, and British Museum curator Irving Finkel translated it in the early 1980s. The game outlived its empires: Jewish families in Kochi, India, played a descendant until the 1950s.',
      'We play Finkel\'s widely used reconstruction.'
    ],
    facts: [['Board', '20 squares, 5 rosettes'], ['Pieces', '7 each'], ['Moves', '4 four-sided dice, 0 to 4'], ['Goal', 'Race every piece home']],
    build: buildUrBoard },
  { id: 'dice', wing: 1, title: 'The First Dice', short: 'The First Dice', date: 'c. 2800–1900 BCE', rail: 'The First Dice',
    eyebrow: 'Iran and the Indus Valley', status: ['known', 'Still rolled today'],
    note: 'On display. The dice are new, made in the old manner.',
    body: [
      'Cubic dice are nearly as old as board games. Possibly the oldest yet found come from the Burnt City, Shahr-e Sukhteh in eastern Iran, buried with a set for a race game that has been dated to between 2800 and 2500 BCE.',
      'Graves at Mohenjo-daro in the Indus Valley held terracotta dice from 2500 to 1900 BCE. On one of them the opposite faces add up to seven, as they do on dice today. Players elsewhere threw other things: Senet\'s sticks and Ur\'s four-sided pyramids are on the tables in this wing.'
    ],
    facts: [['Oldest', 'Burnt City, Iran, c. 2800–2500 BCE'], ['Indus', 'Mohenjo-daro, 2500–1900 BCE'], ['Faces', 'Opposites adding to seven, on one Indus die']],
    build: buildDice },
  { id: 'hounds', wing: 1, title: 'Hounds and Jackals', date: 'c. 2000 BCE', rail: 'Hounds and Jackals',
    eyebrow: 'Egypt · Middle Kingdom', status: ['lost', 'Rules lost'],
    body: [
      'Howard Carter, later famous for Tutankhamun\'s tomb, found a complete set of this game in a Theban tomb in 1910. It is now at the Metropolitan Museum of Art in New York. Ten slender pins fit its holes: five topped with hound heads and five with jackals.',
      'The board has 58 holes in two tracks, which is why archaeologists also call it 58 Holes. Boards like it turn up from Egypt to Mesopotamia, Anatolia and the Levant. The larger hole near the top looks like the finish, but the rest of the rules are lost.'
    ],
    facts: [['Board', '58 holes, palm tree inlay'], ['Pieces', '5 hounds, 5 jackals'], ['Spread', 'Egypt to Anatolia'], ['Rules', 'Unknown']],
    build: buildHounds },

  { id: 'wing2', wing: 2, title: 'Strategy Takes the Table', short: 'Wing II', date: 'c. 500 BCE – 1000 CE', rail: 'Wing II',
    eyebrow: 'Wing II · Librarium Archives', status: null, begin: 'go',
    body: [
      'The games in the first wing were races, and the dice or sticks had the final word. Here the luck drains away. These are games of position, where you win by surrounding, trapping or outthinking the person across from you.',
      'Five tables are open: Go on a small board, Nine Men\'s Morris, the mancala game Oware, Alquerque, and the Irish game Brandubh. Petteia, Liubo and Patolli are on display. The Scribe is waiting at each of them, and it plays these games much more carefully than it rolls dice.'
    ],
    facts: [['Tables', 'Go, Morris, Oware, Alquerque, Brandubh'], ['Luck', 'None. Every move is a choice']],
  },
  { id: 'petteia', wing: 2, title: 'Petteia', date: 'by 443 BCE', rail: 'Petteia',
    eyebrow: 'Classical Greece', status: ['recon', 'Rules mostly lost'],
    note: 'On display. The 8 × 8 slab is our guess: no petteia board has been securely identified.',
    body: [
      'Petteia, "pebbles", was the board game of classical Greece. The comic poet Cratinus mentions it in 443 or 442 BCE, and Plato and Aristotle both use it to make a point. The board, Julius Pollux wrote much later, was called the polis, the city, and the pieces were called dogs.',
      'Each player had pieces of one colour, and a piece was captured by enclosing it between two enemies, so the art was never to leave a piece alone. Beyond that, the size of the board, the opening position and most of the rules are lost. The Roman game of soldiers, further down this wing, may descend from it.'
    ],
    facts: [['Board', 'The polis, or city'], ['Capture', 'Enclose a piece between two'], ['Rules', 'Mostly lost']],
    build: buildPetteia },
  { id: 'liubo', wing: 2, title: 'Liubo', date: 'by the 4th century BCE', rail: 'Liubo',
    eyebrow: 'China · Warring States to Han', status: ['lost', 'Rules lost'],
    note: 'On display. The board, pieces and sticks are new, after the Mawangdui set.',
    body: [
      'Liubo, "six sticks", was the great board game of Han dynasty China, played by emperors and buried with nobles. The oldest boards come from a 4th-century BCE tomb at Pingshan in Hebei, and a complete set in a lacquer box was found in 1973 in a 2nd-century BCE tomb at Mawangdui.',
      'Each player had six pieces, moved by throws of six sticks, and a piece that reached a certain place was stood on end and became an "owl". The board\'s T, L and V marks also appear on bronze mirrors of the time. After the Han the game faded, perhaps losing out to weiqi, and by the 14th century no one knew how to play it. More than a thousand bamboo slips with its rules were found in the tomb of the Marquis of Haihun in 2019; until they are fully read, every modern version is a reconstruction.'
    ],
    facts: [['Pieces', 'Six a side'], ['Moves', 'Six throwing sticks'], ['Rules', 'Lost; reconstructions only']],
    build: buildLiubo },
  { id: 'go', wing: 2, title: 'Weiqi (Go)', date: 'by the 4th century BCE', rail: 'Weiqi (Go)',
    eyebrow: 'China · Zhou dynasty to Han', status: ['known', 'Still played today'],
    game: 'go',
    body: [
      'Weiqi, known in the West by its Japanese name Go, is the oldest board game still played in much the same form. The Zuo Zhuan, a history compiled around the 4th century BCE, mentions it in a story set in 548 BCE, and both Confucius\'s Analects and the book of Mencius refer to it. Legend credits the sage-emperor Yao with inventing it to teach his son discipline.',
      'The oldest complete board, carved in stone during the Eastern Han dynasty (25–220 CE) and found in Hebei province in 1954, has a 17 × 17 grid like this one. The 19 × 19 board was standard by the Tang dynasty. Go reached Korea and Japan by the 7th century, and it became one of the four arts expected of a cultivated scholar, alongside calligraphy, painting and the zither-like guqin.',
      'At this table you play on the 9 × 9 board used today for quick games and teaching, with modern Chinese scoring. The Scribe plays Go differently from the other games: before each move it plays thousands of quick random games from the position and picks the move that wins most often.'
    ],
    facts: [['Board', '17 × 17 on display; 9 × 9 at the table'], ['Pieces', 'Black and white stones'], ['Goal', 'Surround more territory']],
    build: buildGo },
  { id: 'latrunculi', wing: 2, title: 'Ludus Latrunculorum', date: 'by the 1st century BCE', rail: 'Latrunculi',
    eyebrow: 'Rome · Late Republic to Empire', status: ['recon', 'Rules uncertain'],
    note: 'On display. Scholars still disagree about how the pieces moved.',
    body: [
      'The "game of soldiers", or of brigands, was Rome\'s war game. The scholar Varro mentions it in the 1st century BCE, Ovid alludes to it, and a 1st-century CE poem, the Laus Pisonis, praises a player commanding an army of glass pieces.',
      'Boards scratched into stone turn up wherever the legions went. Sixteen have been found at the fort of Vindolanda on Hadrian\'s Wall alone, and sizes vary from 7 × 8 to 9 × 10 squares. A piece seems to have been captured by trapping it between two enemies, but how pieces moved is still debated, and every modern version is a reconstruction.'
    ],
    facts: [['Board', '7 × 8 to 9 × 10 (8 × 8 here)'], ['Pieces', 'Glass counters'], ['Capture', 'Trap between two'], ['Rules', 'Reconstructed']],
    build: buildLatrunculi },
  { id: 'patolli', wing: 2, title: 'Patolli', date: 'by c. 300 CE', rail: 'Patolli',
    eyebrow: 'Mesoamerica', status: ['recon', 'Rules partly known'],
    note: 'On display. The mat, beans and stones are new.',
    body: [
      'Patolli was played across Mesoamerica for more than a thousand years: by the Maya from around 300 CE, and later by the Toltecs and the Aztecs. Its track of 52 houses ran in an X across a reed mat, and each player raced six markers by throwing black beans marked on one side.',
      'It was a gambler\'s game. Players staked blankets, precious stones, gold and food, and sometimes their homes or their freedom. The Dominican friar Diego Durán, writing in the 16th century, described players who carried the mat under an arm the way gamblers of his day carried cards. Moctezuma liked to watch his nobles play; the Spanish suppressed the game.'
    ],
    facts: [['Track', '52 houses in an X'], ['Moves', 'Thrown beans, marked on one side'], ['Markers', 'Six a side']],
    build: buildPatolli },
  { id: 'morris', wing: 2, title: "Nine Men's Morris", date: 'Roman era onward', rail: "Nine Men's Morris",
    eyebrow: 'The Roman world to medieval Europe', status: ['known', 'Rules survive in tradition'], game: 'morris',
    body: [
      'Boards for Nine Men\'s Morris and its smaller cousin, Three Men\'s Morris, are cut into stone across the Roman world. Carvings at the temple of Kurna in Egypt are often dated to about 1400 BCE, but boards scratched into old buildings are notoriously hard to date and may be far younger.',
      'Under names like merels, mill and Mühle, the game became a European favorite. Alfonso X of Castile pictured it in his Book of Games in the 1280s, monks carved boards into the cloister benches of English cathedrals, villagers cut them into the turf of village greens, and Shakespeare mentions a flooded morris board in A Midsummer Night\'s Dream.'
    ],
    facts: [['Board', '24 points on three squares'], ['Pieces', '9 each'], ['Mill', 'Three in a row takes a piece'], ['Win', 'Leave the Scribe two pieces or no moves']],
    build: buildMorrisBoard },
  { id: 'oware', wing: 2, title: 'Mancala (Oware)', date: 'c. 6th–7th century CE', rail: 'Oware',
    eyebrow: 'Africa · Aksum to the Akan', status: ['known', 'Rules survive in tradition'], game: 'oware',
    body: [
      'Mancala is a family of hundreds of games played by sowing seeds around rows of pits. The oldest securely dated evidence comes from the Kingdom of Aksum, in today\'s Ethiopia and Eritrea, where rows of pits were cut into rock and shaped in pottery in the 6th and 7th centuries CE. Hollows in far older stone slabs in Jordan may be boards too, but that is debated.',
      'The name comes from the Arabic naqala, "to move". Traders carried the game across the Islamic world and the Indian Ocean, and enslaved West Africans carried it to the Caribbean and the Americas. Our table plays Oware, the game of the Akan peoples of Ghana and Côte d\'Ivoire, with two rows of six pits and 48 seeds.'
    ],
    facts: [['Board', '2 rows of 6 pits'], ['Pieces', '48 seeds'], ['Capture', 'Make 2 or 3 in a Scribe pit'], ['Win', 'Capture 25 seeds']],
    build: buildOwareBoard },
  { id: 'alquerque', wing: 2, title: 'Alquerque', date: 'by the 10th century CE', rail: 'Alquerque',
    eyebrow: 'The Islamic world and Spain', status: ['recon', 'Rules reconstructed'], game: 'alquerque',
    body: [
      'Alquerque, from the Arabic al-qirkat, is first named late in the 10th century, in Abu al-Faraj al-Isfahani\'s Book of Songs, which does not bother to give the rules: everyone knew them. The game crossed into Spain, and in 1283 Alfonso X of Castile had it described in his Book of Games.',
      'Its board of lines and diagonals, with twelve pieces a side that capture by jumping, made it the parent of draughts, which moved the idea onto a chessboard, and of the Malagasy game fanorona. Alfonso\'s book leaves gaps, so the rules played here are R. C. Bell\'s widely used reconstruction.'
    ],
    facts: [['Board', '5 × 5 points, with diagonals'], ['Pieces', '12 a side'], ['Descendants', 'Draughts, fanorona']],
    build: buildAlquerque },
  { id: 'brandubh', wing: 2, title: 'Brandubh', date: 'c. 900–1000 CE', rail: 'Brandubh',
    eyebrow: 'Ireland · Early Middle Ages', status: ['recon', 'Rules reconstructed'], game: 'brandubh',
    body: [
      'Brandubh, usually translated "black raven", was the Irish member of the tafl family: Norse and Celtic games in which a king tries to escape while a larger army closes in. Irish poems describe it played with five pieces against eight, one of the five being a chief.',
      'The most famous board was found in 1932 at the Ballinderry crannog in County Westmeath, a lake dwelling lived in from the late 9th to the 11th century. It is carved from yew, has 49 peg holes and carved heads for handles, and may have been made in Viking Dublin. No rules survive. Ours follow modern reconstructions built from the poems, the 7 × 7 boards and Linnaeus\'s 1732 notes on the related Sámi game tablut.',
      'Librarium\'s own Calendra comes from the same Celtic world.'
    ],
    facts: [['Board', '7 × 7, a throne and four corners'], ['Pieces', 'King and 4 defenders vs 8'], ['You play', 'The king\'s side'], ['Win', 'Bring the king to a corner']],
    build: buildBrandubhBoard },
  { id: 'wing3', wing: 3, title: 'Kings, Cards and Courts', short: 'Wing III', date: 'c. 480 – 1450 CE', rail: 'Wing III',
    eyebrow: 'Wing III · Librarium Archives', status: null, begin: 'tables',
    body: [
      'Board games became courtly pastimes. In this wing chess travels from India through Persia to the far North, the dice games of Rome and Persia settle into tables, and paper cards arrive from the East and change how Europe plays.',
      'Six tables are open: Tables, the family of games that became backgammon; Shatranj, the chess of the caliphs\' courts; Xiangqi, the chess of China; Chaturaji, chess for four with dice; Four Seasons chess, from Alfonso X\'s Book of Games; and a game of tarocchi, the card game that tarot was made for.'
    ],
    facts: [['Tables', 'Tables, Shatranj, Xiangqi, Chaturaji, Four Seasons chess, Tarocchi'], ['Display', 'Chaturanga, Lewis chessmen, cards, tarot']],
  },
  { id: 'tables', wing: 3, title: 'Tables', short: 'Tables (Backgammon)', date: 'c. 480 CE onward', rail: 'Tables',
    eyebrow: 'Rome, Persia and medieval Europe', status: ['known', 'Rules survive in modern backgammon'], game: 'tables',
    body: [
      'Tables is the family of games that backgammon belongs to. The Byzantine poet Agathias recorded a disastrous throw by the emperor Zeno, who reigned from 474 to 491, in a game of tabula: 24 points, 15 pieces a side and three dice. It descended from the Roman game of twelve lines. In Persia a close relative, nard, appears between the 3rd and 6th centuries, and one legend credits it to a vizier of Khosrow I.',
      'Medieval Europe played tables everywhere. Louis IX banned it from his court in 1254, Alfonso X\'s Book of Games of 1283 describes several versions, and the name backgammon first appears in English in 1647. The doubling cube is a 1920s addition from New York.',
      'We play modern backgammon, without the cube.'
    ],
    facts: [['Board', '24 points in four quarters'], ['Pieces', '15 each'], ['Moves', 'Two dice, doubles count twice'], ['Goal', 'Bear all fifteen off']],
    build: buildTablesBoard },
  { id: 'chaturanga', wing: 3, title: 'Chaturanga', date: 'by c. 600 CE', rail: 'Chaturanga',
    eyebrow: 'India · Gupta period', status: ['recon', 'Rules partly lost'],
    note: 'On display. Nobody knows how the elephant moved, so we play its Persian successor, shatranj, and the four-handed chaturaji instead.',
    body: [
      'Chaturanga means "four limbs", the four arms of an ancient Indian army: elephants, chariots, cavalry and infantry. It is the oldest known ancestor of chess. The earliest clear references come from north India in the 6th century CE, and the name itself appears in Banabhatta\'s Harsha Charita, written around 625.',
      'It was played on the ashtapada, an uncheckered 8 × 8 board whose marked squares may come from an older race game. The raja, the ratha (chariot) and the ashva (horse) moved like today\'s king, rook and knight, and the mantri stepped one square diagonally. How the gaja, the elephant, moved is still uncertain.'
    ],
    facts: [['Board', '8 × 8 ashtapada'], ['Pieces', 'Raja, mantri, gaja, ashva, ratha, padati'], ['Goal', 'Checkmate, or leave the king bare']],
    build: buildChaturanga },
  { id: 'shatranj', wing: 3, title: 'Shatranj', date: 'c. 600–1200 CE', rail: 'Shatranj',
    eyebrow: 'Persia and the Islamic world', status: ['known', 'Rules survive in writing'], game: 'shatranj',
    body: [
      'Chaturanga reached Sasanian Persia as chatrang, and after the Islamic conquest it became shatranj, the chess of the caliphs\' courts. Masters such as al-Adli and as-Suli wrote about openings and endgames in the 9th and 10th centuries, ranked players into classes, and composed mansubat: chess problems built from chains of checks.',
      'The pieces were slower than ours. The firzan, ancestor of the queen, stepped a single square diagonally, and the alfil, ancestor of the bishop, hopped two. Through Muslim Spain and Sicily the game reached Europe in the 10th century, where, one explanation goes, the elephant\'s tusks were read as a bishop\'s mitre.'
    ],
    facts: [['Board', '8 × 8, unchequered'], ['Firzan', 'One square diagonally'], ['Alfil', 'Jumps two diagonally'], ['Win', 'Checkmate, stalemate or a bare king']],
    build: buildShatranjBoard },
  { id: 'xiangqi', wing: 3, title: 'Xiangqi', short: 'Xiangqi (Chinese Chess)', date: 'c. 800 CE', rail: 'Xiangqi',
    eyebrow: 'China · Tang to Song', status: ['known', 'Still played today'], game: 'xiangqi',
    body: [
      'Xiangqi, the "elephant game" or Chinese chess, is still played by millions. The earliest description of its rules is in a Tang dynasty story collection, the Xuanguai lu of Niu Sengru (779–847), and by the Southern Song dynasty (1127–1279) the game was the same as it is today.',
      'Most historians think it grew, like shatranj, from the Indian chaturanga; some Chinese historians argue that it began in China and spread west. Its pieces are discs that stand on the points, not in the squares. A river divides the board, elephants may not cross it, the general never leaves his palace, and the cannon, which leaps to capture, has no counterpart in chess.'
    ],
    facts: [['Board', '9 × 10 points, split by a river'], ['Pieces', '16 a side'], ['Win', 'Checkmate, or leave the other side no move']],
    build: buildXiangqi },
  { id: 'chaturaji', wing: 3, title: 'Chaturaji', short: 'Chaturaji (Chess for Four)', date: 'described c. 1030 CE', rail: 'Chaturaji',
    eyebrow: 'India · recorded by al-Biruni', status: ['recon', 'Partly reconstructed'], game: 'chaturaji',
    body: [
      'Chaturaji, "four kings", was chess for four players, played with dice. The scholar al-Biruni, who came to India with the armies of Mahmud of Ghazni, described it in his book on India of about 1030: four small armies in the corners of one board, a throw of the dice deciding which kind of piece may move, and stakes paid for every piece taken.',
      'The Bengali scholar Raghunandana described it again around 1500, and a version without dice was still played in parts of India in the 19th century. Hiram Cox in 1801 and Duncan Forbes in 1860 argued that it was older than two-handed chaturanga and the true ancestor of chess. Chess historians since H. J. R. Murray have rejected that idea.',
      'We play al-Biruni\'s game as Murray read it, each army for itself, with ordinary cubic dice. Accounts differ on the dice (Murray thought the first were long four-sided ones), on whether opposite players were partners, and on the rule of the throne, so the table leaves those out.'
    ],
    facts: [['Board', '8 × 8, four armies of eight'], ['Dice', '1 or 5 king or pawn · 2 boat · 3 horse · 4 or 6 elephant'], ['Scores', 'King 5, elephant 4, horse 3, boat 2, pawn 1'], ['Goal', 'Take all three kings']],
    build: buildChaturaji },
  { id: 'lewis', wing: 3, title: 'The Lewis Chessmen', short: 'Lewis Chessmen', date: 'c. 1150–1200 CE', rail: 'Lewis Chessmen',
    eyebrow: 'Norway and the Hebrides · 12th century', status: ['known', 'Chess as Europe played it'],
    note: 'On display. The figures here are our own simplified carvings, not copies.',
    body: [
      'Around 1831 a hoard of more than ninety game pieces came to light on the Isle of Lewis in the Outer Hebrides. Most are carved from walrus ivory and a few from whale teeth, probably in Trondheim, Norway, in the later 12th century. The British Museum holds 82 of them and National Museums Scotland 11.',
      'They show chess as medieval Europe played it: kings and queens on thrones, bishops in mitres, knights on ponies, and warders standing in for rooks. Four warders bite the tops of their shields like the berserkers of the Norse sagas. The hoard also held fourteen plain discs for playing tables, and a buckle, perhaps from the bag that carried them.'
    ],
    facts: [['Found', 'Isle of Lewis, about 1831'], ['Material', 'Walrus ivory, whale tooth'], ['Pieces', '79 chessmen, 14 tables discs'], ['Held', 'British Museum, National Museums Scotland']],
    build: buildLewis },
  { id: 'fourseasons', wing: 3, title: 'Four Seasons Chess', short: 'Four Seasons Chess', date: '1283 CE', rail: 'Four Seasons',
    eyebrow: 'Castile · Alfonso X\'s Book of Games', status: ['recon', 'Partly reconstructed'], game: 'fourseasons',
    body: [
      'In 1283 King Alfonso X of Castile finished his Libro de los juegos, the Book of Games: an illustrated manuscript of chess problems, dice games and table games. Among them is a chess for four players, the acedrex de los quatro tiempos, the chess of the four seasons.',
      'Each army is a season, a colour, an element and one of the four humours of the body: green for spring, air and blood; red for summer, fire and choler; black for autumn, earth and melancholy; white for winter, water and phlegm. The armies start in the four corners, and play goes round the board as the seasons turn, beginning with spring.',
      'Alfonso\'s text leaves gaps, so the table follows the reading of H. J. R. Murray and Hans Bodlaender: an alfil that leaps two squares, and a mated army that passes to the player who mated it. The book allows dice; we play without, and the diagonals drawn across the centre are only decoration.'
    ],
    facts: [['Board', '8 × 8, an army in each corner'], ['Armies', 'King, rook, knight, alfil, four pawns'], ['Seasons', 'Spring, summer, autumn, winter'], ['Goal', 'Be the last army left']],
    build: buildFourSeasons },
  { id: 'cards', wing: 3, title: 'Playing Cards', date: 'c. 900–1400 CE', rail: 'Playing Cards',
    eyebrow: 'China, Mamluk Egypt and Europe', status: ['lost', 'Earliest games lost'],
    note: 'On display. These cards are new designs in the old styles.',
    body: [
      'Cards began in China, and a later writer dated them to the Tang dynasty. The earliest certain record is from 969, when an emperor of the Liao dynasty played cards on New Year\'s Eve. They travelled west through Persia to Mamluk Egypt, where packs of four suits showed no human figures: rank was marked with ornament and inscriptions. A Mamluk pack identified in Istanbul\'s Topkapı Palace in the 1930s has suits of coins, cups, swords and sticks.',
      'Cards reached Europe around the 1370s. A Catalan rhyming dictionary names them in 1371, Florence banned a new game called naibbe in 1376, and in 1377 a Dominican friar in Basel described a pack of 52 with kings and marshals. Coins, cups, swords and batons survive today in Italian and Spanish packs.'
    ],
    facts: [['China', 'Recorded by 969 CE'], ['Egypt', 'Mamluk packs, 15th century'], ['Europe', 'From the 1370s'], ['Suits', 'Coins, cups, swords, batons']],
    build: buildCards },
  { id: 'tarot', wing: 3, title: 'Tarot (Tarocchi)', date: 'c. 1440 CE', rail: 'Tarot',
    eyebrow: 'Northern Italy · 15th century', status: ['known', 'Still played as a card game'], game: 'tarocchi',
    note: 'The trumps on the easel are new paintings in the style of the gilded Milan decks. At the table you can play a simplified game of tarocchi for two: the first rules were never written down.',
    body: [
      'Tarot began as a card game, not a way of telling fortunes. Around 1440 Italian courts added a fifth suit of picture cards, called trionfi or triumphs, that beat the ordinary suits as trumps. A Ferrara account book of 1442 records painted packs of trionfi, and the gilded decks made for the Visconti and Sforza dukes of Milan in the 1440s and 1450s are the oldest that survive.',
      'The game spread to France and Switzerland, where it is still played. Reading the cards came centuries later: Etteilla wrote about divination with tarot around 1770, Antoine Court de Gébelin claimed an ancient Egyptian origin in 1781, and the Rider-Waite deck followed in 1909.'
    ],
    facts: [['Pack', 'Four suits, 21 trumps and the Fool'], ['Played', 'Trick-taking games'], ['Fortune-telling', 'From about 1770']],
    build: buildTarot },
  { id: 'wing4', wing: 4, title: 'Printed Boards and Parlour Tables', short: 'Wing IV', date: 'c. 1300 – 1900 CE', rail: 'Wing IV',
    eyebrow: 'Wing IV · Librarium Archives', status: null, begin: 'foxgeese',
    body: [
      'Printing changed how people played. Rules were set down in books, boards were sold as printed sheets, and court games became family games at the kitchen table. This wing follows chess\'s new queen and the rise of draughts, and games that travelled from India and China into parlours around the world.',
      'Eleven tables are open: Fox and Geese, where you play the fox; modern chess, at the New Queen; Draughts; Pachisi; the Game of the Goose; Cribbage; Dominoes; Tablut; Snakes and Ladders; Ludo; and Mahjong, with three Scribes.'
    ],
    facts: [['Tables', 'Fox and Geese, Chess, Draughts, Pachisi, the Goose, Cribbage, Dominoes, Tablut, Snakes and Ladders, Ludo, Mahjong']],
  },
  { id: 'foxgeese', wing: 4, title: 'Fox and Geese', date: 'by c. 1300 CE', rail: 'Fox and Geese',
    eyebrow: 'Northern Europe · Middle Ages', status: ['known', 'Rules survive in tradition'], game: 'foxgeese',
    body: [
      'Fox and Geese is a hunt: one fox against a whole flock. Its likely ancestor is halatafl, the "tail board" game named in the Icelandic Grettis saga, which was written down in the 14th century. It is a cousin of the tafl games in Wing II.',
      'The household accounts of Edward IV of England, who reigned from 1461 to 1483, record silver-gilt pieces for the game: two foxes and 26 hounds, enough for two sets. Boards scratched into cloister benches show that monks played it too, and Queen Victoria is said to have enjoyed it.',
      'Rules varied from place to place. We play a common English form, with one house rule added so that every game ends.'
    ],
    facts: [['Board', '33 points on a cross'], ['Pieces', '1 fox, 13 geese'], ['You play', 'The fox'], ['Win', 'Thin the flock, or slip away']],
    build: buildFoxGeeseBoard },
  { id: 'newqueen', wing: 4, title: 'The New Queen', date: 'c. 1475 CE', rail: 'The New Queen',
    eyebrow: 'Valencia · late 15th century', status: ['known', 'Rules survive in writing'], game: 'chess',
    note: 'Play modern chess here, then shatranj in Wing III to feel how slow the old queen was.',
    body: [
      'For six centuries the piece beside the king was the firzan, a counsellor who stepped a single square diagonally. Then, in late 15th-century Spain, she became the strongest piece on the board, free to sweep any distance in any direction. The bishop gained its long diagonal move at the same time.',
      'The earliest record of the new rules is Scachs d\'amor, a Catalan poem written in Valencia around 1475 by Francí de Castellví, Narcís Vinyoles and Bernat Fenollar, which plays out a game of chess as a courtship. Luis de Lucena\'s book on the game, printed in Salamanca around 1497, spread the new rules further, and the faster game soon replaced the old one across Europe.',
      'On the case: the old firzan, left, and the new queen, right.'
    ],
    facts: [['Queen', 'Any distance, any direction'], ['Bishop', 'Any distance diagonally'], ['First record', 'Scachs d\'amor, c. 1475']],
    build: buildNewChess },
  { id: 'draughts', wing: 4, title: 'Draughts', date: 'c. 1100s – 1500s CE', rail: 'Draughts',
    eyebrow: 'France, Spain and England', status: ['known', 'Rules survive in tradition'], game: 'draughts',
    body: [
      'Draughts was born when someone moved the pieces of alquerque, an Arabic game played on a grid of lines, onto a chessboard. When is disputed: the historian H. J. R. Murray thought the 12th century, while David Parlett finds the first possible reference in England in 1380. Early players called it fierges or ferses, after the medieval chess queen, and later dames.',
      'Around 1535 the French made capturing compulsory, which turned a pleasant pastime into a sharp game of forced sacrifices. The first book on it was printed in Valencia in 1547, and in 1756 the London mathematician William Payne wrote the first in English. In America it is called checkers.'
    ],
    facts: [['Board', '8 × 8, dark squares only'], ['Pieces', '12 each'], ['Capture', 'Compulsory, by jumping'], ['Win', 'Take or block every enemy piece']],
    build: buildDraughtsBoard },
  { id: 'pachisi', wing: 4, title: 'Pachisi (Chaupar)', date: '16th century CE', rail: 'Pachisi',
    eyebrow: 'India · Mughal court', status: ['known', 'Still played, and the ancestor of Ludo'], game: 'pachisi',
    note: 'Pachisi is played by four in two partnerships, so here you play two colours against the Scribe\'s two. The short game takes about a hundred throws; the full game, more than twice as many.',
    body: [
      'Pachisi and its close relative chaupar are race games played on a cross of cloth with four arms of squares. Instead of dice, players throw cowrie shells and count how many land mouth up; the name comes from the Hindi for twenty-five, the highest throw.',
      'How old it is is hard to pin down. A relief in the Ellora caves, carved between the 6th and 8th centuries, is often read as a game of this kind. The most famous board is a courtyard at Fatehpur Sikri, the city the Mughal emperor Akbar built in the 1570s, laid out in red and white stone; accounts say people stood in as the pieces.',
      'British players took the game home. Simplified, with a single die and a square board, it was sold in England as Ludo from 1896, and in America as Parcheesi.'
    ],
    facts: [['Board', 'A cross of four arms'], ['Throws', 'Cowrie shells'], ['Pieces', '4 each, in four colours'], ['Descendants', 'Ludo, Parcheesi']],
    build: buildPachisi },
  { id: 'goose', wing: 4, title: 'The Game of the Goose', short: 'Game of the Goose', date: 'c. 1575 CE', rail: 'The Goose',
    eyebrow: 'Italy and Europe · 16th century', status: ['known', 'Rules survive in print'], game: 'goose',
    body: [
      'The Game of the Goose is often called the first board game made to be sold. Francesco I de\' Medici, Grand Duke of Tuscany, sent one to Philip II of Spain sometime between 1574 and 1587, and in June 1597 the London printer John Wolfe registered "the newe and most pleasant game of the goose".',
      'It is pure luck: two dice, a spiral of 63 squares, and a goose about every nine squares that sends you flying on. Printed sheets made it cheap, and from a French game of chronology in 1638 onwards, publishers borrowed its spiral to teach history and geography.'
    ],
    facts: [['Board', '63 squares in a spiral'], ['Dice', 'Two'], ['Skill', 'None at all'], ['Win', 'Land exactly on 63']],
    build: buildGooseBoard },
  { id: 'cribbage', wing: 4, title: 'Cribbage', date: '1630s CE', rail: 'Cribbage',
    eyebrow: 'England · the Stuart court', status: ['known', 'Still played'], game: 'cribbage',
    body: [
      'Cribbage is said to have been devised in the 1630s by the poet and courtier Sir John Suckling, who added new rules to an older card game called noddy. John Aubrey, writing later in the century, credited Suckling with it; Suckling was also famous as a gambler.',
      'It is one of very few card games scored on a board. Each player moves two pegs, the back one leapfrogging the front, so a miscount is easy to see. Fifteens, pairs and runs are scored twice over: once as the cards are played, and again when the hands are shown.'
    ],
    facts: [['Inventor', 'Sir John Suckling, 1630s, by tradition'], ['From', 'Noddy, an older card game'], ['Score', 'Pegged on a board, to 121']],
    build: buildCribbage },
  { id: 'dominoes', wing: 4, title: 'Dominoes', date: '18th century CE', rail: 'Dominoes',
    eyebrow: 'China, then Italy and France', status: ['known', 'Still played'], game: 'dominoes',
    body: [
      'A domino is a pair of dice in one tile. A double-six set holds one tile for each throw of two dice, with a blank suit added, 28 in all. The earliest written mention of dominoes comes from Song-dynasty China, in Zhou Mi\'s Former Events in Wulin, written in the 13th century, and Chinese sets are still made without the blanks.',
      'The European game appeared in Italy in the 18th century, perhaps first in Venice and Naples, became a fashion in France, and reached Britain late in the century, possibly with French prisoners of war. The name probably comes from a hooded carnival costume. The oldest European games block the line or draw from the boneyard, like the one at this table.'
    ],
    facts: [['Set', '28 tiles, double-six'], ['First record', 'Song China, 13th century'], ['Europe', 'Italy, 18th century']],
    build: buildDominoes },
  { id: 'tablut', wing: 4, title: 'Tablut', date: '1732 CE', rail: 'Tablut',
    eyebrow: 'Lapland · recorded by Linnaeus', status: ['recon', 'Rules partly read'], game: 'tablut',
    body: [
      'In the summer of 1732 the young Swedish naturalist Carl Linnaeus travelled through Lapland and wrote down a board game the Sámi played, Tablut, with a sketch of the board: a 9 × 9 mat of embroidered reindeer hide. A king and eight Swedes stand in the middle; sixteen Muscovites wait at the edges.',
      'It is the last of the tafl games, the "table" games of northern Europe before chess, to be recorded while still in use. Linnaeus wrote in Latin and Swedish, and an English translation of 1811 garbled several rules, so players still argue over details. This table follows the reading most use today: the king escapes to any edge, and helps to capture.'
    ],
    facts: [['Recorded', 'Carl Linnaeus, Lapland, 1732'], ['Board', '9 × 9, of reindeer hide'], ['Sides', 'King and 8 Swedes against 16 Muscovites']],
    build: buildTablut },
  { id: 'snakes', wing: 4, title: 'Snakes and Ladders', date: '18th–19th century CE', rail: 'Snakes and Ladders',
    eyebrow: 'India, then England', status: ['known', 'Still played today'], game: 'snakes',
    body: [
      'Long before it was a children\'s game, snakes and ladders was a lesson. In India it was gyan chaupar, the game of knowledge, or moksha patam, played by Jains, Hindus and Sufis on boards of their own. Ladders were virtues such as faith, generosity and knowledge; snakes were vices such as theft, debt and lust; and square 100 was liberation. Boards survive from 18th- and 19th-century western India.',
      'The snakes outnumbered the ladders, because the way down is easier than the way up. F. H. Ayres registered an English version in 1892, with Victorian virtues and as many ladders as snakes, and in 1943 Milton Bradley turned the snakes into playground chutes.'
    ],
    facts: [['Squares', '100'], ['Moves', 'One die'], ['Goal', 'Square 100: liberation']],
    build: buildSnakesBoard },
  { id: 'ludo', wing: 4, title: 'Ludo', date: '1896 CE', rail: 'Ludo',
    eyebrow: 'England, from India', status: ['known', 'Still played'], game: 'ludo',
    body: [
      'Ludo is Pachisi made simple for the Victorian nursery. The royal game of India, played with cowrie shells on a cloth cross, reached Britain through trade and empire, and in 1896 a version with a single die and a square board was patented in England as Ludo, Latin for "I play".',
      'It travelled the world from there. The Royal Navy turned it into a rougher game called uckers, and it is still one of the first board games many children learn. The race, the six to come out and the token sent home all come straight from Pachisi, two tables away.'
    ],
    facts: [['Patented', 'England, 1896'], ['From', 'Pachisi'], ['Name', 'Latin ludo, "I play"']],
    build: buildLudo },
  { id: 'mahjong', wing: 4, title: 'Mahjong', date: 'mid-1800s CE', rail: 'Mahjong',
    eyebrow: 'China · Qing dynasty', status: ['known', 'Still played today'], game: 'mahjong',
    note: 'A table needs four, so three Scribes join you. Scoring is left out: whoever goes out first wins the hand.',
    body: [
      'Mahjong took shape in the Shanghai region in the middle or later years of the 19th century, during the Qing dynasty. It grew out of older Chinese card games and keeps their money suits: circles, bamboo and characters, joined by winds and dragons. A full set has 136 tiles, or 144 with the flowers and seasons.',
      'After the First World War an American living in Shanghai, Joseph P. Babcock, simplified the rules, added English labels and coined the name mah-jongg. In the mid-1920s it became a craze in the United States, Britain and Australia, and in 1937 players in New York founded the National Mah Jongg League.'
    ],
    facts: [['Tiles', '136, or 144 with flowers'], ['Suits', 'Circles, bamboo, characters'], ['Players', 'Four: you and three Scribes']],
    build: buildMahjong },
  { id: 'wing5', wing: 5, title: 'The Modern Board Game', short: 'Wing V', date: 'c. 1840 CE – today', rail: 'Wing V',
    eyebrow: 'Wing V · Librarium Archives', status: null, begin: 'mansion',
    body: [
      'With cheap colour printing, board games became products. Publishers in Salem, Springfield, London and Ravensburg sold games about virtue, money and getting ahead, and inventors patented their ideas. This wing runs from the first American board games to the ancestors of games still on the shelf, and ends with Librarium\'s own.',
      'Seven tables are open: Reversi, Halma, Dots and Boxes, Chinese checkers, the Landlord\'s Game, Kalah and Hex.'
    ],
    facts: [['Tables', 'Reversi, Halma, Dots and Boxes, Chinese checkers, the Landlord\'s Game, Kalah, Hex'], ['Display', 'Mansion of Happiness, Game of Life']],
  },
  { id: 'mansion', wing: 5, title: 'The Mansion of Happiness', date: '1843 CE', rail: 'Mansion of Happiness',
    eyebrow: 'Salem, Massachusetts', status: ['known', 'Rules survive in print'],
    note: 'On display. Note the teetotum: dice were thought too close to gambling.',
    body: [
      'In 1843 W. & S. B. Ives of Salem, Massachusetts, published The Mansion of Happiness, "an instructive, moral and entertaining amusement". The Library of Congress calls it possibly the first board game published in the United States. It was close to a copy of an English game of 1800, and who adapted it is uncertain: Anne Abbott, who designed other games for the same publisher, has often been credited.',
      'Players spun a numbered top called a teetotum and moved along a spiral. Virtues such as temperance and generosity carried them toward the mansion at the centre; vices such as idleness sent them back toward the pillory.'
    ],
    facts: [['Publisher', 'W. & S. B. Ives, Salem'], ['Moves', 'A spinning teetotum'], ['Goal', 'Reach the mansion at the centre']],
    build: buildMansion },
  { id: 'lifegame', wing: 5, title: 'The Checkered Game of Life', short: 'Checkered Game of Life', date: '1860 CE', rail: 'Game of Life',
    eyebrow: 'Springfield, Massachusetts', status: ['known', 'Rules survive in print'],
    note: 'On display.',
    body: [
      'Milton Bradley had just set up a colour lithography shop in Springfield, Massachusetts, when he printed The Checkered Game of Life in the winter of 1860. He sold the first few hundred copies himself on a two-day trip to New York, and by 1861 buyers had taken more than 45,000.',
      'Like the Mansion of Happiness it was a moral journey, played with a teetotum. Its squares held the virtues and dangers of a life, from Influence and Fat Office to Poverty, Prison and Ruin. The company Bradley founded later grew it into The Game of Life.'
    ],
    facts: [['Maker', 'Milton Bradley'], ['Moves', 'A teetotum'], ['Sold', 'Over 45,000 by 1861']],
    build: buildCheckeredLife },
  { id: 'reversi', wing: 5, title: 'Reversi', date: '1883 CE', rail: 'Reversi',
    eyebrow: 'Victorian England', status: ['known', 'Rules survive in print'], game: 'reversi',
    body: [
      'Two Englishmen, Lewis Waterman and John W. Mollett, each claimed to have invented reversi in 1883, and each called the other a fraud. Whoever was first, the game of flipping discs caught on: the Saturday Review mentioned it in 1886, and the German publisher Ravensburger was making it by 1893.',
      'In 1971 the Japanese salesman Goro Hasegawa patented Othello, which starts from four discs in the centre instead of an empty board. Othello is the version played in tournaments today, and its opening is the one we use here.'
    ],
    facts: [['Board', '8 × 8'], ['Pieces', '64 two-sided discs'], ['Win', 'Most discs showing']],
    build: buildReversiBoard },
  { id: 'halma', wing: 5, title: 'Halma', date: '1883–84 CE', rail: 'Halma',
    eyebrow: 'Massachusetts and Germany', status: ['known', 'Still played, as Chinese checkers'], game: 'halma',
    body: [
      'Halma, from the Greek for "leap", was invented in 1883 or 1884 by George Howard Monks, a surgeon at Harvard Medical School, who drew on an English game called Hoppity. Each player starts with a camp of men in one corner of a 16 × 16 board and races to move them all into the opposite corner, stepping, or leaping over any piece in chains of jumps.',
      'In 1892 a version on a six-pointed star was published as Stern-Halma, "star Halma". Sold in America under a more exotic name, it became Chinese checkers: a game with no link to China, and none to checkers.',
      'At this table you play the two-player game, 19 men a side. Long chains of leaps are the whole art: build ladders of your own men, and borrow the Scribe\'s.'
    ],
    facts: [['Board', '16 × 16'], ['Players', 'Two or four'], ['Moves', 'A step, or chains of leaps'], ['Descendant', 'Chinese checkers']],
    build: buildHalma },
  { id: 'dotsboxes', wing: 5, title: 'Dots and Boxes', date: 'late 19th century CE', rail: 'Dots and Boxes',
    eyebrow: 'France', status: ['known', 'Rules survive in print'], game: 'dotsboxes',
    body: [
      'Dots and Boxes needs only a pencil and paper. The French mathematician Édouard Lucas, best known for the Tower of Hanoi puzzle, published it in the late 19th century as la pipopipette, and it has gone by many names since, from boxes to pigs in a pen.',
      'It looks simple, but it hides deep strategy. Strong players count the chains of boxes forming on the board and give a few boxes away on purpose, to force their opponent to open the long chains. The mathematician Elwyn Berlekamp wrote a whole book about it in 2000.'
    ],
    facts: [['Grid', '4 × 4 boxes'], ['Score', 'Close a box, draw again'], ['Win', 'Most boxes']],
    build: buildDotsBoard },
  { id: 'chinese', wing: 5, title: 'Chinese Checkers', short: 'Chinese Checkers', date: '1892 CE', rail: 'Chinese Checkers',
    eyebrow: 'Germany and the United States', status: ['known', 'Rules survive in print'], game: 'chinese',
    body: [
      'Chinese checkers is neither Chinese nor checkers. It began as Stern-Halma, "star Halma", which the German publisher Ravensburger brought out in 1892: Halma\'s race moved onto a six-pointed star, so that two, three, four or six players could each race their marbles into the opposite point.',
      'In 1928 the American firm J. Pressman & Co. sold the game as Hop Ching Checkers, and the brothers Bill and Jack Pressman soon renamed it Chinese checkers, to suit the fashion of the time for anything from the East. The name stuck, though the game has no Chinese origin.'
    ],
    facts: [['First published', 'Ravensburger, 1892, as Stern-Halma'], ['Renamed', 'J. Pressman & Co., USA, 1928'], ['Board', 'A star of 121 holes']],
    build: buildChinese },
  { id: 'landlord', wing: 5, title: 'The Landlord\'s Game', date: '1904 CE', rail: 'Landlord\'s Game',
    eyebrow: 'United States', status: ['known', 'Rules survive in the patent'], game: 'landlord',
    note: 'The board follows the drawing in Magie\'s patent, space for space. At the table you play the patent\'s rules against the Scribe, three times round by default or five as the patent has it.',
    body: [
      'Lizzie Magie was granted U.S. Patent 748,626 for The Landlord\'s Game on January 5, 1904. She meant it as a lesson. A follower of the economist Henry George, she wanted players to feel how land monopoly enriches landlords and ruins everyone else, and she gave the game two sets of rules: one that rewarded monopoly, and one that rewarded shared prosperity.',
      'For years players made their own boards, adding the streets of their own towns; Quakers in Atlantic City gave it theirs. In 1935 Parker Brothers bought a version from Charles Darrow, published it as Monopoly and credited him as its inventor. Magie\'s part came back to light in the 1970s, when Ralph Anspach dug up her patents while fighting Parker Brothers in court over his game Anti-Monopoly.'
    ],
    facts: [['Patent', 'U.S. 748,626, 1904'], ['Inventor', 'Lizzie Magie'], ['Descendant', 'Monopoly (1935)']],
    build: buildLandlord },
  { id: 'kalah', wing: 5, title: 'Kalah', date: '1940 CE', rail: 'Kalah',
    eyebrow: 'United States', status: ['known', 'Rules survive in print'], game: 'kalah',
    body: [
      'Kalah is mancala made for the modern West. William Julius Champion Jr., a Yale graduate, devised it in 1940 from the African and Asian sowing games he had read about, began selling it in 1944, and patented it in the 1950s. His Kalah Game Company, founded in 1958 in Holbrook, Massachusetts, made sets into the 1970s.',
      'Champion sold it as an educational game, and towns and schools held Kalah tournaments in the early 1960s. It became a favourite of computer scientists too: programs could play some sizes perfectly by 2001, and later analysis shows that with perfect play the first player usually wins.'
    ],
    facts: [['Inventor', 'William Julius Champion Jr., 1940'], ['Made in', 'Holbrook, Massachusetts'], ['Family', 'Mancala']],
    build: buildKalah },
  { id: 'hex', wing: 5, title: 'Hex', date: '1942 CE', rail: 'Hex',
    eyebrow: 'Copenhagen and Princeton', status: ['known', 'Rules survive in print'], game: 'hex',
    body: [
      'The Danish poet and mathematician Piet Hein invented Hex at the Niels Bohr Institute in Copenhagen and published it in the newspaper Politiken on 26 December 1942, under the name Polygon. In 1948 or 1949 John Nash came up with the same game at Princeton, where his fellow students called it Nash, or John. Parker Brothers sold it as Hex in 1952, and Martin Gardner wrote it up in Scientific American in 1957.',
      'Hex has two remarkable properties. It can never be drawn, because a full board always holds exactly one winning chain. And Nash proved that the first player can always win with perfect play, without showing how: the argument is called strategy stealing. That is why players today use the swap rule.'
    ],
    facts: [['Invented', 'Piet Hein, 1942; John Nash, 1948–49'], ['Board', 'A rhombus of hexagons, 11 × 11 by tradition'], ['Draws', 'Impossible']],
    build: buildHex },
  { id: 'wing6', wing: 6, title: 'Games of the World', short: 'Wing VI', date: 'Across the oceans', rail: 'Wing VI',
    eyebrow: 'Wing VI · Librarium Archives', status: null, begin: 'mutorere',
    body: [
      'The other wings follow one long road, from Egypt and Mesopotamia through Europe to the shop shelf. But play has many homelands. This wing gathers games from the Pacific, Africa and Asia: some ancient, some first written down by visitors, all still played today.',
      'All thirteen tables are open: Mū tōrere from Aotearoa New Zealand, Shogi and Gomoku from Japan, Makruk from Thailand, Bagh-chal from Nepal, Kōnane from Hawaiʻi, Yut Nori and Janggi from Korea, Fanorona from Madagascar, Bao from the Swahili coast, Morabaraba from southern Africa, and Seega and Tâb from Egypt.'
    ],
    facts: [['Tables', 'Mū tōrere, Shogi, Gomoku, Makruk, Bagh-chal, Kōnane, Yut Nori, Janggi, Fanorona, Bao, Morabaraba, Seega, Tâb']],
  },
  { id: 'mutorere', wing: 6, title: 'Mū tōrere', date: 'first described in 1917', rail: 'Mū tōrere',
    eyebrow: 'Aotearoa New Zealand · Māori', status: ['known', 'Still played'], game: 'mutorere',
    body: [
      'Mū tōrere is a Māori game for two, played on a star of eight arms, the kewai, round a centre, the pūtahi, drawn on the ground or carved in wood. The board has been likened to an octopus. Each player has four men, and the aim is to leave the other player no move at all.',
      'It was first described in print by Elsdon Best in 1917. Scholars still debate whether it is wholly Māori or partly an answer to the draughts that settlers brought, and accounts of its rules differ. It looks simple, but settlers who thought so are said to have lost to it again and again. Played perfectly, it is a draw.'
    ],
    facts: [['Board', 'Eight arms and a centre'], ['Men', 'Four each'], ['Win', 'Leave the other side no move']],
    build: buildMuTorere },
  { id: 'shogi', wing: 6, title: 'Shogi', short: 'Shogi (Japanese Chess)', date: 'oldest pieces c. 1058 CE', rail: 'Shogi',
    eyebrow: 'Japan', status: ['known', 'Still played'], game: 'shogi',
    body: [
      'Shogi, Japanese chess, belongs to the same family as chaturanga and xiangqi. The oldest pieces yet found, sixteen of them, were dug up at Kōfuku-ji in Nara beside a wooden plaque dated 1058, and they already have the five-sided shape of modern pieces.',
      'Both sides\' pieces are the same colour: only the way a piece points shows whose it is. That made possible shogi\'s great invention of the 16th century, the drop. A captured piece changes sides, and its captor can put it back on the board later, so the game never thins out. Ōhashi Sōko set down the standard rules in 1636.'
    ],
    facts: [['Board', '9 × 9'], ['Pieces', 'One colour, pointing at the enemy'], ['Drops', 'Captured pieces come back into play']],
    build: buildShogi },
  { id: 'gomoku', wing: 6, title: 'Gomoku', date: 'named renju in 1899', rail: 'Gomoku',
    eyebrow: 'Japan', status: ['known', 'Still played'], game: 'gomoku',
    body: [
      'Gomoku narabe, "five pieces in a row", is played with the stones and board of Go: whoever first sets five stones in an unbroken line wins. Games of getting five in a row are played across East Asia, as wuziqi in China, omok in Korea and caro in Vietnam.',
      'On 6 December 1899 the Japanese journalist Kuroiwa Ruikō gave the serious game the name renju, "connected pearls", in his newspaper Yorozu Chōhō. Renju later put restrictions on black, the first player, and with good reason: in 1994 Victor Allis showed by computer that in freestyle gomoku on a 15 × 15 board, black can always win.'
    ],
    facts: [['Board', '15 × 15, or a Go board'], ['Renju', 'Named by Kuroiwa Ruikō, 1899'], ['Solved', 'A first-player win (Allis, 1994)']],
    build: buildGomoku },
  { id: 'makruk', wing: 6, title: 'Makruk', date: 'traditional', rail: 'Makruk',
    eyebrow: 'Thailand', status: ['known', 'Still played'], game: 'makruk',
    body: [
      'Makruk, Thai chess, is a cousin of chess from the same Indian ancestor, chaturanga. Its pieces keep moves that European chess gave up: the met, the counsellor beside the king, steps only one square diagonally, like the Persian firzan, and the khon moves like a shogi silver general. Cambodia plays nearly the same game as ouk chaktrang.',
      'The pawns are cowrie shells, set out on the third rank, and a pawn that reaches the sixth rank is turned over to show its promotion. Endgames are timed by counting: the side behind counts its moves, and if the count runs out before mate, the game is drawn. It is still played across Thailand today.'
    ],
    facts: [['Ancestor', 'Chaturanga'], ['Pawns', 'Cowrie shells, promoted on the sixth rank'], ['Cousin', 'Ouk chaktrang, Cambodia']],
    build: buildMakruk },
  { id: 'baghchal', wing: 6, title: 'Bagh-chal', short: 'Bagh-chal (Tigers and Goats)', date: 'traditional', rail: 'Bagh-chal',
    eyebrow: 'Nepal', status: ['known', 'Still played'], game: 'baghchal',
    body: [
      'Bagh-chal, "the tigers\' move", is the hunt game of Nepal. Four tigers face twenty goats on a board of lines like alquerque\'s: the tigers try to eat five goats, and the goats try to hem every tiger in so that none can move.',
      'Hunt games that pit a few strong pieces against many weak ones are played all over South Asia, from the lambs and tigers of southern India to the tiger games of Bengal. In Nepal, Bagh-chal is played on boards scratched on the ground as well as on cast brass sets with tiger and goat pieces.',
      'You may lead either side. The goats are the harder, more patient role. Once all twenty are down, no position may repeat, so the goats cannot simply wait.'
    ],
    facts: [['Board', '5 × 5 points with diagonals'], ['Sides', '4 tigers, 20 goats'], ['Tigers win', 'By taking five goats'], ['Goats win', 'By leaving no tiger a move']],
    build: buildBaghchal },
  { id: 'konane', wing: 6, title: 'Kōnane', date: 'by 1778–79', rail: 'Kōnane',
    eyebrow: 'Hawaiʻi', status: ['known', 'Still played'], game: 'konane',
    body: [
      'Kōnane is a Hawaiian game of capture. Old boards, papamū, were cut into large flat stones as rows of small hollows, and the pieces were black lava and white coral; one such stone survives at Puʻuhonua o Hōnaunau. Captain James Cook\'s expedition saw the game played during its visit in 1778–79.',
      'The board starts full. Two stones are lifted to open it, and from then on every move is a jump that takes a stone, so the board empties as the game goes on. The first player who cannot jump loses, and a draw is impossible. Mathematicians have shown that judging a large board is extremely hard.'
    ],
    facts: [['Board', '8 × 8 here; old boards came in many sizes'], ['Stones', 'Black lava and white coral'], ['Win', 'Be the last able to capture']],
    build: buildKonane },
  { id: 'yut', wing: 6, title: 'Yut Nori', date: 'traditional', rail: 'Yut Nori',
    eyebrow: 'Korea', status: ['known', 'Still played'], game: 'yut',
    body: [
      'Yut nori is the Korean family game of the New Year, played at Seollal and at the first full moon. Instead of dice, players throw four sticks, flat on one side and round on the other, and count the flat sides that land up: do (a pig, one step), gae (a dog, two), geol (a sheep, three), yut (a cow, four) and mo (a horse, five).',
      'Each side races four pieces round a board of 29 stations, taking shortcuts across the middle from the corners. Pieces of one side can travel stacked, landing on an enemy sends it home, and a yut or a mo earns another throw. Its origin is uncertain; it is often traced to the Three Kingdoms period.'
    ],
    facts: [['Sticks', 'Four, flat on one side'], ['Board', '29 stations'], ['Pieces', 'Four each, which can travel stacked']],
    build: buildYut },
  { id: 'janggi', wing: 6, title: 'Janggi', date: 'traditional', rail: 'Janggi',
    eyebrow: 'Korea', status: ['known', 'Still played'], game: 'janggi',
    body: [
      'Janggi, Korean chess, grew from Chinese xiangqi and keeps its board of nine files and ten rows, its palaces and most of its pieces, but drops the river, so elephants and soldiers range freely. Its cannon must jump to move at all, and its eight-sided pieces come in three sizes, the generals largest.',
      'The sides are named Cho and Han, after the rival states of the Chu–Han contention that followed the fall of the Qin dynasty in China. Older men still play it in Korean city parks, and the first world tournament was held in 2009. A game can be won on points: when neither side can force mate, the material left on the board decides.'
    ],
    facts: [['Board', '9 × 10 points, no river'], ['Sides', 'Cho (blue) and Han (red)'], ['Unusual', 'Passing is allowed']],
    build: buildJanggi },
  { id: 'fanorona', wing: 6, title: 'Fanorona', date: 'traditional', rail: 'Fanorona',
    eyebrow: 'Madagascar', status: ['known', 'Still played'], game: 'fanorona',
    body: [
      'Fanorona is a game of Madagascar, widely played there, and the full game, fanoron-tsivy, is played on five rows of nine points joined by lines and diagonals. It looks like alquerque, but its captures are its own: a stone takes by moving up to an enemy line or by moving away from one, and the whole unbroken line falls at once.',
      'A Malagasy legend tells how King Ralambo chose his heir by summoning his sons while pretending to be ill. The elder was so absorbed in a fanorona problem that the younger, Andrianjaka, arrived first and became king. In 2007 computer scientists showed that, played perfectly, the game is a draw.'
    ],
    facts: [['Board', '5 × 9 points'], ['Stones', '22 each'], ['Capture', 'By approach or withdrawal']],
    build: buildFanorona },
  { id: 'bao', wing: 6, title: 'Bao', date: 'in verse by the 1820s', rail: 'Bao',
    eyebrow: 'East Africa · the Swahili coast', status: ['known', 'Still played'], game: 'bao',
    body: [
      'Bao, Swahili for "board", is the mancala of East Africa, most popular among the Swahili of Tanzania and Kenya, and one of the most complex of all mancala games. The board has four rows of eight pits, two for each player, and a larger square pit, the nyumba or house, with powers of its own.',
      'The poet Muyaka bin Haji of Mombasa praised the game in verse in the 1820s. In Bao la Kiswahili, the masters\' version, players start with most of their 32 seeds in hand and sow them in one by one. Zanzibar\'s bao masters are held in high respect, and tournaments are held in Tanzania, Zanzibar, Kenya and Malawi.',
      'This table plays Bao la Kujifunza, the learners\' game: every seed starts on the board, two to a pit, and the house is an ordinary pit. Captures still fly from one end of the row to the other.'
    ],
    facts: [['Board', 'Four rows of eight pits'], ['Seeds', '64'], ['Win', 'Empty the other inner row']],
    build: buildBao },
  { id: 'morabaraba', wing: 6, title: 'Morabaraba', date: 'traditional', rail: 'Morabaraba',
    eyebrow: 'South Africa, Botswana and Lesotho', status: ['known', 'Still played'], game: 'morabaraba',
    body: [
      'Morabaraba is the mill game of southern Africa, known as mlabalaba, umlabalaba and mmela among other names. Its own name comes from the Southern Sotho moraba-raba, "to mill" or "to go round in a circle". The pieces are called cows, and it is a favourite of young herders, who scratch the board into the ground.',
      'Some have said British settlers brought it, but rock engravings said to be about 800 years old point to an older African history. Today it is a recognised sport: Mind Sports South Africa runs leagues, and world championships have been held since 1997.'
    ],
    facts: [['Pieces', '12 cows each'], ['Board', '24 points, with diagonals'], ['Championships', 'Since 1997']],
    build: buildMorabaraba },
  { id: 'seega', wing: 6, title: 'Seega', date: 'recorded in the 1820s', rail: 'Seega',
    eyebrow: 'Egypt · recorded by Edward Lane', status: ['known', 'Rules survive in writing'], game: 'seega',
    body: [
      'Seega is a game of the Nile valley, played on rows of cups scooped in the ground or cut in stone. Edward William Lane, an English scholar who lived in Cairo in the 1820s and 1830s, described it in his Manners and Customs of the Modern Egyptians (1836): boards of five, seven or nine rows, with twelve pieces each on the five-row board, the khamsáwee seega.',
      'The pieces, called kelbs or "dogs", go down two at a time until only the centre is empty. Then the game becomes a fight of pincers: a piece trapped between two enemies along a line is lifted off, and a player keeps capturing for as long as they can.',
      'Versions of it are still played in North Africa and the Middle East. Lane gives no rule for a game that stalls behind walls of pieces, so the table settles that by count after twenty quiet moves each.'
    ],
    facts: [['Board', '5 × 5 cups'], ['Pieces', '12 each, placed two at a time'], ['Capture', 'Trap a piece between two of yours'], ['Source', 'Edward Lane, 1836']],
    build: buildSeega },
  { id: 'tab', wing: 6, title: 'Tâb', date: 'recorded in the 1820s', rail: 'Tâb',
    eyebrow: 'Egypt · recorded by Edward Lane', status: ['known', 'Rules survive in writing'], game: 'tab',
    body: [
      'Tâb is a race and a battle at once. In Egypt it was played on four rows of squares drawn in the dust or cut in a plank, with pieces of stone on one side and red brick or tile on the other. Edward Lane recorded it in 1836, beside seega.',
      'The dice are four slips of palm stick, white on one face. One white face is a tâb, and a piece cannot leave home until its owner throws one. After that, pieces chase each other round the middle rows, knock out any enemy they land on, and may make one raid through the enemy\'s home row.',
      'Lane also describes pieces joining into stacks that split again on a tâb. The table leaves stacking out and moves each throw as it is made, to keep the game easy to follow.'
    ],
    facts: [['Board', '4 rows of 9 squares'], ['Dice', 'Four palm sticks: 1, 2, 3, 4 or 6'], ['Goal', 'Take every enemy piece'], ['Source', 'Edward Lane, 1836']],
    build: buildTab },
  { id: 'next', wing: 6, title: 'From These Tables to Yours', short: 'Librarium', date: 'Today', rail: 'Today',
    eyebrow: 'Librarium Games', status: null,
    body: [
      'From Senet to the Landlord\'s Game, every table in this hall began with someone deciding how a game should feel. Five thousand years on, people still gather to throw dice, shuffle tiles and corner each other\'s kings, and Librarium Games carries the tradition on with tables of its own.'
    ],
    games: [
      { name: 'Phoenix Farm', url: 'https://librarium.games/phoenix-farm/', text: 'Raise magical firebirds and harvest their feathers for gold. For 1 to 6 players.' },
      { name: 'Calendra', url: 'https://librarium.games/calendra/', text: 'A Celtic game of runes, about controlling the seasons through deception.' },
      { name: 'The Great Chase', url: 'https://librarium.games/the-great-chase/', text: 'A cooperative game for 1 to 6 players that tests your teamwork.' },
      { name: 'Royal Threadcount', url: 'https://librarium.games/royal-threadcount/', text: 'Also playable online on Tabletopia.' },
    ],
    facts: [],
    link: ['Visit Librarium Games', 'https://librarium.games/'] },
];

/* ------------------------------------------------------------ games */
// Rules live in js/rules.js; this adds where pieces sit in 3D and how they look.
const { ur: UR_RULES, senet: SENET_RULES } = window.LibrariumRules;
const UR = Object.assign(UR_RULES, {
  local(pl, pos, i) {
    if (pos === 0 || pos === 15) {
      const z = pl === 0 ? 0.36 : -0.36;
      return new THREE.Vector3(pos === 0 ? -0.78 + i * 0.075 : 0.78 - i * 0.075, TOP, z);
    }
    let r, c;
    if (pos <= 4) { r = pl === 0 ? 2 : 0; c = 4 - pos; }
    else if (pos <= 12) { r = 1; c = pos - 5; }
    else { r = pl === 0 ? 2 : 0; c = pos === 13 ? 7 : 6; }
    return new THREE.Vector3(urCellX(c), this.surface, urCellZ(r));
  },
  makePieces(group) {
    const side = new THREE.MeshStandardMaterial({ color: 0xd8c9a6, roughness: 0.5 });
    const sideD = new THREE.MeshStandardMaterial({ color: 0x18213e, roughness: 0.45 });
    const geo = new THREE.CylinderGeometry(0.058, 0.062, 0.03, 28);
    const tops = [urPieceTop(true), urPieceTop(false)];
    return [0, 1].map(pl => Array.from({ length: 7 }, () => {
      const top = new THREE.MeshStandardMaterial({ map: tops[pl], roughness: 0.45, emissive: 0x000000 });
      const s = (pl ? sideD : side).clone();
      const m = new THREE.Mesh(geo, [s, top, s]); m.userData.mats = [s, top];
      group.add(m); return m;
    }));
  },
  pieceH: 0.015,
});
const SENET = Object.assign(SENET_RULES, {
  local(pl, sq, i) {
    if (sq === 31) return new THREE.Vector3(0.32 + i * 0.09, TOP, pl === 0 ? 0.37 : -0.37);
    const { x, z } = seCell(sq); return new THREE.Vector3(x, this.surface, z);
  },
  makePieces(group) {
    const geos = [spoolGeo(), coneGeo()];
    const cols = [0xe7d9b8, 0x22324f];
    return [0, 1].map(pl => Array.from({ length: 5 }, () => {
      const mat = new THREE.MeshStandardMaterial({ color: cols[pl], roughness: 0.4, metalness: pl ? 0.1 : 0 });
      const m = new THREE.Mesh(geos[pl], mat); m.userData.mats = [mat];
      group.add(m); return m;
    }));
  },
  pieceH: 0,
});
const R = window.LibrariumRules;
const GAMES = { ur: UR, senet: SENET, morris: R.morris, oware: R.oware, brandubh: R.brandubh, tables: R.tables, shatranj: R.shatranj, foxgeese: R.foxgeese, draughts: R.draughts, goose: R.goose, reversi: R.reversi, dotsboxes: R.dotsboxes, halma: R.halma, go: R.go, alquerque: R.alquerque, xiangqi: R.xiangqi, snakes: R.snakes, tarocchi: R.tarocchi, mutorere: R.mutorere, konane: R.konane, fanorona: R.fanorona, chess: R.chess, shogi: R.shogi, yut: R.yut, pachisi: R.pachisi, mahjong: R.mahjong, bao: R.bao, landlord: R.landlord, chinese: R.chinese, hex: R.hex, gomoku: R.gomoku, dominoes: R.dominoes, tablut: R.tablut, makruk: R.makruk, kalah: R.kalah, cribbage: R.cribbage, morabaraba: R.morabaraba, ludo: R.ludo, janggi: R.janggi, chaturaji: R.chaturaji, seega: R.seega, tab: R.tab, baghchal: R.baghchal, fourseasons: R.fourseasons };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* --------------------------------------------------------- tweens */
const tweens = [];
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function tween(dur, fn, e = ease) {
  return new Promise(res => tweens.push({ t: 0, dur: reduceMotion ? dur * 0.35 : dur, fn, e, res }));
}
async function hop(mesh, to, dur = 0.17, h = 0.05) {
  const from = mesh.position.clone();
  await tween(dur, k => { mesh.position.lerpVectors(from, to, k); mesh.position.y += Math.sin(k * Math.PI) * h; }, k => k);
}

/* ----------------------------------------------------- presenters
 * Each game's presenter turns rule moves into meshes on the board:
 *   setup(ex)       place pieces for a fresh game
 *   meshesFor(m)    what the visitor clicks to make move m (may be empty)
 *   ringFor(m)      where to draw the destination ring for m
 *   play(m)         apply m to the rules and animate it; resolves to the rules' result
 *   score()         [[label, value], [label, value], suffix] for the HUD
 *   prompt()        what to tell the visitor on their turn */
function racePresenter(G) {
  return {
    camW: G.camW || (G.id === 'senet' ? 1.62 : 1.78),
    intro: () => `You play the ${G.sides[0]}, nearest to you. Throw to begin.`,
    setup(ex) {
      if (!ex.pieces) ex.pieces = G.makePieces(ex.group);
      this.meshes = ex.pieces;
      [0, 1].forEach(pl => this.meshes[pl].forEach((m, i) => { const v = G.local(pl, G.pos[pl][i], i); v.y += G.pieceH; m.position.copy(v); }));
    },
    meshesFor(m) {
      const a = [this.meshes[m.pl][m.i]];
      if (G.id === 'ur' && m.from === 0) G.pos[m.pl].forEach((p, i) => { if (p === 0 && i !== m.i) a.push(this.meshes[m.pl][i]); });
      return a;
    },
    ringFor(m) { if (m.water) { const c = seCell(27); return V3(c.x, G.surface, c.z); } return G.local(m.pl, m.to, m.i); },
    fromFor(m) { return G.local(m.pl, m.from, m.i); },
    async play(m) {
      const tok = play.token, mesh = this.meshes[m.pl][m.i];
      for (const s of G.steps(m)) {
        if (tok !== play.token) return {};
        const p = s === 27 && G.id === 'senet' ? (() => { const c = seCell(27); return V3(c.x, G.surface, c.z); })() : G.local(m.pl, s, m.i);
        p.y += G.pieceH;
        const off = (G.id === 'ur' && s === 15) || s === 31 || (G.bigHop && G.bigHop(m, s));
        await hop(mesh, p, off ? 0.32 : 0.17, off ? 0.12 : 0.05);
      }
      const res = G.apply(m);
      for (const o of res.moved) {
        if (tok !== play.token) return res;
        const v = G.local(o.pl, G.pos[o.pl][o.i], o.i); v.y += G.pieceH;
        await hop(this.meshes[o.pl][o.i], v, 0.45, 0.16);
      }
      return res;
    },
    score: () => (G.score ? G.score() : [['You', G.home(0) + '/' + G.N], ['Scribe', G.home(1) + '/' + G.N], 'borne off']),
    prompt: () => 'Throw when you are ready.',
  };
}

const MORRIS_P = {
  camW: 1.6, gid: 'morris', word: 'piece',
  intro() { return 'You play the pale pieces. ' + this.prompt(); },
  setup(ex) {
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: GAMES[this.gid].N }, () => {
      const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x1c1916 : 0xe8dcc0, roughness: pl ? 0.3 : 0.45 });
      const m = new THREE.Mesh(morrisPieceGeo, mat); m.userData.mats = [mat]; ex.group.add(m); return m;
    }));
    this.hand = [ex.pieces[0].slice(), ex.pieces[1].slice()];
    this.at = Array(24).fill(null); this.lost = [0, 0];
    [0, 1].forEach(pl => ex.pieces[pl].forEach((m, k) => m.position.copy(this.handSpot(pl, k))));
  },
  handSpot: (pl, k) => V3(-0.4 + k * 0.1, TOP, pl === 0 ? 0.54 : -0.54),
  lostSpot: (owner, k) => V3(owner === 0 ? -0.8 : 0.8, TOP, -0.32 + k * 0.08),
  pt(p) { const q = moPoint(p); return V3(q.x, GAMES[this.gid].surface, q.z); },
  meshesFor(m) { return m.type === 'place' ? [] : [this.at[m.type === 'move' ? m.from : m.at]]; },
  ringFor(m) { return this.pt(m.type === 'remove' ? m.at : m.to); },
  fromFor(m) { return m.type === 'move' ? this.pt(m.from) : null; },
  ringTone: m => (m.type === 'remove' ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES[this.gid]; let mesh, res;
    if (m.type === 'place') { mesh = this.hand[m.pl].shift(); res = G.apply(m); this.at[m.to] = mesh; await hop(mesh, this.pt(m.to), 0.38, 0.12); }
    else if (m.type === 'move') { mesh = this.at[m.from]; this.at[m.from] = null; this.at[m.to] = mesh; res = G.apply(m); await hop(mesh, this.pt(m.to), m.fly ? 0.45 : 0.3, m.fly ? 0.14 : 0.03); }
    else { mesh = this.at[m.at]; this.at[m.at] = null; res = G.apply(m); const owner = 1 - m.pl; await hop(mesh, this.lostSpot(owner, this.lost[owner]++), 0.45, 0.16); }
    return res;
  },
  score() { return [['You', GAMES[this.gid].count(0)], ['Scribe', GAMES[this.gid].count(1)], this.word + 's left']; },
  prompt() {
    const G = GAMES[this.gid];
    if (G.hand[0] > 0) return `Place a ${this.word} on a glowing point. ${G.hand[0]} left in your hand.`;
    return G.onBoard(0) === 3 ? `Three ${this.word}s left, so yours can fly. Pick one, then any empty point.` : `Pick a ${this.word}, then a glowing point next to it.`;
  },
};

const OWARE_P = {
  camW: 1.34, ringScale: 1.4,
  intro() { return 'Your six pits are the row nearest you. ' + this.prompt(); },
  setup(ex) {
    this.ex = ex; this.pitMeshes = ex.group.userData.pits;
    if (!ex.seeds) {
      const cols = [0x7d6a52, 0x5f5040, 0x93826a, 0x4e4236, 0xa8977c];
      ex.seeds = Array.from({ length: 48 }, (_, i) => {
        const s = new THREE.Mesh(seedGeo, new THREE.MeshStandardMaterial({ color: cols[i % 5], roughness: 0.45 }));
        s.scale.set(1, 0.8, 1.15); s.rotation.y = rand(0, TAU); ex.group.add(s); return s;
      });
    }
    this.sync(true);
  },
  slot(kind, idx, k) {
    const base = kind === 'pit' ? owPit(idx) : owStore(idx), y = GAMES.oware.surface;
    const per = kind === 'pit' ? 11 : 20, layer = Math.floor(k / per), j = k % per;
    const a = j * 2.39996 + layer * 1.3, rr = Math.min(kind === 'pit' ? 0.04 : 0.055, 0.0115 * Math.sqrt(j + 0.6));
    return V3(base.x + Math.cos(a) * rr * (kind === 'store' ? 0.85 : 1), y + 0.008 + layer * 0.013, base.z + Math.sin(a) * rr * (kind === 'store' ? 1.7 : 1));
  },
  sync(instant) {
    const G = GAMES.oware, all = this.ex.seeds.slice();
    this.pit = Array.from({ length: 12 }, () => []); this.store = [[], []];
    let k = 0;
    for (let i = 0; i < 12; i++) for (let n = 0; n < G.pits[i]; n++) this.pit[i].push(all[k++]);
    for (const pl of [0, 1]) for (let n = 0; n < G.store[pl]; n++) this.store[pl].push(all[k++]);
    const jobs = [];
    this.pit.forEach((arr, i) => arr.forEach((s, j) => jobs.push([s, this.slot('pit', i, j)])));
    this.store.forEach((arr, pl) => arr.forEach((s, j) => jobs.push([s, this.slot('store', pl, j)])));
    if (instant) { jobs.forEach(([s, v]) => s.position.copy(v)); return Promise.resolve(); }
    return Promise.all(jobs.map(([s, v]) => (s.position.distanceTo(v) > 0.001 ? hop(s, v, 0.6, 0.08) : null)));
  },
  meshesFor(m) { return [this.pitMeshes[m.pit]]; },
  ringFor(m) { const p = owPit(m.pit); return V3(p.x, GAMES.oware.surface, p.z); },
  async play(m) {
    const G = GAMES.oware, tok = play.token;
    const res = G.apply(m), hand = this.pit[m.pit].splice(0);
    for (const q of res.path) {
      if (tok !== play.token) return res;
      const s = hand.shift(), v = this.slot('pit', q, this.pit[q].length);
      this.pit[q].push(s); await hop(s, v, 0.13, 0.05);
    }
    if (res.caps.length) {
      await wait(280);
      const jobs = [];
      for (const c of res.caps) for (const s of this.pit[c].splice(0)) {
        const v = this.slot('store', m.pl, this.store[m.pl].length); this.store[m.pl].push(s); jobs.push(hop(s, v, 0.5, 0.1));
      }
      await Promise.all(jobs);
    }
    return res;
  },
  score: () => [['You', GAMES.oware.store[0]], ['Scribe', GAMES.oware.store[1]], 'seeds · 25 wins'],
  prompt: () => 'Choose one of your six pits to sow.',
  onFinish(res) { if (res.sweep) this.sync(false); },
};

const BRANDUBH_P = {
  camW: 1.36,
  intro() { return this.prompt(); },
  setup(ex) {
    const G = GAMES.brandubh;
    if (!ex.pieces) {
      const mk = (geo, color) => { const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 }); const m = new THREE.Mesh(geo, mat); m.userData.mats = [mat]; ex.group.add(m); return m; };
      ex.pieces = { att: Array.from({ length: 8 }, () => mk(brPawnGeo, 0x231a14)), def: Array.from({ length: 4 }, () => mk(brPawnGeo, 0xe6d8b6)), king: mk(brKingGeo, 0xf0e2bd) };
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.005, 8, 24), MAT.brass); band.rotation.x = Math.PI / 2; band.position.y = 0.074; ex.pieces.king.add(band);
    }
    this.ex = ex; this.cell = Array(49).fill(null); this.lost = [0, 0];
    let a = 0, d = 0;
    for (let i = 0; i < 49; i++) {
      const v = G.b[i]; const m = v === 1 ? ex.pieces.att[a++] : v === 2 ? ex.pieces.def[d++] : v === 3 ? ex.pieces.king : null;
      if (m) { this.cell[i] = m; m.position.copy(this.pos(i)); m.rotation.set(0, 0, 0); }
    }
  },
  pos(i) { const c = brCell(i); return V3(c.x, GAMES.brandubh.surface, c.z); },
  lostSpot: (owner, k) => V3(owner === 1 ? 0.64 : -0.64, TOP, -0.36 + k * 0.09),
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.brandubh, P = this.ex.pieces;
    const mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    const from = mesh.position.clone(), to = this.pos(m.to);
    await tween(0.2 + from.distanceTo(to) * 0.5, k => { mesh.position.lerpVectors(from, to, k); mesh.position.y += Math.sin(k * Math.PI) * 0.025; });
    for (const c of res.caps) {
      const cm = this.cell[c]; this.cell[c] = null;
      if (cm === P.king) { await tween(0.6, k => { cm.rotation.z = k * 1.45; }); continue; }
      const owner = P.att.includes(cm) ? 1 : 0;
      await hop(cm, this.lostSpot(owner, this.lost[owner]++), 0.42, 0.14);
    }
    return res;
  },
  score: () => [['Your side', GAMES.brandubh.count(0)], ['Attackers', GAMES.brandubh.count(1)], 'pieces'],
  prompt: () => 'Pick one of your pieces, then where it should go. Get the king to a corner.',
};
const TABLES_P = {
  camW: 1.6,
  intro: () => 'You play the pale checkers, racing counterclockwise to your home board at the near right. Throw to begin.',
  prompt: () => 'Throw when you are ready.',
  setup(ex) {
    const G = GAMES.tables;
    if (!ex.pieces) {
      const cols = [0xe8dcc0, 0x2a1c14];
      ex.pieces = [0, 1].map(pl => Array.from({ length: 15 }, () => {
        const mat = new THREE.MeshStandardMaterial({ color: cols[pl], roughness: pl ? 0.35 : 0.45 });
        const m = new THREE.Mesh(tbCheckerGeo, mat); m.userData.mats = [mat]; ex.group.add(m); return m;
      }));
    }
    this.stacks = [0, 1].map(() => Array.from({ length: 26 }, () => []));
    for (const pl of [0, 1]) {
      let k = 0;
      for (let rel = 0; rel <= 25; rel++) for (let n = 0; n < G.c[pl][rel]; n++) this.stacks[pl][rel].push(ex.pieces[pl][k++]);
      for (let rel = 0; rel <= 25; rel++) this.layout(pl, rel).forEach(([m, v]) => m.position.copy(v));
    }
  },
  slot(pl, rel, k, n) {
    const y = GAMES.tables.surface;
    if (rel === 25) return V3(0, y + 0.01 + k * 0.016, pl === 0 ? 0.1 + 0 : -0.1);
    if (rel === 0) return V3(0.76, TOP + k * 0.0152, pl === 0 ? 0.3 : -0.3);
    const abs = pl === 0 ? rel : 25 - rel;
    const sp = n > 5 ? 0.34 / (n - 1) : 0.084;
    const bottom = abs <= 12;
    return V3(tbPointX(abs), y + k * 0.0009, bottom ? 0.4 - k * sp : -0.4 + k * sp);
  },
  layout(pl, rel) { const st = this.stacks[pl][rel]; return st.map((m, k) => [m, this.slot(pl, rel, k, st.length)]); },
  meshesFor(m) { const st = this.stacks[m.pl][m.from]; return [st[st.length - 1]]; },
  fromFor(m) { const st = this.stacks[m.pl][m.from]; return this.slot(m.pl, m.from, st.length - 1, st.length); },
  ringFor(m) {
    if (m.to === 0) return this.slot(m.pl, 0, this.stacks[m.pl][0].length, 0);
    const n = this.stacks[m.pl][m.to].length;
    return this.slot(m.pl, m.to, n, n + 1);
  },
  async play(m) {
    const G = GAMES.tables, opp = 1 - m.pl;
    const mesh = this.stacks[m.pl][m.from].pop();
    let hitMesh = null;
    if (m.hit) { hitMesh = this.stacks[opp][25 - m.to].pop(); this.stacks[opp][25].push(hitMesh); }
    this.stacks[m.pl][m.to].push(mesh);
    const res = G.apply(m);
    const st = this.stacks[m.pl][m.to];
    await hop(mesh, this.slot(m.pl, m.to, st.length - 1, st.length), m.to === 0 ? 0.36 : 0.3, 0.1);
    if (hitMesh) { const b = this.stacks[opp][25]; await hop(hitMesh, this.slot(opp, 25, b.length - 1, b.length), 0.4, 0.14); }
    // Re-space any stacks whose spacing changed.
    const jobs = [];
    for (const [pl, rel] of [[m.pl, m.from], [m.pl, m.to]]) for (const [mm, v] of this.layout(pl, rel)) if (mm.position.distanceTo(v) > 0.002) jobs.push(tween(0.2, k => mm.position.lerp(v, k)));
    await Promise.all(jobs);
    return res;
  },
  score: () => { const G = GAMES.tables; return [['You', G.home(0) + '/15'], ['Scribe', G.home(1) + '/15'], `borne off · pips ${G.pip(0)} to ${G.pip(1)}`]; },
};

const SHATRANJ_P = {
  camW: 1.24,
  intro() { return 'You play the pale pieces and move first. ' + this.prompt(); },
  prompt: () => 'Pick one of your pieces, then where it should go.',
  setup(ex) {
    const G = GAMES.shatranj;
    if (ex.pieces) ex.pieces.forEach(p => ex.group.remove(p));
    ex.pieces = [];
    this.ex = ex; this.cell = Array(64).fill(null); this.lost = [0, 0];
    this.mats = [0xe8dcc0, 0x24180f];
    for (let i = 0; i < 64; i++) {
      const v = G.b[i]; if (!v) continue;
      this.cell[i] = this.spawn(G.type(v), G.owner(v), i);
    }
  },
  spawn(type, pl, i) {
    const mat = new THREE.MeshStandardMaterial({ color: this.mats[pl], roughness: pl ? 0.35 : 0.45 });
    const p = sjPiece(type, mat);
    p.position.copy(this.pos(i)); p.rotation.y = pl ? -Math.PI / 2 : Math.PI / 2;
    this.ex.group.add(p); this.ex.pieces.push(p);
    return p;
  },
  pos(i) { const c = sjCell(i); return V3(c.x, GAMES.shatranj.surface, c.z); },
  lostSpot(owner, k) { const col = k % 2, row = (k / 2) | 0; return V3((owner === 1 ? 0.48 : -0.48) + (owner === 1 ? 1 : -1) * col * 0.065, TOP, -0.3 + row * 0.075); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.shatranj;
    const mesh = this.cell[m.from], victim = this.cell[m.to];
    const type = G.type(G.b[m.from]);
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    const from = mesh.position.clone(), to = this.pos(m.to);
    const leaps = type === G.SH.N || type === G.SH.E;
    await tween(0.22 + from.distanceTo(to) * 0.5, k => { mesh.position.lerpVectors(from, to, k); mesh.position.y += Math.sin(k * Math.PI) * (leaps ? 0.06 : 0.015); });
    if (victim) { const owner = 1 - m.pl; await hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.14); }
    if (m.promo) {
      const p = this.spawn(G.SH.F, m.pl, m.to);
      p.scale.setScalar(0.01); mesh.visible = false; this.cell[m.to] = p;
      await tween(0.35, k => { p.scale.setScalar(Math.max(0.01, k)); });
    }
    return res;
  },
  score: () => { const G = GAMES.shatranj; return [['You', G.material(0) + 1], ['Scribe', G.material(1) + 1], 'pieces']; },
};
const FOXGEESE_P = {
  camW: 1.0,
  intro() { return 'You are the fox, in the centre. The geese move first.'; },
  prompt: () => 'Choose a ring to move the fox. A ring beyond a goose is a jump.',
  setup(ex) {
    const G = GAMES.foxgeese;
    if (!ex.pieces) ex.pieces = { fox: foxPiece(), geese: Array.from({ length: G.GEESE }, () => goosePiece()) };
    ex.pieces.fox.parent || ex.group.add(ex.pieces.fox);
    ex.pieces.geese.forEach(g => { g.parent || ex.group.add(g); g.visible = true; g.rotation.set(0, Math.PI / 2, 0); });
    this.ex = ex; this.cell = Array(49).fill(null); this.lost = 0;
    let k = 0;
    for (let i = 0; i < 49; i++) {
      const v = G.b[i]; if (!v) continue;
      const m = v === 1 ? ex.pieces.fox : ex.pieces.geese[k++];
      this.cell[i] = m; m.position.copy(this.pos(i));
    }
    ex.pieces.fox.rotation.set(0, Math.PI / 2, 0);
  },
  pos(i) { const c = fgCell(i); return V3(c.x, GAMES.foxgeese.surface, c.z); },
  lostSpot(k) { return V3(0.5 + (k % 2) * 0.07, TOP, -0.34 + ((k / 2) | 0) * 0.07); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.foxgeese, tok = play.token;
    const mesh = this.cell[m.from]; this.cell[m.from] = null;
    const victims = m.caps.map(c => this.cell[c]);
    m.caps.forEach(c => { this.cell[c] = null; });
    this.cell[m.to] = mesh;
    const res = G.apply(m);
    let k = 0;
    for (const sq of m.path) {
      if (tok !== play.token) return res;
      const to = this.pos(sq), from = mesh.position.clone();
      mesh.rotation.y = Math.atan2(-(to.z - from.z), to.x - from.x);
      await hop(mesh, to, m.caps.length ? 0.3 : 0.24, m.caps.length ? 0.09 : 0.03);
      const v = victims[k++];
      if (v) hop(v, this.lostSpot(this.lost++), 0.4, 0.14);
    }
    await wait(150);
    return res;
  },
  score: () => { const G = GAMES.foxgeese; return [['Geese left', G.geese()], ['Fox wins at', G.FOX_WINS_AT], '']; },
};

const DRAUGHTS_P = {
  camW: 1.1,
  intro() { return 'You play the dark pieces and move first. ' + this.prompt(); },
  prompt: () => 'Pick a piece, then a ring. If a capture is possible, you must take it.',
  setup(ex) {
    const G = GAMES.draughts;
    if (!ex.pieces) {
      ex.pieces = [0, 1].map(pl => Array.from({ length: 12 }, () => {
        const mat = new THREE.MeshStandardMaterial({ color: pl ? 0xe8dcc0 : 0x3a1f12, roughness: 0.4 });
        const m = new THREE.Mesh(drManGeo, mat); m.userData.mats = [mat];
        const crown = new THREE.Mesh(drManGeo, mat); crown.position.y = 0.016; crown.visible = false; m.add(crown); m.userData.crown = crown;
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.003, 6, 24), MAT.brass); band.rotation.x = Math.PI / 2; band.position.y = 0.024; band.visible = false; m.add(band); m.userData.band = band;
        ex.group.add(m); return m;
      }));
    }
    this.ex = ex; this.cell = Array(64).fill(null); this.lost = [0, 0];
    const k = [0, 0];
    ex.pieces.flat().forEach(m => { m.visible = true; this.crown(m, false); });
    for (let i = 0; i < 64; i++) {
      const v = G.b[i]; if (!v) continue;
      const pl = G.owner(v), m = ex.pieces[pl][k[pl]++];
      this.cell[i] = m; m.position.copy(this.pos(i));
    }
  },
  crown(m, on) { m.userData.crown.visible = on; m.userData.band.visible = on; },
  pos(i) { const c = drCell(i); return V3(c.x, GAMES.draughts.surface, c.z); },
  lostSpot(owner, k) { return V3((owner === 1 ? 0.5 : -0.5), TOP + (k % 6) * 0.0165, -0.3 + ((k / 6) | 0) * 0.09); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.draughts, tok = play.token;
    const mesh = this.cell[m.from]; this.cell[m.from] = null;
    const victims = m.caps.map(c => this.cell[c]);
    m.caps.forEach(c => { this.cell[c] = null; });
    this.cell[m.to] = mesh;
    const res = G.apply(m);
    let k = 0;
    for (const sq of m.path) {
      if (tok !== play.token) return res;
      await hop(mesh, this.pos(sq), m.caps.length ? 0.3 : 0.26, m.caps.length ? 0.08 : 0.025);
      const v = victims[k++];
      if (v) { const owner = 1 - m.pl; hop(v, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.14); }
    }
    if (m.crown) { this.crown(mesh, true); await tween(0.3, q => { mesh.userData.crown.scale.setScalar(Math.max(0.01, q)); }); }
    return res;
  },
  score: () => { const G = GAMES.draughts; return [['You', G.count(0)], ['Scribe', G.count(1)], 'pieces']; },
};

// The Goose is a race game: it borrows the race presenter, with its own pieces and spiral.
const GOOSE = Object.assign(R.goose, {
  camW: 1.12, pieceH: 0,
  makePieces(group) { return [[goosePawn(0xd4a23a)], [goosePawn(0xc8ccd2)]].map(a => { a.forEach(m => group.add(m)); return a; }); },
  local(pl, sq) { const c = gsCell(sq); return V3(c.x + (pl ? 0.022 : -0.022), this.surface, c.z + (pl ? 0.016 : -0.016)); },
  score() { return [['You', 'square ' + this.pos[0][0]], ['Scribe', 'square ' + this.pos[1][0]], '· land on 63 to win']; },
  winText: pl => (pl === 0 ? 'You reached the garden at 63 first.' : 'The Scribe reached the garden at 63 first.'),
});
const ALQUERQUE_P = {
  camW: 1.0,
  intro() { return 'You play the dark pieces and move first. ' + this.prompt(); },
  prompt: () => 'Pick a piece, then a ring. Pieces never move backwards, and if you can capture, you must.',
  setup(ex) {
    const G = GAMES.alquerque;
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 12 }, () => {
      const mat = new THREE.MeshStandardMaterial({ color: pl ? 0xe8dcc0 : 0x3a1f12, roughness: 0.4 });
      const m = new THREE.Mesh(drManGeo, mat); m.userData.mats = [mat]; ex.group.add(m); return m;
    }));
    this.cell = Array(25).fill(null); this.lost = [0, 0];
    const k = [0, 0];
    ex.pieces.flat().forEach(m => { m.visible = true; });
    for (let i = 0; i < 25; i++) { const v = G.b[i]; if (!v) continue; const m = ex.pieces[v - 1][k[v - 1]++]; this.cell[i] = m; m.position.copy(this.pos(i)); }
  },
  pos(i) { const c = aqCell(i); return V3(c.x, GAMES.alquerque.surface, c.z); },
  lostSpot(owner, k) { return V3(owner === 1 ? 0.5 : -0.5, TOP + (k % 6) * 0.0165, -0.25 + ((k / 6) | 0) * 0.09); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.alquerque, tok = play.token;
    const mesh = this.cell[m.from]; this.cell[m.from] = null;
    const victims = m.caps.map(c => this.cell[c]); m.caps.forEach(c => { this.cell[c] = null; });
    this.cell[m.to] = mesh;
    const res = G.apply(m);
    let k = 0;
    for (const sq of m.path) {
      if (tok !== play.token) return res;
      await hop(mesh, this.pos(sq), m.caps.length ? 0.3 : 0.24, m.caps.length ? 0.08 : 0.025);
      const v = victims[k++];
      if (v) { const owner = 1 - m.pl; hop(v, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.14); }
    }
    return res;
  },
  score: () => { const G = GAMES.alquerque; return [['You', G.count(0)], ['Scribe', G.count(1)], 'pieces']; },
};
const XIANGQI_P = {
  camW: 0.9, ringScale: 0.62,
  intro() { return 'You play red and move first. ' + this.prompt(); },
  prompt: () => 'Pick a piece, then a ring. Protect your general: checkmate wins.',
  setup(ex) {
    const G = GAMES.xiangqi;
    if (!ex.pieces) { ex.pieces = []; for (let i = 0; i < 90; i++) { const v = G.b[i]; if (v) { const m = xqPiece(v >= 8 ? 1 : 0, v & 7); ex.group.add(m); ex.pieces.push(m); } } }
    this.cell = Array(90).fill(null); this.lost = [0, 0];
    const pool = ex.pieces.slice();
    ex.pieces.forEach(m => { m.visible = true; });
    for (let i = 0; i < 90; i++) {
      const v = G.b[i]; if (!v) continue;
      const k = pool.findIndex(m => m.userData.pl === (v >= 8 ? 1 : 0) && m.userData.t === (v & 7));
      const m = pool.splice(k, 1)[0]; this.cell[i] = m; m.position.copy(this.pos(i));
    }
  },
  pos(i) { const c = xqCell(i); return V3(c.x, GAMES.xiangqi.surface + 0.008, c.z); },
  lostSpot(owner, k) { return V3(owner === 1 ? 0.44 : -0.44, TOP + 0.008 + (k % 8) * 0.0165, -0.28 + ((k / 8) | 0) * 0.07); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.xiangqi, tok = play.token;
    const mesh = this.cell[m.from], victim = this.cell[m.to];
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.3, 0.06);
    if (tok !== play.token) return res;
    if (victim) { const owner = 1 - m.pl; hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.14); }
    return res;
  },
  score: () => { const G = GAMES.xiangqi; return [['You', G.count(0)], ['Scribe', G.count(1)], 'pieces']; },
};
const SNAKES = Object.assign(R.snakes, {
  camW: 1.08, pieceH: 0, sides: ['red pawn', 'blue pawn'],
  makePieces(group) { return [[goosePawn(0xb0302a)], [goosePawn(0x2a4a8a)]].map(a => { a.forEach(m => group.add(m)); return a; }); },
  local(pl, sq) { const c = slCell(sq); return V3(c.x + (pl ? 0.016 : -0.016), this.surface, c.z + (pl ? 0.012 : -0.012)); },
  bigHop: (m, s) => s === m.to && m.path.length > 1 && Math.abs(m.path[m.path.length - 1] - m.path[m.path.length - 2]) > 1,
  score() { return [['You', 'square ' + this.pos[0][0]], ['Scribe', 'square ' + this.pos[1][0]], '· land on 100 to win']; },
  winText: pl => (pl === 0 ? 'You reached 100, liberation, first.' : 'The Scribe reached 100 first.'),
});
const TAROCCHI_P = {
  camW: 1.18,
  intro() { return 'You lead the first trick. ' + this.prompt(); },
  prompt: () => (GAMES.tarocchi.trick.length ? 'Follow suit if you can, otherwise play a trump. The Fool may always be played.' : 'Choose a card to lead.'),
  setup(ex) {
    const G = GAMES.tarocchi, d = ex.group.userData;
    d.display.forEach(m => { m.visible = false; }); d.baize.visible = true;
    (ex.pieces || []).forEach(m => { ex.group.remove(m); });
    ex.pieces = [];
    this.ex = ex; this.mesh = new Map(); this.trick = []; this.pile = [0, 0];
    for (const pl of [0, 1]) for (const c of G.hands[pl]) { const m = tcCard(c); ex.group.add(m); ex.pieces.push(m); this.mesh.set(c, m); }
    this.layout(0, true); this.layout(1, true);
  },
  leave(ex) {
    const d = ex.group.userData;
    d.display.forEach(m => { m.visible = true; }); d.baize.visible = false;
    (ex.pieces || []).forEach(m => { m.visible = false; });
  },
  handSpot(pl, i, n) { return V3((i - (n - 1) / 2) * 0.074, GAMES.tarocchi.surface + 0.001 + i * 0.0002, pl ? -0.205 : 0.205); },
  trickSpot(pl) { return V3(pl ? 0.045 : -0.045, GAMES.tarocchi.surface + 0.004, pl ? -0.035 : 0.035); },
  pileSpot(pl, k) { return V3(0.5, GAMES.tarocchi.surface + 0.002 + k * 0.0017, pl ? -0.16 : 0.16); },
  layout(pl, instant) {
    const hand = GAMES.tarocchi.hands[pl];
    hand.forEach((c, i) => {
      const m = this.mesh.get(c), to = this.handSpot(pl, i, hand.length);
      m.rotation.set(0, 0, pl ? Math.PI : 0); // the Scribe's cards lie face down
      if (instant) m.position.copy(to); else hop(m, to, 0.25, 0.01);
    });
  },
  meshesFor(m) { return [this.mesh.get(m.card)]; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.tarocchi, tok = play.token, mesh = this.mesh.get(m.card);
    const res = G.apply(m);
    this.trick.push({ pl: m.pl, card: m.card });
    sfx.card();
    if (m.pl === 1) tween(0.3, k => { mesh.rotation.z = Math.PI * (1 - k); });
    await hop(mesh, this.trickSpot(m.pl), 0.32, 0.06);
    if (tok !== play.token) return res;
    this.layout(m.pl, false);
    if (res.trick) {
      await wait(900); if (tok !== play.token) return res;
      // Both cards go face down to the winner's pile; the Fool goes back to whoever played it.
      for (const t of this.trick) {
        const to = t.card === G.FOOL ? t.pl : res.winner, cm = this.mesh.get(t.card);
        tween(0.25, k => { cm.rotation.z = Math.PI * k; });
        hop(cm, this.pileSpot(to, this.pile[to]++), 0.35, 0.05);
      }
      this.trick = [];
      await wait(380);
    }
    return res;
  },
  score: () => { const G = GAMES.tarocchi; return [['You', G.score(0)], ['Scribe', G.score(1)], 'points']; },
};
const MUTORERE_P = {
  camW: 1.0,
  intro() { return 'You play the light stones and move first. ' + this.prompt(); },
  prompt: () => 'Pick a stone that can move into the empty point. A stone may enter the centre only beside one of the Scribe\'s.',
  setup(ex) {
    const G = GAMES.mutorere;
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 4 }, () => { const m = stoneMesh(pl ? 0x100c0a : 0xe8e0cc, 0.04, 0.5, 0.4); ex.group.add(m); return m; }));
    this.cell = Array(9).fill(null); const k = [0, 0];
    for (let i = 0; i < 9; i++) { const v = G.b[i]; if (!v) continue; const m = ex.pieces[v - 1][k[v - 1]++]; this.cell[i] = m; m.position.copy(this.pos(i)); }
  },
  pos(i) { const p = mtPos(i); return V3(p.x, GAMES.mutorere.surface + 0.02, p.z); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.mutorere, mesh = this.cell[m.from];
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.3, 0.04);
    return res;
  },
  score: () => { const G = GAMES.mutorere; return [['You', G.legal(0).length], ['Scribe', G.legal(1).length], 'moves open']; },
};
const KONANE_P = {
  camW: 0.98, ringScale: 0.7,
  intro() { return 'You play black. Begin by lifting one of your stones from the centre or a corner. ' ; },
  prompt: () => { const G = GAMES.konane; return G.ply === 0 ? 'Lift one of your stones from the centre or a corner.' : 'Pick a stone, then a ring: jump a white stone into the gap beyond. You may run on in a straight line.'; },
  setup(ex) {
    const G = GAMES.konane;
    if (!ex.pieces) ex.pieces = Array.from({ length: 64 }, (_, i) => { const pl = G.b[i] - 1; const m = stoneMesh(pl ? 0xe8e4da : 0x0e0c0b, 0.03, 0.62, pl ? 0.35 : 0.7); ex.group.add(m); return m; });
    this.cell = Array(64).fill(null); this.lost = [0, 0];
    const pools = [ex.pieces.filter((_, i) => (((i / 8) | 0) + (i % 8)) % 2 === 0), ex.pieces.filter((_, i) => (((i / 8) | 0) + (i % 8)) % 2 === 1)], k = [0, 0];
    for (let i = 0; i < 64; i++) { const v = G.b[i]; if (!v) continue; const m = pools[v - 1][k[v - 1]++]; m.visible = true; m.scale.set(1, 0.62, 1); this.cell[i] = m; m.position.copy(this.pos(i)); }
  },
  pos(i) { const p = knCell(i); return V3(p.x, GAMES.konane.surface + 0.012, p.z); },
  lostSpot(owner, k) { return V3(owner ? 0.46 : -0.46, TOP + 0.015 + ((k / 16) | 0) * 0.02, -0.3 + (k % 16) * 0.04); },
  meshesFor(m) { return [this.cell[m.remove !== undefined ? m.remove : m.from]]; },
  ringFor(m) { return m.remove !== undefined ? null : this.pos(m.to); },
  fromFor(m) { return m.remove !== undefined ? null : this.pos(m.from); },
  async play(m) {
    const G = GAMES.konane, tok = play.token;
    if (m.remove !== undefined) {
      const v = this.cell[m.remove]; this.cell[m.remove] = null; const owner = m.pl;
      const res = G.apply(m); await hop(v, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12); return res;
    }
    const mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const victims = m.caps.map(c => { const v = this.cell[c]; this.cell[c] = null; return v; });
    const res = G.apply(m);
    for (let k = 0; k < m.path.length; k++) {
      if (tok !== play.token) return res;
      await hop(mesh, this.pos(m.path[k]), 0.28, 0.07);
      const owner = 1 - m.pl; hop(victims[k], this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12);
    }
    return res;
  },
  score: () => { const G = GAMES.konane; return [['You', G.count(0)], ['Scribe', G.count(1)], 'stones']; },
};
const FANORONA_P = {
  camW: 1.06, ringScale: 0.62,
  intro() { return 'You play white and move first. ' + this.prompt(); },
  prompt: () => (GAMES.fanorona.chain ? 'Capture again with the same stone, or choose Stop.' : 'Pick a stone, then the ring on the enemy stone you want to capture, or a ring on an empty point to move.'),
  setup(ex) {
    const G = GAMES.fanorona;
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 22 }, () => { const m = stoneMesh(pl ? 0x100c0a : 0xeee6d2, 0.03, 0.55, 0.4); ex.group.add(m); return m; }));
    this.cell = Array(45).fill(null); this.lost = [0, 0]; const k = [0, 0];
    ex.pieces.flat().forEach(m => { m.visible = true; });
    for (let i = 0; i < 45; i++) { const v = G.b[i]; if (!v) continue; const m = ex.pieces[v - 1][k[v - 1]++]; this.cell[i] = m; m.position.copy(this.pos(i)); }
  },
  pos(i) { const p = fnCell(i); return V3(p.x, GAMES.fanorona.surface + 0.016, p.z); },
  lostSpot(owner, k) { return V3(-0.4 + (k % 11) * 0.08, TOP + 0.017, owner ? -0.34 - ((k / 11) | 0) * 0.07 : 0.34 + ((k / 11) | 0) * 0.07); },
  ringTone: m => (m.cap ? 'ember' : 'gold'),
  meshesFor(m) { return m.pass ? [] : [this.cell[m.from]]; },
  // A capture is chosen by the stone it takes first, which tells approach from withdrawal.
  ringFor(m) { return m.pass ? null : this.pos(m.caps.length ? m.caps[0] : m.to); },
  fromFor(m) { return m.pass ? null : this.pos(m.from); },
  ringTone: m => (m.caps && m.caps.length ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES.fanorona, tok = play.token;
    if (m.pass) return G.apply(m);
    const mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const victims = m.caps.map(c => { const v = this.cell[c]; this.cell[c] = null; return v; });
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.26, 0.03);
    if (tok !== play.token) return res;
    victims.forEach((v, k) => { const owner = 1 - m.pl; setTimeout(() => hop(v, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12), k * 70); });
    if (victims.length) await wait(200 + victims.length * 70);
    return res;
  },
  score: () => { const G = GAMES.fanorona; return [['You', G.count(0)], ['Scribe', G.count(1)], 'stones']; },
};
const CHESS_P = {
  camW: 1.0,
  intro() { return 'You play white and move first. ' + this.prompt(); },
  prompt: () => 'Pick a piece, then a ring. To castle, pick the king and the ring two squares over.',
  setup(ex) {
    const G = GAMES.chess, d = ex.group.userData;
    d.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m));
    ex.pieces = []; this.ex = ex;
    this.cell = Array(64).fill(null); this.lost = [0, 0];
    for (let i = 0; i < 64; i++) { const v = G.b[i]; if (v) this.cell[i] = this.make(v, i); }
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => { m.visible = false; }); },
  make(v, i) {
    const pl = v > 8 ? 1 : 0, t = 'xkqbnrp'[v & 7];
    const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x241810 : 0xeee0c0, roughness: pl ? 0.35 : 0.4 });
    const o = CHESS_SHAPES[t](mat); o.userData.mats = [mat]; o.rotation.y = pl ? -Math.PI / 2 : Math.PI / 2;
    if (i !== undefined) o.position.copy(this.pos(i));
    this.ex.group.add(o); this.ex.pieces.push(o); return o;
  },
  pos(i) { return V3(((i & 7) - 3.5) * 0.085, GAMES.chess.surface, (3.5 - (i >> 3)) * 0.085); },
  lostSpot(owner, k) { return V3(owner ? -0.47 : 0.47, TOP, (owner ? -0.3 : 0.3) * (1 - (k % 8) / 8 * 2) * 0.9); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.chess, tok = play.token;
    const mesh = this.cell[m.from], vSq = m.epTake !== undefined ? m.epTake : m.to, victim = m.cap ? this.cell[vSq] : null;
    this.cell[m.from] = null; if (victim) this.cell[vSq] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.32, (G.b[m.to] & 7) === 4 ? 0.08 : 0.03);
    if (tok !== play.token) return res;
    if (victim) { const owner = 1 - m.pl; hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12); }
    if (m.castle) { const rook = this.cell[m.castle[0]]; this.cell[m.castle[0]] = null; this.cell[m.castle[1]] = rook; await hop(rook, this.pos(m.castle[1]), 0.3, 0.06); }
    if (m.promo) { mesh.visible = false; this.cell[m.to] = this.make(G.b[m.to], m.to); }
    return res;
  },
  score: () => { const G = GAMES.chess; return [['You', G.count(0)], ['Scribe', G.count(1)], 'pieces']; },
};
const SHOGI_CH = [null, '歩', '香', '桂', '銀', '金', '角', '飛', '王'], SHOGI_PRO = [null, 'と', '杏', '圭', '全', null, '馬', '龍', null];
const SHOGI_P = {
  camW: 1.12, ringScale: 0.6,
  intro() { return 'You move first; your pieces point away from you. ' + this.prompt(); },
  prompt: () => 'Pick a piece, then a ring. Pieces you capture wait in your hand at the right: pick one there to drop it.',
  setup(ex) {
    const G = GAMES.shogi, d = ex.group.userData;
    d.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m));
    ex.pieces = []; this.ex = ex; this.cell = Array(81).fill(null); this.hand = [[], []];
    for (let i = 0; i < 81; i++) { const v = G.b[i]; if (v) { const p = this.make(v); p.position.copy(this.pos(i)); this.cell[i] = p; } }
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => { m.visible = false; }); },
  make(v) {
    const t = v & 15, pro = (v & 16) !== 0, pl = v & 32 ? 1 : 0;
    const ch = pro ? SHOGI_PRO[t] : t === 8 && pl ? '玉' : SHOGI_CH[t];
    const p = shogiPiece(ch, pl === 1, pro); p.userData.v = v;
    this.ex.group.add(p); this.ex.pieces.push(p); return p;
  },
  relabel(p, v) {
    const t = v & 15, pro = (v & 16) !== 0, pl = v & 32 ? 1 : 0;
    p.userData.v = v; p.userData.label.material.map = shogiFace(pro ? SHOGI_PRO[t] : t === 8 && pl ? '玉' : SHOGI_CH[t], pro); p.userData.label.material.needsUpdate = true;
    p.rotation.y = pl ? Math.PI : 0;
  },
  pos(i) { return V3(((i % 9) - 4) * SHOGI_S, GAMES.shogi.surface, (4 - ((i / 9) | 0)) * SHOGI_S); },
  // Hands: the visitor's beside the board at the near right, the Scribe's at the far left, one row per kind.
  handSpot(pl, t, k) { const x = (pl ? -1 : 1) * (0.43 + (k % 3) * 0.05), z = (pl ? -1 : 1) * (0.32 - (t - 1) * 0.06) ; return V3(x, GAMES.shogi.surface - 0.11 + 0.006 + ((k / 3) | 0) * 0.011, z); },
  layoutHand(pl) {
    for (let t = 1; t <= 7; t++) this.hand[pl].filter(p => (p.userData.v & 15) === t).forEach((p, k) => hop(p, this.handSpot(pl, t, k), 0.25, 0.03));
  },
  meshesFor(m) { if (m.drop) { const h = this.hand[m.pl].filter(p => (p.userData.v & 15) === m.drop); return [h[h.length - 1]]; } return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return m.drop ? null : this.pos(m.from); },
  async play(m) {
    const G = GAMES.shogi, tok = play.token;
    if (m.drop) {
      const p = this.meshesFor(m)[0]; this.hand[m.pl].splice(this.hand[m.pl].indexOf(p), 1);
      const res = G.apply(m); this.cell[m.to] = p;
      await hop(p, this.pos(m.to), 0.32, 0.05); this.layoutHand(m.pl); return res;
    }
    const p = this.cell[m.from], victim = m.cap ? this.cell[m.to] : null;
    this.cell[m.from] = null; this.cell[m.to] = p;
    const res = G.apply(m);
    await hop(p, this.pos(m.to), 0.3, (G.b[m.to] & 15) === 3 ? 0.07 : 0.03);
    if (tok !== play.token) return res;
    if (m.promo) this.relabel(p, G.b[m.to]);
    if (victim) { // it changes sides and joins the captor's hand, unpromoted
      this.relabel(victim, (victim.userData.v & 15) + (m.pl ? 32 : 0));
      this.hand[m.pl].push(victim); this.layoutHand(m.pl);
    }
    return res;
  },
  score: () => { const G = GAMES.shogi; return [['You', G.hands[0].reduce((a, b) => a + b, 0)], ['Scribe', G.hands[1].reduce((a, b) => a + b, 0)], 'in hand']; },
};
const YUT = Object.assign(R.yut, {
  camW: 1.12, pieceH: 0.011,
  makePieces(group) {
    return [0x8a2a22, 0x22346a].map(col => Array.from({ length: 4 }, () => {
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.022, 18), mat); m.userData.mats = [mat]; group.add(m); return m;
    }));
  },
  local(pl, sq, i) {
    const y = this.surface;
    if (sq === -1) return V3(pl ? -0.45 : 0.45, y, (pl ? -1 : 1) * (0.2 - i * 0.05));
    if (sq === this.HOME) return V3((pl ? -1 : 1) * (0.14 + i * 0.045), y, pl ? -0.42 : 0.42);
    const p = ytPos(sq), k = this.pos[pl].filter((q, j) => q === sq && j < i).length; // stacked pieces sit on top of each other
    return V3(p.x + (pl ? -0.008 : 0.008), y + k * 0.023, p.z);
  },
  bigHop: (m, s) => s === m.to && m.cap.length > 0,
  score() { return [['You', this.home(0) + '/4'], ['Scribe', this.home(1) + '/4'], 'home']; },
  winText: pl => (pl === 0 ? 'All four of your pieces are home.' : 'The Scribe brought all four home first.'),
});
const YUT_P = Object.assign(racePresenter(YUT), {
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).flat().forEach(m => { m.visible = false; }); },
});
{ const setup = YUT_P.setup; YUT_P.setup = function (ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); (ex.pieces || []).flat().forEach(m => { m.visible = true; }); setup.call(this, ex); }; }
// Pachisi: cell positions on the cross. Arms 0 near, 1 right, 2 far, 3 left.
const PC_SQ = 0.046, PC_D = [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: -1, z: 0 }];
function pcPos(cell) {
  const a = (cell / 24) | 0, k = ((cell % 24) / 3) | 0, j = (cell % 3) - 1, d = PC_D[a], n = PC_D[(a + 1) % 4], along = 1.5 * PC_SQ + (k + 0.5) * PC_SQ;
  return { x: d.x * along + n.x * j * PC_SQ, z: d.z * along + n.z * j * PC_SQ };
}
const PC_COL = [[0xe8b23a, 0x1e3a7a], [0xe8e0c8, 0x2a6a4a]];
const PACHISI = Object.assign(R.pachisi, {
  camW: 1.05, pieceH: 0,
  makePieces(group) {
    const geo = new THREE.LatheGeometry([[0, 0], [0.016, 0], [0.017, 0.004], [0.015, 0.016], [0.01, 0.028], [0.004, 0.034], [0, 0.035]].map(([a, b]) => new THREE.Vector2(a, b)), 20);
    return [0, 1].map(pl => Array.from({ length: this.N }, (_, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: PC_COL[pl][i < this.per ? 0 : 1], roughness: 0.4 });
      const m = new THREE.Mesh(geo, mat); m.userData.mats = [mat]; group.add(m); return m;
    }));
  },
  local(pl, idx, i) {
    const y = this.surface, a = this.arm(pl, i), d = PC_D[a], n = PC_D[(a + 1) % 4];
    const k = i % this.per;
    if (idx === 0) return V3(d.x * 0.05 + n.x * (k - (this.per - 1) / 2) * 0.03, y, d.z * 0.05 + n.z * (k - (this.per - 1) / 2) * 0.03);
    if (idx === this.HOME) return V3(d.x * 0.018 + n.x * (k - (this.per - 1) / 2) * 0.026, y, d.z * 0.018 + n.z * (k - (this.per - 1) / 2) * 0.026);
    const cell = this.cellOf(pl, i, idx), p = pcPos(cell);
    // Pieces sharing a square sit side by side.
    let under = 0; for (const q of [0, 1]) this.pos[q].forEach((v, j) => { if ((q < pl || (q === pl && j < i)) && this.cellOf(q, j, v) === cell) under++; });
    return V3(p.x + (under % 2 ? 0.012 : under ? -0.012 : 0), y, p.z + (under > 1 ? 0.012 : 0));
  },
  bigHop: (m, s) => s === m.to && m.cap.length > 0,
  score() { return [['You', this.home(0) + '/' + this.N], ['Scribe', this.home(1) + '/' + this.N], 'home']; },
  winText: pl => (pl === 0 ? 'All your pieces are home in the Charkoni.' : 'The Scribe brought all its pieces home first.'),
});
const PACHISI_P = Object.assign(racePresenter(PACHISI), {
  intro: () => 'You play yellow, from the near arm, and blue, from the far one. Throw to begin.',
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).flat().forEach(m => { m.visible = false; }); },
});
{ const setup = PACHISI_P.setup; PACHISI_P.setup = function (ex) {
  ex.group.userData.display.forEach(m => { m.visible = false; });
  if (ex.pieces && ex.pieces[0].length !== PACHISI.N) { ex.pieces.flat().forEach(m => ex.group.remove(m)); ex.pieces = null; } // the other game size
  (ex.pieces || []).flat().forEach(m => { m.visible = true; });
  setup.call(this, ex);
}; }
// Mahjong: seat 0 sits at the front, 1 to the right, 2 at the back, 3 to the left.
const MJ_TW = 0.034, MJ_TH = 0.046, MJ_TD = 0.024;
const mjBone = new THREE.MeshStandardMaterial({ color: 0xf2ecdc, roughness: 0.3 }), mjBack = new THREE.MeshStandardMaterial({ color: 0x2a7a5a, roughness: 0.35 });
const mjGeo = new THREE.BoxGeometry(MJ_TW, MJ_TH, MJ_TD);
const MJ_SEAT = [ // the edge each seat sits at, the way it faces, its right hand, and which way its tiles turn
  { e: { x: 0, z: 0.335 }, f: { x: 0, z: -1 }, r: { x: 1, z: 0 }, rot: 0 },
  { e: { x: 0.53, z: 0 }, f: { x: -1, z: 0 }, r: { x: 0, z: -1 }, rot: Math.PI / 2 },
  { e: { x: 0, z: -0.335 }, f: { x: 0, z: 1 }, r: { x: -1, z: 0 }, rot: Math.PI },
  { e: { x: -0.53, z: 0 }, f: { x: 1, z: 0 }, r: { x: 0, z: 1 }, rot: -Math.PI / 2 },
];
const MAHJONG_P = {
  camW: 1.3,
  intro() { return 'You sit at East, the front of the table, with three Scribes. ' + this.prompt(); },
  prompt: () => (GAMES.mahjong.need.type === 'claim' ? 'A tile you can claim was discarded. Choose a button, or Pass.' : 'Click a tile in your hand to discard it.'),
  setup(ex) {
    const G = GAMES.mahjong, d = ex.group.userData;
    d.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) {
      ex.pieces = Array.from({ length: 136 }, (_, id) => {
        const face = new THREE.MeshStandardMaterial({ map: mjTile(id >> 2), roughness: 0.3 });
        const m = new THREE.Mesh(mjGeo, [mjBone, mjBone, mjBone, mjBone, face, mjBack]); m.rotation.order = 'YXZ'; m.userData.mats = [face]; m.visible = false; ex.group.add(m); return m;
      });
      // Seat names on the felt.
      ['East · you', 'South', 'West', 'North'].forEach((name, s) => {
        const S = MJ_SEAT[s], plate = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.035), new THREE.MeshBasicMaterial({ transparent: true, map: tex(256, 64, (g, w, h) => { g.fillStyle = 'rgba(236,223,195,.8)'; g.font = '600 26px "Montserrat",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name.toUpperCase(), w / 2, h / 2); }) }));
        plate.rotation.order = 'YXZ'; plate.rotation.set(-Math.PI / 2, S.rot, 0);
        plate.position.set(S.e.x + S.f.x * (s % 2 ? 0.0 : 0.0) - S.r.x * 0.33, TOP + 0.021, S.e.z - S.r.z * 0.33 + (s === 0 ? 0.03 : 0));
        ex.group.add(plate); (d.plates = d.plates || []).push(plate);
      });
    }
    (d.plates || []).forEach(p => { p.visible = true; });
    this.ex = ex; this.layout(true);
  },
  leave(ex) { const d = ex.group.userData; d.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => { m.visible = false; }); (d.plates || []).forEach(p => { p.visible = false; }); },
  // Where every tile belongs now: hands standing, melds and discards lying face up, the wall hidden.
  targets() {
    const G = GAMES.mahjong, out = new Map(), y = G.surface;
    for (let s = 0; s < 4; s++) {
      const S = MJ_SEAT[s], hand = G.hands[s], n = hand.length;
      hand.forEach((id, k) => {
        const o = (k - (n - 1) / 2) * (MJ_TW + 0.002) + (s === 0 && k === n - 1 && G.need.type === 'discard' && G.need.seat === 0 && n % 3 === 2 ? 0.012 : 0);
        out.set(id, { x: S.e.x + S.r.x * o, y: y + MJ_TH / 2, z: S.e.z + S.r.z * o, ry: S.rot, rx: s === 0 ? -0.18 : 0 });
      });
      let j = 0;
      for (const m of G.melds[s]) for (const id of m.tiles) {
        const o = 0.27 - j * (MJ_TW + 0.001) - Math.floor(j / 4) * 0.0; j++;
        out.set(id, { x: S.e.x + S.f.x * 0.068 + S.r.x * o, y: y + MJ_TD / 2, z: S.e.z + S.f.z * 0.068 + S.r.z * o, ry: S.rot, rx: -Math.PI / 2 });
      }
      G.discards[s].forEach((id, k) => {
        const col = k % 6, row = (k / 6) | 0, o = (col - 2.5) * (MJ_TW + 0.002), a = 0.125 + row * (MJ_TH + 0.003);
        out.set(id, { x: S.e.x + S.f.x * a + S.r.x * o, y: y + MJ_TD / 2, z: S.e.z + S.f.z * a + S.r.z * o, ry: S.rot, rx: -Math.PI / 2 });
      });
    }
    return out;
  },
  async layout(instant) {
    const want = this.targets(), moves = [];
    this.ex.pieces.forEach((m, id) => {
      const t = want.get(id);
      if (!t) { m.visible = false; return; }
      if (instant || !m.visible) { m.visible = true; m.position.set(t.x, t.y, t.z); m.rotation.set(t.rx, t.ry, 0); return; }
      const dx = t.x - m.position.x, dz = t.z - m.position.z, dy = t.y - m.position.y, drx = t.rx - m.rotation.x;
      if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) + Math.abs(drx) < 1e-4) return;
      moves.push({ m, from: { x: m.position.x, y: m.position.y, z: m.position.z, rx: m.rotation.x, ry: m.rotation.y }, t });
    });
    if (!moves.length) return;
    await tween(0.22, k => { for (const { m, from, t } of moves) { m.position.set(from.x + (t.x - from.x) * k, from.y + (t.y - from.y) * k + Math.sin(k * Math.PI) * 0.03, from.z + (t.z - from.z) * k); m.rotation.set(from.rx + (t.rx - from.rx) * k, from.ry + (t.ry - from.ry) * k, 0); } });
  },
  meshesFor(m) { return m.kind === 'discard' ? [this.ex.pieces[m.tile]] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.mahjong, res = G.apply(m);
    if (m.kind === 'discard' || m.kind === 'draw') sfx.card();
    await this.layout(false);
    if (m.pl === 1 && m.kind === 'discard') await wait(120);
    return res;
  },
  score: () => { const G = GAMES.mahjong, sh = G.shanten(G.hands[0], G.open(0)); return [['Wall', String(G.wall.length)], ['Your hand', sh < 0 ? 'complete' : sh === 0 ? 'ready' : `${sh} from ready`], '']; },
};
const BAO_P = {
  camW: 1.0, ringScale: 0.75,
  intro() { return 'Your sixteen pits are the two rows nearest you, and you move first. ' + this.prompt(); },
  prompt: () => {
    const ms = GAMES.bao.legal(0);
    return ms.length && ms[0].mtaji ? 'You can capture, so you must: pick a pit, then the ring on the side to sow toward.' : 'No capture is open. Pick a pit (from your inner row if you can), then the ring on the side to sow toward.';
  },
  setup(ex) {
    const G = GAMES.bao;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    this.ex = ex; this.pitMeshes = ex.group.userData.pits;
    if (!ex.seeds) {
      const cols = [0x8a8070, 0x6f6658, 0x9d9482, 0x7c705e];
      ex.seeds = Array.from({ length: 64 }, (_, i) => {
        const m = new THREE.Mesh(seedGeo, new THREE.MeshStandardMaterial({ color: cols[i % 4], roughness: 0.4 }));
        m.scale.set(0.85, 0.75, 1); m.rotation.y = rand(0, TAU); ex.group.add(m); return m;
      });
    }
    ex.seeds.forEach(m => { m.visible = true; });
    this.pit = Array.from({ length: 32 }, () => []);
    let k = 0;
    for (let i = 0; i < 32; i++) for (let n = 0; n < G.p[i]; n++) { const m = ex.seeds[k++]; this.pit[i].push(m); m.position.copy(this.slot(i, n)); }
  },
  leave(ex) {
    ex.group.userData.display.forEach(m => { m.visible = true; });
    (ex.seeds || []).forEach(m => { m.visible = false; });
  },
  slot(i, k) {
    const b = baoPos(i), per = 9, layer = Math.floor(k / per), j = k % per;
    const a = j * 2.39996 + layer * 1.3, rr = Math.min(0.024, 0.0085 * Math.sqrt(j + 0.6));
    return V3(b.x + Math.cos(a) * rr, GAMES.bao.surface + 0.007 + layer * 0.011, b.z + Math.sin(a) * rr);
  },
  meshesFor(m) { return [this.pitMeshes[m.pit]]; },
  ringFor(m) { const p = baoPos(GAMES.bao.next(m.pit, m.dir)); return V3(p.x, GAMES.bao.surface, p.z); },
  async play(m) {
    const G = GAMES.bao, tok = play.token, res = G.apply(m);
    const dur = res.trace.length > 70 ? 0.055 : 0.1;
    let hand = [];
    for (const [i, n] of res.trace) {
      if (tok !== play.token) return res;
      if (n === 0) { // everything in this pit is lifted into the hand
        const b = baoPos(i), up = this.pit[i].splice(0);
        await Promise.all(up.map((s, k) => hop(s, V3(b.x + (k % 5 - 2) * 0.006, G.surface + 0.05 + Math.floor(k / 5) * 0.012, b.z), 0.14, 0.02)));
        hand = hand.concat(up);
      } else {
        const s = hand.shift(); if (!s) continue;
        const v = this.slot(i, this.pit[i].length); this.pit[i].push(s);
        // the rest of the hand travels along above the pit being sown
        hand.forEach((h, k) => { h.position.x = v.x + (k % 5 - 2) * 0.006; h.position.z = v.z; });
        await hop(s, v, dur, 0.03);
      }
    }
    return res;
  },
  score: () => { const G = GAMES.bao; return [['You', G.count(0)], ['Scribe', G.count(1)], 'seeds']; },
};
const LANDLORD_P = {
  camW: 1.32, ringScale: 0.8,
  intro() { return 'You play the pale checker and throw first. ' + this.prompt(); },
  prompt() {
    const G = GAMES.landlord;
    if (G.ticketsOpen[0]) return `Your lot tickets: ${G.tickets[0].join(', ')}. Buy any of those lots now if you like, then start.`;
    if (G.jailed[0]) return 'You are in jail. Pay the $50 fine, or throw for a double.';
    const debt = G.notes[0] ? `, notes owed $${100 * G.notes[0]}` : '';
    return G.laps[0] >= G.ROUNDS ? `You have been round ${G.ROUNDS} times${debt}. Throw when you are ready.` : `Round ${G.laps[0] + 1} of ${G.ROUNDS}. Cash $${G.cash[0]}${debt}. Throw when you are ready.`;
  },
  choosePrompt: () => 'Pick your checker, then the glowing space to go to.',
  spot(pl, k) { const p = llSpace(k), side = Math.abs(p.ox) === 1 ? [0, 1] : Math.abs(p.oz) === 1 ? [1, 0] : [0.7, -0.7]; const o = (pl ? 1 : -1) * 0.016; return V3(p.x + p.ox * 0.025 + side[0] * o, GAMES.landlord.surface + 0.007, p.z + p.oz * 0.025 + side[1] * o); },
  deedSpot(k) { const p = llSpace(k); return V3(p.x - p.ox * 0.03, GAMES.landlord.surface + 0.0015, p.z - p.oz * 0.03); },
  setup(ex) {
    const G = GAMES.landlord;
    if (!ex.tokens) ex.tokens = [0, 1].map(pl => {
      const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x1d1a17 : 0xe9dfc6, roughness: pl ? 0.3 : 0.45 });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.012, 24), mat); m.userData.mats = [mat]; ex.group.add(m); return m;
    });
    (ex.deeds || []).forEach(d => ex.group.remove(d)); ex.deeds = [];
    this.ex = ex; this.deedAt = {};
    ex.tokens.forEach((t, pl) => { t.visible = true; t.position.copy(this.spot(pl, G.pos[pl])); });
  },
  leave(ex) { (ex.tokens || []).forEach(t => { t.visible = false; }); (ex.deeds || []).forEach(d => ex.group.remove(d)); ex.deeds = []; },
  async syncDeeds() { // a deed on every bought lot, a charter on every taken franchise
    const G = GAMES.landlord, jobs = [];
    const add = (k, pl, w, d) => {
      const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x2b2622 : 0xf4ecd6, roughness: 0.8 });
      const card = new THREE.Mesh(new THREE.BoxGeometry(w, 0.002, d), mat);
      const p = llSpace(k); card.rotation.y = Math.abs(p.ox) === 1 ? Math.PI / 2 : 0;
      card.position.copy(this.spot(pl, G.pos[pl])); card.position.y += 0.03; this.ex.group.add(card); this.ex.deeds.push(card); this.deedAt[k] = card;
      jobs.push(hop(card, this.deedSpot(k), 0.4, 0.06));
    };
    for (let n = 1; n <= 22; n++) { const k = G.lotAt(n); if (G.owner[n] >= 0 && !this.deedAt[k]) add(k, G.owner[n], 0.05, 0.034); }
    for (const k of [13, 27]) if (G.fran[k] >= 0 && !this.deedAt[k]) add(k, G.fran[k], 0.046, 0.03);
    await Promise.all(jobs);
  },
  meshesFor(m) { return m.kind === 'move' ? [this.ex.tokens[m.pl]] : []; },
  ringFor(m) { if (m.kind !== 'move') return null; const p = llSpace(m.to); return V3(p.x, GAMES.landlord.surface, p.z); },
  fromFor(m) { if (m.kind !== 'move') return null; const p = llSpace(m.from); return V3(p.x, GAMES.landlord.surface, p.z); },
  async play(m) {
    const G = GAMES.landlord, tok = play.token, t = this.ex.tokens[m.pl];
    if (m.kind === 'move') for (const k of G.steps(m)) { if (tok !== play.token) return {}; await hop(t, this.spot(m.pl, k), 0.15, 0.04); }
    const res = G.apply(m);
    if (tok !== play.token) return res;
    const at = this.spot(m.pl, G.pos[m.pl]);
    if (t.position.distanceTo(at) > 0.01) await hop(t, at, 0.5, 0.1);
    await this.syncDeeds();
    return res;
  },
  score: () => { const G = GAMES.landlord; return [['You', '$' + G.worth(0)], ['Scribe', '$' + G.worth(1)], 'worth']; },
};
const CHINESE_P = {
  camW: 1.08, ringScale: 0.45,
  intro() { return 'You play red, from the point of the star nearest you, and move first. ' + this.prompt(); },
  prompt: () => 'Pick a marble, then a ring. Rings beyond a neighbouring marble are hops, and a chain of hops is one move.',
  setup(ex) {
    const G = GAMES.chinese;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 10 }, () => { const m = ccMarble(CC_COLS[pl]); ex.group.add(m); return m; }));
    ex.pieces.flat().forEach(m => { m.visible = true; });
    this.cell = Array(G.N).fill(null); const k = [0, 0];
    for (let i = 0; i < G.N; i++) { if (!G.b[i]) continue; const pl = G.b[i] - 1, m = ex.pieces[pl][k[pl]++]; this.cell[i] = m; m.position.copy(this.pos(i)); }
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).flat().forEach(m => { m.visible = false; }); },
  pos(i) { const c = ccCell(i); return V3(c.x, GAMES.chinese.surface + 0.016, c.z); },
  meshesFor(m) { return m.pass ? [] : [this.cell[m.from]]; },
  ringFor(m) { return m.pass ? null : V3(ccCell(m.to).x, GAMES.chinese.surface, ccCell(m.to).z); },
  fromFor(m) { return m.pass ? null : V3(ccCell(m.from).x, GAMES.chinese.surface, ccCell(m.from).z); },
  async play(m) {
    const G = GAMES.chinese, tok = play.token;
    if (m.pass) return G.apply(m);
    const mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    for (const sq of m.path) { if (tok !== play.token) return res; await hop(mesh, this.pos(sq), m.hop ? 0.22 : 0.18, m.hop ? 0.05 : 0.02); }
    return res;
  },
  score: () => { const G = GAMES.chinese; return [['You', G.home(0)], ['Scribe', G.home(1)], 'marbles home of 10']; },
};
const HEX_P = {
  camW: 1.0, ringOpacity: 0.45,
  get ringScale() { return GAMES.hex.n > 9 ? 0.5 : GAMES.hex.n > 7 ? 0.6 : 0.75; },
  intro() { return 'You play red: join the red edges nearest and farthest from you. The Scribe joins the blue sides. ' + this.prompt(); },
  prompt: () => 'Choose a ring to place a stone.',
  setup(ex) {
    const G = GAMES.hex, h = ex.group.userData.hex;
    h.display.forEach(m => { m.visible = false; }); h.face(G.n);
    if (!ex.pieces) ex.pieces = [];
    ex.pieces.forEach(m => { ex.group.remove(m); }); ex.pieces = [];
    this.ex = ex; this.cell = Array(G.n * G.n).fill(null);
  },
  leave(ex) { const h = ex.group.userData.hex; h.display.forEach(m => { m.visible = true; }); h.face(11); (ex.pieces || []).forEach(m => { ex.group.remove(m); }); ex.pieces = []; },
  pos(i) { const c = hxCell(GAMES.hex.n, i); return V3(c.x, GAMES.hex.surface, c.z); },
  meshesFor: () => [],
  ringFor(m) { return m.swap ? null : this.pos(m.at); },
  fromFor: () => null,
  stone(pl, i) {
    const d = hxD(GAMES.hex.n), m = new THREE.Mesh(hxStoneGeo, HX_MATS[pl]); m.scale.set(d * 0.42, 0.03, d * 0.42);
    const p = this.pos(i); m.position.set(p.x, p.y + 0.06, p.z); this.ex.group.add(m); this.ex.pieces.push(m); this.cell[i] = m; return m;
  },
  async play(m) {
    const G = GAMES.hex, res = G.apply(m);
    if (res.swap) {
      const s = this.cell[res.swap.from]; this.cell[res.swap.from] = null; this.cell[res.swap.to] = s;
      s.material = HX_MATS[1]; await hop(s, V3(this.pos(res.swap.to).x, G.surface + 0.006, this.pos(res.swap.to).z), 0.5, 0.08);
      return res;
    }
    const s = this.stone(m.pl, m.at), y = G.surface + 0.006;
    await tween(0.18, k => { s.position.y = y + 0.06 * (1 - k); }, k => k * k);
    return res;
  },
  score: () => { const G = GAMES.hex; let a = 0, b = 0; G.b.forEach(v => { if (v === 1) a++; else if (v === 2) b++; }); return [['You', a], ['Scribe', b], `stones · ${G.n} × ${G.n}`]; },
};
const GOMOKU_P = {
  camW: 0.98, ringScale: 0.4, ringOpacity: 0.3,
  intro() { return 'You play black and move first. ' + this.prompt(); },
  prompt: () => 'Choose a ring to place a stone. Five in a row wins.',
  setup(ex) {
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [];
    ex.pieces.forEach(m => { ex.group.remove(m); }); ex.pieces = []; this.ex = ex; this.cell = Array(225).fill(null);
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => { ex.group.remove(m); }); ex.pieces = []; },
  pos(i) { const c = gmCell(i); return V3(c.x, GAMES.gomoku.surface, c.z); },
  meshesFor: () => [],
  ringFor(m) { return this.pos(m.at); },
  fromFor: () => null,
  async play(m) {
    const G = GAMES.gomoku, res = G.apply(m);
    const s = new THREE.Mesh(gmStoneGeo, GO9_MATS[m.pl]); s.scale.y = 0.42; this.ex.group.add(s); this.ex.pieces.push(s); this.cell[m.at] = s;
    const to = this.pos(m.at); to.y += 0.0095; s.position.set(to.x, to.y + 0.07, to.z);
    await tween(0.16, k => { s.position.y = to.y + 0.07 * (1 - k); }, k => k * k);
    return res;
  },
  onFinish() { // lift the winning line a little
    const G = GAMES.gomoku; if (!G.line) return;
    G.line.forEach(i => { const s = this.cell[i]; if (s) hop(s, V3(s.position.x, s.position.y + 0.012, s.position.z), 0.4, 0.02); });
  },
  score: () => { const G = GAMES.gomoku; return [['Stones', G.ply], ['Points left', 225 - G.ply], '']; },
};
const DOMINOES_P = {
  camW: 1.2, ringScale: 0.55,
  intro() { return 'You lead first, with any tile. ' + this.prompt(); },
  prompt() {
    const G = GAMES.dominoes;
    if (!G.ends) return 'Click any tile in your hand to lead.';
    const ms = G.legal(0);
    if (ms[0] && ms[0].kind === 'draw') return `Open ends: ${G.ends[0]} and ${G.ends[1]}. Nothing in your hand fits, so draw from the boneyard.`;
    if (ms[0] && ms[0].kind === 'pass') return `Open ends: ${G.ends[0]} and ${G.ends[1]}. Nothing fits and only two tiles are left in the boneyard, so you pass.`;
    return `Open ends: ${G.ends[0]} and ${G.ends[1]}. Click a glowing tile to play it; if it fits both ends, pick the ring.`;
  },
  SP: DM_L + 0.004, ROW: 0.07,
  // Where the k-th tile out from the first one sits: rows of six, snaking back and forth.
  arm(k) {
    if (k === 0) return { x: 0, z: 0, dir: 1 };
    const sg = k > 0 ? 1 : -1, j = Math.abs(k), SP = this.SP;
    if (j <= 6) return { x: sg * j * SP, z: 0, dir: sg };
    if (j <= 12) return { x: sg * (6.5 - (j - 6)) * SP, z: -sg * this.ROW, dir: -sg };
    return { x: sg * (0.5 + (j - 12)) * SP, z: -sg * 2 * this.ROW, dir: sg };
  },
  setup(ex) {
    const G = GAMES.dominoes;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.tiles) ex.tiles = Array.from({ length: 28 }, (_, t) => { const m = dmTile(t); ex.group.add(m); return m; });
    this.ex = ex; this.left = 0;
    ex.tiles.forEach(m => { m.visible = true; m.rotation.set(0, 0, 0); });
    G.yard.forEach((t, k) => { const m = ex.tiles[t]; m.rotation.set(Math.PI, Math.PI / 2, 0); m.position.copy(this.yardPos(k)); });
    this.layHands(false);
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.tiles || []).forEach(m => { m.visible = false; }); },
  yardPos(k) { return V3(0.49 + (k % 2) * (DM_Wd + 0.008), GAMES.dominoes.surface + DM_H / 2, -0.25 + ((k / 2) | 0) * (DM_L + 0.006)); },
  handPos(pl, k, n) {
    const per = 13, row = (k / per) | 0, kk = k % per, m = Math.min(n - row * per, per), sp = DM_L + 0.005;
    return V3(-0.04 + (kk - (m - 1) / 2) * sp, GAMES.dominoes.surface + DM_Wd / 2, (pl === 0 ? 1 : -1) * (0.36 - row * 0.055));
  },
  async layHands(animate) {
    const G = GAMES.dominoes, jobs = [];
    for (const pl of [0, 1]) {
      const h = G.hands[pl].slice().sort((x, y) => x - y);
      h.forEach((t, k) => {
        const m = this.ex.tiles[t], to = this.handPos(pl, k, h.length);
        m.rotation.set(pl === 0 ? Math.PI / 2 - 0.35 : -Math.PI / 2 + 0.35, 0, 0);
        if (animate) jobs.push(hop(m, to, 0.25, 0.02)); else m.position.copy(to);
      });
    }
    await Promise.all(jobs);
  },
  linePos(k) { const a = this.arm(k); return V3(a.x, GAMES.dominoes.surface + DM_H / 2, a.z); },
  meshesFor(m) { return m.kind === 'play' ? [this.ex.tiles[m.t]] : []; },
  ringFor(m) {
    if (m.kind !== 'play') return null;
    const G = GAMES.dominoes;
    if (!G.ends) return this.linePos(0).setY(GAMES.dominoes.surface);
    const k = m.side === 0 ? -(this.left + 1) : G.line.length - this.left;
    return this.linePos(k).setY(GAMES.dominoes.surface);
  },
  async play(m) {
    const G = GAMES.dominoes, tok = play.token;
    const k = m.kind === 'play' ? (!G.ends ? 0 : m.side === 0 ? -(this.left + 1) : G.line.length - this.left) : null;
    const res = G.apply(m);
    if (m.kind === 'draw') {
      const tile = this.ex.tiles[res.drew];
      tile.rotation.set(m.pl === 0 ? Math.PI / 2 - 0.35 : -Math.PI / 2 + 0.35, 0, 0);
      await this.layHands(true);
      return res;
    }
    if (m.kind !== 'play') return res;
    if (m.side === 0 && k !== 0) this.left++;
    const tile = this.ex.tiles[m.t], a = this.arm(k), [lo] = G.TILES[m.t];
    // Turn the tile so the half that joins the line faces back along it.
    const pl = res.placed, inner = k === 0 ? pl.l : k > 0 ? pl.l : pl.r, outer = k === 0 ? pl.r : k > 0 ? pl.r : pl.l;
    const atMinusX = a.dir > 0 ? inner : outer;
    const rotY = atMinusX === lo ? 0 : Math.PI;
    const from = tile.rotation.clone(), to = this.linePos(k);
    const p0 = tile.position.clone();
    await tween(0.35, e => {
      tile.position.lerpVectors(p0, to, e); tile.position.y += Math.sin(e * Math.PI) * 0.05;
      tile.rotation.set(from.x * (1 - e), from.y + (rotY - from.y) * e, 0);
    }, e => e);
    if (tok !== play.token) return res;
    await this.layHands(true);
    return res;
  },
  score: () => { const G = GAMES.dominoes; return [['You', G.hands[0].length], ['Scribe', G.hands[1].length], `tiles · ${G.yard.length} in the boneyard`]; },
};
const TABLUT_P = {
  camW: 1.12, ringScale: 0.7,
  intro() { return 'The Scribe\'s Muscovites move first. ' + this.prompt(); },
  prompt: () => 'Pick one of your pieces, then where it should go. Get the king to any edge square.',
  setup(ex) {
    const G = GAMES.tablut;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(81).fill(null); this.lost = [0, 0];
    G.b.forEach((v, i) => { if (!v) return; const m = tbPiece(v); m.position.copy(this.pos(i)); ex.group.add(m); ex.pieces.push(m); this.cell[i] = m; m.userData.v = v; });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  pos(i) { const c = tbCell(i); return V3(c.x, GAMES.tablut.surface, c.z); },
  lostSpot: (owner, k) => V3(owner === 1 ? 0.5 : -0.5, TOP, -0.36 + (k % 9) * 0.08),
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.tablut, mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m), from = mesh.position.clone(), to = this.pos(m.to);
    await tween(0.2 + from.distanceTo(to) * 0.5, k => { mesh.position.lerpVectors(from, to, k); mesh.position.y += Math.sin(k * Math.PI) * 0.025; });
    for (const c of res.caps) {
      const cm = this.cell[c]; this.cell[c] = null;
      if (cm.userData.v === 3) { await tween(0.6, k => { cm.rotation.z = k * 1.45; }); continue; }
      const owner = cm.userData.v === 1 ? 1 : 0;
      await hop(cm, this.lostSpot(owner, this.lost[owner]++), 0.42, 0.14);
    }
    return res;
  },
  score: () => [['Your side', GAMES.tablut.count(0)], ['Muscovites', GAMES.tablut.count(1)], 'pieces'],
};
const MAKRUK_P = {
  camW: 1.0,
  intro() { return 'You play white and move first. ' + this.prompt(); },
  prompt() {
    const c = GAMES.makruk.count;
    const counting = c ? ` The count is ${c.n} of ${c.lim}.` : '';
    return 'Pick a piece, then a ring.' + counting;
  },
  setup(ex) {
    const G = GAMES.makruk;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(64).fill(null); this.lost = [0, 0];
    G.b.forEach((v, i) => { if (v) this.cell[i] = this.make(v, i); });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  make(v, i) { const o = mkPiece(v); o.position.copy(this.pos(i)); this.ex.group.add(o); this.ex.pieces.push(o); return o; },
  pos(i) { const c = mkCell(i); return V3(c.x, GAMES.makruk.surface, c.z); },
  lostSpot(owner, k) { return V3(owner ? -0.45 : 0.45, TOP, (owner ? -0.3 : 0.3) * (1 - (k % 8) / 8 * 2) * 0.9); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  async play(m) {
    const G = GAMES.makruk, tok = play.token, mesh = this.cell[m.from], victim = this.cell[m.to];
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.32, (G.b[m.to] & 7) === 4 ? 0.08 : 0.03);
    if (tok !== play.token) return res;
    if (victim) { const owner = 1 - m.pl; hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12); }
    if (m.promo) { mesh.visible = false; this.cell[m.to] = this.make(G.b[m.to], m.to); }
    return res;
  },
  score: () => { const G = GAMES.makruk; return [['You', G.pieces(0)], ['Scribe', G.pieces(1)], 'pieces']; },
};
const CHATURAJI_P = {
  camW: 1.25,
  intro() { return 'You are yellow, nearest you. Black sits on your left, Red across, Green on your right, and play goes to your left. Throw the dice.'; },
  prompt() { return `Round ${GAMES.chaturaji.round} of ${GAMES.chaturaji.ROUNDS}. Throw the dice.`; },
  choosePrompt: moves => `Pick a glowing piece, then its ring${moves.some(m => m.pass) ? ', or press Skip' : ''}.`,
  setup(ex) {
    const G = GAMES.chaturaji;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(64).fill(null); this.won = [0, 0, 0, 0]; this.dimmed = [false, false, false, false];
    G.b.forEach((v, i) => { if (v) this.cell[i] = this.make(v, i); });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  make(v, i) { const o = cjPiece(v); o.position.copy(this.pos(i)); this.ex.group.add(o); this.ex.pieces.push(o); return o; },
  pos(i) { const c = cjCell(i); return V3(c.x, GAMES.chaturaji.surface, c.z); },
  // Pieces taken go to the edge of the board in front of whoever took them.
  wonSpot(seat, k) {
    const t = (k % 9 - 4) * 0.075, row = 0.44 + Math.floor(k / 9) * 0.06, y = TOP;
    return [V3(t, y, row), V3(-row, y, -t), V3(-t, y, -row), V3(row, y, t)][seat];
  },
  meshesFor(m) { return m.pass ? [] : [this.cell[m.from]]; },
  ringFor(m) { return m.pass ? null : this.pos(m.to); },
  fromFor(m) { return m.pass ? null : this.pos(m.from); },
  async play(m) {
    const G = GAMES.chaturaji, tok = play.token;
    if (m.pass) return G.apply(m);
    const mesh = this.cell[m.from], victims = [];
    const res = G.apply(m);
    for (const j of res.captured) { victims.push(this.cell[j]); this.cell[j] = null; }
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const t = G.b[m.to] & 7;
    await hop(mesh, this.pos(m.to), 0.3, t === 3 || t === 4 ? 0.07 : 0.03);
    if (tok !== play.token) return res;
    for (const v of victims) if (v) hop(v, this.wonSpot(m.seat, this.won[m.seat]++), 0.4, 0.12);
    if (res.promo) { mesh.visible = false; this.cell[m.to] = this.make(G.b[m.to], m.to); }
    // An army whose king has fallen fades, but stays to be taken.
    for (let s = 1; s < 4; s++) if (!G.alive[s] && !this.dimmed[s]) {
      this.dimmed[s] = true;
      this.cell.forEach(o => { if (o && o.userData.seat === s) o.userData.mats.forEach(mt => { mt.color.multiplyScalar(0.55); mt.transparent = true; mt.opacity = 0.75; }); });
    }
    return res;
  },
  scores() {
    const G = GAMES.chaturaji;
    return [['You', G.score[0]], ...[1, 2, 3].map(s => [G.SEATS[s] + (G.alive[s] ? '' : ' (out)'), G.score[s]]), `round ${Math.min(G.round, G.ROUNDS)}/${G.ROUNDS}`];
  },
  score() { const L = this.scores(); return [L[0], L[1], L.slice(2).map(x => Array.isArray(x) ? x.join(' ') : x).join(' · ')]; },
};
const SEEGA_P = {
  camW: 0.95,
  intro() { return 'You have the dark stones, the Scribe the red clay. Place two stones at a time on empty cups, never the centre.'; },
  prompt() { const G = GAMES.seega; return G.placing() ? 'Place two stones on empty cups.' : !G.started ? 'Your first move must go into the centre.' : 'Pick a stone, then a ring. Trap a piece between two of yours to take it.'; },
  setup(ex) {
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 12 }, () => { const s = sgStone(pl); ex.group.add(s); return s; }));
    this.cell = Array(25).fill(null); this.used = [0, 0]; this.lost = [0, 0];
    ex.pieces.forEach((list, pl) => list.forEach((s, k) => { s.visible = true; s.position.copy(this.handSpot(pl, k)); }));
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).flat().forEach(s => { s.visible = false; }); },
  pos(i) { const c = sgCell(i); return V3(c.x, GAMES.seega.surface + 0.012, c.z); },
  // Stones wait in two rows on their owner's side of the slab; lost stones go to the side.
  handSpot(pl, k) { return V3((pl ? 1 : -1) * (0.2 - ((k / 2) | 0) * 0.075), TOP + 0.012, (pl ? -1 : 1) * (0.34 + (k % 2) * 0.065)); },
  lostSpot(owner, k) { return V3((owner ? -1 : 1) * (0.36 + ((k / 6) | 0) * 0.065), TOP + 0.012, (owner ? -1 : 1) * (0.2 - (k % 6) * 0.07)); },
  meshesFor(m) { return m.place !== undefined ? [] : [this.cell[m.lift !== undefined ? m.lift : m.from]]; },
  ringFor(m) { return m.place !== undefined ? this.pos(m.place) : m.lift !== undefined ? null : this.pos(m.to); },
  ringTone: m => (m.cap ? 'ember' : 'gold'),
  fromFor(m) { return m.from !== undefined ? this.pos(m.from) : null; },
  async play(m) {
    const G = GAMES.seega, tok = play.token, ex = play.ex;
    if (m.place !== undefined) {
      const s = ex.pieces[m.pl][this.used[m.pl]++]; this.cell[m.place] = s;
      const res = G.apply(m); await hop(s, this.pos(m.place), 0.35, 0.08); return res;
    }
    if (m.lift !== undefined) {
      const s = this.cell[m.lift]; this.cell[m.lift] = null; const res = G.apply(m);
      await hop(s, this.lostSpot(m.pl, this.lost[m.pl]++), 0.4, 0.1); return res;
    }
    const s = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = s;
    const res = G.apply(m);
    await hop(s, this.pos(m.to), 0.26, 0.03);
    if (tok !== play.token) return res;
    for (const j of res.taken) { const v = this.cell[j]; this.cell[j] = null; if (v) hop(v, this.lostSpot(1 - m.pl, this.lost[1 - m.pl]++), 0.4, 0.12); }
    return res;
  },
  score: () => { const G = GAMES.seega; return [['You', G.count(0) + 12 - G.placed[0]], ['Scribe', G.count(1) + 12 - G.placed[1]], 'stones']; },
};

const TAB_P = {
  camW: 0.95,
  intro() { return 'You have the dark stones nearest you. Throw the sticks: you need a tâb (one white side) to start a piece.'; },
  prompt() { return 'Throw the sticks.'; },
  choosePrompt: moves => (moves.length > 1 ? 'Pick a glowing piece, then its ring.' : 'Pick the glowing piece to move it.'),
  setup(ex) {
    const G = GAMES.tab;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = G.pc.map(p => { const m = tabPiece(p.pl); ex.group.add(m); return m; });
    this.lost = [0, 0];
    ex.pieces.forEach((m, k) => { m.visible = true; m.userData.band.visible = false; m.position.copy(this.pos(G.pc[k].cell)); });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => { m.visible = false; }); },
  pos(i) { const c = tabCell(i); return V3(c.x, GAMES.tab.surface + 0.007, c.z); },
  lostSpot(owner, k) { return V3(-0.28 + (k % 9) * 0.07, TOP + 0.007, owner ? -0.24 : 0.24); },
  meshesFor(m) { return [play.ex.pieces[m.piece]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  ringTone: m => (m.cap ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES.tab, tok = play.token, mesh = play.ex.pieces[m.piece];
    const victim = G.at[m.to] >= 0 ? play.ex.pieces[G.at[m.to]] : null;
    const res = G.apply(m);
    for (const sq of m.path) { if (tok !== play.token) return res; await hop(mesh, this.pos(sq), 0.16, 0.03); }
    mesh.userData.band.visible = true; // a piece that has set out wears a pale ring
    if (victim) { const owner = 1 - m.pl; hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12); }
    return res;
  },
  score: () => { const G = GAMES.tab; return [['You', G.count(0)], ['Scribe', G.count(1)], 'pieces']; },
};

const BAGHCHAL_P = {
  camW: 1.0,
  intro() { const G = GAMES.baghchal; return G.goatPl === 0 ? 'You lead the goats and move first: place a goat on any empty point. Trap all four tigers to win.' : 'You lead the tigers; the Scribe\'s goats move first. Take five goats to win.'; },
  prompt() { const G = GAMES.baghchal; return G.goatPl === 0 ? (G.inHand ? `Place a goat (${G.inHand} left to place).` : 'Pick a goat, then a ring.') : 'Pick a tiger, then a ring. Jump a goat to take it.'; },
  setup(ex) {
    const G = GAMES.baghchal;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) { ex.pieces = { tigers: [0, 1, 2, 3].map(() => { const t = bcTiger(); ex.group.add(t); return t; }), goats: Array.from({ length: 20 }, () => { const t = bcGoat(); ex.group.add(t); return t; }) }; }
    this.cell = Array(25).fill(null); this.used = 0; this.lost = 0;
    ex.pieces.tigers.forEach((t, k) => { t.visible = true; const i = [0, 4, 20, 24][k]; t.position.copy(this.pos(i)); this.cell[i] = t; });
    ex.pieces.goats.forEach((t, k) => { t.visible = true; t.position.copy(this.handSpot(k)); });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); if (ex.pieces) [...ex.pieces.tigers, ...ex.pieces.goats].forEach(m => { m.visible = false; }); },
  pos(i) { const c = bcCell(i); return V3(c.x, GAMES.baghchal.surface, c.z); },
  // Goats wait beside the board on the goat player's side; taken goats go to the other side.
  handSpot(k) { const near = GAMES.baghchal.goatPl === 0; return V3(-0.33 + (k % 10) * 0.073, TOP, (near ? 1 : -1) * (0.36 + ((k / 10) | 0) * 0.06)); },
  lostSpot(k) { const near = GAMES.baghchal.goatPl === 0; return V3(0.4, TOP, (near ? -1 : 1) * (0.25 - k * 0.07)); },
  meshesFor(m) { return m.place !== undefined ? [] : [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.place !== undefined ? m.place : m.to); },
  fromFor(m) { return m.from !== undefined ? this.pos(m.from) : null; },
  ringTone: m => (m.cap ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES.baghchal, tok = play.token;
    if (m.place !== undefined) {
      const goat = play.ex.pieces.goats[this.used++]; this.cell[m.place] = goat;
      const res = G.apply(m); await hop(goat, this.pos(m.place), 0.35, 0.08); return res;
    }
    const mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const victim = m.over !== undefined ? this.cell[m.over] : null; if (victim) this.cell[m.over] = null;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), victim ? 0.34 : 0.26, victim ? 0.09 : 0.03);
    if (tok !== play.token) return res;
    if (victim) hop(victim, this.lostSpot(this.lost++), 0.4, 0.12);
    return res;
  },
  score: () => { const G = GAMES.baghchal; return [['Goats taken', `${G.taken} of 5`], ['Goats to place', G.inHand], '']; },
};

const FOURSEASONS_P = {
  camW: 1.15, ringScale: 0.78,
  intro() { return 'You are Red, summer, in the corner by your left hand. Green moves first; then you, Black and White, each for itself.'; },
  prompt() { return 'Pick a piece, then a ring.'; },
  setup(ex) {
    const G = GAMES.fourseasons;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(64).fill(null); this.won = [0, 0, 0, 0];
    G.b.forEach((v, i) => { if (v) this.cell[i] = this.make(v, i); });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  make(v, i) { const o = fsPiece(v); o.userData.v = v; o.position.copy(this.pos(i)); this.ex.group.add(o); this.ex.pieces.push(o); return o; },
  pos(i) { const c = fsCell(i); return V3(c.x, GAMES.fourseasons.surface, c.z); },
  // Pieces taken line up in front of the taker's corner.
  wonSpot(seat, k) { const x = (seat === 0 || seat === 3 ? -0.2 : 0.2) + ((k % 6) - 2.5) * 0.06, z = (seat < 2 ? 1 : -1) * (0.42 + ((k / 6) | 0) * 0.06); return V3(x, TOP, z); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  ringTone: m => (m.cap ? 'ember' : 'gold'),
  // Bring every mesh into line with the board: armies that change hands take their new owner's colour.
  sync() {
    const G = GAMES.fourseasons;
    for (let i = 0; i < 64; i++) {
      const v = G.b[i], o = this.cell[i];
      if (!v && o) { o.visible = false; this.cell[i] = null; continue; }
      if (v && (!o || o.userData.v !== v)) { if (o) o.visible = false; this.cell[i] = this.make(v, i); }
    }
  },
  async play(m) {
    const G = GAMES.fourseasons, tok = play.token;
    const mesh = this.cell[m.from], victim = this.cell[m.to];
    const res = G.apply(m);
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    await hop(mesh, this.pos(m.to), 0.3, (G.b[m.to] & 7) === 3 || (G.b[m.to] & 7) === 4 ? 0.07 : 0.03);
    if (tok !== play.token) return res;
    if (victim) hop(victim, this.wonSpot(m.seat, this.won[m.seat]++), 0.4, 0.12);
    this.sync();
    return res;
  },
  scores() {
    const G = GAMES.fourseasons;
    return [['You', G.alive[0] ? G.material(0) : 'out'], ...[1, 2, 3].map(s => [G.SEATS[s], G.alive[s] ? G.material(s) : 'out']), `round ${Math.min(G.round, G.ROUNDS)}/${G.ROUNDS}`];
  },
  score() { const L = this.scores(); return [L[0], L[1], L.slice(2).map(x => Array.isArray(x) ? x.join(' ') : x).join(' · ')]; },
};
const KALAH_P = {
  camW: 1.2, ringScale: 1.2,
  intro() { return 'Your six pits are the row nearest you, and your store is on your right. ' + this.prompt(); },
  prompt: () => 'Choose one of your glowing pits to sow.',
  setup(ex) {
    const G = GAMES.kalah;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    this.ex = ex; this.pitMeshes = ex.group.userData.pits;
    const need = G.seeds * 12;
    if (!ex.seeds) ex.seeds = [];
    const cols = [0x6a8aa8, 0x8aa86a, 0xa86a6a, 0xa8986a, 0x9a7aa8];
    while (ex.seeds.length < need) { const sd = new THREE.Mesh(seedGeo, new THREE.MeshStandardMaterial({ color: cols[ex.seeds.length % 5], roughness: 0.25 })); ex.group.add(sd); ex.seeds.push(sd); }
    ex.seeds.forEach((sd, k) => { sd.visible = k < need; });
    this.at = Array.from({ length: 14 }, () => []);
    let k = 0;
    for (let i = 0; i < 14; i++) for (let n = 0; n < G.p[i]; n++) { const sd = ex.seeds[k++]; this.at[i].push(sd); sd.position.copy(this.slot(i, n)); }
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.seeds || []).forEach(sd => { sd.visible = false; }); },
  slot(i, k) {
    const store = i === 6 || i === 13, b = store ? klStore(i === 6 ? 0 : 1) : klPit(i), per = store ? 18 : 10;
    const layer = Math.floor(k / per), j = k % per, a = j * 2.39996 + layer * 1.3, rr = Math.min(store ? 0.05 : 0.036, 0.0105 * Math.sqrt(j + 0.6));
    return V3(b.x + Math.cos(a) * rr * (store ? 0.8 : 1), GAMES.kalah.surface + 0.008 + layer * 0.012, b.z + Math.sin(a) * rr * (store ? 2.2 : 1));
  },
  meshesFor(m) { return [this.pitMeshes[m.pit]]; },
  ringFor(m) { const p = klPit(m.pit); return V3(p.x, GAMES.kalah.surface, p.z); },
  async play(m) {
    const G = GAMES.kalah, tok = play.token, res = G.apply(m);
    let hand = [];
    for (const [i, n] of res.trace) {
      if (tok !== play.token) return res;
      if (n === 0) { hand = hand.concat(this.at[i].splice(0)); continue; }
      // Seeds arrive one at a time while sowing, or all at once when a capture or the end sweeps them in.
      while (this.at[i].length < n && hand.length) { const sd = hand.shift(); const v = this.slot(i, this.at[i].length); this.at[i].push(sd); await hop(sd, v, hand.length > 12 ? 0.07 : 0.12, 0.04); }
    }
    return res;
  },
  score: () => { const G = GAMES.kalah; return [['You', G.p[6]], ['Scribe', G.p[13]], 'in store']; },
};
const CRIBBAGE_P = {
  camW: 1.2,
  intro() { return 'The Scribe deals first, so the crib is its. ' + this.prompt(); },
  prompt() {
    const G = GAMES.cribbage, t = G.need.type;
    if (t === 'discard') return `Lay ${6 - G.hands[0].length === 0 ? 'two cards' : 'one more card'} aside for ${G.dealer === 0 ? 'your' : 'the Scribe\'s'} crib: click ${6 - G.hands[0].length === 0 ? 'them' : 'it'}.`;
    if (t === 'next') return (G.lastShow ? G.lastShow.map(x => x.text).join(' ') + ' ' : '') + 'Press Next deal when you are ready.';
    return `The count is ${G.count}. Click a card to play.`;
  },
  setup(ex) {
    const G = GAMES.cribbage;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    this.ex = ex; this.pegAt = [[0, 0], [0, 0]];
    ex.group.userData.pegs.forEach((pp, pl) => pp.forEach((pg, k) => { const h = crHole(pl, 0); pg.position.set(h.x + (k ? 0.006 : -0.006), ex.group.userData.pegY, h.z); }));
    this.redeal(true);
  },
  leave(ex) {
    ex.group.userData.display.forEach(m => { m.visible = true; });
    (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = [];
    ex.group.userData.pegs.forEach((pp, pl) => pp.forEach((pg, k) => { const h = crHole(pl, 0); pg.position.set(h.x + (k ? 0.006 : -0.006), ex.group.userData.pegY, h.z); }));
  },
  y: () => GAMES.cribbage.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  handSpot(pl, i, n) { return V3(0.06 + (i - (n - 1) / 2) * 0.07, this.y() + i * 0.0003, pl ? -0.32 : 0.32); },
  playSpot(pl, k) { return V3(-0.17 + k * 0.05, this.y() + 0.002 + k * 0.0003, pl ? -0.1 : 0.1); },
  cribSpot(k) { const G = GAMES.cribbage; return V3(0.42 + k * 0.004, this.y() + 0.003 + k * 0.0016, G.dealer ? -0.2 : 0.2); },
  deckSpot: () => V3(0.42, GAMES.cribbage.surface + 0.012, 0),
  redeal(instant) {
    const G = GAMES.cribbage;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.inPlay = [0, 0];
    this.deck = new THREE.Mesh(new THREE.BoxGeometry(CR_W, 0.02, CR_H), [tcEdgeMat, tcEdgeMat, crBackMat, crBackMat, tcEdgeMat, tcEdgeMat]);
    this.deck.position.copy(this.deckSpot()); this.ex.group.add(this.deck); this.cards.push(this.deck);
    for (const pl of [0, 1]) this.layHand(pl, true);
    G.crib.forEach((c, k) => { const m = this.card(c); m.rotation.set(0, 0, Math.PI); m.position.copy(this.cribSpot(k)); });
    return instant ? Promise.resolve() : wait(200);
  },
  layHand(pl, instant) {
    const G = GAMES.cribbage, h = G.hands[pl].slice().sort((a, b) => G.rank(a) - G.rank(b) || G.suit(a) - G.suit(b)), jobs = [];
    h.forEach((c, i) => { const m = this.card(c), to = this.handSpot(pl, i, h.length); m.rotation.set(0, 0, pl ? Math.PI : 0); if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.22, 0.01)); });
    return Promise.all(jobs);
  },
  movePegs() { // the back peg leapfrogs the front one to the new score
    const G = GAMES.cribbage, pegs = this.ex.group.userData.pegs, jobs = [];
    for (const pl of [0, 1]) {
      const [a, b] = this.pegAt[pl], s = G.score[pl];
      if (s === Math.max(a, b)) continue;
      const k = a <= b ? 0 : 1; this.pegAt[pl][k] = s;
      const h = crHole(pl, s >= G.target ? 61 : s);
      jobs.push(hop(pegs[pl][k], V3(h.x, this.ex.group.userData.pegY, h.z), 0.5, 0.05));
    }
    return Promise.all(jobs);
  },
  meshesFor(m) { return m.c !== undefined ? [this.mesh.get(m.c)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.cribbage, tok = play.token, res = G.apply(m);
    for (const e of res.events) {
      if (tok !== play.token) return res;
      if (e.type === 'crib') { const mc = this.card(e.c); sfx.card(); tween(0.25, k => { mc.rotation.z = Math.PI * k; }); await hop(mc, this.cribSpot(G.crib.indexOf(e.c)), 0.3, 0.05); await this.layHand(e.pl); }
      else if (e.type === 'starter') { const mc = this.card(e.c); mc.rotation.set(0, 0, Math.PI); mc.position.copy(this.deckSpot()); mc.position.y += 0.012; await tween(0.35, k => { mc.rotation.z = Math.PI * (1 - k); mc.position.y = this.deckSpot().y + 0.012 + Math.sin(k * Math.PI) * 0.04; }); }
      else if (e.type === 'play') {
        const mc = this.card(e.c); sfx.card();
        if (e.pl === 1) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        await hop(mc, this.playSpot(e.pl, this.inPlay[e.pl]++), 0.3, 0.05); await this.layHand(e.pl);
      }
      else if (e.type === 'reset') { await wait(500); const live = this.cards.filter(x => x.userData.c !== undefined && G.played.some(a => a.includes(x.userData.c)) && x.rotation.z === 0 && x.position.y < this.y() + 0.01 && Math.abs(x.position.z) < 0.15); live.forEach(x => tween(0.3, k => { x.rotation.z = Math.PI * k; })); }
      else if (e.type === 'show') {
        // Every played card turns face up again, and the crib is spread out.
        this.cards.forEach(x => { if (x.userData.c !== undefined && G.played.some(a => a.includes(x.userData.c))) x.rotation.z = 0; });
        G.crib.forEach((c, k) => { const mc = this.card(c); mc.rotation.z = 0; hop(mc, V3(0.3 + k * 0.05, this.y() + 0.002 + k * 0.0003, G.dealer ? -0.2 : 0.2), 0.4, 0.04); });
      }
      else if (e.type === 'deal') { await this.redeal(false); }
      await this.movePegs();
    }
    await this.movePegs();
    return res;
  },
  score: () => { const G = GAMES.cribbage; return [['You', G.score[0]], ['Scribe', G.score[1]], `of ${G.target}`]; },
};
const MORABARABA_P = Object.assign({}, MORRIS_P, {
  gid: 'morabaraba', word: 'cow', camW: 1.5,
  intro() { return 'You play the pale cows and go first. ' + this.prompt(); },
  setup(ex) {
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 12 }, () => {
      const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x1e120a : 0xf0e6d0, roughness: pl ? 0.35 : 0.5 });
      const m = new THREE.Mesh(morrisPieceGeo, mat); m.userData.mats = [mat]; ex.group.add(m); return m;
    }));
    MORRIS_P.setup.call(this, ex);
  },
  handSpot: (pl, k) => V3(-0.44 + k * 0.08, TOP, pl === 0 ? 0.54 : -0.54),
});
const LUDO_P = {
  camW: 1.05, ringScale: 0.6,
  intro() { return 'You play red, from the yard nearest you on the left. ' + this.prompt(); },
  prompt: () => 'Throw the die. A six brings a token out and earns another throw.',
  choosePrompt: () => 'Pick a glowing token, then its ring.',
  setup(ex) {
    const G = GAMES.ludo;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.tokens) ex.tokens = [LD_COL.red, LD_COL.yellow].map(col => Array.from({ length: 4 }, () => { const m = goosePawn(col); m.scale.setScalar(0.8); ex.group.add(m); return m; }));
    ex.tokens.flat().forEach(m => { m.visible = true; });
    this.ex = ex;
    [0, 1].forEach(pl => G.pos[pl].forEach((rel, k) => ex.tokens[pl][k].position.copy(this.spot(pl, rel, k))));
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.tokens || []).flat().forEach(m => { m.visible = false; }); },
  spot(pl, rel, k) {
    const p = ldSpot(pl, rel, k), G = GAMES.ludo;
    // Tokens sharing a square stand a little apart.
    let dx = 0; if (rel >= 0 && rel < 56) { const same = G.pos[pl].map((r, j) => (r === rel ? j : -1)).filter(j => j >= 0); if (same.length > 1) dx = (same.indexOf(k) - (same.length - 1) / 2) * 0.016; }
    return V3(p.x + dx, G.surface, p.z + (pl ? -0.006 : 0.006));
  },
  meshesFor(m) { return [this.ex.tokens[m.pl][m.k]]; },
  ringFor(m) { const p = ldSpot(m.pl, m.to, m.k); return V3(p.x, GAMES.ludo.surface, p.z); },
  fromFor: () => null,
  async play(m) {
    const G = GAMES.ludo, tok = play.token, t = this.ex.tokens[m.pl][m.k];
    for (const rel of G.steps(m)) { if (tok !== play.token) return {}; const p = ldSpot(m.pl, rel, m.k); await hop(t, V3(p.x, G.surface, p.z), 0.14, 0.03); }
    const res = G.apply(m);
    await hop(t, this.spot(m.pl, m.to, m.k), 0.12, 0.01);
    for (const k of res.caps) hop(this.ex.tokens[1 - m.pl][k], this.spot(1 - m.pl, -1, k), 0.55, 0.12);
    return res;
  },
  score: () => { const G = GAMES.ludo; return [['You', G.home(0)], ['Scribe', G.home(1)], 'tokens home of 4']; },
};
const JANGGI_P = {
  camW: 0.9, ringScale: 0.6,
  intro() { return 'You play Cho, in blue, and move first. ' + this.prompt(); },
  prompt: () => 'Pick a piece, then a ring, or pass. Checkmate Han\'s general to win.',
  setup(ex) {
    const G = GAMES.janggi;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(90).fill(null); this.lost = [0, 0];
    G.b.forEach((v, i) => { if (!v) return; const m = jgPiece(v > 8 ? 1 : 0, v & 7); m.position.copy(this.pos(i)); ex.group.add(m); ex.pieces.push(m); this.cell[i] = m; });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  pos(i) { const c = xqCell(i); return V3(c.x, GAMES.janggi.surface + 0.009, c.z); },
  lostSpot(owner, k) { return V3(owner === 1 ? 0.44 : -0.44, TOP + 0.009 + (k % 8) * 0.019, -0.28 + ((k / 8) | 0) * 0.08); },
  meshesFor(m) { return m.pass ? [] : [this.cell[m.from]]; },
  ringFor(m) { return m.pass ? null : this.pos(m.to); },
  fromFor(m) { return m.pass ? null : this.pos(m.from); },
  async play(m) {
    const G = GAMES.janggi, tok = play.token;
    if (m.pass) return G.apply(m);
    const mesh = this.cell[m.from], victim = this.cell[m.to];
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), 0.3, (mesh.userData.t === 6 || mesh.userData.t === 3 || mesh.userData.t === 4) ? 0.07 : 0.03);
    if (tok !== play.token) return res;
    if (victim) { const owner = 1 - m.pl; hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.14); }
    return res;
  },
  score: () => { const G = GAMES.janggi; return [['You', G.points(0)], ['Scribe', G.points(1)], 'points']; },
};
const GO_P = {
  camW: 0.95, ringScale: 0.6, ringOpacity: 0.4,
  intro() { return 'You play black and move first. ' + this.prompt(); },
  prompt: () => 'Choose a ring to place a stone, or Pass when nothing useful is left.',
  setup(ex) {
    const G = GAMES.go, d = ex.group.userData.go;
    d.face17.visible = false; d.display.forEach(m => { m.visible = false; }); d.face9.visible = true;
    if (!ex.pieces) ex.pieces = [];
    ex.pieces.forEach(m => { m.visible = false; });
    this.ex = ex; this.cell = Array(81).fill(null); this.free = ex.pieces.slice();
  },
  leave(ex) {
    const d = ex.group.userData.go;
    d.face17.visible = true; d.display.forEach(m => { m.visible = true; }); d.face9.visible = false;
    (ex.pieces || []).forEach(m => { m.visible = false; });
  },
  stone(pl) {
    let m = this.free.findIndex(x => x.userData.pl === pl);
    if (m >= 0) return this.free.splice(m, 1)[0];
    const s = new THREE.Mesh(go9StoneGeo, GO9_MATS[pl]); s.scale.y = 0.42; s.userData.pl = pl;
    this.ex.group.add(s); this.ex.pieces.push(s); return s;
  },
  pos(p) { const c = goCell(p); return V3(c.x, GAMES.go.surface + 0.012, c.z); },
  meshesFor: () => [],
  ringFor(m) { return m.pass ? null : this.pos(m.p); },
  fromFor: () => null,
  async play(m) {
    const G = GAMES.go;
    const res = G.apply(m);
    if (m.pass) return res;
    const s = this.stone(m.pl); this.cell[m.p] = s;
    const to = this.pos(m.p);
    s.position.set(to.x, to.y + 0.08, to.z); s.visible = true;
    await tween(0.18, k => { s.position.y = to.y + 0.08 * (1 - k); }, k => k * k);
    if (res.caps.length) {
      const gone = res.caps.map(p => { const g = this.cell[p]; this.cell[p] = null; return g; }).filter(Boolean);
      await tween(0.3, k => { gone.forEach(g => { g.scale.set(1 - k * 0.9, 0.42 * (1 - k * 0.9), 1 - k * 0.9); }); });
      gone.forEach(g => { g.visible = false; g.scale.set(1, 0.42, 1); this.free.push(g); });
    }
    return res;
  },
  score: () => { const G = GAMES.go; return [['You', G.count(0)], ['Scribe', G.count(1)], 'stones · komi 7']; },
};
const HALMA_P = {
  camW: 1.0, ringScale: 0.42,
  intro() { return 'You play red, from the near corner, and move first. ' + this.prompt(); },
  prompt: () => 'Pick a man, then a ring. Rings beyond a neighbouring piece are leaps.',
  setup(ex) {
    const G = GAMES.halma;
    (ex.group.userData.display || []).forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 19 }, () => { const m = halmaMan(pl); ex.group.add(m); return m; }));
    this.cell = Array(256).fill(null);
    const k = [0, 0];
    for (let i = 0; i < 256; i++) {
      if (!G.b[i]) continue;
      const pl = G.b[i] - 1, m = ex.pieces[pl][k[pl]++];
      this.cell[i] = m; m.position.copy(this.pos(i));
    }
  },
  pos(i) { const c = hmCell(i); return V3(c.x, GAMES.halma.surface, c.z); },
  meshesFor(m) { return m.pass ? [] : [this.cell[m.from]]; },
  ringFor(m) { return m.pass ? null : this.pos(m.to); },
  fromFor(m) { return m.pass ? null : this.pos(m.from); },
  async play(m) {
    const G = GAMES.halma, tok = play.token;
    if (m.pass) return G.apply(m);
    const mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const leap = Math.abs((m.path[0] >> 4) - (m.from >> 4)) === 2 || Math.abs((m.path[0] & 15) - (m.from & 15)) === 2;
    const res = G.apply(m);
    for (const sq of m.path) {
      if (tok !== play.token) return res;
      await hop(mesh, this.pos(sq), leap ? 0.22 : 0.18, leap ? 0.05 : 0.02);
    }
    return res;
  },
  score: () => { const G = GAMES.halma; return [['You', G.home(0)], ['Scribe', G.home(1)], 'men home of 19']; },
};
const REVERSI_P = {
  camW: 1.06,
  intro() { return 'You play the dark discs and move first. ' + this.prompt(); },
  prompt: () => 'Choose a ring to place a disc. Every Scribe disc you trap in a line flips to dark.',
  setup(ex) {
    const G = GAMES.reversi;
    if (!ex.pieces) ex.pieces = Array.from({ length: 64 }, () => { const d = rvDisc(); d.visible = false; ex.group.add(d); return d; });
    this.ex = ex; this.cell = Array(64).fill(null); this.free = ex.pieces.slice();
    ex.pieces.forEach(d => { d.visible = false; });
    for (let i = 0; i < 64; i++) if (G.b[i]) this.put(i, G.b[i] - 1, false);
  },
  pos(i) { const c = rvCell(i); return V3(c.x, GAMES.reversi.surface + 0.006, c.z); },
  face: pl => (pl === 0 ? 0 : Math.PI),
  put(i, pl) { const d = this.free.pop(); d.visible = true; d.position.copy(this.pos(i)); d.rotation.set(this.face(pl), 0, 0); this.cell[i] = d; return d; },
  meshesFor() { return []; },
  ringFor(m) { return m.pass ? null : this.pos(m.at); },
  async play(m) {
    const G = GAMES.reversi, tok = play.token;
    if (m.pass) return G.apply(m);
    const res = G.apply(m);
    const d = this.put(m.at, m.pl);
    const to = d.position.clone(); d.position.y += 0.12;
    await tween(0.22, k => { d.position.y = to.y + 0.12 * (1 - k); });
    for (const f of m.flips) {
      if (tok !== play.token) return res;
      const disc = this.cell[f], base = disc.position.y, a0 = disc.rotation.x, a1 = this.face(m.pl);
      await tween(0.16, k => { disc.rotation.x = a0 + (a1 - a0) * k; disc.position.y = base + Math.sin(k * Math.PI) * 0.03; });
    }
    return res;
  },
  score: () => { const G = GAMES.reversi; return [['You', G.count(0)], ['Scribe', G.count(1)], 'discs']; },
};

const DOTS_P = {
  camW: 0.98, get ringScale() { return 0.9 * 4 / dbN(); },
  intro() { return this.prompt(); },
  prompt: () => 'Choose a ring to draw a line between two dots.',
  setup(ex) {
    const G = GAMES.dotsboxes, n = G.N, d = ex.group.userData.dots;
    DB_S = DB_SPAN / n;
    d.maps[n] = d.maps[n] || dbPaper(n); d.paper.material.map = d.maps[n]; d.paper.material.needsUpdate = true;
    if (ex.pieces && ex.pieces.n !== n) { // a new grid size: throw away the old lines and boxes
      [...ex.pieces.lines, ...ex.pieces.boxes].forEach(m => { ex.group.remove(m); m.geometry.dispose(); });
      ex.pieces = null;
    }
    if (!ex.pieces) {
      const lineGeo = new THREE.BoxGeometry(DB_S - 0.02, 0.004, 0.008), boxGeo = new THREE.PlaneGeometry(DB_S - 0.03, DB_S - 0.03);
      ex.pieces = {
        n,
        lines: Array.from({ length: G.EDGES }, (_, e) => {
          const m = new THREE.Mesh(lineGeo, dbLineMats[0]); const mid = dbEdgeMid(e);
          m.position.copy(mid.pos); m.position.y = G.surface + 0.002; if (!mid.horiz) m.rotation.y = Math.PI / 2;
          m.visible = false; ex.group.add(m); return m;
        }),
        boxes: Array.from({ length: G.N * G.N }, (_, b) => {
          const r = (b / G.N) | 0, c = b % G.N;
          const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xd4a23a, transparent: true, opacity: 0, depthWrite: false }));
          m.rotation.x = -Math.PI / 2; m.position.set((c - (n - 1) / 2) * DB_S, G.surface + 0.001, (r - (n - 1) / 2) * DB_S);
          m.visible = false; ex.group.add(m); return m;
        }),
      };
    }
    this.ex = ex;
    ex.pieces.lines.forEach(l => { l.visible = false; });
    ex.pieces.boxes.forEach(b => { b.visible = false; b.material.opacity = 0; });
  },
  meshesFor() { return []; },
  ringFor(m) { const p = dbEdgeMid(m.e).pos; return V3(p.x, GAMES.dotsboxes.surface, p.z); },
  async play(m) {
    const G = GAMES.dotsboxes, P = this.ex.pieces;
    const res = G.apply(m);
    const line = P.lines[m.e]; line.material = dbLineMats[m.pl]; line.visible = true;
    await tween(0.2, k => { line.scale.set(Math.max(0.01, k), 1, 1); });
    for (const b of res.boxes) {
      const f = P.boxes[b]; f.visible = true; f.material.color.setHex(m.pl === 0 ? 0xd4a23a : 0x5a7aaa);
      await tween(0.3, k => { f.material.opacity = 0.55 * k; });
    }
    return res;
  },
  score: () => { const G = GAMES.dotsboxes; return [['You', G.score[0]], ['Scribe', G.score[1]], `boxes of ${G.N * G.N}`]; },
};
const PRES = { ur: racePresenter(UR), senet: racePresenter(SENET), morris: MORRIS_P, oware: OWARE_P, brandubh: BRANDUBH_P, tables: TABLES_P, shatranj: SHATRANJ_P, foxgeese: FOXGEESE_P, draughts: DRAUGHTS_P, goose: racePresenter(GOOSE), reversi: REVERSI_P, dotsboxes: DOTS_P, halma: HALMA_P, go: GO_P, alquerque: ALQUERQUE_P, xiangqi: XIANGQI_P, snakes: racePresenter(SNAKES), tarocchi: TAROCCHI_P, mutorere: MUTORERE_P, konane: KONANE_P, fanorona: FANORONA_P, chess: CHESS_P, shogi: SHOGI_P, yut: YUT_P, pachisi: PACHISI_P, mahjong: MAHJONG_P, bao: BAO_P, landlord: LANDLORD_P, chinese: CHINESE_P, hex: HEX_P, gomoku: GOMOKU_P, dominoes: DOMINOES_P, tablut: TABLUT_P, makruk: MAKRUK_P, kalah: KALAH_P, cribbage: CRIBBAGE_P, morabaraba: MORABARABA_P, ludo: LUDO_P, janggi: JANGGI_P, chaturaji: CHATURAJI_P, seega: SEEGA_P, tab: TAB_P, baghchal: BAGHCHAL_P, fourseasons: FOURSEASONS_P };

/* --------------------------------------------------------- camera */
const cam = { pos: new THREE.Vector3(0, 1.62, 2.4), yaw: 0, pitch: -0.02 };
let camTween = null;
function lookAngles(from, to) {
  const d = to.clone().sub(from);
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
}
function wrapA(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
function flyTo(pos, target, dur = 1.6) {
  const a = lookAngles(pos, target);
  const p0 = cam.pos.clone(), y0 = cam.yaw, pi0 = cam.pitch, dy = wrapA(a.yaw - y0);
  const token = {};
  camTween = token;
  const dist = p0.distanceTo(pos);
  const d = Math.min(3.2, Math.max(0.6, dur * (0.5 + dist / 18)));
  return tween(d, k => {
    if (camTween !== token) return;
    cam.pos.lerpVectors(p0, pos, k);
    cam.yaw = y0 + dy * k; cam.pitch = pi0 + (a.pitch - pi0) * k;
  }).then(() => { if (camTween === token) camTween = null; });
}
function stopView(stop) {
  if (stop.id === 'hall') return { pos: V3(0, 1.62, 2.4), target: V3(0, 1.75, -12) };
  if (/^wing\d$/.test(stop.id)) {
    const d = HALL.dividers[+stop.id.slice(4) - 2];
    return { pos: V3(0, 1.62, d - 1.2), target: V3(0, 1.85, d - 14) };
  }
  if (stop.id === 'next') return { pos: V3(0, 1.62, lectern.position.z + 3), target: V3(0, 1.15, lectern.position.z) };
  const g = stop.group;
  return { pos: g.localToWorld(V3(0, 1.66, 2.15)), target: g.localToWorld(V3(0, 1.08, 0)) };
}
function flyToPlay(stop, dur = 1.4) {
  const g = stop.group;
  const W = PRES[stop.game].camW;
  const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hf = Math.atan(Math.tan(vf) * camera.aspect);
  const elev = THREE.MathUtils.degToRad(58);
  let dist = (W / 2) / Math.tan(hf) * 1.06;
  dist = Math.max(dist, 0.62 / Math.tan(vf) * 1.1);
  const center = V3(0, TOP + 0.05, 0.02);
  const pos = center.clone().add(V3(0, Math.sin(elev) * dist, Math.cos(elev) * dist));
  play.camDist = dist;
  return flyTo(g.localToWorld(pos), g.localToWorld(center.clone().add(V3(0, 0, -0.03))), dur);
}

/* ---------------------------------------------------- visitor progress
 * Kept in this browser only: exhibits visited, rules already shown, the
 * Scribe's level and the visitor's record at each table. */
const STORE_KEY = 'librarium.archives.v1';
const store = (() => {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { d = {}; }
  d.visited = d.visited || {}; d.record = d.record || {}; d.rulesSeen = d.rulesSeen || {};
  return d;
})();
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* storage blocked: progress lasts for this visit only */ } }
function recordText(id) {
  const r = store.record[id]; if (!r) return '';
  const [w, l, d] = r;
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  return `Your record against the Scribe here: ${n(w, 'win', 'wins')}, ${n(l, 'loss', 'losses')}${d ? ', ' + n(d, 'draw', 'draws') : ''}.`;
}

/* ------------------------------------------------------- UI: placard + rail */
let mode = 'gallery', current = 0;
/* ------------------------------------------------------------- navigation
 * The bar along the bottom: wing tabs, the exhibits of the wing you are in,
 * previous and next, and an index of every exhibit with search and filters. */
const rail = $('#lm-rail');
const ROMAN_WINGS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
const WINGS = [1, 2, 3, 4, 5, 6].map(n => {
  const intro = STOPS.findIndex(x => x.wing === n && (x.id === 'hall' || x.id === 'wing' + n));
  return { n, roman: ROMAN_WINGS[n], intro, title: STOPS[intro].title, dates: n === 1 ? 'c. 3100 – 2000 BCE' : STOPS[intro].date };
});
const railButtons = []; // one per stop, in STOPS order
let railWing = 0;
const wingTabs = WINGS.map(w => {
  const b = document.createElement('button');
  b.className = 'wingtab'; b.textContent = w.roman;
  b.setAttribute('aria-label', `Wing ${w.roman}: ${w.title}`); b.title = `Wing ${w.roman} · ${w.title}`;
  b.addEventListener('click', () => goStop(w.intro));
  $('#lm-wings').appendChild(b); return b;
});
STOPS.forEach((s, i) => {
  const isIntro = WINGS.some(w => w.intro === i);
  const b = document.createElement('button');
  b.className = 'stop' + (isIntro ? ' intro' : '') + (s.game ? ' playable' : '');
  b.innerHTML = '<span class="t"></span><span class="d"></span><span class="sr"></span>';
  b.querySelector('.t').textContent = isIntro ? (s.id === 'hall' ? 'Entrance' : s.title) : s.rail;
  b.querySelector('.d').textContent = isIntro ? `Wing ${ROMAN_WINGS[s.wing]}` : s.date;
  b.querySelector('.sr').textContent = (s.game ? ', a table you can play' : '') + ', visited';
  if (store.visited[s.id]) b.classList.add('seen');
  b.dataset.wing = s.wing;
  b.addEventListener('click', () => goStop(i));
  $('#lm-stops').appendChild(b); railButtons.push(b);
});
function showRailWing(n) {
  if (railWing === n) return;
  railWing = n;
  wingTabs.forEach((b, k) => { const on = k + 1 === n; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'true' : 'false'); });
  railButtons.forEach(b => { b.hidden = +b.dataset.wing !== n; });
  $('#lm-stops').scrollLeft = 0;
}
function stepStop(d) { if (mode !== 'gallery') return; const i = Math.max(0, Math.min(STOPS.length - 1, (current < 0 ? 0 : current) + d)); if (i !== current) goStop(i); }
$('#lm-prev').addEventListener('click', () => stepStop(-1));
$('#lm-next').addEventListener('click', () => stepStop(1));

// The index: every exhibit, grouped by wing.
const index = $('#lm-index'), indexBtn = $('#lm-indexBtn'), indexSearch = $('#lm-indexSearch');
let indexFilter = 'all';
function renderIndex() {
  const q = indexSearch.value.trim().toLowerCase(), cols = $('#lm-indexCols');
  cols.innerHTML = '';
  let shown = 0;
  const seenAll = STOPS.filter(s => store.visited[s.id]).length;
  $('#lm-indexCount').textContent = `${seenAll} of ${STOPS.length} visited`;
  for (const w of WINGS) {
    const items = STOPS.map((s, i) => [s, i]).filter(([s]) => s.wing === w.n)
      .filter(([s]) => indexFilter !== 'play' || s.game)
      .filter(([s]) => indexFilter !== 'new' || !store.visited[s.id])
      .filter(([s]) => !q || [s.title, s.short, s.rail, s.eyebrow, s.date, ...s.facts.flat()].join(' ').toLowerCase().includes(q));
    if (!items.length) continue;
    const col = document.createElement('section'); col.className = 'indexwing';
    const seen = STOPS.filter(s => s.wing === w.n && store.visited[s.id]).length, total = STOPS.filter(s => s.wing === w.n).length;
    const h = document.createElement('h3');
    h.innerHTML = '<span class="r"></span><span class="n"></span><span class="dd"></span>';
    h.querySelector('.r').textContent = w.roman; h.querySelector('.n').textContent = w.title;
    h.querySelector('.dd').textContent = `${w.dates} · ${seen} of ${total} visited`;
    col.appendChild(h);
    const ul = document.createElement('ul');
    for (const [s, i] of items) {
      const li = document.createElement('li'), b = document.createElement('button');
      b.className = (store.visited[s.id] ? 'seen' : '') + (i === current ? ' on' : '');
      b.innerHTML = '<span class="t"></span><span class="d"></span>';
      b.querySelector('.t').textContent = s.id === 'hall' ? 'Entrance' : s.title;
      b.querySelector('.d').textContent = (s.id === 'hall' || s.id === 'wing' + s.wing) ? 'Wing introduction' : s.date;
      if (s.game) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = 'Play'; b.appendChild(tag); }
      if (store.visited[s.id]) { const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = ', visited'; b.appendChild(sr); }
      b.addEventListener('click', () => { openIndex(false); goStop(i); });
      li.appendChild(b); ul.appendChild(li); shown++;
    }
    col.appendChild(ul); cols.appendChild(col);
  }
  $('#lm-indexNone').hidden = shown > 0;
}
function openIndex(on) {
  if (on && mode !== 'gallery') return;
  index.hidden = !on; indexBtn.setAttribute('aria-expanded', String(on));
  rail.classList.toggle('indexing', on);
  if (on) { renderIndex(); indexSearch.focus({ preventScroll: true }); } else indexBtn.focus({ preventScroll: true });
}
indexBtn.addEventListener('click', () => openIndex(index.hidden));
$('#lm-indexClose').addEventListener('click', () => openIndex(false));
indexSearch.addEventListener('input', renderIndex);
indexSearch.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); const first = $('#lm-indexCols button'); if (first) first.click(); }
  if (e.key === 'Escape') { e.preventDefault(); openIndex(false); }
  e.stopPropagation(); // typing here should not walk around the hall
});
$('#lm-indexChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  indexFilter = b.dataset.f;
  $('#lm-indexChips').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  renderIndex();
});
function renderPlacard(s) {
  const body = $('#lm-placardBody'); body.innerHTML = '';
  const el = (t, cls, txt) => { const e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; body.appendChild(e); return e; };
  el('div', 'eyebrow', s.eyebrow);
  el('h2', '', s.title);
  el('div', 'date', s.date);
  if (s.status) el('div', 'status ' + s.status[0], s.status[1]);
  s.body.forEach(p => el('p', '', p));
  if (s.games) {
    const ul = el('ul', 'gamelist');
    for (const gm of s.games) {
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = gm.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = gm.name;
      const p = document.createElement('span'); p.textContent = gm.text;
      li.append(a, p); ul.appendChild(li);
    }
  }
  if (s.facts.length) {
    const dl = el('dl', 'facts');
    s.facts.forEach(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); });
  }
  if (s.game) { const rec = recordText(s.game); if (rec) el('p', 'record', rec); }
  body.scrollTop = 0;
  const act = $('#lm-placardActions'); act.innerHTML = '';
  if (s.game) {
    const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = 'Take a seat and play';
    b.addEventListener('click', () => startGame(s)); act.appendChild(b);
  } else if (s.link) {
    const a = document.createElement('a'); a.className = 'btn primary'; a.href = s.link[1]; a.target = '_blank'; a.rel = 'noopener'; a.textContent = s.link[0]; act.appendChild(a);
  } else if (s.begin) {
    const i = STOPS.findIndex(x => x.id === s.begin);
    const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = 'Begin with ' + STOPS[i].rail;
    b.addEventListener('click', () => goStop(i)); act.appendChild(b);
  } else {
    const n = document.createElement('span'); n.className = 'soon'; n.textContent = s.note || 'On display only. The rules did not survive.'; act.appendChild(n);
  }
}
let placardOpen = false;
function showPlacard(on) { placardOpen = on; $('#lm-placard').classList.toggle('away', !on); updateJoy(); }
// On phones the placard is a bottom sheet, so the picture slides up to stay visible above it.
let viewShift = 0;
function updateViewShift(dt) {
  const { w, h } = hostSize();
  const want = mode === 'gallery' && placardOpen && w <= 720 ? 0.26 : 0;
  viewShift += (want - viewShift) * Math.min(1, dt * 6);
  if (Math.abs(viewShift) < 0.002) { if (camera.view && camera.view.enabled) camera.clearViewOffset(); viewShift = want ? viewShift : 0; return; }
  camera.setViewOffset(w, h, 0, h * viewShift, w, h);
}
function setActive(i) {
  current = i;
  showRailWing(STOPS[i].wing);
  railButtons.forEach((b, k) => { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'location'); else b.removeAttribute('aria-current'); });
  $('#lm-prev').disabled = i <= 0; $('#lm-next').disabled = i >= STOPS.length - 1;
  // Scroll the strip sideways only; scrollIntoView would also scroll the host page.
  const strip = $('#lm-stops'), b = railButtons[i], left = b.offsetLeft - strip.offsetLeft - strip.clientWidth / 2 + b.offsetWidth / 2;
  strip.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? 'auto' : 'smooth' });
}
function goStop(i, fly = true) {
  if (mode !== 'gallery') return;
  setActive(i);
  if (!store.visited[STOPS[i].id]) { store.visited[STOPS[i].id] = true; save(); railButtons[i].classList.add('seen'); }
  renderPlacard(STOPS[i]); showPlacard(true);
  if (fly) { const v = stopView(STOPS[i]); view.zoomTo = 1; flyTo(v.pos, v.target); }
}
$('#lm-closeP').addEventListener('click', () => showPlacard(false));

// Full screen, where the browser allows it (a phone or an embedded viewer may not).
/* ------------------------------------------------------------- sound
 * Every sound is made on the spot with the Web Audio API, so there are no
 * audio files to license or load. Nothing plays until the visitor's first
 * click, tap or key, as browsers require; the speaker button mutes it all. */
const sfx = (() => {
  let ctx = null, master = null, noiseBuf = null, room = null, crackle = null;
  let on = store.sound !== false;
  function make() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function ready() { if (!on) return false; if (!ctx && !make()) return false; if (ctx.state === 'suspended') ctx.resume(); return true; }
  // A filtered burst of noise: knocks, clicks and rattles.
  function burst(t, { dur = 0.05, freq = 2000, q = 3, gain = 0.4, type = 'bandpass' } = {}) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); const at = ctx.currentTime + t;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(at, Math.random() * 1.5); src.stop(at + dur + 0.02);
  }
  // A short pitched note with a fast decay: wood, stone, bells.
  function tone(t, { freq = 440, dur = 0.25, gain = 0.2, type = 'sine', bend = 1 } = {}) {
    const o = ctx.createOscillator(); o.type = type;
    const g = ctx.createGain(); const at = ctx.currentTime + t;
    o.frequency.setValueAtTime(freq, at); if (bend !== 1) o.frequency.exponentialRampToValueAtTime(freq * bend, at + dur);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g); g.connect(master); o.start(at); o.stop(at + dur + 0.02);
  }
  // Room tone: a low hush, with now and then a candle crackling.
  function startRoom() {
    if (room || !ready()) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2.5);
    src.connect(lp); lp.connect(g); g.connect(master); src.start();
    room = { src, g };
    const tick = () => {
      if (!room) return;
      if (on && !document.hidden) { const n = 1 + ((Math.random() * 3) | 0); for (let k = 0; k < n; k++) burst(k * 0.03 + Math.random() * 0.02, { dur: 0.02, freq: 2500 + Math.random() * 2500, q: 1, gain: 0.025 }); }
      crackle = setTimeout(tick, 900 + Math.random() * 3200);
    };
    tick();
  }
  function stopRoom() { if (!room) return; const r = room; room = null; clearTimeout(crackle); r.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); setTimeout(() => { try { r.src.stop(); } catch (e) { /* already stopped */ } }, 500); }
  const api = {
    get on() { return on; },
    unlock() { if (on) startRoom(); },
    set(v) { on = v; store.sound = v; save(); if (v) startRoom(); else stopRoom(); },
    // Senet's throwing sticks clatter; dice rattle and settle.
    roll(g) {
      if (!ready()) return;
      if (g.id === 'senet') { for (let k = 0; k < 4; k++) { burst(k * 0.045 + Math.random() * 0.02, { dur: 0.07, freq: 1500 + Math.random() * 600, q: 6, gain: 0.5 }); tone(k * 0.045, { freq: 380 + Math.random() * 120, dur: 0.06, gain: 0.08, type: 'triangle' }); } return; }
      const n = g.id === 'ur' ? 5 : 8;
      for (let k = 0; k < n; k++) burst(k * 0.035 + Math.random() * 0.02, { dur: 0.03, freq: 2800 + Math.random() * 1600, q: 4, gain: 0.35 });
      burst(n * 0.04, { dur: 0.08, freq: 900, q: 2, gain: 0.35 });
    },
    // A piece set down: wood by default, stone for Go, a pencil stroke for Dots and Boxes.
    move(g, m, res) {
      if (!ready() || !m || m.pass || g.id === 'tarocchi') return;
      const caps = (res && ((res.caps && res.caps.length) || (res.boxes && res.boxes.length))) || 0;
      if (g.id === 'go') { burst(0, { dur: 0.04, freq: 3200, q: 5, gain: 0.45 }); tone(0, { freq: 1900, dur: 0.05, gain: 0.08 }); }
      else if (g.id === 'dotsboxes') burst(0, { dur: 0.16, freq: 5000, q: 0.8, gain: 0.12, type: 'highpass' });
      else if (g.id === 'reversi') { tone(0, { freq: 520, dur: 0.07, gain: 0.12, type: 'triangle' }); burst(0, { dur: 0.03, freq: 2600, q: 3, gain: 0.25 }); }
      else { tone(0, { freq: 210 + Math.random() * 40, dur: 0.12, gain: 0.22, type: 'triangle', bend: 0.8 }); burst(0, { dur: 0.03, freq: 1800, q: 2, gain: 0.25 }); }
      if (caps) for (let k = 0; k < Math.min(caps, 4); k++) { tone(0.14 + k * 0.09, { freq: 300, dur: 0.1, gain: 0.16, type: 'triangle', bend: 0.7 }); burst(0.14 + k * 0.09, { dur: 0.03, freq: 1400, q: 2, gain: 0.2 }); }
    },
    card() { if (ready()) burst(0, { dur: 0.12, freq: 3500, q: 0.7, gain: 0.18, type: 'highpass' }); },
    // Three rising bell notes for a win, two falling for a loss, one for a draw.
    end(winner) {
      if (!ready()) return;
      const notes = winner === 0 ? [523, 659, 784] : winner === 1 ? [392, 330] : [440];
      notes.forEach((f, k) => { tone(k * 0.16, { freq: f, dur: 0.9, gain: 0.12 }); tone(k * 0.16, { freq: f * 2.76, dur: 0.4, gain: 0.03 }); });
    },
  };
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (on) ctx.resume(); });
  return api;
})();
const soundBtn = $('#lm-soundBtn');
function renderSoundBtn() {
  soundBtn.setAttribute('aria-pressed', String(sfx.on));
  soundBtn.setAttribute('aria-label', sfx.on ? 'Sound on. Mute' : 'Sound off. Turn on');
  soundBtn.classList.toggle('off', !sfx.on);
}
soundBtn.addEventListener('click', () => { sfx.set(!sfx.on); renderSoundBtn(); });
renderSoundBtn();
// Browsers allow sound only after the visitor does something on the page.
['pointerdown', 'keydown'].forEach(t => root.addEventListener(t, () => sfx.unlock(), { once: true, capture: true }));
const fsBtn = $('#lm-fsBtn');
if (!document.fullscreenEnabled || !root.requestFullscreen) fsBtn.hidden = true;
fsBtn.addEventListener('click', () => {
  const p = document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen();
  if (p && p.catch) p.catch(() => {});
});
document.addEventListener('fullscreenchange', () => {
  const on = document.fullscreenElement === root;
  fsBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
  fsBtn.classList.toggle('on', on);
  setTimeout(resize, 50);
});

// The Scribe's level, chosen at any table and remembered.
const levelButtons = [...document.querySelectorAll('#lm-level button')];
function setScribeLevel(name) {
  name = R.setLevel(name);
  store.level = name; save();
  levelButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.level === name)));
}
levelButtons.forEach(b => b.addEventListener('click', () => setScribeLevel(b.dataset.level)));
setScribeLevel(store.level || 'fair');
// Some tables offer variants (a bigger grid, say). Choosing one restarts the game.
function renderVariants(g) {
  const box = $('#lm-variant'); box.innerHTML = '';
  box.hidden = !g.variants;
  if (!g.variants) return;
  const label = document.createElement('span'); label.textContent = g.variantLabel || 'Size'; box.appendChild(label);
  for (const v of g.variants) {
    const b = document.createElement('button'); b.textContent = v.label; b.setAttribute('aria-pressed', String(v.id === g.variant));
    b.addEventListener('click', () => {
      if (v.id === g.variant) return;
      store.variants = Object.assign(store.variants || {}, { [g.id]: v.id }); save();
      const ex = play.ex; play.token++; clearHighlights(); clearLastMove(); mode = 'gallery'; startGame(ex);
    });
    box.appendChild(b);
  }
}
$('#lm-helpBtn').addEventListener('click', () => { if (mode === 'gallery') goStop(0); else $('#lm-rules').hidden = !$('#lm-rules').hidden; });

/* ------------------------------------------------------------- play table */
const play = { ex: null, game: null, P: null, token: 0, phase: 'idle', roll: null, moves: [], rings: [], byMesh: new Map(), glowing: new Set(), selected: null, hover: null, twoStep: false };
const ringGeo = new THREE.TorusGeometry(0.05, 0.006, 8, 36);
const ringHitGeo = new THREE.CircleGeometry(0.062, 24); // the whole ring face is clickable, not just its outline
const RING_COLOR = { gold: 0xf6a01a, ember: 0xe06418 };
function glowMats(obj) {
  if (obj.userData.mats) return obj.userData.mats;
  const a = []; obj.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { if (m.emissive) a.push(m); }); });
  obj.userData.mats = a; return a;
}
async function startGame(ex) {
  if (mode !== 'gallery') return;
  mode = 'play';
  const g = GAMES[ex.game], P = PRES[ex.game];
  play.ex = ex; play.game = g; play.P = P; play.token++;
  play.phase = 'idle'; play.moves = []; play.selected = null; // nothing from the last table carries over during the glide
  $('#lm-choices').hidden = true;
  g.surface = ex.surface;
  if (g.variants) g.setVariant((store.variants || {})[g.id] || g.variant);
  renderVariants(g);
  g.init(); P.setup(ex);
  showPlacard(false); $('#lm-hint').style.opacity = 0; rail.hidden = true; index.hidden = true; indexBtn.setAttribute('aria-expanded', 'false');
  root.classList.add('playing');
  resetView(true); updateJoy();
  $('#lm-hud').hidden = false; $('#lm-win').hidden = true; $('#lm-rules').hidden = true;
  $('#lm-hudTitle').textContent = g.name;
  $('#lm-throwBtn').hidden = !g.dice; $('#lm-dice').hidden = !g.dice;
  $('#lm-passBtn').hidden = !(g.canPass || g.stopLabel); $('#lm-passBtn').disabled = true;
  $('#lm-passBtn').textContent = g.stopLabel || 'Pass';
  renderRules(g);
  if (!store.rulesSeen[g.id]) { $('#lm-rules').hidden = false; store.rulesSeen[g.id] = true; save(); }
  clearLastMove();
  if (g.dice) renderDice(g, null);
  updateScore();
  setMsg(g.first === 0 ? 'Your turn' : scribeName(g), g.first === 0 ? '' : `${scribeName(g)} moves first.`);
  await flyToPlay(ex);
  beginTurn(g.first, true);
}
function renderRules(g) {
  const r = $('#lm-rules'); r.innerHTML = '';
  const h = document.createElement('h3'); h.textContent = 'How to play ' + g.name; r.appendChild(h);
  const ul = document.createElement('ul'); g.rules.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }); r.appendChild(ul);
  const p = document.createElement('p'); p.className = 'src'; p.textContent = g.source; r.appendChild(p);
  const close = document.createElement('button'); close.className = 'hudbtn'; close.textContent = 'Got it';
  close.addEventListener('click', () => { r.hidden = true; }); r.appendChild(close);
}
function leaveGame() {
  if (mode !== 'play') return;
  play.token++; clearHighlights(); clearLastMove(); $('#lm-choices').hidden = true;
  if (play.P && play.P.leave) play.P.leave(play.ex);
  mode = 'gallery';
  $('#lm-hud').hidden = true; rail.hidden = false; $('#lm-hint').style.opacity = 1;
  root.classList.remove('playing');
  resetView(false); updateJoy();
  goStop(STOPS.indexOf(play.ex));
}
$('#lm-leaveBtn').addEventListener('click', leaveGame);
$('#lm-winLeave').addEventListener('click', leaveGame);
$('#lm-againBtn').addEventListener('click', () => { const ex = play.ex; play.token++; clearHighlights(); mode = 'gallery'; startGame(ex); });
$('#lm-rulesBtn').addEventListener('click', () => { $('#lm-rules').hidden = !$('#lm-rules').hidden; });
$('#lm-throwBtn').addEventListener('click', humanThrow);
$('#lm-passBtn').addEventListener('click', () => {
  if (play.phase !== 'choose') return;
  const m = play.moves.find(x => x.pass) || (play.game.canPass ? { pl: 0, pass: true } : null);
  if (m) choose(m);
});

function setMsg(who, text) {
  const m = $('#lm-msg'); m.innerHTML = '';
  const w = document.createElement('span'); w.className = 'who'; w.textContent = who; m.appendChild(w);
  m.appendChild(document.createTextNode(text));
}
function updateScore() {
  const s = $('#lm-score'); s.innerHTML = '';
  const add = ([label, val]) => { const el = document.createElement('b'); el.textContent = val; s.append(label + ' ', el); };
  if (play.P.scores) { // more than two players
    const list = play.P.scores(), tail = typeof list[list.length - 1] === 'string' ? list.pop() : '';
    list.forEach((x, k) => { if (k) s.append('  ·  '); add(x); });
    if (tail) s.append('  ·  ' + tail); return;
  }
  const [a, b, suffix] = play.P.score();
  add(a); s.append('  ·  '); add(b); if (suffix) s.append('  ' + suffix);
}
// Games with several Scribes name the one at play, and decide whose turn comes next.
const scribeName = g => g.scribeName || 'The Scribe';
const nextPl = (g, other) => (g.passTurn ? g.passTurn() : other);
function renderDice(g, r, shaking = false) {
  const d = $('#lm-dice'); d.innerHTML = ''; d.classList.toggle('shake', shaking);
  const faces = r ? r.faces : g.pipDice ? (g.oneDie ? [1] : [1, 1]) : [0, 0, 0, 0];
  faces.forEach(f => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 30 30');
    if (g.pipDice) {
      const p = document.createElementNS(ns, 'rect'); p.setAttribute('x', '3'); p.setAttribute('y', '3'); p.setAttribute('width', '24'); p.setAttribute('height', '24'); p.setAttribute('rx', '5');
      p.setAttribute('fill', '#ecdfc3'); p.setAttribute('stroke', '#a8977a'); p.setAttribute('stroke-width', '1.2'); svg.appendChild(p);
      const pips = { 1: [[15, 15]], 2: [[9, 9], [21, 21]], 3: [[9, 9], [15, 15], [21, 21]], 4: [[9, 9], [21, 9], [9, 21], [21, 21]], 5: [[9, 9], [21, 9], [15, 15], [9, 21], [21, 21]], 6: [[9, 8], [21, 8], [9, 15], [21, 15], [9, 22], [21, 22]] }[r ? f : 1];
      for (const [x, y] of pips) { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', '2.6'); c.setAttribute('fill', r ? '#1d140c' : '#c9b79a'); svg.appendChild(c); }
    } else if (g.id === 'pachisi') { // a cowrie: mouth up shows its slit
      const e = document.createElementNS(ns, 'ellipse'); e.setAttribute('cx', '15'); e.setAttribute('cy', '15'); e.setAttribute('rx', '9'); e.setAttribute('ry', '13');
      e.setAttribute('fill', r && f ? '#f2ead8' : '#c9b79a'); e.setAttribute('stroke', '#a8977a'); e.setAttribute('stroke-width', '1.2'); svg.appendChild(e);
      if (r && f) { const l = document.createElementNS(ns, 'path'); l.setAttribute('d', 'M15 5 Q12 15 15 25'); l.setAttribute('stroke', '#5a4a3a'); l.setAttribute('stroke-width', '2'); l.setAttribute('fill', 'none'); svg.appendChild(l); }
    } else if (g.id === 'ur') {
      const p = document.createElementNS(ns, 'path'); p.setAttribute('d', 'M15 3 L27 26 L3 26 Z');
      p.setAttribute('fill', '#2a2018'); p.setAttribute('stroke', '#a8977a'); p.setAttribute('stroke-width', '1.4'); svg.appendChild(p);
      const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', '15'); c.setAttribute('cy', '8'); c.setAttribute('r', '3.4');
      c.setAttribute('fill', r && f ? '#f6a01a' : '#3d3126'); svg.appendChild(c);
    } else {
      const p = document.createElementNS(ns, 'rect'); p.setAttribute('x', '10'); p.setAttribute('y', '2'); p.setAttribute('width', '10'); p.setAttribute('height', '26'); p.setAttribute('rx', '4');
      p.setAttribute('fill', r && f ? '#ecdfc3' : '#2a1d14'); p.setAttribute('stroke', '#a8977a'); p.setAttribute('stroke-width', '1.2'); svg.appendChild(p);
    }
    d.appendChild(svg);
  });
}
const readTime = note => Math.min(2800, 700 + note.length * 22);
function rollText(g, r) { return g.rollName ? g.rollName(r) : g.pipDice && r.faces.length === 1 ? String(r.faces[0]) : g.pipDice ? (r.faces[0] === r.faces[1] ? `double ${r.faces[0]}s` : `${r.faces[0]} and ${r.faces[1]}`) : String(r.value); }
async function showRoll(r) {
  const g = play.game, tok = play.token;
  sfx.roll(g);
  for (let k = 0; k < (reduceMotion ? 1 : 5); k++) { renderDice(g, g.roll(), true); await wait(90); if (tok !== play.token) return false; }
  renderDice(g, r, false);
  return tok === play.token;
}
function beginTurn(pl, first) {
  if (mode !== 'play') return;
  const g = play.game, P = play.P;
  updateScore();
  if (!g.dice) { const r = g.result(pl); if (r) return finish(r); }
  if (g.ended && g.ended()) return finish(g.final());
  if (g.skipTurn) {
    const why = g.skipTurn(pl);
    if (why) {
      play.phase = 'skip'; $('#lm-throwBtn').disabled = true;
      setMsg(pl === 0 ? 'Your turn' : 'The Scribe', why);
      const tok = play.token;
      setTimeout(() => { if (tok === play.token) beginTurn(1 - pl); }, 1800);
      return;
    }
  }
  if (pl === 0) {
    const pre = g.dice && g.preThrow ? g.preThrow(0) : null;
    if (pre) { $('#lm-throwBtn').disabled = true; offer(pre, first ? P.intro() : P.prompt()); }
    else if (g.dice) {
      play.phase = 'throw'; $('#lm-throwBtn').disabled = false;
      setMsg('Your turn', first ? P.intro() : P.prompt());
      $('#lm-throwBtn').focus({ preventScroll: true });
    } else offer(g.legal(0), first ? P.intro() : P.prompt());
  } else {
    play.phase = 'ai'; $('#lm-throwBtn').disabled = true;
    const who = scribeName(g);
    setMsg(who, g.dice ? `${who} is throwing…` : `${who} is thinking…`);
    aiTurn();
  }
}
function renderChoices(moves) {
  const box = $('#lm-choices'); box.innerHTML = '';
  const list = moves.filter(m => m.label && !(play.P.meshesFor(m) || []).some(Boolean));
  box.hidden = !list.length;
  for (const m of list) { const b = document.createElement('button'); b.className = 'btn' + (/^Mahjong/.test(m.label) ? ' primary' : ''); b.textContent = m.label; b.addEventListener('click', () => choose(m)); box.appendChild(b); }
}
function offer(moves, text) {
  play.moves = moves; play.phase = 'choose';
  renderChoices(moves);
  $('#lm-passBtn').disabled = !(play.game.canPass || moves.some(m => m.pass));
  highlight(moves);
  setMsg('Your turn', text);
}
async function humanThrow() {
  if (play.phase !== 'throw') return;
  play.phase = 'rolling'; $('#lm-throwBtn').disabled = true;
  const g = play.game, tok = play.token;
  const r = g.roll();
  if (!(await showRoll(r))) return;
  play.roll = r;
  const moves = g.legal(0, r.value, r);
  if (!moves.length) {
    setMsg('Your turn', `You threw ${rollText(g, r)}. No piece can move, so the turn passes.`);
    await wait(1500); if (tok !== play.token) return;
    beginTurn(nextPl(g, 1)); return;
  }
  if (g.autoMove && moves.length === 1) {
    setMsg('Your turn', `You threw ${rollText(g, r)}.`);
    play.moves = moves; play.phase = 'choose';
    await wait(400); if (tok !== play.token) return;
    return choose(moves[0]);
  }
  offer(moves, `You threw ${rollText(g, r)}. ` + (play.P.choosePrompt ? play.P.choosePrompt(moves) : `Choose a glowing piece${moves.length === 1 ? ' (only one can move)' : ''}.`));
}
async function choose(m) {
  if (play.phase !== 'choose') return;
  play.phase = 'anim'; clearHighlights(); clearLastMove();
  $('#lm-choices').hidden = true;
  $('#lm-passBtn').disabled = true;
  const g = play.game, tok = play.token;
  const res = await play.P.play(m);
  if (tok !== play.token) return;
  sfx.move(g, m, res);
  updateScore();
  if (res.followUp && res.followUp.length) { offer(res.followUp, (res.note ? res.note + ' ' : '') + g.followPrompt); return; }
  if (m.pre && res.thenThrow) { // a choice made before throwing, such as paying a fine
    play.phase = 'throw'; $('#lm-throwBtn').disabled = false;
    setMsg('Your turn', (res.note ? res.note + ' ' : '') + 'Now throw the dice.');
    $('#lm-throwBtn').focus({ preventScroll: true }); return;
  }
  if (g.dice) {
    if (g.done(0)) return finish(g.final ? g.final() : { winner: 0, text: g.winText ? g.winText(0) : '' });
    if (g.extra(m, play.roll.value)) {
      setMsg('Your turn', (res.note ? res.note + ' ' : '') + g.extraNote);
      play.phase = 'throw'; $('#lm-throwBtn').disabled = false; return;
    }
  }
  if (res.note) { setMsg('Your turn', res.note); await wait(readTime(res.note)); if (tok !== play.token) return; }
  beginTurn(nextPl(g, 1));
}
async function aiTurn() {
  const g = play.game, P = play.P, tok = play.token;
  await wait(650); if (tok !== play.token) return;
  const who = scribeName(g);
  if (g.dice) {
    if (g.aiPre && g.preThrow(1)) { // choices before the throw: lot tickets, or the way out of jail
      for (const step of g.aiPre(1)) {
        const res = await P.play(step);
        if (tok !== play.token) return;
        updateScore();
        if (res.note) { setMsg('The Scribe', res.note); await wait(Math.min(1600, readTime(res.note))); if (tok !== play.token) return; }
      }
    }
    const r = g.roll();
    if (!(await showRoll(r))) return;
    const moves = g.legal(1, r.value, r);
    if (!moves.length) {
      setMsg(who, `${who} threw ${rollText(g, r)} and cannot move.`);
      await wait(1300); if (tok !== play.token) return;
      beginTurn(nextPl(g, 0)); return;
    }
    setMsg(who, `${who} threw ${rollText(g, r)}.`);
    const plan = g.aiPlan(1, moves);
    await wait(500); if (tok !== play.token) return;
    let res = {};
    const m = plan[plan.length - 1];
    clearLastMove();
    for (const step of plan) {
      const from = P.fromFor ? P.fromFor(step) : null, to = P.ringFor(step);
      res = await P.play(step);
      sfx.move(g, step, res);
      markLastMove(from, to);
      if (tok !== play.token) return;
      updateScore();
      if (res.note) setMsg(who, res.note);
    }
    if (g.done(1)) return finish(g.final ? g.final() : { winner: 1, text: g.winText ? g.winText(1) : '' });
    if (g.extra(m, r.value)) { setMsg(who, (res.note ? res.note + ' ' : '') + `${who} throws again.`); await wait(900); if (tok !== play.token) return; aiTurn(); return; }
    if (res.note) { setMsg(who, res.note); await wait(readTime(res.note) + 250); if (tok !== play.token) return; }
    beginTurn(nextPl(g, 0));
    return;
  }
  // Let the 'thinking' message paint first, without depending on animation frames (paused in background tabs).
  await new Promise(r => { requestAnimationFrame(() => setTimeout(r, 30)); setTimeout(r, 120); });
  const plan = g.aiPlan(1);
  if (tok !== play.token || !plan) return;
  let said = false;
  clearLastMove();
  for (const m of plan) {
    const from = P.fromFor ? P.fromFor(m) : null, to = P.ringFor(m);
    const res = await P.play(m);
    markLastMove(from, to);
    if (tok !== play.token) return;
    sfx.move(g, m, res);
    updateScore();
    if (res.note) { setMsg(who, res.note); said = true; }
  }
  if (said) { await wait(1000); if (tok !== play.token) return; }
  beginTurn(nextPl(g, 0));
}
function finish(res) {
  play.phase = 'over'; clearHighlights();
  sfx.end(res.winner);
  const g = play.game, P = play.P;
  if (P.onFinish) P.onFinish(res);
  updateScore();
  $('#lm-winTitle').textContent = res.title || (res.winner === 0 ? 'You win' : res.winner === 1 ? 'The Scribe wins' : 'A draw');
  $('#lm-winText').textContent = res.text || (res.winner === 0
    ? `All ${g.N} of your pieces are home. The Scribe bows and resets the board.`
    : `The Scribe brought all ${g.N} pieces home first. You bore off ${g.home(0)}.`);
  const rec = store.record[g.id] || (store.record[g.id] = [0, 0, 0]);
  rec[res.winner === 0 ? 0 : res.winner === 1 ? 1 : 2]++; save();
  $('#lm-winRecord').textContent = recordText(g.id).replace('Your record against the Scribe here', 'Your record at this table') + ` The Scribe was playing ${R.level()}.`;
  setTimeout(() => { if (play.phase === 'over') { $('#lm-win').hidden = false; $('#lm-againBtn').focus({ preventScroll: true }); } }, res.sweep ? 900 : 300);
}
// Ember marks show where the Scribe's last move went from and to.
const lastMarks = [];
const markFromGeo = new THREE.CircleGeometry(0.026, 20);
function clearLastMove() { lastMarks.splice(0).forEach(o => { o.parent && o.parent.remove(o); o.material.dispose(); }); }
function markLastMove(from, to) {
  const add = (geo, v, opacity) => {
    if (!v) return;
    const o = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: RING_COLOR.ember, transparent: true, opacity, depthWrite: false }));
    o.rotation.x = -Math.PI / 2; o.position.copy(v); o.position.y += 0.003; o.scale.setScalar(0.9);
    play.ex.group.add(o); lastMarks.push(o);
  };
  add(markFromGeo, from, 0.4); add(ringGeo, to, 0.75);
}
function addRing(m) {
  const P = play.P, at = P.ringFor(m);
  if (!at) return; // a move with no spot of its own, such as a card played from the hand
  const mat = new THREE.MeshBasicMaterial({ color: RING_COLOR[P.ringTone ? P.ringTone(m) : 'gold'], transparent: true, opacity: P.ringOpacity || 0.85, depthWrite: false });
  const ring = new THREE.Mesh(ringGeo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(at); ring.position.y += 0.004;
  ring.userData.move = m; ring.userData.base = P.ringScale || 1;
  ring.add(new THREE.Mesh(ringHitGeo, MAT.hit));
  play.ex.group.add(ring); play.rings.push(ring);
}
function highlight(moves) {
  clearHighlights();
  const P = play.P;
  play.byMesh = new Map();
  for (const m of moves) for (const ms of P.meshesFor(m)) {
    if (!ms) continue;
    if (!play.byMesh.has(ms)) play.byMesh.set(ms, []);
    play.byMesh.get(ms).push(m);
  }
  play.twoStep = [...play.byMesh.values()].some(a => a.length > 1);
  play.byMesh.forEach((_, ms) => play.glowing.add(ms));
  for (const m of moves) if (!play.twoStep || !P.meshesFor(m).some(Boolean)) addRing(m);
  if (play.twoStep && play.byMesh.size === 1) select([...play.byMesh.keys()][0]);
}
function dropRings(keep) {
  play.rings = play.rings.filter(r => { if (keep(r)) return true; r.parent && r.parent.remove(r); r.material.dispose(); return false; });
}
function select(mesh) {
  const P = play.P;
  dropRings(r => !P.meshesFor(r.userData.move).some(Boolean));
  if (play.selected === mesh) { play.selected = null; return; }
  play.selected = mesh;
  play.byMesh.get(mesh).forEach(addRing);
}
function clearHighlights() {
  dropRings(() => false);
  play.glowing.forEach(ms => glowMats(ms).forEach(x => x.emissive.setRGB(0, 0, 0)));
  play.glowing.clear(); play.byMesh = new Map(); play.selected = null; play.hover = null;
}

/* ------------------------------------------------------------- input */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let down = null; const keys = new Set();
function pickAt(x, y, objs) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(objs, true)[0];
}
function playTargets() { return [...play.byMesh.keys(), ...play.rings]; }
function resolveTarget(hit) {
  if (!hit) return null;
  const set = new Set(playTargets());
  for (let o = hit.object; o; o = o.parent) if (set.has(o)) return o;
  return null;
}
function galleryTargets() { return STOPS.filter(s => s.group).map(s => s.group.userData.hit); }
function stopFromHit(o) { return STOPS.findIndex(s => s.group && s.group.userData.hit === o); }
/* ------------------------------------------------------------- touch & zoom
 * One finger drags to look in the hall, or pans a zoomed-in table. Two
 * fingers pinch to zoom (and pan at a table). The joystick walks: push up or
 * down to go forward or back, left or right to turn. A tap on the floor walks
 * to that spot. A mouse wheel or trackpad pinch zooms as well. */
const ZOOM = { gallery: [0.8, 2.6], play: [1, 3.2] };
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
function setZoom(z) { const [a, b] = ZOOM[mode === 'play' ? 'play' : 'gallery']; view.zoomTo = clampN(z, a, b); }
function resetView(instant) { view.zoomTo = 1; view.panX = view.panY = 0; if (instant) view.zoom = 1; }
function panLimit() { return (play.P ? play.P.camW : 1.5) * 0.5 * (1 - 1 / Math.max(1, view.zoom)); }
function panBy(dx, dy) {
  if (mode !== 'play') return;
  // One pixel of finger movement moves the view by one pixel's worth of table.
  const k = 2 * (play.camDist || 1.5) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / (view.zoom * hostSize().h);
  const lim = panLimit();
  view.panX = clampN(view.panX - dx * k, -lim, lim);
  view.panY = clampN(view.panY + dy * k, -lim, lim);
}

const pointers = new Map();
let pinch = null;
function pinchState() {
  const [a, b] = [...pointers.values()];
  return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
}
canvas.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
  if (e.pointerType === 'touch' && !touchUI) { touchUI = true; touchCopy(); updateJoy(); }
  if (pointers.size === 1) { down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false }; return; }
  if (pointers.size === 2) {
    const st = pinchState();
    pinch = { d0: st.d, z0: view.zoomTo, cx: st.cx, cy: st.cy };
    camTween = null;
    if (down) down.moved = true; // a pinch is never a tap
  }
});
canvas.addEventListener('pointermove', e => {
  const pt = pointers.get(e.pointerId);
  if (pt) { pt.x = e.clientX; pt.y = e.clientY; }
  if (pinch && pointers.size >= 2) {
    const st = pinchState();
    setZoom(pinch.z0 * st.d / pinch.d0);
    panBy(st.cx - pinch.cx, st.cy - pinch.cy);
    pinch.cx = st.cx; pinch.cy = st.cy;
    return;
  }
  if (down && pt) {
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.moved && Math.hypot(dx, dy) > 6) down.moved = true;
    const mx = e.clientX - down.lx, my = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY;
    if (down.moved) {
      if (mode === 'gallery') {
        camTween = null;
        const k = 1 / view.zoom; // look more finely when zoomed in
        cam.yaw += mx * 0.0042 * k; cam.pitch += my * 0.0035 * k;
        cam.pitch = Math.max(-0.95, Math.min(0.7, cam.pitch));
      } else if (view.zoom > 1.02) panBy(mx, my);
    }
    return;
  }
  if (coarse) return;
  if (mode === 'play') {
    play.hover = play.phase === 'choose' ? resolveTarget(pickAt(e.clientX, e.clientY, playTargets())) : null;
    canvas.style.cursor = play.hover ? 'pointer' : 'default';
  } else {
    canvas.style.cursor = pickAt(e.clientX, e.clientY, galleryTargets()) ? 'pointer' : 'grab';
  }
});
// Returns true when the lifted finger was part of a pinch, so it must not count as a tap.
function releasePointer(e) {
  pointers.delete(e.pointerId);
  if (!pinch) return false;
  if (pointers.size < 2) {
    pinch = null;
    if (mode === 'play' && view.zoomTo < 1.05) resetView(false);
    const [rest] = [...pointers.values()];
    down = rest ? { x: rest.x, y: rest.y, lx: rest.x, ly: rest.y, moved: true } : null;
  }
  return true;
}
canvas.addEventListener('pointerup', e => {
  if (releasePointer(e)) return;
  const d = down; down = null;
  if (!d || d.moved || pointers.size) return;
  if (mode === 'play') {
    if (play.phase !== 'choose') return;
    const t = resolveTarget(pickAt(e.clientX, e.clientY, playTargets()));
    if (!t) { if (play.selected) select(play.selected); return; }
    if (play.rings.includes(t)) return choose(t.userData.move);
    const list = play.byMesh.get(t);
    if (!play.twoStep) return choose(list[0]);
    select(t);
    return;
  }
  const hit = pickAt(e.clientX, e.clientY, galleryTargets());
  if (hit) { const i = stopFromHit(hit.object); if (i >= 0) goStop(i); return; }
  const floorHit = floorMesh && pickAt(e.clientX, e.clientY, [floorMesh]);
  if (floorHit) walkTo(floorHit.point);
});
canvas.addEventListener('pointercancel', e => { releasePointer(e); pinch = pointers.size >= 2 ? pinch : null; down = null; });
canvas.addEventListener('wheel', e => {
  // Embedded in a page, a plain wheel scrolls the page; Ctrl + wheel (and a trackpad pinch) zooms.
  if (embedded && !e.ctrlKey && document.fullscreenElement !== root) return;
  e.preventDefault();
  camTween = null;
  setZoom(view.zoomTo * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
}, { passive: false });
// Stop Safari's own page zoom from fighting the Archives' pinch.
['gesturestart', 'gesturechange'].forEach(t => root.addEventListener(t, e => e.preventDefault()));

// Tap the floor to walk there, keeping the way you face.
function walkTo(p) {
  const x = clampN(p.x, -1.3, 1.3), z = clampN(p.z, HALL.zFar + 3.2, HALL.zNear - 0.8);
  if (Math.hypot(x - cam.pos.x, z - cam.pos.z) < 0.3) return;
  const mark = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: RING_COLOR.gold, transparent: true, opacity: 0.9, depthWrite: false }));
  mark.rotation.x = -Math.PI / 2; mark.position.set(p.x, 0.02, p.z); mark.scale.setScalar(3);
  scene.add(mark);
  tween(0.9, k => { mark.material.opacity = 0.9 * (1 - k); mark.scale.setScalar(3 + k * 2); }).then(() => { scene.remove(mark); mark.material.dispose(); });
  const to = V3(x, 1.62, z), cp = Math.cos(cam.pitch);
  $('#lm-hint').style.opacity = 0;
  flyTo(to, to.clone().add(V3(-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp)), 1.2).then(settleNearest);
}

// The walking joystick, shown on touch screens in the hall.
function updateJoy() {
  if (!joyEl) return;
  joyEl.hidden = !(touchUI && mode === 'gallery' && !(narrowHost() && placardOpen));
}
if (joyEl) {
  const knob = joyEl.querySelector('.knob');
  const joyMove = e => {
    const r = joyEl.getBoundingClientRect(), R = r.width / 2;
    let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    joy.x = x; joy.y = y;
    knob.style.transform = `translate(${x * R * 0.55}px, ${y * R * 0.55}px)`;
  };
  joyEl.addEventListener('pointerdown', e => {
    e.preventDefault();
    joy.id = e.pointerId;
    try { joyEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    joyEl.classList.add('active'); camTween = null; joyMove(e);
    $('#lm-hint').style.opacity = 0;
  });
  joyEl.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyMove(e); });
  const joyEnd = e => {
    if (e.pointerId !== joy.id) return;
    joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; joyEl.classList.remove('active');
    settleNearest();
  };
  joyEl.addEventListener('pointerup', joyEnd);
  joyEl.addEventListener('pointercancel', joyEnd);
}
// Instructions that match the device in hand.
function touchCopy() {
  const hint = $('#lm-hint');
  if (touchUI) {
    hint.textContent = 'Drag to look · Joystick or tap the floor to walk · Pinch to zoom';
    STOPS[0].facts = [['Look', 'Drag the view'], ['Walk', 'Use the joystick, or tap the floor'], ['Zoom', 'Pinch, here and at the tables'], ['Visit', 'Tap an exhibit or the timeline']];
  } else {
    hint.textContent = `Drag to look · WASD or arrows to walk · ${embedded ? 'Ctrl + scroll' : 'Scroll'} to zoom · Click an exhibit`;
    STOPS[0].facts = [['Look', 'Drag the view'], ['Walk', 'WASD or arrow keys, or click the floor'], ['Zoom', embedded ? 'Ctrl + scroll, or pinch' : 'Scroll, or pinch'], ['Visit', 'Click an exhibit or use the timeline']];
  }
  if (current === 0 && placardOpen) renderPlacard(STOPS[0]);
}
const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
// On its own page the Archives always take the keyboard. Embedded, it only does so
// while the pointer is over it or focus is inside it, so the host page still scrolls.
let pointerInside = false;
root.addEventListener('pointerenter', () => { pointerInside = true; });
root.addEventListener('pointerleave', () => { pointerInside = false; keys.clear(); });
const keyboardOwned = () => !embedded || pointerInside || root.contains(document.activeElement) || document.fullscreenElement === root;
window.addEventListener('keydown', e => {
  if (!keyboardOwned()) return;
  if (!index.hidden && e.code === 'Escape') { openIndex(false); return; }
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (mode === 'gallery' && (e.code === 'BracketLeft' || e.code === 'BracketRight')) { stepStop(e.code === 'BracketLeft' ? -1 : 1); e.preventDefault(); return; }
  if (mode === 'play') {
    if (e.code === 'Space' && play.phase === 'throw' && document.activeElement !== $('#lm-throwBtn')) { e.preventDefault(); humanThrow(); }
    if (e.code === 'Escape') { if (play.selected) select(play.selected); else leaveGame(); }
    return;
  }
  if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); camTween = null; e.preventDefault(); }
});
window.addEventListener('keyup', e => {
  if (KEYMAP[e.code]) { keys.delete(KEYMAP[e.code]); if (!keys.size && mode === 'gallery') settleNearest(); }
});
window.addEventListener('blur', () => keys.clear());
function settleNearest() {
  let best = -1, bd = 3.4;
  STOPS.forEach((s, i) => {
    if (s.id === 'hall' || /^wing\d$/.test(s.id)) return;
    const v = stopView(s); const d = Math.hypot(v.target.x - cam.pos.x, v.target.z - cam.pos.z);
    if (d < bd) { bd = d; best = i; }
  });
  if (best >= 0 && best !== current) {
    setActive(best);
    // On a narrow screen the placard would cover the view, so only light up the
    // exhibit on the timeline until the visitor taps it.
    if (narrowHost() && !placardOpen) return;
    renderPlacard(STOPS[best]); showPlacard(true);
  }
}

/* -------------------------------------------------------------- loop */
const clock = new THREE.Clock();
let t = 0;
let lastStep = 0;
function frame() {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  step();
}
function step() {
  lastStep = performance.now();
  const dt = Math.min(0.05, clock.getDelta()); t += dt;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.e(k)); if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
  let jf = 0, jt = 0;
  if (joy.id !== null) {
    const m = Math.hypot(joy.x, joy.y), dead = 0.14;
    if (m > dead) { const k = (m - dead) / (1 - dead) / m; jf = -joy.y * k; jt = joy.x * k; }
  }
  if (mode === 'gallery' && (keys.size || jf || jt)) {
    const sp = 3.2 * dt, f = V3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), r = V3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    if (keys.has('f')) cam.pos.addScaledVector(f, sp); if (keys.has('b')) cam.pos.addScaledVector(f, -sp);
    if (keys.has('r')) cam.pos.addScaledVector(r, sp); if (keys.has('l')) cam.pos.addScaledVector(r, -sp);
    if (jf) cam.pos.addScaledVector(f, sp * jf);
    if (jt) cam.yaw -= jt * 1.7 * dt;
    cam.pos.x = Math.max(-1.3, Math.min(1.3, cam.pos.x)); cam.pos.z = Math.max(HALL.zFar + 3.2, Math.min(HALL.zNear - 0.8, cam.pos.z));
    cam.pos.y += (1.62 - cam.pos.y) * Math.min(1, dt * 4);
    $('#lm-hint').style.opacity = 0;
  }
  view.zoom += (view.zoomTo - view.zoom) * Math.min(1, dt * 14);
  if (Math.abs(view.zoom - view.zoomTo) < 1e-3) view.zoom = view.zoomTo;
  if (camera.zoom !== view.zoom) { camera.zoom = view.zoom; camera.updateProjectionMatrix(); }
  const lim = panLimit();
  view.panX = clampN(view.panX, -lim, lim); view.panY = clampN(view.panY, -lim, lim);
  camera.position.copy(cam.pos); camera.rotation.set(cam.pitch, cam.yaw, 0);
  if (view.panX || view.panY) { camera.translateX(view.panX); camera.translateY(view.panY); }
  updateViewShift(dt);
  updateLights(dt, t);
  if (!reduceMotion && dust) {
    const a = dust.geometry.attributes.position, b = dust.userData.base;
    for (let i = 0; i < a.count; i++) {
      a.array[i * 3] = b[i * 3] + Math.sin(t * 0.15 + i) * 0.25;
      a.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * 0.1 + i * 1.7) * 0.3;
    }
    a.needsUpdate = true;
  }
  if (mode === 'play' && (play.glowing.size || play.rings.length)) {
    const pulse = 0.42 + 0.18 * Math.sin(t * 5);
    const hoverMove = play.hover && play.hover.userData.move;
    play.glowing.forEach(ms => {
      const hot = ms === play.selected || ms === play.hover || (hoverMove && play.byMesh.get(ms) && play.byMesh.get(ms).includes(hoverMove));
      const k = hot ? 0.5 : pulse;
      glowMats(ms).forEach(x => x.emissive.setRGB(0.55 * k, 0.32 * k, 0.02));
    });
    play.rings.forEach(r => {
      const hot = play.hover === r || (play.hover && play.byMesh.get(play.hover) && play.byMesh.get(play.hover).includes(r.userData.move));
      r.material.opacity = hot ? 1 : 0.6 + 0.25 * Math.sin(t * 5);
      r.scale.setScalar(r.userData.base * (hot ? 1.25 : 1));
    });
  }
  renderer.render(scene, camera);
}

/* -------------------------------------------------------------- boot */
async function boot() {
  try { await Promise.race([Promise.all([document.fonts.load('64px "Almendra SC"'), document.fonts.load('20px "Amethysta"'), document.fonts.load('20px "Montserrat"')]), wait(2500)]); } catch (e) {}
  layoutHall();
  buildHall();
  buildUrTextures();
  for (const s of STOPS) {
    if (!s.build) continue;
    s.group = makePlinth(s);
    s.surface = s.build(s.group);
  }
  buildLectern(HALL.zFar + 4.5);
  STOPS.find(s => s.id === 'next').group = lectern;
  const sconces = [];
  for (let z = -5, k = 0; z > HALL.zFar + 2; z -= 6, k++) if (HALL.dividers.every(d => Math.abs(z - d) > 1.5)) sconces.push([k % 2 ? 4.7 : -4.7, z]);
  sconces.forEach(([x, z]) => addCandle(x, z));
  buildLightPools();
  buildDust();
  resize();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(root);
  const shop = root.dataset.shop;
  if (shop && /^https?:\/\//.test(shop)) STOPS.find(s => s.id === 'next').link[1] = shop;
  const v = stopView(STOPS[0]); const a = lookAngles(v.pos, v.target);
  cam.pos.copy(v.pos).add(V3(0, 0, 1.2)); cam.yaw = a.yaw; cam.pitch = a.pitch;
  touchCopy(); updateJoy();
  frame();
  const startAt = STOPS.findIndex(s => s.id === root.dataset.start);
  setTimeout(() => {
    $('#lm-loader').classList.add('done');
    if (startAt > 0) goStop(startAt);
    else { goStop(0, false); flyTo(v.pos, v.target, 2.2); }
  }, 250);
  setTimeout(() => { $('#lm-hint').style.opacity = 0; }, 12000);
}
// Inspect the live state from the console with ?debug in the address.
if (/[?&]debug\b/.test(location.search)) {
  window.__archives = {
    play, GAMES, PRES, STOPS, cam, view, joy, camera, choose, humanThrow, startGame, leaveGame, goStop,
    // Put the camera at an exhibit straight away, without the glide (for slow test machines).
    jump(id) {
      const i = STOPS.findIndex(x => x.id === id); goStop(i, false); showPlacard(false);
      const v = stopView(STOPS[i]), a = lookAngles(v.pos, v.target);
      camTween = null; cam.pos.copy(v.pos); cam.yaw = a.yaw; cam.pitch = a.pitch; step();
    },
    // Render one frame and return a small JPEG of the 3D view.
    snap(w = 360) { step(); const c = document.createElement('canvas'); c.width = w; c.height = Math.round(w * canvas.height / canvas.width); c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.55); },
  };
  // Keep the scene ticking when the browser starves animation frames (a hidden pane or tab).
  setInterval(() => { if (performance.now() - lastStep > 120) step(); }, 40);
}
boot();
})();

