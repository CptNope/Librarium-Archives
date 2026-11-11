=== Librarium Archives ===
Contributors: cptnope
Tags: board games, archive, 3d, history, game
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.5.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A walkable 3D archive of the oldest board and card games, with tables visitors can play against an AI opponent, the Scribe.

== Description ==

Visitors walk a candlelit library hall in six wings, read the history of each game on its placard, and sit down to play:

57 exhibits, 49 of them playable:

* Wing I, The Dawn of Play: Senet, the Royal Game of Ur and Hounds and Jackals (playable, Senet and Hounds and Jackals as modern reconstructions); Mehen, the Başur Höyük pieces, the first dice.
* Wing II, Strategy Takes the Table: Go, Ludus latrunculorum, Patolli, Nine Men's Morris, Oware, Alquerque and Brandubh (playable; latrunculi and patolli as modern reconstructions); Petteia, Liubo.
* Wing III, Kings, Cards and Courts: Tables (backgammon), Shatranj, Xiangqi, Chaturaji, Four Seasons chess and tarocchi (playable); Chaturanga, the Lewis Chessmen, playing cards.
* Wing IV, Printed Boards and Parlour Tables: Fox and Geese, chess, Draughts, Pachisi, the Game of the Goose, Cribbage, Dominoes, Tablut, Snakes and Ladders, Ludo and Mahjong (all playable).
* Wing V, The Modern Board Game: the Mansion of Happiness, the Checkered Game of Life, Reversi, Halma, Dots and Boxes, Chinese checkers, the Landlord's Game, Kalah and Hex (all playable).
* Wing VI, Games of the World: Mū tōrere, Shogi, Gomoku, Makruk, Bagh-chal, Kōnane, Yut Nori, Janggi, Fanorona, Bao, Morabaraba, Seega and Tâb (all playable).

The hall ends at a lectern of Librarium's own games.

Visitors walk with the arrow keys or WASD, or on phones and tablets with an on-screen joystick or by tapping the floor, and pinch to zoom. The Scribe plays at three levels. Visitor progress (exhibits visited, records at each table) is kept in the visitor's own browser only; the plugin stores nothing on the server.

== Usage ==

Shortcode:

`[librarium_archives]`

`[librarium_archives height="720px" start="tables" shop_url="https://librarium.games/"]`

* height: CSS height of the Archives box (px, vh, svh, dvh, em, rem or %). Default 80vh.
* start: the exhibit to open on, by its id: for example senet, go, tables, newqueen (chess), mahjong, hex or bao. Every id is listed in docs/wordpress.md in the repository. Default: the entrance.
* shop_url: where the "Visit Librarium Games" button at the end of the hall points.

Elementor: add the "Librarium Archives" widget. In the editor it shows a placeholder; the 3D hall runs on the live page.

Only one copy of the Archives can appear on a page. Assets load only on pages that show it.

== Third-party code ==

* three.js r128 (MIT License, https://threejs.org), bundled in assets/vendor.
* Fonts Almendra SC, Amethysta and Montserrat from Google Fonts (SIL Open Font License).

== Changelog ==

= 0.22.1 =
* Hex: you always move first; the swap rule is optional and off by default.

= 0.22.0 =
* The Mansion of Happiness (1843) and the Checkered Game of Life (1860) are playable, with every square read from scans of original boards.

= 0.21.0 =
* Hounds and Jackals, Ludus latrunculorum and Patolli are now playable as modern reconstructions, and their placards say so and name whose.

= 0.20.0 =
* New playable exhibits: Seega and Tâb from Egypt, Bagh-chal from Nepal, and Four Seasons chess from Alfonso X's Book of Games (start values seega, tab, baghchal, fourseasons).

= 0.19.0 =
* Chaturaji, chess for four with dice as al-Biruni described it about 1030: you against three Scribes.

= 0.18.1 =
* Documentation rewritten; the Elementor exhibit list is now grouped by wing.

= 0.18.0 =
* New playable exhibits: Ludo, Janggi and Morabaraba (start values ludo, janggi, morabaraba).

= 0.17.0 =
* New playable exhibits: Cribbage, Tablut, Kalah and Makruk (start values cribbage, tablut, kalah, makruk).

= 0.16.0 =
* New playable exhibits: Dominoes, Chinese Checkers, Hex and Gomoku. Use dominoes, chinese, hex or gomoku as the start exhibit.

= 0.15.0 =
* The shortcode is now [librarium_archives] and the plugin slug librarium-archives.
* The Landlord's Game (1904) is playable, on a board read from the patent drawing.

= 0.14.1 =
* Renamed from the Museum of Play to the Librarium Archives.

= 0.14.0 =
* Mahjong (with three Scribe players) and Bao are now playable.

= 0.13.0 =
* Chess, Shogi, Yut Nori and Pachisi are now playable.

= 0.12.0 =
* Wing VI, Games of the World: Mū tōrere, Kōnane and Fanorona to play; Shogi, Yut Nori and Bao on display.

= 0.11.0 =
* New navigation: wing tabs, previous and next, and a searchable index of every exhibit.

= 0.10.0 =
* Sound (synthesized, with a mute button), a playable tarocchi card game, and Dots and Boxes on a 5 × 5 grid.

= 0.9.0 =
* Playable Halma, 9 × 9 Go, Alquerque, Xiangqi and Snakes and Ladders, plus the first dice, Petteia, Liubo and Patolli on display.

= 0.8.0 =
* Wing V: Reversi and Dots and Boxes, plus the Mansion of Happiness, the Checkered Game of Life, Halma and the Landlord's Game. The closing lectern links to Librarium's games.

= 0.7.0 =
* Wing IV: Fox and Geese, Draughts and the Game of the Goose, plus the new chess queen, Pachisi and Mahjong.

= 0.6.0 =
* Touch controls: walking joystick, tap the floor to walk, pinch to zoom and pan at the tables.

= 0.5.0 =
* First WordPress release: shortcode, Elementor widget, embedded and full-screen modes.
