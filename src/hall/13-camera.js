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
  // With reduced motion asked for, the view cuts to its new place in a blink instead of gliding down the hall.
  const d = reduceMotion ? 0.12 : Math.min(3.2, Math.max(0.6, dur * (0.5 + dist / 18)));
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
  if (stop.id === 'lobby') { const g = stop.group; return { pos: g.localToWorld(V3(0.15, 1.66, 2.35)), target: g.localToWorld(V3(0, 1.25, -0.35)) }; }
  if (stop.id === 'next') return { pos: V3(0, 1.62, lectern.position.z + 3), target: V3(0, 1.15, lectern.position.z) };
  const g = stop.group;
  return { pos: g.localToWorld(V3(0, 1.66, 2.15)), target: g.localToWorld(V3(0, 1.08, 0)) };
}
const CARD_TABLE_FRAME = [0.88, 0.82], CARD_TABLE_TOWARD = 0.07; // how much of the table's width and depth a card table's view takes in, and how far toward the player it is aimed
function flyToPlay(stop, dur = 1.4) {
  const g = stop.group;
  const P = PRES[stop.game];
  // At a card table the cards take far less room than the baize, so the view comes in closer: the cards are
  // readable without zooming, and the cloth's empty margins fall outside.
  if (g.userData.cardTable === undefined) { let c = false; g.traverse(o => { if (o.geometry === crGeo) c = true; }); g.userData.cardTable = c; }
  const near = g.userData.cardTable ? CARD_TABLE_FRAME : [1, 1], W = P.camW * near[0];
  const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hf = Math.atan(Math.tan(vf) * camera.aspect);
  const elev = THREE.MathUtils.degToRad(P.camElev || 58); // a long board is seen from higher up
  let dist = (W / 2) / Math.tan(hf) * 1.06;
  dist = Math.max(dist, (P.camD || 0.62) * near[1] / Math.tan(vf) * 1.1);
  const far = play.online && play.online.seat === 1 && play.ex === stop ? -1 : 1; // online, the second player sits across the table
  // A card table's view is aimed a little toward the player's own side, so their hand clears the message at
  // the foot of the screen (there is room to spare above the far hand).
  const center = V3(0, TOP + 0.05, 0.02 + (g.userData.cardTable ? CARD_TABLE_TOWARD * far : 0));
  const pos = center.clone().add(V3(0, Math.sin(elev) * dist, far * Math.cos(elev) * dist));
  play.camDist = dist;
  return flyTo(g.localToWorld(pos), g.localToWorld(center.clone().add(V3(0, 0, -0.03 * far))), dur);
}

