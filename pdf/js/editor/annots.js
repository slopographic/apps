/* Slop PDF — annotation commands: add, delete, duplicate, copy/paste, nudge, property changes,
   tool switching and placing images / signatures. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, Ed = SP.editor, S = Ed._;
  /* -------------------------------------------------------------- commits */
  S.commitPage = function (label, fn, coalesce) {
    var pid = Ed.pid;
    return E.commit(label, function (st) { var p = st.pages.filter(function (x) { return x.id === pid; })[0]; if (p) return fn(p); }, coalesce);
  }
  Ed.addAnnot = function (a, label) {
    a.id = a.id || U.uid('a');
    S.commitPage(label || 'Add ' + a.type, function (p) { p.annots.push(a); });
    Ed.selId = a.id; Ed.paint();
    if (SP.app) SP.app.editorSelectionChanged();
    return a;
  };
  Ed.deleteSelected = function () {
    var id = Ed.selId; if (!id) return;
    S.commitPage('Delete annotation', function (p) { p.annots = p.annots.filter(function (a) { return a.id !== id; }); });
    Ed.select(null);
  };
  Ed.duplicateSelected = function () {
    var a = Ed.getSelected(); if (!a) return;
    var c = JSON.parse(JSON.stringify(a)); c.id = U.uid('a');
    S.nudge(c, 12, 12);
    Ed.addAnnot(c, 'Duplicate annotation');
  };
  var clip = null;
  Ed.copy = function () { var a = Ed.getSelected(); if (a) { clip = JSON.parse(JSON.stringify(a)); return true; } return false; };
  Ed.canPaste = function () { return !!clip; };
  Ed.paste = function () { if (!clip || !Ed.page()) return false; var c = JSON.parse(JSON.stringify(clip)); c.id = U.uid('a'); S.nudge(c, 12, 12); Ed.addAnnot(c, 'Paste annotation'); clip = c; return true; };
  S.nudge = function (a, dx, dy) {
    var c = S.ctx(), r = E.annotViewRect(a, c.R, c.W, c.H);
    E.setAnnotViewRect(a, { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }, c.R, c.W, c.H);
  }
  Ed.nudgeSelected = function (dx, dy) {
    var id = Ed.selId; if (!id) return;
    S.commitPage('Move annotation', function (p) { p.annots.forEach(function (a) { if (a.id === id) S.nudge(a, dx, dy); }); }, 'nudge:' + id);
  };
  /** Updates a property on the selection (and on the tool default). */
  Ed.setProp = function (key, val) {
    var a = Ed.getSelected(), type = a ? a.type : Ed.tool;
    if (Ed.DEF[type]) { Ed.defaults[type][key] = val; U.store.set('toolDefaults', Ed.defaults); }
    if (!a) return;
    var id = a.id;
    S.commitPage('Change ' + key, function (p) {
      p.annots.forEach(function (x) {
        if (x.id !== id) return;
        if (x.type === 'text' && (key === 'size' || key === 'font' || key === 'bold' || key === 'italic')) {
          var c = S.ctx(), r = E.annotViewRect(x, c.R, c.W, c.H);
          x[key] = val; var t = E.textLayout(x);
          var va = (((c.R - (x.rot || 0)) % 360) + 360) % 360;
          E.setAnnotViewRect(x, { x: r.x, y: r.y, w: va % 180 ? t.h : t.w, h: va % 180 ? t.w : t.h }, c.R, c.W, c.H);
        } else x[key] = val;
      });
    }, 'prop:' + id + ':' + key);
  };
  Ed.setTool = function (t) {
    S.finishText(true);
    if (t === 'image') { Ed.pickImage(); return; }
    if (t === 'signature') { SP.sign.open(function (asset) { Ed.placeImage(asset, 'Add signature'); }); return; }
    Ed.tool = t; if (S.pageEl) S.pageEl.dataset.tool = t;
    if (t !== 'select') Ed.select(null);
    if (SP.app) SP.app.toolChanged();
  };

  /* -------------------------------------------------------------- images */
  Ed.pickImage = function () {
    SlopUI.pickFiles({ accept: 'image/png,image/jpeg,image/webp,image/gif' }).then(async function (files) {
      if (!files || !files[0]) return;
      try {
        var bytes = await U.readFile(files[0]), im = await E.prepareImage(bytes);
        var asset = E.addAsset({ mime: im.mime, url: U.bytesToDataURL(im.bytes, im.mime), w: im.w, h: im.h, name: files[0].name });
        Ed.placeImage(asset, 'Add image');
      } catch (e) { SlopUI.alert('Image not added', 'That image could not be read: ' + (e.message || e)); }
    });
  };
  Ed.placeImage = function (asset, label) {
    var p = Ed.page(); if (!p) return;
    var c = S.ctx(), vs = E.viewSize(p);
    var maxW = vs.w * (label === 'Add signature' ? 0.32 : 0.45), w = Math.min(maxW, asset.w * 0.75), h = w * asset.h / asset.w;
    if (h > vs.h * 0.5) { h = vs.h * 0.5; w = h * asset.w / asset.h; }
    // centre of the visible part of the page
    var vr = S.viewer.getBoundingClientRect(), pr = S.pageEl.getBoundingClientRect();
    var cx = U.clamp(((vr.left + vr.width / 2) - pr.left) / c.z, w / 2, vs.w - w / 2), cy = U.clamp(((vr.top + vr.height / 2) - pr.top) / c.z, h / 2, vs.h - h / 2);
    var a = { type: 'image', asset: asset.id, opacity: 1, rot: c.R, cx: 0, cy: 0, w: w, h: h };
    if (label === 'Add signature') a.sig = true;
    E.setAnnotViewRect(a, { x: cx - w / 2, y: cy - h / 2, w: w, h: h }, c.R, c.W, c.H);
    Ed.tool = 'select'; S.pageEl.dataset.tool = 'select';
    Ed.addAnnot(a, label);
    if (SP.app) SP.app.toolChanged();
  };

})();
