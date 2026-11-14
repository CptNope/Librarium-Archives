/* ------------------------------------------------- read aloud and the tour
 * The browser's own speech synthesis reads placards: no audio files and no
 * outside service. Where it is missing, the button does not appear and the
 * tour simply pauses long enough to read each placard. */
const narrator = (() => {
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let job = 0, speaking = false;
  const voice = () => { const vs = synth.getVoices(); return vs.find(v => /en-GB/i.test(v.lang) && /female|serena|kate|libby|sonia/i.test(v.name)) || vs.find(v => /^en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null; };
  return {
    ok: !!synth,
    get speaking() { return speaking; },
    // Long texts are spoken a sentence or two at a time: some browsers cut one long utterance short.
    say(text) {
      if (!synth) return Promise.resolve(false);
      synth.cancel(); const my = ++job; speaking = true;
      const parts = text.match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g) || [text];
      return new Promise(done => {
        let k = 0;
        const next = () => {
          if (my !== job) { done(false); return; }
          if (k >= parts.length) { speaking = false; done(true); return; }
          const u = new SpeechSynthesisUtterance(parts[k++].trim()); const v = voice(); if (v) u.voice = v;
          u.rate = 0.96; u.onend = next; u.onerror = () => { if (my === job) { speaking = false; done(false); } };
          synth.speak(u);
        };
        next();
      });
    },
    stop() { job++; speaking = false; if (synth) synth.cancel(); document.querySelectorAll('#lm-app .readBtn').forEach(b => { b.setAttribute('aria-pressed', 'false'); if (b.lastChild) b.lastChild.textContent = 'Read aloud'; }); },
  };
})();
function placardSpeech(s) {
  const head = s.id === 'hall' ? s.title : `${s.title}. ${s.eyebrow}, ${s.date}.`;
  return [head, ...s.body, s.game && s.note ? s.note : ''].filter(Boolean).join(' ');
}
// The tour walks the hall from wherever you stand, reading each placard, until you stop it or reach the end.
const tour = { on: false, driving: false, token: 0 };
const tourBtn = $('#lm-tourBtn');
function setTourButton() { tourBtn.setAttribute('aria-pressed', String(tour.on)); tourBtn.lastChild.textContent = tour.on ? 'Stop tour' : 'Tour'; }
async function runTour() {
  const my = ++tour.token;
  tour.on = true; setTourButton();
  let i = current;
  while (tour.on && my === tour.token && i < STOPS.length) {
    tour.driving = true; goStop(i); tour.driving = false;
    await wait(reduceMotion ? 300 : 1800); // let the camera arrive
    if (!tour.on || my !== tour.token) return;
    const text = placardSpeech(STOPS[i]);
    const spoke = narrator.ok && store.sound !== false ? await narrator.say(text) : false;
    if (!tour.on || my !== tour.token) return;
    if (!spoke) await wait(Math.min(26000, Math.max(6000, text.split(/\s+/).length * 240))); // time to read it yourself
    else await wait(900);
    i++;
  }
  if (my === tour.token) stopTour();
}
function stopTour() { if (!tour.on) return; tour.on = false; tour.token++; narrator.stop(); setTourButton(); }
tourBtn.addEventListener('click', () => { if (tour.on) stopTour(); else if (mode === 'gallery') { openIndex(false); openPassport(false); runTour(); } });
// On phones the placard is a bottom sheet, so the picture slides up to stay visible above it.
let viewShift = 0;
function updateViewShift(dt) {
  const { w, h } = hostSize();
  const want = mode === 'gallery' && placardOpen && w <= 720 ? 0.26 : 0;
  viewShift += (want - viewShift) * Math.min(1, dt * 6);
  if (Math.abs(viewShift) < 0.002) { if (camera.view && camera.view.enabled) camera.clearViewOffset(); viewShift = want ? viewShift : 0; return; }
  camera.setViewOffset(w, h, 0, h * viewShift, w, h);
}
function setActive(i) {
  current = i;
  showRailWing(STOPS[i].wing);
  railButtons.forEach((b, k) => { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'location'); else b.removeAttribute('aria-current'); });
  $('#lm-prev').disabled = i <= 0; $('#lm-next').disabled = i >= STOPS.length - 1;
  // Scroll the strip sideways only; scrollIntoView would also scroll the host page.
  const strip = $('#lm-stops'), b = railButtons[i], left = b.offsetLeft - strip.offsetLeft - strip.clientWidth / 2 + b.offsetWidth / 2;
  strip.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? 'auto' : 'smooth' });
}
function goStop(i, fly = true) {
  if (mode !== 'gallery') return;
  buildExhibit(STOPS[i]);
  if (tour.on && !tour.driving) stopTour();
  setActive(i);
  if (!store.visited[STOPS[i].id]) { store.visited[STOPS[i].id] = true; save(); railButtons[i].classList.add('seen'); }
  renderPlacard(STOPS[i]); showPlacard(true);
  if (fly) { const v = stopView(STOPS[i]); view.zoomTo = 1; flyTo(v.pos, v.target); }
}
$('#lm-closeP').addEventListener('click', () => showPlacard(false));

// Full screen, where the browser allows it (a phone or an embedded viewer may not).
