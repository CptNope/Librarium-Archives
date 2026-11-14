const JUNGLE_P = {
  camW: 0.95,
  intro() { return 'You play blue and move first. Walk any animal into the Scribe\'s den, at the far end, to win. ' + this.prompt(); },
  prompt: () => 'Pick an animal, then a ring.',
  setup(ex) {
    const G = GAMES.jungle;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = [];
    this.ex = ex; this.cell = Array(63).fill(null); this.lost = [0, 0];
    G.b.forEach((v, i) => { if (!v) return; const p = juPiece(v); p.position.copy(this.pos(i)); ex.group.add(p); ex.pieces.push(p); this.cell[i] = p; });
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => ex.group.remove(m)); ex.pieces = []; },
  pos(i) { const c = juCell(i); return V3(c.x, GAMES.jungle.surface + 0.008, c.z); },
  // Taken animals line up beside the board, on the side of the player who lost them.
  lostSpot(owner, k) { return V3((owner ? -1 : 1) * (0.37 + ((k / 4) | 0) * 0.07), TOP + 0.008, (owner ? -1 : 1) * (0.22 - (k % 4) * 0.075)); },
  meshesFor(m) { return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return this.pos(m.from); },
  ringTone: m => (m.cap || m.to === GAMES.jungle.DEN[1 - m.pl] ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES.jungle, tok = play.token, mesh = this.cell[m.from], victim = this.cell[m.to];
    this.cell[m.from] = null; this.cell[m.to] = mesh;
    const res = G.apply(m);
    await hop(mesh, this.pos(m.to), m.leap ? 0.5 : 0.28, m.leap ? 0.1 : 0.03);
    if (tok !== play.token) return res;
    if (victim) { const owner = 1 - m.pl; hop(victim, this.lostSpot(owner, this.lost[owner]++), 0.4, 0.12); }
    return res;
  },
  score: () => { const G = GAMES.jungle; return [['You', G.count(0)], ['Scribe', G.count(1)], 'animals']; },
};
