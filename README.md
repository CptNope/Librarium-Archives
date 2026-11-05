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

The AI opponent has three levels, picked at any table and remembered: **Gentle**, **Fair** (the default) and **Sharp**.

- **Race games** (Senet, Ur) score each move. Gentle adds a lot of chance and sometimes just plays any legal move; Sharp plays its best move.
- **Tables** scores every legal full turn (pip count, safe points, exposed checkers). Gentle picks loosely among the good ones; Sharp always takes the best.
- **Strategy games** (Morris, Oware, Brandubh, Shatranj) use a negamax search with alpha-beta pruning and iterative deepening. Each level has a thinking budget (about 0.1, 0.6 and 1.5 seconds): the Scribe searches one move deeper at a time and stops the moment its budget runs out, so it plays as well as the visitor's device allows without stalling.

In Brandubh the visitor's side still wins most games, even against Sharp.

## Visitor progress

Kept in the visitor's browser only (`localStorage`, key `librarium.museum.v1`): exhibits visited (a green dot on the timeline), the Scribe's level, which rules panels have already been shown (each table opens its rules automatically the first time), and the visitor's win/loss/draw record at each table, shown on the placard and after each game. If storage is blocked, everything still works for that visit.

## Controls

| | Touch screens | Mouse and keyboard |
| --- | --- | --- |
| **Look** | Drag with one finger | Drag |
| **Walk** | Joystick at bottom left: up and down to walk, left and right to turn. Or tap the floor to walk there | WASD or arrow keys, or click the floor |
| **Zoom** | Pinch, in the hall and at the tables | Scroll wheel or trackpad pinch (Ctrl + scroll when embedded in a page) |
| **At a zoomed-in table** | Drag with one or two fingers to pan | Drag to pan |
| **Visit an exhibit** | Tap it, or tap the timeline | Click it, or use the timeline |

- The joystick appears on touch screens (and as soon as anyone touches the screen on a touch laptop). On a phone it hides while an exhibit card is open, so close the card to walk; walking up to an exhibit lights it on the timeline rather than covering the view, and a tap opens it.
- Zoom eases back to normal when you travel to another exhibit or leave a table.
- **Race games (Senet, Ur, Tables):** Throw (or Space), then click a glowing piece. In Tables each die is a separate move; when a checker can use either die, click it and then pick a ring
- **Strategy games:** click a glowing piece, then one of its rings (in Morris placement and Oware, click the ring or pit directly)
- **Esc** clears a selection, or leaves the table
- **After the Scribe moves**, ember marks show where its last move came from and went to

## WordPress plugin

The museum ships as a WordPress plugin for librarium.games.

1. Download `librarium-museum-plugin` from the latest successful **CI** run on GitHub (Actions tab), unzip it to get `librarium-museum.zip`, and upload that under **Plugins > Add New > Upload Plugin**.
2. Add the museum to a page with the shortcode, or with the **Museum of Play** widget in Elementor:

```
[librarium_museum]
[librarium_museum height="720px" start="tables" shop_url="https://librarium.games/"]
```

| Attribute | What it does | Default |
| --- | --- | --- |
| `height` | Height of the museum box: px, vh, svh, dvh, em, rem or % | `80vh` |
| `start` | Exhibit to open on: `senet`, `ur`, `morris`, `oware`, `brandubh`, `tables`, `shatranj`, or any other exhibit id | the entrance |
| `shop_url` | Where the "Visit Librarium Games" button at the end of the hall points | `https://librarium.games/` |

How it behaves on a page:

- **Embedded, not full-page.** The museum sits in its own box and scrolls with the page. A full-screen button (top right) expands it where the browser allows.
- **Keyboard.** It only takes WASD and the arrow keys while the pointer is over it or focus is inside it, so the page keeps scrolling normally.
- **Styles are scoped.** Every rule is scoped under `#lm-app` and every id is prefixed `lm-`, so the theme and the museum don't restyle each other. The phone layout responds to the box's width (a container query), not the window's.
- **Assets load only where needed:** on pages whose content holds the shortcode (in the head), or when the widget or shortcode renders (in the footer). three.js r128 is bundled with the plugin; nothing loads from a CDN except Google Fonts.
- **One per page.** A second copy renders nothing for visitors and a notice for editors.
- **In the Elementor editor** the widget shows a placeholder; the 3D hall runs on the live page.

`embed-demo.html` imitates a WordPress page with the museum embedded at 70vh; it is published with the site at `/embed-demo.html`.

## Project layout

```
index.html               Page markup, fonts, script order
css/museum.css           All styles (brand: Almendra SC, Amethysta, Montserrat; logo gold #F6A01A)
js/rules.js              Pure rule engines for all five playable games, plus the Scribe's AI (no rendering)
js/museum.js             three.js hall, exhibit models, light pool, camera, placards, play table
tests/rules.test.mjs     Rule tests, simulated AI-vs-AI games and AI timing checks
tools/build-artifact.mjs Inlines everything into dist/artifact.html for Claude artifacts
tools/build-wp.mjs       Builds the WordPress plugin into dist/librarium-museum.zip
wordpress/               Plugin PHP (shortcode, Elementor widget) and readme.txt
tests/plugin-render.test.php  Renders the shortcode with stubbed WordPress functions
embed-demo.html          A stand-in WordPress page that embeds the museum
```

There is no build step for the site itself. three.js r128 loads from cdnjs, and everything else is static, so the folder can be served as-is or dropped into WordPress.

## Development

```bash
npm test                 # rule tests and simulated games (Node 18+)
npm run build:artifact   # writes dist/artifact.html
npm run test:plugin      # builds the plugin zip and runs the PHP render tests (needs php and zip)
```

Local plugin builds load three.js from cdnjs unless `vendor/three.min.js` exists; CI downloads it and bundles it.

To preview locally, serve the folder with any static server, for example `npx serve .` or `python3 -m http.server`, then open the printed address. Add `?debug` to the address to expose the live state as `window.__museum` in the console, with `choose`, `humanThrow`, `startGame` and a `snap()` helper that returns a small JPEG of the 3D view. Debug mode also keeps the scene ticking when the browser pauses animation frames in a hidden tab.

### Adding a game

1. Add a rule engine to `js/rules.js` with `init`, `legal(pl)`, `apply(m)` and `result(pl)`. Dice games set `dice: true`, provide `roll`, `done`, `home`, `extra` and `aiPlan(pl, moves)`, and receive the full roll as `legal(pl, value, roll)`. A move can return `followUp` choices for the same player (Morris removals, the second die in Tables). Strategy games also provide `snapshot`, `restore`, `turns`, `terminal`, `evaluate` and `aiPlan`, which plug into the shared negamax search.
2. Add a presenter in `js/museum.js` (`setup`, `meshesFor`, `ringFor`, `play`, `score`, `prompt`) and register it in `PRES`.
3. Add a board builder and a `STOPS` entry with `game: '<id>'`.
4. Add tests in `tests/rules.test.mjs`.

## Deployment

- **GitHub Pages:** `.github/workflows/pages.yml` deploys `main` after the tests pass. In the repo's Settings > Pages, set **Source** to **GitHub Actions** once.
- **CI:** `.github/workflows/ci.yml` runs syntax checks, the rule tests and the artifact build on every push and pull request, and builds, lints and tests the WordPress plugin, uploading the zip as the `librarium-museum-plugin` artifact.

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

- [x] WordPress plugin with a shortcode and an Elementor widget, loading the museum only where it is shown
- [ ] Swap the type-set wordmark for Librarium's logo files
- [x] Wing II: strategy games (Weiqi, Ludus latrunculorum, Nine Men's Morris, Oware, Brandubh)
- [x] Wing III: kings, cards and courts (Tables, chaturanga, shatranj, Lewis chessmen, cards, tarot)
- [ ] Wing IV: the early modern era (modern chess, draughts, Go-moku, the first commercial board games)
- [ ] A playable early card game, such as a simple tarocchi trick-taking game
- [x] Difficulty settings for the Scribe
- [ ] A stronger Brandubh attacker
- [ ] Playable Go on a 9 × 9 board
- [ ] Sound: sticks, dice and room tone
