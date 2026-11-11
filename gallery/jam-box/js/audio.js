// Jam Box sound engine. Everything is synthesized with Web Audio: no samples, nothing to download.
// unlock() must run inside a tap (iPhone rule). Times are AudioContext seconds.

export let ctx = null;
let master = null, out = null, noise = null, recDest = null;

export const VOICES = [['pluck', 'Pluck'], ['bell', 'Bell'], ['chip', 'Chip'], ['flute', 'Flute'], ['bass', 'Bass']];

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    out = ctx.createDynamicsCompressor();
    out.threshold.value = -14; out.ratio.value = 4; out.attack.value = 0.003; out.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.8;
    master.connect(out); out.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // iPhone: without this, the ring/silent switch mutes Web Audio.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older Safari */ }
    try { const a = new Audio(silentWav()); a.loop = true; a.setAttribute('playsinline', ''); a.play().catch(() => {}); } catch (e) { /* fine */ }
  }
  if (ctx.state !== 'running') ctx.resume();
}

export const now = () => (ctx ? ctx.currentTime : 0);
// how late the sound reaches the ears (Bluetooth headphones can add 150 ms or more)
export const latency = () => (ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0);

export function recordStream() {
  if (!recDest) { recDest = ctx.createMediaStreamDestination(); out.connect(recDest); }
  return recDest.stream;
}

function silentWav() {
  const n = 4000, b = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, s) => [...s].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); b.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, 8000, true); b.setUint32(28, 16000, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true);
  w(36, 'data'); b.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}

const mtof = m => 440 * 2 ** ((m - 69) / 12);

function osc(type, f, t, end) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f, t); o.start(t); o.stop(end);
  return o;
}
function noiseSrc(t, end) {
  const s = ctx.createBufferSource(); s.buffer = noise;
  s.start(t, Math.random() * 0.5); s.stop(end);
  return s;
}
function filt(type, f, q = 1) {
  const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q;
  return x;
}
// percussive: up to peak in a, down to silence over d
function hitEnv(t, peak, a, d) {
  const n = ctx.createGain(), p = n.gain;
  p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(peak, t + a); p.exponentialRampToValueAtTime(0.0001, t + a + d);
  return n;
}
// held note: attack, settle to sus, hold for dur, release
function env(t, a, peak, dur, rel, sus = 0.6) {
  const n = ctx.createGain(), p = n.gain, lo = Math.max(peak * sus, 0.0002);
  const dEnd = t + a + Math.max(0.02, Math.min(0.15, dur * 0.5)), hold = Math.max(t + dur, dEnd + 0.001);
  p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(peak, t + a);
  p.exponentialRampToValueAtTime(lo, dEnd); p.setValueAtTime(lo, hold);
  p.exponentialRampToValueAtTime(0.0001, hold + rel);
  return n;
}

export const DRUMS = ['Kick', 'Snare', 'Clap', 'Hat', 'Open hat', 'Bongo'];

export function drum(i, t, v = 1) {
  if (!ctx) return;
  if (i === 0) {
    const o = osc('sine', 150, t, t + 0.5); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    o.connect(hitEnv(t, v, 0.002, 0.42)).connect(master);
    osc('triangle', 900, t, t + 0.03).connect(hitEnv(t, 0.2 * v, 0.001, 0.015)).connect(master);
  } else if (i === 1) {
    noiseSrc(t, t + 0.3).connect(filt('highpass', 1500)).connect(hitEnv(t, 0.5 * v, 0.002, 0.2)).connect(master);
    const o = osc('triangle', 200, t, t + 0.2); o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
    o.connect(hitEnv(t, 0.45 * v, 0.002, 0.1)).connect(master);
  } else if (i === 2) {
    const bp = filt('bandpass', 1400, 1.2); bp.connect(master);
    for (let k = 0; k < 3; k++) { const s = t + k * 0.011; noiseSrc(s, s + 0.03).connect(hitEnv(s, 0.55 * v, 0.001, 0.02)).connect(bp); }
    noiseSrc(t + 0.033, t + 0.3).connect(hitEnv(t + 0.033, 0.45 * v, 0.002, 0.17)).connect(bp);
  } else if (i === 3) {
    noiseSrc(t, t + 0.1).connect(filt('highpass', 7500)).connect(hitEnv(t, 0.3 * v, 0.001, 0.045)).connect(master);
  } else if (i === 4) {
    noiseSrc(t, t + 0.45).connect(filt('highpass', 7000)).connect(hitEnv(t, 0.24 * v, 0.002, 0.32)).connect(master);
  } else if (i === 5) {
    const o = osc('sine', 390, t, t + 0.25); o.frequency.exponentialRampToValueAtTime(300, t + 0.08);
    o.connect(hitEnv(t, 0.6 * v, 0.002, 0.15)).connect(master);
  }
}

export function voice(snd, midi, t, dur, v = 1) {
  if (!ctx) return;
  const f = mtof(midi), end = t + dur + 1.3;
  if (snd === 'pluck') {
    const lp = filt('lowpass', 5000, 2);
    lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(800, t + 0.3);
    const e = env(t, 0.004, 0.2 * v, dur, 0.25, 0.35);
    osc('sawtooth', f, t, end).connect(lp); osc('sawtooth', f * 1.006, t, end).connect(lp);
    lp.connect(e).connect(master);
  } else if (snd === 'bell') {
    const c = osc('sine', f, t, end), m = osc('sine', f * 3.5, t, end), mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1);
    m.connect(mg).connect(c.frequency);
    c.connect(env(t, 0.003, 0.28 * v, dur, 1.1, 0.4)).connect(master);
  } else if (snd === 'chip') {
    osc('square', f, t, end).connect(filt('lowpass', 6000)).connect(env(t, 0.003, 0.1 * v, dur, 0.06, 0.7)).connect(master);
  } else if (snd === 'flute') {
    const o = osc('triangle', f, t, end), lfo = osc('sine', 5.5, t, end), lg = ctx.createGain();
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + 0.25);
    lfo.connect(lg).connect(o.frequency);
    const e = env(t, 0.05, 0.3 * v, dur, 0.15, 0.85);
    o.connect(filt('lowpass', 3000)).connect(e).connect(master);
    osc('sine', f * 2, t, end).connect(hitEnv(t, 0.03 * v, 0.04, dur + 0.1)).connect(master);
  } else if (snd === 'bass') {
    const lp = filt('lowpass', 2200, 6);
    lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.25);
    const e = env(t, 0.005, 0.32 * v, dur, 0.12, 0.6);
    osc('sawtooth', f, t, end).connect(lp); lp.connect(e).connect(master);
    osc('sine', f, t, end).connect(env(t, 0.005, 0.25 * v, dur, 0.12, 0.8)).connect(master);
  } else if (snd === 'keys') {
    const e = env(t, 0.003, 0.16 * v, dur, 0.25, 0.3);
    osc('triangle', f, t, end).connect(e).connect(master);
    osc('sine', f * 2, t, end).connect(hitEnv(t, 0.04 * v, 0.003, 0.2)).connect(master);
  } else if (snd === 'pad') {
    const lp = filt('lowpass', 1300, 0.7), e = env(t, 0.12, 0.06 * v, dur, 0.5, 0.85);
    const a = osc('sawtooth', f, t, end); a.detune.value = -7;
    const b = osc('sawtooth', f, t, end); b.detune.value = 7;
    a.connect(lp); b.connect(lp); lp.connect(e).connect(master);
  }
}
