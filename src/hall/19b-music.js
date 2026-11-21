/* ------------------------------------------------------------- music
 * The soundtrack: an opening theme and two pieces for each wing, made for the Archives (docs/soundtrack.md).
 * The opening plays at the visitor's first click, tap or key, as browsers require. When it ends, the music of
 * the wing they are standing in follows, and each wing's two pieces take turns. Walking into another wing
 * crossfades to its music once they have been there a moment (the first hearing of the opening always
 * plays to its end), so passing an arch does not chop and change;
 * coming back to the entrance from further in brings the opening back. The music drops while the visitor
 * sits at a table or the tour reads aloud, and pauses with the tab. It has its own button, apart from the
 * sound effects. The files stream from music/ beside the page (data-music on #lm-app points elsewhere, as the
 * WordPress plugin does), so nothing loads until it plays; if they are not there, the button goes away. */
const music = (() => {
  const BASE = (root.dataset.music || 'music/').replace(/\/?$/, '/');
  const SETS = { opening: ['opening-a', 'opening-b'] };
  for (let w = 0; w < 6; w++) SETS['w' + w] = [`wing${w + 1}-a`, `wing${w + 1}-b`];
  const VOL = 0.5, SEATED = 0.45, READING = 0.35, FADE = 2.5, SETTLE = 2.5;
  const turn = {}; // the next take to play from each set
  let on = store.music !== false, unlocked = false, broken = false;
  let ctx = null, decks = [], cur = null, playing = null, want = null, wantSince = 0, leftEntrance = false, overture = false, timer = 0;

  // Two decks, so one piece can fade out while the next fades in. Each runs through a gain node where the
  // browser has Web Audio (iOS ignores an audio element's volume), or sets the element's volume where not.
  function deck() {
    const el = new Audio(); el.preload = 'none';
    const d = { el, mix: 0, to: 0, gain: null, name: null };
    if (ctx) { try { const src = ctx.createMediaElementSource(el); d.gain = ctx.createGain(); d.gain.gain.value = 0; src.connect(d.gain); d.gain.connect(ctx.destination); } catch (e) { d.gain = null; } }
    el.addEventListener('ended', () => { if (d === cur) next(true); });
    el.addEventListener('error', () => { if (d.name) fail(); });
    return d;
  }
  function fail() { // no music files here (a build without them, or offline before they were heard)
    broken = true; stop();
    if (musicBtn) musicBtn.hidden = true;
  }
  function make() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { try { ctx = new AC(); } catch (e) { ctx = null; } }
    decks = [deck(), deck()];
  }
  const entranceZ = () => HALL.zNear - LAYOUT.first / 2; // before the first exhibit
  function zone() {
    const z = cam.pos.z;
    if (z > entranceZ()) return leftEntrance ? 'opening' : (playing === 'opening' ? 'opening' : 'w0');
    const w = Math.min(5, wingOf(z));
    if (w > 0) leftEntrance = true;
    return 'w' + w;
  }
  function start(set, first) {
    if (broken || !on || !unlocked) return;
    const list = SETS[set], k = turn[set] || 0; turn[set] = (k + 1) % list.length;
    const d = decks.find(x => x !== cur) || decks[0];
    if (cur) cur.to = 0;
    d.name = list[k]; d.el.src = BASE + d.name + '.mp3'; d.el.currentTime = 0;
    d.mix = first ? 1 : 0; d.to = 1;
    const p = d.el.play(); if (p && p.catch) p.catch(() => {});
    cur = d; playing = set; overture = !!first;
    if (set === 'opening') leftEntrance = false;
    if (musicBtn) musicBtn.title = 'Music: ' + titleOf(d.name);
    mixNow();
  }
  // A piece ended: the other take of where the visitor is. After the opening, the first wing's music.
  function next() { const z = zone(); start(z === 'opening' && playing === 'opening' ? 'w0' : z); }
  function level() {
    let v = VOL;
    if (mode === 'play') v *= SEATED;
    if (narrator.speaking) v *= READING;
    return v;
  }
  function mixNow() {
    const v = level(), now = ctx ? ctx.currentTime : 0;
    for (const d of decks) {
      const g = d.mix * v;
      if (d.gain) d.gain.gain.setTargetAtTime(g, now, 0.12); else d.el.volume = Math.max(0, Math.min(1, g));
    }
  }
  function tick() {
    if (!cur || !on || broken) return;
    const dt = 0.25;
    for (const d of decks) {
      if (d.mix < d.to) d.mix = Math.min(d.to, d.mix + dt / FADE);
      else if (d.mix > d.to) { d.mix = Math.max(d.to, d.mix - dt / FADE); if (d.mix === 0 && d !== cur) { d.el.pause(); d.name = null; } }
    }
    mixNow();
    // Seated, the visitor stays put and the music carries on. The overture always plays to its end.
    if (mode !== 'play' && !overture) {
      const z = zone(), now = performance.now();
      if (z !== want) { want = z; wantSince = now; }
      else if (z !== playing && now - wantSince > SETTLE * 1000) start(z);
    }
  }
  function stop() {
    clearInterval(timer); timer = 0;
    for (const d of decks) { d.el.pause(); d.mix = d.to = 0; d.name = null; }
    if (ctx && ctx.state === 'running') ctx.suspend();
    cur = null; playing = null;
  }
  function begin(first) {
    if (!timer) timer = setInterval(tick, 250);
    if (ctx && ctx.state === 'suspended') ctx.resume();
    start(first ? 'opening' : zone(), first);
  }
  const api = {
    get on() { return on; },
    get broken() { return broken; },
    get track() { return cur ? cur.name : null; },
    get decks() { return decks.map(d => ({ name: d.name, mix: +d.mix.toFixed(2), to: d.to, time: +d.el.currentTime.toFixed(1), paused: d.el.paused, gain: d.gain ? +d.gain.gain.value.toFixed(3) : d.el.volume })); },
    skip() { if (cur) cur.el.currentTime = Math.max(0, cur.el.duration - 1); }, // the end of the piece playing (for tests)
    // The first click, tap or key: make the decks inside it (iOS will only start them from one), then the opening.
    unlock() {
      if (unlocked) return; unlocked = true;
      if (!on || broken) return;
      make();
      // Wake the second deck inside the gesture too, or iOS refuses it when the first piece ends.
      const spare = decks[1]; spare.el.src = BASE + 'opening-b.mp3';
      const p = spare.el.play(); if (p && p.then) p.then(() => { if (spare !== cur) spare.el.pause(); }).catch(() => {});
      begin(true);
    },
    set(v) {
      on = v; store.music = v; save();
      if (!v) { stop(); return; }
      if (!unlocked) return;
      if (!decks.length) make();
      begin(false);
    },
  };
  function titleOf(name) {
    if (name.startsWith('opening')) return 'Librarium (Opening Theme)';
    const w = +name[4];
    return `Wing ${['I', 'II', 'III', 'IV', 'V', 'VI'][w - 1]}: ${['The First Boards', 'Strategy Takes the Table', 'Kings, Cards and Courts', 'Printed Boards and Parlour Tables', 'The Modern Board Game', 'Games of the World'][w - 1]}`;
  }
  document.addEventListener('visibilitychange', () => {
    if (!cur || !on) return;
    if (document.hidden) { cur.el.pause(); if (ctx) ctx.suspend(); }
    else { if (ctx) ctx.resume(); const p = cur.el.play(); if (p && p.catch) p.catch(() => {}); }
  });
  return api;
})();
const musicBtn = $('#lm-musicBtn');
function renderMusicBtn() {
  if (!musicBtn) return;
  musicBtn.setAttribute('aria-pressed', String(music.on));
  musicBtn.setAttribute('aria-label', music.on ? 'Music on. Turn off' : 'Music off. Turn on');
  musicBtn.classList.toggle('off', !music.on);
  if (!music.on) musicBtn.title = 'Music';
}
if (musicBtn) {
  musicBtn.addEventListener('click', () => { music.set(!music.on); renderMusicBtn(); });
  renderMusicBtn();
}
['pointerdown', 'keydown'].forEach(t => root.addEventListener(t, () => music.unlock(), { once: true, capture: true }));
