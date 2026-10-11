/* SlopTour: Slop Paste. Targets are ids in paste/index.html. */
SlopTour.define({
  app: 'paste',
  title: 'Slop Paste tour',
  steps: [
    { id: 'new', title: 'New paste', text: 'Start a text paste. Ctrl+Alt+N does the same.', target: '#pb-new' },
    { id: 'search', title: 'Search', text: 'Search titles and text.', target: '#pb-q' },
    { id: 'image', title: 'Image paste', text: 'Add a paste that is an image.', target: '#pb-add-img' },
    { id: 'items', title: 'Your pastes', text: 'Each paste is saved to Slop Drive as you go.', target: '#pb-items' },
    { id: 'editor', title: 'Editor', text: 'Paste text, code or an image here, then copy or share it.', target: '#pb-main' },
    { id: 'commands', title: 'Commands', text: 'Search every command in Paste.', target: '#pb-cmd' },
  ],
});
