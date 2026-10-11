/* SlopTour: Slop Notes. Targets are ids in notes/index.html. */
SlopTour.define({
  app: 'notes',
  title: 'Slop Notes tour',
  steps: [
    { id: 'notebooks', title: 'Notebooks', text: 'Notebooks, folders and tags organise your notes.', target: '#nt-side' },
    { id: 'new', title: 'New note', text: 'Start a note. Ctrl+Alt+N does the same.', target: '#nt-new' },
    { id: 'search', title: 'Search', text: 'Search titles, text and tags.', target: '#nt-q' },
    { id: 'list', title: 'Note list', text: 'Your notes. Pick one to open it in the editor.', target: '#nt-notes' },
    { id: 'editor', title: 'Editor', text: 'Write here. The status line shows when the note was saved.', target: '#nt-main' },
    { id: 'commands', title: 'Commands', text: 'Search every command in Notes.', target: '#nt-cmd' },
  ],
});
