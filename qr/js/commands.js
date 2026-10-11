/* QR SLOP: SlopCmd commands. Registers the actions of the single code and the batch view, and the Commands button.
 * Classic script; exposes window.QRCommands. */
(function () {
  'use strict';
  if (window.QRCommands) return;
  const A = () => window.QRApp;
  const ready = () => !!A().last();

  function commandList() {
    const C = (id, title, group, extra = {}) => Object.assign({ id: 'qr.' + id, title, group, keys: [], run: () => {} }, extra);
    return [
      C('copy', 'Copy encoded text', 'Code', { keywords: ['clipboard', 'payload', 'text'], when: ready, run: () => A().copyText() }),
      C('svg', 'Download as SVG', 'Code', { keywords: ['vector', 'save'], when: ready, run: () => A().downloadSvg() }),
      C('png', 'Download as PNG', 'Code', { keywords: ['picture', 'image', 'save', 'transparent'], when: ready, run: () => A().downloadPng() }),
      C('single', 'Show a single code', 'View', { keywords: ['form', 'one'], run: () => A().setMode('single') }),
      C('batch', 'Show the batch grid', 'View', { keywords: ['many', 'lines', 'list'], run: () => A().setMode('batch') }),
    ];
  }

  function register() {
    if (!window.SlopCmd) return;
    SlopCmd.init({ app: 'qr' });
    SlopCmd.register(commandList());
  }

  window.QRCommands = { register, commandList };
})();
