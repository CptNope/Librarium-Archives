  /* ----------------------------------------------------------------- Mahjong
   * 136 tiles, each an id 0-135 whose type is id >> 2: 0-8 dots 1-9, 9-17
   * bamboo, 18-26 characters, 27-30 winds (east, south, west, north), 31-33
   * dragons (red, green, white). Four seats: 0 is the visitor (East, the
   * dealer); 1, 2 and 3 are Scribes, and play passes 0, 1, 2, 3. In the
   * Archives' two-sided turns, "player 1" is the three Scribes together:
   * everything that happens between the visitor's decisions is one Scribe turn. */
  const MJ_SEATS = ['East', 'South', 'West', 'North'];
  const MJ_TERM = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  const mjCounts = ids => { const c = new Array(34).fill(0); for (const id of ids) c[id >> 2]++; return c; };
  function mjShantenStd(c, open) {
    let best = 8;
    const dfs = (i, m, t, p) => {
      while (i < 34 && !c[i]) i++;
      if (i >= 34) { const mm = m + open, tt = Math.min(t, 4 - mm); const v = 8 - 2 * mm - tt - p; if (v < best) best = v; return; }
      if (c[i] >= 3) { c[i] -= 3; dfs(i, m + 1, t, p); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; dfs(i, m + 1, t, p); c[i]++; c[i + 1]++; c[i + 2]++; }
      if (!p && c[i] >= 2) { c[i] -= 2; dfs(i, m, t, 1); c[i] += 2; }
      if (c[i] >= 2) { c[i] -= 2; dfs(i, m, t + 1, p); c[i] += 2; }
      if (i < 27 && i % 9 <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; dfs(i, m, t + 1, p); c[i]++; c[i + 1]++; }
      if (i < 27 && i % 9 <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; dfs(i, m, t + 1, p); c[i]++; c[i + 2]++; }
      const keep = c[i]; c[i] = 0; dfs(i + 1, m, t, p); c[i] = keep;
    };
    dfs(0, 0, 0, 0);
    return best;
  }
  // How many tiles from ready (0) or complete (-1) a hand is, counting seven pairs and thirteen orphans too.
  function mjShanten(ids, open) {
    const c = mjCounts(ids);
    let s = mjShantenStd(c, open);
    if (!open) {
      let pairs = 0, kinds = 0; for (const n of c) { if (n) kinds++; if (n >= 2) pairs++; }
      s = Math.min(s, 6 - pairs + Math.max(0, 7 - kinds));
      let t = 0, tp = 0; for (const k of MJ_TERM) { if (c[k]) t++; if (c[k] >= 2) tp = 1; }
      s = Math.min(s, 13 - t - tp);
    }
    return s;
  }
  const mjName = t => (t < 27 ? `${(t % 9) + 1} ${['dots', 'bamboo', 'characters'][(t / 9) | 0]}` : ['east wind', 'south wind', 'west wind', 'north wind', 'red dragon', 'green dragon', 'white dragon'][t - 27]);
  const MAHJONG = {
    id: 'mahjong', name: 'Mahjong', dice: false, first: 0, SEATS: MJ_SEATS, shanten: mjShanten, tileName: mjName,
    followPrompt: 'Now discard a tile.',
    rules: [
      'You sit at East, nearest the table\'s front, against three Scribes. Each hand is thirteen tiles; on your turn you draw a fourteenth and discard one by clicking it.',
      'Go out with four sets and a pair: a set is a pung (three alike), a kong (four alike) or a chow (a run of three in one suit). Seven pairs, or one of each terminal and honour plus one more (thirteen orphans), also win.',
      'You can claim another player\'s discard to win, or to make a pung or kong; a chow only from the player on your left (North). The buttons show what you can claim. A win beats a pung or kong, which beats a chow.',
      'Declare a kong of four alike from your hand with its button; you then draw a replacement tile.',
      'The first to go out wins the hand. If the wall runs out first, the hand is drawn. Scoring varies so much between rule sets that the Archives leave it out.'
    ],
    source: 'Common modern rules for 136 tiles without flowers. Scoring is left out: whoever goes out first wins.',
    init() {
      const wall = Array.from({ length: 136 }, (_, i) => i);
      for (let i = wall.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [wall[i], wall[j]] = [wall[j], wall[i]]; }
      this.wall = wall; this.hands = [[], [], [], []]; this.melds = [[], [], [], []]; this.discards = [[], [], [], []];
      for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) this.hands[s].push(this.wall.shift());
      this.hands[0].push(this.wall.shift());
      this.hands.forEach(h => h.sort((a, b) => a - b));
      this.need = { type: 'discard', seat: 0 }; this.winner = null; this.how = '';
    },
    open(seat) { return this.melds[seat].length; },
    tilesOf(seat) { return this.hands[seat].map(id => id >> 2); },
    complete(seat, extra) { const ids = extra === undefined ? this.hands[seat] : this.hands[seat].concat([extra]); return mjShanten(ids, this.open(seat)) === -1; },
    // Kongs the seat may declare from its own hand: four alike, or the fourth tile of a pung it already shows.
    ownKongs(seat) {
      const c = mjCounts(this.hands[seat]), out = [];
      c.forEach((n, t) => { if (n === 4) out.push({ kind: 'ckong', seat, type: t }); });
      for (const m of this.melds[seat]) if (m.type === 'pung' && c[m.tiles[0] >> 2]) out.push({ kind: 'akong', seat, type: m.tiles[0] >> 2 });
      return out;
    },
    // What each seat could do with a discard.
    claimsFor(seat, d) {
      const t = d.tile >> 2, own = this.hands[seat].filter(id => id >> 2 === t), out = [];
      if (this.complete(seat, d.tile)) out.push({ kind: 'ron', seat, pri: 3 });
      if (own.length >= 3) out.push({ kind: 'kong', seat, pri: 2, use: own.slice(0, 3) });
      if (own.length >= 2) out.push({ kind: 'pung', seat, pri: 2, use: own.slice(0, 2) });
      if (seat === (d.seat + 1) % 4 && t < 27) {
        const n = t % 9, has = k => this.hands[seat].find(id => id >> 2 === k);
        for (const [a, b] of [[-2, -1], [-1, 1], [1, 2]]) {
          if (n + a < 0 || n + b > 8) continue;
          const x = has(t + a), y = has(t + b);
          if (x !== undefined && y !== undefined) out.push({ kind: 'chow', seat, pri: 1, use: [x, y], run: [t + a, t, t + b].sort((p, q) => p - q) });
        }
      }
      return out;
    },
    // The Scribes' choice of claim on a discard, if any (the strongest, nearest in turn order for a win).
    aiClaim(d) {
      let best = null;
      for (let k = 1; k <= 3; k++) {
        const seat = (d.seat + k) % 4; if (seat === 0) continue;
        for (const c of this.claimsFor(seat, d)) {
          if (!this.aiWants(seat, c, d)) continue;
          if (!best || c.pri > best.pri) best = Object.assign({}, c, { order: k });
        }
      }
      return best;
    },
    aiWants(seat, c, d) {
      if (c.kind === 'ron') return true;
      const lv = LEVEL.name;
      if (lv === 'gentle' && Math.random() < 0.5) return false;
      const before = mjShanten(this.hands[seat], this.open(seat));
      const rest = this.hands[seat].filter(id => !c.use.includes(id));
      // After the claim the seat discards; take the claim if that leaves it closer to winning.
      let after = 9; for (const id of rest) { const r = rest.filter(x => x !== id); after = Math.min(after, mjShanten(r, this.open(seat) + 1)); }
      if (c.kind === 'kong') return after <= before && lv !== 'gentle';
      return after < before || (lv === 'gentle' && after <= before);
    },
    // Set up the claim phase for a discard: decide the Scribes' claim, and what the visitor may claim over it.
    openClaims(d) {
      const ai = this.aiClaim(d);
      let mine = d.seat === 0 ? [] : this.claimsFor(0, d);
      if (ai) mine = mine.filter(c => c.pri > ai.pri || (c.kind === 'ron' && ai.kind === 'ron' && ((0 - d.seat + 4) % 4) < ai.order));
      this.need = { type: 'claim', d, ai, mine, passed: !mine.length };
    },
    label(m) {
      const t = m.type !== undefined ? m.type : this.need.d ? this.need.d.tile >> 2 : 0;
      return { tsumo: 'Mahjong! Declare the win', ron: 'Mahjong! Win on this tile', pung: 'Pung', kong: 'Kong', pass: 'Pass', ckong: `Kong (${mjName(t)})`, akong: `Add to kong (${mjName(t)})` }[m.kind] || (m.kind === 'chow' ? `Chow ${m.run.map(k => (k % 9) + 1).join('-')}` : '');
    },
    legal(pl) {
      if (pl !== 0 || this.winner !== null || this.need.type === 'over') return [];
      const n = this.need;
      if (n.type === 'discard' && n.seat === 0) {
        const out = this.hands[0].map(id => ({ pl: 0, kind: 'discard', seat: 0, tile: id }));
        if (this.complete(0)) out.push({ pl: 0, kind: 'tsumo', seat: 0 });
        if (this.wall.length) for (const k of this.ownKongs(0)) out.push(Object.assign({ pl: 0 }, k));
        out.forEach(m => { if (m.kind !== 'discard') m.label = this.label(m); });
        return out;
      }
      if (n.type === 'claim' && !n.passed) return n.mine.map(c => Object.assign({ pl: 0 }, c, { label: this.label(c) })).concat([{ pl: 0, kind: 'pass', seat: 0, label: 'Pass' }]);
      return [];
    },
    take(seat, ids) { this.hands[seat] = this.hands[seat].filter(id => !ids.includes(id)); },
    apply(m) {
      const S = MJ_SEATS, who = m.seat === 0 ? 'You' : S[m.seat];
      const res = { note: '' };
      switch (m.kind) {
        case 'draw': {
          if (!this.wall.length) { this.need = { type: 'over' }; res.note = 'The wall is empty.'; break; }
          const id = m.replacement ? this.wall.pop() : this.wall.shift();
          this.hands[m.seat].push(id); res.tile = id;
          this.need = { type: 'discard', seat: m.seat };
          break;
        }
        case 'discard': {
          this.take(m.seat, [m.tile]); this.discards[m.seat].push(m.tile);
          this.hands[m.seat].sort((a, b) => a - b);
          this.openClaims({ seat: m.seat, tile: m.tile });
          break;
        }
        case 'tsumo': this.winner = m.seat; this.how = 'self'; this.need = { type: 'over' }; res.note = m.seat === 0 ? 'Mahjong! You go out on your own draw.' : `${S[m.seat]} declares mahjong on its own draw.`; break;
        case 'ron': {
          const d = this.need.d; this.discards[d.seat].pop(); this.hands[m.seat].push(d.tile);
          this.winner = m.seat; this.how = d.seat; this.need = { type: 'over' };
          res.note = m.seat === 0 ? `Mahjong! You win on ${S[d.seat]}'s ${mjName(d.tile >> 2)}.` : `${S[m.seat]} wins on ${d.seat === 0 ? 'your' : S[d.seat] + '\'s'} ${mjName(d.tile >> 2)}.`;
          break;
        }
        case 'pung': case 'kong': case 'chow': {
          const d = this.need.d; this.discards[d.seat].pop();
          this.take(m.seat, m.use);
          const tiles = m.kind === 'chow' ? m.use.concat([d.tile]).sort((a, b) => (a >> 2) - (b >> 2)) : m.use.concat([d.tile]);
          this.melds[m.seat].push({ type: m.kind, tiles, open: true });
          this.need = m.kind === 'kong' ? { type: 'draw', seat: m.seat, replacement: true } : { type: 'discard', seat: m.seat };
          res.note = `${who} ${m.seat === 0 ? '' : ''}${m.kind === 'chow' ? 'chow' : m.kind}${m.seat === 0 ? '' : 's'} ${d.seat === 0 ? 'your' : S[d.seat] + '\'s'} ${mjName(d.tile >> 2)}.`;
          if (m.seat === 0 && m.kind !== 'kong') res.followUp = this.legal(0);
          break;
        }
        case 'ckong': {
          const ids = this.hands[m.seat].filter(id => id >> 2 === m.type); this.take(m.seat, ids);
          this.melds[m.seat].push({ type: 'kong', tiles: ids, open: false });
          this.need = { type: 'draw', seat: m.seat, replacement: true };
          res.note = m.seat === 0 ? 'You declare a kong.' : `${S[m.seat]} declares a kong.`;
          break;
        }
        case 'akong': {
          const id = this.hands[m.seat].find(x => x >> 2 === m.type); this.take(m.seat, [id]);
          const meld = this.melds[m.seat].find(x => x.type === 'pung' && x.tiles[0] >> 2 === m.type); meld.type = 'kong'; meld.tiles.push(id);
          this.need = { type: 'draw', seat: m.seat, replacement: true };
          res.note = m.seat === 0 ? 'You add the fourth tile to your pung.' : `${S[m.seat]} adds to its pung.`;
          break;
        }
        case 'pass': this.need.passed = true; break;
        case 'resolve': { // nobody claims the discard (or the Scribes' claim is not taken up): play moves on
          this.need = { type: 'draw', seat: (m.from + 1) % 4 };
          break;
        }
      }
      return res;
    },
    // One step of the Scribes' play from the current position.
    aiStep() {
      const n = this.need;
      if (n.type === 'draw') return { pl: 1, kind: 'draw', seat: n.seat, replacement: !!n.replacement };
      if (n.type === 'claim') {
        if (n.ai) return Object.assign({ pl: 1 }, n.ai);
        return { pl: 1, kind: 'resolve', seat: n.d.seat, from: n.d.seat };
      }
      // A Scribe to discard.
      const seat = n.seat, hand = this.hands[seat];
      if (this.complete(seat)) return { pl: 1, kind: 'tsumo', seat };
      if (this.wall.length && LEVEL.name !== 'gentle') { const k = this.ownKongs(seat)[0]; if (k) return Object.assign({ pl: 1 }, k); }
      return { pl: 1, kind: 'discard', seat, tile: this.chooseDiscard(seat) };
    },
    chooseDiscard(seat) {
      const hand = this.hands[seat], open = this.open(seat), lv = LEVEL.name;
      if (lv === 'gentle' && Math.random() < 0.4) return hand[(Math.random() * hand.length) | 0];
      // Tiles this seat can see: its own, every discard and every open meld.
      const seen = mjCounts(hand.concat(...this.discards, ...this.melds.map(ms => ms.flatMap(x => x.open ? x.tiles : [])).flat()));
      let best = null, bv = Infinity;
      const tried = new Set();
      for (const id of hand) {
        const t = id >> 2; if (tried.has(t)) continue; tried.add(t);
        const rest = hand.filter(x => x !== id), sh = mjShanten(rest, open);
        let v = sh * 1000;
        if (lv !== 'gentle') {
          // Prefer the discard that leaves the most tiles that would bring the hand closer.
          let wait = 0;
          for (let k = 0; k < 34; k++) { if (seen[k] >= 4) continue; if (mjShanten(rest.concat([k * 4]), open) < sh) wait += 4 - seen[k]; }
          v -= wait * (lv === 'sharp' ? 2 : 1);
          if (lv === 'sharp' && t >= 27 && seen[t] >= 3) v -= 3; // a safe, dead honour
        }
        v += Math.random() * 0.5;
        if (v < bv) { bv = v; best = id; }
      }
      return best;
    },
    result() {
      if (this.winner !== null) {
        const w = this.winner, S = MJ_SEATS;
        const how = this.how === 'self' ? 'on a self-drawn tile' : this.how === 0 ? 'on your discard' : `on ${S[this.how]}'s discard`;
        return { winner: w === 0 ? 0 : 1, text: w === 0 ? `You go out first, ${how}.` : `${S[w]} goes out first, ${how}.` };
      }
      if (this.need.type === 'over' || (this.need.type === 'draw' && !this.wall.length)) return { winner: -1, text: 'The wall ran out before anyone went out. The hand is drawn.' };
      return null;
    },
    snapshot() { return JSON.stringify({ w: this.wall, h: this.hands, m: this.melds, d: this.discards, n: this.need, x: this.winner, y: this.how }); },
    restore(s) { const o = JSON.parse(s); this.wall = o.w; this.hands = o.h; this.melds = o.m; this.discards = o.d; this.need = o.n; this.winner = o.x; this.how = o.y; },
    // Everything the Scribes do until the visitor has a decision to make, or the hand ends.
    aiPlan() {
      const root = this.snapshot(), plan = [];
      let guard = 0;
      while (this.winner === null && this.need.type !== 'over' && !this.legal(0).length && guard++ < 400) {
        if (this.need.type === 'draw' && !this.wall.length) { plan.push({ pl: 1, kind: 'draw', seat: this.need.seat }); this.need = { type: 'over' }; break; }
        const step = this.aiStep(); plan.push(step); this.apply(step);
        // The visitor's own draw is part of the Scribes' turn: it ends with the visitor holding 14 tiles.
      }
      this.restore(root);
      return plan;
    },
  };

