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
function activateTarget(t) {
  if (play.rings.includes(t)) return choose(t.userData.move);
  const list = play.byMesh.get(t);
  if (!list) return;
  if (!play.twoStep) return choose(list[0]);
  select(t); play.kb = -1;
}
/* Keyboard play: the arrow keys step through what can be chosen (pieces first,
 * then, once a piece is picked, the rings it can go to) in reading order on
 * screen; Enter or Space plays it, and a screen reader hears where focus is. */
const srBox = (() => {
  const d = document.createElement('div'); d.setAttribute('aria-live', 'polite'); d.className = 'lm-sr';
  d.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
  root.appendChild(d); return d;
})();
function kbTargets() {
  const list = play.selected ? play.rings.slice() : playTargets();
  const v = new THREE.Vector3();
  const at = o => { o.getWorldPosition(v); v.project(camera); return [Math.round(-v.y * 12), v.x]; };
  return list.map(o => [o, at(o)]).sort((a, b) => a[1][0] - b[1][0] || a[1][1] - b[1][1]).map(x => x[0]);
}
function kbPlay(code) {
  const list = kbTargets(); if (!list.length) return false;
  if (code === 'Enter' || code === 'Space') {
    if (!play.hover || !list.includes(play.hover)) return false;
    activateTarget(play.hover); return true;
  }
  const step = code === 'ArrowRight' || code === 'ArrowDown' ? 1 : -1;
  play.kb = ((play.kb ?? -1) + step + list.length) % list.length;
  if (play.kb < 0) play.kb = list.length - 1;
  play.hover = list[play.kb];
  const isRing = play.rings.includes(play.hover), card = play.hover.userData.c;
  const what = card !== undefined && play.game.cardName ? play.game.cardName(card) : isRing ? 'Move' : 'Piece';
  srBox.textContent = `${what} ${play.kb + 1} of ${list.length}. Enter to ${isRing || !play.twoStep ? 'play it' : 'pick it'}.`;
  return true;
}
function galleryTargets() { return STOPS.filter(s => s.group).map(s => s.group.userData.hit); }
function stopFromHit(o) { return STOPS.findIndex(s => s.group && s.group.userData.hit === o); }
