const KALAH_P = {
  camW: 1.2, ringScale: 1.2,
  intro() { return 'Your six pits are the row nearest you, and your store is on your right. ' + this.prompt(); },
  prompt: () => 'Choose one of your glowing pits to sow.',
  setup(ex) {
    const G = GAMES.kalah;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    this.ex = ex; this.pitMeshes = ex.group.userData.pits;
    const need = G.seeds * 12;
    if (!ex.seeds) ex.seeds = [];
    const cols = [0x6a8aa8, 0x8aa86a, 0xa86a6a, 0xa8986a, 0x9a7aa8];
    while (ex.seeds.length < need) { const sd = new THREE.Mesh(seedGeo, new THREE.MeshStandardMaterial({ color: cols[ex.seeds.length % 5], roughness: 0.25 })); ex.group.add(sd); ex.seeds.push(sd); }
    ex.seeds.forEach((sd, k) => { sd.visible = k < need; });
    this.at = Array.from({ length: 14 }, () => []);
    let k = 0;
    for (let i = 0; i < 14; i++) for (let n = 0; n < G.p[i]; n++) { const sd = ex.seeds[k++]; this.at[i].push(sd); sd.position.copy(this.slot(i, n)); }
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.seeds || []).forEach(sd => { sd.visible = false; }); },
  slot(i, k) {
    const store = i === 6 || i === 13, b = store ? klStore(i === 6 ? 0 : 1) : klPit(i), per = store ? 18 : 10;
    const layer = Math.floor(k / per), j = k % per, a = j * 2.39996 + layer * 1.3, rr = Math.min(store ? 0.05 : 0.036, 0.0105 * Math.sqrt(j + 0.6));
    return V3(b.x + Math.cos(a) * rr * (store ? 0.8 : 1), GAMES.kalah.surface + 0.008 + layer * 0.012, b.z + Math.sin(a) * rr * (store ? 2.2 : 1));
  },
  meshesFor(m) { return [this.pitMeshes[m.pit]]; },
  ringFor(m) { const p = klPit(m.pit); return V3(p.x, GAMES.kalah.surface, p.z); },
  async play(m) {
    const G = GAMES.kalah, tok = play.token, res = G.apply(m);
    let hand = [];
    for (const [i, n] of res.trace) {
      if (tok !== play.token) return res;
      if (n === 0) { hand = hand.concat(this.at[i].splice(0)); continue; }
      // Seeds arrive one at a time while sowing, or all at once when a capture or the end sweeps them in.
      while (this.at[i].length < n && hand.length) { const sd = hand.shift(); const v = this.slot(i, this.at[i].length); this.at[i].push(sd); await hop(sd, v, hand.length > 12 ? 0.07 : 0.12, 0.04); }
    }
    return res;
  },
  score: () => { const G = GAMES.kalah; return [['You', G.p[6]], ['Scribe', G.p[13]], 'in store']; },
};
