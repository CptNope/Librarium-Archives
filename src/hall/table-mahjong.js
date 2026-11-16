{ const setup = PACHISI_P.setup; PACHISI_P.setup = function (ex) {
  ex.group.userData.display.forEach(m => { m.visible = false; });
  if (ex.pieces && ex.pieces[0].length !== PACHISI.N) { ex.pieces.flat().forEach(m => ex.group.remove(m)); ex.pieces = null; } // the other game size
  (ex.pieces || []).flat().forEach(m => { m.visible = true; });
  setup.call(this, ex);
}; }
// Mahjong: seat 0 sits at the front, 1 to the right, 2 at the back, 3 to the left.
const MJ_TW = 0.034, MJ_TH = 0.046, MJ_TD = 0.024;
const mjBone = new THREE.MeshStandardMaterial({ color: 0xf2ecdc, roughness: 0.3 }), mjBack = new THREE.MeshStandardMaterial({ color: 0x2a7a5a, roughness: 0.35 });
const mjGeo = new THREE.BoxGeometry(MJ_TW, MJ_TH, MJ_TD);
const MJ_SEAT = [ // the edge each seat sits at, the way it faces, its right hand, and which way its tiles turn
  { e: { x: 0, z: 0.335 }, f: { x: 0, z: -1 }, r: { x: 1, z: 0 }, rot: 0 },
  { e: { x: 0.53, z: 0 }, f: { x: -1, z: 0 }, r: { x: 0, z: -1 }, rot: Math.PI / 2 },
  { e: { x: 0, z: -0.335 }, f: { x: 0, z: 1 }, r: { x: -1, z: 0 }, rot: Math.PI },
  { e: { x: -0.53, z: 0 }, f: { x: 1, z: 0 }, r: { x: 0, z: 1 }, rot: -Math.PI / 2 },
];
const MAHJONG_P = {
  camW: 1.3,
  intro() { return 'You sit at East, the front of the table, with three Scribes. ' + this.prompt(); },
  prompt: () => (GAMES.mahjong.need.type === 'claim' ? 'A tile you can claim was discarded. Choose a button, or Pass.' : 'Click a tile in your hand to discard it.'),
  setup(ex) {
    const G = GAMES.mahjong, d = ex.group.userData;
    d.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) {
      ex.pieces = Array.from({ length: 136 }, (_, id) => {
        const face = new THREE.MeshStandardMaterial({ map: mjTile(id >> 2), roughness: 0.3 });
        const m = new THREE.Mesh(mjGeo, [mjBone, mjBone, mjBone, mjBone, face, mjBack]); m.rotation.order = 'YXZ'; m.userData.mats = [face]; m.visible = false; ex.group.add(m); return m;
      });
      // Seat names on the felt.
      ['East · you', 'South', 'West', 'North'].forEach((name, s) => {
        const S = MJ_SEAT[s], plate = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.035), new THREE.MeshBasicMaterial({ transparent: true, map: tex(256, 64, (g, w, h) => { g.fillStyle = 'rgba(236,223,195,.8)'; g.font = '600 26px "Montserrat",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name.toUpperCase(), w / 2, h / 2); }) }));
        plate.rotation.order = 'YXZ'; plate.rotation.set(-Math.PI / 2, S.rot, 0);
        plate.position.set(S.e.x + S.f.x * (s % 2 ? 0.0 : 0.0) - S.r.x * 0.33, TOP + 0.021, S.e.z - S.r.z * 0.33 + (s === 0 ? 0.03 : 0));
        ex.group.add(plate); (d.plates = d.plates || []).push(plate);
      });
    }
    (d.plates || []).forEach(p => { p.visible = true; });
    this.ex = ex; this.layout(true);
  },
  leave(ex) { const d = ex.group.userData; d.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => { m.visible = false; }); (d.plates || []).forEach(p => { p.visible = false; }); },
  // Where every tile belongs now: hands standing, melds and discards lying face up, the wall hidden.
  targets() {
    const G = GAMES.mahjong, out = new Map(), y = G.surface;
    for (let s = 0; s < 4; s++) {
      const S = MJ_SEAT[s], hand = G.hands[s], n = hand.length;
      hand.forEach((id, k) => {
        const o = (k - (n - 1) / 2) * (MJ_TW + 0.002) + (s === 0 && k === n - 1 && G.need.type === 'discard' && G.need.seat === 0 && n % 3 === 2 ? 0.012 : 0);
        out.set(id, { x: S.e.x + S.r.x * o, y: y + MJ_TH / 2, z: S.e.z + S.r.z * o, ry: S.rot, rx: s === 0 ? -0.18 : 0 });
      });
      let j = 0;
      for (const m of G.melds[s]) for (const id of m.tiles) {
        const o = 0.27 - j * (MJ_TW + 0.001) - Math.floor(j / 4) * 0.0; j++;
        out.set(id, { x: S.e.x + S.f.x * 0.068 + S.r.x * o, y: y + MJ_TD / 2, z: S.e.z + S.f.z * 0.068 + S.r.z * o, ry: S.rot, rx: -Math.PI / 2 });
      }
      G.discards[s].forEach((id, k) => {
        const col = k % 6, row = (k / 6) | 0, o = (col - 2.5) * (MJ_TW + 0.002), a = 0.125 + row * (MJ_TH + 0.003);
        out.set(id, { x: S.e.x + S.f.x * a + S.r.x * o, y: y + MJ_TD / 2, z: S.e.z + S.f.z * a + S.r.z * o, ry: S.rot, rx: -Math.PI / 2 });
      });
    }
    return out;
  },
  async layout(instant) {
    const want = this.targets(), moves = [];
    this.ex.pieces.forEach((m, id) => {
      const t = want.get(id);
      if (!t) { m.visible = false; return; }
      if (instant || !m.visible) { m.visible = true; m.position.set(t.x, t.y, t.z); m.rotation.set(t.rx, t.ry, 0); return; }
      const dx = t.x - m.position.x, dz = t.z - m.position.z, dy = t.y - m.position.y, drx = t.rx - m.rotation.x;
      if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) + Math.abs(drx) < 1e-4) return;
      moves.push({ m, from: { x: m.position.x, y: m.position.y, z: m.position.z, rx: m.rotation.x, ry: m.rotation.y }, t });
    });
    if (!moves.length) return;
    await tween(0.22, k => { for (const { m, from, t } of moves) { m.position.set(from.x + (t.x - from.x) * k, from.y + (t.y - from.y) * k + Math.sin(k * Math.PI) * 0.03, from.z + (t.z - from.z) * k); m.rotation.set(from.rx + (t.rx - from.rx) * k, from.ry + (t.ry - from.ry) * k, 0); } });
  },
  meshesFor(m) { return m.kind === 'discard' ? [this.ex.pieces[m.tile]] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.mahjong, res = G.apply(m);
    if (m.kind === 'discard' || m.kind === 'draw') sfx.card();
    await this.layout(false);
    if (m.pl === 1 && m.kind === 'discard') await wait(120);
    return res;
  },
  score: () => { const G = GAMES.mahjong, sh = G.shanten(G.hands[0], G.open(0)); return [['Wall', String(G.wall.length)], ['Your hand', sh < 0 ? 'complete' : sh === 0 ? 'ready' : `${sh} from ready`], '']; },
};
