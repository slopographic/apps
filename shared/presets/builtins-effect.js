/* Built-in effect presets (SlopPresets.BUILTIN_EFFECTS): plain data, shipped with the app. Values are inside the limits
 * of SlopPresets.EFFECT_TYPES, so every one validates (tests/node/presets.test.mjs checks it). Look-up by id: 'soft-shadow'.
 * Colour looks (kind effect, type colour-look) apply in Slop Cut; the rest apply to PhotoSlop layers. */
(function (g) {
  'use strict';
  const SP = (g.SlopPresets = g.SlopPresets || {});
  const fx = (type, p, on) => ({ type, ...(on === false ? { on: false } : {}), p });
  const preset = (id, label, description, apps, effects) => ({ id, kind: 'effect', label, description, apps, params: { effects } });
  const PS = ['photoslop'], CUT = ['slopedit'];

  SP.BUILTIN_EFFECTS = [
    preset('soft-shadow', 'Soft shadow', 'A diffuse drop shadow, down and to the right', PS,
      [fx('drop-shadow', { color: '#000000', op: 45, a: 120, dist: 8, size: 18 })]),
    preset('hard-shadow', 'Hard shadow', 'A crisp, dark shadow with no spread', PS,
      [fx('drop-shadow', { color: '#000000', op: 80, a: 135, dist: 10, size: 0 })]),
    preset('neon-glow', 'Neon glow', 'A lime halo around the layer', PS,
      [fx('glow', { color: '#d4ff3a', op: 85, spread: 4, size: 24 })]),
    preset('inner-glow-soft', 'Soft inner glow', 'A warm light inside the edges', PS,
      [fx('inner-glow', { color: '#fff5b0', op: 75, size: 12 })]),
    preset('outline', 'Outline', 'A dark keyline around the outside', PS,
      [fx('stroke', { size: 4, color: '#0a0a0a', pos: 'outside' })]),
    preset('emboss', 'Emboss', 'A raised bevel with light from the top left', PS,
      [fx('bevel', { size: 8, depth: 120, a: 120 })]),
    preset('colour-wash', 'Colour wash', 'A warm multiply tint over the layer', PS,
      [fx('overlay', { color: '#ff6b4a', op: 35, blend: 'multiply' })]),
    preset('sunset-gradient', 'Sunset gradient', 'A coral to blue gradient over the layer', PS,
      [fx('gradient', { c1: '#ff6b4a', c2: '#1f6feb', op: 60, a: 90, scale: 100, blend: 'normal' })]),
    preset('soft-blur', 'Soft blur', 'A gentle Gaussian blur', PS,
      [fx('blur', { radius: 3 })]),
    preset('sharpen', 'Sharpen', 'The standard sharpen kernel', PS,
      [fx('sharpen', {})]),
    preset('film-grain', 'Film grain', 'Monochrome grain, fixed seed', PS,
      [fx('grain', { amount: 12, mono: true, seed: 7 })]),
    preset('vignette', 'Vignette', 'Darkened corners', PS,
      [fx('vignette', { amount: 55, size: 75, color: '#000000' })]),
    preset('hue-shift', 'Hue shift', 'Turns the colours a little toward yellow', PS,
      [fx('colour-shift', { hue: 30, sat: 10, light: 0 })]),
    preset('glitch', 'Glitch', 'Torn rows with an RGB split', PS,
      [fx('glitch', { amount: 45, shift: 8, seed: 42 })]),
    preset('warm-look', 'Warm look', 'Warmer and a little more colour', CUT,
      [fx('colour-look', { temp: 35, sat: 10, contrast: 0, bright: 0 })]),
    preset('cool-look', 'Cool look', 'Cooler, blue-leaning light', CUT,
      [fx('colour-look', { temp: -35, sat: 0, contrast: 0, bright: 0 })]),
    preset('punchy-look', 'Punchy look', 'More contrast and saturation', CUT,
      [fx('colour-look', { temp: 0, sat: 30, contrast: 25, bright: 0 })]),
    preset('bw-look', 'Black and white', 'Desaturated with a little contrast', CUT,
      [fx('colour-look', { temp: 0, sat: -100, contrast: 15, bright: 0 })]),
  ];
})(typeof window !== 'undefined' ? window : globalThis);
