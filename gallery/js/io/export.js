/* Slop Gallery: download the selected photos. One photo downloads as its original file. Several photos download as one
 * store-only zip (io/zip.js) with unique names. The whole-library backup is a dated zip from io/backup.js.
 * Exposes window.SlopGallery.export. */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});

  /** Returns a name that is not in `taken` yet: "a.jpg", "a (2).jpg", ... */
  function uniqueName(name, taken) {
    if (!taken.has(name)) { taken.add(name); return name; }
    const dot = name.lastIndexOf('.'), stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
    for (let n = 2; ; n++) { const cand = stem + ' (' + n + ')' + ext; if (!taken.has(cand)) { taken.add(cand); return cand; } }
  }
  /** Blobs for the given photo ids, in order. Missing ones are skipped. */
  async function originals(ids) {
    const out = [];
    for (const id of ids) {
      const meta = G.library.photo(id), row = meta && await G.db.get('originals', id);
      if (row && row.blob) out.push({ name: meta.name, blob: row.blob });
    }
    return out;
  }
  /** Downloads the selection. Returns the number of files saved. */
  async function downloadSelection(ids, { zipName = 'slop-gallery-selection.zip' } = {}) {
    const files = await originals(ids);
    if (!files.length) return 0;
    if (files.length === 1) { window.SlopUI.download(files[0].blob, files[0].name); return 1; }
    const taken = new Set();
    const blob = await G.zip.write(files.map((f) => ({ name: uniqueName(f.name, taken), data: f.blob })));
    window.SlopUI.download(blob, zipName);
    return files.length;
  }
  /** Downloads the whole library as one backup file. */
  async function downloadBackup() {
    const blob = await G.backup.exportLibrary();
    const d = new Date(), stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    window.SlopUI.download(blob, 'slop-gallery-backup-' + stamp + '.zip');
    return blob.size;
  }

  G.export = { downloadSelection, downloadBackup, uniqueName };
})();
