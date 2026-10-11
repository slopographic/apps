/* Slop EML: boot. Wires the header, the empty state, the body switch, the drop zone and the commands, then draws the page.
 * Classic script, runs once the page is parsed. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  function wire() {
    const pick = () => window.EmlActions.pick();
    $('em-open').addEventListener('click', pick);
    $('em-open2').addEventListener('click', pick);
    $('em-print').addEventListener('click', () => window.EmlActions.print());
    $('em-pdf').addEventListener('click', () => window.EmlActions.convertPdf());
    $('em-cmd').addEventListener('click', () => { if (window.SlopCmd && SlopCmd.open) SlopCmd.open(); });
    $('em-menu').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      window.SlopUI.menu(window.EmlCommands.menuItems(), r.left, r.bottom + 4);
    });
    $('em-v-html').addEventListener('click', () => window.EmlApp.setView('html'));
    $('em-v-text').addEventListener('click', () => window.EmlApp.setView('text'));
    $('em-cid').addEventListener('click', () => window.EmlApp.toggleCids());
    /* Drop an .eml file anywhere on the page (SlopDrop: refusals say why). Several files are opened in turn. */
    window.SlopDrop.attach($('em-drop'), {
      accept: { types: ['message/rfc822'], exts: ['.eml'], noun: 'an email file (.eml)' },
      targets: [document.body],
      compact: true,
      process: async (file) => { await window.EmlApp.openFile(file); return file.name; },
    });
  }

  function boot() {
    window.EmlApp.subscribe(() => window.EmlView.render());
    window.EmlCommands.register();
    wire();
    window.EmlView.render();
  }

  document.addEventListener('DOMContentLoaded', () => {
    try { boot(); } catch (e) {
      console.error(e);
      if (window.SlopUI) window.SlopUI.toast('Slop EML could not start: ' + e.message);
    }
    document.body.classList.add('ready');
  });
})();
