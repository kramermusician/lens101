// Jam Box: a 1 to 4 player shared step sequencer. Drums, chords, two melody voices.
// Every edit is written to the room and every phone redraws from the room, so one tap changes everyone.
// The loop is 4 bars = 64 sixteenth steps. Drums repeat one bar; chords change each bar; voices are 32 eighth notes.
// Transport is shared: play, stop and tempo are room state, and every phone plays from the same server clock.

import * as A from './audio.js';
import * as N from './sync.js';

const $ = id => document.getElementById(id);
const COLORS = ['var(--p0)', 'var(--p1)', 'var(--p2)', 'var(--p3)'];
const STEPS = 64, ROWS = 10, COLS = 32;
const KEYROW = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'];
const SCALES = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10] };
const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const CHORD_HUE = ['#e86a4f', '#3d9bd6', '#9b6ad6', '#2fae7a', '#f0a020', '#d65a9b', '#7a8494'];
const NAMES = ['Disco Otter', 'Funky Moth', 'Jazz Hands', 'Bass Goose', 'Synth Pony', 'Lo-fi Frog', 'Tuba Cat', 'Snare Bear', 'Banjo Owl', 'Groove Yak'];
const TRACKS = ['d', 'c', 'm1', 'm2'];

const START = {
  s: { bpm: 96, key: 0, minor: false, play: false, anchor: 0, cs: 'bounce' },
  d: { '0_0': 0, '0_8': 0, '1_4': 0, '1_12': 0, '3_0': 0, '3_2': 0, '3_4': 0, '3_6': 0, '3_8': 0, '3_10': 0, '3_12': 0, '3_14': 0 },
  c: { b0: 0, b1: 5, b2: 3, b3: 4 },
  v: { m1: { snd: 'pluck', oct: 0 }, m2: { snd: 'bell', oct: 0 } },
};
const S = { s: { ...START.s }, d: {}, c: {}, m1: {}, m2: {}, v: structuredClone(START.v), mute: {}, p: {} };

let myCol = 0, tab = 'd', rec = false;
const mode = { d: 'grid', m1: 'roll', m2: 'roll' };
const V = {};            // voice pane parts, by track
const cells = {};        // track -> { key: el }, plus cols: [[el]]
const justRec = {};      // cells I just recorded, so they don't double up with my live hit
const lastNote = {};     // remote live-note counters

// ---------- music helpers ----------
const sc = () => (S.s.minor ? SCALES.min : SCALES.maj);
const flats = () => [5, 10, 3, 8, 1].includes(S.s.minor ? (S.s.key + 3) % 12 : S.s.key);
const pcName = pc => (flats() ? FLAT : SHARP)[((pc % 12) + 12) % 12];
function degMidi(deg, base = 60) {
  const k = S.s.key, root = base + (k > 6 ? k - 12 : k), s = sc();
  return root + 12 * Math.floor(deg / 7) + s[((deg % 7) + 7) % 7];
}
function chordInfo(deg) {
  const t = [deg, deg + 2, deg + 4].map(d => degMidi(d));
  const q = t[1] - t[0] === 4 ? '' : t[2] - t[0] === 6 ? 'dim' : 'm';
  const rn = q ? ROMAN[deg].toLowerCase() + (q === 'dim' ? '°' : '') : ROMAN[deg];
  return { name: pcName(t[0]) + (q === 'm' ? 'm' : q === 'dim' ? '°' : ''), rn, notes: t, hue: CHORD_HUE[deg] };
}
const stepSec = () => 60 / S.s.bpm / 4;
const stepMs = () => stepSec() * 1000;
const voiceMidi = (tr, row) => degMidi(row) + 12 * ((S.v[tr] && S.v[tr].oct) || 0);

// ---------- state ----------
function setPath(path, val) {
  const parts = path.split('/'); let o = S;
  for (let i = 0; i < parts.length - 1; i++) { if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {}; o = o[parts[i]]; }
  if (val === null && parts.length === 1) o[parts[0]] = {};
  else if (val === null) delete o[parts.at(-1)]; else o[parts.at(-1)] = val;
}
function put(obj) {
  const before = {}, touched = new Set();
  for (const k of Object.keys(obj)) { const top = k.split('/')[0]; if (!touched.has(top)) { before[top] = structuredClone(S[top]); touched.add(top); } }
  for (const [k, v] of Object.entries(obj)) setPath(k, v);
  touched.forEach(k => changed(k, before[k]));
  N.put(obj).catch(() => toast('That did not save. Check the wifi.'));
}
function remote(key, val) {
  const old = S[key];
  if (key === 's') S.s = { ...START.s, ...(val || {}) };
  else if (key === 'v') S.v = { m1: { ...START.v.m1, ...(val && val.m1) }, m2: { ...START.v.m2, ...(val && val.m2) } };
  else S[key] = val || {};
  changed(key, old, true);
}
function changed(key, old, fromRoom) {
  if (key === 's') {
    if (!old || old.anchor !== S.s.anchor || old.bpm !== S.s.bpm || old.play !== S.s.play) resync = true;
    if (old && old.bpm !== S.s.bpm) { $('hBpm').classList.remove('bump'); void $('hBpm').offsetWidth; $('hBpm').classList.add('bump'); }
    if (!old || old.key !== S.s.key || old.minor !== S.s.minor) { drawChords(); drawRollLabels(); drawPianos(); }
    drawHeader(); drawChordBar();
  } else if (key === 'd' || key === 'm1' || key === 'm2') drawGrid(key, old, fromRoom);
  else if (key === 'c') drawChords(old, fromRoom);
  else if (key === 'v') drawVoiceBars();
  else if (key === 'mute') drawMutes();
  else if (key === 'p') drawPlayers();
}

// ---------- lobby ----------
const params = new URLSearchParams(location.search);
$('lName').value = localStorage.getItem('jambox-name') || NAMES[Math.floor(Math.random() * NAMES.length)];
$('lCode').value = (params.get('room') || params.get('join') || '').toUpperCase().slice(0, 4);
if ($('lCode').value) { $('lJoin').classList.add('go'); $('lStart').classList.remove('go'); }
$('lCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
$('lCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('lJoin').click(); });

const myName = () => ($('lName').value.trim() || 'Someone').slice(0, 16);
function lobbyBusy(msg) { $('lErr').textContent = msg || ''; document.querySelectorAll('#lobby button').forEach(b => { b.disabled = !!msg && msg.endsWith('…'); }); }

$('lStart').onclick = async () => {
  A.unlock(); lobbyBusy('Opening a room…');
  try {
    await N.connect();
    const code = await N.create(START);
    await enter(code);
  } catch (e) { console.error(e); lobbyBusy('Could not reach the jam server. Try "Just me" below.'); }
};
$('lJoin').onclick = async () => {
  const code = $('lCode').value.trim().toUpperCase();
  if (code.length !== 4) { lobbyBusy('Codes are four letters.'); return; }
  A.unlock(); lobbyBusy('Joining…');
  try { await N.connect(); await enter(code); } catch (e) { console.error(e); lobbyBusy('Could not reach the jam server.'); }
};
$('lSolo').onclick = () => {
  A.unlock(); N.startSolo();
  Object.assign(S, structuredClone(START)); S.mute = {}; S.p = { me: { name: myName(), col: 0, tab: 'd' } };
  S.m1 = {}; S.m2 = {};
  start();
};

async function enter(code) {
  localStorage.setItem('jambox-name', myName());
  const r = await N.join(code, { name: myName(), tab });
  if (!r.ok) { lobbyBusy(r.reason === 'full' ? `Room ${code} already has four players.` : `No jam called ${code}. Check the letters?`); return; }
  myCol = r.col;
  history.replaceState(null, '', `${location.pathname}?room=${code}`);
  ['s', 'd', 'c', 'm1', 'm2', 'v', 'mute', 'p'].forEach(k => N.listen(k, val => remote(k, val)));
  N.listen('n', onNotes);
  start();
}

function start() {
  $('lobby').hidden = true; $('app').hidden = false;
  document.documentElement.style.setProperty('--me', COLORS[myCol]);
  $('hCode').textContent = N.roomCode();
  build();
  TRACKS.forEach(k => changed(k, undefined));
  ['s', 'v', 'mute', 'p'].forEach(k => changed(k, undefined));
  showTab('d');
  setInterval(tick, 25);
  requestAnimationFrame(frame);
}

// ---------- build the panes ----------
function build() {
  buildGrid('d', $('gd'), 6, 16, r => A.DRUMS[r], c => (c % 4 === 0 ? 'beat' : ''), r => r);
  $('pads').innerHTML = A.DRUMS.map((n, i) => `<button class="pad" data-i="${i}">${n}<kbd>${KEYROW[i].toUpperCase()}</kbd></button>`).join('');
  bindHits($('pads'), '.pad', el => ['d', +el.dataset.i]);

  for (const tr of ['m1', 'm2']) {
    const sec = document.querySelector(`[data-pane="${tr}"]`);
    sec.append($('voiceTpl').content.cloneNode(true));
    const P = V[tr] = { sec, roll: sec.querySelector('.roll'), piano: sec.querySelector('.piano'), snd: sec.querySelector('.snd'), oct: sec.querySelector('.oct b') };
    P.snd.innerHTML = A.VOICES.map(([k, n]) => `<button data-v="${k}">${n}</button>`).join('');
    P.snd.onclick = e => { const b = e.target.closest('button'); if (!b) return; put({ [`v/${tr}/snd`]: b.dataset.v }); A.voice(b.dataset.v, voiceMidi(tr, 4), A.now() + 0.01, 0.3); };
    sec.querySelector('.oct .down').onclick = () => put({ [`v/${tr}/oct`]: Math.max(-2, (S.v[tr].oct || 0) - 1) });
    sec.querySelector('.oct .up').onclick = () => put({ [`v/${tr}/oct`]: Math.min(1, (S.v[tr].oct || 0) + 1) });
    sec.querySelector('.mute').dataset.mute = tr;
    sec.querySelector('.clear').dataset.clear = tr;
    sec.querySelector('.mode').dataset.mode = tr;
    buildGrid(tr, P.roll, ROWS, COLS, () => '', c => (c % 8 === 0 && c ? 'barline' : ''), i => ROWS - 1 - i);
    bindHits(P.piano, '.key', el => [tr, +el.dataset.deg]);
  }

  document.querySelectorAll('[data-mode]').forEach(seg => {
    const tr = seg.dataset.mode;
    seg.onclick = e => { const b = e.target.closest('button'); if (b) { mode[tr] = b.dataset.v; drawModes(); } };
  });
  document.querySelectorAll('[data-mute]').forEach(b => { b.onclick = () => put({ [`mute/${b.dataset.mute}`]: S.mute[b.dataset.mute] ? null : true }); });
  document.querySelectorAll('[data-clear]').forEach(b => {
    b.onclick = () => {
      if (!b.classList.contains('sure')) { b.classList.add('sure'); b.textContent = 'Sure?'; setTimeout(() => { b.classList.remove('sure'); b.textContent = 'Clear'; }, 2200); return; }
      b.classList.remove('sure'); b.textContent = 'Clear';
      put({ [b.dataset.clear]: null });
    };
  });

  // chords
  $('cKey').onchange = () => put({ 's/key': +$('cKey').value });
  $('cMinor').onclick = e => { const b = e.target.closest('button'); if (b) put({ 's/minor': b.dataset.v === '1' }); };
  $('cStyle').onclick = e => { const b = e.target.closest('button'); if (b) put({ 's/cs': b.dataset.v }); };
  $('slots').onclick = e => { const b = e.target.closest('.slot'); if (b) openPicker(+b.dataset.i); };
  $('picker').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const i = picking; closePicker();
    if (b.dataset.deg === 'x') put({ [`c/b${i}`]: null });
    else { const d = +b.dataset.deg; put({ [`c/b${i}`]: d }); previewChord(d); }
  };

  $('tabs').onclick = e => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); };
  $('hPlay').onclick = togglePlay;
  $('hRec').onclick = toggleRec;
  $('hSlow').onclick = () => setBpm(S.s.bpm - 4);
  $('hFast').onclick = () => setBpm(S.s.bpm + 4);
  $('hCode').onclick = share;
  $('hMore').onclick = () => { $('more').hidden = !$('more').hidden; };
  $('mLeave').onclick = () => { N.leave(); location.href = location.pathname; };
  $('mSave').onclick = saveAudio;
  if (N.isSolo()) $('hCode').textContent = 'Solo';
}

function buildGrid(tr, el, rows, cols, label, cls, rowOf) {
  el.style.setProperty('--cols', cols);
  cells[tr] = { cols: Array.from({ length: cols }, () => []) };
  let h = '';
  for (let i = 0; i < rows; i++) {
    const r = rowOf(i);
    h += `<div class="lab" data-row="${r}">${label(r)}</div>`;
    for (let c = 0; c < cols; c++) h += `<div class="cell ${cls(c)}" data-k="${r}_${c}"></div>`;
  }
  el.innerHTML = h;
  el.querySelectorAll('.cell').forEach(x => { cells[tr][x.dataset.k] = x; cells[tr].cols[+x.dataset.k.split('_')[1]].push(x); });
  bindGrid(el, tr);
}

// mouse: press and drag to paint. touch: tap to toggle (a drag scrolls the roll).
let paint = null, touch = null;
function bindGrid(el, tr) {
  el.addEventListener('pointerdown', e => {
    const c = e.target.closest('.cell'); if (!c) return;
    A.unlock();
    if (e.pointerType === 'mouse') { e.preventDefault(); paint = { tr, on: S[tr][c.dataset.k] === undefined, seen: new Set() }; paintCell(c); }
    else touch = { c, x: e.clientX, y: e.clientY };
  });
  el.addEventListener('pointerup', e => {
    if (!touch) return;
    const t = touch; touch = null;
    if (Math.hypot(e.clientX - t.x, e.clientY - t.y) < 12) { paint = { tr, on: S[tr][t.c.dataset.k] === undefined, seen: new Set() }; paintCell(t.c); paint = null; }
  });
  el.addEventListener('pointercancel', () => { touch = null; });
}
window.addEventListener('pointermove', e => {
  if (!paint) return;
  const c = document.elementFromPoint(e.clientX, e.clientY);
  if (c && c.classList.contains('cell') && cells[paint.tr][c.dataset.k] === c) paintCell(c);
});
window.addEventListener('pointerup', () => { paint = null; });
function paintCell(c) {
  const k = c.dataset.k, tr = paint.tr;
  if (paint.seen.has(k)) return; paint.seen.add(k);
  const isOn = S[tr][k] !== undefined;
  if (isOn === paint.on) return;
  put({ [`${tr}/${k}`]: paint.on ? myCol : null });
  if (paint.on) sound(tr, +k.split('_')[0], A.now() + 0.005, 0.3);
}

// pads and piano keys: fire on press so several fingers can play at once
function bindHits(el, sel, what) {
  el.addEventListener('pointerdown', e => {
    const b = e.target.closest(sel); if (!b) return;
    e.preventDefault(); A.unlock();
    const [tr, i] = what(b); hit(tr, i);
  });
}

// ---------- drawing ----------
function drawGrid(tr, old = {}, fromRoom) {
  const g = cells[tr]; if (!g) return;
  for (const k in g) {
    if (k === 'cols') continue;
    const v = S[tr][k], el = g[k], was = old && old[k] !== undefined;
    el.classList.toggle('on', v !== undefined);
    if (v !== undefined) el.style.setProperty('--c', COLORS[v] || COLORS[0]);
    if (fromRoom && v !== undefined && !was && v !== myCol) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }
}
function drawRollLabels() {
  for (const tr of ['m1', 'm2']) {
    if (!V[tr]) continue;
    V[tr].roll.querySelectorAll('.lab').forEach(l => {
      const r = +l.dataset.row;
      l.textContent = pcName(degMidi(r));
      l.classList.toggle('home', r % 7 === 0);
    });
    V[tr].roll.querySelectorAll('.cell').forEach(c => { c.classList.toggle('home', +c.dataset.k.split('_')[0] % 7 === 0); });
  }
}
function drawPianos() {
  for (const tr of ['m1', 'm2']) {
    if (!V[tr]) continue;
    const deg = {}; for (let d = 0; d < ROWS; d++) deg[degMidi(d)] = d;
    const black = m => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
    let lo = degMidi(0), hi = degMidi(ROWS - 1);
    if (black(lo)) lo--; if (black(hi)) hi++;
    const whites = []; for (let m = lo; m <= hi; m++) if (!black(m)) whites.push(m);
    const w = 100 / whites.length;
    let h = '';
    for (let m = lo; m <= hi; m++) {
      const d = deg[m], on = d !== undefined, lab = on ? `${pcName(m)}<kbd>${KEYROW[d].toUpperCase()}</kbd>` : '';
      if (!black(m)) { const x = whites.indexOf(m) * w; h += `<button class="key w${on ? '' : ' off'}" ${on ? `data-deg="${d}"` : ''} style="left:${x}%;width:${w}%">${lab}</button>`; }
      else { const x = whites.indexOf(m - 1) * w + w * 0.68; h += `<button class="key b${on ? '' : ' off'}" ${on ? `data-deg="${d}"` : ''} style="left:${x}%;width:${w * 0.64}%">${lab}</button>`; }
    }
    V[tr].piano.innerHTML = h;
  }
}
function drawChords(old, fromRoom) {
  $('slots').innerHTML = [0, 1, 2, 3].map(i => {
    const d = S.c['b' + i];
    if (d === undefined || d === null) return `<button class="slot" data-i="${i}"><b>&ndash;</b><small>rest</small><span class="n">bar ${i + 1}</span></button>`;
    const c = chordInfo(d), pop = fromRoom && old && old['b' + i] !== d;
    return `<button class="slot has${pop ? ' pop' : ''}" data-i="${i}" style="--h:${c.hue}"><b>${c.name}</b><small>${c.rn}</small><span class="n">bar ${i + 1}</span></button>`;
  }).join('');
  if (picking !== null) $('slots').children[picking].classList.add('pick');
  if (shown >= 0) $('slots').children[Math.floor(shown / 16)].classList.add('now');
}
function drawChordBar() {
  const keyNames = S.s.minor ? ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'] : ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  $('cKey').innerHTML = keyNames.map((n, k) => `<option value="${k}"${k === S.s.key ? ' selected' : ''}>${n}</option>`).join('');
  [...$('cMinor').children].forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === !!S.s.minor));
  [...$('cStyle').children].forEach(b => b.classList.toggle('on', b.dataset.v === S.s.cs));
}
function drawVoiceBars() {
  for (const tr of ['m1', 'm2']) {
    if (!V[tr]) continue;
    [...V[tr].snd.children].forEach(b => b.classList.toggle('on', b.dataset.v === S.v[tr].snd));
    V[tr].oct.textContent = (S.v[tr].oct > 0 ? '+' : '') + (S.v[tr].oct || 0);
  }
}
function drawMutes() {
  document.querySelectorAll('[data-mute]').forEach(b => { const m = !!S.mute[b.dataset.mute]; b.classList.toggle('on', m); b.textContent = m ? 'Muted' : 'Mute'; });
  TRACKS.forEach(t => document.querySelector(`[data-pane="${t}"]`).classList.toggle('muted', !!S.mute[t]));
}
function drawModes() {
  document.querySelectorAll('[data-mode]').forEach(seg => {
    const tr = seg.dataset.mode;
    [...seg.children].forEach(b => b.classList.toggle('on', b.dataset.v === mode[tr]));
  });
  $('pads').hidden = mode.d !== 'pads';
  for (const tr of ['m1', 'm2']) V[tr].sec.classList.toggle('keys', mode[tr] === 'keys');
}
function drawHeader() {
  $('hBpm').textContent = S.s.bpm;
  $('hPlay').classList.toggle('on', !!S.s.play);
  $('hPlay').innerHTML = S.s.play ? '&#9632;' : '&#9654;';
  $('hRec').classList.toggle('on', rec);
}
function drawPlayers() {
  const ps = Object.entries(S.p || {}).sort((a, b) => a[1].col - b[1].col);
  $('hPlayers').innerHTML = ps.map(([u, p]) => `<span class="pl${u === N.me() ? ' me' : ''}" style="--c:${COLORS[p.col] || COLORS[0]}"><i></i>${esc(p.name || '?')}${u === N.me() ? ' (you)' : ''}</span>`).join('');
  document.querySelectorAll('#tabs button').forEach(b => {
    b.querySelector('.who').innerHTML = ps.filter(([, p]) => p.tab === b.dataset.tab).map(([, p]) => `<u style="--c:${COLORS[p.col] || COLORS[0]}"></u>`).join('');
  });
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function showTab(t) {
  tab = t; closePicker();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('main section').forEach(s => s.classList.toggle('on', s.dataset.pane === t));
  drawModes();
  if (N.isSolo()) { S.p.me.tab = t; drawPlayers(); } else N.setPresence({ tab: t });
}

let picking = null;
function openPicker(i) {
  picking = i;
  $('picker').innerHTML = [0, 1, 2, 3, 4, 5, 6].map(d => { const c = chordInfo(d); return `<button data-deg="${d}" style="--h:${c.hue}">${c.name}<small>${c.rn}</small></button>`; }).join('')
    + '<button class="rest" data-deg="x">Rest<small>no chord</small></button>';
  $('picker').hidden = false;
  drawChords();
}
function closePicker() { picking = null; $('picker').hidden = true; if (cells.d) drawChords(); }

// ---------- sound ----------
function sound(tr, i, at, dur, v = 1) {
  if (tr === 'd') A.drum(i, at, v);
  else A.voice(S.v[tr].snd, voiceMidi(tr, i), at, dur, v);
}
function previewChord(d) {
  const t = A.now() + 0.01;
  voicing(d).forEach(m => A.voice('keys', m, t, 0.6));
  A.voice('bass', bassOf(d), t, 0.6);
}
function voicing(d) { return chordInfo(d).notes.map(m => { while (m < 53) m += 12; while (m >= 69) m -= 12; return m; }).sort((a, b) => a - b); }
function bassOf(d) { const pc = ((chordInfo(d).notes[0] % 12) + 12) % 12; return 36 + pc > 44 ? 24 + pc : 36 + pc; }

// a live hit: you hear it now, the room hears it a moment later, and in record mode it sticks
function hit(tr, i, fromCol) {
  sound(tr, i, A.now() + 0.005, 0.35);
  flash(tr, i, fromCol === undefined ? myCol : fromCol);
  if (fromCol !== undefined) return;
  N.note(tr, i);
  if (rec && S.s.play) {
    const pos = (N.now() - S.s.anchor) / stepMs();
    if (pos < -1) return;
    let k;
    if (tr === 'd') k = `${i}_${((Math.round(pos) % 16) + 16) % 16}`;
    else k = `${i}_${((Math.round(pos / 2) % COLS) + COLS) % COLS}`;
    justRec[`${tr}/${k}`] = performance.now();
    if (S[tr][k] === undefined) put({ [`${tr}/${k}`]: myCol });
  }
}
function flash(tr, i, col) {
  const el = tr === 'd' ? $('pads').children[i] : V[tr] && V[tr].piano.querySelector(`[data-deg="${i}"]`);
  if (!el) return;
  el.style.setProperty('--c', COLORS[col]); el.classList.add('hit');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('hit'), 140);
}
function onNotes(all) {
  for (const [u, n] of Object.entries(all || {})) {
    if (u === N.me() || !n) continue;
    const first = lastNote[u] === undefined;
    if (!first && n.k > lastNote[u]) { const p = S.p[u]; hit(n.tr, n.i, p ? p.col : 0); }
    lastNote[u] = n.k;
  }
}

// ---------- transport ----------
function togglePlay() {
  A.unlock();
  if (S.s.play) put({ 's/play': false });
  else put({ 's/play': true, 's/anchor': N.now() + 250 });
}
function toggleRec() {
  rec = !rec; drawHeader();
  if (rec) { toast('Recording: play the pads or keys and your notes stick'); if (!S.s.play) togglePlay(); }
}
function setBpm(b) {
  b = Math.max(60, Math.min(180, b));
  if (b === S.s.bpm) return;
  if (S.s.play) {
    const now = N.now(), pos = (now - S.s.anchor) / stepMs();
    put({ 's/bpm': b, 's/anchor': now - pos * (60000 / b / 4) });
  } else put({ 's/bpm': b });
}

// look-ahead scheduler on the shared clock: step n plays at anchor + n * stepMs (server time)
// Audio is sent out early by the output latency so every listener hears step n at the same moment.
let resync = true, nextStep = 0, lastAt = 0;
const LOOK = 150;
function tick() {
  if (!A.ctx || !S.s.play) return;
  const nowS = N.now(), nowA = A.now(), ms = stepMs(), lat = A.latency();
  if (resync) { nextStep = Math.max(0, Math.ceil((nowS - S.s.anchor) / ms)); resync = false; }
  while (S.s.anchor + nextStep * ms < nowS + LOOK) {
    const at = nowA + (S.s.anchor + nextStep * ms - nowS) / 1000 - lat;
    if (at > nowA - 0.02 && at > lastAt + 0.005) { lastAt = Math.max(at, nowA); playStep(nextStep % STEPS, lastAt); }
    nextStep++;
  }
}
function fresh(key) { const t = justRec[key]; return t && performance.now() - t < 300; }
function playStep(i, at) {
  const ss = stepSec();
  if (!S.mute.d) for (let r = 0; r < 6; r++) { const k = `${r}_${i % 16}`; if (S.d[k] !== undefined && !fresh('d/' + k)) A.drum(r, at); }
  const bar = Math.floor(i / 16), b = i % 16, deg = S.c['b' + bar];
  if (!S.mute.c && deg !== undefined && deg !== null) {
    const ch = voicing(deg), bass = bassOf(deg), cs = S.s.cs;
    if (cs === 'pad') {
      if (b === 0) { ch.forEach(m => A.voice('pad', m, at, ss * 15.5)); A.voice('bass', bass, at, ss * 15); }
    } else {
      if (b === 0) A.voice('bass', bass, at, ss * 6);
      if (b === 8) A.voice('bass', bass, at, ss * 4);
      if (cs === 'bounce' && b % 4 === 2) ch.forEach(m => A.voice('keys', m, at, ss * 1.4, 0.9));
      if (cs === 'arp' && b % 2 === 0) A.voice('keys', [...ch, ch[0] + 12][(b / 2) % 4], at, ss * 1.8, 1.2);
    }
  }
  if (i % 2 === 0) {
    const col = i / 2;
    for (const tr of ['m1', 'm2']) {
      if (S.mute[tr]) continue;
      for (let r = 0; r < ROWS; r++) { const k = `${r}_${col}`; if (S[tr][k] !== undefined && !fresh(`${tr}/${k}`)) A.voice(S.v[tr].snd, voiceMidi(tr, r), at, ss * 1.8); }
    }
  }
}

// playheads follow the same clock
let shown = -1;
function frame() {
  requestAnimationFrame(frame);
  let st = -1;
  if (S.s.play) { const p = Math.floor((N.now() - S.s.anchor) / stepMs()); if (p >= 0) st = p % STEPS; }
  if (st === shown) return;
  const prev = shown; shown = st;
  const mark = (s, on) => {
    if (s < 0) return;
    cells.d.cols[s % 16].forEach(c => c.classList.toggle('now', on));
    for (const tr of ['m1', 'm2']) cells[tr].cols[Math.floor(s / 2)].forEach(c => c.classList.toggle('now', on));
    const slot = $('slots').children[Math.floor(s / 16)]; if (slot) slot.classList.toggle('now', on);
  };
  mark(prev, false); mark(st, true);
}

// ---------- keyboard ----------
document.addEventListener('keydown', e => {
  if ($('app').hidden || e.target.matches('input, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) togglePlay(); return; }
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'r') { toggleRec(); return; }
  const i = KEYROW.indexOf(k);
  if (i < 0) return;
  if (tab === 'd' && i < 6) { A.unlock(); hit('d', i); }
  else if (tab === 'm1' || tab === 'm2') { A.unlock(); hit(tab, i); }
});

// ---------- share, save, toast ----------
async function share() {
  if (N.isSolo()) return;
  const url = `${location.origin}${location.pathname}?room=${N.roomCode()}`;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Jam Box', text: `Jam with me: code ${N.roomCode()}`, url });
    else { await navigator.clipboard.writeText(url); toast('Link copied. Code ' + N.roomCode()); }
  } catch (e) { toast('Code ' + N.roomCode()); }
}

let saving = false;
function saveAudio() {
  if (saving) return;
  if (!window.MediaRecorder) { toast('This browser cannot save audio.'); return; }
  A.unlock();
  if (!S.s.play) togglePlay();
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
  const loopMs = stepMs() * STEPS, pos = N.now() - S.s.anchor;
  const wait = pos < 0 ? -pos : loopMs - (pos % loopMs);
  saving = true; $('mSave').textContent = 'Waiting for bar 1…';
  setTimeout(() => {
    const mr = new MediaRecorder(A.recordStream(), type ? { mimeType: type } : undefined), parts = [];
    mr.ondataavailable = e => parts.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(parts, { type: mr.mimeType }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `jam-box-${N.roomCode().toLowerCase()}.${mr.mimeType.includes('mp4') ? 'm4a' : 'webm'}`;
      a.click(); saving = false; $('mSave').textContent = 'Save audio'; toast('Saved two times through the loop');
    };
    mr.start(); $('mSave').textContent = 'Recording…';
    setTimeout(() => mr.stop(), loopMs * 2 + 1200);
  }, Math.max(0, wait - A.latency() * 1000));
}

let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }

// a clicked button keeps focus, and then Space would press it again on top of play/stop
document.addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.blur(); });
