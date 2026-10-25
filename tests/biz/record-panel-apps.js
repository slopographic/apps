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
  g.RECORD_PANEL_APPS = [
    docApp('Slop Invoices', 'invoices/index.html', 'SlopInvoices'),
    docApp('Slop Orders', 'orders/index.html', 'SlopOrders'),
    docApp('Slop Quotes', 'quotes/index.html', 'SlopQuotes'),
    docApp('Slop Purchases', 'purchases/index.html', 'SlopPurchases'),
  ];
})(window);
