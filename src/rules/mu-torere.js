  /* --------------------------------------------------------------- Mū tōrere
   * Eight kewai (the arms of a star, 0-7 round the circle) and the pūtahi in
   * the centre (8). Four men each; with nine points and eight men there is
   * always exactly one empty point, and every move goes into it. */
  const MT_CENTRE = 8;
  const MUTORERE = {
    id: 'mutorere', name: 'Mū tōrere', dice: false, first: 0, CENTRE: MT_CENTRE,
    rules: [
      'You play the light stones and move first. There is always exactly one empty point, and every move fills it.',
      'A man on an arm may move to a neighbouring arm, or into the centre. A man in the centre may move out to the empty arm.',
      'A man may move into the centre only if it stands next to one of the Scribe\'s men.',
      'Block the Scribe so it has no move, and you win.',
      'House rule: after thirty moves each the game is drawn. With perfect play mū tōrere is a draw.'
    ],
    source: 'Accounts of the rules differ. The rule for entering the centre used here is the one most often given today; without it the first player can win at once.',
    init() { this.b = [2, 2, 2, 2, 1, 1, 1, 1, 0]; this.ply = 0; },
    empty() { return this.b.indexOf(0); },
    legal(pl) {
      const me = pl + 1, e = this.empty(), out = [];
      if (e === MT_CENTRE) {
        for (let i = 0; i < 8; i++) if (this.b[i] === me && (this.b[(i + 7) % 8] === 3 - me || this.b[(i + 1) % 8] === 3 - me)) out.push({ pl, from: i, to: e });
      } else {
        for (const i of [(e + 7) % 8, (e + 1) % 8, MT_CENTRE]) if (this.b[i] === me) out.push({ pl, from: i, to: e });
      }
      return out;
    },
    apply(m) { this.b[m.to] = this.b[m.from]; this.b[m.from] = 0; this.ply++; return { note: '' }; },
    result(pl) {
      if (!this.legal(pl).length) return { winner: 1 - pl, text: pl === 0 ? 'Your men are blocked: you have no move.' : 'The Scribe is blocked and cannot move.' };
      if (this.ply >= 60) return { winner: -1, text: 'Thirty moves each and no one blocked. The game is drawn.' };
      return null;
    },
    snapshot() { return [this.b.slice(), this.ply]; },
    restore(s) { this.b = s[0].slice(); this.ply = s[1]; },
    turns(pl) { return this.legal(pl).map(m => [m]); },
    terminal(pl, depth) { if (!this.legal(pl).length) return -1000 - depth; if (this.ply >= 60) return 0; return null; },
    evaluate(pl) {
      // Room to move, and a man in the centre is worth having.
      const opp = 1 - pl; let s = 0;
      s += this.b[MT_CENTRE] === pl + 1 ? 1.5 : this.b[MT_CENTRE] === opp + 1 ? -1.5 : 0;
      return s;
    },
    aiPlan(pl, depth) { return bestPlan(this, pl, depth, 16); },
  };

