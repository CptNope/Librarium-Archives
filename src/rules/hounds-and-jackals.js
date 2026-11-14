  /* ------------------------------------------------------ Hounds and Jackals
     Howard Carter's reconstruction (1912) on the 58-hole board: each side
     races five pins up its own track of 29 holes to the goal. Positions are
     0 (not yet on the board) to 29 (the goal). */
  const HJ_GOAL = 29, HJ_BACK = { 20: 6, 10: 8 }, HJ_AGAIN = [15, 25];
  const HOUNDS = {
    id: 'hounds', name: 'Hounds and Jackals', dice: true, first: 0, N: 5, sides: ['hounds', 'jackals'], extraNote: '',
    rules: [
      'This is a modern reconstruction. No ancient rules survive; the table follows the route Howard Carter proposed in 1912, when he found the set.',
      'You have five hounds on the left track, the Scribe five jackals on the right. Each side races up its own 29 holes to the goal at the top.',
      'Throw four sticks and count the white sides; no white side counts 5. Move one pin that many holes, entering at the bottom. Only one pin fits a hole, except the goal, and you must reach the goal exactly.',
      'Lines join hole 6 with 20 and 8 with 10. Land on 20 and you slide back to 6; land on 10 and you slide back to 8.',
      'Holes 15 and 25 are marked "good": landing there earns another throw.',
      'Bring all five pins to the goal first to win.'
    ],
    source: 'A modern reconstruction after Howard Carter (Carnarvon and Carter, Five Years\' Explorations at Thebes, 1912), as described in "Hounds and Jackals in Modern Times" (ISAW Papers 22.4). The stick dice are our choice; Carter thought of dice or knucklebones.',
    init() { this.pos = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]; this.over = null; },
    roll() { const f = [0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0)); const n = f.reduce((a, b) => a + b, 0); return { faces: f, value: n || 5 }; },
    home(pl) { return this.pos[pl].filter(p => p === HJ_GOAL).length; },
    land(pl, to) { const b = HJ_BACK[to]; return b !== undefined && !this.pos[pl].includes(b) ? b : to; },
    legal(pl, value) {
      if (this.over) return [];
      const out = [], seen = new Set();
      this.pos[pl].forEach((p, k) => {
        if (p === HJ_GOAL || seen.has(p)) return; // pins waiting off the board are all alike
        const to = p + value;
        if (to > HJ_GOAL || (to < HJ_GOAL && this.pos[pl].includes(to))) return;
        seen.add(p);
        out.push({ pl, k, from: p, to, end: to === HJ_GOAL ? to : this.land(pl, to) });
      });
      return out;
    },
    steps(m) { const s = []; for (let h = m.from + 1; h <= m.to; h++) s.push(h); if (m.end !== m.to) s.push(m.end); return s; },
    apply(m) {
      const me = m.pl === 0, res = { note: '' };
      this.pos[m.pl][m.k] = m.end;
      if (m.end !== m.to) res.note = `${me ? 'Your' : 'The Scribe\'s'} pin lands on ${m.to} and slides back down the line to ${m.end}.`;
      else if (HJ_AGAIN.includes(m.end)) res.note = `${me ? 'You land' : 'The Scribe lands'} on a "good" hole and ${me ? 'throw' : 'throws'} again.`;
      else if (m.end === HJ_GOAL) res.note = `${me ? 'Your pin reaches' : 'A jackal reaches'} the goal (${this.home(m.pl)} of 5 home).`;
      if (this.home(m.pl) === this.N) this.over = { winner: m.pl, text: me ? 'All five of your hounds are home.' : 'All five jackals reached the goal first.' };
      return res;
    },
    extra(m) { return !!m && !this.over && m.end === m.to && HJ_AGAIN.includes(m.end); },
    done() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over; },
    aiPlan(pl, moves) {
      if (!moves.length) return [];
      if (LEVEL.name === 'gentle' && Math.random() < 0.5) return [moves[(Math.random() * moves.length) | 0]];
      let best = moves[0], bv = -Infinity;
      for (const m of moves) {
        let v = m.end - m.from;
        if (m.end === HJ_GOAL) v += 6;
        if (HJ_AGAIN.includes(m.end) && m.end === m.to) v += 5;
        if (LEVEL.name === 'sharp') { // look one throw ahead: how much the best move after this one is worth, on average
          const save = this.pos[pl][m.k]; this.pos[pl][m.k] = m.end;
          let ev = 0;
          for (const [t, p] of [[1, 4 / 16], [2, 6 / 16], [3, 4 / 16], [4, 1 / 16], [5, 1 / 16]]) {
            let b2 = 0;
            for (const n of this.legal(pl, t)) b2 = Math.max(b2, n.end - n.from + (n.end === HJ_GOAL ? 6 : 0) + (HJ_AGAIN.includes(n.end) && n.end === n.to ? 5 : 0));
            ev += p * b2;
          }
          this.pos[pl][m.k] = save;
          v += 0.8 * ev;
        }
        v += Math.random() * pick(2, 0.3, 0.05);
        if (v > bv) { bv = v; best = m; }
      }
      return [best];
    },
  };

