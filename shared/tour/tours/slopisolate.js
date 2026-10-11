/* SlopTour: Slop Isolate (the slopisolate folder). Targets are ids in slopisolate/index.html. */
SlopTour.define({
  app: 'slopisolate',
  title: 'Slop Isolate tour',
  steps: [
    { id: 'stage', title: 'Your image', text: 'Your image and the result. Drag the divider to compare before and after.', target: '#stage' },
    { id: 'undo', title: 'Undo and redo', text: 'Undo and redo are in the top bar.', target: '#btnUndo' },
    { id: 'settings', title: 'Settings', text: 'Replace the background with a colour, blur or image, and set the edge softness.', target: '#props' },
    { id: 'download', title: 'Download', text: 'Save the result as a file. Nothing leaves your device.', target: '#btnDownload' },
  ],
});
