/* The brand facts a test needs, in one place: the brand profile's switches, as the same /*profile:key*\/ markers the
 * site's code holds (the white-label build rewrites every marker from the profile, so here they always match the code;
 * tests/node/brand-facts.test.mjs checks that each one equals its marker in the code). A test of a feature a profile can
 * switch off reads its switch here and checks the switch's contract either way, instead of assuming this site's values.
 * Classic script: sets window.BRAND_FACTS (and globalThis.BRAND_FACTS in Node; tests/brand-facts.mjs loads it there).
 *   naming      'brand' (this site's app names) or 'plain' (the PLAIN table in shared/apps.js)
 *   tone        'playful' or 'plain' (brand/copy/plain.json)
 *   mascot      'builtin' (the buddy engine, shared/buddy), 'overlay' (a mascot of the build's own in brand/mascot/, run by
 *               shared/mascot/slot.js) or 'none'
 *   media, analytics   screenshots, clips and videos shown; third parties (analytics, ads, the consent strip)
 *   defaultLang the language a visitor gets when nothing is stored
 *   hideApps    app ids left out of every list */
(function (root) {
  'use strict';
  var builtin = /*profile:mascot*/true, overlay = /*profile:mascotOverlay*/false;
  root.BRAND_FACTS = Object.freeze({
    naming: /*profile:naming*/'brand',
    tone: /*profile:tone*/'playful',
    mascot: builtin ? 'builtin' : overlay ? 'overlay' : 'none',
    media: /*profile:media*/true,
    analytics: /*profile:analytics*/true,
    defaultLang: /*profile:defaultLang*/'en',
    hideApps: Object.freeze(/*profile:hideApps*/[]),
  });
})(typeof window !== 'undefined' ? window : globalThis);
