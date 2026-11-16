  /* ------------------------------------------------- The Checkered Game of Life
     Milton Bradley, 1860, as on the Milton Bradley Co. board of about 1911.
     Cells are r * 8 + c, row 0 the far side (Happy Old Age) and row 7 the near
     side (Infancy). Only the squares with (r + c) odd are played on. */
  const CL_SQ = {
    1: ['Wealth', 10], 3: ['Matrimony', 0], 5: ['Gambling', 0, 39], 7: ['Happy Old Age', 50],
    8: ['Perseverance', 0, 23], 10: ['Truth', 0], 12: ['Politics', 0, 24], 14: ['Intemperance', 0, 40],
    17: ['Crime', 0, 62], 19: ['Happiness', 5], 21: ['Idleness', 0, 58], 23: ['Success', 5],
    24: ['Congress', 5], 26: ['Honor', 5], 28: ['Cupid', 0, 3], 30: ['Speculation', 0],
    33: ['Honesty', 0, 19], 35: ['Industry', 0, 1], 37: ['Bravery', 0, 26], 39: ['Ruin', 0],
    40: ['Poverty', 0], 42: ['Ambition', 0, 53], 44: ['College', 5], 46: ['Suicide', 0],
    49: ['School', 0, 44], 51: ['Influence', 0, 55], 53: ['Fame', 0], 55: ['Fat Office', 5],
    56: ['Infancy', 0], 58: ['Disgrace', 0], 60: ['Jail', 0], 62: ['Prison', 0],
  };
  const CL_INFANCY = 56, CL_JAIL = 60, CL_PRISON = 62, CL_SUICIDE = 46, CL_SPEC = 30, CL_WEALTH = 1, CL_RUIN = 39, CL_WIN = 100;
  // What each number of the teetotum allows, as [rows, columns] steps on the board; one "square" is one playing square.
  const CL_MOVES = {
    1: [[-2, 0], [2, 0]], 2: [[0, -2], [0, 2]], 3: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
    4: [[-2, 0], [2, 0], [-4, 0], [4, 0]], 5: [[0, -2], [0, 2], [0, -4], [0, 4]],
    6: [[-1, -1], [-1, 1], [1, -1], [1, 1], [-2, -2], [-2, 2], [2, -2], [2, 2]],
  };
  const CL_SAY = { 1: 'one square up or down', 2: 'one square left or right', 3: 'one square diagonally', 4: 'one or two squares up or down', 5: 'one or two squares left or right', 6: 'one or two squares diagonally' };
  const LIFEGAME = {
    id: 'lifegame', name: 'The Checkered Game of Life', dice: true, pipDice: true, oneDie: true, first: 0, N: 1, extraNote: '',
    SQ: CL_SQ, SAY: CL_SAY,
    rules: [
      'Both players start at Infancy, bottom left. Only the pale squares are played on; the patterned squares between them are not counted.',
      'Spin the teetotum. 1: move one square up or down. 2: one square left or right. 3: one square diagonally. 4: one or two squares up or down. 5: one or two squares left or right. 6: one or two squares diagonally. When there is a choice, you choose.',
      'You can never stop on a square with a pointing hand: it carries you on at once (School to College, Industry to Wealth, Gambling to Ruin, Crime to Prison, and so on).',
      'A square with a number scores it each time you land there: Happy Old Age 50, Wealth 10, and 5 for Happiness, Success, Congress, Honor, College and Fat Office.',
      'Land on the other player\'s square and that counter is sent back to Jail. Prison costs you your next move. From Speculation, your next spin decides: a 3 or a 6 takes you to Wealth, anything else to Ruin.',
      'The square marked Suicide puts a player out of the game. The first to 100 points wins.'
    ],
    source: 'Milton Bradley\'s rules as described in his patent of 1866 (U.S. 53,561), on the board of about 1911 shown here. The patent does not list what each number allows; that table, and the Speculation rule, follow a modern reproduction of the original (Baldwin Games, 2024).',
    init() { this.pos = [CL_INFANCY, CL_INFANCY]; this.score = [0, 0]; this.miss = [0, 0]; this.over = null; },
    roll() { const a = 1 + ((Math.random() * 6) | 0); return { faces: [a], value: a }; },
    rollName(r) { return `${r.value} (${CL_SAY[r.value]})`; },
    who(pl) { return pl === 0 ? 'You' : 'The Scribe'; },
    dests(pl, v) {
      const from = this.pos[pl];
      if (from === CL_SPEC) return [{ pl, from, to: v === 3 || v === 6 ? CL_WEALTH : CL_RUIN, spec: true }];
      const r = from >> 3, c = from & 7, out = [], seen = new Set();
      for (const [dr, dc] of CL_MOVES[v]) {
        const nr = r + dr, nc = c + dc; if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
        const via = nr * 8 + nc, sq = CL_SQ[via], to = sq && sq[2] !== undefined ? sq[2] : via;
        if (seen.has(via)) continue; seen.add(via);
        out.push({ pl, from, via, to, hand: to !== via });
      }
      return out;
    },
    legal(pl, value) { return this.over ? [] : this.dests(pl, value); },
    steps(m) { return m.hand ? [m.via, m.to] : [m.to]; },
    apply(m) {
      const pl = m.pl, o = 1 - pl, me = pl === 0, who = this.who(pl), notes = [], res = { note: '', bumped: null };
      const name = s => CL_SQ[s][0];
      if (m.spec) notes.push(m.to === CL_WEALTH ? `${me ? 'Your' : 'The Scribe\'s'} speculation pays: on to Wealth.` : `${me ? 'Your' : 'The Scribe\'s'} speculation fails: down to Ruin.`);
      else if (m.hand) notes.push(`${name(m.via)} leads ${me ? 'you' : 'the Scribe'} to ${name(m.to)}.`);
      this.pos[pl] = m.to;
      if (m.to !== CL_INFANCY && this.pos[o] === m.to) { this.pos[o] = CL_JAIL; res.bumped = o; notes.push(`${o === 0 ? 'You are' : 'The Scribe is'} sent back to Jail.`); }
      const pts = CL_SQ[m.to][1];
      if (pts) { this.score[pl] += pts; notes.push(`${name(m.to)}: ${me ? 'you score' : 'the Scribe scores'} ${pts} (${this.score[pl]} in all).`); }
      if (m.to === CL_PRISON) { this.miss[pl] = 1; notes.push(`${who} ${me ? 'lose' : 'loses'} the next move in Prison.`); }
      if (m.to === CL_SPEC && !m.spec) notes.push(`Speculation: ${me ? 'your' : 'the Scribe\'s'} next spin decides between Wealth and Ruin.`);
      if (m.to === CL_SUICIDE) { this.over = { winner: o, text: me ? 'Your counter landed on the square marked Suicide, which puts a player out of the game.' : 'The Scribe\'s counter landed on the square marked Suicide, which puts a player out of the game.' }; notes.push(`${who} ${me ? 'are' : 'is'} out of the game.`); }
      else if (this.score[pl] >= CL_WIN) this.over = { winner: pl, text: me ? `You reach ${this.score[pl]} points.` : `The Scribe reaches ${this.score[pl]} points first.` };
      res.note = notes.join(' ');
      return res;
    },
    skipTurn(pl) {
      if (!this.miss[pl]) return '';
      this.miss[pl] = 0;
      return pl === 0 ? 'You lose this move in Prison.' : 'The Scribe loses this move in Prison.';
    },
    extra() { return false; },
    done() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over; },
    home(pl) { return this.score[pl] >= CL_WIN ? 1 : 0; },
    // How good a square is to stand on: its points, the rows above it, and the dangers next to it.
    worth(pl, s) {
      if (s === CL_SUICIDE) return -1000;
      let v = CL_SQ[s][1] * 1.2 + (7 - (s >> 3)) * 0.8;
      if (s === CL_PRISON) v -= 6; if (s === CL_RUIN || s === 40) v -= 2; if (s === CL_JAIL) v -= 2;
      if (s === CL_SPEC) v += 0.5 * 10 * 1.2 / 3 - 1; // a third of spins reach Wealth
      return v;
    },
    aiPlan(pl, moves) {
      if (!moves.length) return [];
      const lvl = LEVEL.name, o = 1 - pl;
      if (lvl === 'gentle' && Math.random() < 0.4) { const safe = moves.filter(m => m.to !== CL_SUICIDE); const pool = safe.length ? safe : moves; return [pool[(Math.random() * pool.length) | 0]]; }
      let best = moves[0], bv = -Infinity;
      for (const m of moves) {
        let v = this.worth(pl, m.to) + (this.pos[o] === m.to && m.to !== CL_INFANCY ? 3 : 0);
        if (this.score[pl] + CL_SQ[m.to][1] >= CL_WIN) v += 500;
        if (lvl === 'sharp') { // and what the next spin could bring from there
          const save = this.pos[pl]; this.pos[pl] = m.to; let ev = 0;
          for (let s = 1; s <= 6; s++) { const ds = this.dests(pl, s); ev += Math.max(...ds.map(d => CL_SQ[d.to][1] * 1.2 - (d.to === CL_SUICIDE ? 30 : 0) + (7 - (d.to >> 3)) * 0.3)) / 6; }
          this.pos[pl] = save; v += 0.7 * ev;
        }
        v += Math.random() * pick(2, 0.3, 0.05);
        if (v > bv) { bv = v; best = m; }
      }
      return [best];
    },
  };

