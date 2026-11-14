/* LIFT storage. Every read and write in the app goes through this module.
   Today: localStorage, one key per collection (prefix lift2_), cached in memory.
   Later: the same calls, plus a sync loop that sends the outbox to Cloudflare D1 (last save wins).
   Records carry {id, updatedAt}; deletes leave a tombstone {id, deleted:true, updatedAt} so a sync can pass them on. */
(function (root) {
'use strict';
const P = 'lift2_';
const COLLECTIONS = ['workouts', 'exercises', 'exprefs', 'templates', 'weighins'];
const SINGLES = ['settings', 'session', 'meta'];
const mem = {};
const subs = new Set();
let ls = null;
try { ls = root.localStorage; ls.setItem(P + 'probe', '1'); ls.removeItem(P + 'probe'); } catch (e) { ls = null; }

function emit(what) { subs.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } }); }
function read(k, def) {
  if (k in mem) return mem[k];
  let v = def;
  if (ls) { try { const raw = ls.getItem(P + k); if (raw != null) v = JSON.parse(raw); } catch (e) { console.warn('LIFT: could not read', k, e); } }
  mem[k] = v; return v;
}
function write(k) {
  if (!ls) return false;
  try { ls.setItem(P + k, JSON.stringify(mem[k])); return true; }
  catch (e) { console.error('LIFT: could not save', k, e); emit({error: 'save', key: k, e}); return false; }
}
const now = () => Date.now();
let seq = 0;
const uid = (p = 'id') => p + '_' + now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
function outbox(col, id) {
  const m = read('meta', {});
  const ob = m.outbox || (m.outbox = {});
  ob[col + ':' + id] = now();
  mem.meta = m; write('meta');
}

const Store = {
  uid,
  available: !!ls,
  /* collections */
  all(col) { return read(col, []).filter(r => r && !r.deleted); },
  get(col, id) { return read(col, []).find(r => r && r.id === id && !r.deleted) || null; },
  put(col, rec) {
    if (!COLLECTIONS.includes(col)) throw new Error('unknown collection ' + col);
    const arr = read(col, []);
    rec = Object.assign({}, rec, {id: rec.id || uid(col.slice(0, 2)), updatedAt: now()});
    const i = arr.findIndex(r => r && r.id === rec.id);
    if (i < 0) arr.push(rec); else arr[i] = rec;
    write(col); outbox(col, rec.id); emit(col);
    return rec;
  },
  remove(col, id) {
    const arr = read(col, []);
    const i = arr.findIndex(r => r && r.id === id);
    if (i < 0) return null;
    const old = arr[i];
    arr[i] = {id, deleted: true, updatedAt: now()};
    write(col); outbox(col, id); emit(col);
    return old;
  },
  /* bring records in from a backup or (later) the server: newer updatedAt wins, existing ids are kept otherwise */
  /* revive: a record in a backup file brings back one deleted on this phone (otherwise the newer copy wins) */
  merge(col, recs, {overwrite = false, revive = false} = {}) {
    const arr = read(col, []);
    let added = 0, skipped = 0;
    for (const r of recs) {
      if (!r || typeof r.id !== 'string') continue;
      const i = arr.findIndex(x => x && x.id === r.id);
      if (i < 0) { arr.push(Object.assign({updatedAt: now()}, r)); added++; }
      else if (overwrite || (revive && arr[i].deleted && !r.deleted) || (r.updatedAt || 0) > (arr[i].updatedAt || 0)) { arr[i] = Object.assign({updatedAt: now()}, r); added++; }
      else skipped++;
    }
    write(col); emit(col);
    return {added, skipped};
  },
  /* single records */
  one(k, def = null) { return read(k, def); },
  setOne(k, v) {
    if (!SINGLES.includes(k)) throw new Error('unknown record ' + k);
    mem[k] = v; write(k);
    if (k === 'settings') outbox('settings', 'settings');
    emit(k); return v;
  },
  /* everything, for the backup file */
  exportAll() {
    const data = {};
    for (const c of COLLECTIONS) data[c] = Store.all(c);
    data.settings = read('settings', null);
    data.session = read('session', null);
    const meta = Object.assign({}, read('meta', {})); delete meta.outbox;
    data.meta = meta;
    return {app: 'LIFT', schema: 2, exported: new Date().toISOString(), data};
  },
  /* wipe LIFT 2 data only; the old app's lift5_ keys are left alone */
  clearAll() {
    if (ls) { const keys = []; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(P)) keys.push(k); } keys.forEach(k => ls.removeItem(k)); }
    Object.keys(mem).forEach(k => delete mem[k]);
    emit('all');
  },
  /* the old app (LIFT 5) on this same address, if it ever ran here */
  readOld() {
    if (!ls) return null;
    const g = k => { try { return JSON.parse(ls.getItem('lift5_' + k)); } catch (e) { return null; } };
    const workouts = g('workouts');
    if (!Array.isArray(workouts) || !workouts.length) return null;
    return {workouts, exercises: g('exercises') || [], templates: g('utpls') || [], settings: g('settings') || {}, version: 5};
  },
  onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  async persist() { try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) {} return false; },
  async usage() { try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) {} return null; },
  /* sync status for the dot on the gear: 'off' until Cloudflare sync is set up */
  syncState() { return 'off'; },
};
/* another tab changed data: drop the cache so the next read is fresh */
if (root.addEventListener) root.addEventListener('storage', e => { if (e.key && e.key.startsWith(P)) { delete mem[e.key.slice(P.length)]; emit('external'); } });
root.Store = Store;
if (typeof module !== 'undefined') module.exports = Store;
})(typeof window !== 'undefined' ? window : globalThis);
