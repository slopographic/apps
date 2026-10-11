/* SlopTour: Slop Slides. Targets are ids in slides/index.html. */
SlopTour.define({
  app: 'slides',
  title: 'Slop Slides tour',
  steps: [
    { id: 'list', title: 'Slides', text: 'Your slides in order. Add, duplicate, delete and move them under the list.', target: '#slides-list' },
    { id: 'insert', title: 'Insert', text: 'Add text, a rectangle, an ellipse or a picture to the slide.', target: '#insText' },
    { id: 'stage', title: 'Slide', text: 'Edit the slide here. Click an object to select it and change it in the inspector.', target: '#stage' },
    { id: 'layout', title: 'Layout', text: 'Change the layout of the selected slide.', target: '#selLayout' },
    { id: 'theme', title: 'Theme', text: 'Pick a theme for the whole presentation.', target: '#selTheme' },
    { id: 'present', title: 'Present', text: 'Play the slides full screen.', target: '#btnPresent' },
  ],
});
