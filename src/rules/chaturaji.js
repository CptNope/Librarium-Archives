  /* -------------------------------------------------------------- Chaturaji
     Four-handed chaturanga with dice, as al-Biruni described it about 1030 and
     Murray read him: each for himself, kings can be taken, captures score.
     Board cells are y * 8 + x, x the file from the visitor's left, y the rank
     away from the visitor. A cell holds 0 or (seat << 3 | type). */
  const CJ_KING = 1, CJ_ELEPHANT = 2, CJ_HORSE = 3, CJ_BOAT = 4, CJ_PAWN = 5;
  const CJ_VAL = [0, 5, 4, 3, 2, 1];
  const CJ_NAME = ['', 'king', 'elephant', 'horse', 'boat', 'pawn'];
  const CJ_SEAT = ['Yellow', 'Black', 'Red', 'Green']; // the visitor, then clockwise
  // [king, elephant, horse, boat] squares, the pawn row, and the pawns' step
  const CJ_SETUP = [
    { back: [[3, 0], [2, 0], [1, 0], [0, 0]], pawns: [[0, 1], [1, 1], [2, 1], [3, 1]], dir: [0, 1] },
    { back: [[0, 4], [0, 5], [0, 6], [0, 7]], pawns: [[1, 4], [1, 5], [1, 6], [1, 7]], dir: [1, 0] },
    { back: [[4, 7], [5, 7], [6, 7], [7, 7]], pawns: [[4, 6], [5, 6], [6, 6], [7, 6]], dir: [0, -1] },
    { back: [[7, 3], [7, 2], [7, 1], [7, 0]], pawns: [[6, 0], [6, 1], [6, 2], [6, 3]], dir: [-1, 0] },
  ];
  // Which pieces each face of a die moves: 1 and 5 king or pawn, 2 boat, 3 horse, 4 and 6 elephant.
  const CJ_FACE = [null, [CJ_KING, CJ_PAWN], [CJ_BOAT], [CJ_HORSE], [CJ_ELEPHANT], [CJ_KING, CJ_PAWN], [CJ_ELEPHANT]];
  const CJ_FACES_FOR = [null, [1, 5], [4, 6], [3], [2], [1, 5]]; // by piece type
  // A pawn on the far line becomes the piece whose line it reached: boat, horse, elephant, king, king, elephant, horse, boat.
  const CJ_PROMO = [CJ_BOAT, CJ_HORSE, CJ_ELEPHANT, CJ_KING, CJ_KING, CJ_ELEPHANT, CJ_HORSE, CJ_BOAT];
  const CJ_KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const CJ_K8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const CJ_ROUNDS = 30;
  const cjIn = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;
  const cjHit = k => 1 - Math.pow((6 - k) / 6, 2); // chance two dice show at least one of k faces

  const CHATURAJI = {
    id: 'chaturaji', name: 'Chaturaji', dice: true, pipDice: true, first: 0, extraNote: '', ROUNDS: CJ_ROUNDS, SEATS: CJ_SEAT, NAME: CJ_NAME, VAL: CJ_VAL,
    stopLabel: 'Skip',
    rules: [
      'Four armies, each for itself. You play yellow, nearest you; Black, Red and Green are three Scribes, and play passes clockwise, to your left.',
      'Throw two dice. Each die lets one piece of its kind move once: 1 or 5 the king or a pawn, 2 the boat, 3 the horse, 4 or 6 the elephant. Use the dice in either order, use one, or skip with the Skip button.',
      'The king moves one square any way, the elephant like a rook, the horse like a knight, and the boat jumps exactly two squares diagonally. Pawns step one square forward, away from your side, and take one square diagonally forward. There is no check: kings are taken like any other piece.',
      'A pawn that reaches the far edge becomes the piece that began on that line (boat, horse, elephant), but only if you have lost one of those. Otherwise it stays a pawn.',
      'If a boat\'s move makes a square of four boats, it takes the other three.',
      'Every capture scores: king 5, elephant 4, horse 3, boat 2, pawn 1. A player who loses the king is out, and the rest of that army stays on the board to be taken.',
      'Take all three kings and you win: that is chaturaji. Lose yours and you lose. After 30 rounds, the highest score among the kings still standing wins.'
    ],
    source: 'After al-Biruni\'s account of about 1030, as read by H. J. R. Murray (A History of Chess, 1913), with cubic dice. The throne rule (sinhasana) and the ransoming of kings are left out, and the 30-round limit is ours.',
    init() {
      this.b = new Int8Array(64);
      CJ_SETUP.forEach((s, seat) => {
        s.back.forEach(([x, y], k) => { this.b[y * 8 + x] = (seat << 3) | (k + 1); });
        s.pawns.forEach(([x, y]) => { this.b[y * 8 + x] = (seat << 3) | CJ_PAWN; });
      });
      this.alive = [true, true, true, true]; this.score = [0, 0, 0, 0]; this.kings = [[], [], [], []]; // whose kings each seat took
      this.seat = 0; this.round = 1; this.left = []; this.over = null; this.outNoted = [false, false, false, false];
    },
    seatOf(v) { return v >> 3; }, typeOf(v) { return v & 7; },
    count(seat, type) { let n = 0; for (let i = 0; i < 64; i++) { const v = this.b[i]; if (v && (v >> 3) === seat && (v & 7) === type) n++; } return n; },
    roll() { const a = 1 + ((Math.random() * 6) | 0), b = 1 + ((Math.random() * 6) | 0); return { faces: [a, b], value: a + b }; },
    rollName(r) {
      const say = f => `${f} (${CJ_FACE[f].map(t => CJ_NAME[t]).join(' or ')})`;
      return r.faces[0] === r.faces[1] ? `double ${say(r.faces[0])}` : `${say(r.faces[0])} and ${say(r.faces[1])}`;
    },
    // Every move one piece of the given types can make; the die is noted on each.
    pieceMoves(seat, i, die, face, out) {
      const v = this.b[i], t = v & 7, x = i & 7, y = i >> 3, own = j => this.b[j] && (this.b[j] >> 3) === seat;
      const add = (nx, ny) => { const j = ny * 8 + nx; if (!own(j)) out.push({ seat, from: i, to: j, die, face, cap: this.b[j] || 0 }); };
      if (t === CJ_KING) { for (const [dx, dy] of CJ_K8) if (cjIn(x + dx, y + dy)) add(x + dx, y + dy); }
      else if (t === CJ_HORSE) { for (const [dx, dy] of CJ_KN) if (cjIn(x + dx, y + dy)) add(x + dx, y + dy); }
      else if (t === CJ_BOAT) { for (const dx of [-2, 2]) for (const dy of [-2, 2]) if (cjIn(x + dx, y + dy)) add(x + dx, y + dy); }
      else if (t === CJ_ELEPHANT) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let nx = x + dx, ny = y + dy;
          while (cjIn(nx, ny)) { const j = ny * 8 + nx; if (own(j)) break; add(nx, ny); if (this.b[j]) break; nx += dx; ny += dy; }
        }
      } else if (t === CJ_PAWN) {
        const [dx, dy] = CJ_SETUP[seat].dir, fx = x + dx, fy = y + dy;
        if (cjIn(fx, fy) && !this.b[fy * 8 + fx]) add(fx, fy);
        const side = dx ? [[dx, 1], [dx, -1]] : [[1, dy], [-1, dy]];
        for (const [sx, sy] of side) { const nx = x + sx, ny = y + sy; if (cjIn(nx, ny)) { const w = this.b[ny * 8 + nx]; if (w && (w >> 3) !== seat) add(nx, ny); } }
      }
    },
    movesFor(seat, faces, pl) {
      const out = [], seen = new Set();
      faces.forEach((f, die) => {
        if (faces.indexOf(f) !== die) return; // a double: the second die offers the same moves
        const types = CJ_FACE[f], got = [];
        for (let i = 0; i < 64; i++) { const v = this.b[i]; if (v && (v >> 3) === seat && types.includes(v & 7)) this.pieceMoves(seat, i, die, f, got); }
        for (const m of got) { const k = m.from * 64 + m.to; if (!seen.has(k)) { seen.add(k); m.pl = pl; out.push(m); } }
      });
      return out;
    },
    // At the start of a turn: the moves the throw allows, plus a skip for the visitor.
    legal(pl, value, r) {
      if (this.over) return [];
      if (r) this.left = r.faces.slice();
      const seat = pl === 0 ? 0 : this.seat;
      const out = this.movesFor(seat, this.left, pl);
      if (out.length && pl === 0) out.push({ pl, seat, pass: true });
      return out;
    },
    get followPrompt() {
      const f = this.left[0];
      return f ? `Now move with your other die, ${f} (${CJ_FACE[f].map(t => 'the ' + CJ_NAME[t]).join(' or ')}), or press Skip.` : '';
    },
    who(seat) { return seat === 0 ? 'You' : CJ_SEAT[seat]; },
    pieceName(v) { return (v >> 3) === 0 ? 'your ' + CJ_NAME[v & 7] : `${CJ_SEAT[v >> 3]}'s ${CJ_NAME[v & 7]}`; },
    take(seat, j, words) {
      const v = this.b[j]; if (!v) return;
      this.b[j] = 0; this.score[seat] += CJ_VAL[v & 7];
      words.push(this.pieceName(v));
      if ((v & 7) === CJ_KING && this.alive[v >> 3] && !this.count(v >> 3, CJ_KING)) { this.alive[v >> 3] = false; this.kings[seat].push(v >> 3); }
    },
    apply(m) {
      const seat = m.seat, me = seat === 0;
      if (m.pass) {
        const first = this.left.length === 2; this.left = [];
        return { note: me ? (first ? 'You let the throw go.' : '') : `${CJ_SEAT[seat]} lets the throw go.`, moved: [] };
      }
      const k = this.left.indexOf(m.face); if (k >= 0) this.left.splice(k, 1);
      const v = this.b[m.from], words = [], captured = [], gained = this.score[seat];
      if (this.b[m.to]) captured.push(m.to);
      this.take(seat, m.to, words);
      this.b[m.to] = v; this.b[m.from] = 0;
      let triumph = false, promo = 0;
      if ((v & 7) === CJ_BOAT) { // the boat's triumph: four boats in a square
        const x = m.to & 7, y = m.to >> 3;
        for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
          const sq = [[x + ox, y + oy], [x + ox + 1, y + oy], [x + ox, y + oy + 1], [x + ox + 1, y + oy + 1]];
          if (!sq.every(([a, c]) => cjIn(a, c))) continue;
          const cells = sq.map(([a, c]) => c * 8 + a), others = cells.filter(j => j !== m.to);
          if (others.every(j => this.b[j] && (this.b[j] & 7) === CJ_BOAT && (this.b[j] >> 3) !== seat)) {
            for (const j of others) { captured.push(j); this.take(seat, j, words); }
            triumph = true; break;
          }
        }
      }
      if ((v & 7) === CJ_PAWN) {
        const [dx, dy] = CJ_SETUP[seat].dir, x = m.to & 7, y = m.to >> 3;
        const far = dx ? (dx > 0 ? x === 7 : x === 0) : (dy > 0 ? y === 7 : y === 0);
        if (far) {
          const t = CJ_PROMO[dx ? y : x];
          if (t !== CJ_KING && !this.count(seat, t)) { this.b[m.to] = (seat << 3) | t; promo = t; }
        }
      }
      const name = me ? 'You' : CJ_SEAT[seat];
      let note = '';
      if (triumph) note = `${me ? 'Your' : name + '\'s'} boat completes a square of four and takes ${words.join(', ')}. `;
      else if (words.length) note = `${name} ${me ? 'take' : 'takes'} ${words[0]} (${this.score[seat] - gained}). `;
      if (promo) note += `${me ? 'Your' : name + '\'s'} pawn becomes ${promo === CJ_ELEPHANT ? 'an' : 'a'} ${CJ_NAME[promo]}. `;
      for (const s of [1, 2, 3, 0]) if (!this.alive[s] && !this.outNoted[s]) { this.outNoted[s] = true; if (s) note += `${CJ_SEAT[s]} is out of the game. `; }
      this.check(seat);
      const res = { note: note.trim(), captured, caps: captured, promo, triumph, moved: [m.to] };
      if (!this.over && me && this.left.length) {
        const f = this.movesFor(0, this.left, 0);
        if (f.length) { f.push({ pl: 0, seat: 0, pass: true }); res.followUp = f; }
        else { this.left = []; res.note = (res.note + ' Your other die has no move.').trim(); }
      }
      return res;
    },
    check(seat) {
      if (this.over) return;
      if (!this.alive[0]) {
        const by = [1, 2, 3].find(s => this.kings[s].includes(0));
        this.over = { winner: 1, title: 'Your king is taken', text: `${CJ_SEAT[by]} took your king, and with it you are out. Scores: ${this.scoreLine()}.` };
      } else if (!this.alive[1] && !this.alive[2] && !this.alive[3]) {
        const all = this.kings[0].length === 3;
        this.over = { winner: 0, title: all ? 'Chaturaji' : 'You win', text: all ? `You took all three kings yourself: chaturaji, the full victory. Scores: ${this.scoreLine()}.` : `Yours is the last king standing. Scores: ${this.scoreLine()}.` };
      }
    },
    scoreLine() { return CJ_SEAT.map((n, s) => `${s ? n : 'you'} ${this.score[s]}`).join(', '); },
    // The turn passes clockwise to the next player with a king; returns 0 for the visitor, 1 for a Scribe.
    passTurn() {
      if (this.over) return 0;
      let s = this.seat;
      do { s = (s + 1) % 4; if (s === 0) this.round++; } while (!this.alive[s]);
      this.seat = s; this.left = [];
      if (s === 0 && this.round > CJ_ROUNDS) this.limit();
      return s === 0 ? 0 : 1;
    },
    limit() {
      const live = [0, 1, 2, 3].filter(s => this.alive[s]), top = Math.max(...live.map(s => this.score[s]));
      const best = live.filter(s => this.score[s] === top);
      const line = `After ${CJ_ROUNDS} rounds the scores are ${this.scoreLine()}.`;
      if (best.length === 1 && best[0] === 0) this.over = { winner: 0, title: 'You win on points', text: line };
      else if (best.includes(0)) this.over = { winner: -1, title: 'A tie on points', text: line + ' You share the top score.' };
      else this.over = { winner: 1, title: `${best.map(s => CJ_SEAT[s]).join(' and ')} ${best.length > 1 ? 'win' : 'wins'} on points`, text: line };
    },
    ended() { return !!this.over; },
    done() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over; },
    extra() { return false; },
    home() { return 0; },
    get scribeName() { return CJ_SEAT[this.seat]; },
    snapshot() { return { b: this.b.slice(), alive: this.alive.slice(), score: this.score.slice(), kings: this.kings.map(k => k.slice()), left: this.left.slice(), over: this.over, outNoted: this.outNoted.slice() }; },
    restore(s) { this.b = s.b.slice(); this.alive = s.alive.slice(); this.score = s.score.slice(); this.kings = s.kings.map(k => k.slice()); this.left = s.left.slice(); this.over = s.over; this.outNoted = s.outNoted.slice(); },
    // How well placed a seat is: its captures, minus what it stands to lose before its next turn, plus its threats.
    evaluate(seat, skipKing) {
      if (!this.alive[seat]) return -1000;
      const sharp = LEVEL.name === 'sharp';
      let e = this.score[seat] * 1.0 + (3 - [1, 2, 3, 0].filter(s => s !== seat && this.alive[s]).length) * 12;
      if (this.over) return e;
      // Who attacks each square, by seat, and with which types.
      const att = Array.from({ length: 4 }, () => new Map());
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v) continue;
        const s = v >> 3; if (!this.alive[s]) continue;
        const ms = []; this.pieceMoves(s, i, 0, 0, ms);
        for (const m of ms) {
          if ((v & 7) === CJ_PAWN && (m.to & 7) === (i & 7) && CJ_SETUP[s].dir[0] === 0) continue; // a pawn's forward step does not attack
          if ((v & 7) === CJ_PAWN && (m.to >> 3) === (i >> 3) && CJ_SETUP[s].dir[1] === 0) continue;
          const set = att[s].get(m.to) || new Set(); set.add(v & 7); att[s].set(m.to, set);
        }
      }
      const facesHit = types => { const f = new Set(); types.forEach(t => CJ_FACES_FOR[t].forEach(x => f.add(x))); return cjHit(f.size); };
      for (let i = 0; i < 64; i++) {
        const v = this.b[i]; if (!v) continue;
        const s = v >> 3, t = v & 7;
        if (s === seat) {
          let safe = 1;
          for (let o = 0; o < 4; o++) if (o !== seat && this.alive[o] && att[o].has(i)) safe *= 1 - facesHit(att[o].get(i));
          if (t === CJ_KING && skipKing) continue;
          const worth = t === CJ_KING ? (sharp ? 40 : 25) : CJ_VAL[t];
          e -= (1 - safe) * worth * (sharp ? 1 : 0.8);
          if (t === CJ_PAWN) { const [dx, dy] = CJ_SETUP[seat].dir, x = i & 7, y = i >> 3; e += 0.06 * (dx ? (dx > 0 ? x : 7 - x) : (dy > 0 ? y : 7 - y)); }
        } else if (sharp && att[seat].has(i)) {
          e += 0.18 * facesHit(att[seat].get(i)) * (t === CJ_KING && this.alive[s] ? 12 : CJ_VAL[t]);
        }
      }
      return e;
    },
    // The chance that some rival can take this seat's king with one throw, using both dice, before its next turn.
    kingRisk(seat) {
      let k = -1; for (let i = 0; i < 64; i++) if (this.b[i] && (this.b[i] >> 3) === seat && (this.b[i] & 7) === CJ_KING) { k = i; break; }
      if (k < 0) return 1;
      const saveB = this.b.slice(), hits = m => m.to === k;
      let safe = 1;
      for (let o = 0; o < 4; o++) {
        if (o === seat || !this.alive[o]) continue;
        let p = 0;
        for (let a = 1; a <= 6; a++) for (let c = a; c <= 6; c++) {
          let can = false;
          const first = this.movesFor(o, [a, c], 1);
          if (first.some(hits)) can = true;
          else for (const m1 of first) {
            const v = this.b[m1.from]; this.b[m1.to] = v; this.b[m1.from] = 0;
            const rest = m1.die === 0 ? [c] : [a];
            if (this.movesFor(o, rest, 1).some(hits)) can = true;
            this.b.set(saveB);
            if (can) break;
          }
          if (can) p += a === c ? 1 / 36 : 2 / 36;
        }
        safe *= 1 - p;
      }
      return 1 - safe;
    },
    // The Scribe whose turn it is tries every way to use its two dice, and keeps the best.
    // Sharp then looks again at its best few, counting two-move attacks on its king.
    aiPlan(pl, moves) {
      const seat = this.seat, root = this.snapshot(), faces = this.left.slice();
      const noise = pick(4, 0.5, 0.05), sharp = LEVEL.name === 'sharp', all = [];
      let best = [{ pl: 1, seat, pass: true }], bestV = this.evaluate(seat) + Math.random() * noise;
      const consider = (plan) => { const v = this.evaluate(seat) + Math.random() * noise; if (sharp) all.push({ plan: plan.slice(), v }); if (v > bestV) { bestV = v; best = plan.slice(); } };
      if (sharp) all.push({ plan: best, v: bestV });
      for (const m1 of this.movesFor(seat, faces, 1)) {
        this.apply(m1); const mid = this.snapshot();
        consider([m1]);
        if (!this.over && this.left.length) {
          for (const m2 of this.movesFor(seat, this.left, 1)) { this.apply(m2); consider([m1, m2]); this.restore(mid); }
        }
        this.restore(root);
      }
      this.restore(root);
      if (sharp) {
        all.sort((x, y) => y.v - x.v);
        let topV = -Infinity;
        for (const c of all.slice(0, 12)) {
          for (const m of c.plan) this.apply(m);
          const v = this.over ? c.v : this.evaluate(seat, true) - 45 * this.kingRisk(seat);
          this.restore(root);
          if (v > topV) { topV = v; best = c.plan; }
        }
      }
      if (LEVEL.name === 'gentle' && Math.random() < 0.35) { // the Gentle Scribe often just moves something
        const ms = this.movesFor(seat, faces, 1); if (ms.length) return [ms[(Math.random() * ms.length) | 0]];
      }
      return best;
    },
  };

