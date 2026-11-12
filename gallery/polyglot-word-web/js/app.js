// Polyglot Word Web: the page. Loads data/<lang>.js on demand (script tags, so file:// works),
// builds the search index, draws the panel and the map. Language-specific parts are in lang-*.js.
(function () {
'use strict';
var P = window.PWWUI, esc = P.esc, fold = P.fold, meanings = P.meanings, num = P.num;
// picker order; a language whose js/lang-<xx>.js did not load is left out rather than breaking the page
var ORDER = ['fr', 'es', 'ko', 'zh', 'ja', 'sr', 'el'].filter(function (c) { return P.langs[c]; });
// About table: languages whose adjectives conjugate like verbs count them in the verbs column
// (a language file can say so with adjVerbs: true), and languages with no forms show a dash (noForms: true)
function adjVerbs(c) { var Lg = P.langs[c]; return Lg.adjVerbs != null ? !!Lg.adjVerbs : c === 'ko'; }
function noForms(c) { var Lg = P.langs[c]; return Lg.noForms != null ? !!Lg.noForms : c === 'zh'; }
// "French, Spanish and Korean"
function andList(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
var LATIN_FONT = '-apple-system, "Helvetica Neue", Arial, sans-serif';

// ---------- settings that outlive the page ----------
function load(k) { try { return localStorage.getItem('pww.' + k); } catch (e) { return null; } }
function save(k, v) { try { localStorage.setItem('pww.' + k, v); } catch (e) {} }

var params = new URLSearchParams(location.search);
// dev only: ?data=/some/folder/ points the page at other data files (fixtures)
var DATA = params.get('data') || 'data/';
if (DATA && !/\/$/.test(DATA)) DATA += '/';

var POS_LABEL = { verb: 'verb', noun: 'noun', adj: 'adjective', adv: 'adverb', expr: 'expression' };
var REL_LABEL = { near: 'close in meaning', opposite: 'opposite', family: 'same family', theme: 'same topic' };
var REL_ORDER = ['near', 'opposite', 'family', 'theme'];
var css = getComputedStyle(document.documentElement);
function cv(n) { return css.getPropertyValue('--' + n).trim(); }
var POS_COLOR = { verb: cv('verb'), noun: cv('noun'), adj: cv('adj'), adv: cv('adv'), expr: cv('expr') };
var REL_COLOR = { near: cv('near'), opposite: cv('opposite'), family: cv('family'), theme: cv('theme') };
P.POS_COLOR = POS_COLOR;

// ---------- loading ----------
// S[code] = {status: loading | ok | missing | empty, D, byId, INDEX, allWarm, waiting}
var S = {};
function addScript(src, ok, fail) {
  var s = document.createElement('script');
  s.src = src; s.charset = 'utf-8';
  s.onload = ok; s.onerror = fail;
  document.head.appendChild(s);
}
function ensure(code, cb) {
  var st = S[code];
  if (st && st.status !== 'loading') { if (cb) cb(st); return; }
  if (st) { if (cb) st.waiting.push(cb); return; }
  st = S[code] = { status: 'loading', waiting: cb ? [cb] : [] };
  function done() { var w = st.waiting; st.waiting = []; w.forEach(function (f) { f(st); }); }
  addScript(DATA + code + '.js?v=202611121349', function () { prepare(code, st); done(); }, function () { st.status = 'missing'; done(); });
}
function prepare(code, st) {
  var D = window.PWW && window.PWW[code], Lg = P.langs[code];
  if (!D || !D.nodes) { st.status = 'missing'; return; }
  if (!D.nodes.length || (D.meta && D.meta.authored === 0)) { st.status = 'empty'; st.D = D; return; }
  D.meta = D.meta || {};
  var byId = {}, INDEX = [];
  // start the dots spread over an area that grows with the word count, so the first layout steps are cheap
  var SPREAD = Math.max(900, Math.sqrt(D.nodes.length) * 48);
  D.nodes.forEach(function (n) { byId[n.id] = n; n.links = []; n.x = (Math.random() - .5) * SPREAD; n.y = (Math.random() - .5) * SPREAD; n.vx = 0; n.vy = 0; });
  D.edges = D.edges || [];
  D.edges.forEach(function (e) {
    var a = byId[e[0]], b = byId[e[1]];
    if (!a || !b) return;
    a.links.push({ n: b, rel: e[2], out: true });
    b.links.push({ n: a, rel: e[2], out: false });
  });
  // search index: the word, its forms (and romanization or pinyin), then each English meaning
  D.nodes.forEach(function (n) {
    Lg.keys(n, function (e) { if (e.k) { e.n = n; INDEX.push(e); } });
    meanings(n.g).forEach(function (m, i) { INDEX.push({ k: m, n: n, how: 2, pos: i }); });
  });
  st.status = 'ok'; st.D = D; st.byId = byId; st.INDEX = INDEX;
}

// cross.js: the same concept across languages
var CROSS = null; // {"fr:maison|n": [["es","casa|n"], ...]}
addScript(DATA + 'cross.js?v=202611121349', function () {
  var C = window.PWW && window.PWW.cross;
  if (!C || !C.groups) return;
  CROSS = {};
  C.groups.forEach(function (g) {
    (g.ids || []).forEach(function (a) {
      var list = CROSS[a] = CROSS[a] || [];
      g.ids.forEach(function (b) {
        if (b.slice(0, 3) === a.slice(0, 3)) return;
        var c = b.indexOf(':'), pair = [b.slice(0, c), b.slice(c + 1)];
        if (!list.some(function (p) { return p[0] === pair[0] && p[1] === pair[1]; })) list.push(pair);
      });
    });
  });
  if (current) renderPanel();
}, function () { CROSS = null; });

// ---------- current language ----------
var lang = null, L = null, ST = null, D = null, byId = {}, INDEX = [];
var current = null, history = [], token = 0;
var panel = document.getElementById('panel');
var box = document.getElementById('search');

// Korean romanization and Chinese pinyin: one on/off button beside the head word, remembered per language
function secOn() { return load('sec.' + lang) !== '0'; }
function applySec() {
  document.body.classList.toggle('nosec', !!(L && L.toggle) && !secOn());
  var b = document.getElementById('secToggle');
  if (b && L && L.toggle) { b.textContent = L.toggleText ? L.toggleText(secOn()) : L.toggle + (secOn() ? ' on' : ' off'); b.className = secOn() ? 'on' : ''; b.title = L.toggleTitle ? L.toggleTitle(secOn()) : (secOn() ? 'Hide ' : 'Show ') + L.toggle.toLowerCase(); }
}
function toggleSec() { save('sec.' + lang, secOn() ? '0' : '1'); applySec(); if (L && L.onToggle) L.onToggle(secOn()); if (current) renderPanel(true); }

function setUrlLang(code) {
  try {
    var p = new URLSearchParams(location.search);
    p.set('lang', code); p.delete('q');
    history_.replaceState(null, '', location.pathname + '?' + p.toString() + location.hash);
  } catch (e) {}
}
var history_ = window.history;

// switch language; then open: {id} a word id, {q} the best match for typed text, {about} the About view
function setLang(code, then) {
  then = then || {};
  if (ORDER.indexOf(code) < 0) code = ORDER[0];
  var my = ++token;
  lang = code; L = P.langs[code]; save('lang', code);
  document.querySelectorAll('#langs button').forEach(function (b) { b.className = b.getAttribute('data-l') === code ? 'on' : ''; });
  document.documentElement.lang = L.htmlLang;
  document.body.className = 'lang-' + code;
  setUrlLang(code);
  // clear the old web off the screen right away
  current = null; history = []; view = []; viewEdges = []; hover = null; drag = null; D = null; byId = {}; INDEX = [];
  document.getElementById('back').disabled = true;
  box.placeholder = L.placeholder; box.value = ''; sug.style.display = 'none';
  if (!S[code] || S[code].status === 'loading') panel.innerHTML = '<p class="empty">Loading ' + esc(L.name) + '&hellip;</p>';
  document.getElementById('stats').textContent = '';
  applySec();
  ensure(code, function (st) {
    if (my !== token) return;
    activate(st, then);
  });
  if (my === token && !D) ST = S[code];
}
function activate(st, then) {
  ST = st;
  D = st.status === 'ok' ? st.D : null;
  byId = st.byId || {}; INDEX = st.INDEX || [];
  started = false; camTo = null;
  box.disabled = !D; document.getElementById('random').disabled = !D;
  applySec();
  legend();
  if (!D) {
    panel.innerHTML = notBuiltHtml(st);
    document.getElementById('depthWrap').style.display = 'none';
    if (then.about) showAbout(true);
    return;
  }
  document.getElementById('stats').textContent = num(D.meta.nodes || D.nodes.length) + ' words · ' + num(D.meta.links || D.edges.length) + ' links';
  var start = then.id ? byId[then.id] : null;
  if (!start && then.q) { var hit = find(then.q)[0]; if (hit) start = hit.n; }
  if (start) go(start, true);
  else { renderPanel(); mode = 'all'; setMode('all'); }
  if (then.about) showAbout(true);
  else if (!start && !aboutOn) box.focus();
}
function notBuiltHtml(st) {
  return '<p class="empty">' + L.en + ' (' + esc(L.name) + ') is not built yet.' +
    (st.status === 'empty' ? ' Its data file is there, but no words have been written for it so far.' : ' Its data file, <code>data/' + lang + '.js</code>, is not in the folder.') +
    '<br><br>When its words are ready, <code>python3 langs/' + lang + '/build/build_data.py</code> makes the file, and this page picks it up the next time it opens.<br><br>' +
    ORDER.filter(function (c) { return c !== lang; }).map(function (c) { return '<span class="chip" data-switch="' + c + '">' + esc(P.langs[c].name) + '</span>'; }).join(' ') + '</p>';
}

// ---------- search ----------
function find(q) {
  var raw = String(q || '');
  q = fold(raw);
  if (L.strip) q = q.replace(L.strip, '');
  if (!q) return [];
  var qs = { '': q, n: q.replace(/[\s\-'’·.]/g, '') };
  if (L.query) Object.keys(L.query).forEach(function (m) { qs[m] = L.query[m](raw); });
  var han = /\p{Script=Han}/u.test(qs.n);
  var best = {};
  function add(e, score) {
    var b = best[e.n.id];
    if (!b || score < b.s) best[e.n.id] = { e: e, s: score };
  }
  var wordStart = new RegExp('(^|[ \'-])' + P.reEsc(q));
  INDEX.forEach(function (e) {
    // common words first inside each tier: tie runs from 0 (very common) up to .9
    var f = e.n.f || 0, tie = e.n.rank ? Math.min(.5, e.n.rank / 1000) : .9 / (1 + Math.log(1 + f));
    if (e.how < 2) {
      // the word itself, one of its forms, then words that start with what was typed
      var k = qs[e.m || ''], pen = e.pen || 0;
      if (!k) return;
      if (e.k === k) add(e, e.how + pen + tie);
      else if (e.k.indexOf(k) === 0) add(e, 4 + e.how + pen + tie);
      else if (e.sub && han && e.k.indexOf(k) > 0) add(e, 8 + tie);
    } else {
      // English: a whole meaning ("house"), then a meaning that starts with it, then a word inside one
      if (e.k === q) add(e, 2 + Math.min(e.pos, 2) * .25 + tie * .5);
      else if (q.length > 1 && e.k.indexOf(q) === 0) add(e, 6 + tie);
      else if (q.length > 2 && wordStart.test(e.k)) add(e, 7 + tie);
    }
  });
  var hits = Object.keys(best).map(function (k) { return best[k]; }).sort(function (a, b) { return a.s - b.s; });
  // find.exact: did anything match the whole word, a form or a whole English meaning (not just a prefix)
  find.exact = !!hits.length && hits[0].s < 4;
  return hits.slice(0, 14).map(function (h) { return h.e; });
}

// ---------- panel ----------
function small(n, Lg) { var s = (Lg || L).small ? (Lg || L).small(n) : ''; return s ? '<small class="sec sm">' + esc(s) + '</small>' : ''; }
function relRow(l) {
  var n = l.n;
  return '<div class="rel" data-id="' + esc(n.id) + '" style="border-left-color:' + REL_COLOR[l.rel] + '">' +
    '<b style="color:' + POS_COLOR[n.pos] + '">' + esc(L.display(n)) + '</b>' + small(n) +
    '<span class="g">' + esc(n.g || '') + '</span>' +
    '<span class="k" style="color:' + REL_COLOR[l.rel] + '">' + (REL_LABEL[l.rel] || esc(l.rel)) + '</span></div>';
}
function byKind(list) {
  return list.map(function (l, i) { return { l: l, i: i }; }).sort(function (a, b) {
    var ka = REL_ORDER.indexOf(a.l.rel), kb = REL_ORDER.indexOf(b.l.rel);
    return (ka - kb) || (a.i - b.i);
  }).map(function (x) { return x.l; });
}
function crossHtml(n) {
  if (!CROSS) return '';
  var list = CROSS[lang + ':' + n.id];
  if (!list || !list.length) return '';
  var want = {};
  var chips = ORDER.filter(function (c) { return c !== lang; }).map(function (c) {
    return list.filter(function (p) { return p[0] === c; }).map(function (p) {
      var st = S[p[0]], Lg = P.langs[p[0]], m, word, sm = '';
      if (st && st.status === 'ok') {
        m = st.byId[p[1]];
        if (!m) return '';
        word = Lg.display(m); sm = small(m, Lg);
      } else {
        if (st && st.status !== 'loading') return '';
        want[p[0]] = 1;
        word = p[1].split('|')[0];
      }
      return '<span class="xchip" data-xl="' + p[0] + '" data-xid="' + esc(p[1]) + '" title="' + esc(Lg.en) + '"><i>' + esc(Lg.name) + '</i><b class="w-' + p[0] + '">' + esc(word) + '</b>' + sm + '</span>';
    }).join('');
  }).join('');
  // load the other languages in the background so their pinyin and romanization can show
  Object.keys(want).forEach(function (c) { ensure(c, function () { if (current === n) renderPanel(true); }); });
  return chips ? '<div class="cross"><span class="xlabel">Same word in</span>' + chips + '</div>' : '';
}
function renderPanel(keepScroll) {
  var n = current;
  if (!D) return;
  if (!n) {
    panel.innerHTML = '<p class="empty">' + L.emptyHtml + '<br><br>Press <kbd>/</kbd> to jump to the box.</p>';
    return;
  }
  var top = panel.scrollTop;
  var color = POS_COLOR[n.pos];
  var h = L.head ? L.head(n, color) : '<h2 style="color:' + color + '">' + esc(L.display(n)) + '</h2>';
  if (L.toggle) h = '<div class="headrow"><div>' + h + '</div><button id="secToggle"></button></div>';
  h += '<div class="gloss">' + esc(n.g || 'No meaning written yet.') + '</div><div class="tags">';
  h += '<span class="tag">' + L.posTag(n, POS_LABEL[n.pos] || n.pos) + '</span>';
  L.tags(n).forEach(function (t) { h += /^<span/.test(t) ? t : '<span class="tag">' + t + '</span>'; });
  h += '<span class="tag">' + n.links.length + ' link' + (n.links.length === 1 ? '' : 's') + '</span></div>';
  h += crossHtml(n);

  if (n.ex && n.ex.t) h += L.exHtml(n);

  var own = n.rel ? n.rel.map(function (r) { return { n: byId[r[0]], rel: r[1] }; }).filter(function (l) { return l.n; }) : [];
  var ownIds = {};
  own.forEach(function (l) { ownIds[l.n.id] = 1; });
  var others = n.links.filter(function (l) { return !ownIds[l.n.id]; });
  if (own.length) {
    h += '<h3>Related words</h3>' + byKind(own).map(relRow).join('');
    if (others.length) {
      h += '<h3>Also linked from</h3><div class="also">' + others.map(function (l) {
        return '<span class="chip" data-id="' + esc(l.n.id) + '" title="' + esc((l.n.g || '') + ' · ' + (REL_LABEL[l.rel] || l.rel)) + '" style="color:' + POS_COLOR[l.n.pos] + '">' + esc(L.display(l.n)) + '</span>';
      }).join('') + '</div>';
    }
  } else if (others.length) {
    h += '<h3>Linked words</h3>' + byKind(others).map(relRow).join('');
  } else {
    h += '<p class="note">No links yet.</p>';
  }
  h += L.body(n);
  panel.innerHTML = h;
  applySec();
  panel.scrollTop = keepScroll ? top : 0;
}
panel.addEventListener('click', function (ev) {
  if (ev.target.id === 'secToggle') { toggleSec(); return; }
  var x = ev.target.closest('[data-xl]');
  if (x) { jump(x.getAttribute('data-xl'), x.getAttribute('data-xid')); return; }
  var s = ev.target.closest('[data-switch]');
  if (s) { setLang(s.getAttribute('data-switch')); return; }
  var t = ev.target.closest('[data-id]');
  if (t) go(byId[t.getAttribute('data-id')]);
});
// open a word in another language (or this one)
function jump(code, id) {
  if (code === lang && D) { go(byId[id]); return; }
  setLang(code, { id: id });
}

function go(n, noHistory) {
  if (!n) return;
  showAbout(false);
  if (current && current !== n && !noHistory) history.push(current);
  current = n;
  document.getElementById('back').disabled = !history.length;
  try { location.hash = lang + ':' + encodeURIComponent(n.id); } catch (e) {}
  renderPanel();
  buildView(true);
}
document.getElementById('back').onclick = function () { var p = history.pop(); if (p) go(p, true); };
document.getElementById('random').onclick = function () {
  if (D) go(D.nodes[Math.floor(Math.random() * D.nodes.length)]);
};
document.querySelectorAll('#langs button').forEach(function (b) {
  b.onclick = function () { var c = b.getAttribute('data-l'); if (c !== lang || !D) setLang(c); };
});

// ---------- search box ----------
var sug = document.getElementById('suggest'), sel = 0, results = [];
function showSuggest() {
  if (!D) { sug.style.display = 'none'; return; }
  results = find(box.value);
  var addRow = ADD.can && box.value.trim() && !find.exact ? '<div class="addRow" data-add="1">' + ADD.label(box.value.trim()) + '</div>' : '';
  if (!results.length) { sug.style.display = box.value.trim() ? 'block' : 'none'; sug.innerHTML = box.value.trim() ? '<div><small>Not in the web yet.</small></div>' + addRow : ''; return; }
  sel = Math.min(sel, results.length - 1);
  sug.innerHTML = addRow + results.map(function (e, i) {
    var via = e.via ? esc(e.via) : e.how === 1 ? L.via(e) : e.how === 2 ? 'English' : '';
    return '<div data-i="' + i + '" class="' + (i === sel ? 'on' : '') + '"><b style="color:' + POS_COLOR[e.n.pos] + '">' + esc(L.display(e.n)) + '</b>' + small(e.n) + '<small>' + esc(e.n.g || '') + '</small>' + (via ? '<span class="via">' + via + '</span>' : '') + '</div>';
  }).join('');
  sug.style.display = 'block';
}
box.addEventListener('input', function () { sel = 0; showSuggest(); });
box.addEventListener('focus', function () { if (box.value) showSuggest(); });
box.addEventListener('keydown', function (ev) {
  if (ev.isComposing) return;
  if (ev.key === 'ArrowDown') { sel = Math.min(sel + 1, results.length - 1); showSuggest(); ev.preventDefault(); }
  else if (ev.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); showSuggest(); ev.preventDefault(); }
  else if (ev.key === 'Enter') { if (results[sel]) pick(results[sel].n); else if (!results.length && ADD.can && box.value.trim()) ADD.start(box.value.trim()); }
  else if (ev.key === 'Escape') { sug.style.display = 'none'; box.blur(); }
});
sug.addEventListener('mousedown', function (ev) {
  if (ev.target.closest('[data-add]')) { ADD.start(box.value.trim()); ev.preventDefault(); return; }
  var t = ev.target.closest('[data-i]');
  if (t) { pick(results[+t.getAttribute('data-i')].n); ev.preventDefault(); }
});
function pick(n) { sug.style.display = 'none'; box.value = ''; box.blur(); go(n); }
document.addEventListener('keydown', function (ev) {
  if (ev.key === '/' && document.activeElement !== box) { box.focus(); ev.preventDefault(); }
  else if (ev.key === 'Escape' && aboutOn) showAbout(false);
});
document.addEventListener('mousedown', function (ev) { if (!ev.target.closest('#searchWrap')) sug.style.display = 'none'; });

// ---------- graph ----------
var canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
var W = 0, H = 0, DPR = 1;
var cam = { x: 0, y: 0, k: 1 }, camTo = null;
var mode = 'local', depth = 2;
var view = [], viewEdges = [], inView = {}, level = {};
var alpha = 1, hover = null, drag = null, moved = false, started = false;

function resize() {
  var r = canvas.parentNode.getBoundingClientRect();
  DPR = window.devicePixelRatio || 1; W = r.width; H = r.height;
  canvas.width = W * DPR; canvas.height = H * DPR;
}
window.addEventListener('resize', function () { resize(); });

function buildView(recenter) {
  inView = {}; level = {}; view = [];
  if (!D) { viewEdges = []; return; }
  if (mode === 'all' || !current) {
    D.nodes.forEach(function (n) { inView[n.id] = 1; view.push(n); });
  } else {
    var q = [current]; inView[current.id] = 1; level[current.id] = 0;
    while (q.length) {
      var n = q.shift(); view.push(n);
      if (level[n.id] >= depth) continue;
      n.links.forEach(function (l) {
        if (!inView[l.n.id]) { inView[l.n.id] = 1; level[l.n.id] = level[n.id] + 1; q.push(l.n); }
      });
    }
    // start new arrivals near whoever brought them in, so the web unfolds instead of exploding
    view.forEach(function (n) {
      if (n === current) return;
      if (!n.placed) { n.x = current.x + (Math.random() - .5) * 160; n.y = current.y + (Math.random() - .5) * 160; }
    });
  }
  view.forEach(function (n) { n.placed = true; });
  viewEdges = D.edges.filter(function (e) { return inView[e[0]] && inView[e[1]]; }).map(function (e) { return { a: byId[e[0]], b: byId[e[1]], rel: e[2] }; });
  alpha = 1;
  // settle most of the layout before the first frame, then let it finish on screen
  var warm = mode === 'all' ? (ST.allWarm ? 0 : 60) : 160;
  if (mode === 'all') ST.allWarm = true;
  for (var w = 0; w < warm; w++) step();
  alpha = Math.max(alpha, .12);
  document.getElementById('depthWrap').style.display = mode === 'local' && current ? 'flex' : 'none';
  if (recenter && current) camTo = { x: current.x, y: current.y, k: mode === 'all' ? Math.max(cam.k, 1.1) : fitZoom(), follow: 70 };
  else if (mode === 'all' && !current) camTo = { x: 0, y: 0, k: fitAll(), follow: 0 };
  if (!started && camTo) { cam.x = camTo.x; cam.y = camTo.y; cam.k = camTo.k; started = true; }
}

function step() {
  var n = view.length, i, j, a, b, dx, dy, d2, d, f;
  var rep = mode === 'all' ? 900 : 2600, len = mode === 'all' ? 46 : 105;
  // dots only push each other inside CELL px (400 around a word, 240 in the whole web), so sort them
  // into cells of that size and compare neighbours only
  var CELL = mode === 'all' ? 240 : 400, CUT = CELL * CELL;
  var grid = {}, keys = [], key, cell, other, ci, k;
  for (i = 0; i < n; i++) {
    a = view[i]; a.gx = Math.floor(a.x / CELL); a.gy = Math.floor(a.y / CELL);
    key = a.gx + ',' + a.gy;
    if (!grid[key]) { grid[key] = []; keys.push(key); }
    grid[key].push(a);
  }
  var NB = [[0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  for (ci = 0; ci < keys.length; ci++) {
    cell = grid[keys[ci]];
    for (k = 0; k < 5; k++) {
      other = k ? grid[(cell[0].gx + NB[k][0]) + ',' + (cell[0].gy + NB[k][1])] : cell;
      if (!other) continue;
      for (i = 0; i < cell.length; i++) {
        a = cell[i];
        for (j = k ? 0 : i + 1; j < other.length; j++) {
          b = other[j];
          dx = a.x - b.x; dy = a.y - b.y; d2 = dx * dx + dy * dy;
          if (d2 > CUT) continue;
          if (d2 < 1) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = 1; }
          f = rep / d2 * alpha;
          a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
        }
      }
    }
  }
  for (i = 0; i < viewEdges.length; i++) {
    a = viewEdges[i].a; b = viewEdges[i].b;
    dx = b.x - a.x; dy = b.y - a.y; d = Math.sqrt(dx * dx + dy * dy) || 1;
    f = (d - len) / d * .09 * alpha;
    a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
  }
  var g = mode === 'all' ? .012 : .02, cx = mode === 'local' && current ? current.x : 0, cy = mode === 'local' && current ? current.y : 0;
  for (i = 0; i < n; i++) {
    a = view[i];
    a.vx += (cx - a.x) * g * alpha; a.vy += (cy - a.y) * g * alpha;
    if (a === drag) { a.vx = a.vy = 0; continue; }
    a.vx *= .82; a.vy *= .82;
    a.x += Math.max(-30, Math.min(30, a.vx)); a.y += Math.max(-30, Math.min(30, a.vy));
  }
  alpha *= .985;
}
function fitAll() {
  var far = 200;
  view.forEach(function (n) { var d = Math.max(Math.abs(n.x), Math.abs(n.y)); if (d > far) far = d; });
  return Math.max(.12, .47 * Math.min(W, H) / far);
}
function fitZoom() {
  // zoom so the whole local neighbourhood fits around the open word
  if (!current) return .32;
  var far = 60;
  view.forEach(function (n) { var d = Math.sqrt((n.x - current.x) * (n.x - current.x) + (n.y - current.y) * (n.y - current.y)); if (d > far) far = d; });
  return Math.max(.3, Math.min(1.35, .43 * Math.min(W, H) / far));
}
function tick() {
  if (alpha > 0.012 && view.length) step();
  if (camTo) {
    if (camTo.follow > 0 && current) { camTo.x = current.x; camTo.y = current.y; camTo.follow--; }
    cam.x += (camTo.x - cam.x) * .14; cam.y += (camTo.y - cam.y) * .14; cam.k += (camTo.k - cam.k) * .14;
    if (camTo.follow <= 0 && Math.abs(camTo.x - cam.x) < .5 && Math.abs(camTo.k - cam.k) < .005) camTo = null;
  }
  draw();
  requestAnimationFrame(tick);
}

function radius(n) { return (n === current ? 9 : 3.5 + Math.min(7, Math.sqrt(n.links.length) * 1.5)); }
function sx(x) { return (x - cam.x) * cam.k + W / 2; }
function sy(y) { return (y - cam.y) * cam.k + H / 2; }

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!D) {
    if (L && ST) {
      ctx.globalAlpha = 1; ctx.fillStyle = '#9a9faa'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 22px ' + (L.font || LATIN_FONT);
      ctx.fillText(L.name, W / 2, H / 2 - 16);
      ctx.font = '14px ' + LATIN_FONT;
      ctx.fillText(ST.status === 'loading' ? 'loading' : 'not built yet', W / 2, H / 2 + 14);
    }
    return;
  }
  var font = L.font || LATIN_FONT;
  var focus = hover || (mode === 'all' ? current : null), near = null, i, e, n;
  if (focus) { near = {}; near[focus.id] = 1; focus.links.forEach(function (l) { near[l.n.id] = 1; }); }
  ctx.lineWidth = 1;
  for (i = 0; i < viewEdges.length; i++) {
    e = viewEdges[i];
    var lit = near && (e.a === focus || e.b === focus);
    ctx.globalAlpha = near ? (lit ? .95 : .07) : (mode === 'all' ? .22 : .55);
    ctx.strokeStyle = REL_COLOR[e.rel];
    ctx.lineWidth = lit ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(sx(e.a.x), sy(e.a.y)); ctx.lineTo(sx(e.b.x), sy(e.b.y)); ctx.stroke();
  }
  var labelAll = mode === 'local' ? view.length < 140 || cam.k > 1.2 : cam.k > 1.5;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (i = 0; i < view.length; i++) {
    n = view[i];
    var x = sx(n.x), y = sy(n.y);
    if (x < -60 || y < -30 || x > W + 60 || y > H + 30) continue;
    var r = radius(n) * Math.max(.55, Math.min(1.3, cam.k));
    var dimmed = near && !near[n.id];
    ctx.globalAlpha = dimmed ? .16 : 1;
    ctx.fillStyle = POS_COLOR[n.pos];
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    if (n === current) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 6.2832); ctx.stroke(); }
    var show = n === current || n === hover || (near && near[n.id]) || (labelAll && !dimmed) || (mode === 'all' && !near && n.links.length >= 9 && cam.k > .55);
    if (show) {
      var big = n === current || n === hover;
      ctx.font = (big ? '600 15px ' : '12px ') + font;
      ctx.fillStyle = big ? '#ffffff' : '#d5d2c8';
      ctx.fillText(L.display(n), x, y + r + 3);
      if (n === hover && n.g) { ctx.font = '12px ' + LATIN_FONT; ctx.fillStyle = '#9a9faa'; ctx.fillText(n.g, x, y + r + 21); }
    }
  }
  ctx.globalAlpha = 1;
}

function nodeAt(px, py) {
  var best = null, bd = 1e9;
  for (var i = 0; i < view.length; i++) {
    var n = view[i], dx = sx(n.x) - px, dy = sy(n.y) - py, d = dx * dx + dy * dy, r = radius(n) + 7;
    if (d < r * r && d < bd) { bd = d; best = n; }
  }
  return best;
}
function pt(ev) { var r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
var pan = null;
canvas.addEventListener('pointerdown', function (ev) {
  var p = pt(ev); moved = false; camTo = null;
  drag = nodeAt(p.x, p.y);
  if (!drag) pan = { x: p.x, y: p.y, cx: cam.x, cy: cam.y };
  canvas.setPointerCapture(ev.pointerId); canvas.classList.add('grabbing');
});
canvas.addEventListener('pointermove', function (ev) {
  var p = pt(ev);
  if (drag) { drag.x = (p.x - W / 2) / cam.k + cam.x; drag.y = (p.y - H / 2) / cam.k + cam.y; alpha = Math.max(alpha, .35); moved = true; }
  else if (pan) { cam.x = pan.cx - (p.x - pan.x) / cam.k; cam.y = pan.cy - (p.y - pan.y) / cam.k; if (Math.abs(p.x - pan.x) + Math.abs(p.y - pan.y) > 3) moved = true; }
  else { hover = nodeAt(p.x, p.y); canvas.style.cursor = hover ? 'pointer' : ''; }
});
canvas.addEventListener('pointerup', function () {
  if (drag && !moved) go(drag);
  drag = null; pan = null; canvas.classList.remove('grabbing');
});
canvas.addEventListener('pointerleave', function () { hover = null; });
canvas.addEventListener('wheel', function (ev) {
  ev.preventDefault(); camTo = null;
  var p = pt(ev), wx = (p.x - W / 2) / cam.k + cam.x, wy = (p.y - H / 2) / cam.k + cam.y;
  cam.k = Math.max(.12, Math.min(4, cam.k * Math.exp(-ev.deltaY * .0016)));
  cam.x = wx - (p.x - W / 2) / cam.k; cam.y = wy - (p.y - H / 2) / cam.k;
}, { passive: false });

function setMode(m) {
  mode = m;
  document.getElementById('modeLocal').className = m === 'local' ? 'on' : '';
  document.getElementById('modeAll').className = m === 'all' ? 'on' : '';
  if (!D) return;
  buildView(true);
  if (m === 'all') camTo = { x: current ? current.x : 0, y: current ? current.y : 0, k: current ? .9 : fitAll(), follow: current ? 90 : 0 };
}
document.getElementById('modeLocal').onclick = function () { setMode('local'); };
document.getElementById('modeAll').onclick = function () { setMode('all'); };
document.querySelectorAll('#depthWrap button').forEach(function (b) {
  b.onclick = function () {
    depth = +b.getAttribute('data-d');
    document.querySelectorAll('#depthWrap button').forEach(function (x) { x.className = x === b ? 'on' : ''; });
    buildView(true);
  };
});

function legend() {
  document.getElementById('legend').style.display = D ? '' : 'none';
  document.getElementById('legend').innerHTML =
    Object.keys(POS_LABEL).map(function (p) { return '<span><i style="background:' + POS_COLOR[p] + '"></i>' + POS_LABEL[p] + '</span>'; }).join('') + '<br>' +
    Object.keys(REL_LABEL).map(function (r) { return '<span><u style="border-color:' + REL_COLOR[r] + '"></u>' + REL_LABEL[r] + '</span>'; }).join('');
}

// ---------- about page ----------
// Every number on it is counted from the data when it opens, so it stays right after a rebuild.
// Opening it loads the languages not opened yet, and it fills in as they arrive.
var aboutView = document.getElementById('aboutView'), aboutOn = false;
function counts(code) {
  var st = S[code];
  if (!st || st.status !== 'ok') return null;
  var D2 = st.D, Lg = P.langs[code], c = { words: D2.nodes.length, links: D2.edges.length, forms: 0, ex: 0, pop: 0, news: 0, pos: {}, rel: {}, keys: st.INDEX.length };
  D2.nodes.forEach(function (n) {
    c.pos[n.pos] = (c.pos[n.pos] || 0) + 1;
    c.forms += Lg.formsCount(n);
    if (n.ex && n.ex.t) { c.ex++; if (n.ex.tag === 'pop') c.pop++; if (n.ex.tag === 'news') c.news++; }
  });
  D2.edges.forEach(function (e) { c.rel[e[2]] = (c.rel[e[2]] || 0) + 1; });
  return c;
}
function aboutHtml() {
  var C = {}, tot = { words: 0, links: 0, forms: 0, ex: 0, pop: 0, news: 0, pos: {}, rel: {} };
  ORDER.forEach(function (c) {
    var x = C[c] = counts(c);
    if (!x) return;
    ['words', 'links', 'forms', 'ex', 'pop', 'news'].forEach(function (k) { tot[k] += x[k]; });
    Object.keys(x.pos).forEach(function (k) { tot.pos[k] = (tot.pos[k] || 0) + x.pos[k]; });
    Object.keys(x.rel).forEach(function (k) { tot.rel[k] = (tot.rel[k] || 0) + x.rel[k]; });
  });
  function status(c) {
    var st = S[c];
    return !st || st.status === 'loading' ? 'loading' : st.status === 'ok' ? '' : 'not built yet';
  }
  function tt(code) { return function (q, label) { return '<span class="try" data-l="' + code + '" data-q="' + esc(q) + '">' + esc(label || q) + '</span>'; }; }
  function card(n, label) { return '<div class="num"><b>' + num(n) + '</b><small>' + label + '</small></div>'; }

  var h = '<div class="col">';
  h += '<h2>Polyglot <span>Word Web</span></h2>';
  h += '<p class="lede">A map of words in ' + andList(ORDER.map(function (c) { return P.langs[c].en; })) + ' that you can walk through, one link at a time. It runs from the files in its own folder and never touches the internet.</p>';
  h += '<p><button id="aboutClose">&larr; Back to the web</button></p>';
  h += '<div class="nums">' + card(tot.words, 'words') + card(tot.links, 'links between them') + card(tot.forms, 'verb forms and endings you can search') + card(tot.ex, 'example sentences') + '</div>';
  h += '<table class="langtab"><tr><th></th><th>words</th><th>links</th><th>verbs</th><th>forms</th><th>examples</th></tr>';
  ORDER.forEach(function (c) {
    var x = C[c], Lg = P.langs[c];
    h += '<tr><td><span class="try" data-l="' + c + '" data-q="">' + esc(Lg.name) + '</span> <small>' + Lg.en + '</small></td>' +
      (x ? '<td>' + num(x.words) + '</td><td>' + num(x.links) + '</td><td>' + num((x.pos.verb || 0) + (adjVerbs(c) ? (x.pos.adj || 0) : 0)) + '</td><td>' + (noForms(c) ? '&mdash;' : num(x.forms)) + '</td><td>' + num(x.ex) + '</td>'
         : '<td colspan="5" class="soft">' + status(c) + '</td>') + '</tr>';
  });
  h += '</table>';

  h += '<h3>How to use it</h3>';
  h += '<h4>1. Pick a language</h4>';
  h += '<p>The buttons at the top switch between ' + andList(ORDER.map(function (c) { return esc(P.langs[c].name); })) + '. Each language has its own web; the page remembers the one you used last. When a word has a match in the other languages, a Same word in row under its meaning shows them, and clicking one takes you there.</p>';
  h += '<h4>2. Find a word</h4>';
  ORDER.forEach(function (c) { var Lg = P.langs[c]; h += '<p><span class="lname">' + Lg.en + '.</span> ' + Lg.about.find(tt(c)) + '</p>'; });
  h += '<p>The list under the box puts the most common words first. Arrow keys move through it and Enter opens the top one. Press <kbd>/</kbd> from anywhere to jump to the box. Click any example above to try it.</p>';
  h += '<h4>3. Read the word</h4>';
  h += '<p>The panel on the right shows the meaning, one example sentence with its English and the open word lit up in it, the related words grouped by how they are related, and the forms:</p><ul>';
  ORDER.forEach(function (c) { var Lg = P.langs[c]; h += '<li><span class="lname">' + Lg.en + ':</span> ' + Lg.about.forms + '.</li>'; });
  var tg = ORDER.filter(function (c) { return P.langs[c].toggle && !P.langs[c].toggleText; });
  var tgNames = []; tg.forEach(function (c) { var t = P.langs[c].toggle.toLowerCase(); if (tgNames.indexOf(t) < 0) tgNames.push(t); });
  h += '</ul><p>' + (tg.length ? 'In ' + andList(tg.map(function (c) { return P.langs[c].en; })) + ' a button beside the word hides the ' + andList(tgNames).replace(/ and /, ' or ') + ', for when you want to read the script on its own. ' : '') + 'A small label under a sentence means it refers to something real, such as a film, a singer or a festival.</p>';
  if (P.TONE_LABEL) h += '<p class="key"><span>Chinese tone colors:</span>' + [1, 2, 3, 4, 5].map(function (t) { return '<span class="t' + t + '">' + P.TONE_LABEL[t] + '</span>'; }).join('') + '</p>';
  h += '<h4>4. Follow a link</h4>';
  h += '<p>Each related word says how it is related. Click one and it becomes the open word. The arrow button takes you back, and Random drops you somewhere new.</p>';
  h += '<p class="key">' + REL_ORDER.map(function (r) { return '<span><u style="border-color:' + REL_COLOR[r] + '"></u>' + REL_LABEL[r] + ' (' + num(tot.rel[r] || 0) + ')</span>'; }).join('') + '</p>';
  h += '<h4>5. Look at the map</h4>';
  h += '<p>Every dot is a word and every line is a link. A bigger dot has more links. Around this word shows the open word and its neighbors, 1 to 3 steps out. Whole web shows every word of the language at once. Click a dot to open it, drag a dot to move it, drag the background to slide the map, scroll to zoom. Rest the pointer on a dot to light up its links.</p>';
  h += '<p class="key">' + Object.keys(POS_LABEL).map(function (p) { return '<span><i style="background:' + POS_COLOR[p] + '"></i>' + POS_LABEL[p] + ' (' + num(tot.pos[p] || 0) + ')</span>'; }).join('') + '</p>';

  h += '<h3>Behind the scenes</h3>';
  h += '<p>The page is <code>index.html</code> and a few script files in <code>js/</code>, with no libraries: one file for the search, panel and map, and one per language for what is special about it. The words live in one data file per language in <code>data/</code>. A build script writes each data file, so nobody edits them by hand. The page loads a language the first time you pick it.</p>';
  h += '<div class="pipe"><div><b>langs/xx/entries</b>one entry per word: meaning, links, example sentence</div><span>&rarr;</span><div><b>build_data.py</b>merges, makes every form, checks</div><span>&rarr;</span><div><b>data/xx.js</b>one list of words, one list of links</div><span>&rarr;</span><div><b>index.html</b>search, panel and map</div></div>';
  ORDER.forEach(function (c) {
    var Lg = P.langs[c], st = S[c];
    h += '<h4>' + Lg.en + ' <small class="soft">' + esc(Lg.name) + '</small></h4>';
    h += '<p>' + Lg.about.words + '</p>';
    h += '<p>' + (st && st.status === 'ok' ? Lg.about.sources(st.D) : Lg.about.sources({ meta: {} })) + '</p>';
    if (st && st.status === 'ok' && st.D.meta.built) h += '<p class="soft">Data built ' + esc(st.D.meta.built) + '.</p>';
    else if (status(c)) h += '<p class="soft">' + Lg.en + ' is ' + status(c) + '.</p>';
  });
  h += '<h4>Who wrote the meanings</h4>';
  h += '<p>The meanings, the links and the ' + num(tot.ex) + ' example sentences were written by Claude, in batches of 200 words, each batch by its own agent working from one written spec. A checker script rejects a batch until every word has a meaning, 3 or 4 valid links and a sentence. ' + num(tot.pop) + ' sentences lean on pop culture and ' + num(tot.news) + ' on recent events. No native speaker has reviewed them yet, so treat a strange one as a possible mistake. The forms are different: no one wrote those, the build makes them, as each language above explains.</p>';
  h += '<h4>Same word in other languages</h4>';
  h += '<p>' + (CROSS ? 'A separate build step, <code>build/build_cross.py</code>, matches words across the languages by their English meaning and part of speech, then applies a short list of hand fixes. It writes <code>data/cross.js</code>, which the page reads for the Same word in row.' : 'A separate build step, <code>build/build_cross.py</code>, will match words across the languages by their English meaning and part of speech. Its file, <code>data/cross.js</code>, is not there yet, so the Same word in row is hidden.') + '</p>';
  h += '<h4>What the build checks</h4>';
  h += '<p>Each word gets an id made of its spelling and its part of speech, so a verb and a noun with the same spelling are two dots. The build removes doubled links, then walks the web to make sure every word can be reached from every other one. An unreachable group is reported as an island and has to be bridged before the build counts as clean.</p>';
  h += '<h4>How search works</h4>';
  h += '<p>When a language opens, the page builds an index of keys for it: every word, every form, the romanization or pinyin, and every English meaning. Accents, tone marks and capitals are stripped from the keys and from what you type, and for Korean romanization and pinyin the spaces and hyphens are too. Typed Hangul is split into its letters, so a half-typed syllable already matches. An exact match on the word wins, then a form, then an exact English meaning, then anything that starts with your letters. Inside each group the more common word comes first.</p>';
  h += '<h4>How the map arranges itself</h4>';
  h += '<p>Nothing places the dots by hand. Every dot pushes the dots near it away, every link pulls its two ends together like a spring, and a weak pull toward the middle keeps the web from drifting off. The page runs those three forces many times a second and slows them down until the picture settles. To keep thousands of dots fast, the map is cut into squares and a dot only pushes against dots in its own square and the ones beside it. Steps out is a walk from the open word, one ring of neighbors at a time.</p>';
  h += '<h4>Credits</h4>';
  h += '<p class="soft">' + ORDER.map(function (c) { var Lg = P.langs[c]; return Lg.about.credits ? Lg.en + '. ' + Lg.about.credits : ''; }).filter(function (x) { return x; }).join(' ') + '</p>';
  h += '</div>';
  return h;
}
function renderAbout() { var top = aboutView.scrollTop; aboutView.innerHTML = aboutHtml(); aboutView.scrollTop = top; }
function showAbout(on) {
  if (on === aboutOn) return;
  aboutOn = on;
  if (on) {
    renderAbout();
    ORDER.forEach(function (c) { ensure(c, function () { if (aboutOn) renderAbout(); }); });
  }
  aboutView.className = on ? 'on' : '';
  document.getElementById('about').className = on ? 'on' : '';
  if (on) { aboutView.scrollTop = 0; sug.style.display = 'none'; }
}
document.getElementById('about').onclick = function () { showAbout(!aboutOn); };
aboutView.addEventListener('click', function (ev) {
  if (ev.target.id === 'aboutClose') { showAbout(false); return; }
  var t = ev.target.closest('.try');
  if (!t) return;
  var c = t.getAttribute('data-l'), q = t.getAttribute('data-q');
  if (c !== lang || !D) { showAbout(false); setLang(c, { q: q }); return; }
  var hit = q && find(q)[0];
  if (hit) go(hit.n); else showAbout(false);
});

// ---------- Add with Claude ----------
// Only when the page is served by server.py (run.sh): a word with no exact match gets a button that
// queues a job; Claude adds the word to all seven languages and rebuilds. Opened from file://, no button.
var ADD = { can: false, timer: null };
var addBar = document.getElementById('addStatus');
ADD.label = function (q) { return '<span class="plus">+</span> Add <b>' + esc(q) + '</b> to all seven languages with Claude'; };
ADD.start = function (q) { return; // read-only gallery copy

  sug.style.display = 'none'; box.blur();
  fetch('api/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: q, lang: lang }) })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d.error) { ADD.show([{ status: 'failed', q: q, note: d.error }]); return; } box.value = ''; ADD.poll(); })
    .catch(function () { ADD.show([{ status: 'failed', q: q, note: 'The server did not answer. Is run.sh running?' }]); });
};
ADD.seen = function () { try { return JSON.parse(load('addSeen') || '[]'); } catch (e) { return []; } };
ADD.dismiss = function (id) { var s = ADD.seen(); s.push(id); save('addSeen', JSON.stringify(s.slice(-50))); ADD.poll(); };
ADD.show = function (jobs) {
  var seen = ADD.seen();
  jobs = jobs.filter(function (j) { return !j.id || seen.indexOf(j.id) < 0; });
  if (!jobs.length) { addBar.style.display = 'none'; return; }
  addBar.innerHTML = jobs.slice(0, 3).map(function (j) {
    var x = j.id ? ' <button data-dismiss="' + esc(j.id) + '" title="Hide">&times;</button>' : '';
    if (j.status === 'queued') return '<div>Waiting to add <b>' + esc(j.q) + '</b> (another word is being added first)</div>';
    if (j.status === 'running') return '<div class="busy">Claude is adding <b>' + esc(j.q) + '</b> to all seven languages. This takes several minutes; you can keep exploring.</div>';
    if (j.status === 'done') {
      var r = j.result || {}, o = r.open || {};
      return '<div class="ok"><b>' + esc(j.q) + '</b> ' + (r.status === 'exists' ? 'was already in the web.' : 'is in the web now.') + ' ' + esc(r.note || '') +
        (o.lang && o.id ? ' <button data-open="' + esc(o.lang) + '" data-oid="' + esc(o.id) + '">Open it</button>' : '') + x + '</div>';
    }
    return '<div class="bad">Could not add <b>' + esc(j.q) + '</b>. ' + esc(j.note || '') + x + '</div>';
  }).join('');
  addBar.style.display = 'block';
};
ADD.poll = function () {
  clearTimeout(ADD.timer);
  fetch('api/jobs').then(function (r) { return r.json(); }).then(function (d) {
    var jobs = d.jobs || [];
    // show running and queued jobs, and those that finished in the last day
    var day = Date.now() - 864e5;
    ADD.show(jobs.filter(function (j) { return j.status === 'queued' || j.status === 'running' || new Date(j.finished || j.created).getTime() > day; }));
    if (jobs.some(function (j) { return j.status === 'queued' || j.status === 'running'; })) ADD.timer = setTimeout(ADD.poll, 5000);
  }).catch(function () {});
};
addBar.addEventListener('click', function (ev) {
  var d = ev.target.closest('[data-dismiss]');
  if (d) { ADD.dismiss(d.getAttribute('data-dismiss')); return; }
  var o = ev.target.closest('[data-open]');
  if (o) {
    var c = o.getAttribute('data-open'), id = o.getAttribute('data-oid');
    // reload so every data file and cross.js is read fresh
    var search = '?lang=' + encodeURIComponent(c), hash = '#' + c + ':' + encodeURIComponent(id);
    if (search === location.search) { location.hash = hash; location.reload(); }
    else location.href = location.pathname + search + hash;
  }
});
if (false) { // read-only gallery copy: Add with Claude removed
  fetch('api/ping').then(function (r) { return r.json(); }).then(function (d) { ADD.can = !!(d && d.ok && d.claude); if (ADD.can) ADD.poll(); }).catch(function () {});
}

// ---------- start ----------
resize();
var startLang = params.get('lang'), startId = null, wantAbout = location.hash === '#about';
if (!wantAbout && location.hash.length > 1) {
  var hv = '';
  try { hv = decodeURIComponent(location.hash.slice(1)); } catch (e) {}
  var hm = /^([a-z]{2}):(.+)$/.exec(hv);
  if (hm && ORDER.indexOf(hm[1]) >= 0) { if (!startLang || startLang === hm[1]) { startLang = hm[1]; startId = hm[2]; } }
  else startId = hv; // an old French Word Web link: #être|v
}
if (ORDER.indexOf(startLang) < 0) startLang = load('lang');
if (ORDER.indexOf(startLang) < 0) startLang = 'fr';
setLang(startLang, { id: startId, q: params.get('q'), about: wantAbout });
window.PWWdebug = {
  about: showAbout, go: go, find: find, setLang: setLang, jump: jump,
  byId: function () { return byId; }, S: S,
  state: function () { return { lang: lang, status: ST && ST.status, current: current && current.id, view: view.length, edges: viewEdges.length, mode: mode, history: history.length, cross: !!CROSS, sec: document.body.classList.contains('nosec') }; }
};
requestAnimationFrame(tick);
})();
