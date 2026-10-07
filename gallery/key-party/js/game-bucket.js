/* Key Party minigame 1: Bucket Brigade (key signatures).
   Letter tiles float in the arena. The banner names a major key. Grab the right
   sharps or flats one at a time and carry them to your bucket. Wrong letters
   bounce back and cost points. C major is the trick: bring nothing and stand
   still in your bucket for 3 seconds. */
const BucketBrigade = (() => {
  'use strict';
  const F = Arena.FIELD;
  const DURATION = 50, TILE_R = 34, PLACE_BONUS = [20, 12, 6, 3];
  let players = [], level = 1, time = 0, tiles = [], key = null, needed = [], done = false;
  let pause = 0, usedKeys = [], buckets = [], cMajor = false, finishedCount = 0, banner = '';

  function pickKey() {
    let pool = Theory.keysForLevel(level).filter(k => usedKeys.indexOf(k) < 0);
    if (!pool.length) { usedKeys = []; pool = Theory.keysForLevel(level); }
    const k = pool[Math.floor(Math.random() * pool.length)];
    usedKeys.push(k);
    return k;
  }

  function newKey() {
    key = pickKey();
    needed = Theory.signature(key);
    cMajor = needed.length === 0;
    banner = key + ' major';
    tiles = [];
    const all = Theory.SHARP_ORDER.concat(Theory.FLAT_ORDER);
    const labels = [];
    needed.forEach(a => { for (let i = 0; i < players.length; i++) labels.push(a); });
    all.forEach(a => { if (needed.indexOf(a) < 0) labels.push(a); });
    // the enharmonic twin of each needed letter is the classic trap, add one more of each
    needed.forEach(a => { const e = Theory.enharmonic(a); if (e && e.length > 1 && needed.indexOf(e) < 0) labels.push(e); });
    labels.forEach(l => {
      const a = Math.random() * Math.PI * 2;
      tiles.push({ label: l, x: F.x + 80 + Math.random() * (F.w - 160), y: F.y + 70 + Math.random() * (F.h - 260),
        vx: Math.cos(a) * 45, vy: Math.sin(a) * 45, carriedBy: null, r: TILE_R, kick: 0 });
    });
    finishedCount = 0;
    players.forEach((p, i) => {
      p.g = { collected: [], finished: false, still: 0, lastX: p.x, lastY: p.y };
      p.carry = null; p.finished = false; p.place = 0;
      p.x = buckets[i].x; p.y = buckets[i].y - 110;
    });
  }

  function start(ps, lvl) {
    players = ps; level = lvl; time = DURATION; done = false; pause = 0; usedKeys = [];
    const n = players.length;
    buckets = players.map((p, i) => ({ x: F.x + F.w * (i + 0.5) / n, y: F.y + F.h - 60, w: 230, h: 100 }));
    Arena.spreadPlayers(players, F.x + F.w / 2, F.y + F.h / 2, 120);
    Arena.startPowerups(['freeze', 'speed', 'magnet'], (x, y) => tiles.some(t => !t.carriedBy && Math.hypot(t.x - x, t.y - y) < TILE_R + 60));
    newKey();
  }

  function dropTile(p, tile) {
    tile.carriedBy = null; p.carry = null;
    tile.x = p.x + p.fx * 40; tile.y = p.y + p.fy * 40;
    tile.vx = p.fx * 380 + (Math.random() - 0.5) * 100; tile.vy = p.fy * 380 + (Math.random() - 0.5) * 100;
    tile.kick = 1;
  }

  function finishPlayer(p, now) {
    p.g.finished = true; p.finished = true;
    finishedCount++;
    p.place = finishedCount;
    const bonus = PLACE_BONUS[finishedCount - 1] || 0;
    Arena.addScore(p, bonus, p.x, p.y - 20, finishedCount === 1 ? 'first!' : 'done');
    Audio.play('finish');
    FX.burst(p.x, p.y, p.color, 30, 360, 8);
    Input.rumble(p.source, 300, 0.6);
    if (finishedCount === players.filter(q => q.active).length) pause = 1.6;
  }

  function deposit(p, tile, bucket, now) {
    const label = tile.label;
    const ok = !cMajor && needed.indexOf(label) >= 0 && p.g.collected.indexOf(label) < 0;
    if (ok) {
      p.g.collected.push(label);
      tiles.splice(tiles.indexOf(tile), 1);
      p.carry = null;
      Arena.addScore(p, 10, bucket.x, bucket.y - 60, Theory.display(label));
      Audio.play('good');
      FX.burst(bucket.x, bucket.y, p.color, 12, 200, 6);
      if (p.g.collected.length === needed.length) finishPlayer(p, now);
    } else {
      Arena.addScore(p, cMajor ? -10 : -5, bucket.x, bucket.y - 60, cMajor ? 'bring nothing!' : 'wrong');
      Audio.play('bad');
      Input.rumble(p.source, 150, 0.5);
      // bounce back up the field
      tile.carriedBy = null; p.carry = null;
      tile.x = bucket.x; tile.y = bucket.y - 80;
      tile.vx = (Math.random() - 0.5) * 300; tile.vy = -520; tile.kick = 1;
      p.g.lockUntil = now + 500;
    }
  }

  function update(dt, now) {
    if (done) return;
    if (pause > 0) {
      pause -= dt;
      if (pause <= 0) { if (time > 8) newKey(); else done = true; }
      return;
    }
    time -= dt;
    if (time <= 0) { time = 0; done = true; return; }
    Arena.updatePlayers(players, dt, now, { onDrop: dropTile });

    // tiles drift and bounce
    tiles.forEach(t => {
      if (t.carriedBy) { t.x = t.carriedBy.x; t.y = t.carriedBy.y - 60; return; }
      t.x += t.vx * dt; t.y += t.vy * dt;
      if (t.kick > 0) { t.kick -= dt * 1.5; t.vx *= Math.pow(0.05, dt); t.vy *= Math.pow(0.05, dt); if (t.kick <= 0) { const m = Math.hypot(t.vx, t.vy) || 1; t.vx = t.vx / m * 45; t.vy = t.vy / m * 45; } }
      if (t.x < F.x + t.r) { t.x = F.x + t.r; t.vx = Math.abs(t.vx); }
      if (t.x > F.x + F.w - t.r) { t.x = F.x + F.w - t.r; t.vx = -Math.abs(t.vx); }
      if (t.y < F.y + t.r) { t.y = F.y + t.r; t.vy = Math.abs(t.vy); }
      if (t.y > F.y + F.h - 130) { t.y = F.y + F.h - 130; t.vy = -Math.abs(t.vy); }
      // magnets pull free tiles
      players.forEach(p => {
        if (now < p.magnetUntil && !p.g.finished) {
          const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy);
          if (d < 320 && d > 1) { t.x += dx / d * 300 * dt; t.y += dy / d * 300 * dt; }
        }
      });
    });

    players.forEach((p, i) => {
      const inp = Input.get(p.source);
      const b = buckets[i];
      const inBucket = Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.y - b.y) < b.h / 2 + 10;
      if (p.g.finished) return;
      if (cMajor) {
        const moved = Math.hypot(p.x - p.g.lastX, p.y - p.g.lastY) > 1.5;
        p.g.lastX = p.x; p.g.lastY = p.y;
        if (inBucket && !moved && !p.carry) {
          p.g.still += dt;
          if (p.g.still >= 3) { Arena.addScore(p, 15, p.x, p.y - 20, 'nothing!'); finishPlayer(p, now); }
        } else p.g.still = 0;
      }
      if (!Arena.canAct(p, now) || !inp) return;
      if (p.carry) {
        if (inBucket && now > (p.g.lockUntil || 0)) deposit(p, p.carry, b, now);
        else if (inp.press.cross) { dropTile(p, p.carry); Audio.play('drop'); }
      } else if (inp.press.cross && now > (p.g.lockUntil || 0)) {
        let best = null, bd = 1e9;
        tiles.forEach(t => { if (t.carriedBy) return; const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < Arena.R + t.r + 12 && d < bd) { bd = d; best = t; } });
        if (best) { best.carriedBy = p; p.carry = best; Audio.play('grab'); FX.burst(best.x, best.y, p.color, 8, 150, 5); }
      }
    });
  }

  function draw(ctx, now) {
    Arena.drawField(ctx);
    const sub = cMajor ? 'No sharps, no flats. Bring NOTHING and stand still in your bucket.' : 'Grab the ' + (needed[0].indexOf('#') >= 0 ? 'sharps' : 'flats') + ' of this key, one at a time, and carry them to your bucket.';
    Arena.drawBanner(ctx, banner, sub, time / DURATION, now, cMajor ? FX.PAL.gold : FX.PAL.sage);
    // buckets
    players.forEach((p, i) => {
      const b = buckets[i];
      FX.roundRect(ctx, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 18, p.g.finished ? FX.PAL.sageT : FX.PAL.white, p.color, 6);
      FX.label(ctx, p.name + (cMajor ? '' : '  ' + p.g.collected.length + '/' + needed.length), b.x, b.y - 30, 22, p.dark);
      if (cMajor) {
        if (p.g.still > 0 && !p.g.finished) FX.bar(ctx, b.x - 90, b.y + 12, 180, 14, p.g.still / 3, p.color);
        else FX.label(ctx, p.g.finished ? 'done' : 'stand still here', b.x, b.y + 18, 20, FX.PAL.dim, 'center', false);
      } else {
        const n = needed.length;
        const cw = Math.min(44, (b.w - 20) / n);
        needed.forEach((a, k) => {
          const x = b.x - (n - 1) * cw / 2 + k * cw;
          const got = p.g.collected.indexOf(a) >= 0;
          FX.roundRect(ctx, x - cw / 2 + 3, b.y + 2, cw - 6, 36, 6, got ? p.color : FX.PAL.sand, null);
          if (got) FX.label(ctx, Theory.display(a), x, b.y + 21, 22, FX.PAL.white);
          else FX.label(ctx, '?', x, b.y + 21, 22, '#c8bda6');
        });
      }
    });
    Arena.drawPowerups(ctx, now);
    players.forEach(p => Arena.drawPlayer(ctx, p, now, p.g.finished ? 'done' : (now < p.magnetUntil ? 'magnet' : '')));
  }

  // Top layer: every letter tile and every carried tile, above players and particles.
  function drawTop(ctx, now) {
    tiles.forEach(t => { if (!t.carriedBy) Arena.drawTile(ctx, t.label, t.x, t.y, t.r, FX.PAL.ink, now); });
    players.forEach(p => Arena.drawCarried(ctx, p, now));
  }

  // Test aid: where P1 should go next (a needed tile, or the bucket when carrying or in C major).
  function debugTarget(p) {
    const i = players.indexOf(p); const b = buckets[i];
    if (!p.g || p.g.finished) return null;
    if (cMajor || p.carry) return { x: b.x, y: b.y, info: 'bucket:' + (p.g.collected || []).length + '/' + needed.length };
    let best = null, bd = 1e9;
    tiles.forEach(t => { if (t.carriedBy || needed.indexOf(t.label) < 0 || p.g.collected.indexOf(t.label) >= 0) return; const d = Math.hypot(t.x - p.x, t.y - p.y); if (d < bd) { bd = d; best = t; } });
    return best ? { x: best.x, y: best.y, info: best.label + ':' + p.g.collected.length + '/' + needed.length } : null;
  }

  return { id: 'bucket', debugTarget, title: 'Bucket Brigade', blurb: 'Collect the sharps or flats of the key and carry them to your bucket.',
    hint: 'X grab / drop   square punch   triangle use power-up', start, update, draw, drawTop, isDone: () => done };
})();
