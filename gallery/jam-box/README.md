# Jam Box

A step sequencer for one to four players on their own phones or laptops. One player starts a jam and gets a four-letter code; the others join with it. Every tap changes every screen in the room: drums, chords, both melody voices, the key, the tempo, and play/stop are shared. Everyone wears headphones and hears the same loop on the same clock.

Done when: four students in a room, each on their own phone with headphones, build one loop together (drums, chords, two voices), hear every change land on all four phones, record a part live from the pads or keyboard, and save the result as an audio file.

Live: https://kramermusician.github.io/lens101/gallery/jam-box/ (gallery copy in `lens101-site/gallery/jam-box/`; copy every change over and push).

## Run

`./run.sh` serves the folder on port 8881 and opens it (`--serve-only` skips the browser). Plain HTML, CSS and JS, no build step. Firebase loads from the gstatic CDN; "Just me" mode works with no network.

## What's in it

- Drums: six rows (kick, snare, clap, hat, open hat, bongo), one bar of 16ths that repeats. Grid or Pads.
- Chords: four bars, one chord each, picked from the seven chords in the key (shown by name and Roman numeral). Key, major/minor and a style (Pad, Bounce, Arp) are shared. Bass follows the chord root.
- Voice 1 and Voice 2: ten scale notes by 32 eighth notes (four bars). Piano roll or Keyboard (an on-screen piano with only the notes in the key lit). Sounds: Pluck, Bell, Chip, Flute, Bass; octave -2 to +1. Notes are stored as scale degrees, so changing the key transposes the whole song.
- Record (R or the red button): play the pads, piano keys, or the home row of the computer keyboard (A S D F G H J K L ;) and each hit is snapped to the nearest step and saved for everyone. Live hits are also sent to the room, so the others hear you play.
- Tempo, play and stop are shared. Changing tempo keeps the loop where it is.
- Each cell is colored by the player who placed it, and a cell someone else adds pops in. The dots under each tab show who is working there.
- More (the dots): Save audio records two times through the loop from bar 1 and downloads it (webm, or m4a on Safari). Leave the jam.
- Keys: Space play/stop, R record.

## How it works

- `js/sync.js`: rooms live in Keystroke Derby's Realtime Database at `/lens101/JAM-{CODE}`. The `lens101` rules block already lets any anonymous signed-in user read and write there, so no rules deploy was needed. Room keys: `s` (bpm, key, minor, play, anchor, cs), `d`, `c` (`b0`..`b3`, never numeric keys, which Firebase turns into arrays), `m1`, `m2` (cells `row_col` -> player color), `v` (sound, octave), `mute`, `p` (presence: name, color, tab; removed on disconnect, re-added on reconnect), `n` (last live note per player). Four players max; the fifth gets "room full".
- Shared clock: step n plays at `anchor + n * stepMs` in server time (`.info/serverTimeOffset`). Each phone schedules 150 ms ahead and sends audio early by its reported output latency, so Bluetooth headphones stay in time where the browser reports it. A tempo change rewrites `anchor` so the current position carries on.
- `js/audio.js`: all synthesized. On iPhone, `navigator.audioSession` plus a silent looping audio element keep the ring/silent switch from muting it.
- `js/app.js`: UI. Every edit goes through `put()`, which applies locally at once and writes the room; the room listeners redraw everyone else.

## Tested

2026-11-11, headless Chrome, two isolated browser sessions (desktop + phone size): join by code, drum cell, tempo, voice note, chord, key change, shared play/stop, and a recorded pad hit all reached the other session; both playheads showed the same step.
