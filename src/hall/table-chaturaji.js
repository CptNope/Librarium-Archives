const CHATURAJI_P = {
  camW: 1.25,
  intro() { return 'You are yellow, nearest you. Black sits on your left, Red across, Green on your right, and play goes to your left. Throw the dice.'; },
  prompt() { return `Round ${GAMES.chaturaji.round} of ${GAMES.chaturaji.ROUNDS}. Throw the dice.`; },
  choosePrompt: moves => `Pick a glowing piece, then its ring${moves.some(m => m.pass) ? ', or press Skip' : ''}.`,
  setup(ex) {
    const G = GAMES.chaturaji;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(64).fill(null); this.won = [0, 0, 0, 0]; this.dimmed = [false, false, false, false];
    G.b.forEach((v, i) => { if (v) this.cell[i] = this.make(v, i); });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  make(v, i) { const o = cjPiece(v); o.position.copy(this.pos(i)); this.ex.group.add(o); this.ex.pieces.push(o); return o; },
  pos(i) { const c = cjCell(i); return V3(c.x, GAMES.chaturaji.surface, c.z); },
  // Pieces taken go to the edge of the board in front of whoever took them.
  wonSpot(seat, k) {
    const t = (k % 9 - 4) * 0.075, row = 0.44 + Math.floor(k / 9) * 0.06, y = TOP;
    return [V3(t, y, row), V3(-row, y, -t), V3(-t, y, -row), V3(row, y, t)][seat];
  },
  meshesFor(m) { return m.pass ? [] : [this.cell[m.from]]; },
  ringFor(m) { return m.pass ? null : this.pos(m.to); },
  fromFor(m) { return m.pass ? null : this.pos(m.from); },
  async play(m) {
    const G = GAMES.chaturaji, tok = play.token;
    if (m.pass) return G.apply(m);
    const mesh = this.cell[m.from], victims = [];
    const res = G.apply(m);
    for (const j of res.captured) { victims.push(this.cell[j]); this.cell[j] = null; }
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const t = G.b[m.to] & 7;
    await hop(mesh, this.pos(m.to), 0.3, t === 3 || t === 4 ? 0.07 : 0.03);
    if (tok !== play.token) return res;
    for (const v of victims) if (v) hop(v, this.wonSpot(m.seat, this.won[m.seat]++), 0.4, 0.12);
    if (res.promo) { mesh.visible = false; this.cell[m.to] = this.make(G.b[m.to], m.to); }
    // An army whose king has fallen fades, but stays to be taken.
    for (let s = 1; s < 4; s++) if (!G.alive[s] && !this.dimmed[s]) {
      this.dimmed[s] = true;
      this.cell.forEach(o => { if (o && o.userData.seat === s) o.userData.mats.forEach(mt => { mt.color.multiplyScalar(0.55); mt.transparent = true; mt.opacity = 0.75; }); });
    }
    return res;
  },
  scores() {
    const G = GAMES.chaturaji;
    return [['You', G.score[0]], ...[1, 2, 3].map(s => [G.SEATS[s] + (G.alive[s] ? '' : ' (out)'), G.score[s]]), `round ${Math.min(G.round, G.ROUNDS)}/${G.ROUNDS}`];
  },
  score() { const L = this.scores(); return [L[0], L[1], L.slice(2).map(x => Array.isArray(x) ? x.join(' ') : x).join(' · ')]; },
};
