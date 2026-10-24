/* Slop Image to 3D: the page as the suite's View · Panel (shared/frame): the 3D view in the middle, the settings (Picture,
 * Depth, Subject, Output, Controls) in the panel on the right, the exports as its Result section and "Open in Slop 3D"
 * stuck to its foot (the suite rule, shared/frame/HANDOFF.md). Phones: the panel is a bottom sheet whose foot (Settings +
 * Open in Slop 3D) always shows. Runs before app/main.js, which wires and enables #btnObj, #btnGlb and #btnSend (drawn
 * once here, never redrawn). Classic script. */
(function (g) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const fr = g.SlopFrame.mount($('work'), {
    list: null, view: $('stage'), panel: $('panel'), phone: '(max-width: 720px)', panelLabel: 'Settings',
    storageKey: 'img3d', button: document.querySelector('.topbar .actions'), phoneButton: false, width: 280, min: 240,
  });
  const panel = g.SlopFrame.panel($('panel'), { title: 'Image to 3D' });
  panel.render([
    ...[...$('panel').querySelectorAll('.i3-group')].map((gr) => ({ title: gr.dataset.title, key: gr.dataset.title, settings: gr })),
    { title: 'Result', key: 'result', actions: [{ id: 'btnObj', label: 'Export OBJ', disabled: true }, { id: 'btnGlb', label: 'Export GLB', disabled: true }] },
  ]);
  panel.footer([{ id: 'btnSend', label: 'Open in Slop 3D', primary: true, disabled: true }], { more: 'Settings' });
  (g.SlopImg3D = g.SlopImg3D || {}).layout = { frame: fr, panel };
})(typeof window !== 'undefined' ? window : globalThis);
