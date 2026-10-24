/* Chord Drop: the song model. Parsing chord text, meters, timing math, chord voicings.
   Time is counted in ticks, 12 to a quarter note, so 16ths (3), 8ths (6) and swung 8ths all land on whole numbers. */
(function () {
  const CD = (window.CD = window.CD || {});
  const TPQ = 12;
  CD.TPQ = TPQ;

  CD.METERS = ['4/4', '3/4', '2/4', '6/8', '12/8'];

  CD.meterInfo = function (meter) {
    const [num, den] = meter.split('/').map(Number);
    const compound = den === 8 && num % 3 === 0;
    const unit = den === 4 ? TPQ : TPQ / 2;
    const barTicks = num * unit;
    const beatTicks = compound ? unit * 3 : unit;
    // the half of the bar a note should not hide (beat 3 in 4/4)
    let groupTicks = barTicks;
    if (meter === '4/4') groupTicks = 24;
    if (meter === '12/8') groupTicks = 36;
    return {
      meter, num, den, compound, unit, barTicks, beatTicks, groupTicks,
      beats: barTicks / beatTicks,
      barsPerLine: meter === '12/8' ? 2 : 4,
    };
  };

  CD.GROOVES = {
    click: { label: 'Click', blurb: 'A plain click on every beat.' },
    rock: { label: 'Rock', blurb: 'Straight eighths, kick and snare.', grid: '8' },
    shuffle: { label: 'Shuffle', blurb: 'Swung eighths. The blues feel.', grid: '8s' },
    funk: { label: 'Funk', blurb: 'Busy sixteenths for tight pushes.', grid: '16' },
  };

  CD.GRIDS = {
    beat: 'Beats only',
    '8': '8th notes',
    '8s': 'Swung 8th notes',
    '16': '16th notes',
  };

  CD.gridTicks = function (grid, mi) {
    if (grid === 'beat') return mi.beatTicks;
    if (grid === '16') return 3;
    return 6;
  };

  CD.isSwing = (song, mi) => song.grid === '8s' && !mi.compound;

  // Chords are stored straight. When swing is on, the "and" of each beat plays two thirds of the way through it.
  CD.swingTick = function (t, swing) {
    if (!swing) return t;
    const b = Math.floor(t / TPQ) * TPQ;
    return t - b === 6 ? b + 8 : t;
  };

  CD.quantize = function (tickF, grid, mi) {
    if (grid === '8s' && !mi.compound) {
      const b = Math.floor(tickF / TPQ);
      const f = tickF / TPQ - b;
      const options = [[0, 0], [2 / 3, 6], [1, 12]];
      let best = options[0];
      for (const o of options) if (Math.abs(f - o[0]) < Math.abs(f - best[0])) best = o;
      return b * TPQ + best[1];
    }
    const g = CD.gridTicks(grid, mi);
    return Math.round(tickF / g) * g;
  };

  /* ---------- chord symbols ---------- */

  const QUAL = '(?:maj|Maj|min|dim|aug|sus|add|alt|m|M|Δ|ø|°|o|\\+|-|\\d+|b|#|\\(|\\)|,|\\/(?=\\d))*';
  const CHORD_RE = new RegExp('^([A-G])([#b]?)(' + QUAL + ')(?:\\/([A-G][#b]?))?$');
  const NC_RE = /^N\.?C\.?$/i;

  function normTok(t) {
    t = t.replace(/♯/g, '#').replace(/♭/g, 'b');
    // lowercase roots are fine if the rest reads as a chord ("g", "am7")
    if (/^[a-g]/.test(t)) {
      const up = t[0].toUpperCase() + t.slice(1);
      if (CHORD_RE.test(up)) return up;
    }
    return t;
  }
  CD.normTok = normTok;
  CD.isNC = (tok) => NC_RE.test(tok);
  CD.isChord = (tok) => CHORD_RE.test(tok) || NC_RE.test(tok);

  const ACC = { '#': '♯', b: '♭', '': '' };
  CD.chordParts = function (sym) {
    if (NC_RE.test(sym)) return { root: 'N.C.', qual: '', bass: '' };
    const m = sym.match(CHORD_RE);
    if (!m) return { root: sym, qual: '', bass: '' };
    const fix = (s) => s.replace(/b(?=\d)/g, '♭').replace(/#(?=\d)/g, '♯');
    return {
      root: m[1] + ACC[m[2]],
      qual: fix(m[3]),
      bass: m[4] ? m[4][0] + ACC[m[4].slice(1)] : '',
    };
  };
  CD.prettyChord = function (sym) {
    const p = CD.chordParts(sym);
    return p.root + p.qual + (p.bass ? '/' + p.bass : '');
  };

  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const pcOf = (l, acc) => (PC[l] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12;
  const wrap = (n, lo) => lo + (((n - lo) % 12) + 12) % 12;

  // A plain voicing for playback: a bass note around E2 and close chord tones above G3.
  CD.chordNotes = function (sym) {
    const m = normTok(sym).match(CHORD_RE);
    if (!m) return null;
    const root = pcOf(m[1], m[2]);
    const q = m[3];
    let third = 4, fifth = 7, ext = [];
    let body = q;
    const minor = /^(m(?!aj)|min|-)/.test(body);
    if (minor) { third = 3; body = body.replace(/^(min|m|-)/, ''); }
    if (/^(dim|°|o)/.test(q)) {
      third = 3; fifth = 6; body = '';
      if (/7/.test(q)) ext.push(9);
    } else if (/^ø/.test(q) || /^(m|min|-)7b5/.test(q)) {
      third = 3; fifth = 6; ext = [10]; body = '';
    } else if (/^(aug|\+)/.test(q)) {
      fifth = 8; body = body.replace(/^(aug|\+)/, '');
    }
    if (body) {
      if (/^\(?(maj|Maj|M|Δ)/.test(body)) { ext.push(11); if (/(9|11|13)/.test(body)) ext.push(14); }
      else if (/^(7|9|11|13)/.test(body)) { ext.push(10); if (/^(9|11|13)/.test(body)) ext.push(14); }
      else if (/^6/.test(body)) { ext.push(9); if (/^6\/?9/.test(body)) ext.push(14); }
      else if (/^5/.test(body)) third = null;
      if (/add(9|2)/.test(body)) ext.push(14);
      if (/add(4|11)/.test(body)) ext.push(5);
      if (/sus2/.test(body)) third = 2;
      else if (/sus/.test(body)) third = 5;
      if (/b5/.test(body)) fifth = 6;
      if (/#5|\+5/.test(body)) fifth = 8;
      if (/b9/.test(body)) { ext = ext.filter((x) => x !== 14); ext.push(13); }
      if (/#9/.test(body)) { ext = ext.filter((x) => x !== 14); ext.push(15); }
    }
    const iv = [0];
    if (third !== null) iv.push(third);
    iv.push(fifth, ...ext);
    const bassPc = m[4] ? pcOf(m[4][0], m[4].slice(1)) : root;
    const upper = [...new Set(iv.map((i) => wrap(root + i, 55)))].sort((a, b) => a - b);
    return { bass: wrap(bassPc, 40), upper };
  };

  /* ---------- parsing the chord text ---------- */

  const SEC = '(?:intro|verse|chorus|pre[- ]?chorus|bridge|outro|solo|interlude|tag|coda|instrumental|break|breakdown|refrain|hook|turnaround|vamp|ending|middle ?8|riff|head)';
  const SECTION_WORDS = new RegExp('^' + SEC + '\\b', 'i');
  // "Chorus" or "Verse 2" alone on a line, the way pasted chord sheets mark sections
  const BARE_HEAD = new RegExp('^' + SEC + '(?:\\s*\\d+)?(?:\\s*(?:[x×]\\s*\\d+|\\(\\s*\\d+\\s*[x×]\\s*\\)))?$', 'i');
  const REP_RE = /\s(?:\(?\s*[x×]\s*(\d+)\s*\)?|\(?\s*(\d+)\s*[x×]\s*\)?)\s*$/i;
  const REP_ONLY = /^\(?\s*(?:[x×]\s*\d+|\d+\s*[x×])\s*\)?$/i;
  const HOLD = /^[\/|.\-%]+$/;
  const keyOf = (name) => name.toLowerCase().replace(/\s+/g, ' ').trim();
  const baseOf = (name) => keyOf(name.replace(/\s*\d+$/, ''));
  const untab = (s) => s.replace(/[^\t]*\t/g, (m) => { const pre = m.slice(0, -1); return pre + ' '.repeat(8 - (pre.length % 8)); });

  // A line is chords when chord symbols outnumber words: "A man walked in" is words, "G C Dd G" is chords with a typo.
  function isChordLine(text) {
    if (text.includes('|')) return true;
    let c = 0, w = 0;
    for (const t of text.replace(REP_RE, '').replace(/,/g, ' ').split(/\s+/).filter(Boolean)) {
      const n = normTok(t);
      if (CD.isChord(n)) c++;
      else if (!HOLD.test(n)) w++;
    }
    return w === 0 || c > w;
  }

  // ChordPro: "[G]Woke up this [C]morning". A lone "[A]" or "[A] G C D" is still a section name.
  function isChordPro(text) {
    const tags = text.match(/\[[^\]]*\]/g);
    if (!tags || !tags.some((t) => CD.isChord(normTok(t.slice(1, -1).trim())))) return false;
    const outside = text.replace(/\[[^\]]*\]/g, ' ').trim();
    return tags.length >= 2 || (!!outside && !isChordLine(outside));
  }

  // Words ending mid-word before the next chord get a hyphen ("mor- ning").
  function tidy(frags) {
    frags.forEach((f, j) => {
      const nx = frags[j + 1];
      f.hy = !!(nx && /[A-Za-z']$/.test(f.text) && /^[A-Za-z']/.test(nx.text));
    });
    frags.forEach((f) => (f.text = f.text.replace(/\s+/g, ' ').trim()));
    return frags;
  }

  // own: section keys that stay their own section even when their chords match another (copies).
  CD.parseSong = function (text, own) {
    own = own || [];
    const sections = [];
    const form = [];
    const formLyrics = [];  // per entry in form: the words for that pass, or null
    const formInfo = [];    // per entry in form: the header it came from and the lines it covers
    const rewrites = {};    // line number -> the line with its words taken out (null drops the line)
    const warnings = [];
    const byKey = {};
    const skipped = new Set();
    let header = null;

    // A words-only verse ("[Verse 2]" with just lyrics) borrows the line starts of the verse it repeats.
    const fitLines = (w, starts) => (w.every((l) => l.frags[0].ci === null) && w.length === starts.length
      ? w.map((l, k) => ({ frags: [{ ...l.frags[0], ci: starts[k] }] }))
      : w);

    function close() {
      if (!header) return;
      let name = header.name.trim() || 'Song';
      let times = 1;
      const tm = name.match(/^(.*?)\s*(?:[x×]\s*(\d+)|\(\s*(\d+)\s*[x×]\s*\))\s*$/i);
      if (tm && tm[1]) { name = tm[1].trim(); times = +(tm[2] || tm[3]); }
      const { chords, bars, lyr, starts, src, chordLines } = readLines(header.lines, name);
      const key = keyOf(name), base = baseOf(name);
      const words = lyr.length ? lyr : null;
      const end = Math.max(header.idx === null ? -1 : header.idx, ...header.lines.map((l) => l.idx));
      const info = { head: header.idx, name, times, chords: chords.length > 0, end };
      const use = (idx, w) => {
        if (form.includes(idx)) sections[idx].name = sections[idx].name.replace(/\s+1$/, '');
        for (let i = 0; i < times; i++) { form.push(idx); formLyrics.push(w); formInfo.push(info); }
      };
      if (!chords.length) {
        const idx = byKey[key] !== undefined ? byKey[key] : sections.findIndex((s) => s.base === base);
        if (idx >= 0) use(idx, words && fitLines(words, sections[idx].starts));
        else warnings.push(`${name} has no chords yet. Type them under its name.`);
      } else {
        const barsKey = JSON.stringify(bars.length ? bars : null);
        const same = own.includes(key) ? -1 : sections.findIndex((s) => s.base === base && s.chords.join(' ') === chords.join(' ') && JSON.stringify(s.bars) === barsKey);
        if (same >= 0) {
          // sung again with its own words: once the words move out, it only needs its name
          if (words) chordLines.forEach((l) => (rewrites[l.idx] = l.pre || null));
          use(same, words); header = null; return;
        }
        let k = key, shown = name;
        if (byKey[k] !== undefined) {
          let n = 2;
          while (byKey[`${key}#${n}`] !== undefined) n++;
          k = `${key}#${n}`;
          if (!/\d$/.test(name)) shown = `${name} ${n}`;
        }
        byKey[k] = sections.length;
        sections.push({ key: k, name: shown, base, chords, bars: bars.length ? bars : null, starts, src, end });
        use(sections.length - 1, words);
      }
      header = null;
    }

    function readLines(lines, name) {
      const chords = [], bars = [], lyr = [], starts = [], chordLines = [], src = [];
      const kind = lines.map((l) => {
        const t = l.text.trim();
        if (isChordPro(t)) return 'pro';
        if (REP_ONLY.test(t)) return 'skip';
        return isChordLine(l.text) ? 'chords' : 'words';
      });
      const barMode = lines.some((l, i) => kind[i] === 'chords' && l.text.includes('|'));
      let above = null; // the chord line right above, for words written under it

      lines.forEach((l, i) => {
        if (kind[i] === 'skip') return;
        if (kind[i] === 'pro') {
          const p = readChordPro(l.text, name);
          rewrites[l.idx] = (l.pre ? l.pre + ' ' : '') + p.chords.join(' ');
          if (p.chords.length) { chordLines.push(l); src.push(p.chords.join(' ')); }
          const base = chords.length;
          if (p.chords.length) starts.push(base);
          chords.push(...p.chords);
          const frags = p.frags.map((f) => ({ ci: base + f.k, text: f.text, hy: f.hy }));
          if (frags.some((f) => f.text)) lyr.push({ frags });
          above = null;
          return;
        }
        if (kind[i] === 'words') {
          rewrites[l.idx] = l.pre || null;
          // the chord line it sat under no longer needs its spacing
          if (above && above.cols && !(above.idx in rewrites)) rewrites[above.idx] = above.raw.trim().replace(/\s+/g, ' ');
          lyr.push({ frags: above ? under(above, l) : [{ ci: null, text: l.text.trim(), hy: false }] });
          above = null;
          return;
        }
        let line = l.text.replace(/,/g, ' ');
        let rep = 1;
        const rm = line.match(REP_RE);
        if (rm) { rep = +(rm[1] || rm[2]); line = line.slice(0, rm.index); }
        const lineChords = [], lineBars = [];
        if (barMode) {
          for (const part of line.split('|')) {
            let toks = part.trim().split(/\s+/).filter(Boolean).map(normTok);
            if (!toks.length) continue;
            if (toks.length === 1 && toks[0] === '%') {
              const prev = lineBars.length ? lineBars[lineBars.length - 1] : bars[bars.length - 1];
              if (!prev) continue;
              toks = prev.slice();
            }
            const slots = [];
            for (const t of toks) {
              if (t === '/' || t === '.' || t === '-') slots.push('/');
              else if (CD.isChord(t)) { slots.push(t); lineChords.push(t); }
              else skip(t, name);
            }
            if (slots.length) lineBars.push(slots);
          }
        } else {
          for (const t of line.split(/\s+/).filter(Boolean).map(normTok)) {
            if (CD.isChord(t)) lineChords.push(t);
            else if (!/^[\/|.\-]+$/.test(t)) skip(t, name);
          }
        }
        const base = chords.length;
        for (let r = 0; r < rep; r++) { chords.push(...lineChords); bars.push(...lineBars); }
        if (lineChords.length || lineBars.length) { chordLines.push(l); src.push(l.text.trim().replace(/\s+/g, ' ')); }
        if (lineChords.length) {
          starts.push(base);
          above = { base, n: lineChords.length, raw: l.text, cols: l.cols, idx: l.idx };
        } else above = null;
      });
      return { chords, bars, lyr, starts, src, chordLines };
    }

    // Words under a chord line. When the chords were spaced out over the words, each chord gets the
    // words from its column up to the next chord's. Otherwise the whole line starts with the line's first chord.
    function under(above, l) {
      const text = l.text;
      const whole = [{ ci: above.base, text: text.trim(), hy: false }];
      if (!above.cols || !l.cols || above.n < 2) return whole;
      const cols = [];
      const re = /[^\s|,]+/g;
      const raw = above.raw.replace(REP_RE, '');
      let m;
      while ((m = re.exec(raw))) if (CD.isChord(normTok(m[0]))) cols.push(m.index);
      if (cols.length !== above.n) return whole;
      if (!/^\s|\S {2,}\S/.test(raw)) return whole; // "G C D G" typed with single spaces isn't lined up with anything
      const ws = (i) => i >= 0 && i < text.length && text[i] !== ' ' && (i === 0 || text[i - 1] === ' ');
      const inside = cols.slice(1).filter((c) => c < text.length);
      if (!inside.length) return whole;
      // spaced on purpose? Most chords should sit on the start of a word.
      const hits = inside.filter((c) => ws(c) || (text[c] === ' ' && ws(c + 1))).length;
      if (hits / inside.length < 0.5) return whole;
      const cuts = cols.map((c, j) => (j === 0 ? 0 : !ws(c) && ws(c + 1) ? c + 1 : c));
      return tidy(cuts.map((c, j) => ({ ci: above.base + j, text: text.slice(c, j + 1 < cuts.length ? cuts[j + 1] : undefined) })));
    }

    function readChordPro(text, name) {
      const parts = text.trim().split(/\[([^\]]*)\]/);
      const chords = [], frags = [];
      let pickup = parts[0];
      for (let i = 1; i < parts.length; i += 2) {
        const c = normTok(parts[i].trim());
        const after = parts[i + 1] || '';
        if (CD.isChord(c)) { chords.push(c); frags.push({ k: chords.length - 1, text: after }); continue; }
        skip(parts[i], name);
        if (frags.length) frags[frags.length - 1].text += after;
        else pickup += after;
      }
      if (frags.length) frags[0].text = pickup + frags[0].text;
      return { chords, frags: tidy(frags) };
    }

    function skip(t, name) {
      const k = `${t}|${name}`;
      if (skipped.has(k)) return;
      skipped.add(k);
      if (skipped.size <= 6) warnings.push(`Skipped "${t}" in ${name}. It doesn't read as a chord.`);
    }

    text.split(/\r?\n/).forEach((raw0, idx) => {
      const raw = untab(raw0).replace(/\s+$/, '');
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) return;
      if (isChordPro(line)) {
        if (!header) header = { name: 'Song', lines: [], idx: null };
        header.lines.push({ text: raw, cols: true, idx });
        return;
      }
      let name = null, rest = '';
      let m = line.match(/^\[([^\]]*)\]\s*(.*)$/);
      if (m) { name = m[1]; rest = m[2]; }
      else if ((m = line.match(/^([A-Za-z][A-Za-z0-9 '\-]*?)\s*:\s*(.*)$/)) && SECTION_WORDS.test(m[1])) { name = m[1]; rest = m[2]; }
      else if (BARE_HEAD.test(line)) name = line;
      if (name !== null) {
        close();
        header = { name, lines: [], idx };
        if (rest) header.lines.push({ text: rest, cols: false, idx, pre: line.slice(0, line.length - rest.length).trim() });
        return;
      }
      if (!header) header = { name: 'Song', lines: [], idx: null };
      header.lines.push({ text: raw, cols: true, idx });
    });
    close();
    if (skipped.size > 6) warnings.push(`...and ${skipped.size - 6} more words skipped.`);
    return { sections, form, formLyrics, formInfo, rewrites, warnings };
  };

  // The chord text with every line of words taken out (they move to the word boxes).
  CD.stripWords = function (text, rewrites) {
    const out = [];
    text.split(/\r?\n/).forEach((line, i) => {
      if (!(i in rewrites)) out.push(line);
      else if (rewrites[i] !== null) out.push(rewrites[i]);
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n');
  };

  // Words typed in boxes, one per chord, as the line the chart draws. A box ending in "-" carries on the word.
  // shifts: ticks each box's words start after (or before) its chord, from nudging them on the chart.
  CD.verseLine = (verse, shifts) => [{ frags: verse.map((t, ci) => ({ ci, sh: (shifts && +shifts[ci]) || 0, text: String(t || '').replace(/-\s*$/, '').trim(), hy: /\S-\s*$/.test(t || '') })) }];

  /* ---------- rhythm for a section ---------- */

  // Bar lines typed in the text: every token in a bar gets an equal slot, "/" holds the chord.
  CD.prefillFromBars = function (bars, mi) {
    const BT = mi.barTicks, ev = [];
    bars.forEach((slots, b) => {
      const n = slots.length;
      slots.forEach((tok, k) => {
        if (tok === '/') return;
        let t = b * BT + Math.round((k * BT) / n / 3) * 3;
        if (ev.length && t <= ev[ev.length - 1]) t = ev[ev.length - 1] + 3;
        ev.push(t);
      });
    });
    if (ev.length) ev[0] = 0;
    return { events: ev, length: bars.length * BT };
  };

  CD.evenRhythm = function (sec, mi) {
    return {
      events: sec.chords.map((_, i) => i * mi.barTicks),
      length: Math.max(1, sec.chords.length) * mi.barTicks,
    };
  };

  // source: 'tap' (tapped or edited), 'bars' (typed bar lines), 'even' (not tapped yet), 'stale' (chords changed since tapping)
  CD.resolveRhythm = function (sec, song, mi) {
    const r = song.rhythms && song.rhythms[sec.key];
    if (r && r.meter === song.meter && r.events && r.events.length === sec.chords.length) {
      return { events: r.events.slice(), length: r.length, tapped: true, source: 'tap' };
    }
    if (sec.bars) {
      const p = CD.prefillFromBars(sec.bars, mi);
      if (p.events.length === sec.chords.length) return { ...p, tapped: true, source: 'bars' };
    }
    const stale = !!(r && r.meter === song.meter);
    return { ...CD.evenRhythm(sec, mi), tapped: false, source: stale ? 'stale' : 'even' };
  };

  CD.formText = function (parsed) {
    const names = parsed.form.map((i) => parsed.sections[i].name);
    const out = [];
    for (const n of names) {
      const last = out[out.length - 1];
      if (last && last.name === n) last.times++;
      else out.push({ name: n, times: 1 });
    }
    return out.map((o) => (o.times > 1 ? `${o.name} ×${o.times}` : o.name)).join('  →  ');
  };
})();
