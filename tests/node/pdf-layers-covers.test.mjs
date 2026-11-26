// Covers over old text in Slop PDF's layer stack (pdf/js/core/layers.js): a cover an edit made (hides: 'text', of: its new
// text) is not a layer of its own (not listed, not counted), a whiteout drawn with the Whiteout tool still is, moving a layer
// up or down passes over covers and keeps each cover right under its text, and a cover whose text is gone stays put.
// Run with: node --test tests/node/pdf-layers-covers.test.mjs
// Covers: pdf/js/core/layers.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** core/layers.js in a context of its own (SP.util.t gives the key back with its vars). */
function load() {
  const ctx = { SP: { util: { t: (k, v) => k + (v ? JSON.stringify(v) : '') } } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(path.join(ROOT, 'pdf/js/core/layers.js'), 'utf8'), ctx, { filename: 'layers.js' });
  return ctx.SP.layers;
}
const cover = (id, of) => Object.assign({ id, type: 'whiteout', hides: 'text', fill: '#ffffff' }, of ? { of } : {});
const ids = (p) => Array.from(p.annots, (a) => a.id); // an array of this realm (the stack may be one the script made)

test('a cover an edit made is not a layer; a drawn whiteout and the new text are', () => {
  const L = load(), p = { id: 'p', annots: [{ id: 'r', type: 'rect' }, cover('c', 't'), { id: 't', type: 'text' }, { id: 'w', type: 'whiteout', fill: '#fff' }] };
  assert.equal(L.isCover(p.annots[1]), true);
  assert.equal(L.isCover(p.annots[3]), false, 'the Whiteout tool\'s box is an ordinary layer');
  assert.equal(L.isCover({ type: 'rect', hides: 'text' }), false);
  const items = L.items(p);
  assert.deepEqual(Array.from(items, (it) => it.a.id), ['w', 't', 'r'], 'top first, no cover');
  assert.deepEqual(Array.from(items, (it) => it.index), [3, 2, 0], 'each item keeps its place in the stack');
  assert.ok(items[0].name.includes('layer_whiteout'), 'the whiteout is numbered as the first whiteout: ' + items[0].name);
});

test('moving the text down passes over its cover and the cover stays right under it', () => {
  const L = load(), st = { pages: [{ id: 'p', annots: [{ id: 'r', type: 'rect' }, cover('c', 't'), { id: 't', type: 'text' }] }] };
  assert.equal(L.move(st, 'p', 't', -1), true);
  assert.deepEqual(ids(st.pages[0]), ['c', 't', 'r'], 'the text went under the rectangle, with its cover');
  assert.equal(L.move(st, 'p', 't', -1), false, 'it is the bottom layer now: only its cover is under it');
  assert.equal(L.move(st, 'p', 'r', -1), true);
  assert.deepEqual(ids(st.pages[0]), ['r', 'c', 't']);
  assert.equal(L.move(st, 'p', 'r', 1), true, 'the rectangle goes over the text, past the cover');
  assert.deepEqual(ids(st.pages[0]), ['c', 't', 'r']);
  assert.equal(L.move(st, 'p', 'c', 1), false, 'a cover is not moved on its own');
});

test('keepCovers puts covers back under their text; a cover whose text is gone stays where it is', () => {
  const L = load(), p = { id: 'p', annots: [{ id: 't', type: 'text' }, cover('c1', 't'), cover('c2', 't'), cover('o', 'gone'), { id: 'r', type: 'rect' }] };
  L.keepCovers(p);
  assert.deepEqual(ids(p), ['c1', 'c2', 't', 'o', 'r']);
  const q = { id: 'q', annots: [cover('x'), { id: 'r', type: 'rect' }] };
  L.keepCovers(q);
  assert.deepEqual(ids(q), ['x', 'r'], 'a cover of a removal (no text) is left alone');
});
