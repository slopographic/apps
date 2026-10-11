/* SlopTour: PhotoSlop. Targets are ids in photoslop/index.html. */
SlopTour.define({
  app: 'photoslop',
  title: 'PhotoSlop tour',
  steps: [
    { id: 'menus', title: 'Menu bar', text: 'File, Edit, Image, Layer, Select and Filter live here. Each menu lists its commands.', target: '#menubar' },
    { id: 'tools', title: 'Tools', text: 'Brushes, selection, type and crop sit in the toolbox. Pick one, then set it up in the options bar.', target: '#toolbox' },
    { id: 'options', title: 'Tool options', text: 'The options bar changes with the active tool: size, opacity, blend mode and more.', target: '#options' },
    { id: 'canvas', title: 'The canvas', text: 'Paint, select and transform on the canvas. The status bar shows zoom and size.', target: '#viewport' },
    { id: 'tabs', title: 'Open documents', text: 'Each open file gets a tab. Drop a file on the canvas to place it as a layer.', target: '#tabs' },
    { id: 'panels', title: 'Layers and panels', text: 'Layers, history and properties live in this column. On a phone, the Layers button shows them.', target: '#panels' },
    { id: 'export', title: 'Export', text: 'Export PNG, JPEG, WebP or PSD. The file is made on your device; nothing is uploaded.', target: '#exportBtn' },
    { id: 'theme', title: 'Theme', text: 'Switch between Pro, Light and Paint ’98.', target: '#themeToggle' },
  ],
});
