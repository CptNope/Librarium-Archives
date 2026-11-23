/* ---------------------------------------------------- saved games
 * A long game against the Scribe is kept in this browser at the start of each of
 * your turns (between tricks, at card tables), and comes back when you sit down
 * again. Only the engine's own state is kept; the table is rebuilt from it. */
const SAVE_OK = new Set(['ecarte', 'gin', 'spades', 'bridge', 'primero', 'madiao', 'popejoan', 'faro', 'hearts', 'pinochle', 'skat', 'karnoffel', 'ombre', 'conquian', 'cassino', 'chess', 'xiangqi', 'janggi', 'makruk', 'shatranj', 'chaturanga', 'lewischess', 'courier', 'rithmo', 'whist', 'piquet', 'bezique', 'scopa', 'euchre', 'patience', 'draughts', 'tablut', 'halma', 'reversi', 'idraughts', 'hnefatafl', 'jungle', 'mutorere', 'oware', 'kalah', 'go', 'morris', 'morabaraba', 'brandubh', 'foxgeese', 'dotsboxes', 'alquerque', 'konane', 'fanorona', 'shogi', 'bao', 'chinese', 'hex', 'gomoku', 'seega', 'baghchal', 'latrunculi', 'mahjong']);
const SAVE_VERSION = 1;
// Mahjong is kept only when it is your turn to discard: the table is laid out again from the hands, melds and discards.
GAMES.mahjong.saveable = function () { return this.need.type === 'discard' && this.need.seat === 0 && this.winner === null; };
function engineState(g) { // plain data fields only: no methods, no getters
  const out = {}, d = Object.getOwnPropertyDescriptors(g);
  for (const k of Object.keys(d)) {
    if (!('value' in d[k]) || typeof d[k].value === 'function' || k === 'rules' || k === 'source' || k === 'surface') continue;
    out[k] = d[k].value;
  }
  return R.packState(out); // typed-array boards, Sets and Maps are tagged so they come back as they were
}
function saveGame() {
  const g = play.game;
  if (!g || !SAVE_OK.has(g.id) || play.hotseat || play.phase !== 'choose' || (g.trick && g.trick.length) || (g.stage && g.stage === 'exchange' && g.marked && g.marked.length)) return;
  if (g.ended && g.ended()) return;
  if (g.saveable && !g.saveable()) return;
  store.saves = store.saves || {};
  try { store.saves[g.id] = { v: SAVE_VERSION, variant: g.variant || null, state: JSON.parse(JSON.stringify(engineState(g))) }; save(); } catch (e) { /* too large or blocked: carry on unsaved */ }
}
function loadGame(g) {
  const s = (store.saves || {})[g.id];
  play.resumeTurn = 0;
  if (!s || s.v !== SAVE_VERSION || !(SAVE_OK.has(g.id) || (s.file && HOTSEAT.has(g.id)))) return false;
  if (!!s.hotseat !== !!play.hotseat) return false; // a game at one screen comes back at one screen, and one against the Scribe against the Scribe
  if ((s.variant || null) !== (g.variant || null)) return false;
  try { Object.assign(g, R.unpackState(JSON.parse(JSON.stringify(s.state)))); } catch (e) { clearSave(g.id); g.init(); return false; }
  play.resumeTurn = s.turn | 0;
  if (s.file) clearSave(g.id); // brought from a file: it is back on the table, and the file is still the player's
  return true;
}

/* A game to a file, and a file back to its table (the Save button and the Games Desk, 23b-online.js). Any game
 * the browser keeps between visits can be saved, and any two-player game at one screen, at the start of a
 * player's turn: before a throw at a dice table, or before a move at any other. */
const FILE_VERSION = 1;
function localSaveFile() {
  const g = play.game;
  if (!g || play.online || mode !== 'play' || !(SAVE_OK.has(g.id) || HOTSEAT.has(g.id))) return null;
  if (g.ended && g.ended()) return null;
  const mine = play.hotseat || play.cur === 0;
  if (g.dice ? !(play.phase === 'throw' && mine) : !(play.phase === 'choose' && mine)) return null;
  if ((g.trick && g.trick.length) || (g.stage === 'exchange' && g.marked && g.marked.length) || (g.saveable && !g.saveable())) return null;
  const toggles = {}; for (const t of g.toggles || []) toggles[t.id] = toggleOn(g, t);
  return { librarium: 'game-save', v: FILE_VERSION, game: g.id, name: g.name, saved: new Date().toISOString(), variant: g.variant || null, toggles,
    hotseat: !!play.hotseat, turn: play.hotseat ? play.cur : 0, state: JSON.parse(JSON.stringify(engineState(g))) };
}
// Returns why the file cannot be carried on, or nothing once its table is being laid out.
function loadSaveFile(d) {
  const g = GAMES[d.game], ex = STOPS.find(s => s.game === d.game);
  if (d.v !== FILE_VERSION || !g || !ex || !(SAVE_OK.has(g.id) || HOTSEAT.has(g.id)) || !d.state || typeof d.state !== 'object') return 'That saved game cannot be carried on here.';
  if (d.hotseat && !HOTSEAT.has(g.id)) return 'That saved game cannot be carried on here.';
  if (g.variants && d.variant != null && !g.variants.some(v => v.id === d.variant)) return 'That saved game is of a size or rules these Archives no longer have.';
  if (g.variants && d.variant != null) store.variants = Object.assign(store.variants || {}, { [g.id]: d.variant });
  if (g.toggles && d.toggles) store.toggles = Object.assign(store.toggles || {}, { [g.id]: Object.fromEntries(g.toggles.map(t => [t.id, !!d.toggles[t.id]])) });
  if (HOTSEAT.has(g.id)) store.opponent = Object.assign(store.opponent || {}, { [g.id]: d.hotseat ? 'friend' : 'scribe' });
  store.saves = store.saves || {};
  store.saves[g.id] = { v: SAVE_VERSION, variant: d.variant || null, state: d.state, hotseat: !!d.hotseat, turn: d.turn | 0, file: true };
  save();
  closeOnlinePanel();
  if (mode === 'play') { play.online = null; net.switching = true; leaveGame(); net.switching = false; } // a desk room stays open
  stopTour(); goStop(STOPS.indexOf(ex), false); showPlacard(false);
  startGame(ex);
  return '';
}
function clearSave(id) { if (store.saves && store.saves[id]) { delete store.saves[id]; save(); } }
