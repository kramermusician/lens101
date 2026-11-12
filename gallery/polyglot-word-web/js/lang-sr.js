// Serbian: search keys (Cyrillic, Latin with or without diacritics, every case and verb form, English),
// panel with the case table, adjective table and verb tables, and the Cyrillic/Latin switch.
// The switch uses the page's one toggle button (label "Cyrillic"): on shows Cyrillic, off shows Latin.
// Every Serbian string in the panel is written twice, <span class="sr-c"> and <span class="sr-l">, and the
// CSS below shows one of them. Latin comes from the letter table langs/sr/build/translit.py writes into
// data/sr.js (meta.translit), so there is one transliterator. Data shape: SPEC.md, "Serbian".
(function () {
'use strict';
var P = window.PWWUI, esc = P.esc;

// ---------- the two scripts ----------
(function css() {
  var s = document.createElement('style');
  s.textContent = 'body.lang-sr:not(.nosec) .sr-l{display:none!important}body.lang-sr.nosec .sr-c{display:none!important}' +
    '.srtab th{color:var(--dim);font-weight:400;text-align:left;padding:0 8px 2px 0;font-size:12px}' +
    '.srtab td.f{padding-right:10px}.srsub{color:var(--dim);font-size:13px;margin-top:2px}';
  document.head.appendChild(s);
})();
var TABLE = null, UP = null;
function table() {
  if (TABLE) return TABLE;
  var D = window.PWW && window.PWW.sr;
  TABLE = (D && D.meta && D.meta.translit) || {};
  UP = {};
  Object.keys(TABLE).forEach(function (c) { var l = TABLE[c]; UP[c.toUpperCase()] = l.charAt(0).toUpperCase() + l.slice(1); });
  return TABLE;
}
var DIGRAPH_UP = { 'Љ': 'LJ', 'Њ': 'NJ', 'Џ': 'DŽ' };
function isUp(ch) { return !!ch && ch !== ch.toLowerCase() && ch === ch.toUpperCase(); }
// Cyrillic to Latin, the same steps as translit.to_lat
function lat(s) {
  var T = table(), out = '', i, ch;
  s = String(s || '').normalize('NFC');
  for (i = 0; i < s.length; i++) {
    ch = s[i];
    if (T[ch]) out += T[ch];
    else if (UP[ch]) {
      var nxt = s[i + 1] || '', prv = s[i - 1] || '';
      var shout = DIGRAPH_UP[ch] && (isUp(nxt) || (isUp(prv) && !/\p{L}/u.test(nxt)));
      out += shout ? DIGRAPH_UP[ch] : UP[ch];
    } else out += ch;
  }
  return out;
}
// search keys: l keeps the diacritics (kuća), s is the skeleton (kuca; đ, dj and d all read as d)
function lkey(s) { return lat(s).toLowerCase().normalize('NFC').replace(/[\s\-'’.·,!?]/g, ''); }
function skey(s) { return lkey(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/dj/g, 'd'); }

// the stored choice, read once and updated when the button is pressed (display() runs every frame)
var latin = false;
try { latin = localStorage.getItem('pww.sec.sr') === '0'; } catch (e) {}
function pick(s) { return latin ? lat(s) : s; }
// both scripts, one shown by the CSS
function sr(s) { s = String(s || ''); return '<span class="sr-c">' + esc(s) + '</span><span class="sr-l">' + esc(lat(s)) + '</span>'; }
function srAlt(s) { return P.alts(s).map(function (x) { return '<span class="nw">' + sr(x) + '</span>'; }).join(' / '); }

function headWord(n) { return n.w + (n.refl ? ' се' : ''); }
function display(n) { return pick(headWord(n)); }

// app.js calls onToggle when the button is pressed, then redraws the panel

// ---------- forms ----------
var CASES = ['nominative', 'genitive', 'dative', 'accusative', 'vocative', 'instrumental', 'locative'];
var CASE_HINT = ['who, what', 'of, from', 'to, for', 'object', 'calling someone', 'with, by', 'in, on, about'];
var PERS = ['ја', 'ти', 'он, она, оно', 'ми', 'ви', 'они, оне, она'];
var PA = ['masculine', 'feminine', 'neuter'];
var IP = ['ти', 'ми', 'ви'];
var GEN = { m: 'masculine', f: 'feminine', n: 'neuter' };
var ASP = { impf: 'imperfective', pf: 'perfective', both: 'imperfective and perfective' };

// every form with a label, for search, highlighting and the forms count
function formList(n) {
  var out = [];
  function add(cell, label) { P.alts(cell).forEach(function (f) { out.push([f, label]); }); }
  if (n.d) ['sg', 'pl'].forEach(function (num) { (n.d[num] || []).forEach(function (c, i) { add(c, CASES[i] + (num === 'sg' ? ' singular' : ' plural')); }); });
  if (n.ad) {
    var KIND = { i: 'short form', d: 'long form', c: 'comparative' };
    Object.keys(n.ad).forEach(function (k) {
      ['m', 'f', 'n'].forEach(function (g) {
        (n.ad[k][g] || []).forEach(function (c, i) { add(c, KIND[k] + ', ' + GEN[g] + ' ' + CASES[i % 7] + (i < 7 ? ' singular' : ' plural')); });
      });
    });
    if (n.ad.c) ['m', 'f', 'n'].forEach(function (g) { (n.ad.c[g] || []).forEach(function (c, i) { P.alts(c).forEach(function (f) { out.push(['нај' + f, 'superlative, ' + GEN[g] + ' ' + CASES[i % 7] + (i < 7 ? ' singular' : ' plural')]); }); }); });
  }
  if (n.v) {
    (n.v.pr || []).forEach(function (c, i) { add(c, 'present, ' + PERS[i]); });
    (n.v.pa || []).forEach(function (c, i) { add(c, 'past, ' + PA[i % 3] + (i < 3 ? ' singular' : ' plural')); });
    (n.v.fu || []).forEach(function (c, i) { add(c, 'future, ' + PERS[i]); });
    (n.v.ip || []).forEach(function (c, i) { add(c, 'imperative, ' + IP[i]); });
  }
  return out;
}

// light up the head word, or a form of it, in the sentence; the Latin line is the same pieces converted
function exHtml(n) {
  var t = n.ex.t || '', low = t.toLowerCase(), hit = null;
  var cands = formList(n).map(function (x) { return x[0]; }).concat([n.w, headWord(n)]);
  cands = cands.filter(function (v, i) { return v && cands.indexOf(v) === i; }).sort(function (a, b) { return b.length - a.length; });
  for (var c = 0; c < cands.length && !hit; c++) {
    var f = cands[c].toLowerCase(), from = 0, i;
    while ((i = low.indexOf(f, from)) >= 0) {
      var before = i ? t[i - 1] : '', after = t[i + f.length] || '';
      if (!/\p{L}/u.test(before) && !/\p{L}/u.test(after)) { hit = [i, i + f.length]; break; }
      from = i + 1;
    }
  }
  function marked(conv) {
    if (!hit) return esc(conv(t));
    return esc(conv(t.slice(0, hit[0]))) + '<mark>' + esc(conv(t.slice(hit[0], hit[1]))) + '</mark>' + esc(conv(t.slice(hit[1])));
  }
  var main = '<span class="sr-c">' + marked(function (x) { return x; }) + '</span><span class="sr-l">' + marked(lat) + '</span>';
  return P.exBox(n, main);
}

function th(cols) { return '<tr><th></th>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr>'; }
function cell(c) { return c ? '<td class="f">' + srAlt(c) + '</td>' : '<td class="f none">&mdash;</td>'; }
function box(title, sub, rows, cols) {
  var h = '<div class="tense srtab"><h4>' + title + (sub ? ' <small>' + sub + '</small>' : '') + '</h4><table>' + (cols ? th(cols) : '');
  rows.forEach(function (r) { h += '<tr><td class="p">' + r[0] + '</td>' + r.slice(1).map(cell).join('') + '</tr>'; });
  return h + '</table></div>';
}

function nounHtml(n) {
  if (!n.d) return '';
  var sg = n.d.sg || [], pl = n.d.pl || [], rows = [];
  for (var i = 0; i < 7; i++) {
    var lab = esc(CASES[i]) + ' <small>' + CASE_HINT[i] + '</small>';
    rows.push(n.pt ? [lab, pl[i]] : [lab, sg[i], pl[i]]);
  }
  return '<h3>Cases</h3><div class="tenses one">' + box(n.pt ? 'Plural only' : 'Singular and plural', '', rows, n.pt ? ['plural'] : ['singular', 'plural']) + '</div>' +
    '<p class="note">Serbian nouns change their ending for their job in the sentence. The genitive follows numbers from five up and words like ' + sr('много') + ' (' + sr('много ' + ((pl[1] || '').split(' / ')[0] || n.w)) + ').</p>';
}

function adjHtml(n) {
  var ad = n.ad;
  if (!ad) return '';
  var main = ad.d || ad.i, h = '<h3>Forms</h3><div class="tenses one">';
  ['singular', 'plural'].forEach(function (num, k) {
    var rows = [];
    for (var i = 0; i < 7; i++) rows.push([esc(CASES[i]), main.m[i + 7 * k], main.f[i + 7 * k], main.n[i + 7 * k]]);
    h += box((ad.d ? 'Long form, ' : '') + num, k ? '' : 'the form used with a noun in most cases', rows, ['masculine', 'feminine', 'neuter']);
  });
  h += '</div>';
  var notes = [];
  if (ad.i && ad.d) notes.push('Short form, after ' + sr('бити') + ': ' + ['m', 'f', 'n'].map(function (g) { return sr(P.alts(ad.i[g][0])[0] || ''); }).join(', ') + ' (' + sr('он је ' + (P.alts(ad.i.m[0])[0] || '')) + ').');
  if (ad.c) {
    var c0 = P.alts(ad.c.m[0])[0] || '';
    notes.push('Comparative ' + sr(c0) + ', ' + sr(P.alts(ad.c.f[0])[0] || '') + ', ' + sr(P.alts(ad.c.n[0])[0] || '') + '; superlative ' + sr('нај' + c0) + '.');
  }
  if (notes.length) h += '<p class="note">' + notes.join(' ') + '</p>';
  return h;
}

function verbHtml(n) {
  var v = n.v, h = '';
  var D = window.PWW && window.PWW.sr, by = {};
  if (n.pair && n.pair.length && D) D.nodes.forEach(function (m) { by[m.id] = m; });
  if (n.asp) {
    h += '<p class="note">' + (ASP[n.asp] || n.asp) + (n.asp === 'impf' ? ': an action in progress or repeated' : n.asp === 'pf' ? ': one finished action' : '') + '.';
    var partners = (n.pair || []).filter(function (id) { return by[id]; });
    if (partners.length) h += ' Its pair: ' + partners.map(function (id) { return '<span class="chip srpair" data-id="' + esc(id) + '">' + sr(by[id].w) + '</span>'; }).join(' ');
    h += '</p>';
  }
  if (!v) return h;
  var se = n.refl ? 'се ' : '';
  h += '<h3>Forms</h3><div class="tenses">';
  h += box('Present', 'now', (v.pr || []).map(function (c, i) { return [sr(PERS[i]), c]; }));
  h += box('Future', 'will', (v.fu || []).map(function (c, i) { return [sr(PERS[i]), c]; }));
  var pa = v.pa || [];
  h += box('Past', 'with ' + sr('сам, си, је') + ' ...', [0, 1, 2].map(function (g) { return [PA[g], pa[g], pa[g + 3]]; }), ['singular', 'plural']);
  if ((v.ip || []).some(function (x) { return x; })) h += box('Imperative', 'do it', (v.ip || []).map(function (c, i) { return [sr(IP[i]), c]; }));
  h += '</div>';
  var p0 = P.alts(pa[0])[0], p1 = P.alts(pa[1])[0];
  if (p0) h += '<p class="note">Past: the form for the speaker\'s gender plus ' + sr('сам, си, је, смо, сте, су') + ': ' + sr(p0 + ' сам') + ' (a man), ' + sr((p1 || p0) + ' сам') + ' (a woman)' + (n.refl ? '; with ' + sr('се') + ': ' + sr(p0 + ' сам се') : '') + '.</p>';
  else if (se) h += '<p class="note">Said with ' + sr('се') + '.</p>';
  return h;
}

function count(n) { var seen = {}; formList(n).forEach(function (x) { if (x[0] !== n.w) seen[x[0]] = 1; }); return Object.keys(seen).length; }

P.langs.sr = {
  code: 'sr', name: 'Српски', en: 'Serbian', htmlLang: 'sr',
  placeholder: 'Serbian in Cyrillic or Latin (кућа, kuća, kuca), any form, or English: house',
  strip: /^(to (be )?|the |a |an )/,
  toggle: 'Cyrillic',
  toggleText: function (on) { return on ? 'Ћирилица' : 'Latinica'; },
  toggleTitle: function (on) { return on ? 'Show Latin letters' : 'Show Cyrillic letters'; },
  onToggle: function (on) { latin = !on; },
  display: display,
  small: function () { return ''; },
  keys: function (n, push) {
    var seen = {};
    function both(s, how, pen, form, label) {
      var a = lkey(s), b = skey(s);
      if (a && !seen['l' + a]) { seen['l' + a] = 1; push({ k: a, how: how, m: 'l', pen: pen, form: form, label: label }); }
      if (b && !seen['s' + b]) { seen['s' + b] = 1; push({ k: b, how: how, m: 's', pen: pen + .3, form: form, label: label }); }
    }
    both(n.w, 0, 0);
    if (n.refl) both(headWord(n), 0, 0);
    formList(n).forEach(function (x) { if (x[0] !== n.w) both(x[0], 1, 0, x[0], x[1]); });
  },
  query: { l: lkey, s: skey },
  via: function (e) { return 'a form of ' + esc(display(e.n)) + ': ' + esc(pick(e.form)) + (e.label ? ' (' + esc(e.label) + ')' : ''); },
  emptyHtml: 'Type a Serbian word in the box, in Cyrillic or Latin: <b>кућа</b>, <b>kuća</b> and plain <b>kuca</b> all find it. Any form works: <b>кући</b> finds кућа, <b>rekao</b> finds рећи.<br><br>Or type English: <b>house</b>, <b>to eat</b>. The Ћирилица button beside a word switches the page to Latin letters (Latinica) and back.',
  head: function (n, color) {
    var w = headWord(n);
    return '<h2 style="color:' + color + '">' + sr(w) + '</h2><div class="srsub"><span class="sr-c">' + esc(lat(w)) + '</span><span class="sr-l">' + esc(w) + '</span></div>';
  },
  posTag: function (n, label) {
    if (n.pos === 'noun' && n.gen) return label + ', ' + GEN[n.gen] + (n.pt ? ', plural only' : '');
    if (n.pos === 'verb' && n.asp) return label + ', ' + (ASP[n.asp] || n.asp);
    return label;
  },
  tags: function (n) {
    var t = [];
    if (n.refl) t.push('said with ' + sr('се'));
    if (n.rank) t.push('#' + n.rank + ' most used');
    return t;
  },
  exHtml: exHtml,
  body: function (n) { return n.pos === 'noun' ? nounHtml(n) : n.pos === 'adj' ? adjHtml(n) : n.pos === 'verb' ? verbHtml(n) : ''; },
  formsCount: count,
  lat: lat,
  about: {
    find: function (t) { return 'Type a word in Cyrillic or Latin letters (' + t('кућа') + ', ' + t('kuća') + '), with or without the marks on č, ć, š, ž and đ (' + t('kuca') + ', ' + t('rodjendan') + '), or any form of it: ' + t('кући') + ' finds кућа, ' + t('rekla') + ' finds рећи, ' + t('najbolji') + ' finds добар. English works too: ' + t('house') + ', ' + t('to eat') + '. The button beside a word (Ћирилица or Latinica) switches every Serbian word on the page between the two alphabets, and the page remembers it.'; },
    forms: 'every noun in its seven cases, singular and plural, with its gender; every adjective in all its cases and genders, its short form and its comparative; every verb with its aspect and pair (купити and куповати), present, past, future and imperative. Everything shows in Cyrillic or in Latin letters',
    words: 'The words are Ekavian, the standard in Serbia (млеко, дете, лепо, not the Ijekavian млијеко, дијете, лијепо used in Bosnia and Montenegro). The list is chosen by how often each word is said in Serbian film and TV subtitles, every form counted toward its head word, with function words (pronouns, prepositions, conjunctions), Croatian and regional words, and film-crime vocabulary taken out, and everyday words for food, music, school and the weather put in.',
    sources: function (D) {
      var m = D.meta || {}, chk = m.check, rule = m.rule;
      return 'No one typed the forms. They come from the inflection tables of Wiktionary, read from the kaikki.org extract, with the tonal accent marks taken off' +
        (chk && chk[1] ? '. Most words have a Cyrillic and a Latin Wiktionary page, edited separately, and the two tables agree on ' + P.num(chk[0]) + ' of ' + P.num(chk[1]) + ' cells' : '') +
        (rule && rule[1] ? '. A small rule-based generator written for this page (future, past, imperative, feminine nouns) agrees with ' + P.num(rule[0]) + ' of ' + P.num(rule[1]) + ' forms' : '') +
        '. Where the tables were wrong, a short list names which page or rule each cell is taken from instead. The Latin letters come from one transliteration table, Cyrillic to Latin letter by letter (љ lj, њ nj, џ dž), which the page uses too.';
    },
    credits: 'Forms, aspect and senses for the authors: Wiktionary (CC BY-SA 4.0) via kaikki.org (Tatu Ylonen, wiktextract). Frequency: OpenSubtitles 2018 Serbian via Hermit Dave\'s FrequencyWords (CC BY-SA 4.0).'
  }
};
})();
