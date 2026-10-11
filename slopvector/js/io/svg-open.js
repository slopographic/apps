/* SlopVector — io: open/import SVG documents */
(function () {
  'use strict';
  var G = window.SVGeom, SV = window.SV, S = SV.state;
  var fmt = G.fmt, esc = SV.esc, clone = SV.clone;
  var abs = Math.abs, min = Math.min, max = Math.max, sqrt = Math.sqrt;
  var IO = SV.io = SV.io || {};
  var $ = SV._io = SV._io || {};
  function svgToObjects() { return $.svgToObjects.apply(this, arguments); }

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
    SV.toast(r.slop ? 'Opened “' + doc.name + '” — fully editable SlopVector document' : 'Opened “' + doc.name + '”');
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
})();
