/* Slop Vector — Slop Hub integration: Slop Drive open/place, "Send to" other apps, launch files.
   Uses window.SlopHub (../shared/hub.js) and window.SLOP_APPS (../shared/apps.js). */
(function () {
  'use strict';
  var SV = window.SV, S = SV.state, IO = SV.io = SV.io || {};
  var HUB = SV.hub = {};
  var ACCEPT = ['image/svg+xml', 'image/*'];

  HUB.available = function () { return !!window.SlopHub; };
  // Sending opens another app at its site path, which only exists when served (not from file://).
  HUB.canSend = function () { return HUB.available() && location.protocol !== 'file:'; };
  function isSVG(rec) { return /svg/.test(rec.type || '') || /\.svg$/i.test(rec.name || ''); }
  function baseName(n) { return String(n || 'Untitled').replace(/\.[^.\/]+$/, ''); }
  function blobToDataURL(blob) {
    return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { rej(fr.error); }; fr.readAsDataURL(blob); });
  }
  function imageSize(url) {
    return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res({ w: i.naturalWidth || 1, h: i.naturalHeight || 1 }); }; i.onerror = function () { rej(new Error('Unreadable image')); }; i.src = url; });
  }

  /* ---------- opening Drive records ---------- */
  // Open as a document: SVG → editable document; raster → new artboard the size of the image.
  HUB.openRecord = function (rec) {
    if (!rec || !rec.blob) return Promise.resolve(false);
    if (isSVG(rec)) return rec.blob.text().then(function (t) { return IO.openSVGText(t, rec.name || 'Untitled.svg'); });
    if (!/^image\//.test(rec.type || '')) { SV.toast('Slop Vector can’t open ' + (rec.type || 'that file'), 'warn'); return Promise.resolve(false); }
    return blobToDataURL(rec.blob).then(function (url) {
      return imageSize(url).then(function (sz) {
        var sc = Math.min(1, 8000 / Math.max(sz.w, sz.h)), w = Math.round(sz.w * sc), h = Math.round(sz.h * sc);
        var doc = SV.newDoc(w, h, baseName(rec.name));
        var aid = 'a' + SV.uid(); doc.assets[aid] = url;
        doc.layers[0].children.push(SV.mk.image(aid, 0, 0, w, h, baseName(rec.name)));
        SV.loadDoc(doc, { fit: true });
        SV.commit('open image'); SV.markSaved();
        SV.toast('Opened “' + (rec.name || 'image') + '” from Slop Drive');
        return true;
      });
    });
  };
  // Place into the current document: SVG → grouped artwork; raster → image object.
  HUB.placeRecord = function (rec) {
    if (!rec || !rec.blob) return Promise.resolve(null);
    if (isSVG(rec)) return rec.blob.text().then(function (t) { return IO.importSVGText(t, { name: baseName(rec.name) }); });
    if (!/^image\//.test(rec.type || '')) { SV.toast('Only SVG and images can be placed', 'warn'); return Promise.resolve(null); }
    return blobToDataURL(rec.blob).then(function (url) { return IO.placeImageURL(url, baseName(rec.name)); });
  };
  HUB.openFromDrive = function () {
    if (!HUB.available()) return SV.toast('Slop Drive is unavailable', 'warn');
    return window.SlopHub.pickFromDrive({ accept: ACCEPT, title: 'Open from Slop Drive' }).then(function (rec) { if (rec) return HUB.openRecord(rec); });
  };
  HUB.placeFromDrive = function () {
    if (!HUB.available()) return SV.toast('Slop Drive is unavailable', 'warn');
    return window.SlopHub.pickFromDrive({ accept: ACCEPT, title: 'Place from Slop Drive' }).then(function (rec) { if (rec) return HUB.placeRecord(rec); });
  };

  /* ---------- sending ---------- */
  HUB.svgBlob = function () { return new Blob([IO.exportSVG({ metadata: true })], { type: 'image/svg+xml' }); };
  HUB.pngBlob = function () {
    return IO.rasterize(2, null).then(function (c) { return new Promise(function (res) { c.toBlob(res, 'image/png'); }); });
  };
  // Items for File ▸ Send to: the document as SVG, then as PNG, to every app that accepts them.
  HUB.sendItems = function () {
    if (!HUB.available()) return [{ label: 'Slop Hub unavailable', disabled: true }];
    var name = function () { return IO.baseName(); };
    var svg = window.SlopHub.sendMenuItems(function () { return HUB.svgBlob(); }, function () { return name() + '.svg'; }, 'image/svg+xml');
    var png = window.SlopHub.sendMenuItems(function () { return HUB.pngBlob(); }, function () { return name() + '.png'; }, 'image/png')
      .map(function (it) { return { label: it.label.replace(/^Send to /, 'Send PNG to '), act: it.act }; });
    var items = svg.concat(svg.length && png.length ? ['-'] : [], png);
    if (!HUB.canSend()) items = items.map(function (it) { return it === '-' ? it : { label: it.label, disabled: true, title: 'Open Slop Vector on slopographic.com to send files' }; });
    return items.length ? items : [{ label: 'No other apps accept this', disabled: true }];
  };
  HUB.sendTo = function (appId, kind) {
    var make = kind === 'png' ? HUB.pngBlob() : Promise.resolve(HUB.svgBlob());
    return make.then(function (b) { return window.SlopHub.sendTo(appId, b, IO.baseName() + (kind === 'png' ? '.png' : '.svg')); });
  };

  /* ---------- boot ---------- */
  HUB.init = function () {
    if (!HUB.available()) return Promise.resolve(null);
    try { window.SlopHub.register('vector'); } catch (e) { /* bus unavailable */ }
    return window.SlopHub.consumeLaunch().then(function (rec) {
      if (!rec) return null;
      return HUB.openRecord(rec).then(function () { return rec; });
    }).catch(function () { return null; });
  };
})();
