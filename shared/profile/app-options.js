/* Per-app options shown on the Settings page: one section per app listed here (apps are listed from shared/apps.js).
 * Each option: { label, type: 'bool' | 'number' | 'string' | 'enum', default, values (enum), min, max, help }.
 * The app keeps its own default in its code and reads with SlopProfile.get(appId, key, appDefault). The default
 * here is what the Settings page shows; a value equal to it is not stored as an override. No app declares options
 * yet. Example of the shape (not active):
 *   tables: { decimalPlaces: { label: 'Decimal places', type: 'number', default: 2, min: 0, max: 6 } }
 * Classic script, exposes window.SLOP_APP_OPTIONS. */
(function (g) {
  'use strict';
  g.SLOP_APP_OPTIONS = Object.freeze({});
})(typeof window !== 'undefined' ? window : globalThis);
