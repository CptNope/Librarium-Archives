/* The referee: one game between two people, run on the server exactly as the hall runs a table.
 *
 * The hall's turn loop (src/hall/23-learning-the-game.js: beginTurn, humanThrow, choose) is written for the
 * page, with its waits and animations. This is the same loop with neither: it decides whose turn it is, rolls
 * the dice, offers the moves the rules allow, checks the move a player sends against them, applies it, and
 * says what happened as a list of events for the room to pass on. Each game gets an engine of its own
 * (Object.create of the rules object), so rooms sharing a server never share a board, and the dice come from
 * the server's cryptographic random numbers, never from either player.
 *
 * A referee can be packed to plain JSON after every action and unpacked later, so a room that has gone to
 * sleep wakes with its game exactly where it was. */

// The tables two people can play online: those that seat two at one screen, and the card tables that have a
// view (VIEWS, below) keeping each player's hidden cards from the other.
export const ONLINE = new Set(['go', 'morris', 'oware', 'brandubh', 'shatranj', 'draughts', 'reversi', 'dotsboxes', 'halma', 'alquerque', 'xiangqi', 'mutorere', 'konane', 'fanorona', 'chess', 'shogi', 'bao', 'hex', 'gomoku', 'tablut', 'makruk', 'kalah', 'morabaraba', 'janggi', 'chaturanga', 'seega', 'baghchal', 'latrunculi', 'rithmo', 'jungle', 'lewischess', 'courier', 'idraughts', 'hnefatafl',
  'ur', 'senet', 'tables', 'goose', 'snakes', 'yut', 'pachisi', 'ludo', 'tab', 'hounds', 'patolli', 'mansion', 'lifegame', 'nard', 'xii', 'hazard',
  // Card tables, each with a view below that keeps the other hand and the stock face down.
  'gin', 'ecarte']);

// A table's settings as a page sends them (the host's variant and on-off rules), kept to plain, short values.
export function cleanSettings(body) {
  const settings = { variant: body && typeof body.variant === 'string' ? body.variant.slice(0, 20) : null, toggles: {} };
  if (body && body.toggles && typeof body.toggles === 'object') for (const [k, v] of Object.entries(body.toggles).slice(0, 12)) settings.toggles[String(k).slice(0, 30)] = !!v;
  return settings;
}

// Fair dice and shuffles: the engines call Math.random, so while the referee is working it answers from
// crypto.getRandomValues, which a player cannot predict from the throws they have seen.
const cryptoRandom = () => { const a = new Uint32Array(2); crypto.getRandomValues(a); return (a[0] * 2 ** 21 + (a[1] >>> 11)) / 2 ** 53; };
function fair(fn) {
  const was = Math.random; Math.random = cryptoRandom;
  try { return fn(); } finally { Math.random = was; }
}

// The engine's own state: plain data fields, as the hall saves a game (22-saved-games.js).
function engineState(R, g) {
  const out = {}, d = Object.getOwnPropertyDescriptors(g);
  for (const k of Object.keys(d)) {
    if (!('value' in d[k]) || typeof d[k].value === 'function' || k === 'rules' || k === 'source' || k === 'surface') continue;
    out[k] = d[k].value;
  }
  return R.packState(out);
}
const plain = v => JSON.parse(JSON.stringify(v === undefined ? null : v));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function makeEngine(R, id, settings) {
  const g = Object.create(R[id]);
  g.surface = 0;
  if (g.variants) g.setVariant(settings.variant ?? g.variant); // as the hall does: the table's default unless the host chose
  for (const t of g.toggles || []) if (settings.toggles && t.id in settings.toggles) g.setToggle(t.id, !!settings.toggles[t.id]);
  return g;
}

export class Referee {
  /* settings: { variant, toggles: { id: bool } } as the host's table had them. */
  constructor(R, id, settings = {}) {
    if (!ONLINE.has(id) || !R[id]) throw new Error(`${id} cannot be played online`);
    this.R = R; this.id = id; this.settings = { variant: settings.variant ?? null, toggles: settings.toggles || {} };
    this.g = makeEngine(R, id, this.settings);
    this.phase = 'idle'; this.cur = 0; this.moves = []; this.roll = null; this.result = null; this.turns = 0;
    this.aliases = {}; // card backs: for each deal, a random number for every card (see aliasFor)
  }
  get engine() { return this.g; }
  state() { return engineState(this.R, this.g); }

  // Start the game: the first player's turn. Returns the events.
  start() {
    const g = this.g, ev = [];
    fair(() => g.init());
    if (g.human) g.human = [true, true];
    this.settings.variant = g.variant ?? this.settings.variant;
    this.begin(g.first || 0, ev);
    return ev;
  }

  // Whose turn, and what they may do: the hall's beginTurn, with a friend in the second seat.
  begin(pl, ev, depth = 0) {
    const g = this.g;
    if (depth > 8) { this.over({ winner: -1, title: 'A draw', text: 'Neither player can move.' }, ev); return; }
    this.cur = pl; this.roll = null;
    if (!g.dice) { const r = g.result(pl); if (r) return this.over(r, ev); }
    if (g.ended && g.ended()) return this.over(g.final(), ev);
    if (g.skipTurn) {
      const why = g.skipTurn(pl);
      if (why) { ev.push({ type: 'skip', seat: pl, note: why }); return this.begin(1 - pl, ev, depth + 1); }
    }
    this.turns++;
    if (g.dice) {
      const pre = g.preThrow ? g.preThrow(pl) : null;
      if (pre && pre.length) return this.offer(pre, ev);
      this.phase = 'throw'; this.moves = [];
      ev.push({ type: 'turn', seat: pl, phase: 'throw' });
      return;
    }
    return this.offer(g.legal(pl), ev);
  }
  // note: what just happened, in the rules' words; prompt: what to do now, addressed to the player choosing.
  offer(moves, ev, note, prompt) {
    this.phase = 'choose'; this.moves = moves.map(plain);
    ev.push({ type: 'turn', seat: this.cur, phase: 'choose', moves: this.moves, canPass: !!this.g.canPass, note: note || '', prompt: prompt || '' });
  }
  over(res, ev) {
    this.phase = 'over'; this.moves = []; this.result = plain(res);
    ev.push({ type: 'over', result: this.result });
  }

  // The player whose turn it is throws (humanThrow).
  throw(seat) {
    if (this.phase !== 'throw') throw new Error('not a time to throw');
    if (seat !== this.cur) throw new Error('not your turn');
    const g = this.g, ev = [];
    const r = fair(() => g.roll()), moves = g.legal(seat, r.value, r);
    this.roll = plain(r);
    ev.push({ type: 'roll', seat, roll: this.roll });
    if (!moves.length) {
      ev.push({ type: 'nomove', seat, roll: this.roll });
      this.begin(g.passTurn ? g.passTurn() : 1 - seat, ev);
      return ev;
    }
    if (g.autoMove && moves.length === 1) { this.moves = moves.map(plain); this.phase = 'choose'; return ev.concat(this.play(seat, this.moves[0], true)); }
    this.offer(moves, ev);
    return ev;
  }

  // The player whose turn it is chooses a move: by its place in the list offered, or a pass where the game
  // lets a player pass at any time (the hall's Pass button).
  choose(seat, index, pass) {
    if (this.phase !== 'choose') throw new Error('not a time to move');
    if (seat !== this.cur) throw new Error('not your turn');
    let m;
    if (pass) {
      m = this.moves.find(x => x.pass) || (this.g.canPass ? { pl: seat, pass: true } : null);
      if (!m) throw new Error('you cannot pass here');
    } else {
      m = this.moves[index];
      if (!m) throw new Error('no such move');
    }
    return this.play(seat, m, false);
  }

  // Apply a move and decide what comes next (choose).
  play(seat, m, auto) {
    const g = this.g, ev = [], before = this.state(); // the turn's own bookkeeping (skips, cached plays) happens before the move
    const res = fair(() => g.apply(Object.assign({}, m))) || {};
    const followUp = res.followUp && res.followUp.length ? res.followUp : null;
    ev.push({ type: 'move', seat, move: m, auto: !!auto, note: res.note || '', publicNote: res.publicNote, before, state: this.state() });
    if (followUp) { this.offer(followUp, ev, '', VIEWS[this.id] ? '' : g.followPrompt || ''); return ev; } // the move's own note came with it; a card table's page writes its own prompt, from its own hand
    if (m.pre && res.thenThrow) { this.phase = 'throw'; this.moves = []; ev.push({ type: 'turn', seat, phase: 'throw', prompt: 'Now throw the dice.' }); return ev; }
    if (g.dice) {
      if (g.done(seat)) { this.over(g.final ? g.final() : { winner: seat, text: g.winText ? g.winText(seat) : '' }, ev); return ev; }
      if (this.roll && g.extra(m, this.roll.value)) { this.phase = 'throw'; this.moves = []; ev.push({ type: 'turn', seat, phase: 'throw', note: g.extraNote || '' }); return ev; }
    }
    this.begin(g.passTurn ? g.passTurn() : 1 - seat, ev);
    return ev;
  }

  // Everything a player needs to pick the game up where it is: on joining, and after a lost connection.
  snapshot() {
    return { id: this.id, settings: this.settings, phase: this.phase, cur: this.cur, moves: this.moves, roll: this.roll, result: this.result, canPass: !!this.g.canPass, state: this.state() };
  }
  /* What one seat is sent. At a table with a view (VIEWS), every card the seat may not see is replaced by its
   * back: a negative number, the same for that card throughout one deal and drawn afresh, at random, for the
   * next, so a back says nothing about the card (aliasFor). A move event carries the state before the move as
   * well as after it: in the "before" state, the cards the move brings into view (a card played from the other
   * hand, a hand laid down at a knock) are already shown, so the page can play the move itself and land on the
   * "after" state; the move's own cards are given as backs where the seat may not see them (a discard made face
   * down), and the note is the public one where the rules give one (the mover alone reads which card they drew). */
  aliasFor(st) {
    const spec = VIEWS[this.id], ep = String(spec.epoch(st));
    if (!this.aliases[ep]) {
      const r = new Uint32Array(spec.deck.length); crypto.getRandomValues(r);
      const map = {}; spec.deck.map((v, i) => [r[i], v]).sort((a, b) => a[0] - b[0]).forEach(([, v], k) => { map[v] = -(1 + k); });
      this.aliases[ep] = map;
      const eps = Object.keys(this.aliases); if (eps.length > 3) delete this.aliases[eps[0]];
    }
    return this.aliases[ep];
  }
  redact(seat, st, reveal) {
    const spec = VIEWS[this.id];
    if (!spec) return st;
    const out = plain(st), alias = this.aliasFor(st);
    for (const path of spec.hidden(seat, st)) {
      const arr = getPath(out, path);
      if (Array.isArray(arr)) {
        arr.forEach((v, i) => { const a = hideCard(v, alias, reveal); if (a !== v) arr[i] = a; });
        // A hand the rules keep sorted is sorted again by its backs, as the page will sort it: left in the
        // order of the cards, the backs would tell where each card sits in the suits.
        if (spec.sortHidden && spec.sortHidden.includes(pathKey(path).replace(/\.\d+$/, ''))) spec.sort(this.R[this.id], arr);
      } else if (typeof arr === 'number') setPath(out, path, hideCard(arr, alias, reveal));
    }
    return out;
  }
  snapshotFor(seat) {
    const s = this.snapshot();
    s.state = this.redact(seat, s.state);
    if (s.cur !== seat) s.moves = []; // the other player's choices are theirs
    return s;
  }
  eventsFor(seat, events) {
    const spec = VIEWS[this.id];
    return events.map(e => {
      if (e.type === 'turn' && e.seat !== seat) { const o = Object.assign({}, e); delete o.moves; return o; }
      if (e.type !== 'move') return e;
      const o = Object.assign({}, e); delete o.publicNote;
      if (seat !== e.seat && e.publicNote != null) o.note = e.publicNote;
      if (!spec) return o;
      // Cards the move brings into view for this seat: shown already in "before".
      const visA = cardCounts(e.state, visiblePaths(spec, seat, e.state)), visB = cardCounts(e.before, visiblePaths(spec, seat, e.before));
      const hidB = cardCounts(e.before, spec.hidden(seat, e.before)), reveal = new Map();
      for (const [v, n] of visA) { const d = n - (visB.get(v) || 0); if (d > 0 && (hidB.get(v) || 0) > 0 && (hidB.get(v) || 0) <= d) reveal.set(v, d); }
      const shown = new Set(reveal.keys());
      o.state = this.redact(seat, e.state);
      o.before = this.redact(seat, e.before, reveal);
      const alias = this.aliasFor(e.before), still = v => typeof v === 'number' && hidB.has(v) && !shown.has(v);
      o.move = plain(e.move);
      for (const f of spec.moveCards) {
        if (Array.isArray(o.move[f])) o.move[f] = o.move[f].map(v => (still(v) ? alias[v] : v));
        else if (still(o.move[f])) o.move[f] = alias[o.move[f]];
      }
      return o;
    });
  }
  // Packed for the room's storage, and back.
  pack() { return plain({ id: this.id, settings: this.settings, phase: this.phase, cur: this.cur, moves: this.moves, roll: this.roll, result: this.result, turns: this.turns, aliases: this.aliases, state: this.state() }); }
  static unpack(R, d) {
    const ref = new Referee(R, d.id, d.settings);
    const g = ref.g;
    fair(() => g.init());
    if (g.human) g.human = [true, true];
    Object.assign(g, R.unpackState(d.state));
    Object.assign(ref, { phase: d.phase, cur: d.cur, moves: d.moves, roll: d.roll, result: d.result, turns: d.turns || 0, aliases: d.aliases || {} });
    return ref;
  }
  // Does the engine come back from its packed state as it was? (Used by the tests for every online game.)
  static roundTrips(R, ref) { return same(Referee.unpack(R, ref.pack()).state(), ref.state()); }
}

/* Card tables: what each seat may see.
 *
 *   deck      every card value the game uses (each once)
 *   epoch     a number that changes with every deal: card backs are drawn afresh for each
 *   cards     every place a card can be, as paths into the state (each an array of cards, or one card)
 *   hidden    the places this seat may not see, as it stands (some open at the end of a hand)
 *   public    the state's other fields, each checked to hold nothing hidden (see the notes on each)
 *   moveCards the fields of a move that name cards
 *   sortHidden, sort   places the rules keep sorted (hands), and the rules' own sort for them
 *
 * The tests play every card table out and check that each field of its state is listed (cards, or public), and
 * that no card a seat has never seen is ever named in what that seat is sent. */
const getPath = (o, path) => path.reduce((x, k) => (x == null ? x : x[k]), o);
function setPath(o, path, v) { const p = getPath(o, path.slice(0, -1)); if (p != null) p[path[path.length - 1]] = v; }
function hideCard(v, alias, reveal) {
  if (typeof v !== 'number' || v < 0) return v;
  if (reveal && reveal.get(v) > 0) { reveal.set(v, reveal.get(v) - 1); return v; }
  return alias[v] ?? -999;
}
const pathKey = p => p.join('.');
function visiblePaths(spec, seat, st) { const hid = new Set(spec.hidden(seat, st).map(pathKey)); return spec.cards(st).filter(p => !hid.has(pathKey(p))); }
function cardCounts(st, paths) {
  const n = new Map(), add = v => { if (typeof v === 'number' && v >= 0) n.set(v, (n.get(v) || 0) + 1); };
  for (const p of paths) { const x = getPath(st, p); if (Array.isArray(x)) x.forEach(add); else add(x); }
  return n;
}
const FRENCH = Array.from({ length: 52 }, (_, i) => i);
export const VIEWS = {
  // Gin rummy. The stock is face down; each hand is the other's secret until a knock lays both down (stage
  // 'next' with show). Public: the discard pile, the cards each player took from it (seen, taken), the knock
  // card (knocked: laid down at once), the showdown (show), the scores and the notes.
  gin: {
    deck: FRENCH,
    epoch: st => st.handNo,
    cards: () => [['hands', 0], ['hands', 1], ['pile'], ['stock']],
    hidden: (seat, st) => [['stock']].concat(st.stage === 'next' && st.show ? [] : [['hands', 1 - seat]]),
    sortHidden: ['hands'], sort: (G, h) => { const t = Object.create(G); t.hands = [h]; t.sort(0); },
    public: ['variant', 'limit', 'score', 'boxes', 'dealer', 'handNo', 'over', 'decided', 'notes', 'stage', 'passes', 'toMove', 'taken', 'knocking', 'seen', 'show', 'knocked'],
    moveCards: ['card'],
  },
  // Écarté (32 cards: 2 to 6 are not dealt, but backs are drawn for the whole French deck). The talon is face
  // down, and so is each player's discard pile in the exchange; each hand is the other's secret, and so are
  // the cards the player exchanging has marked. Public: the turned-up trump, the tricks (trick, played,
  // lastTrick), the king announced, the proposals and scores, and the notes.
  ecarte: {
    deck: FRENCH,
    epoch: st => st.handNo,
    cards: () => [['hands', 0], ['hands', 1], ['stock'], ['discards', 0], ['discards', 1], ['marked'], ['played'], ['turnUp']],
    hidden: (seat, st) => [['stock'], ['hands', 1 - seat], ['discards', 1 - seat]].concat(st.toMove === seat ? [] : [['marked']]),
    sortHidden: ['hands'], sort: (G, h) => { const t = Object.create(G); t.hands = [h]; t.sortAll(); },
    public: ['variant', 'score', 'dealer', 'handNo', 'over', 'decided', 'notes', 'elder', 'turnUp', 'trump', 'proposals', 'vulnerable', 'exchanged', 'trick', 'tricks', 'played', 'lastTrick', 'kingSaid', 'dealNote', 'stage', 'toMove'],
    moveCards: ['card', 'cards'],
  },
};
