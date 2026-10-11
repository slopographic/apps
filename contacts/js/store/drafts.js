/* Slop Contacts: autosave draft in this browser's IndexedDB. A per-viewer convenience only; the real copy is the
 * .scontacts file in Slop Drive. Written about 0.6 s after the last change; read back on a plain start.
 * Every access is wrapped: a blocked or missing IndexedDB just means no draft. Adds SlopContacts.drafts. */
(function () {
  'use strict';
  const SC = (window.SlopContacts = window.SlopContacts || {});
  const DB = 'slop-contacts-drafts', STORE = 'drafts', KEY = 'current';
  let timer = null;

  function open() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) { rej(new Error('no IndexedDB')); return; }
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('blocked'));
    });
  }
  async function run(mode, fn) {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, mode), req = fn(t.objectStore(STORE));
      t.oncomplete = () => { d.close(); res(req && req.result); };
      t.onerror = () => { d.close(); rej(t.error); };
      t.onabort = () => { d.close(); rej(t.error || new Error('aborted')); };
    });
  }

  /** The stored draft, or null. Never throws. */
  const read = () => run('readonly', (s) => s.get(KEY)).catch(() => null);
  const clear = () => run('readwrite', (s) => s.delete(KEY)).catch(() => null);
  /** Save the current state now. Resolves true when it was kept. */
  function writeNow(state) {
    if (!state) return Promise.resolve(false);
    const rec = { json: SC.format.toScontacts(state.list), name: state.name, driveId: state.driveId || null, folderId: state.folderId ?? null, cc: state.cc || '', time: Date.now() };
    return run('readwrite', (s) => s.put(rec, KEY)).then(() => true).catch(() => false);
  }
  /** Debounced: call on every change with a function that returns the current state. */
  function schedule(getState) {
    clearTimeout(timer);
    timer = setTimeout(() => writeNow(getState()), 600);
  }

  SC.drafts = { read, clear, writeNow, schedule };
})();
