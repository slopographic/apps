/* SlopTour: Slop Code. Targets are ids in code/index.html. */
SlopTour.define({
  app: 'code',
  title: 'Slop Code tour',
  steps: [
    { id: 'open', title: 'Open', text: 'Open a file from Slop Drive (Ctrl+O). New starts a new one.', target: '#cd-open' },
    { id: 'new', title: 'New', text: 'Start a new file (Ctrl+Alt+N).', target: '#cd-new' },
    { id: 'save', title: 'Save', text: 'Save to the same Slop Drive file (Ctrl+S). Save as makes a copy.', target: '#cd-save' },
    { id: 'explorer', title: 'Explorer', text: 'Your files from Slop Drive, in folders. Open a file to edit it.', target: '#cd-tree' },
    { id: 'run', title: 'Run', text: 'Run the preview (Ctrl+Enter).', target: '#cd-run' },
    { id: 'commands', title: 'Commands', text: 'Search every command in Slop Code.', target: '#cd-cmd' },
  ],
});
