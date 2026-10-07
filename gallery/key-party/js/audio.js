/* Key Party: WebAudio synth. Sound effects plus the 12 bar blues loop.
   No samples, no network. The context is created on the first user input. */
const Audio = (() => {
  'use strict';
  let ctx = null;
  let master = null;
  let muted = false;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }

  function tone(freq, type, dur, vol, when, detune) {
    if (!ctx || muted) return;
    const t = when || ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function sweep(f0, f1, dur, type, vol) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  let noiseBuf = null;
  function noise(dur, vol, when, hp) {
    if (!ctx || muted) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = when || ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = hp ? 'highpass' : 'lowpass';
    f.frequency.value = hp ? 6000 : 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  const SFX = {
    join: () => { tone(523, 'triangle', 0.12, 0.2); tone(784, 'triangle', 0.2, 0.2, ctx.currentTime + 0.1); },
    select: () => tone(660, 'square', 0.06, 0.08),
    move: () => tone(440, 'square', 0.04, 0.05),
    grab: () => sweep(300, 700, 0.1, 'triangle', 0.15),
    drop: () => sweep(500, 250, 0.12, 'triangle', 0.12),
    good: () => { tone(659, 'triangle', 0.1, 0.2); tone(988, 'triangle', 0.18, 0.2, ctx.currentTime + 0.08); },
    bad: () => { sweep(220, 110, 0.25, 'sawtooth', 0.12); noise(0.1, 0.1); },
    punch: () => { noise(0.08, 0.3); sweep(180, 60, 0.12, 'square', 0.15); },
    hit: () => { sweep(400, 90, 0.2, 'square', 0.12); },
    powerup: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 'triangle', 0.15, 0.15, ctx.currentTime + i * 0.06)); },
    freeze: () => { sweep(1200, 300, 0.5, 'sine', 0.15); },
    speed: () => { sweep(300, 1200, 0.3, 'sawtooth', 0.1); },
    magnet: () => { tone(220, 'sine', 0.4, 0.15); tone(330, 'sine', 0.4, 0.1, ctx.currentTime + 0.05); },
    step: () => tone(880, 'triangle', 0.07, 0.12),
    finish: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 'triangle', 0.25, 0.18, ctx.currentTime + i * 0.09)); },
    tick: () => tone(1000, 'square', 0.03, 0.05),
    fall: () => sweep(600, 80, 0.5, 'sawtooth', 0.12),
    round: () => { [392, 523, 659].forEach((f, i) => tone(f, 'square', 0.2, 0.1, ctx.currentTime + i * 0.12)); },
    win: () => { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 'triangle', 0.3, 0.2, ctx.currentTime + i * 0.14)); },
    burn: () => { noise(0.12, 0.08); },
    out: () => sweep(300, 50, 0.6, 'sawtooth', 0.15),
  };

  function play(name) {
    if (!ctx || muted || !SFX[name]) return;
    try { SFX[name](); } catch (e) { /* audio never breaks the game */ }
  }

  // ---------------------------------------------------------------- blues loop
  // A scheduler fills a lookahead window; the game reads position() each frame.
  const blues = (() => {
    let running = false, prog = null, bpm = 90, startAt = 0, barDur = 0;
    let nextBeat = 0, timer = null, chorus = 0;
    const LOOKAHEAD = 0.25, STEP = 0.05;

    function freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

    function scheduleBeat(beatIndex) {
      const t = startAt + beatIndex * (barDur / 4);
      const bar = Math.floor(beatIndex / 4) % 12;
      const beat = beatIndex % 4;
      const ch = prog[bar];
      const swing = barDur / 4 * 0.33;
      // walking bass: root, 3rd, 5th, 6th (the shuffle line)
      const line = [ch.pcs[0], ch.pcs[1], ch.pcs[2], (ch.pcs[0] + 9) % 12];
      const rootMidi = 36 + ch.pcs[0];
      let bassMidi = 36 + line[beat];
      while (bassMidi < rootMidi) bassMidi += 12;
      tone(freq(bassMidi), 'triangle', barDur / 4 * 0.9, 0.22, t);
      tone(freq(bassMidi), 'sawtooth', barDur / 4 * 0.5, 0.05, t);
      // hat on every beat, snare-ish noise on 2 and 4
      noise(0.03, 0.05, t, true);
      noise(0.03, 0.03, t + swing * 2, true);
      if (beat === 1 || beat === 3) noise(0.1, 0.07, t);
      // chord stab on the swung offbeat
      ch.pcs.forEach((pc, i) => {
        let m = 60 + pc;
        if (i > 0 && m < 60 + ch.pcs[0]) m += 12;
        tone(freq(m), 'square', 0.12, 0.035, t + swing * 2, i * 3);
      });
    }

    function pump() {
      if (!running || !ctx) return;
      while (startAt + nextBeat * (barDur / 4) < ctx.currentTime + LOOKAHEAD) {
        scheduleBeat(nextBeat);
        nextBeat++;
      }
    }

    function start(progression, tempo) {
      if (!ctx) return;
      stop();
      prog = progression; bpm = tempo || 90;
      barDur = 4 * 60 / bpm;
      startAt = ctx.currentTime + 0.1;
      nextBeat = 0; chorus = 0; running = true;
      pump();
      timer = setInterval(pump, STEP * 1000);
    }

    function stop() {
      running = false;
      if (timer) { clearInterval(timer); timer = null; }
    }

    // {bar 0..11, beat 0..3, phase 0..1 within bar, chorus, elapsed, barDur}
    function position() {
      if (!running || !ctx) return null;
      const el = Math.max(0, ctx.currentTime - startAt);
      const barsTotal = el / barDur;
      const bar = Math.floor(barsTotal) % 12;
      return { bar, beat: Math.floor((barsTotal % 1) * 4), phase: barsTotal % 1, chorus: Math.floor(barsTotal / 12), elapsed: el, barDur, bpm };
    }

    return { start, stop, position, isRunning: () => running };
  })();

  function setMuted(m) { muted = m; }
  function ready() { return !!ctx; }

  return { init, play, blues, setMuted, ready };
})();
