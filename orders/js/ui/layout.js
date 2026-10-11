/* Slop Orders: workspace layouts (shared/layouts). While an order is open (the edit view), the list sits on the
   left and the document on the right. The list and the document show with the router's own hidden flags.
   Below 720 px the layout steps aside and the one-view-at-a-time screens apply, unchanged. Classic script. */
(function () {
  'use strict';
  if (!window.SlopLayouts) return;
  const NS = window.SlopOrders, $ = (id) => document.getElementById(id);
  /** Shows or hides a view. Showing the list redraws it: it skips drawing while hidden. */
  function setView(id, on) {
    const el = $(id);
    if (el.hidden === !on) return;
    el.hidden = !on;
    if (on && id === 'view-list' && NS.views && NS.views.list) NS.views.list.refresh();
  }
  SlopLayouts.mount({
    app: 'orders',
    root: $('main'),
    phone: '(max-width: 720px)',
    active: () => !!NS.state && NS.state.view === 'edit',
    release: () => { $('view-list').hidden = NS.state.view !== 'list'; $('view-edit').hidden = NS.state.view !== 'edit'; },
    panels: {
      list: { el: $('view-list'), show: (on) => setView('view-list', on) },
      document: { el: $('view-edit'), show: (on) => setView('view-edit', on) },
    },
  });
})();
