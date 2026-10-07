/* Key Party: particles, floating text and canvas drawing helpers.
   Palette: warm cream background, sage and ocean accents, Okabe-Ito player colors. */
const FX = (() => {
  'use strict';
  const PAL = {
    cream: '#f6efe2', sand: '#ebe1cc', ink: '#2b2620', dim: '#6e6357', sage: '#5f7d50', sageT: '#dfe8d2',
    ocean: '#2f6f8f', oceanT: '#dbe9f0', clay: '#b0522c', clayT: '#f3dfd3', gold: '#d9a441', white: '#fffdf8',
    lava: '#d9532b', lavaDeep: '#8f2c12', ice: '#bfe3f2',
  };
  // Okabe-Ito, colorblind safe. Each player also has a unique shape.
  const PLAYERS = [
    { color: '#e69f00', dark: '#9a6a00', shape: 'circle', name: 'P1' },
    { color: '#56b4e9', dark: '#2b6f94', shape: 'square', name: 'P2' },
    { color: '#009e73', dark: '#00634a', shape: 'triangle', name: 'P3' },
    { color: '#cc79a7', dark: '#86486d', shape: 'diamond', name: 'P4' },
  ];
  const FONT = '"Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif';

  const particles = [];
  const floaters = [];

  function burst(x, y, color, n, speed, size) {
    n = n || 14; speed = speed || 260; size = size || 7;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, t: 0, color, size: size * (0.6 + Math.random() * 0.8), g: 500 });
    }
  }

  function confetti(x, y, n) {
    const cols = ['#e69f00', '#56b4e9', '#009e73', '#cc79a7', '#d9a441', '#2f6f8f'];
    for (let i = 0; i < (n || 40); i++) {
      particles.push({ x: x + (Math.random() - 0.5) * 60, y, vx: (Math.random() - 0.5) * 500, vy: -300 - Math.random() * 400, life: 1.6 + Math.random(), t: 0,
        color: cols[i % cols.length], size: 8 + Math.random() * 6, g: 700, rect: true });
    }
  }

  function text(x, y, str, color, size) {
    floaters.push({ x, y, str, color: color || PAL.ink, size: size || 34, life: 1.1, t: 0 });
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.98;
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.t += dt;
      f.y -= 60 * dt;
      if (f.t >= f.life) floaters.splice(i, 1);
    }
  }

  function draw(ctx) {
    particles.forEach(p => {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      if (p.rect) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 6); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
    floaters.forEach(f => {
      const a = 1 - Math.pow(f.t / f.life, 2);
      ctx.globalAlpha = Math.max(0, a);
      label(ctx, f.str, f.x, f.y, f.size, f.color, 'center', true);
    });
    ctx.globalAlpha = 1;
  }

  function clear() { particles.length = 0; floaters.length = 0; }

  // ---------------------------------------------------------------- drawing helpers
  function roundRect(ctx, x, y, w, h, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 4; ctx.stroke(); }
  }

  function label(ctx, str, x, y, size, color, align, bold, outline) {
    ctx.font = (bold === false ? '500 ' : '700 ') + size + 'px ' + FONT;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    if (outline) { ctx.lineWidth = Math.max(3, size / 8); ctx.strokeStyle = outline; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color || PAL.ink;
    ctx.fillText(str, x, y);
  }

  function shape(ctx, kind, x, y, r, fill, stroke, lw) {
    ctx.beginPath();
    if (kind === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
    else if (kind === 'square') ctx.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
    else if (kind === 'triangle') { ctx.moveTo(x, y - r * 1.1); ctx.lineTo(x + r * 1.05, y + r * 0.8); ctx.lineTo(x - r * 1.05, y + r * 0.8); ctx.closePath(); }
    else { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.05, y); ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r * 1.05, y); ctx.closePath(); }
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 4; ctx.stroke(); }
  }

  // A big progress bar that drains left to right. Color shifts to clay in the last 20 percent.
  function bar(ctx, x, y, w, h, frac, color) {
    roundRect(ctx, x, y, w, h, h / 2, PAL.sand, null);
    const f = Math.max(0, Math.min(1, frac));
    if (f > 0) roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2, color || (f < 0.2 ? PAL.clay : PAL.sage), null);
  }

  return { PAL, PLAYERS, FONT, burst, confetti, text, update, draw, clear, roundRect, label, shape, bar };
})();
