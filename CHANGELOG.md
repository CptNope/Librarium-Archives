# Changelog

## 0.22.1: Hex

- In Hex you always move first, and the swap rule is now an option, off by default, so the first move stays yours. Turn it on above the board for an even game. Tables can now offer on-off rules like this beside their variants.

## 0.22.0: The Mansion of Happiness and the Checkered Game of Life

- **The Mansion of Happiness** (Wing V) is playable. Every one of its 67 squares was read from a scan of the 1843 W. & S. B. Ives board, and the game follows the seventeen rules printed with it: thirteen virtues that advance six, four vices that send you back, crimes punished at the Water, Poverty, the Whipping Post, the Pillory and the Stocks, a month in the House of Correction for a Cheat and two in Prison for a Robber, and an exact spin to reach the Mansion. A newly drawn spiral board names each square, and the teetotum has its own face.
- **The Checkered Game of Life** (Wing V) is playable on the board of the Milton Bradley Co. edition of about 1911, read from a scan, with the rules of Bradley's 1866 patent: the pale squares only, pointing hands that carry you on, points to 100, Jail, Prison and Speculation. What each spin allows follows a modern reproduction, and the placard says so. Every exhibit in Wing V is now playable.
- 6 new rule tests (236 in all).

## 0.21.0: Three modern reconstructions

Three exhibits whose rules are lost or only partly recorded are now playable. Each placard says plainly that the table plays a modern reconstruction and whose, and a line beside the "Take a seat and play" button repeats it.

- **Hounds and Jackals** (Wing I): Howard Carter's reconstruction of 1912. Five pins a side race up their own tracks; the lines from 20 to 6 and 10 to 8 send a pin back, and the "good" holes 15 and 25 give another throw.
- **Ludus latrunculorum** (Wing II): the "Piso" rules of the Locus Ludi project (University of Fribourg). Twenty glass counters each, placed one at a time, then stepped; a counter trapped between two enemies is taken.
- **Patolli** (Wing II): the reconstruction most often given today, from Diego Durán's account. Six markers and six treasures each, five beans, captures in the centre, treasure paid on the dark houses.
- Placards can show a note beside the play button.
- Fixed: Tâb printed "undefined" after a throw that earns another.
- 9 new rule tests (230 in all).

## 0.20.0: Seega, Tâb, Bagh-chal and Four Seasons chess

- **Seega** (Wing VI): Edward Lane's five-cup game from Egypt (1836). Twelve stones each placed two at a time, a first move into the centre, pincer captures that chain, and a way opened for a player who is boxed in.
- **Tâb** (Wing VI): Lane's race-and-capture game on four rows of nine, with four palm-stick dice. A piece needs a tâb to set out, and may raid the enemy's home row once.
- **Bagh-chal** (Wing VI): Nepal's four tigers against twenty goats on the alquerque board. Lead either side; positions may not repeat once the goats are down.
- **Four Seasons chess** (Wing III): Alfonso X's chess for four (1283), against three Scribes. An army in each corner, alfils that leap, no leaving your king in check, and a mated army passing to the player who mated it.
- The turn loop lets several Scribes take turns in games without dice too, and names whoever moves first.
- 16 new rule tests (221 in all).

## 0.19.0: Chaturaji

- **Chaturaji** (Wing III): chess for four with dice, as al-Biruni described it about 1030 and H. J. R. Murray read him. You play yellow against three Scribes, Black, Red and Green, each for itself. Two dice name the pieces that may move; kings can be taken; captures score; a boat that completes a square of four boats takes the other three. Take all three kings, or be the last king standing, to win.
- The turn loop can now hand the turn round several Scribes (`passTurn`, `ended`, `scribeName`), names whichever Scribe is at play, and shows every player's score.
- The Chaturanga placard points to its four-handed relative, and the plugin's exhibit list includes it.
- 10 new rule tests (205 in all).

## 0.18.1: Documentation

- The README is now a front page, and the documentation lives in `docs/`: a visitor guide, the exhibits by wing, the Scribe, architecture, the rule-engine contract, the WordPress plugin, development, sources and the roadmap.
- 31 Mermaid diagrams: the hall, a timeline for each wing, the module map, the turn sequence, the table phases, the engine and presenter contract, the Scribe's search, the plugin's loading and input checks, the test and CI pipelines, and how the Archives grew.
- Corrected counts throughout: 52 exhibits, 39 of them playable.
- The plugin's exhibit list (the Elementor dropdown) is grouped by wing again, and its readme lists every table.

## 0.18.0: Ludo, Janggi and Morabaraba

- **Ludo** (Wing IV): the 1896 game from Pachisi, red against yellow on the classic cross, with one die.
- **Janggi** (Wing VI): Korean chess on a riverless board with octagonal pieces in three sizes, passing, and bikjang decided on points.
- **Morabaraba** (Wing VI): southern Africa's mill game, with twelve cows and the diagonals. Nine Men's Morris and Morabaraba now share one engine and one table.

## 0.17.0: Four more tables

- **Cribbage** (Wing IV): two-player six-card cribbage with the crib, the starter, the play and the show all scored for you, and pegs that leapfrog along a cribbage board. To 61, or 121.
- **Tablut** (Wing IV): Linnaeus's Lapland tafl of 1732, on a board of reindeer hide. You command the king and his Swedes.
- **Kalah** (Wing V): William Champion's mancala of 1940, from Holbrook, Massachusetts, with 3, 4 or 6 seeds a pit.
- **Makruk** (Wing VI): Thai chess, with cowrie-shell pawns, promotion on the sixth rank and the endgame counts.

## 0.16.0: Four new tables

- **Dominoes** (Wing IV): the two-player Draw game with a double-six set, the Scribe's hand face away from you and the boneyard face down.
- **Chinese checkers** (Wing V): Stern-Halma's star of 121 holes, ten marbles each, with chains of hops.
- **Hex** (Wing V): Piet Hein's and John Nash's game on 7 × 7, 9 × 9 or 11 × 11, with the swap rule. The Scribe uses Monte Carlo search.
- **Gomoku** (Wing VI): five in a row on a 15 × 15 board. Sharp hunts for wins by continuous fours.

## 0.15.0: Archives all the way down, and the Landlord's Game

- **The Landlord's Game** is playable. The board is redrawn from Lizzie Magie's 1904 patent, space for space, and the table plays the patent's rules against the Scribe: lot tickets, buying and renting, wages from Mother Earth, taxes on necessities, luxuries, franchises, railroads, jail, Bank notes and the poorhouse. Three rounds by default, five as in the patent.
- Dice games can now offer choices before the throw (buying lot tickets, paying a jail fine), and a dice game can decide its winner by score at the end.
- The rename is complete: the shortcode is now `[librarium_archives]`, the plugin is `librarium-archives` (`librarium-archives.zip`), the files are `js/archives.js` and `css/archives.css`, and the repository is `CptNope/Librarium-Archives`. Visitor progress is saved under `librarium.archives.v1`. Nothing was live yet, so there is no migration.

## 0.14.1: The Librarium Archives

- The hall is renamed from the Museum of Play to the **Librarium Archives**, on the sign, the loading screen, the wing banners, the WordPress plugin and its Elementor widget. 
- "Museum rule" is now "house rule" in the rules panels.

## 0.14.0: A table of four, and Bao

- **Mahjong** is playable. You sit at East with three Scribes at the other winds. Claim discards for pungs, kongs and chows (from your left), declare concealed kongs, and go out with four sets and a pair, seven pairs or the thirteen orphans. The tiles are drawn with their faces, and your hand shows how many tiles you are from ready.
- **Bao** is playable as Bao la Kujifunza, the learners' game, with captures sown from the ends of the row and relay sowing.
- Moves that have no piece to click, such as Mahjong's claims, now show as buttons above the message bar.

## 0.13.0: Known rules, now playable

- Four exhibits whose rules are known can now be played:
  - **Chess** at the New Queen: modern rules with castling, en passant and promotion. The move generator is checked against the standard perft counts.
  - **Shogi**, with drops. Captured pieces wait in your hand beside the board.
  - **Yut Nori**, with the four sticks, the shortcuts, stacking and extra throws.
  - **Pachisi** for two, each side playing a pair of partner colours, with cowrie throws, graces and castles. You can pick a short or a full game.
- Fixed the Pachisi board: the side castles now sit four squares in from the outer end, as the sources describe.
- The dice tray shows cowries for Pachisi and names Yut Nori's throws (do, gae, geol, yut, mo).

## 0.12.0: Wing VI, Games of the World

- A sixth wing, through a fifth arch, for games from the Pacific, Africa and East Asia. The closing lectern now stands at its end.
- Three new tables:
  - **Mū tōrere** (Māori), on a star of eight arms. Block the Scribe to win.
  - **Kōnane** (Hawaiʻi), on a stone papamū. Every move is a capture by jumping.
  - **Fanorona** (Madagascar), with approach and withdrawal captures and capture chains. A new **Stop** button ends a chain early.
- Three new displays: **Shogi** in its opening position, **Yut Nori** with its four sticks, and **Bao** with the square nyumba.
- The navigation gains a sixth wing tab.

## 0.11.0: New navigation

- The bar along the bottom is rebuilt for five wings. **Wing tabs** (I to V) jump to each wing's entrance; the strip shows only the exhibits of the wing you are in, marks the tables you can play, and follows you as you walk; **‹ ›** (or **[ ]** on a keyboard) step through the exhibits in order, across wings.
- **All exhibits** opens an index of every exhibit grouped by wing, with search (titles, places, dates and facts; Enter goes to the first match), filters for playable tables and exhibits you have not visited, and how many you have seen in each wing.
- On phones the bar takes two rows, and the exhibit card and joystick sit above it.

## 0.10.0: Sound, tarocchi and a bigger grid

- **Sound**, all synthesized in the browser: throwing sticks, dice, pieces, Go stones, pencil lines, cards, a chime at the end of a game, and a soft room tone with candle crackle. A speaker button mutes it and is remembered.
- **Tarocchi for two** is playable at the tarot exhibit in Wing III: follow suit, trump if you cannot, the Fool as an excuse, and points for court cards and the great trumps. The easel is put away while you play.
- **Dots and Boxes** can be played on a 5 × 5 grid, using a new variant picker on the table.
- Fixed: a move with no spot of its own no longer stops the table from showing the next prompt.

## 0.9.0: Halma, Go and a backfill of the wings

- **Halma** is now playable: two players, 19 men each, with chains of leaps and the rule against blocking a camp.
- **Go** is playable on a 9 × 9 board, with Chinese area scoring and a komi of 7. The Scribe plays it with Monte Carlo tree search, and the table has a Pass button. The Han-style 17 × 17 board returns when you leave.
- Seven new exhibits fill gaps in the wings:
  - Wing I: **the first dice**, from the Burnt City and the Indus Valley.
  - Wing II: **Petteia**, **Liubo** and **Patolli** on display, and **Alquerque**, the parent of draughts, to play.
  - Wing III: **Xiangqi** (Chinese chess), to play.
  - Wing IV: **Snakes and Ladders**, the Indian game of knowledge, to play.
- The hall now lays itself out: exhibits are spaced by their order in each wing, so new games no longer need hand-placed positions.

## 0.8.0: Wing V

- New wing, **The Modern Board Game** (c. 1840 to today), through a fourth open arch.
- Two new playable tables:
  - **Reversi**: the disc-flipping game of 1883, from the Othello opening. Passes are automatic.
  - **Dots and Boxes**: a 4 × 4 grid of boxes. Close a box to draw again. The Scribe solves the endgame exactly at Fair and Sharp.
- Four new display exhibits: **The Mansion of Happiness** (1843), **The Checkered Game of Life** (1860), **Halma** and **the Landlord's Game** (Lizzie Magie's 1904 patent).
- The closing lectern now lists Librarium's own games with links, and the end arch reads *Different fables for different tables*.

## 0.7.0: Wing IV

- New wing, **Printed Boards and Parlour Tables** (c. 1300–1900), through a third open arch.
- Three new playable tables:
  - **Fox and Geese**: you are the fox, the Scribe herds 13 geese. Includes a house rule so every game ends.
  - **Draughts**: English draughts, with compulsory multi-jump captures and crowning.
  - **The Game of the Goose**: a 63-square spiral race with geese, the Bridge, Inn, Well, Maze, Prison and Death.
- Three new display exhibits: **The New Queen** (chess after c. 1475, with the old firzan beside the new queen), **Pachisi** on a cloth cross with cowrie shells, and **Mahjong** tiles.
- The table can now skip a player's turn (the Goose's Inn, Well and Prison), moves the piece automatically when a throw allows only one move, and shows a lone piece's rings straight away.
- Longer move notes stay on screen long enough to read.

## 0.6.0: Touch controls

- **Walking joystick** on touch screens: push up or down to walk, left or right to turn.
- **Tap (or click) the floor** to walk to that spot, with a ripple where you tapped.
- **Pinch to zoom** in the hall and at every table. At a zoomed-in table, drag with one or two fingers to pan around the board; pieces stay tappable while zoomed and panned.
- **Mouse wheel and trackpad pinch** zoom on desktop. Embedded in a page, a plain wheel still scrolls the page and Ctrl + wheel zooms.
- Safari's own page zoom no longer fights the museum's pinch, and double-tap page zoom is off on the museum's buttons.
- On phones, walking up to an exhibit lights it on the timeline instead of opening a card over the view.
- Instructions on the entrance card and hint match the device: touch or mouse and keyboard.

## 0.5.0: WordPress plugin

- **WordPress plugin** (`librarium-museum.zip`, built by CI): `[librarium_museum]` shortcode with `height`, `start` and `shop_url`, a **Librarium Archives** Elementor widget with the same settings, assets loaded only where the museum appears, and three.js bundled.
- **Embedded mode:** the museum can live in a box inside any page. It sizes from its box, the phone layout follows the box width, it only takes the keyboard while in use, and the timeline no longer scrolls the host page.
- **Full-screen button** on the standalone page and when embedded.
- **Scoped styles:** every rule now lives under `#lm-app` and every id is prefixed `lm-`, so themes and the museum can't restyle each other.
- `embed-demo.html`: a stand-in WordPress page for checking the embedded mode.
- PHP render tests for the shortcode, including rejection of unsafe heights, unknown exhibits and `javascript:` links.

## 0.4.0: Refinements

- **Scribe levels:** Gentle, Fair and Sharp, chosen from the table's HUD and remembered. Strategy games now search with iterative deepening inside a per-level time budget, and stop as soon as the budget is spent, so phones never stall.
- **Last move:** ember marks show where the Scribe's last move came from and went to; they clear when you move.
- **Rules on first visit:** each table opens its rules the first time you sit down, with a "Got it" button.
- **Visitor progress:** visited exhibits are marked on the timeline, and each table keeps your win/loss/draw record, shown on its placard and after every game. Stored in the browser only.
- **Fix:** the Scribe no longer waits for an animation frame before thinking, so a game left in a background tab carries on instead of pausing.
- New tests for levels: the Scribe stays within its budget at every level and never leaves the board changed after thinking.

## 0.3.0: Wing III

- New wing, **Kings, Cards and Courts**, through a second open arch.
- Two new playable tables: **Tables** (modern backgammon rules, without the cube) and **Shatranj** (medieval Islamic chess, with stalemate and bare-king wins).
- Four new display exhibits: **Chaturanga** on an ashtapada board with elephants, chariots, horses and foot soldiers; simplified **Lewis Chessmen** figures; **Playing Cards** from China, Mamluk Egypt and early Europe; and gilded **Tarot** trumps. All card faces and figures are new designs, not copies of surviving pieces.
- Dice games can now take several moves per throw, offered one die at a time, and the Scribe plays a whole turn as a plan.
- Two-dice faces in the HUD, and Tables shows pip counts.
- The hall's books are split into one mesh per wing so out-of-view wings are skipped.
- Debug mode gains a fallback ticker for hidden tabs and a `snap()` helper.

## 0.2.0: Wing II

- New wing, **Strategy Takes the Table**, through an open arch at the end of Wing I.
- Three new playable tables against the Scribe: **Nine Men's Morris**, **Oware** and **Brandubh**.
- Two new display exhibits: **Weiqi (Go)** on a 17 × 17 Han-style board, and **Ludus latrunculorum** with glass counters.
- Shared negamax AI with alpha-beta pruning for the strategy games.
- The play table now handles dice-free games, two-step moves (piece, then destination) and follow-up choices such as removing a piece after a Morris mill.
- Lighting now uses a small pool of lights that follow the nearest candles and exhibits, so the longer hall stays fast.
- The timeline groups exhibits by wing, and the Librarium lectern moved to the end of Wing II.
- On phones, the 3D view slides up above the placard sheet.
- Ring targets are clickable across their whole face.
- `?debug` exposes the live state in the console.

## 0.1.0: Wing I

- Candlelit hall with Senet, Mehen, the Başur Höyük pieces, the Royal Game of Ur and Hounds and Jackals.
- Playable Senet and Royal Game of Ur.
