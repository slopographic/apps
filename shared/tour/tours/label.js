/* SlopTour: Slop Label. Targets are ids in label/index.html. */
SlopTour.define({
  app: 'label',
  title: 'Slop Label tour',
  steps: [
    { id: 'setup', title: 'Label setup', text: 'Choose the label size: a sheet or a thermal roll.', target: '#cbLabel' },
    { id: 'tools', title: 'Tools', text: 'Add text, barcodes, shapes and images to the label.', target: '#toolbox' },
    { id: 'label', title: 'Your label', text: 'Click an object to select it, then drag it into place.', target: '#workspace' },
    { id: 'zoom', title: 'Zoom', text: 'Fit the label to the window with Ctrl+0.', target: '#zoomVal' },
    { id: 'panels', title: 'Panels', text: 'Properties and data panels. On a phone, the ☰ button opens them.', target: '#dock' },
    { id: 'print', title: 'Print', text: 'Print the labels (Ctrl+P).', target: '#btnPrint' },
  ],
});
