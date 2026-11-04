# Score Sketch

A keyboard-first sheet music editor in the browser, in the spirit of Noteflight and Flat. Type letters to write notes, and get printable notation with two voices, repeats, endings, dynamics, key and time changes, and text boxes.

Done when: Kramer (or a LENS 101 student) opens the gallery link, types a melody with the A to G keys, adds a second voice, repeats and dynamics, edits the title and composer, and prints a clean PDF or exports MusicXML to keep working in MuseScore or Noteflight.

Live: https://kramermusician.github.io/lens101/gallery/score-sketch/ (gallery copy at `lens101-site/gallery/score-sketch/`; any change here gets copied there and pushed).

## Run

`./run.sh` serves the folder on port 8862 and opens it. Plain HTML, CSS and JS, no build step, nothing loaded from the network.

## Keys

| Key | Does |
|---|---|
| A to G | Add that note after the selection, in the octave nearest the previous note, spelled from the key signature |
| R | Rest |
| Shift + Up / Down | Octave up / down |
| Up / Down | Half step (up spells with sharps, down with flats) |
| # or =, -, N | Sharp, flat, natural (toggle) |
| [ and ] | Shorter / longer (also sets the length of the next notes) |
| 7 6 5 4 3 2 | Whole, half, quarter, eighth, 16th, 32nd for the next notes (MuseScore numbering). On a clicked note, changes that note |
| . | Dot the selected note |
| T | Tie to the next note (drawn only if the next note is the same pitch) |
| V | Switch voice 1 / voice 2 |
| Left / Right | Move the selection |
| Backspace | Delete |
| Space | Play from the selected bar / stop |
| Cmd+Z, Cmd+Shift+Z, Cmd+S | Undo, redo, save .json |

## How it works

- Model (`js/app.js`): each voice is one flat stream of events (`{s,o,a,d,dot,tie,dyn,hp}` or `{r:true,d,dot}`), with ticks at 480 per quarter. Bar settings live in `score.measures[index]` (`time`, `key`, `repeatStart`, `repeatEnd`, `ending`), and each one carries forward until changed.
- `build()` pours the streams into bars. A note that crosses a barline is split into tied pieces automatically, so nothing ever has to "fit". Unfilled space shows as faint rests on screen (solid in print).
- Typing fills rests in its way (so voice 2 padding and clicked rests get overwritten) and otherwise inserts, pushing later notes along.
- Switching to voice 2 pads it with rests up to the bar of the selected voice 1 note. Clicking an empty bar in voice 2 does the same.
- Layout: proportional spacing per onset, greedy line breaks at 716px, justified systems, beams per beat (dotted quarter in 6/8, 9/8, 12/8), stems up/down by voice when two voices share a bar.
- Rendering: one SVG per system using the Bravura SMuFL font (`fonts/`, SIL OFL, license beside it).
- Playback: Web Audio triangle + sine tone, dynamics set loudness, repeats and 1st/2nd endings followed (`playOrder`).
- Saving: autosaves to localStorage; Save/Open .json; Copy link packs the whole score into the URL hash (deflate + base64); MusicXML 4.0 export (notes, rests, ties, voices, key/time/clef, repeats, endings, dynamics, wedges, tempo, title, composer).
- Text boxes: drag by the bar on top, resize from the corner, A- / A+ for font size, B for bold. Positions are relative to the page's content area, so they print where they sit.
- Print: the toolbar, colors, caret and box borders drop out in print; letter size, half-inch margins.

## Not yet (v2 backlog)

Chords within one voice, lyrics, chord symbols, articulations (staccato, accent), slurs, tuplets, pickup bars, transposition, multiple staves/instruments, MusicXML import, clicking on the staff to place a pitch.
