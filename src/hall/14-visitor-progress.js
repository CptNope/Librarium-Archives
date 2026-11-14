/* ---------------------------------------------------- visitor progress
 * Kept in this browser only: exhibits visited, rules already shown, the
 * Scribe's level and the visitor's record at each table. */
const STORE_KEY = 'librarium.archives.v1';
const store = (() => {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { d = {}; }
  d.visited = d.visited || {}; d.record = d.record || {}; d.rulesSeen = d.rulesSeen || {};
  return d;
})();
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* storage blocked: progress lasts for this visit only */ } }
function recordText(id) {
  const r = store.record[id]; if (!r) return '';
  const [w, l, d] = r;
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  return `Your record against the Scribe here: ${n(w, 'win', 'wins')}, ${n(l, 'loss', 'losses')}${d ? ', ' + n(d, 'draw', 'draws') : ''}.`;
}

