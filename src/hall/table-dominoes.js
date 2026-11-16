const DOMINOES_P = {
  camW: 1.2, ringScale: 0.55,
  intro() { return 'You lead first, with any tile. ' + this.prompt(); },
  prompt() {
    const G = GAMES.dominoes;
    if (!G.ends) return 'Click any tile in your hand to lead.';
    const ms = G.legal(0);
    if (ms[0] && ms[0].kind === 'draw') return `Open ends: ${G.ends[0]} and ${G.ends[1]}. Nothing in your hand fits, so draw from the boneyard.`;
    if (ms[0] && ms[0].kind === 'pass') return `Open ends: ${G.ends[0]} and ${G.ends[1]}. Nothing fits and only two tiles are left in the boneyard, so you pass.`;
    return `Open ends: ${G.ends[0]} and ${G.ends[1]}. Click a glowing tile to play it; if it fits both ends, pick the ring.`;
  },
  SP: DM_L + 0.004, ROW: 0.07,
  // Where the k-th tile out from the first one sits: rows of six, snaking back and forth.
  arm(k) {
    if (k === 0) return { x: 0, z: 0, dir: 1 };
    const sg = k > 0 ? 1 : -1, j = Math.abs(k), SP = this.SP;
    if (j <= 6) return { x: sg * j * SP, z: 0, dir: sg };
    if (j <= 12) return { x: sg * (6.5 - (j - 6)) * SP, z: -sg * this.ROW, dir: -sg };
    return { x: sg * (0.5 + (j - 12)) * SP, z: -sg * 2 * this.ROW, dir: sg };
  },
  setup(ex) {
    const G = GAMES.dominoes;
    ex.group.userData.display.forEach(m => { m.visible = false; });
    if (!ex.tiles) ex.tiles = Array.from({ length: 28 }, (_, t) => { const m = dmTile(t); ex.group.add(m); return m; });
    this.ex = ex; this.left = 0;
    ex.tiles.forEach(m => { m.visible = true; m.rotation.set(0, 0, 0); });
    G.yard.forEach((t, k) => { const m = ex.tiles[t]; m.rotation.set(Math.PI, Math.PI / 2, 0); m.position.copy(this.yardPos(k)); });
    this.layHands(false);
  },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (ex.tiles || []).forEach(m => { m.visible = false; }); },
  yardPos(k) { return V3(0.49 + (k % 2) * (DM_Wd + 0.008), GAMES.dominoes.surface + DM_H / 2, -0.25 + ((k / 2) | 0) * (DM_L + 0.006)); },
  handPos(pl, k, n) {
    const per = 13, row = (k / per) | 0, kk = k % per, m = Math.min(n - row * per, per), sp = DM_L + 0.005;
    return V3(-0.04 + (kk - (m - 1) / 2) * sp, GAMES.dominoes.surface + DM_Wd / 2, (pl === 0 ? 1 : -1) * (0.36 - row * 0.055));
  },
  async layHands(animate) {
    const G = GAMES.dominoes, jobs = [];
    for (const pl of [0, 1]) {
      const h = G.hands[pl].slice().sort((x, y) => x - y);
      h.forEach((t, k) => {
        const m = this.ex.tiles[t], to = this.handPos(pl, k, h.length);
        m.rotation.set(pl === 0 ? Math.PI / 2 - 0.35 : -Math.PI / 2 + 0.35, 0, 0);
        if (animate) jobs.push(hop(m, to, 0.25, 0.02)); else m.position.copy(to);
      });
    }
    await Promise.all(jobs);
  },
  linePos(k) { const a = this.arm(k); return V3(a.x, GAMES.dominoes.surface + DM_H / 2, a.z); },
  meshesFor(m) { return m.kind === 'play' ? [this.ex.tiles[m.t]] : []; },
  ringFor(m) {
    if (m.kind !== 'play') return null;
    const G = GAMES.dominoes;
    if (!G.ends) return this.linePos(0).setY(GAMES.dominoes.surface);
    const k = m.side === 0 ? -(this.left + 1) : G.line.length - this.left;
    return this.linePos(k).setY(GAMES.dominoes.surface);
  },
  async play(m) {
    const G = GAMES.dominoes, tok = play.token;
    const k = m.kind === 'play' ? (!G.ends ? 0 : m.side === 0 ? -(this.left + 1) : G.line.length - this.left) : null;
    const res = G.apply(m);
    if (m.kind === 'draw') {
      const tile = this.ex.tiles[res.drew];
      tile.rotation.set(m.pl === 0 ? Math.PI / 2 - 0.35 : -Math.PI / 2 + 0.35, 0, 0);
      await this.layHands(true);
      return res;
    }
    if (m.kind !== 'play') return res;
    if (m.side === 0 && k !== 0) this.left++;
    const tile = this.ex.tiles[m.t], a = this.arm(k), [lo] = G.TILES[m.t];
    // Turn the tile so the half that joins the line faces back along it.
    const pl = res.placed, inner = k === 0 ? pl.l : k > 0 ? pl.l : pl.r, outer = k === 0 ? pl.r : k > 0 ? pl.r : pl.l;
    const atMinusX = a.dir > 0 ? inner : outer;
    const rotY = atMinusX === lo ? 0 : Math.PI;
    const from = tile.rotation.clone(), to = this.linePos(k);
    const p0 = tile.position.clone();
    await tween(0.35, e => {
      tile.position.lerpVectors(p0, to, e); tile.position.y += Math.sin(e * Math.PI) * 0.05;
      tile.rotation.set(from.x * (1 - e), from.y + (rotY - from.y) * e, 0);
    }, e => e);
    if (tok !== play.token) return res;
    await this.layHands(true);
    return res;
  },
  score: () => { const G = GAMES.dominoes; return [['You', G.hands[0].length], ['Scribe', G.hands[1].length], `tiles · ${G.yard.length} in the boneyard`]; },
};
