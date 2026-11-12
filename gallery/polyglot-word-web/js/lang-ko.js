// Korean: search keys (Hangul, every generated ending, romanization), panel with the ending table.
// Every romanization line carries class "sec", which the Romanization button hides.
(function () {
'use strict';
var P = window.PWWUI, esc = P.esc, fold = P.fold;

var HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;
var IRR = { 'ㅂ': 'ㅂ irregular', 'ㄷ': 'ㄷ irregular', 'ㅅ': 'ㅅ irregular', 'ㅎ': 'ㅎ irregular', '르': '르 irregular', 'ㄹ': 'ㄹ drops', '으': '으 drops', '하다': '하다 verb', 'special': 'irregular' };

function rows(n) { return (n.k || []).filter(function (r) { return r && r[2]; }); }
function secLine(s, cls) { return s ? '<div class="sec ' + (cls || '') + '">' + esc(s) + '</div>' : ''; }

// light up the conjugated form if the sentence uses one from the table, else the stem plus its ending
function exHtml(n) {
  var t = n.ex.t || '', verbish = n.pos === 'verb' || n.pos === 'adj', cands = [];
  rows(n).forEach(function (r) {
    P.alts(r[2]).forEach(function (f) {
      cands.push(f);
      // the bare -아/어 stem (들어 봤어요, 더워서) and the past stem (들었는데) are what irregular verbs
      // show inside longer endings; they come straight from the polite forms, so no stem rules here
      // and the -(으)ㄹ stem (만날까요, 도울게요) and the -(으) stem (추우니까) likewise
      if (/요$/.test(f) && f.length > 2) cands.push(f.slice(0, -1));
      if (r[0] === 'pst' && /어요$/.test(f)) cands.push(f.slice(0, -2));
      if (r[0] === 'fut' && f.indexOf(' ') > 0) cands.push(f.split(' ')[0]);
      if (r[0] === 'if' && /면$/.test(f) && f.length > 2) cands.push(f.slice(0, -1));
    });
  });
  cands.push(n.w);
  if (verbish && /다$/.test(n.w) && n.w.length > 1) cands.push(n.w.slice(0, -1));
  cands.sort(function (a, b) { return b.length - a.length; });
  var hit = null;
  for (var c = 0; c < cands.length && !hit; c++) {
    var from = 0, i;
    while ((i = t.indexOf(cands[c], from)) >= 0) {
      if (i === 0 || !HANGUL.test(t[i - 1])) {
        var end = i + cands[c].length;
        if (verbish) while (end < t.length && HANGUL.test(t[end])) end++;
        hit = [i, end]; break;
      }
      from = i + 1;
    }
  }
  var main = hit ? esc(t.slice(0, hit[0])) + '<mark>' + esc(t.slice(hit[0], hit[1])) + '</mark>' + esc(t.slice(hit[1])) : esc(t);
  return P.exBox(n, main, secLine(n.ex.rom, 'exsec'));
}

// alternatives (먹어요 / 먹읍시다) may wrap between them, never inside one
function nw(s) { return String(s).split(' / ').map(function (x) { return '<span class="nw">' + esc(x) + '</span>'; }).join(' / '); }
function endingsHtml(n) {
  var rs = rows(n);
  if (!rs.length) return '';
  var h = '<div class="tense kt"><table>';
  rs.forEach(function (r) {
    h += '<tr><td class="p">' + esc(r[1]) + '</td><td class="f">' + nw(r[2]) + '</td><td class="sec r">' + nw(r[3] || '') + '</td></tr>';
  });
  h += '</table></div>';
  if (n.irr) h += '<p class="note">' + esc(IRR[n.irr] || n.irr) + (n.irr === '하다' ? ': 하다 becomes 해 before -아/어 endings.' : ': the stem changes before some endings, and the table shows the changed forms.') + '</p>';
  return '<h3>Endings</h3>' + h;
}

function nosp(s) { return fold(s).replace(/[\s\-'’·.]/g, ''); }

P.langs.ko = {
  code: 'ko', name: '한국어', en: 'Korean', htmlLang: 'ko',
  font: '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Helvetica Neue", Arial, sans-serif',
  placeholder: 'Korean word, any ending, romanization, or English: 먹어요, meokda, to eat',
  strip: /^(to (be )?|the |a |an )/,
  toggle: 'Romanization',
  display: function (n) { return n.w; },
  small: function (n) { return n.rom || ''; },
  keys: function (n, push) {
    push({ k: nosp(n.w), how: 0, m: 'n' });
    if (n.rom) push({ k: nosp(n.rom), how: 0, m: 'n', pen: .2, via: 'romanization' });
    if (n.hanja) push({ k: nosp(n.hanja), how: 0, m: 'n', pen: .3, via: 'hanja' });
    rows(n).forEach(function (r) {
      P.alts(r[2]).forEach(function (f) { if (f !== n.w) push({ k: nosp(f), how: 1, m: 'n', form: f, label: r[1] }); });
      if (r[3]) push({ k: nosp(r[3]), how: 1, m: 'n', pen: .2, form: r[2], label: r[1] });
    });
  },
  via: function (e) { return 'a form of ' + esc(e.n.w) + ': ' + esc(e.form) + (e.label ? ' (' + esc(e.label) + ')' : ''); },
  emptyHtml: 'Type a Korean word in the box. Any ending works: <b>먹어요</b>, <b>먹었어요</b> and <b>먹는</b> all find 먹다.<br><br>Romanization works too (<b>meokda</b>, <b>meog-eoyo</b>), and so does English: <b>to eat</b>, <b>house</b>.',
  head: function (n, color) {
    return '<h2 style="color:' + color + '">' + esc(n.w) + '</h2>' + secLine(n.rom, 'headsec');
  },
  posTag: function (n, label) { return n.pos === 'adj' ? 'adjective (describing verb)' : label; },
  tags: function (n) {
    var t = [];
    if (n.irr) t.push('<span class="badge">' + esc(IRR[n.irr] || n.irr) + '</span>');
    if (n.hanja) t.push('hanja ' + esc(n.hanja));
    if (n.rank) t.push('#' + n.rank + ' most used');
    return t;
  },
  exHtml: exHtml,
  body: endingsHtml,
  formsCount: function (n) { var c = 0; rows(n).forEach(function (r) { c += P.alts(r[2]).length; }); return c; },
  about: {
    find: function (t) { return 'Type a Korean word (' + t('먹다') + ', ' + t('집') + ') or any form in its table: ' + t('먹어요') + ', ' + t('먹었어요') + ' and ' + t('먹는') + ' all find 먹다. Romanization works with or without spaces and hyphens (' + t('meokda') + ', ' + t('meogeosseoyo') + '), and so does English: ' + t('to eat') + ', ' + t('house') + '.'; },
    forms: 'every verb and describing verb in the endings a learner needs past Hangul: polite present, past and future, formal, plain, honorific, please do, I want to, not, let\'s, and, so, if, but, and the noun modifier, each with its romanization. A badge marks an irregular verb',
    words: 'The list is chosen by how often a word is used in Korean, from subtitle frequency and the national learner word lists, with names and noise taken out.',
    sources: function (D) {
      var chk = D.meta.check, rt = D.meta.romTests;
      return 'No one typed the endings. The build takes the dictionary form, cuts off 다, looks up whether the stem is regular or one of the irregular kinds (ㅂ, ㄷ, ㅅ, ㅎ, 르, ㄹ, 으, 하다) in a table checked by hand for every verb, and adds each ending with the vowel and sound rules applied. Where Korean has a word of its own instead of the regular ending, it comes first (드세요 before 먹으세요, 몰라요 for 알다)' +
        (chk ? '. Every form is then compared with Dan Bravender\'s Korean conjugator, a separate program: ' + P.num(chk[0]) + ' of ' + P.num(chk[1]) + ' agree, and the few that differ are its mistakes (보이에요 for 보여요)' : '') +
        '. One romanizer module writes every romanization in the Revised Romanization, as the word is said rather than spelled (한국말 is hangungmal)' +
        (rt ? ', and it passes ' + P.num(rt[0]) + ' of ' + P.num(rt[1]) + ' test words' : '') + ', so no romanization is typed by hand.';
    },
    credits: 'Word list: the National Institute of Korean Language learner vocabulary list (2003, merged with TOPIK lists by julienshim on GitHub; rights stay with NIKL, fine for personal use) and OpenSubtitles 2018 Korean frequencies via Hermit Dave\'s FrequencyWords (CC BY-SA 4.0). Cross-check only, not shipped: Dan Bravender\'s korean_conjugation (AGPL).'
  }
};
})();
