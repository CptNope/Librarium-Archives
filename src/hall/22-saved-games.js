/* ---------------------------------------------------- saved games
 * A long game against the Scribe is kept in this browser at the start of each of
 * your turns (between tricks, at card tables), and comes back when you sit down
 * again. Only the engine's own state is kept; the table is rebuilt from it. */
const SAVE_OK = new Set(['chess', 'xiangqi', 'janggi', 'makruk', 'shatranj', 'chaturanga', 'lewischess', 'courier', 'rithmo', 'whist', 'piquet', 'draughts', 'tablut', 'halma', 'reversi', 'idraughts', 'hnefatafl', 'jungle', 'mutorere', 'oware', 'kalah', 'go', 'morris', 'morabaraba', 'brandubh', 'foxgeese', 'dotsboxes', 'alquerque', 'konane', 'fanorona', 'shogi', 'bao', 'chinese', 'hex', 'gomoku', 'seega', 'baghchal', 'latrunculi', 'mahjong']);
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
  if (!s || s.v !== SAVE_VERSION || play.hotseat || !SAVE_OK.has(g.id)) return false;
  if ((s.variant || null) !== (g.variant || null)) return false;
  try { Object.assign(g, R.unpackState(JSON.parse(JSON.stringify(s.state)))); return true; } catch (e) { clearSave(g.id); g.init(); return false; }
}
function clearSave(id) { if (store.saves && store.saves[id]) { delete store.saves[id]; save(); } }
