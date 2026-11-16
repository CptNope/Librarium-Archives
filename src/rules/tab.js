  /* -------------------------------------------------------------------- Tâb
     Lane's Egyptian race-and-capture game: four rows of W squares, a row of
     pieces each, four palm-stick dice. Cells are r * W + c, row 0 the
     visitor's home, row 3 the Scribe's, c from the visitor's left. Each row
     runs one way for both players: rows 0 and 2 to the right, 1 and 3 left. */
  const TB_DIR = [1, -1, 1, -1];
  const TB_P = { 1: 4 / 16, 2: 6 / 16, 3: 4 / 16, 4: 1 / 16, 6: 1 / 16 }; // chances of each throw
  const TAB = {
    id: 'tab', name: 'Tâb', dice: true, first: 0, W: 9, extraNote: 'A tâb, a 4 or a 6: throw again.',
    rules: [
      'You have a row of nine dark stones nearest you; the Scribe has nine pieces of red tile at the far side. Pieces travel through the rows as the arrows show: along your own row, back along the next, out along the third, and then round the two middle rows.',
      'Throw four palm sticks and count the white sides: one white is a tâb (1), two count 2, three count 3, four count 4, and none counts 6. A tâb, a 4 or a 6 earns another throw. Each throw moves one piece.',
      'A piece that has never moved needs a tâb to start, and then moves one square.',
      'Land on an enemy piece to take it. You may not land on your own.',
      'Once in its life a piece may go on into the enemy\'s home row instead of round the middle; it then comes back to the middle rows. A piece in the enemy\'s row cannot move while you still have pieces in your own home row.',
      'Take all the Scribe\'s pieces to win.'
    ],
    source: 'After Edward William Lane, Manners and Customs of the Modern Egyptians (1836). Lane\'s stacking of pieces (\'eggeh) is left out, each throw is moved as it is made, and after 150 throws each the side with more pieces wins: those are our choices.',
    init() {
      const W = this.W; this.pc = [];
      for (let c = 0; c < W; c++) this.pc.push({ pl: 0, cell: c, conv: false, entered: false, back: false, alive: true });
      for (let c = 0; c < W; c++) this.pc.push({ pl: 1, cell: 3 * W + c, conv: false, entered: false, back: false, alive: true });
      this.at = new Int16Array(4 * W).fill(-1); this.pc.forEach((p, k) => { this.at[p.cell] = k; });
      this.throws = 0; this.over = null;
    },
    home(pl) { return pl === 0 ? 0 : 3; },
    count(pl) { return this.pc.filter(p => p.alive && p.pl === pl).length; },
    atHome(pl) { const h = this.home(pl), W = this.W; return this.pc.some(p => p.alive && p.pl === pl && ((p.cell / W) | 0) === h); },
    roll() { const f = [0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0)); const n = f.reduce((a, b) => a + b, 0); return { faces: f, value: n || 6 }; },
    rollName(r) { return r.value === 1 ? 'a tâb (1)' : String(r.value); },
    // Every square a piece could reach in exactly v steps, with the path, and whether it ends having entered the enemy row.
    walk(p, v) {
      const W = this.W, pl = p.pl, h = this.home(pl), a = pl ? 2 : 1, b = pl ? 1 : 2, e = pl ? 0 : 3, out = [];
      const go = (cell, left, entered, path) => {
        if (!left) { out.push({ cell, entered, path }); return; }
        const r = (cell / W) | 0, c = cell % W, nc = c + TB_DIR[r];
        if (nc >= 0 && nc < W) return go(r * W + nc, left - 1, entered, path.concat(r * W + nc));
        const next = r === h ? [a] : r === a ? [b] : r === e ? [b] : entered ? [a] : [e, a];
        for (const nr of next) go(nr * W + c, left - 1, entered || nr === e, path.concat(nr * W + c));
      };
      go(p.cell, v, p.entered, []);
      return out;
    },
    legal(pl, value) {
      if (this.over) return [];
      const W = this.W, out = [], homeLeft = this.atHome(pl);
      this.pc.forEach((p, k) => {
        if (!p.alive || p.pl !== pl) return;
        if (!p.conv && value !== 1) return;
        const r = (p.cell / W) | 0;
        if (r === (pl ? 0 : 3) && homeLeft) return; // stuck in the enemy row while pieces remain at home
        for (const d of this.walk(p, value)) {
          const o = this.at[d.cell];
          if (o >= 0 && this.pc[o].pl === pl) continue;
          out.push({ pl, piece: k, from: p.cell, to: d.cell, path: d.path, entered: d.entered, cap: o >= 0 ? 1 : 0, start: !p.conv });
        }
      });
      return out;
    },
    steps(m) { return m.path; },
    apply(m) {
      const p = this.pc[m.piece], W = this.W, me = m.pl === 0, res = { note: '' };
      this.throws++;
      const o = this.at[m.to];
      if (o >= 0) { this.pc[o].alive = false; res.taken = o; res.caps = [m.to]; res.note = me ? 'You take a Scribe\'s piece.' : 'The Scribe takes one of your pieces.'; }
      this.at[m.from] = -1; this.at[m.to] = m.piece; p.cell = m.to; p.entered = m.entered;
      if (!p.conv) { p.conv = true; if (!res.note) res.note = me ? 'A tâb: your piece sets out.' : ''; }
      const r = (m.to / W) | 0;
      if (r === (m.pl ? 0 : 3) && !res.note) res.note = me ? 'You enter the Scribe\'s home row.' : 'The Scribe enters your home row.';
      if (!this.count(1 - m.pl)) this.over = { winner: m.pl, text: me ? 'You have taken every one of the Scribe\'s pieces.' : 'The Scribe has taken every one of your pieces.' };
      else if (this.throws >= 300) { const a = this.count(0), c = this.count(1); this.over = { winner: a > c ? 0 : c > a ? 1 : -1, text: `After 150 throws each you have ${a} pieces and the Scribe ${c}.` }; }
      return res;
    },
    extra(m, value) { return !this.over && (value === 1 || value === 4 || value === 6); },
    done() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over; },
    // The chance an enemy piece can land on a square with its next throw.
    danger(pl, cell) {
      let p = 0; const opp = 1 - pl, homeLeft = this.atHome(opp), W = this.W;
      for (const v of [1, 2, 3, 4, 6]) {
        let hit = false;
        for (const q of this.pc) {
          if (!q.alive || q.pl !== opp || (!q.conv && v !== 1)) continue;
          if (((q.cell / W) | 0) === (opp ? 0 : 3) && homeLeft) continue;
          if (this.walk(q, v).some(d => d.cell === cell)) { hit = true; break; }
        }
        if (hit) p += TB_P[v];
      }
      return p;
    },
    // Sharp looks at the whole board after a move: what each side can hit with its next throw.
    exposure(pl) {
      let lose = 0, gain = 0;
      for (const q of this.pc) {
        if (!q.alive) continue;
        const d = this.danger(q.pl, q.cell), w = 1 + (q.conv ? 0 : 0.3); // a piece that has not set out cannot run
        if (q.pl === pl) lose += d * w; else gain += d * w;
      }
      return gain * 4 - lose * 9;
    },
    aiPlan(pl, moves) {
      if (!moves.length) return [];
      const lvl = LEVEL.name, W = this.W;
      if (lvl === 'gentle' && Math.random() < 0.4) return [moves[(Math.random() * moves.length) | 0]];
      let best = moves[0], bv = -Infinity;
      for (const m of moves) {
        const p = this.pc[m.piece];
        let v = m.cap ? 10 + (this.pc[this.at[m.to]].conv ? 0 : 2) : 0;
        if (m.start) v += 3;
        if (m.entered && !p.entered) v += 2.5; // a raid on the enemy's home row
        const r = (m.to / W) | 0; if (r === (pl ? 0 : 3)) v += 1;
        if (lvl !== 'gentle') {
          const save = this.at[m.to]; this.at[m.from] = -1; this.at[m.to] = m.piece; const was = p.cell, conv = p.conv, ent = p.entered;
          if (save >= 0) this.pc[save].alive = false;
          p.cell = m.to; p.conv = true; p.entered = m.entered;
          if (lvl === 'sharp') v += this.exposure(pl);
          else { v -= this.danger(pl, m.to) * 6; p.cell = was; v += this.danger(pl, was) * 3; } // moving out of danger
          if (save >= 0) this.pc[save].alive = true;
          p.cell = was; p.conv = conv; p.entered = ent; this.at[m.to] = save; this.at[m.from] = m.piece;
        }
        v += Math.random() * pick(3, 0.5, 0.1);
        if (v > bv) { bv = v; best = m; }
      }
      return [best];
    },
    snapshot() { return [this.pc.map(p => Object.assign({}, p)), this.at.slice(), this.throws, this.over]; },
    restore(s) { this.pc = s[0].map(p => Object.assign({}, p)); this.at = s[1].slice(); this.throws = s[2]; this.over = s[3]; },
  };

