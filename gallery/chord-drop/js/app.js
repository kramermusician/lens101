/* Chord Drop: the app. Songs live in this browser (localStorage), in a song file, or in a share link. */
(function () {
  const CD = window.CD;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const STORE = 'chorddrop.v1';
  const engine = new CD.Engine();
  const transport = new CD.Transport(engine);

  const EXAMPLE = {
    title: 'Oak Square Shuffle',
    composer: 'Example song',
    tempo: 96, meter: '4/4', groove: 'shuffle', grid: '8s',
    text: '[Intro]\nE7 A7 E7 B7\n\n[Verse]\nE7 A7 E7\nA7 E7\nB7 A7 E7 B7\n\n[Chorus]\nA7 E7 C#m7 A7 B7\n\n[Verse]\n[Chorus x2]\n\n[Outro]\nE7 B7 E7',
    rhythms: {
      intro: { chords: ['E7', 'A7', 'E7', 'B7'], events: [0, 48, 96, 138], length: 192, meter: '4/4' },
      verse: { chords: ['E7', 'A7', 'E7', 'A7', 'E7', 'B7', 'A7', 'E7', 'B7'], events: [0, 48, 96, 186, 288, 384, 432, 480, 522], length: 576, meter: '4/4' },
      chorus: { chords: ['A7', 'E7', 'C#m7', 'A7', 'B7'], events: [0, 96, 186, 282, 336], length: 384, meter: '4/4' },
      outro: { chords: ['E7', 'B7', 'E7'], events: [0, 36, 48], length: 96, meter: '4/4' },
    },
    lyrics: {
      verse: { verses: [
        ['Took the 57 bus', 'down to', 'Oak Square', 'Took the 57 bus down to', 'Oak Square', 'Nobody', 'waiting for me,', 'nobody', 'there'],
        ['Got a little money,', 'got my', 'walking shoes', 'Got a little money, got my', 'walking shoes', 'Gonna shuffle', 'down to Brighton,', 'lose these', 'blues'],
      ] },
      chorus: { verses: [['Shuffle on home,', 'shuffle on home,', 'leave a light on', 'for me,', 'baby']] },
    },
  };

  const uid = () => Math.random().toString(36).slice(2, 10);
  const pretty = (s) => CD.prettyChord(s);

  function blankSong() {
    return {
      id: uid(), title: '', composer: '', text: '',
      tempo: 100, meter: '4/4', groove: 'rock', grid: '8', countIn: 1,
      notation: 'rhythm', writeOut: false, hearChords: true, showLyrics: true, rhythms: {}, lyrics: {}, own: [], notes: [], updated: Date.now(),
    };
  }

  function fixSong(s) {
    const n = Object.assign(blankSong(), s || {});
    n.text = String(n.text || '');
    n.title = String(n.title || '');
    n.composer = String(n.composer || '');
    n.tempo = Math.min(240, Math.max(40, Math.round(+n.tempo || 100)));
    if (!CD.METERS.includes(n.meter)) n.meter = '4/4';
    if (!CD.GROOVES[n.groove]) n.groove = 'rock';
    if (!CD.GRIDS[n.grid]) n.grid = '8';
    if (n.grid === '8s' && CD.meterInfo(n.meter).compound) n.grid = '8';
    n.countIn = n.countIn === 2 ? 2 : 1;
    if (n.notation !== 'slash') n.notation = 'rhythm';
    n.showLyrics = n.showLyrics !== false;
    if (!n.lyrics || typeof n.lyrics !== 'object') n.lyrics = {};
    if (!n.rhythms || typeof n.rhythms !== 'object') n.rhythms = {};
    if (!Array.isArray(n.own)) n.own = [];
    if (!Array.isArray(n.notes)) n.notes = [];
    n.notes = n.notes.filter((x) => x && typeof x === 'object').map((x) => ({ id: String(x.id || uid()), text: String(x.text || ''), at: String(x.at || 'top'), n: +x.n || 0, x: +x.x || 0, y: +x.y || 0 }));
    return n;
  }

  /* ---------- storage ---------- */

  function loadLib() {
    try {
      const l = JSON.parse(localStorage.getItem(STORE));
      if (l && l.songs) return l;
    } catch (e) {}
    return { songs: {}, current: null, offsetMs: 0 };
  }
  const lib = loadLib();
  let saveTimer = null;
  function save() {
    song.updated = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE, JSON.stringify(lib)); } catch (e) {}
    }, 250);
  }

  function addSong(s) {
    const n = fixSong(JSON.parse(JSON.stringify(s)));
    n.id = uid();
    n.updated = Date.now();
    lib.songs[n.id] = n;
    lib.current = n.id;
    return n;
  }

  const b64e = (str) => {
    let bin = '';
    new TextEncoder().encode(str).forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const b64d = (s) => {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  };

  /* ---------- state ---------- */

  let song, parsed, mi;
  // sel: the chord picked on the chart; wsel: the words picked instead ({ key, v: verse, ci: box })
  const ui = { secKey: null, wordKey: null, verse: 0, sel: null, wsel: null, rec: null, play: null, playBlocks: null, trying: false };
  const undoStack = [];

  function boot() {
    let shared = null;
    const m = location.hash.match(/song=([A-Za-z0-9_-]+)/);
    if (m) {
      try { shared = JSON.parse(b64d(m[1])); } catch (e) { shared = null; }
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (shared) {
      song = addSong(shared);
      setTimeout(() => toast('Opened a shared song. It is saved in your songs now.'), 300);
    } else if (lib.current && lib.songs[lib.current]) {
      song = lib.songs[lib.current] = fixSong(lib.songs[lib.current]);
    } else {
      const ids = Object.keys(lib.songs);
      song = ids.length ? (lib.songs[ids[0]] = fixSong(lib.songs[ids[0]])) : addSong(EXAMPLE);
      lib.current = song.id;
    }
    lib.offsetMs = +lib.offsetMs || 0;
    loadInputs();
    refresh();
    save();
  }

  function switchTo(id) {
    stopAll();
    song = lib.songs[id] = fixSong(lib.songs[id]);
    lib.current = id;
    ui.secKey = null; ui.sel = null; ui.wsel = null;
    undoStack.length = 0;
    loadInputs();
    refresh();
    save();
  }

  /* ---------- building the chart ---------- */

  const currentSec = () => (parsed ? parsed.sections.find((s) => s.key === ui.secKey) : null);

  function blockFor(sec, override, lyrics) {
    if (override && override.key === sec.key) {
      return { key: sec.key, name: sec.name, chords: override.chords, events: override.events, length: override.length, tapped: true, source: 'tap', recording: true, lyrics };
    }
    return { key: sec.key, name: sec.name, chords: sec.chords, ...CD.resolveRhythm(sec, song, mi), lyrics };
  }

  // Words live per section, one box per chord, one list per time the section is sung.
  const versesOf = (key) => (song.lyrics[key] && song.lyrics[key].verses) || [];
  const shiftsOf = (key, v) => (song.lyrics[key] && song.lyrics[key].shifts && song.lyrics[key].shifts[v]) || [];
  const hasWords = (v) => v && v.some((t) => t && t.trim());
  // one verse as the chart draws it, tagged with its number so a click on the chart finds it again
  const lineOf = (sec, v) => Object.assign(CD.verseLine(versesOf(sec.key)[v].slice(0, sec.chords.length), shiftsOf(sec.key, v)), { v });

  // Every different verse a section is sung with, in order (verse 1, verse 2...).
  function lyricSets(sec) {
    const seen = new Set(), out = [];
    versesOf(sec.key).forEach((v, i) => {
      const id = v.slice(0, sec.chords.length).join('|');
      if (!hasWords(v) || seen.has(id)) return;
      seen.add(id);
      out.push(lineOf(sec, i));
    });
    return out;
  }

  function chartBlocks(override) {
    if (song.writeOut) {
      const pass = {};
      return parsed.form.map((i) => {
        const sec = parsed.sections[i];
        const p = (pass[i] = (pass[i] || 0) + 1) - 1;
        const vs = versesOf(sec.key);
        // a chorus sung again with no words of its own gets the words it had the first time
        const v = hasWords(vs[p]) ? p : vs.findIndex(hasWords);
        return blockFor(sec, override, v >= 0 ? [lineOf(sec, v)] : []);
      });
    }
    const runs = repeatRuns();
    return parsed.sections.map((sec, i) => Object.assign(blockFor(sec, override, lyricSets(sec)), { repeat: repeatMark(runs[i]) }));
  }

  // How many times in a row a section plays each time it comes around: Verse, Chorus x2, Verse, Chorus x2 gives Chorus [2, 2].
  function repeatRuns() {
    const runs = {};
    parsed.form.forEach((f, k) => {
      const r = (runs[f] = runs[f] || []);
      if (k > 0 && parsed.form[k - 1] === f) r[r.length - 1]++;
      else r.push(1);
    });
    return runs;
  }

  const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  // Repeat signs when a section plays again right away. Twice needs no label; more says how many;
  // when it repeats only some of the times it comes around, the label says which.
  function repeatMark(runs) {
    if (!runs || Math.max(...runs) < 2) return null;
    if (runs.every((n) => n === runs[0])) return { label: runs[0] > 2 ? `${runs[0]}×` : '' };
    const parts = runs.map((n, i) => (n > 1 ? `${n > 2 ? `${n}× ` : ''}the ${ORD[i] || `${i + 1}th`} time` : null)).filter(Boolean);
    return { label: '', note: `Repeat ${parts.join(' and ')} only` };
  }

  // The words each chord comes in on, from the first verse. Shown while tapping.
  const wordsFor = (sec) => (versesOf(sec.key).find(hasWords) || []).map((t) => (t || '').trim());

  function feelText() {
    const parts = [];
    if (song.groove !== 'click') parts.push(CD.GROOVES[song.groove].label);
    if (CD.isSwing(song, mi)) parts.push('swing 8ths');
    const s = parts.join(', ');
    return s ? s[0].toUpperCase() + s.slice(1) : '';
  }

  let lastBlocks = [];
  function renderChart(override) {
    const model = {
      title: song.title, composer: song.composer, tempo: song.tempo, mi,
      feel: feelText(),
      formText: parsed.form.length > 1 ? CD.formText(parsed) : '',
      blocks: chartBlocks(override),
    };
    lastBlocks = model.blocks;
    CD.renderChart($('#sheet'), model, { mode: song.notation, screen: true, selected: ui.sel, selWord: ui.wsel, lyrics: song.showLyrics });
    renderNotes();
    lastHL = null;
  }

  /* ---------- notes: your own words anywhere on the chart ---------- */

  // A note sits on the part of the chart it was dropped on (the title area or a section), so it stays put when
  // sections above it grow or move. x and y are fractions of that part's width, so print scaling keeps it in place.
  function noteAnchors() {
    const out = [{ key: 'top', n: 0, el: $('#sheet .sheet-head') }];
    const count = {};
    $$('#sheet > .sec').forEach((el, i) => {
      const b = lastBlocks[i];
      if (!b) return;
      const n = (count[b.key] = (count[b.key] || 0) + 1) - 1;
      out.push({ key: b.key, n, el });
    });
    return out.filter((a) => a.el);
  }

  function anchorFor(note, anchors) {
    const same = anchors.filter((a) => a.key === note.at);
    return same[Math.min(note.n || 0, same.length - 1)] || anchors[0];
  }

  function renderNotes() {
    if (!song.notes.length) return;
    const anchors = noteAnchors();
    if (!anchors.length) return;
    song.notes.forEach((note) => {
      const a = anchorFor(note, anchors);
      const d = document.createElement('div');
      d.className = 'txt-note';
      d.dataset.id = note.id;
      d.style.left = `${(note.x * 100).toFixed(2)}%`;
      d.style.top = `${(note.y * 100).toFixed(2)}cqw`;
      d.innerHTML = '<div class="txt-note-text"></div><button type="button" class="txt-note-x" aria-label="Delete this note" title="Delete this note">&times;</button>';
      d.querySelector('.txt-note-text').textContent = note.text;
      a.el.appendChild(d);
    });
  }

  const noteById = (id) => song.notes.find((n) => n.id === id);

  function editNote(el) {
    const t = el.querySelector('.txt-note-text');
    el.classList.add('editing');
    t.contentEditable = 'plaintext-only';
    if (t.contentEditable !== 'plaintext-only') t.contentEditable = 'true';
    t.focus();
    const r = document.createRange();
    r.selectNodeContents(t);
    r.collapse(false);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  function addNote(anchor, x, y) {
    if (ui.rec) return;
    const note = { id: uid(), text: '', at: anchor.key, n: anchor.n, x: Math.max(0, Math.min(0.9, x)), y };
    song.notes.push(note);
    save();
    renderChart();
    const el = $(`#sheet .txt-note[data-id="${note.id}"]`);
    if (el) { el.scrollIntoView({ block: 'nearest' }); editNote(el); }
  }

  // which part of the chart a point is over: the last one that starts above it
  function anchorAt(clientY, anchors) {
    let best = anchors[0];
    anchors.forEach((a) => { if (a.el.getBoundingClientRect().top <= clientY) best = a; });
    return best;
  }

  function placeFromRect(note, rect, anchors) {
    const a = anchorAt(rect.top + 4, anchors);
    const ar = a.el.getBoundingClientRect();
    note.at = a.key; note.n = a.n;
    note.x = Math.max(0, Math.min(0.95, (rect.left - ar.left) / ar.width));
    note.y = (rect.top - ar.top) / ar.width;
  }

  $('#btnAddNote').addEventListener('click', () => {
    const anchors = noteAnchors();
    const a = anchors.find((x) => x.key === ui.secKey) || anchors[0];
    if (!a) return;
    // in the section's heading line, to the right of its name
    const ar = a.el.getBoundingClientRect();
    addNote(a, 0.45, a.key === 'top' ? (ar.height + 4) / ar.width : 0);
  });

  $('#sheet').addEventListener('dblclick', (e) => {
    if (ui.rec || e.target.closest('.txt-note, [data-ci], .lyric')) return;
    const anchors = noteAnchors();
    if (!anchors.length) return;
    const a = anchorAt(e.clientY, anchors);
    const ar = a.el.getBoundingClientRect();
    getSelection().removeAllRanges();
    addNote(a, (e.clientX - ar.left) / ar.width, (e.clientY - ar.top - 10) / ar.width);
  });

  // Press on a note: a drag moves it, a click starts editing it.
  $('#sheet').addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.txt-note');
    if (!el || e.target.closest('.txt-note-x') || el.classList.contains('editing') || e.button > 0) return;
    e.preventDefault();
    const note = noteById(el.dataset.id);
    if (!note) return;
    const x0 = e.clientX, y0 = e.clientY;
    let dragging = false;
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!dragging && Math.hypot(dx, dy) < 4) return;
      dragging = true;
      el.classList.add('dragging');
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (!dragging) { editNote(el); return; }
      pushUndo({ all: true });
      placeFromRect(note, el.getBoundingClientRect(), noteAnchors());
      save();
      renderChart();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });

  $('#sheet').addEventListener('input', (e) => {
    const el = e.target.closest('.txt-note');
    const note = el && noteById(el.dataset.id);
    if (!note) return;
    note.text = e.target.innerText.replace(/\n$/, '');
    save();
  });

  $('#sheet').addEventListener('focusout', (e) => {
    const el = e.target.closest && e.target.closest('.txt-note');
    if (!el || !e.target.classList.contains('txt-note-text')) return;
    const note = noteById(el.dataset.id);
    el.classList.remove('editing');
    e.target.contentEditable = 'false';
    if (note && !note.text.trim()) {
      song.notes = song.notes.filter((n) => n !== note);
      el.remove();
      save();
    }
  });

  $('#sheet').addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && e.target.classList.contains('txt-note-text')) { e.stopPropagation(); e.target.blur(); }
  });

  $('#sheet').addEventListener('click', (e) => {
    const x = e.target.closest('.txt-note-x');
    if (!x) return;
    e.stopPropagation();
    const id = x.closest('.txt-note').dataset.id;
    pushUndo({ all: true });
    song.notes = song.notes.filter((n) => n.id !== id);
    save();
    renderChart();
    toast('Note deleted. Cmd+Z puts it back.');
  }, true);

  /* ---------- rendering the controls ---------- */

  function loadInputs() {
    $('#title').value = song.title;
    $('#composer').value = song.composer;
    $('#chordText').value = song.text;
    $('#countIn').value = String(song.countIn);
    $('#hearChords').checked = song.hearChords !== false;
    $('#writeOut').checked = !!song.writeOut;
    $('#showWords').checked = song.showLyrics !== false;
    syncTempo();
  }

  function syncTempo() {
    $('#tempo').value = song.tempo;
    $('#tempoRange').value = song.tempo;
  }

  function refresh() {
    parsed = CD.parseSong(song.text, song.own);
    mi = CD.meterInfo(song.meter);
    if (!currentSec()) ui.secKey = parsed.sections.length ? parsed.sections[0].key : null;
    if (ui.sel) {
      const s = parsed.sections.find((x) => x.key === ui.sel.key);
      if (!s || ui.sel.ci >= s.chords.length) ui.sel = null;
    }
    if (ui.wsel) {
      const s = parsed.sections.find((x) => x.key === ui.wsel.key);
      const v = s && versesOf(s.key)[ui.wsel.v];
      if (!v || ui.wsel.ci >= s.chords.length || !(v[ui.wsel.ci] || '').trim()) ui.wsel = null;
    }
    renderSettings();
    renderSongPick();
    renderWarnings();
    renderOrder();
    renderSecList();
    renderRec();
    renderEditBar();
    renderPlayButtons();
    renderWords();
    renderChart();
  }

  function renderSongPick() {
    const sel = $('#songPick');
    const songs = Object.values(lib.songs).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    sel.innerHTML = '';
    for (const s of songs) {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.title || 'Untitled song';
      if (s.id === song.id) o.selected = true;
      sel.appendChild(o);
    }
  }

  function renderSettings() {
    const meterSeg = $('#meterSeg');
    meterSeg.innerHTML = '';
    for (const m of CD.METERS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = m;
      b.className = m === song.meter ? 'on' : '';
      b.onclick = () => setMeter(m);
      meterSeg.appendChild(b);
    }
    const cards = $('#grooveCards');
    cards.innerHTML = '';
    for (const [k, g] of Object.entries(CD.GROOVES)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'groove' + (k === song.groove ? ' on' : '');
      b.innerHTML = '<span class="g-name"></span><span class="g-blurb"></span>';
      b.querySelector('.g-name').textContent = g.label;
      b.querySelector('.g-blurb').textContent = g.blurb;
      b.onclick = () => setGroove(k);
      cards.appendChild(b);
    }
    const grid = $('#grid');
    grid.innerHTML = '';
    for (const [k, label] of Object.entries(CD.GRIDS)) {
      if (k === '8s' && mi.compound) continue;
      const o = document.createElement('option');
      o.value = k;
      o.textContent = k === 'beat' ? (mi.compound ? 'Beats only (dotted quarters)' : 'Beats only (quarter notes)') : label;
      grid.appendChild(o);
    }
    grid.value = song.grid;
    $$('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === song.notation));
    const lights = $('#beatLights');
    if (lights.childElementCount !== mi.beats) {
      lights.innerHTML = '';
      for (let i = 0; i < mi.beats; i++) lights.appendChild(document.createElement('span'));
    }
    $('#offsetVal').textContent = offsetText();
    $('#offsetRange').value = lib.offsetMs;
  }

  function renderWarnings() {
    const box = $('#warnings');
    box.innerHTML = '';
    for (const w of parsed.warnings) {
      const p = document.createElement('p');
      p.textContent = w;
      box.appendChild(p);
    }
    const words = parsed.formLyrics.some(Boolean);
    $('#wordImport').hidden = !words;
    $('#wordImport2').hidden = !words;
  }

  /* ---------- words (step 4) ---------- */

  function wordEntry(key, make) {
    if (!song.lyrics[key] && make) song.lyrics[key] = { verses: [[]] };
    return song.lyrics[key];
  }

  function wordSec() {
    let sec = parsed.sections.find((s) => s.key === ui.wordKey);
    if (!sec) sec = parsed.sections.find((s) => s.key === ui.secKey) || parsed.sections[0];
    if (sec) ui.wordKey = sec.key;
    return sec;
  }

  // "bar 3", "bar 3, beat 2", "bar 4, and of 4": where a chord comes in, the way a player says it
  function whereText(t) {
    const BT = mi.barTicks, B = mi.beatTicks;
    const bar = Math.floor(t / BT) + 1, inBar = t % BT;
    if (!inBar) return `bar ${bar}`;
    const beat = Math.floor(inBar / B) + 1, rest = inBar % B;
    if (!rest) return `bar ${bar}, beat ${beat}`;
    if (!mi.compound && rest * 2 === B) return `bar ${bar}, and of ${beat}`;
    if (!mi.compound && rest * 4 === B) return `bar ${bar}, e of ${beat}`;
    if (!mi.compound && rest * 4 === 3 * B) return `bar ${bar}, a of ${beat}`;
    return `bar ${bar}, after beat ${beat}`;
  }

  function renderWords() {
    const secBox = $('#wordSecs'), tabs = $('#verseTabs'), grid = $('#wordGrid');
    secBox.innerHTML = ''; tabs.innerHTML = ''; grid.innerHTML = '';
    const sec = wordSec();
    if (!sec) { grid.innerHTML = '<p class="empty">Type some chords in step 1 first.</p>'; return; }
    parsed.sections.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.name + (versesOf(s.key).some(hasWords) ? ' ✓' : '');
      if (s.key === sec.key) b.className = 'on';
      b.onclick = () => { ui.wordKey = s.key; ui.verse = 0; renderWords(); };
      secBox.appendChild(b);
    });

    const vs = versesOf(sec.key);
    const nV = Math.max(1, vs.length);
    if (!(ui.verse < nV)) ui.verse = 0;
    const uses = parsed.form.filter((f) => parsed.sections[f] === sec).length;
    for (let v = 0; v < nV; v++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'small' + (v === ui.verse ? ' on' : '');
      b.textContent = nV > 1 || uses > 1 ? `${sec.name} ${v + 1}` : `${sec.name} words`;
      b.onclick = () => { ui.verse = v; renderWords(); };
      tabs.appendChild(b);
    }
    if (nV < 8) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'small link';
      add.textContent = `+ Words for ${sec.name} ${nV + 1}`;
      add.title = 'For when this section comes back with new words';
      add.onclick = () => {
        const e = wordEntry(sec.key, true);
        while (e.verses.length < nV) e.verses.push([]);
        e.verses.push([]);
        ui.verse = e.verses.length - 1;
        save(); renderWords(); renderChart();
        const first = $('#wordGrid input'); if (first) first.focus();
      };
      tabs.appendChild(add);
    }
    if (nV > 1) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'small link danger';
      del.textContent = `Remove ${sec.name} ${ui.verse + 1}`;
      del.onclick = () => {
        const e = wordEntry(sec.key);
        if (!e) return;
        if (hasWords(e.verses[ui.verse]) && del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = 'Click again to remove'; return; }
        e.verses.splice(ui.verse, 1);
        if (e.shifts) e.shifts.splice(ui.verse, 1);
        ui.verse = Math.max(0, ui.verse - 1);
        save(); renderWords(); renderChart();
      };
      tabs.appendChild(del);
    }
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'small link';
    copy.textContent = `Copy ${sec.name} as a new section`;
    copy.title = 'Same chords and rhythm, its own words, and its own spot on the chart';
    copy.onclick = () => copySection(sec);
    tabs.appendChild(copy);
    if (uses > nV) {
      const hint = document.createElement('div');
      hint.className = 'verse-hint';
      hint.textContent = `${sec.name} comes around ${uses} times. Times without their own words use the words of ${sec.name} 1.`;
      tabs.appendChild(hint);
    }

    const r = CD.resolveRhythm(sec, song, mi);
    if (!r.tapped) {
      const n = document.createElement('p');
      n.className = 'verse-hint warn';
      n.textContent = `Tap ${sec.name} in step 3 first, so the words land where the chords do.`;
      grid.appendChild(n);
    }
    const verse = vs[ui.verse] || [];
    const rowTicks = mi.barTicks * mi.barsPerLine;
    let row = -1;
    sec.chords.forEach((ch, ci) => {
      const t = r.events[ci];
      const rw = Math.floor(t / rowTicks);
      if (rw !== row) {
        row = rw;
        const h = document.createElement('div');
        h.className = 'word-line';
        const lastBar = Math.min(Math.round(r.length / mi.barTicks), (rw + 1) * mi.barsPerLine);
        h.textContent = `Line ${rw + 1}, bars ${rw * mi.barsPerLine + 1} to ${lastBar}`;
        grid.appendChild(h);
      }
      const lab = document.createElement('label');
      lab.className = 'word-row';
      lab.innerHTML = '<span class="wr-chord"></span><span class="wr-where"></span><input type="text" autocomplete="off" spellcheck="true" />';
      lab.querySelector('.wr-chord').textContent = pretty(ch);
      const sh = +shiftsOf(sec.key, ui.verse)[ci] || 0;
      lab.querySelector('.wr-where').textContent = whereText(t) + (sh && (verse[ci] || '').trim() ? `, words ${whereText(Math.max(0, t + sh))}` : '');
      const inp = lab.querySelector('input');
      inp.value = verse[ci] || '';
      inp.placeholder = ci === 0 ? `what you sing over ${pretty(ch)}` : '';
      inp.dataset.ci = ci;
      inp.addEventListener('input', () => {
        const e = wordEntry(sec.key, true);
        while (e.verses.length <= ui.verse) e.verses.push([]);
        const v = e.verses[ui.verse];
        while (v.length < sec.chords.length) v.push('');
        v[ci] = inp.value;
        e.chords = sec.chords.slice();
        save();
        clearTimeout(wordTimer);
        wordTimer = setTimeout(() => { renderChart(); showWordSpot(sec, ci); }, 120);
      });
      inp.addEventListener('focus', () => showWordSpot(sec, ci));
      inp.addEventListener('blur', () => { if (!ui.play) highlight(null); });
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const next = $$('#wordGrid input')[ci + 1];
        if (next) next.focus(); else inp.blur();
      });
      grid.appendChild(lab);
    });
    if (versesOf(sec.key).length && sec.chords.length && wordEntry(sec.key).chords && wordEntry(sec.key).chords.join(' ') !== sec.chords.join(' ')) {
      const n = document.createElement('p');
      n.className = 'verse-hint warn';
      n.textContent = 'The chords changed since these words went in. Check each box still sits on the right chord.';
      grid.insertBefore(n, grid.firstChild);
    }
  }
  let wordTimer = null;

  // light up the chord on the chart whose box you're typing in
  function showWordSpot(sec, ci) {
    const idx = parsed.sections.indexOf(sec);
    const blk = song.writeOut ? parsed.form.indexOf(idx) : idx;
    if (!ui.play) highlight({ blk, ci });
  }

  // Words typed into the chord box (a pasted chord sheet, say) move into the word boxes.
  function importWords() {
    const got = {};
    parsed.form.forEach((i, k) => {
      const w = parsed.formLyrics[k];
      if (!w) return;
      const sec = parsed.sections[i], n = sec.chords.length;
      const verse = new Array(n).fill('');
      const loose = w.filter((l) => l.frags[0].ci === null);
      w.forEach((l) => l.frags.forEach((f) => {
        const ci = f.ci !== null ? f.ci : Math.min(n - 1, Math.floor((loose.indexOf(l) * n) / loose.length));
        if (ci >= n || !f.text) return;
        verse[ci] = [verse[ci], f.text + (f.hy ? '-' : '')].filter(Boolean).join(' ');
      }));
      const list = (got[sec.key] = got[sec.key] || []);
      if (!list.some((v) => v.join('|') === verse.join('|'))) list.push(verse);
    });
    let count = 0;
    for (const key in got) {
      const sec = parsed.sections.find((x) => x.key === key);
      const e = wordEntry(key, true);
      const keep = e.verses.map((v, i) => i).filter((i) => hasWords(e.verses[i]));
      if (e.shifts) e.shifts = keep.map((i) => e.shifts[i] || []);
      e.verses = keep.map((i) => e.verses[i]).concat(got[key]);
      e.chords = sec.chords.slice();
      count++;
    }
    song.text = CD.stripWords(song.text, parsed.rewrites);
    $('#chordText').value = song.text;
    ui.wordKey = Object.keys(got)[0];
    ui.verse = 0;
    save();
    refresh();
    toast(`Moved the words for ${count} section${count === 1 ? '' : 's'} into step 4. Check that each box sits on the right chord.`);
    $('#step4').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const STATUS = {
    tap: '✓ tapped',
    bars: '✓ from your bar lines',
    stale: 'chords changed, tap again',
    even: 'not tapped yet',
  };

  function renderSecList() {
    const box = $('#secList');
    box.innerHTML = '';
    if (!parsed.sections.length) {
      box.innerHTML = '<p class="empty">Your sections show up here once you type some chords.</p>';
      return;
    }
    parsed.sections.forEach((sec, i) => {
      const r = CD.resolveRhythm(sec, song, mi);
      const uses = parsed.form.filter((f) => f === i).length;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sec-item' + (sec.key === ui.secKey ? ' on' : '') + (r.tapped ? ' done' : '');
      b.innerHTML = '<span class="si-name"></span><span class="si-chords"></span><span class="si-status"></span>';
      b.querySelector('.si-name').textContent = sec.name;
      const shown = sec.chords.slice(0, 8).map(pretty).join('  ');
      b.querySelector('.si-chords').textContent = shown + (sec.chords.length > 8 ? '  ...' : '');
      b.querySelector('.si-status').textContent = STATUS[r.source] + (uses > 1 ? `, plays ${uses} times` : '');
      b.onclick = () => {
        if (ui.rec) return;
        ui.secKey = sec.key;
        renderSecList();
        renderRec();
      };
      box.appendChild(b);
    });
  }

  function renderRec() {
    const sec = currentSec();
    $('#btnRecord').disabled = !sec || !!ui.rec;
    $('#btnStop').disabled = !ui.rec;
    $('#btnUndoTap').disabled = !ui.rec;
    $('#btnRecord').textContent = sec ? `● Record ${sec.name}` : '● Record';
    const tools = [$('#btnBarMinus'), $('#btnBarPlus'), $('#btnEven'), $('#btnCopySec')];
    tools.forEach((b) => (b.disabled = !sec || !!ui.rec));
    if (ui.rec) return;
    recStatusKey = '';
    if (!sec) {
      $('#recNow').textContent = 'Nothing to record yet';
      $('#recNext').textContent = 'Type chords in step 1 first.';
      $('#secLen').textContent = '';
      $('#barCount').textContent = '';
      return;
    }
    const r = CD.resolveRhythm(sec, song, mi);
    $('#recNow').textContent = `Ready: ${sec.name}`;
    $('#recNext').textContent = `${sec.chords.length} chord${sec.chords.length === 1 ? '' : 's'}: ${sec.chords.map(pretty).join('  ')}`;
    const bars = r.length / mi.barTicks;
    $('#secLen').textContent = `${bars} bar${bars === 1 ? '' : 's'}`;
    $('#barCount').textContent = '';
  }

  function renderEditBar() {
    const bar = $('#editBar');
    const pick = ui.sel || ui.wsel;
    if (!pick || ui.rec) { bar.hidden = true; return; }
    const sec = parsed.sections.find((s) => s.key === pick.key);
    const r = CD.resolveRhythm(sec, song, mi);
    bar.hidden = false;
    if (ui.sel) {
      $('#editWhat').textContent = `${pretty(sec.chords[ui.sel.ci])} in ${sec.name}, ${whereText(r.events[ui.sel.ci])}`;
      $('#btnWordReset').hidden = true;
      return;
    }
    const w = (versesOf(sec.key)[ui.wsel.v][ui.wsel.ci] || '').trim();
    const sh = +shiftsOf(sec.key, ui.wsel.v)[ui.wsel.ci] || 0;
    const short = w.length > 22 ? w.slice(0, 20) + '...' : w;
    $('#editWhat').textContent = `"${short}" in ${sec.name}, ${whereText(Math.max(0, r.events[ui.wsel.ci] + sh))}`;
    $('#btnWordReset').hidden = !sh;
  }

  function renderPlayButtons() {
    $('#btnPlaySec').textContent = ui.play === 'section' ? '■ Stop' : '▶ Play section';
    $('#btnPlaySong').textContent = ui.play === 'song' ? '■ Stop' : '▶ Play whole song';
    $('#btnTry').textContent = ui.trying ? '■ Stop the beat' : '▶ Hear the beat';
  }

  /* ---------- beat lights ---------- */

  let lastLight = null;
  function lights(tick) {
    const B = mi.beatTicks;
    const beatAbs = Math.floor(tick / B);
    const idx = ((beatAbs % mi.beats) + mi.beats) % mi.beats;
    const key = beatAbs;
    if (key === lastLight) return;
    lastLight = key;
    $$('#beatLights span').forEach((s, i) => {
      s.className = i === idx ? (tick < 0 ? 'on count' : idx === 0 ? 'on one' : 'on') : '';
    });
    $('#barCount').textContent = tick < 0 ? 'Count-in' : `Bar ${Math.floor(tick / mi.barTicks) + 1}`;
  }
  function clearLights() {
    lastLight = null;
    $$('#beatLights span').forEach((s) => (s.className = ''));
  }

  /* ---------- recording ---------- */

  function blurActive() {
    const a = document.activeElement;
    if (a && a !== document.body && a.blur) a.blur();
  }

  function startRecord() {
    const sec = currentSec();
    if (!sec || !sec.chords.length || ui.rec) return;
    stopAll();
    blurActive();
    ui.sel = null;
    ui.rec = { key: sec.key, name: sec.name, chords: sec.chords.slice(), words: wordsFor(sec), events: [0], voice: null, lastBar: null };
    transport.start({ song, mi, countIn: song.countIn, blocks: null, onPos: recPos });
    checkSound();
    if (song.hearChords !== false) ui.rec.voice = engine.chord(sec.chords[0], transport.t0, transport.t0 + 60, transport.out);
    document.body.classList.add('recording');
    renderRec();
    renderEditBar();
    renderChart(recOverride(0));
  }

  function recOverride(tick) {
    const r = ui.rec, BT = mi.barTicks;
    const last = r.events[r.events.length - 1];
    const bars = Math.max(1, Math.ceil((Math.max(tick, last) + 1) / BT));
    return { key: r.key, chords: r.chords.slice(0, r.events.length), events: r.events.slice(), length: bars * BT };
  }

  function recPos(tick) {
    if (!ui.rec) return;
    lights(tick);
    const bar = tick < 0 ? -1 : Math.floor(tick / mi.barTicks);
    if (bar !== ui.rec.lastBar) {
      ui.rec.lastBar = bar;
      if (bar >= 0) renderChart(recOverride(tick));
    }
    // All chords in and no end tap two bars on: the section ends a bar after its last chord.
    const r = ui.rec;
    if (r.events.length === r.chords.length) {
      const lastBar = Math.floor(r.events[r.events.length - 1] / mi.barTicks);
      if (tick >= (lastBar + 3) * mi.barTicks) {
        finishRecord((lastBar + 1) * mi.barTicks, `${r.name} saved. It ends one bar after the last chord; use + bar to stretch it.`);
        return;
      }
    }
    recStatus(tick);
  }

  let recStatusKey = '';
  function recStatus(tick) {
    const r = ui.rec;
    // the first few words the chord comes in on, so you can sing along and tap
    const on = (ci) => {
      const w = r.words[ci];
      if (!w) return '';
      const cut = w.split(' ');
      return ` on "${cut.slice(0, 4).join(' ')}${cut.length > 4 ? '...' : ''}"`;
    };
    let now, next;
    if (tick < 0) {
      const B = mi.beatTicks;
      const n = Math.floor((tick + song.countIn * mi.barTicks) / B) % mi.beats + 1;
      now = String(Math.max(1, n));
      next = `${pretty(r.chords[0])} starts on the 1 by itself.` + (r.chords[1] ? ` Then tap for ${pretty(r.chords[1])}${on(1)}.` : '');
    } else {
      const placed = r.events.length;
      now = pretty(r.chords[placed - 1]);
      if (placed < r.chords.length) {
        next = `Next: ${pretty(r.chords[placed])}${on(placed)}. Press space when it comes in.`;
      } else {
        next = `That was the last chord. Press space on the bar where ${r.name} ends, or just wait.`;
      }
    }
    const key = now + '|' + next;
    if (key === recStatusKey) return;
    recStatusKey = key;
    $('#recNow').textContent = now;
    $('#recNow').classList.toggle('counting', tick < 0);
    $('#recNext').textContent = next;
  }

  function tap() {
    const r = ui.rec;
    if (!r) return;
    flash($('#tapPad'));
    const ctx = engine.ctx;
    const heard = ctx.currentTime - engine.latency() - (lib.offsetMs || 0) / 1000;
    const tickF = (heard - transport.t0) / transport.spt;
    const BT = mi.barTicks;
    if (tickF < -mi.beatTicks / 2) return; // still counting in
    const now = ctx.currentTime;
    if (r.events.length < r.chords.length) {
      let q = CD.quantize(tickF, song.grid, mi);
      if (q <= 0) {
        toast(`${pretty(r.chords[0])} starts by itself on beat 1. Tap when ${pretty(r.chords[1])} comes in.`);
        return;
      }
      const prev = r.events[r.events.length - 1];
      if (q <= prev) q = prev + CD.gridTicks(song.grid, mi);
      r.events.push(q);
      if (r.voice) r.voice.release(now);
      r.voice = song.hearChords !== false ? engine.chord(r.chords[r.events.length - 1], now, now + 60, transport.out) : null;
    } else {
      const last = r.events[r.events.length - 1];
      const end = Math.max(Math.round(tickF / BT), Math.floor(last / BT) + 1) * BT;
      finishRecord(end);
      return;
    }
    recStatusKey = '';
    renderChart(recOverride(tickF));
    recStatus(tickF);
  }

  function undoTap() {
    const r = ui.rec;
    if (!r || r.events.length < 2) return;
    r.events.pop();
    recStatusKey = '';
    toast('Took back the last tap.');
    renderChart(recOverride(r.events[r.events.length - 1]));
  }

  function endRec() {
    if (ui.rec && ui.rec.voice) ui.rec.voice.release(engine.ctx.currentTime);
    ui.rec = null;
    transport.stop();
    clearLights();
    document.body.classList.remove('recording');
  }

  function finishRecord(end, note) {
    const r = ui.rec;
    endRec();
    pushUndo();
    song.rhythms[r.key] = { chords: r.chords, events: r.events, length: end, meter: song.meter };
    save();
    const bars = end / mi.barTicks;
    toast(note || `${r.name} saved: ${bars} bar${bars === 1 ? '' : 's'}. Press Play section to hear it back.`);
    parsed = CD.parseSong(song.text);
    const next = parsed.sections.find((s) => !CD.resolveRhythm(s, song, mi).tapped);
    if (next) ui.secKey = next.key;
    refresh();
  }

  function stopRecord() {
    const r = ui.rec;
    if (!r) return;
    if (r.events.length === r.chords.length) {
      const last = r.events[r.events.length - 1];
      finishRecord((Math.floor(last / mi.barTicks) + 1) * mi.barTicks, `${r.name} saved. It ends one bar after the last chord; use + bar to stretch it.`);
      return;
    }
    const left = r.chords.length - r.events.length;
    endRec();
    toast(`Stopped with ${left} chord${left === 1 ? '' : 's'} still to tap, so nothing changed.`);
    refresh();
  }

  /* ---------- playback ---------- */

  function stopAll() {
    if (ui.rec) { stopRecord(); return; }
    transport.stop();
    ui.play = null; ui.playBlocks = null; ui.trying = false;
    highlight(null);
    clearLights();
    renderPlayButtons();
  }

  function play(which) {
    if (ui.play === which) { stopAll(); return; }
    stopAll();
    let list;
    if (which === 'song') {
      list = parsed.form.map((i, n) => ({ sec: parsed.sections[i], chartBlk: song.writeOut ? n : i }));
    } else {
      const sec = currentSec();
      if (!sec) return;
      const idx = parsed.sections.indexOf(sec);
      list = [{ sec, chartBlk: song.writeOut ? parsed.form.indexOf(idx) : idx }];
    }
    if (!list.length) return;
    const blocks = list.map((o) => ({ ...blockFor(o.sec), chartBlk: o.chartBlk }));
    let off = 0;
    blocks.forEach((b) => { b.off = off; off += b.length; });
    ui.play = which;
    ui.playBlocks = blocks;
    blurActive();
    transport.start({
      song, mi, countIn: song.countIn, blocks, chords: song.hearChords !== false,
      onPos: playPos,
      onEnd: () => { ui.play = null; highlight(null); clearLights(); renderPlayButtons(); },
    });
    checkSound();
    renderPlayButtons();
  }

  function playPos(tick) {
    lights(tick);
    if (tick < 0 || !ui.playBlocks) { highlight(null); return; }
    let b = ui.playBlocks[0];
    for (const x of ui.playBlocks) if (x.off <= tick) b = x;
    const t = tick - b.off;
    let ci = 0;
    while (ci + 1 < b.events.length && b.events[ci + 1] <= t) ci++;
    highlight({ blk: b.chartBlk, ci });
  }

  let lastHL = null;
  function highlight(h) {
    const k = h ? `${h.blk}:${h.ci}` : null;
    if (k === lastHL) return;
    lastHL = k;
    $$('#sheet .on').forEach((n) => n.classList.remove('on'));
    if (h) $$(`#sheet [data-blk="${h.blk}"][data-ci="${h.ci}"]`).forEach((n) => n.classList.add('on'));
  }

  function tryBeat() {
    if (ui.trying) { stopAll(); return; }
    stopAll();
    ui.trying = true;
    transport.start({ song, mi, countIn: 0, blocks: null, onPos: lights });
    checkSound();
    renderPlayButtons();
  }
  function restartBeat() {
    if (ui.trying) { ui.trying = false; tryBeat(); }
  }

  /* ---------- editing ---------- */

  // Each undo step keeps only what it changed, so words typed since then are never lost.
  function pushUndo(what) {
    what = what || { rhythms: true };
    const snap = {};
    if (what.rhythms) snap.rhythms = JSON.stringify(song.rhythms);
    if (what.shifts) snap.shifts = { key: what.shifts, value: JSON.stringify((song.lyrics[what.shifts] || {}).shifts || []) };
    if (what.all) snap.all = JSON.stringify({ text: song.text, rhythms: song.rhythms, lyrics: song.lyrics, own: song.own, notes: song.notes });
    undoStack.push(snap);
    if (undoStack.length > 60) undoStack.shift();
  }
  function undo() {
    if (!undoStack.length) { toast('Nothing to undo.'); return; }
    const snap = undoStack.pop();
    if (snap.rhythms) song.rhythms = JSON.parse(snap.rhythms);
    if (snap.shifts && song.lyrics[snap.shifts.key]) song.lyrics[snap.shifts.key].shifts = JSON.parse(snap.shifts.value);
    if (snap.all) {
      Object.assign(song, JSON.parse(snap.all));
      $('#chordText').value = song.text;
    }
    save();
    refresh();
    toast('Undone.');
  }

  function setRhythm(sec, events, length) {
    pushUndo();
    song.rhythms[sec.key] = { chords: sec.chords.slice(), events, length, meter: song.meter };
    save();
    refresh();
  }

  // Arrow keys move the picked chord or words one 16th note, or a whole beat with Shift.
  function nudgeSel(dir, beat) {
    if (ui.wsel) nudgeWords(dir, beat);
    else nudge(dir, beat);
  }

  function nudge(dir, beat) {
    const s = ui.sel;
    if (!s) return;
    const sec = parsed.sections.find((x) => x.key === s.key);
    if (!sec) return;
    if (s.ci === 0) { toast('The first chord always starts the section.'); return; }
    const r = CD.resolveRhythm(sec, song, mi);
    const step = beat ? mi.beatTicks : 3;
    const ev = r.events.slice();
    const t = ev[s.ci] + dir * step;
    const lo = ev[s.ci - 1];
    const hi = s.ci + 1 < ev.length ? ev[s.ci + 1] : r.length;
    if (t <= lo) { toast("It can't move past the chord before it."); return; }
    if (t >= hi) { toast(s.ci + 1 < ev.length ? "It can't move past the next chord." : 'Add a bar to give it more room.'); return; }
    ev[s.ci] = t;
    setRhythm(sec, ev, r.length);
  }

  function nudgeWords(dir, beat) {
    const s = ui.wsel;
    const sec = parsed.sections.find((x) => x.key === s.key);
    if (!sec) return;
    const r = CD.resolveRhythm(sec, song, mi);
    const verse = versesOf(sec.key)[s.v] || [];
    const sh = shiftsOf(sec.key, s.v);
    const startOf = (i) => Math.max(0, r.events[i] + (+sh[i] || 0));
    const t = startOf(s.ci) + dir * (beat ? mi.beatTicks : 3);
    const filled = (i) => i < sec.chords.length && (verse[i] || '').trim();
    let p = s.ci - 1, n = s.ci + 1;
    while (p >= 0 && !filled(p)) p--;
    while (n < sec.chords.length && !filled(n)) n++;
    if (t < 0) { toast("The words can't start before the section does."); return; }
    if (p >= 0 && t <= startOf(p)) { toast("They can't move past the words before them."); return; }
    if (n < sec.chords.length && t >= startOf(n)) { toast("They can't move past the next words."); return; }
    if (t >= r.length) { toast('That is the end of the section.'); return; }
    setShift(sec, s.v, s.ci, t - r.events[s.ci]);
  }

  function setShift(sec, v, ci, ticks) {
    pushUndo({ shifts: sec.key });
    const e = wordEntry(sec.key, true);
    e.shifts = e.shifts || [];
    while (e.shifts.length <= v) e.shifts.push([]);
    while (e.shifts[v].length < sec.chords.length) e.shifts[v].push(0);
    e.shifts[v][ci] = ticks;
    save();
    refresh();
  }

  // Up and down arrows step to the chord (or words) before or after the one picked.
  function stepSel(dir) {
    const pick = ui.sel || ui.wsel;
    const sec = parsed.sections.find((x) => x.key === pick.key);
    if (!sec) return;
    let ci = pick.ci + dir;
    if (ui.wsel) {
      const verse = versesOf(sec.key)[pick.v] || [];
      while (ci >= 0 && ci < sec.chords.length && !(verse[ci] || '').trim()) ci += dir;
    }
    if (ci < 0 || ci >= sec.chords.length) return;
    pick.ci = ci;
    refresh();
  }

  /* ---------- copying a section ---------- */

  // A copy has the same chords and rhythm under a new name, with words of its own.
  // When the section already comes around again, the copy takes over that next time; otherwise it goes right after.
  function copySection(sec) {
    if (ui.rec) return;
    const idx = parsed.sections.indexOf(sec);
    const passes = parsed.form.map((f, k) => (f === idx ? k : -1)).filter((k) => k >= 0);
    const usedKeys = new Set(parsed.sections.map((s) => s.key).concat(parsed.formInfo.map((f) => f.name.toLowerCase().replace(/\s+/g, ' ').trim())));
    const baseName = sec.name.replace(/\s*\d+$/, '') || sec.name;
    const freeName = () => { let n = 2; while (usedKeys.has(`${baseName} ${n}`.toLowerCase())) n++; return `${baseName} ${n}`; };
    const lines = song.text.split(/\r?\n/);
    const block = (name) => [`[${name}]`, ...sec.src];
    let name, pass, insertAt = null, add = null;

    const k = passes[1];
    const info = k !== undefined ? parsed.formInfo[k] : null;
    if (info && info.head !== null && info.times > 1) {
      // "Chorus x2": the last time round becomes the copy
      pass = passes.reduce((m, q, i) => (parsed.formInfo[q] === info ? i : m), 1);
      name = freeName();
      const left = info.times - 1;
      lines[info.head] = lines[info.head].replace(/\s*(?:[x×]\s*\d+|\(\s*\d+\s*[x×]\s*\))(?=\s*\]|\s*:|\s*$)/i, left > 1 ? ` x${left}` : '');
      insertAt = info.end + 1; add = ['', ...block(name)];
    } else if (info && info.head !== null) {
      pass = 1;
      // a "Verse 2" that was folded into Verse keeps its name and just becomes its own section
      const own = info.name.toLowerCase().replace(/\s+/g, ' ').trim();
      const keep = own !== sec.key && !parsed.sections.some((s) => s.key === own);
      name = keep ? info.name : freeName();
      if (!keep) lines[info.head] = `[${name}]`;
      if (!info.chords) { insertAt = info.head + 1; add = sec.src.slice(); }
    } else {
      pass = null;
      name = freeName();
      insertAt = sec.end + 1; add = ['', ...block(name)];
    }
    if (insertAt !== null) {
      if (lines[insertAt] && lines[insertAt].trim()) add.push('');
      lines.splice(insertAt, 0, ...add);
    }

    pushUndo({ all: true });
    const key = name.toLowerCase().replace(/\s+/g, ' ').trim();
    song.own = song.own.filter((x) => x !== key).concat(key);
    song.text = lines.join('\n').replace(/\n{3,}/g, '\n\n');
    const r = CD.resolveRhythm(sec, song, mi);
    if (r.source === 'tap') song.rhythms[key] = { chords: sec.chords.slice(), events: r.events.slice(), length: r.length, meter: song.meter };
    // words already typed for that time round go with it
    const e = song.lyrics[sec.key];
    let moved = false;
    if (pass !== null && e && hasWords(e.verses[pass])) {
      song.lyrics[key] = { verses: e.verses.splice(pass, 1), shifts: e.shifts ? e.shifts.splice(pass, 1) : [], chords: sec.chords.slice() };
      moved = true;
    } else {
      song.lyrics[key] = { verses: [[]], chords: sec.chords.slice() };
    }
    $('#chordText').value = song.text;
    ui.secKey = ui.wordKey = key;
    ui.verse = 0;
    ui.sel = ui.wsel = null;
    save();
    refresh();
    const where = pass === null ? `right after ${sec.name}` : `the next time ${sec.name} comes around`;
    toast(`Made ${name}: same chords and rhythm, ${where}. ${moved ? 'Its words came with it.' : 'Type its words in step 4.'}`);
    $('#step4').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- song order: delete, repeat, drag ---------- */

  // The order lives in the chord text, so every change here rewrites step 1. Each header ([Verse], [Chorus x2])
  // is one row. The first time a section plays has to carry its chords, so a move or a delete that changes
  // which time comes first moves the chords there. Rhythms, words and copies follow their section.
  const nameKey = (n) => n.toLowerCase().replace(/\s+/g, ' ').trim();
  const TIMES_RE = /\s*(?:[x×]\s*\d+|\(\s*\d+\s*[x×]\s*\))(?=\s*\]|\s*:|\s*$)/i;
  const headLine = (name, times) => `[${name}${times > 1 ? ` x${times}` : ''}]`;

  function orderBlocks() {
    const lines = song.text.split(/\r?\n/);
    const blocks = [], pass = {}, seen = new Set();
    parsed.formInfo.forEach((info, k) => {
      const s = parsed.form[k];
      const p = (pass[s] = (pass[s] || 0) + 1) - 1;
      let b = blocks[blocks.length - 1];
      if (!b || b.info !== info) {
        b = { info, sec: s, key: parsed.sections[s].key, times: info.times, start: info.head === null ? 0 : info.head, passes: [], def: !seen.has(s) };
        seen.add(s);
        blocks.push(b);
      }
      b.passes.push(p);
    });
    const pre = lines.slice(0, blocks.length ? blocks[0].start : lines.length);
    blocks.forEach((b, i) => {
      b.lines = lines.slice(b.start, i + 1 < blocks.length ? blocks[i + 1].start : lines.length);
      // chords typed with no header at the top: give them one so they can move
      if (b.info.head === null) b.lines.unshift(headLine(b.info.name, 1));
      while (b.lines.length && !b.lines[b.lines.length - 1].trim()) b.lines.pop();
    });
    return { pre, blocks };
  }

  function canArrange() {
    if (ui.rec) return false;
    if (parsed.formLyrics.some(Boolean)) {
      toast('There are words in your chords. Press "Move the words to step 4" first, then change the order.');
      return false;
    }
    return true;
  }

  function commitOrder(orig, pre, blocks, msg) {
    // the name a bare header uses to reach each section (a second "[Verse]" with other chords is "Verse 2")
    const refName = {};
    orig.forEach((b) => {
      if (!b.def) return;
      const sec = parsed.sections[b.sec];
      refName[b.key] = sec.key.includes('#') ? sec.name : b.info.name;
    });
    const firstDone = new Set();
    blocks.forEach((b) => {
      const sec = parsed.sections[b.sec], name = refName[b.key];
      const first = !firstDone.has(b.key);
      firstDone.add(b.key);
      if (first) {
        if (!b.def || sec.key.includes('#') || b.info.head === null) b.lines = [headLine(name, b.times), ...sec.src];
      } else if (b.def || !b.lines) {
        b.lines = [headLine(name, b.times)];
      }
    });
    const out = pre.slice();
    while (out.length && !out[out.length - 1].trim()) out.pop();
    blocks.forEach((b) => {
      if (out.length) out.push('');
      b.newStart = out.length;
      out.push(...b.lines);
    });
    const text = out.join('\n');

    pushUndo({ all: true });

    // words: each time a section plays keeps the verse it had
    const passCount = {};
    orig.forEach((b) => (passCount[b.key] = (passCount[b.key] || 0) + b.passes.length));
    Object.keys(passCount).forEach((key) => {
      const e = song.lyrics[key];
      const order = blocks.filter((b) => b.key === key).flatMap((b) => b.passes);
      if (!e || !e.verses || !order.length) return;
      const perm = (arr) => {
        if (!arr) return arr;
        const got = order.map((p) => (p === null ? undefined : arr[p])).concat(arr.slice(passCount[key]));
        while (got.length && got[got.length - 1] === undefined) got.pop();
        return got.map((x) => x || []);
      };
      e.verses = perm(e.verses);
      if (!e.verses.length) e.verses = [[]];
      if (e.shifts) e.shifts = perm(e.shifts);
    });

    // a section whose header changed gets a new key: carry its rhythm, words and copy flag across
    const np = CD.parseSong(text, song.own);
    const keyAt = {};
    np.formInfo.forEach((info, k) => { if (info.head !== null && !(info.head in keyAt)) keyAt[info.head] = np.sections[np.form[k]].key; });
    const remap = {};
    blocks.forEach((b) => {
      const nk = keyAt[b.newStart];
      if (nk && nk !== b.key && !(b.key in remap)) remap[b.key] = nk;
    });
    if (Object.keys(remap).length) {
      const move = (obj) => {
        const res = {};
        for (const k in obj) if (!(k in remap)) res[k] = obj[k];
        for (const k in remap) if (obj[k]) res[remap[k]] = obj[k];
        return res;
      };
      song.rhythms = move(song.rhythms);
      song.lyrics = move(song.lyrics);
      song.own = [...new Set(song.own.map((k) => remap[k] || k))];
      if (song.notes) song.notes.forEach((n) => { if (remap[n.at]) n.at = remap[n.at]; });
      if (remap[ui.secKey]) ui.secKey = remap[ui.secKey];
      if (remap[ui.wordKey]) ui.wordKey = remap[ui.wordKey];
    }

    song.text = text;
    $('#chordText').value = song.text;
    ui.sel = ui.wsel = null;
    ui.verse = 0;
    save();
    refresh();
    if (msg) toast(msg);
  }

  function moveBlock(from, to) {
    if (from === to || !canArrange()) return;
    const { pre, blocks } = orderBlocks();
    if (to < 0 || to >= blocks.length) return;
    const arr = blocks.slice();
    const [b] = arr.splice(from, 1);
    arr.splice(to, 0, b);
    commitOrder(blocks, pre, arr, `Moved ${parsed.sections[b.sec].name}.`);
  }

  function repeatBlock(i) {
    if (!canArrange()) return;
    const { pre, blocks } = orderBlocks();
    const b = blocks[i];
    const arr = blocks.slice();
    arr.splice(i + 1, 0, { info: b.info, sec: b.sec, key: b.key, times: 1, passes: [null], def: false, lines: null });
    commitOrder(blocks, pre, arr, `${parsed.sections[b.sec].name} plays again right after. Drag it if it goes somewhere else.`);
  }

  function deleteBlock(i) {
    if (!canArrange()) return;
    const { pre, blocks } = orderBlocks();
    const b = blocks[i];
    const name = parsed.sections[b.sec].name;
    const arr = blocks.slice();
    if (b.times > 1) {
      const nb = Object.assign({}, b, { times: b.times - 1, passes: b.passes.slice(0, -1), lines: b.lines.slice() });
      nb.lines[0] = nb.lines[0].replace(TIMES_RE, nb.times > 1 ? ` x${nb.times}` : '');
      arr[i] = nb;
    } else {
      arr.splice(i, 1);
    }
    commitOrder(blocks, pre, arr, `Took out ${name}${b.times > 1 ? ' once' : ''}. Cmd+Z puts it back.`);
  }

  function renderOrder() {
    const box = $('#orderBox'), list = $('#orderList');
    const { blocks } = orderBlocks();
    box.hidden = !blocks.length;
    list.innerHTML = '';
    blocks.forEach((b, i) => {
      const sec = parsed.sections[b.sec];
      const li = document.createElement('li');
      li.className = 'order-row';
      li.dataset.i = i;
      li.innerHTML = '<button type="button" class="grip">&#8942;&#8942;</button><span class="or-num"></span><span class="or-name"></span><span class="or-chords"></span>'
        + '<button type="button" class="small" data-act="repeat">Repeat</button><button type="button" class="link danger" data-act="del">Delete</button>';
      li.querySelector('.grip').setAttribute('aria-label', `Move ${sec.name}. Drag, or use the up and down arrow keys.`);
      li.querySelector('.or-num').textContent = i + 1;
      li.querySelector('.or-name').textContent = sec.name + (b.times > 1 ? ` ×${b.times}` : '');
      const ch = li.querySelector('.or-chords');
      if (b.def) ch.textContent = sec.chords.slice(0, 8).map(pretty).join('  ') + (sec.chords.length > 8 ? '  ...' : '');
      else { ch.textContent = 'again'; ch.classList.add('or-again'); }
      li.querySelector('[data-act="repeat"]').title = `Play ${sec.name} one more time, right after this`;
      li.querySelector('[data-act="del"]').title = b.times > 1 ? `Play ${sec.name} one time fewer` : `Take this ${sec.name} out of the song`;
      list.appendChild(li);
    });
  }

  $('#orderList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const i = +btn.closest('.order-row').dataset.i;
    if (btn.dataset.act === 'repeat') repeatBlock(i);
    if (btn.dataset.act === 'del') deleteBlock(i);
  });

  $('#orderList').addEventListener('keydown', (e) => {
    const grip = e.target.closest('.grip');
    if (!grip || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    e.stopPropagation();
    const i = +grip.closest('.order-row').dataset.i;
    const to = i + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= $$('#orderList .order-row').length) return;
    moveBlock(i, to);
    const g = $$('#orderList .grip')[to];
    if (g) g.focus();
  });

  // Drag by the handle: the other rows slide out of the way, and the drop rewrites the order.
  $('#orderList').addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('.grip');
    if (!grip || ui.rec || e.button > 0) return;
    e.preventDefault();
    const row = grip.closest('.order-row');
    const rows = $$('#orderList .order-row');
    const from = rows.indexOf(row);
    const step = rows.length > 1 ? rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top : row.offsetHeight;
    const mids = rows.map((r) => { const m = r.getBoundingClientRect(); return m.top + m.height / 2; });
    const y0 = e.clientY;
    let to = from;
    row.classList.add('dragging');
    grip.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const dy = ev.clientY - y0;
      row.style.transform = `translateY(${dy}px)`;
      const y = mids[from] + dy;
      to = 0;
      mids.forEach((m, j) => { if (j !== from && y > m) to++; });
      rows.forEach((r, j) => {
        if (j === from) return;
        let sh = 0;
        if (from < to && j > from && j <= to) sh = -step;
        if (to < from && j >= to && j < from) sh = step;
        r.style.transform = sh ? `translateY(${sh}px)` : '';
      });
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      rows.forEach((r) => (r.style.transform = ''));
      row.classList.remove('dragging');
      if (to !== from) moveBlock(from, to);
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });

  function changeLength(d) {
    const sec = currentSec();
    if (!sec) return;
    const r = CD.resolveRhythm(sec, song, mi);
    const BT = mi.barTicks;
    const len = r.length + d * BT;
    if (len <= r.events[r.events.length - 1]) { toast('The last chord needs that bar. Move it earlier first.'); return; }
    setRhythm(sec, r.events, len);
  }

  function evenBars() {
    const sec = currentSec();
    if (!sec) return;
    const e = CD.evenRhythm(sec, mi);
    setRhythm(sec, e.events, e.length);
    toast(`${sec.name} is one chord per bar now.`);
  }

  /* ---------- settings ---------- */

  function setTempo(v) {
    v = Math.min(240, Math.max(40, Math.round(+v || song.tempo)));
    if (v === song.tempo) { syncTempo(); return; }
    song.tempo = v;
    syncTempo();
    save();
    renderChart();
    restartBeat();
  }

  function setMeter(m) {
    if (ui.rec) return;
    song.meter = m;
    if (song.grid === '8s' && CD.meterInfo(m).compound) song.grid = '8';
    save();
    refresh();
    restartBeat();
  }

  function setGroove(g) {
    if (ui.rec) return;
    song.groove = g;
    const want = CD.GROOVES[g].grid;
    const compound = CD.meterInfo(song.meter).compound;
    if (want) {
      const grid = want === '8s' && compound ? '8' : want;
      if (grid !== song.grid) {
        song.grid = grid;
        toast(`Taps now snap to ${CD.GRIDS[grid].toLowerCase()} to match ${CD.GROOVES[g].label}.`);
      }
    }
    save();
    refresh();
    ui.trying = false;
    tryBeat();
  }

  /* ---------- songs and files ---------- */

  function slug(s) {
    return (s || 'song').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'song';
  }

  function exportable() {
    const s = JSON.parse(JSON.stringify(song));
    delete s.id; delete s.updated;
    return s;
  }

  function saveFile() {
    const blob = new Blob([JSON.stringify({ app: 'chord-drop', version: 1, song: exportable() }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug(song.title)}.chorddrop.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Song file saved. Email it to a bandmate, or open it here later.');
  }

  function openFile(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        const s = d && d.song ? d.song : d;
        if (!s || typeof s.text !== 'string') throw new Error('not a song');
        stopAll();
        addSong(s);
        switchTo(lib.current);
        toast(`Opened ${s.title || 'the song'}.`);
      } catch (e) {
        toast("That file isn't a Chord Drop song.");
      }
    };
    fr.readAsText(file);
  }

  async function shareLink() {
    const url = `${location.origin}${location.pathname}#song=${b64e(JSON.stringify(exportable()))}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied. Paste it in an email or text. Whoever opens it gets their own copy.');
    } catch (e) {
      history.replaceState(null, '', url);
      toast('Copy the link from the address bar. Whoever opens it gets their own copy.');
    }
  }

  let deleteArmed = null;
  function deleteSong(btn) {
    if (deleteArmed !== song.id) {
      deleteArmed = song.id;
      btn.textContent = 'Click again to delete for good';
      setTimeout(() => { deleteArmed = null; btn.textContent = 'Delete this song'; }, 3000);
      return false;
    }
    deleteArmed = null;
    btn.textContent = 'Delete this song';
    stopAll();
    const gone = song.title || 'Untitled song';
    delete lib.songs[song.id];
    const rest = Object.values(lib.songs).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    if (rest.length) switchTo(rest[0].id);
    else { addSong(blankSong()); switchTo(lib.current); }
    toast(`Deleted ${gone}.`);
    return true;
  }

  function printSheet() {
    stopAll();
    const missing = parsed.sections.filter((s) => !CD.resolveRhythm(s, song, mi).tapped).map((s) => s.name);
    const keepSel = ui.sel;
    ui.sel = null;
    renderChart();
    const t = document.title;
    document.title = song.title || 'Chord chart';
    window.print();
    document.title = t;
    ui.sel = keepSel;
    renderChart();
    if (missing.length) toast(`Heads up: ${missing.join(', ')} ${missing.length === 1 ? "isn't" : "aren't"} tapped yet, so ${missing.length === 1 ? 'it prints' : 'they print'} one chord per bar.`);
  }

  /* ---------- tap timing ---------- */

  function offsetText() {
    const v = lib.offsetMs || 0;
    if (!v) return 'none';
    return `${Math.abs(v)} ms ${v > 0 ? 'earlier' : 'later'}`;
  }

  const calib = { on: false, clicks: [], taps: [], timer: null };
  function openCalib() {
    stopAll();
    $('#calib').hidden = false;
    $('#calibStatus').textContent = '';
    renderSettings();
  }
  function closeCalib() {
    calib.on = false;
    clearTimeout(calib.timer);
    $('#calib').hidden = true;
  }
  function calibStart() {
    const ctx = engine.ensure();
    const bus = engine.bus();
    const spb = 0.6, t0 = ctx.currentTime + 0.4;
    calib.clicks = []; calib.taps = []; calib.on = true;
    for (let i = 0; i < 16; i++) {
      const t = t0 + i * spb;
      engine.hit('click', t, i % 4 === 0 ? 1 : 0.6, bus);
      if (i >= 4) calib.clicks.push(t);
    }
    $('#calibStatus').textContent = 'Listen to four clicks, then tap on every click.';
    blurActive();
    clearTimeout(calib.timer);
    calib.timer = setTimeout(calibDone, (0.4 + 16 * spb + 0.4) * 1000);
  }
  function calibTap() {
    flash($('#calibPad'));
    if (!calib.on) return;
    calib.taps.push(engine.ctx.currentTime - engine.latency());
  }
  function calibDone() {
    calib.on = false;
    const diffs = calib.taps
      .map((t) => calib.clicks.reduce((best, c) => (best === null || Math.abs(t - c) < Math.abs(best) ? t - c : best), null))
      .filter((d) => d !== null && Math.abs(d) < 0.25)
      .sort((a, b) => a - b);
    if (diffs.length < 6) {
      $('#calibStatus').textContent = `Only caught ${diffs.length} taps. Press Start and try again.`;
      return;
    }
    const med = diffs[Math.floor(diffs.length / 2)];
    lib.offsetMs = Math.max(-200, Math.min(200, Math.round((med * 1000) / 5) * 5));
    save();
    renderSettings();
    const ms = Math.abs(Math.round(med * 1000));
    $('#calibStatus').textContent = ms < 10
      ? 'Your taps are right on the click. Nothing to fix.'
      : `Your taps landed ${ms} ms ${med > 0 ? 'late' : 'early'}. Chord Drop corrects for that now.`;
  }

  /* ---------- little things ---------- */

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
  }

  function flash(node) {
    node.classList.remove('hit');
    void node.offsetWidth;
    node.classList.add('hit');
  }

  /* ---------- wiring ---------- */

  let textTimer = null;
  $('#chordText').addEventListener('input', (e) => {
    song.text = e.target.value;
    clearTimeout(textTimer);
    textTimer = setTimeout(() => { save(); refresh(); }, 160);
  });
  $('#title').addEventListener('input', (e) => { song.title = e.target.value; save(); renderChart(); renderSongPick(); });
  $('#composer').addEventListener('input', (e) => { song.composer = e.target.value; save(); renderChart(); });

  $('#tempo').addEventListener('change', (e) => setTempo(e.target.value));
  $('#tempoRange').addEventListener('input', (e) => setTempo(e.target.value));
  $$('[data-tempo]').forEach((b) => b.addEventListener('click', () => setTempo(song.tempo + +b.dataset.tempo)));

  let tapTimes = [];
  $('#btnTapTempo').addEventListener('pointerdown', () => {
    const now = performance.now();
    if (tapTimes.length && now - tapTimes[tapTimes.length - 1] > 2000) tapTimes = [];
    tapTimes.push(now);
    if (tapTimes.length > 6) tapTimes.shift();
    if (tapTimes.length >= 2) {
      const iv = (tapTimes[tapTimes.length - 1] - tapTimes[0]) / (tapTimes.length - 1);
      setTempo(60000 / iv);
    }
    $('#btnTapTempo').textContent = tapTimes.length < 3 ? 'Keep tapping' : 'Tap tempo';
  });

  $('#grid').addEventListener('change', (e) => { song.grid = e.target.value; save(); refresh(); restartBeat(); });
  $('#countIn').addEventListener('change', (e) => { song.countIn = +e.target.value; save(); });
  $('#hearChords').addEventListener('change', (e) => { song.hearChords = e.target.checked; save(); });
  $('#btnImportWords').addEventListener('click', importWords);
  $('#btnImportWords2').addEventListener('click', importWords);
  $('#showWords').addEventListener('change', (e) => { song.showLyrics = e.target.checked; save(); renderChart(); });
  $('#writeOut').addEventListener('change', (e) => { song.writeOut = e.target.checked; save(); stopAll(); refresh(); });
  $$('#modeSeg button').forEach((b) => b.addEventListener('click', () => { song.notation = b.dataset.mode; save(); refresh(); }));

  $('#btnTry').addEventListener('click', tryBeat);
  $('#btnRecord').addEventListener('click', startRecord);
  $('#btnStop').addEventListener('click', stopRecord);
  $('#btnUndoTap').addEventListener('click', undoTap);
  $('#btnBarMinus').addEventListener('click', () => changeLength(-1));
  $('#btnBarPlus').addEventListener('click', () => changeLength(1));
  $('#btnEven').addEventListener('click', evenBars);
  $('#tapPad').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (ui.rec) tap();
    else startRecord();
  });

  $('#btnPlaySec').addEventListener('click', () => play('section'));
  $('#btnPlaySong').addEventListener('click', () => play('song'));
  $('#btnEarlier').addEventListener('click', (e) => nudgeSel(-1, e.shiftKey));
  $('#btnLater').addEventListener('click', (e) => nudgeSel(1, e.shiftKey));
  $('#btnWordReset').addEventListener('click', () => {
    const sec = ui.wsel && parsed.sections.find((x) => x.key === ui.wsel.key);
    if (sec) setShift(sec, ui.wsel.v, ui.wsel.ci, 0);
  });
  $('#btnDeselect').addEventListener('click', () => { ui.sel = ui.wsel = null; refresh(); });
  $('#btnCopySec').addEventListener('click', () => { const sec = currentSec(); if (sec) copySection(sec); });

  $('#sheet').addEventListener('click', (e) => {
    if (ui.rec || e.target.closest('.txt-note')) return;
    const w = e.target.closest('.lyric[data-lci]');
    if (w) {
      const key = w.getAttribute('data-key'), v = +w.getAttribute('data-lv');
      ui.wsel = { key, v, ci: +w.getAttribute('data-lci') };
      ui.sel = null;
      ui.secKey = ui.wordKey = key;
      ui.verse = v;
      refresh();
      return;
    }
    const n = e.target.closest('[data-ci]');
    if (!n) {
      if (ui.sel || ui.wsel) { ui.sel = ui.wsel = null; refresh(); }
      return;
    }
    ui.sel = { key: n.getAttribute('data-key'), ci: +n.getAttribute('data-ci') };
    ui.wsel = null;
    ui.secKey = ui.sel.key;
    refresh();
  });

  $('#songPick').addEventListener('change', (e) => switchTo(e.target.value));
  $('#btnNew').addEventListener('click', () => {
    addSong(blankSong());
    switchTo(lib.current);
    $('#title').focus();
    toast('New song. Give it a name, then type the chords.');
  });

  const menu = $('#fileMenu');
  const closeMenu = () => { menu.hidden = true; $('#btnFile').setAttribute('aria-expanded', 'false'); };
  $('#btnFile').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    $('#btnFile').setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'save') saveFile();
    if (act === 'open') $('#fileInput').click();
    if (act === 'share') shareLink();
    if (act === 'example') { addSong(EXAMPLE); switchTo(lib.current); toast('Example loaded as a new song. Press Play whole song.'); }
    if (act === 'delete') { if (!deleteSong(b)) return; }
    closeMenu();
  });
  $('#fileInput').addEventListener('change', (e) => {
    if (e.target.files[0]) openFile(e.target.files[0]);
    e.target.value = '';
  });
  $('#btnPrint').addEventListener('click', printSheet);

  $('#btnCalib').addEventListener('click', openCalib);
  $('#calibClose').addEventListener('click', closeCalib);
  $('#calibStart').addEventListener('click', calibStart);
  $('#calibPad').addEventListener('pointerdown', (e) => { e.preventDefault(); calibTap(); });
  $('#offsetRange').addEventListener('input', (e) => {
    lib.offsetMs = +e.target.value;
    $('#offsetVal').textContent = offsetText();
    save();
  });

  // Browsers only let sound start from a click or a key, and Safari on a phone only from the end of a touch.
  // Wake the sound on every one, so a Record started from a touch still plays once the finger lifts.
  ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown'].forEach((ev) => addEventListener(ev, () => { try { engine.ensure(); } catch (e) {} }, true));
  // still asleep a moment after Play or Record: say how to wake it instead of staying silent
  function checkSound() {
    setTimeout(() => {
      if (engine.ctx && engine.ctx.state !== 'running' && (ui.rec || ui.play || ui.trying)) toast('No sound yet: click or tap anywhere on the page to let the browser play it.');
    }, 600);
  }

  function isTyping() {
    const a = document.activeElement;
    if (!a) return false;
    if (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable) return true;
    return a.tagName === 'INPUT' && !/^(range|checkbox|radio|button)$/.test(a.type);
  }

  document.addEventListener('keydown', (e) => {
    if (!$('#calib').hidden) {
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) calibTap(); }
      if (e.key === 'Escape') closeCalib();
      return;
    }
    const typing = isTyping();
    if (e.code === 'Space') {
      if (ui.rec && !typing) { e.preventDefault(); if (!e.repeat) tap(); return; }
      if (!typing) { e.preventDefault(); if (!e.repeat) startRecord(); return; }
    }
    if (e.key === 'Escape') {
      if (ui.rec) stopRecord();
      else stopAll();
      if (ui.sel || ui.wsel) { ui.sel = ui.wsel = null; refresh(); }
      return;
    }
    if (ui.rec && e.key === 'Backspace' && !typing) { e.preventDefault(); undoTap(); return; }
    if (typing) return;
    if ((ui.sel || ui.wsel) && !ui.rec && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      nudgeSel(e.key === 'ArrowLeft' ? -1 : 1, e.shiftKey);
      return;
    }
    if ((ui.sel || ui.wsel) && !ui.rec && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      stepSel(e.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  });
  document.addEventListener('focusin', () => { if (ui.rec && isTyping()) stopRecord(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && ui.rec) stopRecord(); });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && (ui.rec || !isTyping())) e.preventDefault();
  });

  boot();
})();
