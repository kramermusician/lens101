// Japanese: search keys (kanji, kana, romaji with or without long-vowel marks, every generated form),
// panel with the forms table, counter and reading. Every romaji line carries class "sec", which the
// Romaji button hides; the kana reading stays.
(function () {
'use strict';
var P = window.PWWUI, esc = P.esc, fold = P.fold;

var KANJI = /[㐀-䶿一-鿿豈-﫿々]/;
var LATIN = /[a-zA-ZāīūēōâîûêôÀ-ɏ]/;
var CLS = { godan: 'godan verb (u-verb)', ichidan: 'ichidan verb (ru-verb)', suru: 'suru verb', kuru: 'kuru (irregular)', irregular: 'irregular in some forms' };

function rows(n) { return (n.k || []).filter(function (r) { return r && r[2]; }); }
function kanaOf(r) { return r[4] || r[2]; }
function nosp(s) { return fold(s).replace(/[\s\-'’·.]/g, ''); }

// katakana to hiragana (ー kept)
function hira(s) {
  return String(s || '').normalize('NFC').replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
}
// one spelling for a long vowel, so とうきょう, toukyou, tōkyō and tookyoo all meet: a vowel kana
// that lengthens the one before it becomes ー
var ROWS = { a: 'あかさたなはまやらわがざだばぱぁゃ', i: 'いきしちにひみりぎじぢびぴぃ', u: 'うくすつぬふむゆるぐずづぶぷぅゅ', e: 'えけせてねへめれげぜでべぺぇ', o: 'おこそとのほもよろをごぞどぼぽぉょ' };
function vowelOf(c) { for (var v in ROWS) if (ROWS[v].indexOf(c) >= 0) return v; return ''; }
function longNorm(h) {
  var out = '';
  for (var i = 0; i < h.length; i++) {
    var c = h[i], prev = out[out.length - 1] || '', v = vowelOf(prev);
    if (v && ((c === 'う' && (v === 'o' || v === 'u')) || (c === 'お' && v === 'o') || (c === 'あ' && v === 'a') ||
              (c === 'い' && (v === 'e' || v === 'i')) || (c === 'え' && v === 'e'))) { out += 'ー'; continue; }
    out += c;
  }
  return out.replace(/ー+/g, 'ー');
}

// romaji (Hepburn, Kunrei or typed kana-by-kana) to hiragana; an unfinished last consonant is dropped
var R2K = {};
(function () {
  var base = {
    a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
    ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
    sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ', za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
    ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と', da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
    na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の', ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
    ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ', pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
    ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も', ya: 'や', yu: 'ゆ', yo: 'よ',
    ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ', wa: 'わ', wo: 'を', vu: 'ゔ',
    fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ', va: 'ゔぁ', vi: 'ゔぃ', ve: 'ゔぇ', vo: 'ゔぉ', we: 'うぇ', wi: 'うぃ',
    she: 'しぇ', je: 'じぇ', che: 'ちぇ', tsa: 'つぁ', ye: 'いぇ'
  };
  Object.keys(base).forEach(function (k) { R2K[k] = base[k]; });
  var y = { k: 'き', g: 'ぎ', n: 'に', h: 'ひ', b: 'び', p: 'ぴ', m: 'み', r: 'り', s: 'し', z: 'じ', t: 'ち', d: 'ぢ', j: 'じ', c: 'ち' };
  Object.keys(y).forEach(function (c) {
    R2K[c + 'ya'] = y[c] + 'ゃ'; R2K[c + 'yu'] = y[c] + 'ゅ'; R2K[c + 'yo'] = y[c] + 'ょ';
  });
  R2K.sha = 'しゃ'; R2K.shu = 'しゅ'; R2K.sho = 'しょ'; R2K.cha = 'ちゃ'; R2K.chu = 'ちゅ'; R2K.cho = 'ちょ';
  R2K.ja = 'じゃ'; R2K.ju = 'じゅ'; R2K.jo = 'じょ';
})();
function romaToKana(s) {
  s = String(s || '').toLowerCase().normalize('NFC')
    .replace(/ā/g, 'aa').replace(/ī/g, 'ii').replace(/ū/g, 'uu').replace(/ē/g, 'ee').replace(/ō/g, 'ou')
    .replace(/â/g, 'aa').replace(/î/g, 'ii').replace(/û/g, 'uu').replace(/ê/g, 'ee').replace(/ô/g, 'ou')
    .replace(/[\s\-'’·.]/g, function (c) { return c === "'" || c === '’' ? "'" : ''; });
  var out = '', i = 0;
  while (i < s.length) {
    var c = s[i];
    if (c === "'") { i++; continue; }
    if (c === 'n') {
      var nx = s[i + 1];
      if (nx === 'n' && !/[aiueoy]/.test(s[i + 2] || '')) { out += 'ん'; i += 2; continue; }
      if (nx === "'" || (nx && !/[aiueoy]/.test(nx))) { out += 'ん'; i += 1; continue; }
      if (!nx) { out += 'ん'; i += 1; continue; }
    }
    // doubled consonant: っ (tch for っち)
    if (/[bcdfghjkmpqrstvwxyz]/.test(c) && (s[i + 1] === c || (c === 't' && s[i + 1] === 'c'))) { out += 'っ'; i += 1; continue; }
    var hit = '';
    for (var len = 3; len >= 1 && !hit; len--) {
      var k = s.substr(i, len);
      if (R2K[k]) { hit = k; }
    }
    if (hit) { out += R2K[hit]; i += hit.length; continue; }
    if (/[a-z]/.test(c)) { i++; if (i >= s.length) break; out += c; continue; }   // an unfinished consonant
    out += c; i++;
  }
  return out;
}
// the 'k' search key: hiragana, long vowels as ー, no spaces
function kkey(s) { return longNorm(hira(String(s || '').replace(/[\s・、。]/g, ''))); }
function kquery(raw) {
  raw = String(raw || '').trim();
  if (!raw || KANJI.test(raw)) return '';
  if (LATIN.test(raw)) {
    var k = romaToKana(raw);
    if (/[a-z]/.test(k)) return '';   // not romaji after all (English words go through the meanings)
    return kkey(k);
  }
  return kkey(raw);
}

// light up the head word in the sentence: the longest of its written forms found there
function exHtml(n) {
  var t = n.ex.t || '', cands = [n.w].concat(n.alt || []);
  rows(n).forEach(function (r) { P.alts(r[2]).forEach(function (f) { cands.push(f); }); });
  if ((n.pos === 'verb' || n.pos === 'adj') && rows(n).length) {
    // the stem shared by every form, plus one kana (食べ, 書か, 書き, 書い): catches 食べています, 書いてから
    var fs = []; rows(n).forEach(function (r) { P.alts(r[2]).forEach(function (f) { fs.push(f); }); });
    var lcp = fs.reduce(function (a, b) { var i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });
    if (lcp.length >= 1 && KANJI.test(lcp)) fs.forEach(function (f) { cands.push(f.slice(0, lcp.length + 1)); });
  }
  if (n.pos === 'expr') cands.push(n.w.replace(/[。！？!?]/g, ''));
  cands = cands.filter(function (c) { return c; }).sort(function (a, b) { return b.length - a.length; });
  var hit = null;
  for (var c = 0; c < cands.length && !hit; c++) {
    var i = t.indexOf(cands[c]);
    if (i >= 0) hit = [i, i + cands[c].length];
  }
  var main = hit ? esc(t.slice(0, hit[0])) + '<mark>' + esc(t.slice(hit[0], hit[1])) + '</mark>' + esc(t.slice(hit[1])) : esc(t);
  var extra = '';
  if (n.ex.kana) extra += '<div class="exkana" style="color:var(--dim);font-size:15px;margin-top:4px;letter-spacing:.02em">' + esc(n.ex.kana) + '</div>';
  if (n.ex.rom) extra += '<div class="sec exsec">' + esc(n.ex.rom) + '</div>';
  return P.exBox(n, main, extra);
}

function nw(s) { return String(s).split(' / ').map(function (x) { return '<span class="nw">' + esc(x) + '</span>'; }).join(' / '); }
function formsHtml(n) {
  var rs = rows(n);
  if (!rs.length) return '';
  var h = '<div class="tense kt"><table>';
  rs.forEach(function (r) {
    var k = kanaOf(r);
    // two columns: the label, then the form with its kana and romaji under it (the panel is narrow)
    h += '<tr><td class="p">' + esc(r[1]) + '</td><td class="f">' + nw(r[2]) +
      (k !== r[2] ? '<div style="color:var(--dim);font-size:13px">' + nw(k) + '</div>' : '') +
      '<div class="sec r" style="color:var(--dim);font-size:13px">' + nw(r[3] || '') + '</div></td></tr>';
  });
  h += '</table></div>';
  var note = '';
  if (n.cls === 'godan') note = 'Godan (u-verb): the last kana changes row before each ending (書く, 書かない, 書きます, 書いて).';
  else if (n.cls === 'ichidan') note = 'Ichidan (ru-verb): drop る and add the ending (食べる, 食べない, 食べます).';
  else if (n.cls === 'suru') note = 'A する verb: only する changes (します, しない, できる for can).';
  else if (n.cls === 'kuru') note = '来る is irregular: the kanji stays and its reading changes (きます, こない, くる).';
  else if (n.cls === 'irregular') note = 'Mostly regular, with a few forms of its own; a dash means the form is not used.';
  else if (n.adj === 'i') note = 'An i-adjective: the final い changes (高くない, 高かった, 高く).';
  else if (n.adj === 'na') note = 'A na-adjective: it takes な before a noun and だ, です or じゃない after it.';
  return '<h3>Forms</h3>' + h + (note ? '<p class="note">' + esc(note) + '</p>' : '');
}
function counterHtml(n) {
  if (!n.ctr || !n.ctr.length) return '';
  return '<h3>Counter</h3><div class="mws">' + n.ctr.map(function (c) {
    return '<span class="mw"><b>' + esc(c[0]) + '</b><span>' + esc(c[1]) + '</span><span class="sec">' + esc(c[2]) + '</span></span>';
  }).join('') + '</div><p class="note">Number, then the counter: ' + esc(n.ctr[0][3] ? n.ctr[0][3] + '. ' : '') +
    'Some numbers change its sound (一本 いっぽん, 三本 さんぼん).</p>';
}

P.langs.ja = {
  code: 'ja', name: '日本語', en: 'Japanese', htmlLang: 'ja',
  font: '-apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Helvetica Neue", Arial, sans-serif',
  placeholder: 'Kanji, kana, romaji (tabemashita) or English: to eat',
  strip: /^(to (be )?|the |a |an )/,
  toggle: 'Romaji',
  display: function (n) { return n.w; },
  small: function (n) { return n.kana && n.kana !== n.w ? n.kana : (n.rom || ''); },
  keys: function (n, push) {
    push({ k: nosp(n.w), how: 0, m: 'n', sub: 1 });
    (n.alt || []).forEach(function (a) { push({ k: nosp(a), how: 0, m: 'n', sub: 1, pen: .3, via: 'also written ' + a }); });
    if (n.kana) push({ k: kkey(n.kana), how: 0, m: 'k', pen: n.kana === n.w ? 0 : .1, via: n.kana === n.w ? '' : 'reading' });
    if (n.rom) push({ k: nosp(n.rom), how: 0, m: 'n', pen: .2, via: 'romaji' });
    rows(n).forEach(function (r) {
      P.alts(r[2]).forEach(function (f) { if (f !== n.w) push({ k: nosp(f), how: 1, m: 'n', sub: 1, form: f, label: r[1] }); });
      P.alts(kanaOf(r)).forEach(function (f) { if (f !== n.kana) push({ k: kkey(f), how: 1, m: 'k', form: r[2], label: r[1] }); });
      P.alts(r[3]).forEach(function (f) { push({ k: nosp(f), how: 1, m: 'n', pen: .2, form: r[2], label: r[1] }); });
    });
  },
  query: { k: kquery },
  via: function (e) {
    if (e.form) return 'a form of ' + esc(e.n.w) + ': ' + esc(e.form) + (e.label ? ' (' + esc(e.label) + ')' : '');
    return e.via ? esc(e.via) : '';
  },
  emptyHtml: 'Type a Japanese word in the box: kanji, kana or romaji. Any form works: <b>食べました</b>, <b>たべない</b> and <b>tabete</b> all find 食べる.<br><br>Long vowels any way you like (<b>gakkō</b>, <b>gakkou</b>, <b>gakko</b>), and English too: <b>to eat</b>, <b>house</b>.',
  head: function (n, color) {
    var h = '<h2 style="color:' + color + '">' + esc(n.w) + '</h2>';
    if (n.kana && n.kana !== n.w) h += '<div class="headsec" style="font-size:19px">' + esc(n.kana) + '</div>';
    if (n.rom) h += '<div class="sec headsec">' + esc(n.rom) + '</div>';
    return h;
  },
  posTag: function (n, label) {
    if (n.pos === 'adj') return n.adj === 'na' ? 'na-adjective' : 'i-adjective';
    return label;
  },
  tags: function (n) {
    var t = [];
    if (n.cls) t.push('<span class="badge">' + esc(CLS[n.cls] || n.cls) + '</span>');
    if (n.jlpt) t.push('JLPT N' + esc(n.jlpt));
    if (n.alt && n.alt.length) t.push('also ' + n.alt.map(esc).join(', '));
    if (n.rank) t.push('#' + n.rank + ' most used');
    return t;
  },
  exHtml: exHtml,
  body: function (n) { return formsHtml(n) + counterHtml(n); },
  formsCount: function (n) { var c = 0; rows(n).forEach(function (r) { c += P.alts(r[2]).length; }); return c; },
  adjVerbs: false,
  noForms: false,
  romaToKana: romaToKana,
  about: {
    find: function (t) { return 'Type kanji, kana or romaji (' + t('食べる') + ', ' + t('たべる') + ', ' + t('taberu') + '), or any form in the table: ' + t('食べました') + ', ' + t('たべない') + ' and ' + t('tabete') + ' all find 食べる. Long vowels work with marks, doubled or left short (' + t('gakkō') + ', ' + t('gakkou') + ', ' + t('gakko') + '), and so does English: ' + t('to eat') + ', ' + t('house') + '.'; },
    forms: 'every verb in nineteen forms (polite, past and negative, plain negative and past, te form, can, let\'s, passive, causative, if with -ba and -tara, imperative, want to) and every adjective in its i- or na-adjective endings, each with its kana and romaji; a badge gives the verb class, and some nouns show their counter',
    words: 'The words come from the JLPT N5 to N3 lists, ordered by how often each is used (wordfreq, which counts subtitles, the web and Wikipedia), with everyday words weighted over news words. Particles, pronouns, numbers and counters are left out as head words; the 60 set expressions were chosen by hand.',
    sources: function (D) {
      var chk = D.meta.check, rt = D.meta.romTests;
      return 'No one typed the forms. The build takes the dictionary form and its class from JMdict (godan, ichidan, する, 来る and the few irregular verbs), changes only the end of the word, and does the same to the kanji spelling and the reading' +
        (chk && chk[1] ? '. Every form is then compared with a separate conjugator program and with Wiktionary\'s conjugation tables: ' + P.num(chk[0]) + ' of ' + P.num(chk[1]) + ' agree, and the rest are explained in the build report (the other program writes 静かなかった for 静かじゃなかった)' : '') +
        '. One romanizer module writes every romaji in Hepburn with long-vowel marks' + (rt ? ', and it passes ' + P.num(rt[0]) + ' of ' + P.num(rt[1]) + ' test words' : '') +
        '. The kana reading under each example sentence is written by the author and checked by the build against the sentence; the romaji comes from it.';
    },
    credits: 'Readings and parts of speech: JMdict (EDRDG), CC BY-SA 4.0. Word list: JLPT lists by Jonathan Waller (tanos.co.uk), CC BY, via open-anki-jlpt-decks (MIT). Frequency: wordfreq by Robyn Speer, CC BY-SA 4.0. Cross-check only, not shipped: japanese-verb-conjugator-v2 (BSD) and Wiktionary tables via kaikki.org (CC BY-SA).'
  }
};
})();
