/* Checksum: the page as the suite's View · Panel (shared/frame): the file and its hash in the middle, and on the right the
 * Algorithm and the published hash to check against, with Copy hash stuck to the panel's foot (the suite rule,
 * shared/frame/HANDOFF.md). Phones: the panel is a bottom sheet whose foot (Settings + Copy hash) always shows. The
 * controls are the page's own (the panel adopts them); js/checksum.js wires them. Classic script, before checksum.js. */
(function (g) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const fr = g.SlopFrame.mount($('ck-frame'), {
    list: null, view: $('ck-view'), panel: $('ck-side'), phone: '(max-width: 760px)', panelLabel: 'Settings',
    storageKey: 'checksum', phoneButton: false, width: 300, min: 260,
  });
  const panel = g.SlopFrame.panel($('ck-side'), { title: 'Checksum' });
  panel.render([...$('ck-side').querySelectorAll('.ck-group')].map((gr) => ({ title: gr.dataset.title, key: gr.dataset.title, settings: gr })));
  panel.footer([{ el: $('ck-copy') }], { more: 'Settings' });
  g.SlopChecksumFrame = { frame: fr, panel };
})(typeof window !== 'undefined' ? window : globalThis);
