/* Slop PDF macros — the page-editing steps: Replace text, Rotate, Delete pages, Keep only these pages.
   Each op takes (bytes, step, ctx) and resolves { bytes, message, warn }. The input bytes are never changed. */
(function () {
  'use strict';
  var M = window.SlopPdfMacro = window.SlopPdfMacro || {};
  var P = M.pdf, OPS = M.ops = M.ops || {};
  function count(n, word, plural) { return n + ' ' + (n === 1 ? word : (plural || word + 's')); }

  /** Covers each located match with a box, then draws the replacement in the standard font. The original
   *  characters stay in the file under the box (copy and search still find them); Redact removes them. */
  OPS.replaceText = async function (bytes, s, ctx) {
    var L = P.lib(), doc = await P.load(bytes), n = doc.getPageCount();
    var idx = M.parsePages(s.pages, n);
    var font = await P.font(doc, 'Helvetica'), black = P.rgb('#000000'), cover = P.rgb(s.cover || '#ffffff');
    var pdfjsDoc = await M.text.open(bytes), found = 0, done = 0, wide = 0, unsupported = 0, skipped = [], pagesHit = new Set();
    try {
      for (var k = 0; k < idx.length; k++) {
        var i = idx[k], page = doc.getPage(i);
        var ix = M.text.index(await (await pdfjsDoc.getPage(i + 1)).getTextContent());
        var matches = M.text.find(ix, s.find, s, P.measure);
        for (var j = 0; j < matches.length; j++) {
          var m = matches[j];
          found++;
          if (!m.precise) { skipped.push('page ' + (i + 1)); continue; }
          var rep = s.regex
            ? m.text.replace(M.text.regex(s.find, s, false), s.replace || '')
            : String(s.replace || '');
          if (P.hasUnsupported(font, rep)) unsupported++;
          rep = P.safeText(font, rep);
          var first = m.segs[0], last = m.segs[m.segs.length - 1];
          m.segs.forEach(function (sg) {
            if (!(sg.x1 > sg.x0)) return;
            page.drawRectangle({ x: sg.x0 - 0.4, y: sg.y - 0.24 * sg.fs, width: sg.x1 - sg.x0 + 0.8, height: 1.04 * sg.fs, color: cover, borderWidth: 0 });
          });
          if (rep) {
            page.drawText(rep, { x: first.x0, y: first.y, size: first.fs, font: font, color: black });
            if (font.widthOfTextAtSize(rep, first.fs) > last.x1 - first.x0 + 0.5) wide++;
          }
          done++; pagesHit.add(i);
        }
      }
    } finally { await pdfjsDoc.destroy(); }
    var parts = [];
    if (!found) parts.push('No “' + s.find + '” found on the chosen pages, so nothing was changed.');
    if (done) parts.push('Replaced ' + count(done, 'match', 'matches') + ' on ' + count(pagesHit.size, 'page') + '.');
    if (skipped.length) parts.push(count(skipped.length, 'match', 'matches') + ' left as it is, because its position could not be located exactly (' + skipped.slice(0, 5).join(', ') + ').');
    if (wide) parts.push(count(wide, 'replacement') + ' wider than the original and may overlap nearby text.');
    if (unsupported) parts.push('Some characters are not in the standard font and were written as “?”.');
    if (done) parts.push('The original text remains in the file under the box; use Redact to remove it.');
    return { bytes: await doc.save(), message: parts.join(' '), warn: !done || skipped.length > 0 || wide > 0 || unsupported > 0 };
  };

  OPS.rotate = async function (bytes, s) {
    var L = P.lib(), doc = await P.load(bytes), idx = M.parsePages(s.pages, doc.getPageCount());
    idx.forEach(function (i) {
      var pg = doc.getPage(i), a = (((pg.getRotation().angle || 0) + Number(s.angle)) % 360 + 360) % 360;
      pg.setRotation(L.degrees(a));
    });
    return { bytes: await doc.save(), message: 'Rotated ' + count(idx.length, 'page') + ' by ' + s.angle + '°.', warn: false };
  };

  OPS.deletePages = async function (bytes, s) {
    var doc = await P.load(bytes), n = doc.getPageCount(), idx = M.parsePages(s.pages, n);
    if (!idx.length) throw new Error('No pages were chosen to delete.');
    if (idx.length >= n) throw new Error('This would delete every page. Keep at least one page.');
    idx.slice().reverse().forEach(function (i) { doc.removePage(i); });
    return { bytes: await doc.save(), message: 'Deleted ' + count(idx.length, 'page') + ', ' + count(n - idx.length, 'page') + ' left.', warn: false };
  };

  OPS.extractPages = async function (bytes, s) {
    var L = P.lib(), src = await P.load(bytes), idx = M.parsePages(s.pages, src.getPageCount());
    if (!idx.length) throw new Error('No pages were chosen to keep.');
    var out = await L.PDFDocument.create({ updateMetadata: false });
    (await out.copyPages(src, idx)).forEach(function (pg) { out.addPage(pg); });
    return { bytes: await out.save(), message: 'Kept ' + count(idx.length, 'page') + '.', warn: false };
  };
})();
