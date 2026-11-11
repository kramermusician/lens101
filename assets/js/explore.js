// LENS 101 home: two ways in for a new visitor. No libraries.
//   1. The die button: three dice tumble, each lands on a tile from the site, then the three open up large.
//   2. Search: matches titles, descriptions, and the extra words in search-tags.js ("cartoon" finds the animation tools).
// Both read the tiles straight off the page, so a new tile in index.html shows up here with no extra step.
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAGS = window.LENS_TAGS || {};

  // ---------- the catalog, read from the page ----------
  const items = [...document.querySelectorAll('.chapter .tile')].map(a => {
    const ch = a.closest('.chapter');
    const title = a.querySelector('h3').textContent.trim();
    const href = a.getAttribute('href');
    return {
      href,
      external: a.target === '_blank',
      img: a.querySelector('img').getAttribute('src'),
      tag: a.querySelector('.tag').textContent.trim(),
      title,
      short: title.split(',')[0].trim(),
      desc: a.querySelector('p').textContent.trim(),
      go: a.querySelector('.go').textContent.replace('›', '').trim(),
      chapter: ch.querySelector('h2').textContent.trim(),
      accent: ch.dataset.accent,
      tags: TAGS[href] || []
    };
  });
  if (!items.length) return;

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const linkAttrs = it => `href="${esc(it.href)}"${it.external ? ' target="_blank" rel="noopener"' : ''}`;

  const DIE_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="5" width="38" height="38" rx="9" fill="none" stroke="currentColor" stroke-width="3"/>
    <circle cx="15" cy="15" r="3.4" fill="currentColor"/><circle cx="33" cy="15" r="3.4" fill="currentColor"/>
    <circle cx="24" cy="24" r="3.4" fill="currentColor"/>
    <circle cx="15" cy="33" r="3.4" fill="currentColor"/><circle cx="33" cy="33" r="3.4" fill="currentColor"/></svg>`;

  // =====================================================================
  // 1. GET LUCKY
  // =====================================================================
  const luckyBtn = document.querySelector('.lucky-btn');
  luckyBtn.innerHTML = DIE_SVG;

  const overlay = el('div', 'lucky');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Three random picks from the site');
  overlay.innerHTML = `
    <button class="lucky-close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
    <div class="lucky-stage">
      <div class="lucky-dice"></div>
      <div class="lucky-cards"></div>
    </div>
    <button class="lucky-again" type="button" aria-label="Roll again">${DIE_SVG}</button>`;
  document.body.appendChild(overlay);
  const diceRow = overlay.querySelector('.lucky-dice');
  const cardRow = overlay.querySelector('.lucky-cards');
  const againBtn = overlay.querySelector('.lucky-again');
  const closeBtn = overlay.querySelector('.lucky-close');
  let timers = [];
  let lastPicks = [];

  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Three picks from three different chapters when possible, and not the same three as last time.
  function pickThree() {
    const pool = shuffle(items.filter(it => !lastPicks.includes(it)));
    const picks = [], seen = new Set();
    for (const it of pool) { if (!seen.has(it.chapter)) { picks.push(it); seen.add(it.chapter); } if (picks.length === 3) break; }
    for (const it of pool) { if (picks.length === 3) break; if (!picks.includes(it)) picks.push(it); }
    lastPicks = picks;
    return picks;
  }

  const faceHTML = it => `<img src="${esc(it.img)}" alt="" /><span style="--c:${it.accent}">${esc(it.short)}</span>`;

  function buildDie(pick) {
    const others = shuffle(items.filter(it => it !== pick)).slice(0, 5);
    const wrap = el('div', 'die-wrap');
    const die = el('div', 'die');
    ['front', 'back', 'right', 'left', 'top', 'bottom'].forEach((side, i) => {
      die.appendChild(el('div', 'face ' + side, faceHTML(i === 0 ? pick : others[i - 1])));
    });
    wrap.appendChild(die);
    return { wrap, die };
  }

  function buildCard(it) {
    const a = el('a', 'lucky-card');
    a.href = it.href;
    if (it.external) { a.target = '_blank'; a.rel = 'noopener'; }
    a.style.setProperty('--c', it.accent);
    a.innerHTML = `<figure><img src="${esc(it.img)}" alt="" /></figure>
      <span class="tag">${esc(it.chapter)} &middot; ${esc(it.tag)}</span>
      <h3>${esc(it.title)}</h3>
      <p>${esc(it.desc)}</p>
      <span class="go">${esc(it.go)} &rsaquo;</span>`;
    return a;
  }

  const rnd = (a, b) => a + Math.random() * (b - a);

  function roll() {
    timers.forEach(clearTimeout); timers = [];
    const picks = pickThree();
    diceRow.innerHTML = ''; cardRow.innerHTML = '';
    overlay.classList.remove('landed');
    picks.forEach(p => cardRow.appendChild(buildCard(p)));

    if (reduce) { overlay.classList.add('landed'); return; }

    picks.forEach((p, i) => {
      const { wrap, die } = buildDie(p);
      diceRow.appendChild(wrap);
      // Every turn is a whole number of spins away from zero, so each die comes to rest on its front face.
      const rx = 360 * Math.round(rnd(2, 4)) + 90 * Math.round(rnd(0, 3));
      const ry = 360 * Math.round(rnd(2, 4)) + 90 * Math.round(rnd(0, 3));
      const rz = 360 * Math.round(rnd(0, 1)) + 90 * Math.round(rnd(0, 3));
      const dx = rnd(-30, 30) + (i - 1) * -40;
      // Rest a little tilted so the top and side faces show: it reads as a die, not a card.
      const rest = 'rotateX(-14deg) rotateY(' + (i - 1) * -16 + 'deg)';
      die.animate([
        { transform: `translate3d(${dx}vw, 75vh, -200px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)` },
        { transform: `translate3d(0, -70px, 0) rotateX(${rx * 0.12}deg) rotateY(${ry * 0.12}deg) rotateZ(${rz * 0.12}deg)`, offset: 0.62 },
        { transform: `translate3d(0, 0, 0) ${rest} rotateZ(0deg)`, offset: 0.82 },
        { transform: `translate3d(0, -16px, 0) ${rest} rotateZ(0deg)`, offset: 0.9 },
        { transform: `translate3d(0, 0, 0) ${rest} rotateZ(0deg)` }
      ], { duration: 1500 + i * 160, delay: i * 120, easing: 'cubic-bezier(0.25, 0.8, 0.35, 1)', fill: 'both' });
    });
    // Hold on the landed dice for a beat so the faces can be read, then open them into cards.
    timers.push(setTimeout(() => overlay.classList.add('landed'), 1500 + 2 * 160 + 2 * 120 + 750));
  }

  function openLucky() {
    overlay.classList.add('open');
    document.body.classList.add('lucky-on');
    roll();
    closeBtn.focus({ preventScroll: true });
  }
  function closeLucky() {
    timers.forEach(clearTimeout); timers = [];
    overlay.classList.remove('open', 'landed');
    document.body.classList.remove('lucky-on');
    luckyBtn.focus({ preventScroll: true });
  }
  luckyBtn.addEventListener('click', openLucky);
  againBtn.addEventListener('click', roll);
  closeBtn.addEventListener('click', closeLucky);
  overlay.addEventListener('click', e => { if (e.target === overlay || e.target.classList.contains('lucky-stage')) closeLucky(); });
  // Click the dice before they open and you skip straight to the cards.
  diceRow.addEventListener('click', () => { timers.forEach(clearTimeout); overlay.classList.add('landed'); });

  // =====================================================================
  // 2. SEARCH
  // =====================================================================
  const input = document.querySelector('#site-search');
  const out = document.querySelector('.search-results');
  const searchBtn = document.querySelector('.search-btn');
  if (innerWidth < 720) input.placeholder = 'Try cartoon, beat, font, 3D';

  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
  const STOP = new Set('i im want wanna to a an the how do does can could me my of for with in on and or is it something some thing things like make making use using about learn'.split(' '));
  const isCJK = s => /[぀-ヿ㐀-鿿가-힯]/.test(s);
  const stem = t => t.length > 5 ? t.replace(/(ations?|ing|ers?|ed|es|s)$/, '') : t;

  // Pre-normalize every searchable field once.
  const index = items.map(it => ({
    it,
    title: norm(it.title),
    tags: it.tags.map(norm),
    meta: norm(it.chapter + ' ' + it.tag),
    desc: norm(it.desc),
    words: [...new Set(norm(it.title + ' ' + it.tags.join(' ')).split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 3))]
  }));

  function wordHit(field, t) {
    if (isCJK(t)) return field.includes(t);
    let i = field.indexOf(t);
    while (i !== -1) { if (i === 0 || /[^\p{L}\p{N}]/u.test(field[i - 1])) return true; i = field.indexOf(t, i + 1); }
    return false;
  }
  function edit1or2(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return false;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length] <= max;
  }

  function scoreToken(row, t) {
    const s = stem(t);
    let best = 0, why = null;
    const bump = (n, w) => { if (n > best) { best = n; why = w; } };
    row.tags.forEach((tag, k) => {
      if (tag === t) bump(9, row.it.tags[k]);
      else if (wordHit(tag, t)) bump(5, row.it.tags[k]);
      else if (s !== t && wordHit(tag, s)) bump(4, row.it.tags[k]);
    });
    if (wordHit(row.title, t) || (s !== t && wordHit(row.title, s))) bump(7, null);
    if (wordHit(row.meta, t)) bump(3, null);
    if (wordHit(row.desc, t) || (s !== t && wordHit(row.desc, s))) bump(2, null);
    if (!best && t.length >= 5 && !isCJK(t)) {
      const max = t.length >= 8 ? 2 : 1;
      const w = row.words.find(w => edit1or2(t, w, max));
      if (w) bump(2, w);
    }
    return { best, why };
  }

  function search(q) {
    const nq = norm(q).trim();
    if (!nq) return null;
    let toks = nq.split(/[^\p{L}\p{N}.]+/u).filter(Boolean);
    const kept = toks.filter(t => !STOP.has(t));
    if (kept.length) toks = kept;
    const scored = index.map(row => {
      let total = 0, hits = 0, why = null;
      // The whole phrase matching a tag ("stop motion", "sheet music") beats the words one by one.
      const phrase = toks.length > 1 && row.tags.findIndex(tag => tag.includes(toks.join(' ')));
      if (phrase !== false && phrase > -1) { total += 12; why = row.it.tags[phrase]; }
      toks.forEach(t => { const r = scoreToken(row, t); if (r.best) { hits++; total += r.best; why = why || r.why; } });
      return { it: row.it, total, full: hits === toks.length, why };
    }).filter(r => r.total > 0);
    const full = scored.filter(r => r.full).sort((a, b) => b.total - a.total);
    if (full.length) return { rows: full, close: false };
    return { rows: scored.sort((a, b) => b.total - a.total), close: true };
  }

  function render(q) {
    const res = search(q);
    if (!res) { out.innerHTML = ''; out.classList.remove('on'); return; }
    out.classList.add('on');
    if (!res.rows.length) {
      out.innerHTML = `<p class="none">Nothing for "${esc(q)}" yet. Try a simpler word, or roll the dice up top.</p>`;
      return;
    }
    const rows = res.rows.slice(0, 8);
    out.innerHTML = (res.close ? '<p class="none">No exact match. These are the closest.</p>' : '') + rows.map(r => {
      const it = r.it;
      const why = r.why && !norm(it.title).includes(norm(r.why)) ? `<span class="why">${esc(r.why)}</span>` : '';
      return `<a class="hit" ${linkAttrs(it)} style="--c:${it.accent}">
        <img src="${esc(it.img)}" alt="" loading="lazy" />
        <span class="hit-text"><span class="hit-tag">${esc(it.chapter)}${why}</span><span class="hit-title">${esc(it.title)}</span></span>
        <span class="hit-go">&rsaquo;</span></a>`;
    }).join('') + (res.rows.length > 8 ? `<p class="none">${res.rows.length - 8} more. Add a word to narrow it down.</p>` : '');
  }

  let t;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => render(input.value), 90); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const first = out.querySelector('.hit'); if (first) first.click(); }
    if (e.key === 'ArrowDown') { const first = out.querySelector('.hit'); if (first) { e.preventDefault(); first.focus(); } }
    if (e.key === 'Escape') { input.value = ''; render(''); }
  });
  out.addEventListener('keydown', e => {
    const hits = [...out.querySelectorAll('.hit')], i = hits.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'ArrowDown' && hits[i + 1]) { e.preventDefault(); hits[i + 1].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (hits[i - 1] || input).focus(); }
  });
  function goSearch() {
    scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    setTimeout(() => input.focus({ preventScroll: true }), reduce ? 0 : 350);
  }
  searchBtn.addEventListener('click', goSearch);

  // ---------- keys: "/" to search, Escape closes lucky mode ----------
  addEventListener('keydown', e => {
    if (overlay.classList.contains('open')) {
      if (e.key === 'Escape') closeLucky();
      if (e.key === 'Tab') { // keep focus inside the dialog
        const f = [...overlay.querySelectorAll('button, a')];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
      return;
    }
    if (e.key === '/' && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); goSearch(); }
  });
})();
