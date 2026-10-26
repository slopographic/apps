/* SlopTour: Slop To-do. Targets are ids in todo/index.html. */
(function () {
  /* The words are in the app's string tables (todo/i18n/<code>/tour.js), read when the tour loads. */
  const T = (k) => (globalThis.SlopI18n ? globalThis.SlopI18n.t(k) : k);
  SlopTour.define({
    app: 'todo',
    title: T('todo.tour.title'),
    steps: [
      { id: 'lists', title: T('todo.tour.s_lists'), text: T('todo.tour.s_lists_text'), target: '#tSide' },
      { id: 'title', title: T('todo.tour.s_title'), text: T('todo.tour.s_title_text'), target: '#tTitle' },
      { id: 'add', title: T('todo.tour.s_add'), text: T('todo.tour.s_add_text'), target: '#tAdd' },
      { id: 'done', title: T('todo.tour.s_done'), text: T('todo.tour.s_done_text'), target: '#tDone' },
      { id: 'find', title: T('todo.tour.s_find'), text: T('todo.tour.s_find_text'), target: '#tSearch' },
      { id: 'tasks', title: T('todo.tour.s_tasks'), text: T('todo.tour.s_tasks_text'), target: '#tList' },
    ],
  });
})();
