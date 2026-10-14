/* Slop PDF — documents in Slop Drive. Opening a PDF stores its untouched bytes as a Drive file at once (the original),
   unless the same bytes are in Drive already: they are found by SHA-256 (sizes first; each PDF's hash is kept in its
   record as meta.sha256), and the copy there is linked, not copied. Save writes the edited copy and its change list
   (io/doc-changes.js) as two more Drive files beside the original, and never overwrites the original. A record's
   meta.pdf says what it is: { role: 'edited' | 'changes', original: id } or, for the original, { edited, changes } ids.
   Without Slop Drive (or with autosave off) nothing is written here. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util;
  var D = SP.driveDocs = {};
  function hub() { return window.SlopHub || null; }
  /** Autosave is on unless the person turned it off (File menu), and needs Slop Drive, which is not in the offline file. */
  D.enabled = function () { return !!hub() && !SP.offline && !!U.store.get('driveAutosave', true); };
  D.linked = function () { return !!hub() && !SP.offline; };
  function roleOf(rec) { return rec && rec.meta && rec.meta.pdf ? rec.meta.pdf.role : null; }
  function bytesOf(blob) { return blob.arrayBuffer().then(function (b) { return new Uint8Array(b); }); }

  /** The SHA-256 of a Drive file's bytes, cached in its record. */
  async function hashOf(rec) {
    if (rec.meta && rec.meta.sha256) return rec.meta.sha256;
    var h = await SP.editLog.fingerprint(await bytesOf(rec.blob));
    if (h) await hub().update(rec.id, { meta: Object.assign({}, rec.meta, { sha256: h }) }, { touch: false });
    return h;
  }
  /** The Drive PDF whose bytes equal these (same size, then the same SHA-256), or null. Trashed files do not count. */
  D.findSame = async function (bytes, hash) {
    var list = await hub().list({ accept: 'application/pdf' });
    for (var i = 0; i < list.length; i++) {
      if (list[i].size === bytes.length && (await hashOf(list[i])) === hash) return list[i];
    }
    return null;
  };
  /** The original record of the document a Drive file belongs to: itself for an original or a plain PDF. */
  D.docOf = async function (id) {
    if (!id || !hub()) return null;
    var rec = await hub().get(id);
    if (!rec) return null;
    if (roleOf(rec) === 'edited' || roleOf(rec) === 'changes') return (await hub().get(rec.meta.pdf.original)) || null;
    return rec;
  };
  /** The original, the edited copy and the change list of the document a Drive file belongs to. Null when none. */
  D.versions = async function (id) {
    var orig = await D.docOf(id);
    if (!orig) return null;
    var p = orig.meta.pdf || {};
    return { original: orig, edited: (p.edited && (await hub().get(p.edited))) || null, changes: (p.changes && (await hub().get(p.changes))) || null };
  };

  /** Stores an opened PDF's original bytes in Drive, or links the same bytes already there. Resolves { id, name, reused }. */
  D.keepOriginal = async function (bytes, name) {
    var hash = await SP.editLog.fingerprint(bytes);
    var same = hash ? await D.findSame(bytes, hash) : null;
    if (same) {
      var orig = await D.docOf(same.id);
      return { id: orig.id, name: orig.name, reused: true };
    }
    var id = await hub().put(new Blob([bytes], { type: 'application/pdf' }), { name: name, from: 'pdf', meta: { sha256: hash, pdf: { role: 'original' } } });
    return { id: id, name: name, reused: false };
  };

  /** Writes or updates one Drive file that belongs to a document; prev is its record or null. */
  async function store(prev, blob, name, meta, folderId) {
    if (prev) return hub().update(prev.id, { blob: blob, type: blob.type, name: name, meta: meta }).then(function (rec) { return rec ? rec.id : prev.id; });
    return hub().put(blob, { name: name, from: 'pdf', folderId: folderId, meta: meta });
  }
  /** Versions kept per document. Older ones are removed from Slop Drive when a newer one is saved. */
  var MAX_VERSIONS = 20;
  /** The saved versions of an original, oldest first. A document saved before versions existed has its one edited copy as version 1. */
  function versionsOf(orig) {
    var p = orig.meta && orig.meta.pdf || {};
    if (p.versions && p.versions.length) return p.versions.slice();
    return p.edited ? [{ edited: p.edited, changes: p.changes || null }] : [];
  }
  /** The versions of the document a Drive file belongs to, newest first: { n, at, edited, changes } (records, or null). */
  D.versionList = async function (id) {
    var orig = await D.docOf(id);
    if (!orig) return null;
    var out = [];
    var list = versionsOf(orig);
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      out.push({ n: v.n || i + 1, at: v.at || 0, edited: v.edited ? await hub().get(v.edited) : null, changes: v.changes ? await hub().get(v.changes) : null });
    }
    return out.reverse();
  };
  /** Saves the edited bytes of the document a Drive file belongs to as a new version (the edited copy and its change list,
   * beside the original). Earlier versions are kept, up to MAX_VERSIONS. Resolves { id, editedId, changesId, version } or null. */
  D.save = async function (linkId, blob, name) {
    var orig = await D.docOf(linkId);
    if (!orig) return null;
    var bytes = await bytesOf(blob), hash = await SP.editLog.fingerprint(bytes), origHash = await hashOf(orig);
    var p = orig.meta.pdf || {};
    var versions = versionsOf(orig);
    var n = versions.reduce(function (m, v) { return Math.max(m, v.n || 0); }, 0) + 1;
    var at = Date.now();
    var stem = U.baseName(name || orig.name) || 'document';
    var changes = SP.docChanges.build(
      { name: orig.name, sha256: origHash, size: orig.size },
      { name: name, sha256: hash, size: bytes.length });
    var edited = await hub().put(blob, { name: name, from: 'pdf', folderId: orig.folderId, meta: { sha256: hash, pdf: { role: 'edited', original: orig.id, n: n, at: at } } });
    var chgBlob = new Blob([JSON.stringify(changes)], { type: 'application/json' });
    var chg = await hub().put(chgBlob, { name: stem + '.changes.json', from: 'pdf', folderId: orig.folderId, meta: { sha256: null, pdf: { role: 'changes', original: orig.id, n: n, at: at } } });
    versions.push({ n: n, at: at, edited: edited, changes: chg });
    var dropped = versions.length > MAX_VERSIONS ? versions.splice(0, versions.length - MAX_VERSIONS) : [];
    for (var i = 0; i < dropped.length; i++) {
      if (dropped[i].edited) await hub().remove(dropped[i].edited).catch(function () {});
      if (dropped[i].changes) await hub().remove(dropped[i].changes).catch(function () {});
    }
    var latest = versions[versions.length - 1];
    await hub().update(orig.id, { meta: Object.assign({}, orig.meta, { sha256: origHash, pdf: Object.assign({}, p, { role: p.role || 'original', edited: latest.edited, changes: latest.changes, versions: versions }) }) }, { touch: false });
    return { id: orig.id, editedId: edited, changesId: chg, version: n };
  };
})();
