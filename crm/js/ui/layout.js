/* Slop CRM: workspace layouts (shared/layouts). When the customer list and a customer's record are both on screen
   (the wide split), the layout sets their widths: the list on the left, the record on the right. Below 960 px the
   one-view-at-a-time screens apply, unchanged. Classic script. */
(function () {
  'use strict';
  if (!window.SlopLayouts) return;
  const NS = window.SlopCrm, $ = (id) => document.getElementById(id);
  /** Shows or hides a view; showing one redraws it, as the split would have. */
  function setView(id, name, on) {
    const el = $(id);
    if (el.hidden === !on) return;
    el.hidden = !on;
    if (on && NS.app && NS.app.refreshSoon) NS.app.refreshSoon();
  }
  SlopLayouts.mount({
    app: 'crm',
    root: $('main'),
    phone: '(max-width: 959px)',
    active: () => !!NS.state && !!NS.state.split,
    release: () => { const v = NS.state.view; $('view-customers').hidden = !(v === 'customers' || NS.state.split); $('view-customer').hidden = v !== 'customer' && !NS.state.split; },
    panels: {
      list: { el: $('view-customers'), show: (on) => setView('view-customers', 'customers', on) },
      detail: { el: $('view-customer'), show: (on) => setView('view-customer', 'customer', on) },
    },
  });
})();
