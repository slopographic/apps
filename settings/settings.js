/* Settings page: the consent toggles, read from and written to the same record as the banner. Classic script.
 * Needs config.js, state.js and consent-mode.js loaded first. Toggles save at once. */
(function () {
  'use strict';
  var S = window.SlopConsentState;
  var C = window.SlopConsent;
  var analytics = document.getElementById('set-analytics');
  var ads = document.getElementById('set-ads');
  var note = document.getElementById('settings-note');

  function sync() {
    var cur = C.state();
    var avail = S.available();
    var rec = S.read();
    analytics.checked = cur.analytics;
    ads.checked = cur.ads;
    analytics.disabled = ads.disabled = !avail;
    var msg;
    if (!avail) msg = 'This browser will not store your choices, so analytics and ads stay off.';
    else if (S.needsChoice()) {
      msg = rec
        ? 'Our privacy policy changed, so your earlier choices no longer apply. Analytics and ads are off until you choose again.'
        : 'You have not chosen yet. Analytics and ads are off.';
    } else if (rec) msg = 'Saved on ' + new Date(rec.timestamp).toLocaleString() + '.';
    else msg = 'Analytics and ads are off.';
    note.textContent = msg;
  }
  function wire(el, cat) {
    el.addEventListener('change', function () {
      if (el.checked) C.grant(cat); else C.revoke(cat);
      sync(); // a refused save (storage blocked) puts the switch back
    });
  }
  wire(analytics, 'analytics');
  wire(ads, 'ads');
  sync();
  window.SlopSettings = { sync: sync };
})();
