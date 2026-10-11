/* QR SLOP: SlopCmd commands. Drive, the buffer, the code's downloads and the tabs. Classic script; exposes window.QRCommands. */
(function () {
  'use strict';
  if (window.QRCommands) return;
  const A = () => window.QRApp;
  const ready = () => !!A().last();

  function commandList() {
    const C = (id, title, group, extra = {}) => Object.assign({ id: 'qr.' + id, title, group, keys: [], run: () => {} }, extra);
    const tabs = [['templates', 'Templates'], ['content', 'Content'], ['design', 'Design'], ['logo', 'Logo'], ['raw', 'Raw text'], ['batch', 'Batch']];
    return [
      C('save', 'Save to Slop Drive', 'Drive', { keywords: ['store', 'drive', 'settings', 'png'], when: ready, run: () => A().saveDrive() }),
      C('open', 'Open from Slop Drive', 'Drive', { keywords: ['load', 'restore', 'edit again'], run: () => A().openDrive() }),
      C('buffer', 'Copy to buffer', 'Code', { keywords: ['clipboard', 'paste', 'drag', 'share'], when: ready, run: () => A().toBuffer() }),
      C('copy', 'Copy encoded text', 'Code', { keywords: ['clipboard', 'payload', 'text'], when: ready, run: () => A().copyText() }),
      C('svg', 'Download as SVG', 'Code', { keywords: ['vector', 'save'], when: ready, run: () => A().downloadSvg() }),
      C('png', 'Download as PNG', 'Code', { keywords: ['picture', 'image', 'save', 'transparent'], when: ready, run: () => A().downloadPng() }),
      C('pdf', 'Download print page (PDF)', 'Code', { keywords: ['print', 'pdf', 'page'], when: ready, run: () => A().downloadPdf() }),
      ...tabs.map(([k, name]) => C('tab-' + k, 'Show ' + name, 'View', { keywords: ['tab', 'panel', 'show'], run: () => A().setTab(k) })),
    ];
  }

  function register() {
    if (!window.SlopCmd) return;
    SlopCmd.init({ app: 'qr' });
    SlopCmd.register(commandList());
  }

  window.QRCommands = { register, commandList };
})();
