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

/* ------------------------------------------------------------------ hall */
const HALL = { half: 5, zNear: 4, zFar: -41, h: 5 };
function buildHall() {
  const len = HALL.zNear - HALL.zFar, midZ = (HALL.zNear + HALL.zFar) / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.half * 2, len), MAT.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.z = midZ; scene.add(floor);
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.6, len - 6), MAT.runner);
  runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.005, midZ - 1); scene.add(runner);
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
  buildArch();
  buildBanner();
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
  const mats = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const cols = [];
  for (const s of [-1, 1]) {
    for (const y of rows) {
      let z = HALL.zNear - 0.05;
      while (z > HALL.zFar + 0.05) {
        const t = rand(0.03, 0.075), h = rand(0.34, 0.54), d = rand(0.19, 0.25);
        if (Math.random() < 0.035) { z -= rand(0.08, 0.3); continue; }
        const lean = Math.random() < 0.06 ? rand(-0.25, 0.25) : 0;
        p.set(s * (HALL.half - 0.05 - d / 2), y + h / 2 + 0.002, z - t / 2);
        e.set(lean, 0, 0); q.setFromEuler(e); sc.set(d, h, t);
        m4.compose(p, q, sc); mats.push(m4.clone());
        const c = colors[(Math.random() * colors.length) | 0].clone().multiplyScalar(rand(0.7, 1.15));
        cols.push(c);
        z -= t + 0.002;
      }
    }
  }
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), mats.length);
  mats.forEach((m, i) => { books.setMatrixAt(i, m); books.setColorAt(i, cols[i]); });
  books.instanceMatrix.needsUpdate = true; books.instanceColor.needsUpdate = true;
  scene.add(books);
}

function buildArch() {
  const z = HALL.zFar + 0.02;
  const recess = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), new THREE.MeshBasicMaterial({ color: 0x050403 }));
  recess.position.set(0, 1.6, z); scene.add(recess);
  const top = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32, 0, Math.PI), recess.material);
  top.position.set(0, 3.2, z); scene.add(top);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.09, 8, 40, Math.PI), MAT.stone);
  frame.position.set(0, 3.2, z + 0.05); scene.add(frame);
  for (const s of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), MAT.stone);
    col.position.set(s * 1.3, 1.6, z + 0.05); scene.add(col);
  }
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 8), new THREE.MeshLambertMaterial({ color: 0x6a1a12 }));
  rope.rotation.z = Math.PI / 2; rope.position.set(0, 0.95, z + 0.6); scene.add(rope);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: tex(720, 180, (g, w, h) => {
    g.fillStyle = '#1a120c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a3782c'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#e8c27a'; g.textAlign = 'center';
    g.font = '58px "Almendra SC", serif'; g.fillText('Wing II · The Classical World', w / 2, 92);
    g.font = '30px "Montserrat", sans-serif'; g.fillStyle = '#a8977a'; g.fillText('IN PREPARATION', w / 2, 140);
  }) }));
  sign.position.set(0, 1.55, z + 0.3); scene.add(sign);
}

function buildBanner() {
  const t = tex(1400, 300, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a0f0b'); gr.addColorStop(1, '#170806');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c38a2a'; g.lineWidth = 5; g.strokeRect(18, 18, w - 36, h - 36);
    g.lineWidth = 1.5; g.strokeRect(30, 30, w - 60, h - 60);
    g.fillStyle = '#f6a01a'; g.textAlign = 'center';
    g.font = '118px "Almendra SC", serif'; g.fillText('The Dawn of Play', w / 2, 160);
    g.fillStyle = '#d9c7a2'; g.font = '40px "Almendra SC", serif';
    g.fillText('Wing I  ·  c. 3100 – 2000 BCE', w / 2, 232);
  });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.2), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
  banner.position.set(0, 3.75, -2.6); scene.add(banner);
  for (const s of [-1, 1]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.65, 4), MAT.brass);
    chain.position.set(s * 2.5, 4.68, -2.6); scene.add(chain);
  }
}

/* --------------------------------------------------------------- lights */
scene.add(new THREE.HemisphereLight(0x5a4535, 0x0b0806, 0.55));
scene.add(new THREE.AmbientLight(0x2a1d14, 0.45));
const candles = [];
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
  const light = new THREE.PointLight(0xff9a4a, 1.25, 9, 1.6); light.position.set(-s * 0.35, 0.35, 0); g.add(light);
  scene.add(g);
  candles.push({ light, flame, halo, seed: Math.random() * 100 });
}
const glowTex = tex(64, 64, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,220,160,.7)'); r.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});

/* ---------------------------------------------------------------- dust */
let dust;
function buildDust() {
  const n = coarse ? 220 : 420, pos = new Float32Array(n * 3);
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
    g.font = '30px "Almendra SC", serif'; g.fillText(date, w / 2, 122);
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
  const spot = new THREE.SpotLight(0xffdcae, 2.6, 7.5, 0.5, 0.65, 1.3);
  spot.position.set(0, 3.9, 0.9); spot.target.position.set(0, TOP, 0); g.add(spot); g.add(spot.target);
  scene.add(g);
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

/* --- Finale lectern */
let lectern;
function buildLectern() {
  const g = new THREE.Group(); g.position.set(0, 0, -37.2);
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
  const spot = new THREE.SpotLight(0xffd29a, 2.4, 6, 0.45, 0.7, 1.3); spot.position.set(0, 3.6, 0.9); spot.target.position.set(0, 1.1, 0); g.add(spot); g.add(spot.target);
  scene.add(g); lectern = g;
}

/* ---------------------------------------------------------- exhibit data */
const STOPS = [
  { id: 'hall', title: 'The Dawn of Play', short: 'Welcome', date: 'Wing I', rail: 'Entrance',
    eyebrow: 'Wing I · Librarium Museum of Play',
    status: null,
    body: [
      'Long before anyone wrote rules down, people were already sitting across a board from each other, moving pieces and trusting their luck. This wing gathers the oldest board games we know of, from the Nile valley to the city of Ur.',
      'Two of them are ready to play. Walk up to a plinth, read its story, and take a seat at the table. The rules of the others are lost, so we show them as they were found.'
    ],
    facts: [['Look', 'Drag the view'], ['Walk', 'WASD or arrow keys'], ['Visit', 'Click an exhibit or use the timeline']],
  },
  { id: 'senet', side: -1, z: -8, title: 'Senet', date: 'c. 3100 BCE', rail: 'Senet',
    eyebrow: 'Egypt · Early Dynastic period', status: ['recon', 'Rules reconstructed'], game: 'senet',
    body: [
      'Pieces of what may be Senet boards turn up in First Dynasty burials around 3100 BCE, and the first unmistakable painting of the game appears in the tomb of Hesy-Re, about 2620 BCE. It is one of the oldest board games we know by name.',
      'The board has 30 squares, called houses, in three rows of ten. Players threw four flat sticks instead of dice. Over the centuries the game took on religious meaning: its name means "passing", and by the New Kingdom a match stood for the soul\'s journey through the underworld. Tutankhamun was buried with several sets.',
      'No rulebook survives. We play a popular modern reconstruction that follows Timothy Kendall\'s 1979 work.'
    ],
    facts: [['Board', '30 houses, 3 rows of 10'], ['Pieces', '5 each, spools and cones'], ['Moves', '4 throw sticks, 1 to 5'], ['Goal', 'Bear every piece off the board']],
    build: buildSenetBoard },
  { id: 'mehen', side: 1, z: -14, title: 'Mehen', date: 'c. 3100–2300 BCE', rail: 'Mehen',
    eyebrow: 'Egypt · Early Dynastic to Old Kingdom', status: ['lost', 'Rules lost'],
    body: [
      'The Mehen board is a snake coiled around itself, with its head at the center and its tail at the rim. It shares its name with a serpent god who wrapped around the sun god Ra to protect him on his night journey.',
      'Up to six players moved small lion figures and marbles along the coils. The game faded after the Old Kingdom, and no text explains how it worked. Scholars have suggested the lions raced toward the snake\'s head, but every version played today is a guess.'
    ],
    facts: [['Board', 'Coiled serpent, segmented'], ['Pieces', 'Lions and marbles'], ['Players', 'Up to six'], ['Rules', 'Unknown']],
    build: buildMehen },
  { id: 'basur', side: -1, z: -20, title: 'The Başur Höyük Pieces', short: 'Başur Höyük Pieces', date: 'c. 3000 BCE', rail: 'Başur Höyük',
    eyebrow: 'Southeast Turkey · Early Bronze Age', status: ['lost', 'Game unknown'],
    body: [
      'In 2013, archaeologists excavating a Bronze Age burial mound at Başur Höyük found a set of small carved and painted stones: pyramids, round tokens and little animal figures. At around 5,000 years old, they are often called the oldest gaming pieces yet found.',
      'Nobody knows the game they belonged to. Their different shapes and colors may have marked opposing sides or kept score. They are a reminder that the oldest boards we know are only the ones that happened to survive.'
    ],
    facts: [['Found', '2013, in a burial mound'], ['Pieces', 'Pyramids, tokens, animals'], ['Board', 'None survives']],
    build: buildTokens },
  { id: 'ur', side: 1, z: -26, title: 'The Royal Game of Ur', short: 'Royal Game of Ur', date: 'c. 2600–2400 BCE', rail: 'Royal Game of Ur',
    eyebrow: 'Mesopotamia · Sumer', status: ['known', 'Rules survive in writing'], game: 'ur',
    body: [
      'Sir Leonard Woolley found five of these boards while excavating the Royal Cemetery at Ur between 1922 and 1934. The finest are inlaid with shell, red limestone and lapis lazuli. The game, also called Twenty Squares, spread across the ancient Near East, and more than a hundred boards have been found since.',
      'It is the oldest board game whose rules survive in writing. A Babylonian scribe, Itti-Marduk-balāṭu, copied them onto a clay tablet around 177 BCE, and British Museum curator Irving Finkel translated it in the early 1980s. The game outlived its empires: Jewish families in Kochi, India, played a descendant until the 1950s.',
      'We play Finkel\'s widely used reconstruction.'
    ],
    facts: [['Board', '20 squares, 5 rosettes'], ['Pieces', '7 each'], ['Moves', '4 four-sided dice, 0 to 4'], ['Goal', 'Race every piece home']],
    build: buildUrBoard },
  { id: 'hounds', side: -1, z: -32, title: 'Hounds and Jackals', date: 'c. 2000 BCE', rail: 'Hounds and Jackals',
    eyebrow: 'Egypt · Middle Kingdom', status: ['lost', 'Rules lost'],
    body: [
      'Howard Carter, later famous for Tutankhamun\'s tomb, found a complete set of this game in a Theban tomb in 1910. It is now at the Metropolitan Museum of Art in New York. Ten slender pins fit its holes: five topped with hound heads and five with jackals.',
      'The board has 58 holes in two tracks, which is why archaeologists also call it 58 Holes. Boards like it turn up from Egypt to Mesopotamia, Anatolia and the Levant. The larger hole near the top looks like the finish, but the rest of the rules are lost.'
    ],
    facts: [['Board', '58 holes, palm tree inlay'], ['Pieces', '5 hounds, 5 jackals'], ['Spread', 'Egypt to Anatolia'], ['Rules', 'Unknown']],
    build: buildHounds },
  { id: 'next', title: 'From These Tables to Yours', short: 'Librarium', date: 'Today', rail: 'Today',
    eyebrow: 'Librarium Games', status: null,
    body: [
      'Four thousand years after Senet and Ur, people still gather to throw sticks, roll dice and race each other home. Librarium Games carries the tradition on with tables of its own, from Calendra, a Celtic game of runes and seasons, to Phoenix Farm.',
      'The next wing will cover the classical world. Until it opens, the Librarium\'s own games are waiting in the Tavern.'
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
const GAMES = { ur: UR, senet: SENET };

/* --------------------------------------------------------- tweens */
const tweens = [];
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function tween(dur, fn, e = ease) {
  return new Promise(res => tweens.push({ t: 0, dur: reduceMotion ? dur * 0.35 : dur, fn, e, res }));
}

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
  const d = Math.min(2.6, Math.max(0.6, dur * (0.5 + dist / 18)));
  return tween(d, k => {
    if (camTween !== token) return;
    cam.pos.lerpVectors(p0, pos, k);
    cam.yaw = y0 + dy * k; cam.pitch = pi0 + (a.pitch - pi0) * k;
  }).then(() => { if (camTween === token) camTween = null; });
}
function stopView(stop) {
  if (stop.id === 'hall') return { pos: new THREE.Vector3(0, 1.62, 2.4), target: new THREE.Vector3(0, 1.75, -12) };
  if (stop.id === 'next') return { pos: new THREE.Vector3(0, 1.62, -34.2), target: new THREE.Vector3(0, 1.15, -37.2) };
  const g = stop.group;
  return { pos: g.localToWorld(new THREE.Vector3(0, 1.66, 2.15)), target: g.localToWorld(new THREE.Vector3(0, 1.08, 0)) };
}
function flyToPlay(stop, dur = 1.4) {
  const g = stop.group;
  const W = stop.game === 'senet' ? 1.62 : 1.78;
  const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hf = Math.atan(Math.tan(vf) * camera.aspect);
  const elev = THREE.MathUtils.degToRad(58);
  let dist = (W / 2) / Math.tan(hf) * 1.06;
  dist = Math.max(dist, 0.62 / Math.tan(vf) * 1.1);
  const center = new THREE.Vector3(0, TOP + 0.05, 0.02);
  const pos = center.clone().add(new THREE.Vector3(0, Math.sin(elev) * dist, Math.cos(elev) * dist));
  return flyTo(g.localToWorld(pos), g.localToWorld(center.clone().add(new THREE.Vector3(0, 0, -0.03))), dur);
}

/* ------------------------------------------------------- UI: placard + rail */
let mode = 'gallery', current = 0;
const rail = $('#rail');
STOPS.forEach((s, i) => {
  const b = document.createElement('button');
  b.innerHTML = '<span class="t"></span><span class="d"></span>';
  b.querySelector('.t').textContent = s.rail; b.querySelector('.d').textContent = s.date;
  b.addEventListener('click', () => goStop(i));
  rail.appendChild(b);
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
  } else if (s.id === 'hall') {
    const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = 'Begin with Senet';
    b.addEventListener('click', () => goStop(1)); act.appendChild(b);
  } else {
    const n = document.createElement('span'); n.className = 'soon'; n.textContent = 'On display only. The rules did not survive.'; act.appendChild(n);
  }
  act.hidden = false;
}
function showPlacard(on) { $('#placard').classList.toggle('away', !on); }
function setActive(i) {
  current = i;
  [...rail.children].forEach((b, k) => b.classList.toggle('on', k === i));
  rail.children[i].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}
function goStop(i, fly = true) {
  if (mode !== 'gallery') return;
  setActive(i);
  renderPlacard(STOPS[i]); showPlacard(true);
  if (fly) { const v = stopView(STOPS[i]); flyTo(v.pos, v.target); }
}
$('#closeP').addEventListener('click', () => showPlacard(false));
$('#helpBtn').addEventListener('click', () => { if (mode === 'gallery') goStop(0); else $('#rules').hidden = !$('#rules').hidden; });

/* ------------------------------------------------------------- play */
const play = { ex: null, game: null, meshes: null, token: 0, phase: 'idle', roll: null, moves: [], markers: [], hover: null };
const markerGeo = new THREE.TorusGeometry(0.05, 0.006, 8, 36);
const markerMat = new THREE.MeshBasicMaterial({ color: 0xf6a01a, transparent: true, opacity: 0.85, depthWrite: false });
function placeAll() {
  const g = play.game;
  [0, 1].forEach(pl => play.meshes[pl].forEach((m, i) => {
    const v = g.local(pl, g.pos[pl][i], i); v.y += g.pieceH; m.position.copy(v);
  }));
}
async function startGame(ex) {
  if (mode !== 'gallery') return;
  mode = 'play';
  const g = GAMES[ex.game];
  play.ex = ex; play.game = g; play.token++;
  g.surface = ex.surface;
  if (!ex.pieces) ex.pieces = g.makePieces(ex.group);
  play.meshes = ex.pieces;
  g.init(); placeAll();
  showPlacard(false); $('#hint').style.opacity = 0; rail.hidden = true;
  $('#hud').hidden = false; $('#win').hidden = true; $('#rules').hidden = true;
  $('#hudTitle').textContent = g.name;
  renderRules(g);
  renderDice(g, null);
  updateScore();
  await flyToPlay(ex);
  beginTurn(0, true);
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
  const i = STOPS.indexOf(play.ex);
  goStop(i);
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
  const g = play.game; const s = $('#score'); s.innerHTML = '';
  const add = (label, n) => { const b = document.createElement('b'); b.textContent = n + '/' + g.N; s.append(label + ' ', b); };
  add('You', g.home(0)); s.append('  ·  '); add('Scribe', g.home(1));
  s.append('  borne off');
}
function renderDice(g, r, shaking = false) {
  const d = $('#dice'); d.innerHTML = ''; d.classList.toggle('shake', shaking);
  const faces = r ? r.faces : [0, 0, 0, 0];
  faces.forEach(f => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 30 30');
    if (g.id === 'ur') {
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
async function showRoll(r) {
  const g = play.game, tok = play.token;
  for (let k = 0; k < (reduceMotion ? 1 : 5); k++) { renderDice(g, g.roll(), true); await wait(90); if (tok !== play.token) return false; }
  renderDice(g, r, false);
  return tok === play.token;
}
function beginTurn(pl, first) {
  if (mode !== 'play') return;
  updateScore();
  if (pl === 0) {
    play.phase = 'throw'; $('#throwBtn').disabled = false;
    setMsg('Your turn', first ? `You play the ${play.game.sides[0]}, nearest to you. Throw to begin.` : 'Throw when you are ready.');
    $('#throwBtn').focus({ preventScroll: true });
  } else {
    play.phase = 'ai'; $('#throwBtn').disabled = true;
    setMsg('The Scribe', 'The Scribe is throwing…');
    aiTurn();
  }
}
async function humanThrow() {
  if (play.phase !== 'throw') return;
  play.phase = 'rolling'; $('#throwBtn').disabled = true;
  const g = play.game, tok = play.token;
  const r = g.roll();
  if (!(await showRoll(r))) return;
  play.roll = r;
  const moves = g.legal(0, r.value);
  if (!moves.length) {
    setMsg('Your turn', `You threw ${r.value}. No piece can move, so the turn passes.`);
    await wait(1500); if (tok !== play.token) return;
    beginTurn(1); return;
  }
  play.moves = moves; play.phase = 'choose';
  highlight(moves);
  setMsg('Your turn', `You threw ${r.value}. Choose a glowing piece${moves.length === 1 ? ' (only one can move)' : ''}.`);
}
async function choose(m) {
  if (play.phase !== 'choose') return;
  play.phase = 'anim'; clearHighlights();
  const g = play.game, tok = play.token;
  const note = await execMove(m);
  if (tok !== play.token) return;
  updateScore();
  if (g.done(0)) return finish(0);
  if (g.extra(m, play.roll.value)) {
    setMsg('Your turn', (note ? note + ' ' : '') + g.extraNote);
    play.phase = 'throw'; $('#throwBtn').disabled = false; return;
  }
  if (note) { setMsg('Your turn', note); await wait(900); if (tok !== play.token) return; }
  beginTurn(1);
}
async function aiTurn() {
  const g = play.game, tok = play.token;
  await wait(700); if (tok !== play.token) return;
  const r = g.roll();
  if (!(await showRoll(r))) return;
  const moves = g.legal(1, r.value);
  if (!moves.length) {
    setMsg('The Scribe', `The Scribe threw ${r.value} and cannot move.`);
    await wait(1300); if (tok !== play.token) return;
    beginTurn(0); return;
  }
  setMsg('The Scribe', `The Scribe threw ${r.value}.`);
  const m = g.ai(moves);
  await wait(500); if (tok !== play.token) return;
  const note = await execMove(m);
  if (tok !== play.token) return;
  updateScore();
  if (g.done(1)) return finish(1);
  if (g.extra(m, r.value)) { setMsg('The Scribe', (note ? note + ' ' : '') + 'The Scribe throws again.'); await wait(900); if (tok !== play.token) return; aiTurn(); return; }
  if (note) { setMsg('The Scribe', note); await wait(1100); if (tok !== play.token) return; }
  beginTurn(0);
}
async function hop(mesh, to, dur = 0.17, h = 0.05) {
  const from = mesh.position.clone();
  await tween(dur, k => { mesh.position.lerpVectors(from, to, k); mesh.position.y += Math.sin(k * Math.PI) * h; }, k => k);
}
async function execMove(m) {
  const g = play.game, tok = play.token;
  const mesh = play.meshes[m.pl][m.i];
  for (const s of g.steps(m)) {
    if (tok !== play.token) return '';
    const p = s === 27 ? (() => { const c = seCell(27); return new THREE.Vector3(c.x, g.surface, c.z); })() : g.local(m.pl, s, m.i);
    p.y += g.pieceH;
    const off = (g.id === 'ur' && s === 15) || s === 31;
    await hop(mesh, p, off ? 0.32 : 0.17, off ? 0.12 : 0.05);
  }
  const res = g.apply(m);
  for (const o of res.moved) {
    if (tok !== play.token) return '';
    const v = g.local(o.pl, g.pos[o.pl][o.i], o.i); v.y += g.pieceH;
    await hop(play.meshes[o.pl][o.i], v, 0.45, 0.16);
  }
  return res.note;
}
function finish(pl) {
  play.phase = 'over';
  const g = play.game;
  $('#winTitle').textContent = pl === 0 ? 'You win' : 'The Scribe wins';
  $('#winText').textContent = pl === 0
    ? `All ${g.N} of your pieces are home. The Scribe bows and resets the board.`
    : `The Scribe brought all ${g.N} pieces home first. You bore off ${g.home(0)}.`;
  $('#win').hidden = false;
  $('#againBtn').focus({ preventScroll: true });
}
function highlight(moves) {
  clearHighlights();
  const g = play.game;
  play.pick = new Map();
  moves.forEach(m => {
    const meshes = [play.meshes[m.pl][m.i]];
    if (g.id === 'ur' && m.from === 0) g.pos[0].forEach((p, i) => { if (p === 0 && i !== m.i) meshes.push(play.meshes[0][i]); });
    const dest = m.water ? (() => { const c = seCell(27); return new THREE.Vector3(c.x, g.surface, c.z); })() : g.local(m.pl, m.to, m.i);
    const ring = new THREE.Mesh(markerGeo, markerMat.clone()); ring.rotation.x = -Math.PI / 2; ring.position.copy(dest); ring.position.y += 0.004;
    play.ex.group.add(ring); play.markers.push(ring); ring.userData.move = m;
    meshes.forEach(ms => play.pick.set(ms, { m, ring, mesh: play.meshes[m.pl][m.i] }));
    play.pick.set(ring, { m, ring, mesh: play.meshes[m.pl][m.i] });
  });
}
function clearHighlights() {
  play.markers.forEach(r => r.parent && r.parent.remove(r)); play.markers = [];
  if (play.meshes) play.meshes.flat().forEach(m => m.userData.mats.forEach(x => x.emissive && x.emissive.setRGB(0, 0, 0)));
  play.pick = null; play.hover = null;
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
  if (mode === 'play' && play.pick) {
    const hit = pickAt(e.clientX, e.clientY, [...play.pick.keys()]);
    play.hover = hit ? play.pick.get(hit.object) || play.pick.get(hit.object.parent) : null;
    canvas.style.cursor = play.hover ? 'pointer' : 'default';
  } else if (mode === 'gallery') {
    const hit = pickAt(e.clientX, e.clientY, galleryTargets());
    canvas.style.cursor = hit ? 'pointer' : 'grab';
  }
});
canvas.addEventListener('pointerup', e => {
  const d = down; down = null;
  if (!d || d.moved) return;
  if (mode === 'play') {
    if (!play.pick || play.phase !== 'choose') return;
    const hit = pickAt(e.clientX, e.clientY, [...play.pick.keys()]);
    const p = hit && (play.pick.get(hit.object) || play.pick.get(hit.object.parent));
    if (p) choose(p.m);
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
    if (e.code === 'Escape') leaveGame();
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
  STOPS.forEach((s, i) => { const v = stopView(s); const d = Math.hypot(v.target.x - cam.pos.x, v.target.z - cam.pos.z); if (s.id !== 'hall' && d < bd) { bd = d; best = i; } });
  if (best >= 0 && best !== current) { setActive(best); renderPlacard(STOPS[best]); showPlacard(true); }
}

/* -------------------------------------------------------------- loop */
const clock = new THREE.Clock();
let t = 0;
function frame() {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  const dt = Math.min(0.05, clock.getDelta()); t += dt;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.e(k)); if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
  if (mode === 'gallery' && keys.size) {
    const sp = 2.8 * dt, f = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), r = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    if (keys.has('f')) cam.pos.addScaledVector(f, sp); if (keys.has('b')) cam.pos.addScaledVector(f, -sp);
    if (keys.has('r')) cam.pos.addScaledVector(r, sp); if (keys.has('l')) cam.pos.addScaledVector(r, -sp);
    cam.pos.x = Math.max(-1.3, Math.min(1.3, cam.pos.x)); cam.pos.z = Math.max(HALL.zFar + 3.2, Math.min(HALL.zNear - 0.8, cam.pos.z));
    cam.pos.y += (1.62 - cam.pos.y) * Math.min(1, dt * 4);
    if (cam.pos.z < -10 || cam.pos.x) $('#hint').style.opacity = 0;
  }
  camera.position.copy(cam.pos); camera.rotation.set(cam.pitch, cam.yaw, 0);
  if (!reduceMotion) {
    candles.forEach(c => {
      const f = 0.82 + 0.1 * Math.sin(t * 11 + c.seed) + 0.08 * Math.sin(t * 23.7 + c.seed * 2);
      c.light.intensity = 1.25 * f; c.flame.scale.set(0.15 * f, 0.26 * (0.9 + 0.2 * f), 1); c.halo.material.opacity = 0.3 * f;
    });
    if (dust) {
      const a = dust.geometry.attributes.position, b = dust.userData.base;
      for (let i = 0; i < a.count; i++) {
        a.array[i * 3] = b[i * 3] + Math.sin(t * 0.15 + i) * 0.25;
        a.array[i * 3 + 1] = b[i * 3 + 1] + Math.sin(t * 0.1 + i * 1.7) * 0.3;
      }
      a.needsUpdate = true;
    }
  }
  if (mode === 'play' && play.pick) {
    const pulse = 0.35 + 0.25 * Math.sin(t * 5);
    const seen = new Set();
    play.pick.forEach((v, key) => {
      if (seen.has(v.mesh)) return; seen.add(v.mesh);
      const hot = play.hover && play.hover.m === v.m;
      v.mesh.userData.mats.forEach(x => x.emissive && x.emissive.setRGB(0.55 * (hot ? 1.4 : pulse), 0.32 * (hot ? 1.4 : pulse), 0.02));
      v.ring.material.opacity = hot ? 1 : 0.45 + 0.35 * Math.sin(t * 5);
      v.ring.scale.setScalar(hot ? 1.25 : 1);
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
  buildLectern();
  STOPS[STOPS.length - 1].group = lectern;
  const sconces = [[-4.7, -5], [4.7, -11], [-4.7, -17], [4.7, -23], [-4.7, -29], [4.7, -35]];
  (coarse ? sconces.filter((_, i) => i % 2 === 0) : sconces).forEach(([x, z]) => addCandle(x, z));
  buildDust();
  resize();
  window.addEventListener('resize', resize);
  const v = stopView(STOPS[0]); const a = lookAngles(v.pos, v.target);
  cam.pos.copy(v.pos).add(new THREE.Vector3(0, 0, 1.2)); cam.yaw = a.yaw; cam.pitch = a.pitch;
  if (coarse) { $('#hint').textContent = 'Drag to look · Tap an exhibit or the timeline'; STOPS[0].facts = [['Look', 'Drag the view'], ['Visit', 'Tap an exhibit or the timeline below']]; }
  frame();
  setTimeout(() => { $('#loader').classList.add('done'); goStop(0, false); flyTo(v.pos, v.target, 2.2); }, 250);
  setTimeout(() => { $('#hint').style.opacity = 0; }, 12000);
}
boot();
})();
