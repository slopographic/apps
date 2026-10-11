/* Slop Gallery: boot. Loads the library from IndexedDB, mounts the timeline and the side panel, wires drag and drop
 * (files and folders), the commands, the Slop Drive hand-off (?drive=<id>) and the bus. Sets window.SlopGallery.ready
 * when the library is on screen (the tests wait for it). */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const $ = (id) => document.getElementById(id);

  function bindDrop() {
    let depth = 0;
    const on = (v) => document.body.classList.toggle('dragging', v);
    window.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) { depth++; on(true); e.preventDefault(); } });
    window.addEventListener('dragover', (e) => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) on(false); });
    window.addEventListener('drop', async (e) => {
      e.preventDefault(); depth = 0; on(false);
      if (!e.dataTransfer) return;
      const items = await G.source.fromDrop(e.dataTransfer);
      G.actions.importItems(items);
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
    G.menus.bind($('grid'));
    $('topImport').addEventListener('click', () => G.actions.importFiles());
    $('emptyImport').addEventListener('click', () => G.actions.importFiles());
    $('topSort').addEventListener('click', () => G.actions.sortIds(G.state.selected.length ? G.state.selected : []));
    $('btnSelectMode').addEventListener('click', (e) => {
      const on = !G.state.state.selectMode;
      G.state.state.selectMode = on;
      e.currentTarget.setAttribute('aria-pressed', String(on));
    });
    G.library.on(() => { if (G.state.state.view === 'album' && !G.library.album(G.state.state.query.album)) G.state.setView('photos'); });
    G.ready = true;
    openFromLaunch();
  }

  G.boot = boot;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => boot().catch((e) => console.error(e)));
  else boot().catch((e) => console.error(e));
})();
