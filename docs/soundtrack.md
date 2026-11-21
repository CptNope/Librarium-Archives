# The soundtrack

The Archives have their own music: an opening theme with a chanted Latin choir, and two instrumental pieces for each of the six wings, 14 tracks and about 32 minutes in all. Jeremy Anderson made them with [Suno](https://suno.com) (model v6) on a Pro plan, for Librarium Games. Songs made while subscribed to Pro belong to the person who made them and may be used commercially ([Suno: "Does Suno own the music I make?"](https://help.suno.com/en/articles/2416769)).

## What plays where

| When | Music |
| --- | --- |
| Your first click, tap or key | **Librarium (Opening Theme)**, 1:47. Always heard to the end the first time, wherever you are |
| After it | the music of the wing you are standing in |
| Walking into another wing | a 2.5-second crossfade to that wing's music, once you have been there 2.5 seconds |
| Back at the entrance from further in | the opening again, in its second take (1:38), then the two takes in turn |
| A piece ends | the other take of the same wing |
| Seated at a table | the same piece, at a little under half volume |
| The tour reading a placard aloud | lower still, under the voice |
| The tab hidden | paused |

The music button (a pair of notes, top right, left of the speaker) turns the music on and off and is remembered. It is apart from the speaker button, which still mutes the sound effects and the read-aloud voice. On a phone at a table the music button is folded away to leave room for the table's own bar; the music carries on, and you can turn it off in the hall. Hovering the button shows the name of the piece playing.

## The tracks

| File | Title | Length | Style |
| --- | --- | --- | --- |
| `opening-a.mp3` | Librarium (Opening Theme) | 1:47 | Epic orchestral overture: deep male choir chanting in unison, war drums and taiko, low brass and horns, soaring strings; D minor, 90 bpm |
| `opening-b.mp3` | the same, second take | 1:38 | |
| `wing1-a.mp3`, `-b` | Wing I: The First Boards | 1:43, 2:19 | Ancient Near East: frame drum, oud, ney and drone; 70 bpm |
| `wing2-a.mp3`, `-b` | Wing II: Strategy Takes the Table | 2:54, 3:08 | Guqin and lyre, East and West; 72 bpm |
| `wing3-a.mp3`, `-b` | Wing III: Kings, Cards and Courts | 2:38, 2:32 | Medieval and Renaissance: hurdy-gurdy, lute, recorder; 80 bpm |
| `wing4-a.mp3`, `-b` | Wing IV: Printed Boards and Parlour Tables | 2:15, 2:07 | Baroque and classical chamber music: harpsichord and string quartet; 84 bpm |
| `wing5-a.mp3`, `-b` | Wing V: The Modern Board Game | 2:25, 2:29 | Early 1900s parlour music: upright piano, clarinet, brushes; 92 bpm |
| `wing6-a.mp3`, `-b` | Wing VI: Games of the World | 2:46, 1:00 | World fusion: kora, koto, marimba; 85 bpm |

The opening's words are original Latin written for the Archives:

> Ludus antiquus, vigila / Tabula, alea, charta / Lumen in umbra, memoria / Librarium, Librarium! … Surgite, lusores! / Aperite portas! / Ludus aeternus vivit / Librarium!

(Wake, ancient game: board, dice, card; a light in the dark, memory. Rise, players! Open the gates! The game lives for ever.)

## The files

The tracks are in `music/` as stereo MP3s at about 100 kbps (LAME's VBR `-V 7`), which every browser plays and every host serves: 20 MB for all fourteen, half the size of the downloads. They were levelled to the same loudness (−16 LUFS, the opening −15) so that crossing an arch never jumps in volume. To redo them from the masters:

```bash
# the MP3s downloaded from Suno, renamed opening-a.mp3, opening-b.mp3, wing1-a.mp3 … wing6-b.mp3
node tools/encode-music.mjs path/to/masters     # needs ffmpeg
```

The masters are not kept in the repository; they are in the Suno workspace.

## How it is built

`src/hall/19b-music.js` (the `music` module) streams each piece through an `<audio>` element, so nothing is fetched until it plays and a piece starts before it has all arrived. Two of them take turns, so one piece can fade out as the next fades in, and each runs through a Web Audio gain node, since iOS ignores an audio element's own volume. Both are woken inside the first click, as iOS will only start audio from one.

Where the files are:

- **The website** (GitHub Pages): `music/` beside `index.html`. The service worker leaves them to the network rather than caching them, as a browser fetches audio in ranges a cache cannot hold.
- **WordPress**: the plugin ships them in `assets/music/` and points the hall at them with `data-music` on `#lm-app`.
- **The single-file artifact** (`dist/artifact.html`): the music is not inlined. Published with `music/` beside it, it plays; without, the first piece fails to load and the music button hides itself.
