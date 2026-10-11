/* SlopFaces cache: the face results of each picture, in IndexedDB 'slop-faces' (store 'results'). A row is keyed by
 * scope + ':' + id (scope 'drive' for Slop Drive files, 'gallery' for Gallery photos) and holds the stamp it was
 * detected for: a Drive file's modified time, or a photo's SHA-256. A row whose stamp or model differs from the
 * picture's is treated as missing, so an edited picture is detected again. It is derived data: it can be deleted at any
 * time. Every access is in try/catch; when storage is blocked the rows live in memory for this page only.
 * Classic script; adds to window.SlopFaces.cache. */
(function (g) {
  'use strict';
  const F = (g.SlopFaces = g.SlopFaces || {});
  const NAME = g.SLOP_FACES_DB || 'slop-faces', STORE = 'results';
  const mem = new Map();
  let dbp = null;

  const keyOf = (scope, id) => scope + ':' + id;
  function open() {
    if (!dbp) dbp = new Promise((res, rej) => {
      if (!g.indexedDB) { rej(new Error('IndexedDB is not available')); return; }
      const r = g.indexedDB.open(NAME, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'key' }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }).catch((e) => { dbp = null; throw e; });
    return dbp;
  }
  /** Runs one request on the store; resolves with its result, or rejects. */
  async function req(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
      t.onerror = t.onabort = () => rej(t.error);
    });
  }

  /** The stored row for a picture, when it was detected for this stamp and this model; otherwise null. */
  async function get(scope, id, stamp) {
    const key = keyOf(scope, id);
    let row = null;
    try { row = (await req('readonly', (s) => s.get(key))) || null; } catch (e) { row = mem.get(key) || null; }
    return row && row.stamp === String(stamp) && row.model === F.MODEL_ID ? row : null;
  }
  /** Stores the result for a picture: faces in source pixels, and the picture's size. */
  async function put(scope, id, stamp, { w, h, faces }) {
    const row = { key: keyOf(scope, id), scope, id: String(id), stamp: String(stamp), model: F.MODEL_ID, w, h, faces, time: Date.now() };
    mem.set(row.key, row);
    try { await req('readwrite', (s) => s.put(row)); } catch (e) { /* kept in memory for this page */ }
    return row;
  }
  /** Every stored row of one scope, as a Map from the picture id to its row (any stamp). */
  async function all(scope) {
    const out = new Map();
    const range = { lower: scope + ':', upper: scope + ';' };
    let rows = [];
    try {
      const db = await open();
      rows = await new Promise((res, rej) => {
        const t = db.transaction(STORE, 'readonly');
        const list = [];
        const c = t.objectStore(STORE).openCursor(g.IDBKeyRange ? g.IDBKeyRange.bound(range.lower, range.upper, false, true) : null);
        c.onsuccess = () => { const cur = c.result; if (cur) { list.push(cur.value); cur.continue(); } else res(list); };
        t.onerror = t.onabort = () => rej(t.error);
      });
    } catch (e) { rows = [...mem.values()].filter((r) => r.scope === scope); }
    for (const r of rows) if (r && r.scope === scope) out.set(r.id, r);
    return out;
  }
  /** Removes the result of one picture. */
  async function remove(scope, id) {
    const key = keyOf(scope, id);
    mem.delete(key);
    try { await req('readwrite', (s) => s.delete(key)); } catch (e) { /* nothing stored */ }
  }
  /** Removes every result (all scopes). */
  async function clear() {
    mem.clear();
    try { await req('readwrite', (s) => s.clear()); } catch (e) { /* nothing stored */ }
  }

  F.cache = { get, put, all, remove, clear, keyOf };
})(typeof window !== 'undefined' ? window : globalThis);
