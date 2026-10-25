// The business apps the record-panel test (tests/biz/record-panel.test.html) opens: how each opens a record, where its panel
// and view are, its main button, and what shows that the button ran.
(function (g) {
  'use strict';
  // The document apps (shared/docs): a new record; Save draft with no customer answers in the message line, so it ran.
  const docApp = (name, path, ns) => ({
    name, path, hash: 'new', view: '#view-edit .ws-stage', panel: '#view-edit .ws-panel', main: 'Save draft',
    ready: (W) => W[ns] && W[ns].app && W[ns].app.booted && !W.document.getElementById('view-edit').hidden && W.document.querySelector('.ws-panel .sf-p-foot'),
    done: (W) => W.document.getElementById('eMsg').textContent.trim().length > 0,
  });
  const listApp = (name, path, ns, main) => ({
    name, path, hash: 'new', view: '#view-list', panel: '#view-edit', main,
    ready: (W) => W[ns] && W[ns].app && W[ns].app.booted && !W.document.getElementById('view-edit').hidden && W.document.querySelector('#view-edit .sf-p-foot'),
    done: (W) => W.document.getElementById('eMsg').textContent.trim().length > 0,
  });
  g.RECORD_PANEL_APPS = [
    docApp('Slop Invoices', 'invoices/index.html', 'SlopInvoices'),
    docApp('Slop Orders', 'orders/index.html', 'SlopOrders'),
    docApp('Slop Quotes', 'quotes/index.html', 'SlopQuotes'),
    docApp('Slop Purchases', 'purchases/index.html', 'SlopPurchases'),
    // A record that is a view of its own, beside the list (SlopBiz.panel.records): a new one, its main button with the
    // form empty answers in the message line
    listApp('Slop Expenses', 'expenses/index.html', 'SlopExpenses', 'Record expense'),
    // Contacts: the card is the record panel (its own column, a page on a phone); Edit, Duplicate and Delete at its foot
    { name: 'Slop Contacts', path: 'contacts/index.html', hash: '', view: '.col-list', panel: '#card', main: 'Edit', bare: true,
      ready: (W) => W.SlopContacts && W.SlopContacts.ready,
      async prep(W) {
        W.SlopContacts.state.mode = 'view';   // the card's mode is remembered per device: the run before left it on Edit
        await W.SlopData.store.put('customers', { name: 'Panel Test', stage: 'customer', email: 'panel@test.invalid' });
        const row = () => [...W.document.querySelectorAll('#rows .row')].find((r) => r.textContent.includes('Panel Test'));
        for (let i = 0; i < 100 && !row(); i++) await new Promise((r) => setTimeout(r, 50));
        row().click();
        for (let i = 0; i < 100 && !W.document.querySelector('#card .sf-p-foot'); i++) await new Promise((r) => setTimeout(r, 50));
      },
      done: (W) => !!W.document.querySelector('#card .ed-form') },
  ];
})(window);
