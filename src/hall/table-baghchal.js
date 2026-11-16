
const BAGHCHAL_P = {
  camW: 1.0,
  intro() { const G = GAMES.baghchal; return G.goatPl === 0 ? 'You lead the goats and move first: place a goat on any empty point. Trap all four tigers to win.' : 'You lead the tigers; the Scribe\'s goats move first. Take five goats to win.'; },
  prompt() { const G = GAMES.baghchal; return G.goatPl === 0 ? (G.inHand ? `Place a goat (${G.inHand} left to place).` : 'Pick a goat, then a ring.') : 'Pick a tiger, then a ring. Jump a goat to take it.'; },
  setup(ex) {
    const G = GAMES.baghchal;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) { ex.pieces = { tigers: [0, 1, 2, 3].map(() => { const t = bcTiger(); ex.group.add(t); return t; }), goats: Array.from({ length: 20 }, () => { const t = bcGoat(); ex.group.add(t); return t; }) }; }
    this.cell = Array(25).fill(null); this.used = 0; this.lost = 0;
    ex.pieces.goats.forEach((t, k) => { t.visible = true; t.position.copy(this.handSpot(k)); });
    // Rebuilt from the engine: tigers and goats where they stand, taken goats aside, the rest waiting.
    const tigers = ex.pieces.tigers.slice(), goats = ex.pieces.goats.slice(0, 20 - G.inHand);
    this.used = 20 - G.inHand;
    for (let i = 0; i < 25; i++) {
      if (G.b[i] === 2) { const t = tigers.shift(); t.visible = true; t.position.copy(this.pos(i)); this.cell[i] = t; }
      else if (G.b[i] === 1) { const t = goats.shift(); t.position.copy(this.pos(i)); this.cell[i] = t; }
    }
    goats.forEach(t => t.position.copy(this.lostSpot(this.lost++)));
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); if (ex.pieces) [...ex.pieces.tigers, ...ex.pieces.goats].forEach(m => { m.visible = false; }); },
  pos(i) { const c = bcCell(i); return V3(c.x, GAMES.baghchal.surface, c.z); },
  // Goats wait beside the board on the goat player's side; taken goats go to the other side.
  handSpot(k) { const near = GAMES.baghchal.goatPl === 0; return V3(-0.33 + (k % 10) * 0.073, TOP, (near ? 1 : -1) * (0.36 + ((k / 10) | 0) * 0.06)); },
  lostSpot(k) { const near = GAMES.baghchal.goatPl === 0; return V3(0.4, TOP, (near ? -1 : 1) * (0.25 - k * 0.07)); },
  meshesFor(m) { return m.place !== undefined ? [] : [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.place !== undefined ? m.place : m.to); },
  fromFor(m) { return m.from !== undefined ? this.pos(m.from) : null; },
  ringTone: m => (m.cap ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES.baghchal, tok = play.token;
    if (m.place !== undefined) {
      const goat = play.ex.pieces.goats[this.used++]; this.cell[m.place] = goat;
      const res = G.apply(m); await hop(goat, this.pos(m.place), 0.35, 0.08); return res;
    }
    const mesh = this.cell[m.from]; this.cell[m.from] = null; this.cell[m.to] = mesh;
    const victim = m.over !== undefined ? this.cell[m.over] : null; if (victim) this.cell[m.over] = null;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), victim ? 0.34 : 0.26, victim ? 0.09 : 0.03);
    if (tok !== play.token) return res;
    if (victim) hop(victim, this.lostSpot(this.lost++), 0.4, 0.12);
    return res;
  },
  score: () => { const G = GAMES.baghchal; return [['Goats taken', `${G.taken} of 5`], ['Goats to place', G.inHand], '']; },
};
