/* Slop Gallery: the Drive source. Every file in Slop Drive (SlopHub.list, Trash excluded) as light items, read only.
 *  - load()        → [{ id, name, type, size, time, stamp, kind }], newest first. kind comes from shared/kinds/kinds.js.
 *  - thumb(item)   → an object URL for the Drive's own thumbnail, or null when there is none. It reads Slop Drive's
 *                    thumbnail cache (IndexedDB 'slop-drive-thumbs') and never writes to it: a missing database is not
 *                    created here (the upgrade is aborted). A record is used only while its modified time and version match.
 * Exposes window.SlopGallery.driveSource. */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const THUMB_VER = 3; // must match VER in drive/js/core/thumbs.js
  const dbName = () => window.SLOP_THUMB_DB || 'slop-drive-thumbs';
  const stampOf = (r) => r.modified || r.time || 0;
  let thumbDb = null;

  /** The Drive's thumbnail database, opened read only; null when it is unavailable or does not exist yet. */
  function openThumbs() {
    if (thumbDb) return Promise.resolve(thumbDb);
    return new Promise((res) => {
      if (!window.indexedDB) { res(null); return; }
      let r;
      try { r = indexedDB.open(dbName(), 1); } catch (e) { res(null); return; }
      r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) { /* already gone */ } };
      r.onsuccess = () => {
        thumbDb = r.result;
        thumbDb.onversionchange = () => { thumbDb.close(); thumbDb = null; };
        res(thumbDb);
      };
      r.onerror = () => res(null);
    });
  }
  const readRecord = (db, id) => new Promise((res) => {
    try {
      const q = db.transaction('thumbs', 'readonly').objectStore('thumbs').get(id);
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => res(null);
    } catch (e) { res(null); }
  });

  async function load() {
    const rows = (await window.SlopHub.list()) || [];
    return rows.map((r) => ({
      id: r.id, name: r.name || 'Untitled', type: r.type || '', size: r.size || 0, time: r.time || 0,
      stamp: stampOf(r), kind: window.SlopKinds.kindOf(r.name, r.type),
    }));
  }
  /** The Drive's cached thumbnail for an item, as an object URL, or null. Never rejects. */
  async function thumb(item) {
    try {
      const db = await openThumbs();
      if (!db) return null;
      const rec = await readRecord(db, item.id);
      if (!rec || rec.ver !== THUMB_VER || rec.modified !== item.stamp || !rec.blob) return null;
      return URL.createObjectURL(rec.blob);
    } catch (e) { return null; }
  }

  G.driveSource = { load, thumb, THUMB_VER };
})();
