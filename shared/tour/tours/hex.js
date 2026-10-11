/* SlopTour: Slop Hex. Targets are ids in hex/index.html. */
SlopTour.define({
  app: 'hex',
  title: 'Slop Hex tour',
  steps: [
    { id: 'open', title: 'Open', text: 'Open a file from this computer (Ctrl+O), or drop one on the window.', target: '#hx-open' },
    { id: 'name', title: 'File name', text: 'The file you have open.', target: '#hx-name' },
    { id: 'bytes', title: 'Bytes', text: 'The bytes in hex, with the text beside them. Scroll to move through the file.', target: '#hx-main' },
    { id: 'goto', title: 'Go to offset', text: 'Type an offset, such as 0x4D2, to jump to it.', target: '#hx-goto' },
    { id: 'find', title: 'Find', text: 'Find bytes, such as 4D 5A, or text. F3 finds the next match.', target: '#hx-q' },
    { id: 'status', title: 'Status', text: 'Messages from your last action appear here.', target: '#hx-status' },
  ],
});
