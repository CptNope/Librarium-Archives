/* ------------------------------------------------------------- music
 * The soundtrack: two pieces for the entrance hall, two for each wing, and the main theme, which plays under
 * the credits, all made for the Archives (docs/soundtrack.md). The entrance hall's music fades in at the
 * visitor's first click, tap or key, as browsers require. Each place's two pieces take turns, and walking into
 * another wing, or back to the entrance, crossfades to its music once the visitor has been there a moment, so
 * passing an arch does not chop and change. That is "Follow the hall". The credits play the main theme, and
 * closing them goes back to the music of where the visitor stands. The music button opens the soundtrack
 * panel, where the visitor can pause, skip, seek, or pick any piece; once they pick, the music plays through
 * the list "In order" until they choose to follow the hall again. It drops while the visitor sits at a table or the tour reads aloud,
 * and pauses with the tab. The files stream from music/ beside the page (data-music on #lm-app points
 * elsewhere, as the WordPress plugin does), so nothing loads until it plays; if they are not there, the
 * button goes away. */
const MUSIC_WINGS = ['The First Boards', 'Strategy Takes the Table', 'Kings, Cards and Courts', 'Printed Boards and Parlour Tables', 'The Modern Board Game', 'Games of the World'];
// Every piece in list order, with its length (seconds) so the list can show it before anything has loaded.
// Each piece's set: 'lobby' (the entrance hall), 'w0' to 'w5' (the wings), or 'credits'.
const MUSIC_TRACKS = [['lobby-a', 215], ['lobby-b', 208], ['wing1-a', 103], ['wing1-b', 139], ['wing2-a', 174], ['wing2-b', 188],
  ['wing3-a', 158], ['wing3-b', 152], ['wing4-a', 135], ['wing4-b', 127], ['wing5-a', 145], ['wing5-b', 149], ['wing6-a', 166], ['wing6-b', 60],
  ['credits-a', 107], ['credits-b', 98]]
  .map(([name, len]) => {
    const kind = name.replace(/-.$/, ''), w = kind.startsWith('wing') ? +kind[4] - 1 : -1;
    return { name, len, set: w >= 0 ? 'w' + w : kind, take: name.endsWith('-a') ? 'First take' : 'Second take',
      title: kind === 'lobby' ? 'The Entrance Hall' : kind === 'credits' ? 'Librarium (Main Theme)' : `Wing ${ROMAN_WINGS[w + 1]}: ${MUSIC_WINGS[w]}` };
  });
const trackOf = name => MUSIC_TRACKS.find(t => t.name === name);
const clockOf = s => { s = Math.max(0, Math.round(s || 0)); return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`; };

const music = (() => {
  const BASE = (root.dataset.music || 'music/').replace(/\/?$/, '/');
  const SETS = {};
  for (const t of MUSIC_TRACKS) (SETS[t.set] = SETS[t.set] || []).push(t.name);
  const VOL = 0.5, SEATED = 0.45, READING = 0.35, FADE = 2.5, QUICK = 0.6, SETTLE = 2.5;
  const turn = {}; // the next take to play from each set
  let on = store.music !== false, unlocked = false, broken = false, follow = true, rolling = false, followAfter = true;
  let ctx = null, decks = [], cur = null, playing = null, want = null, wantSince = 0, timer = 0, fade = FADE;
  const listeners = [];
  const changed = () => listeners.forEach(fn => fn());

  // Two decks, so one piece can fade out while the next fades in. Each runs through a gain node where the
  // browser has Web Audio (iOS ignores an audio element's volume), or sets the element's volume where not.
  function deck() {
    const el = new Audio(); el.preload = 'none';
    const d = { el, mix: 0, to: 0, gain: null, name: null };
    if (ctx) { try { const src = ctx.createMediaElementSource(el); d.gain = ctx.createGain(); d.gain.gain.value = 0; src.connect(d.gain); d.gain.connect(ctx.destination); } catch (e) { d.gain = null; } }
    el.addEventListener('ended', () => { if (d === cur) ended(); });
    el.addEventListener('error', () => { if (d.name) fail(); });
    return d;
  }
  function fail() { // no music files here (a build without them, or offline before they were heard)
    broken = true; halt();
    if (musicBtn) { musicBtn.hidden = true; openMusic(false); }
  }
  function make() {
    if (decks.length) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { try { ctx = new AC(); } catch (e) { ctx = null; } }
    decks = [deck(), deck()];
  }
  const entranceZ = () => HALL.zNear - LAYOUT.first / 2; // before the first exhibit
  const zone = () => { const z = cam.pos.z; return z > entranceZ() ? 'lobby' : 'w' + Math.min(5, wingOf(z)); };
  // Start one piece, crossfading from the last.
  function play(name, { quick = false } = {}) {
    if (broken || !on || !unlocked) return;
    const t = trackOf(name), d = decks.find(x => x !== cur) || decks[0];
    if (cur) cur.to = 0;
    fade = quick ? QUICK : FADE;
    d.name = name; d.el.src = BASE + name + '.mp3'; d.el.currentTime = 0;
    d.mix = 0; d.to = 1;
    const p = d.el.play(); if (p && p.catch) p.catch(() => {});
    cur = d; playing = t.set;
    turn[t.set] = (SETS[t.set].indexOf(name) + 1) % SETS[t.set].length;
    mixNow(); changed();
  }
  const fromSet = (set, opts) => play(SETS[set][turn[set] || 0], opts);
  // A piece ended. Under the credits: the main theme's other take. In order: the next in the list. Following
  // the hall: the other take of where the visitor is.
  function ended() {
    if (rolling) fromSet('credits');
    else if (!follow) step(1, false);
    else fromSet(zone());
  }
  function step(by, quick = true) {
    const i = cur ? MUSIC_TRACKS.findIndex(t => t.name === cur.name) : -1;
    play(MUSIC_TRACKS[(i + by + MUSIC_TRACKS.length) % MUSIC_TRACKS.length].name, { quick });
  }
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
      if (d.mix < d.to) d.mix = Math.min(d.to, d.mix + dt / fade);
      else if (d.mix > d.to) { d.mix = Math.max(d.to, d.mix - dt / fade); if (d.mix === 0 && d !== cur) { d.el.pause(); d.name = null; } }
    }
    mixNow();
    // Seated, the visitor stays put and the music carries on.
    if (follow && mode !== 'play') {
      const z = zone(), now = performance.now();
      if (z !== want) { want = z; wantSince = now; }
      else if (z !== playing && now - wantSince > SETTLE * 1000) fromSet(z);
    }
  }
  function halt() { // stop everything (the files are missing)
    clearInterval(timer); timer = 0;
    for (const d of decks) { d.el.pause(); d.mix = d.to = 0; d.name = null; }
    cur = null; playing = null; changed();
  }
  function run() {
    wake();
    if (!timer) timer = setInterval(tick, 250);
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  // Make the decks inside a click, tap or key (iOS will only start audio from one), and wake the second deck
  // there too, or iOS refuses it when the first piece ends.
  function wake() {
    if (decks.length) return;
    make();
    const spare = decks[1]; spare.el.src = BASE + 'lobby-b.mp3';
    const p = spare.el.play(); if (p && p.then) p.then(() => { if (spare !== cur) spare.el.pause(); }).catch(() => {});
  }
  const api = {
    get on() { return on; },
    get broken() { return broken; },
    get follow() { return follow; },
    get rolling() { return rolling; },
    get track() { return cur ? cur.name : null; },
    get time() { return cur ? cur.el.currentTime : 0; },
    get length() { return cur ? (isFinite(cur.el.duration) ? cur.el.duration : trackOf(cur.name).len) : 0; },
    get decks() { return decks.map(d => ({ name: d.name, mix: +d.mix.toFixed(2), to: d.to, time: +d.el.currentTime.toFixed(1), paused: d.el.paused, gain: d.gain ? +d.gain.gain.value.toFixed(3) : d.el.volume })); },
    onChange(fn) { listeners.push(fn); },
    skip() { if (cur) cur.el.currentTime = Math.max(0, api.length - 1); }, // the end of the piece playing (for tests)
    // The first click, tap or key: the music of where the visitor is (the entrance hall, unless a link
    // brought them further in).
    unlock() {
      if (unlocked) return; unlocked = true;
      if (!on || broken || rolling) return;
      run(); fromSet(zone());
    },
    // The credits: the main theme from its start, while they roll; then back to what was playing before
    // (the music of where the visitor stands, when following the hall). Paused music stays paused.
    credits(v) {
      if (v === rolling || broken) return;
      rolling = v;
      if (v) {
        followAfter = follow; follow = false; unlocked = true; turn.credits = 0;
        if (on) { run(); fromSet('credits', { quick: true }); } else changed();
      } else if (followAfter) api.setFollow(true);
      else changed();
    },
    // Pause keeps the place; playing again picks up where it left off.
    set(v) {
      on = v; store.music = v; save();
      if (!unlocked || broken) { changed(); return; }
      if (!v) { for (const d of decks) d.el.pause(); changed(); return; }
      run();
      if (cur) { const p = cur.el.play(); if (p && p.catch) p.catch(() => {}); changed(); }
      else fromSet(rolling ? 'credits' : follow ? zone() : 'lobby');
    },
    // The visitor picks a piece: it plays now, and the list plays on in order from it.
    choose(name) {
      if (broken) return;
      unlocked = true; follow = false; followAfter = false;
      if (!on) { on = true; store.music = true; save(); }
      run(); play(name, { quick: true });
    },
    next() { if (broken) return; unlocked = true; follow = false; on = true; store.music = true; save(); run(); step(1); },
    prev() {
      if (broken) return; unlocked = true; follow = false; on = true; store.music = true; save(); run();
      if (cur && cur.el.currentTime > 4) { cur.el.currentTime = 0; const p = cur.el.play(); if (p && p.catch) p.catch(() => {}); changed(); } else step(-1); // as a player does: back to the start first
    },
    seek(frac) { if (cur && isFinite(cur.el.duration)) { cur.el.currentTime = Math.max(0, Math.min(0.999, frac)) * cur.el.duration; changed(); } },
    setFollow(v) {
      follow = v; if (rolling) followAfter = v; changed();
      if (v && on && unlocked && !broken && !rolling) { run(); const z = zone(); if (z !== playing) fromSet(z, { quick: true }); }
    },
  };
  document.addEventListener('visibilitychange', () => {
    if (!cur || !on) return;
    if (document.hidden) { cur.el.pause(); if (ctx) ctx.suspend(); }
    else { if (ctx) ctx.resume(); const p = cur.el.play(); if (p && p.catch) p.catch(() => {}); }
  });
  return api;
})();

/* The soundtrack panel: what is playing, pause, previous and next, a bar to seek with, Follow the hall or In
 * order, and every piece in the list. The music button opens and closes it. */
const musicBtn = $('#lm-musicBtn'), musicPanel = $('#lm-music');
function openMusic(on) {
  if (!musicPanel) return;
  musicPanel.hidden = !on; musicBtn.setAttribute('aria-expanded', String(on));
  if (on) { renderMusic(); const b = $('#lm-musicList [aria-current]') || $('#lm-musicPlay'); b.focus({ preventScroll: true }); if (b.scrollIntoView && b.closest('#lm-musicList')) b.closest('li').scrollIntoView({ block: 'nearest' }); }
  else if (musicPanel.contains(document.activeElement)) musicBtn.focus({ preventScroll: true });
}
function renderMusicBtn() {
  if (!musicBtn) return;
  const t = music.track && trackOf(music.track);
  musicBtn.classList.toggle('off', !music.on);
  musicBtn.setAttribute('aria-label', 'Soundtrack: ' + (!music.on ? 'paused' : t ? t.title : 'on'));
  musicBtn.title = !music.on ? 'Soundtrack (paused)' : t ? `${t.title} · ${t.take.toLowerCase()}` : 'Soundtrack';
}
function renderMusicNow() {
  const t = music.track && trackOf(music.track), len = music.length, at = music.time;
  $('#lm-musicNow').textContent = t ? t.title : 'Nothing playing yet';
  $('#lm-musicTake').textContent = t ? t.take : 'Press play, or pick a piece below';
  const seek = $('#lm-musicSeek');
  if (document.activeElement !== seek || !seek.dataset.drag) seek.value = len ? Math.round(1000 * at / len) : 0;
  seek.disabled = !t;
  seek.setAttribute('aria-valuetext', t ? `${clockOf(at)} of ${clockOf(len)}` : 'Not playing');
  $('#lm-musicAt').textContent = clockOf(at); $('#lm-musicLen').textContent = clockOf(len);
}
function renderMusic() {
  renderMusicBtn();
  if (!musicPanel || musicPanel.hidden) return;
  const playBtn = $('#lm-musicPlay'), playing = music.on && !!music.track;
  playBtn.classList.toggle('pause', playing);
  playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  $('#lm-musicFollow').setAttribute('aria-pressed', String(music.follow));
  $('#lm-musicOrder').setAttribute('aria-pressed', String(!music.follow));
  for (const b of musicPanel.querySelectorAll('#lm-musicList button')) {
    if (b.dataset.track === music.track) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    b.classList.toggle('paused', b.dataset.track === music.track && !music.on);
  }
  renderMusicNow();
}
if (musicBtn && musicPanel) {
  // The list, by wing.
  const list = $('#lm-musicList'), groups = {};
  for (const t of MUSIC_TRACKS) {
    if (!groups[t.set]) {
      const li = document.createElement('li'), h = document.createElement('h3'), r = document.createElement('span'), n = document.createElement('span'), ul = document.createElement('ul');
      const w = t.set[0] === 'w' ? +t.set[1] : -1;
      r.className = 'r'; r.textContent = w >= 0 ? ROMAN_WINGS[w + 1] : t.set === 'lobby' ? '⌂' : '★'; r.setAttribute('aria-hidden', 'true');
      n.textContent = w >= 0 ? `Wing ${ROMAN_WINGS[w + 1]}: ${MUSIC_WINGS[w]}` : t.set === 'lobby' ? 'The Entrance Hall' : 'Credits: Librarium (Main Theme)';
      h.append(r, n); li.append(h, ul); list.appendChild(li); groups[t.set] = ul;
    }
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.dataset.track = t.name;
    const eq = document.createElement('span'); eq.className = 'eq'; eq.setAttribute('aria-hidden', 'true'); eq.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
    const name = document.createElement('span'); name.className = 'tk'; name.textContent = t.take;
    const len = document.createElement('span'); len.className = 'len'; len.textContent = clockOf(t.len);
    b.append(eq, name, len);
    b.setAttribute('aria-label', `${t.title}, ${t.take.toLowerCase()}, ${clockOf(t.len)}`);
    b.addEventListener('click', () => music.choose(t.name));
    li.appendChild(b); groups[t.set].appendChild(li);
  }
  musicBtn.addEventListener('click', () => openMusic(musicPanel.hidden));
  $('#lm-musicClose').addEventListener('click', () => openMusic(false));
  $('#lm-musicPlay').addEventListener('click', () => music.set(!(music.on && music.track)));
  $('#lm-musicPrev').addEventListener('click', () => music.prev());
  $('#lm-musicNext').addEventListener('click', () => music.next());
  $('#lm-musicFollow').addEventListener('click', () => music.setFollow(true));
  $('#lm-musicOrder').addEventListener('click', () => { if (music.follow) music.setFollow(false); });
  const seek = $('#lm-musicSeek');
  seek.addEventListener('pointerdown', () => { seek.dataset.drag = '1'; });
  seek.addEventListener('change', () => { delete seek.dataset.drag; music.seek(seek.value / 1000); });
  seek.addEventListener('input', () => { $('#lm-musicAt').textContent = clockOf(seek.value / 1000 * music.length); });
  // Keys stay in the panel (arrows seek rather than walk); Esc closes it.
  musicPanel.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); openMusic(false); }
    e.stopPropagation();
  });
  music.onChange(renderMusic);
  setInterval(() => { if (!musicPanel.hidden) renderMusicNow(); }, 500);
  renderMusic();
}
['pointerdown', 'keydown'].forEach(t => root.addEventListener(t, () => music.unlock(), { once: true, capture: true }));
