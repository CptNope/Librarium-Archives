  /* ---------------------------------------------------------------- Jungle
   * Dou shou qi on a 7 x 9 board. Square i = r * 7 + c, with row 0 the visitor's
   * home row. A piece is pl * 10 + rank (1 rat ... 8 elephant). The rivers fill
   * rows 3-5 of columns 1-2 and 4-5; each den sits mid-row with three traps. */
  const JU_NAME = ['', 'rat', 'cat', 'dog', 'wolf', 'leopard', 'tiger', 'lion', 'elephant'];
  const JU_VAL = [0, 4.5, 2, 3, 4, 5, 8, 9, 10];
  const JU_DEN = [3, 59];
  const JU_TRAP = (() => { const t = Array(63).fill(-1); for (const i of [2, 4, 10]) t[i] = 0; for (const i of [58, 60, 52]) t[i] = 1; return t; })();
  const JU_WATER = (() => { const w = Array(63).fill(false); for (let r = 3; r <= 5; r++) for (const c of [1, 2, 4, 5]) w[r * 7 + c] = true; return w; })();
  const JU_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const JUNGLE = {
    id: 'jungle', name: 'Jungle', dice: false, first: 0,
    NAME: JU_NAME, DEN: JU_DEN, TRAP: JU_TRAP, WATER: JU_WATER,
    rules: [
      'You play blue and move first. Each side has eight animals, strongest first: elephant, lion, tiger, leopard, wolf, dog, cat and rat.',
      'An animal moves one square forward, back or sideways, and takes an enemy of the same rank or lower by moving onto it. The one exception runs both ways: the rat can take the elephant, and the elephant cannot take the rat.',
      'Only the rat may swim. A rat in a river can be taken only by the other rat, also in the water, and a rat cannot take anything as it enters or leaves the water.',
      'The lion and the tiger leap straight across a river, along a row or a column, and may take what they land on. A rat in the water on the way blocks the leap.',
      'Three traps guard each den. An animal standing in its enemy\'s trap loses all its rank, and any enemy animal may take it.',
      'Walk any animal into the Scribe\'s den, or take all its animals, to win. You may never enter your own den. A position repeated three times, a side left with no move, or 50 moves each without a capture, is a draw.'
    ],
    source: 'Dou shou qi as played in China today. Some sets let only the lion leap sideways across the rivers; here the tiger may too.',
    init() {
      const b = Array(63).fill(0);
      const home = [[0, 0, 6], [0, 6, 7], [1, 1, 2], [1, 5, 3], [2, 0, 8], [2, 2, 4], [2, 4, 5], [2, 6, 1]]; // [row, col, rank], blue's side
      for (const [r, c, k] of home) { b[r * 7 + c] = k; b[(8 - r) * 7 + (6 - c)] = 10 + k; } // red is the same, turned half round
      this.b = b; this.ply = 0; this.quiet = 0; this.over = null;
      this.seen = new Map(); this.trail = [];
      this.mark(0);
    },
    owner: v => (v > 10 ? 1 : 0),
    rank: v => v % 10,
    key(pl) { return this.b.join('') + pl; },
    mark(pl) { const k = this.key(pl); this.seen.set(k, (this.seen.get(k) || 0) + 1); this.trail.push(k); },
    takes(pl, from, to) { // may the piece on from take what stands on to?
      const a = this.rank(this.b[from]), t = this.rank(this.b[to]);
      if (JU_WATER[from] !== JU_WATER[to]) return false; // no capture while entering or leaving the water
      if (a === 1 && t === 8) return true;
      if (JU_TRAP[to] === pl) return true; // an animal in its enemy's trap has no rank
      if (a === 8 && t === 1) return false;
      return a >= t;
    },
    targets(i) {
      const b = this.b, v = b[i], pl = this.owner(v), k = this.rank(v), r = (i / 7) | 0, c = i % 7, out = [];
      for (const [dr, dc] of JU_DIRS) {
        let rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 8 || cc < 0 || cc > 6) continue;
        let j = rr * 7 + cc, leap = false;
        if (j === JU_DEN[pl]) continue;
        if (JU_WATER[j] && k !== 1) {
          if (k !== 6 && k !== 7) continue;
          let blocked = false;
          while (JU_WATER[j]) { if (b[j]) blocked = true; rr += dr; cc += dc; j = rr * 7 + cc; }
          if (blocked) continue;
          leap = true;
        }
        const w = b[j];
        if (w && this.owner(w) === pl) continue;
        if (w && !this.takes(pl, i, j)) continue;
        out.push({ pl, from: i, to: j, cap: !!w, leap });
      }
      return out;
    },
    legal(pl) {
      if (this.over) return [];
      const out = [];
      for (let i = 0; i < 63; i++) { const v = this.b[i]; if (v && this.owner(v) === pl) out.push(...this.targets(i)); }
      return out;
    },
    count(pl) { let n = 0; for (const v of this.b) if (v && this.owner(v) === pl) n++; return n; },
    apply(m) {
      const b = this.b, v = b[m.from], victim = b[m.to];
      b[m.from] = 0; b[m.to] = v; this.ply++;
      this.quiet = victim ? 0 : this.quiet + 1;
      const you = m.pl === 0, who = you ? 'Your' : 'The Scribe\'s';
      let note = '';
      if (victim) note = you ? `Your ${JU_NAME[this.rank(v)]} takes the Scribe's ${JU_NAME[this.rank(victim)]}.` : `The Scribe's ${JU_NAME[this.rank(v)]} takes your ${JU_NAME[this.rank(victim)]}.`;
      else if (m.leap) note = `${who} ${JU_NAME[this.rank(v)]} leaps the river.`;
      if (m.to === JU_DEN[1 - m.pl]) this.over = { winner: m.pl, text: you ? `Your ${JU_NAME[this.rank(v)]} walks into the Scribe's den. You win.` : `The Scribe's ${JU_NAME[this.rank(v)]} walks into your den. The Scribe wins.` };
      else if (victim && !this.count(1 - m.pl)) this.over = { winner: m.pl, text: you ? 'You have taken every one of the Scribe\'s animals. You win.' : 'The Scribe has taken all your animals.' };
      this.mark(1 - m.pl);
      return { note, caps: victim ? [m.to] : [] };
    },
    result(pl) {
      if (this.over) return this.over;
      if (!this.legal(pl).length) return { winner: -1, text: pl === 0 ? 'You have no move left: a draw.' : 'The Scribe has no move left: a draw.' };
      if ((this.seen.get(this.key(pl)) || 0) >= 3) return { winner: -1, text: 'The same position has come round three times: a draw.' };
      if (this.quiet >= 100) return { winner: -1, text: 'Fifty moves each without a capture: a draw.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply, this.quiet, this.over, this.trail.length]; },
    restore(s) {
      this.b = s[0].slice(); this.ply = s[1]; this.quiet = s[2]; this.over = s[3];
      while (this.trail.length > s[4]) { const k = this.trail.pop(), n = this.seen.get(k) - 1; if (n) this.seen.set(k, n); else this.seen.delete(k); }
    },
    turns(pl) {
      const den = JU_DEN[1 - pl], dr = (den / 7) | 0;
      const val = m => {
        if (m.to === den) return 1000;
        let s = m.cap ? 10 * JU_VAL[this.rank(this.b[m.to])] - JU_VAL[this.rank(this.b[m.from])] : 0;
        const d = i => Math.abs(((i / 7) | 0) - dr) + Math.abs(i % 7 - 3);
        return s + (d(m.from) - d(m.to)) * 0.5;
      };
      return this.legal(pl).map(m => [m, val(m)]).sort((a, b) => b[1] - a[1]).map(x => [x[0]]);
    },
    terminal(pl, depth) {
      if (this.over) return this.over.winner === pl ? 1000 + depth : this.over.winner < 0 ? 0 : -1000 - depth;
      if ((this.seen.get(this.key(pl)) || 0) >= 2) return 0; // a repetition inside the search is as good as a draw
      if (!this.legal(pl).length) return 0;
      return null;
    },
    evaluate(pl) {
      let s = 0;
      for (let i = 0; i < 63; i++) {
        const v = this.b[i]; if (!v) continue;
        const p = this.owner(v), k = this.rank(v), den = JU_DEN[1 - p];
        const d = Math.abs(((i / 7) | 0) - ((den / 7) | 0)) + Math.abs(i % 7 - 3);
        let x = JU_VAL[k] + (12 - d) * 0.07;
        if (d <= 2) x += 0.6 / d; // pressing on the enemy den
        if (JU_TRAP[i] === 1 - p) x += 0.3; // standing in an enemy trap, next to the den
        s += p === pl ? x : -x;
      }
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 6); },
  };

