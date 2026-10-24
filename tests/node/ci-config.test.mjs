// The CI workflow (.github/workflows/rules.yml) and the repo agree: the browser jobs run in the Playwright image of the
// version package-lock.json installs (a newer library in an older image cannot find its browser), and every slice of the
// matrix is asked for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const wf = readFileSync(path.join(ROOT, '.github/workflows/rules.yml'), 'utf8');
const lock = JSON.parse(readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));

test('the browser jobs run in the Playwright image of the locked Playwright version', () => {
  const locked = lock.packages['node_modules/playwright'].version;
  const image = (wf.match(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/) || [])[1];
  assert.equal(image, locked, `image v${image}, package-lock.json ${locked}`);
});

test('the matrix lists every slice from 1 to n, and the run asks for slices of n', () => {
  const list = (wf.match(/shard: \[([\d, ]+)\]/) || [])[1].split(',').map(Number);
  const n = Number((wf.match(/--shard=\$\{\{ matrix\.shard \}\}\/(\d+)/) || [])[1]);
  assert.deepEqual(list, Array.from({ length: n }, (_, i) => i + 1));
});

test('the touch jobs run the touch-marked pages in WebKit (iPad) and Chromium (Android)', () => {
  const engines = (wf.match(/engine: \[([a-z, ]+)\]/) || [])[1].split(',').map((s) => s.trim());
  assert.deepEqual(engines.sort(), ['chromium', 'webkit']);
  assert.match(wf, /node tests\/run\.mjs --touch --browser=\$\{\{ matrix\.engine \}\}/);
});
