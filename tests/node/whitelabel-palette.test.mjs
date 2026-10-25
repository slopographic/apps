// Covers: tools/whitelabel/palette.mjs
// The accent family moves to the profile's hue; greys and other hues stay; lengths and alpha are kept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remapColors, shift, rgbToHsl, paletteFile } from '../../tools/whitelabel/palette.mjs';

const PAL = { hue: 221, from: [55, 110] };
test('lime becomes the profile hue with the same lightness', () => {
  const out = remapColors('a { color: #d4ff3a; background: #4f6c00; }', PAL);
  const hexes = out.match(/#[0-9a-f]{6}/g);
  for (const h of hexes) {
    const [hh] = rgbToHsl(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
    assert.ok(Math.abs(hh - 221) < 2, h);
  }
});
test('greys, reds and blues are untouched; alpha and rgb() handled', () => {
  assert.equal(remapColors('#0a0a0a #ffffff #e5484d #2563eb', PAL), '#0a0a0a #ffffff #e5484d #2563eb');
  assert.match(remapColors('#d4ff3a80', PAL), /^#[0-9a-f]{6}80$/);
  assert.match(remapColors('rgba(212, 255, 58, .5)', PAL), /^rgba\(\d+, \d+, \d+, \.5\)$/);
  assert.equal(shift([128, 128, 128], PAL), null);
  assert.equal(remapColors('#d4ff3a', null), '#d4ff3a');
});
test('only the site’s own styles and code', () => {
  assert.equal(paletteFile('pdf/css/a.css'), true);
  assert.equal(paletteFile('vendor/x/a.js'), false);
  assert.equal(paletteFile('assets/a.png'), false);
});
