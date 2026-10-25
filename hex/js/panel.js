/* Slop Hex: the inspector on the right (the suite rule, shared/frame/HANDOFF.md: SlopFrame, shared/frame/frame.js and
 * panel.js). The bytes are the view, with Go to and Find above them; the panel holds the open file's facts (name, size,
 * type, SHA-256, the selection: the #hx-info list, moved in with its ids) and Save version, the main button, with
 * Download at its foot (Save as new and Open from Drive stay in the File menu). Open stays in the header. On a phone the
 * panel is a bottom sheet whose closed state still shows Save version and Download. Classic script; HexPanel.mount() at boot. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  function mount() {
    if (!window.SlopFrame) return null;
    const side = $('hx-side');
    const frame = window.SlopFrame.mount($('hx-body'), { view: $('hx-main'), panel: side, panelLabel: 'Inspector', storageKey: 'hex',
      button: '.smb-tools', phoneButton: false, width: 300, min: 240, max: 480 });
    const p = window.SlopFrame.panel(side, { title: 'Inspector' });
    const none = document.createElement('p');
    none.className = 'sf-note hx-none'; none.textContent = 'Open a file to see its size, type, hash and the bytes you select.';
    p.render([{ key: 'file', title: 'Details', settings: [$('hx-info'), none] }]);
    p.footer([{ el: $('hx-save'), primary: true }, { el: $('hx-dl') }], { more: 'Inspector' });
    return { frame, panel: p };
  }
  window.HexPanel = { mount };
})();
