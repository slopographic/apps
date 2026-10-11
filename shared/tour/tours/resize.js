/* SlopTour: Slop Resize. Targets are ids in resize/index.html. */
SlopTour.define({
  app: 'resize',
  title: 'Slop Resize tour',
  steps: [
    { id: 'open', title: 'Open', text: 'Add pictures from this computer, or from Slop Drive.', target: '#rs-open' },
    { id: 'drop', title: 'Drop zone', text: 'You can also drop pictures onto the page.', target: '#rs-drop' },
    { id: 'preset', title: 'Presets', text: 'Pick a preset to fill in the size fields.', target: '#rs-preset' },
    { id: 'mode', title: 'Mode', text: 'Resize by width and height, by percentage, by long edge, or to a maximum file size.', target: '#rs-mode' },
    { id: 'run', title: 'Resize all', text: 'Resize every file in the queue. Ctrl+Enter does the same.', target: '#rs-run' },
    { id: 'download', title: 'Download', text: 'Download all results as one zip, or save them to Slop Drive.', target: '#rs-zip' },
  ],
});
