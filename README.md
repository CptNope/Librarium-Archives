# Librarium Museum of Play

A walkable 3D museum of the oldest known board games, built for [Librarium Games](https://librarium.games). Visitors stroll a candlelit library hall, read the history of each game on its placard, and sit down to play the ones whose rules we can reconstruct against an AI opponent, the Scribe.

## Wing I: The Dawn of Play (c. 3100–2000 BCE)

| Exhibit | Date | Rules | In the museum |
| --- | --- | --- | --- |
| Senet | c. 3100 BCE | Reconstructed (after Kendall, 1979) | Playable |
| Mehen | c. 3100–2300 BCE | Lost | On display |
| Başur Höyük pieces | c. 3000 BCE | Game unknown | On display |
| Royal Game of Ur | c. 2600–2400 BCE | Survive in writing (tablet, c. 177 BCE; Finkel) | Playable |
| Hounds and Jackals | c. 2000 BCE | Lost | On display |

## Wing II: Strategy Takes the Table (c. 500 BCE – 1000 CE)

Through the arch, luck drains out of the games.

| Exhibit | Date | Rules | In the museum |
| --- | --- | --- | --- |
| Weiqi (Go) | by the 4th century BCE | Unbroken tradition | On display (17 × 17 Han-style board) |
| Ludus latrunculorum | by the 1st century BCE | Uncertain, reconstructed | On display |
| Nine Men's Morris | Roman era onward | Survive in tradition | Playable |
| Mancala (Oware) | c. 6th–7th century CE (Aksum) | Survive in tradition (abapa) | Playable |
| Brandubh | c. 900–1000 CE (Ballinderry board) | Reconstructed | Playable, as the king's side |

## Wing III: Kings, Cards and Courts (c. 480–1450 CE)

Through the second arch: chess travels from India to the far North, Rome's dice games become tables, and cards arrive from the East.

| Exhibit | Date | Rules | In the museum |
| --- | --- | --- | --- |
| Tables (backgammon) | c. 480 CE onward | Modern backgammon, no cube | Playable |
| Chaturanga | by c. 600 CE | Partly lost (the elephant's move) | On display, on an ashtapada board |
| Shatranj | c. 600–1200 CE | Survive in writing (al-Adli, as-Suli) | Playable |
| The Lewis Chessmen | c. 1150–1200 CE | Medieval European chess | On display (simplified figures, not copies) |
| Playing cards | c. 900–1400 CE | Earliest games lost | On display (new designs in old styles) |
| Tarot (tarocchi) | c. 1440 CE | Still played as a card game | On display (new paintings in the Milan style) |

The hall ends at a lectern featuring Librarium's own games and the closed arch of Wing IV, which is in preparation.

## The Scribe

The AI opponent plays race games with a quick scoring rule, picks Tables moves by scoring every legal full turn (pip count, safe points, exposed checkers), and plays strategy games with a negamax search (alpha-beta pruning): 3–4 moves deep in Morris, 8 in Oware, 4 in Brandubh and 4 in Shatranj. Each move takes well under half a second. In Brandubh the visitor's side currently wins most games; a difficulty setting is on the roadmap.

## Controls

- **Look:** drag the view
- **Walk:** WASD or arrow keys (desktop)
- **Visit an exhibit:** click it, or use the timeline along the bottom
- **Race games (Senet, Ur, Tables):** Throw (or Space), then click a glowing piece. In Tables each die is a separate move; when a checker can use either die, click it and then pick a ring
- **Strategy games:** click a glowing piece, then one of its rings (in Morris placement and Oware, click the ring or pit directly)
- **Esc** clears a selection, or leaves the table

## Project layout

```
index.html               Page markup, fonts, script order
css/museum.css           All styles (brand: Almendra SC, Amethysta, Montserrat; logo gold #F6A01A)
js/rules.js              Pure rule engines for all five playable games, plus the Scribe's AI (no rendering)
js/museum.js             three.js hall, exhibit models, light pool, camera, placards, play table
tests/rules.test.mjs     Rule tests, simulated AI-vs-AI games and AI timing checks
tools/build-artifact.mjs Inlines everything into dist/artifact.html for Claude artifacts
```

There is no build step for the site itself. three.js r128 loads from cdnjs, and everything else is static, so the folder can be served as-is or dropped into WordPress.

## Development

```bash
npm test                 # rule tests and simulated games (Node 18+)
npm run build:artifact   # writes dist/artifact.html
```

To preview locally, serve the folder with any static server, for example `npx serve .` or `python3 -m http.server`, then open the printed address. Add `?debug` to the address to expose the live state as `window.__museum` in the console, with `choose`, `humanThrow`, `startGame` and a `snap()` helper that returns a small JPEG of the 3D view. Debug mode also keeps the scene ticking when the browser pauses animation frames in a hidden tab.

### Adding a game

1. Add a rule engine to `js/rules.js` with `init`, `legal(pl)`, `apply(m)` and `result(pl)`. Dice games set `dice: true`, provide `roll`, `done`, `home`, `extra` and `aiPlan(pl, moves)`, and receive the full roll as `legal(pl, value, roll)`. A move can return `followUp` choices for the same player (Morris removals, the second die in Tables). Strategy games also provide `snapshot`, `restore`, `turns`, `terminal`, `evaluate` and `aiPlan`, which plug into the shared negamax search.
2. Add a presenter in `js/museum.js` (`setup`, `meshesFor`, `ringFor`, `play`, `score`, `prompt`) and register it in `PRES`.
3. Add a board builder and a `STOPS` entry with `game: '<id>'`.
4. Add tests in `tests/rules.test.mjs`.

## Deployment

- **GitHub Pages:** `.github/workflows/pages.yml` deploys `main` after the tests pass. In the repo's Settings > Pages, set **Source** to **GitHub Actions** once.
- **CI:** `.github/workflows/ci.yml` runs syntax checks, the rule tests and the artifact build on every push and pull request.

## Historical notes and sources

The placard text is written for this museum. Where scholarship is uncertain, the placards say so: Senet's rules were never written down, so the playable version is a modern reconstruction; the Royal Game of Ur follows Irving Finkel's translation of a Babylonian rules tablet; Mehen, Hounds and Jackals, and the Başur Höyük pieces are shown without rules because none survive.

- Smithsonian Magazine, "The Best Board Games of the Ancient World"
- History.com, "The Oldest Board Games in the World"
- Wikipedia: Royal Game of Ur, Senet, Hounds and jackals, History of Go, Ludus latrunculorum, Tafl games
- The Metropolitan Museum of Art, Game of Hounds and Jackals (26.7.1287a–k)
- National Museum of Ireland, The Ballinderry gaming board
- Traditional Board Games (tradgames.org.uk), Nine Men's Morris
- Masters Traditional Games, Brandubh rules
- Wikipedia: Chaturanga, Shatranj, Tabula (game), Backgammon, Game pieces of the Lewis chessmen hoard
- The World of Playing Cards (wopc.co.uk): early references; Mamluk cards and the making of the European deck
- Tarot Heritage: tarot history chronology

## Roadmap

- [ ] WordPress plugin wrapper with a shortcode and an Elementor widget, loading the museum only on its own page
- [ ] Swap the type-set wordmark for Librarium's logo files
- [x] Wing II: strategy games (Weiqi, Ludus latrunculorum, Nine Men's Morris, Oware, Brandubh)
- [x] Wing III: kings, cards and courts (Tables, chaturanga, shatranj, Lewis chessmen, cards, tarot)
- [ ] Wing IV: the early modern era (modern chess, draughts, Go-moku, the first commercial board games)
- [ ] A playable early card game, such as a simple tarocchi trick-taking game
- [ ] Difficulty settings for the Scribe, and a stronger Brandubh attacker
- [ ] Playable Go on a 9 × 9 board
- [ ] Sound: sticks, dice and room tone
