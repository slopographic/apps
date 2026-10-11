/* Google Consent Mode v2 and the only place third-party scripts are added. Classic script, exposes window.SlopConsent.
 * Load order: config.js, state.js, then this file, before any other script. On load it sets every consent type to
 * 'denied' BEFORE any tag, then loads what the stored choice allows. Nothing is loaded while an ID is empty.
 * Revoking sets consent to denied, does not reload the page, and stops future loads (window['ga-disable-<ID>'] = true).
 * Tests replace the loader: set window.SLOP_CONSENT_LOADER before this file, or SlopConsent.loadScript later. */
(function () {
  'use strict';
  var cfg = window.SLOP_CONSENT_CONFIG;
  var S = window.SlopConsentState;
  var GA_SRC = 'https://www.googletagmanager.com/gtag/js';
  var ADS_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  var DENIED = {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', functionality_storage: 'denied', personalization_storage: 'denied', security_storage: 'denied'
  };
  gtag('consent', 'default', Object.assign({}, DENIED));

  function mapping(c) {
    var ads = c.ads ? 'granted' : 'denied';
    return {
      analytics_storage: c.analytics ? 'granted' : 'denied',
      ad_storage: ads, ad_user_data: ads, ad_personalization: ads
    };
  }
  function defaultLoad(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    (document.head || document.documentElement).appendChild(s);
    return s;
  }
  var loaded = { analytics: false, ads: false };

  /** True when a gtag.js script for this ID is already on the page (the homepage puts it there inline). */
  function gaTagOnPage(id) {
    try {
      var list = document.getElementsByTagName('script');
      for (var i = 0; i < list.length; i++) {
        if ((list[i].src || '').indexOf(GA_SRC + '?id=' + encodeURIComponent(id)) === 0) return true;
      }
    } catch (e) { /* no DOM access: treat as absent */ }
    return false;
  }
  function loadAnalytics() {
    if (loaded.analytics || !cfg.ga4MeasurementId) return;
    loaded.analytics = true;
    if (gaTagOnPage(cfg.ga4MeasurementId)) {
      // The tag and its config are already on the page: only the consent state changes.
      gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    api.loadScript(GA_SRC + '?id=' + encodeURIComponent(cfg.ga4MeasurementId));
    gtag('js', new Date());
    gtag('config', cfg.ga4MeasurementId);
  }
  function loadAds() {
    if (loaded.ads || !cfg.adsensePublisherId) return;
    loaded.ads = true;
    api.loadScript(ADS_SRC + '?client=' + encodeURIComponent(cfg.adsensePublisherId));
  }

  /** Makes the consent state match the stored record and loads whatever is allowed. */
  function apply() {
    var c = S.current();
    gtag('consent', 'update', mapping(c));
    if (c.analytics) {
      if (cfg.ga4MeasurementId) window['ga-disable-' + cfg.ga4MeasurementId] = false;
      loadAnalytics();
    } else if (cfg.ga4MeasurementId) {
      window['ga-disable-' + cfg.ga4MeasurementId] = true;
      if (gaTagOnPage(cfg.ga4MeasurementId)) gtag('consent', 'update', { analytics_storage: 'denied' });
    }
    if (c.ads) loadAds();
    return c;
  }

  /** Saves the full set of choices and applies them. Returns false if storage refused (then nothing changes). */
  function setChoices(next) {
    var base = S.current();
    var rec = S.write({
      analytics: next && 'analytics' in next ? !!next.analytics : base.analytics,
      ads: next && 'ads' in next ? !!next.ads : base.ads,
      rates: next && 'rates' in next ? !!next.rates : base.rates
    });
    if (!rec) return false;
    apply();
    return true;
  }
  function setOne(cat, on) {
    if (cat !== 'analytics' && cat !== 'ads' && cat !== 'rates') throw new Error('unknown consent category: ' + cat);
    var o = {}; o[cat] = on;
    return setChoices(o);
  }

  var api = {
    loadScript: typeof window.SLOP_CONSENT_LOADER === 'function' ? window.SLOP_CONSENT_LOADER : defaultLoad,
    apply: apply,
    setChoices: setChoices,
    grant: function (cat) { return setOne(cat, true); },
    revoke: function (cat) { return setOne(cat, false); },
    /** The categories in force right now (necessary is always true). */
    state: function () { return S.current(); }
  };
  window.SlopConsent = api;
  apply();
})();
