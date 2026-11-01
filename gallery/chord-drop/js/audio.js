/* Chord Drop: sound. Synthesized click, three drum grooves, a soft chord pad, and a look-ahead scheduler. */
(function () {
  const CD = window.CD;

  /* ---------- grooves, as hits in one bar (real time ticks, so the shuffle's "and" sits at 8) ---------- */

  CD.grooveHits = function (groove, mi) {
    const H = [];
    const add = (tick, inst, vel) => H.push({ tick, inst, vel });
    const B = mi.beatTicks;
    // kick on 1 and 3, snare on 2 and 4; in 3/4 the snare takes beats 2 and 3
    const role = (b) => (mi.beats === 3 ? (b === 0 ? 'kick' : 'snare') : b % 2 === 0 ? 'kick' : 'snare');

    if (groove === 'click') {
      for (let b = 0; b < mi.beats; b++) {
        add(b * B, 'click', b === 0 ? 1 : 0.6);
        if (mi.compound) { add(b * B + 6, 'tick', 0.3); add(b * B + 12, 'tick', 0.3); }
      }
    } else if (!mi.compound) {
      for (let b = 0; b < mi.beats; b++) {
        const t = b * B, r = role(b);
        if (groove === 'rock') {
          add(t, 'hat', 0.75); add(t + 6, 'hat', 0.45);
          add(t, r, r === 'kick' ? 1 : 0.9);
          if (mi.beats === 4 && b === 2) add(t + 6, 'kick', 0.7);
        } else if (groove === 'shuffle') {
          add(t, 'hat', 0.75); add(t + 8, 'hat', 0.5);
          add(t, r, r === 'kick' ? 1 : 0.85);
          if (r === 'snare') add(t + 8, 'snare', 0.12);
          if (r === 'kick' && b > 0) add(t - 4, 'kick', 0.45);
        } else if (groove === 'funk') {
          for (let s = 0; s < 4; s++) add(t + s * 3, 'hat', s === 0 ? 0.65 : s === 2 ? 0.45 : 0.25);
          if (mi.beats === 4) {
            if (b === 0) { add(0, 'kick', 1); add(9, 'kick', 0.55); }
            if (b === 1) { add(12, 'snare', 0.9); add(21, 'snare', 0.18); }
            if (b === 2) { add(30, 'kick', 0.85); add(33, 'snare', 0.15); }
            if (b === 3) { add(36, 'snare', 0.9); add(42, 'kick', 0.6); add(45, 'snare', 0.2); }
          } else {
            add(t, r, r === 'kick' ? 1 : 0.9);
            add(t + 9, r === 'kick' ? 'kick' : 'snare', r === 'kick' ? 0.55 : 0.18);
          }
        }
      }
    } else {
      // 6/8 and 12/8: beats are dotted quarters, three eighths each
      for (let b = 0; b < mi.beats; b++) {
        const t = b * B, r = role(b);
        if (groove === 'rock') {
          for (let e = 0; e < 3; e++) add(t + e * 6, 'hat', e === 0 ? 0.75 : 0.4);
          add(t, r, r === 'kick' ? 1 : 0.9);
        } else if (groove === 'shuffle') {
          add(t, 'hat', 0.75); add(t + 12, 'hat', 0.5);
          add(t, r, r === 'kick' ? 1 : 0.85);
          if (r === 'kick') add(t + 12, 'kick', 0.4);
        } else if (groove === 'funk') {
          for (let s = 0; s < 6; s++) add(t + s * 3, 'hat', s === 0 ? 0.65 : s % 2 === 0 ? 0.4 : 0.22);
          add(t, r, r === 'kick' ? 1 : 0.9);
          if (r === 'kick') add(t + 12, 'kick', 0.6);
          else add(t + 15, 'snare', 0.2);
        }
      }
    }
    return H.sort((a, b) => a.tick - b.tick);
  };

  /* ---------- the synth ---------- */

  // iPhone and iPad: play through the silent switch, like a music app does.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}

  class Engine {
    constructor() { this.ctx = null; }

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.build(new AC({ latencyHint: 'interactive' }));
      }
      // Safari can leave the sound "interrupted" (another tab, headphones, sleep), not just "suspended": wake it either way
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      return this.ctx;
    }

    // the output chain, on a live context or an offline one (for measuring)
    build(ctx) {
      this.ctx = ctx;
      // a safety limiter only: it catches peaks and leaves everything else alone (a lower threshold
      // let every kick pull the whole mix down, and laptop speakers lost what was left)
      this.out = ctx.createDynamicsCompressor();
      this.out.threshold.value = -4;
      this.out.knee.value = 0;
      this.out.ratio.value = 20;
      this.out.attack.value = 0.002;
      this.out.release.value = 0.1;
      this.out.connect(ctx.destination);
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }

    // how long after a sound is scheduled it reaches the ear
    latency() {
      const c = this.ctx;
      return c ? (c.outputLatency || 0) + (c.baseLatency || 0) : 0;
    }

    bus() {
      const g = this.ctx.createGain();
      g.connect(this.out);
      return g;
    }

    _env(g, t, peak, decay) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    }

    _noise(t, dur, type, freq, peak, out) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq;
      const g = ctx.createGain();
      this._env(g, t, peak, dur);
      src.connect(f); f.connect(g); g.connect(out);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    }

    _tone(type, freq, t, peak, decay, out) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      this._env(g, t, peak, decay);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + decay + 0.02);
      return o;
    }

    // Every drum carries some sound above 300 Hz: MacBook speakers play almost nothing below that,
    // so a kick that is only a low thump comes out as silence there.
    hit(inst, t, v, out) {
      const ctx = this.ctx;
      out = out || this.out;
      if (inst === 'click' || inst === 'tick') {
        const f = inst === 'tick' ? 1000 : v >= 1 ? 1760 : 1320;
        this._tone('triangle', f, t, (inst === 'tick' ? 0.45 : 0.8) * v, 0.09, out);
        this._tone('sine', f * 2, t, 0.2 * v, 0.03, out);
      } else if (inst === 'kick') {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(170, t);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
        this._env(g, t, 0.75 * v, 0.3);
        o.connect(g); g.connect(out);
        o.start(t); o.stop(t + 0.35);
        // the beater: a short knock you can hear on small speakers
        const k = this._tone('triangle', 900, t, 0.45 * v, 0.035, out);
        k.frequency.setValueAtTime(900, t);
        k.frequency.exponentialRampToValueAtTime(260, t + 0.03);
        this._noise(t, 0.02, 'bandpass', 2500, 0.25 * v, out);
      } else if (inst === 'snare') {
        this._noise(t, 0.2, 'highpass', 1200, 0.85 * v, out);
        this._noise(t, 0.08, 'bandpass', 2600, 0.5 * v, out);
        this._tone('triangle', 240, t, 0.4 * v, 0.09, out);
        this._tone('triangle', 410, t, 0.25 * v, 0.06, out);
      } else if (inst === 'hat') {
        this._noise(t, 0.06, 'highpass', 6000, 0.45 * v, out);
      }
    }

    // A soft electric-piano-ish pad. Returns a handle so a tapped chord can be cut off by the next tap.
    chord(sym, t, tEnd, out) {
      const n = CD.chordNotes(sym);
      if (!n) return null;
      const ctx = this.ctx;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 3200; f.Q.value = 0.4;
      const g = ctx.createGain();
      f.connect(g); g.connect(out || this.out);
      // holds near full while the chord rings: a pad that fades fast is gone on laptop speakers
      const peak = 0.3;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
      g.gain.exponentialRampToValueAtTime(peak * 0.75, t + 0.5);
      const end = Math.max(tEnd, t + 0.12);
      g.gain.setTargetAtTime(0.0001, end, 0.06);
      const oscs = [];
      const voice = (midi, type, level, detune) => {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type;
        o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
        o.detune.value = detune || 0;
        og.gain.value = level;
        o.connect(og); og.connect(f);
        o.start(t); o.stop(end + 0.5);
        oscs.push(o);
      };
      n.upper.forEach((m) => { voice(m, 'triangle', 0.45, -4); voice(m, 'sawtooth', 0.12, 5); });
      voice(n.bass, 'triangle', 0.7, 0);
      voice(n.bass + 12, 'sawtooth', 0.22, 0); // the bass note an octave up, so small speakers still hear the root
      return {
        release(rt) {
          if (g.gain.cancelAndHoldAtTime) g.gain.cancelAndHoldAtTime(rt);
          else g.gain.cancelScheduledValues(rt);
          g.gain.setTargetAtTime(0.0001, rt, 0.05);
          oscs.forEach((o) => { try { o.stop(rt + 0.4); } catch (e) {} });
        },
      };
    }
  }

  /* ---------- the scheduler ---------- */

  class Transport {
    constructor(engine) { this.e = engine; this.timer = null; this.raf = null; }

    get running() { return !!this.timer; }

    // o: { song, mi, countIn, blocks (null = run until stopped), onPos(tick), onEnd() }
    start(o) {
      this.stop();
      const ctx = this.e.ensure();
      const mi = (this.mi = o.mi);
      const BT = mi.barTicks;
      this.o = o;
      this.spt = 60 / (o.song.tempo * mi.beatTicks);
      this.swing = CD.isSwing(o.song, mi);
      this.out = this.e.bus();
      this.countIn = o.countIn || 0;
      this.t0 = ctx.currentTime + 0.15 + this.countIn * BT * this.spt;
      this.groove = CD.grooveHits(o.song.groove, mi);
      this.countHits = CD.grooveHits('click', mi);
      this.bar = -this.countIn;
      this.hi = 0;
      this.chords = [];
      let total = Infinity;
      if (o.blocks) {
        let off = 0;
        for (const b of o.blocks) {
          b.events.forEach((t, i) => {
            const end = i + 1 < b.events.length ? b.events[i + 1] : b.length;
            if (o.chords !== false) this.chords.push({ t: off + t, end: off + end, sym: b.chords[i] });
          });
          off += b.length;
        }
        total = off;
      }
      this.totalBars = total === Infinity ? Infinity : Math.round(total / BT);
      this.endTime = total === Infinity ? null : this.t0 + total * this.spt;
      this.ci = 0;
      this.timer = setInterval(() => this._pump(), 25);
      this._pump();
      const loop = () => {
        if (!this.timer) return;
        const tick = (ctx.currentTime - this.e.latency() - this.t0) / this.spt;
        if (o.onPos) o.onPos(tick);
        if (this.endTime && ctx.currentTime > this.endTime + 0.25) {
          const cb = o.onEnd;
          this.stop();
          if (cb) cb();
          return;
        }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }

    tickTime(t) { return this.t0 + CD.swingTick(t, this.swing) * this.spt; }

    _pump() {
      const ctx = this.e.ctx, ahead = ctx.currentTime + 0.12, BT = this.mi.barTicks;
      while (this.bar < this.totalBars) {
        const hits = this.bar < 0 ? this.countHits : this.groove;
        if (this.hi >= hits.length) { this.bar++; this.hi = 0; continue; }
        const h = hits[this.hi];
        const t = this.t0 + (this.bar * BT + h.tick) * this.spt;
        if (t > ahead) break;
        if (t >= ctx.currentTime - 0.02) this.e.hit(h.inst, t, h.vel, this.out);
        this.hi++;
      }
      // a last downbeat so the song lands
      if (this.bar === this.totalBars && !this.landed) {
        const t = this.t0 + this.bar * BT * this.spt;
        if (t <= ahead) { this.landed = true; this.e.hit(this.o.song.groove === 'click' ? 'click' : 'kick', t, 1, this.out); }
      }
      while (this.ci < this.chords.length) {
        const c = this.chords[this.ci];
        const t = this.tickTime(c.t);
        if (t > ahead) break;
        if (t >= ctx.currentTime - 0.02) this.e.chord(c.sym, t, this.tickTime(c.end), this.out);
        this.ci++;
      }
    }

    stop() {
      if (this.timer) clearInterval(this.timer);
      if (this.raf) cancelAnimationFrame(this.raf);
      this.timer = null; this.raf = null; this.landed = false;
      if (this.out && this.e.ctx) {
        const g = this.out, now = this.e.ctx.currentTime;
        g.gain.setTargetAtTime(0, now, 0.02);
        setTimeout(() => g.disconnect(), 400);
      }
      this.out = null;
    }
  }

  CD.Engine = Engine;
  CD.Transport = Transport;
})();
