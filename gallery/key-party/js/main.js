/* Key Party: match flow.
   title -> join (settings) -> countdown -> [intro -> play -> roundend] x 4
   -> podium -> initials -> leaderboard -> join.
   The theory self-check runs first; any failure shows the error screen. */
(() => {
  'use strict';
  const W = Arena.W, H = Arena.H;
  const GAMES = [BucketBrigade, ScaleStampede, ChordCorners, BluesLava];
  const DEFAULTS = { level: 1, bluesKey: 'G', bpm: 96, hard: false };
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const exportBtn = document.getElementById('export');
  let scale = 1, offX = 0, offY = 0;
  let state = 'title';
  let players = [];          // joined players, slot order
  let settings = Leaderboard.loadSettings(DEFAULTS);
  let settingRow = 0;
  let order = [], roundIdx = 0, game = null, stateT = 0, countdown = 0, podiumOrder = [];
  let initials = [], boardTop = [], lastFrame = performance.now();
  let errorScreen = false;
  // ?fast runs the arena minigames at 4x for headless play-tests; never on in class.
  const FAST = /[?&]fast/.test(location.search);

  const SETTING_ROWS = [
    { key: 'level', label: 'Difficulty', values: [1, 2, 3], show: v => ['1: keys up to 2 sharps or flats', '2: keys up to 4', '3: all 15 keys'][v - 1] },
    { key: 'bluesKey', label: 'Blues key', values: Theory.bluesKeys(), show: v => Theory.display(v) + ' (' + Theory.bluesProgression(v).slice(0, 1).concat(Theory.bluesProgression(v).slice(1, 2), Theory.bluesProgression(v).slice(8, 9)).map(b => Theory.display(b.name)).join(' ') + ')' },
    { key: 'bpm', label: 'Blues tempo', values: [72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 112, 120], show: v => v + ' bpm' },
    { key: 'hard', label: 'Blues hard mode', values: [false, true], show: v => v ? 'ON: only the 3rd and b7 are safe' : 'off: any chord tone is safe' },
  ];

  // ---------------------------------------------------------------- boot
  const errs = Theory.selfCheck();
  if (errs.length) {
    errorScreen = true;
    document.body.dataset.state = 'error';
    const el = document.getElementById('error');
    el.style.display = 'block';
    el.querySelector('ul').innerHTML = errs.map(e => '<li>' + e.replace(/</g, '&lt;') + '</li>').join('');
    canvas.style.display = 'none';
    console.error('Key Party theory self-check failed', errs);
  } else {
    console.log('Key Party theory self-check passed: ' + Theory.MAJOR_KEYS.length + ' keys, ' + Theory.allScales().length + ' scales, ' + Theory.allChords().length + ' chords, ' + Theory.bluesKeys().length + ' blues keys');
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const cw = window.innerWidth, ch = window.innerHeight;
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    scale = Math.min(cw / W, ch / H);
    offX = (cw - W * scale) / 2; offY = (ch - H * scale) / 2;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, offX * dpr, offY * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  Input.onChange((kind, id) => {
    const p = players.find(q => q.source === id);
    if (p) { p.active = kind === 'connected'; if (p.active) Audio.play('join'); }
  });
  window.addEventListener('keydown', () => Audio.init(), { once: false });
  window.addEventListener('pointerdown', () => Audio.init());
  exportBtn.addEventListener('click', () => Leaderboard.exportJSON());

  // ---------------------------------------------------------------- helpers
  function setState(s) { state = s; stateT = 0; exportBtn.style.display = s === 'leaderboard' ? 'block' : 'none'; mirror(); }
  // Mirror the state into the DOM so a headless test (or a teacher with devtools) can read it.
  function mirror() {
    const d = document.body.dataset;
    d.state = state; d.game = game ? game.id : ''; d.round = String(roundIdx); d.players = String(players.length);
    d.scores = players.map(p => p.name + ':' + p.score).join(' ');
    if (/[?&]debug=/.test(location.search)) {
      d.input = Input.debug();
      const p = players[0];
      if (p && state === 'play' && game.debugTarget) { const t = game.debugTarget(p); d.target = t ? Math.round(t.x) + ',' + Math.round(t.y) + ',' + (t.info || '') : ''; d.p1 = Math.round(p.x) + ',' + Math.round(p.y) + ',' + (p.carry ? p.carry.label : '') + ',' + p.roundScore; }
    }
    d.initials = state === 'initials' ? initials.map(e => e.letters.join('') + '/' + e.cursor + (e.done ? 'd' : '')).join(' ') : '';
  }
  function activeSources() { return Input.all(); }
  function sourceOf(id) { return players.find(p => p.source === id); }
  function anyPress(btn) { return activeSources().some(s => s.press[btn]); }
  function playerPress(btn) { return players.some(p => { const s = Input.get(p.source); return s && s.press[btn]; }); }
  function sorted() { return players.slice().sort((a, b) => b.score - a.score || a.slot - b.slot); }

  function startMatch() {
    players.forEach(p => { p.score = 0; p.roundScore = 0; p.ready = false; });
    order = Theory.shuffle(GAMES);
    roundIdx = 0;
    Leaderboard.saveSettings(settings);
    setState('intro');
    Audio.play('round');
  }

  function startRound() {
    game = order[roundIdx];
    players.forEach(p => { p.roundScore = 0; p.powerup = null; p.carry = null; });
    FX.clear();
    game.start(players, settings.level, settings);
    setState('play');
  }

  function endRound() {
    if (game.stop) game.stop();
    setState('roundend');
    Audio.play('round');
  }

  function finishMatch() {
    podiumOrder = sorted();
    setState('podium');
    Audio.play('win');
  }

  function beginInitials() {
    initials = players.map(p => ({ p, letters: [0, 0, 0], cursor: 0, done: false }));
    setState('initials');
  }

  function saveInitials() {
    initials.forEach(e => {
      const str = e.letters.map(i => String.fromCharCode(65 + i)).join('');
      Leaderboard.add({ initials: str, score: e.p.score, level: settings.level, players: players.length });
    });
    boardTop = Leaderboard.top();
    setState('leaderboard');
  }

  // ---------------------------------------------------------------- update
  function update(dt, now) {
    Input.poll();
    stateT += dt;
    FX.update(dt);
    const srcs = activeSources();

    if (state === 'title') {
      if (anyPress('cross') || anyPress('options')) { Audio.init(); Audio.play('select'); setState('join'); }
      if (anyPress('triangle')) { Audio.init(); boardTop = Leaderboard.top(); setState('leaderboard'); }
      return;
    }

    if (state === 'join') {
      srcs.forEach(s => {
        const p = sourceOf(s.id);
        if (s.press.cross) {
          Audio.init();
          if (!p) {
            if (players.length < 4) {
              const slot = [0, 1, 2, 3].find(i => !players.some(q => q.slot === i));
              players.push(Arena.makePlayer(slot, s.id));
              players.sort((a, b) => a.slot - b.slot);
              Audio.play('join'); Input.rumble(s.id, 200, 0.5);
            }
          } else { p.ready = !p.ready; Audio.play('select'); }
        }
        if (s.press.circle && p) { players.splice(players.indexOf(p), 1); Audio.play('drop'); }
        if (p) {
          if (s.dir.up) { settingRow = (settingRow + SETTING_ROWS.length - 1) % SETTING_ROWS.length; Audio.play('move'); }
          if (s.dir.down) { settingRow = (settingRow + 1) % SETTING_ROWS.length; Audio.play('move'); }
          if (s.dirOnce.left || s.dirOnce.right) {
            const row = SETTING_ROWS[settingRow];
            const i = row.values.indexOf(settings[row.key]);
            const j = (i + (s.dirOnce.right ? 1 : -1) + row.values.length) % row.values.length;
            settings[row.key] = row.values[j]; Audio.play('move');
          }
        }
      });
      if (players.length && anyPress('options')) { players.forEach(p => { p.ready = true; }); }
      if (players.length && players.every(p => p.ready)) { countdown = 3; setState('countdown'); Audio.play('select'); }
      return;
    }

    if (state === 'countdown') {
      if (players.some(p => { const s = Input.get(p.source); return s && s.press.circle; })) { players.forEach(p => { p.ready = false; }); setState('join'); return; }
      const prev = countdown;
      countdown -= dt;
      if (Math.ceil(prev) !== Math.ceil(countdown)) Audio.play('tick');
      if (countdown <= 0) startMatch();
      return;
    }

    if (state === 'intro') {
      if (stateT > 3.2 || (stateT > 0.6 && playerPress('cross'))) startRound();
      return;
    }

    if (state === 'play') {
      const steps = FAST && !game.splitScreen ? 4 : 1;
      for (let i = 0; i < steps && !game.isDone(); i++) game.update(dt, now);
      if (game.isDone()) endRound();
      return;
    }

    if (state === 'roundend') {
      if (stateT > 12 || (stateT > 1 && playerPress('cross'))) {
        roundIdx++;
        if (roundIdx >= order.length) finishMatch(); else { setState('intro'); Audio.play('round'); }
      }
      return;
    }

    if (state === 'podium') {
      if (Math.random() < 0.15 && stateT < 5) FX.confetti(300 + Math.random() * 1000, 200, 6);
      if (stateT > 6 || (stateT > 1.5 && playerPress('cross'))) beginInitials();
      return;
    }

    if (state === 'initials') {
      initials.forEach(e => {
        if (e.done) return;
        const s = Input.get(e.p.source);
        if (!s || !s.connected) return;
        if (s.dir.up) { e.letters[e.cursor] = (e.letters[e.cursor] + 25) % 26; Audio.play('move'); }
        if (s.dir.down) { e.letters[e.cursor] = (e.letters[e.cursor] + 1) % 26; Audio.play('move'); }
        if (s.dirOnce.right && e.cursor < 2) { e.cursor++; Audio.play('select'); }
        if ((s.dirOnce.left || s.press.square) && e.cursor > 0) { e.cursor--; Audio.play('select'); }
        if (s.press.cross) { if (e.cursor < 2) e.cursor++; else { e.done = true; Audio.play('good'); } }
      });
      if (initials.every(e => e.done) || stateT > 45) saveInitials();
      return;
    }

    if (state === 'leaderboard') {
      if (stateT > 0.8 && anyPress('cross')) { players.forEach(p => { p.ready = false; p.score = 0; }); setState('join'); Audio.play('select'); }
      if (stateT > 0.8 && anyPress('triangle')) Leaderboard.exportJSON();
      return;
    }
  }

  // ---------------------------------------------------------------- draw
  function bg() { ctx.fillStyle = FX.PAL.cream; ctx.fillRect(-offX / scale, -offY / scale, W + 2 * offX / scale, H + 2 * offY / scale); }

  function drawTitle(now) {
    bg();
    const pulse = 1 + 0.02 * Math.sin(now / 400);
    ctx.save(); ctx.translate(W / 2, 300); ctx.scale(pulse, pulse);
    FX.label(ctx, 'KEY PARTY', 0, 0, 160, FX.PAL.ink);
    ctx.restore();
    FX.label(ctx, 'key signatures, scales, chords and a 12 bar blues, on gamepads', W / 2, 410, 34, FX.PAL.dim, 'center', false);
    [0, 1, 2, 3].forEach(i => FX.shape(ctx, FX.PLAYERS[i].shape, W / 2 - 180 + i * 120, 500, 34, FX.PLAYERS[i].color, FX.PLAYERS[i].dark, 5));
    FX.label(ctx, 'press X to start', W / 2, 620, 44, FX.PAL.sage);
    FX.label(ctx, 'triangle: leaderboard', W / 2, 680, 26, FX.PAL.dim, 'center', false);
    FX.label(ctx, 'PS4 pads: left stick or d-pad moves, X grabs, square punches, triangle uses a power-up', W / 2, 790, 24, FX.PAL.dim, 'center', false);
    FX.label(ctx, 'keyboard: WASD + F G H   or   arrows + , . /', W / 2, 830, 24, FX.PAL.dim, 'center', false);
  }

  function drawJoin(now) {
    bg();
    FX.label(ctx, 'Who is playing?', W / 2, 70, 64, FX.PAL.ink);
    FX.label(ctx, 'press X to join, X again when ready, circle to leave.  Options or Enter starts right away.', W / 2, 128, 26, FX.PAL.dim, 'center', false);
    [0, 1, 2, 3].forEach(i => {
      const x = 80 + i * 370, y = 180, t = FX.PLAYERS[i];
      const p = players.find(q => q.slot === i);
      FX.roundRect(ctx, x, y, 340, 250, 24, p ? FX.PAL.white : FX.PAL.sand, p ? t.color : '#d8ccb2', 6);
      FX.shape(ctx, t.shape, x + 170, y + 90, 44, p ? t.color : '#cfc4b0', p ? t.dark : '#b9ad98', 5);
      FX.label(ctx, t.name, x + 170, y + 165, 36, p ? t.dark : '#b9ad98');
      if (p) {
        const s = Input.get(p.source);
        FX.label(ctx, s ? s.label : p.source, x + 170, y + 200, 22, FX.PAL.dim, 'center', false);
        FX.label(ctx, p.ready ? 'READY' : 'press X when ready', x + 170, y + 230, 24, p.ready ? FX.PAL.sage : FX.PAL.clay);
      } else FX.label(ctx, 'press X to join', x + 170, y + 215, 22, '#b9ad98', 'center', false);
    });
    // settings
    FX.label(ctx, 'Settings (up / down to pick, left / right to change)', W / 2, 480, 26, FX.PAL.dim, 'center', false);
    SETTING_ROWS.forEach((row, i) => {
      const y = 530 + i * 64;
      const sel = i === settingRow;
      FX.roundRect(ctx, 200, y - 26, 1200, 54, 14, sel ? FX.PAL.sageT : FX.PAL.white, sel ? FX.PAL.sage : '#d8ccb2', 4);
      FX.label(ctx, row.label, 240, y, 30, FX.PAL.ink, 'left');
      FX.label(ctx, (sel ? '<  ' : '') + row.show(settings[row.key]) + (sel ? '  >' : ''), 1360, y, 30, sel ? FX.PAL.sage : FX.PAL.dim, 'right');
    });
    FX.label(ctx, '4 rounds, one per minigame, random order: Bucket Brigade, Scale Stampede, Chord Corners, 12 Bar Blues Lava', W / 2, 820, 24, FX.PAL.dim, 'center', false);
    const pads = Input.all().filter(s => s.kind === 'pad').length;
    FX.label(ctx, pads + ' gamepad' + (pads === 1 ? '' : 's') + ' connected' + (pads ? '' : '. Press a button on a pad to wake it.'), W / 2, 860, 22, pads ? FX.PAL.sage : FX.PAL.clay, 'center', false);
  }

  function drawCountdown(now) {
    drawJoin(now);
    ctx.fillStyle = 'rgba(246,239,226,0.85)'; ctx.fillRect(0, 0, W, H);
    FX.label(ctx, String(Math.ceil(countdown)), W / 2, H / 2 - 20, 260, FX.PAL.sage);
    FX.label(ctx, 'get ready   (circle cancels)', W / 2, H / 2 + 160, 32, FX.PAL.dim, 'center', false);
  }

  function drawIntro(now) {
    bg();
    const g = order[roundIdx];
    FX.label(ctx, 'Round ' + (roundIdx + 1) + ' of ' + order.length, W / 2, 200, 40, FX.PAL.dim, 'center', false);
    FX.label(ctx, g.title, W / 2, 320, 110, FX.PAL.ink);
    FX.label(ctx, g.blurb, W / 2, 440, 34, FX.PAL.sage, 'center', false);
    FX.label(ctx, g.hint, W / 2, 520, 28, FX.PAL.dim, 'center', false);
    if (g.id !== 'blues') FX.label(ctx, 'punch stuns for 1 s and knocks letters loose.  Power-ups: Freeze, Speed' + (g.id === 'bucket' ? ', Magnet' : ''), W / 2, 580, 24, FX.PAL.dim, 'center', false);
    else FX.label(ctx, 'blues in ' + Theory.display(settings.bluesKey) + ' at ' + settings.bpm + ' bpm' + (settings.hard ? ', HARD mode (guide tones only)' : ''), W / 2, 580, 24, FX.PAL.dim, 'center', false);
    FX.bar(ctx, W / 2 - 200, 700, 400, 12, 1 - stateT / 3.2, FX.PAL.sage);
  }

  function drawScoreTable(y0, title, showRound) {
    FX.label(ctx, title, W / 2, y0, 64, FX.PAL.ink);
    const list = sorted();
    list.forEach((p, i) => {
      const y = y0 + 90 + i * 84;
      FX.roundRect(ctx, 300, y - 32, 1000, 68, 18, FX.PAL.white, p.color, 5);
      FX.label(ctx, String(i + 1), 340, y + 2, 36, FX.PAL.dim, 'center');
      FX.shape(ctx, p.shape, 410, y + 2, 22, p.color, p.dark, 4);
      FX.label(ctx, p.name, 500, y + 2, 36, p.dark, 'center');
      if (showRound) FX.label(ctx, (p.roundScore >= 0 ? '+' : '') + p.roundScore + ' this round', 800, y + 2, 28, p.roundScore >= 0 ? FX.PAL.sage : FX.PAL.clay, 'center', false);
      FX.label(ctx, String(p.score), 1250, y + 2, 44, FX.PAL.ink, 'right');
    });
  }

  function drawRoundEnd() {
    bg();
    drawScoreTable(90, game.title + ': scores', true);
    const next = order[roundIdx + 1];
    FX.label(ctx, next ? 'next: ' + next.title : 'that was the last round', W / 2, 760, 32, FX.PAL.sage, 'center', false);
    FX.label(ctx, 'press X to continue', W / 2, 820, 28, FX.PAL.dim, 'center', false);
  }

  function drawPodium(now) {
    bg();
    FX.label(ctx, 'Final podium', W / 2, 90, 72, FX.PAL.ink);
    const stands = [{ x: W / 2, h: 260, place: 1 }, { x: W / 2 - 300, h: 190, place: 2 }, { x: W / 2 + 300, h: 130, place: 3 }];
    stands.forEach(s => {
      const p = podiumOrder[s.place - 1];
      if (!p) return;
      const top = 760 - s.h;
      FX.roundRect(ctx, s.x - 120, top, 240, s.h, 16, s.place === 1 ? FX.PAL.gold : FX.PAL.sand, FX.PAL.ink, 4);
      FX.label(ctx, String(s.place), s.x, top + s.h / 2, 80, FX.PAL.white);
      const bounce = s.place === 1 ? Math.abs(Math.sin(now / 300)) * 14 : 0;
      FX.shape(ctx, p.shape, s.x, top - 60 - bounce, 44, p.color, p.dark, 6);
      FX.label(ctx, p.name + '   ' + p.score, s.x, top - 130 - bounce, 40, p.dark);
    });
    if (podiumOrder[3]) { const p = podiumOrder[3]; FX.shape(ctx, p.shape, W / 2 + 620, 720, 34, p.color, p.dark, 5); FX.label(ctx, p.name + '   ' + p.score, W / 2 + 620, 650, 32, p.dark); }
    FX.label(ctx, 'press X for the leaderboard', W / 2, 840, 28, FX.PAL.dim, 'center', false);
  }

  function drawInitials(now) {
    bg();
    FX.label(ctx, 'Enter your initials', W / 2, 80, 64, FX.PAL.ink);
    FX.label(ctx, 'up / down changes the letter, X confirms each letter, square goes back', W / 2, 140, 26, FX.PAL.dim, 'center', false);
    initials.forEach((e, i) => {
      const y = 230 + i * 150;
      FX.roundRect(ctx, 250, y - 55, 1100, 120, 22, FX.PAL.white, e.p.color, 5);
      FX.shape(ctx, e.p.shape, 330, y + 5, 30, e.p.color, e.p.dark, 4);
      FX.label(ctx, e.p.name, 420, y + 5, 36, e.p.dark);
      FX.label(ctx, String(e.p.score), 1290, y + 5, 44, FX.PAL.ink, 'right');
      e.letters.forEach((L, k) => {
        const x = 650 + k * 110;
        const cur = !e.done && k === e.cursor;
        FX.roundRect(ctx, x - 40, y - 40, 80, 90, 12, cur ? FX.PAL.sageT : FX.PAL.sand, cur ? FX.PAL.sage : null, 4);
        FX.label(ctx, String.fromCharCode(65 + L), x, y + 6, 60, FX.PAL.ink);
        if (cur) { FX.label(ctx, '^', x, y - 56, 24, FX.PAL.sage); FX.label(ctx, 'v', x, y + 66, 24, FX.PAL.sage); }
      });
      if (e.done) FX.label(ctx, 'saved', 1050, y + 5, 28, FX.PAL.sage);
      else if (!e.p.active) FX.label(ctx, 'pad disconnected', 1050, y + 5, 24, FX.PAL.clay, 'center', false);
    });
    FX.bar(ctx, W / 2 - 200, 860, 400, 10, 1 - stateT / 45);
  }

  function drawLeaderboard() {
    bg();
    FX.label(ctx, 'Leaderboard', W / 2, 70, 64, FX.PAL.ink);
    if (!boardTop.length) FX.label(ctx, 'no scores yet', W / 2, 300, 36, FX.PAL.dim, 'center', false);
    boardTop.forEach((e, i) => {
      const y = 150 + i * 62;
      FX.roundRect(ctx, 300, y - 24, 1000, 52, 14, i % 2 ? FX.PAL.white : FX.PAL.sand, null);
      FX.label(ctx, String(i + 1), 340, y + 2, 28, FX.PAL.dim);
      FX.label(ctx, e.initials, 480, y + 2, 36, FX.PAL.ink);
      FX.label(ctx, 'level ' + e.level + (e.players ? ', ' + e.players + ' players' : ''), 760, y + 2, 22, FX.PAL.dim, 'center', false);
      FX.label(ctx, e.date, 1020, y + 2, 22, FX.PAL.dim, 'center', false);
      FX.label(ctx, String(e.score), 1270, y + 2, 36, FX.PAL.ink, 'right');
    });
    FX.label(ctx, 'X: play again      triangle or the button: export JSON', W / 2, 830, 28, FX.PAL.dim, 'center', false);
  }

  function draw(now) {
    if (state === 'title') drawTitle(now);
    else if (state === 'join') drawJoin(now);
    else if (state === 'countdown') drawCountdown(now);
    else if (state === 'intro') drawIntro(now);
    else if (state === 'play') { game.draw(ctx, now); if (!game.splitScreen) Arena.drawHud(ctx, players, now); }
    else if (state === 'roundend') drawRoundEnd();
    else if (state === 'podium') drawPodium(now);
    else if (state === 'initials') drawInitials(now);
    else if (state === 'leaderboard') drawLeaderboard();
    FX.draw(ctx);
    // note names and letters always sit above players, power-ups and particles
    if (state === 'play' && game.drawTop) game.drawTop(ctx, now);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    try { update(dt, now); draw(now); mirror(); } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }
  if (!errorScreen) {
    setState('title');
    // ?debug=initials|podium|leaderboard jumps straight to that screen with the two keyboard players (test aid only)
    const dbg = (location.search.match(/[?&]debug=(\w+)/) || [])[1];
    if (dbg) {
      players = [Arena.makePlayer(0, 'k0'), Arena.makePlayer(1, 'k1')];
      players[0].score = 120; players[1].score = 80;
      podiumOrder = sorted();
      if (dbg === 'initials') beginInitials();
      else if (dbg === 'podium') setState('podium');
      else if (dbg === 'leaderboard') { boardTop = Leaderboard.top(); setState('leaderboard'); }
      else if (GAMES.some(g => g.id === dbg)) { players.forEach(p => { p.score = 0; }); order = [GAMES.find(g => g.id === dbg)]; roundIdx = 0; startRound(); }
    }
    requestAnimationFrame(frame);
  }

  // Test hook for headless drives: window.KeyParty.state() and a settings peek.
  window.KeyParty = { state: () => state, players: () => players, settings: () => settings, game: () => game && game.id, forceState: setState, forceStart: () => { if (players.length) startMatch(); } };
})();
