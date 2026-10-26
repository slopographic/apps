/* SlopTour: Slop CRM. Targets are ids in crm/index.html. */
(function () {
  /* The words are in the app's string tables (crm/i18n/<code>/tour.js), read when the tour loads. */
  const T = (k) => (globalThis.SlopI18n ? globalThis.SlopI18n.t(k) : k);
  SlopTour.define({
    app: 'crm',
    title: T('crm.tour.title'),
    steps: [
      { id: 'views', title: T('crm.tour.s_views'), text: T('crm.tour.s_views_text'), target: '#tab-customers' },
      { id: 'search', title: T('crm.tour.s_search'), text: T('crm.tour.s_search_text'), target: '#cSearch' },
      { id: 'stage', title: T('crm.tour.s_stage'), text: T('crm.tour.s_stage_text'), target: '#cStage' },
      { id: 'groups', title: T('crm.tour.s_groups'), text: T('crm.tour.s_groups_text'), target: '#cSide' },
      { id: 'pipeline', title: T('crm.tour.s_pipeline'), text: T('crm.tour.s_pipeline_text'), target: '#tab-pipeline' },
      { id: 'import', title: T('crm.tour.s_import'), text: T('crm.tour.s_import_text'), target: '#cImport' },
    ],
  });
})();
