/* SlopVector — io: images, file picking, drag and drop */
(function () {
  'use strict';
  var G = window.SVGeom, SV = window.SV, S = SV.state;
  var fmt = G.fmt, esc = SV.esc, clone = SV.clone;
  var abs = Math.abs, min = Math.min, max = Math.max, sqrt = Math.sqrt;
  var IO = SV.io = SV.io || {};
  var $ = SV._io = SV._io || {};
  function loadImg() { return $.loadImg.apply(this, arguments); }

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
      o.src = { w: img.naturalWidth || w, h: img.naturalHeight || h }; // the source ratio, for Restore original aspect ratio
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
  IO.pickFile = function (accept, cb, multiple) { window.SlopUI.pickFiles({ accept: accept, multiple: !!multiple }).then(cb); };
  // Drops go through SlopDrop (shared/drop): a file is placed at the drop point (offset for each extra file), and the
  // strip at the foot of the stage shows each file's progress. The window's drag outline comes from the module.
  var DROP_RULES = { types: ['image/*'], exts: ['.svg'], noun: 'an SVG or a picture' };
  IO.bindDrop = function () {
    var stage = SV.dom.stage;
    window.SlopDrop.attach(document.getElementById('svDrop'), {
      accept: DROP_RULES,
      compact: true,
      targets: [document.getElementById('app')],
      process: function (file, progress, ctx) {
        var r = stage.getBoundingClientRect();
        var at = ctx.at ? SV.toDoc(ctx.at.x - r.left, ctx.at.y - r.top) : null;
        var pt = at ? { x: at.x + ctx.index * 20, y: at.y + ctx.index * 20 } : null;
        return IO.placeFiles([file], pt).then(function () { return file.name; });
      },
    });
  };
})();
