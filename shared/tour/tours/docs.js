/* SlopTour: Slop Docs. Targets are ids in docs/index.html. */
SlopTour.define({
  app: 'docs',
  title: 'Slop Docs tour',
  steps: [
    { id: 'name', title: 'Document name', text: 'Rename the document here.', target: '#docName' },
    { id: 'menus', title: 'Menus', text: 'File, Edit, Insert and the other menus.', target: '#menus' },
    { id: 'formatting', title: 'Formatting', text: 'Font, size, bold and the other controls apply to the selected text.', target: '#toolbar' },
    { id: 'style', title: 'Paragraph style', text: 'Headings and body styles for the paragraph you are in.', target: '#selStyle' },
    { id: 'page', title: 'Page', text: 'Your pages. Type straight onto them.', target: '#stage' },
    { id: 'save', title: 'Save', text: 'Save to Slop Drive (Ctrl+S).', target: '#btnSave' },
  ],
});
