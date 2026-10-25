/* Slop Transcribe: the tool as the suite's View · Panel (shared/frame): the files and the transcript in the middle, and on
 * the right Record, Language (Language and model), Save (file format, Download, Copy, Save to Slop Drive, Open in Slop
 * Docs) and Transcribe / Stop stuck to the panel's foot (the suite rule, shared/frame/HANDOFF.md). Phones: the panel is a
 * bottom sheet whose foot (Options + Transcribe) always shows. The buttons stay in the page's markup (the menu bar names
 * them) and the panel adopts them; js/app.js wires them and shows Stop while it runs. Classic script, before the app module. */
(function (g) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const fr = g.SlopFrame.mount($('trUi'), {
    list: null, view: $('trView'), panel: $('trSide'), phone: '(max-width: 760px)', panelLabel: 'Options',
    storageKey: 'transcribe', button: '.smb-tools', phoneButton: false, width: 300, min: 260,
  });
  const panel = g.SlopFrame.panel($('trSide'), { title: 'Transcribe' });
  const el = (id) => ({ el: $(id) });
  panel.render([
    { title: 'Record', key: 'rec', settings: $('trRecGroup') },
    { title: 'Language', key: 'lang', settings: $('trLangGroup') },
    { title: 'Save', key: 'save', settings: $('trFormatField'), actions: ['trDownload', 'trCopy', 'trDrive', 'trDocs'].map(el) },
  ]);
  panel.footer([el('trRun'), el('trStop')], { more: 'Options' });
  g.SlopTranscribeFrame = { frame: fr, panel };
})(typeof window !== 'undefined' ? window : globalThis);
