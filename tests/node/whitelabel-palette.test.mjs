// Covers: tools/whitelabel/palette.mjs
// The accent family moves to the profile's hue; greys and other hues stay; lengths and alpha are kept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remapColors, shift, rgbToHsl, paletteFile, luminance, themeProblems, sourceThemes, contrast } from '../../tools/whitelabel/palette.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const PAL = { hue: 221, from: [65, 100] };
test('lime becomes the profile hue with the same luminance (so the same contrast)', () => {
  for (const c of [[212, 255, 58], [79, 108, 0], [159, 204, 0]]) assert.ok(Math.abs(luminance(shift(c, PAL)) - luminance(c)) < 0.002, String(c));
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
  assert.equal(paletteFile('tests/node/colors-core.test.mjs'), false);
  assert.equal(paletteFile('tests/pdf/look.test.html'), true);
  assert.equal(paletteFile('assets/a.png'), false);
});

test('every profile\u2019s themes read at least as well as this site\u2019s (4.5:1 text and accent, 3:1 borders), no browser needed', () => {
  // WHITELABEL_PROFILES=<dir> adds a folder of profiles kept outside the repository (the publish script sets it).
  const src = sourceThemes(readFileSync(path.join(ROOT, 'shared/theme/theme.js'), 'utf8'));
  assert.ok(src.light && src.dark);
  const dirs = [path.join(ROOT, 'brand/profiles')].concat(process.env.WHITELABEL_PROFILES && existsSync(process.env.WHITELABEL_PROFILES) ? [process.env.WHITELABEL_PROFILES] : []);
  for (const d of dirs) for (const f of readdirSync(d).filter((x) => x.endsWith('.json') && !x.endsWith('.map.json'))) {
    const p = JSON.parse(readFileSync(path.join(d, f), 'utf8'));
    assert.deepEqual(themeProblems(p.themes, src), [], f);
  }
  assert.ok(themeProblems({ dark: { text: '#777777' } }, src).length > 0, 'a dim text is caught');
  assert.ok(contrast([0, 0, 0], [255, 255, 255]) > 20);
});
