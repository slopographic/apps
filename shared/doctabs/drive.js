/* SlopDocTabs.drive: Save to Slop Drive for one tab, through window.SlopHub (shared/hub.js).
 * Classic script, no network of its own. The app supplies the file format in adapter.drive = { ext, mime, toBlob?, fromBlob? }.
 * Without toBlob the file holds JSON of adapter.serialize(doc); without fromBlob it is read back with adapter.restore. */
(function () {
  'use strict';
  const NS = window.SlopDocTabs || (window.SlopDocTabs = {});
  if (NS.drive) return;

  const hub = () => window.SlopHub || null;
  const toast = (api, msg) => api.toast(msg);

  /** The file's bytes for doc: the app's own format if it has toBlob, else the JSON of serialize(doc). */
  async function blobOf(api, doc) {
    const dr = api.adapter.drive || {};
    if (dr.toBlob) return dr.toBlob(doc);
    return new Blob([JSON.stringify(api.adapter.serialize(doc))], { type: dr.mime || 'application/json' });
  }
  /** The title plus the app's extension, once: "Notes" -> "Notes.txt", "Notes.txt" stays "Notes.txt". */
  function fileName(api, doc) {
    const dr = api.adapter.drive || {};
    let ext = dr.ext || '';
    if (ext && !ext.startsWith('.')) ext = '.' + ext;
    const base = String(api.nameOf(doc) || 'Untitled').replace(/\s+/g, ' ').trim() || 'Untitled';
    return ext && !base.toLowerCase().endsWith(ext.toLowerCase()) ? base + ext : base;
  }

  /**
   * Save doc to Slop Drive. A tab already linked to a Drive file writes that file again (a new version, not a second
   * copy). Otherwise the person picks a folder and the tab is linked to the new file. Resolves with the Drive id, or null.
   */
  async function saveToDrive(api, doc) {
    if (!doc) return null;
    const H = hub();
    if (!H) { toast(api, 'Slop Drive is not available here'); return null; }
    const blob = await blobOf(api, doc), name = fileName(api, doc), type = (api.adapter.drive || {}).mime || blob.type;
    const linked = api.driveIdOf(doc);
    let id = null;
    if (linked) {
      const out = await H.update(linked, { blob, name, type }).catch(() => null);
      if (out) id = linked;
    }
    if (!id) {
      id = await H.saveToDrive(blob, name, { from: api.appId || 'unknown', title: `Save “${name}” to Slop Drive` });
      if (!id) return null;
    }
    api.setDriveId(doc, id);
    api.markSaved(doc);
    toast(api, `Saved ${name} to Slop Drive`);
    return id;
  }

  // Open from Slop Drive is each app's: a source of the one intake (SlopIntake.fromDrive), whose reader opens the file in a
  // tab linked to it with api.openDoc(doc, { driveId, origName }).
  NS.drive = { saveToDrive, fileName };
})();
