/* SlopTour: Slop Calendar. Targets are ids in calendar/index.html. */
(function () {
  /* The words are in the app's string tables (calendar/i18n/<code>/tour.js), read when the tour loads. */
  const T = (k) => (globalThis.SlopI18n ? globalThis.SlopI18n.t(k) : k);
  SlopTour.define({
    app: 'calendar',
    title: T('calendar.tour.title'),
    steps: [
      { id: 'period', title: T('calendar.tour.s_period'), text: T('calendar.tour.s_period_text'), target: '#cTitle' },
      { id: 'new', title: T('calendar.tour.s_new'), text: T('calendar.tour.s_new_text'), target: '#cNew' },
      { id: 'todos', title: T('calendar.tour.s_todos'), text: T('calendar.tour.s_todos_text'), target: '#cTasks' },
      { id: 'zone', title: T('calendar.tour.s_zone'), text: T('calendar.tour.s_zone_text'), target: '#cZone' },
      { id: 'ics', title: T('calendar.tour.s_ics'), text: T('calendar.tour.s_ics_text'), target: '#cExport' },
      { id: 'config', title: T('calendar.tour.s_config'), text: T('calendar.tour.s_config_text'), target: '#cConfig' },
    ],
  });
})();
