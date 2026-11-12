// Chinese: search keys (characters, traditional, pinyin with marks, numbers or no tones), panel with
// tone-colored pinyin and measure words. Every pinyin line carries class "sec", which the Pinyin button hides.
(function () {
'use strict';
var P = window.PWWUI, esc = P.esc, fold = P.fold;

var HAN = /\p{Script=Han}/u;
var MARK = { '̄': 1, '́': 2, '̌': 3, '̀': 4 };
function toneFromMarks(s) {
  var d = String(s).normalize('NFD');
  for (var i = 0; i < d.length; i++) if (MARK[d[i]]) return MARK[d[i]];
  return 5;
}
function syl(s) { return String(s || '').trim().split(/\s+/).filter(function (x) { return x; }); }
// tone of each syllable of the head word, from the numbered pinyin when it lines up, else from the marks
function tones(n) {
  var a = syl(n.py), b = syl(n.pyn);
  return a.map(function (s, i) {
    var m = b.length === a.length && /([1-5])$/.exec(b[i]);
    return m ? +m[1] : toneFromMarks(s);
  });
}
function pyHtml(n) {
  var a = syl(n.py), t = tones(n);
  return a.map(function (s, i) { return '<span class="t' + t[i] + '">' + esc(s) + '</span>'; }).join(' ');
}
function toneSpans(py) {
  return syl(py).map(function (s) { return '<span class="t' + toneFromMarks(s) + '">' + esc(s) + '</span>'; }).join(' ');
}

// key forms for search: no spaces; ü and v both read as u; neutral tone 5 may be left off
function nosp(s) { return fold(s).replace(/[\s\-'’·.]/g, ''); }
function toneless(s) { return nosp(s).replace(/v/g, 'u'); }
function numbered(s) { return String(s || '').toLowerCase().replace(/u:|ü|v/g, 'u').replace(/[\s\-'’·.]/g, '').replace(/5/g, ''); }
function marked(s) { return String(s || '').toLowerCase().normalize('NFC').replace(/[\s\-'’·.]/g, ''); }

// light up the head word in the sentence, and its syllables in the pinyin line when the two line up
function exHtml(n) {
  var t = n.ex.t || '', at = -1, len = 0;
  [n.w, n.tr].forEach(function (c) { if (c && at < 0) { at = t.indexOf(c); len = c.length; } });
  var chars = Array.from(t), main = '';
  var startCp = at < 0 ? -1 : Array.from(t.slice(0, at)).length, lenCp = at < 0 ? 0 : Array.from(t.substr(at, len)).length;
  chars.forEach(function (ch, i) {
    if (i === startCp) main += '<mark>';
    main += esc(ch);
    if (i === startCp + lenCp - 1) main += '</mark>';
  });
  var extra = '';
  if (n.ex.py) {
    var toks = syl(n.ex.py), hanIdx = [], k = 0;
    chars.forEach(function (ch, i) { if (HAN.test(ch)) hanIdx.push(i); });
    var sylToks = toks.filter(function (x) { return /\p{L}/u.test(x); });
    var lineUp = sylToks.length === hanIdx.length;
    extra = '<div class="sec exsec">' + toks.map(function (x) {
      if (!/\p{L}/u.test(x)) return esc(x);
      var ci = hanIdx[k++];
      var lit = lineUp && startCp >= 0 && ci >= startCp && ci < startCp + lenCp;
      return lit ? '<mark>' + esc(x) + '</mark>' : esc(x);
    }).join(' ') + '</div>';
  }
  return P.exBox(n, main, extra);
}

function mwHtml(n) {
  if (!n.mw || !n.mw.length) return '';
  return '<h3>Measure word' + (n.mw.length > 1 ? 's' : '') + '</h3><div class="mws">' + n.mw.map(function (m) {
    return '<span class="mw"><b>一' + esc(m[0]) + '</b><span class="sec">' + toneSpans(m[1]) + '</span></span>';
  }).join('<span class="slash">/</span>') + '</div><p class="note">Say a number, then the measure word, then the noun: <span class="nw">一' + esc(n.mw[0][0]) + esc(n.w) + '</span>, <span class="nw">两' + esc(n.mw[0][0]) + esc(n.w) + '</span>.</p>';
}

P.langs.zh = {
  code: 'zh', name: '中文', en: 'Chinese', htmlLang: 'zh-Hans',
  font: '-apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif',
  placeholder: 'Characters, pinyin (ni3hao3, nihao) or English: friend, to eat',
  strip: /^(to (be )?|the |a |an )/,
  toggle: 'Pinyin',
  display: function (n) { return n.w; },
  small: function (n) { return n.py || ''; },
  keys: function (n, push) {
    push({ k: nosp(n.w), how: 0, m: 'n', sub: 1 });
    if (n.tr && n.tr !== n.w) push({ k: nosp(n.tr), how: 0, m: 'n', sub: 1, via: 'traditional' });
    if (n.py) {
      push({ k: marked(n.py), how: 0, m: 'r', via: 'pinyin' });
      push({ k: toneless(n.py), how: 0, m: 'p', pen: .4, via: 'pinyin' });
    }
    if (n.pyn) push({ k: numbered(n.pyn), how: 0, m: 'p', via: 'pinyin' });
  },
  query: { r: marked, p: function (s) { return numbered(fold(s)); } },
  via: function (e) { return e.via || ''; },
  emptyHtml: 'Type Chinese characters in the box, or pinyin any way you like: <b>péngyou</b>, <b>peng2you5</b> or just <b>pengyou</b> all find 朋友.<br><br>Or type English: <b>friend</b>, <b>to eat</b>.',
  head: function (n, color) {
    var h = '<h2 style="color:' + color + '">' + esc(n.w) + (n.tr && n.tr !== n.w ? ' <small class="tr" title="traditional">' + esc(n.tr) + '</small>' : '') + '</h2>';
    if (n.py) h += '<div class="sec headsec py">' + pyHtml(n) + '</div>';
    return h;
  },
  posTag: function (n, label) { return label; },
  tags: function (n) {
    var t = [];
    if (n.hsk) t.push('HSK ' + esc(n.hsk));
    if (n.rank) t.push('#' + n.rank + ' most used');
    return t;
  },
  exHtml: exHtml,
  body: mwHtml,
  formsCount: function () { return 0; },
  pyHtml: pyHtml,
  about: {
    find: function (t) { return 'Type characters (' + t('朋友') + ', ' + t('吃') + '), traditional characters too, or pinyin in any of three ways: with tone marks (' + t('péngyou') + '), with tone numbers (' + t('peng2you5') + ', ' + t('ni3hao3') + ') or with no tones at all (' + t('pengyou') + ', ' + t('ni hao') + '). English works too: ' + t('friend') + ', ' + t('to eat') + '.'; },
    forms: 'the pinyin of every word with each syllable colored by its tone, the traditional characters when they differ, and the measure word for a noun (一个, 一只), each with its pinyin',
    words: 'The words come from the HSK learner lists (HSK 3.0, levels 1 to 4), ordered by how often each is used in SUBTLEX-CH, a count of 33.5 million words of Chinese film and TV subtitles. Particles, pronouns, measure words and conjunctions are left out as head words.',
    // from langs/zh/build/sources/SOURCES.md
    sources: function (D) {
      var chk = D.meta.check;
      return 'Pinyin, traditional characters and measure words come from CC-CEDICT, an open Chinese-English dictionary, so none of them is typed by hand. The pinyin under each example sentence is written by the author, one syllable per character, and the build checks it against its own converter built from CC-CEDICT, listing any disagreement instead of quietly changing it' +
        (chk && chk[1] ? ': ' + P.num(chk[0]) + ' of ' + P.num(chk[1]) + ' agree.' : '.');
    },
    credits: 'Pinyin, traditional forms and measure words: CC-CEDICT (MDBG), CC BY-SA 4.0. HSK lists: complete-hsk-vocabulary by Yanis Zafirópulos, MIT. Word frequencies: SUBTLEX-CH (Cai and Brysbaert 2010), free for research and non-commercial use.'
  }
};
// tone colors, also used by the legend on the About page
P.TONE_LABEL = ['', 'first tone (high, flat)', 'second tone (rising)', 'third tone (dip)', 'fourth tone (falling)', 'neutral tone'];
})();
