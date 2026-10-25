/* Slop Gallery: the panel on the right (the suite rule, shared/frame/HANDOFF.md: SlopFrame, shared/frame/frame.js and
 * panel.js). The photos are the view; views, albums and filters stay on the left (ui/sidebar.js, a drawer on a phone).
 * The panel holds what acts on the photos: the selection (Sort, Make reel, More actions), adding photos (a folder, from
 * Slop Drive, keep duplicates) and the library tools (sort deck, duplicates, backup, restore), with Import photos, the main
 * button, at its foot. The page's own buttons move in (their ids and listeners stay). On a phone the panel is a bottom
 * sheet whose closed state still shows Import; "Library" opens it. Exposes window.SlopGallery.panel.init(). */
(function () {
  'use strict';
  const G = (window.SlopGallery = window.SlopGallery || {});
  const $ = (id) => document.getElementById(id);
  let fr = null, p = null, lastN = -1;

  function render() {
    const n = G.state.selected.length;
    if (n === lastN) return;
    lastN = n;
    $('btnActions').textContent = 'More actions…';
    p.render([
      { key: 'sel', title: n ? `Selection (${n})` : 'Selection', note: n ? '' : 'Pick photos with Select (or Ctrl+click) to sort them, make a reel or act on them.',
        actions: [{ el: $('topSort'), label: n ? `Sort ${n} photos` : 'Sort photos' }, { el: $('topReel') }, { el: $('btnActions') }] },
      { key: 'add', title: 'Add photos', settings: [$('btnFolder'), $('btnDrive'), $('keepDup').closest('label')] },
      { key: 'lib', title: 'Library', settings: [$('btnSort'), $('btnDupes'), $('btnBackup'), $('btnRestore')] },
    ]);
  }

  function init() {
    if (!window.SlopFrame || fr) return;
    const panel = $('gPanel'), main = document.querySelector('main.grid-area');   // the panel's place is in index.html
    fr = G.panel.frame = window.SlopFrame.mount(document.querySelector('.app > .body'), { view: main, panel, panelLabel: 'Library', storageKey: 'gallery',
      button: '.tb-group', phoneButton: false, phone: '(max-width: 700px)', width: 280, min: 240, max: 420 });
    p = window.SlopFrame.panel(panel, { title: 'Library' });
    $('btnImport').closest('.side-sec').hidden = true;   // its buttons are in the panel now (Import photos… is the foot's)
    render();
    p.footer([{ el: $('topImport'), primary: true, label: 'Import photos', title: 'Import photos (Ctrl+O)' }], { more: 'Library' });
    G.state.subscribe((what) => { if (what === 'selection') render(); });
  }

  G.panel = { init, render: () => { lastN = -1; if (p) render(); } };
})();
