/* QR SLOP: the page as the suite's View · Panel (shared/frame): the live preview in the middle, the editor (Templates,
 * Content, Design, Logo, Raw, Batch tabs) in the panel on the right, SVG and the print page as its Download section and
 * PNG stuck to its foot (the suite rule, shared/frame/HANDOFF.md). Phones: the preview is the page and the panel is a
 * bottom sheet whose foot (Edit + Download PNG) always shows. Runs at the end of <body>, before app.js's init (on
 * DOMContentLoaded) wires and enables #qr-dl-svg, #qr-dl-png and #qr-dl-pdf (drawn once here, never redrawn). */
(function (g) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const edit = $('qr-edit');
  const fr = g.SlopFrame.mount($('qr-work'), {
    list: null, view: $('qr-view'), panel: edit, phone: '(max-width: 860px)', panelLabel: 'Editor',
    storageKey: 'qr', phoneButton: false, width: 440, min: 340, max: 640,
  });
  const panel = g.SlopFrame.panel(edit, { title: 'QR code' });
  panel.render([
    { title: 'Edit', key: 'edit', settings: [$('qr-tabs'), ...edit.querySelectorAll('.qr-panel')] },
    { title: 'Download', key: 'download', actions: [{ id: 'qr-dl-svg', label: 'SVG', disabled: true }, { id: 'qr-dl-pdf', label: 'Print page (PDF)', disabled: true }] },
  ]);
  panel.footer([{ id: 'qr-dl-png', label: 'Download PNG', primary: true, disabled: true }], { more: 'Edit' });
  g.QRLayout = { frame: fr, panel };
})(typeof window !== 'undefined' ? window : globalThis);
