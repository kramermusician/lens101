// Polyglot Word Web: hear a word, a form or the example sentence, through the browser's own speech (speechSynthesis).
// Chrome offers its Google voices when online (French, Spanish, Korean, Chinese, Japanese) and the Mac's built-in voices
// always, so speech keeps working with wifi off. Serbian has no voice on a Mac: it is read in Latin letters by a
// Croatian voice (Lana), which pronounces Serbian closely. The voice picked for each language is remembered.
(function () {
'use strict';
var P = window.PWWUI = window.PWWUI || {};
var synth = window.speechSynthesis;
var S = P.speak = { ok: !!(synth && window.SpeechSynthesisUtterance) };
if (!S.ok) { S.decorate = function () {}; S.handle = function () { return false; }; return; }

// BCP 47 tags each language accepts, best first
var TAGS = { fr: ['fr-FR', 'fr'], es: ['es-ES', 'es-MX', 'es-US', 'es'], ko: ['ko-KR', 'ko'], zh: ['zh-CN', 'zh-TW', 'zh'],
             ja: ['ja-JP', 'ja'], sr: ['sr-RS', 'sr', 'hr-HR', 'hr', 'bs'], el: ['el-GR', 'el'] };
// Mac voices that are jokes or effects, never picked on their own
var NOVELTY = /^(Grandma|Grandpa|Rocko|Shelley|Sandy|Eddy|Flo|Reed|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Albert|Fred|Junior|Ralph|Kathy)\b/;

var voices = [];
function loadVoices() { voices = synth.getVoices() || []; }
loadVoices();
if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices); else synth.onvoiceschanged = loadVoices;

function store(k, v) { try { if (v == null) localStorage.removeItem('pww.voice.' + k); else localStorage.setItem('pww.voice.' + k, v); } catch (e) {} }
function stored(k) { try { return localStorage.getItem('pww.voice.' + k); } catch (e) { return null; } }

function norm(t) { return String(t || '').replace('_', '-').toLowerCase(); }
// every voice usable for a language, best first: exact tag order, then online Google voices when online, then Premium/Enhanced, then plain
S.voicesFor = function (code) {
  var tags = (TAGS[code] || [code]).map(norm), online = navigator.onLine !== false;
  return voices.filter(function (v) {
    var l = norm(v.lang);
    return tags.some(function (t) { return l === t || l.indexOf(t + '-') === 0; });
  }).map(function (v) {
    var l = norm(v.lang), ti = tags.findIndex(function (t) { return l === t || l.indexOf(t + '-') === 0; });
    var s = ti * 10;
    if (/google/i.test(v.name)) s += online ? -5 : 50;
    if (/premium|enhanced|siri/i.test(v.name)) s -= 3;
    if (NOVELTY.test(v.name)) s += 30;
    return { v: v, s: s };
  }).sort(function (a, b) { return a.s - b.s; }).map(function (x) { return x.v; });
};
S.voice = function (code) {
  var list = S.voicesFor(code), want = stored(code);
  if (want) for (var i = 0; i < list.length; i++) if (list[i].name === want) {
    // a remembered online voice is skipped while offline
    if (!(list[i].localService === false && navigator.onLine === false)) return list[i];
  }
  return list[0] || null;
};
S.setVoice = function (code, name) { store(code, name || null); };

// what is said: Serbian goes to Latin letters when the voice is not a Serbian one (the Croatian voice reads Latin only)
function spoken(code, text) {
  text = String(text || '').replace(/\s+/g, ' ').trim();
  if (code === 'sr') {
    var v = S.voice('sr');
    if (!(v && /^sr/i.test(v.lang)) && P.langs.sr && P.langs.sr.lat) text = P.langs.sr.lat(text);
  }
  return text;
}

var lastText = '', lastEnd = 0, playing = null;
// say(code, text, button): pressing the same thing again within 5 seconds of it ending says it slowly
S.say = function (code, text, btn) {
  text = spoken(code, text);
  if (!text) return;
  var slow = text === lastText && Date.now() - lastEnd < 5000;
  synth.cancel();
  var u = new SpeechSynthesisUtterance(text), v = S.voice(code);
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = (TAGS[code] || [code])[0];
  u.rate = slow ? 0.6 : 0.95;
  if (playing) playing.classList.remove('talking');
  playing = btn || null;
  if (btn) btn.classList.add('talking');
  u.onend = u.onerror = function () { lastEnd = Date.now(); if (btn) btn.classList.remove('talking'); if (playing === btn) playing = null; };
  lastText = text;
  // Chrome sometimes leaves the queue paused after a cancel
  setTimeout(function () { synth.speak(u); if (synth.paused) synth.resume(); }, 30);
};

// the text of a form cell, without its romanization line or the other alphabet, first alternative only
function cellText(td) {
  var c = td.cloneNode(true);
  c.querySelectorAll('div, .sec, small, .sr-l').forEach(function (x) { x.remove(); });
  return (c.textContent || '').split(' / ')[0].replace(/[—–]/g, '').trim();
}

var BTN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
function button(kind, title) { return '<button class="say say-' + kind + '" data-say="' + kind + '" title="' + title + '" aria-label="' + title + '">' + BTN + '</button>'; }

// called by app.js after the panel is drawn: n the open word, Lg its language file
S.decorate = function (panel, n, code, Lg) {
  if (!S.voicesFor(code).length && voices.length) {
    var none = document.createElement('p');
    none.className = 'note sayless';
    none.textContent = 'No ' + (Lg.en || code) + ' voice in this browser, so words cannot be heard here.';
    panel.appendChild(none);
    return;
  }
  var h2 = panel.querySelector('h2');
  if (h2) h2.insertAdjacentHTML('beforeend', ' ' + button('word', 'Hear the word (press again to hear it slowly)'));
  var ex = panel.querySelector('.ex .t');
  if (ex && n.ex && n.ex.t) ex.insertAdjacentHTML('afterbegin', button('ex', 'Hear the sentence (press again to hear it slowly)'));
  panel.querySelectorAll('.tense td.f:not(.none)').forEach(function (td) { td.classList.add('sayable'); td.title = 'Click to hear it'; });
  // the voice picker, at the bottom
  var list = S.voicesFor(code), cur = S.voice(code);
  if (list.length > 1) {
    var opts = list.map(function (v) {
      return '<option value="' + P.esc(v.name) + '"' + (cur && v.name === cur.name ? ' selected' : '') + '>' + P.esc(v.name.replace(/\s*\(.*\)$/, '')) + ' (' + P.esc(v.lang) + (v.localService === false ? ', online' : '') + ')</option>';
    }).join('');
    panel.insertAdjacentHTML('beforeend', '<div class="voicepick"><label>Voice <select data-voice="' + code + '">' + opts + '</select></label></div>');
  }
};

// the word as it is said: the language file may give a spoken form (French adds its article), else what is displayed
function wordText(n, Lg) {
  if (Lg.sayWord) return Lg.sayWord(n);
  return Lg.display ? Lg.display(n) : n.w;
}

// app.js passes panel clicks here first; true means it was a speech click
S.handle = function (ev, n, code, Lg) {
  var b = ev.target.closest('[data-say]');
  if (b && n) {
    ev.stopPropagation();
    S.say(code, b.getAttribute('data-say') === 'ex' ? n.ex.t : wordText(n, Lg), b);
    return true;
  }
  var td = ev.target.closest('td.sayable');
  if (td) { S.say(code, cellText(td), null); td.classList.add('talking'); setTimeout(function () { td.classList.remove('talking'); }, 700); return true; }
  return false;
};

document.addEventListener('change', function (ev) {
  var s = ev.target.closest && ev.target.closest('select[data-voice]');
  if (!s) return;
  var code = s.getAttribute('data-voice');
  S.setVoice(code, s.value);
  S.say(code, P.langs[code] && P.langs[code].sayHello || '', null);
});
// the sample each language says when its voice is changed
var HELLO = { fr: 'Bonjour', es: 'Hola', ko: '안녕하세요', zh: '你好', ja: 'こんにちは', sr: 'Здраво', el: 'Γεια σας' };
Object.keys(HELLO).forEach(function (c) { if (P.langs[c]) P.langs[c].sayHello = HELLO[c]; });
// speaking is stopped when the page is left
window.addEventListener('pagehide', function () { synth.cancel(); });
})();
