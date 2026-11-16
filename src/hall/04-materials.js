/* -------------------------------------------------------------- materials */
const MAT = {
  floor: new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.85, metalness: 0 }),
  wall: new THREE.MeshLambertMaterial({ color: 0x140e0a }),
  wood: new THREE.MeshLambertMaterial({ color: 0x2e1d12 }),
  woodDark: new THREE.MeshLambertMaterial({ color: 0x1b120c }),
  stone: new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.95, color: 0xb8a894 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb98a30, metalness: 0.85, roughness: 0.35 }),
  ceiling: new THREE.MeshLambertMaterial({ color: 0x0c0907 }),
  runner: new THREE.MeshLambertMaterial({ map: runnerTex() }),
  hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
};

