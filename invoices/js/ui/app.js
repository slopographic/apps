// Slop Invoices boot: the shared document routes (shared/docs/doc-app.js: list, new, i/<id>, data) plus p/<id>, the print
// view, and repeat (the repeating schedules). The invoice and print tabs show only while one is open; the list beside an open invoice marks its row; the top bar
// has New invoice, Save (a draft) and Print.
(function (g) {
  'use strict';
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const $ = (id) => document.getElementById(id);

  /** The print view's route, p/<id>. */
  const more = (h) => (h === 'repeat' ? { view: 'repeat' } : h.startsWith('p/') && h.length > 2 ? { view: 'print', arg: h.slice(2) } : null);

  /** After a view shows: the print tab, the view name on the page (for the print rules), and the list's selected row. */
  function after(t, shown) {
    $('tab-print').hidden = t.view !== 'print';
    document.querySelector('.app').dataset.view = t.view;
    if (NS.views.list && !$('view-list').hidden) Promise.resolve(shown).then(() => NS.views.list.refresh());
    if (t.view === 'list') NS.repeat.dueNotice();
  }

  /** The top bar's actions: New invoice (list), Save (a draft open) and Print (an invoice open or its print view). */
  function mount() {
    $('tbNew').addEventListener('click', () => NS.app.go('new'));
    $('tbSave').addEventListener('click', () => NS.editor.save());
    $('tbPrint').addEventListener('click', () => (NS.state.view === 'edit' ? NS.editor.preview() : window.print()));
  }

  // a tab click or the tab keys route through the #hash; the print tab stays on its invoice
  const tabRoute = (n) => (n === 'edit' ? NS.editor.route() : n === 'print' ? location.hash.slice(1) : n);

  g.SlopDocs.docApp.start({ ns: NS, app: 'invoices', route: 'i', noun: 'invoice', more, after, mount, tabRoute });
})(typeof window !== 'undefined' ? window : globalThis);
