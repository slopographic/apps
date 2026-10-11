/* SlopTour: Slop Upscale. Targets are ids in upscale/index.html. */
SlopTour.define({
  app: 'upscale',
  title: 'Slop Upscale tour',
  steps: [
    { id: 'open', title: 'Open', text: 'Open a picture or video from this computer, or from Slop Drive.', target: '#up-open' },
    { id: 'picture', title: 'Picture', text: 'Your picture appears here, before and after upscaling.', target: '#up-stage-wrap' },
    { id: 'scale', title: 'Scale', text: 'Choose 2× or 4×.', target: '#up-scale-2' },
    { id: 'model', title: 'Model', text: 'The AI model does the upscaling. Its note says what it is best at.', target: '#up-model' },
    { id: 'format', title: 'Format', text: 'Pick the output format. Quality appears for formats that compress.', target: '#up-format' },
    { id: 'run', title: 'Upscale', text: 'Run the upscale. Esc stops it.', target: '#up-run' },
  ],
});
