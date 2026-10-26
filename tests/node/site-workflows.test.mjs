// This repository's own workflows, which a white-label build does not get (it writes its one rules.yml,
// tools/whitelabel/workflow.mjs). Repo-only (tests/repo-only.json). The checks every workflow needs (read-only token
// permissions, the Playwright image, the plan and its slices) run in every build: tests/node/ci-config.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');

test('this repository has its workflows: the rules, the preview, the commit authors, page speed, IndexNow, the WebGPU check', () => {
  const files = readdirSync(path.join(ROOT, '.github/workflows'));
  for (const f of ['rules.yml', 'preview.yml', 'commit-authors.yml', 'speed.yml', 'indexnow.yml', 'webgpu.yml']) assert.ok(files.includes(f), f);
});

test('the preview copy is the only place that adds noindex to every page', () => {
  const wf = read('.github/workflows/preview.yml');
  assert.match(wf, /branches: \[testing\]/, 'the preview is made from the testing branch only');
  assert.match(wf, /noindex, nofollow/);
  assert.match(wf, /rm -rf CNAME/, 'the preview never takes the live domain');
});
