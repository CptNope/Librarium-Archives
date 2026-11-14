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
  const P = PRES[stop.game], W = P.camW;
  const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hf = Math.atan(Math.tan(vf) * camera.aspect);
  const elev = THREE.MathUtils.degToRad(P.camElev || 58); // a long board is seen from higher up
  let dist = (W / 2) / Math.tan(hf) * 1.06;
  dist = Math.max(dist, (P.camD || 0.62) / Math.tan(vf) * 1.1);
  const center = V3(0, TOP + 0.05, 0.02);
  const pos = center.clone().add(V3(0, Math.sin(elev) * dist, Math.cos(elev) * dist));
  play.camDist = dist;
  return flyTo(g.localToWorld(pos), g.localToWorld(center.clone().add(V3(0, 0, -0.03))), dur);
}

