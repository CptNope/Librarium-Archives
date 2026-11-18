/* --- Card batch six: Écarté (Wing IV), Gin Rummy, Contract Bridge and Spades (Wing V). */

// Écarté: a hand of five each, the turned-up trump beside the talon, and the king of trumps held and shown.
function buildEcarte(group) {
  const y = cardTable(group, ['#2a2a4a', '#242442', '#323256', '#1f1f3a']), shown = [];
  const put = (c, x, z, ry, down) => { const m = crCard(c, c, 'french'); m.position.set(x, y + 0.001 + shown.length * 0.0002, z); m.rotation.set(0, ry, down ? Math.PI : 0); group.add(m); shown.push(m); return m; };
  [13 + 12, 13 + 0, 13 + 9, 39 + 12, 26 + 11].forEach((c, i) => put(c, (i - 2) * 0.075, 0.3, 0, false)); // the king of trumps, hearts
  for (let i = 0; i < 5; i++) put(0, (i - 2) * 0.06, -0.3, Math.PI, true);
  for (let k = 0; k < 12; k++) put(0, -0.42, 0.0, Math.PI / 2, true);
  put(13 + 7, -0.32, 0.0, 0.15, false); // the turned card: the eight of hearts
  group.userData.display = shown;
  return y;
}

// Gin Rummy: a gin hand laid down, three melds and nothing over, beside the stock and the discard pile.
function buildGin(group) {
  const y = cardTable(group, ['#1e4a44', '#1a423c', '#24524c', '#163a34']), shown = [];
  const put = (c, x, z, ry, down) => { const m = crCard(c, c, 'french'); m.position.set(x, y + 0.001 + shown.length * 0.0002, z); m.rotation.set(0, ry, down ? Math.PI : 0); group.add(m); shown.push(m); return m; };
  const melds = [[1, 14, 40], [13 + 5, 13 + 6, 13 + 7, 13 + 8], [26 + 10, 26 + 11, 26 + 12]];
  let x = -0.34; melds.forEach(m => { m.forEach((c, j) => put(c, x + j * 0.03, 0.26, 0, false)); x += m.length * 0.03 + 0.07; });
  for (let i = 0; i < 10; i++) put(0, (i - 4.5) * 0.04, -0.3, Math.PI, true);
  for (let k = 0; k < 20; k++) put(0, -0.1, -0.02 + k * 0.0002, 0, true);
  put(39 + 9, 0.08, -0.02, 0.06, false);
  group.userData.display = shown;
  return y;
}

// Spades and Bridge sit four round a whist table. Spades on display: the ace of spades on a trick it has just
// trumped. Bridge on display: dummy's hand face up in North's place, and the opening lead.
function buildSpades(group) {
  const y = cardTable(group, ['#24243a', '#1f1f33', '#2c2c46', '#1a1a2c'], 1.1, 0.96), shown = [];
  const put = (c, at, ry, down) => { const m = crCard(c, c, 'french'); m.position.copy(at); m.position.y += shown.length * 0.0002; m.rotation.set(0, ry, down ? Math.PI : 0); group.add(m); shown.push(m); return m; };
  for (let s = 0; s < 4; s++) for (let i = 0; i < 10; i++) put(0, wsHandSpot(s, i, 10, y + 0.001), WS_YAW[s], true);
  [13 + 12, 13 + 4, 0, 13 + 9].forEach((c, s) => put(c, wsTrickSpot(s, y + 0.001 + s * 0.0004), WS_YAW[s] + (s - 1.5) * 0.1, false));
  group.userData.display = shown;
  return y;
}
function bridgeDummySpot(seat, i, n, y) { // dummy laid out face up, a little nearer the middle than a hand
  const p = wsHandSpot(seat, i, n, y);
  if (seat === 2) p.z += 0.05; else if (seat === 0) p.z -= 0.05; else p.x += seat === 1 ? 0.05 : -0.05;
  return p;
}
function buildBridge(group) {
  const y = cardTable(group, ['#1f3a2a', '#1a3424', '#264232', '#162e20'], 1.1, 0.96), shown = [];
  const put = (c, at, ry, down) => { const m = crCard(c, c, 'french'); m.position.copy(at); m.position.y += shown.length * 0.0002; m.rotation.set(0, ry, down ? Math.PI : 0); group.add(m); shown.push(m); return m; };
  const dummy = [0, 12, 11, 4, 13 + 12, 13 + 3, 26 + 0, 26 + 10, 26 + 6, 39 + 11, 39 + 8, 39 + 2, 39 + 1];
  dummy.forEach((c, i) => put(c, bridgeDummySpot(2, i, 13, y + 0.001), 0, false));
  for (const s of [0, 1, 3]) for (let i = 0; i < (s === 1 ? 12 : 13); i++) put(0, wsHandSpot(s, i, s === 1 ? 12 : 13, y + 0.001), WS_YAW[s], true);
  put(13 + 10, wsTrickSpot(1, y + 0.002), WS_YAW[1], false); // West's opening lead
  group.userData.display = shown;
  return y;
}
