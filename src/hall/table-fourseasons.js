
const FOURSEASONS_P = {
  camW: 1.15, ringScale: 0.78,
  intro() { return 'You are Red, summer, in the corner by your left hand. Green moves first; then you, Black and White, each for itself.'; },
  prompt() { return 'Pick a piece, then a ring.'; },
  setup(ex) {
    const G = GAMES.fourseasons;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(64).fill(null); this.won = [0, 0, 0, 0];
    G.b.forEach((v, i) => { if (v) this.cell[i] = this.make(v, i); });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  make(v, i) { const o = fsPiece(v); o.userData.v = v; o.position.copy(this.pos(i)); this.ex.group.add(o); this.ex.pieces.push(o); return o; },
  pos(i) { const c = fsCell(i); return V3(c.x, GAMES.fourseasons.surface, c.z); },
  // Pieces taken line up in front of the taker's corner.
  wonSpot(seat, k) { const x = (seat === 0 || seat === 3 ? -0.2 : 0.2) + ((k % 6) - 2.5) * 0.06, z = (seat < 2 ? 1 : -1) * (0.42 + ((k / 6) | 0) * 0.06); return V3(x, TOP, z); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  ringTone: m => (m.cap ? 'ember' : 'gold'),
  // Bring every mesh into line with the board: armies that change hands take their new owner's colour.
  sync() {
    const G = GAMES.fourseasons;
    for (let i = 0; i < 64; i++) {
      const v = G.b[i], o = this.cell[i];
      if (!v && o) { o.visible = false; this.cell[i] = null; continue; }
      if (v && (!o || o.userData.v !== v)) { if (o) o.visible = false; this.cell[i] = this.make(v, i); }
    }
  },
  async play(m) {
    const G = GAMES.fourseasons, tok = play.token;
    const mesh = this.cell[m.from], victim = this.cell[m.to];
    const res = G.apply(m);
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    await hop(mesh, this.pos(m.to), 0.3, (G.b[m.to] & 7) === 3 || (G.b[m.to] & 7) === 4 ? 0.07 : 0.03);
    if (tok !== play.token) return res;
    if (victim) hop(victim, this.wonSpot(m.seat, this.won[m.seat]++), 0.4, 0.12);
    this.sync();
    return res;
  },
  scores() {
    const G = GAMES.fourseasons;
    return [['You', G.alive[0] ? G.material(0) : 'out'], ...[1, 2, 3].map(s => [G.SEATS[s], G.alive[s] ? G.material(s) : 'out']), `round ${Math.min(G.round, G.ROUNDS)}/${G.ROUNDS}`];
  },
  score() { const L = this.scores(); return [L[0], L[1], L.slice(2).map(x => Array.isArray(x) ? x.join(' ') : x).join(' · ')]; },
};
