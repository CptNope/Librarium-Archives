/* ------------------------------------------------------------ games */
// Rules live in js/rules.js; this adds where pieces sit in 3D and how they look.
const { ur: UR_RULES, senet: SENET_RULES } = window.LibrariumRules;
const UR = Object.assign(UR_RULES, {
  local(pl, pos, i) {
    if (pos === 0 || pos === 15) {
      const z = pl === 0 ? 0.36 : -0.36;
      return new THREE.Vector3(pos === 0 ? -0.78 + i * 0.075 : 0.78 - i * 0.075, TOP, z);
    }
    let r, c;
    if (pos <= 4) { r = pl === 0 ? 2 : 0; c = 4 - pos; }
    else if (pos <= 12) { r = 1; c = pos - 5; }
    else { r = pl === 0 ? 2 : 0; c = pos === 13 ? 7 : 6; }
    return new THREE.Vector3(urCellX(c), this.surface, urCellZ(r));
  },
  makePieces(group) {
    const side = new THREE.MeshStandardMaterial({ color: 0xd8c9a6, roughness: 0.5 });
    const sideD = new THREE.MeshStandardMaterial({ color: 0x18213e, roughness: 0.45 });
    const geo = new THREE.CylinderGeometry(0.058, 0.062, 0.03, 28);
    const tops = [urPieceTop(true), urPieceTop(false)];
    return [0, 1].map(pl => Array.from({ length: 7 }, () => {
      const top = new THREE.MeshStandardMaterial({ map: tops[pl], roughness: 0.45, emissive: 0x000000 });
      const s = (pl ? sideD : side).clone();
      const m = new THREE.Mesh(geo, [s, top, s]); m.userData.mats = [s, top];
      group.add(m); return m;
    }));
  },
  pieceH: 0.015,
});
const SENET = Object.assign(SENET_RULES, {
  local(pl, sq, i) {
    if (sq === 31) return new THREE.Vector3(0.32 + i * 0.09, TOP, pl === 0 ? 0.37 : -0.37);
    const { x, z } = seCell(sq); return new THREE.Vector3(x, this.surface, z);
  },
  makePieces(group) {
    const geos = [spoolGeo(), coneGeo()];
    const cols = [0xe7d9b8, 0x22324f];
    return [0, 1].map(pl => Array.from({ length: 5 }, () => {
      const mat = new THREE.MeshStandardMaterial({ color: cols[pl], roughness: 0.4, metalness: pl ? 0.1 : 0 });
      const m = new THREE.Mesh(geos[pl], mat); m.userData.mats = [mat];
      group.add(m); return m;
    }));
  },
  pieceH: 0,
});
const R = window.LibrariumRules;
const GAMES = { ur: UR, senet: SENET, morris: R.morris, oware: R.oware, brandubh: R.brandubh, tables: R.tables, shatranj: R.shatranj, foxgeese: R.foxgeese, draughts: R.draughts, goose: R.goose, reversi: R.reversi, dotsboxes: R.dotsboxes, halma: R.halma, go: R.go, alquerque: R.alquerque, xiangqi: R.xiangqi, snakes: R.snakes, tarocchi: R.tarocchi, mutorere: R.mutorere, konane: R.konane, fanorona: R.fanorona, chess: R.chess, shogi: R.shogi, yut: R.yut, pachisi: R.pachisi, mahjong: R.mahjong, bao: R.bao, landlord: R.landlord, chinese: R.chinese, hex: R.hex, gomoku: R.gomoku, dominoes: R.dominoes, tablut: R.tablut, makruk: R.makruk, kalah: R.kalah, cribbage: R.cribbage, morabaraba: R.morabaraba, ludo: R.ludo, janggi: R.janggi, chaturaji: R.chaturaji, seega: R.seega, tab: R.tab, baghchal: R.baghchal, fourseasons: R.fourseasons, hounds: R.hounds, latrunculi: R.latrunculi, patolli: R.patolli, mansion: R.mansion, lifegame: R.lifegame, jungle: R.jungle, chaturanga: R.chaturanga, whist: R.whist, rithmo: R.rithmo, lewischess: R.lewischess, courier: R.courier, hazard: R.hazard, piquet: R.piquet, nard: R.nard, xii: R.xii, koikoi: R.koikoi, idraughts: R.idraughts, hnefatafl: R.hnefatafl };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

