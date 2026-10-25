// Covers: tools/whitelabel/profile.mjs, tools/whitelabel/emit.mjs, brand/profiles/sample.json, brand/profiles/slopographic.json
// The profile schema, the rename map file, the visible-name pairs, the forbidden words, and the files a build writes from
// a profile. The site's own profile gives today's output unchanged (brand.json, every marker literal).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, loadProfile, loadMap, phrasePairs, forbiddenTerms, profilesDir, allProfiles } from '../../tools/whitelabel/profile.mjs';
import { markerValues, applyMarkers, brandJson, markSvg, logoSvg, manifest, mit, readme } from '../../tools/whitelabel/emit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = profilesDir(ROOT);

test('every profile in brand/profiles is valid; the sample has a rename map', () => {
  for (const p of allProfiles(DIR)) assert.deepEqual(validate(p), [], p.id);
  assert.ok(loadMap(DIR, 'sample').compounds.length > 3);
  assert.equal(loadMap(DIR, 'slopographic'), null);
});

test('validate names each bad field', () => {
  const p = Object.assign({}, loadProfile(DIR, 'sample'), { origin: 'http://x/', naming: 'fun', colors: { ink: 'red' }, defaultLang: 'xx' });
  const errs = validate(p).join('\n');
  for (const k of ['origin', 'naming', 'colors', 'defaultLang']) assert.match(errs, new RegExp(`^${k}:`, 'm'));
});

test('phrase pairs: registry plain names, the tone copy, the brand name', () => {
  const pairs = new Map(phrasePairs(ROOT, loadProfile(DIR, 'sample')));
  assert.equal(pairs.get('Slop PDF'), 'PDF Editor');
  assert.equal(pairs.get('PhotoSlop'), 'Image Editor');
  assert.equal(pairs.get('Slop Drive'), 'Files');
  assert.equal(pairs.get('Slopographic'), 'Acme Tools');
  assert.equal(pairs.get('Sloppo'), 'Helper');
  assert.deepEqual(phrasePairs(ROOT, loadProfile(DIR, 'slopographic')).map((x) => x[0]).filter((x) => x === 'Slop PDF'), []);
});

test('forbidden words: the source stem and the other profiles’ terms', () => {
  const t = forbiddenTerms(DIR, loadProfile(DIR, 'sample'));
  assert.ok(t.includes('slop') && t.includes('slurp'));
  assert.ok(!t.includes('acme tools'));
});

test('the site’s own profile writes today’s brand.json', () => {
  const src = JSON.parse(readFileSync(path.join(ROOT, 'brand/brand.json'), 'utf8'));
  assert.deepEqual(brandJson(src, loadProfile(DIR, 'slopographic')), src);
});

test('the site’s own profile leaves every marker literal as it is', () => {
  const values = markerValues(loadProfile(DIR, 'slopographic'));
  const files = ['shared/apps.js', 'shared/theme/theme.js', 'shared/buddy/boot.js', 'shared/consent/config.js', 'shared/i18n/i18n.js', 'ai/js/ui/sloppo.js', 'drive/js/ui/empty.js', 'shared/seo/copy.mjs'];
  for (const f of files) {
    const text = readFileSync(path.join(ROOT, f), 'utf8');
    assert.match(text, /\/\*profile:\w+\*\//, f);
    assert.equal(applyMarkers(text, values), text, f);
  }
  const sample = markerValues(loadProfile(DIR, 'sample'));
  assert.match(applyMarkers("const N = /*profile:naming*/'brand';", sample), /\/\*profile:naming\*\/"plain"/);
  assert.throws(() => applyMarkers('/*profile:nope*/1', sample), /unknown profile marker/);
});

test('generated files: logo, manifest, licence, README', () => {
  const p = loadProfile(DIR, 'sample');
  assert.match(markSvg(p), /<svg[^>]*>.*>A<\/text>/s);
  assert.match(logoSvg(p), /Acme Tools/);
  const m = JSON.parse(manifest(JSON.stringify({ name: 'x', short_name: 'y', icons: [] }), p));
  assert.equal(m.name, 'Acme Tools'); assert.equal(m.theme_color, p.colors.ink);
  assert.match(mit(p), /Copyright \(c\) 2026 Acme Example Ltd/);
  assert.match(readme(p), /Generated - do not edit/);
});

test('no file in the repository names a real brand profile', () => {
  // brand/profiles holds the made-up sample and the site's own profile only; real ones live outside the repository.
  const names = readdirSync(DIR).filter((f) => statSync(path.join(DIR, f)).isFile());
  assert.deepEqual(names.sort(), ['sample-sv.json', 'sample-sv.map.json', 'sample.json', 'sample.map.json', 'slopographic.json']);
});
