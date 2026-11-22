# The soundtrack

The Archives have their own music: a quiet piece for the entrance hall, with a hushed choir and a little Latin, two instrumental pieces for each of the six wings, and the main theme, an orchestral overture with a chanted Latin choir, which plays under the credits. Each comes in two takes: 16 tracks and about 39 minutes in all. Jeremy Anderson made them with [Suno](https://suno.com) (model v6) on a Pro plan, for Librarium Games. Songs made while subscribed to Pro belong to the person who made them and may be used commercially ([Suno: "Does Suno own the music I make?"](https://help.suno.com/en/articles/2416769)).

## What plays where

| When | Music |
| --- | --- |
| Your first click, tap or key | **The Entrance Hall** (3:35) fades in. A link to an exhibit further in starts that wing's music instead |
| Walking into another wing, or back to the entrance | a 2.5-second crossfade to its music, once you have been there 2.5 seconds |
| A piece ends | the other take of the same place |
| The credits | **Librarium (Main Theme)** from the start (1:47, then its second take, 1:38). Closing them crossfades back to the music of where you stand |
| Seated at a table | the same piece, at a little under half volume |
| The tour reading a placard aloud | lower still, under the voice |
| The tab hidden | paused |

## The soundtrack panel

The music button (a pair of notes, top right, left of the speaker) opens the soundtrack panel. Hovering the button names the piece playing; a slash across it means the music is paused.

| In the panel | What it does |
| --- | --- |
| The piece playing | Its title and take, a bar to drag (or arrow along) to any point in it, and the time |
| Play / Pause | Pause keeps your place; Play picks up there. Paused is remembered for your next visit |
| Previous / Next | The piece before or after in the list. Previous goes back to the start of the piece first, if it is more than a few seconds in |
| **Follow the hall** | The music of wherever you walk, as in the table above. This is how a visit starts |
| **In order** | Every piece in turn, down the list, wherever you are. Picking a piece, Previous or Next switches to this; Follow the hall switches back |
| The list | All sixteen pieces: the entrance hall, the wings, and the main theme under Credits, each with its length. Pick one to hear it at once; the one playing is marked |
| **Roll the credits** | Opens the credits (below) |

Esc or × closes the panel; the music carries on. The speaker button is apart from all this: it still mutes the sound effects and the read-aloud voice. On a phone at a table the music button folds away to leave room for the table's own bar; the music carries on, and the panel is there again in the hall.

## The credits

The credits roll over the hall like the end of a film, while the main theme plays: who the Archives were made for, with Librarium Games' own games; every exhibit, wing by wing, with its date; the soundtrack; what the hall is built with; and who built it. They take about a hundred seconds, the length of the theme's first take, and end on a card with **Back to the hall**.

| | |
| --- | --- |
| Opening them | **Roll the credits** on the lectern at the end of the hall, beside Visit Librarium Games, or at the foot of the soundtrack panel |
| Moving through them | Wheel, drag, the arrow keys, Page Up and Down, Home and End. The roll holds where you leave it for a few seconds, then carries on |
| Pause | Holds the roll until you press it again (Roll on) |
| Reduced motion | The roll does not move by itself; it is a page to scroll, and Pause is not shown |
| Closing | Esc, ×, or Back to the hall. The music goes back to where you are, or to In order if you had picked a piece. Paused music stays paused, and the credits roll in silence |

The exhibits listed come from the hall's own data, so the credits stay right as exhibits are added. `src/hall/19c-credits.js` builds them.

## The tracks

| File | Title | Length | Style |
| --- | --- | --- | --- |
| `lobby-a.mp3` | The Entrance Hall | 3:35 | Ambient fantasy exploration score, after the calm travelling music of open-world role-playing games: warm low strings, harp arpeggios, flute and oboe, a distant hushed choir humming and softly chanting Latin; no drums or brass; 70 bpm |
| `lobby-b.mp3` | the same, second take | 3:28 | |
| `wing1-a.mp3`, `-b` | Wing I: The First Boards | 1:43, 2:19 | Ancient Near East: frame drum, oud, ney and drone; 70 bpm |
| `wing2-a.mp3`, `-b` | Wing II: Strategy Takes the Table | 2:54, 3:08 | Guqin and lyre, East and West; 72 bpm |
| `wing3-a.mp3`, `-b` | Wing III: Kings, Cards and Courts | 2:38, 2:32 | Medieval and Renaissance: hurdy-gurdy, lute, recorder; 80 bpm |
| `wing4-a.mp3`, `-b` | Wing IV: Printed Boards and Parlour Tables | 2:15, 2:07 | Baroque and classical chamber music: harpsichord and string quartet; 84 bpm |
| `wing5-a.mp3`, `-b` | Wing V: The Modern Board Game | 2:25, 2:29 | Early 1900s parlour music: upright piano, clarinet, brushes; 92 bpm |
| `wing6-a.mp3`, `-b` | Wing VI: Games of the World | 2:46, 1:00 | World fusion: kora, koto, marimba; 85 bpm |
| `credits-a.mp3` | Librarium (Main Theme) | 1:47 | Epic orchestral overture: deep male choir chanting in unison, war drums and taiko, low brass and horns, soaring strings; D minor, 90 bpm. Until 0.44.0 it was the opening theme, played at the first click |
| `credits-b.mp3` | the same, second take | 1:38 | |

The entrance hall's words, sung softly between instrumental passages, are original Latin written for the Archives:

> Lumen in libris / Silentium aulae … Lente ambulamus / Memoria ludorum

(Light in the books, the silence of the hall … slowly we walk, the memory of games.)

The main theme's words, also original Latin:

> Ludus antiquus, vigila / Tabula, alea, charta / Lumen in umbra, memoria / Librarium, Librarium! … Surgite, lusores! / Aperite portas! / Ludus aeternus vivit / Librarium!

(Wake, ancient game: board, dice, card; a light in the dark, memory. Rise, players! Open the gates! The game lives for ever.)

## The files

The tracks are in `music/` as stereo MP3s at about 100 kbps (LAME's VBR `-V 7`), which every browser plays and every host serves: 25 MB for all sixteen, half the size of the downloads. They were levelled to the same loudness (−16 LUFS; the entrance hall −17, as quiet as its room; the main theme −15) so that crossing an arch never jumps in volume. To redo them from the masters:

```bash
# the MP3s downloaded from Suno, renamed lobby-a.mp3, lobby-b.mp3, wing1-a.mp3 … wing6-b.mp3, credits-a.mp3, credits-b.mp3
# (any that are missing are skipped, so one piece can be replaced on its own)
node tools/encode-music.mjs path/to/masters     # needs ffmpeg
```

The masters are not kept in the repository; they are in the Suno workspace.

## How it is built

`src/hall/19b-music.js` (the `music` module) streams each piece through an `<audio>` element, so nothing is fetched until it plays and a piece starts before it has all arrived. Two of them take turns, so one piece can fade out as the next fades in, and each runs through a Web Audio gain node, since iOS ignores an audio element's own volume. Both are woken inside the first click, as iOS will only start audio from one.

Where the files are:

- **The website** (GitHub Pages): `music/` beside `index.html`. The service worker leaves them to the network rather than caching them, as a browser fetches audio in ranges a cache cannot hold.
- **WordPress**: the plugin ships them in `assets/music/` and points the hall at them with `data-music` on `#lm-app`.
- **The single-file artifact** (`dist/artifact.html`): the music is not inlined. Published with `music/` beside it, it plays; without, the first piece fails to load and the music button hides itself.
