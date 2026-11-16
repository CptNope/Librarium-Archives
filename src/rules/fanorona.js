  /* ---------------------------------------------------------------- Fanorona
   * 5 rows x 9 columns of points, index r*9+c, row 0 nearest the visitor.
   * Every point joins its neighbours across and up and down; the "strong"
   * points, where r + c is even, also join diagonally. A turn is played one
   * step at a time: after a capture the same stone may capture again. */
  const FN_R = 5, FN_C = 9;
  const FN_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const fnDirs = i => { const r = (i / FN_C) | 0, c = i % FN_C; return (r + c) % 2 === 0 ? FN_DIRS : FN_DIRS.slice(0, 4); };
  const fnAt = (r, c) => (r >= 0 && r < FN_R && c >= 0 && c < FN_C ? r * FN_C + c : -1);
  const FANORONA = {
    id: 'fanorona', name: 'Fanorona', dice: false, first: 0, R: FN_R, C: FN_C, stopLabel: 'Stop',
    followPrompt: 'You may capture again with the same stone, or choose Stop.',
    rules: [
      'You play white and move first. A stone moves one step along a line to an empty point.',
      'Capture by approach: step up to an enemy stone in the direction you are moving. Or by withdrawal: step directly away from an enemy stone next to you. Either way, the whole unbroken line of enemy stones beyond is taken.',
      'Pick a stone, then pick the enemy stone you want to capture: the rings show your choices. When one step could approach or withdraw, you choose which line to take.',
      'Capturing is compulsory. After a capture, the same stone may capture again, but never back onto a point it visited this turn, and never twice in the same direction. Or choose Stop.',
      'Take every enemy stone to win. House rule: twenty moves each with no capture is a draw.'
    ],
    source: 'Fanoron-tsivy, the full 5 × 9 game, with the rules as they are usually given today.',
    init() {
      const b = Array(FN_R * FN_C).fill(0);
      for (let i = 0; i < 18; i++) { b[i] = 1; b[44 - i] = 2; }
      [2, 1, 2, 1, 0, 2, 1, 2, 1].forEach((v, c) => { b[2 * FN_C + c] = v; });
      this.b = b; this.chain = null; this.quiet = 0; this.ply = 0;
    },
    count(pl) { let n = 0; for (const v of this.b) if (v === pl + 1) n++; return n; },
    // The line of enemy stones starting at (r, c) and running in (dr, dc).
    line(r, c, dr, dc, them) { const out = []; for (let i = fnAt(r, c); i >= 0 && this.b[i] === them; r += dr, c += dc, i = fnAt(r, c)) out.push(i); return out; },
    stepsFrom(i, captureOnly, visited, lastDir) {
      const me = this.b[i], them = 3 - me, r = (i / FN_C) | 0, c = i % FN_C, out = [];
      for (const [dr, dc] of fnDirs(i)) {
        const to = fnAt(r + dr, c + dc);
        if (to < 0 || this.b[to]) continue;
        if (visited && visited.includes(to)) continue;
        if (lastDir && lastDir[0] === dr && lastDir[1] === dc) continue;
        const pl = me - 1;
        const appr = this.line(r + 2 * dr, c + 2 * dc, dr, dc, them), wd = this.line(r - dr, c - dc, -dr, -dc, them);
        if (appr.length) out.push({ pl, from: i, to, dir: [dr, dc], caps: appr, kind: 'approach' });
        if (wd.length) out.push({ pl, from: i, to, dir: [dr, dc], caps: wd, kind: 'withdrawal' });
        if (!captureOnly && !appr.length && !wd.length) out.push({ pl, from: i, to, dir: [dr, dc], caps: [], kind: 'paika' });
      }
      return out;
    },
    legal(pl) {
      if (this.chain) {
        const more = this.stepsFrom(this.chain.at, true, this.chain.visited, this.chain.dir);
        return more.concat([{ pl, pass: true }]);
      }
      const me = pl + 1; let caps = [], quiet = [];
      for (let i = 0; i < FN_R * FN_C; i++) if (this.b[i] === me) for (const m of this.stepsFrom(i, false)) (m.caps.length ? caps : quiet).push(m);
      return caps.length ? caps : quiet;
    },
    apply(m) {
      if (m.pass) { this.chain = null; this.ply++; return { caps: [], note: '' }; }
      const v = this.b[m.from]; this.b[m.from] = 0; this.b[m.to] = v;
      m.caps.forEach(c => { this.b[c] = 0; });
      const n = m.caps.length, res = { caps: m.caps.slice(), note: '' };
      if (n) {
        res.note = m.pl === 0 ? `You take ${n} by ${m.kind}.` : `The Scribe takes ${n} by ${m.kind}.`;
        const visited = this.chain ? this.chain.visited.concat([m.to]) : [m.from, m.to];
        this.chain = { at: m.to, visited, dir: m.dir };
        if (this.count(1 - m.pl) && this.stepsFrom(m.to, true, visited, m.dir).length) { res.followUp = this.legal(m.pl); }
        else this.chain = null;
        this.quiet = 0;
      } else { this.chain = null; this.quiet++; }
      if (!this.chain) this.ply++;
      return res;
    },
    result(pl) {
      if (!this.count(pl)) return { winner: 1 - pl, text: pl === 0 ? 'The Scribe has taken all your stones.' : 'You have taken every one of the Scribe\'s stones.' };
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'You have no move.' : 'The Scribe has no move.' };
      if (this.quiet >= 40) return { winner: -1, text: 'Twenty moves each with no capture. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.chain && JSON.stringify(this.chain), this.quiet, this.ply]; },
    restore(s) { this.b = s[0].slice(); this.chain = s[1] ? JSON.parse(s[1]) : null; this.quiet = s[2]; this.ply = s[3]; },
    // Whole turns for the search: every capture sequence, stopping wherever the rules allow.
    turns(pl) {
      const out = [], snap = this.snapshot();
      const walk = (seq) => {
        const ms = this.legal(pl);
        for (const m of ms) {
          if (m.pass) { out.push(seq.concat([m])); continue; }
          const s = this.snapshot();
          const res = this.apply(m);
          if (res.followUp && out.length < 400) walk(seq.concat([m])); else out.push(seq.concat([m]));
          this.restore(s);
        }
      };
      walk([]);
      this.restore(snap);
      return out.sort((a, b) => b.reduce((n, m) => n + (m.caps ? m.caps.length : 0), 0) - a.reduce((n, m) => n + (m.caps ? m.caps.length : 0), 0));
    },
    terminal(pl, depth) {
      if (!this.count(pl)) return -1000 - depth;
      if (!this.count(1 - pl)) return 1000 + depth;
      if (this.quiet >= 40) return 0;
      return null;
    },
    evaluate(pl) { return (this.count(pl) - this.count(1 - pl)) * 10 + (this.b[22] === pl + 1 ? 0.5 : this.b[22] ? -0.5 : 0); },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 4); },
  };

