  /* ---------------------------------------------------------------- Patolli
     A common modern reconstruction from Diego Durán's account: 52 houses in
     an X, six markers a side, five beans, and treasures staked. Houses are
     numbered round the circuit from the visitor's start; the Scribe starts
     opposite, at 26. Every 13th house (0, 13, 26, 39) is one of the four
     centre houses; within each arm, houses 6 and 7 are the tips and 4 and 9
     the dark houses. */
  const PT_N = 52, PT_MARKERS = 6, PT_TREASURE = 6, PT_LIMIT = 300;
  const PT_KIND = h => { const a = h % 13; return a === 0 ? 'centre' : a === 6 || a === 7 ? 'tip' : a === 4 || a === 9 ? 'dark' : ''; };
  const PATOLLI = {
    id: 'patolli', name: 'Patolli', dice: true, first: 0, START: [0, 26], KIND: PT_KIND, extraNote: '',
    rules: [
      'This is a modern reconstruction. Spanish writers such as Diego Durán describe the mat, the beans, the six markers and the stakes, but not every rule; the table follows the reconstruction most often given today.',
      'You have six red markers and six treasures; the Scribe has six blue markers and six treasures. Throw five beans and count the marked sides: 1 to 4 move that many houses, all five move 10, and none means you pay a treasure as an offering to the god Macuilxochitl.',
      'A throw of 1 may put a new marker on your starting house, in the centre. Markers run clockwise round all 52 houses and leave the mat on reaching the last house by an exact throw.',
      'A marker may not land on an occupied house, except in the four centre houses: land on an enemy marker there and it goes back to its owner, who pays you a treasure.',
      'Landing on one of the dark houses costs you a treasure, paid to the other player. Landing on a red tip at the end of an arm earns another throw. Each marker that completes the circuit earns a treasure from the other player.',
      'When one player has brought all six markers round, that player also takes the offerings and a last treasure, and whoever holds more treasures wins. A player who cannot pay loses at once.'
    ],
    source: 'A modern reconstruction, following the rules most often given today from Diego Durán\'s 16th-century account and the Aztec codices. Treasure paid for a completed circuit, the 150-throw limit and deciding the game on treasure after one round are our choices.',
    init() { this.pos = [Array(PT_MARKERS).fill(-1), Array(PT_MARKERS).fill(-1)]; this.treasure = [PT_TREASURE, PT_TREASURE]; this.pot = 0; this.throws = 0; this.over = null; },
    roll() { const f = [0, 0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0)); const n = f.reduce((a, b) => a + b, 0); return { faces: f, value: n === 5 ? 10 : n }; },
    rollName(r) { const n = r.faces.reduce((a, b) => a + b, 0); return n === 0 ? 'no marked beans' : n === 5 ? 'all five marked: 10' : `${n}`; },
    house(pl, rel) { return (this.START[pl] + rel) % PT_N; },
    at(h) { for (const pl of [0, 1]) for (let k = 0; k < PT_MARKERS; k++) { const r = this.pos[pl][k]; if (r >= 0 && r < PT_N - 1 && this.house(pl, r) === h) return [pl, k]; } return null; },
    home(pl) { return this.pos[pl].filter(r => r >= PT_N - 1).length; },
    legal(pl, value) {
      if (this.over) return [];
      if (value === 0) return [{ pl, offering: true, label: 'Pay the offering' }];
      const out = []; let entered = false;
      this.pos[pl].forEach((r, k) => {
        let to;
        if (r < 0) { if (value !== 1 || entered) return; to = 0; }
        else if (r >= PT_N - 1) return;
        else { to = r + value; if (to > PT_N - 1) return; }
        const h = this.house(pl, to), o = to === PT_N - 1 ? null : this.at(h);
        if (o && (o[0] === pl || PT_KIND(h) !== 'centre')) return;
        if (r < 0) entered = true;
        out.push({ pl, k, from: r, to, house: h, cap: o ? 1 : 0, enter: r < 0, off: to === PT_N - 1 });
      });
      return out;
    },
    steps(m) { const s = []; for (let r = Math.max(0, m.from + 1); r <= m.to; r++) s.push(this.house(m.pl, r)); if (m.enter) s.splice(0, s.length, this.house(m.pl, 0)); return s; },
    pay(from, to, words) {
      if (this.treasure[from] <= 0) { this.over = { winner: 1 - from, text: from === 0 ? 'You have no treasure left to pay with, and lose the game.' : 'The Scribe has no treasure left to pay with: you win.' }; return false; }
      this.treasure[from]--; if (to === 'pot') this.pot++; else this.treasure[to]++;
      return true;
    },
    apply(m) {
      const pl = m.pl, me = pl === 0, opp = 1 - pl, notes = [], res = { note: '' };
      this.throws++;
      this.again = false;
      if (m.offering) {
        this.pay(pl, 'pot');
        res.note = me ? 'No marked beans: you pay a treasure as an offering.' : 'The Scribe threw no marked beans and pays an offering.';
        return this.finishCheck(res);
      }
      if (m.cap) {
        const o = this.at(m.house); this.pos[o[0]][o[1]] = -1;
        notes.push(me ? 'You land on the Scribe\'s marker in the centre and send it back.' : 'The Scribe sends your marker back from the centre.');
        if (!this.pay(opp, pl)) return this.finishCheck(Object.assign(res, { note: notes.join(' '), sent: o }));
        res.sent = o;
      }
      this.pos[pl][m.k] = m.to;
      const kind = m.off ? '' : PT_KIND(m.house);
      if (m.off) { notes.push(me ? 'Your marker completes the circuit and leaves the mat; the Scribe pays you a treasure.' : 'A Scribe marker completes the circuit; you pay a treasure.'); this.pay(opp, pl); }
      else if (kind === 'dark') { notes.push(me ? 'A dark house: you pay the Scribe a treasure.' : 'The Scribe lands on a dark house and pays you a treasure.'); this.pay(pl, opp); }
      else if (kind === 'tip') notes.push(me ? 'The tip of an arm: throw again.' : 'The Scribe reaches the tip of an arm and throws again.');
      else if (m.enter) notes.push(me ? 'A marker enters the mat.' : '');
      res.note = notes.filter(Boolean).join(' ');
      this.again = kind === 'tip';
      return this.finishCheck(res);
    },
    finishCheck(res) {
      if (!this.over) {
        const done = [0, 1].find(p => this.home(p) === PT_MARKERS);
        if (done !== undefined || this.throws >= PT_LIMIT) {
          if (done !== undefined) { this.treasure[done] += this.pot; this.pot = 0; if (this.treasure[1 - done] > 0) { this.treasure[1 - done]--; this.treasure[done]++; } }
          const [a, c] = this.treasure, line = `You hold ${a} treasures, the Scribe ${c}.`;
          const lead = done === 0 ? 'All six of your markers are home, and the offerings are yours.' : done === 1 ? 'The Scribe has brought all six markers home and takes the offerings.' : 'After 150 throws each the game stops.';
          const w = a > c ? 0 : c > a ? 1 : done !== undefined ? done : -1;
          this.over = { winner: w, text: `${lead} ${line}` };
        }
      }
      return res;
    },
    extra(m) { return !!m && !m.offering && !this.over && !!this.again; },
    done() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over; },
    // Chance the other side can land on a centre house h with its next throw (only there can markers be hit).
    danger(pl, h) {
      const opp = 1 - pl, P = { 1: 5 / 32, 2: 10 / 32, 3: 10 / 32, 4: 5 / 32, 10: 1 / 32 };
      let p = 0;
      for (const v of [1, 2, 3, 4, 10]) if (this.pos[opp].some((r, k) => (r < 0 ? v === 1 && this.house(opp, 0) === h : r < PT_N - 1 && r + v < PT_N - 1 && this.house(opp, r + v) === h))) p += P[v];
      return p;
    },
    aiPlan(pl, moves) {
      if (!moves.length) return [];
      if (moves[0].offering) return [moves[0]];
      if (LEVEL.name === 'gentle' && Math.random() < 0.45) return [moves[(Math.random() * moves.length) | 0]];
      let best = moves[0], bv = -Infinity;
      for (const m of moves) {
        const kind = m.off ? '' : PT_KIND(m.house);
        let v = (m.to - Math.max(0, m.from)) * 0.15;
        if (m.off) v += 8; if (m.cap) v += 7; if (m.enter) v += 4;
        if (kind === 'tip') v += 3; if (kind === 'dark') v -= 4;
        if (LEVEL.name === 'sharp') {
          if (kind === 'centre' && !m.off) v -= this.danger(pl, m.house) * 9;
          const was = m.from >= 0 ? this.house(pl, m.from) : -1;
          if (was >= 0 && PT_KIND(was) === 'centre') v += this.danger(pl, was) * 6;
        }
        v += Math.random() * pick(2, 0.3, 0.05);
        if (v > bv) { bv = v; best = m; }
      }
      return [best];
    },
  };

