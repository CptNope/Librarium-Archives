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
  const velvet = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 0.78), new THREE.MeshLambertMaterial({ color: 0x1e2a3a }));
  velvet.position.y = TOP + 0.02; group.add(velvet);
  const y0 = TOP + 0.042;
  const back = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.8 });
  const lay = (map, x, z, rot, s = 1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.002, 0.17 * s), [back, back, new THREE.MeshStandardMaterial({ map, roughness: 0.75 }), back, back, back]); m.position.set(x, y0 + Math.random() * 0.002, z); m.rotation.y = rot; group.add(m); return m; };
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
  glassCase(group, 1.3, 0.3, 0.85);
  return y0;
}
