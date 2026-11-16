/* --- Wing V: The Checkered Game of Life (display) */
// The board of about 1911: an 8 x 8 checkerboard whose pale squares carry the course of a life,
// newly drawn with names and numbers in place of the engravings. Row 0 is the far side.
const CL_S = 0.095;
function clCell(i) { const r = i >> 3, c = i & 7; return { x: (c - 3.5) * CL_S, z: (r - 3.5) * CL_S }; }
function buildCheckeredLife(group) {
  const W = 8 * CL_S + 0.06, G = window.LibrariumRules.lifegame;
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, W), new THREE.MeshStandardMaterial({ color: 0x2a3a34, roughness: 0.6 }));
  board.position.y = TOP + 0.01; group.add(board);
  const px = 2048, d = (8 * CL_S) / W * px / 8, o = (px - 8 * d) / 2;
  topPlane(group, W, W, TOP + 0.0205, tex(px, px, (g) => {
    g.fillStyle = '#e8dfc8'; g.fillRect(0, 0, px, px);
    // A border of small checks, as printed round the board.
    for (let k = 0; k < px / 24; k++) { g.fillStyle = k % 2 ? '#2a3a34' : '#e8dfc8'; g.fillRect(k * 24, 0, 24, o * 0.45); g.fillRect(k * 24, px - o * 0.45, 24, o * 0.45); g.fillRect(0, k * 24, o * 0.45, 24); g.fillRect(px - o * 0.45, k * 24, o * 0.45, 24); }
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const x = o + c * d, y = o + r * d, i = r * 8 + c, sq = G.SQ[i];
      if ((r + c) % 2 === 0) { // the red squares are only ornament: an eight-pointed star of our own
        g.fillStyle = '#c4382a'; g.fillRect(x, y, d, d);
        g.strokeStyle = '#f3e3c0'; g.lineWidth = 6; g.strokeRect(x + 12, y + 12, d - 24, d - 24);
        g.fillStyle = '#f3e3c0'; g.beginPath();
        for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, rr = k % 2 ? d * 0.13 : d * 0.3; g.lineTo(x + d / 2 + Math.cos(a) * rr, y + d / 2 + Math.sin(a) * rr); }
        g.closePath(); g.fill();
        continue;
      }
      g.fillStyle = '#9fc7bd'; g.fillRect(x, y, d, d); g.strokeStyle = '#2a3a34'; g.lineWidth = 3; g.strokeRect(x, y, d, d);
      g.fillStyle = '#16302a'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const name = sq[0].toUpperCase();
      g.font = `bold ${name.length > 11 ? 26 : 32}px Georgia, serif`; g.fillText(name, x + d / 2, y + d * 0.2, d - 16);
      if (sq[1]) { g.font = 'bold 84px Georgia, serif'; g.fillText(String(sq[1]), x + d / 2, y + d * 0.58); }
      else if (sq[2] !== undefined) { // a pointing hand: drawn here as an arrow, with where it leads
        g.font = '58px Georgia, serif'; g.fillText('➜', x + d / 2, y + d * 0.52);
        g.font = 'italic 24px Georgia, serif'; g.fillText('to ' + G.SQ[sq[2]][0], x + d / 2, y + d * 0.8, d - 16);
      } else if (i === 62) { g.font = 'italic 22px Georgia, serif'; g.fillText('where you must', x + d / 2, y + d * 0.52); g.fillText('lose one move', x + d / 2, y + d * 0.68); }
      else if (i === 30) { g.font = 'italic 24px Georgia, serif'; g.fillText('3 or 6: Wealth', x + d / 2, y + d * 0.52); g.fillText('else: Ruin', x + d / 2, y + d * 0.68); }
    }
  }), { roughness: 0.75 });
  const tt = teetotum(); tt.position.set(W / 2 + 0.1, TOP, 0.18); group.add(tt);
  const shown = [];
  [0, 1].forEach(pl => { const p = mhPawn(pl); const c = clCell(56); p.position.set(c.x + (pl ? 0.016 : -0.016), TOP + 0.021, c.z); group.add(p); shown.push(p); });
  group.userData.display = shown;
  return TOP + 0.021;
}

