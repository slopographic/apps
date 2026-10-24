// Slop Projects commands for SlopCmd (and the menu bar's data-cmd buttons). Plain letters work outside text fields:
// b Board, t Timeline, l List, n new task, f find, p project settings. Ctrl+Z undoes (SlopUndo). Exposes
// window.SlopProjects.commands.
(function (g) {
  'use strict';
  const NS = (g.SlopProjects = g.SlopProjects || {});
  const $ = (id) => document.getElementById(id);
  const has = () => !!NS.state.project;
  const LIST = [
    { id: 'projects.board', title: 'Projects: Board', group: 'Projects', keys: ['b'], keywords: ['kanban', 'columns', 'cards'], run: () => NS.app.go('board') },
    { id: 'projects.timeline', title: 'Projects: Timeline', group: 'Projects', keys: ['t'], keywords: ['gantt', 'schedule', 'dates'], run: () => NS.app.go('timeline') },
    { id: 'projects.list', title: 'Projects: List', group: 'Projects', keys: ['l'], keywords: ['table', 'sort'], run: () => NS.app.go('list') },
    { id: 'projects.newTask', title: 'Projects: new task', group: 'Projects', keys: ['n'], keywords: ['add', 'card'], when: has, run: () => NS.editor.open({}) },
    { id: 'projects.find', title: 'Projects: find a task', group: 'Projects', keys: ['f'], keywords: ['search', 'filter'], when: has, run: () => $('fText').focus() },
    { id: 'projects.editProject', title: 'Projects: project settings and columns', group: 'Projects', keys: ['p'], keywords: ['columns', 'people', 'wip'], when: has, run: () => NS.projectDialog.open() },
    { id: 'projects.newProject', title: 'Projects: new project', group: 'Projects', keys: [], run: () => NS.projectDialog.create() },
    { id: 'projects.exportJson', title: 'Projects: download backup (.json)', group: 'Projects', keys: [], keywords: ['export', 'save'], when: has, run: () => NS.files.exportJson() },
    { id: 'projects.exportCsv', title: 'Projects: download tasks (.csv)', group: 'Projects', keys: [], keywords: ['export', 'spreadsheet', 'excel'], when: has, run: () => NS.files.exportCsv() },
    { id: 'projects.import', title: 'Projects: open a project backup', group: 'Projects', keys: [], keywords: ['import', 'json'], run: () => NS.files.importFile() },
    { id: 'projects.sample', title: 'Projects: try a sample project', group: 'Projects', keys: [], keywords: ['demo', 'example'], run: () => NS.files.trySample() },
    { id: 'projects.undo', title: 'Projects: undo', group: 'Projects', keys: [], keywords: ['undo', 'back'], when: () => NS.actions.history.size > 0, run: () => NS.actions.undo() },
    { id: 'projects.crm', title: 'Go to Slop CRM', group: 'Go to', keys: [], run: () => { location.href = '../crm/'; } },
  ];

  /** Registers the commands with SlopCmd (SlopBiz.commands also runs the menu bar's data-cmd buttons), then again with
   *  their letters, which SlopBiz.commands leaves out. */
  function init() {
    g.SlopBiz.commands('projects', LIST);
    if (g.SlopCmd) g.SlopCmd.register(LIST.filter((c) => c.keys.length));
    if (NS.ai) NS.ai.init();   // the commands with arguments (ai-commands.js) for the palette, macros and the assistant
  }

  NS.commands = { init, list: LIST };
})(typeof window !== 'undefined' ? window : globalThis);
