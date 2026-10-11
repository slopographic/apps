/* SlopTour: Slop Drive. Targets are ids in drive/index.html. */
SlopTour.define({
  app: 'drive',
  title: 'Slop Drive tour',
  steps: [
    { id: 'places', title: 'Places and folders', text: 'Your places, folder tree and tags. Pick a folder to open it.', target: '#side' },
    { id: 'search', title: 'Search', text: 'Find files by name across Slop Drive.', target: '#search' },
    { id: 'new', title: 'New', text: 'The New button adds a folder or a file to the folder you are in.', target: '#btnNew' },
    { id: 'files', title: 'Files', text: 'Select a file to see its details or send it to another app.', target: '#pane' },
    { id: 'info', title: 'Info panel', text: 'Shows the details of the selected file. Press I to toggle it.', target: '#btnInfo' },
    { id: 'backup', title: 'Backup', text: 'Back up or restore everything in Slop Drive.', target: '#btnBackup' },
  ],
});
