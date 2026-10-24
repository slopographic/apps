/* Slop Signature: the page as the suite's View · Panel (shared/frame): the signature in a mock email in the middle, the
 * form on the right (Your details), Copy HTML code and Download HTML as its Result section, and Copy signature stuck to
 * its foot (the suite rule, shared/frame/HANDOFF.md). Phones: the panel is a bottom sheet whose foot (Edit + Copy
 * signature) always shows, so the email is the page. Runs before app.js, which wires and enables the buttons (drawn once
 * here, never redrawn) and fills #sgForm. Classic script. */
(function (g) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const fr = g.SlopFrame.mount($('sgApp'), {
    list: null, view: $('sgView'), panel: $('sgPanel'), phone: '(max-width: 860px)', panelLabel: 'Details',
    storageKey: 'signature', button: '.smb-tools', phoneButton: false, width: 420, min: 320, max: 600,
  });
  const panel = g.SlopFrame.panel($('sgPanel'), { title: 'Your signature' });
  panel.render([
    { title: 'Your details', key: 'details', settings: [$('sgStart'), $('sgForm')] },
    { title: 'Result', key: 'result', actions: [{ id: 'sgCode', label: 'Copy HTML code' }, { id: 'sgDownload', label: 'Download HTML' }] },
  ]);
  panel.footer([{ id: 'sgCopy', label: 'Copy signature', primary: true }], { more: 'Edit' });
  (g.SlopSignature = g.SlopSignature || {}).layout = { frame: fr, panel };
})(typeof window !== 'undefined' ? window : globalThis);
