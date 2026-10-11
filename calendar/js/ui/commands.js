// Slop Calendar commands for SlopCmd (the palette and remappable keys). Plain letters work outside text fields. The keys
// are: arrows to move, t today, m, w, d, a for the views, n a new event, k to show or hide to-dos. Exposes window.SlopCal.commands.
(function (g) {
  'use strict';
  const NS = (g.SlopCal = g.SlopCal || {});
  const A = () => NS.app;
  const COMMANDS = [
    { id: 'cal.prev', title: 'Calendar: previous period', group: 'Calendar', keys: ['ArrowLeft'], keywords: ['back', 'earlier'], run: () => A().step(-1) },
    { id: 'cal.next', title: 'Calendar: next period', group: 'Calendar', keys: ['ArrowRight'], keywords: ['forward', 'later'], run: () => A().step(1) },
    { id: 'cal.today', title: 'Calendar: go to today', group: 'Calendar', keys: ['t'], run: () => A().goToday() },
    { id: 'cal.month', title: 'Calendar: month view', group: 'Calendar', keys: ['m'], run: () => A().setView('month') },
    { id: 'cal.week', title: 'Calendar: week view', group: 'Calendar', keys: ['w'], run: () => A().setView('week') },
    { id: 'cal.day', title: 'Calendar: day view', group: 'Calendar', keys: ['d'], run: () => A().setView('day') },
    { id: 'cal.agenda', title: 'Calendar: agenda', group: 'Calendar', keys: ['a'], run: () => A().setView('agenda') },
    { id: 'cal.new', title: 'Calendar: new event', group: 'Calendar', keys: ['n'], keywords: ['add', 'create', 'event'], run: () => A().newAt(NS.state.anchor, 9 * 60) },
    { id: 'cal.tasks', title: 'Calendar: show or hide to-dos', group: 'Calendar', keys: ['k'], keywords: ['task', 'todo', 'layer'], run: () => A().toggleTasks() },
    { id: 'cal.import', title: 'Calendar: import .ics', group: 'Calendar', keywords: ['ics', 'ical', 'load'], run: () => A().importIcs() },
    { id: 'cal.export', title: 'Calendar: export .ics', group: 'Calendar', keywords: ['ics', 'ical', 'download', 'save'], run: () => NS.ics.exportIcs() },
    { id: 'cal.todo', title: 'Go to Slop To-do', group: 'Go to', run: () => { location.href = '../todo/'; } },
    { id: 'cal.reminders', title: 'Go to Slop Reminders', group: 'Go to', run: () => { location.href = '../reminders/'; } },
    { id: 'cal.crm', title: 'Go to Slop CRM', group: 'Go to', run: () => { location.href = '../crm/#followups'; } },
  ];

  /** Registers the commands and starts SlopCmd for this app. Without SlopCmd the buttons still work. */
  function init() {
    if (!g.SlopCmd) return;
    g.SlopCmd.init({ app: 'calendar' });
    g.SlopCmd.register(COMMANDS);
  }

  NS.commands = { init, list: COMMANDS };
})(typeof window !== 'undefined' ? window : globalThis);
