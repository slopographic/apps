/* Slop Gallery: where photos come from. Each source resolves to [{ file, name, driveId? }] with only image files kept.
 *  - fromFiles(FileList)          the file picker
 *  - fromDrop(DataTransfer)       dropped files and whole folders (webkitGetAsEntry, recursive)
 *  - fromDirectory()              showDirectoryPicker where the browser has it (FileSystemDirectoryHandle), else null
 *  - fromDrive()                  one file from Slop Drive (SlopHub.pickFromDrive), keeps its Drive id
 * Entries are read synchronously inside the drop event, as the browser requires, before any await.
 * Exposes window.SlopGallery.source. */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif' };
  const extOf = (name) => (/\.([a-z0-9]+)$/i.exec(name || '') || [])[1]?.toLowerCase() || '';
  const mimeOf = (name) => EXT[extOf(name)] || 'application/octet-stream';
  const isImage = (file, name) => /^image\//.test(file.type || '') || !!EXT[extOf(name || file.name)];

  /** Keeps image files only and gives each a display name. */
  function keepImages(list) {
    return list.filter((x) => x && x.file && isImage(x.file, x.name)).map((x) => ({ file: x.file, name: x.name || x.file.name || 'photo', driveId: x.driveId || null }));
  }
  function fromFiles(fileList) {
    return keepImages([...(fileList || [])].map((f) => ({ file: f, name: f.name })));
  }

  const readEntries = (reader) => new Promise((res, rej) => reader.readEntries(res, rej));
  const entryFile = (entry) => new Promise((res, rej) => entry.file(res, rej));
  async function walkEntry(entry, out) {
    if (entry.isFile) { out.push({ file: await entryFile(entry), name: entry.fullPath ? entry.fullPath.replace(/^\//, '') : entry.name }); return; }
    if (!entry.isDirectory) return;
    const reader = entry.createReader();
    for (let batch = await readEntries(reader); batch.length; batch = await readEntries(reader)) {
      for (const child of batch) await walkEntry(child, out);
    }
  }
  /** Drop handler: collects entries synchronously, then walks folders. Falls back to getAsFile where entries are missing. */
  async function fromDrop(dt) {
    if (!dt || !dt.items) return fromFiles(dt && dt.files);
    const entries = [], loose = [];
    for (const item of [...dt.items]) {
      if (item.kind && item.kind !== 'file') continue;
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) entries.push(entry);
      else { const f = item.getAsFile && item.getAsFile(); if (f) loose.push({ file: f, name: f.name }); }
    }
    const out = [...loose];
    for (const e of entries) await walkEntry(e, out);
    return keepImages(out);
  }
  /** Walks a FileSystemDirectoryHandle; only where showDirectoryPicker exists (Chromium). */
  async function walkHandle(dir, prefix, out) {
    for await (const [name, h] of dir.entries()) {
      if (h.kind === 'file') out.push({ file: await h.getFile(), name: prefix + name });
      else if (h.kind === 'directory') await walkHandle(h, prefix + name + '/', out);
    }
    return out;
  }
  async function fromDirectory() {
    if (!window.showDirectoryPicker) return null;
    let dir;
    try { dir = await window.showDirectoryPicker({ mode: 'read' }); } catch (e) { return []; }
    return keepImages(await walkHandle(dir, '', []));
  }
  async function fromDrive() {
    if (!window.SlopHub || !window.SlopHub.pickFromDrive) return [];
    const picked = await window.SlopHub.pickFromDrive({ accept: ['image/*'], title: 'Import from Slop Drive' });
    if (!picked) return [];
    const rec = picked.blob ? picked : await window.SlopHub.get(picked.id);
    if (!rec || !rec.blob) return [];
    return keepImages([{ file: rec.blob, name: rec.name, driveId: rec.id }]);
  }

  G.source = { fromFiles, fromDrop, fromDirectory, fromDrive, mimeOf, isImage, EXT };
})();
