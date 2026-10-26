/* SlopTour: Slop Invoices. Targets are ids in invoices/index.html. */
(function () {
  /* The words are in the app's string tables (invoices/i18n/<code>/tour.js), read when the tour loads. */
  const T = (k) => (globalThis.SlopI18n ? globalThis.SlopI18n.t(k) : k);
  SlopTour.define({
    app: 'invoices',
    title: T('invoices.tour.title'),
    steps: [
      { id: 'search', title: T('invoices.tour.s_search'), text: T('invoices.tour.s_search_text'), target: '#iSearch' },
      { id: 'new', title: T('invoices.tour.s_new'), text: T('invoices.tour.s_new_text'), target: '#iNew' },
      { id: 'from-order', title: T('invoices.tour.s_from_order'), text: T('invoices.tour.s_from_order_text'), target: '#iFromOrder' },
      { id: 'outstanding', title: T('invoices.tour.s_outstanding'), text: T('invoices.tour.s_outstanding_text'), target: '#iOutstanding' },
      { id: 'list', title: T('invoices.tour.s_list'), text: T('invoices.tour.s_list_text'), target: '#view-list' },
      { id: 'data', title: T('invoices.tour.s_data'), text: T('invoices.tour.s_data_text'), target: '#tab-data' },
    ],
  });
})();
