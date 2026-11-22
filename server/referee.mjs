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

// The tables two people can play online: those that already seat two at one screen, less any whose hands
// or tiles are hidden from the other player (those wait for views that keep them hidden: see docs/online.md).
export const ONLINE = new Set(['go', 'morris', 'oware', 'brandubh', 'shatranj', 'draughts', 'reversi', 'dotsboxes', 'halma', 'alquerque', 'xiangqi', 'mutorere', 'konane', 'fanorona', 'chess', 'shogi', 'bao', 'hex', 'gomoku', 'tablut', 'makruk', 'kalah', 'morabaraba', 'janggi', 'chaturanga', 'seega', 'baghchal', 'latrunculi', 'rithmo', 'jungle', 'lewischess', 'courier', 'idraughts', 'hnefatafl',
  'ur', 'senet', 'tables', 'goose', 'snakes', 'yut', 'pachisi', 'ludo', 'tab', 'hounds', 'patolli', 'mansion', 'lifegame', 'nard', 'xii', 'hazard']);

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
    ev.push({ type: 'move', seat, move: m, auto: !!auto, note: res.note || '', before, state: this.state() });
    if (followUp) { this.offer(followUp, ev, '', g.followPrompt || ''); return ev; } // the move's own note came with it
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
  // Packed for the room's storage, and back.
  pack() { return plain({ id: this.id, settings: this.settings, phase: this.phase, cur: this.cur, moves: this.moves, roll: this.roll, result: this.result, turns: this.turns, state: this.state() }); }
  static unpack(R, d) {
    const ref = new Referee(R, d.id, d.settings);
    const g = ref.g;
    fair(() => g.init());
    if (g.human) g.human = [true, true];
    Object.assign(g, R.unpackState(d.state));
    Object.assign(ref, { phase: d.phase, cur: d.cur, moves: d.moves, roll: d.roll, result: d.result, turns: d.turns || 0 });
    return ref;
  }
  // Does the engine come back from its packed state as it was? (Used by the tests for every online game.)
  static roundTrips(R, ref) { return same(Referee.unpack(R, ref.pack()).state(), ref.state()); }
}

/* What one seat may see of a game's state. Every online table today shows everything to both players, so
 * the view is the state. A table with hidden hands registers a view here that lays the other player's cards
 * and the stock face down (a placeholder in place of each card), so they never reach the other device. */
export const VIEWS = {};
export function viewOf(id, seat, state) { const v = VIEWS[id]; return v ? v(seat, state) : state; }
