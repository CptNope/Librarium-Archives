  /* ------------------------------------------------------------------ Seega
     Lane's "khamsawee seega": a 5 x 5 board, twelve pieces each, placed two at
     a time; cells are y * 5 + x, x from the visitor's left, y away from them. */
  const SG_N = 5, SG_C = 12, SG_PIECES = 12, SG_QUIET = 40;
  const SG_D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const SEEGA = {
    id: 'seega', name: 'Seega', dice: false, first: 0,
    rules: [
      'You have twelve dark stones and the Scribe twelve pieces of red clay. Take turns placing two at a time on any empty square except the centre, you first.',
      'When all are placed, you move first, and your first move must go into the empty centre. After that, move one piece one square up, down or sideways onto an empty square.',
      'Trap an enemy piece between the piece you move and another of yours, along a row or column, and it is taken. One move can take up to three. You may move between two enemy pieces safely.',
      'After a capture, keep moving as long as you can capture again.',
      'If your move leaves the Scribe with no move, you must lift one of your own pieces to open a way, and the same holds for the Scribe.',
      'Take every enemy piece to win. If 20 moves each go by with no capture, whoever has more pieces wins.'
    ],
    source: 'Edward William Lane, Manners and Customs of the Modern Egyptians (1836), on the five-square seega. Lane gives no ending for a game that stalls; the 20-move rule is ours.',
    init() {
      this.b = new Int8Array(25); this.placed = [0, 0]; this.pairLeft = 0; this.started = false;
      this.chain = false; this.quiet = 0; this.over = null; this.moves = 0;
    },
    placing() { return this.placed[0] + this.placed[1] < 2 * SG_PIECES; },
    count(pl) { let n = 0; for (const v of this.b) if (v === pl + 1) n++; return n; },
    caps(pl, from, to) { // the enemy pieces a move from -> to would trap
      const me = pl + 1, foe = 2 - pl, x = to % 5, y = (to / 5) | 0, out = [];
      for (const [dx, dy] of SG_D4) {
        const ax = x + dx, ay = y + dy, bx = x + 2 * dx, by = y + 2 * dy;
        if (bx < 0 || bx >= 5 || by < 0 || by >= 5) continue;
        const a = ay * 5 + ax, c = by * 5 + bx;
        if (this.b[a] === foe && (this.b[c] === me && c !== from)) out.push(a);
      }
      return out;
    },
    steps(pl) {
      const out = [], me = pl + 1;
      for (let i = 0; i < 25; i++) {
        if (this.b[i] !== me) continue;
        const x = i % 5, y = (i / 5) | 0;
        for (const [dx, dy] of SG_D4) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= 5 || ny < 0 || ny >= 5) continue;
          const j = ny * 5 + nx; if (this.b[j]) continue;
          out.push({ pl, from: i, to: j, cap: this.caps(pl, i, j).length });
        }
      }
      return out;
    },
    // Own pieces whose lifting would give the blocked side a move.
    openings(pl) {
      const out = [];
      for (let i = 0; i < 25; i++) {
        if (this.b[i] !== pl + 1) continue;
        this.b[i] = 0; const ok = this.steps(1 - pl).length > 0; this.b[i] = pl + 1;
        if (ok) out.push({ pl, lift: i });
      }
      return out;
    },
    legal(pl) {
      if (this.over) return [];
      if (this.placing()) { const out = []; for (let i = 0; i < 25; i++) if (!this.b[i] && i !== SG_C) out.push({ pl, place: i }); return out; }
      let s = this.steps(pl);
      if (!this.started) s = s.filter(m => m.to === SG_C);
      if (this.chain) s = s.filter(m => m.cap);
      return s;
    },
    get followPrompt() {
      if (this.placing()) return 'Place your second stone.';
      if (this.lifting) return 'The Scribe is boxed in: pick one of your pieces to lift and open a way.';
      return 'Capture again: move a glowing piece.';
    },
    apply(m) {
      const pl = m.pl, me = pl === 0, who = me ? 'You' : 'The Scribe';
      if (m.place !== undefined) {
        this.b[m.place] = pl + 1; this.placed[pl]++;
        if (this.pairLeft === 0) this.pairLeft = 1; else this.pairLeft = 0;
        if (this.pairLeft === 1 && this.placed[pl] < SG_PIECES) { this.lifting = false; return { note: '', followUp: this.legal(pl) }; }
        this.pairLeft = 0;
        return { note: this.placing() ? '' : 'Every piece is placed. The centre square is the only empty one.' };
      }
      if (m.lift !== undefined) {
        this.b[m.lift] = 0; this.lifting = false;
        return { note: me ? 'You lift a piece to open a way for the Scribe.' : 'The Scribe lifts one of its pieces to open a way for you.', lifted: m.lift };
      }
      this.started = true; this.moves++;
      const taken = this.caps(pl, m.from, m.to);
      this.b[m.to] = this.b[m.from]; this.b[m.from] = 0;
      for (const j of taken) this.b[j] = 0;
      this.quiet = taken.length ? 0 : this.quiet + 1;
      const res = { note: '', taken, caps: taken };
      if (taken.length) res.note = `${who} ${me ? 'take' : 'takes'} ${taken.length === 1 ? 'a piece' : taken.length + ' pieces'}.`;
      if (!this.count(1 - pl)) { this.over = { winner: pl, text: me ? 'You have taken every one of the Scribe\'s pieces.' : 'The Scribe has taken every one of your pieces.' }; this.chain = false; return res; }
      if (taken.length) {
        this.chain = true;
        const more = this.steps(pl).filter(x => x.cap);
        if (more.length) { res.followUp = more; return res; }
      }
      this.chain = false;
      if (!this.steps(1 - pl).length) { // the other side is boxed in: open a way
        const o = this.openings(pl);
        if (o.length) { this.lifting = true; res.followUp = o; res.note = (res.note + (me ? ' The Scribe cannot move.' : ' You cannot move.')).trim(); return res; }
      }
      if (this.quiet >= SG_QUIET) {
        const a = this.count(0), c = this.count(1);
        this.over = { winner: a > c ? 0 : c > a ? 1 : -1, text: `Twenty moves each without a capture. You have ${a} pieces, the Scribe ${c}.` };
      }
      return res;
    },
    result(pl) {
      if (this.over) return this.over;
      if (!this.placing() && !this.legal(pl).length) { // boxed in by one's own pieces: the turn passes, and if neither can move it is over
        if (!this.steps(1 - pl).length) { const a = this.count(0), c = this.count(1); return { winner: a > c ? 0 : c > a ? 1 : -1, text: `Neither side can move. You have ${a} pieces, the Scribe ${c}.` }; }
      }
      return null;
    },
    skipTurn(pl) { return !this.over && !this.placing() && !this.legal(pl).length && this.steps(1 - pl).length ? (pl === 0 ? 'You cannot move, so the turn passes.' : 'The Scribe cannot move, so the turn passes.') : ''; },
    snapshot() { return [this.b.slice(), this.placed.slice(), this.pairLeft, this.started, this.chain, this.quiet, this.over, this.lifting, this.moves]; },
    restore(s) { this.b = s[0].slice(); this.placed = s[1].slice(); [, , this.pairLeft, this.started, this.chain, this.quiet, this.over, this.lifting, this.moves] = s; },
    turns(pl) {
      const out = [], walk = (seq) => {
        const ms = seq.length ? null : this.legal(pl);
        for (const m of ms || []) {
          const s = this.snapshot(); const r = this.apply(m);
          if (r.followUp && !this.over) this.extend([m], r.followUp, out); else out.push([m]);
          this.restore(s);
        }
      };
      walk([]);
      return out.sort((a, b) => b.reduce((n, m) => n + (m.cap || 0), 0) - a.reduce((n, m) => n + (m.cap || 0), 0));
    },
    extend(seq, follow, out) {
      for (const f of follow) {
        const s = this.snapshot(); const r = this.apply(f);
        if (r.followUp && !this.over && seq.length < 8) this.extend(seq.concat(f), r.followUp, out); else out.push(seq.concat(f));
        this.restore(s);
      }
    },
    terminal(pl, depth) { const r = this.over; if (!r) return null; return r.winner === -1 ? 0 : r.winner === pl ? 1000 + depth : -1000 - depth; },
    // Material first; then threats, room to move, and pieces that cannot be trapped (a friend or the edge on one side of each line).
    evaluate(pl) {
      const opp = 1 - pl, sp = this.steps(pl), so = this.steps(opp);
      let e = (this.count(pl) - this.count(opp)) * 10;
      e += (sp.filter(m => m.cap).length - so.filter(m => m.cap).length) * 2 + (sp.length - so.length) * 0.25;
      for (let i = 0; i < 25; i++) {
        const v = this.b[i]; if (!v) continue;
        const x = i % 5, y = (i / 5) | 0, side = v === pl + 1 ? 1 : -1;
        const firm = (ax, ay, bx, by) => { const a = ax < 0 || ax > 4 || ay < 0 || ay > 4 ? v : this.b[ay * 5 + ax], c = bx < 0 || bx > 4 || by < 0 || by > 4 ? v : this.b[by * 5 + bx]; return a === v || c === v; };
        if (firm(x - 1, y, x + 1, y) && firm(x, y - 1, x, y + 1)) e += 0.8 * side;
      }
      return e;
    },
    // Placing: build solid blocks, which cannot be trapped, and keep away from the centre's neighbours.
    placeScore(pl, i) {
      const x = i % 5, y = (i / 5) | 0; let s = 0;
      for (const [dx, dy] of SG_D4) { const nx = x + dx, ny = y + dy; if (nx < 0 || nx >= 5 || ny < 0 || ny >= 5) { s += 0.6; continue; } const v = this.b[ny * 5 + nx]; if (v === pl + 1) s += 1; else if (v) s -= 0.4; }
      if (Math.abs(x - 2) + Math.abs(y - 2) === 1) s -= 0.8;
      return s;
    },
    aiPlan(pl, depth) {
      if (this.placing()) {
        const noise = pick(4, 0.8, 0.2), plan = [], s = this.snapshot();
        for (let k = 0; k < 2 && this.placing(); k++) {
          let best = null, bv = -Infinity;
          for (const m of this.legal(pl)) { const v = this.placeScore(pl, m.place) + Math.random() * noise; if (v > bv) { bv = v; best = m; } }
          plan.push(best); const r = this.apply(best); if (!r.followUp) break;
        }
        this.restore(s);
        return plan;
      }
      return bestPlan(this, pl, depth, 6);
    },
  };

