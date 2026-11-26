// Slop PDF: a line of text cut into runs, one font each (pdf/js/core/text-intl.js runsOf, with the real SlopBidi and
// SlopScripts). Every run names a font, also for a line of only spaces, digits and punctuation: that is what an edited
// text holds after its letters are deleted, and a run without a font made saving fail
// ("Cannot read properties of null (reading 'indexOf')" in embedTextFont).
// Covers: pdf/js/core/text-intl.js, shared/fonts/bidi.js, shared/fonts/scripts.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
globalThis.window = globalThis;
const S = require('../../shared/fonts/scripts.js');
require('../../shared/fonts/bidi.js');

// Helvetica sets printable ASCII; the prepared language faces set their script plus spaces, digits and punctuation.
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const ascii = range(0x20, 0x7e);
const faces = {
  'lang:noto-hebrew|400': { cs: new Set([...ascii, ...range(0x591, 0x5f4)]) },
  'lang:noto-arabic|400': { cs: new Set([...ascii, ...range(0x600, 0x6ff)]) },
  'lang:noto-jp|400': { cs: new Set([...ascii, ...range(0x3040, 0x30ff), ...range(0x4e00, 0x9fff)]) }
};
let ready = true;   // false: no language face is prepared yet
const E = {
  face: (k) => (ready ? faces[k] : undefined),
  charsetOf: (k) => (E.face(k) ? E.face(k).cs : new Set(ascii))
};
window.SP = { engine: E };
window.SlopFontJIT = { packFor: (cp) => S.packOf(cp, { han: 'jp' }) };
vm.runInThisContext(readFileSync(new URL('../../pdf/js/core/text-intl.js', import.meta.url), 'utf8'));

const plain = (runs) => runs.map((r) => [r.text, r.font]);

test('a line of only spaces, digits or punctuation is set in the text\'s own font', () => {
  for (const line of ['45', '   ', '1.5 %', '(12)', '- - -', '2026-11-26', '#!?', '‍']) {
    const runs = E.runsOf(line, 'Helvetica');
    assert.ok(runs.length > 0, line);
    for (const r of runs) assert.equal(r.font, 'Helvetica', JSON.stringify(line));
    assert.equal(runs.map((r) => r.text).join(''), line);
  }
  assert.deepEqual(plain(E.runsOf('45', 'Times-Bold')), [['45', 'Times-Bold']]);
});

test('a right-to-left text with its letters deleted keeps its font too', () => {
  assert.deepEqual(plain(E.runsOf('123 ,45', 'lang:noto-hebrew|400')), [['123 ,45', 'lang:noto-hebrew|400']]);
  // the digits beside Hebrew still take the Hebrew font around them
  const runs = E.runsOf('מחיר 45', 'Helvetica');
  assert.ok(runs.every((r) => r.font === 'lang:noto-hebrew|400'), JSON.stringify(plain(runs)));
});

test('3000 mixed lines, with and without a ready language font: every run has a font and text, and no character is lost', () => {
  const alphabet = Array.from('ab Z09 .,-()%# ‍מחיר مرحبا ひらがな漢字😀\n');
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (const r of [true, false]) {
    ready = r;
    for (let i = 0; i < 3000; i++) {
      let line = '';
      for (let n = 1 + rnd(12); n > 0; n--) line += alphabet[rnd(alphabet.length)];
      const runs = E.runsOf(line, 'Helvetica');
      for (const run of runs) {
        assert.equal(typeof run.font, 'string', JSON.stringify(line));
        assert.ok(run.font.length && run.text.length, JSON.stringify(line));
      }
      assert.deepEqual([...runs.map((x) => x.text).join('')].sort(), [...line].sort(), JSON.stringify(line));
    }
  }
  ready = true;
});

test('an empty line is one empty run in the text\'s font', () => {
  assert.deepEqual(plain(E.runsOf('', 'Helvetica')), [['', 'Helvetica']]);
});
