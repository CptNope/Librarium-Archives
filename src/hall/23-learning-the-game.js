/* ---------------------------------------------------- learning the game
 * A list of the moves so far, a replay once a game is over, a reason with
 * every hint, and a guide that walks a first game at the hardest tables. */
// Boards laid out on a square grid, where a square can take a name from the visitor's side: files a, b, c… from the
// left, ranks 1, 2, 3… from the near edge. The names come from where each square is drawn, so every board agrees.
const GRID_NAMES = new Set(['chess', 'shatranj', 'chaturanga', 'lewischess', 'makruk', 'courier', 'xiangqi', 'janggi', 'shogi', 'draughts', 'tablut', 'brandubh', 'hnefatafl', 'jungle', 'rithmo', 'reversi', 'halma', 'go', 'gomoku', 'latrunculi', 'seega', 'alquerque', 'konane', 'fanorona', 'baghchal', 'foxgeese', 'morris', 'morabaraba']);
const squareNames = {};
function squareName(g, i) {
  const key = g.id + ':' + (g.variant || '');
  if (!squareNames[key]) {
    const P = PRES[g.id], at = P.pos || P.pt, n = (g.b || g.board || []).length, pts = [];
    for (let k = 0; k < n; k++) { try { const v = at.call(P, k); if (v) pts.push([k, Math.round(v.x * 1000), Math.round(v.z * 1000)]); } catch (e) { /* a square the board does not draw */ } }
    const xs = [...new Set(pts.map(p => p[1]))].sort((a, b) => a - b), zs = [...new Set(pts.map(p => p[2]))].sort((a, b) => b - a);
    const names = {}; for (const [k, x, z] of pts) names[k] = 'abcdefghijklmnopqrstuvwxyz'[xs.indexOf(x)] + (zs.indexOf(z) + 1);
    squareNames[key] = names;
  }
  return squareNames[key][i] || '?';
}
// A short written form of a move, worked out before it is played (a capture shows ×).
function moveText(g, m) {
  if (!m || g.dice) return '';
  if (m.label) return m.label;
  if (m.pass) return 'Pass';
  if (g.id === 'idraughts') return [m.from, ...m.path].map(idNumber).join(m.caps.length ? '×' : '–') + (m.crown ? ', crowned' : ''); // the board's own numbers, as the FMJD writes them
  if (g.id === 'hex') { const n = g.n; return 'abcdefghijk'[m.at % n] + (((m.at / n) | 0) + 1); }
  if (!GRID_NAMES.has(g.id)) {
    if (m.pit !== undefined) return `pit ${(m.pit % 16) + 1}` + (m.dir ? (m.dir > 0 ? ', sowing right' : ', sowing left') : '');
    if (m.e !== undefined) return `line ${m.e + 1}`;
    return '';
  }
  const sq = i => squareName(g, i);
  if (m.type === 'remove') return `takes on ${sq(m.at)}`;
  if (m.drop) return `drop on ${sq(m.to)}`;
  const at = m.place !== undefined ? m.place : m.at !== undefined ? m.at : m.p !== undefined ? m.p : m.type === 'place' ? m.to : m.remove !== undefined ? m.remove : m.lift;
  if (m.from === undefined && at !== undefined) return (m.remove !== undefined || m.lift !== undefined ? 'lifts ' : '') + sq(at);
  if (m.from === undefined || m.to === undefined) return '';
  const cap = (m.caps && m.caps.length) || m.cap || m.meet || (g.b && g.b[m.to] && g.b[m.to] !== 0);
  const via = m.path && m.path.length > 1 ? m.path.slice(0, -1).map(sq) : [];
  return [sq(m.from), ...via, sq(m.to)].join(cap ? '×' : '–') + (m.promo ? ', promoted' : '') + (m.crown ? ', crowned' : '');
}
const canReview = g => UNDO_OK.has(g.id); // tables that rebuild from their state can be replayed
function startHistory() {
  const g = play.game;
  play.history = canReview(g) ? [{ pl: -1, text: play.resumed ? 'The saved game' : 'The start', note: '', state: copyState(g) }] : [];
  play.undoH = [];
  $('#lm-movesBtn').hidden = !canReview(g); $('#lm-moves').hidden = true; $('#lm-movesBtn').setAttribute('aria-expanded', 'false');
  $('#lm-movesKey').textContent = g.id === 'idraughts' ? 'Squares carry the board\'s own numbers, 1 to 50, as players write them; × marks a capture.'
    : GRID_NAMES.has(g.id) ? 'Squares are named from your side: files a, b, c… from your left, ranks 1, 2, 3… from the row nearest you. × marks a capture.' : '';
  renderMoves();
}
function recordMove(pl, m, text, res) {
  const g = play.game; if (!play.history || !play.history.length) return;
  const caps = res && res.caps && res.caps.length;
  if (caps && text && !text.includes('×')) text += ` (takes ${caps})`;
  try { play.history.push({ pl, m, text, note: (res && res.note) || '', state: copyState(g) }); } catch (e) { return; }
  if (!$('#lm-moves').hidden) renderMoves();
}
function renderMoves(now) {
  const ol = $('#lm-moveList'); ol.innerHTML = '';
  const h = play.history || [];
  if (h.length < 2) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No moves yet.'; ol.appendChild(li); return; }
  let turn = 0;
  h.forEach((e, k) => {
    if (k === 0) return;
    if (e.pl === 0 && (k === 1 || h[k - 1].pl !== 0)) turn++;
    const li = document.createElement('li'); li.className = (e.pl === 0 ? 'you' : 'scribe') + (k === now ? ' now' : '');
    const n = document.createElement('span'); n.className = 'n'; n.textContent = e.pl === 0 && (k === 1 || h[k - 1].pl !== 0) ? turn + '.' : '';
    const w = document.createElement('span'); w.className = 'w'; w.textContent = e.pl === 0 ? 'You' : asFriend('Scribe');
    const t = document.createElement('span'); t.className = 't';
    if (e.text) { const b = document.createElement('b'); b.textContent = e.text; t.appendChild(b); }
    if (e.note) { const i = document.createElement('i'); i.textContent = (e.text ? ' · ' : '') + asFriend(e.note); t.appendChild(i); }
    li.append(n, w, t); ol.appendChild(li);
  });
  if (now !== undefined) { const on = ol.querySelector('.now'); if (on) on.scrollIntoView({ block: 'nearest' }); }
  else ol.parentElement.scrollTop = ol.parentElement.scrollHeight;
}
$('#lm-movesBtn').addEventListener('click', () => {
  const box = $('#lm-moves'), on = box.hidden;
  box.hidden = !on; $('#lm-movesBtn').setAttribute('aria-expanded', String(on));
  if (on) { $('#lm-rules').hidden = true; renderMoves(play.phase === 'replay' ? play.replayAt : undefined); }
});

/* Replay: once the game is over, step through it position by position. */
function showReplay(k) {
  const g = play.game, P = play.P, h = play.history, e = h[k];
  play.replayAt = k; settleTweens(); clearLastMove();
  Object.assign(g, structuredClone(e.state)); P.setup(play.ex); updateScore();
  if (e.m) { try { markLastMove(P.fromFor ? P.fromFor(e.m) : null, P.ringFor(e.m)); } catch (err) { /* a move with no spot */ } }
  const who = e.pl === 0 ? 'You' : e.pl === 1 ? asFriend('The Scribe') : '';
  setMsg('Replay', k === 0 ? `${e.text}. Step through the game with the arrows.` : `Move ${k} of ${h.length - 1}. ${who}${e.text ? ': ' + e.text : ''}.${e.note ? ' ' + asFriend(e.note) : ''}`);
  const box = $('#lm-choices'); box.innerHTML = ''; box.hidden = false; box.classList.add('replaybar');
  const add = (label, aria, to, off) => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = label; b.setAttribute('aria-label', aria); b.disabled = off; b.addEventListener('click', () => (to === 'done' ? endReplay() : showReplay(to))); box.appendChild(b); };
  add('⏮', 'Back to the start', 0, k === 0); add('◀', 'Previous move', k - 1, k === 0); add('▶', 'Next move', k + 1, k === h.length - 1); add('Done', 'Leave the replay', 'done', false);
  if (!$('#lm-moves').hidden) renderMoves(k);
}
function startReplay() {
  if (!play.history || play.history.length < 2) return;
  play.phase = 'replay'; $('#lm-win').hidden = true; $('#lm-throwBtn').hidden = true; $('#lm-passBtn').hidden = true; $('#lm-hintBtn').hidden = true; $('#lm-undoBtn').hidden = true;
  showReplay(0);
}
function endReplay() {
  showReplay(play.history.length - 1); // the board as the game ended
  const box = $('#lm-choices'); box.innerHTML = ''; box.hidden = true; box.classList.remove('replaybar');
  play.phase = 'over'; clearLastMove();
  $('#lm-win').hidden = false; $('#lm-replayBtn').focus({ preventScroll: true });
}
$('#lm-replayBtn').addEventListener('click', startReplay);
addEventListener('keydown', e => {
  if (mode !== 'play' || play.phase !== 'replay') return;
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); } // the arrows step the replay, nothing else
  if (e.code === 'ArrowLeft' && play.replayAt > 0) showReplay(play.replayAt - 1);
  else if (e.code === 'ArrowRight' && play.replayAt < play.history.length - 1) showReplay(play.replayAt + 1);
  else if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); endReplay(); }
}, true);

/* Why a hint is good: play it on the side, see what it does, and put everything back. */
const HINT_NOUN = { oware: ['a pit of seeds', 'pits of seeds'], kalah: ['a pit of seeds', 'pits of seeds'], bao: ['seeds', 'lots of seeds'], go: ['a stone', 'stones'], konane: ['a stone', 'stones'], fanorona: ['a stone', 'stones'], seega: ['a stone', 'stones'], latrunculi: ['a counter', 'counters'], gomoku: ['a stone', 'stones'] };
function capturesFor(g, p) { // how many of p's moves take something, where that can be told from the move itself
  if (g.dice || !g.legal) return null;
  let ms; try { ms = g.legal(p); } catch (e) { return null; }
  const telling = ms.some(m => m.caps !== undefined || m.cap !== undefined || m.meet !== undefined) || ['chess', 'shatranj', 'chaturanga', 'lewischess', 'makruk', 'courier', 'xiangqi', 'janggi', 'shogi', 'jungle'].includes(g.id);
  if (!telling) return null;
  return ms.filter(m => (m.caps && m.caps.length) || m.cap || m.meet || (m.from !== undefined && m.to !== undefined && !m.drop && g.b && g.b[m.to])).length;
}
function explainHint(g, pl, m) {
  const before = copyState(g), why = [], opp = 1 - pl;
  const threatsBefore = capturesFor(g, opp);
  const runsBefore = g.kingRuns ? g.kingRuns() : g.kingLines ? g.kingLines().open : 0;
  const countBefore = g.count ? g.count(pl) : null;
  try {
    const res = g.apply(Object.assign({}, m)) || {};
    const r = !g.dice && g.result ? g.result(opp) : null;
    if (r && r.winner === pl) why.push('it wins the game');
    else {
      const noun = HINT_NOUN[g.id] || ['a piece', 'pieces'];
      if (g.dice && pl === 0 && res.note) why.push(res.note.split('. ')[0].replace(/^You /, 'you ').replace(/\.$/, '')); // at dice tables the table's own words say it best
      else if (res.boxes && res.boxes.length) why.push(`it completes ${res.boxes.length > 1 ? res.boxes.length + ' boxes' : 'a box'} and you move again`);
      else if (pl === 0 && res.note && /^You (take|capture|meet)/.test(res.note)) why.push(res.note.split('. ')[0].replace(/^You /, 'you ').replace(/\.$/, '')); // the table's own words
      else if (res.caps && res.caps.length) why.push(`it takes ${res.caps.length > 1 ? res.caps.length + ' ' + noun[1] : noun[0]}`);
      else if (m.flips && m.flips.length) why.push(`it turns ${m.flips.length > 1 ? m.flips.length + ' discs' : 'a disc'}`);
      if (m.promo || m.crown) why.push('it promotes your piece');
      if (res.followUp && res.followUp.length && g.id.match(/morris|morabaraba/)) why.push('it makes a mill, so you take a piece');
      if ((g.inCheck && g.inCheck(opp)) || (g.id === 'janggi' && g.attacked(opp))) why.push(asFriend('it puts the Scribe in check'));
      const runsAfter = g.kingRuns ? g.kingRuns() : g.kingLines ? g.kingLines().open : 0;
      if (pl === 0 && runsAfter > runsBefore) why.push('it opens a road for your king');
      if (pl === 1 && runsAfter < runsBefore) why.push('it closes a road for the king');
      const threatsAfter = threatsBefore === null ? null : capturesFor(g, opp);
      if (threatsBefore && threatsAfter === 0) why.push(asFriend('it leaves the Scribe nothing to take'));
      else if (threatsBefore !== null && threatsAfter < threatsBefore && !why.length) why.push('it takes a piece out of danger');
      if (g.id === 'reversi' && countBefore !== null && !why.length) why.push(`it turns ${g.count(pl) - countBefore - 1} discs`);
    }
  } catch (e) { /* the reason is a courtesy: the hint stands without it */ }
  Object.assign(g, structuredClone(before));
  if (!why.length) return g.id === 'go' || g.id === 'hex' ? 'It is the move that wins most often when the Scribe plays the game out from here many times.'
    : g.dice ? 'Of the moves this throw allows, it leaves your pieces best placed: furthest on, and least exposed.' : 'It is the move the Scribe rates best after looking several moves ahead.';
  const text = why.slice(0, 2).join(', and ');
  return text[0].toUpperCase() + text.slice(1) + '.';
}

/* The guide: a few words at the right moment in a first game at the hardest tables. Each tip shows once a game. */
const COACH = {
  rithmo: [
    { when: (g, c) => c.turn === 1, text: 'Every piece carries its number. Rounds step exactly one square, triangles two and squares three, always straight along a row or a column and never over another piece. Pick a piece to see where it can go.' },
    { when: (g, c) => c.moves.some(m => m.meet), text: 'A ring on an enemy piece is a meeting: that piece has exactly your piece\'s value, so moving onto it takes it.' },
    { when: (g, c) => c.turn >= 3, text: 'Captures also happen after you move. An enemy is taken if one of your pieces, times the empty squares between them, makes its value (assault); if two of yours on either side add up to it (ambuscade); or if it is shut in on all four sides (siege).' },
    { when: (g) => g.taken[0] + g.taken[1] >= 1, text: 'Take five of the Scribe\'s pieces, or its pyramid, to win. The score bar keeps the count. If no one gets there in 150 moves each, whoever has taken more wins.' },
  ],
  bao: [
    { when: (g, c) => c.turn === 1, text: 'A move lifts every seed in one of your pits and drops them one at a time into the pits that follow, round your own two rows and never into the Scribe\'s. The two rings sit on the pits either side of the one you pick: choose the way to sow.' },
    { when: (g, c) => c.turn >= 2 && c.moves.some(m => m.mtaji), text: 'You can capture, so you must. If your last seed lands in an occupied pit of your inner row and the Scribe\'s pit opposite has seeds, you take them and sow them in from an end of your inner row.' },
    { when: (g, c) => c.turn >= 2, text: 'When your last seed lands in a pit that already has seeds, you lift them all and keep sowing. The turn ends only when a last seed falls into an empty pit.' },
    { when: (g, c) => c.turn >= 4 || g.innerCount(0) <= 8, text: 'Watch your inner row, the one nearer the middle: you lose if it is ever empty, or if you cannot move.' },
  ],
  mahjong: [
    { when: (g) => g.need.type === 'discard' && g.need.seat === 0, text: 'You hold fourteen tiles: click one to discard it. You are building four sets and a pair. A set is three alike (a pung) or a run of three in one suit (a chow).' },
    { when: (g) => g.need.type === 'claim', text: 'Someone has discarded a tile you can use. The buttons show your claims: a pung or kong from anyone, a chow only from North, the player on your left. Or press Pass to let it go.' },
    { when: (g, c) => c.turn >= 3, text: 'Winds and dragons can make pungs and pairs but never runs, so a lone one is often a good early discard.' },
    { when: (g) => g.need.type === 'discard' && g.shanten(g.hands[0], g.open(0)) === 0, text: 'Your hand is ready: one tile from going out. When that tile comes, from the wall or from anyone\'s discard, a Mahjong button appears.' },
  ],
};
function coachOn(g) {
  if (!COACH[g.id] || play.hotseat) return false;
  const pref = (store.guide || {})[g.id];
  if (pref !== undefined) return pref;
  const rec = store.record[g.id]; return !rec || !rec.some(Boolean); // on for a first game, unless set
}
function coachCheck() {
  const g = play.game, box = $('#lm-coach');
  if (!g || !coachOn(g) || play.phase !== 'choose' || play.cur !== 0) return;
  const ctx = { turn: play.turnNo || 0, moves: play.moves };
  play.coachSeen = play.coachSeen || new Set();
  const tips = COACH[g.id];
  for (let k = 0; k < tips.length; k++) {
    if (play.coachSeen.has(k)) continue;
    let fire = false; try { fire = tips[k].when(g, ctx); } catch (e) { fire = false; }
    if (!fire) continue;
    play.coachSeen.add(k); $('#lm-coachText').textContent = tips[k].text; box.hidden = false; placeCoach(); return;
  }
}
// On a wide screen the card sits at the top left, beside the table. Where there is no room beside it, the card
// lies over the message bar instead, so it covers the panel and not the rows you play from.
function placeCoach() {
  const box = $('#lm-coach'); if (box.hidden) return;
  const app = root.getBoundingClientRect(), bar = $('#lm-hud .hudbottom').getBoundingClientRect();
  if (app.width >= 1000) {
    const top = $('#lm-hud .hudtop').getBoundingClientRect().bottom - app.top + 10;
    Object.assign(box.style, { top: top + 'px', bottom: '', left: '', width: '', transform: '', maxHeight: Math.max(120, bar.top - app.top - top - 12) + 'px' });
  } else {
    Object.assign(box.style, { top: 'auto', bottom: (app.bottom - bar.bottom) + 'px', left: (bar.left - app.left) + 'px', width: bar.width + 'px', transform: 'none', maxHeight: '45%' });
  }
}
addEventListener('resize', placeCoach);
$('#lm-coachOk').addEventListener('click', () => { $('#lm-coach').hidden = true; });
$('#lm-coachOff').addEventListener('click', () => {
  store.guide = Object.assign(store.guide || {}, { [play.game.id]: false }); save();
  $('#lm-coach').hidden = true; renderRules(play.game);
});
function renderRules(g) {
  const r = $('#lm-rules'); r.innerHTML = '';
  const h = document.createElement('h3'); h.textContent = 'How to play ' + g.name; r.appendChild(h);
  const ul = document.createElement('ul'); g.rules.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }); r.appendChild(ul);
  const p = document.createElement('p'); p.className = 'src'; p.textContent = g.source; r.appendChild(p);
  const k = document.createElement('p'); k.className = 'src'; k.textContent = 'Keyboard: the arrow keys step through the pieces you can move, then the places they can go; Enter plays, Escape steps back.'; r.appendChild(k);
  if (COACH[g.id] && !play.hotseat) {
    const on = coachOn(g), gb = document.createElement('button'); gb.className = 'hudbtn'; gb.textContent = on ? 'Guide: on' : 'Guide: off'; gb.setAttribute('aria-pressed', String(on));
    gb.addEventListener('click', () => { store.guide = Object.assign(store.guide || {}, { [g.id]: !on }); save(); if (on) $('#lm-coach').hidden = true; else coachCheck(); renderRules(g); });
    r.appendChild(gb); r.appendChild(document.createTextNode(' '));
  }
  const close = document.createElement('button'); close.className = 'hudbtn'; close.textContent = 'Got it';
  close.addEventListener('click', () => { r.hidden = true; }); r.appendChild(close);
}
function leaveGame() {
  if (mode !== 'play') return;
  play.token++; clearHighlights(); clearLastMove(); $('#lm-choices').hidden = true;
  if (play.P && play.P.leave) play.P.leave(play.ex);
  $('#lm-coach').hidden = true; $('#lm-moves').hidden = true; $('#lm-choices').classList.remove('replaybar');
  mode = 'gallery';
  $('#lm-hud').hidden = true; rail.hidden = false; $('#lm-hint').style.opacity = 1;
  root.classList.remove('playing');
  resetView(false); updateJoy();
  goStop(STOPS.indexOf(play.ex));
}
$('#lm-leaveBtn').addEventListener('click', leaveGame);
$('#lm-winLeave').addEventListener('click', leaveGame);
$('#lm-againBtn').addEventListener('click', restartTable);
$('#lm-rulesBtn').addEventListener('click', () => { $('#lm-rules').hidden = !$('#lm-rules').hidden; if (!$('#lm-rules').hidden) { $('#lm-moves').hidden = true; $('#lm-movesBtn').setAttribute('aria-expanded', 'false'); } });
$('#lm-throwBtn').addEventListener('click', humanThrow);
$('#lm-passBtn').addEventListener('click', () => {
  if (play.phase !== 'choose') return;
  const m = play.moves.find(x => x.pass) || (play.game.canPass ? { pl: play.cur || 0, pass: true } : null);
  if (m) choose(m);
});

const asFriend = t => (play.hotseat && mode === 'play' && t ? String(t).replace(/The Scribe/g, 'Your friend').replace(/the Scribe/g, 'your friend').replace(/\bScribe\b/g, 'Friend') : t);
function setMsg(who, text) {
  who = asFriend(who); text = asFriend(text);
  const m = $('#lm-msg'); m.innerHTML = '';
  const w = document.createElement('span'); w.className = 'who'; w.textContent = who; m.appendChild(w);
  m.appendChild(document.createTextNode(text));
}
function updateScore() {
  const s = $('#lm-score'); s.innerHTML = '';
  const add = ([label, val]) => { const el = document.createElement('b'); el.textContent = val; s.append(asFriend(label) + ' ', el); };
  if (play.P.scores) { // more than two players
    const list = play.P.scores(), tail = typeof list[list.length - 1] === 'string' ? list.pop() : '';
    list.forEach((x, k) => { if (k) s.append('  ·  '); add(x); });
    if (tail) s.append('  ·  ' + tail); return;
  }
  const [a, b, suffix] = play.P.score();
  add(a); s.append('  ·  '); add(b); if (suffix) s.append('  ' + suffix);
}
// Games with several Scribes name the one at play, and decide whose turn comes next.
const scribeName = g => g.scribeName || 'The Scribe';
const nextPl = (g, other) => (g.passTurn ? g.passTurn() : other);
function renderDice(g, r, shaking = false) {
  const d = $('#lm-dice'); d.innerHTML = ''; d.classList.toggle('shake', shaking);
  const faces = r ? r.faces : g.pipDice ? (g.oneDie ? [1] : [1, 1]) : g.id === 'patolli' ? [0, 0, 0, 0, 0] : [0, 0, 0, 0];
  faces.forEach(f => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 30 30');
    if (g.pipDice && g.id !== 'mansion' && g.id !== 'lifegame') {
      const p = document.createElementNS(ns, 'rect'); p.setAttribute('x', '3'); p.setAttribute('y', '3'); p.setAttribute('width', '24'); p.setAttribute('height', '24'); p.setAttribute('rx', '5');
      p.setAttribute('fill', '#ecdfc3'); p.setAttribute('stroke', '#a8977a'); p.setAttribute('stroke-width', '1.2'); svg.appendChild(p);
      const pips = { 1: [[15, 15]], 2: [[9, 9], [21, 21]], 3: [[9, 9], [15, 15], [21, 21]], 4: [[9, 9], [21, 9], [9, 21], [21, 21]], 5: [[9, 9], [21, 9], [15, 15], [9, 21], [21, 21]], 6: [[9, 8], [21, 8], [9, 15], [21, 15], [9, 22], [21, 22]] }[r ? f : 1];
      for (const [x, y] of pips) { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', '2.6'); c.setAttribute('fill', r ? '#1d140c' : '#c9b79a'); svg.appendChild(c); }
    } else if (g.id === 'pachisi') { // a cowrie: mouth up shows its slit
      const e = document.createElementNS(ns, 'ellipse'); e.setAttribute('cx', '15'); e.setAttribute('cy', '15'); e.setAttribute('rx', '9'); e.setAttribute('ry', '13');
      e.setAttribute('fill', r && f ? '#f2ead8' : '#c9b79a'); e.setAttribute('stroke', '#a8977a'); e.setAttribute('stroke-width', '1.2'); svg.appendChild(e);
      if (r && f) { const l = document.createElementNS(ns, 'path'); l.setAttribute('d', 'M15 5 Q12 15 15 25'); l.setAttribute('stroke', '#5a4a3a'); l.setAttribute('stroke-width', '2'); l.setAttribute('fill', 'none'); svg.appendChild(l); }
    } else if (g.id === 'mansion' || g.id === 'lifegame') { // a teetotum seen from above: a hexagon with the number it fell on
      const p = document.createElementNS(ns, 'path'); p.setAttribute('d', 'M15 2 L27 9 L27 21 L15 28 L3 21 L3 9 Z');
      p.setAttribute('fill', '#ecdfc3'); p.setAttribute('stroke', '#a8977a'); p.setAttribute('stroke-width', '1.2'); svg.appendChild(p);
      const t = document.createElementNS(ns, 'text'); t.setAttribute('x', '15'); t.setAttribute('y', '20'); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '13'); t.setAttribute('font-family', 'Georgia, serif');
      t.setAttribute('fill', r ? '#1d140c' : '#c9b79a'); t.textContent = r ? f : '?'; svg.appendChild(t);
    } else if (g.id === 'patolli') { // a black bean, its marked side a white dot
      const e = document.createElementNS(ns, 'ellipse'); e.setAttribute('cx', '15'); e.setAttribute('cy', '15'); e.setAttribute('rx', '8'); e.setAttribute('ry', '12');
      e.setAttribute('fill', '#1d140c'); e.setAttribute('stroke', '#a8977a'); e.setAttribute('stroke-width', '1.2'); svg.appendChild(e);
      if (r && f) { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', '15'); c.setAttribute('cy', '15'); c.setAttribute('r', '4'); c.setAttribute('fill', '#f2ead8'); svg.appendChild(c); }
    } else if (g.id === 'ur') {
      const p = document.createElementNS(ns, 'path'); p.setAttribute('d', 'M15 3 L27 26 L3 26 Z');
      p.setAttribute('fill', '#2a2018'); p.setAttribute('stroke', '#a8977a'); p.setAttribute('stroke-width', '1.4'); svg.appendChild(p);
      const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', '15'); c.setAttribute('cy', '8'); c.setAttribute('r', '3.4');
      c.setAttribute('fill', r && f ? '#f6a01a' : '#3d3126'); svg.appendChild(c);
    } else {
      const p = document.createElementNS(ns, 'rect'); p.setAttribute('x', '10'); p.setAttribute('y', '2'); p.setAttribute('width', '10'); p.setAttribute('height', '26'); p.setAttribute('rx', '4');
      p.setAttribute('fill', r && f ? '#ecdfc3' : '#2a1d14'); p.setAttribute('stroke', '#a8977a'); p.setAttribute('stroke-width', '1.2'); svg.appendChild(p);
    }
    d.appendChild(svg);
  });
}
const readTime = note => Math.min(2800, 700 + note.length * 22);
function rollText(g, r) { return g.rollName ? g.rollName(r) : g.pipDice && r.faces.length === 1 ? String(r.faces[0]) : g.pipDice ? (r.faces[0] === r.faces[1] ? `double ${r.faces[0]}s` : `${r.faces[0]} and ${r.faces[1]}`) : String(r.value); }
async function showRoll(r) {
  const g = play.game, tok = play.token;
  sfx.roll(g);
  for (let k = 0; k < (reduceMotion ? 1 : 5); k++) { renderDice(g, g.roll(), true); await wait(90); if (tok !== play.token) return false; }
  renderDice(g, r, false);
  return tok === play.token;
}
function beginTurn(pl, first) {
  if (mode !== 'play') return;
  const g = play.game, P = play.P;
  play.cur = pl;
  updateScore();
  if (!g.dice) { const r = g.result(pl); if (r) return finish(r); }
  if (g.ended && g.ended()) return finish(g.final());
  if (g.skipTurn) {
    const why = g.skipTurn(pl);
    if (why) {
      play.phase = 'skip'; $('#lm-throwBtn').disabled = true;
      setMsg(pl === 0 ? 'Your turn' : 'The Scribe', why);
      const tok = play.token;
      setTimeout(() => { if (tok === play.token) beginTurn(1 - pl); }, 1800);
      return;
    }
  }
  if (pl === 0) play.turnNo = (play.turnNo || 0) + 1;
  if (pl === 0 || (play.hotseat && g.dice)) { // at a dice table a friend throws for themselves
    const say = first && pl === 0 ? P.intro() : P.prompt();
    const pre = g.dice && g.preThrow ? g.preThrow(pl) : null;
    if (pre) { $('#lm-throwBtn').disabled = true; offer(pre, say); }
    else if (g.dice) {
      play.phase = 'throw'; $('#lm-throwBtn').disabled = false;
      setMsg(turnName(), pl === 1 && first ? 'Your friend throws first, in the Scribe\'s seat. ' + say : say);
      $('#lm-throwBtn').focus({ preventScroll: true });
    } else offer(g.legal(0), say);
    if (pl === 0) { saveGame(); rememberTurn(); }
  } else if (play.hotseat) {
    offer(g.legal(1), first ? 'Your friend moves first, in the Scribe\'s seat. ' + P.prompt() : P.prompt());
  } else {
    play.phase = 'ai'; $('#lm-throwBtn').disabled = true;
    const who = scribeName(g);
    setMsg(who, g.dice ? `${who} is throwing…` : `${who} is thinking…`);
    aiTurn();
  }
}
function renderChoices(moves) {
  const box = $('#lm-choices'); box.innerHTML = '';
  const list = moves.filter(m => m.label && !(play.P.meshesFor(m) || []).some(Boolean));
  box.hidden = !list.length;
  for (const m of list) { const b = document.createElement('button'); b.className = 'btn' + (/^Mahjong/.test(m.label) ? ' primary' : ''); b.textContent = m.label; b.addEventListener('click', () => choose(m)); box.appendChild(b); }
}
// Whose turn the message names: you, or in pass-and-play the friend in the Scribe's seat.
const turnName = () => (play.cur === 1 ? 'Your friend\'s turn' : 'Your turn');
function offer(moves, text) {
  play.moves = moves; play.phase = 'choose'; play.kb = -1;
  renderChoices(moves);
  $('#lm-passBtn').disabled = !(play.game.canPass || moves.some(m => m.pass));
  highlight(moves);
  setMsg(turnName(), text);
  refreshAids();
  coachCheck();
}
async function humanThrow() {
  if (play.phase !== 'throw') return;
  play.phase = 'rolling'; $('#lm-throwBtn').disabled = true;
  const g = play.game, tok = play.token, pl = play.cur || 0, you = pl ? 'Your friend' : 'You';
  const r = g.roll();
  if (!(await showRoll(r))) return;
  play.roll = r;
  const moves = g.legal(pl, r.value, r);
  if (!moves.length) {
    setMsg(turnName(), `${you} threw ${rollText(g, r)}. No piece can move, so the turn passes.`);
    await wait(1500); if (tok !== play.token) return;
    beginTurn(nextPl(g, 1 - pl)); return;
  }
  if (g.autoMove && moves.length === 1) {
    setMsg(turnName(), `${you} threw ${rollText(g, r)}.`);
    play.moves = moves; play.phase = 'choose';
    await wait(400); if (tok !== play.token) return;
    return choose(moves[0]);
  }
  offer(moves, `${you} threw ${rollText(g, r)}. ` + (play.P.choosePrompt ? play.P.choosePrompt(moves) : `Choose a glowing piece${moves.length === 1 ? ' (only one can move)' : ''}.`));
}
async function choose(m) {
  if (play.phase !== 'choose') return;
  play.phase = 'anim'; clearHighlights(); clearLastMove();
  $('#lm-choices').hidden = true;
  $('#lm-passBtn').disabled = true; refreshAids();
  const g = play.game, tok = play.token, mover = play.cur || 0, text = moveText(g, m);
  $('#lm-coach').hidden = true;
  const res = await play.P.play(m);
  if (tok !== play.token) return;
  recordMove(mover, m, text, res);
  sfx.move(g, m, res);
  updateScore();
  if (res.followUp && res.followUp.length) { offer(res.followUp, (res.note ? res.note + ' ' : '') + g.followPrompt); return; }
  if (m.pre && res.thenThrow) { // a choice made before throwing, such as paying a fine
    play.phase = 'throw'; $('#lm-throwBtn').disabled = false;
    setMsg(turnName(), (res.note ? res.note + ' ' : '') + 'Now throw the dice.');
    $('#lm-throwBtn').focus({ preventScroll: true }); return;
  }
  if (g.dice) {
    const pl = play.cur || 0;
    if (g.done(pl)) return finish(g.final ? g.final() : { winner: pl, text: g.winText ? g.winText(pl) : '' });
    if (g.extra(m, play.roll.value)) {
      setMsg(turnName(), (res.note ? res.note + ' ' : '') + g.extraNote);
      play.phase = 'throw'; $('#lm-throwBtn').disabled = false; return;
    }
  }
  if (res.note) { setMsg(turnName(), res.note); await wait(readTime(res.note)); if (tok !== play.token) return; }
  beginTurn(nextPl(g, 1 - (play.cur || 0)));
}
async function aiTurn() {
  const g = play.game, P = play.P, tok = play.token;
  await wait(650); if (tok !== play.token) return;
  const who = scribeName(g);
  if (g.dice) {
    if (g.aiPre && g.preThrow(1)) { // choices before the throw: lot tickets, or the way out of jail
      for (const step of g.aiPre(1)) {
        const res = await P.play(step);
        if (tok !== play.token) return;
        updateScore();
        if (res.note) { setMsg('The Scribe', res.note); await wait(Math.min(1600, readTime(res.note))); if (tok !== play.token) return; }
      }
    }
    const r = g.roll();
    if (!(await showRoll(r))) return;
    const moves = g.legal(1, r.value, r);
    if (!moves.length) {
      setMsg(who, `${who} threw ${rollText(g, r)} and cannot move.`);
      await wait(1300); if (tok !== play.token) return;
      beginTurn(nextPl(g, 0)); return;
    }
    setMsg(who, `${who} threw ${rollText(g, r)}.`);
    const plan = g.aiPlan(1, moves);
    await wait(500); if (tok !== play.token) return;
    let res = {};
    const m = plan[plan.length - 1];
    clearLastMove();
    for (const step of plan) {
      const from = P.fromFor ? P.fromFor(step) : null, to = P.ringFor(step);
      res = await P.play(step);
      sfx.move(g, step, res);
      markLastMove(from, to);
      if (tok !== play.token) return;
      updateScore();
      if (res.note) setMsg(who, res.note);
    }
    if (g.done(1)) return finish(g.final ? g.final() : { winner: 1, text: g.winText ? g.winText(1) : '' });
    if (g.extra(m, r.value)) { setMsg(who, (res.note ? res.note + ' ' : '') + `${who} throws again.`); await wait(900); if (tok !== play.token) return; aiTurn(); return; }
    if (res.note) { setMsg(who, res.note); await wait(readTime(res.note) + 250); if (tok !== play.token) return; }
    beginTurn(nextPl(g, 0));
    return;
  }
  // Let the 'thinking' message paint first, without depending on animation frames (paused in background tabs).
  await new Promise(r => { requestAnimationFrame(() => setTimeout(r, 30)); setTimeout(r, 120); });
  const plan = await scribe.plan(g, 1, R.level());
  if (tok !== play.token || !plan) return;
  let said = false;
  clearLastMove();
  for (const m of plan) {
    const from = P.fromFor ? P.fromFor(m) : null, to = P.ringFor(m), text = moveText(g, m);
    const res = await P.play(m);
    markLastMove(from, to);
    if (tok !== play.token) return;
    recordMove(1, m, text, res);
    sfx.move(g, m, res);
    updateScore();
    if (res.note) { setMsg(who, res.note); said = true; }
  }
  if (said) { await wait(1000); if (tok !== play.token) return; }
  beginTurn(nextPl(g, 0));
}
/* The Scribe thinks in a worker of its own, so the hall keeps moving while it looks ahead. The worker loads
 * the same rules as the page, is given the game's state, and sends back its plan as plain moves, which the
 * page then plays. If a worker cannot start (an old browser, a blocked page), or answers nothing in time,
 * the Scribe thinks on the page as before. Dice tables plan in an instant and stay on the page. */
const scribe = (() => {
  let w = null, failed = false, next = 1; const waiting = new Map();
  const glue = `self.onmessage = function (e) {
    var d = e.data, R = self.LibrariumRules, plan = null, err = null;
    try { var g = R[d.game]; if (g.setVariant && d.variant != null) g.setVariant(d.variant); g.init();
      Object.assign(g, R.unpackState(d.state)); R.setLevel(d.level); plan = g.aiPlan(d.pl); }
    catch (x) { err = String(x && x.message || x); }
    self.postMessage({ id: d.id, plan: plan, err: err });
  };`;
  function start() {
    if (w || failed) return w;
    try {
      const src = R.source; if (!src || typeof Worker === 'undefined') throw new Error('no worker');
      const head = src.text ? src.text : `importScripts(${JSON.stringify(new URL(src.url, location.href).href)});`;
      const url = URL.createObjectURL(new Blob([head, '\n', glue], { type: 'text/javascript' }));
      w = new Worker(url);
      w.onmessage = e => { const job = waiting.get(e.data.id); if (job) { waiting.delete(e.data.id); job(e.data); } };
      w.onerror = () => { failed = true; stop(); };
    } catch (e) { failed = true; w = null; }
    return w;
  }
  function stop() { if (w) w.terminate(); w = null; for (const job of waiting.values()) job({ err: 'stopped' }); waiting.clear(); }
  // Ask for a plan; resolves to the plan, or to the page's own answer if the worker cannot give one.
  function plan(g, pl, level) {
    const local = () => { const was = R.level(); try { R.setLevel(level); return g.aiPlan(pl); } finally { R.setLevel(was); } };
    if (g.dice || !start()) return Promise.resolve(local());
    const id = next++, msg = { id, game: g.id, variant: g.variant != null ? g.variant : null, state: engineState(g), pl, level };
    return new Promise(resolve => {
      const late = setTimeout(() => { if (waiting.delete(id)) { failed = true; stop(); resolve(local()); } }, 20000);
      waiting.set(id, d => { clearTimeout(late); if (d.err || !d.plan) resolve(d.err === 'stopped' ? null : local()); else resolve(d.plan); });
      try { w.postMessage(msg); } catch (e) { waiting.delete(id); clearTimeout(late); resolve(local()); }
    });
  }
  return { plan, stop, get on() { return !!w && !failed; } };
})();
function finish(res) {
  play.phase = 'over'; clearHighlights();
  sfx.end(res.winner);
  const g = play.game, P = play.P;
  if (P.onFinish) P.onFinish(res);
  updateScore();
  clearSave(g.id);
  $('#lm-coach').hidden = true;
  $('#lm-replayBtn').hidden = !(play.history && play.history.length > 1);
  $('#lm-winTitle').textContent = asFriend(res.title || (res.winner === 0 ? 'You win' : res.winner === 1 ? 'The Scribe wins' : 'A draw'));
  $('#lm-winText').textContent = asFriend(res.text || (res.winner === 0
    ? `All ${g.N} of your pieces are home. The Scribe bows and resets the board.`
    : `The Scribe brought all ${g.N} pieces home first. You bore off ${g.home(0)}.`));
  if (!play.hotseat) {
    const rec = store.record[g.id] || (store.record[g.id] = [0, 0, 0]); rec[res.winner === 0 ? 0 : res.winner === 1 ? 1 : 2]++;
    if (res.winner === 0) { store.best = store.best || {}; const lv = R.LEVELS.indexOf(R.level()); store.best[g.id] = Math.max(store.best[g.id] ?? -1, lv); } // the passport's seal
    save();
  }
  $('#lm-winRecord').textContent = play.hotseat ? 'A game between two visitors: it does not count toward your record against the Scribe.' : recordText(g.id).replace('Your record against the Scribe here', 'Your record at this table') + ` The Scribe was playing ${R.level()}.`;
  setTimeout(() => { if (play.phase === 'over') { $('#lm-win').hidden = false; $('#lm-againBtn').focus({ preventScroll: true }); } }, res.sweep ? 900 : 300);
}
// Ember marks show where the Scribe's last move went from and to.
const lastMarks = [];
const markFromGeo = new THREE.CircleGeometry(0.026, 20);
function clearLastMove() { lastMarks.splice(0).forEach(o => { o.parent && o.parent.remove(o); o.material.dispose(); }); }
function markLastMove(from, to) {
  const add = (geo, v, opacity) => {
    if (!v) return;
    const mat = new THREE.MeshBasicMaterial({ color: RING_COLOR.ember, transparent: true, opacity, depthWrite: false });
    const o = geo === ringGeo ? markMesh(geo, mat) : new THREE.Mesh(geo, mat);
    o.rotation.x = -Math.PI / 2; o.position.copy(v); o.position.y += 0.003; o.scale.setScalar(0.9);
    play.ex.group.add(o); lastMarks.push(o);
  };
  add(markFromGeo, from, 0.45); add(ringGeo, to, 0.85);
}
function addRing(m) {
  const P = play.P, at = P.ringFor(m);
  if (!at) return; // a move with no spot of its own, such as a card played from the hand
  // Where nearly every point is a move (Go, Gomoku, Hex) the marks stay lighter, so the board still shows;
  // the one under the pointer comes up in full.
  const tone = P.ringTone ? P.ringTone(m) : 'gold', soft = !!P.ringOpacity;
  const mat = new THREE.MeshBasicMaterial({ color: RING_COLOR[tone], transparent: true, opacity: soft ? P.ringOpacity + 0.2 : 0.95, depthWrite: false });
  const ring = markMesh(ringGeo, mat, soft ? null : tone, soft);
  ring.userData.op = soft ? P.ringOpacity + 0.2 : 0.85;
  ring.position.copy(at); ring.position.y += 0.004;
  ring.userData.move = m; ring.userData.base = P.ringScale || 1;
  ring.add(new THREE.Mesh(ringHitGeo, MAT.hit));
  play.ex.group.add(ring); play.rings.push(ring);
}
function highlight(moves) {
  clearHighlights();
  const P = play.P;
  play.byMesh = new Map();
  for (const m of moves) for (const ms of P.meshesFor(m)) {
    if (!ms) continue;
    if (!play.byMesh.has(ms)) play.byMesh.set(ms, []);
    play.byMesh.get(ms).push(m);
  }
  play.twoStep = [...play.byMesh.values()].some(a => a.length > 1);
  play.byMesh.forEach((_, ms) => { play.glowing.add(ms); addHalo(ms); });
  for (const m of moves) if (!play.twoStep || !P.meshesFor(m).some(Boolean)) addRing(m);
  if (play.twoStep && play.byMesh.size === 1) select([...play.byMesh.keys()][0]);
}
function dropRings(keep) {
  play.rings = play.rings.filter(r => { if (keep(r)) return true; r.parent && r.parent.remove(r); r.material.dispose(); return false; });
}
function select(mesh) {
  const P = play.P;
  dropRings(r => !P.meshesFor(r.userData.move).some(Boolean));
  if (play.selected === mesh) { play.selected = null; return; }
  play.selected = mesh;
  play.byMesh.get(mesh).forEach(addRing);
}
// A ring at the foot of every piece you can move: the warm glow alone hardly shows on a pale piece.
function addHalo(ms) {
  if (!play.ex || play.halos.has(ms)) return;
  const box = new THREE.Box3().setFromObject(ms); if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  if (size.y > Math.max(size.x, size.z) * 1.6 && size.y > 0.08) return; // a card or tile held upright: its glow and lift say enough
  const foot = play.ex.group.worldToLocal(new THREE.Vector3(mid.x, box.min.y, mid.z));
  const halo = markMesh(ringGeo, new THREE.MeshBasicMaterial({ color: RING_COLOR.gold, transparent: true, opacity: 0.9, depthWrite: false }));
  halo.position.copy(foot); halo.position.y += 0.002;
  const r = Math.min(0.09, Math.max(0.022, Math.max(size.x, size.z) / 2 * 1.12));
  halo.userData.base = r / 0.05; halo.scale.setScalar(halo.userData.base);
  play.ex.group.add(halo); play.halos.set(ms, halo);
}
function clearHighlights() {
  dropRings(() => false);
  play.halos.forEach(h => { h.parent && h.parent.remove(h); h.material.dispose(); }); play.halos.clear();
  play.glowing.forEach(ms => glowMats(ms).forEach(x => x.emissive.setRGB(0, 0, 0)));
  play.glowing.clear(); play.byMesh = new Map(); play.selected = null; play.hover = null; play.hintMove = null;
}

