/* SlopTour: Slop Gallery. Targets are ids in gallery/index.html. */
SlopTour.define({
  app: 'gallery',
  title: 'Slop Gallery tour',
  steps: [
    { id: 'import', title: 'Import', text: 'Import photos from this device (Ctrl+O).', target: '#topImport' },
    { id: 'library', title: 'Library', text: 'Views, albums and filters. On a phone, Filters opens this drawer.', target: '#side' },
    { id: 'views', title: 'Views', text: 'Photos, favourites and duplicates.', target: '#sideNav' },
    { id: 'grid', title: 'Photos', text: 'Your photos. Use Select to pick several at once.', target: '#grid' },
    { id: 'duplicates', title: 'Duplicates', text: 'Find duplicate photos and review them.', target: '#btnDupes' },
    { id: 'backup', title: 'Backup', text: 'Back up the whole library, or restore it.', target: '#btnBackup' },
  ],
});
