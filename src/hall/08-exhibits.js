/* ------------------------------------------------------------- exhibits */
function plaqueTex(title, date) {
  return tex(512, 160, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#c99a3e'); gr.addColorStop(0.5, '#a87a2a'); gr.addColorStop(1, '#8a6220');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,35,8,.8)'; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#2b1a06'; g.textAlign = 'center';
    g.font = '50px "Almendra SC", serif'; g.fillText(title, w / 2, 76, w - 40);
    g.font = '30px "Almendra SC", serif'; g.fillText(date, w / 2, 122, w - 40);
  });
}
function contactShadow(w, d) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.75 }));
  m.rotation.x = -Math.PI / 2; return m;
}
const shadowTex = tex(128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(0,0,0,.85)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w);
});
const TOP = 1.0; // plinth top height
function makePlinth(ex) {
  const g = new THREE.Group();
  const side = ex.side;
  g.position.set(side * 2.55, 0, ex.z);
  g.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; // local +z faces the aisle
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.3), MAT.stone); base.position.y = 0.06; g.add(base);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, TOP - 0.16, 1.15), MAT.stone); body.position.y = 0.12 + (TOP - 0.16) / 2; g.add(body);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 1.3), MAT.stone); cap.position.y = TOP - 0.025; g.add(cap);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.19), new THREE.MeshStandardMaterial({ map: plaqueTex(ex.short || ex.title, ex.date), metalness: 0.6, roughness: 0.4 }));
  plaque.position.set(0, 0.68, 0.578); g.add(plaque);
  const sh = contactShadow(2.6, 2.0); sh.position.y = 0.004; g.add(sh);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.7, 1.35), MAT.hit); hit.position.y = 0.85; g.add(hit);
  g.userData.hit = hit;
  scene.add(g);
  g.updateMatrixWorld(true);
  spotSources.push({ pos: g.localToWorld(new THREE.Vector3(0, TOP, 0)), lightPos: g.localToWorld(new THREE.Vector3(0, 3.9, 0.9)) });
  return g;
}

