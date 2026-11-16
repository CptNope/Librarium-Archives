/* ---------------------------------------------------- hints and undo
 * Hint asks the Sharp Scribe what it would play in your seat and lights that
 * move. Undo takes the table back to the start of your previous turn. Both copy
 * the engine's data fields first, so nothing the Scribe tries can leak out. */
// Only tables whose pieces are rebuilt entirely from the engine's state can be taken back.
const UNDO_OK = new Set(['chess', 'xiangqi', 'janggi', 'makruk', 'shatranj', 'chaturanga', 'lewischess', 'courier', 'rithmo', 'draughts', 'tablut', 'halma', 'reversi', 'jungle', 'mutorere', 'oware', 'kalah', 'idraughts', 'hnefatafl', 'go', 'morris', 'morabaraba', 'brandubh', 'foxgeese', 'dotsboxes', 'alquerque', 'konane', 'fanorona', 'shogi', 'bao', 'chinese', 'hex', 'gomoku', 'seega', 'baghchal', 'latrunculi']);
// At dice tables the Hint weighs the moves this throw allows; where the moves are fixed (the Goose, Snakes and
// Ladders, the Mansion, Hazard's bets) there is nothing to weigh.
const DICE_HINT = new Set(['ur', 'senet', 'tables', 'nard', 'xii', 'yut', 'pachisi', 'ludo', 'patolli', 'tab', 'hounds', 'lifegame']);
const canHint = g => !!g.aiPlan && (g.dice ? DICE_HINT.has(g.id) : !['mahjong', 'landlord', 'cribbage', 'tarocchi', 'dominoes', 'piquet', 'fourseasons', 'chaturaji'].includes(g.id));
function copyState(g) {
  const out = {}, d = Object.getOwnPropertyDescriptors(g);
  for (const k of Object.keys(d)) if ('value' in d[k] && typeof d[k].value !== 'function' && k !== 'rules' && k !== 'source' && k !== 'surface') out[k] = d[k].value;
  return structuredClone(out);
}
function refreshAids() {
  const g = play.game; if (!g) return;
  const mine = play.phase === 'choose' && (play.cur === 0 || play.hotseat);
  $('#lm-hintBtn').disabled = !mine;
  $('#lm-undoBtn').disabled = !(mine && !play.hotseat && play.undo && play.undo.length > 1);
}
function rememberTurn() {
  if (!UNDO_OK.has(play.game.id) || play.hotseat) return;
  try {
    play.undo.push(copyState(play.game)); play.undoH.push(play.history ? play.history.length : 0); // and where the move list stood
    if (play.undo.length > 60) { play.undo.shift(); play.undoH.shift(); }
  } catch (e) { /* a state that cannot be copied: no undo for it */ }
  refreshAids();
}
$('#lm-undoBtn').addEventListener('click', () => {
  if (play.phase !== 'choose' || play.cur !== 0 || play.undo.length < 2) return;
  const g = play.game, P = play.P;
  play.undo.pop(); const back = play.undo.pop();
  play.undoH.pop(); const h = play.undoH.pop(); if (play.history && h !== undefined) { play.history.length = h; renderMoves(); }
  play.token++; clearHighlights(); clearLastMove(); $('#lm-choices').hidden = true;
  settleTweens();
  Object.assign(g, structuredClone(back));
  P.setup(play.ex);
  updateScore();
  beginTurn(0);
  setMsg('Your turn', 'Taken back: the board is as it was at the start of your last turn. ' + P.prompt());
});
$('#lm-hintBtn').addEventListener('click', async () => {
  if (play.phase !== 'choose') return;
  const g = play.game, tok = play.token, pl = play.hotseat ? play.cur : 0, level = R.level();
  const moves = play.moves, before = copyState(g);
  setMsg(turnName(), 'The Scribe looks over your position…');
  $('#lm-hintBtn').disabled = true;
  await new Promise(r => setTimeout(r, 60));
  let plan = null;
  try {
    if (g.dice) { R.setLevel('sharp'); plan = g.aiPlan(pl, moves); } // the best use of this throw: quick, so on the page
    else plan = await scribe.plan(g, pl, 'sharp');
  } catch (e) { plan = null; } finally { R.setLevel(level); Object.assign(g, structuredClone(before)); }
  if (tok !== play.token || play.phase !== 'choose') return;
  const want = plan && plan[0], keys = ['kind', 'from', 'to', 'c', 'card', 'place', 'pit', 'i', 'n', 'line', 'over', 'swap', 'pass', 'label', 'drop', 'promo'];
  const same = (a, b) => keys.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));
  const whole = x => JSON.stringify(x, Object.keys(x).sort()); // the plan comes back from the worker as a copy: match it field by field
  const m = want && (moves.find(x => x === want) || moves.find(x => whole(x) === whole(want)) || moves.find(x => same(x, Object.assign({}, x, want)) && same(want, x)) || moves.find(x => same(x, want)));
  refreshAids();
  if (!m) { setMsg(turnName(), 'The Scribe has no clear advice here. ' + play.P.prompt()); return; }
  play.hintCount++;
  const mesh = (play.P.meshesFor(m) || []).find(Boolean);
  if (mesh && play.twoStep) { if (play.selected !== mesh) { if (play.selected) select(play.selected); select(mesh); } }
  play.hintMove = m; play.hover = play.rings.find(r => r.userData.move === m) || mesh || null;
  const why = explainHint(g, pl, m);
  setMsg(turnName(), (m.label ? `The Scribe would choose “${m.label}”. ` : `The Scribe would play the move now lit up${moveText(g, m) ? ` (${moveText(g, m)})` : ''}. `) + why + ' Play it, or choose your own.');
});

