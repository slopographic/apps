/* Slop EML: boot. Lays the page out as the suite's List · View · Panel (shared/frame: the message list, the message, the
 * actions panel), wires the header, the empty state, the body switch, the drop zone and the commands, opens a file sent
 * from Slop Drive (?drive=<id>), then draws the page. Classic script, runs once the page is parsed. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  function layout() {
    const fr = window.SlopFrame.mount($('em-frame'), {
      list: $('em-list'), view: $('em-main'), panel: $('em-side'), phone: '(max-width: 900px)', panelLabel: 'Actions', storageKey: 'eml',
      button: document.querySelector('.smb-tools'), phoneButton: false, width: 300,
    });
    window.EmlView.frame = fr;
    window.EmlSide.init($('em-side'));
    window.EmlList.init({ open: (doc, show) => { if (show) fr.showView(); } });
    $('em-back').addEventListener('click', () => { fr.showList(); const b = document.querySelector('.em-row.em-on .em-row-open'); if (b) b.focus(); });
    $('em-actions').addEventListener('click', () => fr.openSheet());
    $('em-list-actions').addEventListener('click', () => fr.openSheet());
    $('em-atts-chip').addEventListener('click', () => {
      if (fr.isPhone()) fr.openSheet(); else if (!fr.panelShown()) fr.setPanel(true);
      const sec = [...$('em-side').querySelectorAll('.sf-h')].find((h) => /^Attachments/.test(h.textContent));
      if (sec) { sec.scrollIntoView({ block: 'start' }); const b = sec.parentNode.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
    });
  }

  function wire() {
    const pick = () => window.EmlActions.pick();
    $('em-open').addEventListener('click', pick);
    $('em-open2').addEventListener('click', pick);
    $('em-cmd').addEventListener('click', () => { if (window.SlopCmd && SlopCmd.open) SlopCmd.open(); });
    $('em-v-html').addEventListener('click', () => window.EmlApp.setView('html'));
    $('em-v-text').addEventListener('click', () => window.EmlApp.setView('text'));
    $('em-cid').addEventListener('click', () => window.EmlApp.toggleCids());
    /* The one way in (shared/intake, spec 'eml'): .eml files and mailboxes from a drop on the strip or the page, Open
       messages…, the sample, a paste, ?drive=<id> (Slop Drive's Open with) and a PWA launch open in turn (refusals say
       why). A file that is already open is not opened again. A batch of two or more goes to the list, not to tabs. */
    window.SlopIntake.register({
      id: 'eml',
      accept: { types: ['message/rfc822', 'application/mbox'], exts: ['.eml', '.mbox', '.mbx'], noun: 'an email file (.eml) or a mailbox (.mbox)' },
      process: async (file, ctx) => {
        if (window.EmlApp.isOpen(file.name, file.size)) throw new Error('is already open');
        await window.EmlApp.openFile(file, { pin: ctx.batch.take.length <= 1 });
        return file.name;
      },
    });
    window.SlopDrop.attach($('em-drop'), {
      intake: 'eml',
      targets: [$('em-drop'), $('em-frame')],
      compact: true,
    });
    // The empty page shows a read email and how (SlopDrop's preview); the sample goes through the strip.
    const empty = $('em-empty'), row = empty.querySelector('.em-empty-b'), sample = document.createElement('button');
    empty.insertBefore(window.SlopDrop.panel.preview({
      picture: { src: '../assets/shots/eml.jpg', alt: 'An email open in Slop EML: who sent it, when, and the message' },
      steps: ['Drop .eml files or a mailbox', 'Read, search and tick messages', 'Export them, combine them into one PDF, or open them in Slop PDF'],
    }), row);
    sample.type = 'button'; sample.className = 'sd-sample'; sample.id = 'em-sample'; sample.textContent = 'Try it with a sample email';
    sample.addEventListener('click', () => window.SlopIntake.sample([window.SlopSamples.docs.eml()], { to: 'eml' }));
    row.append(sample);
  }

  /** A message or mailbox sent from Slop Drive ("Open with Slop EML"), or a PWA launch: through the intake. */
  function launch() {
    if (window.SlopHub) window.SlopHub.register('eml');
    return window.SlopIntake.launch({ to: 'eml' }).catch(() => null);
  }

  function boot() {
    window.EmlApp.subscribe(() => window.EmlView.render());
    window.EmlCommands.register();
    layout();
    wire();
    window.EmlView.render();
    launch();
  }

  document.addEventListener('DOMContentLoaded', () => {
    try { boot(); } catch (e) {
      console.error(e);
      if (window.SlopUI) window.SlopUI.toast('Slop EML could not start: ' + e.message);
    }
    document.body.classList.add('ready');
  });
})();
