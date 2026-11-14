/* --- Wing V: The Landlord's Game, as its patent drawing (display) */
// The Landlord's Game board, laid out as in the drawing of U.S. Patent 748,626 (1904).
const LL_B = 0.86, LL_C = 0.13, LL_W = (LL_B - 2 * LL_C) / 9;
function llSpace(k) { // centre of space k, and the unit vector pointing from it to the board's edge
  const h = LL_B / 2, c = LL_C / 2;
  if (k === 0) return { x: h - c, z: -h + c, ox: 0.7, oz: -0.7 };
  if (k < 10) return { x: h - c, z: -h + LL_C + (k - 0.5) * LL_W, ox: 1, oz: 0 };
  if (k === 10) return { x: h - c, z: h - c, ox: 0.7, oz: 0.7 };
  if (k < 20) return { x: h - LL_C - (k - 10.5) * LL_W, z: h - c, ox: 0, oz: 1 };
  if (k === 20) return { x: -h + c, z: h - c, ox: -0.7, oz: 0.7 };
  if (k < 30) return { x: -h + c, z: h - LL_C - (k - 20.5) * LL_W, ox: -1, oz: 0 };
  if (k === 30) return { x: -h + c, z: -h + c, ox: -0.7, oz: -0.7 };
  return { x: -h + LL_C + (k - 30.5) * LL_W, z: -h + c, ox: 0, oz: -1 };
}
function buildLandlord(group) {
  const B = LL_B, base = new THREE.Mesh(new THREE.BoxGeometry(B + 0.03, 0.02, B + 0.03), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.7 }));
  base.position.y = TOP + 0.01; group.add(base);
  const N = 1280, sc = N / B, SP = window.LibrariumRules.landlord.SPACES;
  const FILL = { lot: '#a9cf9d', need: '#a9c3e0', lux: '#c4abd8', franchise: '#ecd77e' };
  topPlane(group, B, B, TOP + 0.0205, tex(N, N, (g) => {
    g.fillStyle = '#efe7d2'; g.fillRect(0, 0, N, N); speckle(g, N, N, 2600, ['#d9cdb0'], 1.3);
    g.strokeStyle = '#1f1d1a'; g.fillStyle = '#1f1d1a'; g.lineWidth = 3; g.textAlign = 'center'; g.textBaseline = 'middle';
    const C = LL_C * sc, Wd = LL_W * sc;
    g.strokeRect(6, 6, N - 12, N - 12); g.strokeRect(C, C, N - 2 * C, N - 2 * C);
    const font = (px, it) => { g.font = `${it ? 'italic ' : ''}${px}px Georgia, "Times New Roman", serif`; };
    for (let k = 0; k < 40; k++) {
      if (k % 10 === 0) continue;
      const sp = SP[k], p = llSpace(k), cx = N / 2 + p.x * sc, cy = N / 2 + p.z * sc;
      const ang = p.oz === 1 ? 0 : p.oz === -1 ? Math.PI : p.ox === -1 ? Math.PI / 2 : -Math.PI / 2;
      g.save(); g.translate(cx, cy); g.rotate(ang);
      // In the rotated frame the space is Wd wide and C deep, with the board's edge at +C/2.
      if (FILL[sp.t]) { g.fillStyle = FILL[sp.t]; g.globalAlpha = 0.55; g.fillRect(-Wd / 2, -C / 2, Wd, C); g.globalAlpha = 1; }
      g.strokeStyle = '#1f1d1a'; g.lineWidth = 2.5; g.strokeRect(-Wd / 2, -C / 2, Wd, C);
      g.fillStyle = '#1f1d1a';
      const lines = sp.t === 'lot' ? [['LOT ' + sp.n, 16], ['FOR SALE', 12], ['$' + sp.price, 22], ['FOR RENT', 12], ['$' + sp.rent, 20]]
        : sp.t === 'need' ? [['ABSOLUTE', 11], ['NECESSITY', 11], [sp.name.toUpperCase(), 15], ['TAXES $5', 13]]
        : sp.t === 'rr' ? [['R. R.', 24], ['$5', 22]]
        : sp.t === 'lux' ? [['LUXURY', 15], ['$50', 22]]
        : sp.t === 'franchise' ? [[sp.key === 'light' ? 'LIGHT' : 'WATER', 15], ['FRANCHISE', 11], ['$5', 20]]
        : sp.t === 'legacy' ? [['LEGACY', 15], ['$100', 22]]
        : sp.t === 'trespass' ? [['NO', 13], ['TRES-', 13], ['PASSING', 13], ['GO TO', 11], ['JAIL', 15]] : [[sp.name, 13]];
      const total = lines.reduce((a, [, px]) => a + px * 1.25, 0); let y = -total / 2;
      for (const [t, px] of lines) { font(px); y += px * 0.625; g.fillText(t, 0, y, Wd - 8); y += px * 0.625; }
      g.restore();
    }
    // The corners, as the patent draws them.
    const corner = (k, draw) => { const p = llSpace(k), cx = N / 2 + p.x * sc, cy = N / 2 + p.z * sc; g.save(); g.translate(cx, cy); draw(); g.restore(); };
    corner(0, () => { // Mother Earth
      g.fillStyle = '#c9dcc0'; g.beginPath(); g.arc(0, 0, C * 0.3, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#86a676'; for (const [x, y, r] of [[-10, -9, 12], [9, 5, 14], [-3, 15, 7]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      g.fillStyle = '#1f1d1a'; font(15); g.fillText('MOTHER EARTH', 0, 0, C * 0.8);
      font(10); g.fillText('LABOR UPON MOTHER EARTH', 0, -C * 0.39, C * 0.95); g.fillText('PRODUCES WAGES', 0, C * 0.39, C * 0.95);
    });
    corner(10, () => { // Coal, with the jail
      g.save(); g.beginPath(); g.arc(C * 0.18, C * 0.18, C * 0.36, 0, TAU); g.clip();
      g.fillStyle = '#d8d0bc'; g.fillRect(-C, -C, 2 * C, 2 * C); g.lineWidth = 5; for (let x = -C / 2; x < C; x += 14) { g.beginPath(); g.moveTo(x, -C); g.lineTo(x, C); g.stroke(); }
      g.restore(); g.lineWidth = 2.5; g.beginPath(); g.arc(C * 0.18, C * 0.18, C * 0.36, 0, TAU); g.stroke();
      g.fillStyle = '#efe7d2'; g.fillRect(C * 0.18 - 30, C * 0.18 - 13, 60, 26); g.fillStyle = '#1f1d1a'; font(20); g.fillText('JAIL', C * 0.18, C * 0.18);
      font(10); g.fillText('ABSOLUTE NECESSITY', -C * 0.12, -C * 0.36); font(14); g.fillText('COAL  $5', -C * 0.12, -C * 0.24);
    });
    corner(20, () => { // Public Park and the poorhouse
      g.fillStyle = '#b9d3a8'; g.beginPath(); g.arc(0, 0, C * 0.2, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#1f1d1a'; font(14); g.fillText('PUBLIC PARK', 0, -C * 0.3); font(12); g.fillText('POOR HOUSE', 0, C * 0.32);
    });
    corner(30, () => { // Lord Blueblood's estate
      g.fillStyle = '#1f1d1a'; font(12); g.fillText('NO TRESPASSING', 0, -C * 0.22); g.fillText('GO TO JAIL', 0, -C * 0.1);
      font(9, true); g.fillText('Owner Lord Blueblood,', 0, C * 0.1); g.fillText('London, England', 0, C * 0.2);
    });
    // The centre: the four boxes of the patent.
    const m = C + 40, cw = (N - 2 * m - 30) / 2;
    [['R. R.', 0, 0], ['WAGES', 1, 0], ['BANK', 0, 1], ['PUBLIC TREASURY', 1, 1]].forEach(([t, cxi, cyi]) => {
      const x = m + cxi * (cw + 30), y = m + cyi * (cw + 30);
      g.lineWidth = 2.5; g.strokeRect(x, y, cw, cw); font(t.length > 8 ? 30 : 40); g.fillText(t, x + cw / 2, y + cw / 2, cw - 20);
    });
    font(16, true); g.fillText('THE LANDLORD\'S GAME · L. J. MAGIE · PAT. No. 748,626, 1904', N / 2, N / 2);
  }), { roughness: 0.8 });
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 }));
  pen.rotation.z = Math.PI / 2; pen.rotation.y = -0.5; pen.position.set(B / 2 + 0.09, TOP + 0.006, 0.3); group.add(pen);
  group.userData.display = [];
  return TOP + 0.021;
}

