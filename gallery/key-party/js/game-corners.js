/* Key Party minigame 3: Chord Corners (chords).
   The banner shows a chord. Four corners show different spellings. Run to the
   correct corner before the bar empties. Wrong corners drop through the floor
   and the player respawns in the middle. Several fast prompts per round. */
const ChordCorners = (() => {
  'use strict';
  const F = Arena.FIELD;
  const PROMPTS = 5, REVEAL = 2.2, CW = 440, CH = 190;
  let players = [], level = 1, done = false, chord = null, corners = [], promptTime = 9, time = 0, phase = 'run', promptNo = 0, used = [], revealT = 0, firstArrival = null;

  function cornerRects() {
    return [
      { x: F.x + 16, y: F.y + 16 }, { x: F.x + F.w - CW - 16, y: F.y + 16 },
      { x: F.x + 16, y: F.y + F.h - CH - 16 }, { x: F.x + F.w - CW - 16, y: F.y + F.h - CH - 16 },
    ].map(r => ({ x: r.x, y: r.y, w: CW, h: CH }));
  }

  function pickChord() {
    let pool = Theory.chordsForLevel(level).filter(c => used.indexOf(c.name) < 0);
    if (!pool.length) { used = []; pool = Theory.chordsForLevel(level); }
    const c = pool[Math.floor(Math.random() * pool.length)];
    used.push(c.name);
    return c;
  }

  function newPrompt() {
    promptNo++;
    chord = pickChord();
    const options = Theory.shuffle([{ notes: chord.notes, correct: true }].concat(Theory.chordDistractors(chord, 3).map(n => ({ notes: n, correct: false }))));
    corners = cornerRects().map((r, i) => ({ rect: r, notes: options[i].notes, correct: options[i].correct }));
    time = promptTime; phase = 'run'; firstArrival = null;
    Arena.spreadPlayers(players, F.x + F.w / 2, F.y + F.h / 2, 80); // resets p.g, so set ours after
    players.forEach(p => { p.g = { arrived: 0 }; });
    Audio.play('round');
  }

  function inRect(p, r) { return p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h; }

  function start(ps, lvl) {
    players = ps; level = lvl; done = false; promptNo = 0; used = [];
    promptTime = lvl === 1 ? 10 : lvl === 2 ? 9 : 8;
    Arena.startPowerups(['freeze', 'speed'], (x, y) => corners.some(c => x > c.rect.x - 40 && x < c.rect.x + c.rect.w + 40 && y > c.rect.y - 40 && y < c.rect.y + c.rect.h + 40));
    newPrompt();
  }

  function resolve(now) {
    phase = 'reveal'; revealT = REVEAL;
    const correct = corners.find(c => c.correct);
    let best = null;
    players.forEach(p => {
      if (!p.active) return;
      const inCorrect = inRect(p, correct.rect);
      const wrong = corners.find(c => !c.correct && inRect(p, c.rect));
      if (inCorrect) {
        Arena.addScore(p, 15, p.x, p.y - 20, chord.notes.map(Theory.display).join(' '));
        if (!best || p.g.arrived < best.g.arrived) best = p;
        FX.burst(p.x, p.y, p.color, 18, 260, 7);
      } else if (wrong) {
        Arena.addScore(p, -5, p.x, p.y - 20, 'wrong corner');
        p.falling = 0.01; Audio.play('fall'); Input.rumble(p.source, 250, 0.7);
      } else FX.text(p.x, p.y - 50, 'no corner', FX.PAL.dim, 28);
    });
    if (best) { Arena.addScore(best, 5, best.x, best.y - 60, 'first'); Audio.play('good'); }
    else Audio.play('bad');
  }

  function update(dt, now) {
    if (done) return;
    if (phase === 'run') {
      Arena.updatePlayers(players, dt, now, {});
      const correct = corners.find(c => c.correct);
      players.forEach(p => { if (inRect(p, correct.rect)) { if (!p.g.arrived) p.g.arrived = now; } else p.g.arrived = 0; });
      const prev = time;
      time -= dt;
      if (Math.ceil(prev) !== Math.ceil(time) && time < 3 && time > 0) Audio.play('tick');
      if (time <= 0) { time = 0; resolve(now); }
    } else {
      players.forEach(p => { if (p.falling) { p.falling = Math.min(1, p.falling + dt * 1.4); } });
      revealT -= dt;
      if (revealT <= 0) {
        players.forEach(p => { p.falling = 0; });
        if (promptNo >= PROMPTS) done = true; else newPrompt();
      }
    }
  }

  function draw(ctx, now) {
    Arena.drawField(ctx);
    const title = chord.longName;
    const sub = 'Prompt ' + promptNo + ' of ' + PROMPTS + '.  Run to the corner with the correct spelling.';
    Arena.drawBanner(ctx, title, sub, phase === 'run' ? time / promptTime : 0, now, FX.PAL.clay);
    corners.forEach(c => {
      const r = c.rect;
      let fill = FX.PAL.white, stroke = FX.PAL.ink;
      if (phase === 'reveal') { if (c.correct) { fill = FX.PAL.sageT; stroke = FX.PAL.sage; } else { fill = '#efe6d8'; stroke = '#c9b9a0'; } }
      FX.roundRect(ctx, r.x, r.y, r.w, r.h, 22, fill, stroke, 6);
      if (phase === 'reveal' && !c.correct) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(r.x + 10, r.y + 10, r.w - 20, r.h - 20);
      }
      if (phase === 'reveal' && c.correct) FX.label(ctx, 'correct', r.x + r.w / 2, r.y + r.h - 24, 22, FX.PAL.sage);
    });
    Arena.drawPowerups(ctx, now);
    players.forEach(p => Arena.drawPlayer(ctx, p, now));
  }

  // Top layer: the four spellings on plates, above players and particles.
  function drawTop(ctx, now) {
    corners.forEach(c => {
      const r = c.rect;
      Arena.plateLabel(ctx, c.notes.map(Theory.display).join('  '), r.x + r.w / 2, r.y + r.h / 2, 54, phase === 'reveal' && !c.correct ? FX.PAL.dim : FX.PAL.ink, phase === 'reveal' && c.correct ? FX.PAL.sage : null);
    });
  }

  // Test aid: the centre of the correct corner.
  function debugTarget(p) {
    const c = corners.find(x => x.correct);
    return { x: c.rect.x + c.rect.w / 2, y: c.rect.y + c.rect.h / 2, info: chord.name + ':' + phase + ':' + promptNo };
  }

  return { id: 'corners', debugTarget, title: 'Chord Corners', blurb: 'Run to the corner that spells the chord correctly. Wrong corners drop through the floor.',
    hint: 'move to a corner   square punch   triangle use power-up', start, update, draw, drawTop, isDone: () => done };
})();
