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
    return activateTarget(t);
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
  stopTour(); // walking off on your own ends the tour
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
    joyEl.classList.add('active'); camTween = null; stopTour(); joyMove(e);
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
  if (mode === 'gallery' && e.code === 'Escape' && tour.on) { stopTour(); e.preventDefault(); return; }
  if (mode === 'gallery' && (e.code === 'BracketLeft' || e.code === 'BracketRight')) { stepStop(e.code === 'BracketLeft' ? -1 : 1); e.preventDefault(); return; }
  if (mode === 'play') {
    if (e.code === 'Space' && play.phase === 'throw' && document.activeElement !== $('#lm-throwBtn')) { e.preventDefault(); humanThrow(); }
    const onButton = document.activeElement && /^(BUTTON|A)$/.test(document.activeElement.tagName);
    if (play.phase === 'choose' && /^Arrow/.test(e.code) && kbPlay(e.code)) { e.preventDefault(); return; }
    if (play.phase === 'choose' && !onButton && (e.code === 'Enter' || e.code === 'Space') && kbPlay(e.code)) { e.preventDefault(); return; }
    if (e.code === 'Escape') { if (play.selected) { select(play.selected); play.kb = -1; play.hover = null; } else leaveGame(); }
    return;
  }
  if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); camTween = null; stopTour(); e.preventDefault(); }
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

