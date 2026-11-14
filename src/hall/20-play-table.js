/* ------------------------------------------------------------- play table */
const play = { ex: null, game: null, P: null, token: 0, phase: 'idle', roll: null, moves: [], rings: [], byMesh: new Map(), glowing: new Set(), selected: null, hover: null, twoStep: false };
const ringGeo = new THREE.TorusGeometry(0.05, 0.006, 8, 36);
const ringHitGeo = new THREE.CircleGeometry(0.062, 24); // the whole ring face is clickable, not just its outline
const RING_COLOR = { gold: 0xf6a01a, ember: 0xe06418 };
function glowMats(obj) {
  if (obj.userData.mats) return obj.userData.mats;
  const a = []; obj.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { if (m.emissive) a.push(m); }); });
  obj.userData.mats = a; return a;
}
async function startGame(ex) {
  stopTour(); narrator.stop();
  if (mode !== 'gallery') return;
  mode = 'play';
  const g = GAMES[ex.game], P = PRES[ex.game];
  play.ex = ex; play.game = g; play.P = P; play.token++;
  play.phase = 'idle'; play.moves = []; play.selected = null; // nothing from the last table carries over during the glide
  $('#lm-choices').hidden = true;
  g.surface = ex.surface;
  if (g.variants) g.setVariant((store.variants || {})[g.id] || g.variant);
  for (const t of g.toggles || []) g.setToggle(t.id, toggleOn(g, t));
  play.hotseat = friendOn(g);
  g.init();
  play.resumed = loadGame(g);
  renderVariants(g);
  P.setup(ex);
  play.turnNo = 0; play.coachSeen = new Set(); $('#lm-coach').hidden = true; $('#lm-choices').classList.remove('replaybar');
  $('#lm-replayBtn').hidden = true; startHistory();
  showPlacard(false); $('#lm-hint').style.opacity = 0; rail.hidden = true; index.hidden = true; indexBtn.setAttribute('aria-expanded', 'false');
  root.classList.add('playing');
  resetView(true); updateJoy();
  $('#lm-hud').hidden = false; $('#lm-win').hidden = true; $('#lm-rules').hidden = true;
  $('#lm-hudTitle').textContent = g.name;
  $('#lm-throwBtn').hidden = !g.dice; $('#lm-dice').hidden = !g.dice;
  $('#lm-passBtn').hidden = !(g.canPass || g.stopLabel); $('#lm-passBtn').disabled = true;
  $('#lm-passBtn').textContent = g.stopLabel || 'Pass';
  play.undo = []; play.hintCount = 0;
  $('#lm-hintBtn').hidden = !canHint(g); $('#lm-undoBtn').hidden = !UNDO_OK.has(g.id);
  refreshAids();
  renderRules(g);
  if (!store.rulesSeen[g.id]) { $('#lm-rules').hidden = false; store.rulesSeen[g.id] = true; save(); }
  clearLastMove();
  if (g.dice) renderDice(g, null);
  updateScore();
  setMsg(g.first === 0 ? 'Your turn' : scribeName(g), g.first === 0 ? '' : `${scribeName(g)} moves first.`);
  await flyToPlay(ex);
  if (play.resumed) { beginTurn(0); setMsg('Your turn', 'Your saved game is back on the table, as you left it. ' + P.prompt()); return; }
  beginTurn(g.first, true);
}

