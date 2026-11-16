/* --- Wing IV: the card room. Two tables (Scopa and Bézique) and two displays (court cards, and cards put to
 * other uses). Every face is our own drawing in an old style, not a copy of a real pack. */
function cardTable(group, cloth, W = 1.2, D = 0.86) {
  const table = new THREE.Mesh(new THREE.BoxGeometry(W, 0.03, D), new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.5 }));
  table.position.y = TOP + 0.015; group.add(table);
  topPlane(group, W - 0.06, D - 0.06, TOP + 0.0305, tex(512, 384, (g, w, h) => {
    g.fillStyle = cloth[0]; g.fillRect(0, 0, w, h); speckle(g, w, h, 4500, cloth.slice(1), 1.2);
    g.strokeStyle = 'rgba(220,200,140,.35)'; g.lineWidth = 3; g.strokeRect(14, 14, w - 28, h - 28);
  }), { roughness: 0.95 });
  return TOP + 0.031;
}
function buildScopa(group) {
  const y = cardTable(group, ['#24426a', '#1d3858', '#2c4c78', '#1a3352']), shown = [];
  const put = (c, x, z, ry, down) => { const m = crCard(c, c, 'latin'); m.position.set(x, y + 0.001 + shown.length * 0.0002, z); m.rotation.set(0, ry, down ? Math.PI : 0); group.add(m); shown.push(m); return m; };
  // Four open cards, with the settebello among them; three cards to each hand; the stock; a scopa across a pile.
  [2 * 13 + 6, 0 * 13 + 3, 1 * 13 + 11, 3 * 13 + 1].forEach((c, i) => put(c, (i - 1.5) * 0.08, 0, (i - 1.5) * 0.04));
  for (let i = 0; i < 3; i++) { put(1 * 13 + i, (i - 1) * 0.075, 0.29, 0); put(0, (i - 1) * 0.05, -0.29, Math.PI, true); }
  for (let k = 0; k < 8; k++) put(3 * 13 + 2, -0.5, 0, Math.PI / 2, true);
  for (let k = 0; k < 5; k++) put(0 * 13 + 2, 0.46, 0.16, Math.PI / 2, true);
  put(1 * 13 + 4, 0.49, 0.18, Math.PI / 2 + 0.1);
  group.userData.display = shown;
  return y;
}
// A bézique marker: a little box with two dials, the way scores were kept.
function bzMarker(group, x, z, y) {
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.09), MAT.woodDark); box.position.set(x, y + 0.0125, z); group.add(box);
  const face = topPlane(group, 0.15, 0.08, y + 0.0255, tex(300, 160, (g, w, h) => {
    g.fillStyle = '#efe3c5'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a2a1a'; g.lineWidth = 3;
    for (const cx of [w * 0.27, w * 0.73]) {
      g.beginPath(); g.arc(cx, h / 2, 58, 0, TAU); g.stroke();
      g.fillStyle = '#3a2a1a'; g.font = '16px "Amethysta",Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU - Math.PI / 2; g.fillText(String(k), cx + Math.cos(a) * 44, h / 2 + Math.sin(a) * 44); }
      g.strokeStyle = '#8a1e14'; g.beginPath(); g.moveTo(cx, h / 2); g.lineTo(cx + Math.cos(k0(cx)) * 34, h / 2 + Math.sin(k0(cx)) * 34); g.stroke(); g.strokeStyle = '#3a2a1a';
    }
    function k0(cx) { return cx < w / 2 ? -1.1 : 0.7; }
  }), { roughness: 0.6 });
  return [box, face];
}
const BEZIQUE_FACE = b => window.LibrariumRules.bezique.face(b);
function buildBezique(group) {
  const y = cardTable(group, ['#6a1e1a', '#5a1814', '#7a2620', '#4e1410']), shown = [];
  const put = (b, x, z, ry, down) => { const m = crCard(BEZIQUE_FACE(b), b, 'french'); m.position.set(x, y + 0.001 + shown.length * 0.0002, z); m.rotation.set(0, ry, down ? Math.PI : 0); group.add(m); shown.push(m); return m; };
  // On display: bézique (queen of spades, jack of diamonds) and a royal marriage laid down, the stock with hearts turned up.
  [0 * 8 + 4, 2 * 8 + 3].forEach((b, i) => put(b, -0.1 + i * 0.062, 0.14, 0));
  [1 * 8 + 5, 1 * 8 + 4].forEach((b, i) => put(b, 0.1 + i * 0.062, 0.14, 0));
  for (let i = 0; i < 6; i++) put(3 * 8 + i, (i - 2.5) * 0.065, 0.3, 0);
  for (let i = 0; i < 8; i++) put(0, (i - 3.5) * 0.045, -0.3, Math.PI, true);
  for (let k = 0; k < 10; k++) put(0, -0.52, -0.02, Math.PI / 2, true);
  put(1 * 8 + 6, -0.47, 0.02, Math.PI / 2);
  shown.push(...bzMarker(group, 0.4, -0.15, y));
  group.userData.display = shown;
  return y;
}
// The court card easel: one figure from each tradition, and how they changed.
function buildCourtCards(group) {
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 0.62), new THREE.MeshLambertMaterial({ color: 0x2a1a10 }));
  stand.position.y = TOP + 0.02; group.add(stand);
  const easel = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.26, 0.02), MAT.woodDark); easel.position.set(0, TOP + 0.15, -0.1); easel.rotation.x = -0.25; group.add(easel);
  const big = (draw, under) => cardTex((g, w, h) => {
    g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, w, h); speckle(g, w, h, 300, ['#dccca4'], 1.2);
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    draw(g, w, h);
    if (under) { g.fillStyle = '#2a1a0c'; g.font = '600 22px "Almendra SC",Georgia,serif'; g.textAlign = 'center'; g.fillText(under, w / 2, h - 24); }
  }, 200, 320);
  const figure = (g, w, h, kind, k, style, dy = 0) => { g.save(); g.translate(w / 2, h / 2 + dy); g.scale(1.45, 1.45); g.translate(-70, -105); packCourt(g, 140, 210, kind, k, style); g.restore(); };
  const cards = [
    big((g, w, h) => { figure(g, w, h, 'spade', 2, 'french', 6); g.fillStyle = '#1c1c1c'; g.font = '600 24px "Almendra SC",Georgia,serif'; g.textAlign = 'center'; g.fillText('DAVID', w / 2, 40); }, 'Rouen, c. 1565'),
    big((g, w, h) => { // the king of hearts with his sword behind his head
      g.save(); g.strokeStyle = '#8a8a90'; g.lineWidth = 7; g.beginPath(); g.moveTo(w * 0.22, h * 0.68); g.lineTo(w * 0.72, h * 0.16); g.stroke();
      g.strokeStyle = '#c8901e'; g.lineWidth = 6; g.beginPath(); g.moveTo(w * 0.18, h * 0.6); g.lineTo(w * 0.3, h * 0.74); g.stroke(); g.restore();
      figure(g, w, h, 'heart', 2, 'french', 10);
    }, 'English, 18th c.'),
    big((g, w, h) => figure(g, w, h, 'acorn', 1, 'german', 4), 'German Ober'),
    big((g, w, h) => figure(g, w, h, 'coin', 2, 'latin', 4), 'Italian re'),
    big((g, w, h) => { // a double-ended queen: the figure cut at the waist and mirrored
      g.save(); g.beginPath(); g.rect(0, 0, w, h / 2); g.clip(); figure(g, w, h, 'diamond', 1, 'french', -46); g.restore();
      g.save(); g.translate(w, h); g.rotate(Math.PI); g.beginPath(); g.rect(0, 0, w, h / 2); g.clip(); figure(g, w, h, 'diamond', 1, 'french', -46); g.restore();
      g.strokeStyle = 'rgba(58,42,26,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(30, h / 2); g.lineTo(w - 30, h / 2); g.stroke();
    }, ''),
  ];
  cards.forEach((map, k) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.208, 0.003), [MAT.woodDark, MAT.woodDark, MAT.woodDark, MAT.woodDark, new THREE.MeshStandardMaterial({ map, roughness: 0.55 }), MAT.woodDark]);
    m.position.set(-0.46 + k * 0.23, TOP + 0.17, -0.08); m.rotation.x = -0.25; m.rotation.z = rand(-0.03, 0.03); group.add(m);
  });
  // A small fan of ordinary courts in front, in all four packs.
  ['french', 'german', 'swiss', 'latin'].forEach((st, k) => { const m = crCard(12 + k * 13 - 1, 0, st); m.position.set(-0.27 + k * 0.18, TOP + 0.042, 0.17); m.rotation.y = (k - 1.5) * 0.08; group.add(m); });
  glassCase(group, 1.3, 0.42, 0.72);
  return TOP + 0.041;
}
// Cards that were never played with: money, a reply, an admission ticket, a note, an invitation.
function buildNotForPlay(group) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 0.78), new THREE.MeshLambertMaterial({ color: 0x2a0c10 }));
  base.position.y = TOP + 0.02; group.add(base);
  const y0 = TOP + 0.042;
  // A sloped board covered in dark cloth, so the cards stand up to be read.
  const board = new THREE.Group(); board.position.set(0, TOP + 0.2, -0.05); board.rotation.x = -0.5; group.add(board);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.34, 0.02), new THREE.MeshStandardMaterial({ color: 0x3a0f14, roughness: 0.95 })); board.add(cloth);
  const back = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8 });
  let slot = 0;
  const lay = (map, _x, _z, rot) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.235, 0.002), [back, back, back, back, new THREE.MeshStandardMaterial({ map, roughness: 0.75 }), back]); m.position.set(-0.46 + slot++ * 0.23, 0, 0.012); m.rotation.z = rot * 0.4; board.add(m); return m; };
  const paper = (g, w, h, tint = '#efe3c5', dirt = 0) => { g.fillStyle = tint; g.fillRect(0, 0, w, h); speckle(g, w, h, 500 + dirt * 1500, ['#cdb98c', '#bba67a'], 1.4); if (dirt) { g.fillStyle = 'rgba(90,70,40,.18)'; g.beginPath(); g.ellipse(w * 0.7, h * 0.3, 60, 40, 0.5, 0, TAU); g.fill(); } };
  const hand = (g, lines, x, y, size = 20, rot = 0) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = '#2a1e14'; g.font = `italic ${size}px Georgia,serif`; g.textAlign = 'center'; lines.forEach((t, i) => g.fillText(t, 0, i * size * 1.3)); g.restore(); };
  // Card money, New France: the blank back of a playing card, a value, a stamp and three signatures.
  lay(cardTex((g, w, h) => {
    paper(g, w, h);
    hand(g, ['Quatre', 'Livres'], w / 2, 90, 28);
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, 190, 26, 0, TAU); g.stroke();
    g.fillStyle = '#3a2a1a'; g.font = '34px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⚜', w / 2, 192);
    hand(g, ['de Meulles'], w / 2, 260, 18, -0.08); hand(g, ['~ ~ ~'], w * 0.3, 290, 16); hand(g, ['~ ~'], w * 0.72, 292, 16);
    g.fillStyle = '#1e2a3a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(26, 0); g.lineTo(0, 26); g.fill(); g.beginPath(); g.moveTo(w, h); g.lineTo(w - 26, h); g.lineTo(w, h - 26); g.fill(); // clipped corners
  }), -0.44, -0.1, 0.12, 1.05);
  // Grace's card: a six of hearts carrying the reply to an ultimatum.
  lay(cardTex((g, w, h) => {
    paper(g, w, h, '#f4ecd8', 1);
    g.fillStyle = '#b3261e'; g.font = '44px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 6; i++) g.fillText('♥', w / 2 + (i % 2 ? 40 : -40), 70 + Math.floor(i / 2) * 90);
    hand(g, ['Tell your master', 'I despise', 'his offer'], w / 2, 130, 19, -0.12);
  }), -0.2, 0.14, -0.1);
  // A ticket to lectures in Philadelphia, written on the back of a card.
  lay(cardTex((g, w, h) => { paper(g, w, h); hand(g, ['Admit', 'Mr. ——', 'to the', 'Lectures', '1765'], w / 2, 70, 21); }), 0.04, -0.12, 0.06);
  // Voltaire's calling note on a soiled card.
  lay(cardTex((g, w, h) => { paper(g, w, h, '#e9dcbc', 2); hand(g, ['M. de Voltaire', 'est venu', 'quatre fois'], w / 2, 120, 21, -0.05); }), 0.27, 0.13, -0.16);
  // An invitation to a ball, on the plain back of another.
  lay(cardTex((g, w, h) => { paper(g, w, h, '#f2e8d2'); g.strokeStyle = '#8a6a2a'; g.lineWidth = 3; g.strokeRect(20, 20, w - 40, h - 40); hand(g, ['The favour of', 'your Company', 'is desired', 'at a Ball'], w / 2, 100, 20); }), 0.47, -0.1, 0.18);
  glassCase(group, 1.3, 0.42, 0.85);
  return y0;
}

// Euchre: on display, the Joker (the Best Bower) with the right and left bowers, and a hand laid out.
function buildEuchre(group) {
  const y = cardTable(group, ['#2a4a2c', '#244024', '#305434', '#1f3a20']), shown = [];
  const put = (c, x, z, ry, down) => { const m = crCard(c, c, 'french'); m.position.set(x, y + 0.001 + shown.length * 0.0002, z); m.rotation.set(0, ry, down ? Math.PI : 0); group.add(m); shown.push(m); return m; };
  [52, 1 * 13 + 10, 2 * 13 + 10].forEach((c, i) => put(c, (i - 1) * 0.085, 0.02, (i - 1) * -0.12)); // Joker, jack of hearts, jack of diamonds
  [1 * 13 + 0, 1 * 13 + 12, 3 * 13 + 0, 0 * 13 + 9, 1 * 13 + 8].forEach((c, i) => put(c, (i - 2) * 0.07, 0.29, 0));
  for (let s = 1; s < 4; s++) for (let i = 0; i < 5; i++) { const at = wsHandSpot(s, i, 5, y); put(0, at.x, at.z, WS_YAW[s], true); }
  for (let k = 0; k < 3; k++) put(0, -0.3, -0.02, Math.PI / 2, true);
  group.userData.display = shown;
  return y;
}
// Patience: a Klondike game in progress, laid out on green baize.
function buildPatience(group) {
  const y = cardTable(group, ['#1f4a32', '#1a422c', '#24523a', '#173a26']), shown = [];
  const put = (c, x, z, down) => { const m = crCard(c, c, 'french'); m.scale.set(1.22, 1, 1.22); m.position.set(x, y + 0.001 + shown.length * 0.0001, z); m.rotation.set(0, 0, down ? Math.PI : 0); group.add(m); shown.push(m); return m; };
  const cols = [[39 + 12], [0, 1 * 13 + 11], [0, 0, 2 * 13 + 6, 3 * 13 + 5], [0, 0, 0, 13 + 9], [0, 0, 0, 0, 12], [0, 0, 0, 0, 0, 26 + 3, 2], [0, 0, 0, 0, 0, 0, 13 + 7, 6]];
  cols.forEach((col, i) => col.forEach((c, j) => { const down = c === 0 && j < col.length - 1; put(down ? 0 : c, (i - 3) * 0.1, -0.17 + j * 0.026, down); }));
  for (let k = 0; k < 8; k++) put(0, -0.3, -0.31, true);
  put(3 * 13 + 3, -0.2, -0.31, false);
  [0, 13, 26 + 1].forEach((c, s) => put(c, s * 0.1, -0.31, false));
  group.userData.display = shown;
  return y;
}
/* Ganjifa: round, hand-painted cards. A Mughal pack's eight suits, each with its own ground colour, shown with
 * numerals and its two court cards, the mir (king) and the wazir (minister); and two Dashavatara cards. Our own
 * paintings after the style, not copies of any pack. */
const GJ_SUITS = [
  { name: 'Slaves', ground: '#c9a33a', ink: '#3a1e0a' }, { name: 'Crowns', ground: '#7a2a1e', ink: '#f2d27a' },
  { name: 'Swords', ground: '#2a3a5a', ink: '#e8e0c8' }, { name: 'Red gold', ground: '#9a1e1a', ink: '#f6c04a' },
  { name: 'Harps', ground: '#2f5a3a', ink: '#f2e2b0' }, { name: 'Bills', ground: '#d9c79a', ink: '#5a2a10' },
  { name: 'White gold', ground: '#5a4a6a', ink: '#ece8f2' }, { name: 'Cloth', ground: '#a8501e', ink: '#fbe7c0' },
];
function gjSign(g, k, x, y, s, ink) {
  g.save(); g.translate(x, y); g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = Math.max(1.5, s * 0.08);
  switch (k) {
    case 0: g.beginPath(); g.arc(0, -s * 0.28, s * 0.16, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-s * 0.26, s * 0.4); g.lineTo(0, -s * 0.1); g.lineTo(s * 0.26, s * 0.4); g.closePath(); g.fill(); break; // a figure
    case 1: g.beginPath(); g.moveTo(-s * 0.36, s * 0.24); g.lineTo(-s * 0.36, -s * 0.12); g.lineTo(-s * 0.18, s * 0.04); g.lineTo(0, -s * 0.32); g.lineTo(s * 0.18, s * 0.04); g.lineTo(s * 0.36, -s * 0.12); g.lineTo(s * 0.36, s * 0.24); g.closePath(); g.fill(); break; // a crown
    case 2: g.beginPath(); g.moveTo(-s * 0.3, s * 0.36); g.quadraticCurveTo(s * 0.1, s * 0.1, s * 0.34, -s * 0.38); g.stroke(); g.beginPath(); g.moveTo(-s * 0.36, s * 0.18); g.lineTo(-s * 0.1, s * 0.44); g.stroke(); break; // a curved sword
    case 3: case 6: g.beginPath(); g.arc(0, 0, s * 0.34, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(0, 0, s * 0.2, 0, TAU); g.stroke(); break; // a coin
    case 4: g.beginPath(); g.moveTo(-s * 0.26, s * 0.36); g.quadraticCurveTo(-s * 0.36, -s * 0.36, s * 0.26, -s * 0.36); g.lineTo(s * 0.26, s * 0.36); g.closePath(); g.stroke(); for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-s * 0.2 + i * 0.1 * s, -s * 0.2); g.lineTo(-s * 0.2 + i * 0.1 * s, s * 0.36); g.stroke(); } break; // a harp
    case 5: g.fillRect(-s * 0.26, -s * 0.34, s * 0.52, s * 0.62); g.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < 4; i++) g.fillRect(-s * 0.18, -s * 0.22 + i * s * 0.13, s * 0.36, s * 0.04); break; // a written bill
    case 7: g.beginPath(); g.ellipse(0, 0, s * 0.36, s * 0.2, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(-s * 0.22, 0, s * 0.08, s * 0.18, 0, 0, TAU); g.fill(); break; // a bolt of cloth
  }
  g.restore();
}
function gjFace(k, n) { // n: 1-10, or 11 the wazir, 12 the mir
  const S = GJ_SUITS[k];
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#1a120a'; g.fillRect(0, 0, w, h);
    g.fillStyle = S.ground; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, TAU); g.fill();
    g.strokeStyle = '#e8c45a'; g.lineWidth = 5; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 12, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 20, 0, TAU); g.stroke();
    if (n <= 10) {
      for (let i = 0; i < n; i++) { const a = i / n * TAU - Math.PI / 2, r = n === 1 ? 0 : 70; gjSign(g, k, w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, n === 1 ? 110 : 44, S.ink); }
    } else { // a court card: a seated figure under a canopy, the suit's sign beside him
      g.fillStyle = S.ink; g.beginPath(); g.moveTo(w * 0.28, h * 0.36); g.quadraticCurveTo(w / 2, h * 0.16, w * 0.72, h * 0.36); g.lineTo(w * 0.72, h * 0.4); g.lineTo(w * 0.28, h * 0.4); g.fill();
      g.fillStyle = '#ecd2ae'; g.beginPath(); g.arc(w / 2, h * 0.5, 20, 0, TAU); g.fill();
      g.fillStyle = n === 12 ? '#e8c45a' : '#f2f0e6'; g.beginPath(); g.ellipse(w / 2, h * 0.43, 22, 12, 0, Math.PI, TAU); g.fill(); // turban
      g.fillStyle = S.ink; g.beginPath(); g.moveTo(w * 0.36, h * 0.78); g.quadraticCurveTo(w / 2, h * 0.52, w * 0.64, h * 0.78); g.closePath(); g.fill();
      gjSign(g, k, w * 0.74, h * 0.62, 48, S.ink);
      if (n === 12) { g.fillStyle = '#e8c45a'; g.beginPath(); g.arc(w / 2, h * 0.5, 34, Math.PI * 1.1, Math.PI * 1.9); g.lineWidth = 4; g.strokeStyle = '#e8c45a'; g.stroke(); } // the mir's halo
    }
  });
}
function gjAvatar(kind) { // two Dashavatara suits: the fish (Matsya) and the tortoise (Kurma)
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#1a120a'; g.fillRect(0, 0, w, h);
    g.fillStyle = kind ? '#2a5a6a' : '#1e3a6a'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, TAU); g.fill();
    g.strokeStyle = '#e8c45a'; g.lineWidth = 5; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 12, 0, TAU); g.stroke();
    g.fillStyle = '#e8b83a'; g.strokeStyle = '#3a1e0a'; g.lineWidth = 3;
    if (!kind) { g.beginPath(); g.ellipse(w / 2 - 10, h / 2, 70, 34, 0, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.moveTo(w / 2 + 56, h / 2); g.lineTo(w / 2 + 96, h / 2 - 34); g.lineTo(w / 2 + 96, h / 2 + 34); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#1a120a'; g.beginPath(); g.arc(w / 2 - 50, h / 2 - 8, 6, 0, TAU); g.fill(); }
    else { g.beginPath(); g.ellipse(w / 2, h / 2, 64, 48, 0, 0, TAU); g.fill(); g.stroke(); g.strokeStyle = 'rgba(58,30,10,.6)'; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(w / 2 + i * 30, h / 2 - 44); g.lineTo(w / 2 + i * 30, h / 2 + 44); g.stroke(); } g.fillStyle = '#e8b83a'; g.beginPath(); g.arc(w / 2 + 80, h / 2, 16, 0, TAU); g.fill(); }
  });
}
function buildGanjifa(group) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 0.78), new THREE.MeshLambertMaterial({ color: 0x3a1410 }));
  base.position.y = TOP + 0.02; group.add(base);
  const y0 = TOP + 0.041, edge = new THREE.MeshStandardMaterial({ color: 0x2a1a0c, roughness: 0.4 });
  const disc = (map, x, z, r = 0.05) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.003, 40), [edge, new THREE.MeshStandardMaterial({ map, roughness: 0.35, metalness: 0.05 }), edge]); m.position.set(x, y0 + 0.0015, z); m.rotation.y = rand(-0.4, 0.4); group.add(m); return m; };
  // Each suit: its mir, its wazir and one numeral, in two rows across the cloth.
  GJ_SUITS.forEach((S, k) => {
    const x = -0.49 + (k % 4) * 0.33, z = k < 4 ? -0.2 : 0.06;
    disc(gjFace(k, 12), x, z); disc(gjFace(k, 11), x + 0.105, z); disc(gjFace(k, [1, 3, 5, 7, 9, 4, 6, 10][k]), x + 0.21, z);
  });
  disc(gjAvatar(0), -0.1, 0.28, 0.06); disc(gjAvatar(1), 0.1, 0.28, 0.06);
  // A lacquered box for the pack, its lid propped open.
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), new THREE.MeshStandardMaterial({ color: 0x6a1a10, roughness: 0.35 })); box.position.set(0.44, y0 + 0.03, 0.29); group.add(box);
  glassCase(group, 1.3, 0.3, 0.85);
  return y0;
}
