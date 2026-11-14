  /* -------------------------------------------------- The Mansion of Happiness
     W. & S. B. Ives, Salem, 1843: 67 squares on a spiral, read from a scan of
     the board, played by the rules printed with the game. */
  const MH_SQ = {
    1: ['Justice', 'plain'], 2: ['Piety', 'virtue'], 4: ['Honesty', 'virtue'], 6: ['The Water', 'water'], 7: ['Audacity', 'vice'],
    9: ['The Inn', 'inn'], 11: ['Poverty', 'place'], 13: ['Temperance', 'virtue'], 14: ['Passion', 'crime'], 15: ['Gratitude', 'virtue'],
    17: ['Idleness', 'crime'], 18: ['Prudence', 'virtue'], 20: ['Cruelty', 'vice'], 22: ['Whipping Post', 'place'], 23: ['Truth', 'virtue'],
    25: ['Immodesty', 'vice'], 26: ['Road to Folly', 'crime'], 28: ['Sabbath Breaker', 'crime'], 30: ['House of Correction', 'jail'],
    31: ['Chastity', 'virtue'], 33: ['Sincerity', 'virtue'], 34: ['A Cheat', 'crime'], 36: ['The Pillory', 'place'], 38: ['Humility', 'virtue'],
    40: ['The Stocks', 'place'], 42: ['Industry', 'virtue'], 43: ['A Perjurer', 'crime'], 45: ['Charity', 'virtue'], 47: ['A Drunkard', 'crime'],
    50: ['Prison', 'place'], 52: ['Humanity', 'virtue'], 54: ['Generosity', 'virtue'], 55: ['Ruin', 'place'], 57: ['A Robber', 'crime'],
    60: ['Seat of Expectation', 'plain'], 61: ['Ingratitude', 'vice'], 63: ['Summit of Dissipation', 'crime'], 67: ['The Mansion of Happiness', 'goal'],
  };
  const MH_BLANK = [11, 22, 36, 40, 50, 55]; // places one is sent to, never counted when moving
  // Where each crime sends you, how many turns you stay, and whether you then begin again.
  const MH_CRIME = { 14: [6, 0], 17: [11, 0], 26: [18, 0], 28: [22, 0], 34: [30, 1, true], 43: [36, 0], 47: [40, 0], 57: [50, 2, true], 63: [55, 0] };
  const MH_SAY = {
    14: 'off to the Water for a ducking', 17: 'off to Poverty', 26: 'back to Prudence', 28: 'off to the Whipping Post',
    34: 'a month in the House of Correction, then back to the beginning', 43: 'into the Pillory', 47: 'into the Stocks',
    57: 'two months in Prison, then back to the beginning', 63: 'down to Ruin',
  };
  const MANSION = {
    id: 'mansion', name: 'The Mansion of Happiness', dice: true, pipDice: true, oneDie: true, autoMove: true, first: 0, N: 1, extraNote: 'Spin again.',
    SQ: MH_SQ, BLANK: MH_BLANK,
    rules: [
      'Spin the teetotum and move your counter that many squares along the spiral toward the Mansion of Happiness at its centre. Poverty, the Whipping Post, the Pillory, the Stocks, Prison and Ruin are not counted: you only go there when found guilty.',
      'Land on a virtue (Piety, Honesty, Temperance, Gratitude, Prudence, Truth, Chastity, Sincerity, Humility, Industry, Charity, Humanity, Generosity) and advance six more squares.',
      'Land on Audacity, Cruelty, Immodesty or Ingratitude and go back to where you were.',
      'The Water (6) carries you on to 10, and the Inn (9) on to 12.',
      'The guilty are punished: Passion to the Water, Idleness to Poverty, the Road to Folly back to Prudence, a Sabbath Breaker to the Whipping Post, a Perjurer to the Pillory, a Drunkard to the Stocks, the Summit of Dissipation to Ruin. A Cheat spends a month (a turn) in the House of Correction and a Robber two in Prison; both then begin again, unless another player guilty of the same crime sets them free sooner.',
      'Land where another counter stands and it goes back to the square you came from.',
      'Reach 67 by an exact count to win. Overshoot and you go back to the Seat of Expectation (60); overshoot again and you begin again.'
    ],
    source: 'The rules printed with the game (as reprinted for the 1894 edition), with every square read from the 1843 Ives board. Two clauses about crimes committed on an occupied square are left out, and the six squares a virtue gives you do not set off the square they reach.',
    init() { this.pos = [0, 0]; this.jail = [0, 0]; this.over = [false, false]; this.won = null; },
    roll() { const a = 1 + ((Math.random() * 6) | 0); return { faces: [a], value: a }; },
    count(from, n) { // n counted squares forward, skipping the places one is only sent to; returns [square, path] or null past 67
      let at = from; const path = [];
      while (n > 0) { at++; if (at > 67) return null; if (MH_BLANK.includes(at)) continue; path.push(at); n--; }
      return [at, path];
    },
    who(pl) { return pl === 0 ? 'You' : 'The Scribe'; },
    plan(pl, roll) {
      const from = this.pos[pl], v = roll.value, notes = [], me = pl === 0, who = this.who(pl);
      const m = { pl, from, path: [], to: from, jail: 0, again: false, bump: null, restart: false };
      const c = this.count(from, v);
      if (!c) {
        if (this.over[pl]) { m.to = 0; m.restart = true; m.overshoot = 2; notes.push(`${who} ${me ? 'overshoot' : 'overshoots'} the Mansion again and ${me ? 'begin' : 'begins'} again.`); }
        else { m.to = 60; m.overshoot = 1; notes.push(`${who} ${me ? 'overshoot' : 'overshoots'} the Mansion, and ${me ? 'go' : 'goes'} back to the Seat of Expectation.`); }
        m.path = [m.to]; m.notes = notes; return m;
      }
      let [at, path] = c; m.path = path;
      const sq = MH_SQ[at], kind = sq ? sq[1] : '';
      if (kind === 'virtue') { const d = this.count(at, 6); notes.push(`${sq[0]}! ${who} ${me ? 'advance' : 'advances'} six.`); if (d) { at = d[0]; m.path = path.concat(d[1]); } }
      else if (kind === 'vice') { notes.push(`${sq[0]}: ${me ? 'you go' : 'the Scribe goes'} back to where ${me ? 'you were' : 'it was'}.`); at = from; m.path = path.concat(from || []); }
      else if (kind === 'water') { notes.push(`The Water carries ${me ? 'you' : 'the Scribe'} on to 10.`); at = 10; m.path = path.concat(10); }
      else if (kind === 'inn') { notes.push(`${who} ${me ? 'rest' : 'rests'} at the Inn and ${me ? 'go' : 'goes'} on to 12.`); at = 12; m.path = path.concat(12); }
      else if (kind === 'crime') { const [to, turns, again] = MH_CRIME[at]; notes.push(`${sq[0]}! ${me ? 'You go' : 'The Scribe goes'} ${MH_SAY[at]}.`); at = to; m.path = path.concat(to); m.jail = turns; m.restart = !!again; }
      else if (at === 67) notes.push(me ? 'You reach the Mansion of Happiness!' : 'The Scribe reaches the Mansion of Happiness.');
      m.to = at;
      const o = 1 - pl;
      if (at !== 0 && at !== 67 && this.pos[o] === at) {
        if (this.jail[o] && m.jail) { m.free = true; notes.push(`${o === 0 ? 'You are' : 'The Scribe is'} set free, to begin again.`); }
        else if (this.jail[o]) { notes.push(`${me ? 'You cannot' : 'The Scribe cannot'} free the prisoner there, so ${me ? 'you go back and spin' : 'it goes back and spins'} again.`); m.to = from; m.path = m.path.concat(from || []); m.again = true; }
        else { m.bump = from; notes.push(`${o === 0 ? 'You are' : 'The Scribe is'} sent back to ${from || 'the start'}.`); }
      }
      m.notes = notes; return m;
    },
    legal(pl, value, roll) { return this.won ? [] : [this.plan(pl, roll || { faces: [value], value })]; },
    steps(m) { return m.path; },
    apply(m) {
      const pl = m.pl, o = 1 - pl;
      this.pos[pl] = m.to; this.jail[pl] = m.jail;
      if (m.overshoot === 1) this.over[pl] = true; if (m.overshoot === 2) this.over[pl] = false;
      if (m.bump !== null && m.bump !== undefined) this.pos[o] = m.bump;
      if (m.free) { this.jail[o] = 0; this.pos[o] = 0; }
      if (m.to === 67) this.won = { winner: pl, text: pl === 0 ? 'You have reached the Mansion of Happiness.' : 'The Scribe reached the Mansion of Happiness first.' };
      return { moved: [], note: m.notes.join(' '), bumped: m.bump !== null && m.bump !== undefined ? o : null, freed: m.free ? o : null };
    },
    // A player serving a sentence misses turns; when it is served, the counter goes back to the start.
    skipTurn(pl) {
      if (!this.jail[pl]) return '';
      const where = this.pos[pl] === 30 ? 'the House of Correction' : 'Prison';
      this.jail[pl]--;
      if (this.jail[pl]) return pl === 0 ? `You serve a month in ${where}.` : `The Scribe serves a month in ${where}.`;
      this.pos[pl] = 0; this.over[pl] = false;
      return pl === 0 ? `You serve your time in ${where}, and begin the game again.` : `The Scribe serves its time in ${where}, and begins again.`;
    },
    extra(m) { return !!m && m.again && !this.won; },
    done() { return !!this.won; },
    final() { return this.won; },
    result() { return this.won; },
    home(pl) { return this.pos[pl] === 67 ? 1 : 0; },
    aiPlan(pl, moves) { return [moves[0]]; },
  };

