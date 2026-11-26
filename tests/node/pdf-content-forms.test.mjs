// Text taken out of the forms a page draws, and fonts measured by their CMaps (pdf/js/core/content-strip.js, content-glyphs.js,
// content-cmap.js), pure: a form that loses glyphs gets a copy for that one Do (under a new name), nested forms a copy at
// each level, and the names nothing draws any more are listed; CMaps split codes of one to four bytes and give their CIDs,
// read from an embedded CMap's text and from pdf.js's packed CMaps (vendor/pdfjs/cmaps). The whole-file side (pdf-lib) is
// tests/node/pdf-strip-files.test.mjs. Run with: node --test tests/node/pdf-content-forms.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Lx = require('../../pdf/js/core/content-lex.js');
const St = require('../../pdf/js/core/content-strip.js');
const G = require('../../pdf/js/core/content-glyphs.js');
const CM = require('../../pdf/js/core/content-cmap.js');

const fonts = (n) => (n === 'F1' ? { width: () => 500 } : null);
/** Resources for strip: forms by name ({ src, matrix, res }, res null: the form uses its caller's), names taken. */
function resOf(forms, taken = []) {
  const res = { fonts, has: (n) => n in forms || taken.includes(n), form: (n) => {
    const f = forms[n];
    return f ? { src: f.src, ops: Lx.lex(f.src), matrix: f.matrix || null, res: f.res === null ? res : f.res || resOf({}) } : null;
  } };
  return res;
}
const HELLO = 'BT /F1 10 Tf 50 700 Td (Hello) Tj 0 -20 Td (Other) Tj ET';

test('text in a form is found where its Do puts it; that Do draws a copy, the other Do the form as it was', () => {
  const src = 'q 1 0 0 1 10 20 cm /Fm0 Do Q /Fm0 Do';
  const res = resOf({ Fm0: { src: HELLO, matrix: [1, 0, 0, 1, 0, -100] } });
  const r = St.strip(src, fonts, [{ x0: 55, x1: 90, y: 620, fs: 10 }], res);
  assert.equal(r.dropped, 5);
  assert.equal(r.text, 'q 1 0 0 1 10 20 cm /Fm0_1 Do Q /Fm0 Do');
  assert.equal(r.first, Lx.lex(src).findIndex((o) => o.op === 'Do'));
  assert.equal(r.forms.length, 1);
  assert.deepEqual([r.forms[0].name, r.forms[0].as], ['Fm0', 'Fm0_1']);
  assert.equal(r.forms[0].text, HELLO.replace('(Hello) Tj ', '[-2500] TJ '));
  assert.deepEqual(r.unused, [], 'Fm0 is still drawn by the second Do');
  // the second Do's text, at its own place, is the one that goes when it is the target
  const r2 = St.strip(src, fonts, [{ x0: 45, x1: 80, y: 580, fs: 10 }], res);
  assert.equal(r2.text, 'q 1 0 0 1 10 20 cm /Fm0 Do Q /Fm0_1 Do');
  assert.equal(r2.forms[0].text, HELLO.replace('(Other) Tj', ''));
});

test('a form drawn once: its name is left out of the copy of the resources; a new name is never one already there', () => {
  const r = St.strip('/Fm0 Do', fonts, [{ x0: 45, x1: 80, y: 700, fs: 10 }], resOf({ Fm0: { src: HELLO } }, ['Fm0_1']));
  assert.equal(r.text, '/Fm0_2 Do');
  assert.deepEqual(r.unused, ['Fm0']);
  // two Dos of one form that both lose text: two copies
  const two = St.strip('/Fm0 Do q 1 0 0 1 0 -300 cm /Fm0 Do Q', fonts, [{ x0: 45, x1: 80, y: 700, fs: 10 }, { x0: 45, x1: 80, y: 400, fs: 10 }], resOf({ Fm0: { src: HELLO } }));
  assert.equal(two.text, '/Fm0_1 Do q 1 0 0 1 0 -300 cm /Fm0_2 Do Q');
  assert.deepEqual(two.unused, ['Fm0']);
});

test('nested forms: a copy at every level down to the text, each drawn under a new name by its parent copy', () => {
  const inner = resOf({ Fm2: { src: HELLO, matrix: [1, 0, 0, 1, 0, 10] } });
  const mid = resOf({ Fm1: { src: 'q 2 0 0 2 0 0 cm /Fm2 Do Q (x) Tj', res: inner } });
  const res = resOf({ Fm0: { src: '/Fm1 Do', res: mid } });
  // Fm2's "Hello" lands at (100, 1420) at size 20, under Fm1's scale
  const r = St.strip('BT /F1 10 Tf 1 0 0 1 300 300 Tm (Kept) Tj ET /Fm0 Do', fonts, [{ x0: 100, x1: 150, y: 1420, fs: 20 }], res);
  assert.equal(r.text, 'BT /F1 10 Tf 1 0 0 1 300 300 Tm (Kept) Tj ET /Fm0_1 Do');
  const f0 = r.forms[0], f1 = f0.forms[0], f2 = f1.forms[0];
  assert.deepEqual([f0.as, f0.text, f0.unused], ['Fm0_1', '/Fm1_1 Do', ['Fm1']]);
  assert.deepEqual([f1.as, f1.text, f1.unused], ['Fm1_1', 'q 2 0 0 2 0 0 cm /Fm2_1 Do Q (x) Tj', ['Fm2']]);
  assert.equal(f2.text, HELLO.replace('(Hello) Tj ', '[-2500] TJ '));
  assert.deepEqual(f2.forms, []);
});

test('a form with no resources of its own draws by its caller\'s names: none is left out then', () => {
  const res = resOf({ Fm0: { src: HELLO + ' /Fm1 Do', res: null }, Fm1: { src: 'BT /F1 10 Tf 0 0 Td (z) Tj ET' } });
  const r = St.strip('/Fm0 Do', fonts, [{ x0: 45, x1: 80, y: 700, fs: 10 }], res);
  assert.equal(r.forms[0].as, 'Fm0_1');
  assert.deepEqual(r.unused, []);
});

test('clipping or invisible text in a form, or a form inside itself: nothing is taken out, and the walk ends', () => {
  assert.equal(St.strip('/Fm0 Do', fonts, [{ x0: 45, x1: 80, y: 700, fs: 10 }], resOf({ Fm0: { src: HELLO.replace('BT', 'BT 7 Tr') } })), null);
  assert.equal(St.strip('/Fm0 Do', fonts, [{ x0: 45, x1: 80, y: 700, fs: 10 }], resOf({ Fm0: { src: HELLO.replace('BT', 'BT 3 Tr') } })), null);
  const loop = { fonts, has: () => false, form: () => ({ src: '/Fm0 Do /Fm0 Do', ops: Lx.lex('/Fm0 Do /Fm0 Do'), matrix: null, res: loop }) };
  assert.equal(St.strip('/Fm0 Do', fonts, [{ x0: 0, x1: 10, y: 0, fs: 10 }], loop), null);
});

test('slanted text (a synthetic italic) is upright on its baseline; a glyph of unknown width loses the pen until the next line', () => {
  const r = St.strip('BT /F1 10 Tf 1 0 0.3 1 50 700 Tm (Hello) Tj ET', fonts, [{ x0: 50, x1: 75, y: 700, fs: 10 }]);
  assert.equal(r.dropped, 5);
  const f = (n) => (n === 'F1' ? { width: (c) => (c === 63 ? null : 500) } : null); // "?" cannot be measured
  const src = 'BT /F1 10 Tf 50 700 Td (ab?cd) Tj 0 -20 Td (ef) Tj ET';
  assert.deepEqual(G.glyphs(Lx.lex(src), f).map((g) => String.fromCharCode(g.code)), ['a', 'b', 'e', 'f']);
  assert.equal(St.strip(src, f, [{ x0: 50, x1: 60, y: 700, fs: 10 }]).text, 'BT /F1 10 Tf 50 700 Td [-1000 <3f6364>] TJ 0 -20 Td (ef) Tj ET');
  assert.equal(St.strip(src, f, [{ x0: 62, x1: 90, y: 700, fs: 10 }]), null);
});

test('a span that loses a glyph loses the text it stands for (ActualText); the other spans stay byte for byte', () => {
  const src = 'BT /F1 10 Tf 50 700 Td /Span <</ActualText (fi) /MCID 3>> BDC (\x01) Tj EMC /Span <</ActualText (x)>> BDC (y) Tj EMC ET';
  const r = St.strip(src, fonts, [{ x0: 50, x1: 54, y: 700, fs: 10 }]);
  assert.equal(r.text, 'BT /F1 10 Tf 50 700 Td /Span <</MCID 3>> BDC [-500] TJ EMC /Span <</ActualText (x)>> BDC (y) Tj EMC ET');
  // a span in the page around a form's Do whose text goes
  const f = St.strip('/P <</ActualText <feff0041> /Alt (A)>> BDC /Fm0 Do EMC', fonts, [{ x0: 45, x1: 80, y: 700, fs: 10 }], resOf({ Fm0: { src: HELLO } }));
  assert.equal(f.text, '/P <<>> BDC /Fm0_1 Do EMC');
});

test('an embedded CMap: codes of one to four bytes by its codespace ranges, CIDs by cidrange and cidchar, WMode, usecmap', () => {
  const cm = CM.parse('/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /T def /WMode 0 def\n' +
    '4 begincodespacerange <00> <7f> <8000> <8fff> <900000> <90ffff> <a0000000> <a0ffffff> endcodespacerange\n' +
    '2 begincidrange <20> <7e> 1 <8000> <80ff> 500 endcidrange 2 begincidchar <900002> 7 <a0000003> 9 endcidchar\n' +
    '/Other-H usecmap endcmap CMapName currentdict /CMap defineresource pop end end');
  const codes = CM.codes(cm, 'A\x80\x01\x90\x00\x02\xa0\x00\x00\x03\xff');
  assert.deepEqual(codes.map((c) => [c.c, c.b.length]), [[0x41, 1], [0x8001, 2], [0x900002, 3], [0xa0000003, 4], [0, 1]]);
  assert.deepEqual(codes.map((c) => CM.cid(cm, c.c)), [34, 501, 7, 9, 0]);
  assert.equal(CM.cid(cm, 0x8f00), 0x8f00, 'a code with no CID is measured by itself, as pdf.js does');
  assert.equal(cm.use, 'Other-H');
  assert.equal(cm.vertical, false);
  assert.equal(CM.parse('/WMode 1 def 1 begincodespacerange <0000> <ffff> endcodespacerange').vertical, true);
  const base = CM.parse('1 begincodespacerange <0000> <ffff> endcodespacerange 1 begincidchar <0001> 42 endcidchar');
  const ext = CM.extend(CM.parse('1 begincidchar <0002> 43 endcidchar'), base);
  assert.deepEqual(CM.codes(ext, '\x00\x01\x00\x02').map((c) => CM.cid(ext, c.c)), [42, 43]);
  assert.deepEqual(CM.codes(CM.identity(false), '\x01\x02\x03').map((c) => [c.c, c.b.length]), [[0x0102, 2], [0x0300, 1]]);
});

test("pdf.js's packed CMaps: UCS-2, Shift-JIS (one- and two-byte codes) and a vertical CMap that uses its horizontal one", () => {
  const read = (n) => CM.binary(new Uint8Array(readFileSync(new URL('../../vendor/pdfjs/cmaps/' + n + '.bcmap', import.meta.url))));
  const ucs = read('UniJIS-UCS2-H');
  assert.deepEqual([0x20, 0x41, 0x3042, 0x4e00].map((c) => CM.cid(ucs, c)), [1, 34, 843, 1200]);
  const sjis = read('90ms-RKSJ-H'), codes = CM.codes(sjis, 'A\x82\xa0\xb1');
  assert.deepEqual(codes.map((c) => [c.c, c.b.length]), [[0x41, 1], [0x82a0, 2], [0xb1, 1]]);
  assert.equal(CM.cid(sjis, 0x82a0), 843, 'Shift-JIS あ is the CID of U+3042');
  const v = read('UniJIS-UCS2-V');
  assert.equal(v.vertical, true);
  assert.equal(v.use, 'UniJIS-UCS2-H');
  assert.equal(CM.cid(CM.extend(v, ucs), 0x41), 34);
  assert.equal(CM.binary(new Uint8Array([0, 0x03])), null, 'cut-off data does not read');
});
