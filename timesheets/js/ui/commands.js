// Slop Timesheets commands (the palette and [data-cmd] buttons), through SlopBiz.commands (shared/biz/biz.js).
(function (g) {
  'use strict';
  const NS = (g.SlopTimesheets = g.SlopTimesheets || {});
  const editing = () => !!(NS.editor && NS.editor.current()) && location.hash.startsWith('#t/');
  const COMMANDS = [
    { id: 'view.list', title: 'Go to Time', group: 'Go to', run: () => NS.app.go('list') },
    { id: 'view.bill', title: 'Go to Bill (make an invoice from time)', group: 'Go to', keywords: ['invoice', 'billing'], run: () => NS.app.go('bill') },
    { id: 'time.new', title: 'Time: log time', group: 'Time', keywords: ['add', 'hours', 'entry'], run: () => NS.app.go('new') },
    { id: 'time.timer', title: 'Time: start or stop the timer', group: 'Time', keywords: ['clock', 'track', 'stopwatch'],
      run: () => { if (NS.timer.running()) NS.timer.stop(); else { NS.app.go('list'); NS.timer.start(); } } },
    { id: 'time.csv', title: 'Time: download CSV of what is shown', group: 'Time', keywords: ['export', 'spreadsheet', 'report'], run: () => NS.listView.downloadCsv() },
    { id: 'entry.copy', title: 'Entry: log again today', group: 'Entry', when: editing, run: () => NS.app.go(`new/${NS.editor.current().id}`) },
    { id: 'entry.delete', title: 'Entry: delete…', group: 'Entry', when: () => editing() && NS.editor.current().state !== 'billed', run: () => NS.editor.remove() },
  ];
  NS.commands = { init: () => { NS.commands.run = g.SlopBiz.commands('timesheets', COMMANDS); }, list: COMMANDS };
})(typeof window !== 'undefined' ? window : globalThis);
