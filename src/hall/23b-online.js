/* ------------------------------------------------------------- online play
 * Two people on two devices, at any table that seats two at one screen. The game itself is kept on the
 * Archives' server (server/, a Cloudflare Worker): the server throws the dice, checks every move against the
 * rules, and sends each device the game as that player may see it. This page only shows the table: it plays
 * each move the server reports on its own copy of the game, so the pieces move as they do against the Scribe,
 * and takes the server's state afterwards, so the two copies can never drift apart. See docs/online.md.
 *
 * The server's address is data-online on #lm-app (the WordPress plugin fills it from its settings), or the
 * website's <meta name="librarium-online">. With no
 * address, nothing here shows. A friend joins with the room's six-letter code, or with a link that carries it
 * (?join=CODE). Each seat has a token, kept in this browser, so a dropped connection or a reload comes back to
 * the same seat. */
// The tables the server will play: the same list as server/referee.mjs (a test keeps the two in step).
const ONLINE_GAMES = new Set(['go', 'morris', 'oware', 'brandubh', 'shatranj', 'draughts', 'reversi', 'dotsboxes', 'halma', 'alquerque', 'xiangqi', 'mutorere', 'konane', 'fanorona', 'chess', 'shogi', 'bao', 'hex', 'gomoku', 'tablut', 'makruk', 'kalah', 'morabaraba', 'janggi', 'chaturanga', 'seega', 'baghchal', 'latrunculi', 'rithmo', 'jungle', 'lewischess', 'courier', 'idraughts', 'hnefatafl',
  'ur', 'senet', 'tables', 'goose', 'snakes', 'yut', 'pachisi', 'ludo', 'tab', 'hounds', 'patolli', 'mansion', 'lifegame', 'nard', 'xii', 'hazard',
  'gin', 'ecarte']);
// The seat at this screen: 0 against the Scribe, or online the seat this player took. A card table shows this
// seat's hand face up, and the other face down (online, as card backs: the page is never sent those cards).
const ME = () => (play.online ? play.online.seat : 0);
const onlineServer = () => { // data-online on #lm-app (WordPress), or the site's <meta name="librarium-online">
  const meta = document.querySelector('meta[name="librarium-online"]');
  const s = (root.dataset.online || (meta && meta.content) || '').trim().replace(/\/+$/, ''); return /^https?:\/\/[^\s"'<>]+$/.test(s) ? s : ''; };
const onlineOk = g => !!onlineServer() && ONLINE_GAMES.has(g.id) && typeof WebSocket !== 'undefined';
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

/* Messages, from the second seat's side. The rules write their notes for the first seat ("You capture…",
 * "The Scribe throws…"); for the player in the second seat each note is turned round: "You" becomes "Your
 * friend", "The Scribe" becomes "You", and the verb after each follows. */
const VERB_TO_3RD = { have: 'has', are: 'is', were: 'was', do: 'does', go: 'goes' };
const VERB_TO_2ND = { has: 'have', is: 'are', was: 'were', does: 'do', goes: 'go' };
// Words after a subject that are not its verb: left as they are.
const NOT_VERB = new Set(['now', 'also', 'still', 'just', 'already', 'then', 'only', 'never', 'both', 'all', 'each', 'again', 'first', 'too', 'instead', 'so',
  'to', 'at', 'in', 'on', 'and', 'or', 'the', 'a', 'an', 'with', 'from', 'by', 'for', 'of', 'if', 'as', 'but', 'it', 'this', 'that', 'when', 'while', 'after', 'before', 'into', 'out', 'off', 'up', 'down', 'back', 'here', 'there', 'can', 'cannot', 'may', 'must', 'will', 'would', 'could', 'should', 'might', 'win', 'lose']);
function third(w) { // take → takes, pass → passes, carry → carries; threw, moved and the like stay
  const lw = w.toLowerCase();
  if (VERB_TO_3RD[lw]) return VERB_TO_3RD[lw];
  if (lw === 'win' || lw === 'lose') return w + 's';
  if (NOT_VERB.has(lw) || /(ed|ew|ok|ost|ought|aught|ung|ank|ame|ore)$/.test(lw) || ['won', 'got', 'had', 'did', 'sent', 'went', 'lost', 'kept', 'left', 'made', 'paid', 'put', 'let', 'set', 'hit', 'cut', 'bore', 'drew'].includes(lw)) return w;
  if (/s$/.test(lw) && !/ss$/.test(lw)) return w;
  if (/(s|sh|ch|x|z|o)$/.test(lw)) return w + 'es';
  if (/[^aeiou]y$/.test(lw)) return w.slice(0, -1) + 'ies';
  return w + 's';
}
function second(w) { // takes → take, passes → pass, carries → carry
  const lw = w.toLowerCase();
  if (VERB_TO_2ND[lw]) return VERB_TO_2ND[lw];
  if (NOT_VERB.has(lw)) return w;
  if (/ies$/.test(lw)) return w.slice(0, -3) + 'y';
  if (/(sses|shes|ches|xes|zes|oes)$/.test(lw)) return w.slice(0, -2);
  if (/[^su]s$/.test(lw)) return w.slice(0, -1);
  return w;
}
const ADV = '((?: (?:now|also|still|just|already|then|only|never|both|all|each|again|first|too|instead))*)';
function asGuest(t) {
  if (!t) return t;
  const A = '\u0001', B = '\u0002';
  let s = String(t)
    .replace(/\bThe Scribe's\b/g, A + 'P').replace(/\bthe Scribe's\b/g, A + 'p')
    .replace(new RegExp('\\b([Tt])he Scribe\\b' + ADV + '(?: ([a-z]+))?', 'g'), (all, T, adv, w) => A + (T === 'T' ? 'S' : 's') + adv + (w ? ' ' + (T === 'T' ? second(w) : w) : ''))
    .replace(/\bScribe\b/g, A + 'N');
  s = s.replace(/\bYours\b/g, B + 'R').replace(/\byours\b/g, B + 'r').replace(/\bYour\b/g, B + 'P').replace(/\byour\b/g, B + 'p')
    .replace(new RegExp('\\b([Yy])ou\\b' + ADV + '(?: ([a-z]+))?', 'g'), (all, Y, adv, w) => B + (Y === 'Y' ? 'S' : 's') + adv + (w ? ' ' + third(w) : ''));
  const swap = { [A + 'P']: 'Your', [A + 'p']: 'your', [A + 'S']: 'You', [A + 's']: 'you', [A + 'N']: 'You',
    [B + 'R']: 'Your friend\'s', [B + 'r']: 'your friend\'s', [B + 'P']: 'Your friend\'s', [B + 'p']: 'your friend\'s', [B + 'S']: 'Your friend', [B + 's']: 'your friend' };
  return s.replace(/[\u0001\u0002][PpSsNRr]/g, k => swap[k] || k);
}
// Any rules text, as the player at this screen should read it.
const forSeat = t => (play.online && play.online.seat === 1 && mode === 'play' && t ? asGuest(t) : asFriend(t));
const seatLabel = pl => (play.online ? (pl === play.online.seat ? 'You' : 'Friend') : pl === 0 ? 'You' : asFriend('Scribe'));

/* The connection. One room at a time; events from the server are handled in order, each waiting for the last
 * to finish moving its pieces. */
const net = { ws: null, code: null, token: null, seat: 0, game: null, settings: null, queue: Promise.resolve(), friend: false, retries: 0, closing: false, ping: 0, pendingGame: null, lastRoll: '', lastNote: '' };
function netSend(msg) { if (net.ws && net.ws.readyState === 1) { net.ws.send(JSON.stringify(msg)); return true; } onlineStatus('Not connected. Trying again…'); return false; }
function rememberRoom(code, d) {
  store.rooms = store.rooms || {};
  store.rooms[code] = Object.assign({ t: Date.now() }, store.rooms[code] || {}, d);
  const keys = Object.keys(store.rooms).sort((a, b) => store.rooms[b].t - store.rooms[a].t);
  for (const k of keys.slice(8)) delete store.rooms[k];
  save();
}
function wsUrl(code, token) { return onlineServer().replace(/^http/, 'ws') + '/rooms/' + code + (token ? '?token=' + encodeURIComponent(token) : ''); }
function netConnect(code, token) {
  netClose(true); net.closing = false;
  net.code = code; net.token = token || ((store.rooms || {})[code] || {}).token || null;
  let ws;
  try { ws = new WebSocket(wsUrl(code, net.token)); } catch (e) { onlineError('Could not reach the game server.'); return; }
  net.ws = ws;
  ws.addEventListener('open', () => { net.retries = 0; clearInterval(net.ping); net.ping = setInterval(() => { try { ws.send('ping'); } catch (e) { /* closed */ } }, 25000); });
  ws.addEventListener('message', e => {
    if (e.data === 'pong') return;
    let msg; try { msg = JSON.parse(e.data); } catch (err) { return; }
    net.queue = net.queue.then(() => onlineMessage(msg)).catch(() => {});
  });
  ws.addEventListener('close', ev => {
    clearInterval(net.ping);
    if (net.ws !== ws || net.closing || [4404, 4409, 4000].includes(ev.code)) return;
    // Lost: try again, a little later each time, while the player is still at the table or waiting.
    if (net.retries > 12) { onlineStatus('The connection to the game server is lost. Leave the table and join the room again with its code.'); return; }
    const delay = Math.min(30000, 1000 * 2 ** net.retries++);
    onlineStatus(play.online ? 'Connection lost. Reconnecting…' : 'Reconnecting…');
    setTimeout(() => { if (net.ws === ws && !net.closing) netConnect(net.code, net.token); }, delay);
  });
}
function netClose(quiet) {
  net.closing = true; clearInterval(net.ping);
  if (net.ws) { try { if (!quiet) net.ws.send(JSON.stringify({ t: 'leave' })); } catch (e) { /* closed */ } try { net.ws.close(1000); } catch (e) { /* closed */ } }
  net.ws = null;
}

/* The online panel: open a room, or join one with a code. */
const onlinePanel = $('#lm-online');
function onlineView(which) {
  $('#lm-onStart').hidden = which !== 'start'; $('#lm-onWait').hidden = which !== 'wait';
  $('#lm-onErr').hidden = true;
}
function onlineError(text) { const e = $('#lm-onErr'); e.textContent = text; e.hidden = false; onlinePanel.hidden = false; }
function onlineStatus(text) {
  $('#lm-onStatus').textContent = text;
  if (play.online && mode === 'play') setMsg(play.cur === play.online.seat ? 'Your turn' : 'Online', text, true);
}
function openOnline(g) {
  net.pendingGame = g ? g.id : null;
  onlineView('start'); onlinePanel.hidden = false;
  $('#lm-onIntro').textContent = g ? `Play ${g.name} with a friend on another phone or computer. One of you opens a room; the other joins it with its code.` : 'Join a friend\'s room with the code they sent you.';
  $('#lm-onOpen').hidden = !g;
  $('#lm-onCode').value = '';
  ($('#lm-onOpen').hidden ? $('#lm-onCode') : $('#lm-onOpen')).focus({ preventScroll: true });
}
function closeOnlinePanel() { onlinePanel.hidden = true; }
async function onlineOpenRoom() {
  const g = GAMES[net.pendingGame]; if (!g) return;
  const btn = $('#lm-onOpen'); btn.disabled = true;
  const toggles = {}; for (const t of g.toggles || []) toggles[t.id] = toggleOn(g, t);
  try {
    const r = await fetch(onlineServer() + '/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: g.id, variant: g.variant ?? null, toggles }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || (r.status === 429 || r.status >= 500 ? 'The game server is busy. Try again in a little while.' : 'Could not open a room.'));
    rememberRoom(d.code, { token: d.token, seat: 0, game: g.id });
    onlineView('wait');
    $('#lm-onCodeShow').textContent = d.code;
    $('#lm-onStatus').textContent = 'Waiting for your friend to join…';
    netConnect(d.code, d.token);
  } catch (e) { onlineError(e && e.message && !/fetch|network/i.test(e.message) ? e.message : 'Could not reach the game server. Check your connection and try again.'); }
  finally { btn.disabled = false; }
}
function onlineJoin(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!CODE_RE.test(code)) { onlineError('A room code is six letters and numbers, like K7MXQ2.'); return; }
  onlineView('wait'); $('#lm-onCodeShow').textContent = code; onlinePanel.hidden = false;
  $('#lm-onStatus').textContent = 'Joining…';
  netConnect(code);
}
function joinLink(code) { const u = new URL(location.href); u.hash = ''; u.searchParams.set('join', code); return u.href; }

async function onlineMessage(msg) {
  switch (msg.t) {
    case 'welcome':
      net.seat = msg.seat; net.token = msg.token; net.game = msg.game; net.settings = msg.settings; net.friend = msg.opponent;
      rememberRoom(msg.code, { token: msg.token, seat: msg.seat, game: msg.game });
      if (!play.online) $('#lm-onStatus').textContent = msg.seat === 0 && !msg.opponent ? 'Waiting for your friend to join…' : 'Joining…';
      return;
    case 'snapshot': return onlineSnapshot(msg);
    case 'events': for (const e of msg.events) await onlineEvent(e); return;
    case 'presence':
      net.friend = msg.online;
      if (play.online && mode === 'play') { renderVariants(play.game); if (play.phase !== 'over') setMsg('Online', msg.online ? 'Your friend is back.' : 'Your friend\'s connection dropped. The game waits for them.', true); }
      return;
    case 'left':
      net.friend = false;
      if (play.online && mode === 'play') { renderVariants(play.game); setMsg('Online', 'Your friend has left the table. Leave when you are ready; the room stays open for a day if they come back.', true); }
      return;
    case 'error': if (play.online && mode === 'play') setMsg('Online', msg.msg + '.', true); return;
    case 'full': netClose(true); onlineView('start'); onlineError('That room already has two players.'); return;
    case 'gone': netClose(true); onlineView('start'); onlineError('There is no room with that code. It may have closed: a room is cleared a day after it was last used.'); return;
    case 'replaced': net.closing = true; onlineStatus('This room was opened in another tab or window, so this one has stepped away.'); return;
    default: return;
  }
}

// The server's game, as a fresh start (the first game, or Play again) or to catch up after a lost connection.
async function onlineSnapshot(msg) {
  const snap = msg.snap, ex = STOPS.find(s => s.game === snap.id);
  if (!ex) return;
  const seatedHere = play.online && mode === 'play' && play.ex === ex && play.online.code === net.code;
  if (seatedHere && !msg.fresh) { // catch up
    play.online.snap = snap;
    const g = play.game;
    Object.assign(g, R.unpackState(snap.state)); play.P.setup(play.ex); updateScore();
    onlineTurnFrom(snap);
    return;
  }
  closeOnlinePanel();
  play.online = { seat: net.seat, code: net.code, game: snap.id, settings: snap.settings, snap };
  if (mode === 'play') {
    // Wait for the table to be laid out before the next message: the friend may move first (the elder at
    // Écarté), and that move must find the table ready, not be overtaken by the opening turn.
    if (play.ex === ex) { await restartTable(); return; }
    net.switching = true; leaveGame(); net.switching = false;
  }
  stopTour(); goStop(STOPS.indexOf(ex), false); showPlacard(false);
  await startGame(ex);
}
// Called by startGame once the table is laid out from the server's state.
function onlineSeated() {
  const snap = play.online.snap;
  updateScore();
  if (snap.phase === 'over' && snap.result) { finish(snap.result); return; }
  onlineTurnFrom(snap, true);
}
function onlineTurnFrom(snap, first) {
  if (snap.phase === 'over') return;
  onlineTurn({ seat: snap.cur, phase: snap.phase, moves: snap.moves, canPass: snap.canPass, note: '', first });
}
function seatWho(seat) { return seat === play.online.seat ? 'You' : 'Your friend'; }
function onlineTurn(e) {
  const g = play.game, P = play.P, me = play.online.seat;
  play.cur = e.seat; updateScore();
  const note = (net.lastNote ? net.lastNote + ' ' : '') + (e.note ? forSeat(e.note) + ' ' : ''); net.lastNote = '';
  const hello = e.first ? (me === 0 ? 'Your friend has joined. ' : 'You have joined your friend\'s table, in the far seat. ') : '';
  if (e.seat !== me) {
    play.phase = 'remote'; play.moves = []; clearHighlights();
    $('#lm-choices').hidden = true; $('#lm-throwBtn').disabled = true; $('#lm-passBtn').disabled = true;
    setMsg('Your friend\'s turn', hello + note + (e.phase === 'throw' ? 'Your friend is about to throw.' : 'Waiting for your friend to move…'), true);
    return;
  }
  if (e.phase === 'throw') {
    play.phase = 'throw'; $('#lm-throwBtn').disabled = false;
    setMsg('Your turn', hello + note + asFriend(e.prompt || P.prompt()), true);
    $('#lm-throwBtn').focus({ preventScroll: true });
    return;
  }
  const moves = e.moves || [];
  let say;
  if (net.lastRoll && g.dice) { say = net.lastRoll + ' ' + (P.choosePrompt ? P.choosePrompt(moves) : `Choose a glowing piece${moves.length === 1 ? ' (only one can move)' : ''}.`); net.lastRoll = ''; }
  else say = asFriend(e.prompt || P.prompt()); // written for this player's seat (P.prompt reads ME())
  offer(moves, hello + note + say, true);
  if (e.canPass) $('#lm-passBtn').disabled = false;
}
async function onlineEvent(e) {
  if (!play.online || mode !== 'play') return;
  const g = play.game, P = play.P, me = play.online.seat, tok = play.token;
  if (e.type === 'turn') return onlineTurn(e);
  if (e.type === 'roll') {
    play.phase = 'rolling'; $('#lm-throwBtn').disabled = true; clearHighlights();
    if (!(await showRoll(e.roll))) return;
    play.roll = e.roll;
    const text = `${seatWho(e.seat)} threw ${rollText(g, e.roll)}.`;
    if (e.seat === me) net.lastRoll = text; else setMsg('Your friend\'s turn', text, true);
    return;
  }
  if (e.type === 'nomove') {
    net.lastRoll = '';
    setMsg(e.seat === me ? 'Your turn' : 'Your friend\'s turn', `${seatWho(e.seat)} threw ${rollText(g, e.roll)}, and no piece can move. The turn passes.`, true);
    await wait(1500); return;
  }
  if (e.type === 'skip') { setMsg(e.seat === me ? 'Your turn' : 'Your friend\'s turn', forSeat(e.note), true); await wait(1600); return; }
  if (e.type === 'over') { finish(e.result); return; }
  if (e.type !== 'move') return;
  // A move: play it on this page's copy of the game, from the server's state just before it, then take the
  // server's state after it (they agree; if ever they do not, the table is laid out again from the server's).
  play.phase = 'anim'; clearHighlights(); $('#lm-choices').hidden = true; $('#lm-passBtn').disabled = true; $('#lm-throwBtn').disabled = true;
  // At a card table the "before" can show a card that was a back here until now (one played from the other hand):
  // lay the table out from it first, so the move starts from the right card.
  if (sameAsServer(g, e.before)) Object.assign(g, R.unpackState(e.before));
  else { Object.assign(g, R.unpackState(e.before)); P.setup(play.ex); }
  const remote = e.seat !== me, text = moveText(g, e.move);
  const from = remote && P.fromFor ? P.fromFor(e.move) : null, to = remote && P.ringFor ? P.ringFor(e.move) : null;
  clearLastMove();
  let res = {};
  try { res = (await P.play(Object.assign({}, e.move))) || {}; } catch (err) { res = {}; }
  if (tok !== play.token) return;
  if (remote) markLastMove(from, to);
  recordMove(e.seat, e.move, text, res);
  sfx.move(g, e.move, res);
  if (!sameAsServer(g, e.state)) { Object.assign(g, R.unpackState(e.state)); P.setup(play.ex); }
  updateScore();
  if (e.note && remote) { setMsg('Your friend\'s turn', forSeat(e.note), true); await wait(readTime(e.note)); }
  else if (e.note) { net.lastNote = forSeat(e.note); setMsg('Your turn', net.lastNote, true); }
}
// Does this page's game match the server's? Only the fields the server keeps: the page's engine also holds
// the rules' own definitions, which the server's copy inherits instead.
function sameAsServer(g, state) {
  const mine = engineState(g);
  return Object.keys(state).every(k => JSON.stringify(mine[k]) === JSON.stringify(state[k]));
}
// Leaving the table, or choosing the Scribe or a friend at this screen, gives up the seat.
function onlineLeave() {
  if (!play.online && !net.ws) return;
  netClose(false); play.online = null; net.code = null;
}
// The player's own turn goes to the server instead of the table.
function onlineChoose(m) {
  const i = play.moves.indexOf(m);
  play.phase = 'sent'; clearHighlights(); $('#lm-choices').hidden = true; $('#lm-passBtn').disabled = true;
  if (!netSend(i >= 0 ? { t: 'choose', i } : { t: 'pass' })) { play.phase = 'choose'; highlight(play.moves); }
}
function onlineThrow() {
  play.phase = 'sent'; $('#lm-throwBtn').disabled = true;
  if (!netSend({ t: 'throw' })) { play.phase = 'throw'; $('#lm-throwBtn').disabled = false; }
}
function onlineAgain() { $('#lm-win').hidden = true; setMsg('Online', 'Starting a new game…', true); netSend({ t: 'again' }); }

$('#lm-onOpen').addEventListener('click', onlineOpenRoom);
$('#lm-onJoinForm').addEventListener('submit', e => { e.preventDefault(); onlineJoin($('#lm-onCode').value); });
$('#lm-onCancel').addEventListener('click', () => { if (!play.online) { netClose(false); net.code = null; } closeOnlinePanel(); });
$('#lm-onCopy').addEventListener('click', () => {
  const link = joinLink($('#lm-onCodeShow').textContent), b = $('#lm-onCopy');
  const done = ok => { b.textContent = ok ? 'Link copied' : 'Copy failed: ' + link; setTimeout(() => { b.textContent = 'Copy the link'; }, 2500); };
  try { navigator.clipboard.writeText(link).then(() => done(true), () => done(false)); } catch (e) { done(false); }
});
onlinePanel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); $('#lm-onCancel').click(); } e.stopPropagation(); });
// Arriving with ?join=CODE: join that room once the hall is lit.
function onlineFromLink() {
  const code = (new URLSearchParams(location.search).get('join') || '').toUpperCase();
  if (!code || !onlineServer() || !CODE_RE.test(code)) return;
  openOnline(null); onlineJoin(code);
}
