// Hazard is played at the first dice: two new bone dice and a pile of shillings.
const HZ_UP = { 1: [0, 0, Math.PI / 2], 6: [0, 0, -Math.PI / 2], 2: [0, 0, 0], 5: [Math.PI, 0, 0], 3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0] }; // turns that bring each face to the top
const hzCoinGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.006, 24);
const HAZARD_P = {
  camW: 1.0,
  intro() { return 'You cast first. ' + this.prompt(); },
  prompt() {
    const G = GAMES.hazard;
    const me = play.cur || 0;
    if (G.stage === 'stake') return `Choose your stake. You have ${G.purse[me]} shillings, ${me ? 'the other player' : asFriend('the Scribe')} ${G.purse[1 - me]}.`;
    if (G.stage === 'main') return 'Call your main, 5 to 9. Seven gives the caster the best odds.';
    return G.pending ? `Throw: you need ${G.chance} before ${G.main}.` : `Throw the dice. Your main is ${G.main}.`;
  },
  choosePrompt: () => '',
  setup(ex) {
    const G = GAMES.hazard;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.pieces) {
      ex.pieces = { dice: [cubeDie(0.045, '#efe6d2', '#2a1a10'), cubeDie(0.045, '#efe6d2', '#2a1a10')], coins: [] };
      ex.pieces.dice.forEach(d => ex.group.add(d));
      const mat = new THREE.MeshStandardMaterial({ color: 0xc9cdd2, roughness: 0.3, metalness: 0.75 });
      for (let k = 0; k < 2 * 10; k++) { const c = new THREE.Mesh(hzCoinGeo, mat); ex.group.add(c); ex.pieces.coins.push(c); }
    }
    this.ex = ex;
    ex.pieces.dice.forEach((d, k) => { d.visible = true; d.position.set(-0.05 + k * 0.1, G.surface + 0.0225, 0); d.rotation.set(0, 0.3 * k, 0); });
    ex.pieces.coins.forEach(c => { c.visible = true; });
    this.layCoins(true);
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); if (ex.pieces) { ex.pieces.dice.forEach(d => { d.visible = false; }); ex.pieces.coins.forEach(c => { c.visible = false; }); } },
  // Each purse is a few stacks of shillings in front of its owner; a stake sits in the middle.
  coinSpot(pl, k) { return V3(-0.33 + ((k / 5) | 0) * 0.055, GAMES.hazard.surface + 0.003 + (k % 5) * 0.0062, pl ? -0.2 : 0.2); },
  potSpot(k) { return V3(0.26 + ((k / 5) | 0) * 0.05, GAMES.hazard.surface + 0.003 + (k % 5) * 0.0062, 0); },
  layCoins(instant) {
    const G = GAMES.hazard, coins = this.ex.pieces.coins, jobs = [];
    const staked = G.stage === 'main' || G.stage === 'throw' ? G.stake : 0, c = G.caster;
    let k = 0; const spots = [];
    for (let i = 0; i < G.purse[0] - (c === 0 ? staked : 0); i++) spots.push(this.coinSpot(0, i));
    for (let i = 0; i < G.purse[1] - (c === 1 ? staked : 0); i++) spots.push(this.coinSpot(1, i));
    for (let i = 0; i < staked; i++) spots.push(this.potSpot(i));
    coins.forEach((m, i) => { const to = spots[i]; if (!to) { m.visible = false; return; } m.visible = true; if (instant || m.position.distanceTo(to) < 0.001) m.position.copy(to); else jobs.push(hop(m, to, 0.35, 0.04)); k++; });
    return Promise.all(jobs);
  },
  meshesFor: () => [],
  ringFor: () => null,
  fromFor: () => null,
  async throwDice(faces) {
    const G = GAMES.hazard, dice = this.ex.pieces.dice;
    await Promise.all(dice.map((d, k) => {
      const to = V3(-0.08 + k * 0.12 + (Math.random() - 0.5) * 0.04, G.surface + 0.0225, (Math.random() - 0.5) * 0.08);
      const [rx, , rz] = HZ_UP[faces[k]], spin = Math.random() * TAU, from = d.position.clone(), r0 = d.rotation.clone();
      return tween(0.55, t => {
        d.position.lerpVectors(from, to, t); d.position.y += Math.sin(t * Math.PI) * 0.06;
        d.rotation.set(r0.x + (rx - r0.x) * t + (1 - t) * 6 * t, spin * t, r0.z + (rz - r0.z) * t);
      });
    }));
    dice.forEach((d, k) => { const [rx, , rz] = HZ_UP[faces[k]]; d.rotation.set(rx, d.rotation.y, rz); });
  },
  async play(m) {
    const G = GAMES.hazard, tok = play.token;
    if (m.kind === 'throw' && m.faces) await this.throwDice(m.faces);
    if (tok !== play.token) return { note: '' };
    const res = G.apply(m);
    await this.layCoins(false);
    return res;
  },
  score: () => { const G = GAMES.hazard; return [['You', G.purse[0]], ['Scribe', G.purse[1]], `shillings · main ${Math.min(G.rounds + 1, G.ROUNDS)} of ${G.ROUNDS}`]; },
};
