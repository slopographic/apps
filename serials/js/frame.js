/* Serial counter: the tool as the suite's View · Panel (shared/frame): the photos, the serials and the totals in the
 * middle, and on the right the serial pattern, the downloads and Clear, with "Read photos" stuck to the panel's foot (the
 * suite rule, shared/frame/HANDOFF.md). Phones: the panel is a bottom sheet whose foot (Options + Read photos) always
 * shows. The controls stay in the page's markup (the menu bar names them) and the panel adopts them; js/app.js wires them.
 * Classic script, before the app module runs. */
(function (g) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const fr = g.SlopFrame.mount($('ui'), {
    list: null, view: $('srView'), panel: $('srSide'), phone: '(max-width: 760px)', panelLabel: 'Options',
    storageKey: 'serials', button: '.smb-tools', phoneButton: false, width: 300, min: 260,
  });
  const panel = g.SlopFrame.panel($('srSide'), { title: 'Count serials' });
  panel.render([
    { title: 'Pattern', key: 'pattern', settings: $('srPattern') },
    { title: 'Save', key: 'save', actions: ['export-serials', 'export-photos', 'clear'].map((id) => ({ el: $(id) })) },
  ]);
  panel.footer([{ el: $('read') }], { more: 'Options' });
  g.SlopSerialsFrame = { frame: fr, panel };
})(typeof window !== 'undefined' ? window : globalThis);
