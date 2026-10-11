/* Slop Slides: canvas pointer interactions: select, multi-select, marquee, move (with smart guides, Alt-drag
   copies), resize (rotated objects too; Shift keeps proportions, Alt from the centre), rotate (Shift = 15° steps,
   magnetic at right angles), line end points, corner radius, double-click to edit, pinch zoom. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, V = SS.view, H = SS.overlay, U = SS.util, O = SS.objects, SN = SS.snap;
  var P = SS.pointer = {};
  var drag = null, touches = new Map(), pinch = null;

  function snapshot(objs) { return objs.map(function (o) { return { o: o, x: o.x, y: o.y, w: o.w, h: o.h, rot: o.rot || 0, flipH: o.flipH, flipV: o.flipV }; }); }
  function begin(kind, e, extra) {
    drag = Object.assign({ kind: kind, start: V.toSlide(e.clientX, e.clientY), moved: false, id: e.pointerId, shift: e.shiftKey, alt: e.altKey }, extra || {});
    try { V.overlay.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
  }
  function commitStart(label) { if (!drag.pushed) { A.history.push(label); drag.pushed = true; } }

  P.init = function () {
    var st = V.stage;
    st.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    st.addEventListener('dblclick', dbl);
    st.addEventListener('contextmenu', function (e) {
      if (A.editing || !e.target.closest('.board')) return;
      e.preventDefault();
      var hit = H.hit(V.toSlide(e.clientX, e.clientY));
      if (hit && A.sel.indexOf(hit.id) < 0) A.select([hit.id]);
      if (!hit) A.select([]);
      if (SS.menus) SS.menus.objectMenu(e.clientX, e.clientY);
    });
    st.addEventListener('pointermove', function (e) {
      if (drag || e.pointerType !== 'mouse' || A.editing) return;
      var h = e.target.closest && e.target.closest('.board') ? H.hit(V.toSlide(e.clientX, e.clientY)) : null;
      if (h !== H.hover) { H.hover = h; H.draw(); }
    });
  };

  function down(e) {
    if (A.readOnly || A.playing) return;
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) { drag = null; var t = Array.from(touches.values()); pinch = { d: Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y), k: V.k }; return; }
    }
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (A.editing && e.target.closest('.text-editor')) return;
    var pt = V.toSlide(e.clientX, e.clientY), hname = e.target.dataset && e.target.dataset.h;
    if (A.editing) SS.textEdit.commit();
    if (hname) {
      var sel = A.selected();
      e.preventDefault();
      if (hname === 'rot') begin('rotate', e, { objs: snapshot(sel) });
      else if (hname === 'p0' || hname === 'p1') begin('lineEnd', e, { end: hname, o: sel[0], ends: H.lineEnds(sel[0]) });
      else if (hname === 'radius') begin('radius', e, { o: sel[0] });
      else begin('resize', e, { h: hname, objs: snapshot(sel), union: O.union(sel) });
      return;
    }
    if (!e.target.closest('.board') && e.target !== V.stage) return;
    var hit = H.hit(pt);
    if (hit) {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        var ids = A.sel.slice(), i = ids.indexOf(hit.id);
        if (i >= 0) ids.splice(i, 1); else ids.push(hit.id);
        A.select(ids);
      } else if (A.sel.indexOf(hit.id) < 0) A.select([hit.id]);
      if (A.sel.indexOf(hit.id) >= 0 && !hit.locked) begin('move', e, { objs: snapshot(A.selected()) });
      e.preventDefault();
    } else {
      begin('marquee', e, { base: e.shiftKey ? A.sel.slice() : [] });
      if (!e.shiftKey) A.select([]);
    }
  }

  function move(e) {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) {
      var t = Array.from(touches.values()), d = Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y);
      V.setZoom(pinch.k * d / pinch.d, { x: (t[0].x + t[1].x) / 2, y: (t[0].y + t[1].y) / 2 });
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    var pt = V.toSlide(e.clientX, e.clientY), dx = pt.x - drag.start.x, dy = pt.y - drag.start.y;
    if (!drag.moved && Math.hypot(dx * V.k, dy * V.k) < 3) return;
    drag.moved = true;
    var fn = P[drag.kind]; if (fn) fn(e, pt, dx, dy);
    A.invalidate(A.cur);
  }
  function up(e) {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null;
    H.guides = []; H.marquee = null;
    if (d.moved && d.pushed) { A.setDirty(true); A.emit('select'); }
    A.invalidate('all');
  }

  P.move = function (e, pt, dx, dy) {
    if (!drag.pushed) {
      commitStart(e.altKey ? 'Duplicate' : 'Move');
      if (e.altKey) { // Alt-drag leaves copies behind
        var s = A.slide();
        drag.objs.forEach(function (r) { var c = O.reId(U.clone(r.o)); s.objects.splice(s.objects.indexOf(r.o), 0, c); });
      }
    }
    var ub = O.union(drag.objs.map(function (r) { return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h, rot: r.rot }; }));
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; ub = O.union(drag.objs.map(function (r) { return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h, rot: r.rot }; })); }
    var sn = SN.move(ub, drag.objs.map(function (r) { return r.o; }), { off: e.metaKey || e.ctrlKey });
    drag.objs.forEach(function (r) { r.o.x = r.x + dx + sn.dx; r.o.y = r.y + dy + sn.dy; });
    H.guides = sn.guides;
  };
  P.marquee = function (e, pt) {
    var s = drag.start, r = { x: Math.min(s.x, pt.x), y: Math.min(s.y, pt.y), w: Math.abs(pt.x - s.x), h: Math.abs(pt.y - s.y) };
    H.marquee = r;
    var ids = drag.base.concat(H.inRect(r).map(function (o) { return o.id; }).filter(function (id) { return drag.base.indexOf(id) < 0; }));
    A.sel = ids; H.draw();
  };
  P.rotate = function (e, pt) {
    commitStart('Rotate');
    var u = O.union(drag.objs.map(function (r) { return r; })), cx = u.x + u.w / 2, cy = u.y + u.h / 2;
    if (drag.objs.length === 1) { var r0 = drag.objs[0]; cx = r0.x + r0.w / 2; cy = r0.y + r0.h / 2; }
    var a0 = Math.atan2(drag.start.y - cy, drag.start.x - cx), a1 = Math.atan2(pt.y - cy, pt.x - cx);
    var delta = (a1 - a0) * 180 / Math.PI;
    drag.objs.forEach(function (r) {
      var rot = r.rot + delta;
      if (e.shiftKey) rot = Math.round(rot / 15) * 15;
      else { var near = Math.round(rot / 90) * 90; if (Math.abs(rot - near) < 4) rot = near; }
      rot = ((rot % 360) + 360) % 360;
      if (drag.objs.length > 1) { // orbit around the selection centre
        var d2 = (rot - r.rot) * Math.PI / 180, ox = r.x + r.w / 2 - cx, oy = r.y + r.h / 2 - cy;
        r.o.x = cx + ox * Math.cos(d2) - oy * Math.sin(d2) - r.w / 2; r.o.y = cy + ox * Math.sin(d2) + oy * Math.cos(d2) - r.h / 2;
      }
      r.o.rot = U.round(rot, 2);
    });
    A.emit('hint', Math.round(drag.objs[0].o.rot) + '°');
  };
  P.radius = function (e, pt) {
    commitStart('Corner radius');
    var o = drag.o, p = U.mat.apply(U.mat.invert(U.mat.forObject(o)), pt.x, pt.y);
    o.radius = U.round(U.clamp(p[0] / Math.min(o.w, o.h), 0, 0.5), 3);
  };
  P.lineEnd = function (e, pt) {
    commitStart('Edit line');
    var o = drag.o, ends = drag.ends, fixed = drag.end === 'p0' ? ends[1] : ends[0], q = [pt.x, pt.y];
    if (e.shiftKey) { var a = Math.atan2(q[1] - fixed[1], q[0] - fixed[0]), L = Math.hypot(q[0] - fixed[0], q[1] - fixed[1]); a = Math.round(a / (Math.PI / 12)) * Math.PI / 12; q = [fixed[0] + Math.cos(a) * L, fixed[1] + Math.sin(a) * L]; }
    var p0 = drag.end === 'p0' ? q : fixed, p1 = drag.end === 'p0' ? fixed : q;
    P.setLine(o, p0, p1);
  };
  /** Sets a line object from two slide points (normalised to positive size with flips). */
  P.setLine = function (o, p0, p1) {
    o.rot = 0; o.flipH = p1[0] < p0[0]; o.flipV = p1[1] < p0[1];
    o.x = Math.min(p0[0], p1[0]); o.y = Math.min(p0[1], p1[1]); o.w = Math.abs(p1[0] - p0[0]); o.h = Math.abs(p1[1] - p0[1]);
  };
  P.resize = function (e, pt) {
    commitStart('Resize');
    var h = drag.h, keep = e.shiftKey, fromC = e.altKey;
    if (drag.objs.length > 1) return resizeMany(h, pt, !e.altKey); // proportional unless Alt
    var r = drag.objs[0], o = r.o;
    if (o.type === 'image' && h.length === 2) keep = !e.shiftKey;
    var m0 = U.mat.forObject(r), p = U.mat.apply(U.mat.invert(m0), pt.x, pt.y);
    var x0 = 0, y0 = 0, x1 = r.w, y1 = r.h;
    if (h.indexOf('w') >= 0) x0 = p[0]; if (h.indexOf('e') >= 0) x1 = p[0];
    if (h.indexOf('n') >= 0) y0 = p[1]; if (h.indexOf('s') >= 0) y1 = p[1];
    if (!r.rot) { // smart-guide snapping for upright objects
      var gs = [];
      ['x', 'y'].forEach(function (ax) {
        var lo = ax === 'x' ? 'w' : 'n', hi = ax === 'x' ? 'e' : 's', base = ax === 'x' ? r.x : r.y;
        if (h.indexOf(lo) >= 0) { var s1 = SN.edge(base + (ax === 'x' ? x0 : y0), ax, [o]); if (ax === 'x') x0 = s1.v - base; else y0 = s1.v - base; if (s1.guide) gs.push(s1.guide); }
        if (h.indexOf(hi) >= 0) { var s2 = SN.edge(base + (ax === 'x' ? x1 : y1), ax, [o]); if (ax === 'x') x1 = s2.v - base; else y1 = s2.v - base; if (s2.guide) gs.push(s2.guide); }
      });
      H.guides = gs;
    }
    if (fromC) { if (h.indexOf('w') >= 0) x1 = r.w - x0; if (h.indexOf('e') >= 0) x0 = r.w - x1; if (h.indexOf('n') >= 0) y1 = r.h - y0; if (h.indexOf('s') >= 0) y0 = r.h - y1; }
    var w = Math.max(4, x1 - x0), hh = Math.max(4, y1 - y0);
    if (keep && r.w && r.h) {
      var ar = r.w / r.h;
      if (h.length === 1) { if (h === 'n' || h === 's') w = hh * ar; else hh = w / ar; }
      else if (w / hh > ar) hh = w / ar; else w = hh * ar;
      if (h.indexOf('w') >= 0) x0 = x1 - w; else x1 = x0 + w;
      if (h.indexOf('n') >= 0) y0 = y1 - hh; else y1 = y0 + hh;
      if (h === 'n' || h === 's') { x0 = (r.w - w) / 2; x1 = x0 + w; }
      if (h === 'e' || h === 'w') { y0 = (r.h - hh) / 2; y1 = y0 + hh; }
    }
    if (x1 - x0 < 4) { if (h.indexOf('w') >= 0) x0 = x1 - 4; else x1 = x0 + 4; }
    if (y1 - y0 < 4) { if (h.indexOf('n') >= 0) y0 = y1 - 4; else y1 = y0 + 4; }
    var c = U.mat.apply(m0, (x0 + x1) / 2, (y0 + y1) / 2);
    o.w = x1 - x0; o.h = y1 - y0; o.x = c[0] - o.w / 2; o.y = c[1] - o.h / 2;
    if (o.type === 'table') { O.fixTable(o); }
    A.emit('hint', Math.round(o.w) + ' × ' + Math.round(o.h) + ' pt');
  };
  function resizeMany(h, pt, keep) {
    var u = drag.union, ax = h.indexOf('w') >= 0 ? u.x + u.w : u.x, ay = h.indexOf('n') >= 0 ? u.y + u.h : u.y;
    var sx = Math.abs(pt.x - ax) / u.w, sy = Math.abs(pt.y - ay) / u.h;
    if (keep) sx = sy = Math.max(0.05, Math.max(sx, sy));
    drag.objs.forEach(function (r) {
      r.o.x = ax + (r.x - ax) * sx; r.o.y = ay + (r.y - ay) * sy; r.o.w = Math.max(2, r.w * sx); r.o.h = Math.max(2, r.h * sy);
      if (r.o.type === 'table') O.fixTable(r.o);
    });
  }
  function dbl(e) {
    if (A.readOnly) return;
    var hit = H.hit(V.toSlide(e.clientX, e.clientY));
    if (!hit) return;
    if (hit.type === 'image' && !hit.media && SS.insert) return SS.insert.pickImageFor(hit);
    if (hit.type === 'chart' && SS.chartData) return SS.chartData.open(hit);
    if (hit.type === 'table') return SS.textEdit.startCell(hit, V.toSlide(e.clientX, e.clientY));
    if ((hit.type === 'text' || (hit.type === 'shape' && !O.isLine(hit))) && SS.textEdit) SS.textEdit.start(hit, { x: e.clientX, y: e.clientY });
  }
  P.isDragging = function () { return !!drag; };
})();
