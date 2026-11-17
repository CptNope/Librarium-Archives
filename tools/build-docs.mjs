#!/usr/bin/env node
// Writes docs/games/: a page for every exhibit, and an index, from the sources themselves (the placards in
// src/hall/09-exhibit-data.js, the rule engines in js/rules.js, the feature lists in the hall code) and from
// the per-game notes in docs/exhibits.md and docs/scribe.md. Run after changing any of them:
//   node tools/build-docs.mjs           write the pages
//   node tools/build-docs.mjs --check   exit 1 if a page is out of date (CI runs this)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { FAMILIES, ALIASES, FLOWS, PACKS, NOTES, WIN } from './docs-data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/games');
const CHECK = process.argv.includes('--check');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const R = createRequire(import.meta.url)(join(ROOT, 'js/rules.js'));

/* ----------------------------------------------------------------- sources */
// The placards. Model builders are code, so they are swapped for their names before the data is evaluated.
const STOPS = new Function(read('src/hall/09-exhibit-data.js')
  .replace(/build: *([A-Za-z_$][\w$]*)/g, (m, name) => `build: ${JSON.stringify(name)}`) + ';return STOPS;')();
const EXHIBITS = STOPS.filter(s => !s.begin && s.id !== 'next');
const WINGS = STOPS.filter(s => s.begin || s.id === 'hall');
const WING_NAME = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

const hallSrc = readdirSync(join(ROOT, 'src/hall')).filter(f => f.endsWith('.js')).map(f => ({ f: 'src/hall/' + f, s: read('src/hall/' + f) }));
const rulesSrc = readdirSync(join(ROOT, 'src/rules')).filter(f => f.endsWith('.js')).map(f => ({ f: 'src/rules/' + f, s: read('src/rules/' + f) }));
const all = hallSrc.map(x => x.s).join('\n');
const setOf = name => { const m = all.match(new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]`)); if (!m) throw new Error('no ' + name); return new Set([...m[1].matchAll(/'([\w-]+)'/g)].map(x => x[1])); };
const UNDO = setOf('UNDO_OK'), SAVE = setOf('SAVE_OK'), HOT = setOf('HOTSEAT'), DICE_HINT = setOf('DICE_HINT');
const NO_HINT = new Set([...all.match(/const canHint = [^\n]*?\[([^\]]*)\]\.includes/)[1].matchAll(/'([\w-]+)'/g)].map(x => x[1]));
const PACK_TABLES = Object.fromEntries([...all.match(/const PACK_TABLES = \{([^}]*)\}/)[1].matchAll(/(\w+): '(\w+)'/g)].map(x => [x[1], x[2]]));
const canHint = g => !!g.aiPlan && (g.dice ? DICE_HINT.has(g.id) : !NO_HINT.has(g.id));
const PRES = Object.fromEntries([...all.match(/const PRES = \{([\s\S]*?)\};/)[1].matchAll(/(\w+): ([\w$]+)(?:\(([\w$]+)\))?/g)].map(x => [x[1], x[2] === 'racePresenter' ? 'racePresenter' : x[2]]));
const fileDefining = (src, re) => (src.find(x => re.test(x.s)) || {}).f;
const rulesFile = id => fileDefining(rulesSrc, new RegExp(`id: '${id}'`));
const presFile = id => PRES[id] && fileDefining(hallSrc, new RegExp(PRES[id] === 'racePresenter' ? 'function racePresenter\\(' : `const ${PRES[id].replace('$', '\\$')} = `));
const buildFile = name => name && fileDefining(hallSrc, new RegExp(`function ${name}\\(`));

// Per-game notes already written in the docs: rule-choice bullets and table rows in the exhibits guide,
// and the Scribe's tables.
const norm = s => s.normalize('NFC').toLowerCase().replace(/\(.*?\)/g, '').replace(/[*:.]/g, '').replace(/^the /, '').replace(/\s+/g, ' ').trim();
const namesOf = st => {
  const g = st.game && R[st.game];
  return new Set([st.title, st.short, st.rail, g && g.name, ...(ALIASES[st.id] || [])].filter(Boolean).map(norm));
};
const exhibitsMd = read('docs/exhibits.md'), scribeMd = read('docs/scribe.md');
const bullets = [...exhibitsMd.matchAll(/^- \*\*([^*]+)\*\*(.*)$/gm)].map(m => ({ names: m[1].split(/,| and /).map(norm), text: m[0].slice(2) }));
function tables(md) { // every markdown table, with the section it sits in
  const out = []; let section = '', head = null;
  for (const line of md.split('\n')) {
    if (/^#+ /.test(line)) { section = line.replace(/^#+ /, ''); head = null; continue; }
    if (!line.startsWith('|')) { head = null; continue; }
    const cells = line.slice(1, -1).split('|').map(c => c.trim());
    if (/^:?-+:?$/.test(cells[0])) continue;
    if (!head) { head = cells; continue; }
    out.push({ section, head, cells, names: cells[0].split(/,| · /).map(norm) });
  }
  return out;
}
const exRows = tables(exhibitsMd).filter(r => r.head[0] === 'Exhibit'), scribeRows = tables(scribeMd).filter(r => r.head[0] === 'Game');
const factRows = tables(read('docs/fact-check.md')).filter(r => r.head[0] === 'Placard');
// The Scribe guide's mindmap sorts the games by the Scribe's method: a category, lines describing it, and
// lines naming games (joined by ' · ').
const METHOD = new Map();
{
  const mm = scribeMd.match(/```mermaid\nmindmap\n([\s\S]*?)```/)[1].split('\n');
  let cat = null;
  for (const line of mm) {
    const m = line.match(/^( *)(\S.*)$/); if (!m) continue;
    if (m[1].length === 4) { cat = { name: m[2], about: [] }; continue; }
    if (m[1].length !== 6 || !cat) continue;
    const parts = m[2].split(' · ').map(norm);
    if (parts.length > 1 || EXHIBITS.some(st => namesOf(st).has(parts[0]))) parts.forEach(p => METHOD.set(p, cat));
    else cat.about.push(m[2]);
  }
}
const methodOf = st => { for (const n of namesOf(st)) if (METHOD.has(n)) return METHOD.get(n); return null; };
const mine = (rows, st) => { const n = namesOf(st); return rows.filter(r => r.names.some(x => n.has(x))); };

/* ----------------------------------------------------------------- helpers */
const familyOf = id => FAMILIES.find(f => f[2].includes(id));
const slug = id => id + '.md';
const q = s => String(s).replace(/"/g, '#quot;').replace(/[<>]/g, '');
const cell = s => String(s).replace(/\|/g, '\\|');
const fact = (st, ...keys) => { for (const k of keys) { const f = (st.facts || []).find(x => x[0] === k); if (f) return f[1]; } return null; };
const statusText = st => (st.status ? st.status[1] : '');
const yes = b => (b ? 'Yes' : 'No');

function flowFor(st, g) {
  if (FLOWS[g.id]) return FLOWS[g.id];
  const goal = fact(st, 'Goal', 'Win') || WIN[g.id], opp = HOT.has(g.id) ? 'The Scribe, or a friend,' : 'The Scribe';
  const L = ['flowchart TD'];
  if (g.first === 1) L.push(`    B(["${q(opp.replace(',', ''))} moves first"]) --> N`);
  const win = goal ? `"${q(goal)}?"` : '"Is the game won?"';
  if (g.dice) {
    const how = fact(st, 'Moves', 'Dice', 'Throws', 'Sticks') || 'the dice';
    L.push(`    S(["Your turn"]) --> T["Throw: ${q(how)}"]`, `    T --> M{"A legal move?"}`, `    M -->|no| N`, `    M -->|yes| C["Pick a piece; where it would land is ringed"]`, `    C --> V["Move it"]`);
    let at = 'V';
    if (g.followPrompt !== undefined && !g.SEATS) { L.push(`    ${at} --> U{"Dice left to use?"}`, '    U -->|yes| C'); at = 'U'; L.push(`    U -->|no| X`); } else L.push(`    ${at} --> X`);
    const extra = (g.extraNote || '').replace(/\s*Throw again\.?/i, '').replace(/[:.]$/, '');
    if (extra) L.push(`    X{"Another throw? ${q(extra)}"} -->|yes| T`, `    X -->|no| W{${win}}`);
    else L.push(`    X{${win}}`);
    const w = extra ? 'W' : 'X';
    L.push(`    ${w} -->|yes| E(["You win"])`, `    ${w} -->|no| N["${q(opp)} throws and moves the same way"] --> S`);
  } else {
    L.push(`    S(["Your turn"]) --> P["Pick a piece: those that can move are marked"]`, `    P --> D["Pick where it goes, from the rings"]`);
    if (g.followPrompt !== undefined) L.push(`    D --> F{"Does the move go on? A further capture or step"}`, `    F -->|yes| D`, `    F -->|no| W{${win}}`);
    else L.push(`    D --> W{${win}}`);
    L.push(`    W -->|yes| E(["You win"])`, `    W -->|no| N["${q(opp)} moves"] --> S`);
  }
  return L.join('\n');
}
function mindmap(st) {
  const L = ['mindmap', `  root(("${q(st.short || st.title)}"))`];
  (st.facts || []).forEach(([k, v], i) => { L.push(`    f${i}["${q(k)}"]`, `      v${i}["${q(v)}"]`); });
  if (st.status) L.push(`    s["Rules"]`, `      sv["${q(st.status[1])}"]`);
  return L.join('\n');
}

/* ----------------------------------------------------------------- a page per exhibit */
function page(st, i) {
  const g = st.game ? R[st.game] : null, fam = familyOf(st.id), wing = WINGS.find(w => w.wing === st.wing);
  const prev = EXHIBITS[i - 1], next = EXHIBITS[i + 1];
  const o = [];
  o.push(`<!-- Written by tools/build-docs.mjs from the sources. Edit those, then run npm run build:docs. -->`, '');
  o.push(`# ${st.title}`, '');
  o.push(`**Wing ${WING_NAME[st.wing]} · ${wing.title}** · ${st.date} · ${st.eyebrow}`, '');
  o.push(`${prev ? `[← ${prev.title}](${slug(prev.id)})` : '[← The entrance](README.md)'} · [All games](README.md) · ${next ? `[${next.title} →](${slug(next.id)})` : '[The lectern →](README.md#the-end-of-the-hall)'}`, '');

  const play = g ? (g.solo ? 'Playable, alone: there is no Scribe at this table' : HOT.has(g.id) ? 'Playable against the Scribe, or a friend on the same screen' : g.SEATS ? `Playable against the Scribe, in ${g.SEATS.length} seats` : 'Playable against the Scribe') : 'On display';
  o.push('| | |', '| --- | --- |');
  o.push(`| In the Archives | ${play} |`);
  if (st.status) o.push(`| Rules | ${cell(statusText(st))} |`);
  const ex = mine(exRows, st)[0];
  if (ex) { const k = ex.head.indexOf('Rules'); if (k >= 0 && ex.cells[k]) o.push(`| How we know them | ${cell(ex.cells[k])} |`); }
  if (fam) o.push(`| Family | [${fam[0]}](README.md#${fam[0].toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-')}) |`);
  o.push(`| Exhibit id | \`${st.id}\`: \`[librarium_archives start="${st.id}"]\` |`);
  if (g && g.id !== st.id) o.push(`| Rule engine | \`${g.id}\` |`);
  if (g && g.variants) o.push(`| ${g.variantLabel || 'Options'} | ${g.variants.map(v => v.id === g.variant ? `**${v.label}**` : v.label).join(' · ')} |`);
  if (g && PACK_TABLES[g.id]) o.push(`| Suits drawn | ${PACKS[PACK_TABLES[g.id]]} by default; the Pack switch redraws it in French, German, Swiss or Italian suits |`);
  o.push('');

  o.push('## At a glance', '', '```mermaid', mindmap(st), '```', '');
  if ((st.facts || []).length) { o.push('| | |', '| --- | --- |'); st.facts.forEach(([k, v]) => o.push(`| ${cell(k)} | ${cell(v)} |`)); o.push(''); }

  o.push('## The placard', '');
  st.body.forEach(p => o.push(p, ''));
  if (st.note) o.push(`> ${st.note}`, '');

  if (g) {
    o.push('## A turn', '', '```mermaid', flowFor(st, g), '```', '');
    if (g.SEATS) o.push(`Seats: ${g.SEATS.join(', ')}.`, '');
    o.push('## The rules as played here', '');
    (g.rules || []).forEach((r, k) => o.push(`${k + 1}. ${r}`));
    o.push('');
    if (g.source) o.push(`**Source:** ${g.source}`, '');
    const b = bullets.filter(x => x.names.some(n => namesOf(st).has(n)));
    if (b.length) { o.push('### Rule choices', ''); b.forEach(x => o.push('- ' + x.text)); o.push(''); }
    if (g.variants) {
      o.push(`### ${g.variantLabel || 'Options'}`, '', 'Chosen at the table under Options. Changing it restarts the game.', '', '| Choice | |', '| --- | --- |');
      g.variants.forEach(v => o.push(`| ${cell(v.label)} | ${v.id === g.variant ? 'the default' : ''} |`));
      o.push('');
    }
    o.push('## At the table', '', '| | |', '| --- | --- |');
    o.push(`| The Scribe | ${g.solo ? 'None: Patience is played alone' : 'Gentle, Fair or Sharp (see [the Scribe](../scribe.md#levels))'} |`);
    o.push(`| Pass-and-play with a friend | ${yes(HOT.has(g.id))} |`);
    o.push(`| Undo | ${yes(UNDO.has(g.id))} |`);
    o.push(`| Hint | ${yes(canHint(g))} |`);
    o.push(`| Saved and resumed | ${yes(SAVE.has(g.id))} |`);
    if (PACK_TABLES[g.id]) o.push('| Pack switch | Yes |');
    o.push('', 'Keys, the move list, replays and the guide are the same at every table: see [Visiting the Archives](../visiting.md#at-a-table).', '');
    const sc = mine(scribeRows, st), meth = methodOf(st);
    if (NOTES[g.id]) o.push(g.solo ? '## Hint' : '## How the Scribe plays', '', NOTES[g.id], '');
    else if ((sc.length || meth) && !g.solo) {
      o.push('## How the Scribe plays', '');
      if (meth) o.push(`**Method:** ${meth.name}${meth.about.length ? ': ' + meth.about.join('; ') : ''}. See [the Scribe](../scribe.md).`, '');
      for (const r of sc) {
        const shared = r.cells[0] && !namesOf(st).has(norm(r.cells[0])) ? ` (${r.cells[0]})` : '';
        if (r.head.length === 2) { o.push(`**${r.section}${shared}:** ${r.cells[1]}`, ''); continue; }
        o.push(`**${r.section}**${shared}`, '');
        o.push('| ' + r.head.slice(1).map(cell).join(' | ') + ' |', '| ' + r.head.slice(1).map(() => '---').join(' | ') + ' |', '| ' + r.cells.slice(1).map(cell).join(' | ') + ' |', '');
      }
    }
  }

  const fc = mine(factRows, st);
  o.push('## Sources', '');
  if (fc.length) { o.push('Checked in [the placard fact-check](../fact-check.md):', ''); fc.forEach(r => o.push('- ' + r.cells.slice(1).map((c, k) => (c ? `**${r.head[k + 1]}:** ${c}` : '')).filter(Boolean).join(' '))); o.push(''); }
  o.push('The sources for every placard are listed in [Historical notes and sources](../sources.md).', '');

  const files = [g && rulesFile(g.id) && ['Rules and the Scribe', rulesFile(g.id)], g && presFile(g.id) && ['Table presenter', presFile(g.id)], buildFile(st.build) && ['3D model', buildFile(st.build)], ['Placard', 'src/hall/09-exhibit-data.js']].filter(Boolean);
  o.push('## In the code', '', '| | |', '| --- | --- |');
  files.forEach(([k, f]) => o.push(`| ${k} | [\`${f}\`](../../${f}) |`));
  o.push('');
  return o.join('\n');
}

/* ----------------------------------------------------------------- the index */
function index() {
  const o = [], playable = EXHIBITS.filter(s => s.game).length;
  o.push('<!-- Written by tools/build-docs.mjs from the sources. Edit those, then run npm run build:docs. -->', '');
  o.push('# Game by game', '');
  o.push(`One page for each of the hall's **${EXHIBITS.length} exhibits**, ${playable} of them playable, in the order you walk them. Each page has the placard's history, a diagram of a turn, the rules as the table plays them and where they come from, what the table offers (the Scribe, a friend, Undo, Hint, saved games), how the Scribe plays and how strong it is, and the files that make it.`, '');
  o.push('The pages are written from the code and the other guides by `tools/build-docs.mjs`, so they change when the games do. For the reasoning behind the rule choices see [the exhibits guide](../exhibits.md); for the AI, [the Scribe](../scribe.md).', '');

  o.push('## The games by family', '', '```mermaid', 'mindmap', '  root(("Librarium Archives"))');
  for (const [name, , ids] of FAMILIES) {
    o.push(`    f${FAMILIES.findIndex(f => f[0] === name)}["${q(name)}"]`);
    ids.forEach(id => { const st = EXHIBITS.find(s => s.id === id); o.push(`      ${id}["${q(st.short || st.title)}${st.game ? '' : ' (display)'}"]`); });
  }
  o.push('```', '');
  for (const [name, about, ids] of FAMILIES) {
    o.push(`### ${name}`, '', about, '', ids.map(id => { const st = EXHIBITS.find(s => s.id === id); return `[${st.title}](${slug(id)})${st.game ? '' : ' (display)'}`; }).join(' · '), '');
  }

  const counts = {}; EXHIBITS.forEach(s => { const k = s.status ? s.status[1] : 'n/a'; counts[k] = (counts[k] || 0) + 1; });
  o.push('## How sure we are of the rules', '', '```mermaid', 'pie showData', '    title Rules status of the 73 exhibits');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => o.push(`    "${q(k)}" : ${v}`));
  o.push('```', '');
  const feats = EXHIBITS.filter(s => s.game).map(s => R[s.game]);
  o.push('## What the tables offer', '', '```mermaid', 'xychart-beta', '    title "Playable tables with each feature"', '    x-axis ["Scribe", "Friend", "Undo", "Hint", "Saved", "Pack"]', `    y-axis "Tables" 0 --> ${feats.length}`,
    `    bar [${[feats.filter(g => !g.solo).length, feats.filter(g => HOT.has(g.id)).length, feats.filter(g => UNDO.has(g.id)).length, feats.filter(canHint).length, feats.filter(g => SAVE.has(g.id)).length, feats.filter(g => PACK_TABLES[g.id]).length].join(', ')}]`, '```', '');

  for (const w of WINGS) {
    const ex = EXHIBITS.filter(s => s.wing === w.wing);
    o.push(`## Wing ${WING_NAME[w.wing]}: ${w.title}`, '', w.body[0], '');
    // The walk through the wing, five exhibits to a row so a long wing stays readable.
    const node = s => `${s.id}${s.game ? `["${q(s.short || s.title)}<br/>${q(s.date)}"]` : `[/"${q(s.short || s.title)}<br/>${q(s.date)}<br/>on display"/]`}`;
    const stops = [{ id: 'in', lab: `in(["${w.wing === 1 ? 'Entrance' : `From Wing ${WING_NAME[w.wing - 1]}`}"])` }, ...ex.map(s => ({ id: s.id, lab: node(s) })), { id: 'out', lab: `out(["${w.wing === 6 ? 'The lectern' : `On to Wing ${WING_NAME[w.wing + 1]}`}"])` }];
    o.push('```mermaid', 'flowchart TB');
    const rows = []; for (let k = 0; k < stops.length; k += 5) rows.push(stops.slice(k, k + 5));
    rows.forEach((row, r) => { o.push(`    subgraph r${r}[" "]`, '        direction LR', '        ' + row.map(x => x.lab).join(' --> '), '    end'); });
    for (let r = 1; r < rows.length; r++) o.push(`    r${r - 1} --> r${r}`);
    o.push('```', '');
    o.push('| Exhibit | Date | Rules | Scribe | Friend | Undo | Hint | Saved |', '| --- | --- | --- | :---: | :---: | :---: | :---: | :---: |');
    for (const s of ex) {
      const g = s.game && R[s.game], t = b => (g ? (b ? '✓' : '·') : '');
      o.push(`| [${s.title}](${slug(s.id)}) | ${cell(s.date)} | ${cell(statusText(s))}${g ? '' : ' (display)'} | ${t(g && !g.solo)} | ${t(g && HOT.has(g.id))} | ${t(g && UNDO.has(g.id))} | ${t(g && canHint(g))} | ${t(g && SAVE.has(g.id))} |`);
    }
    o.push('');
  }
  const end = STOPS.find(s => s.id === 'next');
  o.push('## The end of the hall', '', end.body[0], '');
  if (end.games) o.push(end.games.map(x => `[${x.name}](${x.url})`).join(' · '), '');
  return o.join('\n');
}

/* ----------------------------------------------------------------- write or check */
const homeless = EXHIBITS.filter(s => !familyOf(s.id)).map(s => s.id), unknown = FAMILIES.flatMap(f => f[2]).filter(id => !EXHIBITS.some(s => s.id === id));
if (homeless.length || unknown.length) { console.error(`tools/docs-data.mjs: ${homeless.length ? 'no family for ' + homeless.join(', ') : ''}${unknown.length ? ' unknown ids ' + unknown.join(', ') : ''}`); process.exit(1); }
const files = new Map([['README.md', index()], ...EXHIBITS.map((s, i) => [slug(s.id), page(s, i)])]);
let stale = 0;
if (!CHECK) { if (existsSync(OUT)) rmSync(OUT, { recursive: true }); mkdirSync(OUT, { recursive: true }); }
for (const [f, text] of files) {
  const p = join(OUT, f);
  if (CHECK) { if (!existsSync(p) || readFileSync(p, 'utf8') !== text) { console.error('out of date: docs/games/' + f); stale++; } }
  else writeFileSync(p, text);
}
if (CHECK) {
  const extra = existsSync(OUT) ? readdirSync(OUT).filter(f => !files.has(f)) : [];
  extra.forEach(f => { console.error('not written by the build: docs/games/' + f); stale++; });
  if (stale) { console.error(`${stale} page(s) out of date: run npm run build:docs`); process.exit(1); }
  console.log(`docs/games is up to date (${files.size} pages)`);
} else console.log(`docs/games written (${files.size} pages)`);
