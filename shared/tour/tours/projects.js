/* SlopTour: Slop Projects. Targets are ids in projects/index.html. */
(function () {
  /* The words are in the app's string tables (projects/i18n/<code>/tour.js), read when the tour loads. */
  const T = (k) => (globalThis.SlopI18n ? globalThis.SlopI18n.t(k) : k);
  SlopTour.define({
    app: 'projects',
    title: T('projects.tour.title'),
    steps: [
      { id: 'pick', title: T('projects.tour.s_pick'), text: T('projects.tour.s_pick_text'), target: '#pPick' },
      { id: 'views', title: T('projects.tour.s_views'), text: T('projects.tour.s_views_text'), target: '#tab-board' },
      { id: 'find', title: T('projects.tour.s_find'), text: T('projects.tour.s_find_text'), target: '#fText' },
      { id: 'new', title: T('projects.tour.s_new'), text: T('projects.tour.s_new_text'), target: '#pNew' },
      { id: 'board', title: T('projects.tour.s_board'), text: T('projects.tour.s_board_text'), target: '#board' },
    ],
  });
})();
