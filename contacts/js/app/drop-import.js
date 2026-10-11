/* Slop Contacts: drop files on the contact column to import them. Only file drags are taken (a row dragged onto a
 * group is not). .vcf, .vcard and .csv files go to the import flow; other files are named and left out. The column
 * shows a dashed outline while files are over it. Adds SlopContacts.dropImport. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const UI = window.SlopUI;

  const hasFiles = (e) => !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'));

  /** Imports the dropped files that the import takes; names the rest. */
  function handle(files) {
    const ok = files.filter((f) => SC.importPlan.DROPPABLE.test(f.name || ''));
    const skipped = files.filter((f) => !SC.importPlan.DROPPABLE.test(f.name || ''));
    if (!ok.length) {
      UI.alert('Nothing to import', `Drop a vCard (.vcf or .vcard) or a CSV (.csv) file. Not taken: ${skipped.map((f) => f.name).join(', ')}.`);
      return;
    }
    if (skipped.length) UI.toast(`Not taken: ${skipped.map((f) => f.name).join(', ')}`);
    SC.importFlow.run(ok);
  }

  function mount() {
    const target = document.querySelector('.col-list');
    if (!target) return;
    target.addEventListener('dragenter', (e) => { if (hasFiles(e)) { e.preventDefault(); target.classList.add('is-dropping'); } });
    target.addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    target.addEventListener('dragleave', (e) => {
      if (hasFiles(e) && !target.contains(e.relatedTarget)) target.classList.remove('is-dropping');
    });
    target.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      target.classList.remove('is-dropping');
      handle(Array.from(e.dataTransfer.files || []));
    });
  }

  SC.dropImport = { mount, handle };
})();
