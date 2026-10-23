/* Settings: Updates. Shows the release the service worker serves and loads the newest one on request (SlopPWA.refresh in
 * shared/pwa.js: deletes the offline caches, fetches the newest worker, reloads). Nothing the person made is cleared.
 * Classic script; needs shared/pwa.js. */
(function () {
  'use strict';
  var P = window.SlopPWA;
  var btn = document.getElementById('updates-refresh');
  var note = document.getElementById('updates-version');
  if (!P || !btn || !note) return;
  P.version().then(function (v) {
    note.textContent = v ? 'This browser has release ' + v + '.' : 'No offline copy yet: pages load from the network.';
  });
  btn.addEventListener('click', function () {
    btn.disabled = true;
    note.textContent = 'Loading the latest version…';
    P.refresh();
  });
})();
