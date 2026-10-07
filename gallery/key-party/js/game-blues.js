/* Key Party minigame 4: 12 Bar Blues Lava.
   A 12 bar blues loops on the synth (I7 IV7 I7 I7 | IV7 IV7 I7 I7 | V7 IV7 I7 V7).
   Split screen: each player has a piano and an avatar standing on it. On each
   chord you must stand on a chord tone (root, 3rd, 5th, b7). Hard mode: only
   the guide tones (3rd and b7) are safe. Wrong keys drain health, but the keys
   themselves never show which are safe: the only feedback is on the player
   (health, hurt shake, a slow glow under the avatar once the penalty starts).
   Damage starts one full beat after each chord change.
   No punch or power-ups here: the panes are small and the music is the clock. */
const BluesLava = (() => {
  'use strict';
  const W = Arena.W, H = Arena.H;
  const CHORUSES = 2, DRAIN = 45, REGEN = 12, RATE = 10, RESPAWN = 2.0;
  const WHITE = [{ l: 'C', pc: 0 }, { l: 'D', pc: 2 }, { l: 'E', pc: 4 }, { l: 'F', pc: 5 }, { l: 'G', pc: 7 }, { l: 'A', pc: 9 }, { l: 'B', pc: 11 }, { l: 'C', pc: 0 }, { l: 'D', pc: 2 }, { l: 'E', pc: 4 }];
  const BLACK = [{ after: 0, pc: 1 }, { after: 1, pc: 3 }, { after: 3, pc: 6 }, { after: 4, pc: 8 }, { after: 5, pc: 10 }, { after: 7, pc: 1 }, { after: 8, pc: 3 }];
  const ENH = { 1: 'C# Db', 3: 'D# Eb', 6: 'F# Gb', 8: 'G# Ab', 10: 'A# Bb' };
  let players = [], opts = {}, prog = [], done = false, panes = [], lastBar = -1, barChangedAt = 0, endAt = 0, startedAt = 0, finishing = 0, pos = null;

  function layout(n) {
    const top = 0, h = H - 70;
    if (n <= 1) return [{ x: 0, y: top, w: W, h }];
    if (n === 2) return [{ x: 0, y: top, w: W / 2, h }, { x: W / 2, y: top, w: W / 2, h }];
    const out = [{ x: 0, y: top, w: W / 2, h: h / 2 }, { x: W / 2, y: top, w: W / 2, h: h / 2 }, { x: 0, y: top + h / 2, w: W / 2, h: h / 2 }, { x: W / 2, y: top + h / 2, w: W / 2, h: h / 2 }];
    return out.slice(0, n);
  }

  function keyGeometry(pane) {
    const kbH = Math.min(pane.h * 0.46, 330);
    const kbY = pane.y + pane.h - kbH - 10;
    const ww = (pane.w - 24) / WHITE.length, x0 = pane.x + 12;
    const whites = WHITE.map((k, i) => ({ i, l: k.l, pc: k.pc, x: x0 + i * ww, w: ww, y: kbY, h: kbH, black: false }));
    const bw = ww * 0.62;
    const blacks = BLACK.map(b => ({ pc: b.pc, x: x0 + (b.after + 1) * ww - bw / 2, w: bw, y: kbY, h: kbH * 0.58, black: true }));
    return { whites, blacks, kbY, kbH, x0, ww };
  }

  function start(ps, level, options) {
    players = ps; opts = options || {}; done = false; finishing = 0;
    const key = opts.bluesKey || 'G';
    prog = Theory.bluesProgression(key);
    panes = layout(players.length);
    players.forEach((p, i) => {
      const pane = panes[i];
      const geo = keyGeometry(pane);
      p.g = { pane, geo, px: geo.x0 + geo.ww * 0.5, wantBlack: false, health: 100, out: 0, acc: 0, aliveChorus: true, burnTick: 0, key: null, safe: true, hopT: 0, hurt: 0 };
      p.finished = false; p.place = 0; p.roundScore = p.roundScore || 0;
    });
    Audio.init();
    Audio.blues.start(prog, opts.bpm || 96);
    lastBar = -1; barChangedAt = performance.now(); startedAt = performance.now();
    const barDur = 4 * 60 / (opts.bpm || 96);
    endAt = startedAt + CHORUSES * 12 * barDur * 1000 + 150;
  }

  function stop() { Audio.blues.stop(); }

  function standingKey(p) {
    const geo = p.g.geo;
    if (p.g.wantBlack) {
      const b = geo.blacks.find(k => p.g.px >= k.x && p.g.px <= k.x + k.w);
      if (b) return b;
    }
    const idx = Math.max(0, Math.min(WHITE.length - 1, Math.floor((p.g.px - geo.x0) / geo.ww)));
    return geo.whites[idx];
  }

  function safeSet(bar) {
    const ch = prog[bar];
    return opts.hard ? ch.guidePcs : ch.pcs;
  }

  function update(dt, now) {
    if (done) return;
    pos = Audio.blues.position();
    if (!pos) { // no audio context yet (no gesture): fall back to a wall clock
      const barDur = 4 * 60 / (opts.bpm || 96);
      const el = (now - startedAt) / 1000;
      pos = { bar: Math.floor(el / barDur) % 12, beat: Math.floor((el / barDur % 1) * 4), phase: (el / barDur) % 1, chorus: Math.floor(el / barDur / 12), elapsed: el, barDur };
    }
    if (pos.bar !== lastBar) {
      if (lastBar === 11 && pos.bar === 0) {
        players.forEach(p => { if (p.g.aliveChorus && p.active) { Arena.addScore(p, 25, p.g.pane.x + p.g.pane.w / 2, p.g.pane.y + 150, 'chorus!'); FX.confetti(p.g.pane.x + p.g.pane.w / 2, p.g.pane.y + 120, 20); } p.g.aliveChorus = true; });
        Audio.play('finish');
      }
      lastBar = pos.bar; barChangedAt = now;
    }
    if (now >= endAt) { finishing += dt; if (finishing > 0.1) { done = true; stop(); } return; }
    // exactly one beat of grace after every chord change, at the current tempo
    const grace = pos.beat === 0;
    const safe = safeSet(pos.bar);
    players.forEach(p => {
      const inp = Input.get(p.source);
      const g = p.g, geo = g.geo;
      if (g.out > 0) {
        g.out -= dt;
        if (g.out <= 0) { g.health = 100; g.out = 0; g.px = geo.x0 + geo.ww * 0.5; g.wantBlack = false; }
        return;
      }
      if (inp && p.active) {
        g.px += inp.x * geo.ww * 6.5 * dt;
        g.px = Math.max(geo.x0 + 10, Math.min(geo.x0 + geo.ww * WHITE.length - 10, g.px));
        if (inp.press.cross || inp.dir.up) { if (!g.wantBlack) { g.wantBlack = true; g.hopT = now; Audio.play('move'); } }
        if (inp.dir.down) g.wantBlack = false;
      }
      const key = standingKey(p);
      g.key = key;
      g.safe = safe.indexOf(key.pc) >= 0;
      g.hurt = Math.max(0, g.hurt - dt * 1.5);
      if (!p.active) return; // a disconnected pad is not punished
      if (g.safe) {
        g.acc += RATE * dt;
        if (g.acc >= 1) { const n = Math.floor(g.acc); g.acc -= n; Arena.addScore(p, n, 0, 0, false); }
        g.health = Math.min(100, g.health + REGEN * dt);
      } else if (!grace) {
        g.hurt = 1;
        g.health -= DRAIN * dt;
        g.burnTick -= dt;
        if (g.burnTick <= 0) { g.burnTick = 0.25; Audio.play('burn'); FX.burst(g.px, key.y + 20, FX.PAL.lava, 4, 120, 5); Input.rumble(p.source, 100, 0.3); }
        if (g.health <= 0) {
          g.health = 0; g.out = RESPAWN; g.aliveChorus = false;
          Arena.addScore(p, -10, g.px, key.y - 30, 'burned');
          Audio.play('out'); Input.rumble(p.source, 400, 0.9); FX.burst(g.px, key.y + 20, FX.PAL.lavaDeep, 24, 300, 8);
        }
      }
    });
  }

  function drawPane(ctx, p, now) {
    const g = p.g, pane = g.pane, geo = g.geo;
    const ch = prog[pos ? pos.bar : 0];
    const small = panes.length > 2;
    FX.roundRect(ctx, pane.x + 6, pane.y + 6, pane.w - 12, pane.h - 12, 20, FX.PAL.white, p.color, 6);
    // header: name, health, bar counter
    const hx = pane.x + 24, hy = pane.y + 34;
    FX.shape(ctx, p.shape, hx + 16, hy, 16, p.color, p.dark, 3);
    FX.label(ctx, p.name, hx + 60, hy, 26, p.dark, 'center');
    const hbX = hx + 100, hbW = Math.min(300, pane.w - 360);
    FX.roundRect(ctx, hbX, hy - 12, hbW, 24, 12, FX.PAL.sand, null);
    if (g.health > 0) FX.roundRect(ctx, hbX, hy - 12, Math.max(24, hbW * g.health / 100), 24, 12, g.health > 40 ? FX.PAL.sage : FX.PAL.clay, null);
    FX.label(ctx, 'health', hbX + hbW / 2, hy, 16, FX.PAL.ink);
    if (pos) FX.label(ctx, 'bar ' + (pos.bar + 1) + ' / 12   chorus ' + Math.min(CHORUSES, pos.chorus + 1) + ' / ' + CHORUSES, pane.x + pane.w - 24, hy, 22, FX.PAL.dim, 'right', false);
    // chord name, big, with its spelling
    const cy = pane.y + (small ? 92 : 130);
    const pulse = pos ? 1 + 0.04 * Math.max(0, 1 - pos.phase * 3) : 1;
    ctx.save(); ctx.translate(pane.x + pane.w / 2, cy); ctx.scale(pulse, pulse);
    FX.label(ctx, Theory.display(ch.name), 0, 0, small ? 72 : 110, FX.PAL.ink);
    ctx.restore();
    const spelled = ch.notes.map((n, i) => (opts.hard && (i === 1 || i === 3)) || !opts.hard ? Theory.display(n) : '(' + Theory.display(n) + ')').join('   ');
    FX.label(ctx, spelled, pane.x + pane.w / 2, cy + (small ? 50 : 72), small ? 30 : 40, FX.PAL.sage);
    FX.label(ctx, opts.hard ? 'HARD: only the 3rd and b7 are safe' : 'Stand on a chord tone: root, 3rd, 5th, b7', pane.x + pane.w / 2, cy + (small ? 80 : 112), small ? 18 : 22, opts.hard ? FX.PAL.clay : FX.PAL.dim, 'center', false);
    // keyboard: neutral on purpose. Nothing on the keys says which ones are safe.
    geo.whites.forEach(k => {
      ctx.fillStyle = FX.PAL.white;
      ctx.fillRect(k.x, k.y, k.w - 2, k.h);
      ctx.strokeStyle = '#b9ad98'; ctx.lineWidth = 2; ctx.strokeRect(k.x, k.y, k.w - 2, k.h);
    });
    geo.blacks.forEach(k => FX.roundRect(ctx, k.x, k.y, k.w, k.h, 6, '#3a2f2a', null));
    // avatar, the only place feedback appears, and only once the penalty is running
    const key = g.key || geo.whites[0];
    const standY = key.black ? key.y + key.h - 40 : key.y + key.h - 80;
    const hop = Math.max(0, 1 - (now - g.hopT) / 200) * 30;
    const shake = g.hurt > 0 ? Math.sin(now / 30) * 4 * g.hurt : 0;
    const ax = g.px + shake, ay = standY - hop;
    if (g.out > 0) {
      FX.label(ctx, 'burned!  back in ' + Math.ceil(g.out), pane.x + pane.w / 2, geo.kbY - 30, small ? 24 : 32, FX.PAL.lava);
    } else {
      const r = small ? 22 : 28;
      if (g.hurt > 0) { // slow glow under the avatar while health drains
        const glow = (0.35 + 0.2 * Math.sin(now / 500)) * g.hurt;
        ctx.globalAlpha = glow; ctx.fillStyle = FX.PAL.lava; ctx.beginPath(); ctx.ellipse(ax, ay + r - 2, r * 1.8, r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(ax, ay + r - 2, r, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      FX.shape(ctx, p.shape, ax, ay - r * 0.4, r, p.color, g.hurt > 0 ? FX.PAL.lava : p.dark, g.hurt > 0 ? 6 : 4);
      FX.label(ctx, p.name, ax, ay - r * 1.6 - 10, 20, p.dark, 'center', true, FX.PAL.white);
      if (g.hurt > 0) FX.label(ctx, 'ouch', ax, ay - r * 1.6 - 36, 22, FX.PAL.lava, 'center', true, FX.PAL.white);
    }
    FX.label(ctx, 'round ' + p.roundScore, pane.x + pane.w - 24, geo.kbY - 22, 22, FX.PAL.dim, 'right', false);
  }

  // Top layer: key names, always readable, never under an avatar or a particle.
  // White keys carry their letter; black keys carry both names. The current
  // chord's own spelling lives in the pane header, so nothing on the keys is a cue.
  function drawTop(ctx, now) {
    const small = panes.length > 2;
    players.forEach(p => {
      const geo = p.g.geo;
      geo.whites.forEach(k => Arena.plateLabel(ctx, k.l, k.x + k.w / 2, k.y + k.h - 28, small ? 24 : 32, FX.PAL.ink));
      geo.blacks.forEach(k => {
        const e = ENH[k.pc].split(' ');
        FX.label(ctx, Theory.display(e[0]), k.x + k.w / 2, k.y + k.h / 2 - 12, small ? 16 : 20, FX.PAL.white, 'center', true, '#3a2f2a');
        FX.label(ctx, Theory.display(e[1]), k.x + k.w / 2, k.y + k.h / 2 + 12, small ? 16 : 20, FX.PAL.white, 'center', true, '#3a2f2a');
      });
    });
  }

  function draw(ctx, now) {
    ctx.fillStyle = FX.PAL.cream; ctx.fillRect(0, 0, W, H);
    players.forEach(p => drawPane(ctx, p, now));
    // bottom strip: key, tempo, hint and the time bar
    FX.label(ctx, '12 bar blues in ' + Theory.display(opts.bluesKey || 'G') + '   ' + (opts.bpm || 96) + ' bpm   left / right to move, X or up to hop onto a black key, down to step off', W / 2, H - 46, 22, FX.PAL.dim, 'center', false);
    FX.bar(ctx, 60, H - 22, W - 120, 10, Math.max(0, (endAt - now) / (endAt - startedAt)));
  }

  // Test aid: x of the first safe white key and the first unsafe white key, plus health.
  function debugTarget(p) {
    if (!pos || !p.g) return null;
    const safe = safeSet(pos.bar);
    const ok = p.g.geo.whites.find(k => safe.indexOf(k.pc) >= 0);
    const bad = p.g.geo.whites.find(k => safe.indexOf(k.pc) < 0);
    return { x: ok.x + ok.w / 2, y: bad.x + bad.w / 2, info: Math.round(p.g.px) + ':' + prog[pos.bar].name + ':' + pos.bar + ':' + pos.beat + ':' + Math.round(p.g.health) + ':' + (p.g.safe ? 'safe' : 'lava') + ':' + (p.g.key ? p.g.key.pc : '') };
  }

  return { id: 'blues', debugTarget, title: '12 Bar Blues Lava', blurb: 'Stand on a chord tone of the chord that is playing. Everything else is lava.',
    hint: 'left / right move   X or up hop to a black key   down step off', start, update, draw, drawTop, stop, isDone: () => done, splitScreen: true };
})();
