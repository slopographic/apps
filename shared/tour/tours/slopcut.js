/* SlopTour: Slop Cut (the slopcut folder). Targets are ids in slopcut/index.html. */
SlopTour.define({
  app: 'slopcut',
  title: 'Slop Cut tour',
  steps: [
    { id: 'bin', title: 'Media bin', text: 'Your clips, music and effects. Drag them onto the timeline to build the cut.', target: '#bin' },
    { id: 'monitor', title: 'Program monitor', text: 'Shows the cut as it plays. Space plays and pauses.', target: '#monitor' },
    { id: 'inspector', title: 'Inspector', text: 'Settings for the selected clip. Select a clip on the timeline to change it.', target: '#insp' },
    { id: 'timeline', title: 'Timeline', text: 'Clips sit on tracks. S splits at the playhead; arrows step frame by frame.', target: '#timeline' },
    { id: 'undo', title: 'Undo and redo', text: 'Undo and redo are in the top bar, next to the project name.', target: '#btnUndo' },
    { id: 'export', title: 'Export', text: 'Export the finished cut as a video file.', target: '#btnExport' },
  ],
});
