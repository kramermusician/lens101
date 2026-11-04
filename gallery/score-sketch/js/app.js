/* Score Sketch: a keyboard-first sheet music editor. No libraries; SVG + Bravura (SMuFL) + Web Audio. */
'use strict';
(() => {

// ---------------------------------------------------------------- constants
const SP = 9;                 // staff space in px
const W = 716;                // system width in px
const STORE = 'score-sketch:v1';
const STEP_N = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SEMI = [0, 2, 4, 5, 7, 9, 11];
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6], FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];
const SHARP_POS = [8, 5, 9, 6, 3, 7, 4], FLAT_POS = [4, 7, 3, 6, 2, 5, 1]; // treble, half-spaces above bottom line
const GL = {
  gClef: '', fClef: '', whole: '', half: '', black: '',
  rWhole: '', rHalf: '', rQ: '', r8: '', r16: '', r32: '',
  f8u: '', f8d: '', f16u: '', f16d: '', f32u: '', f32d: '',
  flat: '', nat: '', sharp: '', dot: ''
};
const ACC_GL = { '-1': GL.flat, '0': GL.nat, '1': GL.sharp };
const DYN_GL = { p: '', m: '', f: '', r: '', s: '', z: '' };
const DUR_NAME = { 1920: 'whole', 960: 'half', 480: 'quarter', 240: 'eighth', 120: '16th', 60: '32nd' };
const DUR_KEYS = { '7': 1920, '6': 960, '5': 480, '4': 240, '3': 120, '2': 60 };
const DYN_LEVEL = { pp: .26, p: .38, mp: .5, mf: .62, f: .78, ff: .92, sfz: .95 };
const DECOMP = [2880, 1920, 1440, 960, 720, 480, 360, 240, 180, 120, 90, 60];
const MAJ = { '-7': 'C♭', '-6': 'G♭', '-5': 'D♭', '-4': 'A♭', '-3': 'E♭', '-2': 'B♭', '-1': 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F♯', 7: 'C♯' };
const MIN = { '-7': 'A♭', '-6': 'E♭', '-5': 'B♭', '-4': 'F', '-3': 'C', '-2': 'G', '-1': 'D', 0: 'A', 1: 'E', 2: 'B', 3: 'F♯', 4: 'C♯', 5: 'G♯', 6: 'D♯', 7: 'A♯' };
const SHARP_SP = [[0,0],[0,1],[1,0],[1,1],[2,0],[3,0],[3,1],[4,0],[4,1],[5,0],[5,1],[6,0]];
const FLAT_SP = [[0,0],[1,-1],[1,0],[2,-1],[2,0],[3,0],[4,-1],[4,0],[5,-1],[5,0],[6,-1],[6,0]];

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// ---------------------------------------------------------------- state
function newScore() {
  return { v: 1, title: 'Untitled', subtitle: '', composer: 'Composer', tempo: 100, clef: 'treble',
    minMeasures: 8, measures: { 0: { time: [4, 4], key: 0 } }, voices: [[], []], texts: [] };
}
let score = newScore();
let sel = { v: 0, i: -1, mode: 'insert' };
let inputDur = 480, inputDot = 0;
let undoStack = [], redoStack = [];
let B = null, SYS = [];

// ---------------------------------------------------------------- music helpers
const evTicks = e => e.d * (e.dot ? 1.5 : 1);
function toType(t) {
  for (const d of [1920, 960, 480, 240, 120, 60]) {
    if (t === d) return { d, dot: 0 };
    if (t === d * 1.5) return { d, dot: 1 };
  }
  return null;
}
function decompose(t) {
  const out = [];
  while (t >= 60) { const v = DECOMP.find(x => x <= t); out.push(v); t -= v; }
  return out;
}
function attrAt(m, k) {
  for (let j = m; j >= 0; j--) { const a = score.measures[j]; if (a && a[k] !== undefined) return a[k]; }
  return k === 'time' ? [4, 4] : 0;
}
const mLen = m => { const t = attrAt(m, 'time'); return t[0] * 1920 / t[1]; };
function measureStart(m) { let s = 0; for (let j = 0; j < m; j++) s += mLen(j); return s; }
function tickToMeasure(t) { let m = 0, s = 0; while (s + mLen(m) <= t && m < 9999) { s += mLen(m); m++; } return m; }
function keyAlter(key, step) {
  if (key > 0 && SHARP_ORDER.slice(0, key).includes(step)) return 1;
  if (key < 0 && FLAT_ORDER.slice(0, -key).includes(step)) return -1;
  return 0;
}
const clefBase = () => score.clef === 'bass' ? 18 : 30;
const posOf = e => e.o * 7 + e.s - clefBase();
const yOf = pos => 4 * SP - pos * SP / 2;
const midiOf = e => 12 * (e.o + 1) + SEMI[e.s] + e.a;
function spell(midi, up) {
  const [s, a] = (up ? SHARP_SP : FLAT_SP)[((midi % 12) + 12) % 12];
  return { s, a, o: Math.floor(midi / 12) - 1 };
}
const voiceTicks = v => score.voices[v].reduce((s, e) => s + evTicks(e), 0);
const ticksBefore = (v, i) => { let s = 0; for (let j = 0; j < i; j++) s += evTicks(score.voices[v][j]); return s; };
const noteName = e => e.r ? 'rest' : STEP_N[e.s] + (e.a === 1 ? '♯' : e.a === -1 ? '♭' : '') + e.o;
const durName = e => (e.dot ? 'dotted ' : '') + DUR_NAME[e.d];

// ---------------------------------------------------------------- build: voices -> measures -> pieces
function build() {
  const meas = [];
  const ensure = m => {
    while (meas.length <= m) {
      const i = meas.length, prev = meas[i - 1];
      meas.push({ i, start: prev ? prev.start + prev.len : 0, len: mLen(i), pieces: [[], []], slots: [] });
    }
    return meas[m];
  };
  ensure(0);
  const seq = [[], []], last = [-1, -1], byKey = {};
  const base = clefBase();
  for (let v = 0; v < 2; v++) {
    let m = 0, off = 0;
    score.voices[v].forEach((e, idx) => {
      const total = evTicks(e); let rem = total; const parts = [];
      while (rem > 0) {
        const M = ensure(m);
        if (off >= M.len) { m++; off = 0; continue; }
        const take = Math.min(rem, M.len - off);
        const vals = take === total ? [total] : decompose(take);
        for (const t of vals) {
          const ty = toType(t) || { d: e.d, dot: e.dot };
          const p = { v, idx, e, m, on: off, t, d: ty.d, dot: ty.dot, pos: e.r ? 0 : e.o * 7 + e.s - base };
          M.pieces[v].push(p); parts.push(p); off += t;
        }
        rem -= take;
      }
      parts.forEach((p, k) => {
        p.first = k === 0; p.lastPart = k === parts.length - 1;
        p.tie = !e.r && (k < parts.length - 1 || !!e.tie);
      });
      byKey[v + '-' + idx] = parts;
      seq[v].push(...parts);
      if (parts.length) last[v] = parts[parts.length - 1].m;
    });
  }
  const N = Math.max(score.minMeasures, last[0] + 1, last[1] + 1, 1);
  ensure(N - 1);
  for (const s of seq) for (let k = 1; k < s.length; k++) {
    if (s[k - 1].tie && !s[k].e.r && midiOf(s[k - 1].e) === midiOf(s[k].e)) s[k].tieIn = true;
    else if (s[k - 1].tie) s[k - 1].tie = false;   // a tie needs a matching note after it
  }
  for (const s of seq) if (s.length) { const p = s[s.length - 1]; if (p.e.tie) p.tie = false; }

  meas.forEach(M => {
    for (let v = 0; v < 2; v++) {
      const ps = M.pieces[v];
      if (!ps.length) {
        if (v === 0) ps.push({ v, ghost: true, mrest: true, m: M.i, on: 0, t: M.len, d: 1920, dot: 0, e: { r: true }, pos: 0 });
        continue;
      }
      let end = ps.reduce((s, p) => Math.max(s, p.on + p.t), 0);
      if (end < M.len) for (const t of decompose(M.len - end)) {
        const ty = toType(t);
        ps.push({ v, ghost: true, m: M.i, on: end, t, d: ty.d, dot: ty.dot, e: { r: true }, pos: 0 });
        end += t;
      }
    }
    // accidentals, per measure across both voices
    const key = attrAt(M.i, 'key'), st = {};
    const notes = [...M.pieces[0], ...M.pieces[1]].filter(p => !p.e.r).sort((a, b) => a.on - b.on || a.v - b.v);
    for (const p of notes) {
      const e = p.e, k = e.s + '_' + e.o;
      const cur = k in st ? st[k] : keyAlter(key, e.s);
      if (!p.tieIn && e.a !== cur) p.acc = e.a;
      st[k] = e.a;
    }
  });
  return { meas, seq, byKey, N };
}

// ---------------------------------------------------------------- layout
const tsW = t => Math.max(String(t[0]).length, String(t[1]).length) * 1.8 * SP + 0.4 * SP;
function prefixInfo(m, first) {
  const key = attrAt(m, 'key'), time = attrAt(m, 'time');
  const pk = m > 0 ? attrAt(m - 1, 'key') : 0, pt = m > 0 ? attrAt(m - 1, 'time') : null;
  const timeCh = m === 0 || pt[0] !== time[0] || pt[1] !== time[1];
  const info = { first, key, pk, time, timeCh, keyCh: !first && key !== pk };
  let w = 0;
  if (first) { w += 3.6 * SP; if (key) w += Math.abs(key) * SP + 0.5 * SP; }
  else if (info.keyCh) w += (key ? Math.abs(key) : Math.abs(pk)) * SP + 1.2 * SP;
  if (timeCh) w += tsW(time) + 0.6 * SP;
  if ((score.measures[m] || {}).repeatStart) w += 1.8 * SP;
  if (!first && !info.keyCh && !timeCh && !(score.measures[m] || {}).repeatStart) w = 0;
  info.w = w;
  return info;
}
function measureNat(M) {
  const all = [...M.pieces[0], ...M.pieces[1]].filter(p => !p.mrest);
  // voice collision: a second apart at the same time, push voice 2 right
  for (const p of M.pieces[1]) {
    if (p.e.r) continue;
    const clash = M.pieces[0].some(q => !q.e.r && q.on === p.on && (Math.abs(q.pos - p.pos) === 1 ||
      (q.pos === p.pos && (q.d !== p.d || q.dot !== p.dot || q.d >= 960))));
    if (clash) p.shift = (M.pieces[0].some(q => q.on === p.on && q.d >= 1920) ? 1.75 : 1.3) * SP;
  }
  const ons = [...new Set(all.map(p => p.on))].sort((a, b) => a - b);
  M.slots = ons.map((on, k) => {
    const dt = (k < ons.length - 1 ? ons[k + 1] : M.len) - on;
    const here = all.filter(p => p.on === on);
    let w = SP * (1.9 + 2.1 * Math.sqrt(dt / 480));
    if (here.some(p => p.dot)) w += 0.7 * SP;
    if (here.some(p => p.shift)) w += 1.2 * SP;
    if (here.some(p => !p.e.r && p.d <= 240 && !p.ghost)) w += 0.3 * SP;
    return { on, w, pre: here.some(p => p.acc != null) ? 1.3 * SP : 0 };
  });
  let nat = SP * 1.0 + M.slots.reduce((s, x) => s + x.w + x.pre, 0) + SP * 0.6;
  if (!M.slots.length) nat = 11 * SP;
  if ((score.measures[M.i] || {}).repeatEnd) nat += 1.6 * SP;
  return Math.max(nat, 8 * SP);
}
function layout() {
  const sys = [];
  let cur = null;
  B.meas.forEach(M => {
    M.nat = measureNat(M);
    if (cur) {
      const pi = prefixInfo(M.i, false);
      if (cur.w + pi.w + M.nat > W) cur = null;
    }
    if (!cur) { cur = { ms: [], w: 0 }; sys.push(cur); }
    M.pre = prefixInfo(M.i, cur.ms.length === 0);
    cur.ms.push(M); cur.w += M.pre.w + M.nat;
  });
  sys.forEach((S, si) => {
    const fixed = S.ms.reduce((s, M) => s + M.pre.w, 0), flex = S.ms.reduce((s, M) => s + M.nat, 0);
    let sc = (W - fixed) / flex;
    if (si === sys.length - 1 && sys.length > 1 && (fixed + flex) / W < 0.7) sc = 1;
    S.sc = sc;
    let x = 0;
    S.ms.forEach(M => {
      M.sys = si; M.x0 = x; M.px = x + M.pre.w;
      let cx = M.px + SP * 1.0 * sc;
      const mapX = {};
      M.slots.forEach(sl => { cx += sl.pre; sl.x = cx; mapX[sl.on] = cx; cx += sl.w * sc; });
      M.x1 = M.x0 + M.pre.w + M.nat * sc + 0; // nat already includes pads
      x = M.x1;
      for (const v of [0, 1]) for (const p of M.pieces[v]) {
        p.sys = si;
        p.x = p.mrest ? (M.px + M.x1) / 2 - 0.85 * SP : mapX[p.on] + (p.shift || 0);
      }
    });
    S.width = x;
  });
  return sys;
}

// geometry: stem directions, stems, beams
function beatUnit(M) {
  const t = attrAt(M.i, 'time');
  if (t[1] === 8 && t[0] % 3 === 0) return 720;
  if (t[1] === 2) return 960;
  if (t[1] === 8) return 480;
  return 480;
}
const headW = p => p.d >= 1920 ? 1.69 * SP : 1.18 * SP;
function geometry(S) {
  let minY = -4.5 * SP, maxY = 8 * SP;
  for (const M of S.ms) {
    const two = M.pieces[1].length > 0;
    const unit = beatUnit(M);
    M.beams = [];
    for (const v of [0, 1]) {
      const ps = M.pieces[v];
      // beam groups
      let g = [];
      const flush = () => { if (g.length > 1) M.beams.push({ v, ps: g }); g = []; };
      for (const p of ps) {
        const can = !p.e.r && p.d <= 240;
        if (!can) { flush(); continue; }
        if (g.length && Math.floor(g[0].on / unit) !== Math.floor(p.on / unit)) flush();
        g.push(p);
      }
      flush();
      for (const p of ps) {
        p.hw = headW(p);
        p.y = p.e.r ? 0 : yOf(p.pos);
        p.dir = two ? (v === 0 ? -1 : 1) : (p.pos >= 4 ? 1 : -1);
      }
    }
    for (const bm of M.beams) {
      const avg = bm.ps.reduce((s, p) => s + p.pos, 0) / bm.ps.length;
      const dir = two ? (bm.v === 0 ? -1 : 1) : (avg >= 4 ? 1 : -1);
      bm.dir = dir;
      bm.ps.forEach(p => { p.dir = dir; p.beam = bm; });
    }
    // stems
    for (const v of [0, 1]) for (const p of M.pieces[v]) {
      if (p.e.r || p.d >= 1920) continue;
      p.sx = p.dir < 0 ? p.x + p.hw - 0.55 : p.x + 0.55;
      let len = 3.5 * SP + (p.d === 120 && !p.beam ? 0.4 * SP : 0) + (p.d === 60 && !p.beam ? 1.1 * SP : 0);
      let end = p.y + p.dir * -1 * -len; // placeholder replaced below
      end = p.dir < 0 ? p.y - len : p.y + len;
      if (!two) {
        if (p.dir < 0 && end > yOf(4)) end = yOf(4);
        if (p.dir > 0 && end < yOf(4)) end = yOf(4);
      }
      p.se = end;
    }
    for (const bm of M.beams) {
      const a = bm.ps[0], z = bm.ps[bm.ps.length - 1];
      let y1 = a.se, y2 = z.se;
      const lim = 1.0 * SP;
      if (y2 - y1 > lim) y2 = y1 + lim; if (y1 - y2 > lim) y2 = y1 - lim;
      const f = x => (z.sx === a.sx ? y1 : y1 + (x - a.sx) * (y2 - y1) / (z.sx - a.sx));
      const minLen = 2.9 * SP + (bm.ps.some(p => p.d <= 120) ? 0.6 * SP : 0);
      let shift = 0;
      for (const p of bm.ps) {
        if (bm.dir < 0) shift = Math.max(shift, f(p.sx) - (p.y - minLen));
        else shift = Math.min(shift, f(p.sx) - (p.y + minLen));
      }
      bm.y1 = y1 - shift; bm.y2 = y2 - shift; bm.x1 = a.sx; bm.x2 = z.sx;
      bm.f = x => (bm.x2 === bm.x1 ? bm.y1 : bm.y1 + (x - bm.x1) * (bm.y2 - bm.y1) / (bm.x2 - bm.x1));
      for (const p of bm.ps) p.se = bm.f(p.sx);
    }
    for (const v of [0, 1]) for (const p of M.pieces[v]) {
      if (p.e.r) continue;
      const ys = [p.y, p.se == null ? p.y : p.se];
      minY = Math.min(minY, Math.min(...ys) - 1.4 * SP);
      maxY = Math.max(maxY, Math.max(...ys) + 1.4 * SP);
    }
  }
  S.topY = minY;
  S.endY = Math.min(-2.6 * SP, minY + 0.3 * SP);
  S.dynY = Math.max(4 * SP + 3.6 * SP, maxY + 1.6 * SP);
  S.botY = S.dynY + 1.6 * SP;
  if (S.ms.some(M => (score.measures[M.i] || {}).ending)) S.topY = Math.min(S.topY, S.endY - 2 * SP);
}

// ---------------------------------------------------------------- drawing
const f1 = n => Math.round(n * 10) / 10;
const gl = (x, y, g, cls = 'm', extra = '') => `<text class="${cls}" x="${f1(x)}" y="${f1(y)}"${extra}>${g}</text>`;
const snap = v => Math.round(v) + 0.5;
const ln = (x1, y1, x2, y2, cls) => {
  if (x1 === x2) x1 = x2 = snap(x1);
  if (y1 === y2) y1 = y2 = snap(y1);
  return `<line class="${cls}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`;
};
const rect = (x, y, w, h, cls = 'ink') => `<rect class="${cls}" x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}"/>`;
const timeGl = n => String(n).split('').map(c => String.fromCharCode(0xE080 + +c)).join('');

function drawKey(key, x, o, naturalsOf) {
  const adj = score.clef === 'bass' ? -2 : 0;
  const n = Math.abs(naturalsOf != null ? naturalsOf : key), sh = (naturalsOf != null ? naturalsOf : key) > 0;
  const pos = sh ? SHARP_POS : FLAT_POS;
  for (let i = 0; i < n; i++) o.push(gl(x + i * SP, yOf(pos[i] + adj), naturalsOf != null ? GL.nat : sh ? GL.sharp : GL.flat));
}
function drawPrefix(M, o) {
  const P = M.pre, a = score.measures[M.i] || {};
  let x;
  if (P.first) {
    o.push(score.clef === 'bass' ? gl(M.x0 + 0.4 * SP, SP, GL.fClef) : gl(M.x0 + 0.4 * SP, 3 * SP, GL.gClef));
    x = M.x0 + 3.6 * SP;
    if (P.key) { drawKey(P.key, x, o); x += Math.abs(P.key) * SP + 0.5 * SP; }
  } else {
    x = M.x0 + 0.8 * SP;
    if (P.keyCh) {
      if (P.key) drawKey(P.key, x, o); else drawKey(0, x, o, P.pk);
      x += (P.key ? Math.abs(P.key) : Math.abs(P.pk)) * SP + 0.4 * SP;
    }
  }
  if (P.timeCh) {
    const tw = tsW(P.time), cx = x + tw / 2;
    o.push(gl(cx, SP, timeGl(P.time[0]), 'm', ' text-anchor="middle"'));
    o.push(gl(cx, 3 * SP, timeGl(P.time[1]), 'm', ' text-anchor="middle"'));
  }
  if (a.repeatStart) {
    const xs = M.px - 1.6 * SP;
    o.push(rect(xs, 0, 0.5 * SP, 4 * SP));
    o.push(ln(xs + 0.85 * SP, 0, xs + 0.85 * SP, 4 * SP, 'bl'));
    o.push(`<circle class="ink" cx="${f1(xs + 1.35 * SP)}" cy="${f1(1.5 * SP)}" r="${f1(0.22 * SP)}"/><circle class="ink" cx="${f1(xs + 1.35 * SP)}" cy="${f1(2.5 * SP)}" r="${f1(0.22 * SP)}"/>`);
  }
}
function drawBarline(M, o, isLast) {
  const a = score.measures[M.i] || {}, x = M.x1;
  if (a.repeatEnd) {
    o.push(`<circle class="ink" cx="${f1(x - 1.5 * SP)}" cy="${f1(1.5 * SP)}" r="${f1(0.22 * SP)}"/><circle class="ink" cx="${f1(x - 1.5 * SP)}" cy="${f1(2.5 * SP)}" r="${f1(0.22 * SP)}"/>`);
    o.push(ln(x - 0.95 * SP, 0, x - 0.95 * SP, 4 * SP, 'bl'));
    o.push(rect(x - 0.5 * SP, 0, 0.5 * SP, 4 * SP));
  } else if (isLast) {
    o.push(ln(x - 0.95 * SP, 0, x - 0.95 * SP, 4 * SP, 'bl'));
    o.push(rect(x - 0.5 * SP, 0, 0.5 * SP, 4 * SP));
  } else o.push(ln(x, 0, x, 4 * SP, 'bl'));
}
function restGlyph(p) {
  if (p.mrest) return GL.rWhole;
  return { 1920: GL.rWhole, 960: GL.rHalf, 480: GL.rQ, 240: GL.r8, 120: GL.r16, 60: GL.r32 }[p.d];
}
function drawPiece(p, M, two, o) {
  const cls = ['ev', 'v' + (p.v + 1)];
  if (p.ghost) cls.push('ghost');
  if (!p.ghost && p.v === sel.v && p.idx === sel.i) cls.push('sel');
  const attrs = p.ghost ? '' : ` data-k="${p.v}-${p.idx}"`;
  const g = [];
  if (p.e.r) {
    let y = (p.d >= 1920 || p.mrest) ? SP : 2 * SP;
    if (two) y += p.v === 0 ? -2 * SP : 2 * SP;
    g.push(gl(p.x, y, restGlyph(p)));
    if (p.dot) g.push(gl(p.x + 2.0 * SP, 1.5 * SP, GL.dot));
    // invisible hit area
    if (!p.ghost) g.push(`<rect x="${f1(p.x - 2)}" y="${f1(y - 2.5 * SP)}" width="${f1(1.6 * SP + 4)}" height="${f1(4 * SP)}" fill="transparent"/>`);
  } else {
    const x = p.x, y = p.y, hw = p.hw;
    for (let q = -2; q >= p.pos; q -= 2) g.push(ln(x - 0.45 * SP, yOf(q), x + hw + 0.45 * SP, yOf(q), 'ledger'));
    for (let q = 10; q <= p.pos; q += 2) g.push(ln(x - 0.45 * SP, yOf(q), x + hw + 0.45 * SP, yOf(q), 'ledger'));
    if (p.acc != null) g.push(gl(x - 1.25 * SP, y, ACC_GL[p.acc]));
    g.push(gl(x, y, p.d >= 1920 ? GL.whole : p.d === 960 ? GL.half : GL.black));
    if (p.se != null) {
      g.push(ln(p.sx, y + (p.dir < 0 ? -0.2 * SP : 0.2 * SP), p.sx, p.se, 'stem'));
      if (!p.beam && p.d <= 240) {
        const fl = p.dir < 0 ? { 240: GL.f8u, 120: GL.f16u, 60: GL.f32u } : { 240: GL.f8d, 120: GL.f16d, 60: GL.f32d };
        g.push(gl(p.sx - 0.55, p.se, fl[p.d]));
      }
    }
    if (p.dot) {
      const dy = p.pos % 2 === 0 ? yOf(p.pos + 1) : y;
      g.push(gl(x + hw + 0.35 * SP + (p.dir < 0 && p.d <= 240 && !p.beam ? 0.9 * SP : 0), dy, GL.dot));
    }
    g.push(`<rect x="${f1(x - 3)}" y="${f1(y - SP)}" width="${f1(hw + 6)}" height="${f1(2 * SP)}" fill="transparent"/>`);
  }
  o.push(`<g class="${cls.join(' ')}"${attrs}>${g.join('')}</g>`);
}
function drawBeam(bm, o) {
  const th = 0.5 * SP, cls = 'beam v' + (bm.v + 1);
  const quad = (xa, xb, off) => {
    const ya = bm.f(xa) + off, yb = bm.f(xb) + off;
    const t = bm.dir < 0 ? th : -th;
    return `<polygon class="${cls}" points="${f1(xa)},${f1(ya)} ${f1(xb)},${f1(yb)} ${f1(xb)},${f1(yb + t)} ${f1(xa)},${f1(ya + t)}"/>`;
  };
  o.push(quad(bm.x1 - 0.5, bm.x2 + 0.5, 0));
  for (const [lvl, lim] of [[1, 120], [2, 60]]) {
    const off = (bm.dir < 0 ? 1 : -1) * lvl * 0.75 * SP;
    const ps = bm.ps;
    for (let k = 0; k < ps.length; k++) {
      if (ps[k].d > lim) continue;
      const nxt = ps[k + 1] && ps[k + 1].d <= lim, prv = ps[k - 1] && ps[k - 1].d <= lim;
      if (nxt) o.push(quad(ps[k].sx - 0.5, ps[k + 1].sx + 0.5, off));
      else if (!prv) {
        const stub = 1.1 * SP;
        if (k === ps.length - 1) o.push(quad(ps[k].sx - stub, ps[k].sx + 0.5, off));
        else o.push(quad(ps[k].sx - 0.5, ps[k].sx + stub, off));
      }
    }
  }
}
function tieShape(x1, x2, y, down, cls) {
  const sgn = down ? 1 : -1;
  const h = Math.min(1.5 * SP, 0.5 * SP + (x2 - x1) * 0.07) * sgn;
  const mx = (x1 + x2) / 2;
  return `<path class="tie ${cls}" d="M${f1(x1)},${f1(y)} Q${f1(mx)},${f1(y + 2 * h)} ${f1(x2)},${f1(y)} Q${f1(mx)},${f1(y + 2 * h - 0.32 * SP * sgn)} ${f1(x1)},${f1(y)}Z"/>`;
}
function drawSystem(S, si) {
  const o = [];
  const lastM = B.meas.length - 1;
  // hit areas for bars
  for (const M of S.ms) o.push(`<rect class="hit" data-m="${M.i}" x="${f1(M.x0)}" y="${f1(-2 * SP)}" width="${f1(M.x1 - M.x0)}" height="${f1(8 * SP)}"/>`);
  for (let k = 0; k < 5; k++) o.push(ln(0, k * SP, S.width, k * SP, 'sl'));
  if (si > 0) o.push(`<text class="mnum" x="0" y="${f1(-1.3 * SP)}">${S.ms[0].i + 1}</text>`);
  for (const M of S.ms) {
    const two = M.pieces[1].length > 0;
    drawPrefix(M, o);
    for (const v of [0, 1]) for (const p of M.pieces[v]) drawPiece(p, M, two, o);
    for (const bm of M.beams) drawBeam(bm, o);
    drawBarline(M, o, M.i === lastM);
    // endings
    const a = score.measures[M.i] || {};
    if (a.ending) {
      const prevSame = M !== S.ms[0] && (score.measures[M.i - 1] || {}).ending === a.ending;
      const nextSame = M !== S.ms[S.ms.length - 1] && (score.measures[M.i + 1] || {}).ending === a.ending;
      const y = S.endY, xa = M.x0 + (prevSame ? 0 : 0.3 * SP), xb = M.x1 - (nextSame ? 0 : 0.4 * SP);
      o.push(ln(xa, y, xb, y, 'bl'));
      if (!prevSame) { o.push(ln(xa, y, xa, y + 1.6 * SP, 'bl')); o.push(`<text class="endtxt" x="${f1(xa + 0.5 * SP)}" y="${f1(y + 1.45 * SP)}">${a.ending}.</text>`); }
      if (!nextSame && a.repeatEnd) o.push(ln(xb, y, xb, y + 1.6 * SP, 'bl'));
    }
  }
  // ties and dynamics
  for (const v of [0, 1]) {
    const seq = B.seq[v];
    for (let k = 0; k < seq.length; k++) {
      const p = seq[k], q = seq[k + 1];
      const cls = 'v' + (v + 1);
      if (p.tie && q && q.tieIn) {
        const down = p.dir < 0;
        const yOff = down ? 0.6 * SP : -0.6 * SP;
        if (p.sys === si && q.sys === si) o.push(tieShape(p.x + p.hw + 0.15 * SP, q.x - 0.15 * SP, p.y + yOff, down, cls));
        else if (p.sys === si) o.push(tieShape(p.x + p.hw + 0.15 * SP, S.width - 0.3 * SP, p.y + yOff, down, cls));
        else if (q.sys === si) { const M = B.meas[q.m]; o.push(tieShape(M.px - 0.4 * SP, q.x - 0.15 * SP, q.y + (q.dir < 0 ? 0.6 : -0.6) * SP, q.dir < 0, cls)); }
      }
      if (p.sys !== si || !p.first) continue;
      if (p.e.dyn) o.push(gl(p.x - 0.2 * SP, S.dynY, p.e.dyn.split('').map(c => DYN_GL[c]).join(''), 'md'));
      if (p.e.hp) {
        const vs = score.voices[v];
        let j = -1, atDyn = false;
        for (let t = p.idx + 1; t < Math.min(vs.length, p.idx + 14); t++) if (vs[t].dyn) { j = t; atDyn = true; break; }
        if (j < 0) j = Math.min(vs.length - 1, p.idx + 3);
        const tp = B.byKey[v + '-' + j];
        let x2;
        if (!tp) x2 = p.x + 6 * SP;
        else { const tq = atDyn ? tp[0] : tp[tp.length - 1]; x2 = tq.sys !== si ? S.width - SP : atDyn ? tq.x - 0.8 * SP : tq.x + (tq.hw || SP) + 0.5 * SP; }
        const x1 = p.x + (p.e.dyn ? p.e.dyn.length * 1.1 * SP + 0.6 * SP : 0);
        if (x2 < x1 + 2 * SP) x2 = x1 + 2 * SP;
        const yc = S.dynY - 0.45 * SP, hh = 0.55 * SP;
        const d = p.e.hp === '<'
          ? `M${f1(x2)},${f1(yc - hh)} L${f1(x1)},${f1(yc)} L${f1(x2)},${f1(yc + hh)}`
          : `M${f1(x1)},${f1(yc - hh)} L${f1(x2)},${f1(yc)} L${f1(x1)},${f1(yc + hh)}`;
        o.push(`<path class="hairpin" d="${d}"/>`);
      }
    }
  }
  // caret: where the next note goes
  if (!playing) {
    const parts = sel.i >= 0 ? B.byKey[sel.v + '-' + sel.i] : null;
    let cx = null;
    if (parts) { const p = parts[parts.length - 1]; if (p.sys === si) cx = p.x + (p.hw || 1.4 * SP) + (p.dot ? 1.0 * SP : 0) + 0.6 * SP; }
    else if (sel.i < 0 && si === 0) cx = B.meas[0].px + 0.3 * SP;
    if (cx != null) o.push(`<line class="caret v${sel.v + 1}" x1="${f1(cx)}" y1="${f1(-1.2 * SP)}" x2="${f1(cx)}" y2="${f1(5.2 * SP)}"/>`);
  }
  const h = S.botY - S.topY;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 4}" height="${f1(h)}" viewBox="-2 ${f1(S.topY)} ${W + 4} ${f1(h)}">${o.join('')}</svg>`;
}

function render() {
  B = build();
  SYS = layout();
  SYS.forEach(geometry);
  $('#systems').innerHTML = SYS.map(drawSystem).join('');
  updateUI();
}

// ---------------------------------------------------------------- header, texts, toolbar state
function renderHeader() {
  for (const el of $$('#head [data-f]')) if (document.activeElement !== el) el.textContent = score[el.dataset.f] || '';
  $('#tempoMark').innerHTML = `<span class="mg">&#xE1D5;</span> = ${score.tempo}`;
  $('#tempo').value = score.tempo;
  $('#clefSel').value = score.clef;
}
function renderTexts() {
  const layer = $('#texts');
  layer.innerHTML = '';
  score.texts.forEach(tb => {
    const el = document.createElement('div');
    el.className = 'tbox';
    Object.assign(el.style, { left: tb.x + 'px', top: tb.y + 'px', width: tb.w + 'px', height: tb.h + 'px' });
    el.innerHTML = `<div class="tb-bar"><span class="grip" title="Drag to move">&#x2807; move</span><button data-a="-">A&minus;</button><button data-a="+">A+</button><button data-a="b" title="Bold">B</button><button data-a="x" title="Delete">&times;</button></div><div class="tb-body" contenteditable="true" spellcheck="false"></div>`;
    const body = el.querySelector('.tb-body');
    body.innerText = tb.text;
    body.style.fontSize = tb.size + 'px';
    body.style.fontWeight = tb.bold ? '700' : '400';
    body.addEventListener('focus', () => snapshot());
    body.addEventListener('input', () => { tb.text = body.innerText; save(); });
    el.querySelector('.tb-bar').addEventListener('click', ev => {
      const a = ev.target.dataset && ev.target.dataset.a; if (!a) return;
      snapshot();
      if (a === '-') tb.size = Math.max(8, tb.size - 2);
      if (a === '+') tb.size = Math.min(96, tb.size + 2);
      if (a === 'b') tb.bold = !tb.bold;
      if (a === 'x') score.texts = score.texts.filter(t => t !== tb);
      save(); renderTexts();
    });
    const grip = el.querySelector('.grip');
    grip.addEventListener('pointerdown', ev => {
      ev.preventDefault(); snapshot();
      const sx = ev.clientX, sy = ev.clientY, ox = tb.x, oy = tb.y;
      grip.setPointerCapture(ev.pointerId);
      const mv = e2 => { tb.x = Math.round(ox + e2.clientX - sx); tb.y = Math.round(oy + e2.clientY - sy); el.style.left = tb.x + 'px'; el.style.top = tb.y + 'px'; };
      const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); save(); };
      grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up);
    });
    let first = true;
    new ResizeObserver(() => {
      if (first) { first = false; return; }
      tb.w = el.offsetWidth; tb.h = el.offsetHeight; save();
    }).observe(el);
    layer.appendChild(el);
  });
}
function targetMeasure() {
  if (sel.i < 0) return 0;
  const parts = B.byKey[sel.v + '-' + sel.i];
  if (!parts) return 0;
  if (sel.mode === 'pick') return parts[0].m;
  return tickToMeasure(ticksBefore(sel.v, sel.i + 1));
}
function updateUI() {
  const e = sel.i >= 0 ? score.voices[sel.v][sel.i] : null;
  $$('[data-cmd="voice"]').forEach(b => b.classList.toggle('on', +b.dataset.v === sel.v));
  $$('[data-cmd="dur"]').forEach(b => b.classList.toggle('on', +b.dataset.d === inputDur));
  $('#dotBtn').classList.toggle('on', e ? !!e.dot : !!inputDot);
  $('#tieBtn').classList.toggle('on', !!(e && e.tie));
  $$('[data-cmd="dyn"]').forEach(b => b.classList.toggle('on', !!(e && e.dyn === b.dataset.y)));
  $$('[data-cmd="hp"]').forEach(b => b.classList.toggle('on', !!(e && e.hp === b.dataset.h)));
  const m = targetMeasure(), a = score.measures[m] || {};
  $('#measLbl').textContent = 'Bar ' + (m + 1);
  const t = attrAt(m, 'time');
  $('#timeSel').value = t.join('/');
  if ($('#timeSel').value !== t.join('/')) {
    const op = document.createElement('option'); op.textContent = t.join('/'); $('#timeSel').appendChild(op); $('#timeSel').value = t.join('/');
  }
  $('#keySel').value = String(attrAt(m, 'key'));
  $$('[data-cmd="rep"]').forEach(b => b.classList.toggle('on', !!a[b.dataset.r]));
  $$('[data-cmd="ending"]').forEach(b => b.classList.toggle('on', a.ending === +b.dataset.n));
  const vc = sel.v ? '<b class="v2c">Voice 2</b>' : '<b>Voice 1</b>';
  const what = e ? `Selected: <b>${noteName(e)}</b>, ${durName(e)}${e.dyn ? ', ' + e.dyn : ''}` : 'Cursor at the start';
  $('#status').innerHTML = `<span>${vc}</span><span>Bar ${m + 1}</span><span>${what}</span><span>Next note: ${DUR_NAME[inputDur]}${inputDot ? ', dotted' : ''}</span><span style="margin-left:auto;opacity:.7">Type A to G to write. Press Keys for the full list.</span>`;
}

// ---------------------------------------------------------------- persistence + undo
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(score)); } catch (_) {} }, 250);
}
function snapshot() {
  undoStack.push(JSON.stringify(score));
  if (undoStack.length > 300) undoStack.shift();
  redoStack = [];
}
function restore(json) { score = JSON.parse(json); fixSel(); renderAll(); save(); }
function undo() { if (!undoStack.length) return toast('Nothing to undo'); redoStack.push(JSON.stringify(score)); restore(undoStack.pop()); }
function redo() { if (!redoStack.length) return toast('Nothing to redo'); undoStack.push(JSON.stringify(score)); restore(redoStack.pop()); }
function fixSel() { sel.i = Math.min(sel.i, score.voices[sel.v].length - 1); }
function change(fn) { snapshot(); fn(); render(); save(); }
function renderAll() { renderHeader(); renderTexts(); render(); }
function valid(s) { return s && Array.isArray(s.voices) && s.voices.length === 2 && s.measures && typeof s.measures === 'object'; }
function normalize(s) {
  const d = newScore();
  const out = Object.assign(d, s);
  if (!out.measures[0]) out.measures[0] = { time: [4, 4], key: 0 };
  out.texts = Array.isArray(out.texts) ? out.texts : [];
  return out;
}

// ---------------------------------------------------------------- editing
function nearestOct(v, at, s) {
  const vs = score.voices[v];
  let ref = null;
  for (let j = at - 1; j >= 0; j--) if (!vs[j].r) { ref = vs[j].o * 7 + vs[j].s; break; }
  if (ref == null) {
    const ov = score.voices[1 - v];
    const pt = ticksBefore(v, at);
    let acc = 0;
    for (const e of ov) { if (acc > pt) break; if (!e.r) ref = e.o * 7 + e.s; acc += evTicks(e); }
  }
  if (ref == null) ref = score.clef === 'bass' ? 22 : 34;
  return Math.max(1, Math.min(7, Math.round((ref - s) / 7)));
}
function consumeRests(vs, at, need) {
  while (need > 0 && vs[at] && vs[at].r) {
    const rt = evTicks(vs[at]);
    if (rt <= need) { vs.splice(at, 1); need -= rt; }
    else { vs.splice(at, 1, ...decompose(rt - need).map(t => Object.assign({ r: true }, toType(t)))); need = 0; }
  }
}
function insertEvent(e) {
  const vs = score.voices[sel.v];
  const cur = vs[sel.i];
  const at = cur && cur.r && sel.mode === 'pick' ? sel.i : sel.i + 1;
  vs.splice(at, 0, e);
  consumeRests(vs, at + 1, evTicks(e));
  sel.i = at; sel.mode = 'insert';
  inputDot = 0;
}
function enterNote(s) {
  snapshot();
  const vs = score.voices[sel.v];
  const cur = vs[sel.i];
  const at = cur && cur.r && sel.mode === 'pick' ? sel.i : sel.i + 1;
  const m = tickToMeasure(ticksBefore(sel.v, at));
  const e = { s, o: nearestOct(sel.v, at, s), a: keyAlter(attrAt(m, 'key'), s), d: inputDur, dot: inputDot };
  insertEvent(e);
  preview(e);
  render(); save();
}
function enterRest() { change(() => insertEvent({ r: true, d: inputDur, dot: inputDot })); }
function selected() { return sel.i >= 0 ? score.voices[sel.v][sel.i] : null; }
function editSel(fn, needNote = true) {
  const e = selected();
  if (!e || (needNote && e.r)) return toast(needNote ? 'Select a note first' : 'Select a note or rest first');
  change(() => fn(e));
}
function halfStep(dir) {
  editSel(e => { const sp = spell(Math.max(12, Math.min(119, midiOf(e) + dir)), dir > 0); Object.assign(e, sp); preview(e); });
}
function octave(dir) {
  editSel(e => { e.o = Math.max(1, Math.min(7, e.o + dir)); preview(e); });
}
function setAcc(a) {
  editSel(e => { e.a = (a !== 0 && e.a === a) ? 0 : a; preview(e); });
}
function setDur(d) {
  const e = selected();
  inputDur = d;
  if (e && sel.mode === 'pick') change(() => { e.d = d; });
  else updateUI();
}
function stepDur(dir) {
  const ladder = [60, 120, 240, 480, 960, 1920];
  const e = selected();
  if (!e) { inputDur = ladder[Math.max(0, Math.min(5, ladder.indexOf(inputDur) + dir))]; updateUI(); return; }
  change(() => { e.d = ladder[Math.max(0, Math.min(5, ladder.indexOf(e.d) + dir))]; inputDur = e.d; });
}
function toggleDot() {
  const e = selected();
  if (!e) { inputDot = inputDot ? 0 : 1; updateUI(); return; }
  change(() => { e.dot = e.dot ? 0 : 1; });
}
function moveSel(dir) {
  const n = score.voices[sel.v].length;
  sel.i = Math.max(-1, Math.min(n - 1, sel.i + dir));
  sel.mode = sel.i >= 0 ? 'pick' : 'insert';
  const e = selected(); if (e) { inputDur = e.d; if (!e.r) preview(e); }
  render();
}
function deleteSel() {
  if (sel.i < 0) return;
  change(() => { score.voices[sel.v].splice(sel.i, 1); sel.i--; sel.mode = 'insert'; });
}
function setVoice(v) {
  if (v === sel.v) return;
  let T = 0;
  if (sel.i >= 0) { const parts = B.byKey[sel.v + '-' + sel.i]; T = parts ? B.meas[parts[0].m].start : 0; }
  const vs = score.voices[v];
  let tot = voiceTicks(v);
  if (tot < T) {
    snapshot();
    while (tot < T) {
      const m = tickToMeasure(tot), ms = measureStart(m), end = Math.min(ms + mLen(m), T);
      for (const t of decompose(end - tot)) vs.push(Object.assign({ r: true }, toType(t)));
      tot = end;
    }
    save();
  }
  let acc = 0, idx = -1;
  for (let j = 0; j < vs.length; j++) { if (acc + evTicks(vs[j]) > T) break; acc += evTicks(vs[j]); idx = j; }
  sel = { v, i: idx, mode: 'insert' };
  render();
}
function clickMeasure(m) {
  const M = B.meas[m];
  const vs = score.voices[sel.v];
  const ps = M.pieces[sel.v].filter(p => !p.ghost);
  if (ps.length) { sel.i = ps[ps.length - 1].idx; sel.mode = 'insert'; render(); return; }
  if (voiceTicks(sel.v) <= M.start) {
    if (sel.v === 1 || voiceTicks(sel.v) < M.start) {
      snapshot();
      let tot = voiceTicks(sel.v);
      while (tot < M.start) {
        const mm = tickToMeasure(tot), end = Math.min(measureStart(mm) + mLen(mm), M.start);
        for (const t of decompose(end - tot)) vs.push(Object.assign({ r: true }, toType(t)));
        tot = end;
      }
      save();
    }
    sel.i = vs.length - 1; sel.mode = 'insert';
  }
  render();
}
function setMeasureAttr(k, val) {
  change(() => {
    const m = targetMeasure();
    const a = score.measures[m] || (score.measures[m] = {});
    if (val === undefined) delete a[k]; else a[k] = val;
    if ((k === 'time' || k === 'key') && m > 0) {
      const prev = attrAt(m - 1, k);
      if (JSON.stringify(prev) === JSON.stringify(val)) delete a[k];
    }
    if (m > 0 && !Object.keys(a).length) delete score.measures[m];
  });
}

// ---------------------------------------------------------------- audio
let actx = null, master = null, playing = null;
function ensureAudio() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = actx.createDynamicsCompressor();
    master = actx.createGain(); master.gain.value = 0.8;
    master.connect(comp); comp.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(midi, when, dur, vel, dest) {
  const c = actx, f = 440 * Math.pow(2, (midi - 69) / 12);
  const g = c.createGain(); g.connect(dest || master);
  const o1 = c.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
  const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
  const g2 = c.createGain(); g2.gain.value = 0.18; o2.connect(g2); g2.connect(g); o1.connect(g);
  const v = vel * 0.32, end = when + Math.max(0.06, dur);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(v, when + 0.012);
  g.gain.setTargetAtTime(v * 0.45, when + 0.012, 0.3);
  g.gain.setTargetAtTime(0, end, 0.05);
  o1.start(when); o2.start(when); o1.stop(end + 0.4); o2.stop(end + 0.4);
}
function preview(e) {
  if (!e || e.r) return;
  try { ensureAudio(); tone(midiOf(e), actx.currentTime + 0.01, 0.35, 0.6); } catch (_) {}
}
function playOrder(N) {
  const out = []; let i = 0, start = 0, pass = 1, guard = 0; const done = {};
  while (i < N && guard++ < 20000) {
    const a = score.measures[i] || {};
    if (a.repeatStart && !(pass > 1 && start === i)) { start = i; pass = 1; }
    if (a.ending && a.ending !== pass) { i++; continue; }
    out.push(i);
    if (a.repeatEnd && !done[i]) { done[i] = true; pass++; i = start; continue; }
    if (a.repeatEnd) { start = i + 1; pass = 1; }
    i++;
  }
  return out;
}
function play() {
  if (playing) return stopPlay();
  ensureAudio();
  render();
  const order = playOrder(B.meas.length);
  let k0 = 0;
  if (sel.i >= 0) { const parts = B.byKey[sel.v + '-' + sel.i]; if (parts) { const m = sel.mode === 'pick' ? parts[0].m : parts[0].m; k0 = Math.max(0, order.indexOf(m)); } }
  const spt = 60 / (score.tempo * 480), t0 = actx.currentTime + 0.12;
  const bus = actx.createGain(); bus.connect(master);
  const notes = [], marks = [], lastN = [null, null], dyn = [0.62, 0.62];
  let tick = 0;
  for (let k = k0; k < order.length; k++) {
    const M = B.meas[order[k]];
    for (const v of [0, 1]) for (const p of M.pieces[v]) {
      if (p.first && p.e.dyn) { dyn[v] = DYN_LEVEL[p.e.dyn]; if (v === 0 && !score.voices[1].some(e => e.dyn)) dyn[1] = dyn[0]; }
      const at = tick + p.on;
      if (!p.ghost) marks.push({ at, k: p.v + '-' + p.idx });
      if (p.e.r) { lastN[v] = null; continue; }
      let n;
      if (p.tieIn && lastN[v]) { n = lastN[v]; n.dur += p.t; }
      else { n = { midi: midiOf(p.e), at, dur: p.t, vel: dyn[v] }; notes.push(n); }
      lastN[v] = p.tie ? n : null;
    }
    tick += M.len;
  }
  notes.forEach(n => tone(n.midi, t0 + n.at * spt, n.dur * spt * 0.96, n.vel, bus));
  const lead = (t0 - actx.currentTime) * 1000;
  const timers = marks.map(mk => setTimeout(() => highlight(mk.k), lead + mk.at * spt * 1000));
  timers.push(setTimeout(stopPlay, lead + tick * spt * 1000 + 250));
  playing = { bus, timers };
  $('#playBtn').innerHTML = '&#9632; Stop';
  render();
}
function highlight(k) {
  $$('.ev.playing').forEach(el => el.classList.remove('playing'));
  const els = $$(`[data-k="${k}"]`);
  els.forEach(el => el.classList.add('playing'));
  if (els[0]) els[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function stopPlay() {
  if (!playing) return;
  playing.timers.forEach(clearTimeout);
  try { playing.bus.gain.setTargetAtTime(0, actx.currentTime, 0.03); setTimeout(() => playing && 0, 0); } catch (_) {}
  const bus = playing.bus; setTimeout(() => bus.disconnect(), 400);
  playing = null;
  $('#playBtn').innerHTML = '&#9654; Play';
  render();
}

// ---------------------------------------------------------------- export / import / share
const slug = s => (s || 'score').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'score';
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function saveFile() { download(slug(score.title) + '.json', JSON.stringify(score, null, 1), 'application/json'); toast('Saved ' + slug(score.title) + '.json'); }
function toMusicXML() {
  const BB = build();
  const esc = s => String(s == null ? '' : s).replace(/[<&>"]/g, c => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;', '"': '&quot;' }[c]));
  const hpStop = {};
  for (const v of [0, 1]) score.voices[v].forEach((e, i) => {
    if (!e.hp) return;
    const vs = score.voices[v];
    let j = -1;
    for (let t = i + 1; t < Math.min(vs.length, i + 14); t++) if (vs[t].dyn) { j = t; break; }
    if (j < 0) j = Math.min(vs.length - 1, i + 3);
    hpStop[v + '-' + j] = true;
  });
  let x = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n<score-partwise version="4.0">\n';
  x += `<work><work-title>${esc(score.title)}</work-title></work>\n<identification><creator type="composer">${esc(score.composer)}</creator><encoding><software>Score Sketch</software></encoding></identification>\n`;
  if (score.subtitle) x += `<credit page="1"><credit-type>subtitle</credit-type><credit-words>${esc(score.subtitle)}</credit-words></credit>\n`;
  x += '<part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>\n<part id="P1">\n';
  const lastI = BB.meas.length - 1;
  BB.meas.forEach(M => {
    const a = score.measures[M.i] || {};
    const prevEnd = (score.measures[M.i - 1] || {}).ending, nextEnd = (score.measures[M.i + 1] || {}).ending;
    x += `<measure number="${M.i + 1}">\n`;
    if (a.repeatStart || (a.ending && prevEnd !== a.ending)) {
      x += '<barline location="left">' + (a.repeatStart ? '<bar-style>heavy-light</bar-style>' : '') +
        (a.ending && prevEnd !== a.ending ? `<ending number="${a.ending}" type="start">${a.ending}.</ending>` : '') +
        (a.repeatStart ? '<repeat direction="forward"/>' : '') + '</barline>\n';
    }
    const key = attrAt(M.i, 'key'), time = attrAt(M.i, 'time');
    const keyCh = M.i === 0 || attrAt(M.i - 1, 'key') !== key;
    const timeCh = M.i === 0 || attrAt(M.i - 1, 'time').join() !== time.join();
    if (keyCh || timeCh) {
      x += '<attributes>' + (M.i === 0 ? '<divisions>480</divisions>' : '') +
        (keyCh ? `<key><fifths>${key}</fifths></key>` : '') +
        (timeCh ? `<time><beats>${time[0]}</beats><beat-type>${time[1]}</beat-type></time>` : '') +
        (M.i === 0 ? (score.clef === 'bass' ? '<clef><sign>F</sign><line>4</line></clef>' : '<clef><sign>G</sign><line>2</line></clef>') : '') +
        '</attributes>\n';
    }
    if (M.i === 0) x += `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${score.tempo}</per-minute></metronome></direction-type><sound tempo="${score.tempo}"/></direction>\n`;
    for (const v of [0, 1]) {
      const ps = M.pieces[v];
      if (!ps.length) continue;
      if (v === 1) x += `<backup><duration>${M.len}</duration></backup>\n`;
      for (const p of ps) {
        const e = p.e, key2 = p.v + '-' + p.idx;
        if (p.first && !p.ghost) {
          if (hpStop[key2]) x += `<direction placement="below"><direction-type><wedge type="stop"/></direction-type><voice>${v + 1}</voice></direction>\n`;
          if (e.dyn) x += `<direction placement="below"><direction-type><dynamics><${e.dyn}/></dynamics></direction-type><voice>${v + 1}</voice></direction>\n`;
          if (e.hp) x += `<direction placement="below"><direction-type><wedge type="${e.hp === '<' ? 'crescendo' : 'diminuendo'}"/></direction-type><voice>${v + 1}</voice></direction>\n`;
        }
        x += '<note>';
        if (e.r) x += p.mrest ? '<rest measure="yes"/>' : '<rest/>';
        else x += `<pitch><step>${STEP_N[e.s]}</step>${e.a ? `<alter>${e.a}</alter>` : ''}<octave>${e.o}</octave></pitch>`;
        x += `<duration>${p.t}</duration>`;
        if (p.tieIn) x += '<tie type="stop"/>';
        if (p.tie) x += '<tie type="start"/>';
        x += `<voice>${v + 1}</voice>`;
        if (!p.mrest) x += `<type>${DUR_NAME[p.d]}</type>` + (p.dot ? '<dot/>' : '');
        if (p.acc != null) x += `<accidental>${{ '-1': 'flat', '0': 'natural', '1': 'sharp' }[p.acc]}</accidental>`;
        if (!e.r && p.dir) x += `<stem>${p.dir < 0 ? 'up' : 'down'}</stem>`;
        if (p.tie || p.tieIn) x += '<notations>' + (p.tieIn ? '<tied type="stop"/>' : '') + (p.tie ? '<tied type="start"/>' : '') + '</notations>';
        x += '</note>\n';
      }
    }
    const endStop = a.ending && nextEnd !== a.ending;
    if (a.repeatEnd || endStop || M.i === lastI) {
      x += '<barline location="right">' + ((a.repeatEnd || M.i === lastI) ? '<bar-style>light-heavy</bar-style>' : '') +
        (endStop ? `<ending number="${a.ending}" type="${a.repeatEnd ? 'stop' : 'discontinue'}"/>` : '') +
        (a.repeatEnd ? '<repeat direction="backward"/>' : '') + '</barline>\n';
    }
    x += '</measure>\n';
  });
  x += '</part>\n</score-partwise>\n';
  return x;
}
async function encodeShare() {
  const bytes = new TextEncoder().encode(JSON.stringify(score));
  let data = bytes, tag = 'j';
  if (window.CompressionStream) {
    const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    data = new Uint8Array(await new Response(cs).arrayBuffer()); tag = 'z';
  }
  let bin = ''; data.forEach(b => bin += String.fromCharCode(b));
  return tag + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function decodeShare(s) {
  const tag = s[0];
  const b64 = s.slice(1).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64), bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  if (tag === 'z') {
    const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(ds).text());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function copyLink() {
  const code = await encodeShare();
  const url = location.href.split('#')[0] + '#s=' + code;
  try { await navigator.clipboard.writeText(url); toast('Link copied. Anyone who opens it gets this score.'); }
  catch (_) { history.replaceState(null, '', '#s=' + code); toast('Link is in the address bar now. Copy it from there.'); }
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2600);
}

// ---------------------------------------------------------------- commands
function addTextBox() {
  snapshot();
  const stage = $('#stage'), page = $('#page');
  const y = Math.max(0, stage.scrollTop - page.offsetTop + 160);
  const tb = { id: Date.now(), x: 40, y: Math.round(y), w: 220, h: 60, size: 16, bold: false, text: 'Text' };
  score.texts.push(tb);
  save(); renderTexts();
  const bodies = $$('.tb-body'); const body = bodies[bodies.length - 1];
  body.focus();
  const r = document.createRange(); r.selectNodeContents(body); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function command(cmd, d) {
  switch (cmd) {
    case 'new': snapshot(); score = newScore(); sel = { v: 0, i: -1, mode: 'insert' }; renderAll(); save(); toast('New score. Undo brings the old one back.'); break;
    case 'open': $('#file').click(); break;
    case 'save': saveFile(); break;
    case 'xml': download(slug(score.title) + '.musicxml', toMusicXML(), 'application/vnd.recordare.musicxml+xml'); toast('MusicXML saved. Open it in MuseScore, Noteflight, Sibelius, Finale or Dorico.'); break;
    case 'link': copyLink(); break;
    case 'print': if (playing) stopPlay(); window.print(); break;
    case 'undo': undo(); break;
    case 'redo': redo(); break;
    case 'play': play(); break;
    case 'help': $('#help').hidden = !$('#help').hidden; localStorage.setItem(STORE + ':helped', '1'); break;
    case 'voice': setVoice(+d.v); break;
    case 'dur': setDur(+d.d); break;
    case 'dot': toggleDot(); break;
    case 'acc': setAcc(+d.a); break;
    case 'tie': editSel(e => { e.tie = !e.tie; }); break;
    case 'rest': enterRest(); break;
    case 'note': enterNote(+d.s); break;
    case 'oct': octave(+d.o); break;
    case 'rep': { const m = targetMeasure(); setMeasureAttr(d.r, (score.measures[m] || {})[d.r] ? undefined : true); break; }
    case 'ending': { const m = targetMeasure(); setMeasureAttr('ending', (score.measures[m] || {}).ending === +d.n ? undefined : +d.n); break; }
    case 'addbar': change(() => { score.minMeasures = Math.max(score.minMeasures, B.meas.length) + 1; }); break;
    case 'delbar': {
      const need = Math.max(B.seq[0].length ? B.seq[0][B.seq[0].length - 1].m + 1 : 1, B.seq[1].length ? B.seq[1][B.seq[1].length - 1].m + 1 : 1);
      if (B.meas.length <= need) { toast('The last bar has notes in it. Delete them first.'); break; }
      change(() => { score.minMeasures = B.meas.length - 1; });
      break;
    }
    case 'dyn': editSel(e => { e.dyn = e.dyn === d.y ? undefined : d.y; if (!e.dyn) delete e.dyn; }, false); break;
    case 'hp': editSel(e => { e.hp = e.hp === d.h ? undefined : d.h; if (!e.hp) delete e.hp; }, false); break;
    case 'text': addTextBox(); break;
  }
}

// ---------------------------------------------------------------- wiring
function wire() {
  const ks = $('#keySel');
  for (let k = -7; k <= 7; k++) {
    const op = document.createElement('option'); op.value = String(k);
    op.textContent = `${MAJ[k]} major / ${MIN[k]} minor` + (k ? ` (${Math.abs(k)}${k > 0 ? '♯' : '♭'})` : '');
    ks.appendChild(op);
  }
  ks.value = '0';
  $('#bar').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-cmd]'); if (!b) return;
    command(b.dataset.cmd, b.dataset); b.blur();
  });
  $('#help').addEventListener('click', ev => {
    if (ev.target.id === 'help' || ev.target.closest('[data-cmd="help"]')) command('help');
  });
  $('#timeSel').addEventListener('change', ev => { const [n, dd] = ev.target.value.split('/').map(Number); setMeasureAttr('time', [n, dd]); ev.target.blur(); });
  $('#keySel').addEventListener('change', ev => { setMeasureAttr('key', +ev.target.value); ev.target.blur(); });
  $('#clefSel').addEventListener('change', ev => { change(() => { score.clef = ev.target.value; }); ev.target.blur(); });
  $('#tempo').addEventListener('change', ev => {
    const v = Math.max(30, Math.min(300, Math.round(+ev.target.value || 100)));
    snapshot(); score.tempo = v; renderHeader(); save(); ev.target.blur();
  });
  for (const el of $$('#head [data-f]')) {
    el.addEventListener('focus', () => snapshot());
    el.addEventListener('input', () => { score[el.dataset.f] = el.innerText.replace(/\n+/g, ' ').trim(); save(); });
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); } });
    el.addEventListener('blur', () => { el.textContent = score[el.dataset.f] || ''; });
  }
  $('#systems').addEventListener('click', ev => {
    const n = ev.target.closest('[data-k]');
    if (n) {
      const [v, i] = n.dataset.k.split('-').map(Number);
      sel = { v, i, mode: 'pick' };
      const e = selected(); inputDur = e.d; preview(e);
      render(); return;
    }
    const m = ev.target.closest('[data-m]');
    if (m) clickMeasure(+m.dataset.m);
  });
  $('#file').addEventListener('change', ev => {
    const f = ev.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const s = JSON.parse(r.result);
        if (!valid(s)) throw new Error('bad');
        snapshot(); score = normalize(s); sel = { v: 0, i: -1, mode: 'insert' }; renderAll(); save(); toast('Opened ' + f.name);
      } catch (_) { toast('That file is not a Score Sketch score.'); }
    };
    r.readAsText(f); ev.target.value = '';
  });
  document.addEventListener('keydown', onKey);
}
function onKey(ev) {
  const t = ev.target;
  if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) { if (ev.key === 'Escape') t.blur(); return; }
  const k = ev.key, mod = ev.metaKey || ev.ctrlKey;
  if (!$('#help').hidden && (k === 'Escape' || k === 'Enter')) { command('help'); ev.preventDefault(); return; }
  if (mod) {
    const lk = k.toLowerCase();
    if (lk === 'z') { ev.preventDefault(); ev.shiftKey ? redo() : undo(); }
    else if (lk === 'y') { ev.preventDefault(); redo(); }
    else if (lk === 's') { ev.preventDefault(); saveFile(); }
    return;
  }
  if (ev.altKey) return;
  const lk = k.length === 1 ? k.toLowerCase() : k;
  if (/^[a-g]$/.test(lk)) { ev.preventDefault(); enterNote('cdefgab'.indexOf(lk)); return; }
  if (DUR_KEYS[k]) { ev.preventDefault(); setDur(DUR_KEYS[k]); return; }
  let used = true;
  switch (k) {
    case 'r': case 'R': enterRest(); break;
    case 'v': case 'V': setVoice(1 - sel.v); break;
    case 't': case 'T': command('tie'); break;
    case 'n': case 'N': setAcc(0); break;
    case '#': case '=': case '+': setAcc(1); break;
    case '-': case '_': setAcc(-1); break;
    case '[': stepDur(-1); break;
    case ']': stepDur(1); break;
    case '.': toggleDot(); break;
    case 'ArrowUp': ev.shiftKey ? octave(1) : halfStep(1); break;
    case 'ArrowDown': ev.shiftKey ? octave(-1) : halfStep(-1); break;
    case 'ArrowLeft': moveSel(-1); break;
    case 'ArrowRight': moveSel(1); break;
    case 'Backspace': case 'Delete': deleteSel(); break;
    case ' ': play(); break;
    case '?': command('help'); break;
    case 'Escape': sel.mode = 'insert'; render(); break;
    default: used = false;
  }
  if (used) ev.preventDefault();
}

async function boot() {
  wire();
  let loaded = false;
  if (location.hash.startsWith('#s=')) {
    try { const s = await decodeShare(location.hash.slice(3)); if (valid(s)) { score = normalize(s); loaded = true; } } catch (_) {}
    history.replaceState(null, '', location.pathname + location.search);
  }
  if (!loaded) {
    try { const s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (valid(s)) score = normalize(s); } catch (_) {}
  }
  sel = { v: 0, i: score.voices[0].length - 1, mode: 'insert' };
  if (!localStorage.getItem(STORE + ':helped')) $('#help').hidden = false;
  const go = () => renderAll();
  if (document.fonts && document.fonts.load) document.fonts.load('36px Bravura').then(go, go); else go();
  if (loaded) save();
  window.__scoreSketch = { get score() { return score; }, set score(s) { score = s; renderAll(); }, render, toMusicXML, playOrder };
}
boot();
})();
