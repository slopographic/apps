/* SlopTour: Slop Tables. Targets are ids in tables/index.html. */
SlopTour.define({
  app: 'tables',
  title: 'Slop Tables tour',
  steps: [
    { id: 'namebox', title: 'Name box', text: 'Shows the address of the selected cell. Type an address to jump to it.', target: '#namebox' },
    { id: 'formula', title: 'Formula bar', text: 'Type a value, or a formula that starts with =.', target: '#fx' },
    { id: 'grid', title: 'Cells', text: 'Click a cell, or drag across cells to select them.', target: '#grid' },
    { id: 'format', title: 'Number format', text: 'Choose how numbers are shown: currency, percent, dates and more.', target: '#nf' },
    { id: 'side', title: 'Sheets and templates', text: 'Sheets, templates and the function list. The arrow button hides this sidebar.', target: '#side' },
    { id: 'save', title: 'Save', text: 'Save to Slop Drive (Ctrl+S).', target: '#btnSave' },
  ],
});
