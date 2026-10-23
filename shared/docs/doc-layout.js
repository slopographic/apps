/* The workspace layout the document apps share (shared/layouts): while a document is open (the edit view), the list sits
   on the left and the document on the right, each shown with the router's own hidden flags. Below 720 px the layout steps
   aside and the one-view-at-a-time screens apply, unchanged. SlopDocs.docLayout.mount(ns, app). Classic script. */
(function (g) {
  'use strict';
  const D = (g.SlopDocs = g.SlopDocs || {});

  function mount(NS, app) {
    if (!g.SlopLayouts) return;
    const $ = (id) => document.getElementById(id);
    /** Shows or hides a view. Showing the list redraws it: it skips drawing while hidden. */
    function setView(id, on) {
      const el = $(id);
      if (el.hidden === !on) return;
      el.hidden = !on;
      if (on && id === 'view-list' && NS.views && NS.views.list) NS.views.list.refresh();
    }
    g.SlopLayouts.mount({
      app, root: $('main'), phone: '(max-width: 720px)',
      active: () => !!NS.state && NS.state.view === 'edit',
      release: () => { $('view-list').hidden = NS.state.view !== 'list'; $('view-edit').hidden = NS.state.view !== 'edit'; },
      panels: {
        list: { el: $('view-list'), show: (on) => setView('view-list', on) },
        document: { el: $('view-edit'), show: (on) => setView('view-edit', on) },
      },
    });
  }

  D.docLayout = { mount };
})(typeof window !== 'undefined' ? window : globalThis);
