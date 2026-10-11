/* Slop Slides: context menus for a slide thumbnail, an object, a text box, and the empty slide. A right-click on an
   object selects it first. The Menu key or Shift+F10 opens the menu for the focused thumbnail, or for the canvas
   (its selection, or the empty slide). Every item calls an SS.ops or SS.app action, so no logic is repeated here.
   Exposes window.SS.ctxmenu. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, OP = SS.ops;

  /** Runs fn with slide i current (the slide actions work on the current slide). */
  function onSlide(i, fn) { return function () { A.go(i); fn(); }; }
  var keyOf = function (id, fb) { return window.SlopCtx ? SlopCtx.keyFor(id, fb) : fb || ''; };

  /** A thumbnail: the slide's own actions. */
  function thumbItems(i) {
    var n = A.deck.slides.length, s = A.deck.slides[i], out = [
      { label: 'New slide after', act: onSlide(i, OP.newSlide) },
      { label: 'Duplicate slide', act: onSlide(i, OP.dupSlide) },
    ];
    if (i > 0) out.push({ label: 'Move up', act: onSlide(i, function () { OP.moveSlide(-1); }) });
    if (i < n - 1) out.push({ label: 'Move down', act: onSlide(i, function () { OP.moveSlide(1); }) });
    out.push('-', { label: s.hidden ? 'Show slide' : 'Hide slide', act: onSlide(i, function () { OP.setHidden(!s.hidden); }) });
    if (n > 1) out.push('-', { label: 'Delete slide', act: onSlide(i, OP.delSlide) });
    return out;
  }

  /** An object or text box (the selection, when the pointer is on one of them). */
  function objectItems(objs) {
    var one = objs.length === 1 ? objs[0] : null, out = [];
    if (one && SS.textEdit.canEdit(one)) out.push({ label: 'Edit text', act: function () { SS.textEdit.open(one); } }, '-');
    out.push(
      { label: 'Copy', key: keyOf('slides.copy', 'Ctrl+C'), act: function () { OP.copy(); } },
      { label: 'Paste', key: keyOf('slides.paste', 'Ctrl+V'), act: function () { OP.paste(); }, disabled: !A.clip },
      { label: 'Duplicate', key: keyOf('slides.duplicate', 'Ctrl+D'), act: function () { OP.duplicateSel(); } },
      '-',
      { label: 'Bring to front', act: function () { OP.arrange('front'); } },
      { label: 'Bring forward', act: function () { OP.arrange('forward'); } },
      { label: 'Send to back', act: function () { OP.arrange('back'); } },
      '-',
      { label: 'Delete', key: keyOf('slides.delete', 'Delete'), act: function () { OP.deleteSel(); } }
    );
    return out;
  }

  /** The empty slide: insert the basic objects, paste, or hide this slide. */
  function emptyItems() {
    return [
      { label: 'Add text', act: function () { OP.addText(); } },
      { label: 'Add rectangle', act: function () { OP.addShape('rect'); } },
      { label: 'Add ellipse', act: function () { OP.addShape('ellipse'); } },
      { label: 'Add picture…', act: function () { OP.addImage(); } },
      '-',
      { label: 'Paste', key: keyOf('slides.paste', 'Ctrl+V'), act: function () { OP.paste(); }, disabled: !A.clip },
      '-',
      { label: A.slide() && A.slide().hidden ? 'Show slide' : 'Hide slide', act: function () { OP.setHidden(!(A.slide() && A.slide().hidden)); } },
    ];
  }

  /** What the canvas menu shows: the selected objects, or the empty slide. */
  function canvasItems() {
    var objs = A.selObjs();
    return objs.length ? objectItems(objs) : emptyItems();
  }

  function resolve(target, ev) {
    if (!target || !target.closest || A.mode !== 'edit' || !A.deck) return null;
    if (!ev) {
      if (target.classList && target.classList.contains('thumb') && target.dataset.id) return thumbItems(index(target.dataset.id));
      if (target.id === 'canvas' && A.slide()) return canvasItems();
      return null;
    }
    var thumb = target.closest('.thumb[data-id]');
    if (thumb) return thumbItems(index(thumb.dataset.id));
    var canvas = target.closest('#stage');
    if (!canvas || !A.slide()) return null;
    var p = SS.stage.toSlide(ev.clientX, ev.clientY), hit = SS.overlay.hit(A.slide(), p);
    if (hit && A.sel.indexOf(hit.id) < 0) A.select([hit.id]);
    return A.selObjs().length ? objectItems(A.selObjs()) : emptyItems();
  }
  function index(id) { return A.deck.slides.findIndex(function (s) { return s.id === id; }); }

  SS.ctxmenu = {
    thumbItems: thumbItems, objectItems: objectItems, emptyItems: emptyItems, resolve: resolve,
    mount: function () {
      if (!window.SlopCtx) return;
      var list = document.getElementById('slides-list'), stage = document.getElementById('stage');
      if (list) SlopCtx.bind(list, resolve);
      if (stage) SlopCtx.bind(stage, resolve);
    },
  };
})();
