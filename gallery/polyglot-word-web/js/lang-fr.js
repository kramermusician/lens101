// French: search keys, panel and conjugation tables. Behaves as French Word Web did.
(function () {
'use strict';
var P = window.PWWUI, esc = P.esc, fold = P.fold;

var VOWEL = /^[aeiouyàâäéèêëîïôöùûüœ]/i;
var H_ASPIRE = { 'haïr': 1, 'hurler': 1, 'heurter': 1, 'hausser': 1, 'harceler': 1, 'hanter': 1, 'hâter': 1, 'hocher': 1, 'hisser': 1, 'happer': 1, 'hacher': 1, 'haleter': 1, 'handicaper': 1, 'harponner': 1, 'hennir': 1, 'honnir': 1, 'huer': 1 };
function elides(node, form) {
  if (VOWEL.test(form)) return true;
  return /^h/i.test(form) && !H_ASPIRE[node.w];
}
function display(n) {
  if (n.pos === 'verb' && n.pron) return (elides(n, n.w) ? "s'" : 'se ') + n.w;
  if (n.pos === 'noun' && n.art) return n.art + (n.art === "l'" ? '' : ' ') + n.w;
  return n.w;
}
function forms(n) {
  var seen = {};
  if (!n.c) return [];
  ['pr', 'im', 'fu', 'co', 'sp', 'ps', 'ip'].forEach(function (t) {
    (n.c[t] || []).forEach(function (f) { P.alts(f).forEach(function (v) { seen[v] = 1; }); });
  });
  [n.c.pp, n.c.ppr].forEach(function (f) { P.alts(f).forEach(function (v) { seen[v] = 1; }); });
  return Object.keys(seen);
}

// ---------- conjugation ----------
var SUBJ = ['je', 'tu', 'il / elle', 'nous', 'vous', 'ils / elles'];
var REFL = ['me', 'te', 'se', 'nous', 'vous', 'se'];
var ETRE = ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'];
var AVOIR = ['ai', 'as', 'a', 'avons', 'avez', 'ont'];

function person(n, i, form, que) {
  var first = form.split(' / ')[0];
  var el = elides(n, first);
  var pro;
  if (n.pron) {
    var r = REFL[i];
    var rr = (el && /e$/.test(r) && r.length === 2) ? r[0] + "'" : r + ' ';
    pro = SUBJ[i] + ' ' + rr;
    if (que) pro = (i === 2 || i === 5 ? "qu'" : 'que ') + pro;
    return [pro, form];
  }
  pro = (i === 0 && el) ? "j'" : SUBJ[i] + ' ';
  if (que) pro = (i === 2 || i === 5 ? "qu'" : 'que ') + pro;
  return [pro, form];
}
function table(n, title, sub, fs, que) {
  var rows = [];
  for (var i = 0; i < 6; i++) {
    var f = fs[i];
    rows.push(f ? person(n, i, f, que) : [SUBJ[i], '']);
  }
  return P.tense(title, sub, rows);
}
function passeCompose(n) {
  var etre = n.pron || n.aux === 'être' || n.aux === 'both';
  var aux = etre ? ETRE : AVOIR, out = [];
  var pp = n.c.pp.split(' / ')[0];
  for (var i = 0; i < 6; i++) {
    if (!n.c.pr[i]) { out.push(''); continue; }
    var agree = etre ? (i < 3 ? '(e)' : (/s$/.test(pp) ? '(es)' : '(e)s')) : '';
    out.push(aux[i] + ' ' + pp + agree);
  }
  return out;
}
function imperative(n) {
  var who = ['(tu)', '(nous)', '(vous)'], tail = ['-toi', '-nous', '-vous'], rows = [];
  for (var i = 0; i < 3; i++) {
    var f = n.c.ip[i];
    if (f && n.pron) f = f.split(' / ').map(function (v) { return v + tail[i]; }).join(' / ');
    rows.push([who[i], f || '']);
  }
  return P.tense('Impératif', 'do it', rows);
}
function conjHtml(n) {
  var c = n.c, h = '<div class="tenses' + (n.pron ? ' one' : '') + '">';
  h += table(n, 'Présent', 'now', c.pr);
  h += table(n, 'Passé composé', 'did', passeCompose(n));
  h += table(n, 'Imparfait', 'was doing', c.im);
  h += table(n, 'Futur', 'will', c.fu);
  h += table(n, 'Conditionnel', 'would', c.co);
  h += table(n, 'Subjonctif', 'that I do', c.sp, true);
  h += imperative(n);
  h += '<div class="tense"><h4>Participes</h4><table>' +
       '<tr><td class="p">passé</td><td class="f">' + esc(c.pp || '—') + '</td></tr>' +
       '<tr><td class="p">présent</td><td class="f">' + esc(c.ppr || '—') + '</td></tr></table></div>';
  h += '</div>';
  var notes = [];
  if (n.pron) notes.push('Used with se. The passé composé takes être.');
  else if (n.aux === 'être') notes.push('The passé composé takes être, so the participle agrees with the subject.');
  else if (n.aux === 'both') notes.push('Takes être when it is about movement (je suis ' + esc(c.pp) + '), and avoir when it has a direct object (j\'ai ' + esc(c.pp) + ' la valise).');
  if (notes.length) h += '<p class="note">' + notes.join(' ') + '</p>';
  h += '<details><summary>Passé simple (written French)</summary><div class="tenses">' + table(n, 'Passé simple', 'books', c.ps) + '</div></details>';
  return h;
}

// light up the open word inside its sentence: the word itself, or any of its verb forms
function exHtml(n) {
  var fs = [n.w].concat(forms(n));
  fs.sort(function (a, b) { return b.length - a.length; });
  var L = 'a-zA-ZÀ-ſ', src = fs.map(P.reEsc).join('|');
  var re = new RegExp('(^|[^' + L + '])(' + src + ')(' + (n.c ? 'es|e|s' : 'es|e|s|x|nes|ne|les|le|tes|te') + ')?(?![' + L + '])', n.c ? 'i' : 'gi');
  var t = esc(n.ex.t || '').replace(re, function (m, a, w, tail) { return a + '<mark>' + w + (tail || '') + '</mark>'; });
  return P.exBox(n, t);
}

P.langs.fr = {
  code: 'fr', name: 'Français', en: 'French', htmlLang: 'fr',
  placeholder: 'French word, any verb form, or English: house, to run, happy',
  strip: /^(se |s'|to (be )?|the |a |an |le |la |les |l'|un |une |je |j'|tu |il |elle |on |nous |vous |ils |elles )/,
  display: display,
  keys: function (n, push) {
    push({ k: fold(n.w), how: 0 });
    if (n.pron) push({ k: fold(display(n)), how: 0 });
    forms(n).forEach(function (v) { if (v !== n.w) push({ k: fold(v), how: 1, form: v }); });
  },
  via: function (e) { return 'a form of ' + esc(e.n.w) + ': ' + esc(e.form); },
  emptyHtml: 'Type a French word in the box. Any verb form works: <b>suis</b> finds être, <b>irai</b> finds aller.<br><br>Or type English: <b>house</b> finds la maison, <b>to run</b> finds courir.',
  posTag: function (n, label) {
    return label + (n.pos === 'noun' && (n.art || n.gen) ? ', ' + (n.art === 'le' || n.gen === 'm' ? 'masculine' : n.art === 'la' || n.gen === 'f' ? 'feminine' : 'plural') + (n.art === 'les' ? ', plural' : '') : '');
  },
  tags: function (n) {
    var t = [];
    if (n.rank) t.push('#' + n.rank + ' most used verb');
    if (n.c) t.push('passé composé with ' + (n.pron ? 'être' : n.aux === 'both' ? 'être or avoir' : n.aux));
    return t;
  },
  exHtml: exHtml,
  body: function (n) {
    if (n.c) return '<h3>Conjugation</h3>' + conjHtml(n);
    if (n.pos === 'verb') return '<p class="note">No conjugation table for this verb yet.</p>';
    return '';
  },
  formsCount: function (n) { return forms(n).filter(function (v) { return v !== n.w; }).length; },
  about: {
    find: function (t) { return 'Type a French word (' + t('maison') + ', ' + t('heureux') + ') or any form of a verb: ' + t('suis') + ' finds être, ' + t('irai') + ' finds aller, ' + t('voulions') + ' finds vouloir. Accents are optional, so ' + t('etre') + ' finds être. English works too: ' + t('house') + ' finds la maison, ' + t('to run') + ' finds courir.'; },
    forms: 'every verb in présent, passé composé, imparfait, futur, conditionnel, subjonctif, impératif and both participles, with the passé simple folded away at the bottom',
    words: 'The list is chosen by how often a word is spoken, counted in Lexique 3.83, a research database built from French film subtitles. The first 500 words are the most used verbs; the rest are the most used verbs, nouns, adjectives and adverbs after those, with names, noise and crude words taken out by hand.',
    sources: function (D) {
      var chk = D.meta.check || [0, 0];
      return 'No one typed the verb tables. Each verb is matched to a pattern from Verbiste, an open conjugation project: parler follows the aimer pattern, finir its own, and so on. The build cuts the verb down to its stem and adds the endings of its pattern for every tense. Then it compares the result with the forms Lexique has seen in real subtitles: ' + P.num(chk[0]) + ' of ' + P.num(chk[1]) + ' agree, and nearly all of the few that differ are tagging mistakes in Lexique. The passé composé is put together in the page itself, from avoir or être plus the past participle.';
    },
    credits: 'Word frequencies: Lexique 3.83 (New, Pallier, Brysbaert, Ferrand), CC BY-SA 4.0. Conjugation patterns: Verbiste by Pierre Sarrazin, GPL, by way of the verbecc project.'
  }
};
})();
