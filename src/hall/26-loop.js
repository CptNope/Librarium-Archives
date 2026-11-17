/* -------------------------------------------------------------- loop */
const clock = new THREE.Clock();
let t = 0;
let lastStep = 0;
// Beyond 46 m the fog has swallowed 97% of an exhibit, so it is not drawn at all; the hall is a corridor, so
// distance along it is enough. The camera's far plane is 60 m, where the fog is total.
const CULL = 46; let cullClock = 0;
function cullFar(dt) {
  cullClock -= dt; if (cullClock > 0) return; cullClock = 0.2;
  const z = camera.position.z;
  for (const s of STOPS) {
    const g = s.group; if (!g) continue;
    const near = (mode === 'play' && play.ex === s) || Math.abs(g.position.z - z) < CULL;
    if (g.visible !== near) g.visible = near;
  }
}
const fwd = new THREE.Vector3(), side = new THREE.Vector3(); // reused every frame, not allocated
/* Adaptive resolution. Shading cost grows with the square of the pixel ratio, so when frames run slow (under
 * about 45 a second, over two seconds) the ratio steps down, as far as 0.75; when they run fast again for six
 * seconds it steps back up, but never above a ratio that was too slow before. ?fixedres turns it off. */
const RES = { max: renderer.getPixelRatio(), min: 0.75, now: renderer.getPixelRatio(), ceil: renderer.getPixelRatio(), ema: 16.7, last: 0, judged: 0, fastFor: 0, off: /[?&]fixedres\b/.test(location.search) };
function adaptRes(now) {
  if (RES.off) return;
  const gap = RES.last ? now - RES.last : 16.7; RES.last = now;
  if (gap > 250) return; // a stall, a hidden tab or a breakpoint, not the steady rate
  RES.ema += (gap - RES.ema) * 0.05;
  if (now - RES.judged < 2000) return;
  RES.judged = now;
  if (RES.ema > 22 && RES.now > RES.min) { RES.ceil = RES.now; RES.now = Math.max(RES.min, +(RES.now - 0.15).toFixed(2)); RES.fastFor = 0; }
  else if (RES.ema < 14 && RES.now < Math.min(RES.max, RES.ceil)) { RES.fastFor += 2000; if (RES.fastFor >= 6000) { RES.now = Math.min(RES.max, RES.ceil, +(RES.now + 0.1).toFixed(2)); RES.fastFor = 0; } else return; }
  else { RES.fastFor = 0; return; }
  renderer.setPixelRatio(RES.now); // keeps the canvas's size; only the drawing buffer changes
}
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { RES.last = 0; return; }
  adaptRes(now || performance.now());
  step();
}
function step() {
  lastStep = performance.now();
  const raw = clock.getDelta(), dt = Math.min(0.05, raw); t += dt;
  // Animations keep to the clock (up to a quarter second a frame), so a slow machine plays a move in about the
  // same time as a fast one rather than stretching it over many slow frames. The walking still steps at most 0.05.
  const tdt = Math.min(0.25, raw);
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += tdt; const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.e(k)); if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
  let jf = 0, jt = 0;
  if (joy.id !== null) {
    const m = Math.hypot(joy.x, joy.y), dead = 0.14;
    if (m > dead) { const k = (m - dead) / (1 - dead) / m; jf = -joy.y * k; jt = joy.x * k; }
  }
  if (mode === 'gallery' && (keys.size || jf || jt)) {
    const sp = 3.2 * dt, f = fwd.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), r = side.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
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
  if (!reduceMotion && dust) dust.userData.time.value = t;
  if (mode === 'play' && (play.glowing.size || play.rings.length)) {
    const pulse = 0.42 + 0.18 * Math.sin(t * 5), all = marksOn();
    const hoverMove = play.hover && play.hover.userData.move;
    play.glowing.forEach(ms => {
      const hot = ms === play.selected || ms === play.hover || (play.hintMove && play.byMesh.get(ms) && play.byMesh.get(ms).includes(play.hintMove)) || (hoverMove && play.byMesh.get(ms) && play.byMesh.get(ms).includes(hoverMove));
      const k = hot ? 0.5 : all ? pulse : 0;
      glowMats(ms).forEach(x => x.emissive.setRGB(0.55 * k, 0.32 * k, 0.02));
      const h = play.halos.get(ms);
      if (h) { h.material.opacity = hot ? 1 : 0.7 + 0.25 * Math.sin(t * 5); h.scale.setScalar(h.userData.base * (hot ? 1.18 : 1)); }
    });
    play.rings.forEach(r => {
      const hot = play.hover === r || r.userData.move === play.hintMove || (play.hover && play.byMesh.get(play.hover) && play.byMesh.get(play.hover).includes(r.userData.move));
      r.material.opacity = hot ? 1 : (r.userData.op || 0.85) + 0.12 * Math.sin(t * 5);
      const show = hot || all; // with hints off the ring is still there to click, just not drawn
      if (r.material.visible !== show) { r.material.visible = show; r.children.forEach(c => { if (c.material !== MAT.hit) c.visible = show; }); }
      r.scale.setScalar(r.userData.base * (hot ? 1.25 : 1));
    });
  }
  cullFar(raw);
  renderer.render(scene, camera);
}

