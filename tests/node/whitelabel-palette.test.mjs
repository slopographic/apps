// Covers: tools/whitelabel/palette.mjs, tools/whitelabel/transform.mjs
// The accent family moves to the profile's hue; greys and other hues stay; lengths and alpha are kept. palette.neutral
// moves the source's tinted greys; the profile's own colours (marker values) are never moved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { remapColors, shift, shiftNeutral, rgbToHsl, paletteFile, luminance, themeProblems, sourceThemes, contrast } from '../../tools/whitelabel/palette.mjs';

import { context, forward } from '../../tools/whitelabel/transform.mjs';
import { loadProfile, loadMap, validate } from '../../tools/whitelabel/profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

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
  assert.equal(paletteFile('bgremover/js/io/sample.js'), false);   // a sample picture: the model's input, drawn as it is
  assert.equal(paletteFile('bgremover/js/io/files.js'), true);
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

test('palette.neutral: the warm and the listed tinted greys take the profile\u2019s tint, same luminance; pure greys and colours stay', () => {
  const pal = { hue: 4, from: [65, 100], neutral: { hue: 220, saturation: 0.15, from: [[20, 60], [225, 260]] } };
  for (const c of ['#ebe7de', '#f8f6f1', '#dcd6c9', '#8f897d', '#0e0e10', '#1d1d22']) {
    const out = remapColors(c, pal), [h, sat] = rgbToHsl(...hexRgb(out));
    assert.notEqual(out, c);
    // near-black: 8-bit channels cannot hold the hue exactly
    if (luminance(hexRgb(c)) > 0.05) assert.ok(Math.abs(h - 220) < 3 && Math.abs(sat - 0.15) < 0.03, `${c} -> ${out}`);
    assert.ok(Math.abs(luminance(hexRgb(out)) - luminance(hexRgb(c))) < 0.004, `${c} keeps its luminance`);
  }
  assert.equal(remapColors('#0a0a0a #ffffff #808080 #d97706 #dc2626 #3b82f6', pal), '#0a0a0a #ffffff #808080 #d97706 #dc2626 #3b82f6');
  assert.equal(remapColors('#0e0e10', { hue: 4, neutral: { hue: 220 } }), '#0e0e10', 'default range: the warm greys only');
  assert.equal(shiftNeutral([235, 231, 222], undefined), null);
  const sample = loadProfile(path.join(ROOT, 'brand/profiles'), 'sample');
  assert.match(validate({ ...sample, palette: { hue: 4, neutral: { from: [1] } } }).join('\n'), /^palette\.neutral:/m);
});

test('the profile\u2019s own colours in a marker are written as given, not moved by the palette', () => {
  const dir = path.join(ROOT, 'brand/profiles'), sample = loadProfile(dir, 'sample');
  const p = { ...sample, palette: { hue: 4, from: [65, 100], neutral: { hue: 220 } }, themes: { light: { ...sample.themes.light, accent: '#4f6c00', background: '#ebe7de' } } };
  const out = forward("var A = '#4f6c00', P = /*profile:themes*/{};", context(ROOT, p, loadMap(dir, 'sample')), 'shared/theme/theme.js');
  assert.doesNotMatch(out.split('P =')[0], /#4f6c00/, 'the source colour moves');
  assert.match(out.split('P =')[1], /"accent":"#4f6c00"/);
  assert.match(out.split('P =')[1], /"background":"#ebe7de"/);
});
