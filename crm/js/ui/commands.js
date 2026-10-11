// Slop CRM commands, registered with SlopCmd (palette, remappable keys). Also wires every [data-cmd] button.
(function (g) {
  'use strict';
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const $ = (id) => document.getElementById(id);
  const COMMANDS = [
    { id: 'view.pipeline', title: 'Go to Pipeline', group: 'Go to', run: () => NS.app.show('pipeline') },
    { id: 'view.customers', title: 'Go to Customers', group: 'Go to', run: () => NS.app.show('customers') },
    { id: 'view.followups', title: 'Go to Follow-ups', group: 'Go to', run: () => NS.app.show('followups') },
    { id: 'customers.new', title: 'Customers: add a customer', group: 'Customers', run: () => NS.form.open(null) },
    { id: 'customers.search', title: 'Customers: search', group: 'Customers', keywords: ['find', 'filter'],
      run: () => { NS.app.show('customers'); setTimeout(() => $('cSearch').focus(), 40); } },
    { id: 'customers.import', title: 'Customers: import from Slop Contacts', group: 'Customers', run: () => NS.importUi.open() },
    { id: 'labels.tags', title: 'Customers: manage tags', group: 'Customers', keywords: ['colour', 'color', 'merge'], run: () => NS.tagManager.open() },
    { id: 'labels.groups', title: 'Customers: manage groups', group: 'Customers', keywords: ['filter', 'segment'], run: () => NS.groupsPanel.open() },
  ];
  const byId = Object.fromEntries(COMMANDS.map((c) => [c.id, c]));

  /** Runs a command through SlopCmd when it is loaded (recents and remapped keys apply), else directly. */
  function run(id) {
    if (g.SlopCmd && g.SlopCmd.get(id)) return g.SlopCmd.run(id);
    const c = byId[id];
    if (!c) return false;
    c.run();
    return true;
  }

  function init() {
    if (g.SlopCmd) {
      g.SlopCmd.init({ app: 'crm' });
      g.SlopCmd.register(COMMANDS.map((c) => ({ id: c.id, title: c.title, group: c.group, keywords: c.keywords || [], keys: [], run: () => c.run() })));
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
