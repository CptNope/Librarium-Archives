# Librarium Archives

A walkable 3D archive of the oldest board and card games, built for [Librarium Games](https://librarium.games). Visitors stroll a candlelit library hall, read the history of each game on its placard, and sit down to play the ones whose rules are known against an AI opponent, the Scribe.

| 88 exhibits | 81 playable tables | 6 wings | 3 Scribe levels | 320 rule tests |
| :---: | :---: | :---: | :---: | :---: |
| from Senet (c. 3100 BCE) to Hex (1942) | every one with its own board and pieces | walked in date order | Gentle · Fair · Sharp | plus simulated games and AI timing |

**Live:** [cptnope.github.io/Librarium-Archives](https://cptnope.github.io/Librarium-Archives/) · **Embedded:** the `[librarium_archives]` shortcode or the Elementor widget ([WordPress plugin](docs/wordpress.md))

The Archives were first called the Librarium Museum of Play, and the repository was `Librarium-Museum`. GitHub redirects the old repository address, but not the old Pages address.

## The hall

```mermaid
flowchart LR
    E([Entrance]) --> W1
    W1["<b>Wing I</b><br/>The Dawn of Play<br/>c. 3100–2000 BCE<br/>▶ 4 of 6"] --> W2
    W2["<b>Wing II</b><br/>Strategy Takes the Table<br/>c. 500 BCE – 1000 CE<br/>▶ 9 of 11"] --> W3
    W3["<b>Wing III</b><br/>Kings, Cards and Courts<br/>c. 480–1450 CE<br/>▶ 12 of 12"] --> W4
    W4["<b>Wing IV</b><br/>Printed Boards and<br/>Parlour Tables<br/>c. 1300–1900 CE<br/>▶ 19 of 21"] --> W5
    W5["<b>Wing V</b><br/>The Modern Board Game<br/>c. 1840 CE – today<br/>▶ 13 of 13"] --> W6
    W6["<b>Wing VI</b><br/>Games of the World<br/>▶ 16 of 17"] --> L([Librarium lectern])
```

▶ playable tables of exhibits in the wing.

| Wing | Playable tables |
| --- | --- |
| I | [Senet](docs/games/senet.md) · [Royal Game of Ur](docs/games/ur.md) · [Hazard (at the first dice)](docs/games/dice.md) · [Hounds and Jackals](docs/games/hounds.md) |
| II | [Weiqi (Go)](docs/games/go.md) · [Ludus latrunculorum](docs/games/latrunculi.md) · [Duodecim scripta](docs/games/xii.md) · [Patolli](docs/games/patolli.md) · [Nine Men's Morris](docs/games/morris.md) · [Oware](docs/games/oware.md) · [Alquerque](docs/games/alquerque.md) · [Brandubh](docs/games/brandubh.md) · [Hnefatafl](docs/games/hnefatafl.md) |
| III | [Tables (backgammon)](docs/games/tables.md) · [Chaturanga](docs/games/chaturanga.md) · [Shatranj](docs/games/shatranj.md) · [Xiangqi](docs/games/xiangqi.md) · [Chaturaji](docs/games/chaturaji.md) · [Rithmomachia](docs/games/rithmo.md) · [Medieval chess (on the Lewis chessmen)](docs/games/lewis.md) · [Courier chess](docs/games/courier.md) · [Four Seasons chess](docs/games/fourseasons.md) · [Piquet (at the playing cards)](docs/games/cards.md) · [Karnöffel](docs/games/karnoffel.md) · [Tarocchi](docs/games/tarot.md) |
| IV | [Fox and Geese](docs/games/foxgeese.md) · [Chess](docs/games/newqueen.md) · [Draughts](docs/games/draughts.md) · [International draughts](docs/games/idraughts.md) · [Pachisi](docs/games/pachisi.md) · [Game of the Goose](docs/games/goose.md) · [Ombre](docs/games/ombre.md) · [Cribbage](docs/games/cribbage.md) · [Dominoes](docs/games/dominoes.md) · [Scopa](docs/games/scopa.md) · [Tablut](docs/games/tablut.md) · [Whist](docs/games/whist.md) · [Patience](docs/games/patience.md) · [Cassino](docs/games/cassino.md) · [Skat](docs/games/skat.md) · [Snakes and Ladders](docs/games/snakes.md) · [Bézique](docs/games/bezique.md) · [Ludo](docs/games/ludo.md) · [Mahjong](docs/games/mahjong.md) |
| V | [The Mansion of Happiness](docs/games/mansion.md) · [Euchre](docs/games/euchre.md) · [Conquian](docs/games/conquian.md) · [The Checkered Game of Life](docs/games/lifegame.md) · [Pinochle](docs/games/pinochle.md) · [Reversi](docs/games/reversi.md) · [Halma](docs/games/halma.md) · [Hearts](docs/games/hearts.md) · [Dots and Boxes](docs/games/dotsboxes.md) · [Chinese checkers](docs/games/chinese.md) · [The Landlord's Game](docs/games/landlord.md) · [Kalah](docs/games/kalah.md) · [Hex](docs/games/hex.md) |
| VI | [Mū tōrere](docs/games/mutorere.md) · [Shogi](docs/games/shogi.md) · [Gomoku](docs/games/gomoku.md) · [Hanafuda (koi-koi)](docs/games/koikoi.md) · [Jungle](docs/games/jungle.md) · [Nard](docs/games/nard.md) · [Makruk](docs/games/makruk.md) · [Bagh-chal](docs/games/baghchal.md) · [Kōnane](docs/games/konane.md) · [Yut Nori](docs/games/yut.md) · [Janggi](docs/games/janggi.md) · [Fanorona](docs/games/fanorona.md) · [Bao](docs/games/bao.md) · [Morabaraba](docs/games/morabaraba.md) · [Seega](docs/games/seega.md) · [Tâb](docs/games/tab.md) |

Every exhibit has **[a page of its own](docs/games/README.md)**: the placard's history, a diagram of a turn, the rules as the table plays them, what the table offers and how the Scribe plays it. Dates, rule status and the reasoning behind each table's rule choices are in **[the exhibits guide](docs/exhibits.md)**.

## How it fits together

```mermaid
flowchart LR
    rules["js/rules.js<br/>73 rule engines<br/>and the Scribes"] --> hall["js/archives.js<br/>3D hall, tables,<br/>navigation, sound"]
    three["three.js r128"] --> hall
    css["css/archives.css"] --> hall
    hall --> site["GitHub Pages"]
    hall --> plugin["WordPress plugin<br/>shortcode and Elementor widget"]
    hall --> artifact["Single-file artifact"]
    rules --> tests["node --test<br/>rules, simulations, timing"]
```

No bundler, no framework, no audio files: a static page on three.js, with every sound synthesised in the browser.

## Documentation

| Guide | What's in it |
| --- | --- |
| [Visiting the Archives](docs/visiting.md) | Controls on touch and keyboard, getting around, the guided tour and passport, playing at a table (keyboard play included), playing a friend, saved games, options, sound |
| [Game by game](docs/games/README.md) | A page for each of the 88 exhibits: history, a turn diagram, the rules as played, table features, the Scribe's play and strength, the source files |
| [The exhibits](docs/exhibits.md) | All 88 exhibits by wing, with timelines, rule status and the rule choices at each table |
| [The Scribe](docs/scribe.md) | How the AI plays each game, its three levels, and measured strength |
| [Architecture](docs/architecture.md) | Files, modules, the turn loop, table phases, conventions, stored progress |
| [Rule engines and presenters](docs/engines.md) | The contract every game implements, a feature matrix of all 73, and how to add a game |
| [WordPress plugin](docs/wordpress.md) | Install, shortcode attributes, how it loads, security, every exhibit id |
| [Development](docs/development.md) | Scripts, debug mode, tests, CI and deployment, workflow |
| [Sources](docs/sources.md) | Historical notes and the sources behind the placards |
| [Roadmap](docs/roadmap.md) | What's next, and how the Archives grew |
| [Changelog](CHANGELOG.md) | Every release |

## Quick start

```bash
npx serve .              # open the printed address; add ?debug for the console API
npm test                 # rule tests and simulated games (Node 18+)
npm run build:artifact   # dist/artifact.html
npm run build:docs       # docs/games/, from the code and the guides
npm run test:plugin      # builds dist/librarium-archives.zip and runs the PHP tests
```

## Credits

Built by [Jeremy Anderson Tech](https://jeremyanderson.tech) for [Librarium Games](https://librarium.games). The hall ends at a lectern featuring Librarium's own games, Phoenix Farm, Calendra, The Great Chase and Royal Threadcount, under an arch signed *Different fables for different tables*.

Placard text is written for the Archives. Where scholarship is uncertain, the placards say so. Games whose rules are lost or only partly recorded (Senet, Hounds and Jackals, Ludus latrunculorum, Patolli and others) are played as modern reconstructions, and each placard names whose; see [sources](docs/sources.md).
