  /* ------------------------------------------------------------ Dots and Boxes
   * A 4 x 4 grid of boxes between 5 x 5 dots. Edges 0-19 are horizontal (row r
   * of dots 0-4, column c 0-3, index r*4+c); 20-39 are vertical (box row r 0-3,
   * dot column c 0-4, index 20 + r*5+c). Box (r, c) is index r*4+c. */
  // The grid size can change (4 x 4 or 5 x 5 boxes), so these tables are rebuilt by dbBuild().
  let DB_N, DB_EDGES, DB_BOX_EDGES, DB_EDGE_BOXES;
  function dbBuild(n) {
    DB_N = n;
    const dbH = (r, c) => r * n + c, dbV = (r, c) => n * (n + 1) + r * (n + 1) + c;
    DB_EDGES = 2 * n * (n + 1);
    DB_BOX_EDGES = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) DB_BOX_EDGES.push([dbH(r, c), dbH(r + 1, c), dbV(r, c), dbV(r, c + 1)]);
    DB_EDGE_BOXES = Array.from({ length: DB_EDGES }, () => []);
    DB_BOX_EDGES.forEach((es, b) => es.forEach(e => DB_EDGE_BOXES[e].push(b)));
  }
  dbBuild(4);
  const DOTSBOXES = {
    id: 'dotsboxes', name: 'Dots and Boxes', dice: false, first: 0, N: DB_N, EDGES: DB_EDGES,
    BOX_EDGES: DB_BOX_EDGES, EDGE_BOXES: DB_EDGE_BOXES,
    variants: [{ id: '4', label: '4 × 4' }, { id: '5', label: '5 × 5' }],
    variant: '4',
    setVariant(id) {
      const n = id === '5' ? 5 : 4;
      dbBuild(n); this.variant = String(n);
      this.N = DB_N; this.EDGES = DB_EDGES; this.BOX_EDGES = DB_BOX_EDGES; this.EDGE_BOXES = DB_EDGE_BOXES;
    },
    rules: [
      'Take turns drawing a line between two neighbouring dots, across or up and down.',
      'Close the fourth side of a box and it is yours: you score it and draw again.',
      'When every line is drawn, the player with more boxes wins.',
      'A tip: try not to draw the third side of a box, unless you have to.'
    ],
    source: 'The rules Édouard Lucas published as "la pipopipette", here on a grid of sixteen boxes.',
    followPrompt: 'You closed a box, so draw another line.',
    init() { this.drawn = Array(DB_EDGES).fill(false); this.by = Array(DB_EDGES).fill(-1); this.owner = Array(DB_N * DB_N).fill(-1); this.score = [0, 0]; },
    sides(b) { let n = 0; for (const e of DB_BOX_EDGES[b]) if (this.drawn[e]) n++; return n; },
    gain(e) { let n = 0; for (const b of DB_EDGE_BOXES[e]) if (this.sides(b) === 3) n++; return n; },
    gift(e) { let n = 0; for (const b of DB_EDGE_BOXES[e]) if (this.sides(b) === 2) n++; return n; },
    left() { let n = 0; for (const d of this.drawn) if (!d) n++; return n; },
    legal(pl) { const out = []; for (let e = 0; e < DB_EDGES; e++) if (!this.drawn[e]) out.push({ pl, e }); return out; },
    apply(m) {
      this.drawn[m.e] = true; if (this.by) this.by[m.e] = m.pl; // who drew it, so a resumed table can colour it
      const boxes = [];
      for (const b of DB_EDGE_BOXES[m.e]) if (this.sides(b) === 4 && this.owner[b] < 0) { this.owner[b] = m.pl; this.score[m.pl]++; boxes.push(b); }
      let note = '';
      if (boxes.length) note = m.pl === 0 ? (boxes.length > 1 ? 'Two boxes for you.' : 'A box for you.') : (boxes.length > 1 ? 'The Scribe closes two boxes.' : 'The Scribe closes a box.');
      const followUp = boxes.length && this.left() ? this.legal(m.pl) : null;
      return { boxes, note, followUp };
    },
    result() {
      if (this.left()) return null;
      const [a, b] = this.score;
      return { winner: a > b ? 0 : b > a ? 1 : -1, text: a === b ? `${a} boxes each. The game is drawn.` : `Final count: you ${a} boxes, the Scribe ${b}.` };
    },
    snapshot() { return [this.drawn.slice(), this.owner.slice(), this.score.slice()]; },
    restore(s) { this.drawn = s[0].slice(); this.owner = s[1].slice(); this.score = s[2].slice(); },
    // Exact endgame: the best final margin for the player to move, over the remaining edges.
    solve(budgetMs) {
      const edges = []; for (let e = 0; e < DB_EDGES; e++) if (!this.drawn[e]) edges.push(e);
      const k = edges.length, memo = new Map(), stop = Date.now() + budgetMs;
      const sides = this.drawn.slice();
      const gainOf = (e) => { let n = 0; for (const b of DB_EDGE_BOXES[e]) { let s = 0; for (const x of DB_BOX_EDGES[b]) if (sides[x]) s++; if (s === 3) n++; } return n; };
      let nodes = 0;
      const f = (mask) => {
        if (mask === (1 << k) - 1) return 0;
        const hit = memo.get(mask); if (hit !== undefined) return hit;
        if ((++nodes & 1023) === 0 && Date.now() > stop) throw OUT_OF_TIME;
        let best = -Infinity;
        for (let j = 0; j < k; j++) {
          if (mask & (1 << j)) continue;
          const e = edges[j], g = gainOf(e);
          sides[e] = true;
          const v = g ? g + f(mask | (1 << j)) : -f(mask | (1 << j));
          sides[e] = false;
          if (v > best) best = v;
        }
        memo.set(mask, best); return best;
      };
      // Pick the edge with the best value, preferring captures on ties.
      let pickE = -1, pickV = -Infinity;
      for (let j = 0; j < k; j++) {
        const e = edges[j], g = gainOf(e);
        sides[e] = true;
        const v = g ? g + f(1 << j) : -f(1 << j);
        sides[e] = false;
        if (v > pickV || (v === pickV && g)) { pickV = v; pickE = e; }
      }
      return pickE;
    },
    // One move for the player to move, by level.
    pickEdge(budget = BUDGET_MS[LEVEL.name]) {
      const free = []; for (let e = 0; e < DB_EDGES; e++) if (!this.drawn[e]) free.push(e);
      const rnd = a => a[(Math.random() * a.length) | 0];
      const takes = free.filter(e => this.gain(e) > 0), safe = free.filter(e => !this.gain(e) && !this.gift(e));
      if (LEVEL.name === 'gentle') {
        if (takes.length && Math.random() < 0.75) return rnd(takes);
        if (safe.length && Math.random() < 0.7) return rnd(safe);
        return rnd(free);
      }
      const limit = LEVEL.name === 'sharp' ? 22 : 15;
      if (free.length <= limit && !safe.length && budget > 40) {
        try { return this.solve(budget); } catch (e) { if (e !== OUT_OF_TIME) throw e; }
      }
      if (takes.length) return takes[0];
      if (safe.length) return rnd(safe);
      // Every line gives boxes away: give away as few as possible.
      let best = free[0], bestLoss = Infinity;
      for (const e of free) {
        const s = this.snapshot(); this.drawn[e] = true;
        let loss = 0, again = true;
        while (again) { again = false; for (let x = 0; x < DB_EDGES; x++) if (!this.drawn[x] && this.gain(x)) { loss += this.gain(x); this.drawn[x] = true; again = true; } }
        this.restore(s);
        if (loss < bestLoss) { bestLoss = loss; best = e; }
      }
      return best;
    },
    aiPlan(pl) {
      const s = this.snapshot(), plan = [], t0 = Date.now(), budget = BUDGET_MS[LEVEL.name];
      for (;;) {
        if (!this.left()) break;
        // Every line in a turn shares the level's thinking budget.
        const m = { pl, e: this.pickEdge(budget - (Date.now() - t0)) };
        plan.push(m);
        const r = this.apply(m);
        if (!r.followUp) break;
      }
      this.restore(s);
      return plan;
    },
  };

