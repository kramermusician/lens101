// Spanish: search keys, panel and conjugation tables (data shape in SPEC.md, "Spanish").
(function () {
'use strict';
var P = window.PWWUI, esc = P.esc, fold = P.fold;

var TENSES = ['pr', 'pi', 'im', 'fu', 'co', 'sp', 'si', 'ip'];
function display(n) {
  if (n.pos === 'verb' && n.pron) return n.w + 'se';
  if (n.pos === 'noun' && n.art) return n.art + ' ' + n.w;
  return n.w;
}
function forms(n) {
  var seen = {};
  if (!n.c) return [];
  TENSES.forEach(function (t) { (n.c[t] || []).forEach(function (f) { P.alts(f).forEach(function (v) { seen[v] = 1; }); }); });
  P.alts(n.c.ger).concat(P.alts(n.c.pp)).forEach(function (v) { seen[v] = 1; });
  return Object.keys(seen);
}

// ---------- pronouns stuck on the end (levántate, levantándose) ----------
// Spanish keeps the stress where it was; when the added syllables push it three from the end,
// it has to be written. So the page finds the stressed vowel of the bare form and marks it if needed.
var ACC = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }, UNACC = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' };
function isV(c) { return /[aeiouáéíóúü]/.test(c); }
function strong(c) { return /[aeoáéíóú]/.test(c); }
function nuclei(w) {
  var out = [], i = 0;
  w = w.toLowerCase();
  while (i < w.length) {
    if (isV(w[i])) {
      var s = i; i++;
      while (i < w.length && isV(w[i]) && !(strong(w[i - 1]) && strong(w[i]))) i++;
      out.push([s, i]);
    } else i++;
  }
  return out;
}
function stressIdx(w) {
  var nu = nuclei(w);
  for (var k = 0; k < nu.length; k++) if (/[áéíóú]/.test(w.slice(nu[k][0], nu[k][1]))) return k;
  if (/[aeiouns]$/i.test(w)) return Math.max(0, nu.length - 2);
  return nu.length - 1;
}
function attach(f, cl) {
  if (!f) return '';
  if (f === 'id' && cl === 'os') return 'idos';
  var stressed = stressIdx(f), accented = /[áéíóú]/.test(f), base = f;
  if (cl === 'nos' && /s$/.test(base)) base = base.slice(0, -1);
  if (cl === 'os' && /d$/.test(base)) {
    base = base.slice(0, -1);
    if (/i$/.test(base)) return base.slice(0, -1) + 'íos';
  }
  var w = base + cl, nu = nuclei(w), left = nu.length - stressed;
  if (left >= 3 && !accented) {
    var seg = nu[stressed], pos = -1;
    for (var i = seg[0]; i < seg[1]; i++) if (strong(w[i])) { pos = i; break; }
    if (pos < 0) pos = seg[1] - 1;
    if (ACC[w[pos]]) w = w.slice(0, pos) + ACC[w[pos]] + w.slice(pos + 1);
  } else if (left === 2 && accented && nuclei(f).length === 1) {
    w = w.replace(/[áéíóú]/, function (c) { return UNACC[c]; }); // dé + le = dele
  }
  return w;
}

// ---------- conjugation ----------
var PERS = ['yo', 'tú', 'él, ella, usted', 'nosotros', 'vosotros', 'ellos, ellas, ustedes'];
var REFL = ['me', 'te', 'se', 'nos', 'os', 'se'];
var HABER = ['he', 'has', 'ha', 'hemos', 'habéis', 'han'];
var IP_WHO = ['tú', 'usted', 'nosotros', 'vosotros', 'ustedes'], IP_CL = ['te', 'se', 'nos', 'os', 'se'];

function table(n, title, sub, fs) {
  var rows = [];
  for (var i = 0; i < 6; i++) {
    var f = (fs || [])[i];
    rows.push([PERS[i], f ? (n.pron ? REFL[i] + ' ' : '') + f : '']);
  }
  return P.tense(title, sub, rows);
}
function perfecto(n) {
  var pp = P.alts(n.c.pp)[0] || '', out = [];
  for (var i = 0; i < 6; i++) out.push(pp && (n.c.pr || [])[i] ? HABER[i] + ' ' + pp : '');
  return out;
}
function imperative(n) {
  var rows = [], ip = n.c.ip || [];
  for (var i = 0; i < 5; i++) {
    var f = ip[i];
    if (f && n.pron) f = P.alts(f).map(function (v) { return attach(v, IP_CL[i]); }).join(' / ');
    rows.push([IP_WHO[i], f || '']);
  }
  return P.tense('Imperativo', 'do it', rows);
}
function gerund(n) {
  return P.alts(n.c.ger).map(function (v) { return n.pron ? attach(v, 'se') : v; }).join(' / ');
}
function conjHtml(n) {
  var c = n.c, h = '<div class="tenses one">';
  h += table(n, 'Presente', 'now', c.pr);
  h += table(n, 'Pretérito perfecto', 'have done', perfecto(n));
  h += table(n, 'Pretérito', 'did', c.pi);
  h += table(n, 'Imperfecto', 'was doing, used to', c.im);
  h += table(n, 'Futuro', 'will', c.fu);
  h += table(n, 'Condicional', 'would', c.co);
  h += table(n, 'Subjuntivo presente', 'that I do', c.sp);
  h += table(n, 'Subjuntivo imperfecto', 'that I did', c.si);
  h += imperative(n);
  h += '<div class="tense"><h4>Gerundio y participio</h4><table>' +
       '<tr><td class="p">gerundio</td><td class="f">' + esc(gerund(n) || '—') + '</td></tr>' +
       '<tr><td class="p">participio</td><td class="f">' + esc(c.pp || '—') + '</td></tr></table></div>';
  h += '</div>';
  if (n.pron) h += '<p class="note">Said with se: me ' + esc(P.alts((c.pr || [])[0])[0] || n.w) + ', te ' + esc(P.alts((c.pr || [])[1])[0] || n.w) + '. In the imperativo and the gerundio the pronoun goes on the end.</p>';
  return h;
}

function exHtml(n) {
  var fs = [n.w, display(n)].concat(forms(n));
  if (n.c && n.pron) {
    (n.c.ip || []).forEach(function (f, i) { P.alts(f).forEach(function (v) { fs.push(attach(v, IP_CL[i])); }); });
    fs.push(gerund(n));
  }
  fs = fs.filter(function (v, i) { return v && fs.indexOf(v) === i; }).sort(function (a, b) { return b.length - a.length; });
  var src = fs.map(P.reEsc).join('|');
  var re = new RegExp('(^|[^\\p{L}])(' + src + ')(' + (n.c ? '' : 'es|s|as|os|a') + ')?(?![\\p{L}])', n.c ? 'iu' : 'giu');
  var t = esc(n.ex.t || '').replace(re, function (m, a, w, tail) { return a + '<mark>' + w + (tail || '') + '</mark>'; });
  return P.exBox(n, t);
}

P.langs.es = {
  code: 'es', name: 'Español', en: 'Spanish', htmlLang: 'es',
  placeholder: 'Spanish word, any verb form, or English: house, to eat, happy',
  strip: /^(se |me |te |nos |os |to (be )?|the |a |an |el |la |los |las |un |una |yo |tu |el |ella |usted |nosotros |vosotros |ellos |ellas |ustedes )/,
  display: display,
  keys: function (n, push) {
    push({ k: fold(n.w), how: 0 });
    if (n.pron) push({ k: fold(display(n)), how: 0 });
    forms(n).forEach(function (v) { if (v !== n.w) push({ k: fold(v), how: 1, form: v }); });
  },
  via: function (e) { return 'a form of ' + esc(display(e.n)) + ': ' + esc(e.form); },
  emptyHtml: 'Type a Spanish word in the box. Any verb form works: <b>fui</b> finds ir and ser, <b>hablo</b> finds hablar, and accents are optional.<br><br>Or type English: <b>house</b> finds la casa, <b>to eat</b> finds comer.',
  posTag: function (n, label) {
    if (n.pos !== 'noun' || !(n.art || n.gen)) return label;
    var fem = n.gen ? n.gen === 'f' : (n.art === 'la' || n.art === 'las');
    return label + ', ' + (fem ? 'feminine' : 'masculine') + (n.art === 'los' || n.art === 'las' ? ', plural' : '');
  },
  tags: function (n) {
    var t = [];
    if (n.rank) t.push('#' + n.rank + ' most used');
    if (n.pron) t.push('said with se');
    return t;
  },
  exHtml: exHtml,
  body: function (n) {
    if (n.c) return '<h3>Conjugation</h3>' + conjHtml(n);
    if (n.pos === 'verb') return '<p class="note">No conjugation table for this verb yet.</p>';
    return '';
  },
  formsCount: function (n) { return forms(n).filter(function (v) { return v !== n.w; }).length; },
  attach: attach,
  about: {
    find: function (t) { return 'Type a Spanish word (' + t('casa') + ', ' + t('feliz') + ') or any form of a verb: ' + t('hablo') + ' finds hablar, ' + t('fui') + ' finds ir and ser, ' + t('tengo') + ' finds tener. Accents are optional, so ' + t('hablo') + ' and ' + t('habló') + ' both work. English works too: ' + t('house') + ', ' + t('to eat') + '.'; },
    forms: 'every verb in presente, pretérito perfecto, pretérito, imperfecto, futuro, condicional, both subjuntivos, imperativo, gerundio and participio; for a verb said with se the pronouns are added (me levanto, levántate)',
    words: 'The list is chosen by how often a word is used in Spanish, from a frequency list built from film and TV subtitles, with names, noise and crude words taken out.',
    sources: function (D) {
      var chk = D.meta.check;
      return 'No one typed the verb tables. The build matches each verb to a Verbiste conjugation pattern and adds that pattern\'s endings to the stem for every tense' +
        (chk ? ', then compares the result with Fred Jehle\'s hand-written verb tables, a separate source: ' + P.num(chk[0]) + ' of ' + P.num(chk[1]) + ' forms agree' : '') +
        '. A few mistakes in the Verbiste patterns (pasar filed as a weather verb, salir missing sal) were fixed by hand. Subtitle counts are for word forms, so two hand-annotated Spanish treebanks decide which word each form belongs to (casa the noun, not casar). The pretérito perfecto (he hablado) is put together in the page itself, from haber plus the participle, and so are the se pronouns.';
    },
    credits: 'Conjugation patterns: Verbiste by Pierre Sarrazin, via verbecc (GPL). Frequency: OpenSubtitles 2018 via Hermit Dave\'s FrequencyWords (CC BY-SA 4.0). Lemmas and gender: Universal Dependencies Spanish AnCora (CC BY 4.0) and GSD (CC BY-SA 4.0). Cross-check only, not shipped: Fred Jehle\'s verb database (CC BY-NC-SA 3.0).'
  }
};
})();
