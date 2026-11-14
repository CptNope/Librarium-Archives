  /* Saved games go to JSON. Boards kept in typed arrays, and the odd Set or Map,
   * are tagged on the way out and rebuilt on the way back. */
  const TYPED = { Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array };
  function packState(v) {
    if (v === null || typeof v !== 'object') return v;
    if (ArrayBuffer.isView(v)) return { __typed: v.constructor.name, d: Array.from(v) };
    if (v instanceof Set) return { __set: [...v].map(packState) };
    if (v instanceof Map) return { __map: [...v].map(([k, x]) => [packState(k), packState(x)]) };
    if (Array.isArray(v)) return v.map(packState);
    const out = {}; for (const k of Object.keys(v)) out[k] = packState(v[k]); return out;
  }
  function unpackState(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(unpackState);
    if (v.__typed && TYPED[v.__typed]) return TYPED[v.__typed].from(v.d);
    if (v.__set) return new Set(v.__set.map(unpackState));
    if (v.__map) return new Map(v.__map.map(([k, x]) => [unpackState(k), unpackState(x)]));
    const out = {}; for (const k of Object.keys(v)) out[k] = unpackState(v[k]); return out;
  }

  const api = { DICE_P, LEVELS, setLevel, packState, unpackState, level: () => LEVEL.name, ur: UR, senet: SENET, morris: MORRIS, oware: OWARE, brandubh: BRANDUBH, tables: TABLES, shatranj: SHATRANJ, foxgeese: FOXGEESE, draughts: DRAUGHTS, goose: GOOSE, reversi: REVERSI, dotsboxes: DOTSBOXES, halma: HALMA, go: GO, alquerque: ALQUERQUE, snakes: SNAKES, xiangqi: XIANGQI, tarocchi: TAROCCHI, mutorere: MUTORERE, konane: KONANE, fanorona: FANORONA, chess: CHESS, shogi: SHOGI, yut: YUT, pachisi: PACHISI, mahjong: MAHJONG, bao: BAO, landlord: LANDLORD, chinese: CHINESE, hex: HEX, gomoku: GOMOKU, dominoes: DOMINOES, tablut: TABLUT, makruk: MAKRUK, kalah: KALAH, cribbage: CRIBBAGE, morabaraba: MORABARABA, ludo: LUDO, janggi: JANGGI, chaturaji: CHATURAJI, seega: SEEGA, tab: TAB, baghchal: BAGHCHAL, fourseasons: FOURSEASONS, hounds: HOUNDS, latrunculi: LATRUNCULI, patolli: PATOLLI, mansion: MANSION, lifegame: LIFEGAME, jungle: JUNGLE, chaturanga: CHATURANGA, whist: WHIST, rithmo: RITHMO, lewischess: LEWISCHESS, courier: COURIER, hazard: HAZARD, piquet: PIQUET, nard: NARD, xii: XII, koikoi: KOIKOI, idraughts: IDRAUGHTS, hnefatafl: HNEFATAFL };
  // Where this file came from, so the hall can start a worker that loads the very same rules:
  // its address when it is a file of its own, its text when it is written into the page.
  const here = typeof document !== 'undefined' && document.currentScript;
  api.source = here ? { url: here.src || null, text: here.src ? null : here.textContent } : null;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LibrariumRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
