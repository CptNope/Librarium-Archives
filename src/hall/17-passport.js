/* ------------------------------------------------------------- passport */
const passport = $('#lm-passport'), passBtn = $('#lm-passBtnRail');
const SEAL = ['Gentle', 'Fair', 'Sharp'];
function renderPassport() {
  const cols = $('#lm-passCols'); cols.innerHTML = '';
  const exhibits = STOPS.filter(s => s.id !== 'hall' && s.id !== 'next' && !/^wing\d$/.test(s.id)); // wing entrances and the lectern carry no stamp
  const tables = STOPS.filter(s => s.game), seen = exhibits.filter(s => store.visited[s.id]).length;
  const played = tables.filter(s => (store.record[s.game] || [0, 0, 0]).some(Boolean)).length;
  const won = tables.filter(s => (store.record[s.game] || [0])[0] > 0).length;
  const golds = tables.filter(s => (store.best || {})[s.game] === 2).length;
  $('#lm-passCount').textContent = `${seen} of ${exhibits.length} exhibits visited · ${played} of ${tables.length} tables played · ${won} won${golds ? ` (${golds} at Sharp)` : ''}`;
  for (const w of WINGS) {
    const col = document.createElement('section'); col.className = 'indexwing';
    const items = STOPS.map((s, i) => [s, i]).filter(([s]) => s.wing === w.n && s.id !== 'hall' && s.id !== 'wing' + w.n && s.id !== 'next');
    if (!items.length) continue;
    const h = document.createElement('h3'); h.innerHTML = '<span class="r"></span><span class="n"></span><span class="dd"></span>';
    h.querySelector('.r').textContent = w.roman; h.querySelector('.n').textContent = w.title;
    h.querySelector('.dd').textContent = `${items.filter(([s]) => store.visited[s.id]).length} of ${items.length} stamped`;
    col.appendChild(h);
    const ul = document.createElement('ul'); ul.className = 'stamps';
    for (const [s, i] of items) {
      const li = document.createElement('li'), b = document.createElement('button'), visited = !!store.visited[s.id];
      const best = s.game && store.best ? store.best[s.game] : undefined, rec = s.game ? store.record[s.game] : null;
      b.className = 'stamp' + (visited ? ' seen' : '');
      b.innerHTML = '<span class="ring"></span><span class="l"></span>';
      b.querySelector('.ring').textContent = (s.rail || s.title).replace(/^The /, '').replace(/\(.*?\)/g, '').split(/[\s-]+/).map(x => x.replace(/[^\p{L}]/gu, '')).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
      if (best !== undefined) { const seal = document.createElement('span'); seal.className = 'seal s' + best; seal.textContent = 'WON'; b.querySelector('.ring').appendChild(seal); }
      b.querySelector('.l').textContent = s.rail || s.title;
      b.setAttribute('aria-label', `${s.title}: ${visited ? 'visited' : 'not visited yet'}${best !== undefined ? `, beaten at ${SEAL[best]}` : ''}${rec && rec.some(Boolean) ? `, record ${rec[0]} won, ${rec[1]} lost, ${rec[2]} drawn` : ''}`);
      b.addEventListener('click', () => { openPassport(false); goStop(i); });
      li.appendChild(b); ul.appendChild(li);
    }
    col.appendChild(ul); cols.appendChild(col);
  }
}
function openPassport(on) {
  if (on && mode !== 'gallery') return;
  if (on) openIndex(false);
  passport.hidden = !on; passBtn.setAttribute('aria-expanded', String(on));
  if (on) { renderPassport(); $('#lm-passClose').focus({ preventScroll: true }); } else if (document.activeElement && passport.contains(document.activeElement)) passBtn.focus({ preventScroll: true });
}
passBtn.addEventListener('click', () => openPassport(passport.hidden));
$('#lm-passClose').addEventListener('click', () => openPassport(false));
passport.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); openPassport(false); } });
function openIndex(on) {
  if (on) openPassport(false);
  if (on && mode !== 'gallery') return;
  index.hidden = !on; indexBtn.setAttribute('aria-expanded', String(on));
  rail.classList.toggle('indexing', on);
  if (on) { renderIndex(); indexSearch.focus({ preventScroll: true }); } else indexBtn.focus({ preventScroll: true });
}
indexBtn.addEventListener('click', () => openIndex(index.hidden));
$('#lm-indexClose').addEventListener('click', () => openIndex(false));
indexSearch.addEventListener('input', renderIndex);
indexSearch.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); const first = $('#lm-indexCols button'); if (first) first.click(); }
  if (e.key === 'Escape') { e.preventDefault(); openIndex(false); }
  e.stopPropagation(); // typing here should not walk around the hall
});
$('#lm-indexChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  indexFilter = b.dataset.f;
  $('#lm-indexChips').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  renderIndex();
});
function renderPlacard(s) {
  if (!tour.on) narrator.stop();
  const body = $('#lm-placardBody'); body.innerHTML = '';
  if (narrator.ok) {
    const rb = document.createElement('button'); rb.className = 'readBtn'; rb.setAttribute('aria-pressed', 'false');
    rb.innerHTML = '<svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true"><path d="M3 8h3l4-3v10l-4-3H3zM13 7a4 4 0 010 6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span>Read aloud</span>';
    rb.addEventListener('click', () => { if (narrator.speaking) { narrator.stop(); return; } rb.setAttribute('aria-pressed', 'true'); rb.lastChild.textContent = 'Stop'; narrator.say(placardSpeech(s)).then(() => { rb.setAttribute('aria-pressed', 'false'); rb.lastChild.textContent = 'Read aloud'; }); });
    body.appendChild(rb);
  }
  const el = (t, cls, txt) => { const e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; body.appendChild(e); return e; };
  el('div', 'eyebrow', s.eyebrow);
  el('h2', '', s.title);
  el('div', 'date', s.date);
  if (s.status) el('div', 'status ' + s.status[0], s.status[1]);
  s.body.forEach(p => el('p', '', p));
  if (s.games) {
    const ul = el('ul', 'gamelist');
    for (const gm of s.games) {
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = gm.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = gm.name;
      const p = document.createElement('span'); p.textContent = gm.text;
      li.append(a, p); ul.appendChild(li);
    }
  }
  if (s.facts.length) {
    const dl = el('dl', 'facts');
    s.facts.forEach(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); });
  }
  if (s.game) { const rec = recordText(s.game); if (rec) el('p', 'record', rec); }
  body.scrollTop = 0;
  const act = $('#lm-placardActions'); act.innerHTML = '';
  if (s.game) {
    if (s.note) { const n = document.createElement('span'); n.className = 'soon recon'; n.textContent = s.note; act.appendChild(n); } // e.g. that the table plays a modern reconstruction
    const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = 'Take a seat and play';
    b.addEventListener('click', () => startGame(s)); act.appendChild(b);
  } else if (s.link) {
    const a = document.createElement('a'); a.className = 'btn primary'; a.href = s.link[1]; a.target = '_blank'; a.rel = 'noopener'; a.textContent = s.link[0]; act.appendChild(a);
  } else if (s.begin) {
    const i = STOPS.findIndex(x => x.id === s.begin);
    const b = document.createElement('button'); b.className = 'btn primary'; b.textContent = 'Begin with ' + STOPS[i].rail;
    b.addEventListener('click', () => goStop(i)); act.appendChild(b);
  } else {
    const n = document.createElement('span'); n.className = 'soon'; n.textContent = s.note || 'On display only. The rules did not survive.'; act.appendChild(n);
  }
}
let placardOpen = false;
function showPlacard(on) { placardOpen = on; $('#lm-placard').classList.toggle('away', !on); updateJoy(); if (!on && !tour.on) narrator.stop(); }

