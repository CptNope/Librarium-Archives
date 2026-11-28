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
  'gin', 'ecarte', 'scopa']);
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
const net = { ws: null, code: null, token: null, seat: 0, game: null, settings: null, queue: Promise.resolve(), friend: false, retries: 0, closing: false, ping: 0, pendingGame: null, lastRoll: '', lastNote: '',
  lobby: false, friendJoined: false, playing: false, proposal: null, wantTable: false, pendingSave: null, lastCode: null }; // lobby: a desk room, where the players choose games together
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

/* The Games Desk panel (23b): open a room or join one; in a room, the friend, the game on, the suggestion on
 * the table and a game to suggest; and saved games to carry on. Opened from the desk at the entrance, the
 * people button at the top, and a table's Online button (which opens a room for that table alone). */
const onlinePanel = $('#lm-online'), deskBtn = $('#lm-deskBtn');
function onlineView(which) {
  $('#lm-onStart').hidden = which !== 'start'; $('#lm-onWait').hidden = which !== 'wait';
  $('#lm-onErr').hidden = true;
}
function onlineError(text) { if (onlinePanel.hidden) showDesk(true); const e = $('#lm-onErr'); e.textContent = text; e.hidden = false; }
function onlineStatus(text) {
  $('#lm-onStatus').textContent = text;
  if (play.online && mode === 'play') setMsg(play.cur === play.online.seat ? 'Your turn' : 'Online', text, true);
}
function showDesk(on) {
  onlinePanel.hidden = !on;
  if (deskBtn) deskBtn.setAttribute('aria-expanded', String(on));
  if (on) renderDesk();
}
// From a table (g): a room for that table. From the desk or the top button: a room where you choose together.
function openOnline(g) {
  net.pendingGame = g ? g.id : null;
  if (!net.code) { onlineView('start'); $('#lm-onCode').value = ''; }
  showDesk(true);
  const first = !net.code ? ($('#lm-onOpen').hidden ? $('#lm-onCode') : $('#lm-onOpen')) : ($('#lm-onAccept').offsetParent ? $('#lm-onAccept') : $('#lm-onCancel'));
  first.focus({ preventScroll: true });
}
const openDesk = () => openOnline(null);
function closeOnlinePanel() { showDesk(false); }
const gameName = id => (GAMES[id] ? GAMES[id].name : id);
function variantName(id, settings) {
  const g = GAMES[id], v = g && g.variants && settings && settings.variant != null ? g.variants.find(x => x.id === settings.variant) : null;
  return v ? `${gameName(id)} (${v.label})` : gameName(id);
}
const lastRoom = () => { // a room this browser was in within the day, to go back to after a reload
  const rooms = store.rooms || {}, code = Object.keys(rooms).sort((a, b) => rooms[b].t - rooms[a].t)[0];
  return code && rooms[code].token && Date.now() - rooms[code].t < 20 * 3600 * 1000 ? code : null;
};
// The suggestion list: every table that plays online, by wing, in the hall's order.
function fillPick() {
  const pick = $('#lm-onPick'); if (pick.options.length) return;
  for (let w = 1; w <= 6; w++) {
    const grp = document.createElement('optgroup'); grp.label = `Wing ${ROMAN_WINGS[w]}: ${MUSIC_WINGS[w - 1]}`;
    for (const s of STOPS) if (s.wing === w && s.game && ONLINE_GAMES.has(s.game) && !grp.querySelector(`[value="${s.game}"]`)) {
      const o = document.createElement('option'); o.value = s.game; o.textContent = GAMES[s.game].name; grp.appendChild(o);
    }
    if (grp.children.length) pick.appendChild(grp);
  }
  pick.value = 'chess';
  fillVariant();
}
function fillVariant() {
  const g = GAMES[$('#lm-onPick').value], sel = $('#lm-onVariant'); sel.innerHTML = '';
  sel.hidden = !g || !g.variants;
  if (!g || !g.variants) return;
  const mine = (store.variants || {})[g.id] || g.variant;
  for (const v of g.variants) { const o = document.createElement('option'); o.value = v.id; o.textContent = v.label; sel.appendChild(o); }
  sel.value = mine; sel.setAttribute('aria-label', g.variantLabel || 'Size');
}
function renderDesk() {
  const inRoom = !!net.code, server = !!onlineServer() && typeof WebSocket !== 'undefined', g = GAMES[net.pendingGame];
  if ($('#lm-onWait').hidden === inRoom) onlineView(inRoom ? 'wait' : 'start'); // a change of view clears the last error
  $('#lm-onStart').hidden = inRoom || !server;
  $('#lm-onIntro').textContent = !server ? 'Online play is not switched on for this copy of the Archives. Saved games still carry on here.'
    : inRoom ? (net.lobby ? 'Suggest a game, or answer your friend\'s suggestion. You can save a game at any time and carry it on later.' : `This room is for ${gameName(net.game)}. The game begins when your friend joins.`)
    : g ? `Play ${g.name} with a friend on another phone or computer. Open a room for it, or join your friend's.` : 'Play any two-player table with a friend on another phone or computer.';
  $('#lm-onOpen').textContent = g ? `Open a room for ${g.name}` : 'Open a room';
  const back = lastRoom();
  let rejoin = $('#lm-onRejoin');
  if (!inRoom && server && back) {
    if (!rejoin) { rejoin = document.createElement('button'); rejoin.className = 'btn'; rejoin.id = 'lm-onRejoin'; rejoin.type = 'button'; $('#lm-onOpen').after(rejoin); rejoin.addEventListener('click', () => onlineJoin(rejoin.dataset.code)); }
    rejoin.dataset.code = back; rejoin.textContent = `Back to room ${back}`; rejoin.hidden = false;
  } else if (rejoin) rejoin.hidden = true;
  if (deskBtn) deskBtn.classList.toggle('asking', !!(net.proposal && net.proposal.by !== net.seat));
  if (!inRoom) return;
  $('#lm-onCodeShow').textContent = net.code;
  // The game on in this room, when this page is not at its table.
  const away = net.playing && !(play.online && mode === 'play');
  $('#lm-onGame').hidden = !away;
  if (away) { const t = $('#lm-onGameText'); t.innerHTML = ''; t.append('Your game of '); const b = document.createElement('b'); b.textContent = variantName(net.game, net.settings); t.append(b, ' is still on.'); }
  // The suggestion: yours (waiting for your friend), or theirs (to answer).
  const p = net.proposal, box = $('#lm-onProposal');
  box.hidden = !p; box.classList.toggle('theirs', !!p && p.by !== net.seat);
  if (p) {
    const mine = p.by === net.seat, t = $('#lm-onPropText'), b = document.createElement('b');
    b.textContent = variantName(p.game, p.settings); t.innerHTML = '';
    if (p.resume) {
      const when = p.resume.saved ? new Date(p.resume.saved) : null, day = when && !isNaN(when) ? when.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'earlier';
      t.append(mine ? 'You asked to carry on your game of ' : 'Your friend wants to carry on your game of ', b, `, saved ${day}, after ${p.resume.turns} turns. Each of you sits in the seat you had.`);
    } else t.append(mine ? 'You suggested ' : 'Your friend suggests ', b, mine ? '. Waiting for your friend to answer…' : '. They move first if you accept.');
    if (net.playing && !mine) t.append(' Accepting ends the game that is on now.');
    $('#lm-onPropYes').hidden = mine; $('#lm-onPropMine').hidden = !mine;
  }
  $('#lm-onSuggest').hidden = !net.lobby || !!p;
  if (net.lobby) fillPick();
  $('#lm-onLeaveRoom').hidden = false;
}
async function onlineOpenRoom() {
  const g = GAMES[net.pendingGame];
  const btn = $('#lm-onOpen'); btn.disabled = true;
  const body = {};
  if (g) { const toggles = {}; for (const t of g.toggles || []) toggles[t.id] = toggleOn(g, t); Object.assign(body, { game: g.id, variant: g.variant ?? null, toggles }); }
  try {
    const r = await fetch(onlineServer() + '/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || (r.status === 429 || r.status >= 500 ? 'The game server is busy. Try again in a little while.' : 'Could not open a room.'));
    rememberRoom(d.code, { token: d.token, seat: 0, game: d.game });
    Object.assign(net, { lobby: !!d.lobby, game: d.game, proposal: null, playing: false, friend: false });
    netConnect(d.code, d.token);
    renderDesk();
    $('#lm-onStatus').textContent = 'Waiting for your friend to join…';
  } catch (e) { onlineError(e && e.message && !/fetch|network/i.test(e.message) ? e.message : 'Could not reach the game server. Check your connection and try again.'); }
  finally { btn.disabled = false; }
}
function onlineJoin(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!CODE_RE.test(code)) { onlineError('A room code is six letters and numbers, like K7MXQ2.'); return; }
  Object.assign(net, { proposal: null, playing: false });
  netConnect(code);
  showDesk(true);
  $('#lm-onStatus').textContent = 'Joining…';
}
function onlineLeaveRoom() {
  if (play.online && mode === 'play') { onlineLeave(); restartTable(); } else onlineLeave();
  Object.assign(net, { proposal: null, playing: false, lobby: false, game: null, pendingSave: null });
  if (store.rooms) { delete store.rooms[net.lastCode]; save(); }
  renderDesk();
}
function joinLink(code) { const u = new URL(location.href); u.hash = ''; u.searchParams.set('join', code); return u.href; }
function friendStatus() {
  if (!net.friendJoined) return net.seat === 0 ? 'Waiting for your friend to join…' : 'Joining…';
  return net.friend ? 'Your friend is here.' : 'Your friend is away just now. They can come back with the code or the link.';
}

async function onlineMessage(msg) {
  switch (msg.t) {
    case 'welcome':
      Object.assign(net, { seat: msg.seat, token: msg.token, game: msg.game, settings: msg.settings, friend: msg.opponent, lobby: !!msg.lobby, friendJoined: !!msg.friendJoined || msg.seat === 1, playing: !!msg.playing, proposal: msg.proposal || null, lastCode: msg.code });
      rememberRoom(msg.code, { token: msg.token, seat: msg.seat, game: msg.game });
      if (net.pendingSave && net.lobby) { netSend({ t: 'propose', save: net.pendingSave }); net.pendingSave = null; }
      $('#lm-onStatus').textContent = friendStatus();
      if (!onlinePanel.hidden) renderDesk();
      if (net.proposal && net.proposal.by !== net.seat && !(play.online && mode === 'play')) showDesk(true);
      return;
    case 'snapshot': return onlineSnapshot(msg);
    case 'events':
      for (const e of msg.events) { if (e.type === 'over') net.playing = false; await onlineEvent(e); }
      return;
    case 'presence':
      net.friend = msg.online; if (msg.online) net.friendJoined = true;
      $('#lm-onStatus').textContent = friendStatus();
      if (!onlinePanel.hidden) renderDesk();
      if (play.online && mode === 'play') { renderVariants(play.game); if (play.phase !== 'over') setMsg('Online', msg.online ? 'Your friend is back.' : 'Your friend\'s connection dropped. The game waits for them.', true); }
      return;
    case 'left':
      net.friend = false;
      $('#lm-onStatus').textContent = 'Your friend has left the room. It stays open for a day if they come back.';
      if (play.online && mode === 'play') { renderVariants(play.game); setMsg('Online', 'Your friend has left the table. Leave when you are ready; the room stays open for a day if they come back.', true); }
      return;
    case 'proposal': {
      const was = net.proposal; net.proposal = msg.proposal || null;
      const theirs = net.proposal && net.proposal.by !== net.seat;
      if (!onlinePanel.hidden || theirs) showDesk(true);
      else renderDesk();
      if (msg.declined !== undefined && msg.declined !== net.seat && was) toast(`Your friend declined ${variantName(was.game, was.settings)}.`);
      if (msg.withdrawn !== undefined && msg.withdrawn !== net.seat) toast('Your friend took back their suggestion.');
      if (theirs && play.online && mode === 'play') setMsg('Online', `Your friend suggests ${variantName(net.proposal.game, net.proposal.settings)}. Answer at the Games Desk.`, true);
      if (theirs) sfx.notify && sfx.notify();
      return;
    }
    case 'saved': downloadOnlineSave(msg); return;
    case 'error':
      if (play.online && mode === 'play' && onlinePanel.hidden) setMsg('Online', msg.msg + '.', true);
      else onlineError(msg.msg + '.');
      return;
    case 'full': netClose(true); net.code = null; renderDesk(); onlineError('That room already has two players.'); return;
    case 'gone': netClose(true); if (store.rooms) { delete store.rooms[net.code]; save(); } net.code = null; renderDesk(); onlineError('There is no room with that code. It may have closed: a room is cleared a day after it was last used.'); return;
    case 'replaced': net.closing = true; onlineStatus('This room was opened in another tab or window, so this one has stepped away.'); return;
    default: return;
  }
}

// The server's game: a fresh start (a game accepted, the first game of a table's room, Play again, a saved game
// carried on), or the game as it is (after a lost connection, or coming back to the table from the desk).
async function onlineSnapshot(msg) {
  const snap = msg.snap, ex = STOPS.find(s => s.game === snap.id);
  if (!ex) return;
  Object.assign(net, { game: snap.id, settings: snap.settings, playing: snap.phase !== 'over' });
  if (msg.fresh) net.proposal = null;
  const seatedHere = play.online && mode === 'play' && play.ex === ex && play.online.code === net.code;
  if (seatedHere && !msg.fresh) { // catch up
    play.online.snap = snap; play.online.seat = snap.you ?? net.seat;
    const g = play.game;
    Object.assign(g, R.unpackState(snap.state)); play.P.setup(play.ex); updateScore();
    onlineTurnFrom(snap);
    return;
  }
  // In a desk room, the game as it is waits at the desk until the player chooses to go back to the table.
  if (!msg.fresh && net.lobby && !net.wantTable) { if (!onlinePanel.hidden) renderDesk(); return; }
  net.wantTable = false;
  closeOnlinePanel();
  const hello = !msg.fresh ? '' : msg.resumed ? 'Your saved game is back on the table, as it was. ' : net.lobby ? ((snap.you ?? net.seat) === 0 ? 'Your game begins: you move first. ' : 'Your game begins: your friend moves first. ') : null;
  play.online = { seat: snap.you ?? net.seat, code: net.code, game: snap.id, settings: snap.settings, snap, hello };
  if (mode === 'play') {
    // Wait for the table to be laid out before the next message: the friend may move first (the elder at
    // Écarté), and that move must find the table ready, not be overtaken by the opening turn.
    if (play.ex === ex) { await restartTable(); return; }
    net.switching = true; leaveGame(); net.switching = false;
  }
  stopTour(); goStop(STOPS.indexOf(ex), false); showPlacard(false);
  await startGame(ex);
}
function backToTable() { net.wantTable = true; if (!netSend({ t: 'sync' })) net.wantTable = false; }
// Leaving the table of a desk room keeps the room: the game stays on, and the desk opens.
function onlineToDesk() { play.online = null; setTimeout(() => showDesk(true), 400); }
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
  const hello = !e.first ? '' : play.online.hello != null ? play.online.hello : me === 0 ? 'Your friend has joined. ' : 'You have joined your friend\'s table, in the far seat. ';
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
// Closing the desk keeps the room: walk the hall while your friend joins, and come back to it at the desk.
$('#lm-onCancel').addEventListener('click', closeOnlinePanel);
$('#lm-onLeaveRoom').addEventListener('click', onlineLeaveRoom);
$('#lm-onBack').addEventListener('click', backToTable);
$('#lm-onAccept').addEventListener('click', () => netSend({ t: 'answer', yes: true }));
$('#lm-onDecline').addEventListener('click', () => netSend({ t: 'answer', yes: false }));
$('#lm-onWithdraw').addEventListener('click', () => netSend({ t: 'withdraw' }));
$('#lm-onPick').addEventListener('change', fillVariant);
$('#lm-onSuggest').addEventListener('submit', e => {
  e.preventDefault();
  const g = GAMES[$('#lm-onPick').value]; if (!g) return;
  const toggles = {}; for (const t of g.toggles || []) toggles[t.id] = toggleOn(g, t);
  netSend({ t: 'propose', game: g.id, variant: g.variants ? $('#lm-onVariant').value : null, toggles });
});
$('#lm-onCopy').addEventListener('click', () => {
  const link = joinLink($('#lm-onCodeShow').textContent), b = $('#lm-onCopy');
  const done = ok => { b.textContent = ok ? 'Link copied' : 'Copy failed: ' + link; setTimeout(() => { b.textContent = 'Copy the link'; }, 2500); };
  try { navigator.clipboard.writeText(link).then(() => done(true), () => done(false)); } catch (e) { done(false); }
});
$('#lm-onFileBtn').addEventListener('click', () => $('#lm-onFile').click());
$('#lm-onFile').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) openSaveFile(f); });
if (deskBtn) deskBtn.addEventListener('click', () => { if (onlinePanel.hidden) { hudMenu(false); openDesk(); } else closeOnlinePanel(); });
onlinePanel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closeOnlinePanel(); } e.stopPropagation(); });
// Arriving with ?join=CODE: join that room once the hall is lit.
function onlineFromLink() {
  const code = (new URLSearchParams(location.search).get('join') || '').toUpperCase();
  if (!code || !onlineServer() || !CODE_RE.test(code)) return;
  openOnline(null); onlineJoin(code);
}

/* Saving to a file, and carrying on from one. A game against the Scribe or at one screen is saved as it is
 * (the engine's state, as the browser keeps it between visits, 22-saved-games.js); an online game is saved by
 * the server, sealed (server/seal.mjs), so the file cannot be read or changed. */
function toast(text) {
  const t = $('#lm-toast'); if (!t) return;
  t.textContent = text; t.hidden = false; t.classList.remove('out');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.classList.add('out'); toast.timer = setTimeout(() => { t.hidden = true; }, 400); }, 4200);
}
function downloadFile(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }), url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.hidden = true;
  root.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const fileStamp = iso => { const d = iso ? new Date(iso) : new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
function downloadOnlineSave(m) {
  const name = `librarium-${m.game}-online-${fileStamp(m.at)}.json`;
  downloadFile(name, { librarium: 'online-save', v: 1, game: m.game, name: gameName(m.game), saved: m.at, seat: m.seat, turns: m.turns, settings: m.settings, sealed: m.sealed });
  toast(`Saved as ${name}. Bring it to the Games Desk to carry on.`);
}
function saveToFile() {
  if (play.online) {
    if (play.phase === 'over') { toast('The game is over: there is nothing to save.'); return; }
    netSend({ t: 'save' }); return;
  }
  const g = play.game, file = localSaveFile();
  if (!file) { toast(`${g.name} can be saved at the start of ${play.hotseat ? 'a' : 'your'} turn. Press Save again then.`); return; }
  const name = `librarium-${g.id}-${fileStamp()}.json`;
  downloadFile(name, file);
  toast(`Saved as ${name}. Bring it to the Games Desk to carry on.`);
}
$('#lm-saveBtn').addEventListener('click', () => { hudMenu(false); saveToFile(); });
// A save file brought to the desk.
async function openSaveFile(f) {
  $('#lm-onErr').hidden = true;
  let d;
  try { if (f.size > 2e6) throw new Error('big'); d = JSON.parse(await f.text()); } catch (e) { onlineError('That file is not a saved game from these Archives.'); return; }
  if (d && d.librarium === 'game-save') {
    const why = loadSaveFile(d);
    if (why) onlineError(why);
    return;
  }
  if (!d || d.librarium !== 'online-save' || typeof d.sealed !== 'string') { onlineError('That file is not a saved game from these Archives.'); return; }
  if (!onlineServer()) { onlineError('This is an online game, and online play is not switched on here.'); return; }
  if (net.code && net.ws && net.lobby) { netSend({ t: 'propose', save: d.sealed }); return; }
  if (net.code && !net.lobby) { onlineError(`This room is for ${gameName(net.game)} only. Leave it, then open the saved game here: a new room will open for it.`); return; }
  // No room yet: open one, and suggest the saved game as soon as it is open.
  net.pendingGame = null; net.pendingSave = d.sealed;
  await onlineOpenRoom();
  toast(`Your saved game of ${gameName(d.game)} will be suggested to your friend when they join.`);
}
