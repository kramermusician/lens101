# Chord Drop

Type a song's chords, tap the changes along with a drum groove, and print a chart that shows the band when each chord lands. Built for Dave Bove, who writes chord sheets with no rhythm on them.

Done when: Dave opens one link on his own, types a song's chords by section, picks a tempo and a groove, taps the changes on the space bar, hears it played back, and saves a PDF the band can read cold.

## Run

`./run.sh` serves the folder on port 8838 and opens it. `--serve-only` skips the browser. Plain HTML, CSS and JS, no build step, nothing loaded from the network.

## How it works

1. Type chords under section names: `[Verse]`, `[Chorus]`. A name with nothing under it repeats that section. `x2` after a line or a name plays it twice. `N.C.` is a stop. Bar lines (`| G / C / | D |`) skip tapping for that section.
2. Set tempo (number, slider, or tap tempo), time signature (4/4, 3/4, 2/4, 6/8, 12/8), beat (Click, Rock, Shuffle, Funk) and the snap grid. Picking a groove sets the grid to match: Rock 8ths, Shuffle swung 8ths, Funk 16ths.
3. Pick a section, press Record (or Space). After the count-in the first chord starts on beat 1 by itself; Space for each next chord; one more Space where the section ends (rounded to the nearest bar). Backspace takes back a tap, Esc stops.
4. Click a chord on the chart and the arrow keys move it one 16th note (Shift: one beat); up and down pick the chord before or after. Click a word on the chart and the same keys move that box's words, stored as a tick offset from its chord in `song.lyrics[key].shifts[verse][box]`, so the words follow when the chord moves. "Back under its chord" clears it. Cmd+Z undoes rhythm and word moves (each undo step keeps only what it changed).
5. Words go in step 4, after tapping: one box per chord ("what you sing while it plays"), labeled with where the chord lands (bar 3, and of 4). A box ending in "-" splits a word across two chords. "+ Words for Verse 2" adds another verse; the chart stacks them as numbered lines, and Write out every repeat gives each pass its own words (a pass with none reuses the first). Words live in `song.lyrics[sectionKey].verses`, never in the chord text. Words pasted into step 1 (chord sheet style, ChordPro, or a words-only `[Verse 2]`) are spotted by the parser and a "Move the words to step 4" button moves them into the boxes and strips them from the text. Show words hides them for a chords-only print.
6. Copy section (step 3, or "Copy Verse as a new section" in step 4) makes a new section with the same chords and tapped rhythm and words of its own. If the section already comes around again, the copy takes over that next time (a bare `[Verse]` becomes `[Verse 2]` with chords, the last pass of a `[Chorus x2]` splits off) and the words already typed for that pass move with it; otherwise it goes right after. A copy's key goes in `song.own`, which tells the parser not to fold it back into the section it matches (normally a `[Verse 2]` with the same chords is the same section sung again).
7. Save PDF opens the print window; the print stylesheet strips everything but the chart.

## Files

- `js/model.js`: parsing the chord text and lyrics (`formLyrics`: the words for each pass of the form), meters, quantizing, chord voicings for playback. Time is in ticks, 12 per quarter note.
- `js/audio.js`: synthesized click, kick, snare, hat; the three grooves; the chord pad; the look-ahead scheduler.
- `js/notation.js`: spells each chord into note values (keeps beat 3 visible in 4/4, ties across barlines, beams within a beat) and draws SVG rows of bars.
- `js/app.js`: UI, recording, playback, editing, songs.

## Notes

- Swing is stored straight and notated as straight 8ths with "swing 8ths" in the header, the way charts are written. Playback swings the "and" to two thirds of the beat.
- Recording guards: typing never taps (Space and Backspace only act outside text boxes), focusing a text box or hiding the tab stops the recording, and a section with all chords in and no end tap ends itself one bar after its last chord once playback is two bars past it. The old behavior let a late end tap stretch the last chord by many bars.
- Tap timing subtracts the audio output latency, plus a per-browser nudge set by "Taps landing late? Fix timing" (tap along to 12 clicks).
- Songs live in localStorage (`chorddrop.v1`). Song file saves and opens `.chorddrop.json`; "Copy a link" puts the whole song in the URL hash, so a bandmate opens their own copy with nothing stored on a server.
- A published copy lives at `lens101-site/gallery/chord-drop/`. Any change here must be copied over and re-pushed.

v2 ideas, not built: repeat signs and first/second endings, transposing, a MIDI export.
