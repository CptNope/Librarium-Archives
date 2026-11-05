/*
 * Librarium Museum of Play: the 3D hall, exhibits, camera and play table.
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
 * The museum fills the window on its own page, or a box when embedded in
 * another page (the WordPress plugin wraps it in .lm-embed). Settings come
 * from data attributes on #lm-app: data-start (an exhibit id to open on) and
 * data-shop (where the closing "Visit Librarium Games" link points). */
const root = $('#lm-app');
if (!root) return; // no museum markup on this page
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
const HALL = { half: 5, zNear: 4, zFar: -221, h: 5, dividers: [-41, -86, -131, -176] };
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
  buildEndArch();
  buildBanner(-2.6, 'The Dawn of Play', 'Wing I  ·  c. 3100 – 2000 BCE');
  buildBanner(HALL.dividers[0] - 3.6, 'Strategy Takes the Table', 'Wing II  ·  c. 500 BCE – 1000 CE');
  buildBanner(HALL.dividers[1] - 3.6, 'Kings, Cards and Courts', 'Wing III  ·  c. 480 – 1450 CE');
  buildBanner(HALL.dividers[2] - 3.6, 'Printed Boards and Parlour Tables', 'Wing IV  ·  c. 1300 – 1900 CE');
  buildBanner(HALL.dividers[3] - 3.6, 'The Modern Board Game', 'Wing V  ·  c. 1840 CE – today');
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
  const make = {
    raja(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.06, 14), m); b.position.y = 0.03; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), m); h.position.y = 0.068; g.add(h); const u = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.014, 16), m); u.position.y = 0.088; g.add(u); return g; },
    mantri(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.05, 14), m); b.position.y = 0.025; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), m); h.scale.y = 1.2; h.position.y = 0.062; g.add(h); return g; },
    gaja(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.032), m); b.position.y = 0.04; g.add(b); for (const [x, z] of [[-0.016, -0.011], [-0.016, 0.011], [0.016, -0.011], [0.016, 0.011]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.026, 8), m); l.position.set(x, 0.013, z); g.add(l); } const h = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), m); h.position.set(0.03, 0.05, 0); g.add(h); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.035, 8), m); t.position.set(0.04, 0.032, 0); t.rotation.z = 0.25; g.add(t); return g; },
    ashva(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 0.018), m); b.position.y = 0.036; g.add(b); for (const [x, z] of [[-0.016, -0.006], [-0.016, 0.006], [0.016, -0.006], [0.016, 0.006]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.027, 6), m); l.position.set(x, 0.013, z); g.add(l); } const n = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.012), m); n.position.set(0.022, 0.054, 0); n.rotation.z = -0.4; g.add(n); const h = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.01, 0.01), m); h.position.set(0.032, 0.068, 0); g.add(h); return g; },
    ratha(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.026, 0.03), m); b.position.y = 0.03; g.add(b); for (const z of [-0.018, 0.018]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 6, 16), m); w.position.set(-0.004, 0.017, z); g.add(w); } const p = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.04, 6), m); p.position.set(0.012, 0.06, 0); g.add(p); return g; },
    padati(m) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 10), m); b.position.y = 0.02; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), m); h.position.y = 0.045; g.add(h); return g; },
  };
  const back = ['ratha', 'ashva', 'gaja', 'raja', 'mantri', 'gaja', 'ashva', 'ratha'];
  for (const side of [0, 1]) {
    const m = mats[side], r0 = side ? 7 : 0, r1 = side ? 6 : 1, face = side ? Math.PI / 2 : -Math.PI / 2;
    back.forEach((k, c) => { const o = make[k](m); o.position.copy(cell(r0, c)); o.rotation.y = face; group.add(o); });
    for (let c = 0; c < 8; c++) { const o = make.padati(m); o.position.copy(cell(r1, c)); group.add(o); }
  }
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
  const lathe = (pts, m) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 22), m);
  const base = [[0, 0], [0.024, 0], [0.025, 0.006], [0.017, 0.012]];
  const shapes = {
    p: m => lathe([...base, [0.009, 0.028], [0.013, 0.032], [0.012, 0.042], [0, 0.046]], m),
    r: m => lathe([...base, [0.015, 0.05], [0.019, 0.054], [0.019, 0.064], [0.014, 0.064], [0, 0.062]], m),
    b: m => { const g = new THREE.Group(); g.add(lathe([...base, [0.01, 0.045], [0.015, 0.052], [0.012, 0.068], [0.004, 0.076], [0, 0.078]], m)); return g; },
    n: m => { const g = new THREE.Group(); g.add(lathe([...base, [0.014, 0.022], [0, 0.024]], m)); const h = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.045, 0.016), m); h.position.set(0.004, 0.044, 0); h.rotation.z = -0.25; g.add(h); const sn = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.014, 0.014), m); sn.position.set(0.016, 0.06, 0); g.add(sn); return g; },
    q: m => { const g = new THREE.Group(); g.add(lathe([...base, [0.01, 0.06], [0.018, 0.07], [0.016, 0.084], [0, 0.084]], m)); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, ball = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), m); ball.position.set(Math.cos(a) * 0.015, 0.088, Math.sin(a) * 0.015); g.add(ball); } return g; },
    k: m => { const g = new THREE.Group(); g.add(lathe([...base, [0.011, 0.064], [0.018, 0.074], [0.014, 0.088], [0, 0.088]], m)); const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.026, 0.005), m); c1.position.y = 0.1; g.add(c1); const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.005, 0.005), m); c2.position.y = 0.104; g.add(c2); return g; },
  };
  // A position from a fast attacking game: the queen has swept out early.
  const layout = [
    [0, 0, 'r', 0], [0, 4, 'k', 0], [0, 5, 'b', 0], [0, 7, 'r', 0], [1, 0, 'p', 0], [1, 1, 'p', 0], [1, 5, 'p', 0], [1, 6, 'p', 0], [1, 7, 'p', 0], [2, 2, 'n', 0], [3, 3, 'p', 0], [3, 4, 'p', 0], [2, 5, 'n', 0],
    [4, 7, 'q', 0], [3, 2, 'b', 0],
    [7, 0, 'r', 1], [7, 2, 'b', 1], [7, 3, 'q', 1], [7, 4, 'k', 1], [7, 7, 'r', 1], [6, 0, 'p', 1], [6, 1, 'p', 1], [6, 2, 'p', 1], [6, 3, 'p', 1], [5, 5, 'n', 1], [6, 6, 'p', 1], [6, 7, 'p', 1], [4, 4, 'p', 1], [5, 2, 'n', 1], [4, 1, 'b', 1],
  ];
  for (const [r, c, t, side] of layout) {
    const o = shapes[t](mats[side]); o.position.set((c - 3.5) * S, y0, (3.5 - r) * S); o.rotation.y = side ? -Math.PI / 2 : Math.PI / 2; group.add(o);
  }
  // A small gilded crown beside the board marks the piece that changed.
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a23a, metalness: 0.8, roughness: 0.3 });
  const q = shapes.q(gold); q.scale.setScalar(1.6); q.position.set(W / 2 + 0.11, TOP, -0.12); group.add(q);
  const old = sjPiece(2, new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.5 })); old.scale.setScalar(1.6); old.position.set(W / 2 + 0.11, TOP, 0.12); group.add(old);
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
        if ((k === 3 && j !== 0) || (k === 7 && j === 0)) { g.strokeStyle = '#f0d58a'; g.beginPath(); g.moveTo(x + 8, y + 8); g.lineTo(x + s - 8, y + s - 8); g.moveTo(x + s - 8, y + 8); g.lineTo(x + 8, y + s - 8); g.stroke(); }
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
  const R = seeded(25);
  for (let k = 0; k < 7; k++) {
    const sh = new THREE.Group();
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
      p.position.set(x, TOP + 0.005, z); group.add(p);
    }
  });
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
const DB_S = 0.155;
function dbDot(r, c) { return V3((c - 2) * DB_S, 0, (r - 2) * DB_S); }
function dbEdgeMid(e) {
  const N = 4;
  if (e < N * (N + 1)) { const r = (e / N) | 0, c = e % N; const a = dbDot(r, c), b = dbDot(r, c + 1); return { pos: a.add(b).multiplyScalar(0.5), horiz: true }; }
  const k = e - N * (N + 1), r = (k / (N + 1)) | 0, c = k % (N + 1); const a = dbDot(r, c), b = dbDot(r + 1, c); return { pos: a.add(b).multiplyScalar(0.5), horiz: false };
}
function buildDotsBoard(group) {
  const W = 0.86;
  const desk = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.03, W + 0.06), new THREE.MeshStandardMaterial({ color: 0x3a2312, roughness: 0.55 }));
  desk.position.y = TOP + 0.015; group.add(desk);
  const px = 1024, sc = px / W;
  topPlane(group, W, W, TOP + 0.0305, tex(px, px, (g) => {
    g.fillStyle = '#f2ead6'; g.fillRect(0, 0, px, px);
    speckle(g, px, px, 1500, ['#d8ccb0'], 1.2);
    g.strokeStyle = 'rgba(70,110,170,.25)'; g.lineWidth = 2;
    for (let y = 40; y < px; y += 34) { g.beginPath(); g.moveTo(0, y); g.lineTo(px, y); g.stroke(); }
    g.strokeStyle = 'rgba(190,60,60,.35)'; g.beginPath(); g.moveTo(90, 0); g.lineTo(90, px); g.stroke();
    g.fillStyle = '#1d1a16';
    for (let r = 0; r <= 4; r++) for (let c = 0; c <= 4; c++) { g.beginPath(); g.arc(px / 2 + (c - 2) * DB_S * sc, px / 2 + (r - 2) * DB_S * sc, 9, 0, TAU); g.fill(); }
  }), { roughness: 0.9 });
  // An inkwell and a pencil beside the sheet.
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.045, 18), new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.2 }));
  glass.position.set(W / 2 + 0.1, TOP + 0.0225, -0.22); group.add(glass);
  const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.18, 6), new THREE.MeshStandardMaterial({ color: 0xd4a23a, roughness: 0.5 }));
  pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.4; pencil.position.set(W / 2 + 0.1, TOP + 0.005, 0.15); group.add(pencil);
  return TOP + 0.031;
}
const dbLineGeo = new THREE.BoxGeometry(DB_S - 0.02, 0.004, 0.008);
const dbLineMats = [new THREE.MeshStandardMaterial({ color: 0x8a5a12, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.6 })];
const dbBoxGeo = new THREE.PlaneGeometry(DB_S - 0.03, DB_S - 0.03);

/* --- Wing V: The Landlord's Game, as its patent drawing (display) */
function buildLandlord(group) {
  const W = 0.62, D = 0.82;
  const blotter = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.015, D + 0.08), new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.9 }));
  blotter.position.y = TOP + 0.0075; group.add(blotter);
  const px = 768, py = Math.round(768 * D / W);
  topPlane(group, W, D, TOP + 0.0158, tex(px, py, (g, w, h) => {
    g.fillStyle = '#f1ead8'; g.fillRect(0, 0, w, h); speckle(g, w, h, 1200, ['#d8ccb0'], 1.1);
    g.fillStyle = '#2a2a2a'; g.textAlign = 'center';
    g.font = '26px Georgia, serif'; g.fillText('No. 748,626.', w / 2, 56);
    g.font = '20px Georgia, serif'; g.fillText('PATENTED JAN. 5, 1904.', w / 2, 86);
    g.font = 'italic 24px Georgia, serif'; g.fillText('GAME BOARD.', w / 2, 120);
    // A square track of spaces around the edge, drawn in a patent draughtsman's ink.
    const x0 = 80, y0 = 160, size = w - 160, n = 10, s = size / (n + 1);
    g.strokeStyle = '#2a2a2a'; g.lineWidth = 2;
    g.strokeRect(x0, y0, size, size);
    g.strokeRect(x0 + s, y0 + s, size - 2 * s, size - 2 * s);
    for (let k = 1; k <= n; k++) {
      g.beginPath(); g.moveTo(x0 + k * s, y0); g.lineTo(x0 + k * s, y0 + s); g.stroke();
      g.beginPath(); g.moveTo(x0 + k * s, y0 + size - s); g.lineTo(x0 + k * s, y0 + size); g.stroke();
      g.beginPath(); g.moveTo(x0, y0 + k * s); g.lineTo(x0 + s, y0 + k * s); g.stroke();
      g.beginPath(); g.moveTo(x0 + size - s, y0 + k * s); g.lineTo(x0 + size, y0 + k * s); g.stroke();
    }
    for (const [cx, cy] of [[x0, y0], [x0 + size - s, y0], [x0, y0 + size - s], [x0 + size - s, y0 + size - s]]) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + s, cy + s); g.stroke(); }
    g.font = '15px Georgia, serif'; g.fillText('Fig. 1.', w / 2, y0 + size + 34);
    g.textAlign = 'right'; g.font = 'italic 17px Georgia, serif';
    g.fillText('Inventor', w - 70, h - 70);
    g.strokeStyle = '#2a2a2a'; g.beginPath(); g.moveTo(w - 260, h - 50); g.bezierCurveTo(w - 220, h - 80, w - 160, h - 30, w - 90, h - 55); g.stroke();
  }), { roughness: 0.9 });
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 }));
  pen.rotation.z = Math.PI / 2; pen.rotation.y = -0.5; pen.position.set(W / 2 + 0.1, TOP + 0.02, 0.2); group.add(pen);
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
    eyebrow: 'Wing I · Librarium Museum of Play', status: null, begin: 'senet',
    body: [
      'Long before anyone wrote rules down, people were already sitting across a board from each other, moving pieces and trusting their luck. This wing gathers the oldest board games we know of, from the Nile valley to the city of Ur.',
      'Two of them are ready to play. Walk up to a plinth, read its story, and take a seat at the table. The rules of the others are lost, so we show them as they were found. Beyond the arch, Wing II turns from luck to strategy.'
    ],
    facts: [['Look', 'Drag the view'], ['Walk', 'WASD or arrow keys'], ['Visit', 'Click an exhibit or use the timeline']],
  },
  { id: 'senet', wing: 1, side: -1, z: -8, title: 'Senet', date: 'c. 3100 BCE', rail: 'Senet',
    eyebrow: 'Egypt · Early Dynastic period', status: ['recon', 'Rules reconstructed'], game: 'senet',
    body: [
      'Pieces of what may be Senet boards turn up in First Dynasty burials around 3100 BCE, and the first unmistakable painting of the game appears in the tomb of Hesy-Re, about 2620 BCE. It is one of the oldest board games we know by name.',
      'The board has 30 squares, called houses, in three rows of ten. Players threw four flat sticks instead of dice. Over the centuries the game took on religious meaning: its name means "passing", and by the New Kingdom a match stood for the soul\'s journey through the underworld. Tutankhamun was buried with several sets.',
      'No rulebook survives. We play a popular modern reconstruction that follows Timothy Kendall\'s 1979 work.'
    ],
    facts: [['Board', '30 houses, 3 rows of 10'], ['Pieces', '5 each, spools and cones'], ['Moves', '4 throw sticks, 1 to 5'], ['Goal', 'Bear every piece off the board']],
    build: buildSenetBoard },
  { id: 'mehen', wing: 1, side: 1, z: -14, title: 'Mehen', date: 'c. 3100–2300 BCE', rail: 'Mehen',
    eyebrow: 'Egypt · Early Dynastic to Old Kingdom', status: ['lost', 'Rules lost'],
    body: [
      'The Mehen board is a snake coiled around itself, with its head at the center and its tail at the rim. It shares its name with a serpent god who wrapped around the sun god Ra to protect him on his night journey.',
      'Up to six players moved small lion figures and marbles along the coils. The game faded after the Old Kingdom, and no text explains how it worked. Scholars have suggested the lions raced toward the snake\'s head, but every version played today is a guess.'
    ],
    facts: [['Board', 'Coiled serpent, segmented'], ['Pieces', 'Lions and marbles'], ['Players', 'Up to six'], ['Rules', 'Unknown']],
    build: buildMehen },
  { id: 'basur', wing: 1, side: -1, z: -20, title: 'The Başur Höyük Pieces', short: 'Başur Höyük Pieces', date: 'c. 3000 BCE', rail: 'Başur Höyük',
    eyebrow: 'Southeast Turkey · Early Bronze Age', status: ['lost', 'Game unknown'],
    note: 'On display. No board survives to play on.',
    body: [
      'In 2013, archaeologists excavating a Bronze Age burial mound at Başur Höyük found a set of small carved and painted stones: pyramids, round tokens and little animal figures. At around 5,000 years old, they are often called the oldest gaming pieces yet found.',
      'Nobody knows the game they belonged to. Their different shapes and colors may have marked opposing sides or kept score. They are a reminder that the oldest boards we know are only the ones that happened to survive.'
    ],
    facts: [['Found', '2013, in a burial mound'], ['Pieces', 'Pyramids, tokens, animals'], ['Board', 'None survives']],
    build: buildTokens },
  { id: 'ur', wing: 1, side: 1, z: -26, title: 'The Royal Game of Ur', short: 'Royal Game of Ur', date: 'c. 2600–2400 BCE', rail: 'Royal Game of Ur',
    eyebrow: 'Mesopotamia · Sumer', status: ['known', 'Rules survive in writing'], game: 'ur',
    body: [
      'Sir Leonard Woolley found five of these boards while excavating the Royal Cemetery at Ur between 1922 and 1934. The finest are inlaid with shell, red limestone and lapis lazuli. The game, also called Twenty Squares, spread across the ancient Near East, and more than a hundred boards have been found since.',
      'It is the oldest board game whose rules survive in writing. A Babylonian scribe, Itti-Marduk-balāṭu, copied them onto a clay tablet around 177 BCE, and British Museum curator Irving Finkel translated it in the early 1980s. The game outlived its empires: Jewish families in Kochi, India, played a descendant until the 1950s.',
      'We play Finkel\'s widely used reconstruction.'
    ],
    facts: [['Board', '20 squares, 5 rosettes'], ['Pieces', '7 each'], ['Moves', '4 four-sided dice, 0 to 4'], ['Goal', 'Race every piece home']],
    build: buildUrBoard },
  { id: 'hounds', wing: 1, side: -1, z: -32, title: 'Hounds and Jackals', date: 'c. 2000 BCE', rail: 'Hounds and Jackals',
    eyebrow: 'Egypt · Middle Kingdom', status: ['lost', 'Rules lost'],
    body: [
      'Howard Carter, later famous for Tutankhamun\'s tomb, found a complete set of this game in a Theban tomb in 1910. It is now at the Metropolitan Museum of Art in New York. Ten slender pins fit its holes: five topped with hound heads and five with jackals.',
      'The board has 58 holes in two tracks, which is why archaeologists also call it 58 Holes. Boards like it turn up from Egypt to Mesopotamia, Anatolia and the Levant. The larger hole near the top looks like the finish, but the rest of the rules are lost.'
    ],
    facts: [['Board', '58 holes, palm tree inlay'], ['Pieces', '5 hounds, 5 jackals'], ['Spread', 'Egypt to Anatolia'], ['Rules', 'Unknown']],
    build: buildHounds },

  { id: 'wing2', wing: 2, title: 'Strategy Takes the Table', short: 'Wing II', date: 'c. 500 BCE – 1000 CE', rail: 'Wing II',
    eyebrow: 'Wing II · Librarium Museum of Play', status: null, begin: 'go',
    body: [
      'The games in the first wing were races, and the dice or sticks had the final word. Here the luck drains away. These are games of position, where you win by surrounding, trapping or outthinking the person across from you.',
      'Four tables are open: Go on a small board, Nine Men\'s Morris, the mancala game Oware, and the Irish game Brandubh. The Scribe is waiting at each of them, and it plays these games much more carefully than it rolls dice.'
    ],
    facts: [['Tables', 'Go, Morris, Oware, Brandubh'], ['Luck', 'None. Every move is a choice']],
  },
  { id: 'go', wing: 2, side: -1, z: -50, title: 'Weiqi (Go)', date: 'by the 4th century BCE', rail: 'Weiqi (Go)',
    eyebrow: 'China · Zhou dynasty to Han', status: ['known', 'Still played today'],
    game: 'go',
    body: [
      'Weiqi, known in the West by its Japanese name Go, is the oldest board game still played in much the same form. The Zuo Zhuan, a history compiled around the 4th century BCE, mentions it in a story set in 548 BCE, and both Confucius\'s Analects and the book of Mencius refer to it. Legend credits the sage-emperor Yao with inventing it to teach his son discipline.',
      'The oldest complete board, carved in stone during the Eastern Han dynasty (25–220 CE) and found in Hebei province in 1954, has a 17 × 17 grid like this one. The 19 × 19 board was standard by the Tang dynasty. Go reached Korea and Japan by the 7th century, and it became one of the four arts expected of a cultivated scholar, alongside calligraphy, painting and the zither-like guqin.',
      'At this table you play on the 9 × 9 board used today for quick games and teaching, with modern Chinese scoring. The Scribe plays Go differently from the other games: before each move it plays thousands of quick random games from the position and picks the move that wins most often.'
    ],
    facts: [['Board', '17 × 17 on display; 9 × 9 at the table'], ['Pieces', 'Black and white stones'], ['Goal', 'Surround more territory']],
    build: buildGo },
  { id: 'latrunculi', wing: 2, side: 1, z: -56, title: 'Ludus Latrunculorum', date: 'by the 1st century BCE', rail: 'Latrunculi',
    eyebrow: 'Rome · Late Republic to Empire', status: ['recon', 'Rules uncertain'],
    note: 'On display. Scholars still disagree about how the pieces moved.',
    body: [
      'The "game of soldiers", or of brigands, was Rome\'s war game. The scholar Varro mentions it in the 1st century BCE, Ovid alludes to it, and a 1st-century CE poem, the Laus Pisonis, praises a player commanding an army of glass pieces.',
      'Boards scratched into stone turn up wherever the legions went. Sixteen have been found at the fort of Vindolanda on Hadrian\'s Wall alone, and sizes vary from 7 × 8 to 9 × 10 squares. A piece seems to have been captured by trapping it between two enemies, but how pieces moved is still debated, and every modern version is a reconstruction.'
    ],
    facts: [['Board', '7 × 8 to 9 × 10 (8 × 8 here)'], ['Pieces', 'Glass counters'], ['Capture', 'Trap between two'], ['Rules', 'Reconstructed']],
    build: buildLatrunculi },
  { id: 'morris', wing: 2, side: -1, z: -62, title: "Nine Men's Morris", date: 'Roman era onward', rail: "Nine Men's Morris",
    eyebrow: 'The Roman world to medieval Europe', status: ['known', 'Rules survive in tradition'], game: 'morris',
    body: [
      'Boards for Nine Men\'s Morris and its smaller cousin, Three Men\'s Morris, are cut into stone across the Roman world. Carvings at the temple of Kurna in Egypt are often dated to about 1400 BCE, but boards scratched into old buildings are notoriously hard to date and may be far younger.',
      'Under names like merels, mill and Mühle, the game became a European favorite. Alfonso X of Castile pictured it in his Book of Games in the 1280s, monks carved boards into the cloister benches of English cathedrals, villagers cut them into the turf of village greens, and Shakespeare mentions a flooded morris board in A Midsummer Night\'s Dream.'
    ],
    facts: [['Board', '24 points on three squares'], ['Pieces', '9 each'], ['Mill', 'Three in a row takes a piece'], ['Win', 'Leave the Scribe two pieces or no moves']],
    build: buildMorrisBoard },
  { id: 'oware', wing: 2, side: 1, z: -68, title: 'Mancala (Oware)', date: 'c. 6th–7th century CE', rail: 'Oware',
    eyebrow: 'Africa · Aksum to the Akan', status: ['known', 'Rules survive in tradition'], game: 'oware',
    body: [
      'Mancala is a family of hundreds of games played by sowing seeds around rows of pits. The oldest securely dated evidence comes from the Kingdom of Aksum, in today\'s Ethiopia and Eritrea, where rows of pits were cut into rock and shaped in pottery in the 6th and 7th centuries CE. Hollows in far older stone slabs in Jordan may be boards too, but that is debated.',
      'The name comes from the Arabic naqala, "to move". Traders carried the game across the Islamic world and the Indian Ocean, and enslaved West Africans carried it to the Caribbean and the Americas. Our table plays Oware, the game of the Akan peoples of Ghana and Côte d\'Ivoire, with two rows of six pits and 48 seeds.'
    ],
    facts: [['Board', '2 rows of 6 pits'], ['Pieces', '48 seeds'], ['Capture', 'Make 2 or 3 in a Scribe pit'], ['Win', 'Capture 25 seeds']],
    build: buildOwareBoard },
  { id: 'brandubh', wing: 2, side: -1, z: -74, title: 'Brandubh', date: 'c. 900–1000 CE', rail: 'Brandubh',
    eyebrow: 'Ireland · Early Middle Ages', status: ['recon', 'Rules reconstructed'], game: 'brandubh',
    body: [
      'Brandubh, usually translated "black raven", was the Irish member of the tafl family: Norse and Celtic games in which a king tries to escape while a larger army closes in. Irish poems describe it played with five pieces against eight, one of the five being a chief.',
      'The most famous board was found in 1932 at the Ballinderry crannog in County Westmeath, a lake dwelling lived in from the late 9th to the 11th century. It is carved from yew, has 49 peg holes and carved heads for handles, and may have been made in Viking Dublin. No rules survive. Ours follow modern reconstructions built from the poems, the 7 × 7 boards and Linnaeus\'s 1732 notes on the related Sámi game tablut.',
      'Librarium\'s own Calendra comes from the same Celtic world.'
    ],
    facts: [['Board', '7 × 7, a throne and four corners'], ['Pieces', 'King and 4 defenders vs 8'], ['You play', 'The king\'s side'], ['Win', 'Bring the king to a corner']],
    build: buildBrandubhBoard },
  { id: 'wing3', wing: 3, title: 'Kings, Cards and Courts', short: 'Wing III', date: 'c. 480 – 1450 CE', rail: 'Wing III',
    eyebrow: 'Wing III · Librarium Museum of Play', status: null, begin: 'tables',
    body: [
      'Board games became courtly pastimes. In this wing chess travels from India through Persia to the far North, the dice games of Rome and Persia settle into tables, and paper cards arrive from the East and change how Europe plays.',
      'Two tables are open: Tables, the family of games that became backgammon, and Shatranj, the chess of the caliphs\' courts. The Scribe is waiting at both.'
    ],
    facts: [['Tables', 'Tables, Shatranj'], ['Display', 'Chaturanga, Lewis chessmen, cards, tarot']],
  },
  { id: 'tables', wing: 3, side: -1, z: -93, title: 'Tables', short: 'Tables (Backgammon)', date: 'c. 480 CE onward', rail: 'Tables',
    eyebrow: 'Rome, Persia and medieval Europe', status: ['known', 'Rules survive in modern backgammon'], game: 'tables',
    body: [
      'Tables is the family of games that backgammon belongs to. The Byzantine poet Agathias recorded a disastrous throw by the emperor Zeno, who reigned from 474 to 491, in a game of tabula: 24 points, 15 pieces a side and three dice. It descended from the Roman game of twelve lines. In Persia a close relative, nard, appears between the 3rd and 6th centuries, and one legend credits it to a vizier of Khosrow I.',
      'Medieval Europe played tables everywhere. Louis IX banned it from his court in 1254, Alfonso X\'s Book of Games of 1283 describes several versions, and the name backgammon first appears in English in 1647. The doubling cube is a 1920s addition from New York.',
      'We play modern backgammon, without the cube.'
    ],
    facts: [['Board', '24 points in four quarters'], ['Pieces', '15 each'], ['Moves', 'Two dice, doubles count twice'], ['Goal', 'Bear all fifteen off']],
    build: buildTablesBoard },
  { id: 'chaturanga', wing: 3, side: 1, z: -98.5, title: 'Chaturanga', date: 'by c. 600 CE', rail: 'Chaturanga',
    eyebrow: 'India · Gupta period', status: ['recon', 'Rules partly lost'],
    note: 'On display. Nobody knows how the elephant moved, so we play its Persian successor next door.',
    body: [
      'Chaturanga means "four limbs", the four arms of an ancient Indian army: elephants, chariots, cavalry and infantry. It is the oldest known ancestor of chess. The earliest clear references come from north India in the 6th century CE, and the name itself appears in Banabhatta\'s Harsha Charita, written around 625.',
      'It was played on the ashtapada, an uncheckered 8 × 8 board whose marked squares may come from an older race game. The raja, the ratha (chariot) and the ashva (horse) moved like today\'s king, rook and knight, and the mantri stepped one square diagonally. How the gaja, the elephant, moved is still uncertain.'
    ],
    facts: [['Board', '8 × 8 ashtapada'], ['Pieces', 'Raja, mantri, gaja, ashva, ratha, padati'], ['Goal', 'Checkmate, or leave the king bare']],
    build: buildChaturanga },
  { id: 'shatranj', wing: 3, side: -1, z: -104, title: 'Shatranj', date: 'c. 600–1200 CE', rail: 'Shatranj',
    eyebrow: 'Persia and the Islamic world', status: ['known', 'Rules survive in writing'], game: 'shatranj',
    body: [
      'Chaturanga reached Sasanian Persia as chatrang, and after the Islamic conquest it became shatranj, the chess of the caliphs\' courts. Masters such as al-Adli and as-Suli wrote about openings and endgames in the 9th and 10th centuries, ranked players into classes, and composed mansubat: chess problems built from chains of checks.',
      'The pieces were slower than ours. The firzan, ancestor of the queen, stepped a single square diagonally, and the alfil, ancestor of the bishop, hopped two. Through Muslim Spain and Sicily the game reached Europe in the 10th century, where, one explanation goes, the elephant\'s tusks were read as a bishop\'s mitre.'
    ],
    facts: [['Board', '8 × 8, unchequered'], ['Firzan', 'One square diagonally'], ['Alfil', 'Jumps two diagonally'], ['Win', 'Checkmate, stalemate or a bare king']],
    build: buildShatranjBoard },
  { id: 'lewis', wing: 3, side: 1, z: -109.5, title: 'The Lewis Chessmen', short: 'Lewis Chessmen', date: 'c. 1150–1200 CE', rail: 'Lewis Chessmen',
    eyebrow: 'Norway and the Hebrides · 12th century', status: ['known', 'Chess as Europe played it'],
    note: 'On display. The figures here are our own simplified carvings, not copies.',
    body: [
      'Around 1831 a hoard of more than ninety game pieces came to light on the Isle of Lewis in the Outer Hebrides. Most are carved from walrus ivory and a few from whale teeth, probably in Trondheim, Norway, in the later 12th century. The British Museum holds 82 of them and National Museums Scotland 11.',
      'They show chess as medieval Europe played it: kings and queens on thrones, bishops in mitres, knights on ponies, and warders standing in for rooks. Four warders bite the tops of their shields like the berserkers of the Norse sagas. The hoard also held fourteen plain discs for playing tables, and a buckle, perhaps from the bag that carried them.'
    ],
    facts: [['Found', 'Isle of Lewis, about 1831'], ['Material', 'Walrus ivory, whale tooth'], ['Pieces', '79 chessmen, 14 tables discs'], ['Held', 'British Museum, National Museums Scotland']],
    build: buildLewis },
  { id: 'cards', wing: 3, side: -1, z: -115, title: 'Playing Cards', date: 'c. 900–1400 CE', rail: 'Playing Cards',
    eyebrow: 'China, Mamluk Egypt and Europe', status: ['lost', 'Earliest games lost'],
    note: 'On display. These cards are new designs in the old styles.',
    body: [
      'Cards began in China, and a later writer dated them to the Tang dynasty. The earliest certain record is from 969, when an emperor of the Liao dynasty played cards on New Year\'s Eve. They travelled west through Persia to Mamluk Egypt, where packs of four suits showed no human figures: rank was marked with ornament and inscriptions. A Mamluk pack identified in Istanbul\'s Topkapı Palace in the 1930s has suits of coins, cups, swords and sticks.',
      'Cards reached Europe around the 1370s. A Catalan rhyming dictionary names them in 1371, Florence banned a new game called naibbe in 1376, and in 1377 a Dominican friar in Basel described a pack of 52 with kings and marshals. Coins, cups, swords and batons survive today in Italian and Spanish packs.'
    ],
    facts: [['China', 'Recorded by 969 CE'], ['Egypt', 'Mamluk packs, 15th century'], ['Europe', 'From the 1370s'], ['Suits', 'Coins, cups, swords, batons']],
    build: buildCards },
  { id: 'tarot', wing: 3, side: 1, z: -120.5, title: 'Tarot (Tarocchi)', date: 'c. 1440 CE', rail: 'Tarot',
    eyebrow: 'Northern Italy · 15th century', status: ['known', 'Still played as a card game'],
    note: 'On display. These trumps are new paintings in the style of the gilded Milan decks.',
    body: [
      'Tarot began as a card game, not a way of telling fortunes. Around 1440 Italian courts added a fifth suit of picture cards, called trionfi or triumphs, that beat the ordinary suits as trumps. A Ferrara account book of 1442 records painted packs of trionfi, and the gilded decks made for the Visconti and Sforza dukes of Milan in the 1440s and 1450s are the oldest that survive.',
      'The game spread to France and Switzerland, where it is still played. Reading the cards came centuries later: Etteilla wrote about divination with tarot around 1770, Antoine Court de Gébelin claimed an ancient Egyptian origin in 1781, and the Rider-Waite deck followed in 1909.'
    ],
    facts: [['Pack', 'Four suits, 21 trumps and the Fool'], ['Played', 'Trick-taking games'], ['Fortune-telling', 'From about 1770']],
    build: buildTarot },
  { id: 'wing4', wing: 4, title: 'Printed Boards and Parlour Tables', short: 'Wing IV', date: 'c. 1300 – 1900 CE', rail: 'Wing IV',
    eyebrow: 'Wing IV · Librarium Museum of Play', status: null, begin: 'foxgeese',
    body: [
      'Printing changed how people played. Rules were set down in books, boards were sold as printed sheets, and court games became family games at the kitchen table. This wing follows chess\'s new queen and the rise of draughts, and games that travelled from India and China into parlours around the world.',
      'Three tables are open: Fox and Geese, where you play the fox; Draughts; and the Game of the Goose, a race of pure luck.'
    ],
    facts: [['Tables', 'Fox and Geese, Draughts, the Goose'], ['Display', 'The new queen, Pachisi, Mahjong']],
  },
  { id: 'foxgeese', wing: 4, side: -1, z: -138, title: 'Fox and Geese', date: 'by c. 1300 CE', rail: 'Fox and Geese',
    eyebrow: 'Northern Europe · Middle Ages', status: ['known', 'Rules survive in tradition'], game: 'foxgeese',
    body: [
      'Fox and Geese is a hunt: one fox against a whole flock. Its likely ancestor is halatafl, the "tail board" game named in the Icelandic Grettis saga, which was written down in the 14th century. It is a cousin of the tafl games in Wing II.',
      'The household accounts of Edward IV of England, who reigned from 1461 to 1483, record silver-gilt pieces for the game: two foxes and 26 hounds, enough for two sets. Boards scratched into cloister benches show that monks played it too, and Queen Victoria is said to have enjoyed it.',
      'Rules varied from place to place. We play a common English form, with one museum rule added so that every game ends.'
    ],
    facts: [['Board', '33 points on a cross'], ['Pieces', '1 fox, 13 geese'], ['You play', 'The fox'], ['Win', 'Thin the flock, or slip away']],
    build: buildFoxGeeseBoard },
  { id: 'newqueen', wing: 4, side: 1, z: -143.5, title: 'The New Queen', date: 'c. 1475 CE', rail: 'The New Queen',
    eyebrow: 'Valencia · late 15th century', status: ['known', 'Rules survive in writing'],
    note: 'On display. Play shatranj in Wing III to feel how slow the old queen was.',
    body: [
      'For six centuries the piece beside the king was the firzan, a counsellor who stepped a single square diagonally. Then, in late 15th-century Spain, she became the strongest piece on the board, free to sweep any distance in any direction. The bishop gained its long diagonal move at the same time.',
      'The earliest record of the new rules is Scachs d\'amor, a Catalan poem written in Valencia around 1475 by Francí de Castellví, Narcís Vinyoles and Bernat Fenollar, which plays out a game of chess as a courtship. Luis de Lucena\'s book on the game, printed in Salamanca around 1497, spread the new rules further, and the faster game soon replaced the old one across Europe.',
      'On the case: the old firzan, left, and the new queen, right.'
    ],
    facts: [['Queen', 'Any distance, any direction'], ['Bishop', 'Any distance diagonally'], ['First record', 'Scachs d\'amor, c. 1475']],
    build: buildNewChess },
  { id: 'draughts', wing: 4, side: -1, z: -149, title: 'Draughts', date: 'c. 1100s – 1500s CE', rail: 'Draughts',
    eyebrow: 'France, Spain and England', status: ['known', 'Rules survive in tradition'], game: 'draughts',
    body: [
      'Draughts was born when someone moved the pieces of alquerque, an Arabic game played on a grid of lines, onto a chessboard. When is disputed: the historian H. J. R. Murray thought the 12th century, while David Parlett finds the first possible reference in England in 1380. Early players called it fierges or ferses, after the medieval chess queen, and later dames.',
      'Around 1535 the French made capturing compulsory, which turned a pleasant pastime into a sharp game of forced sacrifices. The first book on it was printed in Valencia in 1547, and in 1756 the London mathematician William Payne wrote the first in English. In America it is called checkers.'
    ],
    facts: [['Board', '8 × 8, dark squares only'], ['Pieces', '12 each'], ['Capture', 'Compulsory, by jumping'], ['Win', 'Take or block every enemy piece']],
    build: buildDraughtsBoard },
  { id: 'pachisi', wing: 4, side: 1, z: -154.5, title: 'Pachisi (Chaupar)', date: '16th century CE', rail: 'Pachisi',
    eyebrow: 'India · Mughal court', status: ['known', 'Still played, and the ancestor of Ludo'],
    note: 'On display. It is played by four, so the Scribe sits this one out.',
    body: [
      'Pachisi and its close relative chaupar are race games played on a cross of cloth with four arms of squares. Instead of dice, players throw cowrie shells and count how many land mouth up; the name comes from the Hindi for twenty-five, the highest throw.',
      'How old it is is hard to pin down. A relief in the Ellora caves, carved between the 6th and 8th centuries, is often read as a game of this kind. The most famous board is a courtyard at Fatehpur Sikri, the city the Mughal emperor Akbar built in the 1570s, laid out in red and white stone; accounts say people stood in as the pieces.',
      'British players took the game home. Simplified, with a single die and a square board, it was sold in England as Ludo from 1896, and in America as Parcheesi.'
    ],
    facts: [['Board', 'A cross of four arms'], ['Throws', 'Cowrie shells'], ['Pieces', '4 each, in four colours'], ['Descendants', 'Ludo, Parcheesi']],
    build: buildPachisi },
  { id: 'goose', wing: 4, side: -1, z: -160, title: 'The Game of the Goose', short: 'Game of the Goose', date: 'c. 1575 CE', rail: 'The Goose',
    eyebrow: 'Italy and Europe · 16th century', status: ['known', 'Rules survive in print'], game: 'goose',
    body: [
      'The Game of the Goose is often called the first board game made to be sold. Francesco I de\' Medici, Grand Duke of Tuscany, sent one to Philip II of Spain sometime between 1574 and 1587, and in June 1597 the London printer John Wolfe registered "the newe and most pleasant game of the goose".',
      'It is pure luck: two dice, a spiral of 63 squares, and a goose about every nine squares that sends you flying on. Printed sheets made it cheap, and from a French game of chronology in 1638 onwards, publishers borrowed its spiral to teach history and geography.'
    ],
    facts: [['Board', '63 squares in a spiral'], ['Dice', 'Two'], ['Skill', 'None at all'], ['Win', 'Land exactly on 63']],
    build: buildGooseBoard },
  { id: 'mahjong', wing: 4, side: 1, z: -165.5, title: 'Mahjong', date: 'mid-1800s CE', rail: 'Mahjong',
    eyebrow: 'China · Qing dynasty', status: ['known', 'Still played today'],
    note: 'On display. A full table needs four players, so the Scribe sits this one out.',
    body: [
      'Mahjong took shape in the Shanghai region in the middle or later years of the 19th century, during the Qing dynasty. It grew out of older Chinese card games and keeps their money suits: circles, bamboo and characters, joined by winds and dragons. A full set has 136 tiles, or 144 with the flowers and seasons.',
      'After the First World War an American living in Shanghai, Joseph P. Babcock, simplified the rules, added English labels and coined the name mah-jongg. In the mid-1920s it became a craze in the United States, Britain and Australia, and in 1937 players in New York founded the National Mah Jongg League.'
    ],
    facts: [['Tiles', '136, or 144 with flowers'], ['Suits', 'Circles, bamboo, characters'], ['Players', 'Four']],
    build: buildMahjong },
  { id: 'wing5', wing: 5, title: 'The Modern Board Game', short: 'Wing V', date: 'c. 1840 CE – today', rail: 'Wing V',
    eyebrow: 'Wing V · Librarium Museum of Play', status: null, begin: 'mansion',
    body: [
      'With cheap colour printing, board games became products. Publishers in Salem, Springfield, London and Ravensburg sold games about virtue, money and getting ahead, and inventors patented their ideas. This wing runs from the first American board games to the ancestors of games still on the shelf, and ends with Librarium\'s own.',
      'Three tables are open: Reversi, Halma, and Dots and Boxes.'
    ],
    facts: [['Tables', 'Reversi, Halma, Dots and Boxes'], ['Display', 'Mansion of Happiness, Game of Life, the Landlord\'s Game']],
  },
  { id: 'mansion', wing: 5, side: -1, z: -183, title: 'The Mansion of Happiness', date: '1843 CE', rail: 'Mansion of Happiness',
    eyebrow: 'Salem, Massachusetts', status: ['known', 'Rules survive in print'],
    note: 'On display. Note the teetotum: dice were thought too close to gambling.',
    body: [
      'In 1843 W. & S. B. Ives of Salem, Massachusetts, published The Mansion of Happiness, "an instructive, moral and entertaining amusement". The Library of Congress calls it possibly the first board game published in the United States. It was close to a copy of an English game of 1800, and who adapted it is uncertain: Anne Abbott, who designed other games for the same publisher, has often been credited.',
      'Players spun a numbered top called a teetotum and moved along a spiral. Virtues such as temperance and generosity carried them toward the mansion at the centre; vices such as idleness sent them back toward the pillory.'
    ],
    facts: [['Publisher', 'W. & S. B. Ives, Salem'], ['Moves', 'A spinning teetotum'], ['Goal', 'Reach the mansion at the centre']],
    build: buildMansion },
  { id: 'lifegame', wing: 5, side: 1, z: -188.5, title: 'The Checkered Game of Life', short: 'Checkered Game of Life', date: '1860 CE', rail: 'Game of Life',
    eyebrow: 'Springfield, Massachusetts', status: ['known', 'Rules survive in print'],
    note: 'On display.',
    body: [
      'Milton Bradley had just set up a colour lithography shop in Springfield, Massachusetts, when he printed The Checkered Game of Life in the winter of 1860. He sold the first few hundred copies himself on a two-day trip to New York, and by 1861 buyers had taken more than 45,000.',
      'Like the Mansion of Happiness it was a moral journey, played with a teetotum. Its squares held the virtues and dangers of a life, from Influence and Fat Office to Poverty, Prison and Ruin. The company Bradley founded later grew it into The Game of Life.'
    ],
    facts: [['Maker', 'Milton Bradley'], ['Moves', 'A teetotum'], ['Sold', 'Over 45,000 by 1861']],
    build: buildCheckeredLife },
  { id: 'reversi', wing: 5, side: -1, z: -194, title: 'Reversi', date: '1883 CE', rail: 'Reversi',
    eyebrow: 'Victorian England', status: ['known', 'Rules survive in print'], game: 'reversi',
    body: [
      'Two Englishmen, Lewis Waterman and John W. Mollett, each claimed to have invented reversi in 1883, and each called the other a fraud. Whoever was first, the game of flipping discs caught on: the Saturday Review mentioned it in 1886, and the German publisher Ravensburger was making it by 1893.',
      'In 1971 the Japanese salesman Goro Hasegawa patented Othello, which starts from four discs in the centre instead of an empty board. Othello is the version played in tournaments today, and its opening is the one we use here.'
    ],
    facts: [['Board', '8 × 8'], ['Pieces', '64 two-sided discs'], ['Win', 'Most discs showing']],
    build: buildReversiBoard },
  { id: 'halma', wing: 5, side: 1, z: -199.5, title: 'Halma', date: '1883–84 CE', rail: 'Halma',
    eyebrow: 'Massachusetts and Germany', status: ['known', 'Still played, as Chinese checkers'], game: 'halma',
    body: [
      'Halma, from the Greek for "leap", was invented in 1883 or 1884 by George Howard Monks, a surgeon at Harvard Medical School, who drew on an English game called Hoppity. Each player starts with a camp of men in one corner of a 16 × 16 board and races to move them all into the opposite corner, stepping, or leaping over any piece in chains of jumps.',
      'In 1892 a version on a six-pointed star was published as Stern-Halma, "star Halma". Sold in America under a more exotic name, it became Chinese checkers: a game with no link to China, and none to checkers.',
      'At this table you play the two-player game, 19 men a side. Long chains of leaps are the whole art: build ladders of your own men, and borrow the Scribe\'s.'
    ],
    facts: [['Board', '16 × 16'], ['Players', 'Two or four'], ['Moves', 'A step, or chains of leaps'], ['Descendant', 'Chinese checkers']],
    build: buildHalma },
  { id: 'dotsboxes', wing: 5, side: -1, z: -205, title: 'Dots and Boxes', date: 'late 19th century CE', rail: 'Dots and Boxes',
    eyebrow: 'France', status: ['known', 'Rules survive in print'], game: 'dotsboxes',
    body: [
      'Dots and Boxes needs only a pencil and paper. The French mathematician Édouard Lucas, best known for the Tower of Hanoi puzzle, published it in the late 19th century as la pipopipette, and it has gone by many names since, from boxes to pigs in a pen.',
      'It looks simple, but it hides deep strategy. Strong players count the chains of boxes forming on the board and give a few boxes away on purpose, to force their opponent to open the long chains. The mathematician Elwyn Berlekamp wrote a whole book about it in 2000.'
    ],
    facts: [['Grid', '4 × 4 boxes'], ['Score', 'Close a box, draw again'], ['Win', 'Most boxes']],
    build: buildDotsBoard },
  { id: 'landlord', wing: 5, side: 1, z: -210.5, title: 'The Landlord\'s Game', date: '1904 CE', rail: 'Landlord\'s Game',
    eyebrow: 'United States', status: ['known', 'Rules survive in the patent'],
    note: 'On display, as a patent sheet. The track drawn here is our own sketch, not a copy of the patent figure.',
    body: [
      'Lizzie Magie was granted U.S. Patent 748,626 for The Landlord\'s Game on January 5, 1904. She meant it as a lesson. A follower of the economist Henry George, she wanted players to feel how land monopoly enriches landlords and ruins everyone else, and she gave the game two sets of rules: one that rewarded monopoly, and one that rewarded shared prosperity.',
      'For years players made their own boards, adding the streets of their own towns; Quakers in Atlantic City gave it theirs. In 1935 Parker Brothers bought a version from Charles Darrow, published it as Monopoly and credited him as its inventor. Magie\'s part came back to light in the 1970s, when Ralph Anspach dug up her patents while fighting Parker Brothers in court over his game Anti-Monopoly.'
    ],
    facts: [['Patent', 'U.S. 748,626, 1904'], ['Inventor', 'Lizzie Magie'], ['Descendant', 'Monopoly (1935)']],
    build: buildLandlord },
  { id: 'next', wing: 5, title: 'From These Tables to Yours', short: 'Librarium', date: 'Today', rail: 'Today',
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
const GAMES = { ur: UR, senet: SENET, morris: R.morris, oware: R.oware, brandubh: R.brandubh, tables: R.tables, shatranj: R.shatranj, foxgeese: R.foxgeese, draughts: R.draughts, goose: R.goose, reversi: R.reversi, dotsboxes: R.dotsboxes, halma: R.halma, go: R.go };
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
        const off = (G.id === 'ur' && s === 15) || s === 31;
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
  camW: 1.6,
  intro() { return 'You play the pale pieces. ' + this.prompt(); },
  setup(ex) {
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 9 }, () => {
      const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x1c1916 : 0xe8dcc0, roughness: pl ? 0.3 : 0.45 });
      const m = new THREE.Mesh(morrisPieceGeo, mat); m.userData.mats = [mat]; ex.group.add(m); return m;
    }));
    this.hand = [ex.pieces[0].slice(), ex.pieces[1].slice()];
    this.at = Array(24).fill(null); this.lost = [0, 0];
    [0, 1].forEach(pl => ex.pieces[pl].forEach((m, k) => m.position.copy(this.handSpot(pl, k))));
  },
  handSpot: (pl, k) => V3(-0.4 + k * 0.1, TOP, pl === 0 ? 0.54 : -0.54),
  lostSpot: (owner, k) => V3(owner === 0 ? -0.8 : 0.8, TOP, -0.32 + k * 0.08),
  pt(p) { const q = moPoint(p); return V3(q.x, GAMES.morris.surface, q.z); },
  meshesFor(m) { return m.type === 'place' ? [] : [this.at[m.type === 'move' ? m.from : m.at]]; },
  ringFor(m) { return this.pt(m.type === 'remove' ? m.at : m.to); },
  fromFor(m) { return m.type === 'move' ? this.pt(m.from) : null; },
  ringTone: m => (m.type === 'remove' ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES.morris; let mesh, res;
    if (m.type === 'place') { mesh = this.hand[m.pl].shift(); res = G.apply(m); this.at[m.to] = mesh; await hop(mesh, this.pt(m.to), 0.38, 0.12); }
    else if (m.type === 'move') { mesh = this.at[m.from]; this.at[m.from] = null; this.at[m.to] = mesh; res = G.apply(m); await hop(mesh, this.pt(m.to), m.fly ? 0.45 : 0.3, m.fly ? 0.14 : 0.03); }
    else { mesh = this.at[m.at]; this.at[m.at] = null; res = G.apply(m); const owner = 1 - m.pl; await hop(mesh, this.lostSpot(owner, this.lost[owner]++), 0.45, 0.16); }
    return res;
  },
  score: () => [['You', GAMES.morris.count(0)], ['Scribe', GAMES.morris.count(1)], 'pieces left'],
  prompt() {
    const G = GAMES.morris;
    if (G.hand[0] > 0) return `Place a piece on a glowing point. ${G.hand[0]} left in your hand.`;
    return G.onBoard(0) === 3 ? 'Three pieces left, so yours can fly. Pick a piece, then any empty point.' : 'Pick a piece, then a glowing point next to it.';
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
  camW: 0.98, ringScale: 0.9,
  intro() { return this.prompt(); },
  prompt: () => 'Choose a ring to draw a line between two dots.',
  setup(ex) {
    const G = GAMES.dotsboxes;
    if (!ex.pieces) {
      ex.pieces = {
        lines: Array.from({ length: G.EDGES }, (_, e) => {
          const m = new THREE.Mesh(dbLineGeo, dbLineMats[0]); const mid = dbEdgeMid(e);
          m.position.copy(mid.pos); m.position.y = G.surface + 0.002; if (!mid.horiz) m.rotation.y = Math.PI / 2;
          m.visible = false; ex.group.add(m); return m;
        }),
        boxes: Array.from({ length: G.N * G.N }, (_, b) => {
          const r = (b / G.N) | 0, c = b % G.N;
          const m = new THREE.Mesh(dbBoxGeo, new THREE.MeshBasicMaterial({ color: 0xd4a23a, transparent: true, opacity: 0, depthWrite: false }));
          m.rotation.x = -Math.PI / 2; m.position.set((c - 1.5) * DB_S, G.surface + 0.001, (r - 1.5) * DB_S);
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
  score: () => { const G = GAMES.dotsboxes; return [['You', G.score[0]], ['Scribe', G.score[1]], 'boxes of 16']; },
};
const PRES = { ur: racePresenter(UR), senet: racePresenter(SENET), morris: MORRIS_P, oware: OWARE_P, brandubh: BRANDUBH_P, tables: TABLES_P, shatranj: SHATRANJ_P, foxgeese: FOXGEESE_P, draughts: DRAUGHTS_P, goose: racePresenter(GOOSE), reversi: REVERSI_P, dotsboxes: DOTS_P, halma: HALMA_P, go: GO_P };

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
const STORE_KEY = 'librarium.museum.v1';
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
const rail = $('#lm-rail');
const railButtons = [];
STOPS.forEach((s, i) => {
  if (i === 0 || STOPS[i - 1].wing !== s.wing) {
    const w = document.createElement('span'); w.className = 'wing'; w.textContent = ['', 'Wing I', 'Wing II', 'Wing III', 'Wing IV', 'Wing V'][s.wing]; rail.appendChild(w);
  }
  const b = document.createElement('button');
  b.innerHTML = '<span class="t"></span><span class="d"></span><span class="sr">, visited</span>';
  b.querySelector('.t').textContent = s.rail; b.querySelector('.d').textContent = s.date;
  if (store.visited[s.id]) b.classList.add('seen');
  b.addEventListener('click', () => goStop(i));
  rail.appendChild(b); railButtons.push(b);
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
  railButtons.forEach((b, k) => b.classList.toggle('on', k === i));
  // Scroll the timeline sideways only; scrollIntoView would also scroll the host page.
  const b = railButtons[i], left = b.offsetLeft - rail.clientWidth / 2 + b.offsetWidth / 2;
  rail.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? 'auto' : 'smooth' });
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
  g.surface = ex.surface;
  g.init(); P.setup(ex);
  showPlacard(false); $('#lm-hint').style.opacity = 0; rail.hidden = true;
  root.classList.add('playing');
  resetView(true); updateJoy();
  $('#lm-hud').hidden = false; $('#lm-win').hidden = true; $('#lm-rules').hidden = true;
  $('#lm-hudTitle').textContent = g.name;
  $('#lm-throwBtn').hidden = !g.dice; $('#lm-dice').hidden = !g.dice;
  $('#lm-passBtn').hidden = !g.canPass; $('#lm-passBtn').disabled = true;
  renderRules(g);
  if (!store.rulesSeen[g.id]) { $('#lm-rules').hidden = false; store.rulesSeen[g.id] = true; save(); }
  clearLastMove();
  if (g.dice) renderDice(g, null);
  updateScore();
  setMsg(g.first === 0 ? 'Your turn' : 'The Scribe', g.first === 0 ? '' : 'The Scribe moves first.');
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
  play.token++; clearHighlights(); clearLastMove();
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
$('#lm-passBtn').addEventListener('click', () => { if (play.phase === 'choose' && play.game.canPass) choose({ pl: 0, pass: true }); });

function setMsg(who, text) {
  const m = $('#lm-msg'); m.innerHTML = '';
  const w = document.createElement('span'); w.className = 'who'; w.textContent = who; m.appendChild(w);
  m.appendChild(document.createTextNode(text));
}
function updateScore() {
  const [a, b, suffix] = play.P.score(); const s = $('#lm-score'); s.innerHTML = '';
  const add = ([label, val]) => { const el = document.createElement('b'); el.textContent = val; s.append(label + ' ', el); };
  add(a); s.append('  ·  '); add(b); if (suffix) s.append('  ' + suffix);
}
function renderDice(g, r, shaking = false) {
  const d = $('#lm-dice'); d.innerHTML = ''; d.classList.toggle('shake', shaking);
  const faces = r ? r.faces : g.pipDice ? [1, 1] : [0, 0, 0, 0];
  faces.forEach(f => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 30 30');
    if (g.pipDice) {
      const p = document.createElementNS(ns, 'rect'); p.setAttribute('x', '3'); p.setAttribute('y', '3'); p.setAttribute('width', '24'); p.setAttribute('height', '24'); p.setAttribute('rx', '5');
      p.setAttribute('fill', '#ecdfc3'); p.setAttribute('stroke', '#a8977a'); p.setAttribute('stroke-width', '1.2'); svg.appendChild(p);
      const pips = { 1: [[15, 15]], 2: [[9, 9], [21, 21]], 3: [[9, 9], [15, 15], [21, 21]], 4: [[9, 9], [21, 9], [9, 21], [21, 21]], 5: [[9, 9], [21, 9], [15, 15], [9, 21], [21, 21]], 6: [[9, 8], [21, 8], [9, 15], [21, 15], [9, 22], [21, 22]] }[r ? f : 1];
      for (const [x, y] of pips) { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', '2.6'); c.setAttribute('fill', r ? '#1d140c' : '#c9b79a'); svg.appendChild(c); }
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
function rollText(g, r) { return g.pipDice ? (r.faces[0] === r.faces[1] ? `double ${r.faces[0]}s` : `${r.faces[0]} and ${r.faces[1]}`) : String(r.value); }
async function showRoll(r) {
  const g = play.game, tok = play.token;
  for (let k = 0; k < (reduceMotion ? 1 : 5); k++) { renderDice(g, g.roll(), true); await wait(90); if (tok !== play.token) return false; }
  renderDice(g, r, false);
  return tok === play.token;
}
function beginTurn(pl, first) {
  if (mode !== 'play') return;
  const g = play.game, P = play.P;
  updateScore();
  if (!g.dice) { const r = g.result(pl); if (r) return finish(r); }
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
    if (g.dice) {
      play.phase = 'throw'; $('#lm-throwBtn').disabled = false;
      setMsg('Your turn', first ? P.intro() : P.prompt());
      $('#lm-throwBtn').focus({ preventScroll: true });
    } else offer(g.legal(0), first ? P.intro() : P.prompt());
  } else {
    play.phase = 'ai'; $('#lm-throwBtn').disabled = true;
    setMsg('The Scribe', g.dice ? 'The Scribe is throwing…' : 'The Scribe is thinking…');
    aiTurn();
  }
}
function offer(moves, text) {
  play.moves = moves; play.phase = 'choose';
  $('#lm-passBtn').disabled = false;
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
    beginTurn(1); return;
  }
  if (g.autoMove && moves.length === 1) {
    setMsg('Your turn', `You threw ${rollText(g, r)}.`);
    play.moves = moves; play.phase = 'choose';
    await wait(400); if (tok !== play.token) return;
    return choose(moves[0]);
  }
  offer(moves, `You threw ${rollText(g, r)}. Choose a glowing piece${moves.length === 1 ? ' (only one can move)' : ''}.`);
}
async function choose(m) {
  if (play.phase !== 'choose') return;
  play.phase = 'anim'; clearHighlights(); clearLastMove();
  $('#lm-passBtn').disabled = true;
  const g = play.game, tok = play.token;
  const res = await play.P.play(m);
  if (tok !== play.token) return;
  updateScore();
  if (res.followUp && res.followUp.length) { offer(res.followUp, (res.note ? res.note + ' ' : '') + g.followPrompt); return; }
  if (g.dice) {
    if (g.done(0)) return finish({ winner: 0, text: g.winText ? g.winText(0) : '' });
    if (g.extra(m, play.roll.value)) {
      setMsg('Your turn', (res.note ? res.note + ' ' : '') + g.extraNote);
      play.phase = 'throw'; $('#lm-throwBtn').disabled = false; return;
    }
  }
  if (res.note) { setMsg('Your turn', res.note); await wait(readTime(res.note)); if (tok !== play.token) return; }
  beginTurn(1);
}
async function aiTurn() {
  const g = play.game, P = play.P, tok = play.token;
  await wait(650); if (tok !== play.token) return;
  if (g.dice) {
    const r = g.roll();
    if (!(await showRoll(r))) return;
    const moves = g.legal(1, r.value, r);
    if (!moves.length) {
      setMsg('The Scribe', `The Scribe threw ${rollText(g, r)} and cannot move.`);
      await wait(1300); if (tok !== play.token) return;
      beginTurn(0); return;
    }
    setMsg('The Scribe', `The Scribe threw ${rollText(g, r)}.`);
    const plan = g.aiPlan(1, moves);
    await wait(500); if (tok !== play.token) return;
    let res = {};
    const m = plan[plan.length - 1];
    clearLastMove();
    for (const step of plan) {
      const from = P.fromFor ? P.fromFor(step) : null, to = P.ringFor(step);
      res = await P.play(step);
      markLastMove(from, to);
      if (tok !== play.token) return;
      updateScore();
      if (res.note) setMsg('The Scribe', res.note);
    }
    if (g.done(1)) return finish({ winner: 1, text: g.winText ? g.winText(1) : '' });
    if (g.extra(m, r.value)) { setMsg('The Scribe', (res.note ? res.note + ' ' : '') + 'The Scribe throws again.'); await wait(900); if (tok !== play.token) return; aiTurn(); return; }
    if (res.note) { setMsg('The Scribe', res.note); await wait(readTime(res.note) + 250); if (tok !== play.token) return; }
    beginTurn(0);
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
    updateScore();
    if (res.note) { setMsg('The Scribe', res.note); said = true; }
  }
  if (said) { await wait(1000); if (tok !== play.token) return; }
  beginTurn(0);
}
function finish(res) {
  play.phase = 'over'; clearHighlights();
  const g = play.game, P = play.P;
  if (P.onFinish) P.onFinish(res);
  updateScore();
  $('#lm-winTitle').textContent = res.winner === 0 ? 'You win' : res.winner === 1 ? 'The Scribe wins' : 'A draw';
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
  const P = play.P;
  const mat = new THREE.MeshBasicMaterial({ color: RING_COLOR[P.ringTone ? P.ringTone(m) : 'gold'], transparent: true, opacity: P.ringOpacity || 0.85, depthWrite: false });
  const ring = new THREE.Mesh(ringGeo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(P.ringFor(m)); ring.position.y += 0.004;
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
// Stop Safari's own page zoom from fighting the museum's pinch.
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
// On its own page the museum always takes the keyboard. Embedded, it only does so
// while the pointer is over it or focus is inside it, so the host page still scrolls.
let pointerInside = false;
root.addEventListener('pointerenter', () => { pointerInside = true; });
root.addEventListener('pointerleave', () => { pointerInside = false; keys.clear(); });
const keyboardOwned = () => !embedded || pointerInside || root.contains(document.activeElement) || document.fullscreenElement === root;
window.addEventListener('keydown', e => {
  if (!keyboardOwned()) return;
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
  window.__museum = {
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

