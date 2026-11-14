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
    play, GAMES, PRES, STOPS, cam, view, joy, camera, choose, humanThrow, startGame, leaveGame, goStop, scribe,
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

