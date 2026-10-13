/* Slop Contacts: vCards and CSV files dropped on the contact list, or chosen with the zone's button, go to the import
 * flow together (one preview). Other files are refused with their names (SlopDrop, shared/drop: the column is the drop
 * target and the zone sits at its head). Adds SlopContacts.dropImport. */
(function () {
  'use strict';
  const SC = window.SlopContacts;

  const RULES = {
    types: ['text/vcard', 'text/x-vcard', 'text/csv', 'application/csv', 'text/comma-separated-values', 'text/plain'],
    exts: ['.vcf', '.vcard', '.csv'],
    noun: 'a vCard (.vcf, .vcard) or a CSV (.csv) file',
  };
  let pending = []; // the accepted files of the batch, read by the import flow once the batch is done

  /** One accepted file. A name the import does not read (a .txt with a text type) is refused here, by name. */
  function process(file) {
    if (!SC.importPlan.DROPPABLE.test(file.name || '')) throw new Error('is not a vCard or CSV file');
    pending.push(file);
    return file.name;
  }
  /** After the batch: the files go to the import flow together, so the preview lists them all. */
  function done() {
    const list = pending;
    pending = [];
    if (list.length) SC.importFlow.run(list);
  }

  function mount() {
    const column = document.querySelector('.col-list');
    const zone = document.getElementById('ctDrop');
    if (!column || !zone || !window.SlopDrop) return;
    SlopDrop.attach(zone, { accept: RULES, compact: true, label: 'Drop vCards or CSV files here', targets: [column], process, done });
  }

  SC.dropImport = { mount };
})();
