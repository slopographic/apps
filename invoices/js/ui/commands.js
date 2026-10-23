// Slop Invoices commands, registered with SlopCmd (palette, remappable keys). Also wires [data-cmd] elements.
// Commands that act on the open invoice are only offered while the editor shows one (their `when`).
(function (g) {
  'use strict';
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const E = () => NS.editor.state();

  const COMMANDS = [
    { id: 'view.list', title: 'Go to Invoices', group: 'Go to', run: () => NS.app.go('list') },
    { id: 'view.data', title: 'Go to Data (backup and restore)', group: 'Go to', run: () => NS.app.go('data') },
    { id: 'invoices.new', title: 'Invoices: new invoice', group: 'Invoices', keywords: ['add', 'create'], run: () => NS.app.go('new') },
    { id: 'invoices.fromOrder', title: 'Invoices: from an order…', group: 'Invoices', keywords: ['convert'], run: () => NS.listView.fromOrder() },
    { id: 'invoices.sample', title: 'Invoices: random sample', group: 'Invoices', keywords: ['test', 'demo', 'fake'], run: () => NS.sampleActions.quick() },
    { id: 'invoices.samples', title: 'Invoices: random samples… (options)', group: 'Invoices', keywords: ['test', 'demo', 'batch'], run: () => NS.sampleActions.options() },
    { id: 'invoices.deleteSamples', title: 'Invoices: delete all samples…', group: 'Invoices', keywords: ['test', 'demo', 'clear'], run: () => NS.sampleActions.deleteAll() },
    { id: 'invoice.save', title: 'Invoice: save draft', group: 'Invoice', when: () => E().open && E().status === 'draft', run: () => NS.editor.save() },
    { id: 'invoice.issue', title: 'Invoice: issue (assign number, post to ledger)…', group: 'Invoice',
      when: () => E().open && E().status === 'draft', run: () => NS.editor.issue() },
    { id: 'invoice.payment', title: 'Invoice: record payment…', group: 'Invoice',
      when: () => E().open && E().status === 'issued', run: () => NS.editor.state().open && NS.paymentDialog.open(NS.editor.id(), () => NS.editor.open(NS.editor.id())) },
    { id: 'invoice.void', title: 'Invoice: void…', group: 'Invoice',
      when: () => E().open && E().status === "issued" && E().payments === 0, run: () => NS.editor.voidInvoice() },
    { id: 'invoice.preview', title: 'Invoice: preview and print', group: 'Invoice', when: () => E().open && !E().isNew, run: () => NS.editor.preview() },
    { id: 'invoice.pdf', title: 'Invoice: export PDF', group: 'Invoice', when: () => E().open && !E().isNew, run: () => NS.preview.pdf(NS.editor.id()) },
    { id: 'data.backup', title: 'Data: download a full backup', group: 'Data', run: () => NS.dataActions.backup() },
  ];
  let runner = null;
  /** Registers the commands with SlopCmd and wires [data-cmd] (SlopBiz.commands, shared/biz/biz.js). */
  function init() { runner = g.SlopBiz.commands('invoices', COMMANDS); }
  /** Runs a command by id (through SlopCmd when it is loaded). */
  const run = (id) => (runner ? runner(id) : false);

  NS.commands = { init, run, list: COMMANDS };
})(typeof window !== 'undefined' ? window : globalThis);
