// Slop PDF watermark layers as data (pdf/js/core/watermark.js): the anchor maths, the page ranges, the stacking order,
// the legacy single watermark, and undo/redo of every change through the real history (core/history.js + model.js).
// Run with: node --test tests/node/pdf-watermark.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';  // loose deepEqual: the layer arrays come from another realm (vm)
import vm from 'node:vm';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['core/util', 'core/model', 'core/history', 'core/watermark']) {
  vm.runInContext(readFileSync(path.join(ROOT, 'pdf', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
}
const W = ctx.SlopPdfWm, E = ctx.SP.engine;
const plain = (v) => JSON.parse(JSON.stringify(v));
const text = (over) => W.normalize(Object.assign({ id: undefined, kind: 'text', text: 'DRAFT', size: 40 }, over));
/** Fixed-width glyphs: 0.5 em per character (enough for the box maths). */
const content = (L) => ({ w: L.text.length * L.size * 0.5, h: L.size * 1.2 });

test('anchors: the box is aligned to the chosen point of the page, then offset (dx right, dy down)', () => {
  const c = { w: 100, h: 50 };
  const at = (anchor, dx = 0, dy = 0) => W.box(W.normalize({ kind: 'text', anchor, dx, dy, rot: 0, id: 'x' }), 400, 300, c);
  assert.deepEqual(plain([at('mc').cx, at('mc').cy]), [200, 150]);
  assert.deepEqual(plain([at('tl', 10, 5).cx, at('tl', 10, 5).cy]), [60, 30]);
  assert.deepEqual(plain([at('br', -10, -20).cx, at('br', -10, -20).cy]), [340, 255]);
  assert.deepEqual(plain([at('tc').cx, at('tc').cy]), [200, 25]);
  assert.deepEqual(plain([at('mr').cx, at('mr').cy]), [350, 150]);
  assert.deepEqual(plain([at('bl').cx, at('bl').cy]), [50, 275]);
  assert.equal(at('mc').w, 100);
  assert.equal(at('mc').h, 50);
});

test('the rotation of a layer is kept on its box; unknown anchors fall back to the centre', () => {
  const L = W.normalize({ kind: 'image', anchor: 'nope', rot: 30, id: 'x' });
  assert.equal(L.anchor, 'mc');
  assert.equal(W.box(L, 200, 100, { w: 10, h: 10 }).rot, 30);
});

test('page ranges: numbers, ranges, open ranges, last, odd and even; unreadable text is refused', () => {
  assert.deepEqual(W.parsePages('1-3, 5', 6), [0, 1, 2, 4]);
  assert.deepEqual(W.parsePages('4-', 5), [3, 4]);
  assert.deepEqual(W.parsePages('last', 5), [4]);
  assert.deepEqual(W.parsePages('odd', 5), [0, 2, 4]);
  assert.deepEqual(W.parsePages('even', 5), [1, 3]);
  assert.deepEqual(W.parsePages('', 3), [0, 1, 2]);
  assert.deepEqual(W.parsePages('2-9', 4), [1, 2, 3], 'pages past the end are ignored');
  assert.throws(() => W.parsePages('x', 3), /not a page number/);
  assert.throws(() => W.parsePages('3-1', 5), /not a valid page range/);
});

test('a layer is drawn only where it is shown and its pages cover the page', () => {
  assert.equal(W.appliesTo(text({ pages: '' }), 0, 3), true);
  assert.equal(W.appliesTo(text({ pages: '2' }), 0, 3), false);
  assert.equal(W.appliesTo(text({ pages: '2' }), 1, 3), true);
  assert.equal(W.appliesTo(text({ show: false }), 1, 3), false, 'a hidden layer draws nowhere');
  assert.equal(W.appliesTo(text({ pages: 'x y' }), 0, 3), false, 'an unreadable range draws nowhere');
});

test('stacking: the list is bottom first; move, duplicate and remove keep the order', () => {
  let L = [];
  L = W.add(L, text({ id: 'a', text: 'A' }));
  L = W.add(L, text({ id: 'b', text: 'B' }));
  assert.deepEqual(L.map((x) => x.id), ['a', 'b'], 'a new layer goes on top');
  assert.deepEqual(W.move(L, 'a', 1).map((x) => x.id), ['b', 'a'], 'move up: drawn later');
  assert.deepEqual(W.move(L, 'b', 1).map((x) => x.id), ['a', 'b'], 'the top layer cannot move up');
  assert.deepEqual(W.move(L, 'a', -1).map((x) => x.id), ['a', 'b'], 'the bottom layer cannot move down');
  const copy = W.duplicate(L, 'a', 'c');
  assert.deepEqual(copy.map((x) => x.id), ['a', 'c', 'b'], 'a copy sits just above its original');
  assert.equal(copy[1].text, 'A');
  assert.deepEqual(W.remove(copy, 'c').map((x) => x.id), ['a', 'b']);
  assert.deepEqual(W.add(L, text({ id: 'z' }), 0).map((x) => x.id), ['z', 'a', 'b'], 'an index puts a layer at that place');
  assert.equal(L.length, 2, 'the input list is not changed');
});

test('a document with one watermark object from before layers reads as one layer', () => {
  const layers = W.fromStamps({ watermark: { text: 'DRAFT', size: 40, opacity: 0.3, angle: 30, color: '#ff0000' } });
  assert.equal(layers.length, 1);
  assert.deepEqual([layers[0].text, layers[0].size, layers[0].opacity, layers[0].rot, layers[0].colour], ['DRAFT', 40, 0.3, 30, '#ff0000']);
  assert.deepEqual(W.fromStamps({}), []);
});

test('values are kept in range and a colour must be a hex colour', () => {
  const L = W.normalize({ kind: 'text', opacity: 2, rot: 400, colour: 'red', size: -5, dx: 1e6 });
  assert.equal(L.opacity, 1);
  assert.equal(L.rot, 180);
  assert.equal(L.colour, '#888888');
  assert.equal(L.size, 4);
  assert.equal(L.dx, 5000);
});

test('every change is one undo step: add, move, duplicate, change, hide, change pages and remove', () => {
  const st = () => plain(E.state.stamps.watermarks || []);
  /** Each change is applied to the same two layers, undone, and checked: one step, undone exactly, redone exactly. */
  const step = (label, fn) => {
    const before = st();
    E.commit(label, (s) => { s.stamps.watermarks = fn(s.stamps.watermarks || []); delete s.stamps.watermark; });
    const after = st();
    assert.notDeepEqual(after, before, label + ' changes the layers');
    assert.equal(E.undo(), label, 'it is one undo step named after the change');
    assert.deepEqual(st(), before, 'undo restores the layers exactly');
    assert.equal(E.redo(), label);
    assert.deepEqual(st(), after, 'redo puts the change back');
    E.undo();
  };
  E.resetHistory();
  E.state = E.blankState();
  E.commit('set up', (s) => { s.stamps.watermarks = [text({ id: 'a', text: 'A' }), text({ id: 'b', text: 'B' })]; });
  E.resetHistory();
  step('Add text layer', (L) => W.add(L, text({ id: 'c', text: 'C' })));
  step('Move layer up', (L) => W.move(L, 'a', 1));
  step('Duplicate layer', (L) => W.duplicate(L, 'a', 'd'));
  step('Change size', (L) => W.update(L, 'a', { size: 90 }));
  step('Hide layer', (L) => W.update(L, 'a', { show: false }));
  step('Change pages', (L) => W.update(L, 'a', { pages: '1-2' }));
  step('Remove layer', (L) => W.remove(L, 'a'));
  assert.deepEqual(st().map((x) => x.id), ['a', 'b'], 'the set-up layers are unchanged after every step was undone');
});

test('the layer maths is pure: the content size is the only thing measured', () => {
  const L = text({ text: 'ABCD', size: 20 });
  const b = W.box(L, 300, 200, content(L));
  assert.equal(b.w, 40);
  assert.equal(b.h, 24);
  assert.equal(b.cx, 150);
});
