/* SlopTour: Slop Orders. Targets are ids in orders/index.html. */
(function () {
  /* The words are in the app's string tables (orders/i18n/<code>/tour.js), read when the tour loads. */
  const T = (k) => (globalThis.SlopI18n ? globalThis.SlopI18n.t(k) : k);
  SlopTour.define({
    app: 'orders',
    title: T('orders.tour.title'),
    steps: [
      { id: 'search', title: T('orders.tour.s_search'), text: T('orders.tour.s_search_text'), target: '#oSearch' },
      { id: 'new', title: T('orders.tour.s_new'), text: T('orders.tour.s_new_text'), target: '#oNew' },
      { id: 'status', title: T('orders.tour.s_status'), text: T('orders.tour.s_status_text'), target: '#oStatus' },
      { id: 'list', title: T('orders.tour.s_list'), text: T('orders.tour.s_list_text'), target: '#view-list' },
      { id: 'summary', title: T('orders.tour.s_summary'), text: T('orders.tour.s_summary_text'), target: '#oSummary' },
      { id: 'samples', title: T('orders.tour.s_samples'), text: T('orders.tour.s_samples_text'), target: '#oSamples' },
    ],
  });
})();
