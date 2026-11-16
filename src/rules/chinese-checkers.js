  /* --------------------------------------------------------- Chinese checkers
   * Stern-Halma's star of 121 holes, in cube coordinates (x + y + z = 0): the
   * union of two big triangles. The visitor starts in the point nearest them
   * (z > 4) and races for the far point (z < -4); the Scribe the other way. */
  const CC_CELLS = [], CC_AT = new Map();
  for (let x = -8; x <= 8; x++) for (let y = -8; y <= 8; y++) {
    const z = -x - y; if (z < -8 || z > 8) continue;
    if ((x <= 4 && y <= 4 && z <= 4) || (x >= -4 && y >= -4 && z >= -4)) { CC_AT.set(x + ',' + y, CC_CELLS.length); CC_CELLS.push([x, y, z]); }
  }
  const CC_DIRS = [[1, -1, 0], [-1, 1, 0], [1, 0, -1], [-1, 0, 1], [0, 1, -1], [0, -1, 1]];
  const ccAt = (x, y) => { const k = CC_AT.get(x + ',' + y); return k === undefined ? -1 : k; };
  const CC_NB = CC_CELLS.map(([x, y]) => CC_DIRS.map(([dx, dy]) => ccAt(x + dx, y + dy)));
  const CC_JUMP = CC_CELLS.map(([x, y]) => CC_DIRS.map(([dx, dy]) => ccAt(x + 2 * dx, y + 2 * dy)));
  const CC_CAMP = [CC_CELLS.map((c, i) => (c[2] > 4 ? i : -1)).filter(i => i >= 0), CC_CELLS.map((c, i) => (c[2] < -4 ? i : -1)).filter(i => i >= 0)];
  const CC_GOAL = [0, 1].map(pl => { const a = new Uint8Array(CC_CELLS.length); CC_CAMP[1 - pl].forEach(i => { a[i] = 1; }); return a; });
  // Rows still to travel, plus a little for straying into a side point of the star.
  const ccDist = (pl, i) => { const [x, y, z] = CC_CELLS[i]; return (pl === 0 ? z : -z) + 8 + 0.5 * Math.max(0, Math.max(Math.abs(x), Math.abs(y)) - 4); };
  const CC_LIMIT = 300;
  const CHINESE = {
    id: 'chinese', name: 'Chinese checkers', dice: false, first: 0, CELLS: CC_CELLS, CAMP: CC_CAMP, GOAL: CC_GOAL, N: CC_CELLS.length,
    rules: [
      'You play red, from the point of the star nearest you, and move first. Move all ten of your marbles into the far point before the Scribe fills yours.',
      'A marble steps to an empty hole next to it, in any of six directions.',
      'Or it hops: over one marble next to it, of either colour, into the empty hole just beyond. Nothing is captured, and it may keep hopping in the same turn, as far as the chain goes. A move is a step or a chain of hops, never both.',
      'You win when all your marbles are in the far point. If the far point is full and at least one marble in it is yours, you win too, so no one can block by staying home.',
      'House rule: after a hundred and fifty moves each, whoever has more marbles home wins, then whoever is closer overall.'
    ],
    source: 'Stern-Halma, the star Halma Ravensburger published in 1892, for two players with ten marbles each. The rule against blocking a point by staying home is a common modern addition.',
    init() { const b = new Uint8Array(CC_CELLS.length); CC_CAMP[0].forEach(i => { b[i] = 1; }); CC_CAMP[1].forEach(i => { b[i] = 2; }); this.b = b; this.ply = 0; },
    home(pl) { let n = 0; for (const i of CC_CAMP[1 - pl]) if (this.b[i] === pl + 1) n++; return n; },
    men(pl) { const out = []; for (let i = 0; i < this.b.length; i++) if (this.b[i] === pl + 1) out.push(i); return out; },
    reach(i) {
      const b = this.b, pl = b[i] - 1, out = [];
      for (const j of CC_NB[i]) if (j >= 0 && !b[j]) out.push({ pl, from: i, to: j, path: [j] });
      b[i] = 0;
      const seen = new Set([i]), queue = [[i, []]];
      while (queue.length) {
        const [at, path] = queue.shift();
        for (let d = 0; d < 6; d++) {
          const mid = CC_NB[at][d], land = CC_JUMP[at][d];
          if (mid < 0 || land < 0 || !b[mid] || b[land] || seen.has(land)) continue;
          seen.add(land);
          const np = path.concat([land]);
          out.push({ pl, from: i, to: land, path: np, hop: true });
          queue.push([land, np]);
        }
      }
      b[i] = pl + 1;
      return out;
    },
    legal(pl) { if (this.winner() !== null) return []; const out = []; for (const i of this.men(pl)) out.push(...this.reach(i)); return out; },
    apply(m) {
      if (m.pass) { this.ply++; return { note: '' }; }
      const was = CC_GOAL[m.pl][m.from];
      this.b[m.from] = 0; this.b[m.to] = m.pl + 1; this.ply++;
      const parts = [];
      if (m.hop && m.path.length > 1) parts.push(m.pl === 0 ? `You hop ${m.path.length} times.` : `The Scribe hops ${m.path.length} times.`);
      if (!was && CC_GOAL[m.pl][m.to]) { const n = this.home(m.pl); parts.push(m.pl === 0 ? `${n} of your marbles ${n === 1 ? 'is' : 'are'} home.` : `${n} of the Scribe's marbles ${n === 1 ? 'is' : 'are'} home.`); }
      return { note: parts.join(' ') };
    },
    winner() {
      for (const pl of [0, 1]) { const n = this.home(pl); if (n === 10) return pl; if (n && CC_CAMP[1 - pl].every(i => this.b[i])) return pl; }
      return null;
    },
    total(pl) { let d = 0; for (const i of this.men(pl)) d += ccDist(pl, i); return d; },
    skipTurn(pl) { if (this.winner() !== null || this.legal(pl).length || !this.legal(1 - pl).length) return ''; return pl === 0 ? 'Your marbles are boxed in, so you pass.' : 'The Scribe\'s marbles are boxed in, and it passes.'; },
    result() {
      const w = this.winner();
      if (w !== null) return { winner: w, text: w === 0 ? (this.home(0) === 10 ? 'All your marbles reached the far point.' : 'The far point is full, and your marbles are in it.') : (this.home(1) === 10 ? 'All the Scribe\'s marbles reached your point.' : 'Your point is full, and the Scribe\'s marbles are in it.') };
      if (this.ply >= CC_LIMIT || (!this.legal(0).length && !this.legal(1).length)) {
        const a = this.home(0), b = this.home(1), da = this.total(0), db = this.total(1);
        const winner = a !== b ? (a > b ? 0 : 1) : Math.abs(da - db) > 1e-9 ? (da < db ? 0 : 1) : -1;
        return { winner, text: a !== b ? `A hundred and fifty moves each. Marbles home: you ${a}, the Scribe ${b}.` : winner < 0 ? 'A hundred and fifty moves each, dead level. The game is drawn.' : `A hundred and fifty moves each, ${a} home apiece; ${winner === 0 ? 'yours are' : 'the Scribe\'s are'} closer.` };
      }
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply]; },
    restore(s) { this.b = s[0].slice(); this.ply = s[1]; },
    turns(pl) {
      const ms = this.legal(pl);
      if (!ms.length) return [[{ pl, pass: true }]];
      const gain = m => ccDist(pl, m.from) - ccDist(pl, m.to) + (CC_GOAL[pl][m.to] && !CC_GOAL[pl][m.from] ? 1.5 : 0) - (CC_GOAL[pl][m.from] && !CC_GOAL[pl][m.to] ? 3 : 0);
      ms.sort((x, y) => gain(y) - gain(x));
      return ms.slice(0, 30).map(m => [m]);
    },
    terminal(pl, depth) {
      const w = this.winner();
      if (w !== null) return w === pl ? 1000 + depth : -1000 - depth;
      if (this.ply >= CC_LIMIT) return (this.home(pl) - this.home(1 - pl)) * 50 + (this.total(1 - pl) - this.total(pl));
      return null;
    },
    score(pl) { let s = 0; for (let i = 0; i < this.b.length; i++) if (this.b[i] === pl + 1) { const d = ccDist(pl, i); s -= d + 0.06 * d * d; if (CC_GOAL[pl][i]) s += 2; } return s; },
    evaluate(pl) { return this.score(pl) - this.score(1 - pl); },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 3); },
  };

