const BAO_P = {
  camW: 1.0, ringScale: 0.75,
  intro() { return 'Your sixteen pits are the two rows nearest you, and you move first. ' + this.prompt(); },
  prompt: () => {
    const ms = GAMES.bao.legal(0);
    return ms.length && ms[0].mtaji ? 'You can capture, so you must: pick a pit, then the ring on the side to sow toward.' : 'No capture is open. Pick a pit (from your inner row if you can), then the ring on the side to sow toward.';
  },
  setup(ex) {
    const G = GAMES.bao;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    this.ex = ex; this.pitMeshes = ex.group.userData.pits;
    if (!ex.seeds) {
      const cols = [0x8a8070, 0x6f6658, 0x9d9482, 0x7c705e];
      ex.seeds = Array.from({ length: 64 }, (_, i) => {
        const m = new THREE.Mesh(seedGeo, new THREE.MeshStandardMaterial({ color: cols[i % 4], roughness: 0.4 }));
        m.scale.set(0.85, 0.75, 1); m.rotation.y = rand(0, TAU); ex.group.add(m); return m;
      });
    }
    ex.seeds.forEach(m => { m.visible = true; });
    this.pit = Array.from({ length: 32 }, () => []);
    let k = 0;
    for (let i = 0; i < 32; i++) for (let n = 0; n < G.p[i]; n++) { const m = ex.seeds[k++]; this.pit[i].push(m); m.position.copy(this.slot(i, n)); }
  },
  leave(ex) {
    ex.group.userData.display.forEach(m => { m.visible = true; });
    (ex.seeds || []).forEach(m => { m.visible = false; });
  },
  slot(i, k) {
    const b = baoPos(i), per = 9, layer = Math.floor(k / per), j = k % per;
    const a = j * 2.39996 + layer * 1.3, rr = Math.min(0.024, 0.0085 * Math.sqrt(j + 0.6));
    return V3(b.x + Math.cos(a) * rr, GAMES.bao.surface + 0.007 + layer * 0.011, b.z + Math.sin(a) * rr);
  },
  meshesFor(m) { return [this.pitMeshes[m.pit]]; },
  ringFor(m) { const p = baoPos(GAMES.bao.next(m.pit, m.dir)); return V3(p.x, GAMES.bao.surface, p.z); },
  async play(m) {
    const G = GAMES.bao, tok = play.token, res = G.apply(m);
    const dur = res.trace.length > 70 ? 0.055 : 0.1;
    let hand = [];
    for (const [i, n] of res.trace) {
      if (tok !== play.token) return res;
      if (n === 0) { // everything in this pit is lifted into the hand
        const b = baoPos(i), up = this.pit[i].splice(0);
        await Promise.all(up.map((s, k) => hop(s, V3(b.x + (k % 5 - 2) * 0.006, G.surface + 0.05 + Math.floor(k / 5) * 0.012, b.z), 0.14, 0.02)));
        hand = hand.concat(up);
      } else {
        const s = hand.shift(); if (!s) continue;
        const v = this.slot(i, this.pit[i].length); this.pit[i].push(s);
        // the rest of the hand travels along above the pit being sown
        hand.forEach((h, k) => { h.position.x = v.x + (k % 5 - 2) * 0.006; h.position.z = v.z; });
        await hop(s, v, dur, 0.03);
      }
    }
    return res;
  },
  score: () => { const G = GAMES.bao; return [['You', G.count(0)], ['Scribe', G.count(1)], 'seeds']; },
};
