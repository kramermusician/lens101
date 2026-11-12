// Greek: search keys (Greek with or without accents and final sigma, every form in the tables,
// Latin letters), panel with the verb, noun and adjective tables, each form with its romanization.
// Every romanization line carries class "sec", which the Romanization button hides. No romanization
// is made here: the build writes them all (rom, cr, dr, ar, ex.rom, and meta.aux for θα, να and the
// articles the page puts in front of a form).
(function () {
'use strict';
var P = window.PWWUI, esc = P.esc, fold = P.fold;

var PERSONS = ['εγώ', 'εσύ', 'αυτός, αυτή', 'εμείς', 'εσείς', 'αυτοί'];
var CASES = ['nominative', 'genitive', 'accusative', 'vocative'];
var GENDER = { m: 'masculine', f: 'feminine', n: 'neuter', mf: 'masculine or feminine' };
// the article in front of each case, singular then plural, by gender
var ART = {
  m: [['ο', 'του', 'τον', ''], ['οι', 'των', 'τους', '']],
  f: [['η', 'της', 'την', ''], ['οι', 'των', 'τις', '']],
  n: [['το', 'του', 'το', ''], ['τα', 'των', 'τα', '']],
  mf: [['ο/η', '', '', ''], ['οι', 'των', '', '']]
};
var LETTER = /[\p{L}\p{M}]+/gu;
// a romanization line under a form: quieter than the form itself
var ROMSTYLE = 'color:var(--dim);font-size:13px;font-weight:400;margin-bottom:3px';

function meta() { return (window.PWW && window.PWW.el && window.PWW.el.meta) || {}; }
function aux(w) { var a = meta().aux || {}; return a[w] || ''; }

// ---------- search keys ----------
// Greek: accents and diaeresis off (fold does that), final ς read as σ, no spaces or punctuation
function gk(s) { return fold(s).replace(/ς/g, 'σ').replace(/[\s\-'’·.,;!;?]/g, ''); }
// Latin: one loose spelling for the romanization and for whatever is typed, so that kalimera,
// kaliméra, spiti, efharisto, efcharisto, gynaika, yineka, geia and ya all meet
function lk(s) {
  s = fold(s).replace(/[^a-z]/g, '');
  s = s.replace(/th/g, 'q').replace(/ph/g, 'f').replace(/ch|kh/g, 'h').replace(/ks/g, 'x').replace(/dh/g, 'd')
    .replace(/mp|mb/g, 'b').replace(/nt|nd/g, 'd').replace(/gk|ng|gg/g, 'g')
    .replace(/ou/g, 'u').replace(/au/g, 'av').replace(/eu/g, 'ev').replace(/af/g, 'av').replace(/ef/g, 'ev')
    .replace(/ai/g, 'e').replace(/ei|oi|ui/g, 'i').replace(/w/g, 'o')
    .replace(/y(?![aeiou])/g, 'i').replace(/g(?=[ei])/g, 'y').replace(/yi(?=[aeiou])/g, 'y')
    .replace(/(.)\1+/g, '$1');
  return s;
}
// what the user typed, with a leading θα, να or article taken off (θα γράψω finds γράψω)
var GREEK_LEAD = /^(θα|να|ας|δεν|μην|ο|η|το|οι|τα|του|της|των|τον|την|τους|τις)\s+(?=\S)/;
var LATIN_LEAD = /^(tha|na|as|den|min|o|i|to|oi|ta|tou|tis|ton|tin|tous)\s+(?=\S)/;
function qGreek(raw) {
  var s = String(raw || '').toLowerCase().trim();
  if (!/[Ͱ-Ͽἀ-῿]/.test(s)) return '';
  return gk(s.replace(GREEK_LEAD, ''));
}
function qLatin(raw) {
  var s = fold(raw);
  if (/[Ͱ-Ͽ]/.test(s) || !/[a-z]/.test(s)) return '';
  return lk(s.replace(LATIN_LEAD, ''));
}

// every [label, form, rom] of a word, for search and for counting
function allForms(n) {
  var out = [];
  if (n.c) {
    var lab = { pr: 'present', im: 'past continuous', ao: 'simple past', sb: 'after θα and να', ip: 'imperative' };
    ['pr', 'im', 'ao', 'sb', 'ip'].forEach(function (k) {
      (n.c[k] || []).forEach(function (f, i) {
        var who = k === 'ip' ? (i ? 'εσείς' : 'εσύ') : PERSONS[i];
        out.push([lab[k] + ', ' + who, f, ((n.cr || {})[k] || [])[i] || '']);
      });
    });
  }
  if (n.d) n.d.forEach(function (row, s) { row.forEach(function (f, i) { out.push([CASES[i] + (s ? ' plural' : ' singular'), f, ((n.dr || [])[s] || [])[i] || '']); }); });
  if (n.a) n.a.forEach(function (row, r) {
    row.forEach(function (f, g) { out.push([['masculine', 'feminine', 'neuter'][g] + ' ' + CASES[r % 4] + (r > 3 ? ' plural' : ''), f, ((n.ar || [])[r] || [])[g] || '']); });
  });
  return out.filter(function (x) { return x[1]; });
}

// ---------- panel ----------
function secLine(s, cls) { return s ? '<div class="sec ' + (cls || '') + '">' + esc(s) + '</div>' : ''; }
function pre(word, f) {
  return P.alts(f).map(function (a) { return word ? word + ' ' + a : a; }).join(' / ');
}
function preRom(word, r) {
  var w = aux(word);
  return P.alts(r).map(function (a) { return w ? w + ' ' + a : a; }).join(' / ');
}
function nw(s) { return String(s).split(' / ').map(function (x) { return '<span class="nw">' + esc(x) + '</span>'; }).join(' / '); }
// one table: rows are [label, form, rom]; an empty form shows a dash
function box(title, sub, rows) {
  var h = '';
  rows.forEach(function (r) {
    // the romanization sits under the form, so two tables fit side by side
    h += r[1] ? '<tr><td class="p">' + esc(r[0]) + '</td><td class="f">' + nw(r[1]) + (r[2] ? '<div class="sec" style="' + ROMSTYLE + '">' + nw(r[2]) + '</div>' : '') + '</td></tr>'
              : '<tr><td class="p">' + esc(r[0]) + '</td><td class="f none">&mdash;</td></tr>';
  });
  return '<div class="tense kt"><h4>' + title + (sub ? ' <small>' + sub + '</small>' : '') + '</h4><table>' + h + '</table></div>';
}
function verbHtml(n) {
  var c = n.c, r = n.cr || {};
  function six(k, word) {
    return PERSONS.map(function (p, i) {
      var f = (c[k] || [])[i] || '', x = (r[k] || [])[i] || '';
      return [p, f ? pre(word, f) : '', f ? preRom(word, x) : ''];
    });
  }
  var h = '<h3>Forms</h3><div class="tenses">';
  h += box('Present', 'now, usually', six('pr'));
  h += box('Past continuous', 'was doing, used to', six('im'));
  if ((c.ao || []).some(function (x) { return x; })) h += box('Simple past', 'did, once', six('ao'));
  if (n.nosb) {
    h += box('Future', 'θα + present', six('pr', 'θα'));
    h += box('Subjunctive', 'να + present', six('pr', 'να'));
  } else {
    h += box('Future continuous', 'θα + present: will be doing', six('pr', 'θα'));
    h += box('Future simple', 'θα + the perfective form: will do', six('sb', 'θα'));
    h += box('Subjunctive', 'να + the perfective form: to do, that I do', six('sb', 'να'));
  }
  var ip = c.ip || [];
  h += box('Imperative', 'do it!', [['εσύ', ip[0] || '', (r.ip || [])[0] || ''], ['εσείς', ip[1] || '', (r.ip || [])[1] || '']]);
  h += '</div>';
  var notes = [];
  if (n.dep) notes.push(esc(n.w) + ' has passive endings only (a deponent verb): these are its only forms, with an active meaning.');
  if (n.nosb) notes.push(esc(n.w) + ' has no perfective form of its own, so θα and να take the present.');
  if (!(c.ao || []).some(function (x) { return x; })) notes.push(esc(n.w) + ' has no simple past of its own: the past continuous is used for any past.');
  return h + notes.map(function (t) { return '<p class="note">' + t + '</p>'; }).join('');
}
function nounHtml(n) {
  var g = String(n.gen || '').replace('-p', ''), arts = ART[g] || ART.m;
  var h = '<h3>Cases</h3><div class="tenses">';
  ['singular', 'plural'].forEach(function (num, s) {
    if (s === 0 && /-p$/.test(n.gen || '')) return;
    var rows = CASES.map(function (cs, i) {
      var f = ((n.d || [])[s] || [])[i] || '', x = ((n.dr || [])[s] || [])[i] || '', a = arts[s][i];
      return [cs, f ? pre(a, f) : '', f ? preRom(a, x) : ''];
    });
    h += box(num === 'singular' ? 'Singular' : 'Plural', '', rows);
  });
  h += '</div>';
  if (/-p$/.test(n.gen || '')) h += '<p class="note">' + esc(n.w) + ' is used in the plural only.</p>';
  return h;
}
function adjHtml(n) {
  var a = n.a || [], ar = n.ar || [];
  function part(from, title) {
    var h = '<div class="tense kt"><h4>' + title + '</h4><table><tr><td class="p"></td><td class="p">masculine</td><td class="p">feminine</td><td class="p">neuter</td></tr>';
    for (var r = from; r < from + 4; r++) {
      h += '<tr><td class="p">' + CASES[r % 4] + '</td>';
      for (var g = 0; g < 3; g++) {
        var f = (a[r] || [])[g] || '', x = (ar[r] || [])[g] || '';
        h += f ? '<td class="f">' + nw(f) + '<div class="sec" style="' + ROMSTYLE + '">' + nw(x) + '</div></td>' : '<td class="f none">&mdash;</td>';
      }
      h += '</tr>';
    }
    return h + '</table></div>';
  }
  return '<h3>Forms</h3><div class="tenses one"><div class="wide">' + part(0, 'Singular') + '</div><div class="wide">' + part(4, 'Plural') + '</div></div>';
}

// light up the head word in the sentence in whatever form it takes, and the same word in the romanization
function exHtml(n) {
  var t = n.ex.t || '', rom = n.ex.rom || '';
  var want = {};
  want[gk(n.w)] = 1;
  allForms(n).forEach(function (x) { P.alts(x[1]).forEach(function (f) { want[gk(f)] = 1; }); });
  var toks = [], m;
  LETTER.lastIndex = 0;
  while ((m = LETTER.exec(t))) toks.push([m.index, m[0]]);
  var hit = -1, hitLen = 1;
  if (n.pos === 'expr') {
    var ew = String(n.w).match(LETTER) || [];
    for (var i = 0; i + ew.length <= toks.length && hit < 0; i++) {
      var ok = ew.every(function (w, j) { return gk(toks[i + j][1]) === gk(w); });
      if (ok) { hit = i; hitLen = ew.length; }
    }
  } else {
    for (var k = 0; k < toks.length && hit < 0; k++) if (want[gk(toks[k][1])]) hit = k;
  }
  function mark(s, list, at, len) {
    if (at < 0 || !list[at] || !list[at + len - 1]) return esc(s);
    var a = list[at][0], b = list[at + len - 1][0] + list[at + len - 1][1].length;
    return esc(s.slice(0, a)) + '<mark>' + esc(s.slice(a, b)) + '</mark>' + esc(s.slice(b));
  }
  var rtoks = [];
  LETTER.lastIndex = 0;
  while ((m = LETTER.exec(rom))) rtoks.push([m.index, m[0]]);
  var romHtml = rom ? '<div class="sec exsec">' + (rtoks.length === toks.length ? mark(rom, rtoks, hit, hitLen) : esc(rom)) + '</div>' : '';
  return P.exBox(n, mark(t, toks, hit, hitLen), romHtml);
}

P.langs.el = {
  code: 'el', name: 'Ελληνικά', en: 'Greek', htmlLang: 'el',
  placeholder: 'Greek word, any form, Latin letters, or English: έγραψα, spiti, house',
  strip: /^(to (be )?|the |a |an )/,
  toggle: 'Romanization',
  adjVerbs: false, noForms: false,
  query: { g: qGreek, l: qLatin },
  display: function (n) { return n.w; },
  small: function (n) { return n.rom || ''; },
  keys: function (n, push) {
    push({ k: gk(n.w), how: 0, m: 'g' });
    if (n.rom) push({ k: lk(n.rom), how: 0, m: 'l', pen: .2, via: 'romanization' });
    var seen = {};
    seen[gk(n.w)] = 1;
    allForms(n).forEach(function (x) {
      var al = P.alts(x[1]), rl = P.alts(x[2]);
      al.forEach(function (f, i) {
        var k = gk(f);
        if (seen[k]) return;
        seen[k] = 1;
        push({ k: k, how: 1, m: 'g', form: f, label: x[0] });
        if (rl[i]) push({ k: lk(rl[i]), how: 1, m: 'l', pen: .2, form: f, label: x[0] });
      });
    });
  },
  via: function (e) { return 'a form of ' + esc(e.n.w) + ': ' + esc(e.form) + (e.label ? ' (' + esc(e.label) + ')' : ''); },
  emptyHtml: 'Type a Greek word in the box. Any form works: <b>έγραψα</b>, <b>γράφεις</b> and <b>θα γράψω</b> all find γράφω, and <b>σπιτιού</b> finds σπίτι.<br><br>Accents are optional (<b>σπιτι</b>), and so is Greek itself: Latin letters work (<b>spiti</b>, <b>kalimera</b>, <b>efcharisto</b>), and so does English: <b>to write</b>, <b>house</b>.',
  head: function (n, color) {
    var art = n.art ? '<span style="color:var(--dim);font-weight:400">' + esc(n.art) + '</span> ' : '';
    var artR = n.art ? aux(n.art) : '';
    return '<h2 style="color:' + color + '">' + art + esc(n.w) + '</h2>' + secLine((artR ? artR + ' ' : '') + (n.rom || ''), 'headsec');
  },
  posTag: function (n, label) {
    if (n.pos === 'noun' && n.gen) return 'noun, ' + (GENDER[String(n.gen).replace('-p', '')] || n.gen) + (/-p$/.test(n.gen) ? ', plural only' : '');
    if (n.pos === 'verb' && n.dep) return 'verb, passive endings';
    return label;
  },
  tags: function (n) {
    var t = [];
    if (n.dep) t.push('<span class="badge">deponent</span>');
    if (n.rank) t.push('#' + n.rank + ' most used');
    return t;
  },
  exHtml: exHtml,
  body: function (n) { return n.c ? verbHtml(n) : n.d ? nounHtml(n) : n.a ? adjHtml(n) : ''; },
  formsCount: function (n) { var c = 0; allForms(n).forEach(function (x) { c += P.alts(x[1]).length; }); return c; },
  about: {
    find: function (t) { return 'Type a Greek word (' + t('γράφω') + ', ' + t('σπίτι') + ') or any form in its tables: ' + t('έγραψα') + ', ' + t('θα γράψω') + ' and ' + t('γράφεις') + ' all find γράφω, ' + t('σπιτιού') + ' finds σπίτι. Accents and final ς are optional (' + t('σπιτι') + '), Latin letters work (' + t('spiti') + ', ' + t('kalimera') + ', ' + t('efharisto') + '), and so does English: ' + t('to write') + ', ' + t('house') + '.'; },
    forms: 'every verb in the present, past continuous, simple past, both futures (θα), the subjunctive (να) and the imperative, with the passive forms for verbs that only have those (έρχομαι, κάθομαι); every noun with its article in four cases, singular and plural; every adjective in all three genders; each form with its romanization',
    words: 'The list is chosen by how often a word is used in Greek subtitles, counting every form of a word, with names, function words, crime-drama vocabulary and noise taken out and everyday words a beginner needs (food, music, seasons, colors) kept in.',
    sources: function (D) {
      var chk = D.meta.check, rt = D.meta.romTests;
      return 'No one typed the forms. They are read from the inflection tables of the English Wiktionary (and of the Greek Wiktionary for a word the English one has no table for)' +
        (chk && chk[1] ? '. Every cell is then compared with the Greek Wiktionary\'s own table for the same word, written separately by other editors: ' + P.num(chk[0]) + ' of ' + P.num(chk[1]) + ' cells share a form, and the build report lists the rest' : '') +
        '. One romanizer module writes every romanization, as the word is said (γεια is ya, μπαμπάς is bambás, θάλασσα is thálasa), with the accent kept on the stressed vowel' +
        (rt ? '; it passes ' + P.num(rt[0]) + ' of ' + P.num(rt[1]) + ' test words' : '') + ', so no romanization is typed by hand.';
    },
    credits: 'Forms and part of speech: English Wiktionary and Greek Wiktionary (CC BY-SA 4.0) as extracted by kaikki.org (wiktextract, Tatu Ylonen). Word frequency: OpenSubtitles 2018 Greek via Hermit Dave\'s FrequencyWords (CC BY-SA 4.0).'
  }
};
})();
