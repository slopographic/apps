// Slop To-do commands for SlopCmd. Plain letters work outside text fields: t Today, u Upcoming, a All, n new task,
// f find, h show done. Exposes window.SlopTodo.commands.
(function (g) {
  'use strict';
  const NS = (g.SlopTodo = g.SlopTodo || {});
  const A = () => NS.app;
  const $ = (id) => document.getElementById(id);
  const COMMANDS = [
    { id: 'todo.today', title: 'To-do: Today', group: 'To-do', keys: ['t'], keywords: ['due', 'overdue'], run: () => A().setView('today') },
    { id: 'todo.upcoming', title: 'To-do: Upcoming', group: 'To-do', keys: ['u'], keywords: ['later', 'future'], run: () => A().setView('upcoming') },
    { id: 'todo.all', title: 'To-do: All tasks', group: 'To-do', keys: ['a'], run: () => A().setView('all') },
    { id: 'todo.new', title: 'To-do: new task', group: 'To-do', keys: ['n'], keywords: ['add', 'create'], run: () => $('tNew').click() },
    { id: 'todo.find', title: 'To-do: find a task', group: 'To-do', keys: ['f'], keywords: ['search', 'filter'], run: () => $('tSearch').focus() },
    { id: 'todo.done', title: 'To-do: show or hide done tasks', group: 'To-do', keys: ['h'], keywords: ['completed', 'finished'], run: () => { $('tDone').click(); } },
    { id: 'todo.calendar', title: 'Go to Slop Calendar', group: 'Go to', run: () => { location.href = '../calendar/'; } },
    { id: 'todo.reminders', title: 'Go to Slop Reminders', group: 'Go to', run: () => { location.href = '../reminders/'; } },
  ];

  /** Registers the commands with SlopCmd when it is loaded. */
  function init() {
    if (!g.SlopCmd) return;
    g.SlopCmd.init({ app: 'todo' });
    g.SlopCmd.register(COMMANDS);
  }

  NS.commands = { init, list: COMMANDS };
})(typeof window !== 'undefined' ? window : globalThis);
