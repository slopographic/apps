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

  /** One photo into the library: the reader of the one intake (shared/intake, registered in ui/main.js), whichever way
   *  it came in. Throws the reason it is not added (a row in the drop strip, and the toast). */
  async function importOne(file, ctx) {
    const keep = !!(document.getElementById('keepDup') || {}).checked;
    const name = file.slopPath || file.name || 'photo';
    const r = await G.importer.run([{ file, name, driveId: ctx && ctx.drive ? ctx.drive.id : null }], { keepDuplicates: keep });
    if (r.failed.length) throw new Error('is not an image this browser can decode');
    if (!r.added) throw new Error('is already in the library');
    return name;
  }
  // Import, Import a folder and Import from Slop Drive are sources of the intake, like a drop.
  const importFiles = () => window.SlopIntake.pick({ to: 'gallery' });
  const importFolder = async () => {
    const files = await G.source.fromDirectory();
    if (files === null) { await SlopUI.alert('Folder import', 'This browser cannot open folders directly. Drag the folder onto the window instead.'); return null; }
    return window.SlopIntake.take(files, { source: 'folder', to: 'gallery' });
  };
  const importDrive = () => window.SlopIntake.fromDrive({ to: 'gallery', title: 'Import from Slop Drive' });

  /** Removes photos from the library after a confirmation (ask: false when the caller already asked, as the assistant's
   *  panel does for destructive commands). Resolves the number removed. */
  async function removeIds(ids, { ask = true } = {}) {
    if (!ids.length) return 0;
    const ok = !ask || await SlopUI.confirm('Remove from library', `Remove ${plural(ids.length, 'photo', 'photos')} from Slop Gallery? Their Slop Drive files, if any, are kept.`, 'Remove', { danger: true });
    if (!ok) return 0;
    const n = await G.library.remove(ids);
    G.state.select(ids, false);
    ids.forEach((id) => G.urls.forget(id));
    toast(`Removed ${plural(n, 'photo', 'photos')}`);
    return n;
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
  // Restore a backup: a part of the intake of its own (a .zip, one at a time, asked first), so a backup comes in the same
  // one way as a photo. Registered at boot (ui/main.js), once shared/intake has loaded.
  const registerBackup = () => window.SlopIntake.register({
    id: 'gallery.backup', main: false, paste: false, limit: 1, toast: false,
    accept: { types: ['application/zip', 'application/x-zip-compressed'], exts: ['.zip'], noun: 'a Slop Gallery backup (.zip)' },
    gate: (batch) => SlopUI.confirm('Restore a backup', `Restore “${batch.take[0].name}” into this library? Photos already here (same bytes) are merged, nothing is deleted.`, 'Restore'),
    process: async (file) => {
      try {
        const r = await G.backup.restore(file);
        toast(`Restored ${plural(r.added, 'photo', 'photos')}${r.merged ? `, ${r.merged} already here` : ''}`);
        return r;
      } catch (e) {
        await SlopUI.alert('Restore failed', e.message + ' Nothing was changed.');
        throw e;
      }
    },
  });
  const restoreBackup = async () => { const s = await window.SlopIntake.pick({ to: 'gallery.backup', multiple: false }); return (s.added[0] && s.added[0].value) || null; };
  function sortIds(ids) {
    const list = ids && ids.length ? ids : G.timeline.visibleIds();
    if (!list.length) { toast('Nothing to sort here.'); return; }
    G.sortmode.open(list);
  }

  G.actions = {
    targets, importOne, registerBackup, importFiles, importFolder, importDrive, removeIds, tagPrompt, exportIds, restoreBackup, sortIds,
    selectAll: () => G.state.select(G.timeline.visibleIds(), true),
    clearSelection: () => G.state.clearSelection(),
    toggleFav: (ids) => G.library.toggleFav(ids),
    like: (ids, v) => G.library.setLiked(ids, v),
    dupes: () => G.dupes.open(),
    backup: () => G.export.downloadBackup().then((n) => toast(`Backup saved (${Math.round(n / 1024)} KB)`)),
    makeReel: (ids) => G.reel.open(ids),
  };
})();
