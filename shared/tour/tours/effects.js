/* SlopTour: Slop Effects. Targets are ids in effects/index.html. */
SlopTour.define({
  app: 'effects',
  title: 'Slop Effects tour',
  steps: [
    { id: 'preview', title: 'Preview', text: 'Your composition plays here. The transport below plays and stops it.', target: '#fx-view' },
    { id: 'composition', title: 'Composition', text: 'Settings for the whole composition.', target: '#fx-comp' },
    { id: 'layer', title: 'Layers', text: 'Add and arrange the layers that make up the composition.', target: '#fx-layer' },
    { id: 'timeline', title: 'Timeline', text: 'Each layer is a bar across time. Select one to change its keyframes.', target: '#fx-timeline' },
    { id: 'panel', title: 'Effects panel', text: 'Effects and properties for the selected layer, in tabs.', target: '#fx-panel' },
    { id: 'render', title: 'Render', text: 'Render the composition to a video file.', target: '#fx-render' },
  ],
});
