// The CI workflow (.github/workflows/rules.yml) and the repo agree: the browser jobs run in the Playwright image of the
// version package-lock.json installs (a newer library in an older image cannot find its browser), and every slice of the
// matrix is asked for. wip/* branches never run the full suite (browser-changed runs only the changed apps there).
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

test('wip/* branches never run the full browser suite; they run only the changed apps and smoke pages', () => {
  const job = (name) => (wf.split(/\n  (?=[\w-]+:\n)/).find((b) => b.startsWith(name + ':')) || '');
  assert.match(job('browser'), /if: \$\{\{ !startsWith\(github\.ref, 'refs\/heads\/wip\/'\) \}\}/);
  const changed = job('browser-changed');
  assert.match(changed, /if: \$\{\{ startsWith\(github\.ref, 'refs\/heads\/wip\/'\) \}\}/);
  assert.doesNotMatch(changed, /--shard=/);
  assert.equal((wf.match(/--shard=/g) || []).length, 1, 'only the full-suite job splits into shards');
});
