/* SlopTour: Slop To-do. Targets are ids in todo/index.html. */
SlopTour.define({
  app: 'todo',
  title: 'Slop To-do tour',
  steps: [
    { id: 'lists', title: 'Views and lists', text: 'Pick a view or a list on the left to see its tasks.', target: '#tSide' },
    { id: 'title', title: 'Current list', text: 'The name of the list you are looking at.', target: '#tTitle' },
    { id: 'add', title: 'Add a task', text: 'Type a task and press Enter. Details… adds notes and a date.', target: '#tAdd' },
    { id: 'done', title: 'Show done', text: 'Tick Show done to see finished tasks as well.', target: '#tDone' },
    { id: 'find', title: 'Find', text: 'Find a task by its text.', target: '#tSearch' },
    { id: 'tasks', title: 'Tasks', text: 'Tick a task to complete it.', target: '#tList' },
  ],
});
