  /* ------------------------------------------------------ Four Seasons chess
     Alfonso X's acedrex de los quatro tiempos (1283): four armies in the four
     corners of an 8 x 8 board. Cells are y * 8 + x, x the file from the
     visitor's left (a), y the rank away from the visitor (1). A cell holds 0 or
     owner << 5 | pawn direction << 3 | type. The visitor is Red, in a1. */
  const FS_K = 1, FS_R = 2, FS_N = 3, FS_B = 4, FS_P = 5, FS_G = 6;
  const FS_VAL = [0, 0, 5, 3, 1.5, 1, 2];
  const FS_NAME = ['', 'king', 'rook', 'knight', 'alfil', 'pawn', 'general'];
  const FS_SEAT = ['Red', 'Black', 'White', 'Green'];
  const FS_SEASON = ['summer', 'autumn', 'winter', 'spring'];
  const FS_DIR = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // up, right, down, left
  // [x, y, type, pawn direction] for each army: Red a1, Black h1, White h8, Green a8
  const FS_SETUP = [
    [[0, 0, FS_K], [1, 0, FS_R], [0, 1, FS_N], [1, 1, FS_B], [0, 2, FS_P, 0], [1, 2, FS_P, 0], [2, 0, FS_P, 1], [2, 1, FS_P, 1]],
    [[7, 0, FS_K], [6, 0, FS_R], [7, 1, FS_N], [6, 1, FS_B], [6, 2, FS_P, 0], [7, 2, FS_P, 0], [5, 0, FS_P, 3], [5, 1, FS_P, 3]],
    [[7, 7, FS_K], [6, 7, FS_R], [7, 6, FS_N], [6, 6, FS_B], [7, 5, FS_P, 2], [6, 5, FS_P, 2], [5, 7, FS_P, 3], [5, 6, FS_P, 3]],
    [[0, 7, FS_K], [1, 7, FS_R], [0, 6, FS_N], [1, 6, FS_B], [0, 5, FS_P, 2], [1, 5, FS_P, 2], [2, 7, FS_P, 1], [2, 6, FS_P, 1]],
  ];
  const FS_ROUNDS = 60;
  const fsIn = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;
  const FS_KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const FS_K8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const FS_DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const FS_ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const FOURSEASONS = {
    id: 'fourseasons', name: 'Four Seasons Chess', dice: false, SEATS: FS_SEAT, ROUNDS: FS_ROUNDS, NAME: FS_NAME,
    get first() { return this.seat === 0 ? 0 : 1; },
    rules: [
      'Four armies, one in each corner, each for itself. You are Red, summer, in the corner nearest your left hand. Green (spring) moves first, then play goes round: you, Black (autumn), White (winter).',
      'The king, rook and knight move as in chess. The alfil jumps exactly two squares diagonally, over anything between. Pawns step one square straight ahead, never two, and take one square diagonally ahead; two of your pawns march up the board and two across it.',
      'A pawn that reaches the edge of the board becomes a general, which moves one square diagonally.',
      'You may not leave your king in check from any army.',
      'A player who is checkmated is out: the king is removed and the whole army passes to the player who gave the mate. A player left with no move but not in check is stalemated: the whole army is removed. Taking a king counts as a mate.',
      'The last player left wins. If you are mated or stalemated you lose. After 60 rounds, the strongest army still in play wins (rook 5, knight 3, general 2, alfil 1½, pawn 1).'
    ],
    source: 'After the Libro de los juegos of Alfonso X (1283), as described by H. J. R. Murray and Hans Bodlaender. The game is played without dice, the diagonals in the centre of the board are decoration, and the 60-round limit is ours.',
    init() {
      this.b = new Int16Array(64);
      FS_SETUP.forEach((army, s) => army.forEach(([x, y, t, d]) => { this.b[y * 8 + x] = (s << 5) | ((d || 0) << 3) | t; }));
      this.alive = [true, true, true, true]; this.seat = 3; this.round = 1; this.over = null; this.news = '';
    },
    own(v) { return v >> 5; }, type(v) { return v & 7; }, dir(v) { return (v >> 3) & 3; },
    kingOf(s) { for (let i = 0; i < 64; i++) { const v = this.b[i]; if (v && (v >> 5) === s && (v & 7) === FS_K) return i; } return -1; },
    // Squares a piece attacks or moves to. Pawns: 'cap' squares only when capture is true.
    pmoves(i, out, attacksOnly) {
      const v = this.b[i], s = v >> 5, t = v & 7, x = i & 7, y = i >> 3;
      const add = (nx, ny, mode) => { // mode: 0 move or take, 1 move only, 2 take only
        if (!fsIn(nx, ny)) return; const j = ny * 8 + nx, w = this.b[j];
        if (attacksOnly) { if (mode !== 1) out.push(j); return; }
        if (w && (w >> 5) === s) return;
        if (mode === 1 && w) return; if (mode === 2 && !w) return;
        out.push(j);
      };
      if (t === FS_K) for (const [dx, dy] of FS_K8) add(x + dx, y + dy, 0);
      else if (t === FS_N) for (const [dx, dy] of FS_KN) add(x + dx, y + dy, 0);
      else if (t === FS_B) for (const [dx, dy] of FS_DIAG) add(x + 2 * dx, y + 2 * dy, 0);
      else if (t === FS_G) for (const [dx, dy] of FS_DIAG) add(x + dx, y + dy, 0);
      else if (t === FS_R) for (const [dx, dy] of FS_ORTH) {
        let nx = x + dx, ny = y + dy;
        while (fsIn(nx, ny)) { const w = this.b[ny * 8 + nx]; add(nx, ny, 0); if (w) break; nx += dx; ny += dy; }
      } else if (t === FS_P) {
        const [dx, dy] = FS_DIR[(v >> 3) & 3];
        add(x + dx, y + dy, 1);
        if (dx) { add(x + dx, y + 1, 2); add(x + dx, y - 1, 2); } else { add(x + 1, y + dy, 2); add(x - 1, y + dy, 2); }
      }
    },
    attackedBy(i, s) { // seats (other than s, still in play) attacking square i
      const who = new Set(), sq = [];
      for (let j = 0; j < 64; j++) {
        const v = this.b[j]; if (!v) continue; const o = v >> 5;
        if (o === s || !this.alive[o] || who.has(o)) continue;
        sq.length = 0; this.pmoves(j, sq, true);
        if (sq.includes(i)) who.add(o);
      }
      return who;
    },
    inCheck(s) { const k = this.kingOf(s); return k >= 0 && this.attackedBy(k, s).size > 0; },
    raw(s) {
      const out = [];
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v || (v >> 5) !== s) continue;
        const t = []; this.pmoves(i, t, false);
        for (const j of t) out.push({ seat: s, from: i, to: j, cap: this.b[j] || 0 });
      }
      return out;
    },
    movesOf(s) {
      return this.raw(s).filter(m => {
        const v = this.b[m.from], w = this.b[m.to];
        this.b[m.to] = v; this.b[m.from] = 0;
        const ok = !this.inCheck(s);
        this.b[m.from] = v; this.b[m.to] = w;
        return ok;
      });
    },
    legal(pl) { if (this.over) return []; const s = pl === 0 ? 0 : this.seat; return this.movesOf(s).map(m => Object.assign(m, { pl })); },
    who(s) { return s === 0 ? 'You' : FS_SEAT[s]; },
    whose(s) { return s === 0 ? 'your' : FS_SEAT[s] + '\'s'; },
    // Hand an army to the player who beat it (its king gone), or clear it from the board.
    fall(s, to, words) {
      this.alive[s] = false;
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v || (v >> 5) !== s) continue;
        if (to < 0 || (v & 7) === FS_K) this.b[i] = 0; else this.b[i] = (to << 5) | (v & 31);
      }
      return words;
    },
    settle(mover, notes, events) {
      for (let pass = 0; pass < 4; pass++) {
        let changed = false;
        for (const s of [1, 2, 3, 0].map(k => (mover + k) % 4)) {
          if (!this.alive[s] || s === mover) continue;
          if (this.kingOf(s) < 0) continue;
          if (this.movesOf(s).length) continue;
          const att = this.attackedBy(this.kingOf(s), s);
          if (att.size) {
            const by = att.has(mover) ? mover : [...att][0];
            this.fall(s, by); events.push({ seat: s, to: by });
            notes.push(s === 0 ? `${FS_SEAT[by]} checkmates you.` : `${by === 0 ? 'You checkmate' : FS_SEAT[by] + ' checkmates'} ${FS_SEAT[s]}, and ${by === 0 ? 'take' : 'takes'} over ${FS_SEAT[s] === 'White' ? 'the white' : 'the ' + FS_SEAT[s].toLowerCase()} army.`);
          } else {
            this.fall(s, -1); events.push({ seat: s, to: -1 });
            notes.push(s === 0 ? 'You are stalemated, and your army leaves the board.' : `${FS_SEAT[s]} is stalemated, and that army leaves the board.`);
          }
          changed = true;
        }
        if (!changed) break;
      }
    },
    apply(m) {
      const s = m.seat, me = s === 0, notes = [], events = [];
      if (this.news) { notes.push(this.news); this.news = ''; }
      const v = this.b[m.from], w = this.b[m.to];
      this.b[m.to] = v; this.b[m.from] = 0;
      let promo = false;
      if ((v & 7) === FS_P) {
        const [dx, dy] = FS_DIR[(v >> 3) & 3], x = m.to & 7, y = m.to >> 3;
        if (!fsIn(x + dx, y + dy)) { this.b[m.to] = (v & ~7) | FS_G; promo = true; }
      }
      if (w) {
        const o = w >> 5, t = w & 7;
        if (t === FS_K && this.alive[o]) {
          this.fall(o, s); events.push({ seat: o, to: s });
          notes.push(o === 0 ? `${FS_SEAT[s]} takes your king.` : `${this.who(s)} ${me ? 'take' : 'takes'} ${FS_SEAT[o]}'s king and the ${FS_SEAT[o].toLowerCase()} army with it.`);
        } else notes.push(`${this.who(s)} ${me ? 'take' : 'takes'} ${o === 0 ? 'your' : FS_SEAT[o] + '\'s'} ${FS_NAME[t]}.`);
      }
      if (promo) notes.push(`${me ? 'Your' : FS_SEAT[s] + '\'s'} pawn becomes a general.`);
      this.settle(s, notes, events);
      const checks = [0, 1, 2, 3].filter(o => o !== s && this.alive[o] && this.kingOf(o) >= 0 && this.attackedBy(this.kingOf(o), o).has(s));
      if (checks.length) notes.push(checks.includes(0) ? `${FS_SEAT[s]} gives you check.` : `Check to ${checks.map(o => FS_SEAT[o]).join(' and ')}.`);
      this.check();
      return { note: notes.join(' '), caps: w ? [m.to] : [], captured: w ? m.to : -1, promo, events };
    },
    check() {
      if (this.over) return;
      const live = [0, 1, 2, 3].filter(s => this.alive[s]);
      if (!this.alive[0]) this.over = { winner: 1, title: 'Your army is lost', text: 'You are out of the game.' };
      else if (live.length === 1) this.over = { winner: 0, title: 'You win', text: 'Yours is the last army standing: all four seasons are yours.' };
    },
    material(s) { let n = 0; for (let i = 0; i < 64; i++) { const v = this.b[i]; if (v && (v >> 5) === s) n += FS_VAL[v & 7]; } return n; },
    passTurn() {
      if (this.over) return 0;
      let s = this.seat;
      do { s = (s + 1) % 4; if (s === 3) this.round++; } while (!this.alive[s]);
      this.seat = s;
      if (this.round > FS_ROUNDS) this.limit();
      return s === 0 ? 0 : 1;
    },
    limit() {
      const live = [0, 1, 2, 3].filter(s => this.alive[s]), m = live.map(s => this.material(s)), top = Math.max(...m);
      const best = live.filter((s, k) => m[k] === top), line = `After ${FS_ROUNDS} rounds: ${live.map((s, k) => `${s ? FS_SEAT[s] : 'you'} ${m[k]}`).join(', ')}.`;
      if (best.length === 1 && best[0] === 0) this.over = { winner: 0, title: 'You win on strength', text: line };
      else if (best.includes(0)) this.over = { winner: -1, title: 'A tie on strength', text: line };
      else this.over = { winner: 1, title: `${best.map(s => FS_SEAT[s]).join(' and ')} ${best.length > 1 ? 'win' : 'wins'} on strength`, text: line };
    },
    ended() { return !!this.over; },
    final() { return this.over; },
    result(pl) {
      if (this.over) return this.over;
      if (pl === 0 && !this.movesOf(0).length) { this.fall(0, -1); this.check(); return this.over; }
      return null;
    },
    get scribeName() { return FS_SEAT[this.seat]; },
    snapshot() { return [this.b.slice(), this.alive.slice(), this.over, this.news]; },
    restore(s) { this.b = s[0].slice(); this.alive = s[1].slice(); this.over = s[2]; this.news = s[3]; },
    // How a seat stands: its own strength, rivals' strength, pieces left hanging, and the safety of its king.
    evaluate(s) {
      if (!this.alive[s]) return -1000;
      let e = this.material(s) * 1.0 + [0, 1, 2, 3].filter(o => o !== s && !this.alive[o]).length * 6;
      for (let o = 0; o < 4; o++) if (o !== s && this.alive[o]) e -= this.material(o) * 0.2;
      const sharp = LEVEL.name === 'sharp';
      // Which squares each seat attacks
      const att = [new Set(), new Set(), new Set(), new Set()], low = new Map();
      for (let j = 0; j < 64; j++) {
        const v = this.b[j]; if (!v) continue; const o = v >> 5; if (!this.alive[o]) continue;
        const sq = []; this.pmoves(j, sq, true);
        for (const q of sq) { att[o].add(q); if (o !== s) { const cur = low.get(q); if (cur === undefined || FS_VAL[v & 7] < cur) low.set(q, FS_VAL[v & 7]); } }
      }
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v || (v >> 5) !== s) continue; const t = v & 7;
        let hit = false; for (let o = 0; o < 4; o++) if (o !== s && this.alive[o] && att[o].has(i)) hit = true;
        if (t === FS_K) { if (hit) e -= 1.5; const x = i & 7, y = i >> 3; for (const [dx, dy] of FS_K8) if (fsIn(x + dx, y + dy)) { for (let o = 0; o < 4; o++) if (o !== s && att[o].has((y + dy) * 8 + x + dx)) e -= 0.15; } continue; }
        if (hit) {
          const defended = att[s].has(i);
          const loss = defended ? Math.max(0, FS_VAL[t] - (low.get(i) || 0)) : FS_VAL[t];
          e -= loss * (sharp ? 0.9 : 0.7);
        }
        if (t === FS_P) { const x = i & 7, y = i >> 3, d = (v >> 3) & 3; e += 0.05 * [y, x, 7 - y, 7 - x][d]; }
      }
      return e;
    },
    aiPlan() {
      const s = this.seat, root = this.snapshot(), lvl = LEVEL.name, noise = pick(2.5, 0.35, 0.05);
      const moves = this.movesOf(s).map(m => Object.assign(m, { pl: 1 }));
      if (!moves.length) return [];
      if (lvl === 'gentle' && Math.random() < 0.3) return [moves[(Math.random() * moves.length) | 0]];
      const scored = moves.map(m => { this.apply(m); const v = this.over && this.over.winner === 1 && !this.alive[0] ? 500 : this.evaluate(s); this.restore(root); return { m, v: v + Math.random() * noise }; });
      scored.sort((a, b) => b.v - a.v);
      if (lvl !== 'sharp') return [scored[0].m];
      // Sharp: for its best few, let the next player answer with its own best move, and judge again.
      let best = scored[0].m, bv = -Infinity;
      for (const c of scored.slice(0, 8)) {
        this.apply(c.m); const mid = this.snapshot();
        let nxt = s; do { nxt = (nxt + 1) % 4; } while (!this.alive[nxt] && nxt !== s);
        let worst = this.evaluate(s);
        if (!this.over && nxt !== s) {
          let rv = -Infinity, reply = null;
          for (const r of this.movesOf(nxt)) { this.apply(r); const v = this.evaluate(nxt); this.restore(mid); if (v > rv) { rv = v; reply = r; } }
          if (reply) { this.apply(reply); worst = this.evaluate(s); this.restore(mid); }
        }
        this.restore(root);
        if (worst + c.v * 0.15 > bv) { bv = worst + c.v * 0.15; best = c.m; }
      }
      return [best];
    },
  };

