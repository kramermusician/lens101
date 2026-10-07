/* Key Party: music theory module.
   Single source of truth for key signatures, scales and chords.
   Mirrors scripts/diagram-maps/lens101_circle_of_fifths.py: every scale is
   derived from its root, one letter per degree, never typed in by hand.
   Runs in the browser (window.Theory) and in node (module.exports) so the
   same code is tested by js/theory.test.js and self-checked at boot. */
(function (root) {
  'use strict';

  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const MAJOR_STEPS = [2, 2, 1, 2, 2, 2, 1];
  const SHARP_ORDER = ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'];
  const FLAT_ORDER = ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'];

  // Clock position (12 = top), key, kind, count, relative minor.
  // 6 o'clock is the enharmonic pair F# (6 sharps) = Gb (6 flats).
  // C# (7 sharps) and Cb (7 flats) sit beside their enharmonic neighbours.
  const CIRCLE = [
    { clock: 12, key: 'C', kind: 'none', count: 0, minor: 'Am' },
    { clock: 1, key: 'G', kind: 'sharp', count: 1, minor: 'Em' },
    { clock: 2, key: 'D', kind: 'sharp', count: 2, minor: 'Bm' },
    { clock: 3, key: 'A', kind: 'sharp', count: 3, minor: 'F#m' },
    { clock: 4, key: 'E', kind: 'sharp', count: 4, minor: 'C#m' },
    { clock: 5, key: 'B', kind: 'sharp', count: 5, minor: 'G#m',
      alt: { key: 'Cb', kind: 'flat', count: 7, minor: 'Abm' } },
    { clock: 6, key: 'F#', kind: 'sharp', count: 6, minor: 'D#m',
      alt: { key: 'Gb', kind: 'flat', count: 6, minor: 'Ebm' } },
    { clock: 7, key: 'Db', kind: 'flat', count: 5, minor: 'Bbm',
      alt: { key: 'C#', kind: 'sharp', count: 7, minor: 'A#m' } },
    { clock: 8, key: 'Ab', kind: 'flat', count: 4, minor: 'Fm' },
    { clock: 9, key: 'Eb', kind: 'flat', count: 3, minor: 'Cm' },
    { clock: 10, key: 'Bb', kind: 'flat', count: 2, minor: 'Gm' },
    { clock: 11, key: 'F', kind: 'flat', count: 1, minor: 'Dm' },
  ];

  // The 15 major keys, flattened from the circle.
  const MAJOR_KEYS = [];
  CIRCLE.forEach(c => {
    MAJOR_KEYS.push({ key: c.key, kind: c.kind, count: c.count, minor: c.minor, clock: c.clock });
    if (c.alt) MAJOR_KEYS.push({ key: c.alt.key, kind: c.alt.kind, count: c.alt.count, minor: c.alt.minor, clock: c.clock });
  });

  const CHORD_TYPES = {
    maj: { label: 'major', suffix: '', degrees: [1, 3, 5], alter: {} },
    min: { label: 'minor', suffix: 'm', degrees: [1, 3, 5], alter: { 3: -1 } },
    maj7: { label: 'maj7', suffix: 'maj7', degrees: [1, 3, 5, 7], alter: {} },
    dom7: { label: '7', suffix: '7', degrees: [1, 3, 5, 7], alter: { 7: -1 } },
    min7: { label: 'm7', suffix: 'm7', degrees: [1, 3, 5, 7], alter: { 3: -1, 7: -1 } },
  };
  const CHORD_INTERVALS = {
    maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], dom7: [0, 4, 7, 10], min7: [0, 3, 7, 10],
  };

  // ---------------------------------------------------------------- basics

  function pitchClass(note) {
    let pc = NATURAL_PC[note[0]];
    for (let i = 1; i < note.length; i++) pc += note[i] === '#' ? 1 : -1;
    return ((pc % 12) + 12) % 12;
  }

  function spell(letter, pc) {
    const diff = ((pc - NATURAL_PC[letter]) % 12 + 12) % 12;
    const acc = { 0: '', 1: '#', 2: '##', 11: 'b', 10: 'bb' }[diff];
    if (acc === undefined) throw new Error('cannot spell ' + letter + ' as pc ' + pc);
    return letter + acc;
  }

  function hasDouble(note) {
    return note.indexOf('##') >= 0 || note.indexOf('bb') >= 0;
  }

  function majorScale(rootNote) {
    let li = LETTERS.indexOf(rootNote[0]);
    let pc = pitchClass(rootNote);
    const out = [rootNote];
    for (let i = 0; i < MAJOR_STEPS.length - 1; i++) {
      li = (li + 1) % 7;
      pc = (pc + MAJOR_STEPS[i]) % 12;
      out.push(spell(LETTERS[li], pc));
    }
    return out;
  }

  function accidentals(scale) {
    return scale.filter(n => n.length > 1);
  }

  // Accidentals of a major key, in standard order (F C G D A E B / B E A D G C F).
  function signature(key) {
    const acc = accidentals(majorScale(key));
    const order = acc.some(a => a.indexOf('#') >= 0) ? SHARP_ORDER : FLAT_ORDER;
    return order.filter(a => acc.indexOf(a) >= 0);
  }

  function lower(note) {
    return spell(note[0], (pitchClass(note) + 11) % 12);
  }

  function raise(note) {
    return spell(note[0], (pitchClass(note) + 1) % 12);
  }

  function mixolydian(rootNote) {
    const s = majorScale(rootNote);
    s[6] = lower(s[6]);
    return s;
  }

  // Parent major of a Mixolydian: the key whose 5th degree is the root,
  // i.e. one step counterclockwise on the circle (a fifth down = the 4th degree).
  function parentMajor(mixRoot) {
    return majorScale(mixRoot)[3];
  }

  function keyInfo(key) {
    return MAJOR_KEYS.find(k => k.key === key) || null;
  }

  function isMajorKey(key) {
    return keyInfo(key) !== null;
  }

  function chord(rootNote, type) {
    const t = CHORD_TYPES[type];
    if (!t) throw new Error('unknown chord type ' + type);
    const s = majorScale(rootNote);
    return t.degrees.map(d => {
      let n = s[d - 1];
      const alt = t.alter[d] || 0;
      if (alt === -1) n = lower(n);
      if (alt === 1) n = raise(n);
      return n;
    });
  }

  function chordName(rootNote, type) {
    return rootNote + CHORD_TYPES[type].suffix;
  }

  function chordLongName(rootNote, type) {
    if (type === 'maj') return rootNote + ' major';
    if (type === 'min') return rootNote + ' minor';
    return rootNote + CHORD_TYPES[type].suffix;
  }

  // Display helpers: use real sharp and flat glyphs on screen.
  function display(note) {
    return note.replace(/#/g, '♯').replace(/b/g, '♭');
  }

  // ---------------------------------------------------------------- pools

  function keyLevel(key) {
    const c = keyInfo(key).count;
    return c <= 2 ? 1 : c <= 4 ? 2 : 3;
  }

  function keysForLevel(level) {
    return MAJOR_KEYS.filter(k => keyLevel(k.key) <= level).map(k => k.key);
  }

  // Scales the game can ask: {root, mode:'major'|'mixolydian', name, notes, level}
  function allScales() {
    const out = [];
    MAJOR_KEYS.forEach(k => {
      out.push({ root: k.key, mode: 'major', name: k.key + ' major', notes: majorScale(k.key), level: keyLevel(k.key) });
    });
    MAJOR_KEYS.forEach(k => {
      const parent = parentMajor(k.key);
      if (!isMajorKey(parent)) return; // Cb Mixolydian would need Fb major
      const notes = mixolydian(k.key);
      if (notes.some(hasDouble)) return;
      out.push({ root: k.key, mode: 'mixolydian', name: k.key + ' Mixolydian', notes: notes, parent: parent, level: keyLevel(parent) });
    });
    return out;
  }

  function scalesForLevel(level) {
    return allScales().filter(s => s.level <= level);
  }

  // Chords the game can ask: {root, type, name, notes, level}
  function allChords() {
    const out = [];
    const seen = {};
    function add(rootNote, type, level) {
      const notes = chord(rootNote, type);
      if (notes.some(hasDouble)) return;
      const name = chordName(rootNote, type);
      if (seen[name]) return;
      seen[name] = true;
      out.push({ root: rootNote, type: type, name: name, longName: chordLongName(rootNote, type), notes: notes, level: level });
    }
    MAJOR_KEYS.forEach(k => {
      const lvl = keyLevel(k.key);
      add(k.key, 'maj', lvl);
      add(k.key, 'maj7', lvl);
      add(k.key, 'dom7', lvl);
      const minorRoot = k.minor.slice(0, -1); // relative minor, diatonic so no doubles
      add(minorRoot, 'min', lvl);
      add(minorRoot, 'min7', lvl);
    });
    return out;
  }

  function chordsForLevel(level) {
    return allChords().filter(c => c.level <= level);
  }

  // ---------------------------------------------------------------- 12 bar blues

  // Quick-change form with a V7 turnaround, every chord a dominant seventh.
  const BLUES_FORM = ['I', 'IV', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'];
  const BLUES_DEGREE_INDEX = { I: 0, IV: 3, V: 4 };

  function bluesChord(key, degree) {
    const rootNote = majorScale(key)[BLUES_DEGREE_INDEX[degree]];
    const notes = chord(rootNote, 'dom7');
    return { degree: degree, root: rootNote, type: 'dom7', name: chordName(rootNote, 'dom7'), notes: notes,
      pcs: notes.map(pitchClass), guide: [notes[1], notes[3]], guidePcs: [pitchClass(notes[1]), pitchClass(notes[3])] };
  }

  // 12 bars for a key: [{bar, degree, root, name, notes, pcs, guide, guidePcs}]
  function bluesProgression(key) {
    const cache = {};
    return BLUES_FORM.map((deg, i) => {
      if (!cache[deg]) cache[deg] = bluesChord(key, deg);
      const c = cache[deg];
      return { bar: i + 1, degree: deg, root: c.root, type: c.type, name: c.name, notes: c.notes, pcs: c.pcs, guide: c.guide, guidePcs: c.guidePcs };
    });
  }

  // Keys whose I7, IV7 and V7 all spell without double accidentals (13 of the 15).
  function bluesKeys() {
    return MAJOR_KEYS.map(k => k.key).filter(key => {
      return ['I', 'IV', 'V'].every(d => !bluesChord(key, d).notes.some(hasDouble));
    });
  }

  // ---------------------------------------------------------------- distractors

  // Alternate spelling of the same pitch with at most one accidental.
  function enharmonic(note) {
    const pc = pitchClass(note);
    const li = LETTERS.indexOf(note[0]);
    const cands = [LETTERS[(li + 1) % 7], LETTERS[(li + 6) % 7]];
    for (const L of cands) {
      const diff = ((pc - NATURAL_PC[L]) % 12 + 12) % 12;
      if (diff === 0) return L;
      if (diff === 1) return L + '#';
      if (diff === 11) return L + 'b';
    }
    return null;
  }

  function shuffle(arr, rng) {
    rng = rng || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Wrong spellings for a chord: respelled notes, half-step slips, wrong quality.
  function chordDistractors(ch, n, rng) {
    const correct = ch.notes.join(' ');
    const cands = [];
    const seen = {};
    seen[correct] = true;
    function push(notes) {
      if (notes.some(x => x === null || hasDouble(x))) return;
      const k = notes.join(' ');
      if (seen[k]) return;
      seen[k] = true;
      cands.push(notes);
    }
    // 1. one note respelled enharmonically (same sound, wrong letter)
    ch.notes.forEach((note, i) => {
      const alt = enharmonic(note);
      if (alt) { const c = ch.notes.slice(); c[i] = alt; push(c); }
    });
    // 2. other qualities on the same root
    Object.keys(CHORD_TYPES).forEach(t => {
      if (t === ch.type) return;
      try { push(chord(ch.root, t)); } catch (e) { /* unspellable */ }
    });
    // 3. one non-root note slipped a half step, same letter
    ch.notes.forEach((note, i) => {
      if (i === 0) return;
      try { const c = ch.notes.slice(); c[i] = lower(note); push(c); } catch (e) { /* skip */ }
      try { const c = ch.notes.slice(); c[i] = raise(note); push(c); } catch (e) { /* skip */ }
    });
    const first = cands.slice(0, ch.notes.length + 2); // favour respellings and quality errors
    const rest = cands.slice(ch.notes.length + 2);
    return shuffle(first, rng).concat(shuffle(rest, rng)).slice(0, n);
  }

  // Wrong note tiles for a scale: naturals of its accidentals, enharmonics, altered naturals.
  function scaleDistractors(scale, n, rng) {
    const have = {};
    scale.notes.forEach(x => { have[x] = true; });
    const cands = [];
    const seen = {};
    function push(x) {
      if (!x || have[x] || seen[x] || hasDouble(x)) return;
      seen[x] = true;
      cands.push(x);
    }
    scale.notes.forEach(note => {
      if (note.length > 1) { push(note[0]); push(enharmonic(note)); }
    });
    scale.notes.forEach(note => {
      if (note.length === 1) { push(note + '#'); push(note + 'b'); }
    });
    return shuffle(cands.slice(0, 4), rng).concat(shuffle(cands.slice(4), rng)).slice(0, n);
  }

  // ---------------------------------------------------------------- self-check

  function selfCheck() {
    const errors = [];
    const same = (a, b) => a.join(' ') === b.join(' ');

    // Every major key: derived scale, letters, signature order and count.
    MAJOR_KEYS.forEach(k => {
      const sc = majorScale(k.key);
      const letters = {};
      sc.forEach(x => { letters[x[0]] = true; });
      if (Object.keys(letters).length !== 7) errors.push(k.key + ': letters repeat ' + sc.join(' '));
      if (sc.some(hasDouble)) errors.push(k.key + ': double accidental ' + sc.join(' '));
      const acc = accidentals(sc);
      if (acc.length !== k.count) errors.push(k.key + ': count ' + acc.length + ' != ' + k.count);
      const kinds = {};
      acc.forEach(a => { kinds[a.indexOf('#') >= 0 ? 'sharp' : 'flat'] = true; });
      if (acc.length && (Object.keys(kinds).length !== 1 || !kinds[k.kind])) errors.push(k.key + ': mixed or wrong accidentals ' + acc.join(' '));
      const order = k.kind === 'sharp' ? SHARP_ORDER : FLAT_ORDER;
      if (k.count && !same(signature(k.key), order.slice(0, k.count))) errors.push(k.key + ': not in standard order ' + signature(k.key).join(' '));
      if (k.minor !== sc[5] + 'm') errors.push(k.key + ': relative minor ' + k.minor + ' != ' + sc[5] + 'm');
      for (let i = 0; i < 7; i++) {
        const step = (pitchClass(sc[(i + 1) % 7]) - pitchClass(sc[i]) + 12) % 12;
        if (step !== MAJOR_STEPS[i]) errors.push(k.key + ': step ' + i + ' is ' + step);
      }
    });

    // Circle neighbours are a fifth apart; new sharp is the 7th, new flat the 4th.
    for (let i = 0; i < CIRCLE.length; i++) {
      const c = CIRCLE[i], nxt = CIRCLE[(i + 1) % 12];
      if ((pitchClass(nxt.key) - pitchClass(c.key) + 12) % 12 !== 7) errors.push(c.key + ' -> ' + nxt.key + ' is not a fifth up');
      if ((c.kind === 'none' || c.kind === 'sharp') && nxt.kind === 'sharp' && nxt.count === c.count + 1) {
        const prev = signature(c.key);
        const added = signature(nxt.key).filter(a => prev.indexOf(a) < 0);
        if (!same(added, [majorScale(nxt.key)[6]])) errors.push(nxt.key + ': new sharp ' + added + ' is not the 7th');
      }
    }
    const ccw = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
    for (let i = 0; i + 1 < ccw.length; i++) {
      const prev = signature(ccw[i]);
      const added = signature(ccw[i + 1]).filter(a => prev.indexOf(a) < 0);
      if (!same(added, [majorScale(ccw[i + 1])[3]])) errors.push(ccw[i + 1] + ': new flat ' + added + ' is not the 4th');
    }

    // Mixolydian = parent major started on its 5th degree, parent one step ccw.
    ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb'].forEach(r => {
      const idx = CIRCLE.findIndex(c => c.key === r);
      const par = CIRCLE[(idx + 11) % 12].key;
      if (parentMajor(r) !== par) errors.push(r + ' Mixolydian parent ' + parentMajor(r) + ' != ' + par);
      const ps = majorScale(par);
      const rot = ps.slice(4).concat(ps.slice(0, 4));
      if (!same(rot, mixolydian(r))) errors.push(r + ' Mixolydian ' + mixolydian(r).join(' ') + ' != ' + par + ' major from 5th');
    });

    // Every askable scale: 7 unique letters, no doubles, correct interval pattern.
    allScales().forEach(s => {
      const letters = {};
      s.notes.forEach(x => { letters[x[0]] = true; });
      if (Object.keys(letters).length !== 7) errors.push(s.name + ': letters repeat');
      if (s.notes.some(hasDouble)) errors.push(s.name + ': double accidental');
      const steps = s.mode === 'major' ? MAJOR_STEPS : [2, 2, 1, 2, 2, 1, 2];
      for (let i = 0; i < 7; i++) {
        const step = (pitchClass(s.notes[(i + 1) % 7]) - pitchClass(s.notes[i]) + 12) % 12;
        if (step !== steps[i]) errors.push(s.name + ': step ' + i + ' is ' + step);
      }
      scaleDistractors(s, 5).forEach(d => {
        if (s.notes.indexOf(d) >= 0) errors.push(s.name + ': distractor ' + d + ' is in the scale');
      });
    });

    // Every askable chord: intervals, letters, no doubles, distractors never equal the answer.
    allChords().forEach(c => {
      const want = CHORD_INTERVALS[c.type];
      const rootPc = pitchClass(c.notes[0]);
      c.notes.forEach((note, i) => {
        if ((pitchClass(note) - rootPc + 12) % 12 !== want[i]) errors.push(c.name + ': interval ' + i + ' wrong in ' + c.notes.join(' '));
      });
      if (c.notes.some(hasDouble)) errors.push(c.name + ': double accidental');
      const letters = {};
      c.notes.forEach(x => { letters[x[0]] = true; });
      if (Object.keys(letters).length !== c.notes.length) errors.push(c.name + ': letters repeat');
      const li = LETTERS.indexOf(c.notes[0][0]);
      c.notes.forEach((note, i) => {
        if (note[0] !== LETTERS[(li + 2 * i) % 7]) errors.push(c.name + ': ' + note + ' is not stacked in thirds');
      });
      const ds = chordDistractors(c, 3);
      if (ds.length < 3) errors.push(c.name + ': only ' + ds.length + ' distractors');
      ds.forEach(d => {
        if (d.join(' ') === c.notes.join(' ')) errors.push(c.name + ': distractor equals answer');
      });
    });

    // 12 bar blues: every playable key, 12 bars, dom7 on I IV V, right degrees.
    const bk = bluesKeys();
    if (bk.length !== 13 || bk.indexOf('Gb') >= 0 || bk.indexOf('Cb') >= 0) errors.push('blues keys should be the 13 keys without Gb and Cb: ' + bk.join(' '));
    bk.forEach(key => {
      const prog = bluesProgression(key);
      if (prog.length !== 12) errors.push(key + ' blues: ' + prog.length + ' bars');
      if (prog.map(b => b.degree).join(' ') !== BLUES_FORM.join(' ')) errors.push(key + ' blues: wrong form');
      const sc = majorScale(key);
      prog.forEach(b => {
        const wantRoot = sc[BLUES_DEGREE_INDEX[b.degree]];
        if (b.root !== wantRoot) errors.push(key + ' blues bar ' + b.bar + ': root ' + b.root + ' != ' + wantRoot);
        if (b.notes.some(hasDouble)) errors.push(key + ' blues bar ' + b.bar + ': double accidental');
        const rootPc = pitchClass(b.root);
        b.notes.forEach((n, i) => {
          if ((pitchClass(n) - rootPc + 12) % 12 !== CHORD_INTERVALS.dom7[i]) errors.push(key + ' blues ' + b.name + ': interval ' + i + ' wrong');
        });
        if (b.guide.join(' ') !== b.notes[1] + ' ' + b.notes[3]) errors.push(key + ' blues ' + b.name + ': guide tones wrong');
      });
    });

    // Golden answers, the ones a teacher would check first.
    const golden = [
      ['sig', 'C', []],
      ['sig', 'G', ['F#']],
      ['sig', 'D', ['F#', 'C#']],
      ['sig', 'A', ['F#', 'C#', 'G#']],
      ['sig', 'E', ['F#', 'C#', 'G#', 'D#']],
      ['sig', 'B', ['F#', 'C#', 'G#', 'D#', 'A#']],
      ['sig', 'F#', ['F#', 'C#', 'G#', 'D#', 'A#', 'E#']],
      ['sig', 'C#', ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#']],
      ['sig', 'F', ['Bb']],
      ['sig', 'Bb', ['Bb', 'Eb']],
      ['sig', 'Eb', ['Bb', 'Eb', 'Ab']],
      ['sig', 'Ab', ['Bb', 'Eb', 'Ab', 'Db']],
      ['sig', 'Db', ['Bb', 'Eb', 'Ab', 'Db', 'Gb']],
      ['sig', 'Gb', ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']],
      ['sig', 'Cb', ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb']],
      ['major', 'F#', ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']],
      ['major', 'Gb', ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F']],
      ['major', 'Cb', ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb']],
      ['mix', 'D', ['D', 'E', 'F#', 'G', 'A', 'B', 'C']],
      ['mix', 'G', ['G', 'A', 'B', 'C', 'D', 'E', 'F']],
      ['mix', 'A', ['A', 'B', 'C#', 'D', 'E', 'F#', 'G']],
      ['mix', 'Bb', ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'Ab']],
      ['mix', 'E', ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D']],
      ['mix', 'F', ['F', 'G', 'A', 'Bb', 'C', 'D', 'Eb']],
      ['chord', ['G', 'dom7'], ['G', 'B', 'D', 'F']],
      ['chord', ['C', 'maj7'], ['C', 'E', 'G', 'B']],
      ['chord', ['D', 'min'], ['D', 'F', 'A']],
      ['chord', ['D', 'min7'], ['D', 'F', 'A', 'C']],
      ['chord', ['Bb', 'dom7'], ['Bb', 'D', 'F', 'Ab']],
      ['chord', ['F#', 'min'], ['F#', 'A', 'C#']],
      ['chord', ['Eb', 'maj7'], ['Eb', 'G', 'Bb', 'D']],
      ['chord', ['E', 'dom7'], ['E', 'G#', 'B', 'D']],
      ['chord', ['Ab', 'min7'], ['Ab', 'Cb', 'Eb', 'Gb']],
      ['chord', ['C#', 'dom7'], ['C#', 'E#', 'G#', 'B']],
      ['chord', ['Gb', 'maj7'], ['Gb', 'Bb', 'Db', 'F']],
      ['chord', ['B', 'min7'], ['B', 'D', 'F#', 'A']],
      ['blues', 'G', ['G7', 'C7', 'G7', 'G7', 'C7', 'C7', 'G7', 'G7', 'D7', 'C7', 'G7', 'D7']],
      ['bluesnotes', 'F', ['F A C Eb', 'Bb D F Ab', 'C E G Bb']],
      ['bluesnotes', 'G', ['G B D F', 'C E G Bb', 'D F# A C']],
      ['bluesnotes', 'E', ['E G# B D', 'A C# E G', 'B D# F# A']],
      ['bluesnotes', 'Bb', ['Bb D F Ab', 'Eb G Bb Db', 'F A C Eb']],
      ['bluesnotes', 'F#', ['F# A# C# E', 'B D# F# A', 'C# E# G# B']],
    ];
    golden.forEach(g => {
      let got;
      if (g[0] === 'sig') got = signature(g[1]);
      else if (g[0] === 'major') got = majorScale(g[1]);
      else if (g[0] === 'mix') got = mixolydian(g[1]);
      else if (g[0] === 'blues') got = bluesProgression(g[1]).map(b => b.name);
      else if (g[0] === 'bluesnotes') got = ['I', 'IV', 'V'].map(d => bluesChord(g[1], d).notes.join(' '));
      else got = chord(g[1][0], g[1][1]);
      if (!same(got, g[2])) errors.push('golden ' + g[0] + ' ' + g[1] + ': ' + got.join(' ') + ' != ' + g[2].join(' '));
    });
    if (MAJOR_KEYS.length !== 15) errors.push('expected 15 major keys, have ' + MAJOR_KEYS.length);
    if (keysForLevel(1).length !== 5) errors.push('level 1 should hold 5 keys');
    if (keysForLevel(2).length !== 9) errors.push('level 2 should hold 9 keys');
    if (keysForLevel(3).length !== 15) errors.push('level 3 should hold 15 keys');
    return errors;
  }

  const Theory = {
    LETTERS, NATURAL_PC, SHARP_ORDER, FLAT_ORDER, CIRCLE, MAJOR_KEYS, CHORD_TYPES,
    pitchClass, spell, hasDouble, majorScale, accidentals, signature, mixolydian, parentMajor,
    keyInfo, isMajorKey, chord, chordName, chordLongName, display, enharmonic,
    keyLevel, keysForLevel, allScales, scalesForLevel, allChords, chordsForLevel,
    chordDistractors, scaleDistractors, shuffle, selfCheck,
    BLUES_FORM, bluesChord, bluesProgression, bluesKeys,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Theory;
  else root.Theory = Theory;
})(typeof window !== 'undefined' ? window : globalThis);
