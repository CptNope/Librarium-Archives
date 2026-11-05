=== Librarium Museum of Play ===
Contributors: cptnope
Tags: board games, museum, 3d, history, game
Requires at least: 6.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.5.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A walkable 3D museum of the oldest board and card games, with tables visitors can play against an AI opponent, the Scribe.

== Description ==

Visitors walk a candlelit library hall in five wings, read the history of each game on its placard, and sit down to play:

* Wing I, The Dawn of Play: Senet and the Royal Game of Ur (playable), Mehen, the Başur Höyük pieces, the first dice, Hounds and Jackals.
* Wing II, Strategy Takes the Table: Go, Nine Men's Morris, Oware, Alquerque and Brandubh (playable), Petteia, Liubo, Ludus latrunculorum, Patolli.
* Wing III, Kings, Cards and Courts: Tables (backgammon), Shatranj, Xiangqi and tarocchi (playable), Chaturanga, the Lewis Chessmen, playing cards, painted tarot trumps.
* Wing IV, Printed Boards and Parlour Tables: Fox and Geese, Draughts, the Game of the Goose and Snakes and Ladders (playable), the new chess queen, Pachisi, Mahjong.
* Wing V, The Modern Board Game: Reversi, Halma and Dots and Boxes (playable), the Mansion of Happiness, the Checkered Game of Life, the Landlord's Game, and a lectern of Librarium's own games.

Visitors walk with the arrow keys or WASD, or on phones and tablets with an on-screen joystick or by tapping the floor, and pinch to zoom. The Scribe plays at three levels. Visitor progress (exhibits visited, records at each table) is kept in the visitor's own browser only; the plugin stores nothing on the server.

== Usage ==

Shortcode:

`[librarium_museum]`

`[librarium_museum height="720px" start="tables" shop_url="https://librarium.games/"]`

* height: CSS height of the museum box (px, vh, svh, dvh, em, rem or %). Default 80vh.
* start: the exhibit to open on, for example senet, ur, morris, oware, brandubh, tables, shatranj, foxgeese, draughts or goose. Default: the entrance.
* shop_url: where the "Visit Librarium Games" button at the end of the hall points.

Elementor: add the "Museum of Play" widget. In the editor it shows a placeholder; the 3D hall runs on the live page.

Only one museum can appear on a page. Assets load only on pages that show it.

== Third-party code ==

* three.js r128 (MIT License, https://threejs.org), bundled in assets/vendor.
* Fonts Almendra SC, Amethysta and Montserrat from Google Fonts (SIL Open Font License).

== Changelog ==

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
