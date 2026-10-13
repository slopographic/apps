/* The name shown for an app on the homepage. Each registry entry (shared/apps.js) has a descriptive `title`, such as
 * "EML previewer and converter" or "SlopCut: video editor", and the brand `name`. The homepage shows the title, or the brand
 * name when the visitor turns on the switch (remembered in this browser). The registry keeps both; lookups and the sort use `name`. */
(() => {
  'use strict';
  const BRAND_KEY = 'slop.home.names';
  window.slopBrandNamesOn = () => { try { return localStorage.getItem(BRAND_KEY) === '1'; } catch (e) { return false; } };
  window.slopSetBrandNames = (on) => { try { localStorage.setItem(BRAND_KEY, on ? '1' : '0'); } catch (e) { /* storage blocked: the switch still works for this visit */ } };
  window.slopAppLabel = (a, withBrand) => (withBrand ? a.name : a.title || a.name);
})();
