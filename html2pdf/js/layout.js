/* Slop HTML to PDF: the page as the suite's View · Panel (shared/frame): the paper preview in the middle, the options
 * (Source, Paper, Page header) in the panel on the right, and "Print or save as PDF…" stuck to the panel's foot (the
 * suite rule, shared/frame/HANDOFF.md). Phones: the panel is a bottom sheet whose foot (Options + Print) always shows.
 * Runs before app.js, which wires and enables #h2p-print (drawn once here, never redrawn). Classic script. */
(function (g) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const fr = g.SlopFrame.mount($('h2p-main'), {
    list: null, view: $('h2p-stage'), panel: $('h2p-side'), phone: '(max-width: 800px)', panelLabel: 'Options',
    storageKey: 'html2pdf', button: '.smb-tools', phoneButton: false, width: 300, min: 260,
  });
  const panel = g.SlopFrame.panel($('h2p-side'), { title: 'HTML to PDF' });
  panel.render([...$('h2p-side').querySelectorAll('.h2p-group')].map((gr) => ({ title: gr.dataset.title, key: gr.dataset.title, settings: gr })));
  panel.footer([{ el: $('h2p-print') }], { more: 'Options' });
  (g.H2P = g.H2P || {}).layout = { frame: fr, panel };
})(typeof window !== 'undefined' ? window : globalThis);
