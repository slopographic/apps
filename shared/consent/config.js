/* Consent and third-party settings: the ONE place the owner fills in IDs. Classic script, exposes window.SLOP_CONSENT_CONFIG.
 * Empty string = off. With every value empty nothing third-party ever loads and the Donate section stays hidden.
 * Bump policyVersion whenever the categories or the banner text change: every visitor is asked again.
 * Malformed values are treated as empty, so a typo cannot inject anything. See shared/consent/HANDOFF.md. */
(function () {
  'use strict';
  var defaults = {
    ga4MeasurementId: 'G-HW6FWQVFK3', // Empty: the gtag script never loads. Loads only after the visitor opts in.
    adsensePublisherId: 'ca-pub-9263973145335219', // Empty: the AdSense script never loads. Loads only after the visitor opts in to ads.
    patreonUrl: '',         // e.g. 'https://www.patreon.com/yourname'. Empty: the donate link is hidden.
    policyVersion: 2        // Consent policy version. A change makes every stored record outdated (2 adds the 'rates' category).
  };
  // Test hook only: test pages set window.SLOP_CONSENT_OVERRIDES before this file loads. Nothing in the app sets it.
  var over = window.SLOP_CONSENT_OVERRIDES || {};
  var cfg = Object.assign({}, defaults, over);
  if (!/^G-[A-Z0-9]{4,20}$/.test(cfg.ga4MeasurementId)) cfg.ga4MeasurementId = '';
  if (!/^ca-pub-\d{6,20}$/.test(cfg.adsensePublisherId)) cfg.adsensePublisherId = '';
  if (!/^https:\/\/[^\s"'<>]+$/.test(cfg.patreonUrl)) cfg.patreonUrl = '';
  if (!(Number.isInteger(cfg.policyVersion) && cfg.policyVersion >= 1)) cfg.policyVersion = defaults.policyVersion;
  window.SLOP_CONSENT_CONFIG = Object.freeze(cfg);
})();
