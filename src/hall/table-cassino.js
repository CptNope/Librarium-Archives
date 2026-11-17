// Cassino: four cards in each hand, the table's cards and builds between, the rest of the pack at the side,
// and each player's takings in a pile on their right. A build is a little fan of its cards, labelled by a ring.
const CASSINO_P = {
  camW: 1.15,
  intro() { const G = GAMES.cassino; return (G.toMove === 0 ? 'The Scribe deals; you play first. ' : 'You deal; the Scribe plays first. ') + this.prompt(); },
  prompt() { return GAMES.cassino.prompt0(); },
  choosePrompt() { return GAMES.cassino.prompt0(); },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.cassino.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = crCard(c); m.scale.set(1.15, 1, 1.15); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } m.visible = true; return m; },
  handSpot(pl, i, n) { return V3((i - (n - 1) / 2) * (pl ? 0.06 : 0.1), this.y() + i * 0.0004, pl ? -0.3 : 0.3); },
  itemSpot(i, n) { // up to six to a row, then a second row
    const per = n > 6 ? Math.ceil(n / 2) : n, row = i < per ? 0 : 1, k = row ? i - per : i, cnt = row ? n - per : per;
    return V3((k - (cnt - 1) / 2) * 0.1, this.y(), n > 6 ? (row ? 0.08 : -0.08) : 0);
  },
  packSpot: k => V3(-0.5, GAMES.cassino.surface + 0.001 + k * 0.0012, 0),
  pileSpot(pl, k) { return V3(0.47, this.y() + k * 0.0012, pl ? -0.16 : 0.16); },
  down(m) { m.rotation.set(0, Math.PI / 2, Math.PI); },
  redeal() {
    const G = GAMES.cassino;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map(); this.piled = [0, 0];
    G.pack.forEach((c, k) => { const m = this.card(c); this.down(m); m.position.copy(this.packSpot(k)); });
    for (const pl of [0, 1]) G.piles[pl].forEach(c => { const m = this.card(c); this.down(m); m.position.copy(this.pileSpot(pl, this.piled[pl]++)); });
    this.layTable(true); this.layHand(0, true); this.layHand(1, true);
  },
  layTable(instant) {
    const G = GAMES.cassino, n = G.table.length, jobs = [];
    G.table.forEach((t, i) => {
      const at = this.itemSpot(i, n);
      t.cards.forEach((c, j) => { const m = this.card(c), to = V3(at.x + j * 0.012, at.y + j * 0.0012, at.z + j * 0.016); m.rotation.set(0, t.kind === 'card' ? 0 : -0.06 * j, 0); if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.22, 0.01)); });
    });
    return Promise.all(jobs);
  },
  layHand(pl, instant) {
    const G = GAMES.cassino, h = G.hands[pl];
    return Promise.all(h.map((c, i) => {
      const m = this.card(c), to = this.handSpot(pl, i, h.length);
      if (pl === 0 && G.stage === 'how' && G.picked === c) { to.z -= 0.045; to.y += 0.008; } // the card being played, lifted
      m.rotation.set(0, pl ? Math.PI : 0, pl ? Math.PI : 0);
      if (instant) { m.position.copy(to); return null; }
      return hop(m, to, 0.22, 0.008);
    }));
  },
  // A card with one play is played by clicking it; a card with several is picked, and its plays offered as buttons.
  meshesFor(m) { return m.pl === 0 && !m.label && m.card !== undefined && ['pick', 'take', 'build', 'multi', 'trail'].includes(m.kind) ? [this.mesh.get(m.card)] : []; },
  ringFor: () => null,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.cassino, tok = play.token;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); continue; }
      if (e.type === 'pick') { await this.layHand(0); continue; }
      if (e.type === 'take') {
        const mc = this.card(e.card); sfx.card();
        if (e.pl === 1) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        const over = this.card(e.cards[0]).position.clone(); over.y += 0.006;
        await hop(mc, over, 0.3, 0.04); mc.rotation.set(0, 0, 0);
        await wait(e.sweep ? 700 : 350); if (tok !== play.token) return res;
        await Promise.all([e.card, ...e.cards].map(c => { const x = this.card(c), to = this.pileSpot(e.pl, this.piled[e.pl]++); return hop(x, to, 0.3, 0.03).then(() => this.down(x)); }));
        await this.layTable(); await this.layHand(e.pl);
        continue;
      }
      if (e.type === 'build' || e.type === 'trail') {
        const mc = this.card(e.card); sfx.card();
        if (e.pl === 1) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        await this.layTable(); await this.layHand(e.pl);
        continue;
      }
      if (e.type === 'deal4') {
        sfx.card();
        await this.layHand(0); await this.layHand(1);
        G.pack.forEach((c, k) => this.card(c).position.copy(this.packSpot(k)));
        continue;
      }
      if (e.type === 'sweepUp') { await wait(400); await Promise.all(e.cards.map(c => { const x = this.card(c), to = this.pileSpot(e.pl, this.piled[e.pl]++); return hop(x, to, 0.3, 0.03).then(() => this.down(x)); })); }
    }
    return res;
  },
  score() {
    const G = GAMES.cassino;
    return [['You', G.total[0]], ['Scribe', G.total[1]], `to 21 · deal ${G.deals} · taken ${G.piles[0].length}–${G.piles[1].length} · pack ${G.pack.length}`];
  },
};
