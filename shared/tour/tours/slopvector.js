/* SlopTour: SlopVector. Targets are ids in slopvector/index.html. */
SlopTour.define({
  app: 'vector',
  title: 'SlopVector tour',
  steps: [
    { id: 'menus', title: 'Menus', text: 'File, Edit, Object, Type and the other menus list every command.', target: '#menus' },
    { id: 'controls', title: 'Control bar', text: 'Options for the active tool or the selection appear here.', target: '#controlbar' },
    { id: 'tools', title: 'Tools', text: 'Pen, shapes, type and selection tools. Pick one, then draw on the artboard.', target: '#toolbar' },
    { id: 'artboard', title: 'Artboard', text: 'Draw here. Drag from the rulers to make guides.', target: '#workspace' },
    { id: 'panels', title: 'Panels', text: 'Layers and colour dock on the right. Tab shows or hides them.', target: '#dock' },
    { id: 'status', title: 'Status bar', text: 'Zoom and document details are shown at the bottom.', target: '#statusbar' },
  ],
});
