#!/usr/bin/env node
// Re-encodes the soundtrack's masters into the small files the hall plays, in music/.
//
//   node tools/encode-music.mjs <folder of masters>
//
// The masters are the MP3s downloaded from Suno, renamed to the names below (lobby-a.mp3, wing1-a.mp3 and
// so on); any that are missing are skipped, so one piece can be added or replaced on its own. They are
// about 190 kbps; the hall's copies are VBR MP3 at LAME's -V 7 (about 100 kbps), which halves the size (all
// sixteen come to about 24 MB) without anything you would hear through laptop speakers. Each track is first measured
// and then turned up or down to the same loudness, so walking from one wing into the next never jumps in
// volume. The entrance hall's music sits a decibel lower, as quiet as the room it plays in; the main theme,
// which plays under the credits, a decibel hotter. Needs ffmpeg on the PATH.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2];
if (!src) { console.error('usage: node tools/encode-music.mjs <folder of masters>'); process.exit(1); }
const out = join(root, 'music');
mkdirSync(out, { recursive: true });

// File name, title for the tags, and target loudness (LUFS).
const TRACKS = [
  ['lobby-a', 'The Entrance Hall', -17], ['lobby-b', 'The Entrance Hall (second take)', -17],
  ['wing1-a', 'Wing I: The First Boards', -16], ['wing1-b', 'Wing I: The First Boards (second take)', -16],
  ['wing2-a', 'Wing II: Strategy Takes the Table', -16], ['wing2-b', 'Wing II: Strategy Takes the Table (second take)', -16],
  ['wing3-a', 'Wing III: Kings, Cards and Courts', -16], ['wing3-b', 'Wing III: Kings, Cards and Courts (second take)', -16],
  ['wing4-a', 'Wing IV: Printed Boards and Parlour Tables', -16], ['wing4-b', 'Wing IV: Printed Boards and Parlour Tables (second take)', -16],
  ['wing5-a', 'Wing V: The Modern Board Game', -16], ['wing5-b', 'Wing V: The Modern Board Game (second take)', -16],
  ['wing6-a', 'Wing VI: Games of the World', -16], ['wing6-b', 'Wing VI: Games of the World (second take)', -16],
  ['credits-a', 'Librarium (Main Theme)', -15], ['credits-b', 'Librarium (Main Theme, reprise)', -15],
];

let total = 0;
for (const [name, title, target] of TRACKS) {
  const master = join(src, `${name}.mp3`);
  if (!existsSync(master)) { console.warn(`missing ${master}, skipped`); continue; }
  // ffmpeg prints the loudness summary on stderr.
  const meter = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', master, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const lufs = parseFloat(([...meter.stderr.matchAll(/^\s+I:\s+(-?[\d.]+) LUFS/gm)].pop() || [])[1]);
  if (!Number.isFinite(lufs)) throw new Error(`could not measure ${master}`);
  const gain = (target - lufs).toFixed(1);
  const file = join(out, `${name}.mp3`);
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', master, '-vn', '-map_metadata', '-1',
    '-af', `volume=${gain}dB,afade=t=in:d=0.05`, '-c:a', 'libmp3lame', '-q:a', '7', '-ac', '2', '-ar', '44100', '-id3v2_version', '3',
    '-metadata', `title=${title}`, '-metadata', 'album=Librarium Archives', '-metadata', 'artist=Librarium Games', file]);
  const kb = statSync(file).size / 1024; total += kb;
  console.log(`${name}.mp3  ${lufs} LUFS → ${target} (${gain} dB)  ${kb.toFixed(0)} KB`);
}
console.log(`music/ ${(total / 1024).toFixed(1)} MB`);
