const HOUNDS_P = {
  camW: 0.9,
  intro() { return 'This table plays Howard Carter\'s 1912 reconstruction. Your hounds race up the left track; throw the sticks to begin.'; },
  prompt() { return 'Throw the sticks.'; },
  choosePrompt: moves => (moves.length > 1 ? 'Pick a glowing pin, then its ring.' : 'Pick the glowing pin to move it.'),
  setup(ex) {
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [-1, 1].map(s => Array.from({ length: 5 }, () => { const p = hjPin(s); ex.group.add(p); return p; }));
    ex.pieces.forEach((list, pl) => list.forEach((p, k) => { p.visible = true; p.position.copy(this.waitSpot(pl, k)); }));
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).flat().forEach(p => { p.visible = false; }); },
  side: pl => (pl ? 1 : -1),
  hole(pl, h) { return play.ex.group.userData.holes[this.side(pl)][h - 1].clone(); },
  waitSpot(pl, k) { return V3((pl ? 1 : -1) * (0.3 + (k % 2) * 0.05), TOP, 0.28 - k * 0.06); }, // beside the foot of the board
  pos(pl, h, k) {
    if (h === 0) return this.waitSpot(pl, k);
    const p = this.hole(pl, h);
    if (h === 29) { const n = GAMES.hounds.pos[pl].slice(0, k).filter(x => x === 29).length; p.x += (n - 2) * 0.012 * (pl ? -1 : 1); } // pins in the goal stand side by side
    return p;
  },
  meshesFor(m) { return [play.ex.pieces[m.pl][m.k]]; },
  ringFor(m) { return this.pos(m.pl, m.end, m.k); },
  fromFor(m) { return m.from ? this.hole(m.pl, m.from) : null; },
  async play(m) {
    const G = GAMES.hounds, tok = play.token, pin = play.ex.pieces[m.pl][m.k];
    const res = G.apply(m);
    for (const h of G.steps(m)) { if (tok !== play.token) return res; await hop(pin, this.pos(m.pl, h, m.k), 0.13, 0.03); }
    return res;
  },
  score: () => { const G = GAMES.hounds; return [['You', G.home(0)], ['Scribe', G.home(1)], 'home of 5']; },
};
