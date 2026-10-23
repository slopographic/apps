// The precache list and the service worker VERSION are generated (tools/pwa-precache.mjs, run by the pre-commit hook).
// This fails when a commit changed a cached file without regenerating them, so returning visitors would keep old files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('service-worker.js VERSION and the precache list match the files (node tools/pwa-precache.mjs --check)', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/pwa-precache.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('VERSION is the generated hash form, not a hand-edited number', () => {
  const sw = readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
  assert.match(sw, /^const VERSION = 'v-[0-9a-f]{12}';$/m);
});

test('the pre-commit hook regenerates the list and VERSION', () => {
  const hook = readFileSync(path.join(ROOT, '.githooks/pre-commit'), 'utf8');
  assert.match(hook, /node tools\/pwa-precache\.mjs/);
  assert.match(hook, /git add service-worker\.js sw-precache\*\.js/);
});
