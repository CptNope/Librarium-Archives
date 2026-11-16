  /* ---------------------------------------------------------------- Hazard
   * Two players, each with a purse of shillings. The caster stakes, calls a main
   * from 5 to 9, and throws two dice; the other player sets (covers) the stake.
   * The caster keeps the dice until losing three times running. */
  const HZ_START = 10, HZ_ROUNDS = 24, HZ_STAKES = [1, 2, 5];
  const HAZARD = {
    id: 'hazard', name: 'Hazard', dice: true, pipDice: true, first: 0, autoMove: true,
    N: 0, STAKES: HZ_STAKES, ROUNDS: HZ_ROUNDS,
    rules: [
      'You each begin with ten shillings. Whoever casts stakes 1, 2 or 5 shillings, which the other covers, then calls a main: any number from 5 to 9.',
      'On the first throw of two dice, the main wins (a nick). So does 11 with a main of 7, and 12 with a main of 6 or 8. A 2 or 3 always loses (throwing out), and so does any other 11 or 12.',
      'Any other total becomes your chance. Keep throwing: the chance wins, the main loses, and anything else is thrown again.',
      'The caster keeps the dice until losing three times in a row; then they pass. The game ends when a purse is empty, or after 24 mains, when the fuller purse wins.'
    ],
    source: 'English hazard as Hoyle\'s Games set it down by 1790. The bank\'s side bets and odds on the chance are left out: every cast is an even-money stake.',
    get followPrompt() { return 'Now call your main.'; },
    get extraNote() { return this.pending ? `Throw again: you need ${this.chance} before ${this.main}.` : ''; },
    init() {
      this.purse = [HZ_START, HZ_START]; this.caster = 0; this.losses = 0; this.rounds = 0;
      this.stage = 'stake'; this.stake = 0; this.main = 0; this.chance = 0; this.pending = false; this.over = null; this.last = null;
      this.human = [true, false]; // seats a person plays (the hall sets the second for a game against a friend)
    },
    roll() { const a = 1 + ((Math.random() * 6) | 0), b = 1 + ((Math.random() * 6) | 0); return { faces: [a, b], value: a + b }; },
    who(pl, cap) { return pl === 0 ? (cap ? 'You' : 'you') : 'the Scribe'; },
    maxStake() { return Math.min(this.purse[this.caster], this.purse[1 - this.caster]); },
    preThrow(pl) {
      if (this.over || pl !== this.caster) return null;
      if (this.stage === 'stake') return HZ_STAKES.filter(n => n <= this.maxStake()).concat(this.maxStake() < 5 && !HZ_STAKES.includes(this.maxStake()) ? [this.maxStake()] : [])
        .map(n => ({ pl, pre: true, kind: 'stake', n, label: `Stake ${n} shilling${n > 1 ? 's' : ''}` }));
      if (this.stage === 'main') return [5, 6, 7, 8, 9].map(n => ({ pl, pre: true, kind: 'main', n, label: `Main ${n}` }));
      return null;
    },
    legal(pl, value, roll) { return this.stage === 'throw' && pl === this.caster ? [{ pl, kind: 'throw', value, faces: roll ? roll.faces : null }] : []; },
    nick(main, v) { return v === main || (v === 11 && main === 7) || (v === 12 && (main === 6 || main === 8)); },
    out(main, v) { return v === 2 || v === 3 || ((v === 11 || v === 12) && !this.nick(main, v)); },
    apply(m) {
      const pl = m.pl, Y = pl === 0;
      if (m.kind === 'stake') { this.stake = m.n; this.stage = 'main'; return { note: Y ? `You stake ${m.n}.` : `The Scribe stakes ${m.n} shilling${m.n > 1 ? 's' : ''}.`, followUp: this.human[pl] ? this.preThrow(pl) : null }; }
      if (m.kind === 'main') { this.main = m.n; this.stage = 'throw'; this.pending = false; return { note: Y ? `Your main is ${m.n}.` : `The Scribe calls a main of ${m.n}.`, thenThrow: true }; }
      const v = m.value;
      if (!this.pending) {
        if (this.nick(this.main, v)) return this.settle(true, `${v}: a nick!`);
        if (this.out(this.main, v)) return this.settle(false, `${v}: thrown out.`);
        this.chance = v; this.pending = true;
        return { note: `${v}: ${Y ? 'your' : 'the Scribe\'s'} chance is ${v}, against a main of ${this.main}.` };
      }
      if (v === this.chance) return this.settle(true, `${v}: the chance comes up.`);
      if (v === this.main) return this.settle(false, `${v}: the main comes up first.`);
      return { note: `${v}.` };
    },
    settle(won, what) {
      const c = this.caster, s = this.stake, Y = c === 0;
      this.purse[c] += won ? s : -s; this.purse[1 - c] -= won ? s : -s;
      this.pending = false; this.stage = 'stake'; this.rounds++; this.last = { won, caster: c };
      let note = `${what} ${Y ? (won ? `You win ${s}.` : `You lose ${s}.`) : (won ? `The Scribe wins ${s}.` : `The Scribe loses ${s}.`)}`;
      this.losses = won ? 0 : this.losses + 1;
      if (this.losses === 3) { this.caster = 1 - c; this.losses = 0; note += Y ? ' Three losses running: the dice pass to the Scribe.' : ' Three losses running: the dice pass to you.'; }
      if (!this.purse[0]) this.over = { winner: 1, text: 'Your purse is empty. The Scribe sweeps up the shillings.' };
      else if (!this.purse[1]) this.over = { winner: 0, text: 'The Scribe\'s purse is empty. You win every shilling.' };
      else if (this.rounds >= HZ_ROUNDS) {
        const [a, b] = this.purse;
        this.over = { winner: a > b ? 0 : b > a ? 1 : -1, title: a > b ? 'You win' : b > a ? 'The Scribe wins' : 'Even purses', text: `After ${HZ_ROUNDS} mains you have ${a} shillings and the Scribe ${b}.` };
      }
      return { note, settled: true };
    },
    extra() { return this.pending && !this.over; },
    done() { return !!this.over; },
    ended() { return !!this.over; },
    final() { return this.over; },
    home() { return 0; },
    passTurn() { return this.caster; },
    // The Scribe calls 7, the main with the smallest disadvantage; Gentle calls any main.
    // Staking: the caster always has the worse of the bet, so Sharp stakes little unless it must catch up.
    aiPre(pl) {
      const max = this.maxStake(), opts = HZ_STAKES.filter(n => n <= max);
      if (!opts.length) opts.push(max);
      const left = HZ_ROUNDS - this.rounds, behind = this.purse[1 - pl] - this.purse[pl];
      const stake = LEVEL.name === 'gentle' ? opts[(Math.random() * opts.length) | 0]
        : LEVEL.name === 'sharp' ? (behind > 0 && left < 6 ? opts[opts.length - 1] : opts[0])
          : opts[Math.min(1, opts.length - 1)];
      const main = LEVEL.name === 'gentle' ? 5 + ((Math.random() * 5) | 0) : 7;
      return [{ pl, pre: true, kind: 'stake', n: stake }, { pl, pre: true, kind: 'main', n: main }];
    },
    aiPlan(pl, moves) { return [moves[0]]; },
  };

