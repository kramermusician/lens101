/* Key Party minigame 2: Scale Stampede (scales).
   Note pads are scattered around the arena. The banner names a scale
   (major or Mixolydian). Step on the notes in order, root to root, eight steps.
   A trail in your color shows your progress. First to finish the octave wins. */
const ScaleStampede = (() => {
  'use strict';
  const F = Arena.FIELD;
  const DURATION = 50, PAD_R = 46, PLACE_BONUS = [30, 20, 10, 5];
  let players = [], level = 1, time = 0, pads = [], scale = null, done = false, pause = 0, used = [], finishedCount = 0;

  function pickScale() {
    let pool = Theory.scalesForLevel(level).filter(s => used.indexOf(s.name) < 0);
    if (!pool.length) { used = []; pool = Theory.scalesForLevel(level); }
    const s = pool[Math.floor(Math.random() * pool.length)];
    used.push(s.name);
    return s;
  }

  function newScale() {
    scale = pickScale();
    const labels = scale.notes.concat(Theory.scaleDistractors(scale, 5));
    // 12 spots on a 4 x 3 grid, shuffled, with jitter
    const spots = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      spots.push({ x: F.x + F.w * (c + 0.5) / 4 + (Math.random() - 0.5) * 120, y: F.y + 70 + (F.h - 140) * (r + 0.5) / 3 + (Math.random() - 0.5) * 70 });
    }
    const sh = Theory.shuffle(spots);
    pads = labels.map((l, i) => ({ label: l, x: sh[i].x, y: sh[i].y, r: PAD_R, stepped: {} }));
    finishedCount = 0;
    Arena.spreadPlayers(players, F.x + F.w / 2, F.y + F.h / 2, 90); // resets p.g, so set ours after
    players.forEach(p => { p.g = { progress: 0, trail: [], onPad: null, finished: false }; });
  }

  function start(ps, lvl) {
    players = ps; level = lvl; time = DURATION; done = false; pause = 0; used = [];
    Arena.startPowerups(['freeze', 'speed'], (x, y) => pads.some(pad => Math.hypot(pad.x - x, pad.y - y) < PAD_R + 70));
    newScale();
  }

  function step(p, pad, now) {
    const expected = scale.notes[p.g.progress % 7];
    if (pad.label === expected) {
      p.g.progress++;
      p.g.trail.push(pad);
      pad.stepped[p.slot] = p.g.progress;
      Arena.addScore(p, 5, pad.x, pad.y - 40, Theory.display(pad.label));
      Audio.play('step');
      FX.burst(pad.x, pad.y, p.color, 10, 180, 5);
      if (p.g.progress === 8) {
        p.g.finished = true; p.finished = true;
        finishedCount++; p.place = finishedCount;
        Arena.addScore(p, PLACE_BONUS[finishedCount - 1] || 0, p.x, p.y - 30, finishedCount === 1 ? 'first!' : 'octave');
        Audio.play('finish'); FX.burst(p.x, p.y, p.color, 30, 360, 8); Input.rumble(p.source, 300, 0.6);
        if (finishedCount === players.filter(q => q.active).length) pause = 1.6;
      }
    } else {
      if (p.g.lastWrong === pad && now - p.g.lastWrongAt < 1200) return; // no double charge for the same pad
      p.g.lastWrong = pad; p.g.lastWrongAt = now;
      Arena.addScore(p, -3, pad.x, pad.y - 40, 'not next');
      Audio.play('bad'); Input.rumble(p.source, 120, 0.4);
      p.stunUntil = now + 350;
      const dx = p.x - pad.x, dy = p.y - pad.y, d = Math.hypot(dx, dy) || 1;
      p.kx = dx / d * 300; p.ky = dy / d * 300;
    }
  }

  function update(dt, now) {
    if (done) return;
    if (pause > 0) { pause -= dt; if (pause <= 0) { if (time > 8) newScale(); else done = true; } return; }
    time -= dt;
    if (time <= 0) { time = 0; done = true; return; }
    Arena.updatePlayers(players, dt, now, {});
    players.forEach(p => {
      if (p.g.finished || !p.active) return;
      let on = null;
      pads.forEach(pad => { if (Math.hypot(pad.x - p.x, pad.y - p.y) < pad.r - 4) on = pad; });
      if (on && on !== p.g.onPad && now > p.stunUntil) step(p, on, now);
      p.g.onPad = on;
    });
  }

  function draw(ctx, now) {
    Arena.drawField(ctx);
    const sub = scale.mode === 'mixolydian'
      ? 'Step on the notes in order, root to root. Mixolydian = major with a flat 7.'
      : 'Step on the notes in order, root to root. Eight steps for the octave.';
    Arena.drawBanner(ctx, scale.name, sub, time / DURATION, now, scale.mode === 'mixolydian' ? FX.PAL.ocean : FX.PAL.sage);
    // trails
    players.forEach(p => {
      if (p.g.trail.length < 1) return;
      const off = (p.slot - 1.5) * 7;
      ctx.strokeStyle = p.color; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      p.g.trail.forEach((pad, i) => { if (i === 0) ctx.moveTo(pad.x + off, pad.y + off); else ctx.lineTo(pad.x + off, pad.y + off); });
      if (!p.g.finished) ctx.lineTo(p.x + off, p.y + off);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    // pads
    pads.forEach(pad => {
      const steppers = Object.keys(pad.stepped);
      ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r, 0, Math.PI * 2);
      ctx.fillStyle = FX.PAL.white; ctx.fill(); ctx.strokeStyle = FX.PAL.ink; ctx.lineWidth = 4; ctx.stroke();
      steppers.forEach((slot, i) => {
        const p = FX.PLAYERS[slot];
        ctx.beginPath(); ctx.arc(pad.x, pad.y, pad.r + 7 + i * 7, 0, Math.PI * 2); ctx.strokeStyle = p.color; ctx.lineWidth = 5; ctx.stroke();
      });
    });
    Arena.drawPowerups(ctx, now);
    players.forEach(p => Arena.drawPlayer(ctx, p, now, p.g.finished ? 'done' : p.g.progress + '/8'));
  }

  // Top layer: note names on a plate above players, trails and particles.
  function drawTop(ctx, now) {
    pads.forEach(pad => Arena.plateLabel(ctx, Theory.display(pad.label), pad.x, pad.y, 40, FX.PAL.ink));
  }

  // Test aid: where P1 should go next (the pad of the expected note).
  function debugTarget(p) {
    if (!p.g || p.g.finished) return null;
    const pad = pads.find(x => x.label === scale.notes[p.g.progress % 7]);
    return pad ? { x: pad.x, y: pad.y, info: pad.label + ':' + p.g.progress } : null;
  }

  return { id: 'stampede', debugTarget, title: 'Scale Stampede', blurb: 'Step on the notes of the scale in order, root to root.',
    hint: 'move onto the pads   square punch   triangle use power-up', start, update, draw, drawTop, isDone: () => done };
})();
