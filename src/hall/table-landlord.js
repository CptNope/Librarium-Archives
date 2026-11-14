const LANDLORD_P = {
  camW: 1.32, ringScale: 0.8,
  intro() { return 'You play the pale checker and throw first. ' + this.prompt(); },
  prompt() {
    const G = GAMES.landlord;
    if (G.ticketsOpen[0]) return `Your lot tickets: ${G.tickets[0].join(', ')}. Buy any of those lots now if you like, then start.`;
    if (G.jailed[0]) return 'You are in jail. Pay the $50 fine, or throw for a double.';
    const debt = G.notes[0] ? `, notes owed $${100 * G.notes[0]}` : '';
    return G.laps[0] >= G.ROUNDS ? `You have been round ${G.ROUNDS} times${debt}. Throw when you are ready.` : `Round ${G.laps[0] + 1} of ${G.ROUNDS}. Cash $${G.cash[0]}${debt}. Throw when you are ready.`;
  },
  choosePrompt: () => 'Pick your checker, then the glowing space to go to.',
  spot(pl, k) { const p = llSpace(k), side = Math.abs(p.ox) === 1 ? [0, 1] : Math.abs(p.oz) === 1 ? [1, 0] : [0.7, -0.7]; const o = (pl ? 1 : -1) * 0.016; return V3(p.x + p.ox * 0.025 + side[0] * o, GAMES.landlord.surface + 0.007, p.z + p.oz * 0.025 + side[1] * o); },
  deedSpot(k) { const p = llSpace(k); return V3(p.x - p.ox * 0.03, GAMES.landlord.surface + 0.0015, p.z - p.oz * 0.03); },
  setup(ex) {
    const G = GAMES.landlord;
    if (!ex.tokens) ex.tokens = [0, 1].map(pl => {
      const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x1d1a17 : 0xe9dfc6, roughness: pl ? 0.3 : 0.45 });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.012, 24), mat); m.userData.mats = [mat]; ex.group.add(m); return m;
    });
    (ex.deeds || []).forEach(d => ex.group.remove(d)); ex.deeds = [];
    this.ex = ex; this.deedAt = {};
    ex.tokens.forEach((t, pl) => { t.visible = true; t.position.copy(this.spot(pl, G.pos[pl])); });
  },
  leave(ex) { (ex.tokens || []).forEach(t => { t.visible = false; }); (ex.deeds || []).forEach(d => ex.group.remove(d)); ex.deeds = []; },
  async syncDeeds() { // a deed on every bought lot, a charter on every taken franchise
    const G = GAMES.landlord, jobs = [];
    const add = (k, pl, w, d) => {
      const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x2b2622 : 0xf4ecd6, roughness: 0.8 });
      const card = new THREE.Mesh(new THREE.BoxGeometry(w, 0.002, d), mat);
      const p = llSpace(k); card.rotation.y = Math.abs(p.ox) === 1 ? Math.PI / 2 : 0;
      card.position.copy(this.spot(pl, G.pos[pl])); card.position.y += 0.03; this.ex.group.add(card); this.ex.deeds.push(card); this.deedAt[k] = card;
      jobs.push(hop(card, this.deedSpot(k), 0.4, 0.06));
    };
    for (let n = 1; n <= 22; n++) { const k = G.lotAt(n); if (G.owner[n] >= 0 && !this.deedAt[k]) add(k, G.owner[n], 0.05, 0.034); }
    for (const k of [13, 27]) if (G.fran[k] >= 0 && !this.deedAt[k]) add(k, G.fran[k], 0.046, 0.03);
    await Promise.all(jobs);
  },
  meshesFor(m) { return m.kind === 'move' ? [this.ex.tokens[m.pl]] : []; },
  ringFor(m) { if (m.kind !== 'move') return null; const p = llSpace(m.to); return V3(p.x, GAMES.landlord.surface, p.z); },
  fromFor(m) { if (m.kind !== 'move') return null; const p = llSpace(m.from); return V3(p.x, GAMES.landlord.surface, p.z); },
  async play(m) {
    const G = GAMES.landlord, tok = play.token, t = this.ex.tokens[m.pl];
    if (m.kind === 'move') for (const k of G.steps(m)) { if (tok !== play.token) return {}; await hop(t, this.spot(m.pl, k), 0.15, 0.04); }
    const res = G.apply(m);
    if (tok !== play.token) return res;
    const at = this.spot(m.pl, G.pos[m.pl]);
    if (t.position.distanceTo(at) > 0.01) await hop(t, at, 0.5, 0.1);
    await this.syncDeeds();
    return res;
  },
  score: () => { const G = GAMES.landlord; return [['You', '$' + G.worth(0)], ['Scribe', '$' + G.worth(1)], 'worth']; },
};
