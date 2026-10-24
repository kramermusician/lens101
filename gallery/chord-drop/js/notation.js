/* Chord Drop: the chart. Each section becomes rows of bars drawn in SVG: chord symbols spaced by
   where they land in time, over a rhythm line in slash notation (or plain beat slashes). */
(function () {
  const CD = window.CD;
  const NS = 'http://www.w3.org/2000/svg';
  const W = 720;
  const MID = 84;               // middle staff line
  const S = 7;                  // staff space
  const STAFF_TOP = MID - 2 * S;
  const STAFF_BOT = MID + 2 * S;
  const STEM_TOP = MID - 34;
  const SYS_H = 122;
  const LABEL_Y = 44;
  const LABEL_Y2 = 22;
  const LYR_Y = STAFF_BOT + 27;  // first line of words, clear of the ties
  const LYR_GAP = 19;
  const LYR_FS = 14;

  // note values, longest first: [ticks, base, dots]
  const DURS = [[72, 'w', 1], [48, 'w', 0], [36, 'h', 1], [24, 'h', 0], [18, 'q', 1], [12, 'q', 0], [9, 'e', 1], [6, 'e', 0], [3, 's', 0]];

  // May a note of length d start at s and still show where the beats are?
  function legal(s, d, mi) {
    const B = mi.beatTicks, G = mi.groupTicks;
    if (s + d > mi.barTicks) return false;
    const crosses = Math.floor(s / G) !== Math.floor((s + d - 1) / G);
    if (d > B) {
      if (s % B) return false;
      if (mi.compound && d % B) return false;
      if (crosses && s !== 0) return !mi.compound && d === 2 * B; // quarter, half, quarter
      return true;
    }
    if (d === B) {
      if (s % B === 0) return true;
      return !mi.compound && s % (B / 2) === 0 && !crosses; // eighth, quarter, eighth
    }
    return Math.floor(s / B) === Math.floor((s + d - 1) / B);
  }

  // Break every chord into notes bar by bar, tied where a chord keeps ringing.
  function spell(block, mi) {
    const BT = mi.barTicks, out = [];
    const nBars = Math.max(1, Math.round(block.length / BT));
    const ev = block.events;
    for (let bar = 0; bar < nBars; bar++) {
      const bs = bar * BT, be = bs + BT;
      for (let i = 0; i < ev.length; i++) {
        const s = ev[i], e = Math.min(i + 1 < ev.length ? ev[i + 1] : block.length, block.length);
        const a = Math.max(s, bs), z = Math.min(e, be);
        if (z <= a) continue;
        const rest = CD.isNC(block.chords[i]);
        let p = a - bs, first = true;
        const end = z - bs;
        while (p < end) {
          let pick = null;
          for (const d of DURS) if (d[0] <= end - p && legal(p, d[0], mi)) { pick = d; break; }
          if (!pick) pick = [Math.min(3, end - p), 's', 0];
          out.push({ bar, start: p, dur: pick[0], base: pick[1], dots: pick[2], ci: i, rest, chordStart: first && a === s, tieNext: false });
          p += pick[0];
          first = false;
        }
      }
    }
    for (let k = 0; k + 1 < out.length; k++) {
      if (!out[k].rest && out[k].ci === out[k + 1].ci) out[k].tieNext = true;
    }
    return out;
  }
  CD.spell = spell;

  /* ---------- svg helpers ---------- */

  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function div(cls, text) {
    const d = document.createElement('div');
    d.className = cls;
    if (text !== undefined) d.textContent = text;
    return d;
  }

  const headPts = (x) => `${x},${MID + 7} ${x + 6.5},${MID + 7} ${x + 13},${MID - 7} ${x + 6.5},${MID - 7}`;
  const STEM_X = 12.3;

  function drawHead(g, x, hollow, a) {
    el('polygon', { points: headPts(x), class: hollow ? 'head hollow' : 'head', ...a }, g);
  }

  function drawFlags(g, sx, count, a) {
    for (let k = 0; k < count; k++) {
      const y = STEM_TOP + k * 7;
      el('path', { d: `M${sx},${y} C${sx + 1},${y + 6} ${sx + 10},${y + 8} ${sx + 8},${y + 18} C${sx + 8},${y + 12} ${sx + 3},${y + 10} ${sx},${y + 8} Z`, class: 'ink', ...a }, g);
    }
  }

  function drawRest(g, n, x, a) {
    const cx = x + 6;
    if (n.base === 'w') el('rect', { x: cx - 6, y: MID - 7, width: 12, height: 4, class: 'ink', ...a }, g);
    else if (n.base === 'h') el('rect', { x: cx - 6, y: MID - 4, width: 12, height: 4, class: 'ink', ...a }, g);
    else if (n.base === 'q') {
      el('path', { d: `M${cx - 2},${MID - 13} l6,7 l-5,6 l6,7 c-5,-2 -8,1 -4,6 c-7,-3 -6,-10 1,-8 l-6,-6 l5,-6 z`, class: 'ink', ...a }, g);
    } else {
      const flags = n.base === 's' ? 2 : 1;
      el('path', { d: `M${cx + 4},${MID - 6} L${cx - 1},${MID + 10}`, class: 'stroke', 'stroke-width': 1.4, ...a }, g);
      for (let k = 0; k < flags; k++) {
        el('circle', { cx: cx - 2 - k * 1.5, cy: MID - 5 + k * 6, r: 2.1, class: 'ink', ...a }, g);
        el('path', { d: `M${cx - 2 - k * 1.5},${MID - 4 + k * 6} Q${cx + 1},${MID - 3 + k * 6} ${cx + 4 - k * 1.8},${MID - 6 + k * 6}`, class: 'stroke', 'stroke-width': 1.2, fill: 'none', ...a }, g);
      }
    }
    if (n.dots) el('circle', { cx: x + 17, cy: MID - 3.5, r: 1.9, class: 'ink', ...a }, g);
  }

  function tiePath(x1, x2) {
    const y = STAFF_BOT + 6, w = x2 - x1;
    return `M${x1},${y} C${x1 + w * 0.25},${y + 8} ${x2 - w * 0.25},${y + 8} ${x2},${y} C${x2 - w * 0.25},${y + 5.5} ${x1 + w * 0.25},${y + 5.5} ${x1},${y} Z`;
  }

  function labelWidth(sym, fs) {
    const p = CD.chordParts(sym);
    return p.root.length * fs * 0.62 + p.qual.length * fs * 0.42 + (p.bass ? (p.bass.length + 1) * fs * 0.6 : 0);
  }

  let mctx = null;
  function textW(str, fs) {
    mctx = mctx || document.createElement('canvas').getContext('2d');
    mctx.font = `${fs}px Georgia, "Times New Roman", serif`;
    return mctx.measureText(str).width;
  }

  // One line of words across one row: each starts under its chord, or just after the words before it
  // when those run long. The whole row steps down a size until it fits, then squeezes as a last resort.
  function drawWordRow(svg, items, y, end) {
    items.sort((a, b) => a.x - b.x);
    let fs, xs, px;
    for (fs of [LYR_FS, 13, 12, 11]) {
      px = -Infinity;
      xs = items.map((it) => { const w = textW(it.text, fs); const x = Math.max(it.x, px + fs * 0.45); px = x + w; return { x, w }; });
      if (px <= end) break;
    }
    const start = xs[0].x, k = px > end ? (end - start) / (px - start) : 1;
    items.forEach((it, i) => {
      const t = el('text', { x: (start + (xs[i].x - start) * k).toFixed(1), y, class: it.sel ? 'lyric sel' : 'lyric', 'font-size': fs, ...it.a }, svg);
      if (k < 1) { t.setAttribute('textLength', (xs[i].w * k).toFixed(1)); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
      t.textContent = it.text;
    });
  }

  // One verse's words as pieces in time: each starts where its chord lands (plus any nudge) and runs to the next piece.
  // Lines typed without chords are spread out between the lines that have them.
  function lyricPieces(set, b, BT, B) {
    const L = b.length, ev = b.events;
    const tOf = (ci, sh) => (ci !== null && ci < ev.length ? Math.max(0, ev[ci] + (sh || 0)) : null);
    const lines = set.map((l) => ({ frags: l.frags, start: tOf(l.frags[0].ci, l.frags[0].sh) }));
    if (!lines.some((l) => l.start !== null)) {
      const nB = Math.max(1, Math.round(L / BT)), n = lines.length;
      lines.forEach((l, k) => (l.start = n <= nB ? Math.round((k * nB) / n) * BT : Math.round((k * L) / n / B) * B));
    } else {
      for (let k = 0; k < lines.length; ) {
        if (lines[k].start !== null) { k++; continue; }
        let j = k;
        while (j < lines.length && lines[j].start === null) j++;
        const prev = k > 0 ? lines[k - 1].start : null;
        const a = prev !== null ? prev : 0, z = j < lines.length ? lines[j].start : L;
        const off = prev !== null ? 1 : 0, slots = j - k + off;
        for (let q = k; q < j; q++) lines[q].start = a + Math.round(((z - a) * (q - k + off)) / slots / B) * B;
        k = j;
      }
    }
    const out = [];
    lines.forEach((l) => l.frags.forEach((f, j) => {
      const s = j === 0 ? l.start : tOf(f.ci, f.sh);
      if (s === null || s >= L) return;
      const last = out.find((p) => p.s === s);
      if (last) {
        if (f.text && !last.text) last.ci = f.ci;
        last.text = [last.text, f.text].filter(Boolean).join(' '); last.hy = f.hy; return;
      }
      out.push({ s, text: f.text, hy: f.hy, ci: f.ci });
    }));
    out.sort((x, y) => x.s - y.s);
    out.forEach((p, k) => (p.e = k + 1 < out.length ? out[k + 1].s : L));
    return out.filter((p) => p.text && p.e > p.s);
  }

  function drawLabel(svg, x, y, sym, fs, a) {
    const p = CD.chordParts(sym);
    const t = el('text', { x, y, class: 'chord', 'font-size': fs, ...a }, svg);
    const span = (txt, attrs) => { const s = el('tspan', attrs, t); s.textContent = txt; };
    span(p.root, {});
    if (p.qual) span(p.qual, { 'font-size': (fs * 0.68).toFixed(1), dy: (-fs * 0.3).toFixed(1) });
    if (p.bass) span('/' + p.bass, { 'font-size': fs, dy: p.qual ? (fs * 0.3).toFixed(1) : 0 });
    return t;
  }

  /* ---------- one section ---------- */

  function renderBlock(b, idx, model, opts) {
    const mi = model.mi, BT = mi.barTicks, bpl = mi.barsPerLine;
    const wrap = div('sec' + (b.tapped ? '' : ' untapped'));
    const head = div('sec-head');
    head.appendChild(div('sec-mark', b.name));
    const nBars = Math.max(1, Math.round(b.length / BT));
    head.appendChild(div('sec-info', `${nBars} bar${nBars === 1 ? '' : 's'}`));
    if (opts.screen && !b.tapped) {
      head.appendChild(div('sec-note', b.source === 'stale' ? 'chords changed since you tapped, so this is one chord per bar again' : 'not tapped yet, shown one chord per bar'));
    }
    if (opts.screen && b.recording) head.appendChild(div('sec-note rec-note', 'recording'));
    wrap.appendChild(head);

    const notes = opts.mode === 'slash' ? null : spell(b, mi);
    const showTS = idx === 0;
    const x0 = 6, tsW = 34, padL = 12, padR = 16;
    const barW = (W - x0 - tsW - 6) / bpl;
    const inner = barW - padL - padR;
    const barX = (col) => x0 + tsW + col * barW;
    const xAt = (bar, tick) => barX(bar % bpl) + padL + (tick / BT) * inner;
    const nSys = Math.ceil(nBars / bpl);
    const data = (ci) => ({ 'data-blk': idx, 'data-ci': ci, 'data-key': b.key });
    const sets = opts.lyrics === false ? [] : (b.lyrics || []);
    const sysH = sets.length ? LYR_Y + (sets.length - 1) * LYR_GAP + 9 : SYS_H;

    const svgs = [];
    for (let s = 0; s < nSys; s++) {
      const svg = el('svg', { viewBox: `0 0 ${W} ${sysH}`, class: 'sys', preserveAspectRatio: 'xMinYMin meet' });
      svgs.push(svg);
      const first = s * bpl, last = Math.min(nBars, first + bpl) - 1;
      const xStart = s === 0 && showTS ? x0 : barX(0);
      const xEnd = barX(last % bpl) + barW;
      for (let l = -2; l <= 2; l++) el('line', { x1: xStart, x2: xEnd, y1: MID + l * S, y2: MID + l * S, class: 'staff' }, svg);
      el('line', { x1: xStart, x2: xStart, y1: STAFF_TOP, y2: STAFF_BOT, class: 'bar' }, svg);
      if (s === 0 && showTS) {
        const tx = x0 + 15;
        el('text', { x: tx, y: MID - 1, class: 'ts' }, svg).textContent = mi.num;
        el('text', { x: tx, y: STAFF_BOT, class: 'ts' }, svg).textContent = mi.den;
      }
      for (let bar = first; bar <= last; bar++) {
        const bx = barX(bar % bpl) + barW;
        if (bar === nBars - 1) {
          const final = idx === model.blocks.length - 1;
          el('line', { x1: bx - 5, x2: bx - 5, y1: STAFF_TOP, y2: STAFF_BOT, class: 'bar' }, svg);
          el('line', { x1: bx - (final ? 1.6 : 1), x2: bx - (final ? 1.6 : 1), y1: STAFF_TOP, y2: STAFF_BOT, class: final ? 'bar thick' : 'bar' }, svg);
        } else {
          el('line', { x1: bx, x2: bx, y1: STAFF_TOP, y2: STAFF_BOT, class: 'bar' }, svg);
        }
      }
    }

    // chord symbols: where each chord lands, nudged up a row when two crowd each other
    const labels = [];
    b.events.forEach((t, ci) => {
      if (t >= b.length) return;
      const bar = Math.floor(t / BT);
      labels.push({ ci, sys: Math.floor(bar / bpl), x: xAt(bar, t - bar * BT) - 1, sym: b.chords[ci], offBeat: t % mi.beatTicks !== 0 });
    });
    const lastEnd = {};
    for (const L of labels) {
      const fs = 21;
      const w = labelWidth(L.sym, fs);
      if (L.x + w > W - 2) L.x = W - 2 - w; // a push at the end of a line stays on the page
      const prev = lastEnd[L.sys];
      let y = LABEL_Y;
      if (prev && L.x < prev.end + 6 && prev.y === LABEL_Y) y = LABEL_Y2;
      lastEnd[L.sys] = { end: L.x + w, y };
      const cls = opts.selected && opts.selected.key === b.key && opts.selected.ci === L.ci ? 'chord sel' : 'chord';
      const t = drawLabel(svgs[L.sys], L.x, y, L.sym, fs, data(L.ci));
      t.setAttribute('class', cls);
      if (opts.mode === 'slash' && L.offBeat) {
        el('path', { d: `M${L.x + 2},${STAFF_TOP - 9} l5,3 l-5,3`, class: 'stroke push', fill: 'none', 'stroke-width': 1.4, ...data(L.ci) }, svgs[L.sys]);
      }
    }

    // words, one line per verse, numbered when there's more than one
    const rowEnd = (sys) => barX((Math.min(nBars, (sys + 1) * bpl) - 1) % bpl) + barW - 4;
    const xTick = (t) => { const bar = Math.floor(t / BT); return xAt(bar, t - bar * BT) - 1; };
    const chordAt = (t) => { let ci = 0; while (ci + 1 < b.events.length && b.events[ci + 1] <= t) ci++; return ci; };
    sets.forEach((set, r) => {
      const y = LYR_Y + r * LYR_GAP;
      const rows = {};
      lyricPieces(set, b, BT, mi.beatTicks).forEach((p, k) => {
        const text = (k === 0 && sets.length > 1 ? `${r + 1}. ` : '') + p.text + (p.hy ? ' -' : '');
        const segs = [];
        for (let sys = Math.floor(p.s / BT / bpl); sys < nSys && sys * bpl * BT < p.e; sys++) {
          const rs = sys * bpl * BT, re = Math.min(nBars, (sys + 1) * bpl) * BT;
          const a = Math.max(p.s, rs), z = Math.min(p.e, re);
          const x1 = xTick(a), x2 = z >= re ? rowEnd(sys) : xTick(z) - 5;
          segs.push({ sys, x1, w: x2 - x1 });
        }
        // a sliver at the end of a line (a push into the next bar) hands its words to the next line
        const use = segs.length > 1 ? segs.filter((g) => g.w >= 50) : segs;
        if (!use.length) use.push(segs[segs.length - 1]);
        const words = text.split(' ');
        const total = use.reduce((n, g) => n + g.w, 0), full = textW(text, LYR_FS);
        let wi = 0, acc = 0;
        use.forEach((g, gi) => {
          acc += g.w;
          const take = [], limit = (acc / total) * full + 4;
          while (wi < words.length && (gi === use.length - 1 || !take.length ||
            textW(words.slice(0, wi + 1).join(' '), LYR_FS) <= limit)) take.push(words[wi++]);
          if (!take.length) return;
          const sel = !!(opts.selWord && opts.selWord.key === b.key && opts.selWord.v === set.v && opts.selWord.ci === p.ci);
          const a = { ...data(chordAt(Math.max(p.s, g.sys * bpl * BT))), 'data-lv': set.v, 'data-lci': p.ci };
          (rows[g.sys] = rows[g.sys] || []).push({ x: g.x1, text: take.join(' '), sel, a });
        });
      });
      for (const sys in rows) drawWordRow(svgs[sys], rows[sys], y, rowEnd(+sys));
    });

    if (opts.mode === 'slash') {
      for (let bar = 0; bar < nBars; bar++) {
        const svg = svgs[Math.floor(bar / bpl)];
        for (let k = 0; k < mi.beats; k++) {
          const t = bar * BT + k * mi.beatTicks;
          let ci = 0;
          while (ci + 1 < b.events.length && b.events[ci + 1] <= t) ci++;
          drawHead(el('g', {}, svg), xAt(bar, k * mi.beatTicks), false, data(ci));
        }
      }
      return finish();
    }

    // rhythm notation
    const pos = notes.map((n) => ({ sys: Math.floor(n.bar / bpl), x: xAt(n.bar, n.start) }));
    const B = mi.beatTicks;
    // beam groups: eighths and sixteenths inside one beat
    const groups = [];
    let cur = null;
    notes.forEach((n, k) => {
      const beamable = !n.rest && (n.base === 'e' || n.base === 's');
      const beat = n.bar * 1000 + Math.floor(n.start / B);
      if (beamable && cur && cur.beat === beat && notes[k - 1] && notes[k - 1].start + notes[k - 1].dur === n.start && notes[k - 1].bar === n.bar) {
        cur.items.push(k);
      } else if (beamable) {
        cur = { beat, items: [k] };
        groups.push(cur);
      } else cur = null;
    });
    const inGroup = new Map();
    groups.forEach((g) => g.items.forEach((k) => inGroup.set(k, g)));

    notes.forEach((n, k) => {
      const svg = svgs[pos[k].sys];
      const x = pos[k].x;
      const a = data(n.ci);
      const g = el('g', { class: 'note' }, svg);
      if (n.rest) { drawRest(g, n, x, a); return; }
      drawHead(g, x, n.base === 'w' || n.base === 'h', a);
      if (n.base !== 'w') el('line', { x1: x + STEM_X, x2: x + STEM_X, y1: MID - 6, y2: STEM_TOP, class: 'stem', ...a }, g);
      if (n.dots) el('circle', { cx: x + 17, cy: MID - 3.5, r: 1.9, class: 'ink', ...a }, g);
      const grp = inGroup.get(k);
      if (grp && grp.items.length === 1) drawFlags(g, x + STEM_X, n.base === 's' ? 2 : 1, a);
    });

    groups.forEach((grp) => {
      if (grp.items.length < 2) return;
      const svg = svgs[pos[grp.items[0]].sys];
      const xs = grp.items.map((k) => pos[k].x + STEM_X);
      el('rect', { x: xs[0] - 0.6, y: STEM_TOP, width: xs[xs.length - 1] - xs[0] + 1.2, height: 4.5, class: 'ink' }, svg);
      grp.items.forEach((k, j) => {
        if (notes[k].base !== 's') return;
        const prevS = j > 0 && notes[grp.items[j - 1]].base === 's';
        const nextS = j < grp.items.length - 1 && notes[grp.items[j + 1]].base === 's';
        if (nextS) el('rect', { x: xs[j] - 0.6, y: STEM_TOP + 7, width: xs[j + 1] - xs[j] + 1.2, height: 4.5, class: 'ink' }, svg);
        else if (!prevS) {
          const toLeft = j === grp.items.length - 1;
          const x1 = toLeft ? xs[j] - 7 : xs[j];
          el('rect', { x: x1 - 0.6, y: STEM_TOP + 7, width: 8.2, height: 4.5, class: 'ink' }, svg);
        }
      });
    });

    // ties, split across rows when a chord rings past the end of a line
    notes.forEach((n, k) => {
      if (!n.tieNext) return;
      const a = { class: 'ink tie', ...data(n.ci) };
      const p = pos[k], q = pos[k + 1];
      if (p.sys === q.sys) el('path', { d: tiePath(p.x + 6, q.x + 5), ...a }, svgs[p.sys]);
      else {
        el('path', { d: tiePath(p.x + 6, W - 4), ...a }, svgs[p.sys]);
        el('path', { d: tiePath(barX(0) - 2, q.x + 5), ...a }, svgs[q.sys]);
      }
    });

    return finish();

    function finish() {
      svgs.forEach((s) => wrap.appendChild(s));
      return wrap;
    }
  }

  /* ---------- the whole sheet ---------- */

  // model: { title, composer, tempo, mi, feel, formText, blocks: [{ key, name, chords, events, length, tapped, source }] }
  // opts:  { mode: 'rhythm' | 'slash', screen, selected: { key, ci } }
  CD.renderChart = function (host, model, opts) {
    host.innerHTML = '';
    const top = div('sheet-head');
    top.appendChild(div('sheet-title', model.title || 'Untitled song'));
    if (model.composer) top.appendChild(div('sheet-by', model.composer));
    host.appendChild(top);
    const mark = model.mi.compound ? '♩. = ' : '♩ = ';
    const meta = [mark + model.tempo, model.feel, model.mi.meter].filter(Boolean).join('     ');
    host.appendChild(div('sheet-meta', meta));
    if (model.formText) host.appendChild(div('sheet-form', 'Form:  ' + model.formText));
    if (!model.blocks.length) {
      host.appendChild(div('sheet-empty', 'Type some chords in step 1 and the chart shows up here.'));
      return;
    }
    model.blocks.forEach((b, i) => host.appendChild(renderBlock(b, i, model, opts)));
  };
})();
