/* Built-in motion presets (SlopPresets.BUILTIN_MOTION): entrances as plain keyframe data. x and y are fractions of the
 * frame (-1 = one frame away, 1 = one frame below or to the right); rot is in degrees; every preset ends at its rest
 * pose, so it leaves the object as it was. The ids of the Slides presets (fade-in, slide-up, pop, shake, pulse, spin-in)
 * are kept, so saved Slides animations still resolve. slide-up is 40 px on a 720 px slide, as it was in Slides. */
(function (g) {
  'use strict';
  const SP = (g.SlopPresets = g.SlopPresets || {});
  const motion = (id, label, description, duration, tracks) => ({ id, kind: 'motion', label, description, apps: ['slides', 'remix', 'slopedit'], params: { duration, tracks } });
  const k = (t, value, ease) => (ease === undefined ? { t, value } : { t, value, ease });

  SP.BUILTIN_MOTION = [
    motion('fade-in', 'Fade in', 'Fades in over 0.4 s', 0.4, { opacity: [k(0, 0, 'easeOutQuad'), k(0.4, 1)] }),
    motion('slide-up', 'Slide up', 'Rises 40 px from below (on a 720 px frame)', 0.5, {
      y: [k(0, 40 / 720, 'easeOutCubic'), k(0.5, 0)], opacity: [k(0, 0, 'easeOutQuad'), k(0.5, 1)],
    }),
    motion('slide-down', 'Slide down', 'Slides in from the top edge', 0.5, {
      y: [k(0, -1, 'easeOutCubic'), k(0.5, 0)], opacity: [k(0, 0, 'easeOutQuad'), k(0.5, 1)],
    }),
    motion('slide-left', 'Slide from left', 'Slides in from the left edge', 0.5, {
      x: [k(0, -1, 'easeOutCubic'), k(0.5, 0)], opacity: [k(0, 0, 'easeOutQuad'), k(0.5, 1)],
    }),
    motion('slide-right', 'Slide from right', 'Slides in from the right edge', 0.5, {
      x: [k(0, 1, 'easeOutCubic'), k(0.5, 0)], opacity: [k(0, 0, 'easeOutQuad'), k(0.5, 1)],
    }),
    motion('zoom-in', 'Zoom in', 'Grows from 40 % to full size', 0.5, { scale: [k(0, 0.4, 'easeOutCubic'), k(0.5, 1)] }),
    motion('pop', 'Pop', 'Pops in with a small overshoot', 0.5, {
      scale: [k(0, 0, 'easeOutBack'), k(0.5, 1)], opacity: [k(0, 0), k(0.15, 1)],
    }),
    motion('bounce', 'Bounce in', 'Drops from above and bounces into place', 0.6, {
      y: [k(0, -0.5, 'easeOutBounce'), k(0.6, 0)], opacity: [k(0, 0), k(0.15, 1)],
    }),
    motion('shake', 'Shake', 'Side to side, damping out (10 px on a 1280 px frame)', 0.5, {
      x: [k(0, 0), k(0.07, -0.0078), k(0.14, 0.0078), k(0.21, -0.0063), k(0.28, 0.0063), k(0.35, -0.003), k(0.42, 0.003), k(0.5, 0)],
    }),
    motion('pulse', 'Pulse', 'Grows 8 % and returns', 0.6, {
      scale: [k(0, 1, 'easeInOutQuad'), k(0.3, 1.08, 'easeInOutQuad'), k(0.6, 1)],
    }),
    motion('spin-in', 'Spin in', 'Turns a full turn while it grows in', 0.6, {
      rot: [k(0, -360, 'easeOutCubic'), k(0.6, 0)], scale: [k(0, 0, 'easeOutCubic'), k(0.6, 1)], opacity: [k(0, 0), k(0.2, 1)],
    }),
  ];
})(typeof window !== 'undefined' ? window : globalThis);
