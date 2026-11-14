
const PATOLLI_P = {
  camW: 0.95,
  intro() { return 'This table plays a modern reconstruction. You have the red markers and six treasures. Throw the beans: a 1 brings a marker onto the mat.'; },
  prompt() { return 'Throw the beans.'; },
  choosePrompt: moves => (moves[0] && moves[0].offering ? 'No marked beans: press the button to pay your offering.' : moves.length > 1 ? 'Pick a glowing marker, then its ring.' : 'Pick the glowing marker to move it.'),
  setup(ex) {
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 6 }, () => { const o = ptStone(pl); ex.group.add(o); return o; }));
    ex.pieces.forEach((list, pl) => list.forEach((o, k) => { o.visible = true; o.position.copy(this.waitSpot(pl, k)); }));
    this.homeN = [0, 0];
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).flat().forEach(o => { o.visible = false; }); },
  house(h) { const [x, z] = ptHouses[h]; return V3(x, GAMES.patolli.surface, z); },
  waitSpot(pl, k) { return V3((pl ? 1 : -1) * (0.36 + (k % 2) * 0.04), TOP + 0.014, (pl ? -1 : 1) * (0.26 + ((k / 2) | 0) * 0.04)); },
  homeSpot(pl, k) { return V3((pl ? -1 : 1) * (0.36 + (k % 2) * 0.04), TOP + 0.014, (pl ? -1 : 1) * (0.26 + ((k / 2) | 0) * 0.04)); },
  meshesFor(m) { return m.offering ? [] : [play.ex.pieces[m.pl][m.k]]; },
  ringFor(m) { return m.offering ? null : m.off ? this.homeSpot(m.pl, this.homeN[m.pl]) : this.house(m.house); },
  fromFor(m) { return m.offering || m.from < 0 ? null : this.house(GAMES.patolli.house(m.pl, m.from)); },
  ringTone: m => (m.cap ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES.patolli, tok = play.token;
    if (m.offering) return G.apply(m);
    const o = play.ex.pieces[m.pl][m.k];
    const res = G.apply(m);
    const path = G.steps(m);
    if (m.off) path.pop();
    for (const h of path) { if (tok !== play.token) return res; await hop(o, this.house(h), 0.11, 0.025); }
    if (m.off) await hop(o, this.homeSpot(m.pl, this.homeN[m.pl]++), 0.3, 0.06);
    if (res.sent) { const [p, k] = res.sent; hop(play.ex.pieces[p][k], this.waitSpot(p, k), 0.45, 0.12); }
    return res;
  },
  score: () => { const G = GAMES.patolli; return [['Your treasures', G.treasure[0]], ['Scribe\'s', G.treasure[1]], `· offerings ${G.pot} · home ${G.home(0)} v ${G.home(1)}`]; },
};
