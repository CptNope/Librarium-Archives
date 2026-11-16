  /* ----------------------------------------------------------------------- Go
   * A 9 x 9 board, index r*9+c, row 0 nearest the visitor. b holds 0 empty,
   * 1 black (the visitor, who plays first) and 2 white (the Scribe). Chinese
   * area scoring with a komi of 7 for white. The Scribe searches with Monte
   * Carlo tree search: thousands of random games from the position, steered
   * by RAVE (moves that won when played anywhere later count a little too). */
  const GO_N = 9, GO_KOMI = 7, GO_LIMIT = 300;
  const GO_NB = [], GO_DG = [];
  for (let p = 0; p < 81; p++) {
    const r = (p / 9) | 0, c = p % 9, nb = [], dg = [];
    if (r > 0) nb.push(p - 9); if (r < 8) nb.push(p + 9); if (c > 0) nb.push(p - 1); if (c < 8) nb.push(p + 1);
    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 9 && cc >= 0 && cc < 9) dg.push(rr * 9 + cc); }
    GO_NB.push(nb); GO_DG.push(dg);
  }
  const goMark = new Int32Array(81), goLibMark = new Int32Array(81), goStack = new Int32Array(81), goEmpty = new Int32Array(81);
  let goStamp = 0, goLibAt = -1;
  // Liberties of the group on p, counted up to max. The last one found is left in goLibAt.
  function goLibs(b, p, max) {
    if (goStamp > 2e9) { goStamp = 0; goMark.fill(0); goLibMark.fill(0); } // the marks are 32-bit
    const col = b[p], s = ++goStamp; let sp = 0, libs = 0;
    goStack[sp++] = p; goMark[p] = s;
    while (sp) {
      const nb = GO_NB[goStack[--sp]];
      for (let k = 0; k < nb.length; k++) {
        const n = nb[k], v = b[n];
        if (v === 0) { if (goLibMark[n] !== s) { goLibMark[n] = s; goLibAt = n; if (++libs >= max) return libs; } }
        else if (v === col && goMark[n] !== s) { goMark[n] = s; goStack[sp++] = n; }
      }
    }
    return libs;
  }
  function goRemove(b, p, out) {
    const col = b[p]; let sp = 0, n = 1;
    goStack[sp++] = p; b[p] = 0; if (out) out.push(p);
    while (sp) {
      const nb = GO_NB[goStack[--sp]];
      for (let k = 0; k < nb.length; k++) { const q = nb[k]; if (b[q] === col) { b[q] = 0; n++; if (out) out.push(q); goStack[sp++] = q; } }
    }
    return n;
  }
  // Is it legal for col to play p? Not occupied, not the ko point, and not suicide.
  function goLegal(b, col, p, ko) {
    if (b[p] || p === ko) return false;
    const nb = GO_NB[p];
    for (let k = 0; k < nb.length; k++) {
      const v = b[nb[k]];
      if (!v) return true;
      if (v === col ? goLibs(b, nb[k], 2) >= 2 : goLibs(b, nb[k], 2) === 1) return true;
    }
    return false;
  }
  // Plays a legal move. Returns the new ko point, or -1.
  function goPlay(b, col, p, caps) {
    const opp = 3 - col, nb = GO_NB[p];
    b[p] = col;
    let taken = 0, at = -1;
    for (let k = 0; k < nb.length; k++) { const n = nb[k]; if (b[n] === opp && goLibs(b, n, 1) === 0) { taken += goRemove(b, n, caps); at = n; } }
    if (taken === 1 && goLibs(b, p, 2) === 1) { for (let k = 0; k < nb.length; k++) if (b[nb[k]] === col) return -1; return at; }
    return -1;
  }
  // A point col should never fill: surrounded by its own stones, and not a false eye.
  function goEye(b, p, col) {
    const nb = GO_NB[p];
    for (let k = 0; k < nb.length; k++) if (b[nb[k]] !== col) return false;
    const dg = GO_DG[p]; let bad = 0;
    for (let k = 0; k < dg.length; k++) if (b[dg[k]] === 3 - col) bad++;
    return dg.length < 4 ? bad === 0 : bad < 2;
  }
  // Area score for black minus white, before komi, of a finished random game.
  function goArea(b) {
    let s = 0;
    for (let p = 0; p < 81; p++) {
      const v = b[p];
      if (v) { s += v === 1 ? 1 : -1; continue; }
      let bl = 0, wh = 0; const nb = GO_NB[p];
      for (let k = 0; k < nb.length; k++) { if (b[nb[k]] === 1) bl++; else if (b[nb[k]] === 2) wh++; }
      if (bl && !wh) s++; else if (wh && !bl) s--;
    }
    return s;
  }
  // Plays random moves to the end. Captures a group left in atari by the last move when it can.
  function goPlayout(b, col, ko, passes, last, firstT, firstC, t) {
    while (passes < 2 && t < GO_LIMIT) {
      let p = -1;
      if (last >= 0 && b[last] === 3 - col && goLibs(b, last, 2) === 1) {
        const lib = goLibAt; // goLegal overwrites goLibAt, so keep the liberty first
        if (goLegal(b, col, lib, ko) && Math.random() < 0.9) p = lib;
      }
      if (p < 0) {
        let ne = 0;
        for (let q = 0; q < 81; q++) if (!b[q]) goEmpty[ne++] = q;
        while (ne) {
          const k = (Math.random() * ne) | 0, q = goEmpty[k]; goEmpty[k] = goEmpty[--ne];
          if (!goEye(b, q, col) && goLegal(b, col, q, ko)) { p = q; break; }
        }
      }
      if (p < 0) { passes++; ko = -1; last = -1; }
      else {
        ko = goPlay(b, col, p, null); passes = 0; last = p;
        if (firstT && firstT[p] < 0) { firstT[p] = t; firstC[p] = col; }
      }
      col = 3 - col; t++;
    }
    return goArea(b) - GO_KOMI;
  }
  function goSearch(st, col, budget) {
    const root = { p: -2, col: 3 - col, n: 0, w: 0, rn: 0, rw: 0, kids: null };
    const b = new Int8Array(81), firstT = new Int16Array(81), firstC = new Int8Array(81);
    const t0 = Date.now(); let sims = 0;
    const select = node => {
      let best = null, bv = -Infinity; const ln = Math.log(node.n + 1);
      for (const c of node.kids) {
        let v;
        if (!c.n) v = (c.rn ? c.rw / c.rn : 0.5) + 0.1;
        else {
          const beta = c.rn / (c.rn + c.n + c.rn * c.n * 0.0005);
          v = (1 - beta) * (c.w / c.n) + beta * (c.rn ? c.rw / c.rn : 0) + 0.08 * Math.sqrt(ln / c.n);
        }
        if (c.p === -1) v -= 0.05; // pass only when nothing else is worth playing
        if (v > bv) { bv = v; best = c; }
      }
      return best;
    };
    const expand = (node, toMove, ko) => {
      node.kids = [];
      for (let p = 0; p < 81; p++) if (!goEye(b, p, toMove) && goLegal(b, toMove, p, ko)) node.kids.push({ p, col: toMove, n: 0, w: 0, rn: 0, rw: 0, kids: null });
      node.kids.push({ p: -1, col: toMove, n: 0, w: 0, rn: 0, rw: 0, kids: null });
    };
    do {
      b.set(st.b); firstT.fill(-1);
      let ko = st.ko, passes = st.passes, toMove = col, last = st.last, node = root, depth = 0;
      const path = [root];
      for (;;) {
        if (passes >= 2) break;
        if (!node.kids) { if (node !== root && node.n < 2) break; expand(node, toMove, ko); }
        node = select(node);
        if (node.p >= 0) {
          ko = goPlay(b, toMove, node.p, null); passes = 0; last = node.p;
          if (firstT[node.p] < 0) { firstT[node.p] = depth; firstC[node.p] = toMove; }
        } else { passes++; ko = -1; last = -1; }
        toMove = 3 - toMove; depth++; path.push(node);
      }
      const score = passes >= 2 ? goArea(b) - GO_KOMI : goPlayout(b, toMove, ko, passes, last, firstT, firstC, depth + st.ply);
      const winner = score > 0 ? 1 : 2;
      for (let i = path.length - 1; i >= 0; i--) {
        const nd = path[i];
        nd.n++; if (nd.col === winner) nd.w++;
        if (nd.kids) for (const c of nd.kids) if (c.p >= 0 && firstC[c.p] === c.col && firstT[c.p] >= i) { c.rn++; if (c.col === winner) c.rw++; }
      }
      sims++;
    } while ((sims & 7) || Date.now() - t0 < budget);
    return { root, sims };
  }
  const GO = {
    id: 'go', name: 'Go', dice: false, first: 0, canPass: true, N: GO_N, KOMI: GO_KOMI,
    rules: [
      'You play black and move first. Take turns placing a stone on an empty point where the lines cross. Stones never move.',
      'A stone or a chain of stones joined along the lines is captured when the other side fills every empty point next to it.',
      'You may not play a stone that would have no empty point next to it, unless it captures. Ko: you may not take back a single stone straight away if that would repeat the board.',
      'Use Pass when there is nothing useful left to play. When both players pass in a row, the game ends.',
      'Each side scores its stones plus the empty points it alone surrounds. Stones that could not escape capture are counted as captured. White adds 7 points (komi) for moving second; the higher total wins.'
    ],
    source: 'Modern rules: Chinese area scoring on the 9 × 9 board used for quick games, with a komi of 7.',
    init() { this.b = new Int8Array(81); this.ko = -1; this.passes = 0; this.ply = 0; this.last = -1; this.caps = [0, 0]; this.final = null; },
    count(pl) { let n = 0; for (const v of this.b) if (v === pl + 1) n++; return n; },
    over() { return this.passes >= 2 || this.ply >= GO_LIMIT; },
    legal(pl) {
      if (this.over()) return [];
      const out = [];
      for (let p = 0; p < 81; p++) if (goLegal(this.b, pl + 1, p, this.ko)) out.push({ pl, p });
      return out;
    },
    apply(m) {
      this.ply++; this.final = null;
      if (m.pass) {
        this.passes++; this.ko = -1; this.last = -1;
        const end = this.passes >= 2;
        return { caps: [], note: m.pl === 0 ? (end ? 'You pass too, so the game ends.' : 'You pass.') : (end ? 'The Scribe passes too, so the game ends.' : 'The Scribe passes. Pass as well to end the game and count the board.') };
      }
      const caps = [];
      this.ko = goPlay(this.b, m.pl + 1, m.p, caps); this.passes = 0; this.last = m.p;
      this.caps[m.pl] += caps.length;
      const n = caps.length;
      return { caps, note: !n ? '' : m.pl === 0 ? `You capture ${n === 1 ? 'a stone' : n + ' stones'}.` : `The Scribe captures ${n === 1 ? 'one of your stones' : n + ' of your stones'}.` };
    },
    // Who owns each point at the end: plays the position out many times and keeps the clear majorities.
    // Returns +1 (black), -1 (white) or 0 per point.
    ownership(runs = 300) {
      const tally = new Int16Array(81), b = new Int8Array(81);
      for (let k = 0; k < runs; k++) {
        b.set(this.b);
        goPlayout(b, this.ply % 2 ? 2 : 1, this.ko, 0, this.last, null, null, 0);
        for (let p = 0; p < 81; p++) {
          let v = b[p];
          if (!v) { let bl = 0, wh = 0; for (const n of GO_NB[p]) { if (b[n] === 1) bl++; else if (b[n] === 2) wh++; } v = bl && !wh ? 1 : wh && !bl ? 2 : 0; }
          if (v === 1) tally[p]++; else if (v === 2) tally[p]--;
        }
      }
      return Array.from(tally, t => (t > runs * 0.3 ? 1 : t < -runs * 0.3 ? -1 : 0));
    },
    tally() {
      const own = this.ownership();
      let black = 0, white = 0;
      own.forEach(o => { if (o > 0) black++; else if (o < 0) white++; });
      return { black, white, dead: this.b.reduce((n, v, p) => n + (v && own[p] && (own[p] > 0 ? 1 : 2) !== v ? 1 : 0), 0) };
    },
    result() {
      if (!this.over()) return null;
      if (!this.final) {
        const { black, white, dead } = this.tally(), w = white + GO_KOMI, d = black - w;
        const why = this.passes >= 2 ? '' : 'Three hundred moves played. ';
        const deadNote = dead ? ` ${dead} stone${dead === 1 ? '' : 's'} that could not escape count${dead === 1 ? 's' : ''} as captured.` : '';
        this.final = { winner: d > 0 ? 0 : 1, text: `${why}You ${black}, the Scribe ${white} + 7 komi = ${w}. ${d > 0 ? `You win by ${d}.` : `The Scribe wins by ${-d}.`}${deadNote}` };
      }
      return this.final;
    },
    snapshot() { return [this.b.slice(), this.ko, this.passes, this.ply, this.last, this.caps.slice()]; },
    restore(s) { this.b = s[0].slice(); this.ko = s[1]; this.passes = s[2]; this.ply = s[3]; this.last = s[4]; this.caps = s[5].slice(); this.final = null; },
    aiPlan(pl, budget) {
      const col = pl + 1, pass = [{ pl, pass: true }];
      // After the visitor passes, pass too if the count already favours the Scribe.
      if (this.passes === 1) { const { black, white } = this.tally(); if ((col === 2 ? white + GO_KOMI - black : black - white - GO_KOMI) > 0) return pass; }
      const { root } = goSearch(this, col, budget || BUDGET_MS[LEVEL.name]);
      const kids = root.kids.filter(c => c.n).sort((a, b) => b.n - a.n);
      if (!kids.length) return pass;
      let pick0 = kids[0];
      // Gentle chooses loosely among its better candidates.
      if (LEVEL.name === 'gentle' && kids.length > 1 && Math.random() < 0.35) pick0 = kids[1 + ((Math.random() * Math.min(3, kids.length - 1)) | 0)];
      if (pick0.p < 0) return pass;
      return [{ pl, p: pick0.p }];
    },
  };

