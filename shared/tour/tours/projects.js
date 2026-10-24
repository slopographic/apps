/* SlopTour: Slop Projects. Targets are ids in projects/index.html. */
SlopTour.define({
  app: 'projects',
  title: 'Slop Projects tour',
  steps: [
    { id: 'pick', title: 'Your projects', text: 'Pick a project here. The Project menu has its settings, columns, backups and CSV.', target: '#pPick' },
    { id: 'views', title: 'Board, Timeline, List', text: 'Three views of the same tasks: columns, bars on dates, and a sortable table.', target: '#tab-board' },
    { id: 'find', title: 'Filters', text: 'Find a task by its text, or show one person or one tag.', target: '#fText' },
    { id: 'new', title: 'New task', text: 'Add a task with its dates, checklist and what it waits for.', target: '#pNew' },
    { id: 'board', title: 'The board', text: 'Drag cards between columns, or focus one and press Shift with an arrow. Ctrl+Z undoes.', target: '#board' },
  ],
});
