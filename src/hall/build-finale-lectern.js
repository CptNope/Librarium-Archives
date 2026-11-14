/* --- Finale lectern */
let lectern;
function buildLectern(z) {
  const g = new THREE.Group(); g.position.set(0, 0, z);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.0, 0.22), MAT.wood); post.position.y = 0.5; g.add(post);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.5), MAT.wood); foot.position.y = 0.03; g.add(foot);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.56), MAT.woodDark); top.position.y = 1.08; top.rotation.x = 0.35; g.add(top);
  const pageT = tex(512, 340, (c, w, h) => {
    c.fillStyle = '#efe2c4'; c.fillRect(0, 0, w, h); speckle(c, w, h, 900, ['#c9b68e', '#fff8e6'], 1.3);
    c.fillStyle = '#e6d6b2'; c.fillRect(w / 2 - 6, 0, 12, h);
    c.fillStyle = '#7a4a10'; c.textAlign = 'center';
    c.font = '40px "Almendra SC", serif'; c.fillText('Librarium', w / 4, 70);
    c.fillStyle = '#3b2a18'; c.font = '20px "Amethysta", serif';
    ['Different fables', 'for different tables'].forEach((t, i) => c.fillText(t, w / 4, 110 + i * 26));
    c.font = '28px "Almendra SC", serif'; c.fillStyle = '#7a4a10';
    ['Calendra', 'Phoenix Farm', 'Royal Threadcount', 'The Great Chase'].forEach((t, i) => c.fillText(t, w * 0.75, 80 + i * 56));
  });
  const page = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.03, 0.44), [MAT.woodDark, MAT.woodDark, new THREE.MeshLambertMaterial({ map: pageT }), MAT.woodDark, MAT.woodDark, MAT.woodDark]);
  page.position.y = 1.115; page.rotation.x = 0.35; g.add(page);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1, 1.4, 0.8), MAT.hit); hit.position.y = 0.7; g.add(hit); g.userData.hit = hit;
  const sh = contactShadow(1.5, 1.2); sh.position.y = 0.004; g.add(sh);
  scene.add(g); lectern = g;
  spotSources.push({ pos: new THREE.Vector3(0, 1.1, z), lightPos: new THREE.Vector3(0, 3.6, z + 0.9) });
}

