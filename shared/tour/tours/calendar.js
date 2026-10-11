/* SlopTour: Slop Calendar. Targets are ids in calendar/index.html. */
SlopTour.define({
  app: 'calendar',
  title: 'Slop Calendar tour',
  steps: [
    { id: 'period', title: 'Period', text: 'The period you are viewing. The arrows move through time; Today jumps back.', target: '#cTitle' },
    { id: 'new', title: 'New event', text: 'Add an event. N starts a new one.', target: '#cNew' },
    { id: 'todos', title: 'To-dos', text: 'Tick To-dos to show your tasks on the calendar too.', target: '#cTasks' },
    { id: 'zone', title: 'Time zone', text: 'Choose the time zone that times are shown in.', target: '#cZone' },
    { id: 'ics', title: 'Import and export', text: 'Import .ics brings events in. Export .ics shares them with other calendars.', target: '#cExport' },
    { id: 'config', title: 'Config', text: 'Calendar settings and the export and import options.', target: '#cConfig' },
  ],
});
