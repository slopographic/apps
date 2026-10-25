// The palette shift of a white-label build: every colour of the source brand's accent family (its hues, from.hues) is
// turned to the profile's hue, keeping saturation and lightness, in the site's CSS, JavaScript, HTML and SVG. Greys, reds,
// blues and the rest are untouched, so contrast between text and surfaces stays as the source tested it.
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

/** The new [r, g, b] for a colour, or null when it is not in the accent family. */
export function shift([r, g, b], pal) {
  const [h, s, l] = rgbToHsl(r, g, b);
  const [lo, hi] = pal.from || [55, 110];
  if (h < lo || h > hi || s < (pal.minSaturation ?? 0.3)) return null;
  return hslToRgb(pal.hue, s, l);
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

/** Which files the shift applies to: the site's own styles and code, not third-party code or test fixtures. */
export const paletteFile = (file) => /\.(css|m?js|html|svg)$/.test(file) && !/^(vendor|tests\/.*fixtures)\//.test(file);
