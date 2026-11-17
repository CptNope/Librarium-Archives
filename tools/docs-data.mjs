// Hand-kept data for tools/build-docs.mjs: the families the exhibits belong to, other names they go by in
// the docs, and the turn diagrams for games whose turns do not follow the two common patterns (a dice race,
// or picking a piece and where it goes). Everything else on the game pages is read from the source.

// Each exhibit (by its stop id) in one family. Display-only exhibits are included.
export const FAMILIES = [
  ['Race games', 'Dice or sticks decide how far; the first home wins.', ['senet', 'mehen', 'ur', 'hounds', 'liubo', 'xii', 'patolli', 'tables', 'nard', 'pachisi', 'ludo', 'yut', 'tab']],
  ['Roll and move on a printed track', 'One counter each on a printed course, with squares that help or hinder.', ['goose', 'snakes', 'mansion', 'lifegame', 'landlord']],
  ['Dice games', 'The dice themselves, and betting on them.', ['basur', 'dice']],
  ['The chess family', 'Armies with a king (or general) to trap.', ['chaturanga', 'shatranj', 'xiangqi', 'chaturaji', 'lewis', 'courier', 'fourseasons', 'newqueen', 'shogi', 'makruk', 'janggi', 'jungle', 'rithmo']],
  ['Hunt and tafl games', 'Unequal sides: a king escaping a larger army, or hunters against a flock.', ['brandubh', 'hnefatafl', 'tablut', 'foxgeese', 'baghchal']],
  ['Capture games', 'Equal armies that take by jumping or by trapping between two.', ['petteia', 'latrunculi', 'seega', 'alquerque', 'draughts', 'idraughts', 'fanorona', 'konane']],
  ['Alignment, connection and blocking', 'Make a line, join two edges, or leave the other side with no move.', ['morris', 'morabaraba', 'gomoku', 'hex', 'mutorere']],
  ['Territory and enclosure', 'Surround, close in or flip to own the most of the board.', ['go', 'dotsboxes', 'reversi']],
  ['Running and jumping races', 'Move a whole army across the board by steps and chains of hops.', ['halma', 'chinese']],
  ['Mancala', 'Sow seeds round a row of pits and capture by count.', ['oware', 'kalah', 'bao']],
  ['Cards', 'Tricks, melds, fishing, combinations and patience, and cards made for other uses.', ['cards', 'tarot', 'courtcards', 'cribbage', 'notforplay', 'scopa', 'whist', 'patience', 'bezique', 'euchre', 'koikoi', 'ganjifa']],
  ['Tiles', 'Dominoes and mahjong.', ['dominoes', 'mahjong']],
];

// Other names an exhibit goes by in docs/exhibits.md and docs/scribe.md, beyond its title and its engine's name.
export const ALIASES = {
  ur: ['Ur', 'Royal Game of Ur'], scopa: ['Scopa'], euchre: ['Euchre'], bezique: ['Bézique'],
  dice: ['Hazard', 'The first dice'], hounds: ['Hounds and Jackals'], go: ['Go', 'Weiqi'], latrunculi: ['Latrunculi', 'Ludus latrunculorum'],
  xii: ['Duodecim scripta', 'Ludus duodecim scriptorum'], morris: ['Morris', "Nine Men's Morris"], oware: ['Oware', 'Mancala'],
  lewis: ['Medieval chess', 'Lewis chessmen'], cards: ['Piquet', 'Playing cards'], tarot: ['Tarocchi', 'Tarot'], newqueen: ['Chess', 'The New Queen'],
  pachisi: ['Pachisi', 'Chaupar'], koikoi: ['Hanafuda', 'Koi-koi'], chinese: ['Chinese checkers'], idraughts: ['International draughts'],
  courier: ['Courier chess'], fourseasons: ['Four Seasons chess', 'Four seasons chess'], lifegame: ['Checkered Game of Life', 'The Checkered Game of Life'],
  mansion: ['Mansion of Happiness', 'The Mansion of Happiness'], landlord: ["The Landlord's Game", "Landlord's Game"], goose: ['Game of the Goose', 'The Game of the Goose'],
  basur: ['Başur Höyük pieces', 'Başur Höyük'], mutorere: ['Mū tōrere'], tab: ['Tâb'], konane: ['Kōnane'], bao: ['Bao'], dotsboxes: ['Dots and Boxes'],
  snakes: ['Snakes and Ladders'], foxgeese: ['Fox and Geese'], baghchal: ['Bagh-chal'], yut: ['Yut Nori'], rithmo: ['Rithmomachia'],
};

// Turn diagrams written by hand, keyed by engine id. Each is the body of a mermaid flowchart.
export const FLOWS = {
  go: `flowchart TD
    S(["Your turn: black"]) --> P["Place a stone on an empty point, or pass"]
    P --> C{"Does it take the last liberty of enemy stones?"}
    C -->|yes| X["Those stones are captured"] --> K
    C -->|no| K{"Both sides passed in a row?"}
    K -->|no| N["White's turn, the same way"] --> S
    K -->|yes| E(["Score: stones plus surrounded points, white adds 7 komi"])`,
  hex: `flowchart TD
    S(["Your turn: red"]) --> P["Place a stone on any empty hexagon"]
    P --> C{"An unbroken red chain joins your two edges?"}
    C -->|yes| W(["You win: Hex cannot be drawn"])
    C -->|no| N["Blue places a stone, joining left and right"] --> S`,
  gomoku: `flowchart TD
    S(["Your turn: black"]) --> P["Place a stone on an empty point"]
    P --> C{"Five or more in an unbroken line?"}
    C -->|yes| W(["You win"])
    C -->|no| F{"Board full?"}
    F -->|yes| D(["Drawn"])
    F -->|no| N["White places a stone"] --> S`,
  reversi: `flowchart TD
    S(["Your turn: dark"]) --> L{"A placement that traps a line of light discs?"}
    L -->|no| P["You pass"] --> N
    L -->|yes| M["Place the disc; every trapped disc flips to dark"] --> N
    N{"Can either side still move?"} -->|yes| O["Light's turn, the same way"] --> S
    N -->|no| E(["More discs showing wins"])`,
  dotsboxes: `flowchart TD
    S(["Your turn"]) --> D["Draw a line between two neighbouring dots"]
    D --> B{"Did it close the fourth side of a box?"}
    B -->|yes| Y["The box is yours"] --> A{"Lines left?"}
    A -->|yes| D
    B -->|no| O["The Scribe's turn"] --> S
    A -->|no| E(["More boxes wins"])`,
  oware: `flowchart TD
    S(["Your turn"]) --> P["Take every seed from one of your six pits"]
    P --> W["Sow them one by one, counterclockwise, skipping the emptied pit"]
    W --> L{"Last seed makes 2 or 3 in a Scribe pit?"}
    L -->|yes| C["Capture it and the run of 2s and 3s before it, unless that empties the Scribe's side"] --> G
    L -->|no| G{"25 seeds captured?"}
    G -->|yes| E(["You win"])
    G -->|no| N["The Scribe sows; you must feed an empty side if you can"] --> S`,
  kalah: `flowchart TD
    S(["Your turn"]) --> P["Take all the seeds from one of your pits"]
    P --> W["Sow them anticlockwise, through your store, never the Scribe's"]
    W --> K{"Last seed in your store?"}
    K -->|yes| S
    K -->|no| C{"In an empty pit of yours, with seeds opposite?"}
    C -->|yes| X["Capture both into your store"] --> G
    C -->|no| G{"One side's pits all empty?"}
    G -->|yes| E(["Remaining seeds go to their owner; the fuller store wins"])
    G -->|no| N["The Scribe's turn"] --> S`,
  bao: `flowchart TD
    S(["Your turn"]) --> P["Pick a pit with two or more seeds, then the direction"]
    P --> W["Sow round your own two rows"]
    W --> L{"Where does the last seed fall?"}
    L -->|"occupied inner pit, seeds opposite"| C["Capture them and sow them in from a kichwa"] --> W
    L -->|"other occupied pit"| R["Pick up everything there and keep sowing"] --> W
    L -->|"empty pit"| T["The turn ends"] --> G
    G{"The Scribe's inner row empty, or no move?"} -->|yes| E(["You win"])
    G -->|no| N["The Scribe's turn"] --> S`,
  morris: `flowchart TD
    S(["Your turn"]) --> Q{"Pieces still to place?"}
    Q -->|yes| P["Place one on an empty point"]
    Q -->|no| M["Move one along a line; with three left, fly anywhere"]
    P --> L{"A new mill of three in a row?"}
    M --> L
    L -->|yes| R["Remove a Scribe piece not in a mill"] --> G
    L -->|no| G{"Scribe down to two, or no move?"}
    G -->|yes| E(["You win"])
    G -->|no| N["The Scribe's turn"] --> S`,
  morabaraba: `flowchart TD
    S(["Your turn"]) --> Q{"Cows still to place?"}
    Q -->|yes| P["Place one of your twelve cows"]
    Q -->|no| M["Move a cow along a line; with three left, fly"]
    P --> L{"A new mill, diagonals included?"}
    M --> L
    L -->|yes| R["Shoot a Scribe cow not in a mill"] --> G
    L -->|no| G{"Scribe down to two, or no move?"}
    G -->|yes| E(["You win"])
    G -->|no| N["The Scribe's turn"] --> S`,
  seega: `flowchart TD
    A(["Placing"]) --> P["Place two pieces at a time, never on the centre"]
    P --> F{"All 24 placed?"}
    F -->|no| P
    F -->|yes| M["You move first, into the centre; then one square orthogonally"]
    M --> C{"Enemy piece trapped between two of yours?"}
    C -->|yes| X["Take it, up to three at once, and move again while you can capture"] --> G
    C -->|no| G{"Every enemy piece taken?"}
    G -->|yes| E(["You win"])
    G -->|no| N["The Scribe moves"] --> M`,
  latrunculi: `flowchart TD
    A(["Placing"]) --> P["Place one counter at a time; nothing is captured"]
    P --> F{"All forty placed?"}
    F -->|no| P
    F -->|yes| M["Move a counter one square orthogonally, never straight back"]
    M --> C{"An enemy counter trapped between two of yours, or in a corner?"}
    C -->|yes| X["It is taken"] --> G
    C -->|no| G{"A player down to one counter, or with no move?"}
    G -->|yes| E(["More counters taken wins"])
    G -->|no| N["The Scribe moves"] --> M`,
  baghchal: `flowchart TD
    S(["Goats' turn"]) --> Q{"Goats still off the board?"}
    Q -->|yes| P["Place a goat on any empty point"]
    Q -->|no| M["Move a goat along a line"]
    P --> T["Tigers' turn: move along a line, or jump a goat to capture it"]
    M --> T
    T --> G{"Five goats taken?"}
    G -->|yes| TW(["Tigers win"])
    G -->|no| H{"No tiger can move?"}
    H -->|yes| GW(["Goats win"])
    H -->|no| S`,
  foxgeese: `flowchart TD
    S(["The geese move first"]) --> G["A goose steps forward or sideways along a line"]
    G --> P{"Fox penned in?"}
    P -->|yes| GW(["The geese win"])
    P -->|no| F["Your turn: the fox steps, or jumps a goose and may keep jumping"]
    F --> T{"Six geese or fewer, or no goose can move?"}
    T -->|yes| FW(["The fox wins"])
    T -->|no| S`,
  tarocchi: `flowchart TD
    D(["Thirteen cards each"]) --> L["The leader plays a card"]
    L --> F["The other follows suit, else trumps, else anything; the Fool may be played instead"]
    F --> W["Highest trump wins, else the highest of the suit led"]
    W --> M{"Cards left?"}
    M -->|yes| L
    M -->|no| C(["Count court cards, trumps I and XXI, the Fool and tricks: the higher total wins"])`,
  mahjong: `flowchart TD
    S(["Your turn, at East"]) --> D["Draw a fourteenth tile"]
    D --> W{"Four sets and a pair, seven pairs or thirteen orphans?"}
    W -->|yes| E(["You win the hand"])
    W -->|no| K["Declare a concealed kong if you like, then discard a tile"]
    K --> C{"Does anyone claim the discard?"}
    C -->|"win, pung or kong"| O["They take it"]
    C -->|"chow: the next player only"| O
    C -->|no| N["The next player draws"]
    O --> N
    N --> R{"Wall empty?"}
    R -->|yes| X(["The hand is drawn"])
    R -->|no| S`,
  dominoes: `flowchart TD
    S(["You lead with any tile"]) --> T["Your turn: play a tile matching an open end"]
    T --> C{"Can you play?"}
    C -->|no| B["Draw from the boneyard until you can, or pass when two are left"] --> C
    C -->|yes| P["Play it"] --> O{"Hand empty, or nobody can play?"}
    O -->|no| N["The Scribe's turn"] --> T
    O -->|yes| E(["Fewer pips wins, scoring the difference"])`,
  cribbage: `flowchart TD
    D(["Deal six each"]) --> K["Each lays two aside for the dealer's crib"]
    K --> T["Turn up the starter: a jack pegs 2 for his heels"]
    T --> P["The play: lay cards in turn, count up to 31, peg 15s, 31s, pairs, runs and the go"]
    P --> S["The show: non-dealer's hand, dealer's hand, then the crib"]
    S --> G{"Someone pegged out, 61 or 121?"}
    G -->|yes| E(["They win"])
    G -->|no| D`,
  whist: `flowchart TD
    D(["Thirteen cards each; the dealer's last card shows trumps"]) --> L["The dealer's left leads"]
    L --> F["Each follows suit if they can, else plays anything"]
    F --> W["Highest trump, or highest of the suit led, wins; the winner leads"]
    W --> M{"Thirteen tricks played?"}
    M -->|no| F
    M -->|yes| S["A point a trick over six, then honours"]
    S --> G{"A side at 5?"}
    G -->|yes| E(["That side wins"])
    G -->|no| D`,
  euchre: `flowchart TD
    D(["Five cards each, one turned up"]) --> O{"Round 1: anyone orders it up?"}
    O -->|yes| T["Its suit is trumps; the dealer takes it and discards"]
    O -->|no| N{"Round 2: anyone names another suit?"}
    N -->|yes| T
    N -->|no| X["The deal is thrown in"] --> D
    T --> A["The maker may go alone"]
    A --> P["Five tricks: follow suit, bowers and the Joker are trumps"]
    P --> S["Makers: 3-4 tricks 1, march 2, alone 4; euchred: 2 to the defenders"]
    S --> G{"A side at 10?"}
    G -->|yes| E(["That side wins"])
    G -->|no| D`,
  piquet: `flowchart TD
    D(["Twelve cards each, eight in the talon"]) --> X["Exchange: elder hand up to five, younger up to the rest"]
    X --> C["Declarations: point, sequence, sets, carte blanche"]
    C --> R{"Repique or pique?"}
    R -->|yes| B["60 or 30 more"] --> T
    R -->|no| T["Twelve tricks, no trumps: a point a lead and a point a win"]
    T --> F["10 for more tricks, 40 for capot"]
    F --> G{"Six deals played?"}
    G -->|no| D
    G -->|yes| E(["The higher total wins"])`,
  bezique: `flowchart TD
    D(["Eight cards each; turn up trumps"]) --> P["Lead and play a trick: no need to follow while the stock lasts"]
    P --> M["The winner may meld once"]
    M --> W["Winner draws, then loser"]
    W --> S{"Stock gone?"}
    S -->|no| P
    S -->|yes| L["Last eight tricks: melds back in hand, follow and win if you can"]
    L --> B["Brisques 10 each, last trick 10"]
    B --> G{"Anyone at 1,000?"}
    G -->|yes| E(["The higher total wins"])
    G -->|no| D`,
  scopa: `flowchart TD
    D(["Three cards each, four on the table"]) --> P["Play a card"]
    P --> C{"A card of the same value on the table?"}
    C -->|yes| T["Take it"]
    C -->|no| S{"Cards adding up to it?"}
    S -->|yes| T2["Take them"]
    S -->|no| L["The card stays on the table"]
    T --> Y{"Table cleared?"}
    T2 --> Y
    Y -->|yes| SC["A scopa: a point now"] --> H
    Y -->|no| H
    L --> H{"Hands empty?"}
    H -->|"no"| P
    H -->|"yes, cards left in the pack"| R["Three more each"] --> P
    H -->|"yes, pack spent"| F["Last taker takes the table; score cards, coins, settebello, primiera"]
    F --> G{"Anyone at 11 or 21?"}
    G -->|yes| E(["Higher score wins"])
    G -->|no| D`,
  koikoi: `flowchart TD
    D(["Eight cards each, eight on the table"]) --> P["Play a card: take a table card of the same month, or leave yours"]
    P --> T["Turn up the pile's top card and match it the same way"]
    T --> Y{"A new yaku?"}
    Y -->|no| H{"Hands empty?"}
    Y -->|yes| K{"Stop or koi-koi?"}
    K -->|stop| S["Score the month"]
    K -->|koi-koi| H
    H -->|no| P
    H -->|yes| S
    S --> G{"Last month played?"}
    G -->|no| D
    G -->|yes| E(["Highest total wins"])`,
  patience: `flowchart TD
    S(["Seven columns dealt, the rest the stock"]) --> C{"A card to move?"}
    C -->|yes| M["Move it, or a face-up run, onto a column or a foundation"]
    M --> F["A column's next card turns over"] --> W
    C -->|no| D["Turn the stock onto the waste, or turn the waste over"] --> C
    W{"All 52 on the foundations?"} -->|yes| E(["Patience is rewarded"])
    W -->|no| C
    C -->|"stuck"| U(["Undo, or give up"])`,
  hazard: `flowchart TD
    S(["The caster stakes and calls a main, 5 to 9"]) --> T["Throw two dice"]
    T --> N{"A nick?"}
    N -->|yes| W["The caster wins the stake"]
    N -->|"2, 3, or another 11 or 12"| L["The caster throws out and loses"]
    N -->|"anything else"| C["That is the chance"] --> R["Throw again"]
    R --> Q{"Chance or main?"}
    Q -->|chance| W
    Q -->|main| L
    Q -->|other| R
    W --> G
    L --> X{"Three losses in a row?"}
    X -->|yes| P["The dice pass"] --> G
    X -->|no| G
    G{"A purse empty, or 24 mains?"} -->|no| S
    G -->|yes| E(["The fuller purse wins"])`,
  landlord: `flowchart TD
    S(["Your turn"]) --> T["Throw two dice and move clockwise"]
    T --> M{"Passed Mother Earth?"}
    M -->|yes| Wg["Draw $100 wages; pay interest on notes"] --> L
    M -->|no| L{"Where did you land?"}
    L -->|"a green lot"| B["Buy it or rent it"]
    L -->|"someone's lot"| R["Pay the owner rent"]
    L -->|"necessity, railroad, luxury, franchise"| F["Tax, fare, ticket or charter"]
    L -->|"No Trespassing"| J["Jail: pay $50 or throw a double"]
    B --> C
    R --> C
    F --> C
    J --> C
    C{"Both round five times?"} -->|no| N["The other player's turn"] --> S
    C -->|yes| E(["The richer player wins"])`,
  mansion: `flowchart TD
    S(["Your turn"]) --> T["Spin the teetotum and move along the spiral"]
    T --> V{"Where did you land?"}
    V -->|"a virtue"| A["Advance six more"]
    V -->|"Audacity, Cruelty, Immodesty, Ingratitude"| B["Go back where you were"]
    V -->|"a crime or folly"| P["Punished: sent to its square"]
    V -->|"another counter"| K["It goes back to your old square"]
    V -->|"anywhere else"| G
    A --> G
    B --> G
    P --> G
    K --> G
    G{"Exactly on 67?"} -->|yes| E(["The Mansion of Happiness: you win"])
    G -->|no| N["The other player's turn"] --> S`,
  lifegame: `flowchart TD
    S(["Your turn"]) --> T["Spin the teetotum: it sets the direction and the distance"]
    T --> M["Move; a pointing hand carries you on"]
    M --> P["A numbered square scores its points"]
    P --> K{"Landed on the other counter?"}
    K -->|yes| J["It goes back to Jail"] --> G
    K -->|no| G{"100 points?"}
    G -->|yes| E(["You win"])
    G -->|no| N["The other player's turn"] --> S`,
  chaturaji: `flowchart TD
    S(["Yellow's turn: you"]) --> T["Throw two dice"]
    T --> U["Each die moves one piece of its kind: king or pawn, boat, horse, elephant"]
    U --> C{"A capture?"}
    C -->|yes| P["Score it: king 5 down to pawn 1"] --> K
    C -->|no| K{"Three kings taken, or yours lost?"}
    K -->|yes| E(["Chaturaji, or you are out"])
    K -->|no| N["Black, Red and Green take their turns, clockwise"] --> S`,
  fourseasons: `flowchart TD
    S(["Green, spring, moves first"]) --> Y["Your turn: Red, summer"]
    Y --> M["Move one piece; never leave your king in check"]
    M --> C{"An army mated or stalemated?"}
    C -->|mate| A["It passes to the player who mated"]
    C -->|stalemate| R["It is removed"]
    C -->|no| N
    A --> N
    R --> N
    N["Black, autumn, then White, winter"] --> G{"One player left, or 60 rounds?"}
    G -->|no| S
    G -->|yes| E(["The last player, or the strongest army, wins"])`,
};

// The winning condition, for turn diagrams of games whose placard has no Goal or Win line. Keyed by engine id.
export const WIN = {
  hounds: 'All five pins at the goal', xii: 'All fifteen borne off', patolli: 'All six markers round, or the other cannot pay',
  alquerque: 'The Scribe has no piece, or none that can move', hnefatafl: 'The king reached a corner, or was taken or ringed',
  rithmo: "The Scribe's pyramid, or five of its pieces, taken", lewischess: 'Checkmate', courier: 'Checkmate', chess: 'Checkmate',
  idraughts: 'The Scribe has no piece or no move', pachisi: 'All your pieces home', tablut: 'The king reached the edge, or was taken',
  ludo: 'All four tokens home', halma: 'All your men in the far camp', chinese: 'All your marbles in the far point', shogi: 'Checkmate',
  makruk: 'Checkmate', yut: 'All four pieces home', janggi: 'Checkmate', fanorona: 'Every enemy stone taken', nard: 'All fifteen borne off',
  tab: 'Every Scribe piece taken', chaturanga: 'Checkmate, stalemate, or a bare raja',
};

// Notes for a game that the other guides do not cover, printed under "How the Scribe plays".
export const NOTES = {
  patience: 'There is no Scribe at this table. Hint suggests a move by rule of thumb (a card up to a foundation, then a move that turns over a hidden card, then the waste, then the stock). Played on its own, that rule wins about 36% of draw-one deals and 10% of draw-three deals, over 300 deals each.',
};

// The Pack switch's packs, for the card-table pages.
export const PACKS = { french: 'French', german: 'German', swiss: 'Swiss', latin: 'Italian (Latin) suits' };
