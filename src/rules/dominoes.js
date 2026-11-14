  /* ---------------------------------------------------------------- Dominoes
   * The two-player Draw game with a double-six set. Tile t is the pair DM_T[t].
   * The line runs left to right; its open ends are ends[0] and ends[1]. The
   * boneyard is shuffled at the deal and drawn from the end. */
  const DM_T = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) DM_T.push([a, b]);
  const DOMINOES = {
    id: 'dominoes', name: 'Dominoes', dice: false, first: 0, TILES: DM_T,
    followPrompt: 'Play a glowing tile, or draw again.',
    rules: [
      'Each of you has seven tiles; the other fourteen lie face down in the boneyard. You lead first, with any tile.',
      'On your turn, play one tile that matches either open end of the line: click it, and if it fits both ends, then the ring at the end you want.',
      'If you cannot play, you must draw from the boneyard until you can. The last two tiles are never drawn: once only two remain, a player who cannot play passes.',
      'The hand ends when someone plays their last tile, or when neither of you can play. The player with fewer pips left in hand wins, and scores the difference (a player who goes out scores all the other\'s pips). Equal pips is a draw.'
    ],
    source: 'The Draw game, the oldest kind of European domino game, as pagat.com gives it for two players. One hand is played here rather than a game to 100.',
    init() {
      const t = Array.from({ length: 28 }, (_, k) => k);
      for (let k = 27; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [t[k], t[j]] = [t[j], t[k]]; }
      this.hands = [t.slice(0, 7), t.slice(7, 14)]; this.yard = t.slice(14);
      this.line = []; this.ends = null; this.passes = 0; this.out = -1; this.ply = 0;
      this.lacks = [new Set(), new Set()]; // numbers a player has shown they hold none of
    },
    pips(pl) { return this.hands[pl].reduce((a, t) => a + DM_T[t][0] + DM_T[t][1], 0); },
    fits(t, v) { return DM_T[t][0] === v || DM_T[t][1] === v; },
    legal(pl) {
      if (this.over()) return [];
      const h = this.hands[pl], out = [];
      if (!this.ends) return h.map(t => ({ pl, kind: 'play', t, side: 1 }));
      for (const t of h) for (const side of [0, 1]) {
        if (!this.fits(t, this.ends[side])) continue;
        if (side === 1 && this.ends[0] === this.ends[1] && this.fits(t, this.ends[0])) continue; // same either way
        out.push({ pl, kind: 'play', t, side });
      }
      if (out.length) return out;
      return this.yard.length > 2 ? [{ pl, kind: 'draw', label: 'Draw a tile' }] : [{ pl, kind: 'pass', label: 'Pass', pass: true }];
    },
    over() { return this.out >= 0 || this.passes >= 2; },
    apply(m) {
      const pl = m.pl, who = pl === 0 ? 'You' : 'The Scribe';
      if (m.kind === 'draw') {
        const t = this.yard.pop(); this.hands[pl].push(t);
        if (this.ends) { this.lacks[pl].add(this.ends[0]); this.lacks[pl].add(this.ends[1]); }
        const r = { note: pl === 0 ? `You draw the ${DM_T[t][0]}–${DM_T[t][1]}.` : 'The Scribe draws a tile.', drew: t };
        if (pl === 0) r.followUp = this.legal(0);
        return r;
      }
      if (m.kind === 'pass') {
        this.passes++; if (this.ends) { this.lacks[pl].add(this.ends[0]); this.lacks[pl].add(this.ends[1]); }
        return { note: pl === 0 ? 'You cannot play, and pass.' : 'The Scribe cannot play, and passes.' };
      }
      const [a, b] = DM_T[m.t]; this.hands[pl].splice(this.hands[pl].indexOf(m.t), 1); this.passes = 0; this.ply++;
      let placed;
      if (!this.ends) { placed = { t: m.t, l: a, r: b }; this.line.push(placed); this.ends = [a, b]; }
      else if (m.side === 0) { const v = this.ends[0], o = a === v ? b : a; placed = { t: m.t, l: o, r: v }; this.line.unshift(placed); this.ends[0] = o; }
      else { const v = this.ends[1], o = a === v ? b : a; placed = { t: m.t, l: v, r: o }; this.line.push(placed); this.ends[1] = o; }
      if (!this.hands[pl].length) this.out = pl;
      return { note: this.out === pl ? `${who} ${pl === 0 ? 'play' : 'plays'} the last tile: domino!` : '', placed, side: m.side };
    },
    result() {
      if (!this.over()) return null;
      const a = this.pips(0), b = this.pips(1);
      if (this.out >= 0) { const w = this.out; return { winner: w, text: w === 0 ? `You go out. You score the Scribe's ${b} pips.` : `The Scribe goes out and scores your ${a} pips.` }; }
      if (a === b) return { winner: -1, text: `Blocked, with ${a} pips each. No one scores.` };
      return { winner: a < b ? 0 : 1, text: `Blocked. Pips left: you ${a}, the Scribe ${b}. ${a < b ? 'You score' : 'The Scribe scores'} ${Math.abs(a - b)}.` };
    },
    snapshot() { return JSON.stringify([this.hands, this.yard, this.line, this.ends, this.passes, this.out, this.ply, [...this.lacks[0]], [...this.lacks[1]]]); },
    restore(s) { const v = JSON.parse(s); [this.hands, this.yard, this.line, this.ends, this.passes, this.out, this.ply] = v; this.lacks = [new Set(v[7]), new Set(v[8])]; },
    // The Scribe's choice of tile, using only what it can see: its hand, the line, and what you have shown you lack.
    choose(pl, ms) {
      if (ms.length === 1 || LEVEL.name === 'gentle') return ms[(Math.random() * ms.length) | 0];
      const h = this.hands[pl], foe = 1 - pl;
      const val = m => {
        const [a, b] = DM_T[m.t]; let v = a + b + (a === b ? 6 : 0);
        if (LEVEL.name === 'sharp') {
          const ends = this.ends ? this.ends.slice() : [a, b];
          if (this.ends) { const s = m.side, o = a === ends[s] ? b : a; ends[s] = o; }
          const rest = h.filter(t => t !== m.t);
          v += 2.5 * ends.reduce((acc, e) => acc + rest.filter(t => this.fits(t, e)).length, 0); // keep plays for later
          v += 5 * ends.filter(e => this.lacks[foe].has(e)).length; // leave ends the visitor cannot match
          // Numbers already showing on the table are scarcer for the visitor too.
          const seen = e => this.line.reduce((acc, x) => acc + (x.l === e) + (x.r === e), 0) + rest.filter(t => this.fits(t, e)).length;
          v += 0.8 * ends.reduce((acc, e) => acc + seen(e), 0);
        }
        return v;
      };
      return ms.reduce((x, y) => (val(y) > val(x) ? y : x));
    },
    aiPlan(pl) {
      const snap = this.snapshot(), plan = [];
      for (let k = 0; k < 30; k++) {
        const ms = this.legal(pl); if (!ms.length) break;
        if (ms[0].kind === 'draw') { plan.push(ms[0]); this.apply(ms[0]); continue; }
        plan.push(ms[0].kind === 'pass' ? ms[0] : this.choose(pl, ms)); break;
      }
      this.restore(snap);
      return plan;
    },
  };

