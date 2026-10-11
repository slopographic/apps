/* Slop Slides: canvas pointer interactions. A press selects the object under the pointer (Shift toggles), a drag moves
   the selection with smart guides, a drag on a handle resizes one unrotated object, and a second press on the same
   object within 450 ms (double-click or double-tap) opens its text. A gesture is one undo step; a press that does
   not move drops its step. Exposes window.SS.pointer.bind(canvas). */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, O = SS.objects, U = SS.util, St = SS.stage, OV = SS.overlay, SN = SS.snap;
  var P = SS.pointer = {};
  var last = null, drag = null;
  var CUR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

  function hover(p) {
    var h = OV.handleAt(p, A.selObjs()), hit = h ? null : OV.hit(A.slide(), p);
    St.cv.style.cursor = h ? CUR[h] : (hit ? 'move' : 'default');
  }
  function start(e, p, hit, h) {
    var sel = A.selObjs();
    if (h) {
      var o = sel[0];
      drag = { kind: 'resize', h: h, o: o, b0: { x: o.x, y: o.y, w: o.w, h: o.h }, p0: p, label: 'Resize' };
    } else {
      if (e.shiftKey) {
        var ids = A.sel.slice(), i = ids.indexOf(hit.id);
        if (i >= 0) { ids.splice(i, 1); A.select(ids); return; }
        A.select(ids.concat([hit.id]));
      } else if (A.sel.indexOf(hit.id) < 0) A.select([hit.id]);
      var items = A.selObjs().map(function (o2) { return { o: o2, x: o2.x, y: o2.y }; });
      var ids2 = items.map(function (it) { return it.o.id; });
      drag = {
        kind: 'move', items: items, p0: p, label: 'Move',
        box: O.union(items.map(function (it) { return it.o; })),
        others: A.slide().objects.filter(function (o3) { return ids2.indexOf(o3.id) < 0; }).map(O.bounds)
      };
    }
    drag.moved = false;
    A.hist.push(drag.label, null);
    try { St.cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events have no active pointer */ }
  }
  function down(e) {
    if (A.mode !== 'edit' || !A.slide() || e.button > 0) return;
    if (SS.textEdit.editing) SS.textEdit.commit();
    var p = St.toSlide(e.clientX, e.clientY), now = Date.now();
    var hit = OV.hit(A.slide(), p), h = OV.handleAt(p, A.selObjs());
    if (hit && last && last.id === hit.id && now - last.t < 450 && SS.textEdit.canEdit(hit)) {
      last = null;
      e.preventDefault();
      SS.textEdit.open(hit);
      return;
    }
    last = hit ? { id: hit.id, t: now } : null;
    if (!hit && !h) { if (!e.shiftKey) A.select([]); return; }
    start(e, p, hit, h);
  }
  function move(e) {
    var p = St.toSlide(e.clientX, e.clientY);
    if (!drag) { if (A.mode === 'edit' && A.slide()) hover(p); return; }
    var dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) * St.k < 3) return;
      drag.moved = true;
    }
    if (drag.kind === 'move') {
      var s = SN.move(drag.box, drag.others, dx, dy);
      drag.items.forEach(function (it) { it.o.x = it.x + s.dx; it.o.y = it.y + s.dy; });
    } else {
      var b = OV.resizeBox(drag.b0, drag.h, dx, dy), o = drag.o;
      o.x = b.x; o.y = b.y; o.w = b.w; o.h = b.h;
      if (o.type === 'table') O.fixTable(o);
    }
    A.touch();
  }
  function up(e) {
    if (!drag) return;
    var d = drag;
    drag = null;
    SN.clear();
    try { St.cv.releasePointerCapture(e.pointerId); } catch (err) { /* not captured */ }
    if (d.moved) A.touch(); else A.hist.drop();
    St.redraw();
  }
  /** Wires the pointer events of the editing canvas. */
  P.bind = function (cv) {
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', function () { if (!drag) cv.style.cursor = 'default'; });
  };
  P.isDragging = function () { return !!drag; };
})();
