/* Key Party: persistent leaderboard in localStorage plus JSON export. */
const Leaderboard = (() => {
  'use strict';
  const KEY = 'keyparty.leaderboard.v1';
  const SETTINGS = 'keyparty.settings.v1';
  const MAX = 10;

  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
  }
  function add(entry) {
    const list = load();
    list.push({ initials: entry.initials, score: entry.score, level: entry.level, date: entry.date || new Date().toISOString().slice(0, 10), players: entry.players || 0 });
    list.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
    save(list);
    return list.slice(0, MAX);
  }
  function top() { return load().slice(0, MAX); }
  function exportJSON() {
    const data = { exported: new Date().toISOString(), game: 'Key Party', entries: load() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'key-party-leaderboard-' + data.exported.slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function loadSettings(defaults) {
    try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(SETTINGS) || '{}')); } catch (e) { return Object.assign({}, defaults); }
  }
  function saveSettings(s) { try { localStorage.setItem(SETTINGS, JSON.stringify(s)); } catch (e) { /* ignore */ } }

  return { add, top, exportJSON, loadSettings, saveSettings, load };
})();
