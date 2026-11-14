  /* --------------------------------------------------------------- Koi-koi
   * 48 hanafuda cards: card c is month c >> 2 (0 pine ... 11 paulownia), and
   * HF_KIND[c] its kind: b bright, a animal, r ribbon (red poem, blue or plain
   * red), k chaff. Player 0 is the visitor; the oya (dealer) plays first. */
  const HF_MONTH = ['pine', 'plum', 'cherry', 'wisteria', 'iris', 'peony', 'bush clover', 'pampas', 'chrysanthemum', 'maple', 'willow', 'paulownia'];
  const HF_CARDS = [ // [kind, name] for the four cards of each month
    [['b', 'crane'], ['rp', 'red poem ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'bush warbler'], ['rp', 'red poem ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['b', 'curtain'], ['rp', 'red poem ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'cuckoo'], ['rr', 'red ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'eight-plank bridge'], ['rr', 'red ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'butterflies'], ['rb', 'blue ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'boar'], ['rr', 'red ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['b', 'moon'], ['a', 'geese'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'sake cup'], ['rb', 'blue ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['a', 'deer'], ['rb', 'blue ribbon'], ['k', 'chaff'], ['k', 'chaff']],
    [['b', 'rain man'], ['a', 'swallow'], ['rr', 'red ribbon'], ['k', 'lightning']],
    [['b', 'phoenix'], ['k', 'chaff'], ['k', 'chaff'], ['k', 'chaff']]
  ];
  const hfKind = c => HF_CARDS[c >> 2][c & 3][0];
  const hfName = c => `${HF_MONTH[c >> 2]} ${HF_CARDS[c >> 2][c & 3][1]}`;
  const HF = { RAIN: 40, MOON: 28, CURTAIN: 8, SAKE: 32, BOAR: 24, DEER: 36, BUTTERFLIES: 20 };
  const hfValue = c => { const k = hfKind(c); return k === 'b' ? 20 : k === 'a' ? (c === HF.SAKE ? 16 : [HF.BOAR, HF.DEER, HF.BUTTERFLIES].includes(c) ? 12 : 10) : k === 'rp' || k === 'rb' ? 7 : k === 'rr' ? 5 : 1; };
  function hfYaku(pile) { // [{name, pts}] for a pile of captured cards
    const has = c => pile.includes(c), out = [];
    const brights = pile.filter(c => hfKind(c) === 'b'), rain = has(HF.RAIN);
    if (brights.length === 5) out.push(['gokō, five brights', 10]);
    else if (brights.length === 4) out.push(rain ? ['ame-shikō, four brights with the rain man', 7] : ['shikō, four brights', 8]);
    else if (brights.length === 3 && !rain) out.push(['sankō, three brights', 5]);
    if (has(HF.MOON) && has(HF.SAKE)) out.push(['tsukimi-zake, moon and sake', 5]);
    if (has(HF.CURTAIN) && has(HF.SAKE)) out.push(['hanami-zake, cherry blossom and sake', 5]);
    if (has(HF.BOAR) && has(HF.DEER) && has(HF.BUTTERFLIES)) out.push(['inoshikachō, boar, deer and butterflies', 5]);
    if (pile.filter(c => hfKind(c) === 'rp').length === 3) out.push(['akatan, the red poem ribbons', 5]);
    if (pile.filter(c => hfKind(c) === 'rb').length === 3) out.push(['aotan, the blue ribbons', 5]);
    const n = { a: 0, r: 0, k: 0 }; pile.forEach(c => { const k = hfKind(c)[0]; if (n[k] !== undefined) n[k]++; });
    if (n.a >= 5) out.push([`tane, ${n.a} animals`, n.a - 4]);
    if (n.r >= 5) out.push([`tan, ${n.r} ribbons`, n.r - 4]);
    if (n.k >= 10) out.push([`kasu, ${n.k} chaff`, n.k - 9]);
    return out;
  }
  const hfPoints = pile => hfYaku(pile).reduce((t, y) => t + y[1], 0);
  const KOIKOI = {
    id: 'koikoi', name: 'Koi-koi', dice: false, first: 0, cardName: hfName,
    MONTH: HF_MONTH, kind: hfKind, yaku: hfYaku, points: hfPoints,
    variants: [{ id: '3', label: '3 months' }, { id: '6', label: '6 months' }, { id: '12', label: '12 months' }], variant: '6', variantLabel: 'Game',
    setVariant(id) { this.variant = ['3', '6', '12'].includes(id) ? id : '6'; },
    rules: [
      'Forty-eight flower cards, four for each month. Each of you holds eight, eight lie face up between you, and the rest are the draw pile. The dealer (oya) plays first; you deal the first month.',
      'On your turn, play a card from your hand. If a card of the same month lies on the table, take both into your pile; if two do, choose one; if three do, take all four. If none does, your card stays on the table.',
      'Then turn up the top card of the pile and match it the same way.',
      'Collect combinations (yaku): five brights 10, four brights 8 (7 with the rain man), three brights 5 (not with the rain man); moon and sake 5; cherry blossom and sake 5; boar, deer and butterflies 5; the three red poem ribbons 5; the three blue ribbons 5; five animals, five ribbons or ten chaff 1, and 1 more for each card beyond.',
      'When you make a new yaku you may stop and score, or call koi-koi and play on for more. If you call koi-koi and the Scribe then stops first, it scores double and you score nothing. A score of 7 or more doubles.',
      'If the hands run out with no yaku, the dealer scores 1. The winner of a month deals the next. Highest total after the last month wins.'
    ],
    source: 'Koi-koi as commonly played in Japan, after the rules on Wikipedia. Four of a month or four pairs dealt to a player score 6 at once; the same on the table means a redeal.',
    get followPrompt() { return this.need === 'koi' ? 'You have a new yaku. Stop and score, or call koi-koi and play on?' : 'Two cards of that month are on the table: choose one to take.'; },
    init() { this.total = [0, 0]; this.month = 0; this.oya = 0; this.over = null; this.deal(); },
    deal() {
      for (let tries = 0; tries < 50; tries++) {
        const d = Array.from({ length: 48 }, (_, i) => i); for (let i = 47; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
        this.hands = [d.slice(0, 8), d.slice(8, 16)]; this.field = d.slice(16, 24); this.pile = d.slice(24);
        const four = cs => { const n = Array(12).fill(0); cs.forEach(c => n[c >> 2]++); return n.some(x => x === 4) || n.filter(x => x === 2).length === 4; };
        if (!four(this.field)) break; // four of a month, or four pairs, on the table: deal again
      }
      this.hands.forEach(h => h.sort((a, b) => a - b));
      this.won = [[], []]; this.koi = [false, false]; this.lastPts = [0, 0];
      this.toMove = this.oya; this.need = 'play'; this.pendingDraw = null; this.notes = []; this.month++;
      // Four of a month or four pairs in a hand (teshi, kuttsuki) score 6 at once.
      for (const pl of [this.oya, 1 - this.oya]) {
        const n = Array(12).fill(0); this.hands[pl].forEach(c => n[c >> 2]++);
        if (n.some(x => x === 4) || n.filter(x => x === 2).length === 4) { this.endMonth(pl, 6, [`${pl ? 'The Scribe was' : 'You were'} dealt ${n.some(x => x === 4) ? 'all four cards of a month (teshi)' : 'four pairs (kuttsuki)'}: 6 points.`]); break; }
      }
    },
    get rounds() { return +this.variant; },
    matches(c) { return this.field.filter(f => f >> 2 === c >> 2); },
    legal(pl) {
      if (this.over || pl !== this.toMove) return [];
      if (this.need === 'next') return [{ pl, kind: 'next', label: this.month >= this.rounds ? 'See the result' : 'Next month' }];
      if (this.need === 'koi') return [{ pl, kind: 'stop', label: `Stop and score ${this.scoreNow(pl)}` }, { pl, kind: 'koikoi', label: 'Koi-koi!' }];
      if (this.need === 'draw') return this.matches(this.pendingDraw).map(f => ({ pl, kind: 'draw', c: this.pendingDraw, take: f }));
      const out = [];
      for (const c of this.hands[pl]) {
        const m = this.matches(c);
        if (m.length === 2) for (const f of m) out.push({ pl, kind: 'play', c, take: f });
        else out.push({ pl, kind: 'play', c, take: m.length ? m[0] : null });
      }
      return out;
    },
    // The score a player would bank by stopping now.
    scoreNow(pl) { let p = hfPoints(this.won[pl]); if (p >= 7) p *= 2; if (this.koi[1 - pl]) p *= 2; return p; },
    capture(pl, c, take, events) {
      const same = this.matches(c);
      if (!same.length) { this.field.push(c); events.push({ type: 'toField', pl, c }); return; }
      const got = same.length === 3 ? same : [take];
      for (const f of got) this.field.splice(this.field.indexOf(f), 1);
      this.won[pl].push(c, ...got); events.push({ type: 'capture', pl, cards: [c, ...got] });
    },
    apply(m) {
      const pl = m.pl, events = [], notes = [];
      if (m.kind === 'next') {
        if (this.month >= this.rounds) { this.finishGame(); return { note: '', events }; }
        this.deal(); events.push({ type: 'deal' });
        return { note: this.need === 'next' ? this.notes.join(' ') : `${HF_MONTH[(this.month - 1) % 12][0].toUpperCase() + HF_MONTH[(this.month - 1) % 12].slice(1)} month. ${this.oya ? 'The Scribe deals and plays first.' : 'You deal and play first.'}`, events };
      }
      if (m.kind === 'stop') { this.endMonth(pl, this.scoreNow(pl), [`${pl ? 'The Scribe stops' : 'You stop'} and ${pl ? 'scores' : 'score'} ${this.scoreNow(pl)}.`]); return { note: this.notes.join(' '), events: [{ type: 'end' }] }; }
      if (m.kind === 'koikoi') { this.koi[pl] = true; this.passOn(pl); return { note: pl ? 'The Scribe calls koi-koi!' : 'Koi-koi! You play on.', events }; }
      if (m.kind === 'play') {
        this.hands[pl].splice(this.hands[pl].indexOf(m.c), 1);
        this.capture(pl, m.c, m.take, events);
        const d = this.pile.shift(); events.push({ type: 'drawn', pl, c: d });
        if (this.matches(d).length === 2 && pl === 0) { this.pendingDraw = d; this.need = 'draw'; return { note: `You turn up the ${hfName(d)}.`, events, followUp: this.legal(pl) }; }
        const two = this.matches(d); this.capture(pl, d, two.length === 2 ? two.reduce((x, y) => (hfValue(y) > hfValue(x) ? y : x)) : two[0], events);
      } else if (m.kind === 'draw') { this.capture(pl, m.c, m.take, events); this.pendingDraw = null; }
      return this.afterTurn(pl, events, notes);
    },
    afterTurn(pl, events, notes) {
      const pts = hfPoints(this.won[pl]);
      if (pts > this.lastPts[pl]) {
        this.lastPts[pl] = pts;
        const names = hfYaku(this.won[pl]).map(y => y[0]).join('; ');
        notes.push(`${pl ? 'The Scribe has' : 'You have'} ${names}.`);
        if (pl === 0) { this.need = 'koi'; return { note: notes.join(' '), events, followUp: this.legal(0) }; }
        if (this.aiStop()) { const s = this.scoreNow(1); this.endMonth(1, s, notes.concat([`The Scribe stops and scores ${s}.`])); return { note: this.notes.join(' '), events: events.concat([{ type: 'end' }]) }; }
        this.koi[1] = true; notes.push('The Scribe calls koi-koi!');
      }
      this.passOn(pl);
      if (this.need === 'next') events.push({ type: 'end' });
      return { note: (notes.concat(this.need === 'next' ? this.notes : [])).join(' '), events };
    },
    passOn(pl) {
      this.need = 'play'; this.toMove = 1 - pl;
      if (!this.hands[0].length && !this.hands[1].length) this.endMonth(this.oya, 1, ['The hands are empty with no one stopping: the dealer scores 1.']);
    },
    endMonth(pl, pts, notes) {
      this.total[pl] += pts; this.oya = pl;
      this.notes = notes.concat([`After ${this.month} of ${this.rounds} months: you ${this.total[0]}, the Scribe ${this.total[1]}.`]);
      this.need = 'next'; this.toMove = 0;
    },
    finishGame() {
      const [a, b] = this.total;
      this.over = { winner: a > b ? 0 : b > a ? 1 : -1, title: a > b ? 'You win' : b > a ? 'The Scribe wins' : 'A draw', text: `${a} to ${b} after ${this.rounds} months.` };
    },
    passTurn() { return this.over ? 0 : this.toMove; },
    ended() { return !!this.over; },
    final() { return this.over; },
    result() { return this.over || null; },
    // The Scribe stops when it is ahead in the match or holds 7 or more; otherwise, with cards left, it may press on.
    aiStop() {
      const s = this.scoreNow(1), left = this.hands[1].length, behind = this.total[0] - this.total[1];
      if (LEVEL.name === 'gentle') return Math.random() < 0.6;
      if (s >= 7 || left <= 2) return true;
      if (LEVEL.name === 'sharp') { const oppNear = hfPoints(this.won[0]) > 0 || this.won[0].length >= 10; return oppNear || behind <= 0 ? true : left < 5; }
      return true;
    },
    // Sharp: what the field left after a play offers the opponent, weighed by the chance they hold a card of
    // each month there (counted from the cards it cannot see) and the yaku each card would build for them.
    threat(pl, seen, taken, added) {
      const opp = 1 - pl, h = this.hands[opp].length; if (!h) return 0;
      const field = this.field.filter(c => !taken.includes(c)).concat(added);
      const unseen = []; for (let c = 0; c < 48; c++) if (!seen.has(c) && !added.includes(c)) unseen.push(c);
      const U = unseen.length, base = hfPoints(this.won[opp]), months = new Map();
      for (const f of field) { const gain = hfValue(f) + 25 * (hfPoints(this.won[opp].concat([f])) - base); months.set(f >> 2, Math.max(months.get(f >> 2) || 0, gain)); }
      let t = 0;
      for (const [mo, gain] of months) {
        const k = unseen.filter(c => c >> 2 === mo).length; if (!k) continue;
        let none = 1; for (let i = 0; i < h; i++) none *= Math.max(0, (U - k - i) / (U - i)); // chance they hold none of the k
        t += (1 - none) * gain;
      }
      return t;
    },
    // Score a play: what it takes now, what it leaves for the opponent, and yaku in the making.
    aiPlan(pl) {
      const ms = this.legal(pl);
      if (LEVEL.name === 'gentle' && Math.random() < 0.4) return [ms[(Math.random() * ms.length) | 0]];
      const seen = new Set(this.won[0].concat(this.won[1], this.field, this.hands[pl]));
      const deadMonth = m => [0, 1, 2, 3].every(k => seen.has(m * 4 + k)); // every card of the month accounted for
      let best = ms[0], bv = -Infinity;
      for (const m of ms) {
        let v = 0;
        if (m.kind !== 'play' && m.kind !== 'draw') { v = 0; }
        else {
          const same = this.matches(m.c), got = !same.length ? [] : same.length === 3 ? [m.c, ...same] : [m.c, m.take];
          const before = hfPoints(this.won[pl]), after = hfPoints(this.won[pl].concat(got));
          v = got.reduce((t, c) => t + hfValue(c), 0) + (after - before) * 25;
          if (!got.length) v -= hfValue(m.c) * (deadMonth(m.c >> 2) ? 0.2 : 1.2); // a card left on the table may feed the opponent
          if (LEVEL.name === 'sharp' && m.kind === 'play') v -= 1.5 * this.threat(pl, seen, got.length ? got : [], got.length ? [] : [m.c]);
        }
        v += Math.random() * pick(6, 1, 0.2);
        if (v > bv) { bv = v; best = m; }
      }
      return [best];
    },
  };

