# Source

The Archives' code lives here, in small files, and is joined into the two files the page loads:

- `src/rules/` → `js/rules.js`: the rule engines, one file per game, with `00-core.js` (Scribe levels, the shared search, Ur and Senet) first and `zz-api.js` (saved state, the export) last.
- `src/hall/` → `js/archives.js`: the hall's systems in order (`00-head.js` … `27-boot.js`), with the exhibits' models (`build-*.js`) inside the exhibits section and each table's presenter (`table-*.js`) inside the presenters section.

Each folder's `ORDER` file lists its parts in the order they are joined; the files share one scope, so order matters (a table built on another, like Chaturanga on Shatranj, comes after it). To add a game, add its file and its line in `ORDER`.

```bash
npm run build:js          # write js/rules.js and js/archives.js
node tools/build-js.mjs --check   # what CI runs: fails if js/ does not match src/
```
