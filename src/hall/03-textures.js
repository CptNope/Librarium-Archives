/* ------------------------------------------------------------- textures */
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function speckle(g, w, h, n, colors, rMax = 1.6) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(Math.random() * colors.length) | 0];
    g.globalAlpha = rand(0.05, 0.22);
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rand(0.4, rMax), 0, TAU); g.fill();
  }
  g.globalAlpha = 1;
}
const floorTex = () => tex(512, 512, (g, w, h) => {
  g.fillStyle = '#17110d'; g.fillRect(0, 0, w, h);
  const rows = 4; let y = 0;
  for (let r = 0; r < rows; r++) {
    const rh = h / rows; let x = r % 2 ? -w / 6 : 0;
    while (x < w) {
      const sw = rand(w / 3.2, w / 2.2);
      const v = rand(36, 52) | 0;
      g.fillStyle = `rgb(${v + 6},${v},${v - 6})`;
      g.fillRect(x + 3, y + 3, sw - 6, rh - 6);
      x += sw;
    }
    y += rh;
  }
  speckle(g, w, h, 5000, ['#000', '#5a4c40', '#2a2018'], 2.2);
}, [5, 24]);
const stoneTex = () => tex(256, 256, (g, w, h) => {
  g.fillStyle = '#4a4036'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 3000, ['#2b241e', '#6b5e50', '#3a3129'], 1.8);
});
const runnerTex = () => tex(256, 1024, (g, w, h) => {
  g.fillStyle = '#3a1410'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#a0742c'; g.lineWidth = 6; g.strokeRect(14, -10, w - 28, h + 20);
  g.strokeStyle = '#1a0806'; g.lineWidth = 10; g.strokeRect(30, -10, w - 60, h + 20);
  for (let y = 60; y < h; y += 128) {
    g.save(); g.translate(w / 2, y); g.rotate(Math.PI / 4);
    g.strokeStyle = '#8a5a26'; g.lineWidth = 4; g.strokeRect(-26, -26, 52, 52);
    g.fillStyle = '#5c1f16'; g.fillRect(-14, -14, 28, 28); g.restore();
  }
  speckle(g, w, h, 4000, ['#000', '#6a2a1e'], 1.4);
}, [1, 8]);

