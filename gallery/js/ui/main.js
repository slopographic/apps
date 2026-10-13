/* Slop Gallery: boot. Loads the library from IndexedDB, mounts the timeline and the side panel, wires drag and drop
 * (files and folders), the commands, the Slop Drive hand-off (?drive=<id>) and the bus. Sets window.SlopGallery.ready
 * when the library is on screen (the tests wait for it). */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const $ = (id) => document.getElementById(id);

  // Files and folders dropped on the window: SlopDrop (shared/drop) shows the outline and each file's progress. The
  // folder walk (G.source.fromDrop) reads the drop's entries inside the drop event, as before.
  function bindDrop() {
    window.SlopDrop.attach($('gDrop'), {
      accept: {
        types: ['image/*'],
        exts: ['.jpg', '.jpeg', '.jpe', '.png', '.webp', '.gif', '.avif', '.bmp', '.heic', '.heif', '.svg'],
        noun: 'a photo',
      },
      compact: true,
      targets: [document.querySelector('main.grid-area') || document.body],
      files: async (dt) => (await G.source.fromDrop(dt)).map((it) => it.file),
      process: async (file) => {
        await G.actions.importItems([{ file, name: file.name }]);
        return file.name;
      },
    });
  }

  async function openFromLaunch() {
    if (!window.SlopHub || !window.SlopHub.consumeLaunch) return;
    const rec = await window.SlopHub.consumeLaunch();
    if (rec && rec.blob && G.source.isImage(rec.blob, rec.name)) await G.actions.importItems([{ file: rec.blob, name: rec.name, driveId: rec.id }]);
  }

  async function boot() {
    if (window.SlopHub && SlopHub.register) SlopHub.register('gallery');
    if (window.SlopCmd) SlopCmd.init({ app: 'gallery' });
    G.commands.register();
    bindDrop();
    await G.library.load();
    G.timeline.init({
      scroller: $('grid'), content: $('tlContent'), sticky: $('sticky'), empty: $('empty'), status: $('status'),
    });
    G.sidebar.init($('side'));
    G.driveView.init(); // the Library / Drive switch (ui/drive-view.js)
    G.driveBar.init();
    G.peopleBar.init(); // the People bar (ui/people.js); the scan starts from core/people.js
    G.menus.bind($('grid'));
    $('topImport').addEventListener('click', () => G.actions.importFiles());
    $('emptyImport').addEventListener('click', () => G.actions.importFiles());
    $('topSort').addEventListener('click', () => G.actions.sortIds(G.state.selected.length ? G.state.selected : []));
    G.reel.init($('topReel'));
    $('btnActions').addEventListener('click', (e) => G.menus.openActions(e.currentTarget));
    $('btnSelectMode').addEventListener('click', (e) => {
      const on = !G.state.state.selectMode;
      G.state.state.selectMode = on;
      e.currentTarget.setAttribute('aria-pressed', String(on));
    });
    G.library.on(() => { if (G.state.state.view === 'album' && !G.library.album(G.state.state.query.album)) G.state.setView('photos'); });
    await G.viewState.restore(); // ui/view-state.js: the view, filters, Select mode and scroll
    G.ready = true;
    openFromLaunch();
  }

  G.boot = boot;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => boot().catch((e) => console.error(e)));
  else boot().catch((e) => console.error(e));
})();
