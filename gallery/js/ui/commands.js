/* Slop Gallery: SlopCmd commands. Every main action is in the command palette (Mod+K) and can be rebound in the
 * keyboard settings. Keys are only Mod combinations, Escape and Delete, so typing in a field is never hijacked.
 * Each command checks its own precondition (selection present, no overlay open) through `when`.
 * Exposes window.SlopGallery.commands.list() for the tests. */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const A = () => G.actions;
  const overlayOpen = () => !!(G.viewer.current() || (G.sortmode.state().open));
  const typing = () => { const a = document.activeElement; return !!(a && a.closest && a.closest('input, textarea, select, [contenteditable="true"]')); };
  const idle = () => !overlayOpen() && !typing();
  const hasSel = () => G.state.selected.length > 0;
  const ids = () => A().targets(null);

  const COMMANDS = [
    { id: 'gallery.import', title: 'Import photos…', group: 'File', keys: ['Mod+O'], run: () => A().importFiles(), when: idle },
    { id: 'gallery.importFolder', title: 'Import a folder…', group: 'File', run: () => A().importFolder(), when: idle },
    { id: 'gallery.importDrive', title: 'Import from Slop Drive…', group: 'File', run: () => A().importDrive(), when: () => idle() && !!window.SlopHub },
    { id: 'gallery.backup', title: 'Back up the whole library', group: 'File', run: () => A().backup(), when: idle },
    { id: 'gallery.restore', title: 'Restore from a backup…', group: 'File', run: () => A().restoreBackup(), when: idle },
    { id: 'gallery.export', title: 'Download selection', group: 'Edit', run: () => A().exportIds(ids()), when: () => idle() && hasSel() },
    { id: 'gallery.selectAll', title: 'Select all', group: 'Edit', keys: ['Mod+A'], run: () => A().selectAll(), when: idle },
    { id: 'gallery.clearSelection', title: 'Clear selection', group: 'Edit', keys: ['Escape'], run: () => A().clearSelection(), when: () => idle() && hasSel() },
    { id: 'gallery.remove', title: 'Remove selection from library', group: 'Edit', keys: ['Delete'], run: () => A().removeIds(ids()), when: () => idle() && hasSel() },
    { id: 'gallery.favourite', title: 'Toggle favourite on selection', group: 'Photo', run: () => A().toggleFav(ids()), when: () => idle() && hasSel() },
    { id: 'gallery.like', title: 'Like selection', group: 'Photo', run: () => A().like(ids(), 'liked'), when: () => idle() && hasSel() },
    { id: 'gallery.dislike', title: 'Dislike selection', group: 'Photo', run: () => A().like(ids(), 'disliked'), when: () => idle() && hasSel() },
    { id: 'gallery.tag', title: 'Add tag to selection…', group: 'Photo', run: () => A().tagPrompt(ids()), when: () => idle() && hasSel() },
    { id: 'gallery.sort', title: 'Sort photos (swipe deck)', group: 'Organise', keys: ['Alt+S'], run: () => A().sortIds(hasSel() ? ids() : []), when: idle },
    { id: 'gallery.dupes', title: 'Find duplicates…', group: 'Organise', keys: ['Mod+Shift+D'], run: () => A().dupes(), when: idle },
    { id: 'gallery.album.new', title: 'New album…', group: 'Albums', run: () => G.albums.create(), when: idle },
    { id: 'gallery.album.add', title: 'Add selection to an album…', group: 'Albums', run: () => G.albums.addIds(ids()), when: () => idle() && hasSel() },
    { id: 'gallery.view.photos', title: 'Show all photos', group: 'View', run: () => G.state.setView('photos'), when: idle },
    { id: 'gallery.view.favourites', title: 'Show favourites', group: 'View', run: () => G.state.setView('favourites'), when: idle },
    { id: 'gallery.view.dupes', title: 'Show duplicates only', group: 'View', run: () => G.state.setView('dupes'), when: idle },
    { id: 'gallery.filter.liked', title: 'Filter: liked only', group: 'View', run: () => G.state.setQuery({ tag: 'liked' }), when: idle },
    { id: 'gallery.filter.disliked', title: 'Filter: disliked only', group: 'View', run: () => G.state.setQuery({ tag: 'disliked' }), when: idle },
    { id: 'gallery.filter.untagged', title: 'Filter: untagged only', group: 'View', run: () => G.state.setQuery({ tag: 'untagged' }), when: idle },
    { id: 'gallery.filter.clear', title: 'Clear all filters', group: 'View', run: () => G.state.setQuery({ text: '', year: '', month: '', camera: '', tag: '' }), when: idle },
  ];

  /** Registers the commands with SlopCmd when it is present. */
  function register() {
    if (!window.SlopCmd) return;
    SlopCmd.register(COMMANDS.map((c) => Object.assign({}, c, { keys: c.keys || [] })));
  }
  G.commands = { register, list: () => COMMANDS.map((c) => ({ id: c.id, title: c.title, keys: c.keys || [] })) };
})();
