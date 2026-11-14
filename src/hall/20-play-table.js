/* ------------------------------------------------------------- play table */
const play = { ex: null, game: null, P: null, token: 0, phase: 'idle', roll: null, moves: [], rings: [], halos: new Map(), byMesh: new Map(), glowing: new Set(), selected: null, hover: null, twoStep: false };
const ringGeo = new THREE.TorusGeometry(0.05, 0.008, 8, 36);
const ringHitGeo = new THREE.CircleGeometry(0.062, 24); // the whole ring face is clickable, not just its outline
const RING_COLOR = { gold: 0xffb21f, ember: 0xff6a1a };
// Every mark sits on a dark band a little wider than itself, so it reads on a pale board as well as a dark one,
// over a faint wash of its own colour that shows which square it means.
const ringEdgeGeo = new THREE.TorusGeometry(0.05, 0.0135, 8, 36), ringFillGeo = new THREE.CircleGeometry(0.043, 28);
const RING_EDGE = new THREE.MeshBasicMaterial({ color: 0x140a03, transparent: true, opacity: 0.78, depthWrite: false });
const RING_FILL = { gold: new THREE.MeshBasicMaterial({ color: RING_COLOR.gold, transparent: true, opacity: 0.2, depthWrite: false }), ember: new THREE.MeshBasicMaterial({ color: RING_COLOR.ember, transparent: true, opacity: 0.22, depthWrite: false }) };
const RING_EDGE_SOFT = new THREE.MeshBasicMaterial({ color: 0x140a03, transparent: true, opacity: 0.4, depthWrite: false });
function markMesh(geo, mat, tone, soft) { // a ring with its dark band and its wash, all lying flat
  const ring = new THREE.Mesh(geo, mat); ring.rotation.x = -Math.PI / 2;
  const edge = new THREE.Mesh(ringEdgeGeo, soft ? RING_EDGE_SOFT : RING_EDGE); edge.position.z = -0.0006; edge.renderOrder = -1; ring.add(edge);
  if (tone) { const fill = new THREE.Mesh(ringFillGeo, RING_FILL[tone]); fill.position.z = -0.0003; ring.add(fill); }
  return ring;
}
function glowMats(obj) {
  if (obj.userData.mats) return obj.userData.mats;
  const a = []; obj.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { if (m.emissive) a.push(m); }); });
  obj.userData.mats = a; return a;
}
async function startGame(ex) {
  stopTour(); narrator.stop();
  if (mode !== 'gallery') return;
  buildExhibit(ex); // in case the visitor got here before it was built
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
  if (g.human) g.human = [true, !!play.hotseat]; // engines that ask a person for choices the Scribe makes by itself
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

