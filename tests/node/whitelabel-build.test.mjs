// Covers: tools/whitelabel/build.mjs, tools/whitelabel/export.mjs, tools/whitelabel/images.mjs, tools/whitelabel/workflow.mjs, tools/whitelabel/mirror-skip.mjs
// The build's parts that need no browser: what it leaves out, the model-file patch, the mirror's workflow, the icon file,
// the share card. CI's white-label job runs the whole build, the scan and the smoke pages on the sample profile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { excluded, patchBinary, SCAN_ALLOW } from '../../tools/whitelabel/build.mjs';
import { exportProfile } from '../../tools/whitelabel/export.mjs';
import { ico, cardHtml } from '../../tools/whitelabel/images.mjs';
import { mirrorWorkflow, DROP_STEPS } from '../../tools/whitelabel/workflow.mjs';
import { skipPattern, SKIP, smokeFor, SMOKE } from '../../tools/whitelabel/mirror-skip.mjs';
import { loadProfile, profilesDir } from '../../tools/whitelabel/profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const P = { support: { ads: false }, media: false };

test('left out of a renamed build: the source brand’s own files', () => {
  for (const f of ['TRADEMARKS.md', 'LICENSE-ART', '.github/workflows/rules.yml', 'docs-1280-dark.png', 'brand/profiles/sample.json', 'tools/whitelabel/build.mjs',
    'tests/node/whitelabel-build.test.mjs', 'tests/node/attribution.test.mjs', '.github/workflows/commit-authors.yml', 'ads.txt', 'assets/shots/pdf.jpg', 'brand/logo-128.webp', 'docs-1280-dark.png', '.claude/settings.json']) assert.equal(excluded(f, P), true, f);
  for (const f of ['pdf/index.html', '.github/workflows/speed.yml', '.githooks/pre-commit', 'shared/apps.js', 'tests/node/i18n.test.mjs']) assert.equal(excluded(f, P), false, f);
  assert.equal(excluded('assets/shots/pdf.jpg', { media: true }), false);
});

test('model files: the tool name is patched at the same length', () => {
  const buf = Buffer.concat([Buffer.from([8, 0, 18, 12]), Buffer.from('slopographic'), Buffer.from([0, 1])]);
  const out = patchBinary('vendor/m.onnx', buf);
  assert.equal(out.length, buf.length);
  assert.ok(!out.includes('slopographic') && out.includes('modelbuilder'));
  assert.equal(patchBinary('a.png', buf), buf);
  assert.ok(SCAN_ALLOW.every((a) => a.file && a.why));
});

test('the mirror workflow drops the steps that only work here', () => {
  const yml = readFileSync(path.join(ROOT, '.github/workflows/rules.yml'), 'utf8');
  const out = mirrorWorkflow(yml);
  for (const d of DROP_STEPS) assert.ok(yml.includes(d) && !out.includes(d), d);
  assert.doesNotMatch(out, /git config user\.name/);
  assert.match(out, /node --test tests\/node/);
  assert.doesNotMatch(out, /whitelabel/);
  assert.doesNotMatch(out, /\n  (touch|browser|plan):\n/);
  assert.match(mirrorWorkflow(yml, '', ['tests/x.test.html']), /\n  smoke:\n[\s\S]*tests\/x\.test\.html/);
});

test('icons: a PNG-in-ICO header; the share card holds the name', () => {
  const png = Buffer.from([137, 80, 78, 71]);
  const f = ico([{ size: 16, data: png }, { size: 32, data: png }]);
  assert.equal(f.readUInt16LE(2), 1); assert.equal(f.readUInt16LE(4), 2); assert.equal(f.readUInt32LE(6 + 12), 38);
  assert.match(cardHtml({ name: 'Acme Tools', tagline: 'x', colors: { ink: '#000', paper: '#fff', accent: '#00f' } }, '<svg ></svg>'), /Acme Tools/);
  assert.equal(typeof exportProfile, 'function');
});

test('the mirror skips only the tests that pin this site’s profile, and names each one', () => {
  const dir = profilesDir(ROOT);
  const own = skipPattern(loadProfile(dir, 'slopographic'));   // this site's own profile skips only what every build skips
  assert.doesNotMatch(own, /system prompt|support block|tutorial/);
  assert.match(own, /description of 120 to 160/);
  const pat = skipPattern(loadProfile(dir, 'sample'));
  assert.doesNotMatch(pat, /['"]/);
  const sample = loadProfile(dir, 'sample');
  for (const s of SKIP) assert.equal(new RegExp(pat).test(s.test), !!s.when(sample), s.test);
  assert.ok(!new RegExp(pat).test('every app id in shared/apps.js has an icon entry'));
  assert.deepEqual(smokeFor(sample), SMOKE);
  assert.ok(!smokeFor(loadProfile(dir, 'sample-sv')).includes('tests/i18n/switch.test.html'));
  const yml = mirrorWorkflow(readFileSync(path.join(ROOT, '.github/workflows/rules.yml'), 'utf8'), pat);
  assert.ok(yml.includes(`node --test '--test-skip-pattern=${pat}' tests/node/`));
});
