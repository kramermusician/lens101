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
      notation: 'rhythm', writeOut: false, hearChords: true, showLyrics: true, rhythms: {}, lyrics: {}, own: [], updated: Date.now(),
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
    return parsed.sections.map((sec) => blockFor(sec, override, lyricSets(sec)));
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

  function renderChart(override) {
    const model = {
      title: song.title, composer: song.composer, tempo: song.tempo, mi,
      feel: feelText(),
      formText: parsed.form.length > 1 ? CD.formText(parsed) : '',
      blocks: chartBlocks(override),
    };
    CD.renderChart($('#sheet'), model, { mode: song.notation, screen: true, selected: ui.sel, selWord: ui.wsel, lyrics: song.showLyrics });
    lastHL = null;
  }

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
    if (what.all) snap.all = JSON.stringify({ text: song.text, rhythms: song.rhythms, lyrics: song.lyrics, own: song.own });
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
    if (ui.rec) return;
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

  function isTyping() {
    const a = document.activeElement;
    if (!a) return false;
    if (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') return true;
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
