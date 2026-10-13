/* Slop PDF — the OCR text layer. The engine returns one box per text line (canvas pixels, top-left origin). Each line is
   split into words and every word is written as an invisible run (text render mode 3, Helvetica) at its place on the
   page, so pdf.js reads the words as text and the editor's text editing, find and copy work on them. Word positions are
   estimated from Helvetica's advance widths: the line is stretched (horizontal scale) to the width of its box.
   Pure geometry in placements(); writer in write(). The page's own content is left as it is. */
(function () {
  'use strict';
  var SP = window.SP;
  var OL = SP.ocrLayer = {};
  var CAP_CENTRE = 0.2555; // Helvetica: baseline to the middle of the ink (ascender 0.718, descender 0.207), in em
  var SX_MIN = 0.25, SX_MAX = 4;

  /** Text that Helvetica (WinAnsi) can draw. Other characters are left out of the layer, not guessed. */
  function drawable(font, text) {
    return Array.from(text).filter(function (ch) {
      try { font.encodeText(ch); return true; } catch (e) { return false; }
    }).join('');
  }

  /**
   * Words of OCR lines with their page-space boxes (points, PDF user space, unrotated).
   * lines: engine lines ({ text, box: { x, y, w, h } } in canvas pixels); g: E.geom(page) (view box in points);
   * px: { w, h } canvas size; font: a pdf-lib font. Returns [{ str, x, y, size, sx }]: x, y is the word's baseline start,
   * size its font size and sx the horizontal scale that makes the line as wide as its box.
   */
  OL.placements = function (lines, g, px, font) {
    var kx = px.w / g.W, ky = px.h / g.H, out = [];
    lines.forEach(function (l) {
      var text = drawable(font, String(l.text || '')).replace(/\s+/g, ' ').trim();
      if (!text) return;
      var b = l.box, hPt = b.h / ky, size = Math.max(4, hPt * 0.75);
      var natural = font.widthOfTextAtSize(text, size);
      if (!(natural > 0)) return;
      var sx = Math.min(SX_MAX, Math.max(SX_MIN, (b.w / kx) / natural));
      var left = g.x0 + b.x / kx;
      var baselineFromTop = b.y / ky + hPt / 2 + CAP_CENTRE * size;
      var y = g.y0 + g.H - baselineFromTop;
      var re = /\S+/g, m;
      while ((m = re.exec(text))) {
        out.push({
          str: m[0],
          x: left + font.widthOfTextAtSize(text.slice(0, m.index), size) * sx,
          y: y, size: size, sx: sx
        });
      }
    });
    return out;
  };

  /**
   * Writes the text layer into a copy of a PDF. bytes: the source file; pages: [{ index, lines, g, px }] (index is the
   * page in this file; lines, g and px as for placements()). Every other page and all document data are kept.
   * Resolves to the new bytes.
   */
  OL.write = async function (bytes, pages) {
    var L = window.PDFLib;
    var doc = await L.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
    var font = await doc.embedFont(L.StandardFonts.Helvetica);
    pages.forEach(function (pp) {
      var page = doc.getPage(pp.index);
      var name = page.node.newFontDictionary('SlopOCR', font.ref);
      var ops = [L.pushGraphicsState(), L.beginText(), L.setTextRenderingMode(3)];
      OL.placements(pp.lines, pp.g, pp.px, font).forEach(function (w) {
        ops.push(L.setFontAndSize(name, w.size), L.setTextMatrix(w.sx, 0, 0, 1, w.x, w.y), L.showText(font.encodeText(w.str)));
      });
      ops.push(L.endText(), L.popGraphicsState());
      page.pushOperators.apply(page, ops);
    });
    return doc.save({ useObjectStreams: true });
  };
})();
