// Slop Orders commands, registered with SlopCmd (palette, remappable keys). Also wires [data-cmd] elements.
// Commands that act on the open order are only offered while the editor shows one (their `when`).
(function (g) {
  'use strict';
  const NS = (g.SlopOrders = g.SlopOrders || {});
  const E = () => NS.editor.state();
  const editing = () => E().open;

  const COMMANDS = [
    { id: 'view.list', title: 'Go to Orders', group: 'Go to', run: () => NS.app.go('list') },
    { id: 'view.data', title: 'Go to Data (backup and restore)', group: 'Go to', run: () => NS.app.go('data') },
    { id: 'orders.new', title: 'Orders: new order', group: 'Orders', keywords: ['add', 'create'], run: () => NS.app.go('new') },
    { id: 'orders.sample', title: 'Orders: random sample', group: 'Orders', keywords: ['test', 'demo', 'fake'], run: () => NS.sampleActions.quick() },
    { id: 'orders.samples', title: 'Orders: random samples… (options)', group: 'Orders', keywords: ['test', 'demo', 'batch'], run: () => NS.sampleActions.options() },
    { id: 'orders.deleteSamples', title: 'Orders: delete all samples…', group: 'Orders', keywords: ['test', 'demo', 'clear'], run: () => NS.sampleActions.deleteAll() },
    { id: 'orders.save', title: 'Order: save', group: 'Order', when: () => editing() && E().status !== 'fulfilled' && E().status !== 'cancelled',
      run: () => NS.editor.save() },
    { id: 'orders.confirm', title: 'Order: confirm (draft to confirmed)', group: 'Order', when: () => editing() && E().status === 'draft',
      run: () => NS.editor.confirm() },
    { id: 'orders.fulfil', title: 'Order: fulfil and take stock out…', group: 'Order', when: () => editing() && E().status === 'open',
      run: () => NS.editor.fulfil() },
    { id: 'orders.cancel', title: 'Order: cancel…', group: 'Order', when: () => editing() && (E().status === 'draft' || E().status === 'open'),
      run: () => NS.editor.cancel() },
    { id: 'orders.convert', title: 'Order: convert to invoice', group: 'Order',
      when: () => editing() && ['open', 'fulfilled'].includes(E().status) && !E().invoiceId, run: () => NS.editor.convert() },
    { id: 'data.backup', title: 'Data: download a full backup', group: 'Data', run: () => NS.dataActions.backup() },
  ];
  let runner = null;
  /** Registers the commands with SlopCmd and wires [data-cmd] (SlopBiz.commands, shared/biz/biz.js). */
  function init() { runner = g.SlopBiz.commands('orders', COMMANDS); }
  /** Runs a command by id (through SlopCmd when it is loaded). */
  const run = (id) => (runner ? runner(id) : false);

  NS.commands = { init, run, list: COMMANDS };
})(typeof window !== 'undefined' ? window : globalThis);
