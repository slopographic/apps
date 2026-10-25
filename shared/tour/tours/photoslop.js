/* SlopTour: PhotoSlop. Targets are ids in photoslop/index.html. A button the top bar folds into More ▾ when it is narrow
 * (app/topbar-fit.js: .ps-fold) is pointed at through that menu: "#x:not(.ps-fold), #topMore" finds the button, else More ▾. */
SlopTour.define({
  app: 'photoslop',
  title: 'PhotoSlop tour',
  steps: [
    { id: 'new', title: 'Start a file', text: 'New sets the size, preset and background of a document (in More ▾ on a narrow window); Open loads a PSD, ORA or image. Each file gets a tab.', target: '#newBtn:not(.ps-fold), #topMore' },
    { id: 'menus', title: 'Menu bar', text: 'File, Edit, Image, Layer, Select and Filter live here. Each menu lists its commands.', target: '#menubar' },
    { id: 'tools', title: 'Tools', text: 'Brushes, selection, type and crop sit in the toolbox. Pick one, then set it up in the options bar.', target: '#toolbox' },
    { id: 'options', title: 'Tool options', text: 'The options bar changes with the active tool: size, opacity, blend mode and more.', target: '#options' },
    { id: 'canvas', title: 'The canvas', text: 'Paint, select and transform on the canvas. The status bar shows zoom and size.', target: '#viewport' },
    { id: 'panels', title: 'Layers and panels', text: 'Layers, history and properties live in this column. On a phone, the Layers button shows them.', target: '#panels' },
    { id: 'export', title: 'Export', text: 'Export PNG, JPEG, WebP or PSD. The file is made on your device; nothing is uploaded.', target: '#exportBtn' },
    { id: 'theme', title: 'Theme', text: 'Switch between Pro, Light and Paint ’98.', target: '#themeToggle:not(.ps-fold), #topMore' },
  ],
});
