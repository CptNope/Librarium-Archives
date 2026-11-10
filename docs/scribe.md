# The Scribe

The Scribe is the Archives' opponent at every table. It has three levels, chosen at any table and remembered: **Gentle**, **Fair** (the default) and **Sharp**. Each game's Scribe is built from one of a few families of method, picked to suit the game.

```mermaid
mindmap
  root((The Scribe))
    Shared search
      negamax with alpha-beta
      iterative deepening
      time budget per level
      Morris · Oware · Alquerque · Brandubh
      Shatranj · Xiangqi · Chess · Shogi · Makruk · Janggi
      Fox and Geese · Draughts · Reversi · Halma
      Chinese checkers · Kalah · Bao · Tablut
      Mū tōrere · Kōnane · Fanorona · Morabaraba
    Monte Carlo
      random playouts with RAVE
      Go · Hex
    Hidden information
      plays only from what it can see
      Tarocchi · Dominoes · Cribbage · Mahjong
    Rules of thumb
      scored moves for dice games
      Senet · Ur · Tables · Goose
      Yut Nori · Pachisi · Ludo · Landlord's Game
    Exact and threat search
      Dots and Boxes endgame solver
      Gomoku continuous fours
```

## Levels

| | Gentle | Fair | Sharp |
| --- | --- | --- | --- |
| Thinking budget | about 0.12 s | about 0.6 s | about 1.5 s |
| Search depth cap | 2 plies | the game's limit | the game's limit + 2 |
| Random tie-breaking noise | large (up to 6) | small (0.6) | tiny (0.05) |
| Dice and card games | often plays any legal move | sensible rules of thumb | looks further: danger, odds, what you have shown |

A level is set with `LibrariumRules.setLevel(name)`, and engines read it through `pick(gentle, fair, sharp)`.

## The shared search

Strategy games hand the Scribe five hooks (`snapshot`, `restore`, `turns`, `terminal`, `evaluate`) and call `bestPlan(this, pl, depth, maxDepth)`. It deepens one ply at a time until the level's budget would run out, so the Scribe plays as well as the visitor's device allows without stalling.

```mermaid
flowchart TD
    A(["bestPlan(G, pl)"]) --> B["search to depth 1<br/>(always have a move)"]
    B --> C["deadline = now + budget"]
    C --> D{"depth ≤ cap and<br/>elapsed × 3 ≤ budget?"}
    D -- no --> Z(["return the best plan so far"])
    D -- yes --> E["searchAt(depth)<br/>try the last best plan first"]
    E --> F["for each turn: apply, negamax with alpha-beta, restore<br/>add the level's random noise"]
    F --> G{"out of time?"}
    G -- yes --> H["restore the root position"] --> Z
    G -- no --> I["keep this depth's best"] --> D
```

- **Turns, not moves.** `turns(pl)` returns whole turns, so a Fanorona capture chain, a Kalah extra move or a Morris mill-and-remove is searched as one step.
- **Move ordering.** Engines list captures and threats first, and each new depth tries the previous best plan first, so alpha-beta prunes more.
- **Safe interruption.** When the deadline passes mid-search, the search throws, and the root position is restored before the best plan so far is returned.
- **Wins sooner, losses later.** `terminal()` scores a finished game as `±1000 ± depth`.

## Monte Carlo search (Go and Hex)

```mermaid
flowchart LR
    S["Select<br/>child by value mixed with<br/>all-moves-as-first stats"] --> X["Expand<br/>one new child"]
    X --> P["Play out<br/>random to the end<br/>(Go: take stones in atari)"]
    P --> B["Back up<br/>wins and RAVE<br/>statistics"]
    B --> S
    B -. "budget spent" .-> M(["play the most-visited move"])
```

RAVE lets a point that won when played *later* in a random game count a little toward playing it *now*. That is a good guess in both games, since stones never move. In Go the Scribe passes after you do if the count already favours it. In Hex, Fair and Sharp take a central opening stone with the swap rule.

## Games with hidden cards and tiles

The Scribe never looks at the visitor's hand or the deck. Each game's Scribe works from what a human player at that table could see.

| Game | How the Scribe decides |
| --- | --- |
| Tarocchi | Sharp deals the unseen cards at random many times over, consistent with what you have shown (a suit you could not follow), plays each deal out, and picks the card that scores best on average. Fair plays by rule of thumb |
| Dominoes | Sheds heavy tiles and doubles. Sharp also keeps tiles that match the ends it leaves, and leaves ends you have shown you cannot match (you drew or passed on them) |
| Cribbage | Sharp averages every possible four-card keep over all 46 possible starters, weighs what it gives the crib, and in the play avoids leaving counts of 5 or 21 |
| Mahjong | Each of the three Scribes counts how far its hand is from ready (shanten) and keeps the discards that leave the most useful draws open. It claims only when a claim brings its hand closer |

## Measured strength

Every Scribe is checked by simulation, playing level against level with seats swapped. Where a game strongly favours the first player, the games start from varied openings. Dice games need hundreds of games to show a difference; deterministic games need far fewer.

| Game | Fair vs Gentle | Sharp vs Fair | Games |
| --- | --- | --- | --- |
| Bao | 31–9 | 29–11 | 40 each |
| Gomoku | every game | 58–22 | 20, and 80 from varied openings |
| Hex | 9–1 (7 × 7) | 6–0 (9 × 9) | 10 and 6 |
| Kalah | 20–0 | 24–16 | 20 and 40, varied openings |
| Tablut | 6–0 | 4–2 | 6 each |
| Makruk | 6–0 | 2 wins, 4 draws | 6 each |
| Morabaraba | 6–0 | 4–2 | 6 each |
| Janggi | 4–0 | 2–2 | 4 each |
| Chinese checkers | 6–0 | 4–2 | 6 each |
| Tarocchi | | 16–14 (by +3.4 points a game) | 30 |
| Ludo | 81% | 65% | 600 and 1,000 |
| Dominoes | 61% | 62% | 400 and 600 hands |
| Cribbage | 60% | 57% | 300 each |
| The Landlord's Game | 67% | 52% | 600 and 1,500 |
| Pachisi (short) | 72% | | hundreds |
| Yut Nori | about 55% | | hundreds |
| Mū tōrere | | | Sharp looks 16 moves ahead and never loses |

Known weak spots: in Brandubh the visitor's side still wins most games against Sharp, and Janggi's Sharp is barely stronger than Fair in short matches. Both are on the [roadmap](roadmap.md).

## Game by game

| Game | What the Scribe weighs |
| --- | --- |
| Senet, Ur | Each move scored for progress, safety and captures; Gentle adds a lot of chance |
| Tables | Every legal full turn scored for pip count, safe points and exposed checkers |
| Go | Monte Carlo with RAVE (above) |
| Morris, Morabaraba | Pieces, open two-in-a-rows, mills and mobility |
| Fox and Geese | Plays the geese, steering by how much room the fox has left |
| Reversi | Corners, edges and mobility, then exact disc counting near the end. Gentle plays a random legal move |
| Dots and Boxes | Never hands over boxes while it can help it, then solves the endgame exactly (Sharp from 22 open lines, Fair from 15) |
| Chess, Shogi | Captures tried first; chess up to five moves deep, shogi up to four, with drops near the kings when the list is long |
| Makruk, Janggi | Material (Janggi's tournament points), soldiers and cowries pushed forward |
| Tablut | The king's open lines to the edge, Muscovites around him, material |
| Bao | Seeds, the inner row, and the best capture on offer; cheap to search, so Sharp looks twelve plies ahead |
| Kalah | Stores and seeds on each side; chains of extra moves searched as one turn |
| Gomoku | Every point near the stones ranked by the lines it makes for each side. Sharp hunts for a win by continuous fours, blocks yours, and searches a few moves scored by five-point windows |
| Ludo | Captures, coming out, getting home. Sharp counts how many enemy tokens could reach a square in one throw |
| The Landlord's Game | Lot tickets, buy or rent, luxuries, the jail fine, railroad rides. Sharp buys every lot it can afford, since land pays |
| Yut Nori, Pachisi | Progress, captures, safety, and castles in Pachisi |
