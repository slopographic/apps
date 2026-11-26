/* Fixtures for taking text out of pages that real files make hard (tests/node/pdf-strip-files.test.mjs and
   tests/pdf/pdf.spec-strip-forms.js), built with the pdf-lib handed in (the app's, or vendor/'s in Node):
     make(L, kind, stamp) → Promise of { bytes, text: { head, a, tail, b, c, d }, pages, enc (a text's codes in the
       paragraphs' font) }; stamp (a string, in the Subject) keeps two files of one kind apart. Each page's sheet has a heading, a
       paragraph of lines a and b (a carries a tail far to its right, drawn by the same TJ after a 6 em move, so it stays
       only when the text before it is measured right) and a paragraph of c and d, at x 72 and baselines 730, 690, 674,
       610 and 594, size 12 (the heading 20). kind:
       wrapped  the sheet is a Form XObject the page draws          shared  one form drawn by two pages (shared resources)
       twice    one form drawn twice on a page (the second 360 lower) nested  the paragraphs four forms deep, each moved
       type3    the paragraphs in a Type 3 font (FontMatrix 0.01, Widths in glyph space, a ToUnicode)
       cmap     a Type 0 font with an embedded CMap of one- and two-byte codes (Q to Z), CIDs that are not the codes
       ucs2     a Type 0 font with the predefined CMap UniJIS-UCS2-H (codes are UCS-2, CIDs Adobe-Japan1)
       nowidths simple TrueType fonts with no Widths (Georgia, measured by pdf.js as Times-Roman; Verdana as Helvetica)
       kern     the page's own text, line a in three runs: "Hello ", a bold word, and the rest right after it, kerned a hair
                back under it (TJ 20: its first letter starts inside the bold word's box, its centre past it)
       clip     the sheet in a form, its text in render mode 4 (fill, then clip: the text that a cover must still hide) */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.StripFixtures = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var TEXT = {
    wrapped: ['Wrapped heading stays', 'Quartz lemur juggles nine', 'tail kept', 'Velvet otter paints seven', 'Keep ochre heron', 'Keep amber walrus'],
    shared: ['Shared heading stays', 'Cobalt badger hums twelve', 'tail kept', 'Saffron gecko naps four', 'Keep olive crane', 'Keep cedar bison'],
    twice: ['Twice heading stays', 'Maroon tapir skips eight', 'tail kept', 'Indigo koala sings ten', 'Keep pearl finch', 'Keep coral moose'],
    nested: ['Nested heading stays', 'Ivory panda swims three', 'tail kept', 'Jade llama reads five', 'Keep mint egret', 'Keep plum yak'],
    type3: ['Type three heading', 'Amber raven counts six', 'tail kept', 'Silver mole digs two', 'Keep rust ibis', 'Keep teal newt'],
    cmap: ['Mixed codes heading', 'Lilac QR bear hops', 'tail kept', 'Golden ST crab runs', 'Keep sand owl', 'Keep moss elk'],
    ucs2: ['Predefined heading', 'Cyan fox jumps high', 'tail kept', 'Ruby seal dives deep', 'Keep gray dove', 'Keep pink hare'],
    nowidths: ['Old file heading', 'Topaz bison wades far', 'tail kept', 'Garnet eel coils tight', 'Keep slate lark', 'Keep hazel mink'],
    kern: ['Kerned heading stays', 'Hello ', 'bold', 'world again', 'Keep dusk wren', 'Keep dawn vole'],
    clip: ['Clipped heading stays', 'Onyx shrew clips one', 'tail kept', 'Opal stoat clips two', 'Keep fern moth', 'Keep reed crab']
  };
  function lit(s) { return '(' + s.replace(/[\\()]/g, '\\$&') + ')'; }
  function hex(s) { var o = '<'; for (var i = 0; i < s.length; i++) o += ('0' + s.charCodeAt(i).toString(16)).slice(-2); return o + '>'; }
  function ucs2(s) { var o = ''; for (var i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) >> 8, s.charCodeAt(i) & 255); return o; }
  /** The mixed codes of the embedded CMap: Q to Z two bytes (0x80, then the letter), the rest one byte (Latin letters only:
   * the paragraph editor fetches the fonts of other scripts). */
  function mixed(s) { var o = ''; for (var j = 0; j < s.length; j++) o += /[Q-Z]/.test(s[j]) ? '\x80' + s[j] : s[j]; return o; }

  /** The sheet's content: heading in F1, the paragraphs in font E (its codes by enc), at a y offset. */
  function sheet(t, E, enc, mode) {
    var tr = mode ? mode + ' Tr ' : '';
    return 'BT ' + tr + '/F1 20 Tf 72 730 Td ' + lit(t[0]) + ' Tj ET\n' +
      'BT ' + tr + '/' + E + ' 12 Tf 72 690 Td [' + hex(enc(t[1])) + ' -6000 ' + hex(enc(t[2])) + '] TJ 0 -16 Td ' + hex(enc(t[3])) + ' Tj ET\n' +
      'BT ' + tr + '/' + E + ' 12 Tf 72 610 Td ' + hex(enc(t[4])) + ' Tj 0 -16 Td ' + hex(enc(t[5])) + ' Tj ET\n';
  }
  function Ctx(L, doc) {
    var ctx = doc.context;
    return {
      ctx: ctx,
      stream: function (text, dict) { return ctx.register(ctx.flateStream(text, dict || {})); },
      form: function (text, res, extra) { return ctx.register(ctx.flateStream(text, Object.assign({ Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 612, 792], Resources: res }, extra || {}))); },
      page: function (text, res) { var pg = doc.addPage(L.PageSizes.Letter); pg.node.set(L.PDFName.of('Contents'), ctx.register(ctx.flateStream(text))); pg.node.set(L.PDFName.of('Resources'), res instanceof L.PDFObject ? res : ctx.obj(res)); return pg; }
    };
  }
  function toUnicode(c, spaces, ranges) {
    return c.stream('/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /Slop-UCS def /CMapType 2 def\n' +
      spaces.length / 2 + ' begincodespacerange ' + spaces.join(' ') + ' endcodespacerange\n' +
      ranges.length / 3 + ' beginbfrange ' + ranges.join(' ') + ' endbfrange\nendcmap CMapName currentdict /CMap defineresource pop end end');
  }
  /** A Type 3 font of the printable ASCII: each glyph a box, of width 40 … 69 in glyph space (0.01 em). */
  function type3(L, c) {
    var procs = {}, diff = [32], widths = [];
    for (var code = 32; code <= 126; code++) {
      var w = code === 32 ? 30 : 40 + (code * 7) % 30;
      widths.push(w); diff.push('g' + code);
      procs['g' + code] = c.stream(w + ' 0 0 0 ' + w + ' 70 d1 ' + (code === 32 ? '' : (w * 0.1) + ' 0 ' + (w * 0.8) + ' 70 re f'));
    }
    return c.ctx.register(c.ctx.obj({ Type: 'Font', Subtype: 'Type3', FontBBox: [0, 0, 100, 100], FontMatrix: [0.01, 0, 0, 0.01, 0, 0],
      CharProcs: procs, Encoding: { Type: 'Encoding', Differences: diff }, FirstChar: 32, LastChar: 126, Widths: widths, Resources: {},
      ToUnicode: toUnicode(c, ['<20>', '<7e>'], ['<20>', '<7e>', '<0020>']) }));
  }
  /** A Type 0 font (not embedded) with a CMap: an embedded stream of mixed codes, or a predefined one's name. */
  function type0(L, c, kind) {
    var w = [], cids = kind === 'ucs2' ? { Registry: L.PDFString.of('Adobe'), Ordering: L.PDFString.of('Japan1'), Supplement: 6 } : { Registry: L.PDFString.of('Adobe'), Ordering: L.PDFString.of('Identity'), Supplement: 0 };
    for (var cid = 1; cid <= 95; cid++) w.push(400 + (cid * 37) % 300);
    var enc = kind === 'ucs2' ? 'UniJIS-UCS2-H' : c.stream('/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /Slop-Mixed-H def /CMapType 1 def\n' +
      '2 begincodespacerange <00> <7f> <8000> <ffff> endcodespacerange\n2 begincidrange <20> <7e> 1 <8000> <80ff> 200 endcidrange\n' +
      'endcmap CMapName currentdict /CMap defineresource pop end end', { Type: 'CMap', CMapName: 'Slop-Mixed-H', CIDSystemInfo: cids, WMode: 0 });
    var tu = kind === 'ucs2' ? toUnicode(c, ['<0000>', '<ffff>'], ['<0020>', '<007e>', '<0020>', '<3040>', '<30ff>', '<3040>'])
      : toUnicode(c, ['<00>', '<7f>', '<8000>', '<ffff>'], ['<20>', '<7e>', '<0020>', '<8051>', '<805a>', '<0051>']);
    var name = kind === 'ucs2' ? 'KozMinPr6N-Regular' : 'SlopMixed';
    var fd = { Type: 'FontDescriptor', FontName: name, Flags: 32, FontBBox: [0, -200, 1000, 900], ItalicAngle: 0, Ascent: 880, Descent: -120, CapHeight: 700, StemV: 80 };
    var desc = { Type: 'Font', Subtype: kind === 'ucs2' ? 'CIDFontType0' : 'CIDFontType2', BaseFont: name, CIDSystemInfo: cids, FontDescriptor: fd, DW: 1000, W: [1, w] };
    return c.ctx.register(c.ctx.obj({ Type: 'Font', Subtype: 'Type0', BaseFont: name, Encoding: enc, DescendantFonts: [desc], ToUnicode: tu }));
  }

  async function make(L, kind, stamp) {
    var doc = await L.PDFDocument.create(), c = Ctx(L, doc), t = TEXT[kind];
    var hel = (await doc.embedFont(L.StandardFonts.Helvetica)).ref, bold = (await doc.embedFont(L.StandardFonts.HelveticaBold)).ref;
    var id = function (s) { return s; }, out = { text: { head: t[0], a: t[1], tail: t[2], b: t[3], c: t[4], d: t[5] }, pages: 1 };
    out.enc = kind === 'ucs2' ? ucs2 : kind === 'cmap' ? mixed : id;
    var res = function (fonts, xo) { var r = { Font: Object.assign({ F1: hel }, fonts || {}) }; if (xo) r.XObject = xo; return r; };
    if (kind === 'wrapped' || kind === 'clip') {
      var fm = c.form('0.92 0.95 1 rg 40 560 532 200 re f 0 g\n' + sheet(t, 'F1', id, kind === 'clip' ? 4 : 0), res());
      c.page('q 1 0 0 1 0 0 cm /Fm0 Do Q', res(null, { Fm0: fm }));
    } else if (kind === 'shared') {
      var shared = c.ctx.register(c.ctx.obj(res(null, { Fm0: c.form(sheet(t, 'F1', id), res()) })));
      c.page('q /Fm0 Do Q BT /F1 12 Tf 72 100 Td (Page one footer) Tj ET', shared);
      c.page('q /Fm0 Do Q BT /F1 12 Tf 72 100 Td (Page two footer) Tj ET', shared);
      out.pages = 2;
    } else if (kind === 'twice') {
      c.page('q /Fm0 Do Q q 1 0 0 1 0 -360 cm /Fm0 Do Q', res(null, { Fm0: c.form(sheet(t, 'F1', id), res()) }));
    } else if (kind === 'nested') {
      // the paragraphs in Fm3, drawn by Fm2 by Fm1 by Fm0; each form moves what it draws (its Matrix or a cm) to where the sheet puts it
      var parts = sheet(t, 'F1', id).split('\n');
      var f3 = c.form(parts[1] + '\n' + parts[2], res(), { Matrix: [1, 0, 0, 1, 0, 20] });
      var f2 = c.form('q 1 0 0 1 0 -10 cm /Fm3 Do Q', res(null, { Fm3: f3 }));
      var f1 = c.form('/Fm2 Do', res(null, { Fm2: f2 }), { Matrix: [1, 0, 0, 1, 0, -10] });
      var f0 = c.form(parts[0] + '\nq /Fm1 Do Q', res(null, { Fm1: f1 }));
      c.page('/Fm0 Do', res(null, { Fm0: f0 }));
    } else if (kind === 'type3') {
      c.page(sheet(t, 'T3', id), res({ T3: type3(L, c) }));
    } else if (kind === 'cmap' || kind === 'ucs2') {
      c.page(sheet(t, 'C0', kind === 'ucs2' ? ucs2 : mixed), res({ C0: type0(L, c, kind) }));
    } else if (kind === 'nowidths') {
      var georgia = c.ctx.register(c.ctx.obj({ Type: 'Font', Subtype: 'TrueType', BaseFont: 'Georgia', Encoding: 'WinAnsiEncoding' }));
      var verdana = c.ctx.register(c.ctx.obj({ Type: 'Font', Subtype: 'TrueType', BaseFont: 'Verdana', Encoding: 'WinAnsiEncoding' }));
      c.page(sheet(t, 'G1', id) + 'BT /V1 12 Tf 72 400 Td [(Verdana line stays) -6000 (end)] TJ ET', res({ G1: georgia, V1: verdana }));
    } else if (kind === 'kern') {
      c.page('BT /F1 20 Tf 72 730 Td ' + lit(t[0]) + ' Tj ET\nBT /F1 12 Tf 72 690 Td ' + lit(t[1]) + ' Tj /F2 12 Tf ' + lit(t[2]) + ' Tj /F1 12 Tf [20 ' + lit(t[3]) + '] TJ ET\n' +
        'BT /F1 12 Tf 72 610 Td ' + lit(t[4]) + ' Tj 0 -16 Td ' + lit(t[5]) + ' Tj ET', res({ F2: bold }));
    }
    doc.setSubject('Strip fixture ' + kind + ' ' + (stamp || ''));
    out.bytes = await doc.save({ useObjectStreams: false });
    return out;
  }
  return { make: make, kinds: Object.keys(TEXT), TEXT: TEXT };
});
