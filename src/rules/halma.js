  /* -------------------------------------------------------------------- Halma
   * A 16 x 16 board, index r*16+c, row 0 nearest the visitor. Each camp is the
   * 19 squares of a corner (rows of 5, 5, 4, 3 and 2): the visitor's at (0, 0),
   * the Scribe's at (15, 15). b holds 0 empty, 1 visitor, 2 Scribe. */
  const HM_N = 16, HM_MEN = 19;
  const HM_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const HM_CAMP = [[], []];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (r + c <= 5) { HM_CAMP[0].push(r * HM_N + c); HM_CAMP[1].push((15 - r) * HM_N + (15 - c)); }
  // HM_GOAL[pl][i] is 1 when square i is in the camp pl is racing to.
  const HM_GOAL = [0, 1].map(pl => { const a = new Uint8Array(256); HM_CAMP[1 - pl].forEach(i => { a[i] = 1; }); return a; });
  // How far square i is from pl's far corner, counted in diagonal rows.
  const hmDist = (pl, i) => { const r = i >> 4, c = i & 15; return pl === 0 ? 30 - r - c : r + c; };
  const HM_LIMIT = 400; // plies: two hundred moves each
  const HALMA = {
    id: 'halma', name: 'Halma', dice: false, first: 0, N: HM_N, CAMP: HM_CAMP, GOAL: HM_GOAL,
    rules: [
      'You play red and move first. Move all 19 of your men into the Scribe\'s camp in the far corner before the Scribe fills yours.',
      'A man steps to any empty square next to it, across, up or down, or diagonally.',
      'Or it leaps: over one piece next to it, of either colour, onto the empty square just beyond. Nothing is captured, and a man may keep leaping in the same turn, as far as the chain goes.',
      'A man that reaches the far camp may move inside it but may not leave it again.',
      'You win when all your men are in the far camp. If the far camp is full and at least one man in it is yours, you win too, so no one can block a camp by staying home.',
      'House rule: after two hundred moves each, whoever has more men home wins, then whoever is closer overall.'
    ],
    source: 'Two-player Halma as published by George Howard Monks in 1884, with the modern rule against blocking a camp.',
    init() {
      const b = new Uint8Array(256);
      HM_CAMP[0].forEach(i => { b[i] = 1; }); HM_CAMP[1].forEach(i => { b[i] = 2; });
      this.b = b; this.ply = 0;
    },
    home(pl) { let n = 0; for (const i of HM_CAMP[1 - pl]) if (this.b[i] === pl + 1) n++; return n; },
    men(pl) { const out = []; for (let i = 0; i < 256; i++) if (this.b[i] === pl + 1) out.push(i); return out; },
    // Every square the man on i can end on, with the path that gets there.
    reach(i) {
      const b = this.b, pl = b[i] - 1, locked = HM_GOAL[pl][i], out = [];
      const r0 = i >> 4, c0 = i & 15;
      for (const [dr, dc] of HM_DIRS) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || r > 15 || c < 0 || c > 15) continue;
        const j = r * 16 + c;
        if (!b[j] && (!locked || HM_GOAL[pl][j])) out.push({ pl, from: i, to: j, path: [j] });
      }
      // Leaps: a search over landing squares, with the man lifted off its square.
      b[i] = 0;
      const seen = new Set([i]), queue = [[i, []]];
      while (queue.length) {
        const [at, path] = queue.shift(), r1 = at >> 4, c1 = at & 15;
        for (const [dr, dc] of HM_DIRS) {
          const mr = r1 + dr, mc = c1 + dc, lr = r1 + 2 * dr, lc = c1 + 2 * dc;
          if (lr < 0 || lr > 15 || lc < 0 || lc > 15) continue;
          const land = lr * 16 + lc;
          if (!b[mr * 16 + mc] || b[land] || seen.has(land)) continue;
          seen.add(land);
          const np = path.concat([land]);
          if (!locked || HM_GOAL[pl][land]) out.push({ pl, from: i, to: land, path: np });
          queue.push([land, np]);
        }
      }
      b[i] = pl + 1;
      return out;
    },
    legal(pl) {
      if (this.winner() !== null) return [];
      const out = [];
      for (const i of this.men(pl)) out.push(...this.reach(i));
      return out;
    },
    apply(m) {
      if (m.pass) { this.ply++; return { note: '' }; }
      const wasHome = HM_GOAL[m.pl][m.from];
      this.b[m.from] = 0; this.b[m.to] = m.pl + 1; this.ply++;
      const leaps = Math.max(Math.abs((m.path[0] >> 4) - (m.from >> 4)), Math.abs((m.path[0] & 15) - (m.from & 15))) === 2 ? m.path.length : 0;
      const parts = [];
      if (leaps > 1) parts.push(m.pl === 0 ? `You leap ${leaps} times.` : `The Scribe leaps ${leaps} times.`);
      if (!wasHome && HM_GOAL[m.pl][m.to]) {
        const n = this.home(m.pl);
        parts.push(m.pl === 0 ? `${n} of your men ${n === 1 ? 'is' : 'are'} home.` : `${n} of the Scribe's men ${n === 1 ? 'is' : 'are'} home.`);
      }
      return { note: parts.join(' ') };
    },
    winner() {
      for (const pl of [0, 1]) {
        const n = this.home(pl);
        if (n === HM_MEN) return pl;
        if (n && HM_CAMP[1 - pl].every(i => this.b[i])) return pl;
      }
      return null;
    },
    total(pl) { let d = 0; for (const i of this.men(pl)) d += hmDist(pl, i); return d; },
    skipTurn(pl) {
      if (this.winner() !== null || this.legal(pl).length || !this.legal(1 - pl).length) return '';
      return pl === 0 ? 'Your men are boxed in, so you pass.' : 'The Scribe\'s men are boxed in, and it passes.';
    },
    result() {
      const w = this.winner();
      if (w !== null) return { winner: w, text: w === 0 ? (this.home(0) === HM_MEN ? 'All your men reached the Scribe\'s camp.' : 'The Scribe\'s camp is full, and your men are in it.') : (this.home(1) === HM_MEN ? 'All the Scribe\'s men reached your camp.' : 'Your camp is full, and the Scribe\'s men are in it.') };
      if (this.ply >= HM_LIMIT || (!this.legal(0).length && !this.legal(1).length)) {
        const a = this.home(0), b = this.home(1), da = this.total(0), db = this.total(1);
        const winner = a !== b ? (a > b ? 0 : 1) : da !== db ? (da < db ? 0 : 1) : -1;
        const text = a !== b ? `Two hundred moves each. Men home: you ${a}, the Scribe ${b}.` : winner < 0 ? 'Two hundred moves each, dead level. The game is drawn.' : `Two hundred moves each, ${a} men home apiece; ${winner === 0 ? 'yours are' : 'the Scribe\'s are'} closer to home.`;
        return { winner, text };
      }
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply]; },
    restore(s) { this.b = s[0].slice(); this.ply = s[1]; },
    turns(pl) {
      const ms = this.legal(pl);
      if (!ms.length) return [[{ pl, pass: true }]];
      const gain = m => hmDist(pl, m.from) - hmDist(pl, m.to) + (HM_GOAL[pl][m.to] && !HM_GOAL[pl][m.from] ? 2 : 0);
      ms.sort((x, y) => gain(y) - gain(x));
      return ms.slice(0, 36).map(m => [m]);
    },
    terminal(pl, depth) {
      const w = this.winner();
      if (w !== null) return w === pl ? 1000 + depth : -1000 - depth;
      if (this.ply >= HM_LIMIT) { const d = this.home(pl) - this.home(1 - pl); return d * 50 + (this.total(1 - pl) - this.total(pl)); }
      return null;
    },
    // Distance still to travel, squared a little so no man is left behind.
    score(pl) {
      let s = 0;
      for (let i = 0; i < 256; i++) if (this.b[i] === pl + 1) { const d = hmDist(pl, i); s -= d + 0.05 * d * d; if (HM_GOAL[pl][i]) s += 3; }
      return s;
    },
    evaluate(pl) { return this.score(pl) - this.score(1 - pl); },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 3); },
  };

