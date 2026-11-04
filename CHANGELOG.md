# Changelog

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
