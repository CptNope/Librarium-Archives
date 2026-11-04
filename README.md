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

The hall ends at a lectern featuring Librarium's own games and a doorway to Wing II (the classical world), which is in preparation.

## Controls

- **Look:** drag the view
- **Walk:** WASD or arrow keys (desktop)
- **Visit an exhibit:** click it, or use the timeline along the bottom
- **At the table:** Throw (or Space), then click a glowing piece; Esc leaves the table

## Project layout

```
index.html               Page markup, fonts, script order
css/museum.css           All styles (brand: Almendra SC, Amethysta, Montserrat; logo gold #F6A01A)
js/rules.js              Pure rule engines for Ur and Senet, plus the Scribe's AI (no rendering)
js/museum.js             three.js hall, exhibit models, camera, placards, play table
tests/rules.test.mjs     Rule tests and 1,000 simulated AI-vs-AI games
tools/build-artifact.mjs Inlines everything into dist/artifact.html for Claude artifacts
```

There is no build step for the site itself. three.js r128 loads from cdnjs, and everything else is static, so the folder can be served as-is or dropped into WordPress.

## Development

```bash
npm test                 # rule tests and simulated games (Node 18+)
npm run build:artifact   # writes dist/artifact.html
```

To preview locally, serve the folder with any static server, for example `npx serve .` or `python3 -m http.server`, then open the printed address.

## Deployment

- **GitHub Pages:** `.github/workflows/pages.yml` deploys `main` after the tests pass. In the repo's Settings > Pages, set **Source** to **GitHub Actions** once.
- **CI:** `.github/workflows/ci.yml` runs syntax checks, the rule tests and the artifact build on every push and pull request.

## Historical notes and sources

The placard text is written for this museum. Where scholarship is uncertain, the placards say so: Senet's rules were never written down, so the playable version is a modern reconstruction; the Royal Game of Ur follows Irving Finkel's translation of a Babylonian rules tablet; Mehen, Hounds and Jackals, and the Başur Höyük pieces are shown without rules because none survive.

- Smithsonian Magazine, "The Best Board Games of the Ancient World"
- History.com, "The Oldest Board Games in the World"
- Wikipedia: Royal Game of Ur, Senet, Hounds and jackals
- The Metropolitan Museum of Art, Game of Hounds and Jackals (26.7.1287a–k)

## Roadmap

- [ ] WordPress plugin wrapper with a shortcode and an Elementor widget, loading the museum only on its own page
- [ ] Swap the type-set wordmark for Librarium's logo files
- [ ] Wing II: the classical world (Ludus latrunculorum, Nine Men's Morris, Go, Mancala)
- [ ] A Celtic room (Brandubh and other tafl games) leading into Calendra
- [ ] Sound: sticks, dice and room tone
