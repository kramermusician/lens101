# Key Party

A local multiplayer party game for the LENS 101 classroom. Two to four players on PS4 gamepads, one projector, four fast minigames that drill key signatures, scales, chords and the 12 bar blues. Vanilla JS and HTML5 canvas, no build step, nothing loaded from the network.

## Launch

```
./run.sh
```

Serves the folder on port 8771 and opens Google Chrome (Chrome has the most reliable Gamepad API). Safe to run twice; it leaves a running server alone. `./run.sh --serve-only` starts the server without opening a browser.

Plug the pads in before or after the page opens. A pad is invisible to the browser until a button is pressed on it, so press X once on each.

The page runs a music theory self-check at boot. If any key signature, scale, chord or blues progression is wrong, an error screen replaces the game. `node js/theory.test.js` runs the same checks from the terminal, plus extra spot checks.

## How a match goes

1. Title: press X.
2. Join: press X on each pad to take a slot (P1 to P4). Press X again when ready, circle to leave. Options (or Enter) starts right away. Up and down pick a setting, left and right change it:
   - Difficulty 1: keys with up to 2 sharps or flats (C G D F Bb). 2: up to 4. 3: all 15 major keys.
   - Blues key (default G), blues tempo (72 to 120 bpm, default 96) and blues hard mode.
3. Four rounds in random order, one per minigame. A scoreboard follows each round.
4. Final podium, then each player enters three initials on their own pad, then the leaderboard. Scores persist in the browser (localStorage). "Export leaderboard JSON" downloads a file.

## Controls

PS4 pad (standard mapping):

| action | button |
|---|---|
| move | left stick or d-pad |
| grab or drop a letter, confirm, hop to a black key | X (cross) |
| punch | square |
| use a power-up | triangle |
| leave / cancel | circle |
| start now | options |

Keyboard fallback for two players: P1 uses WASD plus F (X), G (square), H (triangle), R (circle). P2 uses the arrows plus , (X), . (square), / (triangle), ' (circle). Enter is options.

A pad that disconnects mid-game greys its player out ("reconnect pad"); plugging the same pad back in revives it. Scores are kept.

## The minigames

Shared rules in the three arena games: a punch stuns for one second, knocks the target back and makes it drop what it carries. Power-ups spawn now and then: Freeze (everyone else stops for 2 s), Speed (5 s), Magnet (Bucket Brigade only, pulls letters toward you). Pick one up by touching it, use it with triangle. Rounds last 30 to 60 seconds. Note names always draw on top of players and effects.

**Bucket Brigade** (key signatures, 50 s). Letter tiles drift around the arena. The banner names a major key. Grab the right sharps or flats one at a time (X) and walk them into your bucket. A wrong letter bounces back and costs 5. 10 per correct letter, a bonus for finishing (20, 12, 6, 3 by place). C major is the trick round: bring nothing and stand still in your bucket for 3 seconds; any deposit costs 10. When everyone finishes, a new key starts if time remains.

**Scale Stampede** (scales, 50 s). Twelve note pads: the seven notes of the scale plus five wrong spellings. The banner names a major or Mixolydian scale. Walk onto the notes in order, root to root, eight steps. A wrong pad costs 3 and bounces you. 5 per step, a bonus for finishing the octave (30, 20, 10, 5).

**Chord Corners** (chords). Five prompts of 8 to 10 seconds. The banner names a chord (major, minor, maj7, 7, m7). Four corners show four spellings, one correct, three traps (wrong accidental, enharmonic respelling, wrong quality). Stand in the correct corner when the bar empties: 15, plus 5 for arriving first. A wrong corner costs 5 and drops you through the floor.

**12 Bar Blues Lava** (chord tones). Split screen, one piano per player. A 12 bar blues plays on the synth, quick change with a V7 turnaround: I7 IV7 I7 I7 | IV7 IV7 I7 I7 | V7 IV7 I7 V7, two choruses. Each pane shows the current chord, its spelling and the bar. Stand on a chord tone (root, 3rd, 5th, b7) of the chord that is playing; left and right move, X or up hops to a black key, down steps off. Any other key drains health, starting one full beat after each chord change. The keys never show which are safe; the only feedback is on your avatar (health bar, shake, a glow underneath). Burned players sit out two seconds and lose 10. 10 points per second on a chord tone, 25 for surviving a chorus. Hard mode: only the 3rd and the b7 (guide tones) are safe. No punch or power-ups in this mode.

## Spelling

`js/theory.js` derives every scale from its root, one letter per degree, the same way `scripts/diagram-maps/lens101_circle_of_fifths.py` does for the week 6 materials. F# major has E#, Gb major has Cb, D Mixolydian has C natural, Ab minor 7 is Ab Cb Eb Gb. Sharps arrive in the order F C G D A E B, flats B E A D G C F. Mixolydian is the major scale of the key one step counterclockwise on the circle, started from its 5th. Chords are stacked thirds from the root's major scale (minor lowers the 3rd, dominant lowers the 7th). Chords that would need a double accidental (Cb7, D#7) are never asked.

## Adding content

- A new chord type: add it to `CHORD_TYPES` and `CHORD_INTERVALS` in `js/theory.js`, add it in `allChords()`, add a golden check, run `node js/theory.test.js`.
- A new scale mode: add a builder beside `mixolydian()` and include it in `allScales()` with its step pattern in `selfCheck()`.
- A new minigame: copy `js/game-corners.js`, export `{ id, title, blurb, hint, start(players, level, settings), update(dt, now), draw(ctx, now), drawTop(ctx, now), isDone() }`, add the script tag to `index.html` and the object to `GAMES` in `js/main.js`. Put note names in `drawTop` so they stay above everything.
- Durations and point values are constants at the top of each game file.

## Testing

```
node js/theory.test.js        # theory module, 70 plus checks
./run.sh --serve-only         # then open http://localhost:8771/index.html?fast=1
```

`?fast=1` runs the three arena games at 4x so a whole match fits in a couple of minutes. `?debug=bucket|stampede|corners|blues|podium|initials|leaderboard` jumps straight to that screen with the two keyboard players. Neither is for class. `document.body.dataset` mirrors the match state (state, game, round, scores, and under debug a `target` for P1) so a scripted test can steer a player.
