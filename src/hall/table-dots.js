
const DOTS_P = {
  camW: 0.98, get ringScale() { return 0.9 * 4 / dbN(); },
  intro() { return this.prompt(); },
  prompt: () => 'Choose a ring to draw a line between two dots.',
  setup(ex) {
    const G = GAMES.dotsboxes, n = G.N, d = ex.group.userData.dots;
    DB_S = DB_SPAN / n;
    d.maps[n] = d.maps[n] || dbPaper(n); d.paper.material.map = d.maps[n]; d.paper.material.needsUpdate = true;
    if (ex.pieces && ex.pieces.n !== n) { // a new grid size: throw away the old lines and boxes
      [...ex.pieces.lines, ...ex.pieces.boxes].forEach(m => { ex.group.remove(m); m.geometry.dispose(); });
      ex.pieces = null;
    }
    if (!ex.pieces) {
      const lineGeo = new THREE.BoxGeometry(DB_S - 0.02, 0.004, 0.008), boxGeo = new THREE.PlaneGeometry(DB_S - 0.03, DB_S - 0.03);
      ex.pieces = {
        n,
        lines: Array.from({ length: G.EDGES }, (_, e) => {
          const m = new THREE.Mesh(lineGeo, dbLineMats[0]); const mid = dbEdgeMid(e);
          m.position.copy(mid.pos); m.position.y = G.surface + 0.002; if (!mid.horiz) m.rotation.y = Math.PI / 2;
          m.visible = false; ex.group.add(m); return m;
        }),
        boxes: Array.from({ length: G.N * G.N }, (_, b) => {
          const r = (b / G.N) | 0, c = b % G.N;
          const m = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xd4a23a, transparent: true, opacity: 0, depthWrite: false }));
          m.rotation.x = -Math.PI / 2; m.position.set((c - (n - 1) / 2) * DB_S, G.surface + 0.001, (r - (n - 1) / 2) * DB_S);
          m.visible = false; ex.group.add(m); return m;
        }),
      };
    }
    this.ex = ex;
    ex.pieces.lines.forEach(l => { l.visible = false; l.scale.set(1, 1, 1); });
    ex.pieces.boxes.forEach(b => { b.visible = false; b.material.opacity = 0; });
    // Rebuilt from the engine, for a game taken back or resumed.
    G.drawn.forEach((on, e) => { if (!on) return; const l = ex.pieces.lines[e]; l.material = dbLineMats[Math.max(0, (G.by || [])[e] || 0)]; l.visible = true; });
    G.owner.forEach((pl, b) => { if (pl < 0) return; const f = ex.pieces.boxes[b]; f.visible = true; f.material.color.setHex(pl === 0 ? 0xd4a23a : 0x5a7aaa); f.material.opacity = 0.55; });
  },
  meshesFor() { return []; },
  ringFor(m) { const p = dbEdgeMid(m.e).pos; return V3(p.x, GAMES.dotsboxes.surface, p.z); },
  async play(m) {
    const G = GAMES.dotsboxes, P = this.ex.pieces;
    const res = G.apply(m);
    const line = P.lines[m.e]; line.material = dbLineMats[m.pl]; line.visible = true;
    await tween(0.2, k => { line.scale.set(Math.max(0.01, k), 1, 1); });
    for (const b of res.boxes) {
      const f = P.boxes[b]; f.visible = true; f.material.color.setHex(m.pl === 0 ? 0xd4a23a : 0x5a7aaa);
      await tween(0.3, k => { f.material.opacity = 0.55 * k; });
    }
    return res;
  },
  score: () => { const G = GAMES.dotsboxes; return [['You', G.score[0]], ['Scribe', G.score[1]], `boxes of ${G.N * G.N}`]; },
};
