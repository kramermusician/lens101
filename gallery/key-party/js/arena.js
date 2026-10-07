/* Key Party: shared top-down arena mechanics used by Bucket Brigade,
   Scale Stampede and Chord Corners. Players, movement, punch, power-ups,
   the prompt banner and the score HUD. Times are performance.now() ms,
   dt is seconds. Logical canvas is 1600 x 900. */
const Arena = (() => {
  'use strict';
  const W = 1600, H = 900;
  const FIELD = { x: 30, y: 165, w: 1540, h: 650 };
  const SPEED = 430, R = 30;
  const STUN_MS = 1000, FREEZE_MS = 2000, SPEED_MS = 5000, MAGNET_MS = 6000;
  const POWER = {
    freeze: { label: 'Freeze', icon: '*', color: FX.PAL.ocean, blurb: 'everyone else stops for 2 s' },
    speed: { label: 'Speed', icon: '>', color: FX.PAL.gold, blurb: 'run faster for 5 s' },
    magnet: { label: 'Magnet', icon: 'U', color: FX.PAL.clay, blurb: 'pulls letters to you' },
  };
  let powerups = [];
  let spawnAt = 0;
  let pool = [];
  let avoidFn = null;

  function makePlayer(slot, sourceId) {
    const t = FX.PLAYERS[slot];
    return {
      slot, source: sourceId, name: t.name, color: t.color, dark: t.dark, shape: t.shape,
      x: W / 2, y: H / 2, vx: 0, vy: 0, kx: 0, ky: 0, fx: 1, fy: 0,
      stunUntil: 0, frozenUntil: 0, speedUntil: 0, magnetUntil: 0, punchCd: 0, punchAnim: 0,
      powerup: null, carry: null, score: 0, roundScore: 0, active: true, ready: false,
      finished: false, place: 0, falling: 0, bob: Math.random() * 7, hit: 0,
      // per-game scratch
      g: {},
    };
  }

  function resetPlayer(p, x, y) {
    p.x = x; p.y = y; p.vx = p.vy = p.kx = p.ky = 0;
    p.stunUntil = p.frozenUntil = p.speedUntil = p.magnetUntil = 0;
    p.punchCd = 0; p.punchAnim = 0; p.carry = null; // a held power-up survives a respawn
    p.finished = false; p.place = 0; p.falling = 0; p.hit = 0; p.g = {};
  }

  function spreadPlayers(players, cx, cy, spread) {
    const n = players.length;
    players.forEach((p, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      resetPlayer(p, cx + Math.cos(a) * (n > 1 ? spread : 0), cy + Math.sin(a) * (n > 1 ? spread : 0));
    });
  }

  function addScore(p, pts, x, y, why) {
    p.roundScore += pts;
    p.score += pts;
    if (why !== false) FX.text(x !== undefined ? x : p.x, (y !== undefined ? y : p.y) - 50, (pts > 0 ? '+' : '') + pts + (why ? ' ' + why : ''), pts > 0 ? FX.PAL.sage : FX.PAL.clay, pts > 0 ? 36 : 32);
  }

  function canAct(p, now) {
    return p.active && now > p.stunUntil && now > p.frozenUntil && !p.falling;
  }

  // avoid(x, y) returns true when a spot is taken by a tile or pad; power-ups never spawn there.
  function startPowerups(kinds, avoid) {
    powerups = [];
    pool = kinds || ['freeze', 'speed', 'magnet'];
    avoidFn = avoid || null;
    spawnAt = performance.now() + 5000;
  }

  function spawnPowerup(now) {
    if (!pool.length) return;
    const kind = pool[Math.floor(Math.random() * pool.length)];
    let x = 0, y = 0;
    for (let tries = 0; tries < 30; tries++) {
      x = FIELD.x + 120 + Math.random() * (FIELD.w - 240); y = FIELD.y + 80 + Math.random() * (FIELD.h - 200);
      if (!avoidFn || !avoidFn(x, y)) break;
      if (tries === 29) { spawnAt = now + 1500; return; }
    }
    powerups.push({ kind, x, y, born: now });
    spawnAt = now + 7000 + Math.random() * 4000;
  }

  function usePowerup(p, players, now) {
    const kind = p.powerup;
    if (!kind) return;
    p.powerup = null;
    if (kind === 'freeze') {
      players.forEach(o => { if (o !== p && o.active) { o.frozenUntil = now + FREEZE_MS; FX.burst(o.x, o.y, FX.PAL.ice, 12, 160, 6); } });
      Audio.play('freeze');
      FX.text(p.x, p.y - 60, 'FREEZE', FX.PAL.ocean, 40);
    } else if (kind === 'speed') {
      p.speedUntil = now + SPEED_MS; Audio.play('speed'); FX.text(p.x, p.y - 60, 'SPEED', FX.PAL.gold, 40);
    } else if (kind === 'magnet') {
      p.magnetUntil = now + MAGNET_MS; Audio.play('magnet'); FX.text(p.x, p.y - 60, 'MAGNET', FX.PAL.clay, 40);
    }
  }

  function punch(p, players, now, onDrop) {
    if (p.punchCd > now) return;
    p.punchCd = now + 550;
    p.punchAnim = now + 180;
    Audio.play('punch');
    const fxp = p.x + p.fx * 46, fyp = p.y + p.fy * 46;
    players.forEach(o => {
      if (o === p || !o.active || o.falling) return;
      if (Math.hypot(o.x - fxp, o.y - fyp) < R * 2 + 20) {
        o.stunUntil = now + STUN_MS;
        o.kx = p.fx * 520; o.ky = p.fy * 520;
        o.hit = now + 300;
        FX.burst(o.x, o.y, p.color, 16, 300, 7);
        Audio.play('hit');
        Input.rumble(o.source, 200, 0.8);
        if (o.carry && onDrop) onDrop(o, o.carry);
      }
    });
  }

  // opts: { punch: bool, powerups: bool, onDrop(p, tile) }
  function updatePlayers(players, dt, now, opts) {
    opts = opts || {};
    if (opts.powerups !== false) {
      if (now > spawnAt && powerups.length < 3) spawnPowerup(now);
      powerups = powerups.filter(pu => now - pu.born < 20000);
    }
    players.forEach(p => {
      const inp = Input.get(p.source);
      const act = canAct(p, now) && inp;
      let ix = 0, iy = 0;
      if (act) { ix = inp.x; iy = inp.y; }
      const sp = SPEED * (now < p.speedUntil ? 1.6 : 1) * (now < p.frozenUntil ? 0 : 1);
      p.vx = ix * sp + p.kx; p.vy = iy * sp + p.ky;
      p.kx *= Math.pow(0.02, dt); p.ky *= Math.pow(0.02, dt);
      if (ix || iy) { const m = Math.hypot(ix, iy); p.fx = ix / m; p.fy = iy / m; }
      if (!p.falling) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.x = Math.max(FIELD.x + R, Math.min(FIELD.x + FIELD.w - R, p.x));
        p.y = Math.max(FIELD.y + R, Math.min(FIELD.y + FIELD.h - R, p.y));
      }
      if (act) {
        if (opts.punch !== false && inp.press.square) punch(p, players, now, opts.onDrop);
        if (opts.powerups !== false && inp.press.triangle) usePowerup(p, players, now);
      }
      if (opts.powerups !== false && p.active && !p.powerup && !p.falling) {
        for (let i = powerups.length - 1; i >= 0; i--) {
          const pu = powerups[i];
          if (Math.hypot(pu.x - p.x, pu.y - p.y) < R + 26) {
            p.powerup = pu.kind; powerups.splice(i, 1);
            Audio.play('powerup'); FX.burst(pu.x, pu.y, POWER[pu.kind].color, 14, 220, 6);
            FX.text(p.x, p.y - 60, POWER[pu.kind].label + '! press triangle', POWER[pu.kind].color, 30);
          }
        }
      }
    });
    // push players apart
    for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
      const a = players[i], b = players[j];
      if (a.falling || b.falling) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      if (d < R * 2) { const push = (R * 2 - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; }
    }
  }

  // ---------------------------------------------------------------- drawing
  function drawField(ctx) {
    ctx.fillStyle = FX.PAL.cream;
    ctx.fillRect(0, 0, W, H);
    FX.roundRect(ctx, FIELD.x, FIELD.y, FIELD.w, FIELD.h, 28, FX.PAL.sand, '#d8ccb2', 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    for (let x = FIELD.x + 100; x < FIELD.x + FIELD.w; x += 100) { ctx.beginPath(); ctx.moveTo(x, FIELD.y + 10); ctx.lineTo(x, FIELD.y + FIELD.h - 10); ctx.stroke(); }
    for (let y = FIELD.y + 100; y < FIELD.y + FIELD.h; y += 100) { ctx.beginPath(); ctx.moveTo(FIELD.x + 10, y); ctx.lineTo(FIELD.x + FIELD.w - 10, y); ctx.stroke(); }
  }

  // Big prompt at the top with a countdown bar. Gentle pulse only.
  function drawBanner(ctx, title, sub, frac, now, accent) {
    const pulse = 1 + 0.015 * Math.sin((now || 0) / 350);
    FX.roundRect(ctx, 30, 14, W - 60, 138, 24, FX.PAL.white, accent || FX.PAL.sage, 5);
    ctx.save();
    ctx.translate(W / 2, 66);
    ctx.scale(pulse, pulse);
    FX.label(ctx, title, 0, 0, 72, FX.PAL.ink);
    ctx.restore();
    if (sub) FX.label(ctx, sub, W / 2, 118, 28, FX.PAL.dim, 'center', false);
    if (frac !== null && frac !== undefined) FX.bar(ctx, 60, 138, W - 120, 10, frac);
  }

  function drawPowerups(ctx, now) {
    powerups.forEach(pu => {
      const bob = Math.sin(now / 250 + pu.x) * 4;
      const c = POWER[pu.kind];
      ctx.beginPath(); ctx.arc(pu.x, pu.y + bob, 26, 0, Math.PI * 2);
      ctx.fillStyle = FX.PAL.white; ctx.fill(); ctx.strokeStyle = c.color; ctx.lineWidth = 5; ctx.stroke();
      FX.label(ctx, c.icon, pu.x, pu.y + bob + 1, 30, c.color);
      FX.label(ctx, c.label, pu.x, pu.y + bob + 40, 20, c.color);
    });
  }

  function drawPlayer(ctx, p, now, extraLabel) {
    ctx.save();
    if (p.falling) { const f = Math.max(0.05, 1 - p.falling); ctx.globalAlpha = f; ctx.translate(p.x, p.y + (1 - f) * 120); ctx.scale(f, f); ctx.translate(-p.x, -p.y); }
    const hop = p.vx || p.vy ? Math.abs(Math.sin(now / 90 + p.bob)) * 5 : 0;
    const y = p.y - hop;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + R - 4, R * 0.9, R * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    const frozen = now < p.frozenUntil, stunned = now < p.stunUntil;
    const fill = !p.active ? '#bbb' : frozen ? FX.PAL.ice : p.color;
    if (now < p.speedUntil) { ctx.globalAlpha *= 0.35; FX.shape(ctx, p.shape, p.x - p.fx * 22, y - p.fy * 22, R, p.color); FX.shape(ctx, p.shape, p.x - p.fx * 42, y - p.fy * 42, R * 0.8, p.color); ctx.globalAlpha /= 0.35; }
    FX.shape(ctx, p.shape, p.x, y, R, fill, now < p.hit ? FX.PAL.clay : p.dark, 5);
    // face direction dot
    ctx.fillStyle = FX.PAL.white; ctx.beginPath(); ctx.arc(p.x + p.fx * 12, y + p.fy * 12 - 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.dark; ctx.beginPath(); ctx.arc(p.x + p.fx * 15, y + p.fy * 15 - 2, 3.5, 0, Math.PI * 2); ctx.fill();
    // fist
    if (now < p.punchAnim) { ctx.fillStyle = p.dark; ctx.beginPath(); ctx.arc(p.x + p.fx * 48, y + p.fy * 48, 13, 0, Math.PI * 2); ctx.fill(); }
    if (stunned) { for (let i = 0; i < 3; i++) { const a = now / 200 + i * 2.1; FX.label(ctx, '*', p.x + Math.cos(a) * 30, y - R - 10 + Math.sin(a) * 8, 26, FX.PAL.gold); } }
    if (frozen) FX.label(ctx, 'frozen', p.x, y + R + 16, 18, FX.PAL.ocean);
    if (!p.active) FX.label(ctx, 'reconnect pad', p.x, y + R + 16, 18, FX.PAL.clay);
    // name and carried tile
    FX.label(ctx, p.name, p.x, y - R - 20, 24, p.dark, 'center', true, FX.PAL.white);
    if (extraLabel) FX.label(ctx, extraLabel, p.x, y + R + 18, 20, p.dark, 'center', true, FX.PAL.white);
    if (p.powerup) { const c = POWER[p.powerup]; ctx.beginPath(); ctx.arc(p.x + R + 10, y - R, 13, 0, Math.PI * 2); ctx.fillStyle = FX.PAL.white; ctx.fill(); ctx.strokeStyle = c.color; ctx.lineWidth = 3; ctx.stroke(); FX.label(ctx, c.icon, p.x + R + 10, y - R + 1, 17, c.color); }
    ctx.restore();
  }

  function drawTile(ctx, labelStr, x, y, r, stroke, now, fill) {
    FX.roundRect(ctx, x - r, y - r, r * 2, r * 2, 10, fill || FX.PAL.white, stroke || FX.PAL.ink, 4);
    FX.label(ctx, Theory.display(labelStr), x, y + 1, r * 1.15, FX.PAL.ink);
  }

  // Carried tile, drawn in the top layer so the letter is never hidden.
  function drawCarried(ctx, p, now) {
    if (!p.carry || p.falling) return;
    const hop = p.vx || p.vy ? Math.abs(Math.sin(now / 90 + p.bob)) * 5 : 0;
    drawTile(ctx, p.carry.label, p.x, p.y - hop - R - 62, 30, p.color, now);
  }

  // A label with a backing plate, for the top layer.
  function plateLabel(ctx, str, x, y, size, color, stroke) {
    ctx.font = '700 ' + size + 'px ' + FX.FONT;
    const w = ctx.measureText(str).width + size * 0.6;
    FX.roundRect(ctx, x - w / 2, y - size * 0.62, w, size * 1.24, size * 0.3, 'rgba(255,253,248,0.94)', stroke || null, 3);
    FX.label(ctx, str, x, y + 1, size, color || FX.PAL.ink);
  }

  function drawHud(ctx, players, now, extra) {
    const n = players.length;
    const cw = Math.min(360, (W - 60) / n - 10);
    players.forEach((p, i) => {
      const x = 30 + i * (cw + 10), y = 828;
      FX.roundRect(ctx, x, y, cw, 58, 14, FX.PAL.white, p.active ? p.color : '#bbb', 4);
      FX.shape(ctx, p.shape, x + 32, y + 29, 16, p.color, p.dark, 3);
      FX.label(ctx, p.name, x + 76, y + 29, 26, p.dark, 'center');
      FX.label(ctx, String(p.score), x + cw - 20, y + 29, 34, FX.PAL.ink, 'right');
      const d = p.roundScore;
      if (d) FX.label(ctx, (d > 0 ? '+' : '') + d, x + cw - 110, y + 29, 22, d > 0 ? FX.PAL.sage : FX.PAL.clay, 'right', false);
      if (extra) { const s = extra(p); if (s) FX.label(ctx, s, x + 110, y + 29, 22, FX.PAL.dim, 'left', false); }
    });
  }

  return { W, H, FIELD, R, POWER, makePlayer, resetPlayer, spreadPlayers, addScore, canAct, startPowerups, updatePlayers,
    drawField, drawBanner, drawPowerups, drawPlayer, drawTile, drawCarried, plateLabel, drawHud, powerupsList: () => powerups };
})();
