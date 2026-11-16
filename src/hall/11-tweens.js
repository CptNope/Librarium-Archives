/* --------------------------------------------------------- tweens */
const tweens = [];
const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function tween(dur, fn, e = ease) {
  return new Promise(res => tweens.push({ t: 0, dur: reduceMotion ? dur * 0.35 : dur, fn, e, res }));
}
// Finish every running animation at once, so a table rebuilt from its state is not pulled about afterwards.
function settleTweens() { for (const tw of tweens.splice(0)) { try { tw.fn(tw.e(1)); } catch (e) { /* a mesh already gone */ } tw.res(); } }
async function hop(mesh, to, dur = 0.17, h = 0.05) {
  const from = mesh.position.clone();
  await tween(dur, k => { mesh.position.lerpVectors(from, to, k); mesh.position.y += Math.sin(k * Math.PI) * h; }, k => k);
}

