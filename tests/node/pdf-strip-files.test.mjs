// Taking text out of whole files the way Edit text does (pdf/js/core/content-res.js, content-fonts.js, content-forms.js with
// content-strip.js), with the vendored pdf-lib in a vm context: text in a Form XObject (alone, shared by two pages, drawn
// twice, four forms deep), in a Type 3 font, in Type 0 fonts with an embedded and a predefined CMap and in fonts with no
// Widths is removed from the file, the rest keeps its place, and what other pages and other Dos draw stays as it was. The
// fixtures are the browser test's (tests/pdf/strip-fixtures.js). Run with: node --test tests/node/pdf-strip-files.test.mjs
// Covers: pdf/js/core/content-res.js, pdf/js/core/content-fonts.js, pdf/js/core/content-forms.js, pdf/js/core/content-cmap.js,
//   pdf/js/core/content-glyphs.js, pdf/js/core/content-strip.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = ['vendor/pdf-lib/pdf-lib.min.js', 'pdf/js/core/content-lex.js', 'pdf/js/core/content-glyphs.js', 'pdf/js/core/content-strip.js',
  'pdf/js/core/content-ink.js', 'pdf/js/core/content-cmap.js', 'pdf/js/core/content-res.js', 'pdf/js/core/content-fonts.js',
  'pdf/js/core/content-forms.js', 'tests/pdf/strip-fixtures.js'];
const W = {};
W.window = W; W.self = W; W.setTimeout = setTimeout; // pdf-lib waits a tick between batches of objects
W.SP = { engine: { vendorBase: () => 'vendor/pdfjs/' } };
W.fetch = async (url) => { const b = readFileSync(path.join(ROOT, url)); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
vm.createContext(W);
for (const f of FILES) vm.runInContext(readFileSync(path.join(ROOT, f), 'utf8'), W, { filename: f });
const { PDFLib: L, SlopPdfLex: Lx, SlopPdfStrip: St, SlopPdfRes: Res, SlopPdfFonts: Fonts, SlopPdfForms: Forms, StripFixtures: Fx } = W;

/** The derive of editor/text-strip.js: page i of the bytes without the targets' text → { bytes, r } (bytes null: not done). */
async function derive(bytes, i, targets) {
  const doc = await L.PDFDocument.load(bytes), page = doc.getPage(i), c = Res.contentOf(doc, page);
  await Fonts.ready(doc, page.node.Resources());
  const res = Res.of(doc, page.node.Resources()), r = St.strip(c.text, res.fonts, targets, res);
  if (!r) return { bytes: null, r };
  Forms.put(doc, page, r);
  Forms.contents(doc, i, c.refs, r.text);
  return { bytes: await doc.save({ useObjectStreams: true }), r };
}
/** The walker options that follow a page's forms (as content-ink.js does). */
function follow(res, depth = 0) {
  return { form: (name) => { const x = depth < 12 ? res.form(name) : null; return x && x.ops ? { ops: x.ops, fonts: x.res.fonts, matrix: x.matrix, opts: follow(x.res, depth + 1) } : null; } };
}
/** Every glyph page i shows, through its forms: [code, x, y] (rounded). */
async function placed(bytes, i) {
  const doc = await L.PDFDocument.load(bytes), page = doc.getPage(i), c = Res.contentOf(doc, page);
  await Fonts.ready(doc, page.node.Resources());
  const res = Res.of(doc, page.node.Resources());
  return St.glyphs(Lx.lex(c.text), res.fonts, follow(res)).map((g) => ({ code: g.code, x: +g.x.toFixed(2), y: +g.y.toFixed(2), g }));
}
/** What the text operators of page i's streams (its content and the forms it draws, read on their own) show, as bytes. */
async function shown(bytes, i) {
  const doc = await L.PDFDocument.load(bytes), page = doc.getPage(i), out = [];
  function read(text, res, depth) {
    for (const o of Lx.lex(text)) {
      if (o.op === 'Tj' || o.op === "'" || o.op === '"') out.push(o.args[o.args.length - 1].str);
      if (o.op === 'TJ') out.push(o.args[0].filter((e) => e && e.str != null).map((e) => e.str).join(''));
      if (o.op === 'Do' && depth < 12) {
        const xd = res && res.lookup(L.PDFName.of('XObject')), st = xd && xd.lookup(L.PDFName.of(o.args[0].name));
        if (st && st.dict) read(Res.streamText(st), st.dict.lookup(L.PDFName.of('Resources')) || res, depth + 1);
      }
    }
  }
  read(Res.contentOf(doc, page).text, page.node.Resources(), 0);
  return out;
}
/** Every text operator of the whole file, every stream: what it shows. */
function inFile(bytes) {
  return L.PDFDocument.load(bytes).then((doc) => doc.context.enumerateIndirectObjects().flatMap(([, o]) => {
    if (!o || !o.dict) return [];
    let t = ''; try { t = Res.streamText(o); } catch (e) { return []; }
    return Lx.lex(t).filter((x) => x.op === 'Tj' || x.op === 'TJ').map((x) => (x.op === 'TJ' ? x.args[0].filter((e) => e && e.str != null).map((e) => e.str).join('') : x.args[0].str));
  }));
}
/** The line of baseline y as a target, from its first glyph to the gap before its tail (if any). */
function lineAt(glyphs, y) {
  const on = glyphs.filter((p) => Math.abs(p.y - y) < 0.5).sort((a, b) => a.x - b.x);
  let end = 0;
  while (end + 1 < on.length && on[end + 1].x - (on[end].g.x + on[end].g.w) < 30) end++;
  return { x0: on[0].x, x1: +(on[end].g.x + on[end].g.w).toFixed(2), y, fs: 12 };
}
const has = (list, s) => list.some((x) => x.includes(s));
const key = (p) => p.code + '@' + p.x + ',' + p.y;

for (const kind of ['wrapped', 'shared', 'twice', 'nested', 'type3', 'cmap', 'ucs2', 'nowidths']) {
  for (const mode of ['line', 'paragraph']) {
    test(`${kind}: a ${mode} goes from the file, the rest stays where it was`, async () => {
      const fx = await Fx.make(L, kind), t = fx.text, enc = fx.enc, before = await placed(fx.bytes, 0);
      const targets = mode === 'line' ? [lineAt(before, 690)] : [lineAt(before, 690), lineAt(before, 674)];
      const { bytes, r } = await derive(fx.bytes, 0, targets);
      assert.ok(bytes, `${kind}: the text is taken out (not covered)`);
      assert.equal(r.dropped, [...(mode === 'line' ? t.a : t.a + t.b)].length);
      const gone = mode === 'line' ? [t.a] : [t.a, t.b], kept = mode === 'line' ? [t.b, t.c, t.d, t.tail, t.head] : [t.c, t.d, t.tail, t.head];
      const page = await shown(bytes, 0);
      // (the second Do of the form drawn twice still draws all of it)
      if (kind !== 'twice') for (const s of gone) for (const w of s.split(' ').filter((w) => w.length > 2)) assert.ok(!has(page, enc(w)), `${kind}: "${w}" is not on the page`);
      for (const s of kept) assert.ok(has(page, s) || has(page, enc(s)), `${kind}: "${s}" stays`);
      // every glyph outside the targets is where it was, and none is left in them
      const after = await placed(bytes, 0), now = new Set(after.map(key));
      const out = before.filter((p) => !St.inTarget(p.g, targets));
      assert.deepEqual([...out.filter((p) => !now.has(key(p))).map(key)], [], 'every other glyph keeps its place');
      assert.equal(after.length, out.length, 'nothing else is drawn');
      if (kind === 'twice') assert.ok(after.some((p) => Math.abs(p.y - 330) < 0.5) && has(page, t.a), 'the second Do draws the whole form');
      if (kind !== 'shared' && kind !== 'twice') {
        const all = await inFile(bytes);
        for (const s of gone) assert.ok(!has(all, enc(s.split(' ')[0])), `${kind}: "${s}" is nowhere in the file`);
      }
    });
  }
}

test('a form shared by two pages: page 1 draws a copy, page 2 the form as it was; the file keeps the form for page 2', async () => {
  const fx = await Fx.make(L, 'shared'), before2 = await placed(fx.bytes, 1), shown2 = await shown(fx.bytes, 1);
  const { bytes } = await derive(fx.bytes, 0, [lineAt(await placed(fx.bytes, 0), 690)]);
  const doc0 = await L.PDFDocument.load(fx.bytes), doc = await L.PDFDocument.load(bytes);
  const xo = (d, i) => d.getPage(i).node.Resources().lookup(L.PDFName.of('XObject'));
  assert.deepEqual([...(await placed(bytes, 1)).map(key)], [...before2.map(key)]);
  assert.deepEqual([...await shown(bytes, 1)], [...shown2]);
  assert.equal(String(xo(doc, 1).get(L.PDFName.of('Fm0'))), String(xo(doc0, 1).get(L.PDFName.of('Fm0'))), 'page 2 draws the same object');
  assert.deepEqual([...xo(doc, 0).keys().map((k) => k.decodeText())], ['Fm0_1'], 'page 1 draws only the copy');
  assert.ok(!has(await shown(bytes, 0), 'Cobalt') && has(await shown(bytes, 1), 'Cobalt'));
});

test('a form drawn twice on a page: only the Do that loses text draws a copy; the form stays for the other', async () => {
  const fx = await Fx.make(L, 'twice'), before = await placed(fx.bytes, 0);
  const { bytes, r } = await derive(fx.bytes, 0, [lineAt(before, 690)]);
  assert.match(r.text, /\/Fm0_1 Do Q q 1 0 0 1 0 -360 cm \/Fm0 Do/);
  assert.equal(r.unused.length, 0, 'Fm0 is still drawn');
  const doc = await L.PDFDocument.load(bytes), xo = doc.getPage(0).node.Resources().lookup(L.PDFName.of('XObject'));
  assert.deepEqual([...xo.keys().map((k) => k.decodeText()).sort()], ['Fm0', 'Fm0_1']);
});

test('nested forms: each level down to the text gets a copy, the old forms leave the file', async () => {
  const fx = await Fx.make(L, 'nested'), before = await placed(fx.bytes, 0), doc0 = await L.PDFDocument.load(fx.bytes);
  const forms = (d) => d.context.enumerateIndirectObjects().filter(([, o]) => o && o.dict && o.dict.get(L.PDFName.of('Subtype')) === L.PDFName.of('Form')).map(([ref]) => String(ref));
  const { bytes, r } = await derive(fx.bytes, 0, [lineAt(before, 690)]);
  const chain = []; for (let f = r; f.forms && f.forms.length; f = f.forms[0]) chain.push(f.forms[0].as);
  assert.deepEqual(chain, ['Fm0_1', 'Fm1_1', 'Fm2_1', 'Fm3_1']);
  const doc = await L.PDFDocument.load(bytes), old = forms(doc0), now = forms(doc);
  assert.equal(now.length, 4);
  assert.deepEqual([...now.filter((x) => old.includes(x))], [], 'no old form is left');
});

test('a Type 3 font is measured by its Widths through the FontMatrix; a Type 0 font by its CMap (one- and two-byte codes)', async () => {
  const doc = await L.PDFDocument.load((await Fx.make(L, 'type3')).bytes), f3 = Res.of(doc, doc.getPage(0).node.Resources()).fonts('T3');
  assert.equal(f3.width(65), (40 + (65 * 7) % 30) * 0.01 * 1000);
  const d2 = await L.PDFDocument.load((await Fx.make(L, 'cmap')).bytes), f0 = Res.of(d2, d2.getPage(0).node.Resources()).fonts('C0');
  assert.deepEqual(JSON.parse(JSON.stringify(f0.codes('A\x80\x01B').map((c) => [c.c, c.b.length]))), [[65, 1], [0x8001, 2], [66, 1]]);
  assert.equal(f0.width(65), 400 + (34 * 37) % 300, 'A is CID 34');
  assert.equal(f0.width(0x8001), 1000, 'CID 201 has the default width');
  const d3 = await L.PDFDocument.load((await Fx.make(L, 'ucs2')).bytes), r3 = d3.getPage(0).node.Resources();
  await Fonts.ready(d3, r3);
  const fu = Res.of(d3, r3).fonts('C0');
  assert.equal(fu.width(0x41), 400 + (34 * 37) % 300, 'UniJIS-UCS2-H: U+0041 is CID 34');
  assert.equal(fu.width(0x3042), 1000);
  // another predefined CMap (UniKS-UCS2-H, which nothing here loaded before) is not guessed until ready() has it
  const ks = d3.context.obj({ Font: { K0: { Type: 'Font', Subtype: 'Type0', Encoding: 'UniKS-UCS2-H', DescendantFonts: [{ Subtype: 'CIDFontType0', W: [34, [777]] }] } } });
  assert.equal(Res.of(d3, ks).fonts('K0'), null);
  await Fonts.ready(d3, ks);
  assert.equal(Res.of(d3, ks).fonts('K0').width(0x41), 777);
});

test('fonts with no Widths are measured as pdf.js does: Georgia by Times-Roman, Verdana by Helvetica, Courier 600', async () => {
  const doc = await L.PDFDocument.load((await Fx.make(L, 'nowidths')).bytes), res = Res.of(doc, doc.getPage(0).node.Resources());
  const times = L.StandardFontEmbedder.for('Times-Roman').font, hel = L.StandardFontEmbedder.for('Helvetica').font;
  assert.equal(res.fonts('G1').width(65), times.getWidthOfGlyph('A'));
  assert.equal(res.fonts('V1').width(119), hel.getWidthOfGlyph('w'));
  const c = doc.context, mk = (o) => W.SlopPdfFonts.read(c, c.obj(o));
  assert.equal(mk({ Type: 'Font', Subtype: 'TrueType', BaseFont: 'CourierNewPSMT' }).width(65), 600);
  assert.equal(mk({ Type: 'Font', Subtype: 'Type1', BaseFont: 'Arial,Bold', Encoding: 'WinAnsiEncoding' }).width(65), L.StandardFontEmbedder.for('Helvetica-Bold').font.getWidthOfGlyph('A'));
  assert.equal(mk({ Type: 'Font', Subtype: 'Type1', BaseFont: 'Foo', Encoding: { Type: 'Encoding', Differences: [65, 'B'] } }).width(65), hel.getWidthOfGlyph('B'));
  assert.equal(mk({ Type: 'Font', Subtype: 'Type1', BaseFont: 'Foo', Encoding: 'MacRomanEncoding' }).width(200), null, 'a code MacRoman does not share with WinAnsi is not guessed');
  assert.equal(mk({ Type: 'Font', Subtype: 'Type0', Encoding: 'Identity-V', DescendantFonts: [{ Subtype: 'CIDFontType2' }] }), null, 'vertical writing is not measured');
});

test('a bold word between two runs, the next kerned back under it: only its glyphs go, the next run keeps its place', async () => {
  const fx = await Fx.make(L, 'kern'), before = await placed(fx.bytes, 0), line = before.filter((p) => p.y === 690);
  const bold = line.slice(6, 10), x1 = +(bold[3].g.x + bold[3].g.w).toFixed(2);
  assert.ok(line[10].x < x1, 'the next run starts inside the bold word\'s box');
  const { bytes, r } = await derive(fx.bytes, 0, [{ x0: bold[0].x, x1, y: 690, fs: 12 }]);
  assert.equal(r.dropped, 4);
  const now = new Set((await placed(bytes, 0)).map(key));
  assert.deepEqual([...before.filter((p) => !bold.includes(p) && !now.has(key(p))).map(key)], []);
});

test('clipping text in a form is not taken out (a cover hides it instead)', async () => {
  const fx = await Fx.make(L, 'clip'), before = await placed(fx.bytes, 0);
  assert.equal((await derive(fx.bytes, 0, [lineAt(before, 690)])).bytes, null);
});
