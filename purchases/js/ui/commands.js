// Slop Purchases commands, registered with SlopCmd (palette, remappable keys). Also wires [data-cmd] elements. Commands that
// act on the open purchase order are only offered while the editor shows one (their `when`).
(function (g) {
  'use strict';
  const NS = (g.SlopPurchases = g.SlopPurchases || {});
  const E = () => NS.editor.state();
  const editing = () => E().open && !E().isNew;

  const COMMANDS = [
    { id: 'view.list', title: 'Go to Purchase orders', group: 'Go to', run: () => NS.app.go('list') },
    { id: 'view.data', title: 'Go to Data (backup and restore)', group: 'Go to', run: () => NS.app.go('data') },
    { id: 'purchases.new', title: 'Purchases: new purchase order', group: 'Purchases', keywords: ['add', 'buy', 'supplier', 'po'], run: () => NS.app.go('new') },
    { id: 'purchases.save', title: 'Purchase order: save', group: 'Purchase order', when: () => E().open && (E().status === 'draft' || E().status === 'ordered'), run: () => NS.editor.save() },
    { id: 'purchases.place', title: 'Purchase order: place the order', group: 'Purchase order', when: () => editing() && E().status === 'draft', run: () => NS.editor.place() },
    { id: 'purchases.receive', title: 'Purchase order: receive into stock…', group: 'Purchase order', when: () => editing() && E().status === 'ordered', run: () => NS.editor.receive() },
    { id: 'purchases.bill', title: 'Purchase order: record the bill…', group: 'Purchase order', keywords: ['expense', 'invoice'],
      when: () => editing() && (E().status === 'ordered' || E().status === 'received') && !E().billed, run: () => NS.editor.bill() },
    { id: 'purchases.pdf', title: 'Purchase order: export PDF', group: 'Purchase order', when: editing, run: () => NS.editor.exportPdf() },
    { id: 'data.backup', title: 'Data: download a full backup', group: 'Data', run: () => NS.dataActions.backup() },
  ];
  let runner = null;
  /** Registers the commands with SlopCmd and wires [data-cmd] (SlopBiz.commands, shared/biz/biz.js). */
  function init() { runner = g.SlopBiz.commands('purchases', COMMANDS); }
  const run = (id) => (runner ? runner(id) : false);

  NS.commands = { init, run, list: COMMANDS };
})(typeof window !== 'undefined' ? window : globalThis);
