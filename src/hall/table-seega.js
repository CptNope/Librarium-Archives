const SEEGA_P = {
  camW: 0.95,
  intro() { return 'You have the dark stones, the Scribe the red clay. Place two stones at a time on empty cups, never the centre.'; },
  prompt() { const G = GAMES.seega; return G.placing() ? 'Place two stones on empty cups.' : !G.started ? 'Your first move must go into the centre.' : 'Pick a stone, then a ring. Trap a piece between two of yours to take it.'; },
  setup(ex) {
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 12 }, () => { const s = sgStone(pl); ex.group.add(s); return s; }));
    this.cell = Array(25).fill(null); this.used = [0, 0]; this.lost = [0, 0];
    ex.pieces.forEach((list, pl) => list.forEach((s, k) => { s.visible = true; s.position.copy(this.handSpot(pl, k)); }));
    // Rebuilt from the engine: stones on the board, those lost, the rest still in hand.
    const G = GAMES.seega;
    for (const pl of [0, 1]) {
      const placed = ex.pieces[pl].slice(0, G.placed[pl]); this.used[pl] = G.placed[pl];
      for (let i = 0; i < 25; i++) if (G.b[i] === pl + 1) { const s = placed.shift(); this.cell[i] = s; s.position.copy(this.pos(i)); }
      placed.forEach(s => s.position.copy(this.lostSpot(pl, this.lost[pl]++)));
    }
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).flat().forEach(s => { s.visible = false; }); },
  pos(i) { const c = sgCell(i); return V3(c.x, GAMES.seega.surface + 0.012, c.z); },
  // Stones wait in two rows on their owner's side of the slab; lost stones go to the side.
  handSpot(pl, k) { return V3((pl ? 1 : -1) * (0.2 - ((k / 2) | 0) * 0.075), TOP + 0.012, (pl ? -1 : 1) * (0.34 + (k % 2) * 0.065)); },
  lostSpot(owner, k) { return V3((owner ? -1 : 1) * (0.36 + ((k / 6) | 0) * 0.065), TOP + 0.012, (owner ? -1 : 1) * (0.2 - (k % 6) * 0.07)); },
  meshesFor(m) { return m.place !== undefined ? [] : [this.cell[m.lift !== undefined ? m.lift : m.from]]; },
  ringFor(m) { return m.place !== undefined ? this.pos(m.place) : m.lift !== undefined ? null : this.pos(m.to); },
  ringTone: m => (m.cap ? 'ember' : 'gold'),
  fromFor(m) { return m.from !== undefined ? this.pos(m.from) : null; },
  async play(m) {
    const G = GAMES.seega, tok = play.token, ex = play.ex;
    if (m.place !== undefined) {
      const s = ex.pieces[m.pl][this.used[m.pl]++]; this.cell[m.place] = s;
      const res = G.apply(m); await hop(s, this.pos(m.place), 0.35, 0.08); return res;
    }
    if (m.lift !== undefined) {
      const s = this.cell[m.lift]; this.cell[m.lift] = null; const res = G.apply(m);
      await hop(s, this.lostSpot(m.pl, this.lost[m.pl]++), 0.4, 0.1); return res;
    }
    const s = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = s;
    const res = G.apply(m);
    await hop(s, this.pos(m.to), 0.26, 0.03);
    if (tok !== play.token) return res;
    for (const j of res.taken) { const v = this.cell[j]; this.cell[j] = null; if (v) hop(v, this.lostSpot(1 - m.pl, this.lost[1 - m.pl]++), 0.4, 0.12); }
    return res;
  },
  score: () => { const G = GAMES.seega; return [['You', G.count(0) + 12 - G.placed[0]], ['Scribe', G.count(1) + 12 - G.placed[1]], 'stones']; },
};
