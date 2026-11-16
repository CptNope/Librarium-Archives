  /* -------------------------------------------------- Ludus duodecim scriptorum
   * A modern reconstruction. p[pl][k] counts a player's pieces at route position
   * k: 0 waiting off the board, 1-6 the player's own half of the middle row,
   * 7-18 the far row and 19-30 the near row, shared by both, 31 borne off.
   * Three dice; every die must be used if it can be. */
  const XII_DONE = 31;
  const XII = {
    id: 'xii', name: 'Duodecim scripta', dice: true, pipDice: true, first: 0, N: 15,
    rules: [
      'This is a modern reconstruction: no Roman account of the rules survives. You have fifteen pieces and throw three dice.',
      'Each die brings a waiting piece onto your half of the middle row, on the space of its number, or moves a piece that many spaces on. You must use every die you can.',
      'From your half of the middle row the course runs along the far row, right to left, then along the near row to the finish. The Scribe starts on the other half and shares the same course.',
      'No piece may leave your home row until all fifteen are on the board. A piece taken must come back on before you move anything else.',
      'Two or more pieces together are safe and block the space. Land on a single enemy piece to send it back to wait off the board.',
      'When all fifteen are in the last six spaces, bear them off with exact throws: a piece on the last space needs a 1. The first to bear off all fifteen wins.'
    ],
    source: 'A modern reconstruction, after the basics worked out by Roland Austin and H. J. R. Murray in the early 20th century and adapted from tabula, in the version the J. Paul Getty Museum gives in Ancient Rome at Home.',
    followPrompt: 'Move again with your remaining dice.',
    extraNote: '',
    rollName: r => `${r.faces.join(', ')}`,
    init() { this.p = [Array(32).fill(0), Array(32).fill(0)]; this.p[0][0] = 15; this.p[1][0] = 15; this.turn = null; this.hitOnce = [false, false]; },
    roll() { const f = [0, 0, 0].map(() => 1 + ((Math.random() * 6) | 0)); return { faces: f, value: f[0] + f[1] + f[2] }; },
    waiting(pl) { return this.p[pl][0]; },
    home(pl) { return this.p[pl][XII_DONE]; },
    done(pl) { return this.p[pl][XII_DONE] === 15; },
    allIn(pl) { const q = this.p[pl]; for (let k = 0; k <= 24; k++) if (q[k]) return false; return true; },
    blocked(pl, k) { return k >= 7 && k <= 30 && this.p[1 - pl][k] >= 2; },
    single(pl, d) {
      const q = this.p[pl], o = this.p[1 - pl], out = [];
      const add = (from, to) => { if (this.blocked(pl, to)) return; out.push({ pl, from, to, die: d, hit: to >= 7 && to <= 30 && o[to] === 1 }); };
      if (q[0]) { add(0, d); if (this.reentry(pl)) return out; } // a taken piece comes back before anything else moves
      const filling = q[0] > 0;
      for (let k = 1; k <= 30; k++) {
        if (!q[k]) continue;
        const to = k + d;
        if (filling && to > 6) continue; // nothing leaves the home row until all fifteen are on
        if (to <= 30) add(k, to);
        else if (to === XII_DONE && this.allIn(pl)) out.push({ pl, from: k, to: XII_DONE, die: d, hit: false });
      }
      return out;
    },
    reentry(pl) { return this.hitOnce[pl] && this.p[pl][0] > 0; }, // a piece that was taken must come back before others move
    doMove(m) { const q = this.p[m.pl]; q[m.from]--; q[m.to]++; if (m.hit) { const o = this.p[1 - m.pl]; o[m.to]--; o[0]++; m.wasHit = this.hitOnce[1 - m.pl]; this.hitOnce[1 - m.pl] = true; } },
    undoMove(m) { const q = this.p[m.pl]; q[m.to]--; q[m.from]++; if (m.hit) { const o = this.p[1 - m.pl]; o[0]--; o[m.to]++; this.hitOnce[1 - m.pl] = m.wasHit; } },
    sequences(pl, dice) {
      let best = [], maxLen = 0; const seen = new Set();
      const rec = (rem, seq) => {
        let any = false; const tried = new Set();
        for (let k = 0; k < rem.length; k++) {
          const d = rem[k]; if (tried.has(d)) continue; tried.add(d);
          for (const m of this.single(pl, d)) { any = true; this.doMove(m); rec(rem.slice(0, k).concat(rem.slice(k + 1)), seq.concat([m])); this.undoMove(m); }
        }
        if (!any && seq.length) {
          const key = this.p[0].join(',') + '|' + this.p[1].join(',') + '|' + seq.map(m => m.from + '>' + m.to).join(' '); // every order stays open to the visitor
          if (seq.length > maxLen) { maxLen = seq.length; best = []; seen.clear(); }
          if (seq.length === maxLen && !seen.has(key)) { seen.add(key); best.push(seq.map(m => Object.assign({}, m))); }
        }
      };
      rec(dice.slice(), []);
      return best;
    },
    firstMoves() {
      const byKey = new Map();
      for (const s of this.turn.seqs) { const m = s[0], k = m.from + '>' + m.to; if (!byKey.has(k)) byKey.set(k, m); }
      return [...byKey.values()];
    },
    legal(pl, value, roll) {
      this.turn = { pl, seqs: this.sequences(pl, roll ? roll.faces : [value]) };
      return this.turn.seqs.length ? this.firstMoves() : [];
    },
    apply(m) {
      this.doMove(m);
      const you = m.pl === 0;
      const note = m.hit ? (you ? 'You take a Scribe\'s piece: it goes back to wait off the board.' : 'The Scribe takes one of your pieces: it goes back to wait off the board.') : '';
      let followUp = null;
      if (this.turn && this.turn.pl === m.pl) {
        this.turn.seqs = this.turn.seqs.filter(s => s[0].from === m.from && s[0].to === m.to && s[0].die === m.die).map(s => s.slice(1)).filter(s => s.length);
        if (this.turn.seqs.length) followUp = this.firstMoves();
      }
      return { note, followUp };
    },
    extra() { return false; },
    final() { const w = this.done(0) ? 0 : 1; return { winner: w, text: w ? `The Scribe bears off all fifteen first. You bore off ${this.home(0)}.` : `You bear off all fifteen first. The Scribe bore off ${this.home(1)}.` }; },
    progress(pl) { const q = this.p[pl]; let s = 0; for (let k = 1; k <= XII_DONE; k++) s += q[k] * k; return s; },
    evaluate(pl) {
      const me = this.p[pl], op = this.p[1 - pl];
      let s = this.progress(pl) - this.progress(1 - pl) + op[0] * 6 * (this.hitOnce[1 - pl] ? 1 : 0.2) + (me[XII_DONE] - op[XII_DONE]) * 14;
      // Bearing off needs exact throws, so pieces spread over the last six spaces use more of each throw;
      // a crowd on the last spaces waits for ones and twos.
      for (let k = 25; k <= 30; k++) s -= Math.max(0, me[k] - 2) * 3 + me[k] * Math.max(0, k - 27) * 1.5;
      for (let k = 7; k <= 30; k++) {
        if (me[k] >= 2) s += 1.5;
        if (me[k] === 1) { // a lone piece the enemy can reach with up to three dice: weigh what it would lose
          let near = 99; for (let b = Math.max(1, k - 18); b < k; b++) if (op[b]) near = Math.min(near, k - b);
          const risk = near <= 6 ? 0.55 : near <= 12 ? 0.3 : near <= 18 ? 0.12 : 0;
          s -= risk * (k + 6);
        }
      }
      return s;
    },
    aiPlan(pl) {
      const seqs = this.turn && this.turn.pl === pl ? this.turn.seqs : [];
      let best = seqs[0], bv = -Infinity;
      for (const seq of seqs) {
        const done = []; for (const m of seq) { const c = Object.assign({}, m); this.doMove(c); done.push(c); }
        const v = this.evaluate(pl) + Math.random() * pick(60, 3, 0);
        for (let k = done.length - 1; k >= 0; k--) this.undoMove(done[k]);
        if (v > bv) { bv = v; best = seq; }
      }
      return best ? best.map(m => Object.assign({}, m)) : [];
    },
  };

