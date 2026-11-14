
const LATRUNCULI_P = {
  camW: 1.0,
  intro() { return 'This table plays a modern reconstruction. You have the blue glass; place your counters one at a time.'; },
  prompt() { const G = GAMES.latrunculi; return G.placing() ? `Place a counter (${20 - G.placed[0]} left).` : 'Pick a counter, then a ring. Trap a counter between two of yours to take it.'; },
  setup(ex) {
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 20 }, () => { const c = ltCounter(pl); ex.group.add(c); return c; }));
    this.cell = Array(64).fill(null); this.used = [0, 0]; this.lost = [0, 0];
    ex.pieces.forEach((list, pl) => list.forEach((c, k) => { c.visible = true; c.position.copy(this.handSpot(pl, k)); }));
    // Rebuilt from the engine: counters on the board, those taken, the rest still to place.
    const G = GAMES.latrunculi;
    for (const pl of [0, 1]) {
      const placed = ex.pieces[pl].slice(0, G.placed[pl]); this.used[pl] = G.placed[pl];
      for (let i = 0; i < 64; i++) if (G.b[i] === pl + 1) { const c = placed.shift(); this.cell[i] = c; c.position.copy(this.pos(i)); }
      placed.forEach(c => c.position.copy(this.lostSpot(pl, this.lost[pl]++)));
    }
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).flat().forEach(c => { c.visible = false; }); },
  pos(i) { const c = ltCell(i); return V3(c.x, GAMES.latrunculi.surface, c.z); },
  // Counters wait in a column beside the slab, the visitor's on the left; taken counters go to the taker's side.
  handSpot(pl, k) { return V3((pl ? 1 : -1) * (0.5 + (k % 2) * 0.065), TOP + 0.013, -0.3 + ((k / 2) | 0) * 0.065); },
  lostSpot(owner, k) { return V3((owner ? -1 : 1) * (0.63 + ((k / 10) | 0) * 0.065), TOP + 0.013, -0.3 + (k % 10) * 0.065); },
  meshesFor(m) { return m.place !== undefined ? [] : [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.place !== undefined ? m.place : m.to); },
  fromFor(m) { return m.from !== undefined ? this.pos(m.from) : null; },
  ringTone: m => (m.cap ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES.latrunculi, tok = play.token, ex = play.ex;
    if (m.place !== undefined) { const c = ex.pieces[m.pl][this.used[m.pl]++]; this.cell[m.place] = c; const res = G.apply(m); await hop(c, this.pos(m.place), 0.3, 0.07); return res; }
    const c = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = c;
    const res = G.apply(m);
    await hop(c, this.pos(m.to), 0.24, 0.025);
    if (tok !== play.token) return res;
    for (const j of res.taken) { const v = this.cell[j]; this.cell[j] = null; if (v) hop(v, this.lostSpot(1 - m.pl, this.lost[1 - m.pl]++), 0.4, 0.12); }
    return res;
  },
  score: () => { const G = GAMES.latrunculi; return [['You took', G.taken[0]], ['Scribe took', G.taken[1]], G.placing() ? '' : `· ${G.count(0)} v ${G.count(1)} on the board`]; },
};
