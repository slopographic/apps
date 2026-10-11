/* SlopTour: Slop Isolate (the slopisolate folder). Targets are ids in slopisolate/index.html. */
SlopTour.define({
  app: 'slopisolate',
  title: 'Slop Isolate tour',
  steps: [
    { id: 'queue', title: 'Image list', text: 'Every image you open is listed here. Click one to work on it.', target: '#queue' },
    { id: 'tools', title: 'Tools', text: 'Refine the edge with the brush and soft-edge tools for the selected image.', target: '#ctxbar' },
    { id: 'stage', title: 'Preview', text: 'Your image and the result. Drag the divider to compare before and after.', target: '#stage' },
    { id: 'settings', title: 'Settings', text: 'Replace the background with a colour, blur or image, and set the edge softness.', target: '#props' },
    { id: 'download', title: 'Download', text: 'Save the result as a file. Nothing leaves your device.', target: '#btnDownload' },
  ],
});
