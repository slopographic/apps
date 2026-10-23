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
  let runner = null;
  /** Registers the commands with SlopCmd and wires [data-cmd] (SlopBiz.commands, shared/biz/biz.js). */
  function init() { runner = g.SlopBiz.commands('crm', COMMANDS); }
  /** Runs a command by id (through SlopCmd when it is loaded). */
  const run = (id) => (runner ? runner(id) : false);

  NS.commands = { init, run, list: COMMANDS };
})(typeof window !== 'undefined' ? window : globalThis);
