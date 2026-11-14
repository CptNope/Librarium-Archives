  /* -------------------------------------------------------------------- Ludo
   * The cross of 52 squares on a 15 x 15 grid. Square k of the track lies at LD_TRACK[k] (x right,
   * y away from the visitor); each colour starts at its own square and runs 51 squares round,
   * then five up its home column and into the centre. Position: -1 in the yard, 0-50 on the track
   * (counted from that colour's start), 51-55 the home column, 56 home. */
  const LD_TRACK = (() => {
    const t = [], seg = (x0, y0, dx, dy, n) => { for (let k = 0; k < n; k++) t.push([x0 + dx * k, y0 + dy * k]); };
    seg(1, 6, 1, 0, 5); seg(6, 5, 0, -1, 6); t.push([7, 0]); seg(8, 0, 0, 1, 6); seg(9, 6, 1, 0, 6); t.push([14, 7]);
    seg(14, 8, -1, 0, 6); seg(8, 9, 0, 1, 6); t.push([7, 14]); seg(6, 14, 0, -1, 6); seg(5, 8, -1, 0, 6); t.push([0, 7]); t.push([0, 6]);
    return t;
  })();
  const LD_START = [0, 26];
  const LUDO = {
    id: 'ludo', name: 'Ludo', dice: true, oneDie: true, pipDice: true, autoMove: true, first: 0, N: 4, TRACK: LD_TRACK, START: LD_START,
    extraNote: 'A six: throw again.',
    rules: [
      'You play red and the Scribe yellow, from opposite corners. Each of you has four tokens in your yard. You throw first.',
      'Throw one die. A six brings a token out onto your starting square, or moves one six squares, and earns another throw.',
      'Tokens run once round the board, clockwise, then turn up your own coloured column to the centre. You need the exact throw to finish.',
      'Land on a Scribe token and it goes back to its yard. Your home column is safe from capture.',
      'The first to bring all four tokens home wins. If no token can move, the turn passes.'
    ],
    source: 'Ludo as patented in England in 1896, with the common rules: a six to come out, a six to throw again, capture by landing, and an exact throw home.',
    init() { this.pos = [[-1, -1, -1, -1], [-1, -1, -1, -1]]; this.ply = 0; },
    roll() { const v = 1 + ((Math.random() * 6) | 0); return { value: v, faces: [v] }; },
    abs(pl, rel) { return rel < 0 || rel > 50 ? -1 : (rel + LD_START[pl]) % 52; },
    legal(pl, value) {
      const out = [];
      this.pos[pl].forEach((rel, k) => {
        if (rel === 56) return;
        if (rel < 0) { if (value === 6) out.push({ pl, k, from: -1, to: 0 }); return; }
        if (rel + value <= 56) out.push({ pl, k, from: rel, to: rel + value });
      });
      // Tokens of one colour on one square move the same way: offer one of them.
      const seen = new Set();
      return out.filter(m => { const key = m.from + ':' + m.to; if (seen.has(key)) return false; seen.add(key); return true; });
    },
    steps(m) { if (m.from < 0) return [0]; return Array.from({ length: m.to - m.from }, (_, i) => m.from + i + 1); },
    apply(m) {
      const pl = m.pl; this.pos[pl][m.k] = m.to; this.ply++;
      const caps = [], a = this.abs(pl, m.to);
      if (a >= 0) this.pos[1 - pl].forEach((rel, k) => { if (this.abs(1 - pl, rel) === a) { this.pos[1 - pl][k] = -1; caps.push(k); } });
      let note = '';
      if (m.from < 0) note = pl === 0 ? 'A token comes out.' : 'A Scribe token comes out.';
      if (caps.length) note = pl === 0 ? `You send ${caps.length > 1 ? caps.length + ' Scribe tokens' : 'a Scribe token'} back to its yard.` : `The Scribe sends ${caps.length > 1 ? caps.length + ' of your tokens' : 'one of your tokens'} back to your yard.`;
      if (m.to === 56) note = pl === 0 ? 'A token reaches home.' : 'A Scribe token reaches home.';
      return { note, caps };
    },
    extra(m, value) { return value === 6 && !this.done(m.pl); },
    done(pl) { return this.pos[pl].every(r => r === 56); },
    home(pl) { return this.pos[pl].filter(r => r === 56).length; },
    winText: pl => (pl === 0 ? 'All four of your tokens are home.' : 'All four Scribe tokens are home.'),
    snapshot() { return this.pos.map(a => a.slice()); },
    restore(s) { this.pos = s.map(a => a.slice()); },
    // How many enemy tokens could reach this square with one throw.
    danger(pl, rel) {
      if (rel < 1 || rel > 50) return 0;
      const a = this.abs(pl, rel); let d = 0;
      for (const r of this.pos[1 - pl]) {
        if (r < 0 || r > 50) { if (r < 0 && a === LD_START[1 - pl]) d += 0.3; continue; }
        const ea = this.abs(1 - pl, r), gap = (a - ea + 52) % 52;
        if (gap >= 1 && gap <= 6 && r + gap <= 50) d++;
      }
      return d;
    },
    aiPlan(pl, moves) {
      if (moves.length === 1 || LEVEL.name === 'gentle') return [moves[(Math.random() * moves.length) | 0]];
      const sharp = LEVEL.name === 'sharp';
      const val = m => {
        const s = this.snapshot(), r = this.apply(m); let v = 0;
        v += r.caps.length * (sharp ? 12 + 0.25 * r.caps.length : 10);
        if (m.from < 0) v += 8;
        if (m.to === 56) v += 9;
        if (m.to > 50 && m.from <= 50) v += 6;
        v += (m.to - Math.max(m.from, 0)) * 0.1;
        if (sharp) { v -= this.danger(pl, m.to) * 4 * (0.4 + m.to / 50); v += this.danger(pl, m.from) * 3 * (0.4 + m.from / 50); }
        this.restore(s); return v;
      };
      return [moves.reduce((a, b) => (val(b) > val(a) ? b : a))];
    },
  };

