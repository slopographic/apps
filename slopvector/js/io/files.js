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
})();
