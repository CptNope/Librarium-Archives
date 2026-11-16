/* ------------------------------------------------------------- sound
 * Every sound is made on the spot with the Web Audio API, so there are no
 * audio files to license or load. Nothing plays until the visitor's first
 * click, tap or key, as browsers require; the speaker button mutes it all. */
const sfx = (() => {
  let ctx = null, master = null, noiseBuf = null, room = null, crackle = null;
  let on = store.sound !== false;
  function make() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function ready() { if (!on) return false; if (!ctx && !make()) return false; if (ctx.state === 'suspended') ctx.resume(); return true; }
  // A filtered burst of noise: knocks, clicks and rattles.
  function burst(t, { dur = 0.05, freq = 2000, q = 3, gain = 0.4, type = 'bandpass' } = {}) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); const at = ctx.currentTime + t;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(at, Math.random() * 1.5); src.stop(at + dur + 0.02);
  }
  // A short pitched note with a fast decay: wood, stone, bells.
  function tone(t, { freq = 440, dur = 0.25, gain = 0.2, type = 'sine', bend = 1 } = {}) {
    const o = ctx.createOscillator(); o.type = type;
    const g = ctx.createGain(); const at = ctx.currentTime + t;
    o.frequency.setValueAtTime(freq, at); if (bend !== 1) o.frequency.exponentialRampToValueAtTime(freq * bend, at + dur);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g); g.connect(master); o.start(at); o.stop(at + dur + 0.02);
  }
  // Room tone: a low hush, with now and then a candle crackling.
  function startRoom() {
    if (room || !ready()) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2.5);
    src.connect(lp); lp.connect(g); g.connect(master); src.start();
    room = { src, g };
    const tick = () => {
      if (!room) return;
      if (on && !document.hidden) { const n = 1 + ((Math.random() * 3) | 0); for (let k = 0; k < n; k++) burst(k * 0.03 + Math.random() * 0.02, { dur: 0.02, freq: 2500 + Math.random() * 2500, q: 1, gain: 0.025 }); }
      crackle = setTimeout(tick, 900 + Math.random() * 3200);
    };
    tick();
  }
  function stopRoom() { if (!room) return; const r = room; room = null; clearTimeout(crackle); r.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); setTimeout(() => { try { r.src.stop(); } catch (e) { /* already stopped */ } }, 500); }
  const api = {
    get on() { return on; },
    unlock() { if (on) startRoom(); },
    set(v) { on = v; store.sound = v; save(); if (v) startRoom(); else stopRoom(); },
    // Senet's throwing sticks clatter; dice rattle and settle.
    roll(g) {
      if (!ready()) return;
      if (g.id === 'senet') { for (let k = 0; k < 4; k++) { burst(k * 0.045 + Math.random() * 0.02, { dur: 0.07, freq: 1500 + Math.random() * 600, q: 6, gain: 0.5 }); tone(k * 0.045, { freq: 380 + Math.random() * 120, dur: 0.06, gain: 0.08, type: 'triangle' }); } return; }
      const n = g.id === 'ur' ? 5 : 8;
      for (let k = 0; k < n; k++) burst(k * 0.035 + Math.random() * 0.02, { dur: 0.03, freq: 2800 + Math.random() * 1600, q: 4, gain: 0.35 });
      burst(n * 0.04, { dur: 0.08, freq: 900, q: 2, gain: 0.35 });
    },
    // A piece set down: wood by default, stone for Go, a pencil stroke for Dots and Boxes.
    move(g, m, res) {
      if (!ready() || !m || m.pass || g.id === 'tarocchi') return;
      const caps = (res && ((res.caps && res.caps.length) || (res.boxes && res.boxes.length))) || 0;
      if (g.id === 'go') { burst(0, { dur: 0.04, freq: 3200, q: 5, gain: 0.45 }); tone(0, { freq: 1900, dur: 0.05, gain: 0.08 }); }
      else if (g.id === 'dotsboxes') burst(0, { dur: 0.16, freq: 5000, q: 0.8, gain: 0.12, type: 'highpass' });
      else if (g.id === 'reversi') { tone(0, { freq: 520, dur: 0.07, gain: 0.12, type: 'triangle' }); burst(0, { dur: 0.03, freq: 2600, q: 3, gain: 0.25 }); }
      else { tone(0, { freq: 210 + Math.random() * 40, dur: 0.12, gain: 0.22, type: 'triangle', bend: 0.8 }); burst(0, { dur: 0.03, freq: 1800, q: 2, gain: 0.25 }); }
      if (caps) for (let k = 0; k < Math.min(caps, 4); k++) { tone(0.14 + k * 0.09, { freq: 300, dur: 0.1, gain: 0.16, type: 'triangle', bend: 0.7 }); burst(0.14 + k * 0.09, { dur: 0.03, freq: 1400, q: 2, gain: 0.2 }); }
    },
    card() { if (ready()) burst(0, { dur: 0.12, freq: 3500, q: 0.7, gain: 0.18, type: 'highpass' }); },
    // Three rising bell notes for a win, two falling for a loss, one for a draw.
    end(winner) {
      if (!ready()) return;
      const notes = winner === 0 ? [523, 659, 784] : winner === 1 ? [392, 330] : [440];
      notes.forEach((f, k) => { tone(k * 0.16, { freq: f, dur: 0.9, gain: 0.12 }); tone(k * 0.16, { freq: f * 2.76, dur: 0.4, gain: 0.03 }); });
    },
  };
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (on) ctx.resume(); });
  return api;
})();
const soundBtn = $('#lm-soundBtn');
function renderSoundBtn() {
  soundBtn.setAttribute('aria-pressed', String(sfx.on));
  soundBtn.setAttribute('aria-label', sfx.on ? 'Sound on. Mute' : 'Sound off. Turn on');
  soundBtn.classList.toggle('off', !sfx.on);
}
soundBtn.addEventListener('click', () => { sfx.set(!sfx.on); renderSoundBtn(); });
renderSoundBtn();
// Browsers allow sound only after the visitor does something on the page.
['pointerdown', 'keydown'].forEach(t => root.addEventListener(t, () => sfx.unlock(), { once: true, capture: true }));
const fsBtn = $('#lm-fsBtn');
if (!document.fullscreenEnabled || !root.requestFullscreen) fsBtn.hidden = true;
fsBtn.addEventListener('click', () => {
  const p = document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen();
  if (p && p.catch) p.catch(() => {});
});
document.addEventListener('fullscreenchange', () => {
  const on = document.fullscreenElement === root;
  fsBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
  fsBtn.classList.toggle('on', on);
  setTimeout(resize, 50);
});

// The Scribe's level, chosen at any table and remembered.
const levelButtons = [...document.querySelectorAll('#lm-level button')];
function setScribeLevel(name) {
  name = R.setLevel(name);
  store.level = name; save();
  levelButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.level === name)));
}
levelButtons.forEach(b => b.addEventListener('click', () => setScribeLevel(b.dataset.level)));
setScribeLevel(store.level || 'fair');
// Some tables offer variants (a bigger grid, say). Choosing one restarts the game.
function toggleOn(g, t) { const v = ((store.toggles || {})[g.id] || {})[t.id]; return v === undefined ? !!t.default : !!v; }
// Pass-and-play: two visitors share the screen at a two-player table with nothing hidden.
const HOTSEAT = new Set(['go', 'morris', 'oware', 'brandubh', 'shatranj', 'draughts', 'reversi', 'dotsboxes', 'halma', 'alquerque', 'xiangqi', 'mutorere', 'konane', 'fanorona', 'chess', 'shogi', 'bao', 'hex', 'gomoku', 'tablut', 'makruk', 'kalah', 'morabaraba', 'janggi', 'chaturanga', 'seega', 'baghchal', 'latrunculi', 'rithmo', 'jungle', 'lewischess', 'courier', 'idraughts', 'hnefatafl',
  // dice games too: each player throws for themselves
  'ur', 'senet', 'tables', 'goose', 'snakes', 'yut', 'pachisi', 'ludo', 'tab', 'hounds', 'patolli', 'mansion', 'lifegame', 'nard', 'xii', 'hazard', 'landlord']);
const friendOn = g => HOTSEAT.has(g.id) && ((store.opponent || {})[g.id] === 'friend');
function restartTable() { const ex = play.ex; clearSave(play.game.id); play.token++; clearHighlights(); clearLastMove(); mode = 'gallery'; startGame(ex); }
function renderVariants(g) {
  const box = $('#lm-variant'); box.innerHTML = '';
  box.hidden = !g.variants && !g.toggles && !HOTSEAT.has(g.id) && !play.resumed;
  $('#lm-level').hidden = friendOn(g);
  if (HOTSEAT.has(g.id)) {
    const label = document.createElement('span'); label.textContent = 'Opponent'; box.appendChild(label);
    for (const [id, text] of [['scribe', 'The Scribe'], ['friend', 'A friend']]) {
      const b = document.createElement('button'); b.textContent = text; b.setAttribute('aria-pressed', String((friendOn(g) ? 'friend' : 'scribe') === id));
      b.addEventListener('click', () => { if ((friendOn(g) ? 'friend' : 'scribe') === id) return; store.opponent = Object.assign(store.opponent || {}, { [g.id]: id }); save(); restartTable(); });
      box.appendChild(b);
    }
  }
  if (play.resumed) { const b = document.createElement('button'); b.textContent = 'New game'; b.addEventListener('click', restartTable); box.appendChild(b); }
  // On-off rules, such as Hex's swap rule. Changing one restarts the game, like a variant.
  for (const t of g.toggles || []) {
    const on = toggleOn(g, t), b = document.createElement('button');
    b.textContent = `${t.label}: ${on ? 'on' : 'off'}`; b.setAttribute('aria-pressed', String(on));
    b.addEventListener('click', () => {
      store.toggles = store.toggles || {}; store.toggles[g.id] = Object.assign(store.toggles[g.id] || {}, { [t.id]: !on }); save();
      restartTable();
    });
    box.appendChild(b);
  }
  if (!g.variants) return;
  const label = document.createElement('span'); label.textContent = g.variantLabel || 'Size'; box.appendChild(label);
  for (const v of g.variants) {
    const b = document.createElement('button'); b.textContent = v.label; b.setAttribute('aria-pressed', String(v.id === g.variant));
    b.addEventListener('click', () => {
      if (v.id === g.variant) return;
      store.variants = Object.assign(store.variants || {}, { [g.id]: v.id }); save();
      restartTable();
    });
    box.appendChild(b);
  }
}
$('#lm-helpBtn').addEventListener('click', () => { if (mode === 'gallery') goStop(0); else $('#lm-rules').hidden = !$('#lm-rules').hidden; });

