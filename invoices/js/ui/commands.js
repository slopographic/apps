// Slop Invoices commands, registered with SlopCmd (palette, remappable keys). Also wires [data-cmd] elements.
// Commands that act on the open invoice are only offered while the editor shows one (their `when`).
(function (g) {
  'use strict';
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const UI = g.SlopUI;
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
  const byId = Object.fromEntries(COMMANDS.map((c) => [c.id, c]));

  /** Runs a command: through SlopCmd when it is loaded (recents and remapped keys apply), else directly. */
  function run(id) {
    const c = byId[id];
    if (!c) return false;
    if (g.SlopCmd && g.SlopCmd.get(id)) return g.SlopCmd.run(id);
    if (c.when && !c.when()) return false;
    try { c.run(); } catch (err) { console.error(err); if (UI) UI.toast(`${c.title} failed: ${err.message}`); }
    return true;
  }

  function init() {
    const C = g.SlopCmd;
    if (C) {
      C.init({ app: 'invoices' });
      C.register(COMMANDS.map((c) => ({ id: c.id, title: c.title, group: c.group, keywords: c.keywords || [], keys: [], when: c.when, run: () => c.run() })));
    }
    document.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-cmd]');
      if (!el || el.disabled) return;
      e.preventDefault();
      run(el.dataset.cmd);
    });
  }

  NS.commands = { init, run, list: COMMANDS };
})(typeof window !== 'undefined' ? window : globalThis);
