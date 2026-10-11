/* Slop Vector — import/export: SVG (with editable metadata), PDF 1.4 writer, PNG/JPG,
   file open/place/drag-drop, and the offline self-download. */
(function () {
  'use strict';
  var G = window.SVGeom, SV = window.SV, S = SV.state;
  var fmt = G.fmt, esc = SV.esc, clone = SV.clone;
  var abs = Math.abs, min = Math.min, max = Math.max, sqrt = Math.sqrt;
  var IO = SV.io = {};

  /* ================= download helper ================= */
  IO.download = function (blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
  };
  function safeName(n) { return String(n || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Untitled'; }
  IO.baseName = function () { return safeName(S.doc.name); };

  /* ================= SVG export ================= */
  function idName(n) { var s = String(n).trim().replace(/[^A-Za-z0-9_\-]+/g, '_'); if (!/^[A-Za-z_]/.test(s)) s = '_' + s; return s; }
  IO.exportSVG = function (opts) {
    opts = opts || {};
    var doc = S.doc, defs = [], gc = 0, used = {};
    var ctx = {
      defs: defs, outline: false, names: !opts.noIds,
      gradId: function () { return 'sv-gradient-' + (++gc); },
      uniqueName: function (n) { var b = idName(n), k = b, i = 2; while (used[k]) k = b + '-' + (i++); used[k] = 1; return k; }
    };
    var body = '', W = doc.width, H = doc.height, vb = '0 0 ' + fmt(W) + ' ' + fmt(H);
    if (opts.ids) {
      var b = SV.selBBox(opts.ids) || { x: 0, y: 0, w: 1, h: 1 };
      W = max(1, b.w); H = max(1, b.h); vb = fmt(b.x) + ' ' + fmt(b.y) + ' ' + fmt(W) + ' ' + fmt(H);
      body = SV.zSorted(opts.ids).map(function (id) { return SV.objToSVG(SV.getObj(id), ctx); }).join('\n');
    } else {
      if (opts.background) body += '<rect width="100%" height="100%" fill="' + opts.background + '"/>\n';
      doc.layers.forEach(function (L) {
        if (L.hidden) return;
        body += '<g id="' + ctx.uniqueName(L.name) + '" data-name="' + esc(L.name) + '">\n' + L.children.map(function (o) { return SV.objToSVG(o, ctx); }).filter(Boolean).join('\n') + '\n</g>\n';
      });
    }
    var meta = '';
    if (opts.metadata) {
      var json = JSON.stringify({ app: 'Slop Vector', format: 1, doc: doc });
      meta = '<metadata id="slopvector-document"><![CDATA[' + json.replace(/\]\]>/g, ']]]]><![CDATA[>') + ']]></metadata>\n';
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="' + fmt(W) + '" height="' + fmt(H) + '" viewBox="' + vb + '">\n' +
      '<title>' + esc(doc.name) + '</title>\n<desc>Made with Slop Vector — slopographic.com/vector</desc>\n' + meta +
      (defs.length ? '<defs>\n' + defs.join('\n') + '\n</defs>\n' : '') + body + '</svg>\n';
  };
  IO.saveSVG = function (name) {
    if (name) S.doc.name = name;
    var svg = IO.exportSVG({ metadata: true });
    IO.download(new Blob([svg], { type: 'image/svg+xml' }), IO.baseName() + '.svg');
    SV.markSaved(); SV.scheduleAutosave();
    SV.toast('Saved “' + IO.baseName() + '.svg” (editable Slop Vector SVG)');
  };
  IO.exportPlainSVG = function () {
    IO.download(new Blob([IO.exportSVG({})], { type: 'image/svg+xml' }), IO.baseName() + '.svg');
    SV.toast('Exported SVG');
  };

  /* ================= raster export ================= */
  IO.rasterize = function (scale, bg) {
    var svg = IO.exportSVG({ noIds: true });
    var W = S.doc.width, H = S.doc.height;
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = max(1, Math.round(W * scale)); c.height = max(1, Math.round(H * scale));
        var cx = c.getContext('2d');
        if (bg) { cx.fillStyle = bg; cx.fillRect(0, 0, c.width, c.height); }
        cx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c);
      };
      img.onerror = function () { reject(new Error('Could not render artwork')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  };
  IO.exportRaster = function (type, scale, transparent, quality) {
    return IO.rasterize(scale, (type === 'jpg' || !transparent) ? '#ffffff' : null).then(function (c) {
      return new Promise(function (res) {
        c.toBlob(function (blob) {
          IO.download(blob, IO.baseName() + (scale !== 1 ? '@' + scale + 'x' : '') + (type === 'jpg' ? '.jpg' : '.png'));
          SV.toast('Exported ' + type.toUpperCase() + ' · ' + c.width + '×' + c.height + ' px');
          res(blob);
        }, type === 'jpg' ? 'image/jpeg' : 'image/png', quality || 0.92);
      });
    }).catch(function (e) { SV.toast('Export failed: ' + e.message, 'warn'); });
  };

  /* ================= PDF writer (hand-made PDF 1.4) ================= */
  var HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  var HELVB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
  var WINANSI = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F, 0x2212: 0x2D, 0x2032: 0x27 };
  function toWinAnsi(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF) { i++; out += '?'; continue; }
      if (c < 128 || (c >= 160 && c <= 255)) out += String.fromCharCode(c);
      else if (WINANSI[c]) out += String.fromCharCode(WINANSI[c]);
      else out += '?';
    }
    return out;
  }
  function pdfStr(s) { return '(' + s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\r/g, '\\r').replace(/\n/g, '\\n') + ')'; }
  function pdfFontFor(f) {
    var fam = (f.family || '').toLowerCase(), bold = (+f.weight || 400) >= 600, it = f.style === 'italic';
    var mono = /mono|courier|consol|menlo/.test(fam), serif = /georgia|times|serif/.test(fam) && !/sans/.test(fam);
    if (mono) return { name: 'Courier' + (bold ? (it ? '-BoldOblique' : '-Bold') : (it ? '-Oblique' : '')), kind: 'mono' };
    if (serif) return { name: bold ? (it ? 'Times-BoldItalic' : 'Times-Bold') : (it ? 'Times-Italic' : 'Times-Roman'), kind: 'serif', bold: bold };
    return { name: 'Helvetica' + (bold ? (it ? '-BoldOblique' : '-Bold') : (it ? '-Oblique' : '')), kind: 'sans', bold: bold };
  }
  var measCtx = null;
  function pdfTextWidth(enc, size, font) {
    if (font.kind === 'mono') return enc.length * 600 * size / 1000;
    if (font.kind === 'sans') {
      var tab = font.bold ? HELVB : HELV, w = 0;
      for (var i = 0; i < enc.length; i++) { var c = enc.charCodeAt(i); w += (c >= 32 && c <= 126) ? tab[c - 32] : 556; }
      return w * size / 1000;
    }
    if (!measCtx) measCtx = document.createElement('canvas').getContext('2d');
    measCtx.font = (font.bold ? 'bold ' : '') + size + "px 'Times New Roman', Times, serif";
    return measCtx.measureText(enc).width;
  }
  function hexRGB(c) {
    c = String(c || '#000');
    if (c[0] === '#' && c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    var n = parseInt(c.slice(1, 7), 16); if (isNaN(n)) n = 0;
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  function rgbStr(c) { return hexRGB(c).map(function (v) { return fmt(v); }).join(' '); }
  function solidOf(p) { if (!p) return null; if (typeof p === 'string') return p; return p.stops && p.stops.length ? p.stops[Math.floor((p.stops.length - 1) / 2)].c : '#000000'; }
  function pathOps(subs) {
    var out = [];
    subs.forEach(function (sp) {
      if (!sp.pts.length) return;
      out.push(fmt(sp.pts[0].x) + ' ' + fmt(sp.pts[0].y) + ' m');
      G.eachSeg(sp, function (a, b) {
        if (G.isLineSeg(a, b)) out.push(fmt(b.x) + ' ' + fmt(b.y) + ' l');
        else out.push(fmt(a.ox) + ' ' + fmt(a.oy) + ' ' + fmt(b.ix) + ' ' + fmt(b.iy) + ' ' + fmt(b.x) + ' ' + fmt(b.y) + ' c');
      });
      if (sp.closed) out.push('h');
    });
    return out.join('\n');
  }
  // alphaMode: build a DeviceGray shading from stop opacities (for a luminosity soft mask)
  function shadingDict(g, alphaMode) {
    var stops = g.stops.slice().sort(function (a, b) { return a.o - b.o; }).map(function (s) { return { o: SV.clamp(s.o, 0, 1), c: s.c, a: s.a == null ? 1 : s.a }; });
    if (!stops.length) stops = [{ o: 0, c: '#000', a: 1 }];
    if (stops[0].o > 0) stops.unshift({ o: 0, c: stops[0].c, a: stops[0].a });
    if (stops[stops.length - 1].o < 1) stops.push({ o: 1, c: stops[stops.length - 1].c, a: stops[stops.length - 1].a });
    if (stops.length === 1) stops.push({ o: 1, c: stops[0].c, a: stops[0].a });
    var col = function (s) { return alphaMode ? fmt(SV.clamp(s.a, 0, 1)) : rgbStr(s.c); };
    var cs = alphaMode ? '/DeviceGray' : '/DeviceRGB';
    for (var i = 1; i < stops.length - 1; i++) { if (stops[i].o <= stops[i - 1].o) stops[i].o = Math.min(1, stops[i - 1].o + 1e-4); }
    var fns = [];
    for (i = 0; i < stops.length - 1; i++) fns.push('<< /FunctionType 2 /Domain [0 1] /C0 [' + col(stops[i]) + '] /C1 [' + col(stops[i + 1]) + '] /N 1 >>');
    var fn = fns.length === 1 ? fns[0] : '<< /FunctionType 3 /Domain [0 1] /Functions [' + fns.join(' ') + '] /Bounds [' + stops.slice(1, -1).map(function (s) { return fmt(s.o); }).join(' ') + '] /Encode [' + fns.map(function () { return '0 1'; }).join(' ') + '] >>';
    if (g.type === 'radial') {
      var fx = g.fx != null ? g.fx : g.cx, fy = g.fy != null ? g.fy : g.cy;
      return '<< /ShadingType 3 /ColorSpace ' + cs + ' /Coords [' + [fx, fy, 0, g.cx, g.cy, g.r].map(fmt).join(' ') + '] /Function ' + fn + ' /Extend [true true] >>';
    }
    return '<< /ShadingType 2 /ColorSpace ' + cs + ' /Coords [' + [g.x1, g.y1, g.x2, g.y2].map(fmt).join(' ') + '] /Function ' + fn + ' /Extend [true true] >>';
  }
  var BM = { normal: 'Normal', multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', darken: 'Darken', lighten: 'Lighten', 'color-dodge': 'ColorDodge', 'color-burn': 'ColorBurn', 'hard-light': 'HardLight', 'soft-light': 'SoftLight', difference: 'Difference', exclusion: 'Exclusion', hue: 'Hue', saturation: 'Saturation', color: 'Color', luminosity: 'Luminosity' };
  function latin1Bytes(s) { var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }
  function deflate(bytes) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
    try {
      var cs = new CompressionStream('deflate');
      var stream = new Blob([bytes]).stream().pipeThrough(cs);
      return new Response(stream).arrayBuffer().then(function (ab) { return new Uint8Array(ab); }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function loadImg(src) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(new Error('image')); }; i.src = src; });
  }
  IO.buildPDF = function () {
    var doc = S.doc, W = doc.width, H = doc.height;
    var gstates = {}, gsN = 0, shadings = [], fonts = {}, fontN = 0, images = [], content = [], masks = [];
    content.push('1 0 0 -1 0 ' + fmt(H) + ' cm');
    function gs(alpha, blend) {
      var k = fmt(alpha) + '|' + (blend || 'normal');
      if (!gstates[k]) gstates[k] = { name: 'GS' + (++gsN), dict: '<< /Type /ExtGState /ca ' + fmt(alpha) + ' /CA ' + fmt(alpha) + ' /BM /' + (BM[blend] || 'Normal') + ' >>' };
      return '/' + gstates[k].name + ' gs';
    }
    function fontRes(f) {
      var pf = pdfFontFor(f);
      if (!fonts[pf.name]) fonts[pf.name] = { name: 'F' + (++fontN), base: pf.name };
      return { res: fonts[pf.name].name, pf: pf };
    }
    function emit(o, alpha, blend) {
      if (o.hidden) return;
      var st = o.style || {}, a = alpha * (st.opacity == null ? 1 : st.opacity), bl = (st.blend && st.blend !== 'normal') ? st.blend : blend;
      if (o.type === 'group') { o.children.forEach(function (c) { emit(c, a, bl); }); return; }
      content.push('q');
      if (!G.isIdentity(o.m)) content.push(o.m.map(fmt).join(' ') + ' cm');
      if (a < 0.999 || (bl && bl !== 'normal')) content.push(gs(a, bl));
      if (o.type === 'image') {
        var href = S.doc.assets[o.asset] || o.href;
        if (href) {
          images.push({ name: 'Im' + (images.length + 1), href: href });
          content.push(fmt(o.w) + ' 0 0 ' + fmt(-o.h) + ' ' + fmt(o.x) + ' ' + fmt(o.y + o.h) + ' cm /' + images[images.length - 1].name + ' Do');
        }
        content.push('Q'); return;
      }
      var fill = st.fill, stroke = st.stroke && st.sw > 0 ? st.stroke : null;
      var strokeSetup = function () {
        var sc = solidOf(stroke);
        content.push(rgbStr(sc) + ' RG ' + fmt(st.sw) + ' w ' + ({ butt: 0, round: 1, square: 2 }[st.cap] || 0) + ' J ' + ({ miter: 0, round: 1, bevel: 2 }[st.join] || 0) + ' j ' + fmt(st.miter || 10) + ' M [' + (st.dash || []).map(fmt).join(' ') + '] 0 d');
      };
      if (o.type === 'text') {
        var fr = fontRes(o.font), lay = SV.textLayout(o), f = o.font, fc = solidOf(fill);
        if (fc) content.push(rgbStr(fc) + ' rg');
        var mode = fc && stroke ? 2 : stroke ? 1 : 0;
        if (stroke) strokeSetup();
        if (!fc && !stroke) { content.push('Q'); return; }
        lay.lines.forEach(function (ln, i) {
          var enc = toWinAnsi(ln), w = pdfTextWidth(enc, f.size, fr.pf) + lay.tr * enc.length;
          var x = f.align === 'center' ? o.x - w / 2 : f.align === 'right' ? o.x - w : o.x, y = o.y + i * lay.L;
          content.push('BT /' + fr.res + ' ' + fmt(f.size) + ' Tf ' + (lay.tr ? fmt(lay.tr) + ' Tc ' : '') + mode + ' Tr 1 0 0 -1 ' + fmt(x) + ' ' + fmt(y) + ' Tm ' + pdfStr(enc) + ' Tj ET');
        });
        content.push('Q'); return;
      }
      var subs = SV.localSubs(o), ops = pathOps(subs), eo = st.rule === 'evenodd';
      if (!ops) { content.push('Q'); return; }
      if (fill && typeof fill === 'object') {
        var bb = G.subsBBox(subs);
        if (bb && bb.w > 0 && bb.h > 0) {
          shadings.push({ name: 'Sh' + (shadings.length + 1), dict: shadingDict(fill) });
          var needMask = fill.stops.some(function (s) { return s.a != null && s.a < 0.999; });
          content.push('q', ops, eo ? 'W* n' : 'W n', fmt(bb.w) + ' 0 0 ' + fmt(bb.h) + ' ' + fmt(bb.x) + ' ' + fmt(bb.y) + ' cm');
          if (needMask) {
            var mk = { name: 'GM' + (masks.length + 1), dict: shadingDict(fill, true) };
            masks.push(mk); content.push('/' + mk.name + ' gs');
          }
          content.push('/' + shadings[shadings.length - 1].name + ' sh', 'Q');
        }
        if (stroke) { strokeSetup(); content.push(ops, 'S'); }
      } else if (fill && stroke) {
        content.push(rgbStr(fill) + ' rg'); strokeSetup(); content.push(ops, eo ? 'B*' : 'B');
      } else if (fill) {
        content.push(rgbStr(fill) + ' rg', ops, eo ? 'f*' : 'f');
      } else if (stroke) {
        strokeSetup(); content.push(ops, 'S');
      }
      content.push('Q');
    }
    doc.layers.forEach(function (L) { if (!L.hidden) L.children.forEach(function (o) { emit(o, 1, null); }); });
    var contentStr = content.join('\n');
    // prepare images (async)
    return Promise.all(images.map(function (im) {
      return loadImg(im.href).then(function (img) {
        var w = img.naturalWidth || 1, h = img.naturalHeight || 1, sc = min(1, 2048 / max(w, h));
        w = max(1, Math.round(w * sc)); h = max(1, Math.round(h * sc));
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var cx = c.getContext('2d'); cx.drawImage(img, 0, 0, w, h);
        var px = cx.getImageData(0, 0, w, h).data, rgb = new Uint8Array(w * h * 3), al = new Uint8Array(w * h), hasA = false;
        for (var i = 0, j = 0, k = 0; i < px.length; i += 4) { rgb[j++] = px[i]; rgb[j++] = px[i + 1]; rgb[j++] = px[i + 2]; al[k++] = px[i + 3]; if (px[i + 3] < 255) hasA = true; }
        im.w = w; im.h = h;
        return Promise.all([deflate(rgb), hasA ? deflate(al) : Promise.resolve(null)]).then(function (r) {
          im.rgb = r[0] || rgb; im.rgbZ = !!r[0];
          if (hasA) { im.alpha = r[1] || al; im.alphaZ = !!r[1]; }
        });
      }).catch(function () { im.failed = true; });
    })).then(function () { return deflate(latin1Bytes(contentStr)); }).then(function (zc) {
      // assemble objects
      var objs = []; // each: {dict, stream?}
      function add(o) { objs.push(o); return objs.length; }
      var catalog = add(null), pages = add(null), page = add(null);
      var contentObj = add({ dict: zc ? '<< /Filter /FlateDecode' : '<<', stream: zc || latin1Bytes(contentStr) });
      var info = add({ dict: '<< /Producer (Slop Vector - slopographic.com) /Creator (Slop Vector) /Title ' + pdfStr(toWinAnsi(doc.name)) + ' /CreationDate (D:' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z) >>' });
      var xobj = [];
      images.forEach(function (im) {
        if (im.failed) return;
        var smask = '';
        if (im.alpha) {
          var sm = add({ dict: '<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceGray /BitsPerComponent 8' + (im.alphaZ ? ' /Filter /FlateDecode' : ''), stream: im.alpha });
          smask = ' /SMask ' + sm + ' 0 R';
        }
        var io = add({ dict: '<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8' + smask + (im.rgbZ ? ' /Filter /FlateDecode' : ''), stream: im.rgb });
        xobj.push('/' + im.name + ' ' + io + ' 0 R');
      });
      var res = '<< /ProcSet [/PDF /Text /ImageB /ImageC]';
      var fk = Object.keys(fonts);
      if (fk.length) res += ' /Font << ' + fk.map(function (k) { return '/' + fonts[k].name + ' << /Type /Font /Subtype /Type1 /BaseFont /' + fonts[k].base + ' /Encoding /WinAnsiEncoding >>'; }).join(' ') + ' >>';
      var gk = Object.keys(gstates), gsEntries = gk.map(function (k) { return '/' + gstates[k].name + ' ' + gstates[k].dict; });
      masks.forEach(function (mk) {
        // luminosity soft mask: a transparency-group form painting the stop opacities as gray
        var formStr = '/Sa sh';
        var form = add({ dict: '<< /Type /XObject /Subtype /Form /BBox [0 0 1 1] /Group << /S /Transparency /CS /DeviceGray >> /Resources << /Shading << /Sa ' + mk.dict + ' >> >>', stream: latin1Bytes(formStr) });
        gsEntries.push('/' + mk.name + ' << /Type /ExtGState /SMask << /Type /Mask /S /Luminosity /G ' + form + ' 0 R >> >>');
      });
      if (gsEntries.length) res += ' /ExtGState << ' + gsEntries.join(' ') + ' >>';
      if (shadings.length) res += ' /Shading << ' + shadings.map(function (s) { return '/' + s.name + ' ' + s.dict; }).join(' ') + ' >>';
      if (xobj.length) res += ' /XObject << ' + xobj.join(' ') + ' >>';
      res += ' >>';
      objs[catalog - 1] = { dict: '<< /Type /Catalog /Pages ' + pages + ' 0 R >>' };
      objs[pages - 1] = { dict: '<< /Type /Pages /Kids [' + page + ' 0 R] /Count 1 >>' };
      objs[page - 1] = { dict: '<< /Type /Page /Parent ' + pages + ' 0 R /MediaBox [0 0 ' + fmt(W) + ' ' + fmt(H) + '] /Resources ' + res + ' /Contents ' + contentObj + ' 0 R /Group << /S /Transparency /CS /DeviceRGB >> >>' };
      // serialise
      var parts = [], off = 0, offsets = [];
      function push(x) { var b = typeof x === 'string' ? latin1Bytes(x) : x; parts.push(b); off += b.length; }
      push('%PDF-1.4\n%âãÏÓ\n');
      objs.forEach(function (o, i) {
        offsets.push(off);
        push((i + 1) + ' 0 obj\n');
        if (o.stream) { push(o.dict + ' /Length ' + o.stream.length + ' >>\nstream\n'); push(o.stream); push('\nendstream\nendobj\n'); }
        else push(o.dict + '\nendobj\n');
      });
      var xref = off, x = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
      offsets.forEach(function (o) { x += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
      push(x);
      push('trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + catalog + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
      return new Blob(parts, { type: 'application/pdf' });
    });
  };
  IO.exportPDF = function (asAI) {
    return IO.buildPDF().then(function (blob) {
      var name = IO.baseName() + (asAI ? '.ai' : '.pdf');
      IO.download(asAI ? new Blob([blob], { type: 'application/postscript' }) : blob, name);
      SV.toast('Exported ' + name);
      return blob;
    }).catch(function (e) { SV.toast('PDF export failed: ' + e.message, 'warn'); });
  };

  /* ================= SVG import ================= */
  var colorCtx = null, colorCache = {};
  function parseColor(str) {
    if (str == null) return null;
    str = String(str).trim();
    if (!str || str === 'none' || str === 'transparent') return null;
    if (colorCache[str]) return colorCache[str];
    if (!colorCtx) colorCtx = document.createElement('canvas').getContext('2d');
    colorCtx.fillStyle = '#000'; colorCtx.fillStyle = str;
    var v = colorCtx.fillStyle, res;
    if (v[0] === '#') res = { c: v.toLowerCase(), a: 1 };
    else {
      var m = /rgba?\(([^)]+)\)/.exec(v);
      if (m) { var p = m[1].split(',').map(parseFloat); res = { c: '#' + p.slice(0, 3).map(function (n) { return ('0' + Math.round(n).toString(16)).slice(-2); }).join(''), a: p[3] == null ? 1 : p[3] }; }
      else res = { c: '#000000', a: 1 };
    }
    colorCache[str] = res; return res;
  }
  IO.parseColor = parseColor;
  function parseTransform(str) {
    var m = G.I(); if (!str) return m;
    var re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g, r;
    while ((r = re.exec(str))) {
      var a = r[2].trim().split(/[\s,]+/).map(parseFloat), t;
      switch (r[1]) {
        case 'matrix': t = a.length >= 6 ? a.slice(0, 6) : G.I(); break;
        case 'translate': t = G.translate(a[0] || 0, a[1] || 0); break;
        case 'scale': t = G.scale(a[0], a.length > 1 ? a[1] : a[0]); break;
        case 'rotate': t = G.rotate((a[0] || 0) * Math.PI / 180, a[1] || 0, a[2] || 0); break;
        case 'skewX': t = [1, 0, Math.tan((a[0] || 0) * Math.PI / 180), 1, 0, 0]; break;
        case 'skewY': t = [1, Math.tan((a[0] || 0) * Math.PI / 180), 0, 1, 0, 0]; break;
      }
      m = G.mul(m, t);
    }
    return m;
  }
  IO.parseTransform = parseTransform;
  function num(v, d) { if (v == null || v === '') return d || 0; var f = parseFloat(v); if (isNaN(f)) return d || 0; if (/pt$/.test(v)) f *= 4 / 3; else if (/mm$/.test(v)) f *= 96 / 25.4; else if (/cm$/.test(v)) f *= 96 / 2.54; else if (/in$/.test(v)) f *= 96; return f; }
  function frac(v, d) { if (v == null || v === '') return d; var s = String(v).trim(); return /%$/.test(s) ? parseFloat(s) / 100 : parseFloat(s); }
  var INHERIT = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'fill-rule', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'letter-spacing', 'fill-opacity', 'stroke-opacity', 'visibility', 'color'];
  var OWN = ['opacity', 'display', 'mix-blend-mode', 'transform'];
  function parseCSS(text) {
    var rules = [];
    text = text.replace(/\/\*[\s\S]*?\*\//g, '');
    var re = /([^{}]+)\{([^}]*)\}/g, r;
    while ((r = re.exec(text))) {
      var decls = {};
      r[2].split(';').forEach(function (d) { var i = d.indexOf(':'); if (i > 0) decls[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim().replace(/\s*!important$/, ''); });
      r[1].split(',').forEach(function (sel) { sel = sel.trim(); if (sel && !/^@/.test(sel)) rules.push({ sel: sel, decls: decls }); });
    }
    return rules;
  }
  function ruleMatches(sel, el) {
    if (/[\s>+~\[:]/.test(sel)) return false; // simple selectors only
    var m = /^([a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)$/.exec(sel); if (!m) return false;
    if (m[1] && el.localName !== m[1]) return false;
    var parts = (m[2] || '').match(/[.#][\w-]+/g) || [];
    var cls = (el.getAttribute('class') || '').split(/\s+/);
    return parts.every(function (p) { return p[0] === '.' ? cls.indexOf(p.slice(1)) >= 0 : el.getAttribute('id') === p.slice(1); });
  }
  function specificity(sel) { return (sel.match(/#/g) || []).length * 100 + (sel.match(/\./g) || []).length * 10 + (/^[a-zA-Z]/.test(sel) ? 1 : 0); }
  function ownProps(el, rules) {
    var p = {};
    INHERIT.concat(OWN).forEach(function (k) { var v = el.getAttribute(k); if (v != null) p[k] = v; });
    rules.filter(function (r) { return ruleMatches(r.sel, el); }).sort(function (a, b) { return specificity(a.sel) - specificity(b.sel); }).forEach(function (r) { Object.keys(r.decls).forEach(function (k) { p[k] = r.decls[k]; }); });
    var st = el.getAttribute('style');
    if (st) st.split(';').forEach(function (d) { var i = d.indexOf(':'); if (i > 0) p[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim().replace(/\s*!important$/, ''); });
    return p;
  }
  function svgToObjects(root, opts) {
    var rules = [], grads = {}, warnings = {};
    Array.prototype.forEach.call(root.getElementsByTagName('style'), function (s) { rules = rules.concat(parseCSS(s.textContent || '')); });
    var byId = {};
    Array.prototype.forEach.call(root.querySelectorAll('[id]'), function (e) { byId[e.getAttribute('id')] = e; });
    function href(el) { return el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || el.getAttribute('xlink:href'); }
    function gradAttr(el, name) {
      var cur = el, guard = 0;
      while (cur && guard++ < 10) { var v = cur.getAttribute(name); if (v != null) return v; var h = href(cur); cur = h && h[0] === '#' ? byId[h.slice(1)] : null; }
      return null;
    }
    function gradStops(el) {
      var cur = el, guard = 0;
      while (cur && guard++ < 10) {
        var st = Array.prototype.filter.call(cur.children, function (c) { return c.localName === 'stop'; });
        if (st.length) return st.map(function (s) {
          var pp = ownProps(s, rules), col = parseColor(pp['stop-color'] || s.getAttribute('stop-color') || '#000') || { c: '#000000', a: 0 };
          var op = parseFloat(pp['stop-opacity'] != null ? pp['stop-opacity'] : 1);
          return { o: SV.clamp(frac(s.getAttribute('offset'), 0), 0, 1), c: col.c, a: SV.clamp((isNaN(op) ? 1 : op) * col.a, 0, 1) };
        });
        var h = href(cur); cur = h && h[0] === '#' ? byId[h.slice(1)] : null;
      }
      return [];
    }
    function resolvePaint(val, props, localBox, which) {
      if (val == null) return which === 'fill' ? { c: '#000000', a: 1 } : null;
      val = String(val).trim();
      var mu = /^url\(\s*['"]?#([^)'"]+)['"]?\s*\)\s*(.*)$/.exec(val);
      if (mu) {
        var gel = byId[mu[1]];
        if (!gel || (gel.localName !== 'linearGradient' && gel.localName !== 'radialGradient')) return mu[2] ? resolvePaint(mu[2], props, localBox, which) : null;
        var stops = gradStops(gel); if (!stops.length) return null;
        if (stops.length === 1) return { c: stops[0].c, a: stops[0].a };
        var units = gradAttr(gel, 'gradientUnits') || 'objectBoundingBox';
        var gt = parseTransform(gradAttr(gel, 'gradientTransform'));
        var bb = localBox || { x: 0, y: 0, w: 1, h: 1 };
        var userU = units === 'userSpaceOnUse';
        function toFrac(x, y) {
          var p = G.ap(gt, x, y);
          if (!userU) return p;
          return { x: bb.w ? (p.x - bb.x) / bb.w : 0.5, y: bb.h ? (p.y - bb.y) / bb.h : 0.5 };
        }
        function coord(name, def, axis) {
          var v = gradAttr(gel, name); if (v == null) return userU ? (axis === 'x' ? bb.x + def * bb.w : bb.y + def * bb.h) : def;
          if (/%$/.test(v)) { var f = parseFloat(v) / 100; return userU ? (axis === 'x' ? bb.x + f * bb.w : bb.y + f * bb.h) : f; }
          return parseFloat(v);
        }
        if (gel.localName === 'radialGradient') {
          var cx = coord('cx', 0.5, 'x'), cy = coord('cy', 0.5, 'y'), fxv = gradAttr(gel, 'fx') != null ? coord('fx', 0.5, 'x') : cx, fyv = gradAttr(gel, 'fy') != null ? coord('fy', 0.5, 'y') : cy;
          var rr = gradAttr(gel, 'r'), r = rr == null ? (userU ? 0.5 * (bb.w + bb.h) / 2 : 0.5) : (/%$/.test(rr) ? parseFloat(rr) / 100 * (userU ? (bb.w + bb.h) / 2 : 1) : parseFloat(rr));
          var c = toFrac(cx, cy), f = toFrac(fxv, fyv), sc = sqrt(abs(G.det(gt)));
          var rf = userU ? r * sc / (((bb.w + bb.h) / 2) || 1) : r * sc;
          return { grad: { type: 'radial', cx: c.x, cy: c.y, r: rf, fx: f.x, fy: f.y, stops: stops } };
        }
        var p1 = toFrac(coord('x1', 0, 'x'), coord('y1', 0, 'y')), p2 = toFrac(coord('x2', 1, 'x'), coord('y2', 0, 'y'));
        return { grad: { type: 'linear', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stops: stops } };
      }
      if (val === 'currentColor') return parseColor(props.color || '#000');
      return parseColor(val);
    }
    function styleFrom(props, localBox) {
      var st = SV.mkStyle();
      var fp = resolvePaint(props.fill === undefined ? null : props.fill, props, localBox, 'fill');
      if (props.fill === undefined) fp = { c: '#000000', a: 1 };
      var sp = props.stroke === undefined ? null : resolvePaint(props.stroke, props, localBox, 'stroke');
      var fo = parseFloat(props['fill-opacity']); if (isNaN(fo)) fo = 1;
      var so = parseFloat(props['stroke-opacity']); if (isNaN(so)) so = 1;
      var op = parseFloat(props.opacity); if (isNaN(op)) op = 1;
      if (fp && fp.grad) { st.fill = fp.grad; if (fo < 1) st.fill.stops.forEach(function (s) { s.a *= fo; }); }
      else if (fp) { st.fill = fp.c; if (fp.a * fo < 1) { if (!sp) op *= fp.a * fo; } }
      if (sp && sp.grad) st.stroke = sp.grad; else if (sp) { st.stroke = sp.c; if (sp.a * so < 1 && !st.fill) op *= sp.a * so; }
      st.sw = props['stroke-width'] != null ? num(props['stroke-width'], 1) : 1;
      if (props['stroke-linecap']) st.cap = props['stroke-linecap'];
      if (props['stroke-linejoin']) st.join = props['stroke-linejoin'] === 'arcs' || props['stroke-linejoin'] === 'miter-clip' ? 'miter' : props['stroke-linejoin'];
      if (props['stroke-miterlimit']) st.miter = parseFloat(props['stroke-miterlimit']) || 4; else st.miter = 4;
      if (props['stroke-dasharray'] && props['stroke-dasharray'] !== 'none') { var d = props['stroke-dasharray'].split(/[\s,]+/).map(function (v) { return num(v); }).filter(function (v) { return !isNaN(v); }); if (d.length && d.some(function (v) { return v > 0; })) st.dash = d; }
      if (props['fill-rule'] === 'evenodd') st.rule = 'evenodd';
      st.opacity = SV.clamp(op, 0, 1);
      if (props['mix-blend-mode'] && SV.BLENDS.indexOf(props['mix-blend-mode']) >= 0) st.blend = props['mix-blend-mode'];
      return st;
    }
    function nameOf(el) { return el.getAttribute('data-name') || el.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label') || el.getAttribute('inkscape:label') || el.getAttribute('id') || ''; }
    var SKIP = { defs: 1, metadata: 1, title: 1, desc: 1, style: 1, clipPath: 1, mask: 1, symbol: 1, pattern: 1, linearGradient: 1, radialGradient: 1, filter: 1, script: 1, foreignObject: 1, marker: 1 };
    var prevScale = S.prefs.scaleStrokes;
    function conv(el, parentProps, ctm, depth) {
      var tag = el.localName;
      if (SKIP[tag] || depth > 40) return null;
      var own = ownProps(el, rules), props = {};
      INHERIT.forEach(function (k) { if (parentProps[k] !== undefined) props[k] = parentProps[k]; });
      Object.keys(own).forEach(function (k) { if (own[k] !== 'inherit') props[k] = own[k]; });
      if (props.display === 'none') return null;
      var m = G.mul(ctm, parseTransform(own.transform));
      var o = null, lb;
      function fin(obj) {
        obj.name = nameOf(el);
        if (props.visibility === 'hidden') obj.hidden = true;
        SV.transformObj(obj, m);
        return obj;
      }
      switch (tag) {
        case 'g': case 'a': case 'switch': case 'svg': {
          var cm = m;
          if (tag === 'svg') {
            cm = G.mul(m, G.translate(num(el.getAttribute('x')), num(el.getAttribute('y'))));
            var vbs = el.getAttribute('viewBox');
            if (vbs) { var v = vbs.split(/[\s,]+/).map(parseFloat), ww = num(el.getAttribute('width'), v[2]), hh = num(el.getAttribute('height'), v[3]); cm = G.mul(cm, G.mul(G.scale(ww / v[2], hh / v[3]), G.translate(-v[0], -v[1]))); }
          }
          var kids = [];
          Array.prototype.forEach.call(el.children, function (c) { var r = conv(c, props, cm, depth + 1); if (r) kids.push(r); });
          if (!kids.length) return null;
          var op = parseFloat(own.opacity);
          if (kids.length === 1 && isNaN(op) && !nameOf(el)) return kids[0];
          var g = SV.mk.group(kids, nameOf(el));
          if (!isNaN(op) && op < 1) g.style.opacity = op;
          if (own['mix-blend-mode']) g.style.blend = own['mix-blend-mode'];
          return g;
        }
        case 'use': {
          var h = href(el); var ref = h && h[0] === '#' ? byId[h.slice(1)] : null;
          if (!ref || ref === el) return null;
          var um = G.mul(m, G.translate(num(el.getAttribute('x')), num(el.getAttribute('y'))));
          if (ref.localName === 'symbol') {
            var ks = []; Array.prototype.forEach.call(ref.children, function (c) { var r = conv(c, props, um, depth + 1); if (r) ks.push(r); });
            return ks.length ? (ks.length === 1 ? ks[0] : SV.mk.group(ks, nameOf(el))) : null;
          }
          return conv(ref, props, um, depth + 1);
        }
        case 'rect': {
          var x = num(el.getAttribute('x')), y = num(el.getAttribute('y')), w = num(el.getAttribute('width')), hgt = num(el.getAttribute('height'));
          if (w <= 0 || hgt <= 0) return null;
          var rx = el.getAttribute('rx'), ry = el.getAttribute('ry'), rad = rx != null ? num(rx) : ry != null ? num(ry) : 0;
          o = SV.mk.rect(x, y, w, hgt, rad, styleFrom(props, { x: x, y: y, w: w, h: hgt }));
          return fin(o);
        }
        case 'circle': case 'ellipse': {
          var cx = num(el.getAttribute('cx')), cy = num(el.getAttribute('cy'));
          var erx = tag === 'circle' ? num(el.getAttribute('r')) : num(el.getAttribute('rx')), ery = tag === 'circle' ? erx : num(el.getAttribute('ry'));
          if (tag === 'ellipse' && el.getAttribute('ry') == null) ery = erx; if (tag === 'ellipse' && el.getAttribute('rx') == null) erx = ery;
          if (erx <= 0 || ery <= 0) return null;
          o = SV.mk.ellipse(cx, cy, erx, ery, styleFrom(props, { x: cx - erx, y: cy - ery, w: 2 * erx, h: 2 * ery }));
          return fin(o);
        }
        case 'line': {
          var subs = [{ closed: false, pts: [G.A(num(el.getAttribute('x1')), num(el.getAttribute('y1'))), G.A(num(el.getAttribute('x2')), num(el.getAttribute('y2')))] }];
          var stl = styleFrom(props, G.subsBBox(subs)); stl.fill = null;
          o = SV.mk.path(subs, stl); return fin(o);
        }
        case 'polyline': case 'polygon': {
          var nums = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(parseFloat).filter(function (v) { return !isNaN(v); });
          var pts = []; for (var i = 0; i + 1 < nums.length; i += 2) pts.push(G.A(nums[i], nums[i + 1]));
          if (pts.length < 2) return null;
          var s2 = [{ closed: tag === 'polygon', pts: pts }];
          o = SV.mk.path(s2, styleFrom(props, G.subsBBox(s2))); return fin(o);
        }
        case 'path': {
          var ps = G.parseD(el.getAttribute('d') || '');
          if (!ps.length) return null;
          o = SV.mk.path(ps, styleFrom(props, G.subsBBox(ps))); return fin(o);
        }
        case 'text': {
          var lines = [], tx = el.getAttribute('x'), ty = el.getAttribute('y');
          var tsp = Array.prototype.filter.call(el.children, function (c) { return c.localName === 'tspan'; });
          var multi = tsp.length > 1 && tsp.some(function (t) { return t.getAttribute('dy') || (t.getAttribute('y') && t.getAttribute('y') !== ty); });
          if (multi) tsp.forEach(function (t) { lines.push((t.textContent || '').replace(/\s+/g, ' ')); });
          else lines.push((el.textContent || '').replace(/\s+/g, ' ').trim());
          if (tx == null && tsp[0]) tx = tsp[0].getAttribute('x');
          if (ty == null && tsp[0]) ty = tsp[0].getAttribute('y');
          var x0 = num(String(tx || '0').split(/[\s,]+/)[0]), y0 = num(String(ty || '0').split(/[\s,]+/)[0]);
          if (tsp[0] && tsp[0].getAttribute('dy')) y0 += num(tsp[0].getAttribute('dy'));
          var fam = (props['font-family'] || 'Inter Tight').split(',')[0].replace(/['"]/g, '').trim();
          Object.keys(SV.FONTS).forEach(function (k) { if (k.toLowerCase() === fam.toLowerCase()) fam = k; });
          var size = num(props['font-size'], 16) || 16;
          var wt = props['font-weight'] || '400'; wt = wt === 'bold' ? 700 : wt === 'normal' ? 400 : (parseInt(wt, 10) || 400);
          var anchor = props['text-anchor'];
          var lh = 1.2;
          if (multi && tsp.length > 1) { var d1 = tsp[1].getAttribute('dy'); if (d1) lh = num(d1) / size; else if (tsp[1].getAttribute('y')) lh = (num(tsp[1].getAttribute('y')) - num(tsp[0].getAttribute('y') || ty)) / size; if (!(lh > 0.3 && lh < 5)) lh = 1.2; }
          var ls = parseFloat(props['letter-spacing']);
          var font = { family: fam, size: size, weight: wt, style: props['font-style'] === 'italic' ? 'italic' : 'normal', align: anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left', lh: Math.round(lh * 1000) / 1000, tracking: isNaN(ls) ? 0 : Math.round(ls / size * 1000) };
          if (!lines.join('').trim()) return null;
          o = SV.mk.text(x0, y0, lines.join('\n'), font, styleFrom(props, null));
          return fin(o);
        }
        case 'image': {
          var src = href(el);
          if (!src || !/^data:image\//.test(src)) { warnings.external = true; return null; }
          var aid = 'a' + SV.uid();
          opts.assets[aid] = src;
          o = SV.mk.image(aid, num(el.getAttribute('x')), num(el.getAttribute('y')), num(el.getAttribute('width')), num(el.getAttribute('height')));
          var op2 = parseFloat(props.opacity); if (!isNaN(op2)) o.style.opacity = op2;
          return fin(o);
        }
      }
      return null;
    }
    S.prefs.scaleStrokes = true;
    var result;
    try {
      var vb = root.getAttribute('viewBox'), W, H, base = G.I();
      var wAttr = root.getAttribute('width'), hAttr = root.getAttribute('height');
      if (vb) {
        var v = vb.trim().split(/[\s,]+/).map(parseFloat);
        W = wAttr && !/%/.test(wAttr) ? num(wAttr) : v[2]; H = hAttr && !/%/.test(hAttr) ? num(hAttr) : v[3];
        base = G.mul(G.scale(W / v[2], H / v[3]), G.translate(-v[0], -v[1]));
      } else { W = num(wAttr, 800) || 800; H = num(hAttr, 600) || 600; }
      var rootProps = {}; var rp = ownProps(root, rules); INHERIT.forEach(function (k) { if (rp[k] !== undefined) rootProps[k] = rp[k]; });
      base = G.mul(base, parseTransform(rp.transform));
      var kids = Array.prototype.filter.call(root.children, function (c) { return !SKIP[c.localName]; });
      var layers = [];
      var allGroups = kids.length > 0 && kids.every(function (c) { return c.localName === 'g'; });
      if (allGroups && opts.asLayers) {
        kids.forEach(function (gEl, i) {
          var gp = ownProps(gEl, rules), props = {};
          INHERIT.forEach(function (k) { if (rootProps[k] !== undefined) props[k] = rootProps[k]; if (gp[k] !== undefined && gp[k] !== 'inherit') props[k] = gp[k]; });
          if (gp.display === 'none') return;
          var gm = G.mul(base, parseTransform(gp.transform));
          var L = SV.mk.layer(nameOf(gEl) || ('Layer ' + (i + 1)), SV.LAYER_COLORS[i % SV.LAYER_COLORS.length]);
          Array.prototype.forEach.call(gEl.children, function (c) { var r = conv(c, props, gm, 1); if (r) L.children.push(r); });
          var gop = parseFloat(gp.opacity);
          if (!isNaN(gop) && gop < 1) L.children.forEach(function (o) { o.style.opacity = (o.style.opacity == null ? 1 : o.style.opacity) * gop; });
          layers.push(L);
        });
      } else {
        var L1 = SV.mk.layer('Layer 1', SV.LAYER_COLORS[0]);
        kids.forEach(function (c) { var r = conv(c, rootProps, base, 1); if (r) L1.children.push(r); });
        layers.push(L1);
      }
      result = { width: W, height: H, layers: layers, warnings: warnings };
    } finally { S.prefs.scaleStrokes = prevScale; }
    return result;
  }
  IO.parseSVG = function (text, opts) {
    opts = opts || {};
    var dom = new DOMParser().parseFromString(text, 'image/svg+xml');
    var root = dom.documentElement;
    if (!root || root.localName !== 'svg' || dom.getElementsByTagName('parsererror').length) throw new Error('Not a valid SVG file');
    var meta = dom.getElementById ? dom.getElementById('slopvector-document') : null;
    if (!meta) meta = root.querySelector('metadata[id="slopvector-document"]');
    if (meta) {
      try {
        var payload = JSON.parse(meta.textContent);
        if (payload && payload.doc && payload.doc.layers) return { slop: true, doc: payload.doc };
      } catch (e) { /* fall through to generic */ }
    }
    var assets = {};
    var r = svgToObjects(root, { asLayers: opts.asLayers, assets: assets });
    r.assets = assets;
    return r;
  };
  IO.openSVGText = function (text, fileName) {
    var r;
    try { r = IO.parseSVG(text, { asLayers: true }); } catch (e) { SV.toast(e.message, 'warn'); return false; }
    var base = (fileName || 'Untitled').replace(/\.svg$/i, '');
    var doc;
    if (r.slop) { doc = r.doc; doc.name = doc.name || base; }
    else {
      doc = SV.newDoc(Math.round(r.width * 100) / 100, Math.round(r.height * 100) / 100, base);
      doc.layers = r.layers.length ? r.layers : doc.layers;
      doc.assets = r.assets;
      if (r.warnings.external) SV.toast('External (linked) images were skipped — only embedded images are supported', 'warn');
    }
    S.fileName = fileName || null;
    SV.loadDoc(doc, { fit: true });
    SV.commit('open');
    SV.markSaved();
    SV.toast(r.slop ? 'Opened “' + doc.name + '” — fully editable Slop Vector document' : 'Opened “' + doc.name + '”');
    return true;
  };
  IO.importSVGText = function (text, opts) {
    opts = opts || {};
    var r;
    try { r = IO.parseSVG(text, {}); } catch (e) { SV.toast(e.message, 'warn'); return null; }
    if (r.slop) {
      if (opts.allowOpen) return IO.openSVGText(text, opts.name);
      var objs = []; r.doc.layers.forEach(function (L) { if (!L.hidden) L.children.forEach(function (o) { objs.push(SV.reId(o)); }); });
      Object.keys(r.doc.assets || {}).forEach(function (k) { S.doc.assets[k] = r.doc.assets[k]; });
      r = { layers: [{ children: objs }], assets: {}, warnings: {} };
    }
    Object.keys(r.assets || {}).forEach(function (k) { S.doc.assets[k] = r.assets[k]; });
    var kids = r.layers[0] ? r.layers[0].children : [];
    if (!kids.length) { SV.toast('Nothing to import in that SVG', 'warn'); return null; }
    if (!SV.canDraw()) return null;
    var o = kids.length === 1 ? kids[0] : SV.mk.group(kids, opts.name || 'Placed SVG');
    if (opts.name && !o.name) o.name = opts.name;
    var b = SV.objBBox(o), c = opts.at;
    if (!c) { var rr = SV.dom.stage.getBoundingClientRect(); c = SV.toDoc(rr.width / 2, rr.height / 2); }
    if (b) SV.transformObj(o, G.translate(c.x - (b.x + b.w / 2), c.y - (b.y + b.h / 2)));
    SV.insertObj(o); SV.select([o.id]); SV.commit('place svg');
    return o;
  };

  /* ================= images & files ================= */
  function readFile(file, asText) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); }; fr.onerror = function () { rej(fr.error); };
      if (asText) fr.readAsText(file); else fr.readAsDataURL(file);
    });
  }
  IO.placeImageURL = function (url, name, at) {
    return loadImg(url).then(function (img) {
      if (!SV.canDraw()) return null;
      var w = img.naturalWidth || 100, h = img.naturalHeight || 100, maxW = S.doc.width * 0.8, maxH = S.doc.height * 0.8;
      var sc = min(1, maxW / w, maxH / h); w *= sc; h *= sc;
      var c = at; if (!c) { var rr = SV.dom.stage.getBoundingClientRect(); c = SV.toDoc(rr.width / 2, rr.height / 2); }
      var aid = 'a' + SV.uid(); S.doc.assets[aid] = url;
      var o = SV.mk.image(aid, c.x - w / 2, c.y - h / 2, w, h, name || 'Image');
      SV.insertObj(o); SV.select([o.id]); SV.commit('place image');
      return o;
    }).catch(function () { SV.toast('Could not read that image', 'warn'); });
  };
  IO.placeFiles = function (files, at) {
    var list = Array.from(files);
    return list.reduce(function (p, f, i) {
      return p.then(function () {
        var pt = at ? { x: at.x + i * 20, y: at.y + i * 20 } : null;
        var isSVG = /svg/.test(f.type) || /\.svg$/i.test(f.name);
        if (isSVG) return readFile(f, true).then(function (t) { IO.importSVGText(t, { name: f.name.replace(/\.svg$/i, ''), at: pt, allowOpen: list.length === 1 && at && /slopvector-document/.test(t) }); });
        if (/^image\//.test(f.type)) return readFile(f, false).then(function (u) { return IO.placeImageURL(u, f.name.replace(/\.[^.]+$/, ''), pt); });
        SV.toast('Unsupported file: ' + f.name, 'warn');
      });
    }, Promise.resolve());
  };
  IO.openFile = function (file) {
    if (!file) return;
    if (/svg/.test(file.type) || /\.svg$/i.test(file.name)) readFile(file, true).then(function (t) { IO.openSVGText(t, file.name); });
    else if (/^image\//.test(file.type)) IO.placeFiles([file]);
    else SV.toast('Open supports .svg files (use Place for images)', 'warn');
  };
  IO.pickFile = function (accept, cb, multiple) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.multiple = !!multiple; inp.style.display = 'none';
    inp.addEventListener('change', function () { cb(Array.from(inp.files || [])); inp.remove(); });
    document.body.appendChild(inp); inp.click();
  };
  IO.bindDrop = function () {
    var stage = SV.dom.stage, app = document.getElementById('app');
    ['dragenter', 'dragover'].forEach(function (t) { app.addEventListener(t, function (e) { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; app.classList.add('dropping'); } }); });
    app.addEventListener('dragleave', function (e) { if (e.target === app || !app.contains(e.relatedTarget)) app.classList.remove('dropping'); });
    app.addEventListener('drop', function (e) {
      app.classList.remove('dropping');
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      var r = stage.getBoundingClientRect();
      IO.placeFiles(e.dataTransfer.files, SV.toDoc(e.clientX - r.left, e.clientY - r.top));
    });
  };

  /* ================= offline self-download ================= */
  function fetchText(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(url + ' → HTTP ' + r.status); return r.text(); }); }
  IO.buildOfflineHTML = function () {
    var offline = location.protocol === 'file:' || !!document.querySelector('meta[name="slop-vector-build"]');
    if (offline) {
      if (window.__SV_PRISTINE) return Promise.resolve(window.__SV_PRISTINE);
      return Promise.reject(new Error('No pristine copy available'));
    }
    return fetchText('index.html').then(function (html) {
      var jobs = [];
      // stylesheets
      html = html.replace(/<link\b[^>]*>/gi, function (tag) {
        var href = (/href="([^"]+)"/i.exec(tag) || [])[1] || '';
        if (/fonts\.(googleapis|gstatic)\.com/.test(href) || /rel="preconnect"/i.test(tag)) return '';
        if (/rel="stylesheet"/i.test(tag) && !/^https?:/i.test(href)) { var k = '@@CSS' + jobs.length + '@@'; jobs.push({ k: k, url: href, kind: 'css' }); return k; }
        if (/rel="icon"/i.test(tag) && !/^https?:|^data:/i.test(href)) { var k2 = '@@ICON' + jobs.length + '@@'; jobs.push({ k: k2, url: href, kind: 'icon' }); return k2; }
        return tag;
      });
      html = html.replace(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)><\/script>/gi, function (m, a, src) {
        if (/^https?:/i.test(src)) return m;
        var k = '@@JS' + jobs.length + '@@'; jobs.push({ k: k, url: src, kind: 'js' }); return k;
      });
      return Promise.all(jobs.map(function (j) { return fetchText(j.url).then(function (t) { j.text = t; }); })).then(function () {
        jobs.forEach(function (j) {
          var rep;
          if (j.kind === 'css') rep = '<style>\n' + j.text.replace(/<\/style/gi, '<\\/style') + '\n</style>';
          else if (j.kind === 'js') rep = '<script>\n' + j.text.replace(/<\/script/gi, '<\\/script') + '\n</' + 'script>';
          else rep = '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(j.text) + '" type="image/svg+xml">';
          html = html.split(j.k).join(rep);
        });
        html = html.replace(/<meta charset="utf-8">/i, '<meta charset="utf-8">\n  <meta name="slop-vector-build" content="offline">');
        return html;
      });
    });
  };
  IO.downloadApp = function () {
    return IO.buildOfflineHTML().then(function (html) {
      IO.download(new Blob([html], { type: 'text/html' }), 'slop-vector.html');
      SV.toast('Downloaded slop-vector.html — open it from disk, works fully offline');
      return html;
    }).catch(function (e) { SV.toast('Could not build offline copy: ' + e.message, 'warn'); });
  };
})();
