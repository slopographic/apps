/* Slop Gallery: the actions every entry point shares (toolbar, right-click menus, SlopCmd commands, keyboard).
 * Each action works on the selection when there is one, otherwise on the photo it was called for.
 * Exposes window.SlopGallery.actions. */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const toast = (m) => window.SlopUI && SlopUI.toast(m);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /** ids for an action: the selection if it holds the photo, else the selection when there is one, else just the photo. */
  function targets(id) {
    const sel = G.state.selected;
    if (id && sel.includes(id)) return sel;
    if (!id && sel.length) return sel;
    return id ? [id] : sel;
  }

  /** Runs the import pipeline and reports the result. items: [{ file, name, driveId? }]. */
  /** The note for video files that were left out (the library keeps photos). */
  const videoNote = (names) => `${plural(names.length, 'video was', 'videos were')} not imported: the library keeps photos. Play them in the Drive view.`;
  async function importItems(items) {
    const videos = (items && items.skipped) || [];
    if (!items || !items.length) { toast(videos.length ? videoNote(videos) : 'Nothing to import: no photos found.'); return null; }
    const busy = document.getElementById('busy');
    const keep = !!(document.getElementById('keepDup') || {}).checked;
    if (busy) { busy.hidden = false; busy.textContent = `Importing ${items.length}…`; }
    let report;
    try {
      report = await G.importer.run(items, { keepDuplicates: keep, onProgress: (p) => { if (busy) busy.textContent = `Importing ${p.done + 1} of ${p.total}${p.name ? ' · ' + p.name : ''}`; } });
    } finally { if (busy) busy.hidden = true; }
    const parts = [plural(report.added, 'photo added', 'photos added')];
    if (videos.length) parts.push(videoNote(videos));
    if (report.skipped) parts.push(`${report.skipped} already in the library`);
    if (report.failed.length) parts.push(`${report.failed.length} could not be read`);
    toast(parts.join(' · '));
    if (report.failed.length) await SlopUI.alert('Some files could not be read', `These files are not images this browser can decode: ${report.failed.slice(0, 12).join(', ')}${report.failed.length > 12 ? '…' : ''}`);
    return report;
  }
  const importFiles = async () => importItems(G.source.fromFiles(await SlopUI.pickFiles({ accept: 'image/*', multiple: true })));
  const importFolder = async () => {
    const items = await G.source.fromDirectory();
    if (items === null) { await SlopUI.alert('Folder import', 'This browser cannot open folders directly. Drag the folder onto the window instead.'); return null; }
    return importItems(items);
  };
  const importDrive = async () => importItems(await G.source.fromDrive());

  async function removeIds(ids) {
    if (!ids.length) return;
    const ok = await SlopUI.confirm('Remove from library', `Remove ${plural(ids.length, 'photo', 'photos')} from Slop Gallery? Their Slop Drive files, if any, are kept.`, 'Remove', { danger: true });
    if (!ok) return;
    const n = await G.library.remove(ids);
    G.state.select(ids, false);
    ids.forEach((id) => G.urls.forget(id));
    toast(`Removed ${plural(n, 'photo', 'photos')}`);
  }
  async function tagPrompt(ids) {
    const t = await SlopUI.prompt('Add a tag', 'Tag name', '', { ok: 'Add tag', placeholder: 'e.g. holiday' });
    const tag = t && t.trim().toLowerCase();
    if (!tag || !ids.length) return;
    await G.library.retag(ids, (m) => ({ tags: [...m.tags, tag] }));
    toast(`Tagged ${plural(ids.length, 'photo', 'photos')} “${tag}”`);
  }
  async function exportIds(ids) {
    if (!ids.length) return;
    const n = await G.export.downloadSelection(ids);
    toast(n > 1 ? `Saved ${n} photos as a zip` : n ? 'Saved' : 'Nothing to save');
  }
  async function restoreBackup() {
    const picked = await SlopUI.pickFiles({ accept: '.zip,application/zip', multiple: false });
    const file = picked && picked[0];
    if (!file) return null;
    const ok = await SlopUI.confirm('Restore a backup', `Restore “${file.name}” into this library? Photos already here (same bytes) are merged, nothing is deleted.`, 'Restore');
    if (!ok) return null;
    try {
      const r = await G.backup.restore(file);
      toast(`Restored ${plural(r.added, 'photo', 'photos')}${r.merged ? `, ${r.merged} already here` : ''}`);
      return r;
    } catch (e) {
      await SlopUI.alert('Restore failed', e.message + ' Nothing was changed.');
      return null;
    }
  }
  function sortIds(ids) {
    const list = ids && ids.length ? ids : G.timeline.visibleIds();
    if (!list.length) { toast('Nothing to sort here.'); return; }
    G.sortmode.open(list);
  }

  G.actions = {
    targets, importItems, importFiles, importFolder, importDrive, removeIds, tagPrompt, exportIds, restoreBackup, sortIds,
    selectAll: () => G.state.select(G.timeline.visibleIds(), true),
    clearSelection: () => G.state.clearSelection(),
    toggleFav: (ids) => G.library.toggleFav(ids),
    like: (ids, v) => G.library.setLiked(ids, v),
    dupes: () => G.dupes.open(),
    backup: () => G.export.downloadBackup().then((n) => toast(`Backup saved (${Math.round(n / 1024)} KB)`)),
    makeReel: (ids) => G.reel.open(ids),
  };
})();
