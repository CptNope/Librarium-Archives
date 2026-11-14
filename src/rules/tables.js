  /* ----------------------------------------------------- Tables (backgammon)
   * Each player counts points from their own side: 24 is where they start,
   * 1-6 is their home board, 25 is the bar and 0 is borne off. A player's
   * point p is the opponent's point 25 - p. A turn is a sequence of single
   * moves; legal() works out every full sequence, and apply() narrows them
   * as moves are made, returning the next choices as a follow-up. */
  const TABLES = {
    id: 'tables', name: 'Tables', dice: true, pipDice: true, first: 0, N: 15, sides: ['pale checkers', 'dark checkers'],
    rules: [
      'Throw two dice and move one checker by each die, or one checker by both. Doubles are played four times.',
      'Your checkers travel counterclockwise toward your home board in the near-right quarter.',
      'You may not land on a point held by two or more of the Scribe\'s checkers. Land on a single one to hit it and send it to the bar.',
      'A checker on the bar must come back in through the Scribe\'s home board before you move anything else.',
      'You must use both dice if you can. If only one can be used, use the larger if possible.',
      'When all fifteen are in your home board, start bearing them off. The first to bear off all fifteen wins.'
    ],
    source: 'Modern backgammon rules without the doubling cube. Roman tabula used three dice and probably different starting rules.',
    followPrompt: 'Move again with your remaining dice.',
    extraNote: '',
    init() {
      this.c = [Array(26).fill(0), Array(26).fill(0)];
      for (const pl of [0, 1]) { const c = this.c[pl]; c[24] = 2; c[13] = 5; c[8] = 3; c[6] = 5; }
      this.turn = null;
    },
    roll() { const a = 1 + ((Math.random() * 6) | 0), b = 1 + ((Math.random() * 6) | 0); return { faces: [a, b], value: a + b }; },
    pip(pl) { let s = 0; for (let i = 1; i <= 25; i++) s += this.c[pl][i] * i; return s; },
    canBearOff(pl) { const c = this.c[pl]; for (let i = 7; i <= 25; i++) if (c[i]) return false; return true; },
    single(pl, d) {
      const c = this.c[pl], o = this.c[1 - pl], out = [];
      const froms = [];
      if (c[25]) froms.push(25); else for (let i = 24; i >= 1; i--) if (c[i]) froms.push(i);
      for (const f of froms) {
        const t = f - d;
        if (t >= 1) { const oc = o[25 - t]; if (oc >= 2) continue; out.push({ pl, from: f, to: t, die: d, hit: oc === 1 }); }
        else {
          if (!this.canBearOff(pl)) continue;
          if (t < 0) { let higher = false; for (let i = f + 1; i <= 6; i++) if (c[i]) { higher = true; break; } if (higher) continue; }
          out.push({ pl, from: f, to: 0, die: d, hit: false });
        }
      }
      return out;
    },
    doMove(m) { const c = this.c[m.pl], o = this.c[1 - m.pl]; c[m.from]--; c[m.to]++; if (m.hit) { o[25 - m.to]--; o[25]++; } },
    undoMove(m) { const c = this.c[m.pl], o = this.c[1 - m.pl]; c[m.to]--; c[m.from]++; if (m.hit) { o[25]--; o[25 - m.to]++; } },
    sequences(pl, dice) {
      const dl = dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [dice[0], dice[1]];
      let best = [], maxLen = 0;
      const seen = new Set();
      const rec = (remaining, seq) => {
        let any = false; const tried = new Set();
        for (let k = 0; k < remaining.length; k++) {
          const d = remaining[k]; if (tried.has(d)) continue; tried.add(d);
          for (const m of this.single(pl, d)) {
            any = true; this.doMove(m);
            rec(remaining.slice(0, k).concat(remaining.slice(k + 1)), seq.concat([m]));
            this.undoMove(m);
          }
        }
        if (!any && seq.length) {
          const key = this.c[0].join(',') + '|' + this.c[1].join(',') + '|' + seq.map(m => m.from + '>' + m.to + ':' + m.die).join(' ');
          if (seq.length > maxLen) { maxLen = seq.length; best = []; }
          if (seq.length === maxLen && !seen.has(key)) { seen.add(key); best.push(seq); }
        }
      };
      rec(dl, []);
      if (dice[0] !== dice[1] && maxLen === 1) {
        const hi = Math.max(dice[0], dice[1]);
        if (best.some(s => s[0].die === hi)) best = best.filter(s => s[0].die === hi);
      }
      return best;
    },
    firstMoves() {
      const byKey = new Map();
      for (const s of this.turn.seqs) {
        const m = s[0], k = m.from + '>' + m.to;
        const prev = byKey.get(k);
        if (!prev || m.die < prev.die) byKey.set(k, m);
      }
      return [...byKey.values()];
    },
    legal(pl, value, roll) {
      this.turn = { pl, seqs: this.sequences(pl, roll ? roll.faces : [value, value]) };
      return this.turn.seqs.length ? this.firstMoves() : [];
    },
    apply(m) {
      this.doMove(m);
      let note = '';
      if (m.hit) note = m.pl === 0 ? 'You hit one of the Scribe\'s checkers. It goes to the bar.' : 'The Scribe hits your checker. It goes to the bar.';
      else if (m.to === 0) note = m.pl === 0 ? 'Borne off.' : '';
      let followUp = null;
      if (this.turn && this.turn.pl === m.pl) {
        this.turn.seqs = this.turn.seqs.filter(s => s[0].from === m.from && s[0].to === m.to && s[0].die === m.die).map(s => s.slice(1)).filter(s => s.length);
        if (this.turn.seqs.length) followUp = this.firstMoves();
      }
      return { note, followUp, moved: [] };
    },
    extra() { return false; },
    done(pl) { return this.c[pl][0] === 15; },
    home(pl) { return this.c[pl][0]; },
    evaluate(pl) {
      const me = this.c[pl], op = this.c[1 - pl];
      let s = (this.pip(1 - pl) - this.pip(pl)) + me[0] * 3 + op[25] * 9;
      // Is there still contact? Find my rearmost checker and the opponent's rearmost (in my numbering).
      let myBack = 0; for (let i = 25; i >= 1; i--) if (me[i]) { myBack = i; break; }
      let opBack = 25; for (let i = 25; i >= 1; i--) if (op[i]) { opBack = 25 - i; break; }
      const contact = myBack > opBack;
      if (!contact) return s;
      let run = 0;
      for (let i = 1; i <= 24; i++) {
        if (me[i] >= 2) { s += i <= 7 ? 4 : 1.5; run++; if (run >= 3) s += run; } else run = 0;
        if (me[i] === 1) {
          // Opponent checkers that sit "below" this point in my numbering can hit it moving upward.
          let direct = 0, indirect = 0;
          for (let p = 0; p < i; p++) {
            const n = p === 0 ? op[25] : op[25 - p];
            if (!n) continue;
            const dist = i - p;
            if (dist <= 6) direct++; else if (dist <= 12) indirect++;
          }
          s -= (direct ? 6 : 0) + (indirect ? 2 : 0) + (i <= 6 ? 2 : 0) * (direct ? 1 : 0);
        }
      }
      return s;
    },
    aiPlan(pl) {
      const seqs = this.turn && this.turn.pl === pl ? this.turn.seqs : [];
      let best = seqs[0], bv = -Infinity;
      for (const seq of seqs) {
        for (const m of seq) this.doMove(m);
        const v = this.evaluate(pl) + Math.random() * pick(14, 0.3, 0);
        for (let k = seq.length - 1; k >= 0; k--) this.undoMove(seq[k]);
        if (v > bv) { bv = v; best = seq; }
      }
      return best ? best.slice() : [];
    },
  };

