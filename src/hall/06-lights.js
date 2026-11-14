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
// The table lamp: when you sit at a game, a warm light comes up over that board and the
// hall's own lights ease back, so pieces and move marks read clearly. It is always in the
// scene (at nought when you are walking), so sitting down never recompiles a shader.
const lamp = { light: null, k: 0, at: null };
function buildLightPools() {
  lamp.light = new THREE.SpotLight(0xfff0d8, 0, 4.2, 0.62, 0.55, 1.1);
  scene.add(lamp.light); scene.add(lamp.light.target);
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
function aimLamp(group) {
  if (!lamp.light) return;
  lamp.light.position.copy(group.localToWorld(V3(0, TOP + 1.55, 0.35)));
  lamp.light.target.position.copy(group.localToWorld(V3(0, TOP, 0)));
  lamp.light.target.updateMatrixWorld();
}
function updateLights(dt, time) {
  const seated = mode === 'play' && play.ex;
  if (seated && lamp.at !== play.ex) { lamp.at = play.ex; lamp.k = 0; aimLamp(play.ex.group); }
  lamp.k = reduceMotion ? +!!seated : Math.max(0, Math.min(1, lamp.k + (seated ? dt : -dt) * 1.6));
  if (lamp.light) lamp.light.intensity = 2.4 * lamp.k;
  const hallDim = 1 - 0.3 * lamp.k;
  poolClock -= dt;
  if (poolClock <= 0) { poolClock = 0.25; assignPool(POOL.point, candles, cam.pos); assignPool(POOL.spot, spotSources, cam.pos); }
  for (const slot of POOL.point) {
    if (!slot.src) { slot.light.intensity = 0; continue; }
    const c = slot.src;
    const f = reduceMotion ? 0.9 : 0.82 + 0.1 * Math.sin(time * 11 + c.seed) + 0.08 * Math.sin(time * 23.7 + c.seed * 2);
    slot.light.intensity = 1.25 * f * fade(c.pos.distanceTo(cam.pos)) * hallDim;
  }
  for (const slot of POOL.spot) slot.light.intensity = slot.src ? 2.6 * fade(slot.src.pos.distanceTo(cam.pos)) * hallDim : 0;
  if (!reduceMotion) for (const c of candles) {
    const f = 0.82 + 0.1 * Math.sin(time * 11 + c.seed) + 0.08 * Math.sin(time * 23.7 + c.seed * 2);
    c.flame.scale.set(0.15 * f, 0.26 * (0.9 + 0.2 * f), 1); c.halo.material.opacity = 0.3 * f;
  }
}

