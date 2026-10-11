/* The face detection wording, in one place: the opt-in dialog (shared/faces/consent.js) and the Profile switch
 * (shared/profile/app-options.js, shown on settings/) both read it, so they say the same thing. Classic script;
 * sets window.SLOP_FACES_COPY. Load it before app-options.js. */
(function (g) {
  'use strict';
  g.SLOP_FACES_COPY = Object.freeze({
    title: 'Find faces on this device?',
    switchLabel: 'Find faces on this device',
    lines: Object.freeze([
      'Slop can find the faces in your pictures. You then see how many faces each picture has, and Gallery can group photos by face count.',
      'It runs on this device, with one small open model (YuNet, MIT licence, about 230 KB). Nothing is uploaded, and no one is identified.',
      'It is off by default. You can turn it on or off again at any time in Profile, under Face detection.',
    ]),
  });
})(typeof window !== 'undefined' ? window : globalThis);
