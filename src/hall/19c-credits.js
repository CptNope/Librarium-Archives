/* ------------------------------------------------------------- credits
 * The credits: a slow roll over the hall, set like the end of a film, while the main theme plays. It lists
 * who the Archives were made for, every exhibit wing by wing, the soundtrack, and what the hall is built
 * with. It rolls up by itself in about the length of the theme. Wheel, drag or keys move it, and it carries
 * on after a moment; Pause holds it. With reduced motion it does not roll at all: it is a page to scroll.
 * Opened from the lectern at the end of the hall and from the soundtrack panel; Esc or × closes it, and the
 * music goes back to where the visitor stands. */
const creditsBox = $('#lm-credits');
const credits = (() => {
  if (!creditsBox) return { open() {}, get on() { return false; } };
  const roll = $('#lm-creditsRoll'), body = $('#lm-creditsBody'), pauseBtn = $('#lm-creditsPause');
  const DURATION = 100; // seconds to roll from the title to the last card, about the main theme's first take
  const HOLD = 3.5;     // seconds a hand on the wheel, finger or key holds the roll before it carries on
  let built = false, on = false, paused = false, hold = 0, pos = 0, set = 0, last = 0, speed = 0, raf = 0, opener = null;

  // The roll's text. Everything listed is read from the hall's own data, so it stays true as exhibits change.
  function build() {
    if (built) return; built = true;
    const el = (tag, cls, text, parent = body) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent.appendChild(e); return e; };
    const head = el('header', 'crtitle');
    el('h2', null, 'Librarium', head).id = 'lm-creditsTitle';
    el('p', 'crsub', 'Archives', head);
    el('p', 'crtag', 'A playable history of board and card games', head);

    const block = (label) => { const s = el('section', 'crblock'); el('h3', 'crlabel', label, s); return s; };
    const pair = (s, role, name, href) => {
      const p = el('p', 'crpair', null, s); el('span', 'crrole', role, p);
      if (href) { const a = el('a', 'crname', name, p); a.href = href; a.target = '_blank'; a.rel = 'noopener'; } else el('span', 'crname', name, p);
    };

    const made = block('Made for');
    const next = STOPS.find(s => s.id === 'next');
    const house = el('a', 'crhouse', 'Librarium Games', made); house.href = 'https://librarium.games/'; house.target = '_blank'; house.rel = 'noopener';
    if (next && next.games) {
      const g = el('p', 'crgames', null, made);
      next.games.forEach((x, i) => { if (i) el('span', 'crdot', ' · ', g); el('span', null, x.name, g); });
    }

    const ex = block('The exhibits');
    for (let w = 1; w <= 6; w++) {
      const wing = el('div', 'crwing', null, ex);
      const h = el('h4', null, null, wing); el('span', 'crnum', ROMAN_WINGS[w], h); el('span', null, MUSIC_WINGS[w - 1], h);
      const ul = el('ul', null, null, wing);
      for (const s of STOPS) {
        if (s.wing !== w || !isExhibit(s)) continue;
        const li = el('li', null, null, ul); el('span', 'crex', s.title, li); el('span', 'crdate', s.date, li);
      }
    }

    const mu = block('The soundtrack');
    const pieces = el('ul', 'crpieces', null, mu);
    for (const t of MUSIC_TRACKS) if (t.take === 'First take') el('li', null, t.title, pieces);
    el('p', 'crnote', 'Two takes of each, made with Suno for Librarium Games', mu);

    const tools = block('Built with');
    pair(tools, 'The hall', 'three.js', 'https://threejs.org/');
    pair(tools, 'The lettering', 'Almendra SC, Amethysta and Montserrat');
    pair(tools, 'Online play', 'Cloudflare Workers');

    const by = block('Design and development');
    pair(by, 'Built by', 'Jeremy Anderson Tech', 'https://jeremyanderson.tech/');

    const end = el('section', 'crend');
    el('p', 'crmark', 'Librarium', end);
    el('p', 'crthanks', 'Thank you for visiting', end);
    const back = el('button', 'btn', 'Back to the hall', end); back.type = 'button'; back.id = 'lm-creditsBack';
    back.addEventListener('click', () => open(false));
  }

  // The roll starts with the title low on the screen and ends with the last card in the middle.
  function measure() {
    const h = roll.clientHeight, endCard = body.lastElementChild;
    body.style.paddingTop = Math.round(h * 0.62) + 'px';
    body.style.paddingBottom = Math.max(0, Math.round(h / 2 - (endCard ? endCard.offsetHeight / 2 : 0))) + 'px';
    speed = Math.max(12, (roll.scrollHeight - h) / DURATION);
  }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
    if (paused || reduceMotion) return;
    // Moved some other way (a scrollbar, a screen reader, a script): the roll holds there, then carries on.
    if (Math.abs(roll.scrollTop - set) > 2) { hold = HOLD; set = roll.scrollTop; }
    if (hold > 0) { hold -= dt; pos = set = roll.scrollTop; return; }
    const max = roll.scrollHeight - roll.clientHeight;
    if (pos >= max) return; // the end: the last card stays
    pos = Math.min(max, pos + speed * dt);
    roll.scrollTop = pos; set = roll.scrollTop;
  }
  const nudge = () => { hold = HOLD; };
  function setPaused(v) {
    paused = v; pauseBtn.setAttribute('aria-pressed', String(v));
    pauseBtn.textContent = v ? 'Roll on' : 'Pause';
    if (!v) pos = set = roll.scrollTop;
  }
  function open(v) {
    if (v === on) return;
    on = v;
    if (v) {
      opener = document.activeElement;
      stopTour(); narrator.stop();
      if (typeof openMusic === 'function') openMusic(false);
      build();
      creditsBox.hidden = false; root.classList.add('crediting');
      measure(); roll.scrollTop = pos = set = 0; hold = 0; last = 0;
      setPaused(reduceMotion); pauseBtn.hidden = reduceMotion;
      music.credits(true);
      $('#lm-creditsClose').focus({ preventScroll: true });
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
      creditsBox.hidden = true; root.classList.remove('crediting');
      music.credits(false);
      if (opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
    }
  }
  roll.addEventListener('wheel', nudge, { passive: true });
  roll.addEventListener('touchstart', nudge, { passive: true });
  roll.addEventListener('pointerdown', nudge);
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  $('#lm-creditsClose').addEventListener('click', () => open(false));
  // Keys stay here (arrows move the roll rather than walk the hall); Esc closes.
  creditsBox.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); open(false); return; }
    const step = { ArrowDown: 60, ArrowUp: -60, PageDown: roll.clientHeight * 0.8, PageUp: -roll.clientHeight * 0.8, ' ': roll.clientHeight * 0.8, Home: -1e6, End: 1e6 }[e.key];
    if (step == null || e.target.closest('button,a') && e.key === ' ') return;
    e.preventDefault(); nudge(); roll.scrollTop += step; pos = set = roll.scrollTop;
  });
  window.addEventListener('resize', () => { if (on) { const f = roll.scrollTop / Math.max(1, roll.scrollHeight); measure(); roll.scrollTop = pos = f * roll.scrollHeight; set = roll.scrollTop; } });
  return { open, get on() { return on; } };
})();
const creditsBtn = $('#lm-musicCredits');
if (creditsBtn) creditsBtn.addEventListener('click', () => credits.open(true));
