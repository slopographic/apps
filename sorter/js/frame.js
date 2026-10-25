/* Slop Photo Sorter: the page as the suite's View · Panel (shared/frame): the photos in the middle, and on the right the
 * downloads (liked as a ZIP, to Slop Drive, the list as CSV) and Clear, with "Start sorting" stuck to the panel's foot (the
 * suite rule, shared/frame/HANDOFF.md). Phones: the panel is a bottom sheet whose foot (Save + Start sorting) always
 * shows. The buttons stay in the page's markup (the menu bar names them) and the panel adopts them; js/app.js wires them.
 * Classic script. */
(function (g) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const fr = g.SlopFrame.mount($('soFrame'), {
    list: null, view: $('soView'), panel: $('soSide'), phone: '(max-width: 760px)', panelLabel: 'Save',
    storageKey: 'sorter', button: '.smb-tools', phoneButton: false, width: 280, min: 240,
  });
  const panel = g.SlopFrame.panel($('soSide'), { title: 'Keep the best' });
  panel.render([{ title: 'Save', key: 'save', actions: ['soZip', 'soDrive', 'soCsv', 'soClear'].map((id) => ({ el: $(id) })) }]);
  panel.footer([{ el: $('soStart') }], { more: 'Save' });
  g.SlopSorterFrame = { frame: fr, panel };
})(typeof window !== 'undefined' ? window : globalThis);
