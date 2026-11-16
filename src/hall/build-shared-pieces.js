/* --- Wing V: shared pieces */
// A teetotum: the numbered spinning top that moral games used instead of gambling dice.
function teetotum(color = 0xd8c49a) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 8), [wood, wood, new THREE.MeshStandardMaterial({ map: tex(128, 128, (c, w) => {
    c.fillStyle = '#e8d6ac'; c.fillRect(0, 0, w, w);
    c.fillStyle = '#3a2412'; c.font = '20px Georgia, serif'; c.textAlign = 'center';
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * TAU; c.fillText(String(k + 1), w / 2 + Math.cos(a) * 44, w / 2 + Math.sin(a) * 44 + 7); }
    c.strokeStyle = '#3a2412'; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; c.beginPath(); c.moveTo(w / 2, w / 2); c.lineTo(w / 2 + Math.cos(a) * 62, w / 2 + Math.sin(a) * 62); c.stroke(); }
  }) })]);
  top.rotation.y = Math.PI / 8; top.position.y = 0.03; g.add(top);
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 8), wood); spindle.position.y = 0.05; g.add(spindle);
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.024, 8), wood); point.rotation.x = Math.PI; point.position.y = 0.012; g.add(point);
  g.rotation.z = 0.35; // resting on its side, as it fell
  return g;
}
function paperSheet(group, w, d, map, y = TOP + 0.003) {
  const m = topPlane(group, w, d, y, map, { roughness: 0.9 });
  return m;
}
function agedPaper(g, w, h) {
  g.fillStyle = '#ecdcb4'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 3000, ['#c9b07c', '#f8ecd0', '#b89a68'], 1.6);
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(110,70,20,.35)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}

