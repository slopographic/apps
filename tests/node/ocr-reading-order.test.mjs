// Slop OCR: the reading order of OCR pieces. The engine (aitools/workers/ocr-engine.js) finds an item and its price on
// a receipt as two pieces whose boxes start a pixel or two apart; they must read as one line, left to right
// (ocr/js/layout.js rowsOf), not as separate lines sorted by top edge ("Flat white", "3.80", "2.90", "Croissant").
// Run: node --test tests/node/ocr-reading-order.test.mjs
// Covers: ocr/js/layout.js, aitools/workers/ocr-engine.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { rowsOf, linesToText, pairBoxes } from '../../ocr/js/layout.js';

const piece = (text, x, y, w = 200, h = 44) => ({ text, score: 1, box: { x, y, w, h } });
// What PP-OCRv4 gives for the sample receipt's item rows: each price box starts 1 to 2 px higher than its item's.
const RECEIPT = [
  piece('Flat white', 48, 280), piece('3.80', 620, 279, 90), piece('Croissant', 48, 338), piece('2.90', 620, 336, 90),
  piece('Sparkling water', 48, 396, 330), piece('2.20', 620, 395, 90), piece('Total', 48, 520), piece('12.00', 600, 519, 110),
];

test('pieces on one baseline join one line, left to right, rows top to bottom', () => {
  const shuffled = [RECEIPT[1], RECEIPT[3], RECEIPT[0], RECEIPT[2], RECEIPT[7], RECEIPT[5], RECEIPT[4], RECEIPT[6]];
  assert.deepEqual(rowsOf(shuffled).map((r) => r.text), ['Flat white 3.80', 'Croissant 2.90', 'Sparkling water 2.20', 'Total 12.00']);
  assert.equal(linesToText(RECEIPT), 'Flat white 3.80\nCroissant 2.90\nSparkling water 2.20\n\nTotal 12.00');
  const row = rowsOf(RECEIPT)[0].box;
  assert.deepEqual(row, { x: 48, y: 279, w: 662, h: 45 });
});

test('lines a full line apart stay separate, and each text line pairs with its row box', () => {
  const lines = [piece('a', 40, 0), piece('b', 40, 50), piece('c', 300, 51)];
  assert.deepEqual(rowsOf(lines).map((r) => r.text), ['a', 'b c']);
  const pairs = pairBoxes('a\nb c', lines);
  assert.equal(pairs[1].box.x, 40);
  assert.equal(pairs[1].box.w, 460);
});

test('the engine returns pieces in the same reading order', () => {
  const ctx = { self: {} };
  vm.runInNewContext(readFileSync(new URL('../../aitools/workers/ocr-engine.js', import.meta.url), 'utf8'), ctx);
  const order = Array.from(ctx.self.SlopAIOcr.readingOrder(RECEIPT), (l) => l.text);
  assert.deepEqual(order, ['Flat white', '3.80', 'Croissant', '2.90', 'Sparkling water', '2.20', 'Total', '12.00']);
});
