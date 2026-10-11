/* QR SLOP: boot. Builds the single view and the batch view, wires the Commands button, registers the SlopCmd commands,
 * and marks the page ready for the tests. Classic script, runs once the page is parsed. */
(function () {
  'use strict';
  function boot() {
    window.QRApp.init();
    window.QRBatch.init();
    document.getElementById('qr-cmd').addEventListener('click', () => { if (window.SlopCmd && SlopCmd.open) SlopCmd.open(); });
    window.QRCommands.register();
    document.body.classList.add('ready');
  }
  document.addEventListener('DOMContentLoaded', () => {
    try { boot(); } catch (e) {
      console.error(e);
      document.body.classList.add('ready');
      if (window.SlopUI) SlopUI.toast('QR SLOP could not start: ' + e.message);
    }
  });
})();
