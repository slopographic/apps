// Covers: tests/needs.mjs, tests/run.mjs
// The page tags that keep a feature's tests to the builds that ship the feature (tests/needs.mjs), and the pages that
// carry them: the buddy engine's pages need the built-in mascot, and a page checks the other side of each switch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { needsOf, unmet, loadFacts } from '../needs.mjs';
import { FACTS, BRAND, ROOT } from '../brand-facts.mjs';

const F = { mascot: 'overlay', media: false, defaultLang: 'sv' };

test('a page with no tag runs everywhere; a tag runs a page only where every condition holds', () => {
  assert.deepEqual(needsOf('<title>x</title>'), []);
  const n = needsOf('<meta name="slop-test-needs" content="mascot=builtin|overlay; media=false">');
  assert.deepEqual(n, [{ key: 'mascot', values: ['builtin', 'overlay'] }, { key: 'media', values: ['false'] }]);
  assert.deepEqual(unmet(n, F), []);
  assert.deepEqual(unmet(n, { ...F, mascot: 'none' }).map((c) => c.key), ['mascot']);
  assert.deepEqual(unmet(needsOf('<meta name="slop-test-needs" content="media=true">'), F).map((c) => c.key), ['media']);
  assert.throws(() => unmet(needsOf('<meta name="slop-test-needs" content="mascott=builtin">'), F), /no brand fact "mascott"/);
  assert.throws(() => needsOf('<meta name="slop-test-needs" content="mascot">'), /key=value/);
  const all = loadFacts();
  for (const k of Object.keys(FACTS)) assert.equal(JSON.stringify(all[k]), JSON.stringify(FACTS[k]), k);
  for (const k of ['exportCard', 'donate', 'ads']) assert.equal(all[`support.${k}`], BRAND.support[k], k);
  assert.deepEqual(unmet(needsOf('<meta name="slop-test-needs" content="support.exportCard=true">'), { 'support.exportCard': false }).map((c) => c.key), ['support.exportCard']);
});

test('the pages of the buddy engine need it, the slot needs a mascot, and the off page needs none', () => {
  const needs = (f) => needsOf(readFileSync(path.join(ROOT, f), 'utf8'));
  for (const f of ['tests/buddy/app.test.html', 'tests/buddy/care.test.html', 'tests/buddy/mood.test.html', 'tests/buddy/tips.test.html']) {
    assert.deepEqual(needs(f), [{ key: 'mascot', values: ['builtin'] }], f);
  }
  assert.deepEqual(needs('tests/buddy/off.test.html'), [{ key: 'mascot', values: ['none'] }]);
  const run = readFileSync(path.join(ROOT, 'tests/run.mjs'), 'utf8');
  assert.match(run, /unmet\(needsOf\(/);
});
