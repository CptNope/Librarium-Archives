  /* ------------------------------------------------------------------ Nard
   * Long nard on a tables board. Like TABLES, c[pl][1..24] counts a player's
   * checkers by distance from home and c[pl][0] those borne off; there is no bar,
   * since nobody hits. Both sides run counterclockwise, so a player's point t is
   * the other's point ndOpp(t). Point 24 is the head, where all fifteen start. */
  const ndOpp = t => (t > 12 ? t - 12 : t + 12);
  const NARD = Object.assign({}, TABLES, {
    id: 'nard', name: 'Nard',
    rules: [
      'All fifteen of your checkers start on your head, the far right point. Both sides race the same way, counterclockwise, the Scribe from the near left corner.',
      'Throw two dice and move one checker by each die, or one checker by both. Doubles are played four times. Use both dice if you can, or the larger if only one can be played.',
      'Nobody hits. A single checker holds its point, and you may not land where the Scribe has any checker.',
      'Only one checker may leave the head each turn. On your first throw, a double 3, 4 or 6 lets two leave.',
      'You may not build six points in a row unless at least one of the Scribe\'s checkers is already past them.',
      'When all fifteen are home, in the near-right quarter, bear them off. The first to bear off all fifteen wins; a win before the loser has borne off any is a mars, worth double.'
    ],
    source: 'Long nard (long nardy) as played across Iran, the Caucasus and Russia, after the rules collected at bkgm.com and Wikipedia.',
    followPrompt: 'Move again with your remaining dice.',
    init() {
      this.c = [Array(26).fill(0), Array(26).fill(0)];
      this.c[0][24] = 15; this.c[1][24] = 15;
      this.turn = null; this.thrown = [0, 0]; this.headUsed = 0; this.headLimit = 1;
    },
    canBearOff(pl) { const c = this.c[pl]; for (let i = 7; i <= 24; i++) if (c[i]) return false; return true; },
    // Six of a player's points in a row are allowed only with an enemy checker already past them.
    primeOK(pl) {
      const c = this.c[pl], o = this.c[1 - pl];
      for (let start = 1; start <= 19; start++) {
        let run = true; for (let k = 0; k < 6; k++) if (!c[start + k]) { run = false; break; }
        if (!run) continue;
        const lowest = Math.min(...[0, 1, 2, 3, 4, 5].map(k => ndOpp(start + k))); // where the block begins in the enemy's count
        let past = false; for (let r = 0; r < lowest; r++) if (o[r]) { past = true; break; } // borne off counts as past
        if (!past) return false;
      }
      return true;
    },
    single(pl, d) {
      const c = this.c[pl], o = this.c[1 - pl], out = [];
      for (let f = 24; f >= 1; f--) {
        if (!c[f]) continue;
        if (f === 24 && this.headUsed >= this.headLimit) continue;
        const t = f - d;
        let m = null;
        if (t >= 1) { if (o[ndOpp(t)]) continue; m = { pl, from: f, to: t, die: d, hit: false }; }
        else {
          if (!this.canBearOff(pl)) continue;
          if (t < 0) { let higher = false; for (let i = f + 1; i <= 6; i++) if (c[i]) { higher = true; break; } if (higher) continue; }
          m = { pl, from: f, to: 0, die: d, hit: false };
        }
        this.doMove(m); const ok = this.primeOK(pl); this.undoMove(m);
        if (ok) out.push(m);
      }
      return out;
    },
    doMove(m) { const c = this.c[m.pl]; c[m.from]--; c[m.to]++; if (m.from === 24) this.headUsed++; },
    undoMove(m) { const c = this.c[m.pl]; c[m.to]--; c[m.from]++; if (m.from === 24) this.headUsed--; },
    legal(pl, value, roll) {
      const dice = roll ? roll.faces : [value, value];
      this.headUsed = 0;
      this.headLimit = !this.thrown[pl] && dice[0] === dice[1] && [3, 4, 6].includes(dice[0]) ? 2 : 1;
      this.thrown[pl]++;
      this.turn = { pl, seqs: this.sequences(pl, dice) };
      return this.turn.seqs.length ? this.firstMoves() : [];
    },
    apply(m) {
      const res = TABLES.apply.call(this, m);
      res.note = m.to === 0 && m.pl === 0 ? 'Borne off.' : '';
      return res;
    },
    final() {
      const w = this.c[0][0] === 15 ? 0 : 1, mars = this.c[1 - w][0] === 0;
      return { winner: w, title: w ? 'The Scribe wins' : 'You win', text: (w ? 'The Scribe bears off all fifteen first' : 'You bear off all fifteen first') + (mars ? ', before the other side has borne off one: a mars, a double win.' : '.') };
    },
    // Race, keep points ahead of the enemy's checkers, and do not leave the head crowded late.
    evaluate(pl) {
      const me = this.c[pl], op = this.c[1 - pl];
      let s = (this.pip(1 - pl) - this.pip(pl)) + me[0] * 4;
      let opBack = 0; for (let r = 24; r >= 1; r--) if (op[r]) { opBack = r; break; } // the enemy's rearmost checker
      let run = 0;
      for (let t = 1; t <= 24; t++) {
        if (!me[t]) { run = 0; continue; }
        run++;
        const ahead = ndOpp(t) < opBack; // the enemy still has to pass this point
        if (ahead) s += 1.2 + Math.min(run, 5) * 0.8;
      }
      s -= Math.max(0, me[24] - 10) * 0.5;
      return s;
    },
  });

