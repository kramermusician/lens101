// Jam Box sync: one shared room in Keystroke Derby's Realtime Database.
// Rooms live at /lens101/JAM-{CODE} (the lens101 rules block already allows any signed-in user),
// so no rules deploy is needed. Firebase web config is public by design; the rules do the guarding.
// Solo mode skips Firebase entirely and every write stays on this device.

const CFG = {
  apiKey: 'AIzaSyAcTaW7DMuHKVpEJ0KD11OmFphKH2-gYdg',
  authDomain: 'keystroke-derby.firebaseapp.com',
  databaseURL: 'https://keystroke-derby-default-rtdb.firebaseio.com',
  projectId: 'keystroke-derby',
  storageBucket: 'keystroke-derby.firebasestorage.app',
  messagingSenderId: '723609300799',
  appId: '1:723609300799:web:1e5916b1a34d584b6eed8a',
};
const SDK = 'https://www.gstatic.com/firebasejs/10.12.0/';
const ROOT = 'lens101';
export const MAX_PLAYERS = 4;

let F = null, db = null, uid = null, offset = 0, code = null, solo = false, presence = null, noteK = Date.now();

export const now = () => Date.now() + offset;   // the room's shared clock (server time)
export const me = () => uid;
export const roomCode = () => code;
export const isSolo = () => solo;

export function startSolo() { solo = true; uid = 'me'; code = 'SOLO'; }

export async function connect() {
  if (F) return;
  const [a, d, au] = await Promise.all(['app', 'database', 'auth'].map(m => import(`${SDK}firebase-${m}.js`)));
  const app = a.initializeApp(CFG, 'jambox');
  db = d.getDatabase(app);
  const auth = au.getAuth(app);
  uid = await new Promise((res, rej) => {
    const off = au.onAuthStateChanged(auth, u => { if (u) { off(); res(u.uid); } });
    au.signInAnonymously(auth).catch(rej);
  });
  F = d;
  F.onValue(F.ref(db, '.info/serverTimeOffset'), s => { offset = s.val() || 0; });
}

const roomPath = c => `${ROOT}/JAM-${c}`;
const ref = p => F.ref(db, roomPath(code) + (p ? '/' + p : ''));
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const makeCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');

export async function create(init) {
  for (let i = 0; i < 10; i++) {
    const c = makeCode();
    const snap = await F.get(F.ref(db, roomPath(c) + '/s'));
    if (!snap.exists()) {
      code = c;
      await F.set(ref(''), { ...init, s: { ...init.s, created: F.serverTimestamp() } });
      return c;
    }
  }
  throw new Error('Could not find a free code');
}

// -> { ok, col } or { ok: false, reason: 'missing' | 'full' }
export async function join(c, info) {
  const snap = await F.get(F.ref(db, roomPath(c)));
  if (!snap.exists() || !snap.child('s').exists()) return { ok: false, reason: 'missing' };
  const p = snap.child('p').val() || {};
  const others = Object.entries(p).filter(([u]) => u !== uid);
  if (others.length >= MAX_PLAYERS) return { ok: false, reason: 'full' };
  const used = new Set(others.map(([, v]) => v.col));
  const col = p[uid] && !used.has(p[uid].col) ? p[uid].col : [0, 1, 2, 3].find(x => !used.has(x));
  code = c;
  presence = { ...info, col };
  // re-announce after every reconnect, since the server drops us when the line goes quiet
  F.onValue(F.ref(db, '.info/connected'), s => {
    if (s.val() !== true || !presence) return;
    const pr = ref('p/' + uid);
    F.onDisconnect(pr).remove().then(() => F.set(pr, presence));
  });
  return { ok: true, col };
}

export function setPresence(patch) {
  if (solo || !presence) return;
  Object.assign(presence, patch);
  F.update(ref('p/' + uid), patch).catch(() => {});
}

export function listen(key, cb) {
  if (solo) return;
  F.onValue(ref(key), s => cb(s.val()));
}

// obj: { 'd/3_5': 2, 'mute/d': null, ... }  null deletes
export function put(obj) {
  if (solo) return Promise.resolve();
  return F.update(ref(''), obj);
}

// a live note (pad or key press) so everyone hears it right away
export function note(tr, i) {
  if (solo) return;
  F.set(ref('n/' + uid), { k: ++noteK, tr, i }).catch(() => {});
}

export function leave() {
  if (solo || !F || !code) return;
  presence = null;
  F.remove(ref('p/' + uid)).catch(() => {});
}
