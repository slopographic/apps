/* SlopClean: the page as the suite's View · Panel (shared/frame): the pictures and what they hold in the middle, and on the
 * right "What to remove" (the choices, Remove all), the Drive save as its Result section and "Copy and clean: download"
 * stuck to its foot (the suite rule, shared/frame/HANDOFF.md). Phones: the panel is a bottom sheet whose foot (Choices +
 * Copy and clean) always shows. The buttons are the page's own (the panel adopts them); app/main.js wires and enables
 * them, and ui/choices.js fills #cl-choices. Classic script, before app/main.js. */
(function (g) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const fr = g.SlopFrame.mount($('cl-frame'), {
    list: null, view: $('cl-view'), panel: $('cl-side'), phone: '(max-width: 860px)', panelLabel: 'Choices',
    storageKey: 'clean', button: '.cl-tools', phoneButton: false, width: 300, min: 260,
  });
  const panel = g.SlopFrame.panel($('cl-side'), { title: 'Clean' });
  panel.render([
    { title: 'What to remove', key: 'remove', settings: [$('cl-choices'), $('cl-remove-all')] },
    { title: 'Result', key: 'result', actions: [{ el: $('cl-save-all') }] },
  ]);
  panel.footer([{ el: $('cl-all') }], { more: 'Choices' });
  (g.CL = g.CL || {}).layout = { frame: fr, panel };
})(typeof window !== 'undefined' ? window : globalThis);
