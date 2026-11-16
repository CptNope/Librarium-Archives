const MORABARABA_P = Object.assign({}, MORRIS_P, {
  gid: 'morabaraba', word: 'cow', camW: 1.5,
  intro() { return 'You play the pale cows and go first. ' + this.prompt(); },
  setup(ex) {
    if (!ex.pieces) ex.pieces = [0, 1].map(pl => Array.from({ length: 12 }, () => {
      const mat = new THREE.MeshStandardMaterial({ color: pl ? 0x1e120a : 0xf0e6d0, roughness: pl ? 0.35 : 0.5 });
      const m = new THREE.Mesh(morrisPieceGeo, mat); m.userData.mats = [mat]; ex.group.add(m); return m;
    }));
    MORRIS_P.setup.call(this, ex);
  },
  handSpot: (pl, k) => V3(-0.44 + k * 0.08, TOP, pl === 0 ? 0.54 : -0.54),
});
