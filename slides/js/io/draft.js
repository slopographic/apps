/* Slop Slides: the autosave draft. The current deck and which Drive file it belongs to are kept in IndexedDB
   ('slop-slides', store 'drafts', key 'last'), so an unsaved edit survives a reload on this device. Every call
   resolves (null on failure): storage can be blocked, and the editor must work without it. Exposes SS.draft. */
(function () {
  'use strict';
  var SS = window.SS;
  var DR = SS.draft = {};
  var DB = 'slop-slides', STORE = 'drafts', KEY = 'last', dbp = null;

  function db() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('IndexedDB is unavailable')); return; }
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { dbp = null; rej(r.error); };
      r.onblocked = function () { dbp = null; rej(new Error('blocked')); };
    });
    return dbp;
  }
  function run(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(STORE, mode), q = fn(t.objectStore(STORE));
        t.oncomplete = function () { res(q ? q.result : undefined); };
        t.onerror = t.onabort = function () { rej(t.error || new Error('aborted')); };
      });
    });
  }
  /** rec = { deck, driveId, name }. Stored as JSON text so large decks cost one clone. */
  DR.save = function (rec) {
    var entry = { json: JSON.stringify(rec.deck), driveId: rec.driveId || null, name: rec.name || '', savedAt: Date.now() };
    return run('readwrite', function (s) { return s.put(entry, KEY); }).then(function () { return entry; }, function () { return null; });
  };
  DR.load = function () {
    return run('readonly', function (s) { return s.get(KEY); }).then(function (e) {
      if (!e || !e.json) return null;
      try { return { deck: JSON.parse(e.json), driveId: e.driveId, name: e.name, savedAt: e.savedAt }; } catch (err) { return null; }
    }, function () { return null; });
  };
  DR.clear = function () { return run('readwrite', function (s) { return s.delete(KEY); }).then(function () { return true; }, function () { return false; }); };
})();
