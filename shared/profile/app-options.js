/* Per-app options shown on the Settings page: one section per app listed here (apps are listed from shared/apps.js).
 * Each option: { label, type: 'bool' | 'number' | 'string' | 'enum', default, values (enum), min, max, help }.
 * The app keeps its own default in its code and reads with SlopProfile.get(appId, key, appDefault). The default
 * here is what the Settings page shows; a value equal to it is not stored as an override.
 *   tables: { decimalPlaces: { label: 'Decimal places', type: 'number', default: 2, min: 0, max: 6 } }   (example, not active)
 * SLOP_APP_SHARED lists option groups that several apps show with ONE stored value: { appId: { groupId: 'Heading' } }.
 * Here the group 'faces' (face detection, off by default, shared/faces/) is shown in Drive's and Gallery's sections.
 * Needs shared/faces/copy.js first. Classic script; exposes window.SLOP_APP_OPTIONS and window.SLOP_APP_SHARED. */
(function (g) {
  'use strict';
  var C = g.SLOP_FACES_COPY || { switchLabel: 'Find faces on this device', lines: [] };
  g.SLOP_APP_OPTIONS = Object.freeze({
    faces: {
      detect: { label: C.switchLabel, type: 'bool', default: false, help: C.lines.join(' ') },
    },
  });
  g.SLOP_APP_SHARED = Object.freeze({
    drive: Object.freeze({ faces: 'Face detection' }),
    gallery: Object.freeze({ faces: 'Face detection' }),
  });
})(typeof window !== 'undefined' ? window : globalThis);
