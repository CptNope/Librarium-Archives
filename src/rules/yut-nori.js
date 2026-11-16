  /* ---------------------------------------------------------------- Yut Nori
   * 29 stations. The outer square is 0-19, run anticlockwise from the start
   * corner 0 (near right): corners at 5 (far right), 10 (far left) and 15
   * (near left). The diagonal from 5 to 15 is 20, 21, centre 22, 23, 24; the
   * diagonal from 10 to 0 is 25, 26, 22, 27, 28. A piece off the board is -1,
   * a piece home is YT_HOME. A piece that STARTS its move on a corner or the
   * centre takes the shortcut. */
  const YT_HOME = 29;
  const YT_NAMES = ['mo', 'do', 'gae', 'geol', 'yut'];
  function ytRoute(s) {
    const tail = a => a.concat([YT_HOME]);
    const outer = from => { const r = []; for (let k = from + 1; k <= 19; k++) r.push(k); return tail(r.concat([0])); };
    if (s === -1) return outer(0);
    if (s === 0) return [YT_HOME];
    if (s === 5) return [20, 21, 22, 23, 24].concat(outer(14).slice(0));
    if (s === 10) return tail([25, 26, 22, 27, 28, 0]);
    if (s === 22) return tail([27, 28, 0]);
    if (s === 20 || s === 21) return [20, 21, 22, 23, 24].slice(s - 19).concat(outer(14));
    if (s === 23 || s === 24) return [24].slice(s - 23).concat(outer(14));
    if (s === 25 || s === 26) return tail([26, 22, 27, 28, 0].slice(s - 25));
    if (s === 27 || s === 28) return tail([28, 0].slice(s - 27));
    return outer(s);
  }
  const YUT = {
    id: 'yut', name: 'Yut Nori', dice: true, N: 4, first: 0, sides: ['red pieces', 'blue pieces'], HOME: YT_HOME, route: ytRoute,
    rules: [
      'Throw the four sticks and count the flat sides that land up: one is do (1 step), two gae (2), three geol (3), four yut (4), and none is mo (5).',
      'Enter a new piece or move one already on the board, anticlockwise from the start corner near you on the right.',
      'A piece that starts its move on a corner or on the centre takes the shortcut across the board instead.',
      'Land on your own piece and they stack, moving together from then on. Land on the Scribe\'s and they all go back off the board.',
      'Throwing yut or mo, or capturing, earns another throw. A piece goes home when it moves past the start corner. Bring all four home first to win.'
    ],
    source: 'Common modern rules for two sides. Each throw is moved at once rather than saved up, and there is no back-do.',
    init() { this.pos = [[-1, -1, -1, -1], [-1, -1, -1, -1]]; },
    roll() { const f = [0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0)); const n = f.reduce((a, b) => a + b, 0); return { faces: f, value: n || 5 }; },
    rollName: r => `${YT_NAMES[r.value % 5]} (${r.value})`,
    legal(pl, v) {
      const moves = [], seen = new Set();
      this.pos[pl].forEach((p, i) => {
        if (p === YT_HOME) return;
        const key = p === -1 ? 'off' : p; if (seen.has(key)) return; seen.add(key);
        const route = ytRoute(p), path = route.slice(0, v);
        const to = path[path.length - 1];
        const group = p === -1 ? [i] : this.pos[pl].map((q, k) => (q === p ? k : -1)).filter(k => k >= 0);
        const cap = to === YT_HOME ? [] : this.pos[1 - pl].map((q, k) => (q === to ? k : -1)).filter(k => k >= 0);
        moves.push({ pl, i, from: p, to, path, group, cap, value: v });
      });
      return moves;
    },
    steps(m) { return m.path; },
    apply(m) {
      const moved = [];
      for (const k of m.group) { this.pos[m.pl][k] = m.to; if (k !== m.i) moved.push({ pl: m.pl, i: k }); }
      for (const k of m.cap) { this.pos[1 - m.pl][k] = -1; moved.push({ pl: 1 - m.pl, i: k }); }
      // Pieces already waiting on the landing station join the stack where they are.
      let note = '';
      if (m.cap.length) note = m.pl === 0 ? `Caught! ${m.cap.length > 1 ? 'The Scribe\'s stack goes' : 'The Scribe\'s piece goes'} back off the board.` : `The Scribe catches ${m.cap.length > 1 ? 'your stack' : 'your piece'}.`;
      else if (m.to === YT_HOME) note = m.pl === 0 ? (m.group.length > 1 ? `${m.group.length} pieces home.` : 'A piece home.') : 'The Scribe brings a piece home.';
      else if (m.from !== -1 && this.pos[m.pl].filter(q => q === m.to).length > m.group.length) note = m.pl === 0 ? 'Stacked: they travel together now.' : 'The Scribe stacks its pieces.';
      else if ([5, 10, 22].includes(m.to)) note = m.pl === 0 ? 'On a shortcut point: next move cuts across.' : '';
      return { moved, note };
    },
    extra(m) { return m.cap.length > 0 || m.value >= 4; },
    extraNote: 'Throw again.',
    done(pl) { return this.pos[pl].every(p => p === YT_HOME); },
    home(pl) { return this.pos[pl].filter(p => p === YT_HOME).length; },
    // How far a piece still has to go: the length of its route home.
    left(p) { return p === YT_HOME ? 0 : ytRoute(p).length; },
    danger(pl, sq) { // chance the other side can land on sq next throw
      if (sq === YT_HOME || sq === -1) return 0;
      const P = [0, 4 / 16, 6 / 16, 4 / 16, 1 / 16, 1 / 16];
      let d = 0;
      for (const q of new Set(this.pos[1 - pl])) { if (q === YT_HOME) continue; const r = ytRoute(q); for (let v = 1; v <= 5; v++) if (r[v - 1] === sq) d += P[v]; }
      return Math.min(1, d);
    },
    ai(moves) {
      let best = moves[0], bs = -1e9;
      for (const m of moves) {
        let s = 0;
        const n = m.group.length;
        if (m.to === YT_HOME) s += 40 * n;
        s += m.cap.length * (30 + 4 * m.cap.reduce((a, k) => a + (20 - this.left(this.pos[1 - m.pl][k])), 0) / Math.max(1, m.cap.length));
        s += (this.left(m.from) - this.left(m.to)) * 2 * n;
        if ([5, 10, 22].includes(m.to)) s += 10;
        if (m.to !== YT_HOME && this.pos[m.pl].some((q, k) => q === m.to && !m.group.includes(k))) s += 8;
        s -= this.danger(m.pl, m.to) * 30 * n;
        s += this.danger(m.pl, m.from) * 18 * n;
        s += Math.random() * pick(30, 6, 0.5);
        if (s > bs) { bs = s; best = m; }
      }
      return best;
    },
    aiPlan(pl, moves) { return [this.ai(moves)]; },
  };

