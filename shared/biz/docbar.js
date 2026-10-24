// SlopBiz.docbar: the bar of an open record in every business app (an invoice, an order, a quote, a purchase order, an
// expense, a time entry). The app's tabs are its sections and never change; a record opens in a view of its own, and this
// bar sits above it: "‹ Invoices" back to the list, the record's name and status, and the record's own actions on the right
// (Save, Print, Statement). Actions for the whole app (New invoice) stay in the menu bar. Classic script; SlopBiz.router
// shows and hides the bar: the views whose tabs are hidden in the page (edit, print, statement) are record views.
//   SlopBiz.docbar.mount({ back: 'list', title: '#eTitle', status: '#eStatus', actions: ['#tbSave', '#tbPrint'] })
//     back      the view the back button goes to (its tab's text is the button's label)        default 'list'
//     title     the editor's heading, which the app fills with the record's name (moved in), shown on `views`;
//               on other record views the bar shows the view's label                           default '#eTitle'
//     views     the views that show `title`                                                       default ['edit']
//     status    the editor's status chip (moved in)                                               default '#eStatus'
//     actions   the app's own buttons for the record, moved in as they are                        optional
//   The editor's own header row (.head-row: its back button, heading and chip) is hidden: the bar replaces it.
//   SlopBiz.docbar.show(on, label, view)   the router: on a record view or not, the view's label and name
(function (g) {
  'use strict';
  const B = (g.SlopBiz = g.SlopBiz || {});
  const $ = (sel) => (typeof sel === 'string' ? document.querySelector(sel) : sel || null);
  let bar = null, label = null, own = null, status = null, ownViews = ['edit'];

  function mount(o) {
    const opts = o || {};
    if (bar) return bar;
    const back = opts.back || 'list';
    const tab = document.getElementById('tab-' + back);
    bar = document.createElement('div');
    bar.className = 'biz-docbar no-print';
    bar.hidden = true;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'biz-back';
    b.innerHTML = '<span aria-hidden="true">‹</span> ';
    b.append(tab ? tab.textContent.trim() : 'Back');
    b.setAttribute('aria-label', 'Back to ' + (tab ? tab.textContent.trim() : 'the list'));
    b.addEventListener('click', () => { location.hash = back; });
    const name = document.createElement('div');
    name.className = 'biz-doc-name';
    own = $(opts.title || '#eTitle');
    const row = own && own.closest('.head-row');
    if (row) row.hidden = true;   // its back button and heading are the bar's now
    ownViews = opts.views || ['edit'];
    label = document.createElement('b');
    label.className = 'biz-doc-title';
    name.append(label);
    if (own) { own.classList.add('biz-doc-title'); name.append(own); }
    status = $(opts.status || '#eStatus');
    if (status) name.append(status);
    const acts = document.createElement('div');
    acts.className = 'biz-doc-actions';
    for (const sel of opts.actions || []) { const n = $(sel); if (n) acts.append(n); }
    bar.append(b, name, acts);
    const tabs = document.querySelector('.tabs');
    if (tabs) tabs.after(bar); else document.body.prepend(bar);
    return bar;
  }

  /** The app's title shows on its own views (opts.views, default the edit view); other record views show their label. */
  function show(on, text, view) {
    if (!bar) mount();
    bar.hidden = !on;
    if (!on) return;
    const mine = !!own && ownViews.includes(view);
    label.textContent = text || '';
    label.hidden = mine;
    if (own) own.hidden = !mine;
    if (status) status.hidden = !mine;
    bar.dataset.view = view || '';
  }

  B.docbar = { mount, show, get element() { return bar; } };
})(typeof window !== 'undefined' ? window : globalThis);
