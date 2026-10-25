// The palette shift of a white-label build: every colour of the source brand's accent family (its hues, from.hues) is
// turned to the profile's hue, keeping saturation and luminance, in the site's CSS, JavaScript, HTML and SVG. Greys, reds,
// blues and the rest are untouched; a moved colour keeps its luminance, so contrast stays as the source tested it.
// profile.palette: { hue: 221, from: [55, 110], minSaturation: 0.3 }. Node only. Tests: tests/node/whitelabel-palette.test.mjs.

const hex2 = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** WCAG relative luminance of 0-255 channels. */
export function luminance([r, g, b]) {
  const c = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

/** The new [r, g, b] for a colour, or null when it is not in the accent family. The new colour has the profile's hue,
 * the same saturation, and the lightness that gives the same luminance, so every contrast the source passed still holds. */
export function shift([r, g, b], pal) {
  const [h, s] = rgbToHsl(r, g, b);
  const [lo, hi] = pal.from || [65, 100];
  if (h < lo || h > hi || s < (pal.minSaturation ?? 0.3)) return null;
  const want = luminance([r, g, b]);
  let a = 0, z = 1;
  for (let i = 0; i < 30; i++) { const m = (a + z) / 2; if (luminance(hslToRgb(pal.hue, s, m)) < want) a = m; else z = m; }
  return hslToRgb(pal.hue, s, (a + z) / 2);
}

const HEX = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const RGB = /\brgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(\s*[,)])/g;

/** The text with its accent-family colours moved to the profile's hue. Hex keeps its length and case style. */
export function remapColors(text, pal) {
  if (!pal || typeof pal.hue !== 'number') return text;
  return text.replace(HEX, (m, h) => {
    const full = h.length <= 4 ? h.split('').map((c) => c + c).join('') : h;
    const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    const n = shift(rgb, pal);
    if (!n) return m;
    let out = n.map(hex2).join('') + (full.length === 8 ? full.slice(6) : '');
    if (h === h.toUpperCase() && /[A-F]/.test(h)) out = out.toUpperCase();
    return '#' + out;
  }).replace(RGB, (m, r, g, b, tail) => {
    const n = shift([+r, +g, +b], pal);
    return n ? m.slice(0, m.indexOf('(') + 1) + n.map(Math.round).join(', ') + tail : m;
  });
}

/** Tests whose colours are inputs to colour maths, not the site's look: left as they are. */
export const PALETTE_KEEP = /^tests\/(node\/colors-|.*fixtures\/)/;
/** Which files the shift applies to: the site's own styles and code and the tests that check them; not third-party code. */
export const paletteFile = (file) => /\.(css|m?js|html|svg)$/.test(file) && !/^vendor\//.test(file) && !PALETTE_KEEP.test(file);
