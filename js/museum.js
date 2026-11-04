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

/* ------------------------------------------------------------------ renderer */
const canvas = $('#scene');
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
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.8 ? 72 : 58;
  camera.updateProjectionMatrix();
  if (mode === 'play' && play.ex) flyToPlay(play.ex, 0.4);
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
const HALL = { half: 5, zNear: 4, zFar: -131, h: 5, dividers: [-41, -86] };
const wingOf = z => HALL.dividers.filter(d => z < d).length; // 0-based wing index
function buildHall() {
  const len = HALL.zNear - HALL.zFar, midZ = (HALL.zNear + HALL.zFar) / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.half * 2, len), MAT.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.z = midZ; scene.add(floor);
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
  buildEndArch();
  buildBanner(-2.6, 'The Dawn of Play', 'Wing I  ·  c. 3100 – 2000 BCE');
  buildBanner(HALL.dividers[0] - 3.6, 'Strategy Takes the Table', 'Wing II  ·  c. 500 BCE – 1000 CE');
  buildBanner(HALL.dividers[1] - 3.6, 'Kings, Cards and Courts', 'Wing III  ·  c. 480 – 1450 CE');
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
  const buckets = [0, 1, 2].map(() => ({ mats: [], cols: [] }));
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
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: signTex('Wing IV', 'IN PREPARATION') }));
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
  topPlane(group, W, W, TOP + 0.1205, map);
  const stoneGeo = new THREE.SphereGeometry(0.0185, 18, 10);
  const black = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.32 });
  const white = new THREE.MeshStandardMaterial({ color: 0xefe9dc, roughness: 0.28 });
  const R = seeded(548), board = new Map();
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= N || y >= N || board.has(x + ',' + y)) return false;
    board.set(x + ',' + y, c);
    const s = new THREE.Mesh(stoneGeo, c ? white : black); s.scale.y = 0.42;
    s.position.set((x - (N - 1) / 2) * S + (R() - 0.5) * 0.004, TOP + 0.128, (y - (N - 1) / 2) * S + (R() - 0.5) * 0.004);
    group.add(s); return true;
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
      'Three tables are open: Nine Men\'s Morris, the mancala game Oware, and the Irish game Brandubh. The Scribe is waiting at each of them, and it plays these games much more carefully than it rolls dice.'
    ],
    facts: [['Tables', 'Morris, Oware, Brandubh'], ['Luck', 'None. Every move is a choice']],
  },
  { id: 'go', wing: 2, side: -1, z: -50, title: 'Weiqi (Go)', date: 'by the 4th century BCE', rail: 'Weiqi (Go)',
    eyebrow: 'China · Zhou dynasty to Han', status: ['known', 'Still played today'],
    note: 'On display. A Go table needs a stronger Scribe than this one, so it is planned for a later visit.',
    body: [
      'Weiqi, known in the West by its Japanese name Go, is the oldest board game still played in much the same form. The Zuo Zhuan, a history compiled around the 4th century BCE, mentions it in a story set in 548 BCE, and both Confucius\'s Analects and the book of Mencius refer to it. Legend credits the sage-emperor Yao with inventing it to teach his son discipline.',
      'The oldest complete board, carved in stone during the Eastern Han dynasty (25–220 CE) and found in Hebei province in 1954, has a 17 × 17 grid like this one. The 19 × 19 board was standard by the Tang dynasty. Go reached Korea and Japan by the 7th century, and it became one of the four arts expected of a cultivated scholar, alongside calligraphy, painting and the zither-like guqin.'
    ],
    facts: [['Board', '17 × 17 here, 19 × 19 today'], ['Pieces', 'Black and white stones'], ['Goal', 'Surround more territory']],
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
  { id: 'next', wing: 3, title: 'From These Tables to Yours', short: 'Librarium', date: 'Today', rail: 'Today',
    eyebrow: 'Librarium Games', status: null,
    body: [
      'Thousands of years after Senet, Ur and Weiqi, people still gather to throw dice, shuffle cards and corner each other\'s kings. Librarium Games carries the tradition on with tables of its own, from Calendra, a Celtic game of runes and seasons, to Phoenix Farm.',
      'Wing IV is in preparation. Until it opens, the Librarium\'s own games are waiting in the Tavern.'
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
const GAMES = { ur: UR, senet: SENET, morris: R.morris, oware: R.oware, brandubh: R.brandubh, tables: R.tables, shatranj: R.shatranj };
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
    camW: G.id === 'senet' ? 1.62 : 1.78,
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
    score: () => [['You', G.home(0) + '/' + G.N], ['Scribe', G.home(1) + '/' + G.N], 'borne off'],
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
const PRES = { ur: racePresenter(UR), senet: racePresenter(SENET), morris: MORRIS_P, oware: OWARE_P, brandubh: BRANDUBH_P, tables: TABLES_P, shatranj: SHATRANJ_P };

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
  if (stop.id === 'wing2' || stop.id === 'wing3') {
    const d = HALL.dividers[stop.id === 'wing2' ? 0 : 1];
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
  return flyTo(g.localToWorld(pos), g.localToWorld(center.clone().add(V3(0, 0, -0.03))), dur);
}

/* ------------------------------------------------------- UI: placard + rail */
let mode = 'gallery', current = 0;
const rail = $('#rail');
const railButtons = [];
STOPS.forEach((s, i) => {
  if (i === 0 || STOPS[i - 1].wing !== s.wing) {
    const w = document.createElement('span'); w.className = 'wing'; w.textContent = ['', 'Wing I', 'Wing II', 'Wing III'][s.wing]; rail.appendChild(w);
  }
  const b = document.createElement('button');
  b.innerHTML = '<span class="t"></span><span class="d"></span>';
  b.querySelector('.t').textContent = s.rail; b.querySelector('.d').textContent = s.date;
  b.addEventListener('click', () => goStop(i));
  rail.appendChild(b); railButtons.push(b);
});
function renderPlacard(s) {
  const body = $('#placardBody'); body.innerHTML = '';
  const el = (t, cls, txt) => { const e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; body.appendChild(e); return e; };
  el('div', 'eyebrow', s.eyebrow);
  el('h2', '', s.title);
  el('div', 'date', s.date);
  if (s.status) el('div', 'status ' + s.status[0], s.status[1]);
  s.body.forEach(p => el('p', '', p));
  if (s.facts.length) {
    const dl = el('dl', 'facts');
    s.facts.forEach(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); });
  }
  body.scrollTop = 0;
  const act = $('#placardActions'); act.innerHTML = '';
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
function showPlacard(on) { placardOpen = on; $('#placard').classList.toggle('away', !on); }
// On phones the placard is a bottom sheet, so the picture slides up to stay visible above it.
let viewShift = 0;
function updateViewShift(dt) {
  const h = window.innerHeight, w = window.innerWidth;
  const want = mode === 'gallery' && placardOpen && w <= 720 ? 0.26 : 0;
  viewShift += (want - viewShift) * Math.min(1, dt * 6);
  if (Math.abs(viewShift) < 0.002) { if (camera.view && camera.view.enabled) camera.clearViewOffset(); viewShift = want ? viewShift : 0; return; }
  camera.setViewOffset(w, h, 0, h * viewShift, w, h);
}
function setActive(i) {
  current = i;
  railButtons.forEach((b, k) => b.classList.toggle('on', k === i));
  railButtons[i].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}
function goStop(i, fly = true) {
  if (mode !== 'gallery') return;
  setActive(i);
  renderPlacard(STOPS[i]); showPlacard(true);
  if (fly) { const v = stopView(STOPS[i]); flyTo(v.pos, v.target); }
}
$('#closeP').addEventListener('click', () => showPlacard(false));
$('#helpBtn').addEventListener('click', () => { if (mode === 'gallery') goStop(0); else $('#rules').hidden = !$('#rules').hidden; });

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
  showPlacard(false); $('#hint').style.opacity = 0; rail.hidden = true;
  document.body.classList.add('playing');
  $('#hud').hidden = false; $('#win').hidden = true; $('#rules').hidden = true;
  $('#hudTitle').textContent = g.name;
  $('#throwBtn').hidden = !g.dice; $('#dice').hidden = !g.dice;
  renderRules(g);
  if (g.dice) renderDice(g, null);
  updateScore();
  setMsg(g.first === 0 ? 'Your turn' : 'The Scribe', g.first === 0 ? '' : 'The Scribe moves first.');
  await flyToPlay(ex);
  beginTurn(g.first, true);
}
function renderRules(g) {
  const r = $('#rules'); r.innerHTML = '';
  const h = document.createElement('h3'); h.textContent = 'How to play ' + g.name; r.appendChild(h);
  const ul = document.createElement('ul'); g.rules.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }); r.appendChild(ul);
  const p = document.createElement('p'); p.className = 'src'; p.textContent = g.source; r.appendChild(p);
}
function leaveGame() {
  if (mode !== 'play') return;
  play.token++; clearHighlights();
  mode = 'gallery';
  $('#hud').hidden = true; rail.hidden = false; $('#hint').style.opacity = 1;
  document.body.classList.remove('playing');
  goStop(STOPS.indexOf(play.ex));
}
$('#leaveBtn').addEventListener('click', leaveGame);
$('#winLeave').addEventListener('click', leaveGame);
$('#againBtn').addEventListener('click', () => { const ex = play.ex; play.token++; clearHighlights(); mode = 'gallery'; startGame(ex); });
$('#rulesBtn').addEventListener('click', () => { $('#rules').hidden = !$('#rules').hidden; });
$('#throwBtn').addEventListener('click', humanThrow);

function setMsg(who, text) {
  const m = $('#msg'); m.innerHTML = '';
  const w = document.createElement('span'); w.className = 'who'; w.textContent = who; m.appendChild(w);
  m.appendChild(document.createTextNode(text));
}
function updateScore() {
  const [a, b, suffix] = play.P.score(); const s = $('#score'); s.innerHTML = '';
  const add = ([label, val]) => { const el = document.createElement('b'); el.textContent = val; s.append(label + ' ', el); };
  add(a); s.append('  ·  '); add(b); if (suffix) s.append('  ' + suffix);
}
function renderDice(g, r, shaking = false) {
  const d = $('#dice'); d.innerHTML = ''; d.classList.toggle('shake', shaking);
  const faces = r ? r.faces : g.id === 'tables' ? [1, 1] : [0, 0, 0, 0];
  faces.forEach(f => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 30 30');
    if (g.id === 'tables') {
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
function rollText(g, r) { return g.id === 'tables' ? (r.faces[0] === r.faces[1] ? `double ${r.faces[0]}s` : `${r.faces[0]} and ${r.faces[1]}`) : String(r.value); }
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
  if (pl === 0) {
    if (g.dice) {
      play.phase = 'throw'; $('#throwBtn').disabled = false;
      setMsg('Your turn', first ? P.intro() : P.prompt());
      $('#throwBtn').focus({ preventScroll: true });
    } else offer(g.legal(0), first ? P.intro() : P.prompt());
  } else {
    play.phase = 'ai'; $('#throwBtn').disabled = true;
    setMsg('The Scribe', g.dice ? 'The Scribe is throwing…' : 'The Scribe is thinking…');
    aiTurn();
  }
}
function offer(moves, text) {
  play.moves = moves; play.phase = 'choose';
  highlight(moves);
  setMsg('Your turn', text);
}
async function humanThrow() {
  if (play.phase !== 'throw') return;
  play.phase = 'rolling'; $('#throwBtn').disabled = true;
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
  offer(moves, `You threw ${rollText(g, r)}. Choose a glowing piece${moves.length === 1 ? ' (only one can move)' : ''}.`);
}
async function choose(m) {
  if (play.phase !== 'choose') return;
  play.phase = 'anim'; clearHighlights();
  const g = play.game, tok = play.token;
  const res = await play.P.play(m);
  if (tok !== play.token) return;
  updateScore();
  if (res.followUp && res.followUp.length) { offer(res.followUp, (res.note ? res.note + ' ' : '') + g.followPrompt); return; }
  if (g.dice) {
    if (g.done(0)) return finish({ winner: 0 });
    if (g.extra(m, play.roll.value)) {
      setMsg('Your turn', (res.note ? res.note + ' ' : '') + g.extraNote);
      play.phase = 'throw'; $('#throwBtn').disabled = false; return;
    }
  }
  if (res.note) { setMsg('Your turn', res.note); await wait(850); if (tok !== play.token) return; }
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
    for (const step of plan) {
      res = await P.play(step);
      if (tok !== play.token) return;
      updateScore();
      if (res.note) setMsg('The Scribe', res.note);
    }
    if (g.done(1)) return finish({ winner: 1 });
    if (g.extra(m, r.value)) { setMsg('The Scribe', (res.note ? res.note + ' ' : '') + 'The Scribe throws again.'); await wait(900); if (tok !== play.token) return; aiTurn(); return; }
    if (res.note) { setMsg('The Scribe', res.note); await wait(1100); if (tok !== play.token) return; }
    beginTurn(0);
    return;
  }
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
  const plan = g.aiPlan(1);
  if (tok !== play.token || !plan) return;
  let said = false;
  for (const m of plan) {
    const res = await P.play(m);
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
  $('#winTitle').textContent = res.winner === 0 ? 'You win' : res.winner === 1 ? 'The Scribe wins' : 'A draw';
  $('#winText').textContent = res.text || (res.winner === 0
    ? `All ${g.N} of your pieces are home. The Scribe bows and resets the board.`
    : `The Scribe brought all ${g.N} pieces home first. You bore off ${g.home(0)}.`);
  setTimeout(() => { if (play.phase === 'over') { $('#win').hidden = false; $('#againBtn').focus({ preventScroll: true }); } }, res.sweep ? 900 : 300);
}
function addRing(m) {
  const P = play.P;
  const mat = new THREE.MeshBasicMaterial({ color: RING_COLOR[P.ringTone ? P.ringTone(m) : 'gold'], transparent: true, opacity: 0.85, depthWrite: false });
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
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (down) {
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!down.moved && Math.hypot(dx, dy) > 6) down.moved = true;
    const mx = e.clientX - down.lx, my = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY;
    if (down.moved && mode === 'gallery') {
      camTween = null;
      cam.yaw += mx * 0.0042; cam.pitch += my * 0.0035;
      cam.pitch = Math.max(-0.95, Math.min(0.7, cam.pitch));
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
canvas.addEventListener('pointerup', e => {
  const d = down; down = null;
  if (!d || d.moved) return;
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
  if (hit) { const i = stopFromHit(hit.object); if (i >= 0) goStop(i); }
});
canvas.addEventListener('pointercancel', () => { down = null; });
const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
window.addEventListener('keydown', e => {
  if (mode === 'play') {
    if (e.code === 'Space' && play.phase === 'throw' && document.activeElement !== $('#throwBtn')) { e.preventDefault(); humanThrow(); }
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
    if (s.id === 'hall' || s.id === 'wing2' || s.id === 'wing3') return;
    const v = stopView(s); const d = Math.hypot(v.target.x - cam.pos.x, v.target.z - cam.pos.z);
    if (d < bd) { bd = d; best = i; }
  });
  if (best >= 0 && best !== current) { setActive(best); renderPlacard(STOPS[best]); showPlacard(true); }
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
  if (mode === 'gallery' && keys.size) {
    const sp = 3.2 * dt, f = V3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), r = V3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    if (keys.has('f')) cam.pos.addScaledVector(f, sp); if (keys.has('b')) cam.pos.addScaledVector(f, -sp);
    if (keys.has('r')) cam.pos.addScaledVector(r, sp); if (keys.has('l')) cam.pos.addScaledVector(r, -sp);
    cam.pos.x = Math.max(-1.3, Math.min(1.3, cam.pos.x)); cam.pos.z = Math.max(HALL.zFar + 3.2, Math.min(HALL.zNear - 0.8, cam.pos.z));
    cam.pos.y += (1.62 - cam.pos.y) * Math.min(1, dt * 4);
    $('#hint').style.opacity = 0;
  }
  camera.position.copy(cam.pos); camera.rotation.set(cam.pitch, cam.yaw, 0);
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
  const v = stopView(STOPS[0]); const a = lookAngles(v.pos, v.target);
  cam.pos.copy(v.pos).add(V3(0, 0, 1.2)); cam.yaw = a.yaw; cam.pitch = a.pitch;
  if (coarse) { $('#hint').textContent = 'Drag to look · Tap an exhibit or the timeline'; STOPS[0].facts = [['Look', 'Drag the view'], ['Visit', 'Tap an exhibit or the timeline below']]; }
  frame();
  setTimeout(() => { $('#loader').classList.add('done'); goStop(0, false); flyTo(v.pos, v.target, 2.2); }, 250);
  setTimeout(() => { $('#hint').style.opacity = 0; }, 12000);
}
// Inspect the live state from the console with ?debug in the address.
if (/[?&]debug\b/.test(location.search)) {
  window.__museum = { play, GAMES, PRES, STOPS, cam, choose, humanThrow, startGame, leaveGame, goStop };
  // Keep the scene ticking when the browser starves animation frames (a hidden pane or tab).
  setInterval(() => { if (performance.now() - lastStep > 120) step(); }, 40);
}
boot();
})();

