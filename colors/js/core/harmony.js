/* Slop Colors: palettes made from one colour. Pure; needs the convert module (colors/js/core/convert.js) and the
 * contrast maths (shared/color/contrast.js). In Node the factory takes them; in a page it reads SlopColors.convert.
 *   HARMONIES                      [[id, label]]: complementary, analogous, triadic, split, tetradic, square, monochrome
 *   harmony(hex, id) → [hex]       the base colour first, the others by turning the hue on the HSL colour wheel (as
 *                                  designers' wheels do); monochrome keeps the hue and steps the lightness
 *   SCALES                         [[id, label]]: tints (towards white), shades (towards black), tones (towards grey)
 *   scale(hex, id, steps) → [hex]  the colour and steps-1 mixes, the last one step short of white, black or grey
 *   RAMP_KEYS, ramp(hex) → { 50: hex, …, 950: hex }   a Tailwind-style ramp: the hue kept, lightness from 97% to 22% in
 *                                  OKLCH with the chroma eased at the ends, and the given colour placed at its nearest step
 *   suggest(fg, bg, target) → hex | null   the colour nearest fg (same hue and chroma, lightness moved the least) whose
 *                                  contrast with bg reaches target */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else (root.SlopColors = root.SlopColors || {}).harmony = factory(root.SlopColors.convert, root.SlopContrastMath);
})(typeof window !== 'undefined' ? window : globalThis, function (C, M) {
  'use strict';
  const HARMONIES = [['complementary', 'Complementary'], ['analogous', 'Analogous'], ['triadic', 'Triadic'], ['split', 'Split complementary'],
    ['tetradic', 'Tetradic'], ['square', 'Square'], ['monochrome', 'Monochrome']];
  const TURNS = { complementary: [0, 180], analogous: [-30, 0, 30, 60], triadic: [0, 120, 240], split: [0, 150, 210], tetradic: [0, 60, 180, 240], square: [0, 90, 180, 270] };
  const SCALES = [['tints', 'Tints (with white)'], ['shades', 'Shades (with black)'], ['tones', 'Tones (with grey)']];
  const RAMP_KEYS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const RAMP_L = [0.97, 0.93, 0.87, 0.79, 0.70, 0.62, 0.54, 0.46, 0.38, 0.30, 0.22];

  function harmony(hex, id) {
    const base = C.parse(hex) || '#000000', [r, g, b] = C.rgbOf(base), [h, s, l] = C.rgbToHsl(r, g, b);
    if (id === 'monochrome') {
      const ls = [l, ...[20, 35, 50, 65, 80].filter((x) => Math.abs(x - l) > 7)].slice(0, 5);
      return ls.map((x, i) => (i === 0 ? base : C.hexOf(C.hslToRgb(h, s, x))));
    }
    const turns = TURNS[id] || TURNS.complementary;
    const out = turns.map((t) => (t === 0 ? base : C.hexOf(C.hslToRgb(h + t, s, l))));
    return [base, ...out.filter((x, i) => turns[i] !== 0)];
  }

  function scale(hex, id = 'tints', steps = 5) {
    const base = C.rgbOf(C.parse(hex) || '#000000'), n = Math.max(2, Math.min(20, Math.round(steps) || 5));
    const to = id === 'shades' ? [0, 0, 0] : id === 'tones' ? [128, 128, 128] : [255, 255, 255];
    const out = [];
    for (let i = 0; i < n; i++) { const t = i / n; out.push(C.hexOf(base.map((v, k) => v + (to[k] - v) * t))); }
    return out;
  }

  function ramp(hex) {
    const [r, g, b] = C.rgbOf(C.parse(hex) || '#000000'), [L, Ch, h] = C.rgbToOklch(r, g, b);
    let at = 0;
    RAMP_L.forEach((x, i) => { if (Math.abs(x - L) < Math.abs(RAMP_L[at] - L)) at = i; });
    const out = {};
    RAMP_KEYS.forEach((k, i) => {
      const ease = 1 - Math.abs(RAMP_L[i] - 0.6) * 0.9;   // less chroma near white and black, where little fits
      out[k] = i === at ? C.hexOf([r, g, b]) : C.hexOf(C.oklchToRgb(RAMP_L[i], Ch * Math.max(0.25, ease), h));
    });
    return out;
  }

  function suggest(fg, bg, target = 4.5) {
    const f = C.parse(fg), b = C.parse(bg);
    if (!f || !b) return null;
    if (M.ratioHex(f, b) >= target) return f;
    const [L, Ch, h] = C.rgbToOklch(...C.rgbOf(f));
    let best = null;
    for (let d = 0.005; d <= 1; d += 0.005) {
      for (const L2 of [L - d, L + d]) {
        if (L2 < 0 || L2 > 1) continue;
        const x = C.hexOf(C.oklchToRgb(L2, Ch, h));
        if (M.ratioHex(x, b) >= target) { best = x; break; }
      }
      if (best) break;
    }
    return best;
  }
  return { HARMONIES, SCALES, RAMP_KEYS, harmony, scale, ramp, suggest };
});
