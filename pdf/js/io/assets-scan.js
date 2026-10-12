/* Slop PDF — extract assets, reading: the embedded images and fonts of the pages in the document. pdf.js renders and
   decodes pages but does not expose the stored stream of an image or font, so pdf-lib reads the objects of each source
   file (only the pages still in the document, following form XObjects, and each object once). Decoding is in
   assets-save.js. */
(function () {
  'use strict';
  var SP = window.SP, E = SP.engine, Mod = window.SlopPdfAssets, A = SP.assets = {};

  /** Inflates zlib (Flate) data with the browser's DecompressionStream. */
  A.inflate = async function (bytes) {
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };
  /** The stream's bytes after its filters (raw, or Flate with an optional predictor). Null for filters that are not decoded. */
  A.streamBytes = async function (stream, filters, parms) {
    if (!filters.length) return stream.contents;
    if (filters.length === 1 && filters[0] === 'FlateDecode') {
      try { return Mod.unpredict(await A.inflate(stream.contents), parms || {}); } catch (e) { return null; }
    }
    return null;
  };

  /** The reading of one source file: resolves references and reads names, numbers, arrays and colour spaces. */
  function reader(ctx, PL) {
    var lk = function (o) { return o instanceof PL.PDFRef ? ctx.lookup(o) : o; };
    var nm = function (o) { o = lk(o); return o && o.decodeText ? o.decodeText() : ''; };
    var num = function (d, k) { var v = lk(d.get(PL.PDFName.of(k))); return v && v.asNumber ? v.asNumber() : undefined; };
    var has = function (d, k) { return d.get(PL.PDFName.of(k)) !== undefined; };
    var get = function (d, k) { return lk(d.get(PL.PDFName.of(k))); };
    var filters = function (d) {
      var f = get(d, 'Filter'); if (!f) return [];
      if (f instanceof PL.PDFArray) { var out = []; for (var i = 0; i < f.size(); i++) out.push(nm(f.get(i))); return out; }
      return [nm(f)];
    };
    var parms = function (d) {
      var p = get(d, 'DecodeParms') || get(d, 'DP'); if (p instanceof PL.PDFArray) p = lk(p.get(0));
      if (!(p instanceof PL.PDFDict)) return {};
      var o = {}; ['Predictor', 'Colors', 'BitsPerComponent', 'Columns'].forEach(function (k) { var v = num(p, k); if (v !== undefined) o[k] = v; });
      return o;
    };
    /** Colour space: name, component count, and for palettes the base and the lookup bytes. */
    var colour = function (cs) {
      cs = lk(cs);
      if (cs instanceof PL.PDFName) { var n = cs.decodeText(); return { colorSpace: n, comps: Mod.COMPS[n] || (n === 'DeviceCMYK' ? 4 : 0) }; }
      if (cs instanceof PL.PDFArray) {
        var first = nm(cs.get(0));
        if (first === 'ICCBased') { var st = lk(cs.get(1)); return { colorSpace: 'ICCBased', comps: st && st.dict ? (num(st.dict, 'N') || 0) : 0 }; }
        if (first === 'Indexed') {
          var base = colour(cs.get(1)), look = lk(cs.get(3)), bytes = null;
          if (look && look.contents) bytes = look.contents;
          else if (look && look.asBytes) bytes = look.asBytes();
          return { colorSpace: 'Indexed', comps: 1, base: base.comps === 3 ? 'DeviceRGB' : base.comps === 1 ? 'DeviceGray' : base.colorSpace, palette: bytes };
        }
        return { colorSpace: first, comps: 0 };
      }
      return { colorSpace: '', comps: 0 };
    };
    return { lk: lk, nm: nm, num: num, has: has, get: get, filters: filters, parms: parms, colour: colour };
  }

  /** Reads the images and fonts of the document's pages. Resolves { images, fonts }, each item once (with the pages it is on). */
  A.scan = async function () {
    var PL = window.PDFLib, out = { images: [], fonts: [] }, seen = new Set(), n = 0;
    var byFile = new Map();
    E.state.pages.forEach(function (p) {
      if (!p.f || p.blank || !E.files.get(p.f)) return;
      if (!byFile.has(p.f)) byFile.set(p.f, new Set());
      byFile.get(p.f).add(p.i);
    });
    for (var [fid, idxs] of byFile) {
      var f = E.files.get(fid), doc = await PL.PDFDocument.load(f.bytes, { updateMetadata: false, ignoreEncryption: true, throwOnInvalidObject: false });
      var R = reader(doc.context, PL), pages = doc.getPages();
      var file = f.name || 'document';
      for (var i of Array.from(idxs).sort(function (a, b) { return a - b; })) {
        var pg = pages[i]; if (!pg) continue;
        var ctx = { fid: fid, file: file, page: i + 1, multi: byFile.size > 1 };
        await walk(R, R.lk(pg.node.Resources ? pg.node.Resources() : null), ctx, out, seen, function () { return ++n; }, 0);
      }
    }
    out.images.forEach(function (im) { im.pageText = im.pages.length > 1 ? 'pages ' + im.pages.join(', ') : 'page ' + im.pages[0]; });
    return out;
  };

  async function walk(R, res, ctx, out, seen, next, depth) {
    if (!res || depth > 12) return;
    var PL = window.PDFLib, xo = R.lk(R.get(res, 'XObject'));
    if (xo instanceof PL.PDFDict) {
      for (var [name, ref] of xo.entries()) {
        var key = ctx.fid + ':' + String(ref), obj = R.lk(ref);
        if (!obj || !obj.dict) continue;
        var sub = R.nm(obj.dict.get(PL.PDFName.of('Subtype')));
        if (sub === 'Image') {
          if (seen.has(key)) { var old = out.images.find(function (x) { return x.key === key; }); if (old && old.pages.indexOf(ctx.page) < 0) old.pages.push(ctx.page); continue; }
          seen.add(key); out.images.push(await imageItem(R, name.decodeText(), key, obj, ctx, next()));
        } else if (sub === 'Form' && !seen.has(key)) {
          seen.add(key);
          await walk(R, R.lk(obj.dict.get(PL.PDFName.of('Resources'))), ctx, out, seen, next, depth + 1);
        }
      }
    }
    var fonts = R.lk(R.get(res, 'Font'));
    if (fonts instanceof PL.PDFDict) {
      for (var [, fref] of fonts.entries()) {
        var fkey = ctx.fid + ':font:' + String(fref);
        if (seen.has(fkey)) continue;
        seen.add(fkey);
        var fd = R.lk(fref); if (fd instanceof PL.PDFDict) out.fonts.push(await fontItem(R, fd, fkey, ctx, next()));
      }
    }
  }

  async function imageItem(R, name, key, s, ctx, n) {
    var PL = window.PDFLib, d = s.dict, bpc = R.num(d, 'BitsPerComponent');
    var im = R.get(d, 'ImageMask'), imageMask = !!(im && im.asBoolean && im.asBoolean());
    var cs = R.has(d, 'ColorSpace') ? R.colour(d.get(PL.PDFName.of('ColorSpace'))) : { colorSpace: imageMask ? 'Mask' : '', comps: 1 };
    var fl = R.filters(d), w = R.num(d, 'Width') || 0, h = R.num(d, 'Height') || 0;
    if (imageMask) bpc = 1; else if (bpc === undefined) bpc = 8;
    var kind = Mod.imageKind({ filters: fl, bpc: bpc, colorSpace: cs.colorSpace, comps: cs.comps, base: cs.base, imageMask: imageMask });
    return {
      id: 'img' + n, key: key, name: name, file: ctx.multi ? ctx.file : '', pages: [ctx.page], page: ctx.page, pageText: '',
      width: w, height: h, colorSpace: cs.colorSpace, bpc: bpc,
      filterText: fl.join('+') || 'raw', size: s.contents ? s.contents.length : 0,
      kind: kind.kind, ext: kind.ext || null, reason: kind.reason || '', mask: R.has(d, 'SMask') || R.has(d, 'Mask'),
      comps: cs.comps, base: cs.base, palette: cs.palette || null, filters: fl, parms: R.parms(d), contents: s.contents, fileId: ctx.fid
    };
  }

  async function fontItem(R, fd, key, ctx, n) {
    var PL = window.PDFLib, sub = R.nm(fd.get(PL.PDFName.of('Subtype'))), base = R.nm(fd.get(PL.PDFName.of('BaseFont'))) || 'Font';
    var desc = fd;
    if (sub === 'Type0') { var df = R.lk(fd.get(PL.PDFName.of('DescendantFonts'))), cid = df instanceof PL.PDFArray ? R.lk(df.get(0)) : null; if (cid instanceof PL.PDFDict) desc = cid; }
    var fdesc = R.get(desc, 'FontDescriptor'), file = null, fkey = null, stream = null;
    if (fdesc instanceof PL.PDFDict) {
      for (var k of ['FontFile', 'FontFile2', 'FontFile3']) { var v = fdesc.get(PL.PDFName.of(k)); if (v !== undefined) { file = R.lk(v); fkey = k; break; } }
    }
    var bytes = null, reason = '', fsub = '';
    if (file && file.contents) {
      stream = file; fsub = R.nm(file.dict.get(PL.PDFName.of('Subtype')));
      bytes = await A.streamBytes(file, R.filters(file.dict), R.parms(file.dict));
      if (!bytes) reason = 'This font stream is stored in a way that is not decoded';
    }
    var kind = Mod.fontKind({ key: fkey, subtype: fsub, firstByte: bytes ? bytes[0] : 0 });
    var type = fkey ? kind.label : 'not embedded';
    if (sub === 'Type0') type = 'Composite (' + type + ')';
    return { id: 'font' + n, key: key, name: base, type: type, embedded: !!bytes, size: bytes ? bytes.length : 0, bytes: bytes,
      subset: Mod.subsetOf(base), ext: bytes ? kind.ext : null, reason: reason, file: ctx.multi ? ctx.file : '', pages: [ctx.page] };
  }
})();
