/* --- Tarocchi cards for the table: original faces in an old Italian manner */
const TC_W = 0.07, TC_H = 0.11;
const tcGeo = new THREE.BoxGeometry(TC_W, 0.0016, TC_H);
const tcEdgeMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.7 });
const TC_SUITS = ['coin', 'cup', 'sword', 'stick'];
const TC_SUIT_COL = { coin: '#c48a1e', cup: '#a3301e', sword: '#2a4a7a', stick: '#3a6a2a' };
const TC_TRUMPS = ['Il Bagatto', 'La Papessa', 'L\'Imperatrice', 'L\'Imperatore', 'Il Papa', 'Gli Amanti', 'Il Carro', 'La Giustizia', 'L\'Eremita', 'La Ruota', 'La Forza', 'L\'Appeso', 'La Morte', 'La Temperanza', 'Il Diavolo', 'La Torre', 'La Stella', 'La Luna', 'Il Sole', 'Il Giudizio', 'Il Mondo'];
const ROMAN = n => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'][n];
const tcBackMat = new THREE.MeshStandardMaterial({ roughness: 0.6, map: cardTex((g, w, h) => {
  g.fillStyle = '#6a1e14'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d9b04a'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  g.lineWidth = 2; g.strokeStyle = 'rgba(217,176,74,.6)';
  for (let k = -h; k < w + h; k += 22) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); }
}, 140, 220) });
const tcFaceCache = new Map();
function tcFace(c) {
  if (tcFaceCache.has(c)) return tcFaceCache.get(c);
  const T = window.LibrariumRules.tarocchi, su = T.suit(c), rk = T.rank(c);
  const map = cardTex((g, w, h) => {
    if (su === 4 || c === T.FOOL) {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ecd08a'); gr.addColorStop(1, '#c99a3e');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#6a4a14'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#3a2410'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '600 40px "Amethysta",Georgia,serif'; g.fillText(c === T.FOOL ? '0' : ROMAN(rk), w / 2, 42);
      // A simple emblem: a sun, a star or a circle, not a copy of any painted trump.
      g.strokeStyle = '#7a2a1c'; g.fillStyle = 'rgba(122,42,28,.15)'; g.lineWidth = 4;
      g.beginPath(); g.arc(w / 2, h * 0.52, 34, 0, TAU); g.fill(); g.stroke();
      for (let i = 0; i < (rk % 8) + 4; i++) { const a = i / ((rk % 8) + 4) * TAU; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 40, h * 0.52 + Math.sin(a) * 40); g.lineTo(w / 2 + Math.cos(a) * 52, h * 0.52 + Math.sin(a) * 52); g.stroke(); }
      g.font = '17px "Amethysta",Georgia,serif'; g.fillStyle = '#3a2410';
      g.fillText(c === T.FOOL ? 'Il Matto' : TC_TRUMPS[rk - 1], w / 2, h - 30, w - 20);
      return;
    }
    const suit = TC_SUITS[su], col = TC_SUIT_COL[suit];
    g.fillStyle = '#f2e8cf'; g.fillRect(0, 0, w, h); speckle(g, w, h, 200, ['#c9b68e'], 1.2);
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'top';
    const label = rk > 10 ? ['F', 'C', 'D', 'R'][rk - 11] : String(rk); // fante, cavallo, donna, re
    g.font = '700 30px "Montserrat",sans-serif'; g.fillText(label, 16, 14);
    if (rk > 10) {
      g.textAlign = 'center'; g.font = '600 26px "Amethysta",Georgia,serif';
      g.fillText(['Fante', 'Cavallo', 'Regina', 'Re'][rk - 11], w / 2, h - 52);
      suitMark(g, suit, w / 2, h * 0.45, 70, col);
      g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2 - 40, h * 0.2); g.lineTo(w / 2 - 22, h * 0.13); g.lineTo(w / 2, h * 0.19); g.lineTo(w / 2 + 22, h * 0.13); g.lineTo(w / 2 + 40, h * 0.2); g.stroke();
    } else {
      const cols = rk > 3 ? 2 : 1, rows = Math.ceil(rk / cols);
      for (let i = 0; i < rk; i++) {
        const cx = cols === 2 ? w / 2 + (i % 2 ? 30 : -30) : w / 2, ry = cols === 2 ? (i / 2) | 0 : i;
        suitMark(g, suit, cx, 70 + (ry + 0.5) * ((h - 100) / rows), Math.min(44, (h - 120) / rows), col);
      }
    }
  }, 140, 220);
  tcFaceCache.set(c, map); return map;
}
function tcCard(c) {
  const face = new THREE.MeshStandardMaterial({ map: tcFace(c), roughness: 0.55 });
  const m = new THREE.Mesh(tcGeo, [tcEdgeMat, tcEdgeMat, face, tcBackMat, tcEdgeMat, tcEdgeMat]);
  m.userData.mats = [face]; // only this card's face glows, not the backs it shares with others
  return m;
}

