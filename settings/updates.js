/* Settings: Updates. Shows the release the service worker serves and loads the newest one on request (SlopPWA.refresh in
 * shared/pwa.js: deletes the offline caches, fetches the newest worker, reloads). Nothing the person made is cleared.
 * The desktop app's download links, or in the desktop app its version (shared/desktop/download.js), go under it; the app
 * has no offline copies to reload, so there the button and the release line are hidden.
 * Classic script; needs shared/pwa.js, shared/desktop/download.js and settings/say.js. */
(function () {
  'use strict';
  var P = window.SlopPWA;
  var btn = document.getElementById('updates-refresh');
  var note = document.getElementById('updates-version');
  var Say = window.SlopSettingsSay;
  if (window.SlopDesktopDownload) window.SlopDesktopDownload.mount(document.getElementById('desktop-download'));
  if (!P || !btn || !note) return;
  if (location.protocol === 'app:') { btn.hidden = true; note.hidden = true; return; }
  P.version().then(function (v) {
    if (v) Say.key(note, 'settings.updates.release', { version: String(v) }); else Say.key(note, 'settings.updates.no_copy');
  });
  btn.addEventListener('click', function () {
    btn.disabled = true;
    Say.key(note, 'settings.updates.loading');
    P.refresh();
  });
})();
