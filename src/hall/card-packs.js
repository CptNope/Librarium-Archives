/* --- Pack styles. Every card table numbers its cards the same way (suit * 13 + rank, rank 0 the ace), so one
 * painter can draw any card in any of the four suit systems that spread across Europe: French (spades, hearts,
 * diamonds, clubs), German (leaves, hearts, bells, acorns), Swiss (shields, roses, bells, acorns) and Latin
 * (swords, cups, coins, batons). Suit k of one system stands for suit k of every other, as players matched them.
 * All the faces are our own drawings in the old styles. */
const PACK_STYLES = ['french', 'german', 'swiss', 'latin'];
const PACK_LABEL = { french: 'French', german: 'German', swiss: 'Swiss', latin: 'Latin' };
const PACK_SUITS = { french: ['spade', 'heart', 'diamond', 'club'], german: ['leaf', 'gheart', 'bell', 'acorn'], swiss: ['shield', 'rose', 'bell', 'acorn'], latin: ['sword', 'cup', 'coin', 'baton'] };
// The court cards' letters: French jack, queen, king; German and Swiss Unter, Ober, king; Italian fante, cavallo, re.
const PACK_COURT = { french: ['J', 'Q', 'K'], german: ['U', 'O', 'K'], swiss: ['U', 'O', 'K'], latin: ['F', 'C', 'R'] };
// The words a game's messages use, so a change of pack changes the names too.
const PACK_WORDS = {
  french: { suits: ['spades', 'hearts', 'diamonds', 'clubs'], courts: [['jack', 'jacks'], ['queen', 'queens'], ['king', 'kings']] },
  german: { suits: ['leaves', 'hearts', 'bells', 'acorns'], courts: [['Unter', 'Unters'], ['Ober', 'Obers'], ['king', 'kings']] },
  swiss: { suits: ['shields', 'roses', 'bells', 'acorns'], courts: [['Under', 'Unders'], ['Ober', 'Obers'], ['king', 'kings']] },
  latin: { suits: ['swords', 'cups', 'coins', 'batons'], courts: [['knave', 'knaves'], ['knight', 'knights'], ['king', 'kings']] },
};
// The tables that offer the switch, and the pack each game is played with by default.
const PACK_TABLES = { piquet: 'french', whist: 'french', cribbage: 'french', bezique: 'french', scopa: 'latin', euchre: 'french', karnoffel: 'german', ombre: 'french', conquian: 'french', cassino: 'french', hearts: 'french', pinochle: 'french', skat: 'french' };
let packNow = 'french';
const packFor = g => (PACK_TABLES[g.id] ? ((store.packs || {})[g.id] || PACK_TABLES[g.id]) : 'french');
function packText(text, from, to) {
  if (!text || from === to) return text;
  const A = PACK_WORDS[from], B = PACK_WORDS[to], map = new Map();
  A.suits.forEach((w, k) => map.set(w, B.suits[k]));
  A.courts.forEach((pair, k) => pair.forEach((w, j) => map.set(w.toLowerCase(), B.courts[k][j])));
  const re = new RegExp('\\b(' + [...map.keys()].join('|') + ')\\b', 'gi');
  return text.replace(re, w => { const out = map.get(w.toLowerCase()); return /^[A-Z]/.test(w) && /^[a-z]/.test(out) ? out[0].toUpperCase() + out.slice(1) : out; });
}
// A message from the game in hand, in the words of the pack on the table.
const asPack = t => (mode === 'play' && play.game && PACK_TABLES[play.game.id] ? packText(t, PACK_TABLES[play.game.id], packNow) : t);

const PACK_COL = { spade: '#1c1c1c', club: '#1c1c1c', heart: '#b3261e', diamond: '#b3261e', leaf: '#2f6b2a', gheart: '#b3261e', bell: '#c8901e', acorn: '#7a4a1e', shield: '#b3261e', rose: '#b3261e', sword: '#2a4a7a', cup: '#a3301e', coin: '#c48a1e', baton: '#3a6a2a' };
function packMark(g, kind, x, y, s) {
  const col = PACK_COL[kind], ink = 'rgba(30,18,8,.85)';
  g.save(); g.translate(x, y); g.fillStyle = col; g.strokeStyle = ink; g.lineWidth = Math.max(1, s * 0.06); g.lineJoin = 'round';
  const heart = () => { g.beginPath(); g.moveTo(0, s * 0.42); g.bezierCurveTo(-s * 0.62, -s * 0.02, -s * 0.36, -s * 0.52, 0, -s * 0.2); g.bezierCurveTo(s * 0.36, -s * 0.52, s * 0.62, -s * 0.02, 0, s * 0.42); g.closePath(); };
  switch (kind) {
    case 'spade': case 'heart': case 'diamond': case 'club':
      g.font = `${Math.round(s * 1.1)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText({ spade: '♠', heart: '♥', diamond: '♦', club: '♣' }[kind], 0, s * 0.05); break;
    case 'leaf': // a linden leaf, stalk down
      g.beginPath(); g.moveTo(0, s * 0.3); g.bezierCurveTo(-s * 0.62, s * 0.05, -s * 0.4, -s * 0.5, 0, -s * 0.5); g.bezierCurveTo(s * 0.4, -s * 0.5, s * 0.62, s * 0.05, 0, s * 0.3); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, s * 0.3); g.lineTo(0, s * 0.52); g.moveTo(0, s * 0.2); g.lineTo(0, -s * 0.36); g.stroke(); break;
    case 'gheart': heart(); g.fill(); g.stroke(); break; // the German heart, drawn rather than printed
    case 'bell': // a sleigh bell: a ball with a slot and a loop
      g.beginPath(); g.arc(0, s * 0.04, s * 0.38, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-s * 0.3, s * 0.06); g.lineTo(s * 0.3, s * 0.06); g.stroke();
      g.beginPath(); g.arc(0, s * 0.24, s * 0.06, 0, TAU); g.fillStyle = ink; g.fill();
      g.beginPath(); g.arc(0, -s * 0.4, s * 0.09, 0, TAU); g.stroke(); break;
    case 'acorn':
      g.beginPath(); g.ellipse(0, s * 0.1, s * 0.24, s * 0.34, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#4a2a10'; g.beginPath(); g.ellipse(0, -s * 0.16, s * 0.3, s * 0.16, 0, Math.PI, TAU); g.lineTo(s * 0.3, -s * 0.12); g.lineTo(-s * 0.3, -s * 0.12); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, -s * 0.3); g.lineTo(s * 0.06, -s * 0.48); g.stroke(); break;
    case 'shield': // a heater shield, quartered
      g.beginPath(); g.moveTo(-s * 0.36, -s * 0.42); g.lineTo(s * 0.36, -s * 0.42); g.lineTo(s * 0.36, 0); g.quadraticCurveTo(s * 0.32, s * 0.36, 0, s * 0.5); g.quadraticCurveTo(-s * 0.32, s * 0.36, -s * 0.36, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e8c45a'; g.fillRect(-s * 0.36, -s * 0.12, s * 0.72, s * 0.14); g.strokeRect(-s * 0.36, -s * 0.12, s * 0.72, s * 0.14); break;
    case 'rose':
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU - Math.PI / 2; g.beginPath(); g.arc(Math.cos(a) * s * 0.22, Math.sin(a) * s * 0.22, s * 0.2, 0, TAU); g.fill(); g.stroke(); }
      g.fillStyle = '#e8c45a'; g.beginPath(); g.arc(0, 0, s * 0.13, 0, TAU); g.fill(); g.stroke(); break;
    case 'sword':
      g.strokeStyle = col; g.lineWidth = s * 0.1; g.beginPath(); g.moveTo(0, -s * 0.52); g.lineTo(0, s * 0.3); g.stroke();
      g.strokeStyle = '#c8901e'; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(-s * 0.24, s * 0.26); g.lineTo(s * 0.24, s * 0.26); g.moveTo(0, s * 0.3); g.lineTo(0, s * 0.48); g.stroke(); break;
    case 'cup':
      g.beginPath(); g.moveTo(-s * 0.34, -s * 0.4); g.quadraticCurveTo(-s * 0.3, s * 0.06, 0, s * 0.08); g.quadraticCurveTo(s * 0.3, s * 0.06, s * 0.34, -s * 0.4); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#c8901e'; g.fillRect(-s * 0.05, s * 0.08, s * 0.1, s * 0.28); g.beginPath(); g.ellipse(0, s * 0.4, s * 0.24, s * 0.07, 0, 0, TAU); g.fill(); g.stroke(); break;
    case 'coin':
      g.beginPath(); g.arc(0, 0, s * 0.42, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(90,50,10,.8)'; g.beginPath(); g.arc(0, 0, s * 0.26, 0, TAU); g.stroke();
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * s * 0.1, Math.sin(a) * s * 0.1); g.lineTo(Math.cos(a) * s * 0.24, Math.sin(a) * s * 0.24); g.stroke(); } break;
    case 'baton':
      g.rotate(-0.5); g.beginPath(); g.moveTo(-s * 0.08, s * 0.5); g.lineTo(s * 0.08, s * 0.5); g.lineTo(s * 0.13, -s * 0.5); g.lineTo(-s * 0.13, -s * 0.5); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#c8901e'; for (const t of [-0.25, 0.05, 0.32]) { g.beginPath(); g.ellipse(0, s * t, s * 0.12, s * 0.04, 0, 0, TAU); g.fill(); } break;
  }
  g.restore();
}
// A court figure, shoulders up: the crown, hat or cap tells king, queen or Ober, and jack, Unter or fante apart.
function packCourt(g, w, h, kind, k, style) {
  const col = PACK_COL[kind], cx = w / 2, cy = h * 0.54;
  g.save();
  g.fillStyle = col; g.strokeStyle = 'rgba(30,18,8,.85)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - 40, cy + 62); g.quadraticCurveTo(cx - 38, cy + 6, cx, cy + 4); g.quadraticCurveTo(cx + 38, cy + 6, cx + 40, cy + 62); g.closePath(); g.fill(); g.stroke(); // robe
  g.fillStyle = '#e8c45a'; g.fillRect(cx - 4, cy + 8, 8, 52); // its border
  g.fillStyle = '#ecd2ae'; g.beginPath(); g.arc(cx, cy - 16, 18, 0, TAU); g.fill(); g.stroke(); // face
  g.fillStyle = '#1c1c1c'; g.beginPath(); g.arc(cx - 6, cy - 18, 1.8, 0, TAU); g.arc(cx + 6, cy - 18, 1.8, 0, TAU); g.fill();
  if (k === 2 || (k === 1 && style === 'latin')) { g.fillStyle = '#5a3a1a'; g.beginPath(); g.moveTo(cx - 12, cy - 4); g.quadraticCurveTo(cx, cy + 14, cx + 12, cy - 4); g.fill(); } // a beard for kings and the cavallo
  if (k === 2) { // a crown
    g.fillStyle = '#e8b83a'; g.beginPath(); g.moveTo(cx - 19, cy - 30); for (let i = 0; i <= 4; i++) { g.lineTo(cx - 19 + i * 9.5, cy - (i % 2 ? 40 : 52)); } g.lineTo(cx + 19, cy - 30); g.closePath(); g.fill(); g.stroke();
  } else if (k === 1 && style === 'french') { // a queen's veil and circlet
    g.fillStyle = 'rgba(240,232,214,.95)'; g.beginPath(); g.moveTo(cx - 22, cy - 22); g.quadraticCurveTo(cx, cy - 50, cx + 22, cy - 22); g.lineTo(cx + 26, cy + 8); g.lineTo(cx + 18, cy - 14); g.quadraticCurveTo(cx, cy - 38, cx - 18, cy - 14); g.lineTo(cx - 26, cy + 8); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e8b83a'; g.fillRect(cx - 14, cy - 36, 28, 5);
  } else if (k === 1) { // the Ober or the cavallo: a broad hat with a feather
    g.fillStyle = col; g.beginPath(); g.ellipse(cx, cy - 32, 28, 7, 0, 0, TAU); g.fill(); g.stroke(); g.fillRect(cx - 14, cy - 46, 28, 14);
    g.strokeStyle = '#e8e0c8'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx + 10, cy - 44); g.quadraticCurveTo(cx + 30, cy - 66, cx + 40, cy - 46); g.stroke();
  } else { // the jack, Unter or fante: a soft cap
    g.fillStyle = col; g.beginPath(); g.moveTo(cx - 20, cy - 26); g.quadraticCurveTo(cx - 6, cy - 54, cx + 24, cy - 36); g.lineTo(cx + 18, cy - 26); g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
  packMark(g, kind, cx + 30, cy + 24, 26); // the suit sign held at the shoulder
}
const crFaceCache = new Map();
// The Joker (card 52), the Best Bower of 1860s American euchre packs: a jester, the same in every pack.
function jokerFace() {
  return cardTex((g, w, h) => {
    g.fillStyle = '#f7f2e6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#8a1e14'; g.font = '700 15px "Montserrat",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    [...'JOKER'].forEach((ch, i) => { g.fillText(ch, 18, 22 + i * 16); g.save(); g.translate(w - 18, h - 22 - i * 16); g.rotate(Math.PI); g.fillText(ch, 0, 0); g.restore(); });
    const cx = w / 2, cy = h * 0.56;
    g.save(); g.strokeStyle = 'rgba(30,18,8,.85)'; g.lineWidth = 2;
    g.fillStyle = '#2a4a7a'; g.beginPath(); g.moveTo(cx - 38, cy + 64); g.quadraticCurveTo(cx - 36, cy + 4, cx, cy + 2); g.quadraticCurveTo(cx + 36, cy + 4, cx + 38, cy + 64); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#c8901e'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(cx - 26 + k * 13, cy + 8 + (k % 2) * 6, 6, 0, TAU); g.fill(); g.stroke(); } // the ruff
    g.fillStyle = '#ecd2ae'; g.beginPath(); g.arc(cx, cy - 16, 17, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#1c1c1c'; g.beginPath(); g.arc(cx - 6, cy - 18, 1.8, 0, TAU); g.arc(cx + 6, cy - 18, 1.8, 0, TAU); g.fill();
    g.beginPath(); g.arc(cx, cy - 12, 7, 0.2, Math.PI - 0.2); g.stroke(); // a grin
    // the fool's cap: two horns with bells
    g.fillStyle = '#b3261e'; g.beginPath(); g.moveTo(cx - 16, cy - 28); g.quadraticCurveTo(cx - 34, cy - 58, cx - 46, cy - 40); g.quadraticCurveTo(cx - 26, cy - 44, cx, cy - 34); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#2f6b2a'; g.beginPath(); g.moveTo(cx + 16, cy - 28); g.quadraticCurveTo(cx + 34, cy - 58, cx + 46, cy - 40); g.quadraticCurveTo(cx + 26, cy - 44, cx, cy - 34); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e8b83a'; for (const x of [-46, 46]) { g.beginPath(); g.arc(cx + x, cy - 40, 5, 0, TAU); g.fill(); g.stroke(); }
    g.restore();
  }, 140, 210);
}
function crFace(c, style = packNow) {
  const key = style + c;
  if (crFaceCache.has(key)) return crFaceCache.get(key);
  if (c === 52) { const j = jokerFace(); for (const st of PACK_STYLES) crFaceCache.set(st + c, j); return j; }
  const rk = c % 13, su = (c / 13) | 0, kind = PACK_SUITS[style][su], court = rk >= 10 ? rk - 10 : -1;
  const french = style === 'french', col = french ? (su === 1 || su === 2 ? '#b3261e' : '#1c1c1c') : '#2a1a0c';
  const label = court >= 0 ? PACK_COURT[style][court] : rk === 0 ? 'A' : String(rk + 1);
  const map = cardTex((g, w, h) => {
    g.fillStyle = french ? '#f7f2e6' : '#f2e8cf'; g.fillRect(0, 0, w, h);
    if (!french) speckle(g, w, h, 160, ['#d9c89e'], 1);
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.strokeRect(5, 5, w - 10, h - 10);
    const corner = () => { g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 30px "Montserrat",sans-serif'; g.fillText(label, 24, 26); packMark(g, kind, 24, 56, 24); };
    corner(); g.save(); g.translate(w, h); g.rotate(Math.PI); corner(); g.restore();
    if (court >= 0) packCourt(g, w, h, kind, court, style);
    else if (rk === 0) packMark(g, kind, w / 2, h / 2, french ? 84 : 70);
    else if (french) packMark(g, kind, w / 2, h / 2, 58);
    else { // the old pip cards: the suit sign repeated, in two columns
      const n = rk + 1, cols = n > 3 ? 2 : 1, rows = Math.ceil(n / cols), s = n > 8 ? 26 : n > 5 ? 30 : 36;
      for (let i = 0; i < n; i++) {
        const lastOdd = cols === 2 && n % 2 && i === n - 1, x = cols === 1 || lastOdd ? w / 2 : w / 2 + (i % 2 ? 24 : -24);
        const r = cols === 1 ? i : Math.floor(i / 2), y = 48 + (h - 96) * (rows === 1 ? 0.5 : r / (rows - 1));
        packMark(g, kind, x, y, s);
      }
    }
  }, 140, 210);
  crFaceCache.set(key, map); return map;
}
// Redraw every card on a table in another pack, in place.
function reskinCards(group, style) {
  group.traverse(o => { if (o.userData.face !== undefined && o.userData.mats && o.userData.mats[0]) { o.userData.mats[0].map = crFace(o.userData.face, style); o.userData.mats[0].needsUpdate = true; } });
}
