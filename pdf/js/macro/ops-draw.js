/* Slop PDF macros — the steps that draw on pages: Header or footer, Page numbers, Watermark, Stamp.
   Positions are measured on the displayed page (P.frame), so text follows a rotated page. Each op takes
   (bytes, step, ctx) and resolves { bytes, message, warn }. ctx carries date, filename and the page count. */
(function () {
  'use strict';
  var M = window.SlopPdfMacro = window.SlopPdfMacro || {};
  var P = M.pdf, OPS = M.ops = M.ops || {};
  var MARGIN = 28, RAD = Math.PI / 180;
  function count(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  function tokens(text, i, n, ctx) {
    return M.expandTokens(text, { page: i + 1, pages: n, date: ctx.date, filename: ctx.filename });
  }
  function dataBytes(url) {
    var bin = atob(url.slice(url.indexOf(',') + 1)), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  /** Numbers for the page-number formats. total is the last number used. */
  function numberText(format, num, total) {
    switch (format) {
      case 'page': return 'Page ' + num;
      case 'n-of': return num + ' / ' + total;
      case 'page-of': return 'Page ' + num + ' of ' + total;
      case 'dash': return '– ' + num + ' –';
    }
    return String(num);
  }

  OPS.addHeaderFooter = async function (bytes, s, ctx) {
    var L = P.lib(), doc = await P.load(bytes), n = doc.getPageCount(), idx = M.parsePages(s.pages, n);
    var font = await P.font(doc, 'Helvetica'), col = P.rgb(s.colour), unsupported = 0;
    idx.forEach(function (i) {
      var page = doc.getPage(i), fr = P.frame(page), text = tokens(s.text, i, n, ctx);
      if (P.hasUnsupported(font, text)) unsupported++;
      text = P.safeText(font, text);
      if (!text) return;
      var w = font.widthOfTextAtSize(text, s.size);
      var vx = s.align === 'left' ? MARGIN : s.align === 'right' ? fr.VW - MARGIN - w : (fr.VW - w) / 2;
      var vy = s.position === 'header' ? MARGIN + s.size * 0.75 : fr.VH - MARGIN;
      var p = fr.pt(vx, vy);
      page.drawText(text, { x: p[0], y: p[1], size: s.size, font: font, color: col, rotate: L.degrees(fr.rot) });
    });
    return { bytes: await doc.save(), message: 'Added a ' + s.position + ' to ' + count(idx.length, 'page') + '.' + (unsupported ? ' Some characters were written as “?”.' : ''), warn: !!unsupported };
  };

  OPS.addPageNumbers = async function (bytes, s, ctx) {
    var L = P.lib(), doc = await P.load(bytes), n = doc.getPageCount(), idx = M.parsePages(s.pages, n);
    var font = await P.font(doc, 'Helvetica'), col = P.rgb(s.colour);
    var where = String(s.position).split('-'), top = where[0] === 'top', align = where[1] || 'center';
    var last = s.start + n - 1;
    idx.forEach(function (i) {
      var page = doc.getPage(i), fr = P.frame(page);
      var text = numberText(s.format, s.start + i, last), w = font.widthOfTextAtSize(text, s.size);
      var vx = align === 'left' ? MARGIN : align === 'right' ? fr.VW - MARGIN - w : (fr.VW - w) / 2;
      var vy = top ? MARGIN + s.size * 0.75 : fr.VH - MARGIN;
      var p = fr.pt(vx, vy);
      page.drawText(text, { x: p[0], y: p[1], size: s.size, font: font, color: col, rotate: L.degrees(fr.rot) });
    });
    return { bytes: await doc.save(), message: 'Numbered ' + count(idx.length, 'page') + ' (' + s.position + ').', warn: false };
  };

  OPS.addWatermark = async function (bytes, s, ctx) {
    var L = P.lib(), doc = await P.load(bytes), n = doc.getPageCount(), idx = M.parsePages(s.pages, n);
    var font = await P.font(doc, 'Helvetica'), col = P.rgb(s.colour), unsupported = 0;
    idx.forEach(function (i) {
      var page = doc.getPage(i), fr = P.frame(page), text = tokens(s.text, i, n, ctx);
      if (P.hasUnsupported(font, text)) unsupported++;
      text = P.safeText(font, text);
      if (!text) return;
      var w = font.widthOfTextAtSize(text, s.size), theta = fr.rot + Number(s.angle);
      var c = fr.pt(fr.VW / 2, fr.VH / 2), ux = Math.cos(theta * RAD), uy = Math.sin(theta * RAD);
      var vxn = -uy, vyn = ux, hh = s.size * 0.36; // text box centre: half the cap height above the baseline
      page.drawText(text, {
        x: c[0] - (w / 2) * ux - hh * vxn, y: c[1] - (w / 2) * uy - hh * vyn,
        size: s.size, font: font, color: col, opacity: s.opacity, rotate: L.degrees(((theta % 360) + 360) % 360)
      });
    });
    return { bytes: await doc.save(), message: 'Watermarked ' + count(idx.length, 'page') + '.' + (unsupported ? ' Some characters were written as “?”.' : ''), warn: !!unsupported };
  };

  OPS.stamp = async function (bytes, s, ctx) {
    var L = P.lib(), doc = await P.load(bytes), n = doc.getPageCount(), idx = M.parsePages(s.pages, n);
    var img = null, font = null;
    if (s.imageDataUrl) {
      var raw = dataBytes(s.imageDataUrl);
      img = /^data:image\/png/.test(s.imageDataUrl) ? await doc.embedPng(raw) : await doc.embedJpg(raw);
    } else font = await P.font(doc, 'Helvetica');
    idx.forEach(function (i) {
      var page = doc.getPage(i), fr = P.frame(page), x = fr.VW * s.x / 100, y = fr.VH * s.y / 100;
      if (img) {
        var w = fr.VW * s.width / 100, h = w * img.height / img.width, p = fr.pt(x, y + h);
        page.drawImage(img, { x: p[0], y: p[1], width: w, height: h, rotate: L.degrees(fr.rot) });
      } else {
        var text = P.safeText(font, tokens(s.text, i, n, ctx)), size = 14, q = fr.pt(x, y + size * 0.8);
        page.drawText(text, { x: q[0], y: q[1], size: size, font: font, color: P.rgb(s.colour), rotate: L.degrees(fr.rot) });
      }
    });
    return { bytes: await doc.save(), message: 'Stamped ' + count(idx.length, 'page') + '.', warn: false };
  };
})();
