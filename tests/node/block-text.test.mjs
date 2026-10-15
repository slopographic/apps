import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { extract } = require('../../pdf/js/editor/block-text.js');

const span = (text, left, top, width = 40, height = 12) => ({ text, rect: { left, top, right: left + width, bottom: top + height } });

test('words in a box come out line by line, left to right', () => {
  const spans = [span('World', 60, 10), span('Hello', 10, 10), span('Second', 10, 30)];
  assert.equal(extract(spans, { left: 0, top: 0, right: 200, bottom: 100 }), 'Hello World\nSecond');
});

test('a word whose centre is outside the box is left out, not cut in half', () => {
  const spans = [span('Inside', 10, 10), span('Edge', 190, 10)];
  assert.equal(extract(spans, { left: 0, top: 0, right: 200, bottom: 100 }), 'Inside');
});

test('a box dragged in any direction gives the same text', () => {
  const spans = [span('One', 10, 10), span('Two', 60, 10)];
  assert.equal(extract(spans, { left: 200, top: 100, right: 0, bottom: 0 }), 'One Two');
});

test('touching spans join without a space, separated words get one', () => {
  const spans = [span('Hel', 10, 10, 20), span('lo', 30, 10, 14), span('there', 60, 10, 30)];
  assert.equal(extract(spans, { left: 0, top: 0, right: 200, bottom: 100 }), 'Hello there');
});

test('empty or blank spans and an empty box give an empty string', () => {
  assert.equal(extract([span('   ', 10, 10)], { left: 0, top: 0, right: 200, bottom: 100 }), '');
  assert.equal(extract([], { left: 0, top: 0, right: 10, bottom: 10 }), '');
});
