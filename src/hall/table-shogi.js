const SHOGI_CH = [null, '歩', '香', '桂', '銀', '金', '角', '飛', '王'], SHOGI_PRO = [null, 'と', '杏', '圭', '全', null, '馬', '龍', null];
const SHOGI_P = {
  camW: 1.12, ringScale: 0.6,
  intro() { return 'You move first; your pieces point away from you. ' + this.prompt(); },
  prompt: () => 'Pick a piece, then a ring. Pieces you capture wait in your hand at the right: pick one there to drop it.',
  setup(ex) {
    const G = GAMES.shogi, d = ex.group.userData;
    d.display.forEach(m => { m.visible = false; });
    (ex.pieces || []).forEach(m => ex.group.remove(m));
    ex.pieces = []; this.ex = ex; this.cell = Array(81).fill(null); this.hand = [[], []];
    for (let i = 0; i < 81; i++) { const v = G.b[i]; if (v) { const p = this.make(v); p.position.copy(this.pos(i)); this.cell[i] = p; } }
    // Pieces in hand, for a game taken back or resumed.
    for (const pl of [0, 1]) for (let t = 1; t <= 7; t++) for (let n = 0; n < G.hands[pl][t - 1]; n++) {
      const p = this.make(t + (pl ? 32 : 0)); this.hand[pl].push(p); p.position.copy(this.handSpot(pl, t, n));
    }
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.pieces || []).forEach(m => { m.visible = false; }); },
  make(v) {
    const t = v & 15, pro = (v & 16) !== 0, pl = v & 32 ? 1 : 0;
    const ch = pro ? SHOGI_PRO[t] : t === 8 && pl ? '玉' : SHOGI_CH[t];
    const p = shogiPiece(ch, pl === 1, pro); p.userData.v = v;
    this.ex.group.add(p); this.ex.pieces.push(p); return p;
  },
  relabel(p, v) {
    const t = v & 15, pro = (v & 16) !== 0, pl = v & 32 ? 1 : 0;
    p.userData.v = v; p.userData.label.material.map = shogiFace(pro ? SHOGI_PRO[t] : t === 8 && pl ? '玉' : SHOGI_CH[t], pro); p.userData.label.material.needsUpdate = true;
    p.rotation.y = pl ? Math.PI : 0;
  },
  pos(i) { return V3(((i % 9) - 4) * SHOGI_S, GAMES.shogi.surface, (4 - ((i / 9) | 0)) * SHOGI_S); },
  // Hands: the visitor's beside the board at the near right, the Scribe's at the far left, one row per kind.
  handSpot(pl, t, k) { const x = (pl ? -1 : 1) * (0.43 + (k % 3) * 0.05), z = (pl ? -1 : 1) * (0.32 - (t - 1) * 0.06) ; return V3(x, GAMES.shogi.surface - 0.11 + 0.006 + ((k / 3) | 0) * 0.011, z); },
  layoutHand(pl) {
    for (let t = 1; t <= 7; t++) this.hand[pl].filter(p => (p.userData.v & 15) === t).forEach((p, k) => hop(p, this.handSpot(pl, t, k), 0.25, 0.03));
  },
  meshesFor(m) { if (m.drop) { const h = this.hand[m.pl].filter(p => (p.userData.v & 15) === m.drop); return [h[h.length - 1]]; } return [this.cell[m.from]]; },
  ringFor(m) { return this.pos(m.to); },
  fromFor(m) { return m.drop ? null : this.pos(m.from); },
  async play(m) {
    const G = GAMES.shogi, tok = play.token;
    if (m.drop) {
      const p = this.meshesFor(m)[0]; this.hand[m.pl].splice(this.hand[m.pl].indexOf(p), 1);
      const res = G.apply(m); this.cell[m.to] = p;
      await hop(p, this.pos(m.to), 0.32, 0.05); this.layoutHand(m.pl); return res;
    }
    const p = this.cell[m.from], victim = m.cap ? this.cell[m.to] : null;
    this.cell[m.from] = null; this.cell[m.to] = p;
    const res = G.apply(m);
    await hop(p, this.pos(m.to), 0.3, (G.b[m.to] & 15) === 3 ? 0.07 : 0.03);
    if (tok !== play.token) return res;
    if (m.promo) this.relabel(p, G.b[m.to]);
    if (victim) { // it changes sides and joins the captor's hand, unpromoted
      this.relabel(victim, (victim.userData.v & 15) + (m.pl ? 32 : 0));
      this.hand[m.pl].push(victim); this.layoutHand(m.pl);
    }
    return res;
  },
  score: () => { const G = GAMES.shogi; return [['You', G.hands[0].reduce((a, b) => a + b, 0)], ['Scribe', G.hands[1].reduce((a, b) => a + b, 0)], 'in hand']; },
};
