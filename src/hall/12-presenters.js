/* ----------------------------------------------------- presenters
 * Each game's presenter turns rule moves into meshes on the board:
 *   setup(ex)       place pieces for a fresh game
 *   meshesFor(m)    what the visitor clicks to make move m (may be empty)
 *   ringFor(m)      where to draw the destination ring for m
 *   play(m)         apply m to the rules and animate it; resolves to the rules' result
 *   score()         [[label, value], [label, value], suffix] for the HUD
 *   prompt()        what to tell the visitor on their turn */
function racePresenter(G) {
  return {
    camW: G.camW || (G.id === 'senet' ? 1.62 : 1.78),
    intro: () => `You play the ${G.sides[0]}, nearest to you. Throw to begin.`,
    setup(ex) {
      if (!ex.pieces) ex.pieces = G.makePieces(ex.group);
      this.meshes = ex.pieces;
      [0, 1].forEach(pl => this.meshes[pl].forEach((m, i) => { const v = G.local(pl, G.pos[pl][i], i); v.y += G.pieceH; m.position.copy(v); }));
    },
    meshesFor(m) {
      const a = [this.meshes[m.pl][m.i]];
      if (G.id === 'ur' && m.from === 0) G.pos[m.pl].forEach((p, i) => { if (p === 0 && i !== m.i) a.push(this.meshes[m.pl][i]); });
      return a;
    },
    ringFor(m) { if (m.water) { const c = seCell(27); return V3(c.x, G.surface, c.z); } return G.local(m.pl, m.to, m.i); },
    fromFor(m) { return G.local(m.pl, m.from, m.i); },
    async play(m) {
      const tok = play.token, mesh = this.meshes[m.pl][m.i];
      for (const s of G.steps(m)) {
        if (tok !== play.token) return {};
        const p = s === 27 && G.id === 'senet' ? (() => { const c = seCell(27); return V3(c.x, G.surface, c.z); })() : G.local(m.pl, s, m.i);
        p.y += G.pieceH;
        const off = (G.id === 'ur' && s === 15) || s === 31 || (G.bigHop && G.bigHop(m, s));
        await hop(mesh, p, off ? 0.32 : 0.17, off ? 0.12 : 0.05);
      }
      const res = G.apply(m);
      for (const o of res.moved) {
        if (tok !== play.token) return res;
        const v = G.local(o.pl, G.pos[o.pl][o.i], o.i); v.y += G.pieceH;
        await hop(this.meshes[o.pl][o.i], v, 0.45, 0.16);
      }
      return res;
    },
    score: () => (G.score ? G.score() : [['You', G.home(0) + '/' + G.N], ['Scribe', G.home(1) + '/' + G.N], 'borne off']),
    prompt: () => 'Throw when you are ready.',
  };
}

const MORRIS_P = {
  camW: 1.6, gid: 'morris', word: 'piece',
  intro() { return 'You play the pale pieces. ' + this.prompt(); },
  setup(ex) {
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: GAMES[this.gid].N }, () => {
      const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x1c1916 : 0xe8dcc0, roughness: pl ? 0.3 : 0.45 });
      const m = new THREE.Mesh(morrisPieceGeo, mat); m.userData.mats = [mat]; ex.group.add(m); return m;
    }));
    const G = GAMES[this.gid];
    this.hand = [ex.pieces[0].slice(), ex.pieces[1].slice()];
    this.at = Array(24).fill(null); this.lost = [0, 0];
    [0, 1].forEach(pl => ex.pieces[pl].forEach((m, k) => m.position.copy(this.handSpot(pl, k))));
    // Rebuilt from the engine, for a game taken back or resumed: placed pieces first, then those taken.
    for (const pl of [0, 1]) {
      const placed = G.N - G.hand[pl], mine = this.hand[pl].splice(0, placed);
      for (let p = 0; p < 24; p++) if (G.board[p] === pl) { const m = mine.shift(); this.at[p] = m; m.position.copy(this.pt(p)); }
      mine.forEach(m => m.position.copy(this.lostSpot(pl, this.lost[pl]++)));
      this.hand[pl].forEach((m, k) => m.position.copy(this.handSpot(pl, k + placed)));
    }
  },
  handSpot: (pl, k) => V3(-0.4 + k * 0.1, TOP, pl === 0 ? 0.54 : -0.54),
  lostSpot: (owner, k) => V3(owner === 0 ? -0.8 : 0.8, TOP, -0.32 + k * 0.08),
  pt(p) { const q = moPoint(p); return V3(q.x, GAMES[this.gid].surface, q.z); },
  meshesFor(m) { return m.type === 'place' ? [] : [this.at[m.type === 'move' ? m.from : m.at]]; },
  ringFor(m) { return this.pt(m.type === 'remove' ? m.at : m.to); },
  fromFor(m) { return m.type === 'move' ? this.pt(m.from) : null; },
  ringTone: m => (m.type === 'remove' ? 'ember' : 'gold'),
  async play(m) {
    const G = GAMES[this.gid]; let mesh, res;
    if (m.type === 'place') { mesh = this.hand[m.pl].shift(); res = G.apply(m); this.at[m.to] = mesh; await hop(mesh, this.pt(m.to), 0.38, 0.12); }
    else if (m.type === 'move') { mesh = this.at[m.from]; this.at[m.from] = null; this.at[m.to] = mesh; res = G.apply(m); await hop(mesh, this.pt(m.to), m.fly ? 0.45 : 0.3, m.fly ? 0.14 : 0.03); }
    else { mesh = this.at[m.at]; this.at[m.at] = null; res = G.apply(m); const owner = 1 - m.pl; await hop(mesh, this.lostSpot(owner, this.lost[owner]++), 0.45, 0.16); }
    return res;
  },
  score() { return [['You', GAMES[this.gid].count(0)], ['Scribe', GAMES[this.gid].count(1)], this.word + 's left']; },
  prompt() {
    const G = GAMES[this.gid];
    if (G.hand[0] > 0) return `Place a ${this.word} on a glowing point. ${G.hand[0]} left in your hand.`;
    return G.onBoard(0) === 3 ? `Three ${this.word}s left, so yours can fly. Pick one, then any empty point.` : `Pick a ${this.word}, then a glowing point next to it.`;
  },
};
