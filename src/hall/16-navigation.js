/* ------------------------------------------------------------- navigation
 * The bar along the bottom: wing tabs, the exhibits of the wing you are in,
 * previous and next, and an index of every exhibit with search and filters. */
const rail = $('#lm-rail');
const ROMAN_WINGS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
const WINGS = [1, 2, 3, 4, 5, 6].map(n => {
  const intro = STOPS.findIndex(x => x.wing === n && (x.id === 'hall' || x.id === 'wing' + n));
  return { n, roman: ROMAN_WINGS[n], intro, title: STOPS[intro].title, dates: n === 1 ? 'c. 3100 – 2000 BCE' : STOPS[intro].date };
});
const railButtons = []; // one per stop, in STOPS order
let railWing = 0;
const wingTabs = WINGS.map(w => {
  const b = document.createElement('button');
  b.className = 'wingtab'; b.textContent = w.roman;
  b.setAttribute('aria-label', `Wing ${w.roman}: ${w.title}`); b.title = `Wing ${w.roman} · ${w.title}`;
  b.addEventListener('click', () => goStop(w.intro));
  $('#lm-wings').appendChild(b); return b;
});
STOPS.forEach((s, i) => {
  const isIntro = WINGS.some(w => w.intro === i);
  const b = document.createElement('button');
  b.className = 'stop' + (isIntro ? ' intro' : '') + (s.game ? ' playable' : '');
  b.innerHTML = '<span class="t"></span><span class="d"></span><span class="sr"></span>';
  b.querySelector('.t').textContent = isIntro ? (s.id === 'hall' ? 'Entrance' : s.title) : s.rail;
  b.querySelector('.d').textContent = isIntro ? `Wing ${ROMAN_WINGS[s.wing]}` : s.date;
  b.querySelector('.sr').textContent = (s.game ? ', a table you can play' : '') + ', visited';
  if (store.visited[s.id]) b.classList.add('seen');
  b.dataset.wing = s.wing;
  b.addEventListener('click', () => goStop(i));
  $('#lm-stops').appendChild(b); railButtons.push(b);
});
function showRailWing(n) {
  if (railWing === n) return;
  railWing = n;
  wingTabs.forEach((b, k) => { const on = k + 1 === n; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'true' : 'false'); });
  railButtons.forEach(b => { b.hidden = +b.dataset.wing !== n; });
  $('#lm-stops').scrollLeft = 0;
}
function stepStop(d) { if (mode !== 'gallery') return; const i = Math.max(0, Math.min(STOPS.length - 1, (current < 0 ? 0 : current) + d)); if (i !== current) goStop(i); }
$('#lm-prev').addEventListener('click', () => stepStop(-1));
$('#lm-next').addEventListener('click', () => stepStop(1));

// The index: every exhibit, grouped by wing.
const index = $('#lm-index'), indexBtn = $('#lm-indexBtn'), indexSearch = $('#lm-indexSearch');
let indexFilter = 'all';
function renderIndex() {
  const q = indexSearch.value.trim().toLowerCase(), cols = $('#lm-indexCols');
  cols.innerHTML = '';
  let shown = 0;
  const seenAll = STOPS.filter(s => store.visited[s.id]).length;
  $('#lm-indexCount').textContent = `${seenAll} of ${STOPS.length} visited`;
  for (const w of WINGS) {
    const items = STOPS.map((s, i) => [s, i]).filter(([s]) => s.wing === w.n)
      .filter(([s]) => indexFilter !== 'play' || s.game)
      .filter(([s]) => indexFilter !== 'new' || !store.visited[s.id])
      .filter(([s]) => !q || [s.title, s.short, s.rail, s.eyebrow, s.date, ...s.facts.flat()].join(' ').toLowerCase().includes(q));
    if (!items.length) continue;
    const col = document.createElement('section'); col.className = 'indexwing';
    const seen = STOPS.filter(s => s.wing === w.n && store.visited[s.id]).length, total = STOPS.filter(s => s.wing === w.n).length;
    const h = document.createElement('h3');
    h.innerHTML = '<span class="r"></span><span class="n"></span><span class="dd"></span>';
    h.querySelector('.r').textContent = w.roman; h.querySelector('.n').textContent = w.title;
    h.querySelector('.dd').textContent = `${w.dates} · ${seen} of ${total} visited`;
    col.appendChild(h);
    const ul = document.createElement('ul');
    for (const [s, i] of items) {
      const li = document.createElement('li'), b = document.createElement('button');
      b.className = (store.visited[s.id] ? 'seen' : '') + (i === current ? ' on' : '');
      b.innerHTML = '<span class="t"></span><span class="d"></span>';
      b.querySelector('.t').textContent = s.id === 'hall' ? 'Entrance' : s.title;
      b.querySelector('.d').textContent = (s.id === 'hall' || s.id === 'wing' + s.wing) ? 'Wing introduction' : s.date;
      if (s.game) { const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = 'Play'; b.appendChild(tag); }
      if (store.visited[s.id]) { const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = ', visited'; b.appendChild(sr); }
      b.addEventListener('click', () => { openIndex(false); goStop(i); });
      li.appendChild(b); ul.appendChild(li); shown++;
    }
    col.appendChild(ul); cols.appendChild(col);
  }
  $('#lm-indexNone').hidden = shown > 0;
}
