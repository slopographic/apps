// Slop Ledger commands, registered with SlopCmd (palette, remappable keys). Also wires every [data-cmd] button.
(function (g) {
  'use strict';
  const NS = (g.SlopLedger = g.SlopLedger || {});
  const $ = (id) => document.getElementById(id);
  const COMMANDS = [
    { id: 'view.journal', title: 'Go to Journal', group: 'Go to', run: () => NS.app.show('journal') },
    { id: 'view.gl', title: 'Go to General ledger', group: 'Go to', run: () => NS.app.show('gl') },
    { id: 'view.trial', title: 'Go to Trial balance', group: 'Go to', run: () => NS.app.show('trial') },
    { id: 'view.accounts', title: 'Go to Accounts', group: 'Go to', run: () => NS.app.show('accounts') },
    { id: 'view.rates', title: 'Go to Exchange rates', group: 'Go to', run: () => NS.app.show('rates') },
    { id: 'journal.new', title: 'Journal: new manual entry', group: 'Journal', run: () => { NS.app.show('journal'); setTimeout(() => $('jMemo').focus(), 40); } },
    { id: 'journal.export', title: 'Journal: export as CSV', group: 'Journal', run: () => $('jExport').click() },
    { id: 'trial.export', title: 'Trial balance: export as CSV', group: 'Trial balance', run: () => { NS.app.show('trial'); $('tExport').click(); } },
    { id: 'accounts.new', title: 'Accounts: add an account', group: 'Accounts', run: () => { NS.app.show('accounts'); setTimeout(() => $('aCode').focus(), 40); } },
    { id: 'rates.new', title: 'Rates: add a manual rate', group: 'Rates', run: () => { NS.app.show('rates'); setTimeout(() => $('rForeign').focus(), 40); } },
    { id: 'view.bank', title: 'Go to Bank', group: 'Go to', run: () => NS.app.show('bank') },
    { id: 'bank.import', title: 'Bank: import a statement…', group: 'Bank', run: () => { NS.app.show('bank'); $('bkPick').click(); } },
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
      g.SlopCmd.init({ app: 'ledger' });
      g.SlopCmd.register(COMMANDS.map((c) => ({ id: c.id, title: c.title, group: c.group, keywords: [], keys: [], run: () => c.run() })));
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
