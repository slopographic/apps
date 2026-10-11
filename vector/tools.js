/* Slop Vector — tools, pointer pipeline, commands (actions) and keyboard. */
(function () {
  'use strict';
  var G = window.SVGeom, SV = window.SV, S = SV.state, D = SV.dom;
  var abs = Math.abs, min = Math.min, max = Math.max, PI = Math.PI, round = Math.round, hypot = Math.hypot;
  var clone = SV.clone, getObj = SV.getObj, find = SV.find;

  /* ================= tool metadata ================= */
  function ic(d, filled) { return '<svg viewBox="0 0 24 24" aria-hidden="true" class="' + (filled ? 'ic-fill' : 'ic') + '">' + d + '</svg>'; }
  SV.ICONS = {
    select: ic('<path d="M6 3.5l12 7.6-5.4 1.2 3.3 6-2.3 1.2-3.2-6.1L6 17.6z"/>', true),
    direct: ic('<path d="M6 3.5l12 7.6-5.4 1.2 3.3 6-2.3 1.2-3.2-6.1L6 17.6z"/>'),
    pen: ic('<path d="M12 3l5 8-3 8h-4l-3-8z"/><path d="M12 3v7"/><circle cx="12" cy="11.5" r="1.4"/><path d="M9.5 21h5"/>'),
    addAnchor: ic('<path d="M10 4l4 7-2.4 7H8.4L6 11z"/><path d="M17 15v6M14 18h6"/>'),
    deleteAnchor: ic('<path d="M10 4l4 7-2.4 7H8.4L6 11z"/><path d="M14 18h6"/>'),
    convertAnchor: ic('<path d="M4 19l8-14 8 14"/><circle cx="12" cy="5" r="1.6"/>'),
    pencil: ic('<path d="M4 20l1.2-4.6L16 4.6a1.9 1.9 0 0 1 2.7 0l.7.7a1.9 1.9 0 0 1 0 2.7L8.6 18.8z"/><path d="M14.5 6l3.5 3.5"/>'),
    brush: ic('<path d="M20 4c-3 1.5-7.5 6-9.4 8.8l1.6 1.6C15 12.5 18.5 7 20 4z"/><path d="M10.2 13.6c-2.2-.3-3.7 1.2-3.9 3-.2 1.6-1 2.4-2.3 2.6 3.8 1.6 7.6.2 7.8-3.6z"/>'),
    type: ic('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
    line: ic('<path d="M5 19L19 5"/>'),
    rect: ic('<rect x="4" y="6" width="16" height="12"/>'),
    rrect: ic('<rect x="4" y="6" width="16" height="12" rx="4"/>'),
    ellipse: ic('<ellipse cx="12" cy="12" rx="8" ry="7"/>'),
    polygon: ic('<path d="M12 3.5l7.5 4.3v8.4L12 20.5l-7.5-4.3V7.8z"/>'),
    star: ic('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>'),
    eyedropper: ic('<path d="M14 6l4 4M12.5 7.5l4 4-8 8H4.5v-4z"/><path d="M15 4.5a2.1 2.1 0 0 1 3 0l1.5 1.5a2.1 2.1 0 0 1 0 3L18 10.5 13.5 6z" class="f"/>'),
    hand: ic('<path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11M11 10.5V5a1.5 1.5 0 0 1 3 0v5.5M14 10.5V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 6.5-6 6.5-2.6 0-4-1.3-5.4-3.6L4 13.6a1.4 1.4 0 0 1 2.3-1.5L8 14"/>'),
    zoom: ic('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5M10.5 8v5"/>'),
    rotate: ic('<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M17.5 3v4.2h-4.2"/>'),
    scale: ic('<rect x="4" y="10" width="10" height="10"/><path d="M11 4h9v9M20 4l-8 8"/>'),
    scissors: ic('<circle cx="6.5" cy="17" r="2.6"/><circle cx="17.5" cy="17" r="2.6"/><path d="M8.3 15L17 4M15.7 15L7 4"/>'),
    gradient: ic('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 20L20 4" class="thin"/><path d="M4 14l6-6M10 20l10-10"/>')
  };
  SV.TOOL_LIST = [
    { id: 'select', name: 'Selection', key: 'V' }, { id: 'direct', name: 'Direct Selection', key: 'A' },
    { id: 'pen', name: 'Pen', key: 'P' }, { id: 'addAnchor', name: 'Add Anchor Point', key: '+' },
    { id: 'deleteAnchor', name: 'Delete Anchor Point', key: '−' }, { id: 'convertAnchor', name: 'Anchor Point (Convert)', key: 'Shift+C' },
    { id: 'pencil', name: 'Pencil', key: 'N' }, { id: 'brush', name: 'Paintbrush', key: 'B' },
    { id: 'type', name: 'Type', key: 'T' }, { id: 'line', name: 'Line Segment', key: '\\' },
    { id: 'rect', name: 'Rectangle', key: 'M' }, { id: 'rrect', name: 'Rounded Rectangle', key: 'Shift+M' },
    { id: 'ellipse', name: 'Ellipse', key: 'L' }, { id: 'polygon', name: 'Polygon', key: 'Shift+L' },
    { id: 'star', name: 'Star', key: 'Shift+S' }, { id: 'rotate', name: 'Rotate', key: 'R' },
    { id: 'scale', name: 'Scale', key: 'S' }, { id: 'scissors', name: 'Scissors', key: 'C' },
    { id: 'gradient', name: 'Gradient', key: 'G' }, { id: 'eyedropper', name: 'Eyedropper', key: 'I' },
    { id: 'hand', name: 'Hand', key: 'H' }, { id: 'zoom', name: 'Zoom', key: 'Z' }
  ];
  var TOOL_KEYS = { v: 'select', a: 'direct', p: 'pen', '=': 'addAnchor', '-': 'deleteAnchor', 'shift+c': 'convertAnchor', 'shift+=': 'addAnchor', n: 'pencil', b: 'brush', t: 'type', '\\': 'line', m: 'rect', 'shift+m': 'rrect', l: 'ellipse', 'shift+l': 'polygon', 'shift+s': 'star', r: 'rotate', s: 'scale', c: 'scissors', g: 'gradient', i: 'eyedropper', h: 'hand', z: 'zoom' };

  /* cursors */
  function cur(svg, x, y, fb) { return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' + svg + '</svg>') + '") ' + x + ' ' + y + ', ' + fb; }
  var penBase = '<path d="M4 3l9 4-3 3-3 9z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/><circle cx="7.6" cy="10.4" r="1.2" fill="#000"/>';
  var CURSORS = {
    direct: cur('<path d="M3 2l12 7.6-5.4 1.2 3.3 6-2.3 1.2-3.2-6.1L3 16.1z" fill="#fff" stroke="#000" stroke-width="1.1" stroke-linejoin="round"/>', 3, 2, 'default'),
    pen: cur(penBase + '<path d="M15 16h0" />', 4, 3, 'crosshair'),
    penAdd: cur(penBase + '<path d="M18 14v7M14.5 17.5h7" stroke="#000" stroke-width="1.8"/>', 4, 3, 'crosshair'),
    penDel: cur(penBase + '<path d="M14.5 17.5h7" stroke="#000" stroke-width="1.8"/>', 4, 3, 'crosshair'),
    penClose: cur(penBase + '<circle cx="18" cy="17.5" r="3" fill="none" stroke="#000" stroke-width="1.6"/>', 4, 3, 'crosshair'),
    penCont: cur(penBase + '<path d="M15 20l3-5 3 5" fill="none" stroke="#000" stroke-width="1.6"/>', 4, 3, 'crosshair'),
    convert: cur('<path d="M3 20l8-15 8 15" fill="none" stroke="#fff" stroke-width="3.4"/><path d="M3 20l8-15 8 15" fill="none" stroke="#000" stroke-width="1.6"/>', 11, 5, 'crosshair'),
    eyedropper: cur('<path d="M3 21l1-4 9-9 3 3-9 9z" fill="#fff" stroke="#000" stroke-width="1.2"/><path d="M14 5l2-2a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3l-2 2z" fill="#000"/>', 3, 21, 'crosshair'),
    rotate: cur('<path d="M18 9a7 7 0 1 0 0 6" fill="none" stroke="#fff" stroke-width="4"/><path d="M18 9a7 7 0 1 0 0 6" fill="none" stroke="#000" stroke-width="1.6"/><path d="M15 4l3.6 5.2L13 10" fill="none" stroke="#000" stroke-width="1.6"/>', 12, 12, 'alias'),
    scissors: cur('<circle cx="6" cy="18" r="3" fill="#fff" stroke="#000" stroke-width="1.4"/><circle cx="18" cy="18" r="3" fill="#fff" stroke="#000" stroke-width="1.4"/><path d="M8 16L18 3M16 16L6 3" stroke="#000" stroke-width="1.6"/>', 12, 9, 'crosshair')
  };
  SV.CURSORS = CURSORS;
  var TOOL_CURSOR = { select: 'default', direct: CURSORS.direct, pen: CURSORS.pen, addAnchor: CURSORS.penAdd, deleteAnchor: CURSORS.penDel, convertAnchor: CURSORS.convert, pencil: 'crosshair', brush: 'crosshair', type: 'text', line: 'crosshair', rect: 'crosshair', rrect: 'crosshair', ellipse: 'crosshair', polygon: 'crosshair', star: 'crosshair', rotate: 'crosshair', scale: 'crosshair', scissors: CURSORS.scissors, gradient: 'crosshair', eyedropper: CURSORS.eyedropper, hand: 'grab', zoom: 'zoom-in' };
  function setCursor(c) { if (D.stage.style.cursor !== c) D.stage.style.cursor = c; }
  SV.updateCursor = function (alt) {
    var t = S.spaceHand ? 'hand' : S.tool;
    if (S.op && S.op.kind === 'pan') return setCursor('grabbing');
    if (t === 'zoom') return setCursor(alt ? 'zoom-out' : 'zoom-in');
    setCursor(TOOL_CURSOR[t] || 'default');
  };

  SV.setTool = function (id) {
    if (!SV.TOOL_LIST.some(function (t) { return t.id === id; })) return;
    if (S.editing) SV.commitTextEdit();
    if (S.pen && id !== 'pen') SV.finishPen();
    if (S.tool === id) return;
    S.tool = id; S.origin = null; S.hover = null;
    if (id === 'direct') { /* keep object selection, no points */ }
    SV.updateCursor();
    SV.requestRender(true);
  };

  /* ================= pointer pipeline ================= */
  var pointers = new Map(), gesture = null, lastDown = { t: 0, x: 0, y: 0 };
  function mkEv(e) {
    var r = D.stage.getBoundingClientRect();
    return { e: e, p: SV.evDoc(e), sx: e.clientX - r.left, sy: e.clientY - r.top, shift: e.shiftKey, alt: e.altKey, mod: e.ctrlKey || e.metaKey };
  }
  function onDown(e) {
    if (e.button === 2 || e.target === D.textEditor) return;
    if (document.activeElement && document.activeElement !== document.body && document.activeElement !== D.textEditor && document.activeElement.blur) document.activeElement.blur();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { startGesture(); return; }
    if (pointers.size > 2) return;
    e.preventDefault();
    try { D.stage.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    var ev = mkEv(e);
    var now = Date.now();
    ev.dbl = now - lastDown.t < 420 && hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 6;
    lastDown = { t: ev.dbl ? 0 : now, x: e.clientX, y: e.clientY };
    if (S.editing) {
      var eo = getObj(S.editing.id);
      var onIt = eo && (S.tool === 'type' || S.tool === 'select') && SV.hitTest(ev.p) && SV.hitTest(ev.p).obj.id === eo.id;
      SV.commitTextEdit();
      if (onIt && S.tool === 'type') { SV.startTextEdit(getObj(eo.id), ev.p); return; }
    }
    if (e.button === 1 || S.spaceHand || S.tool === 'hand') { S.op = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y }; SV.updateCursor(); return; }
    S.hover = null;
    var t = TOOLS[S.tool];
    if (t && t.down) t.down(ev);
    SV.requestRender();
  }
  function onMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture) { moveGesture(); return; }
    var ev = mkEv(e);
    if (SV.ui && SV.ui.setCursorPos) SV.ui.setCursorPos(ev.p);
    S.lastPointer = ev;
    if (S.op) {
      if (S.op.kind === 'pan') { S.view.x = S.op.vx + e.clientX - S.op.sx; S.view.y = S.op.vy + e.clientY - S.op.sy; SV.requestRender(); return; }
      var t = TOOLS[S.op.tool || S.tool];
      if (t && t.move) t.move(ev);
      SV.requestRender();
    } else if (e.target === D.stage || D.stage.contains(e.target)) {
      var th = TOOLS[S.spaceHand ? 'hand' : S.tool];
      if (th && th.hover) th.hover(ev); else SV.updateCursor(ev.alt);
      SV.requestRender();
    }
  }
  function onUp(e) {
    var had = pointers.has(e.pointerId);
    pointers.delete(e.pointerId);
    if (gesture) { if (pointers.size < 2) { gesture = null; SV.requestRender(true); } return; }
    if (!had) return;
    var ev = mkEv(e);
    if (S.op) {
      var op = S.op;
      if (op.kind === 'pan') { S.op = null; SV.updateCursor(); SV.requestRender(true); return; }
      var t = TOOLS[op.tool || S.tool];
      if (t && t.up) t.up(ev);
      if (S.op === op) S.op = null;
      S.snapLines = []; S.readout = null; S.marquee = null;
      SV.requestRender(true);
    }
  }
  function onCancel(e) {
    pointers.delete(e.pointerId);
    if (S.op && S.op.kind !== 'pan') { SV.revert(); }
    S.op = null; S.snapLines = []; S.readout = null; S.marquee = null; gesture = null;
    SV.requestRender(true);
  }
  function startGesture() {
    if (S.op && S.op.kind !== 'pan' && S.op.dirty !== false) SV.revert();
    S.op = null; S.marquee = null; S.snapLines = []; S.readout = null;
    var ps = Array.from(pointers.values()), r = D.stage.getBoundingClientRect();
    gesture = { d0: hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1, m0: { x: (ps[0].x + ps[1].x) / 2 - r.left, y: (ps[0].y + ps[1].y) / 2 - r.top }, z0: S.view.zoom, vx: S.view.x, vy: S.view.y };
  }
  function moveGesture() {
    var ps = Array.from(pointers.values()); if (ps.length < 2) return;
    var r = D.stage.getBoundingClientRect();
    var d = hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), m = { x: (ps[0].x + ps[1].x) / 2 - r.left, y: (ps[0].y + ps[1].y) / 2 - r.top };
    var z = SV.clamp(gesture.z0 * d / gesture.d0, 0.02, 64);
    var docPt = { x: (gesture.m0.x - gesture.vx) / gesture.z0, y: (gesture.m0.y - gesture.vy) / gesture.z0 };
    S.view.zoom = z; S.view.x = m.x - docPt.x * z; S.view.y = m.y - docPt.y * z;
    SV.requestRender(true);
  }
  function onWheel(e) {
    e.preventDefault();
    var r = D.stage.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
    var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, dx = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
    if (e.ctrlKey || e.metaKey || e.altKey) {
      SV.setZoom(S.view.zoom * Math.exp(-dy * (e.ctrlKey && !e.altKey ? 0.01 : 0.002)), cx, cy);
    } else {
      if (e.shiftKey && !dx) { dx = dy; dy = 0; }
      S.view.x -= dx; S.view.y -= dy; SV.requestRender(true);
    }
    if (S.editing) SV.positionEditor();
  }
  SV.bindStage = function () {
    D.stage.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    D.stage.addEventListener('wheel', onWheel, { passive: false });
    D.stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    D.stage.addEventListener('pointerleave', function () { if (!S.op) { S.hover = null; if (S.pen) S.pen.cursor = null; SV.requestRender(); } });
  };

  /* ================= helpers for ops ================= */
  function snapshotObjs(ids) { return ids.map(function (id) { return clone(getObj(id)); }).filter(Boolean); }
  function restoreObjs(origs) { origs.forEach(function (o) { SV.replaceObj(o.id, clone(o)); }); }
  function readout(ev, text) { S.readout = { x: ev.sx, y: ev.sy, text: text }; }
  function n1(v) { return (Math.round(v * 10) / 10).toString(); }
  SV.fmtNum = n1;
  function selectableTopIds() { return S.sel.filter(function (id) { var o = getObj(id); return o && SV.isEditable(o); }); }

  /* ================= selection tool ================= */
  function handleAt(b, sx, sy) {
    var sb = SV.screenBox(b), hp = SV.handlePositions(sb), best = null;
    if (sb.w < 6 && sb.h < 6) return null;
    SV.HANDLE_NAMES.forEach(function (n) { var d = max(abs(hp[n][0] - sx), abs(hp[n][1] - sy)); if (d <= 6 && (!best || d < best.d)) best = { n: n, d: d }; });
    return best && best.n;
  }
  function rotateZone(b, sx, sy) {
    var sb = SV.screenBox(b);
    if (sx >= sb.x && sx <= sb.x + sb.w && sy >= sb.y && sy <= sb.y + sb.h) return false;
    var hp = SV.handlePositions(sb);
    return ['nw', 'ne', 'se', 'sw'].some(function (n) { var d = hypot(hp[n][0] - sx, hp[n][1] - sy); return d > 5 && d < 22; });
  }
  var RESIZE_CURSORS = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' };
  function guideAt(ev) {
    if (!S.prefs.guides || S.prefs.lockGuides) return null;
    var z = S.view.zoom, best = null;
    S.doc.guides.v.forEach(function (x, i) { var d = abs(x * z + S.view.x - ev.sx); if (d <= 3 && (!best || d < best.d)) best = { axis: 'v', i: i, d: d }; });
    S.doc.guides.h.forEach(function (y, i) { var d = abs(y * z + S.view.y - ev.sy); if (d <= 3 && (!best || d < best.d)) best = { axis: 'h', i: i, d: d }; });
    return best;
  }
  function beginMove(ev, ids, tool) {
    ids = ids || S.sel.slice();
    ids = ids.filter(function (id) { var o = getObj(id); return o && SV.isEditable(o); });
    if (!ids.length) return;
    S.op = { kind: 'move', tool: tool || 'select', start: ev.p, ids: ids, origs: snapshotObjs(ids), bbox: SV.selBBox(ids), snap: SV.buildSnap(ids), moved: false, dup: false };
  }
  function moveMove(ev) {
    var op = S.op, dx = ev.p.x - op.start.x, dy = ev.p.y - op.start.y;
    if (!op.moved && hypot(dx, dy) * S.view.zoom < 3) return;
    if (!op.moved) {
      op.moved = true;
      if (ev.alt) { // duplicate originals in place, move the copies
        var newIds = [];
        op.origs.forEach(function (o) {
          var f = find(o.id), c = SV.reId(clone(o));
          f.arr.splice(f.idx + 1, 0, c); newIds.push(c.id);
        });
        op.dup = true; op.origs = snapshotObjs(newIds); op.ids = newIds; S.sel = newIds.slice();
      }
    }
    if (ev.shift) { var c = SV.constrain45({ x: 0, y: 0 }, { x: dx, y: dy }); dx = c.x; dy = c.y; }
    else if (op.bbox) { var sn = SV.snapBox(op.snap, op.bbox, dx, dy); dx = sn.dx; dy = sn.dy; }
    restoreObjs(op.origs);
    var M = G.translate(dx, dy);
    op.ids.forEach(function (id) { var o = getObj(id); if (o) SV.transformObj(o, M); });
    op.dx = dx; op.dy = dy;
    readout(ev, 'dX: ' + n1(dx) + ' px\ndY: ' + n1(dy) + ' px');
  }
  function moveUp() {
    var op = S.op;
    if (op.moved) {
      if (op.dup) S.lastDup = { dx: op.dx, dy: op.dy };
      SV.commit(op.dup ? 'duplicate' : 'move');
    }
  }
  function beginScale(ev, b, h) {
    var ids = selectableTopIds(); if (!ids.length) return;
    S.op = { kind: 'scale', tool: 'select', b: b, h: h, ids: ids, origs: snapshotObjs(ids), snap: SV.buildSnap(ids), start: ev.p };
  }
  function scaleMove(ev) {
    var op = S.op, b = op.b, h = op.h, hp = SV.handlePositions(b)[h];
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2, ax, ay;
    if (ev.alt) { ax = cx; ay = cy; } else { var opp = SV.handlePositions(b)[{ nw: 'se', n: 's', ne: 'sw', e: 'w', se: 'nw', s: 'n', sw: 'ne', w: 'e' }[h]]; ax = opp[0]; ay = opp[1]; }
    var p = ev.shift ? ev.p : SV.snapPoint(op.snap, ev.p);
    var hasX = h.indexOf('e') >= 0 || h.indexOf('w') >= 0, hasY = h.indexOf('n') >= 0 || h.indexOf('s') >= 0;
    var sx = hasX && abs(hp[0] - ax) > 1e-9 ? (p.x - ax) / (hp[0] - ax) : 1;
    var sy = hasY && abs(hp[1] - ay) > 1e-9 ? (p.y - ay) / (hp[1] - ay) : 1;
    if (ev.shift) {
      if (hasX && hasY) { var s = max(abs(sx), abs(sy)); sx = (sx < 0 ? -1 : 1) * s; sy = (sy < 0 ? -1 : 1) * s; }
      else if (hasX) sy = abs(sx); else sy = sy, sx = abs(sy);
    }
    if (abs(sx) < 0.002) sx = sx < 0 ? -0.002 : 0.002;
    if (abs(sy) < 0.002) sy = sy < 0 ? -0.002 : 0.002;
    restoreObjs(op.origs);
    var M = G.scale(sx, sy, ax, ay);
    op.ids.forEach(function (id) { var o = getObj(id); if (o) SV.transformObj(o, M); });
    op.changed = true;
    readout(ev, 'W: ' + n1(abs(b.w * sx)) + ' px\nH: ' + n1(abs(b.h * sy)) + ' px');
  }
  function beginRotate(ev, b, origin, tool) {
    var ids = selectableTopIds(); if (!ids.length) return;
    var c = origin || { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    S.op = { kind: 'rotate', tool: tool || 'select', c: c, a0: Math.atan2(ev.p.y - c.y, ev.p.x - c.x), ids: ids, origs: snapshotObjs(ids), start: ev.p, sx: ev.sx, sy: ev.sy };
  }
  function rotateMove(ev) {
    var op = S.op;
    if (!op.changed && hypot(ev.sx - op.sx, ev.sy - op.sy) < 3) return;
    var a = Math.atan2(ev.p.y - op.c.y, ev.p.x - op.c.x) - op.a0;
    if (ev.shift) a = round(a / (PI / 4)) * (PI / 4);
    restoreObjs(op.origs);
    var M = G.rotate(a, op.c.x, op.c.y);
    op.ids.forEach(function (id) { var o = getObj(id); if (o) { SV.transformObj(o, M); if (o.type === 'path' || o.type === 'group') o.rot = normAng((o.rot || 0) + a * 180 / PI); } });
    op.changed = true; op.angle = a;
    var deg = -a * 180 / PI; deg = ((deg % 360) + 540) % 360 - 180;
    readout(ev, 'Angle: ' + n1(deg) + '°');
  }
  function normAng(d) { d = ((d % 360) + 540) % 360 - 180; return Math.round(d * 100) / 100; }
  SV.normAng = normAng;
  function beginMarquee(ev, add, kind) {
    S.op = { kind: 'marquee', tool: S.tool, start: ev.p, add: add, mk: kind || 'objects', base: S.sel.slice(), basePts: clone(S.psel) };
    S.marquee = { x: ev.p.x, y: ev.p.y, w: 0, h: 0 };
  }
  function marqueeMove(ev) {
    var s = S.op.start;
    S.marquee = { x: min(s.x, ev.p.x), y: min(s.y, ev.p.y), w: abs(ev.p.x - s.x), h: abs(ev.p.y - s.y), zoom: S.op.mk === 'zoom' };
  }
  function marqueeUp() {
    var r = S.marquee; if (!r) return;
    if (r.w * S.view.zoom < 2 && r.h * S.view.zoom < 2) { S.marquee = null; return; }
    if (S.op.mk === 'points') {
      var psel = S.op.add ? S.op.basePts : {}, ids = S.op.add ? S.op.base.slice() : [];
      S.doc.layers.forEach(function (L) {
        if (L.hidden || L.locked) return;
        L.children.forEach(function (top) {
          SV.leaves(top).forEach(function (o) {
            if (!SV.isEditable(o)) return;
            var bb = SV.objBBox(o); if (!bb || !G.boxesTouch(bb, r)) return;
            if (o.type === 'text' || o.type === 'image') { if (G.boxesTouch(bb, r)) ids.push(o.id); return; }
            var keys = [];
            SV.docSubs(o).forEach(function (sp, si) { sp.pts.forEach(function (a, i) { if (a.x >= r.x && a.x <= r.x + r.w && a.y >= r.y && a.y <= r.y + r.h) keys.push(si + ':' + i); }); });
            if (keys.length) { psel[o.id] = Array.from(new Set((psel[o.id] || []).concat(keys))); ids.push(o.id); }
            else if (G.polysTouchRect(SV.flatPolys(o), r, false)) ids.push(o.id);
          });
        });
      });
      SV.select(ids, { keepPoints: true }); S.psel = psel;
    } else {
      var sel = S.op.add ? S.op.base.slice() : [];
      S.doc.layers.forEach(function (L) {
        if (L.hidden || L.locked) return;
        L.children.forEach(function (o) {
          if (o.hidden || o.locked) return;
          var bb = SV.objBBox(o); if (!bb || !G.boxesTouch(bb, r)) return;
          var hit = SV.leaves(o).some(function (l) {
            if (l.type === 'text' || l.type === 'image') return G.boxesTouch(SV.objBBox(l), r);
            return G.polysTouchRect(SV.flatPolys(l), r, !!l.style.fill);
          });
          if (hit && sel.indexOf(o.id) < 0) sel.push(o.id);
        });
      });
      SV.select(sel);
    }
    S.marquee = null;
  }
  function guideDragMove(ev) {
    var g = S.guideDrag;
    g.pos = g.axis === 'v' ? ev.p.x : ev.p.y;
    if (S.prefs.snapGrid) { var gs = S.prefs.gridSize; g.pos = round(g.pos / gs) * gs; }
    g.out = g.axis === 'v' ? ev.sx < 0 : ev.sy < 0;
  }
  SV.beginGuideDrag = function (axis, idx, fromRuler) {
    S.guideDrag = { axis: axis, idx: idx, pos: idx != null ? S.doc.guides[axis][idx] : 0, fromRuler: fromRuler };
    if (idx != null) S.doc.guides[axis].splice(idx, 1);
    S.op = { kind: 'guide', tool: 'select' };
  };
  SV.endGuideDrag = function () {
    var g = S.guideDrag; S.guideDrag = null;
    if (!g) return;
    if (!g.out) S.doc.guides[g.axis].push(Math.round(g.pos * 100) / 100);
    SV.commit('guide');
  };

  var TOOLS = SV.TOOLS = {};
  TOOLS.select = {
    down: function (ev) {
      var p = ev.p;
      if (ev.dbl) {
        var hd = SV.hitTest(p);
        if (hd && hd.obj.type === 'text' && SV.isEditable(hd.obj)) { SV.startTextEdit(hd.obj, p); return; }
        if (hd && hd.top.type === 'group' && hd.obj.id !== hd.top.id) { SV.select([hd.obj.id]); beginMove(ev); return; }
      }
      if (S.sel.length) {
        var b = SV.selBBox();
        if (b) {
          var hn = handleAt(b, ev.sx, ev.sy);
          if (hn) { beginScale(ev, b, hn); return; }
          if (rotateZone(b, ev.sx, ev.sy)) { beginRotate(ev, b); return; }
        }
      }
      var h = SV.hitTest(p);
      if (h) {
        var target = h.top.id;
        if (S.sel.indexOf(h.obj.id) >= 0) target = h.obj.id;
        else {
          var inner = S.sel.filter(function (sid) { var so = getObj(sid); return so && sid !== h.top.id && (function c(o) { if (o.id === h.obj.id) return true; return o.type === 'group' && o.children.some(c); })(so); })[0];
          if (inner) target = inner;
        }
        if (ev.shift) {
          var i = S.sel.indexOf(target);
          var ns = S.sel.slice(); if (i >= 0) ns.splice(i, 1); else ns.push(target);
          SV.select(ns); return;
        }
        if (S.sel.indexOf(target) < 0) SV.select([target]);
        beginMove(ev);
        return;
      }
      var g = guideAt(ev);
      if (g) { SV.beginGuideDrag(g.axis, g.i); return; }
      if (!ev.shift) SV.select([]);
      beginMarquee(ev, ev.shift);
    },
    move: function (ev) {
      var k = S.op.kind;
      if (k === 'move') moveMove(ev); else if (k === 'scale') scaleMove(ev); else if (k === 'rotate') rotateMove(ev);
      else if (k === 'marquee') marqueeMove(ev); else if (k === 'guide') guideDragMove(ev);
    },
    up: function (ev) {
      var k = S.op.kind;
      if (k === 'move') moveUp(); else if (k === 'scale' || k === 'rotate') { if (S.op.changed) SV.commit(k); }
      else if (k === 'marquee') marqueeUp(); else if (k === 'guide') SV.endGuideDrag();
    },
    hover: function (ev) {
      var c = 'default';
      if (S.sel.length) {
        var b = SV.selBBox();
        if (b) { var hn = handleAt(b, ev.sx, ev.sy); if (hn) c = RESIZE_CURSORS[hn]; else if (rotateZone(b, ev.sx, ev.sy)) c = CURSORS.rotate; }
      }
      var h = SV.hitTest(ev.p);
      S.hover = h ? h.top.id : null;
      if (c === 'default' && !h && guideAt(ev)) { var g = guideAt(ev); c = g.axis === 'v' ? 'ew-resize' : 'ns-resize'; }
      setCursor(c);
    }
  };

  /* ================= direct selection ================= */
  function allLeafCandidates(p) {
    var list = SV.selObjs().slice(), h = SV.hitTest(p);
    if (h && list.indexOf(h.obj) < 0) list.push(h.obj);
    return list;
  }
  function anyAnchorAt(p) {
    var a = SV.hitAnchor(SV.selObjs(), p, true);
    if (a) return a;
    var tops = [];
    S.doc.layers.forEach(function (L) { if (!L.hidden && !L.locked) L.children.forEach(function (o) { if (!o.hidden && !o.locked) tops.push(o); }); });
    return SV.hitAnchor(tops, p, false);
  }
  function setHandle(a, part, x, y, keepSmooth) {
    if (part === 'in') { a.ix = x; a.iy = y; } else { a.ox = x; a.oy = y; }
    if (keepSmooth && a.s) {
      var hx = part === 'in' ? a.ox : a.ix, hy = part === 'in' ? a.oy : a.iy;
      var L = hypot(hx - a.x, hy - a.y), dx = x - a.x, dy = y - a.y, l = hypot(dx, dy);
      if (l > 1e-9 && L > 1e-9) {
        var nx = a.x - dx / l * L, ny = a.y - dy / l * L;
        if (part === 'in') { a.ox = nx; a.oy = ny; } else { a.ix = nx; a.iy = ny; }
      }
    } else if (!keepSmooth) a.s = false;
  }
  SV.setHandle = setHandle;
  function beginPoints(ev, primary) {
    var ids = Object.keys(S.psel).filter(function (id) { var o = getObj(id); return o && S.psel[id].length && SV.isEditable(o); });
    if (!ids.length) return;
    S.op = { kind: 'points', tool: S.tool, start: ev.p, ids: ids, origs: snapshotObjs(ids), primary: primary, snap: SV.buildSnap(ids), moved: false };
  }
  function pointsMove(ev) {
    var op = S.op, dx = ev.p.x - op.start.x, dy = ev.p.y - op.start.y;
    if (!op.moved && hypot(dx, dy) * S.view.zoom < 2) return;
    op.moved = true;
    if (ev.shift) { var c = SV.constrain45({ x: 0, y: 0 }, { x: dx, y: dy }); dx = c.x; dy = c.y; }
    else if (op.primary) { var t = SV.snapPoint(op.snap, { x: op.primary.x + dx, y: op.primary.y + dy }); dx = t.x - op.primary.x; dy = t.y - op.primary.y; }
    restoreObjs(op.origs);
    movePoints(op.ids, dx, dy);
    readout(ev, 'dX: ' + n1(dx) + ' px\ndY: ' + n1(dy) + ' px');
  }
  function movePoints(ids, dx, dy) {
    ids.forEach(function (id) {
      var o = getObj(id); if (!o) return;
      var keys = S.psel[id] || [];
      if (o.type === 'text' || o.type === 'image') { SV.transformObj(o, G.translate(dx, dy)); return; }
      var total = 0; SV.localSubs(o).forEach(function (sp) { total += sp.pts.length; });
      if (keys.length >= total) { SV.transformObj(o, G.translate(dx, dy)); return; }
      SV.toPath(o);
      keys.forEach(function (k) {
        var pr = k.split(':'), sp = o.subpaths[+pr[0]], a = sp && sp.pts[+pr[1]];
        if (!a) return;
        a.x += dx; a.y += dy; a.ix += dx; a.iy += dy; a.ox += dx; a.oy += dy;
      });
    });
  }
  SV.movePoints = movePoints;
  TOOLS.direct = {
    down: function (ev) {
      var p = ev.p, ah = anyAnchorAt(p);
      if (ah) {
        var o = ah.o, key = ah.si + ':' + ah.i;
        if (ah.part !== 'a') {
          S.op = { kind: 'handle', tool: 'direct', id: o.id, si: ah.si, i: ah.i, part: ah.part, orig: clone(o) };
          return;
        }
        if (ev.shift) {
          var cur = (S.psel[o.id] || []).slice(), j = cur.indexOf(key);
          if (j >= 0) cur.splice(j, 1); else cur.push(key);
          S.psel[o.id] = cur;
          if (S.sel.indexOf(o.id) < 0) S.sel.push(o.id);
          SV.requestRender(true); return;
        }
        if ((S.psel[o.id] || []).indexOf(key) < 0) { S.sel = [o.id]; S.psel = {}; S.psel[o.id] = [key]; SV.select(S.sel, { keepPoints: true }); }
        var A = SV.docSubs(o)[ah.si].pts[ah.i];
        beginPoints(ev, { x: A.x, y: A.y });
        return;
      }
      var h = SV.hitTest(p);
      var cands = SV.selObjs().slice(); if (h && cands.indexOf(h.obj) < 0) cands.push(h.obj);
      var seg = SV.hitSegment(cands, p);
      if (seg && (!h || h.obj.id === seg.o.id || S.sel.indexOf(seg.o.id) >= 0)) {
        var so = seg.o;
        if (ev.shift) { var ns = S.sel.slice(), k = ns.indexOf(so.id); if (k >= 0) ns.splice(k, 1); else ns.push(so.id); SV.select(ns, { keepPoints: true }); return; }
        if (S.sel.indexOf(so.id) < 0 || S.sel.length > 1) { S.psel = {}; SV.select([so.id]); }
        S.op = { kind: 'segment', tool: 'direct', id: so.id, si: seg.si, i: seg.i, t: seg.t, start: p, orig: clone(so) };
        return;
      }
      if (h) {
        var leaf = h.obj;
        if (ev.shift) { var ns2 = S.sel.slice(), k2 = ns2.indexOf(leaf.id); if (k2 >= 0) { ns2.splice(k2, 1); delete S.psel[leaf.id]; } else { ns2.push(leaf.id); SV.selectAllPoints(leaf); } SV.select(ns2, { keepPoints: true }); return; }
        if (S.sel.indexOf(leaf.id) < 0) { S.psel = {}; SV.select([leaf.id]); SV.selectAllPoints(leaf); }
        if (leaf.type === 'text' || leaf.type === 'image') { beginMove(ev, [leaf.id], 'direct'); return; }
        if (!(S.psel[leaf.id] || []).length) SV.selectAllPoints(leaf);
        beginPoints(ev, null);
        return;
      }
      if (!ev.shift) { S.psel = {}; SV.select([]); }
      beginMarquee(ev, ev.shift, 'points');
    },
    move: function (ev) {
      var op = S.op;
      if (op.kind === 'points') pointsMove(ev);
      else if (op.kind === 'move') moveMove(ev);
      else if (op.kind === 'marquee') marqueeMove(ev);
      else if (op.kind === 'handle') {
        SV.replaceObj(op.id, clone(op.orig));
        var o = getObj(op.id), a = o.subpaths[op.si].pts[op.i], p = ev.shift ? SV.constrain45(a, ev.p) : ev.p;
        setHandle(a, op.part, p.x, p.y, !ev.alt && op.tool !== 'convertAnchor');
        if (ev.alt || op.tool === 'convertAnchor') a.s = false;
        op.changed = true;
      } else if (op.kind === 'segment') {
        SV.replaceObj(op.id, clone(op.orig));
        var so = getObj(op.id); SV.toPath(so);
        var sp = so.subpaths[op.si], n = sp.pts.length, A = sp.pts[op.i], B = sp.pts[(op.i + 1) % n];
        var dx = ev.p.x - op.start.x, dy = ev.p.y - op.start.y;
        if (!op.changed && hypot(dx, dy) * S.view.zoom < 2) return;
        op.changed = true;
        if (G.isLineSeg(A, B)) {
          [A, B].forEach(function (a) { a.x += dx; a.y += dy; a.ix += dx; a.iy += dy; a.ox += dx; a.oy += dy; });
        } else {
          var t = SV.clamp(op.t, 0.12, 0.88), k = 1 / (3 * t * (1 - t));
          setHandle(A, 'out', A.ox + dx * k, A.oy + dy * k, true);
          setHandle(B, 'in', B.ix + dx * k, B.iy + dy * k, true);
        }
      }
    },
    up: function (ev) {
      var op = S.op;
      if (op.kind === 'points') { if (op.moved) SV.commit('reshape'); }
      else if (op.kind === 'move') moveUp();
      else if (op.kind === 'marquee') marqueeUp();
      else if (op.kind === 'handle' || op.kind === 'segment') { if (op.changed) SV.commit('reshape'); }
    },
    hover: function (ev) {
      var h = SV.hitTest(ev.p);
      S.hover = h ? h.obj.id : null;
      setCursor(CURSORS.direct);
    }
  };

  /* ================= pen & anchor tools ================= */
  function nearScreen(a, ev, px) { var s = SV.toScreen(a); return hypot(s.x - ev.sx, s.y - ev.sy) <= (px || 7); }
  SV.finishPen = function () {
    if (!S.pen) return;
    var o = getObj(S.pen.id);
    S.pen = null;
    if (o) {
      o.subpaths = o.subpaths.filter(function (sp) { return sp.pts.length > 1; });
      if (!o.subpaths.length) { SV.removeObj(o.id); S.sel = S.sel.filter(function (id) { return id !== o.id; }); }
    }
    SV.commit('pen');
  };
  function deleteAnchor(o, si, i) {
    SV.toPath(o);
    var sp = o.subpaths[si]; sp.pts.splice(i, 1);
    if (sp.pts.length < 2) o.subpaths.splice(si, 1);
    if (!o.subpaths.length) { SV.removeObj(o.id); S.sel = S.sel.filter(function (id) { return id !== o.id; }); }
    S.psel = {};
  }
  function addAnchor(seg) {
    var o = seg.o; SV.toPath(o);
    var idx = G.splitSegAt(o.subpaths[seg.si], seg.i, seg.t);
    S.psel = {}; S.psel[o.id] = [seg.si + ':' + idx];
    if (S.sel.indexOf(o.id) < 0) S.sel = [o.id];
  }
  TOOLS.pen = {
    down: function (ev) {
      var o = S.pen && getObj(S.pen.id);
      if (S.pen && !o) S.pen = null;
      var snap = SV.buildSnap(S.pen ? [S.pen.id] : []);
      if (S.pen) {
        var sp = o.subpaths[S.pen.sub], first = sp.pts[0], last = sp.pts[sp.pts.length - 1];
        if (sp.pts.length >= 2 && nearScreen(first, ev)) {
          sp.closed = true;
          S.op = { kind: 'penclose', tool: 'pen', idx: 0, start: ev.p };
          return;
        }
        if (nearScreen(last, ev)) {
          last.ox = last.x; last.oy = last.y; last.s = false;
          S.op = { kind: 'pendrag', tool: 'pen', idx: sp.pts.length - 1, start: ev.p, outOnly: true };
          return;
        }
        var p = ev.shift ? SV.constrain45(last, ev.p) : SV.snapPoint(snap, ev.p);
        sp.pts.push(G.A(p.x, p.y));
        S.psel = {}; S.psel[o.id] = [S.pen.sub + ':' + (sp.pts.length - 1)];
        S.op = { kind: 'pendrag', tool: 'pen', idx: sp.pts.length - 1, start: p };
        return;
      }
      // not drawing: continue / auto add-delete on selected paths
      var sel = SV.selObjs();
      var ah = SV.hitAnchor(sel, ev.p, false);
      if (ah && ah.o.type === 'path') {
        var sp2 = ah.o.subpaths[ah.si];
        if (!sp2.closed && (ah.i === 0 || ah.i === sp2.pts.length - 1)) {
          if (ah.i === 0) ah.o.subpaths[ah.si] = G.reverseSub(sp2);
          S.pen = { id: ah.o.id, sub: ah.si };
          var L = ah.o.subpaths[ah.si].pts;
          S.op = { kind: 'pendrag', tool: 'pen', idx: L.length - 1, start: ev.p, outOnly: true };
          return;
        }
        deleteAnchor(ah.o, ah.si, ah.i); SV.commit('delete anchor'); return;
      }
      if (ah) { deleteAnchor(ah.o, ah.si, ah.i); SV.commit('delete anchor'); return; }
      var seg = SV.hitSegment(sel, ev.p);
      if (seg) { addAnchor(seg); SV.commit('add anchor'); return; }
      if (!SV.canDraw()) return;
      var p0 = SV.snapPoint(snap, ev.p);
      var np = SV.mk.path([{ closed: false, pts: [G.A(p0.x, p0.y)] }], SV.newStyle('pen'));
      SV.insertObj(np);
      S.sel = [np.id]; S.psel = {}; S.psel[np.id] = ['0:0'];
      S.pen = { id: np.id, sub: 0 };
      S.op = { kind: 'pendrag', tool: 'pen', idx: 0, start: p0 };
    },
    move: function (ev) {
      var op = S.op, o = S.pen && getObj(S.pen.id); if (!o) return;
      var sp = o.subpaths[S.pen.sub], a = sp.pts[op.idx];
      var p = ev.shift ? SV.constrain45(a, ev.p) : ev.p;
      if (hypot(p.x - a.x, p.y - a.y) * S.view.zoom < 2) return;
      op.dragged = true;
      if (op.kind === 'penclose') {
        a.ix = 2 * a.x - p.x; a.iy = 2 * a.y - p.y; a.ox = p.x; a.oy = p.y; a.s = true;
        if (ev.alt) { a.ox = op.oox != null ? op.oox : a.ox; }
      } else {
        a.ox = p.x; a.oy = p.y;
        if (!op.outOnly && !ev.alt) { a.ix = 2 * a.x - p.x; a.iy = 2 * a.y - p.y; a.s = true; } else a.s = false;
      }
    },
    up: function () {
      var op = S.op;
      var o = S.pen && getObj(S.pen.id);
      if (op.kind === 'penclose') { SV.finishPen(); return; }
      if (o) SV.commit('pen');
    },
    hover: function (ev) {
      var c = CURSORS.pen;
      if (S.pen) {
        var o = getObj(S.pen.id);
        if (o) {
          var sp = o.subpaths[S.pen.sub];
          S.pen.cursor = ev.shift ? SV.constrain45(sp.pts[sp.pts.length - 1], ev.p) : ev.p;
          if (sp.pts.length >= 2 && nearScreen(sp.pts[0], ev)) c = CURSORS.penClose;
        }
      } else {
        var sel = SV.selObjs(), ah = SV.hitAnchor(sel, ev.p, false);
        if (ah && ah.o.type === 'path' && !ah.o.subpaths[ah.si].closed && (ah.i === 0 || ah.i === ah.o.subpaths[ah.si].pts.length - 1)) c = CURSORS.penCont;
        else if (ah) c = CURSORS.penDel;
        else if (SV.hitSegment(sel, ev.p)) c = CURSORS.penAdd;
      }
      setCursor(c);
    }
  };
  TOOLS.addAnchor = {
    down: function (ev) {
      var seg = SV.hitSegment(allLeafCandidates(ev.p), ev.p);
      if (!seg) return SV.toast('Click on a path segment to add an anchor point');
      addAnchor(seg); SV.commit('add anchor');
    },
    hover: function (ev) { var h = SV.hitTest(ev.p); S.hover = h ? h.obj.id : null; setCursor(CURSORS.penAdd); }
  };
  TOOLS.deleteAnchor = {
    down: function (ev) {
      var ah = SV.hitAnchor(allLeafCandidates(ev.p), ev.p, false);
      if (!ah) return SV.toast('Click on an anchor point to delete it');
      deleteAnchor(ah.o, ah.si, ah.i); SV.commit('delete anchor');
    },
    hover: function (ev) { var h = SV.hitTest(ev.p); S.hover = h ? h.obj.id : null; setCursor(CURSORS.penDel); }
  };
  TOOLS.convertAnchor = {
    down: function (ev) {
      var ah = SV.hitAnchor(allLeafCandidates(ev.p), ev.p, true);
      if (!ah) return;
      var o = ah.o; SV.toPath(o);
      if (S.sel.indexOf(o.id) < 0) { S.sel = [o.id]; }
      S.psel = {}; S.psel[o.id] = [ah.si + ':' + ah.i];
      if (ah.part !== 'a') { S.op = { kind: 'handle', tool: 'convertAnchor', id: o.id, si: ah.si, i: ah.i, part: ah.part, orig: clone(o) }; return; }
      S.op = { kind: 'convert', tool: 'convertAnchor', id: o.id, si: ah.si, i: ah.i, orig: clone(o), start: ev.p };
    },
    move: function (ev) {
      var op = S.op;
      if (op.kind === 'handle') { return TOOLS.direct.move(ev); }
      SV.replaceObj(op.id, clone(op.orig));
      var a = getObj(op.id).subpaths[op.si].pts[op.i];
      if (hypot(ev.p.x - a.x, ev.p.y - a.y) * S.view.zoom < 3) return;
      op.dragged = true;
      a.ox = ev.p.x; a.oy = ev.p.y; a.ix = 2 * a.x - ev.p.x; a.iy = 2 * a.y - ev.p.y; a.s = true;
    },
    up: function () {
      var op = S.op;
      if (op.kind === 'handle') { if (op.changed) SV.commit('convert'); return; }
      if (!op.dragged) { var a = getObj(op.id).subpaths[op.si].pts[op.i]; a.ix = a.ox = a.x; a.iy = a.oy = a.y; a.s = false; }
      SV.commit('convert');
    },
    hover: function (ev) { var h = SV.hitTest(ev.p); S.hover = h ? h.obj.id : null; setCursor(CURSORS.convert); }
  };

  /* ================= pencil / brush ================= */
  function freehandTool(kind) {
    return {
      down: function (ev) { if (!SV.canDraw()) return; S.op = { kind: 'pencil', tool: kind, pts: [ev.p] }; },
      move: function (ev) {
        var pts = S.op.pts, l = pts[pts.length - 1];
        if (hypot(ev.p.x - l.x, ev.p.y - l.y) * S.view.zoom >= 1.5) pts.push(ev.p);
      },
      up: function () {
        var pts = S.op.pts; if (pts.length < 3) return;
        var z = S.view.zoom, closed = pts.length > 12 && hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) * z < 12;
        var sp = G.fitFreehand(pts, 2.4 / z, closed);
        if (!sp || sp.pts.length < 2) return;
        var o = SV.mk.path([sp], SV.newStyle(kind === 'brush' ? 'brush' : 'pencil'));
        if (SV.insertObj(o)) { SV.select([o.id]); SV.commit(kind); }
      }
    };
  }
  TOOLS.pencil = freehandTool('pencil');
  TOOLS.brush = freehandTool('brush');

  /* ================= shape tools ================= */
  function shapeTool(kind) {
    return {
      down: function (ev) {
        if (!SV.canDraw()) return;
        var snap = SV.buildSnap([]);
        S.op = { kind: 'shape', tool: kind, p0: SV.snapPoint(snap, ev.p), snap: snap, obj: null, sx: ev.sx, sy: ev.sy };
        S.snapLines = [];
      },
      move: function (ev) {
        var op = S.op;
        if (!op.obj && hypot(ev.sx - op.sx, ev.sy - op.sy) < 3) return;
        op.last = ev;
        updateShape(op, ev);
      },
      up: function () {
        var op = S.op;
        if (!op.obj) { SV.ui.shapeDialog(kind, op.p0); return; }
        SV.select([op.obj.id]); SV.commit(kind);
      }
    };
  }
  function updateShape(op, ev) {
    var kind = op.tool, p0 = op.p0, p = SV.snapPoint(op.snap, ev.p), st;
    if (!op.obj) {
      st = SV.newStyle(kind === 'line' ? 'line' : 'shape');
      if (kind === 'rect' || kind === 'rrect') op.obj = SV.mk.rect(0, 0, 0, 0, kind === 'rrect' ? S.shape.radius : 0, st);
      else if (kind === 'ellipse') op.obj = SV.mk.ellipse(0, 0, 0, 0, st);
      else if (kind === 'polygon') op.obj = SV.mk.polygon(0, 0, 0, S.shape.sides, st);
      else if (kind === 'star') op.obj = SV.mk.star(0, 0, 0, 0, S.shape.points, st);
      else if (kind === 'line') op.obj = SV.mk.path([{ closed: false, pts: [G.A(0, 0), G.A(0, 0)] }], st);
      SV.insertObj(op.obj); S.sel = [op.obj.id];
    }
    var o = getObj(op.obj.id); if (!o) return;
    var dx = p.x - p0.x, dy = p.y - p0.y;
    if (kind === 'rect' || kind === 'rrect' || kind === 'ellipse') {
      if (ev.shift) { var s = max(abs(dx), abs(dy)); dx = (dx < 0 ? -1 : 1) * s; dy = (dy < 0 ? -1 : 1) * s; }
      var x, y, w, h;
      if (ev.alt) { w = abs(dx) * 2; h = abs(dy) * 2; x = p0.x - abs(dx); y = p0.y - abs(dy); }
      else { w = abs(dx); h = abs(dy); x = min(p0.x, p0.x + dx); y = min(p0.y, p0.y + dy); }
      if (kind === 'ellipse') { o.cx = x + w / 2; o.cy = y + h / 2; o.rx = w / 2; o.ry = h / 2; }
      else { o.x = x; o.y = y; o.w = w; o.h = h; }
      readout(ev, 'W: ' + n1(w) + ' px\nH: ' + n1(h) + ' px');
    } else if (kind === 'polygon' || kind === 'star') {
      var r = hypot(dx, dy), ang = ev.shift ? 0 : Math.atan2(dy, dx) + PI / 2;
      o.cx = p0.x; o.cy = p0.y;
      if (kind === 'polygon') { o.r = r; o.sides = S.shape.sides; } else { o.r1 = r; o.r2 = r * S.shape.inner; o.points = S.shape.points; }
      o.m = G.rotate(ang, p0.x, p0.y);
      readout(ev, (kind === 'polygon' ? 'Sides: ' + S.shape.sides : 'Points: ' + S.shape.points) + '  (↑/↓)\nRadius: ' + n1(r) + ' px');
    } else if (kind === 'line') {
      var e = ev.shift ? SV.constrain45(p0, ev.p) : p, a = ev.alt ? { x: 2 * p0.x - e.x, y: 2 * p0.y - e.y } : p0;
      var sp = o.subpaths[0]; sp.pts = [G.A(a.x, a.y), G.A(e.x, e.y)];
      var deg = -Math.atan2(e.y - a.y, e.x - a.x) * 180 / PI;
      readout(ev, 'L: ' + n1(hypot(e.x - a.x, e.y - a.y)) + ' px\n∠: ' + n1(deg) + '°');
    }
  }
  SV.updateShapeOp = function () { if (S.op && S.op.kind === 'shape' && S.op.obj && S.op.last) { updateShape(S.op, S.op.last); SV.requestRender(); } };
  ['rect', 'rrect', 'ellipse', 'polygon', 'star', 'line'].forEach(function (k) { TOOLS[k] = shapeTool(k); });

  /* ================= type ================= */
  TOOLS.type = {
    down: function (ev) {
      var h = SV.hitTest(ev.p);
      if (h && h.obj.type === 'text' && SV.isEditable(h.obj)) { SV.startTextEdit(h.obj, ev.p); return; }
      if (!SV.canDraw()) return;
      var o = SV.mk.text(ev.p.x, ev.p.y, '', clone(S.font), SV.newStyle('text'));
      SV.insertObj(o); S.sel = [o.id];
      SV.startTextEdit(o, null, { isNew: true });
    },
    hover: function (ev) { var h = SV.hitTest(ev.p); S.hover = h && h.obj.type === 'text' ? h.obj.id : null; setCursor('text'); }
  };
  SV.startTextEdit = function (o, clickP, opts) {
    opts = opts || {};
    if (S.pen) SV.finishPen();
    S.editing = { id: o.id, isNew: !!opts.isNew, orig: o.text };
    S.sel = [o.id]; S.psel = {};
    var ta = D.textEditor;
    ta.value = o.text;
    ta.style.display = 'block';
    SV.positionEditor();
    ta.focus({ preventScroll: true });
    var idx = o.text.length;
    if (clickP) idx = caretIndexAt(o, clickP);
    ta.setSelectionRange(idx, idx);
    SV.requestRender(true);
  };
  function caretIndexAt(o, p) {
    var lay = SV.textLayout(o), q = G.ap(G.inv(o.m), p.x, p.y);
    var li = SV.clamp(Math.floor((q.y - (o.y - lay.asc) + (lay.L - lay.asc - lay.desc) / 2) / lay.L), 0, lay.lines.length - 1);
    var line = lay.lines[li], w = lay.widths[li], f = o.font;
    var x0 = f.align === 'center' ? o.x - w / 2 : f.align === 'right' ? o.x - w : o.x;
    var c = document.createElement('canvas').getContext('2d'); c.font = SV.fontCSS(f);
    var best = 0, bestD = Infinity;
    for (var k = 0; k <= line.length; k++) {
      var xx = x0 + c.measureText(line.slice(0, k)).width + lay.tr * k, d = abs(xx - q.x);
      if (d < bestD) { bestD = d; best = k; }
    }
    var idx = 0; for (var j = 0; j < li; j++) idx += lay.lines[j].length + 1;
    return idx + best;
  }
  SV.positionEditor = function () {
    if (!S.editing) return;
    var o = getObj(S.editing.id); if (!o) return;
    var ta = D.textEditor, f = o.font, lay = SV.textLayout(Object.assign({}, o, { text: ta.value, id: '__edit' }));
    var M = G.mul(SV.viewM(), o.m);
    var w = max(lay.W, f.size * 0.5) + f.size * 0.6;
    var left = f.align === 'center' ? o.x - w / 2 : f.align === 'right' ? o.x - w + f.size * 0.3 : o.x;
    var top = o.y - ((lay.L - (lay.asc + lay.desc)) / 2 + lay.asc);
    var fill = typeof o.style.fill === 'string' ? o.style.fill : (o.style.fill && o.style.fill.stops ? o.style.fill.stops[0].c : '#000');
    ta.style.font = SV.fontCSS(f);
    ta.style.lineHeight = lay.L + 'px';
    ta.style.letterSpacing = lay.tr + 'px';
    ta.style.textAlign = f.align || 'left';
    ta.style.width = w + 'px';
    ta.style.height = (lay.lines.length * lay.L + 2) + 'px';
    ta.style.color = fill;
    ta.style.transform = 'matrix(' + M.join(',') + ') translate(' + left + 'px,' + top + 'px)';
  };
  SV.commitTextEdit = function (opts) {
    if (!S.editing) return;
    var ed = S.editing, o = getObj(ed.id), ta = D.textEditor;
    S.editing = null;
    ta.style.display = 'none'; ta.blur();
    if (o) {
      o.text = ta.value;
      if (!o.text.trim()) { SV.removeObj(o.id); S.sel = S.sel.filter(function (id) { return id !== o.id; }); }
    }
    SV.commit('type');
    if (opts && opts.toSelect) SV.setTool('select');
    SV.requestRender(true);
  };
  SV.onEditorInput = function () {
    if (!S.editing) return;
    var o = getObj(S.editing.id); if (!o) return;
    o.text = D.textEditor.value;
    SV.positionEditor();
    SV.requestRender(true);
  };

  /* ================= eyedropper / hand / zoom ================= */
  TOOLS.eyedropper = {
    down: function (ev) {
      var h = SV.hitTest(ev.p); if (!h) return;
      var src = h.obj; if (!src.style) return;
      var keys = ['fill', 'stroke', 'sw', 'cap', 'join', 'miter', 'dash', 'opacity', 'blend'];
      var targets = [];
      SV.selObjs().forEach(function (o) { SV.leaves(o).forEach(function (l) { if (l.id !== src.id && SV.isEditable(l)) targets.push(l); }); });
      targets.forEach(function (t) {
        keys.forEach(function (k) { if (t.type === 'image' && k !== 'opacity' && k !== 'blend') return; t.style[k] = clone(src.style[k]); });
        if (t.type === 'text' && src.type === 'text') t.font = clone(src.font);
      });
      if (src.type !== 'image') keys.forEach(function (k) { S.style[k] = clone(src.style[k]); });
      if (src.type === 'text') S.font = clone(src.font);
      if (targets.length) SV.commit('eyedropper'); else SV.requestRender(true);
      SV.toast(targets.length ? 'Applied sampled appearance' : 'Sampled appearance — select objects first to apply it');
    },
    hover: function (ev) { var h = SV.hitTest(ev.p); S.hover = h ? h.obj.id : null; setCursor(CURSORS.eyedropper); }
  };
  TOOLS.hand = { hover: function () { setCursor('grab'); } };
  TOOLS.zoom = {
    down: function (ev) { S.op = { kind: 'marquee', tool: 'zoom', start: ev.p, mk: 'zoom', alt: ev.alt, sx: ev.sx, sy: ev.sy }; S.marquee = { x: ev.p.x, y: ev.p.y, w: 0, h: 0, zoom: true }; },
    move: function (ev) { marqueeMove(ev); },
    up: function (ev) {
      var r = S.marquee;
      if (r && r.w * S.view.zoom > 6 && r.h * S.view.zoom > 6 && !S.op.alt) SV.zoomToRect(r);
      else SV.zoomStep(S.op.alt || ev.alt ? -1 : 1, S.op.sx, S.op.sy);
      S.marquee = null;
    },
    hover: function (ev) { setCursor(ev.alt ? 'zoom-out' : 'zoom-in'); }
  };

  /* ================= rotate / scale tools ================= */
  function originOf() { var b = SV.selBBox(); if (!b) return null; return S.origin || { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }
  TOOLS.rotate = {
    down: function (ev) {
      if (!S.sel.length) return SV.toast('Select objects to rotate');
      if (ev.alt) { S.origin = ev.p; SV.ui.transformDialog('rotate'); return; }
      var org = originOf();
      if (nearScreen(org, ev, 9) || ev.dbl) { if (ev.dbl) SV.ui.transformDialog('rotate'); return; }
      var b = SV.selBBox();
      beginRotate(ev, b, org, 'rotate');
      S.op.setOrigin = ev.p;
    },
    move: function (ev) { rotateMove(ev); },
    up: function () { if (S.op.changed) SV.commit('rotate'); else S.origin = S.op.setOrigin; },
    hover: function () { setCursor('crosshair'); }
  };
  TOOLS.scale = {
    down: function (ev) {
      if (!S.sel.length) return SV.toast('Select objects to scale');
      if (ev.alt) { S.origin = ev.p; SV.ui.transformDialog('scale'); return; }
      var org = originOf(), ids = selectableTopIds();
      S.op = { kind: 'scaletool', tool: 'scale', o: org, start: ev.p, ids: ids, origs: snapshotObjs(ids), sx: ev.sx, sy: ev.sy };
    },
    move: function (ev) {
      var op = S.op;
      if (!op.changed && hypot(ev.sx - op.sx, ev.sy - op.sy) < 3) return;
      var d0x = op.start.x - op.o.x, d0y = op.start.y - op.o.y;
      var sx = abs(d0x) > 1e-6 ? (ev.p.x - op.o.x) / d0x : 1, sy = abs(d0y) > 1e-6 ? (ev.p.y - op.o.y) / d0y : 1;
      if (ev.shift) { var s = hypot(ev.p.x - op.o.x, ev.p.y - op.o.y) / (hypot(d0x, d0y) || 1); sx = sy = s; }
      if (abs(sx) < 0.01) sx = 0.01; if (abs(sy) < 0.01) sy = 0.01;
      restoreObjs(op.origs);
      var M = G.scale(sx, sy, op.o.x, op.o.y);
      op.ids.forEach(function (id) { var o = getObj(id); if (o) SV.transformObj(o, M); });
      op.changed = true;
      readout(ev, 'Scale: ' + n1(sx * 100) + '% × ' + n1(sy * 100) + '%');
    },
    up: function (ev) { if (S.op.changed) SV.commit('scale'); else S.origin = ev.p; },
    hover: function () { setCursor('crosshair'); }
  };

  /* ================= scissors ================= */
  TOOLS.scissors = {
    down: function (ev) {
      var cands = allLeafCandidates(ev.p);
      var seg = SV.hitSegment(cands, ev.p);
      if (!seg) return SV.toast('Click on a path to cut it');
      var o = seg.o; SV.toPath(o);
      var sp = o.subpaths[seg.si], idx;
      var A = sp.pts[seg.i], B = sp.pts[(seg.i + 1) % sp.pts.length];
      if (hypot(seg.p.x - A.x, seg.p.y - A.y) * S.view.zoom < 4) idx = seg.i;
      else if (hypot(seg.p.x - B.x, seg.p.y - B.y) * S.view.zoom < 4) idx = (seg.i + 1) % sp.pts.length;
      else idx = G.splitSegAt(sp, seg.i, seg.t);
      var pts = sp.pts, a = pts[idx];
      if (sp.closed) {
        var rot = pts.slice(idx).concat(pts.slice(0, idx));
        var endCopy = { x: a.x, y: a.y, ix: a.ix, iy: a.iy, ox: a.x, oy: a.y, s: false };
        rot[0] = { x: a.x, y: a.y, ix: a.x, iy: a.y, ox: a.ox, oy: a.oy, s: false };
        rot.push(endCopy);
        o.subpaths[seg.si] = { closed: false, pts: rot };
        SV.select([o.id]);
      } else {
        if (idx === 0 || idx === pts.length - 1) return SV.toast('Cannot cut at an endpoint');
        var first = pts.slice(0, idx + 1), second = pts.slice(idx).map(function (q) { return clone(q); });
        first[first.length - 1] = Object.assign({}, a, { ox: a.x, oy: a.y, s: false });
        second[0] = Object.assign({}, a, { ix: a.x, iy: a.y, s: false });
        o.subpaths[seg.si] = { closed: false, pts: first };
        var o2 = SV.mk.path([{ closed: false, pts: second }], clone(o.style), o.name);
        var f = find(o.id); f.arr.splice(f.idx + 1, 0, o2);
        SV.select([o.id, o2.id]);
      }
      SV.commit('scissors');
    },
    hover: function (ev) { var h = SV.hitTest(ev.p); S.hover = h ? h.obj.id : null; setCursor(CURSORS.scissors); }
  };

  /* ================= gradient tool ================= */
  SV.defaultGradient = function (base, type) {
    var c = typeof base === 'string' ? base : '#d4ff3a';
    var stops = [{ o: 0, c: '#ffffff', a: 1 }, { o: 1, c: c.toLowerCase() === '#ffffff' ? '#0a0a0a' : c, a: 1 }];
    if (base && typeof base === 'object' && base.stops) stops = clone(base.stops);
    return type === 'radial' ? { type: 'radial', cx: 0.5, cy: 0.5, r: 0.5, fx: 0.5, fy: 0.5, stops: stops } : { type: 'linear', x1: 0, y1: 0.5, x2: 1, y2: 0.5, stops: stops };
  };
  TOOLS.gradient = {
    down: function (ev) {
      var targets = [];
      SV.selObjs().forEach(function (o) { SV.leaves(o).forEach(function (l) { if (l.type !== 'image' && SV.isEditable(l)) targets.push(l); }); });
      if (!targets.length) { var h = SV.hitTest(ev.p); if (h && h.obj.type !== 'image') { SV.select([h.obj.id]); targets = [h.obj]; } }
      if (!targets.length) return;
      targets.forEach(function (t) { if (!t.style.fill || typeof t.style.fill !== 'object') t.style.fill = SV.defaultGradient(t.style.fill); });
      S.op = { kind: 'grad', tool: 'gradient', start: ev.p, ids: targets.map(function (t) { return t.id; }) };
    },
    move: function (ev) {
      var op = S.op;
      op.ids.forEach(function (id) {
        var o = getObj(id), lb = o.type === 'path' ? G.subsBBox(o.subpaths) : SV.localBox(o); if (!lb) return;
        var inv = G.inv(o.m), a = G.ap(inv, op.start.x, op.start.y), b = G.ap(inv, ev.p.x, ev.p.y);
        var fx = function (x) { return lb.w ? (x - lb.x) / lb.w : 0.5; }, fy = function (y) { return lb.h ? (y - lb.y) / lb.h : 0.5; };
        var g = o.style.fill;
        if (g.type === 'radial') { g.cx = g.fx = fx(a.x); g.cy = g.fy = fy(a.y); g.r = max(0.01, hypot(fx(b.x) - fx(a.x), fy(b.y) - fy(a.y))); }
        else { g.x1 = fx(a.x); g.y1 = fy(a.y); g.x2 = fx(b.x); g.y2 = fy(b.y); }
      });
      op.changed = true;
    },
    up: function () { SV.commit('gradient'); },
    hover: function (ev) { var h = SV.hitTest(ev.p); S.hover = h ? h.obj.id : null; setCursor('crosshair'); }
  };

  /* ================= commands ================= */
  var C = SV.cmd = {};
  function topSel() { return SV.zSorted(S.sel.filter(function (id) { var o = getObj(id); return o && SV.isEditable(o); })); }
  C.deleteSel = function () {
    if (S.tool === 'direct' || S.tool === 'pen') {
      var ids = Object.keys(S.psel).filter(function (id) { return getObj(id) && (S.psel[id] || []).length; });
      var partial = ids.filter(function (id) { var o = getObj(id), tot = 0; SV.localSubs(o).forEach(function (sp) { tot += sp.pts.length; }); return S.psel[id].length < tot; });
      if (partial.length) {
        partial.forEach(function (id) {
          var o = getObj(id); SV.toPath(o);
          var keys = S.psel[id].map(function (k) { return k.split(':').map(Number); }).sort(function (a, b) { return b[0] - a[0] || b[1] - a[1]; });
          keys.forEach(function (k) { var sp = o.subpaths[k[0]]; if (sp) sp.pts.splice(k[1], 1); });
          o.subpaths = o.subpaths.filter(function (sp) { return sp.pts.length > 1; });
          if (!o.subpaths.length) SV.removeObj(id);
        });
        S.psel = {}; S.sel = S.sel.filter(function (id) { return getObj(id); });
        if (S.pen) S.pen = null;
        SV.commit('delete points'); return;
      }
    }
    var ids2 = topSel(); if (!ids2.length) return;
    ids2.forEach(SV.removeObj);
    S.sel = []; S.psel = {}; S.pen = null;
    SV.commit('delete');
  };
  C.copy = function () {
    var ids = topSel(); if (!ids.length) return false;
    S.clipboard = { objs: ids.map(function (id) { return clone(getObj(id)); }), box: SV.selBBox(ids), assets: {} };
    S.clipboard.objs.forEach(function (o) { SV.leaves(o).forEach(function (l) { if (l.type === 'image') S.clipboard.assets[l.asset] = S.doc.assets[l.asset]; }); });
    try { S.clipText = SV.io.exportSVG({ ids: ids }); } catch (e) { S.clipText = ''; }
    return true;
  };
  C.cut = function () { if (C.copy()) { topSel().forEach(SV.removeObj); S.sel = []; SV.commit('cut'); } };
  C.paste = function (mode) {
    var cb = S.clipboard; if (!cb || !cb.objs.length) return SV.toast('Clipboard is empty');
    Object.keys(cb.assets || {}).forEach(function (k) { if (!S.doc.assets[k]) S.doc.assets[k] = cb.assets[k]; });
    var objs = cb.objs.map(function (o) { return SV.reId(clone(o)); }), ids = objs.map(function (o) { return o.id; });
    var L = SV.activeLayer();
    if (L.locked || L.hidden) return SV.toast('Active layer is locked or hidden', 'warn');
    var sel = topSel();
    if (mode === 'front' && sel.length) {
      var f = find(sel[sel.length - 1]); f.arr.splice.apply(f.arr, [f.idx + 1, 0].concat(objs));
    } else if (mode === 'back' && sel.length) {
      var fb = find(sel[0]); fb.arr.splice.apply(fb.arr, [fb.idx, 0].concat(objs));
    } else {
      objs.forEach(function (o) { L.children.push(o); });
      if (!mode && cb.box) {
        var r = D.stage.getBoundingClientRect(), c = SV.toDoc(r.width / 2, r.height / 2);
        var M = G.translate(c.x - (cb.box.x + cb.box.w / 2), c.y - (cb.box.y + cb.box.h / 2));
        objs.forEach(function (o) { SV.transformObj(o, M); });
      }
    }
    SV.select(ids); SV.commit('paste');
  };
  C.duplicate = function () {
    var ids = topSel(); if (!ids.length) return;
    var off = S.lastDup || { dx: 10, dy: 10 }, newIds = [];
    ids.slice().reverse().forEach(function (id) {
      var f = find(id), c = SV.reId(clone(f.obj));
      SV.transformObj(c, G.translate(off.dx, off.dy));
      f.arr.splice(f.idx + 1, 0, c); newIds.unshift(c.id);
    });
    S.lastDup = off;
    SV.select(newIds); SV.commit('duplicate');
  };
  C.group = function () {
    var ids = topSel(); if (!ids.length) return;
    var objs = ids.map(getObj), g = SV.mk.group([], '');
    SV.replaceObj(ids[ids.length - 1], g);
    ids.slice(0, -1).forEach(function (id) { var f = find(id); if (f) f.arr.splice(f.idx, 1); });
    g.children = objs;
    SV.select([g.id]); SV.commit('group');
  };
  C.ungroup = function () {
    var ids = topSel(), out = [], any = false;
    ids.forEach(function (id) {
      var o = getObj(id);
      if (o && o.type === 'group') {
        any = true;
        var f = find(id), ch = o.children;
        if (o.style && o.style.opacity < 1) ch.forEach(function (c) { if (c.style) c.style.opacity = (c.style.opacity == null ? 1 : c.style.opacity) * o.style.opacity; });
        f.arr.splice.apply(f.arr, [f.idx, 1].concat(ch));
        ch.forEach(function (c) { out.push(c.id); });
      } else out.push(id);
    });
    if (!any) return SV.toast('No groups selected');
    SV.select(out); SV.commit('ungroup');
  };
  C.arrange = function (how) {
    var ids = topSel(); if (!ids.length) return;
    var selSet = new Set(ids);
    if (how === 'front') ids.forEach(function (id) { var f = find(id); f.arr.splice(f.idx, 1); f.arr.push(f.obj); });
    else if (how === 'back') ids.slice().reverse().forEach(function (id) { var f = find(id); f.arr.splice(f.idx, 1); f.arr.unshift(f.obj); });
    else if (how === 'forward') ids.slice().reverse().forEach(function (id) { var f = find(id); if (f.idx < f.arr.length - 1 && !selSet.has(f.arr[f.idx + 1].id)) { f.arr[f.idx] = f.arr[f.idx + 1]; f.arr[f.idx + 1] = f.obj; } });
    else if (how === 'backward') ids.forEach(function (id) { var f = find(id); if (f.idx > 0 && !selSet.has(f.arr[f.idx - 1].id)) { f.arr[f.idx] = f.arr[f.idx - 1]; f.arr[f.idx - 1] = f.obj; } });
    SV.commit('arrange');
  };
  C.lockSel = function () { var ids = topSel(); if (!ids.length) return; ids.forEach(function (id) { getObj(id).locked = true; }); S.sel = []; SV.commit('lock'); };
  C.unlockAll = function () {
    var ids = [];
    S.doc.layers.forEach(function (L) { if (L.locked) return; (function rec(arr, top) { arr.forEach(function (o) { if (o.locked) { o.locked = false; if (top) ids.push(o.id); } if (o.type === 'group') rec(o.children, false); }); })(L.children, true); });
    S.sel = ids; SV.commit('unlock all');
  };
  C.hideSel = function () { var ids = topSel(); if (!ids.length) return; ids.forEach(function (id) { getObj(id).hidden = true; }); S.sel = []; SV.commit('hide'); };
  C.showAll = function () {
    var ids = [];
    S.doc.layers.forEach(function (L) { (function rec(arr, top) { arr.forEach(function (o) { if (o.hidden) { o.hidden = false; if (top) ids.push(o.id); } if (o.type === 'group') rec(o.children, false); }); })(L.children, true); });
    S.sel = ids; SV.commit('show all');
  };
  function pathish(o) { return o.type !== 'text' && o.type !== 'image' && o.type !== 'group'; }
  C.makeCompound = function () {
    var ids = topSel(), objs = [];
    ids.forEach(function (id) { SV.leaves(getObj(id)).forEach(function (l) { if (pathish(l)) objs.push(l); }); });
    if (objs.length < 1) return SV.toast('Select paths to make a compound path');
    var subs = []; objs.forEach(function (o) { subs = subs.concat(SV.docSubs(o)); });
    var np = SV.mk.path(subs, clone(objs[0].style), 'Compound Path'); np.style.rule = 'evenodd';
    SV.replaceObj(ids[ids.length - 1], np);
    ids.slice(0, -1).forEach(SV.removeObj);
    SV.select([np.id]); SV.commit('compound');
  };
  C.releaseCompound = function () {
    var ids = topSel(), out = [], any = false;
    ids.forEach(function (id) {
      var o = getObj(id);
      if (o.type === 'path' && o.subpaths.length > 1) {
        any = true;
        var f = find(id), parts = o.subpaths.map(function (sp) { var st = clone(o.style); st.rule = 'nonzero'; return SV.mk.path([clone(sp)], st); });
        f.arr.splice.apply(f.arr, [f.idx, 1].concat(parts));
        parts.forEach(function (p) { out.push(p.id); });
      } else out.push(id);
    });
    if (!any) return SV.toast('No compound paths selected');
    SV.select(out); SV.commit('release compound');
  };
  C.expand = function () {
    var ids = topSel(), n = 0;
    ids.forEach(function (id) { SV.leaves(getObj(id)).forEach(function (l) { if (pathish(l) && l.type !== 'path') { SV.toPath(l); n++; } }); });
    if (!n) return SV.toast('Nothing to expand (select live shapes)');
    SV.commit('expand'); SV.toast('Expanded ' + n + ' shape' + (n > 1 ? 's' : '') + ' to paths');
  };
  function operandOf(o) {
    var ls = SV.leaves(o).filter(pathish);
    if (!ls.length) return null;
    var ops = ls.map(function (l) { return { rings: G.flatten(SV.docSubs(l), 0.35).map(function (p) { return p.pts; }), rule: l.style.rule }; });
    if (ops.length === 1) return ops[0];
    return { rings: G.boolean(ops, 'union'), rule: 'nonzero' };
  }
  C.pathfinder = function (op) {
    var ids = topSel(), objs = ids.map(getObj);
    var bad = objs.filter(function (o) { return !SV.leaves(o).some(pathish); });
    objs = objs.filter(function (o) { return bad.indexOf(o) < 0; });
    if (objs.length < 2) return SV.toast('Select two or more overlapping shapes' + (bad.length ? ' (text and images are skipped)' : ''), 'warn');
    var ck = new Set();
    objs.forEach(function (o) { SV.leaves(o).filter(pathish).forEach(function (l) { G.cornerKeysOf(SV.docSubs(l), ck); }); });
    var operands = objs.map(operandOf);
    var rings = G.boolean(operands, op, ck);
    if (!rings.length) return SV.toast('The result is empty — shapes do not overlap', 'warn');
    var subs = G.fitRings(rings, ck);
    var styleSrc = op === 'minus' ? objs[0] : objs[objs.length - 1];
    var leaf = SV.leaves(styleSrc).filter(pathish).pop();
    var st = clone(leaf.style); st.rule = 'nonzero';
    var np = SV.mk.path(subs, st, '');
    var anchorObj = op === 'minus' ? objs[0] : objs[objs.length - 1];
    SV.replaceObj(anchorObj.id, np);
    objs.forEach(function (o) { if (o !== anchorObj) SV.removeObj(o.id); });
    SV.select([np.id]); SV.commit('pathfinder ' + op);
    return np;
  };
  C.slopify = function () {
    var ids = topSel(); if (!ids.length) return SV.toast('Select a shape to slopify');
    var out = [], skipped = 0;
    ids.forEach(function (id) {
      var o = getObj(id), ls = SV.leaves(o).filter(pathish);
      if (!ls.length) { skipped++; out.push(id); return; }
      var subs = [], rule = 'nonzero';
      if (ls.length === 1) { subs = SV.docSubs(ls[0]); rule = ls[0].style.rule; }
      else { var u = operandOf(o); subs = u.rings.map(function (r) { return { closed: true, pts: r.map(function (p) { return G.A(p.x, p.y); }) }; }); }
      subs = subs.map(function (sp) { return { closed: true, pts: sp.pts }; });
      var res = G.slopify(subs, { rule: rule });
      if (!res || !res.body.length) { skipped++; out.push(id); return; }
      var srcSt = ls[ls.length - 1].style;
      var st = SV.mkStyle({
        fill: { type: 'linear', x1: 0.5, y1: 0, x2: 0.5, y2: 1, stops: [{ o: 0, c: '#f4ffa8', a: 1 }, { o: 0.42, c: '#d4ff3a', a: 1 }, { o: 1, c: '#86b800', a: 1 }] },
        stroke: srcSt.stroke ? '#1b2600' : null, sw: srcSt.stroke ? max(1, srcSt.sw) : 1, join: 'round', cap: 'round'
      });
      var body = SV.mk.path(res.body, st, 'Slime');
      var kids = [body];
      if (res.gloss) kids.push(SV.mk.path(res.gloss, { fill: '#ffffff', opacity: 0.6 }, 'Gloss'));
      var g = SV.mk.group(kids, (o.name ? o.name + ' ' : 'Slime ') + '(slopified)');
      SV.replaceObj(id, g); out.push(g.id);
    });
    SV.select(out); SV.commit('slopify');
    if (skipped) SV.toast('Slopify skipped ' + skipped + ' object' + (skipped > 1 ? 's' : '') + ' (text/images)', 'warn');
    else SV.toast('Slopified. Certified sloppy.');
  };
  C.transformSel = function (M, copy, label) {
    var ids = topSel(); if (!ids.length) return;
    if (copy) {
      var nids = [];
      ids.slice().reverse().forEach(function (id) { var f = find(id), c = SV.reId(clone(f.obj)); f.arr.splice(f.idx + 1, 0, c); nids.unshift(c.id); });
      ids = nids;
    }
    ids.forEach(function (id) { SV.transformObj(getObj(id), M); });
    SV.select(ids); SV.commit(label || 'transform');
  };
  C.flip = function (axis) {
    var b = SV.selBBox(topSel()); if (!b) return;
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    C.transformSel(axis === 'h' ? G.scale(-1, 1, cx, cy) : G.scale(1, -1, cx, cy), false, 'reflect');
  };
  C.align = function (how) {
    var ids = topSel(); if (!ids.length) return;
    var ref = (ids.length === 1 || S.prefs.alignTo === 'artboard') ? { x: 0, y: 0, w: S.doc.width, h: S.doc.height } : SV.selBBox(ids);
    ids.forEach(function (id) {
      var o = getObj(id), b = SV.objBBox(o); if (!b) return;
      var dx = 0, dy = 0;
      if (how === 'left') dx = ref.x - b.x; else if (how === 'hcenter') dx = ref.x + ref.w / 2 - (b.x + b.w / 2); else if (how === 'right') dx = ref.x + ref.w - (b.x + b.w);
      else if (how === 'top') dy = ref.y - b.y; else if (how === 'vcenter') dy = ref.y + ref.h / 2 - (b.y + b.h / 2); else if (how === 'bottom') dy = ref.y + ref.h - (b.y + b.h);
      if (dx || dy) SV.transformObj(o, G.translate(dx, dy));
    });
    SV.commit('align');
  };
  C.distribute = function (how) {
    var ids = topSel(); if (ids.length < 3) return SV.toast('Select three or more objects to distribute');
    var items = ids.map(function (id) { return { o: getObj(id), b: SV.objBBox(getObj(id)) }; });
    var horiz = how === 'hcenter' || how === 'hspace';
    items.sort(function (a, b) { return horiz ? a.b.x - b.b.x : a.b.y - b.b.y; });
    var first = items[0].b, last = items[items.length - 1].b, n = items.length;
    if (how === 'hcenter' || how === 'vcenter') {
      var c0 = horiz ? first.x + first.w / 2 : first.y + first.h / 2, c1 = horiz ? last.x + last.w / 2 : last.y + last.h / 2;
      items.forEach(function (it, i) { var target = c0 + (c1 - c0) * i / (n - 1), cur = horiz ? it.b.x + it.b.w / 2 : it.b.y + it.b.h / 2; SV.transformObj(it.o, horiz ? G.translate(target - cur, 0) : G.translate(0, target - cur)); });
    } else {
      var total = 0; items.forEach(function (it) { total += horiz ? it.b.w : it.b.h; });
      var span = horiz ? last.x + last.w - first.x : last.y + last.h - first.y, gap = (span - total) / (n - 1), pos = horiz ? first.x : first.y;
      items.forEach(function (it) { var cur = horiz ? it.b.x : it.b.y; SV.transformObj(it.o, horiz ? G.translate(pos - cur, 0) : G.translate(0, pos - cur)); pos += (horiz ? it.b.w : it.b.h) + gap; });
    }
    SV.commit('distribute');
  };
  C.selectInverse = function () {
    var ids = [];
    S.doc.layers.forEach(function (L) { if (!L.hidden && !L.locked) L.children.forEach(function (o) { if (!o.hidden && !o.locked && S.sel.indexOf(o.id) < 0) ids.push(o.id); }); });
    SV.select(ids);
  };
  C.selectSame = function (attr) {
    var src = SV.selObjs()[0]; if (!src || !src.style) return SV.toast('Select an object first');
    var v = JSON.stringify(src.style[attr]), ids = [];
    S.doc.layers.forEach(function (L) { if (!L.hidden && !L.locked) L.children.forEach(function (o) { if (!o.hidden && !o.locked && SV.leaves(o).some(function (l) { return l.style && JSON.stringify(l.style[attr]) === v; })) ids.push(o.id); }); });
    SV.select(ids);
  };
  C.selectLayer = function () {
    var L = SV.activeLayer(); SV.select(L.children.filter(function (o) { return !o.hidden && !o.locked; }).map(function (o) { return o.id; }));
  };
  C.nudge = function (dx, dy) {
    if (S.tool === 'direct' && Object.keys(S.psel).some(function (k) { return (S.psel[k] || []).length; })) {
      SV.movePoints(Object.keys(S.psel).filter(function (id) { return getObj(id); }), dx, dy);
    } else {
      var ids = topSel(); if (!ids.length) return;
      ids.forEach(function (id) { SV.transformObj(getObj(id), G.translate(dx, dy)); });
    }
    SV.commit('nudge');
  };
  // apply a style attribute to the selection (and the current default style)
  SV.applyStyle = function (attr, value, opts) {
    opts = opts || {};
    S.style[attr] = clone(value);
    var n = 0;
    SV.selObjs().forEach(function (o) {
      SV.leaves(o).forEach(function (l) {
        if (!SV.isEditable(l) || !l.style) return;
        if (l.type === 'image' && attr !== 'opacity' && attr !== 'blend') return;
        l.style[attr] = clone(value); n++;
      });
      if (o.type === 'group' && (attr === 'opacity' || attr === 'blend')) { /* applied to leaves */ }
    });
    if (opts.commit !== false && n) SV.commit('style ' + attr); else SV.requestRender(true);
    return n;
  };
  SV.applyFont = function (key, value, opts) {
    S.font[key] = value;
    var n = 0;
    SV.selObjs().forEach(function (o) { SV.leaves(o).forEach(function (l) { if (l.type === 'text' && SV.isEditable(l)) { l.font[key] = value; n++; } }); });
    if (S.editing) SV.positionEditor();
    if (n && (!opts || opts.commit !== false)) SV.commit('font ' + key); else SV.requestRender(true);
  };
  SV.applyShapeOpt = function (key, value) {
    S.shape[key] = value;
    var n = 0;
    SV.selObjs().forEach(function (o) {
      SV.leaves(o).forEach(function (l) {
        if (!SV.isEditable(l)) return;
        if (key === 'radius' && l.type === 'rect') { l.rx = value; n++; }
        if (key === 'sides' && l.type === 'polygon') { l.sides = value; n++; }
        if (key === 'points' && l.type === 'star') { l.points = value; n++; }
        if (key === 'inner' && l.type === 'star') { l.r2 = l.r1 * value; n++; }
      });
    });
    if (n) SV.commit('shape ' + key); else SV.requestRender(true);
  };
  SV.currentPaint = function (which) {
    var o = SV.selObjs()[0];
    if (o) { var l = SV.leaves(o).filter(function (x) { return x.style && x.type !== 'image'; })[0]; if (l) return l.style[which]; }
    return S.style[which];
  };
  SV.swapFillStroke = function () {
    var objs = [];
    SV.selObjs().forEach(function (o) { SV.leaves(o).forEach(function (l) { if (l.style && l.type !== 'image' && SV.isEditable(l)) objs.push(l); }); });
    var t = S.style.fill; S.style.fill = S.style.stroke; S.style.stroke = t;
    objs.forEach(function (l) { var f = l.style.fill; l.style.fill = l.style.stroke; l.style.stroke = f; });
    if (objs.length) SV.commit('swap'); else SV.requestRender(true);
  };
  SV.defaultFillStroke = function () {
    var objs = [];
    SV.selObjs().forEach(function (o) { SV.leaves(o).forEach(function (l) { if (l.style && l.type !== 'image' && l.type !== 'text' && SV.isEditable(l)) objs.push(l); }); });
    S.style.fill = '#ffffff'; S.style.stroke = '#000000'; S.style.sw = 1; S.style.dash = null;
    objs.forEach(function (l) { l.style.fill = '#ffffff'; l.style.stroke = '#000000'; l.style.sw = 1; l.style.dash = null; });
    if (objs.length) SV.commit('default colors'); else SV.requestRender(true);
  };

  /* ================= keyboard ================= */
  var CODE_KEYS = { Equal: '=', Minus: '-', BracketLeft: '[', BracketRight: ']', Quote: "'", Semicolon: ';', Slash: '/', Backslash: '\\', Comma: ',', Period: '.', Backquote: '`', IntlBackslash: '\\', NumpadAdd: '=', NumpadSubtract: '-' };
  function keyName(e) {
    if (/^Key[A-Z]$/.test(e.code)) { var k = (e.key || '').toLowerCase(); return /^[a-z]$/.test(k) ? k : e.code.slice(3).toLowerCase(); }
    if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
    if (/^Numpad\d$/.test(e.code)) return e.code.slice(6);
    if (CODE_KEYS[e.code]) return CODE_KEYS[e.code];
    return (e.key || '').toLowerCase();
  }
  SV.comboOf = function (e) {
    var k = keyName(e);
    return (e.ctrlKey || e.metaKey ? 'mod+' : '') + (e.altKey ? 'alt+' : '') + (e.shiftKey ? 'shift+' : '') + k;
  };
  function isTyping(t) { return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  var pasteTimer = null;
  function onKeyDown(e) {
    var t = e.target;
    if (SV.ui && SV.ui.handleGlobalKey && SV.ui.handleGlobalKey(e)) return;
    if (t === D.textEditor) {
      if (e.key === 'Escape') { e.preventDefault(); SV.commitTextEdit({ toSelect: true }); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); SV.commitTextEdit({ toSelect: true }); }
      return;
    }
    if (isTyping(t)) { if (e.key === 'Escape' && t.blur) t.blur(); return; }
    if (S.editing) SV.commitTextEdit();
    var combo = SV.comboOf(e);
    if (e.key === ' ' || e.code === 'Space') { if (!S.spaceHand) { S.spaceHand = true; SV.updateCursor(); } e.preventDefault(); return; }
    // clipboard: let native events fire
    if (combo === 'mod+c' || combo === 'mod+x') { if (combo === 'mod+c') C.copy(); else C.cut(); return; }
    if (combo === 'mod+v') {
      clearTimeout(pasteTimer);
      pasteTimer = setTimeout(function () { pasteTimer = null; C.paste(); }, 80);
      return;
    }
    var act = SV.keymap && SV.keymap[combo];
    if (act) {
      e.preventDefault();
      SV.runAction(act);
      return;
    }
    if (S.op && S.op.kind === 'shape' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      var d = e.key === 'ArrowUp' ? 1 : -1;
      if (S.op.tool === 'polygon') S.shape.sides = SV.clamp(S.shape.sides + d, 3, 64);
      if (S.op.tool === 'star') S.shape.points = SV.clamp(S.shape.points + d, 2, 64);
      SV.updateShapeOp(); return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      var inc = S.prefs.keyInc * (e.shiftKey ? 10 : 1);
      C.nudge(e.key === 'ArrowLeft' ? -inc : e.key === 'ArrowRight' ? inc : 0, e.key === 'ArrowUp' ? -inc : e.key === 'ArrowDown' ? inc : 0);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); C.deleteSel(); return; }
    if (e.key === 'Escape') {
      if (S.pen) { SV.finishPen(); return; }
      if (S.op) { SV.revert(); S.op = null; S.marquee = null; S.readout = null; SV.requestRender(true); return; }
      if (SV.ui && SV.ui.closeMenus && SV.ui.closeMenus()) return;
      SV.deselect(); return;
    }
    if (e.key === 'Enter') {
      if (S.pen) { e.preventDefault(); SV.finishPen(); return; }
      if (S.tool === 'select' && S.sel.length) { e.preventDefault(); SV.ui.transformDialog('move'); return; }
      return;
    }
    if (e.key === 'Tab') { if (t === document.body || t === D.stage || !t) { e.preventDefault(); SV.runAction('window.togglePanels'); } return; }
    if (e.key === 'F1') { e.preventDefault(); SV.runAction('help.shortcuts'); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = keyName(e), kc = (e.shiftKey ? 'shift+' : '') + k;
    if (TOOL_KEYS[kc]) { e.preventDefault(); SV.setTool(TOOL_KEYS[kc]); return; }
    if (kc === 'x') { S.focus = S.focus === 'fill' ? 'stroke' : 'fill'; SV.requestRender(true); return; }
    if (kc === 'shift+x') { SV.swapFillStroke(); return; }
    if (kc === 'd') { SV.defaultFillStroke(); return; }
    if (kc === '/') { e.preventDefault(); SV.applyStyle(S.focus, null); return; }
    if (kc === ',') { var cp = SV.currentPaint(S.focus); SV.applyStyle(S.focus, typeof cp === 'string' ? cp : (cp && cp.stops ? cp.stops[0].c : '#d4ff3a')); return; }
    if (kc === '.') { var gp = SV.currentPaint(S.focus); SV.applyStyle(S.focus, gp && typeof gp === 'object' ? gp : SV.defaultGradient(gp)); return; }
  }
  function onKeyUp(e) {
    if (e.key === ' ' || e.code === 'Space') { S.spaceHand = false; SV.updateCursor(); }
    if (e.key === 'Alt') SV.updateCursor(false);
  }
  SV.bindKeys = function () {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () { S.spaceHand = false; });
    document.addEventListener('copy', function (e) {
      if (isTyping(e.target) || S.editing) return;
      if (!S.sel.length || !S.clipText) return;
      try { e.clipboardData.setData('text/plain', S.clipText); e.clipboardData.setData('image/svg+xml', S.clipText); e.preventDefault(); } catch (er) { /* ignore */ }
    });
    document.addEventListener('cut', function (e) {
      if (isTyping(e.target) || S.editing) return;
      if (!S.clipText) return;
      try { e.clipboardData.setData('text/plain', S.clipText); e.preventDefault(); } catch (er) { /* ignore */ }
    });
    document.addEventListener('paste', function (e) {
      if (isTyping(e.target) || S.editing) return;
      clearTimeout(pasteTimer); pasteTimer = null;
      e.preventDefault();
      var dt = e.clipboardData, files = dt ? Array.from(dt.files || []) : [];
      if (files.length) { SV.io.placeFiles(files); return; }
      var txt = dt ? dt.getData('text/plain') : '';
      if (!txt || (S.clipboard && txt === S.clipText)) { C.paste(); return; }
      if (/<svg[\s>]/i.test(txt)) { SV.io.importSVGText(txt, { place: true }); return; }
      if (txt.trim()) {
        if (!SV.canDraw()) return;
        var r = D.stage.getBoundingClientRect(), c = SV.toDoc(r.width / 2, r.height / 2);
        var o = SV.mk.text(c.x, c.y, txt.slice(0, 2000), clone(S.font), SV.newStyle('text'));
        SV.insertObj(o); SV.select([o.id]); SV.commit('paste text');
      }
    });
  };
})();
