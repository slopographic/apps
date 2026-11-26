// The one rule for old text hidden under covers in Slop PDF (pdf/js/core/covered.js): a cover an edit left (hides: 'text')
// hides the text items, or the runs of their characters, that lie mostly under it; what stays visible of an item becomes
// items of its own in their own place; a drawn whiteout or a hidden cover hides nothing; and in a saved copy only the page's
// own items can be hidden, so the new text drawn over a cover stays. Find, the text layer, Redact ▸ find and the text
// exports all use it. Run with: node --test tests/node/pdf-covered.test.mjs
// Covers: pdf/js/core/covered.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ctx = { SP: {} };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, 'pdf/js/core/covered.js'), 'utf8'), ctx, { filename: 'covered.js' });
const C = ctx.SP.covered;
const plain = (v) => JSON.parse(JSON.stringify(v));

const VIEW = [0, 0, 400, 300]; // a 400 × 300 page: annotation y = 300 - PDF y
/** A text item at PDF (x, y) in a 10 pt font, 5 points per character. */
const item = (str, x, y, more) => Object.assign({ str, width: str.length * 5, height: 10, transform: [10, 0, 0, 10, x, y], fontName: 'f1', hasEOL: false, dir: 'ltr' }, more || {});
/** A cover over PDF user-space box x0..x1, y0..y1, as an edit saves it (annotation space from the top-left). */
const cover = (x0, y0, x1, y1, more) => Object.assign({ id: 'c', type: 'whiteout', hides: 'text', fill: '#ffffff', cx: (x0 + x1) / 2, cy: 300 - (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, rot: 0 }, more || {});

test('covers are only whiteouts that hide text and are not hidden layers, in PDF user space', () => {
  const r = plain(C.rects([cover(10, 95, 60, 110), { id: 'w', type: 'whiteout', cx: 1, cy: 1, w: 5, h: 5 }, cover(0, 0, 5, 5, { hidden: true }), { type: 'rect', hides: 'text', cx: 1, cy: 1, w: 1, h: 1 }], VIEW));
  assert.deepEqual(r, [{ x0: 10, x1: 60, y0: 95, y1: 110 }]);
  // a view box that does not start at 0 moves them with it; a turned cover counts by its bounds
  const t = C.rects([cover(10, 95, 60, 110, { rot: 90 })], [100, 50, 500, 350]).map((r) => [r.x0, r.x1, r.y0, r.y1].map((v) => Math.round(v * 1000) / 1000));
  assert.deepEqual(plain(t), [[127.5, 142.5, 127.5, 177.5]]);
});

test('an item mostly under a cover is hidden; one beside it, or only touched, is not', () => {
  assert.equal(C.hidden(item('hello', 20, 100), C.rects([cover(21, 96, 44, 109)], VIEW)), true, 'its outer letters mostly covered');
  assert.equal(C.hidden(item('hello', 20, 100), C.rects([cover(20, 96, 38, 109)], VIEW)), false, 'its last letters show');
  const it = item('hello', 20, 100); // x 20..45, band y 98..107.5
  const on = C.rects([cover(18, 96, 47, 109)], VIEW);
  assert.equal(C.hidden(it, on), true);
  assert.equal(C.hidden(it, C.rects([cover(100, 96, 140, 109)], VIEW)), false, 'elsewhere on the page');
  assert.equal(C.mask(it, C.rects([cover(18, 106, 47, 120)], VIEW)), null, 'a cover over the line above only grazes its top');
  assert.equal(C.hidden(it, C.rects([cover(18, 96, 47, 109, { hides: undefined })], VIEW)), false, 'a whiteout drawn with the tool hides nothing');
  // two covers that hide it together (one per half) count as one
  assert.equal(C.hidden(it, C.rects([cover(18, 96, 33, 109), cover(32, 96, 47, 109)], VIEW)), true);
  // text that runs up the page (turned 90°): its box turns with it
  const up = item('hello', 50, 100, { transform: [0, 10, -10, 0, 50, 100] }); // x 42.5..52, y 100..125
  assert.equal(C.hidden(up, C.rects([cover(40, 98, 54, 127)], VIEW)), true);
  assert.equal(C.hidden(up, C.rects([cover(18, 96, 47, 109)], VIEW)), false);
});

test('a cover over part of an item hides those characters; the rest stays as items in their own place', () => {
  const it = item('A paragraph of two', 40, 160, { hasEOL: true }); // characters 5 points wide from x 40
  // Replace all covers "paragraph" (characters 2..10: x 50..95) and a little around it
  const m = C.mask(it, C.rects([cover(49.6, 157.6, 95.4, 168)], VIEW));
  assert.equal(m.map((v) => (v ? 'x' : '.')).join(''), '..xxxxxxxxx.......');
  const parts = plain(C.pieces(it, m));
  assert.deepEqual(parts.map((q) => q.str), ['A ', ' of two']);
  assert.deepEqual(parts.map((q) => q.transform[4]), [40, 95], 'each part starts where its characters are');
  assert.deepEqual(parts.map((q) => Math.round(q.width * 1000) / 1000), [10, 35]);
  assert.deepEqual(parts.map((q) => q.hasEOL), [false, true], 'the line end stays on the last part');
  assert.equal(parts[0].fontName, 'f1');
  // measured shares place the parts by the glyphs (a wide first letter)
  const frac = (x, k) => (k === 0 ? 0 : (k + 3) / (x.str.length + 3));
  const wide = C.pieces(item('Wxy', 0, 0), [false, true, false], frac);
  assert.deepEqual(plain(wide).map((q) => [q.str, q.transform[4], Math.round(q.width * 1000) / 1000]), [['W', 0, 10], ['y', 12.5, 2.5]]);
});

test('a text content loses what covers hide, keeps its line ends, and is the same object when nothing is hidden', () => {
  const tc = { items: [item('The browser is the new print shop', 40, 260), { str: '', hasEOL: true, transform: [1, 0, 0, 1, 0, 0], width: 0 }, item('Other words', 40, 200, { hasEOL: true })], styles: { f1: { fontFamily: 'sans-serif' } }, lang: 'en' };
  const line = C.rects([cover(38, 255, 210, 274)], VIEW);
  const out = C.visible(tc, line);
  assert.notEqual(out, tc);
  assert.deepEqual(plain(out.items.map((q) => q.str)), ['', 'Other words'], 'the hidden line goes; the line end after it stays');
  assert.equal(out.styles, tc.styles, 'the styles and the rest of the content stay');
  assert.equal(out.lang, 'en');
  assert.equal(tc.items[0].str, 'The browser is the new print shop', 'the content given is not changed');
  assert.equal(C.visible(tc, C.rects([cover(300, 10, 320, 20)], VIEW)), tc);
  assert.equal(C.visible(tc, []), tc);
  // an item that ended a line keeps the line end on an empty item
  const eol = C.visible({ items: [item('gone', 0, 100, { hasEOL: true }), item('next', 0, 80)] }, C.rects([cover(-2, 96, 22, 109)], VIEW));
  assert.deepEqual(plain(eol.items).map((q) => [q.str, q.hasEOL]), [['', true], ['next', false]]);
});

test('in a saved copy only the page\'s own items are hidden: the new text drawn over the cover stays', () => {
  const own = { items: [item('The browser is the new print shop', 40, 260), item('Other words', 40, 200)] };
  const rects = C.rects([cover(38, 255, 210, 274)], VIEW);
  // the saved copy: the page's content, then the new text "Hi" an edit drew over the cover on the same baseline
  const saved = { items: [item('The browser is the new print shop', 40, 260), item('Other words', 40, 200), item('Hi', 40, 260, { fontName: 'f9' })] };
  assert.deepEqual(plain(C.visible(saved, rects, { only: C.keys(own) }).items.map((q) => q.str)), ['Other words', 'Hi']);
  // without the page's own items to go by, the new text would be hidden too
  assert.deepEqual(plain(C.visible(saved, rects).items.map((q) => q.str)), ['Other words']);
  // replaced by the very same words: the first (the page's) goes, the one drawn over it stays
  const same = { items: [item('The browser is the new print shop', 40, 260), item('The browser is the new print shop', 40, 260, { fontName: 'f9' })] };
  assert.deepEqual(plain(C.visible(same, rects, { only: C.keys(own) }).items.map((q) => q.str)), ['The browser is the new print shop']);
  assert.equal(C.visible(same, rects, { only: C.keys(own) }).items[0].fontName, 'f9');
  assert.equal(C.keys(own).get(C.key(own.items[0])), 1);
});

test('the covers\' key changes when a cover comes, moves or goes, and not for other annotations', () => {
  const p = { annots: [{ id: 't', type: 'text', cx: 1, cy: 1, w: 1, h: 1 }] };
  const none = C.sig(p);
  p.annots.push(cover(10, 10, 20, 20));
  const one = C.sig(p);
  assert.notEqual(one, none);
  p.annots[1].cx += 5;
  assert.notEqual(C.sig(p), one);
  p.annots[1].hidden = true;
  assert.equal(C.sig(p), none);
  assert.equal(C.sig(null), '');
});
