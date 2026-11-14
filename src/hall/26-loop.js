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
      const hot = ms === play.selected || ms === play.hover || (play.hintMove && play.byMesh.get(ms) && play.byMesh.get(ms).includes(play.hintMove)) || (hoverMove && play.byMesh.get(ms) && play.byMesh.get(ms).includes(hoverMove));
      const k = hot ? 0.5 : pulse;
      glowMats(ms).forEach(x => x.emissive.setRGB(0.55 * k, 0.32 * k, 0.02));
    });
    play.rings.forEach(r => {
      const hot = play.hover === r || r.userData.move === play.hintMove || (play.hover && play.byMesh.get(play.hover) && play.byMesh.get(play.hover).includes(r.userData.move));
      r.material.opacity = hot ? 1 : 0.6 + 0.25 * Math.sin(t * 5);
      r.scale.setScalar(r.userData.base * (hot ? 1.25 : 1));
    });
  }
  renderer.render(scene, camera);
}

