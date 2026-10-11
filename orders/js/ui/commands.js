// Slop Orders commands, registered with SlopCmd (palette, remappable keys). Also wires [data-cmd] elements.
// Commands that act on the open order are only offered while the editor shows one (their `when`).
(function (g) {
  'use strict';
  const NS = (g.SlopOrders = g.SlopOrders || {});
  const UI = g.SlopUI;
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
      C.init({ app: 'orders' });
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
