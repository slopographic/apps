/* SlopStorage: how full this site's browser storage is, what is using it, and whether the browser keeps it.
 * Classic script; extends window.SlopStorage (classify.js runs first). Every call resolves and never throws.
 *   SlopStorage.estimate()        { supported, usage, quota, percent, parts: [{ id, label, bytes, count, detail }] }
 *                                 parts: IndexedDB (per database and store, record counts), Cache Storage (per cache),
 *                                 localStorage (measured in characters), and Other (the rest, from the browser's total).
 *                                 Bytes are null where the browser does not say.
 *   SlopStorage.persisted()       true | false | null (unknown)
 *   SlopStorage.requestPersist()  asks the person first (one line of explanation), then asks the browser.
 *                                 Resolves 'granted' | 'denied' | 'declined' | 'unsupported'. Never asks silently.
 *   SlopStorage.classify(err)     see classify.js.
 * The IndexedDB and Cache parts are listed only for databases and caches this site already has; nothing is created. */
(function (g) {
  'use strict';
  const SS = (g.SlopStorage = g.SlopStorage || {});
  const nav = g.navigator || {};
  const MAX_DBS = 12;
  const LABELS = { indexedDB: 'IndexedDB (saved records)', caches: 'Cache Storage (downloads and offline files)', localStorage: 'localStorage (settings and small saves)' };
  const CACHE_LABELS = [[/^webllm\//, 'Downloaded AI models'], [/^slop-cutout/, 'Cut-out model'], [/^slopographic-/, 'Offline cache of the site']];

  const quiet = (p, fallback = null) => Promise.resolve().then(() => p).catch(() => fallback);

  /** IndexedDB: the databases this site already has, with the record count of each store. Opens without a version,
   * so nothing is created or upgraded. Firefox without indexedDB.databases() gets an empty list. */
  async function indexedDbParts() {
    if (!g.indexedDB || !g.indexedDB.databases) return [];
    const list = (await quiet(g.indexedDB.databases(), [])).filter((d) => d && d.name).slice(0, MAX_DBS);
    const out = [];
    for (const d of list) {
      const stores = await quiet(countStores(d.name), null);
      if (!stores) { out.push({ id: 'idb:' + d.name, label: d.name, bytes: null, count: null, detail: 'could not be read' }); continue; }
      const records = stores.reduce((n, s) => n + s.count, 0);
      out.push({ id: 'idb:' + d.name, label: d.name, bytes: null, count: records, detail: stores.map((s) => `${s.name}: ${s.count}`).join(', ') || 'no stores' });
    }
    return out;
  }
  function countStores(name) {
    return new Promise((res, rej) => {
      const r = g.indexedDB.open(name);
      r.onupgradeneeded = () => { r.transaction.abort(); }; // a database that is not at a version yet: nothing to count
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        const db = r.result, names = [...db.objectStoreNames];
        if (!names.length) { db.close(); res([]); return; }
        const t = db.transaction(names, 'readonly');
        const counts = names.map((n) => { const q = t.objectStore(n).count(); return { name: n, req: q }; });
        t.oncomplete = () => { db.close(); res(counts.map((c) => ({ name: c.name, count: c.req.result || 0 }))); };
        t.onerror = t.onabort = () => { db.close(); rej(t.error || new Error('aborted')); };
      };
    });
  }

  /** Cache Storage: one part per cache, with its entry count. Bytes come from the browser total, not per cache. */
  async function cacheParts() {
    if (!g.caches) return [];
    const names = await quiet(caches.keys(), []);
    const out = [];
    for (const n of names) {
      const c = await quiet(caches.open(n), null);
      const count = c ? (await quiet(c.keys(), [])).length : null;
      const hit = CACHE_LABELS.find(([re]) => re.test(n));
      out.push({ id: 'cache:' + n, label: hit ? hit[1] : n, bytes: null, count, detail: n });
    }
    return out;
  }

  /** localStorage: characters times two (UTF-16), for this site's keys. */
  function localParts() {
    try {
      const ls = g.localStorage, n = ls.length;
      let bytes = 0;
      for (let i = 0; i < n; i++) { const k = ls.key(i) || ''; bytes += (k.length + (ls.getItem(k) || '').length) * 2; }
      return [{ id: 'localstorage', label: LABELS.localStorage, bytes, count: n, detail: n + ' keys' }];
    } catch (e) { return []; }
  }

  /** The browser's own split (Chrome): usageDetails has the bytes of IndexedDB and Cache Storage. */
  function sizeOf(details, key) { return details && typeof details[key] === 'number' ? details[key] : null; }

  SS.estimate = async function () {
    const out = { supported: !!(nav.storage && nav.storage.estimate), usage: null, quota: null, percent: 0, parts: [] };
    let details = {};
    if (out.supported) {
      const e = await quiet(nav.storage.estimate(), null);
      if (e) { out.usage = typeof e.usage === 'number' ? e.usage : null; out.quota = typeof e.quota === 'number' ? e.quota : null; details = e.usageDetails || {}; }
    }
    out.percent = out.usage != null && out.quota ? Math.min(100, (out.usage / out.quota) * 100) : 0;
    const idb = await indexedDbParts(), cache = await cacheParts();
    const ls = localParts();
    const idbBytes = sizeOf(details, 'indexedDB'), cacheBytes = sizeOf(details, 'caches');
    const parts = [
      { id: 'indexedDB', label: LABELS.indexedDB, bytes: idbBytes, count: idb.reduce((n, p) => n + (p.count || 0), 0), detail: idb.length + ' databases' },
      ...idb,
      { id: 'caches', label: LABELS.caches, bytes: cacheBytes, count: cache.reduce((n, p) => n + (p.count || 0), 0), detail: cache.length + ' caches' },
      ...cache,
      ...ls,
    ];
    const known = [idbBytes, cacheBytes].filter((b) => typeof b === 'number'); // localStorage is measured, not in the browser total
    if (out.usage != null && known.length) {
      const other = Math.max(0, out.usage - known.reduce((a, b) => a + b, 0));
      parts.push({ id: 'other', label: 'Other site data (service worker, files the browser counts)', bytes: other, count: null, detail: '' });
    }
    out.parts = parts;
    return out;
  };

  SS.persisted = async function () {
    if (!nav.storage || !nav.storage.persisted) return null;
    return quiet(nav.storage.persisted(), null);
  };

  /** Asks the person first. Uses SlopUI when the page has it, else window.confirm. */
  function askFirst() {
    const text = 'Ask the browser to keep this site’s data? The browser decides from how often you use the site, and may still say no. Clearing the site’s data still deletes everything, so keep a backup.';
    if (g.SlopUI && g.SlopUI.confirm) return g.SlopUI.confirm('Keep this site’s data?', text, 'Ask the browser', { cancel: 'Not now' });
    return Promise.resolve(!!(g.confirm && g.confirm('Keep this site’s data? ' + text)));
  }
  SS.requestPersist = async function () {
    if (!nav.storage || !nav.storage.persist) return 'unsupported';
    if ((await SS.persisted()) === true) return 'granted';
    if (!(await askFirst())) return 'declined';
    if (g.SlopPWA && g.SlopPWA.requestPersist) return quiet(g.SlopPWA.requestPersist(), 'denied');
    return quiet(nav.storage.persist().then((ok) => (ok ? 'granted' : 'denied')), 'denied');
  };

  SS.bytes = function (n) {
    if (n == null || !isFinite(n)) return 'unknown';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0, v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (i === 0 ? String(Math.round(v)) : v.toFixed(v < 10 ? 1 : 0)) + ' ' + u[i];
  };
})(window);
