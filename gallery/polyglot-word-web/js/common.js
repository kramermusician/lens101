// Polyglot Word Web: helpers shared by app.js and the four language files (lang-*.js).
// Each language file registers itself in PWWUI.langs.<code>; app.js does the rest.
(function () {
'use strict';
var P = window.PWWUI = window.PWWUI || {};
P.langs = P.langs || {};

// lower case, accents off, so "etre" finds être and "hablo" finds habló.
// Hangul splits into its letters here too, so a half-typed syllable (머) still matches 먹다.
P.fold = function (s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, "'").replace(/œ/g, 'oe').trim();
};
P.esc = function (s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
};
P.reEsc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };

// English meanings in a gloss, one search key each
P.meanings = function (g) {
  var out = [];
  (g || '').replace(/\([^)]*\)/g, ' ').split(/[,;\/]/).forEach(function (m) {
    m = P.fold(m).replace(/^to (be )?/, '').replace(/^(a|an|the) /, '').replace(/\s+/g, ' ').trim();
    if (m && out.indexOf(m) < 0) out.push(m);
  });
  return out;
};

P.num = function (x) { return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

// every alternative in a " / " cell, empty ones dropped
P.alts = function (f) { return String(f || '').split(' / ').filter(function (v) { return v; }); };

// one conjugation box: rows are [label, form]; an empty form shows a dash
P.tense = function (title, sub, rows) {
  var h = '';
  rows.forEach(function (r) {
    h += r[1] ? '<tr><td class="p">' + P.esc(r[0]) + '</td><td class="f">' + P.esc(r[1]) + '</td></tr>'
              : '<tr><td class="p">' + P.esc(r[0]) + '</td><td class="f none">&mdash;</td></tr>';
  });
  return '<div class="tense"><h4>' + title + (sub ? ' <small>' + sub + '</small>' : '') + '</h4><table>' + h + '</table></div>';
};

// the example box every language shares; main is the sentence html (with its <mark>), extra goes under it
P.EX_TAG = { pop: 'pop culture', news: 'current events' };
P.exBox = function (n, main, extra) {
  var ref = n.ex.tag ? '<div class="ref">' + (P.EX_TAG[n.ex.tag] || P.esc(n.ex.tag)) + (n.ex.ref ? ' · ' + P.esc(n.ex.ref) : '') + '</div>' : '';
  return '<div class="ex"><div class="t">' + main + '</div>' + (extra || '') + '<div class="en">' + P.esc(n.ex.en || '') + '</div>' + ref + '</div>';
};
})();
