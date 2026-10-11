/* Slop Vector — core: document model, rendering, history, tools, keyboard.
   Classic script, no modules, no dependencies. */
(function () {
  'use strict';
  var G = window.SVGeom;
  var SV = window.SV = window.SV || {};
  var SVGNS = 'http://www.w3.org/2000/svg';
  var abs = Math.abs, min = Math.min, max = Math.max, PI = Math.PI, round = Math.round;
  var fmt = G.fmt;
  var IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  SV.IS_MAC = IS_MAC;

  /* ================= constants ================= */
  var LAYER_COLORS = ['#4f8bff', '#ff4f7b', '#2fc65a', '#ffa21f', '#b45cff', '#00bcd4', '#ff6a3d', '#8f9bb3'];
  var FONTS = {
    'Inter Tight': "'Inter Tight', 'Inter', 'Helvetica Neue', Arial, sans-serif",
    'Archivo': "'Archivo', 'Arial Black', 'Helvetica Neue', Arial, sans-serif",
    'JetBrains Mono': "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, monospace",
    'System UI': "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    'Helvetica': "Helvetica, 'Helvetica Neue', Arial, sans-serif",
    'Arial': "Arial, Helvetica, sans-serif",
    'Georgia': "Georgia, 'Times New Roman', serif",
    'Times New Roman': "'Times New Roman', Times, serif",
    'Courier New': "'Courier New', Courier, monospace",
    'Verdana': "Verdana, Geneva, sans-serif",
    'Trebuchet MS': "'Trebuchet MS', sans-serif",
    'Impact': "Impact, 'Arial Black', sans-serif",
    'Comic Sans MS': "'Comic Sans MS', 'Comic Sans', cursive"
  };
  var BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
  SV.FONTS = FONTS; SV.BLENDS = BLENDS; SV.LAYER_COLORS = LAYER_COLORS;
  SV.fontStack = function (fam) { return FONTS[fam] || ("'" + String(fam).replace(/'/g, '') + "', sans-serif"); };

  /* ================= state ================= */
  var S = SV.state = {
    doc: null,
    sel: [],                 // selected object ids
    psel: {},                // direct selection: objId -> [ 'si:i', ... ]
    activeLayer: null,
    view: { zoom: 1, x: 0, y: 0 },
    tool: 'select', spaceHand: false,
    style: { fill: '#d4ff3a', stroke: '#0a0a0a', sw: 2, cap: 'butt', join: 'miter', miter: 10, dash: null, opacity: 1, blend: 'normal', rule: 'nonzero' },
    focus: 'fill',
    font: { family: 'Inter Tight', size: 48, weight: 700, style: 'normal', align: 'left', lh: 1.2, tracking: 0 },
    shape: { radius: 16, sides: 6, points: 5, inner: 0.45 },
    brush: { size: 6 },
    prefs: { smart: true, grid: false, snapGrid: false, rulers: true, guides: true, outline: false, gridSize: 10, scaleStrokes: false, keyInc: 1, alignTo: 'selection', lockGuides: false, panels: true },
    history: [], hIdx: -1, savedIdx: 0, lastLabel: '', lastTime: 0,
    clipboard: null, clipText: '',
    op: null, hover: null, snapLines: [], marquee: null, editing: null, pen: null, readout: null,
    lastDup: null, docCounter: 1, fileName: null
  };

  /* ================= utilities ================= */
  function uid() { return Math.random().toString(36).slice(2, 10) + (Date.now() % 1e6).toString(36); }
  SV.uid = uid;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  SV.clone = clone;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  SV.esc = esc;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  SV.clamp = clamp;
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return e; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  SV.lsGet = lsGet; SV.lsSet = lsSet; SV.lsDel = lsDel;
  SV.modKey = function (e) { return IS_MAC ? e.metaKey : e.ctrlKey; };

  /* ================= object factories ================= */
  function mkStyle(o) { return Object.assign({ fill: null, stroke: null, sw: 1, cap: 'butt', join: 'miter', miter: 10, dash: null, opacity: 1, blend: 'normal', rule: 'nonzero' }, o || {}); }
  SV.mkStyle = mkStyle;
  function base(type, name, style) { return { id: uid(), type: type, name: name || '', hidden: false, locked: false, m: [1, 0, 0, 1, 0, 0], style: mkStyle(style) }; }
  SV.mk = {
    path: function (subs, style, name) { var o = base('path', name, style); o.subpaths = subs; return o; },
    d: function (d, style, name) { return SV.mk.path(G.parseD(d), style, name); },
    rect: function (x, y, w, h, rx, style, name) { var o = base('rect', name, style); o.x = x; o.y = y; o.w = w; o.h = h; o.rx = rx || 0; return o; },
    ellipse: function (cx, cy, rx, ry, style, name) { var o = base('ellipse', name, style); o.cx = cx; o.cy = cy; o.rx = rx; o.ry = ry; return o; },
    polygon: function (cx, cy, r, sides, style, name) { var o = base('polygon', name, style); o.cx = cx; o.cy = cy; o.r = r; o.sides = sides; return o; },
    star: function (cx, cy, r1, r2, points, style, name) { var o = base('star', name, style); o.cx = cx; o.cy = cy; o.r1 = r1; o.r2 = r2; o.points = points; return o; },
    text: function (x, y, text, font, style, name) { var o = base('text', name, style); o.x = x; o.y = y; o.text = text; o.font = Object.assign({ family: 'Inter Tight', size: 48, weight: 400, style: 'normal', align: 'left', lh: 1.2, tracking: 0 }, font || {}); return o; },
    image: function (asset, x, y, w, h, name) { var o = base('image', name, {}); o.asset = asset; o.x = x; o.y = y; o.w = w; o.h = h; return o; },
    group: function (children, name) { var o = base('group', name, {}); o.children = children; return o; },
    layer: function (name, color) { return { id: uid(), name: name, color: color || LAYER_COLORS[0], hidden: false, locked: false, expanded: true, children: [] }; }
  };
  var mk = SV.mk;
  SV.newDoc = function (w, h, name) {
    var d = { version: 1, name: name || ('Untitled-' + S.docCounter++), width: w || 1200, height: h || 800, layers: [mk.layer('Layer 1', LAYER_COLORS[0])], guides: { h: [], v: [] }, swatches: null, assets: {} };
    return d;
  };

  /* ================= tree helpers ================= */
  function walk(fn, opts) {
    var stop = false;
    function rec(arr, layer, parent, depth) {
      for (var i = 0; i < arr.length && !stop; i++) {
        var o = arr[i];
        if (fn(o, arr, i, layer, parent, depth) === false) { stop = true; return; }
        if (o.type === 'group' && o.children) rec(o.children, layer, o, depth + 1);
      }
    }
    S.doc.layers.forEach(function (L) { if (!stop) rec(L.children, L, null, 0); });
  }
  SV.walk = walk;
  function find(id) {
    var r = null;
    walk(function (o, arr, i, layer, parent) { if (o.id === id) { r = { obj: o, arr: arr, idx: i, layer: layer, parent: parent }; return false; } });
    return r;
  }
  SV.find = find;
  function getObj(id) { var f = find(id); return f ? f.obj : null; }
  SV.getObj = getObj;
  function layerOf(id) { var f = find(id); return f ? f.layer : null; }
  function topOf(id) {
    var f = find(id); if (!f) return null;
    var res = null;
    f.layer.children.forEach(function (t) { if (t.id === id || containsId(t, id)) res = t; });
    return res;
  }
  SV.topOf = topOf;
  function containsId(o, id) {
    if (o.id === id) return true;
    if (o.type === 'group') for (var i = 0; i < o.children.length; i++) if (containsId(o.children[i], id)) return true;
    return false;
  }
  function getLayer(id) { for (var i = 0; i < S.doc.layers.length; i++) if (S.doc.layers[i].id === id) return S.doc.layers[i]; return null; }
  SV.getLayer = getLayer;
  function activeLayer() {
    var L = getLayer(S.activeLayer);
    if (!L) { L = S.doc.layers[S.doc.layers.length - 1]; S.activeLayer = L.id; }
    return L;
  }
  SV.activeLayer = activeLayer;
  function selObjs() { return S.sel.map(getObj).filter(Boolean); }
  SV.selObjs = selObjs;
  // z-order key for sorting: [layerIndex, path of indices]
  function zKey(id) {
    var f = find(id); if (!f) return [];
    var key = [S.doc.layers.indexOf(f.layer)];
    function rec(arr, path) {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === id) return path.concat(i);
        if (arr[i].type === 'group') { var r = rec(arr[i].children, path.concat(i)); if (r) return r; }
      }
      return null;
    }
    return key.concat(rec(f.layer.children, []) || []);
  }
  function zCompare(a, b) {
    var ka = zKey(a), kb = zKey(b);
    for (var i = 0; i < max(ka.length, kb.length); i++) { var x = ka[i] === undefined ? -1 : ka[i], y = kb[i] === undefined ? -1 : kb[i]; if (x !== y) return x - y; }
    return 0;
  }
  SV.zSorted = function (ids) { return ids.slice().sort(zCompare); };
  function isEditable(o) {
    var f = find(o.id); if (!f) return false;
    if (f.layer.locked || f.layer.hidden) return false;
    var cur = o; if (cur.locked || cur.hidden) return false;
    var p = f.parent; while (p) { if (p.locked || p.hidden) return false; var pf = find(p.id); p = pf && pf.parent; }
    return true;
  }
  SV.isEditable = isEditable;
  function leaves(o, out) {
    out = out || [];
    if (o.type === 'group') o.children.forEach(function (c) { if (!c.hidden) leaves(c, out); }); else out.push(o);
    return out;
  }
  SV.leaves = leaves;
  function reId(o) { o.id = uid(); if (o.type === 'group') o.children.forEach(reId); return o; }
  SV.reId = reId;

  /* ================= geometry of objects ================= */
  var mctx = document.createElement('canvas').getContext('2d');
  var textCache = new Map();
  function fontCSS(f, size) { return (f.style || 'normal') + ' ' + (f.weight || 400) + ' ' + (size || f.size) + 'px ' + SV.fontStack(f.family); }
  SV.fontCSS = fontCSS;
  function textLayout(o) {
    var f = o.font, sig = JSON.stringify([o.text, f, o.x, o.y]);
    var c = textCache.get(o.id);
    if (c && c.sig === sig) return c.lay;
    mctx.font = fontCSS(f);
    var lines = String(o.text).split('\n');
    var mm = mctx.measureText('Hgjy');
    var asc = mm.fontBoundingBoxAscent || f.size * 0.8, desc = mm.fontBoundingBoxDescent || f.size * 0.22;
    var L = f.size * (f.lh || 1.2), tr = (f.tracking || 0) / 1000 * f.size;
    var widths = lines.map(function (l) { return mctx.measureText(l).width + tr * l.length; });
    var W = max.apply(null, widths.concat([0]));
    var x0 = f.align === 'center' ? o.x - W / 2 : f.align === 'right' ? o.x - W : o.x;
    var lay = { lines: lines, widths: widths, asc: asc, desc: desc, L: L, tr: tr, W: W, box: { x: x0, y: o.y - asc, w: max(W, 1), h: (lines.length - 1) * L + asc + desc } };
    textCache.set(o.id, { sig: sig, lay: lay });
    return lay;
  }
  SV.textLayout = textLayout;
  SV.clearTextCache = function () { textCache.clear(); flatCache.clear(); };
  function localBox(o) {
    if (o.type === 'text') return textLayout(o).box;
    if (o.type === 'image' || o.type === 'rect') return { x: o.x, y: o.y, w: o.w, h: o.h };
    return G.subsBBox(localSubs(o));
  }
  SV.localBox = localBox;
  function localSubs(o) {
    switch (o.type) {
      case 'path': return o.subpaths;
      case 'rect': return G.rectSubs(o.x, o.y, o.w, o.h, o.rx);
      case 'ellipse': return G.ellipseSubs(o.cx, o.cy, o.rx, o.ry);
      case 'polygon': return G.polygonSubs(o.cx, o.cy, o.r, o.sides);
      case 'star': return G.starSubs(o.cx, o.cy, o.r1, o.r2, o.points);
      case 'text': case 'image':
        var b = localBox(o); return G.rectSubs(b.x, b.y, b.w, b.h, 0);
    }
    return [];
  }
  SV.localSubs = localSubs;
  function docSubs(o) {
    if (o.type === 'group') { var out = []; o.children.forEach(function (c) { if (!c.hidden) out = out.concat(docSubs(c)); }); return out; }
    return G.transformSubs(localSubs(o), o.m);
  }
  SV.docSubs = docSubs;
  function objBBox(o) {
    if (o.type === 'group') {
      var b = null; o.children.forEach(function (c) { if (!c.hidden) b = G.unionBox(b, objBBox(c)); }); return b;
    }
    if (o.type === 'text' || o.type === 'image') {
      var lb = localBox(o), pts = [G.ap(o.m, lb.x, lb.y), G.ap(o.m, lb.x + lb.w, lb.y), G.ap(o.m, lb.x + lb.w, lb.y + lb.h), G.ap(o.m, lb.x, lb.y + lb.h)];
      return G.boxOfPoints(pts);
    }
    return G.subsBBox(docSubs(o));
  }
  SV.objBBox = objBBox;
  function selBBox(ids) {
    var b = null; (ids || S.sel).forEach(function (id) { var o = getObj(id); if (o) b = G.unionBox(b, objBBox(o)); }); return b;
  }
  SV.selBBox = selBBox;
  var flatCache = new Map();
  function flatPolys(o) {
    var sig = JSON.stringify([o.type, o.subpaths, o.x, o.y, o.w, o.h, o.rx, o.cx, o.cy, o.r, o.r1, o.r2, o.sides, o.points, o.m, o.text, o.font]);
    var c = flatCache.get(o.id);
    if (c && c.sig === sig) return c.polys;
    var polys = G.flatten(docSubs(o), 0.7);
    flatCache.set(o.id, { sig: sig, polys: polys });
    return polys;
  }
  SV.flatPolys = flatPolys;
  SV.objRot = function (o) {
    if (o.type === 'path' || o.type === 'group') return o.rot || 0;
    var a = Math.atan2(o.m[1], o.m[0]) * 180 / PI; return Math.round(a * 100) / 100;
  };

  /* ================= transforms ================= */
  function scaleStroke(o, M) {
    if (!S.prefs.scaleStrokes || !o.style) return;
    o.style.sw = o.style.sw * Math.sqrt(abs(G.det(M)));
  }
  function toPath(o) {
    if (o.type === 'path' || o.type === 'group' || o.type === 'text' || o.type === 'image') return o;
    var subs = G.transformSubs(localSubs(o), o.m);
    ['x', 'y', 'w', 'h', 'rx', 'cx', 'cy', 'r', 'r1', 'r2', 'sides', 'points', 'ry'].forEach(function (k) { delete o[k]; });
    o.type = 'path'; o.subpaths = subs; o.m = G.I();
    return o;
  }
  SV.toPath = toPath;
  function transformObj(o, M) {
    var N, sx, sy, dotp;
    switch (o.type) {
      case 'group': o.children.forEach(function (c) { transformObj(c, M); }); break;
      case 'path':
        if (!G.isIdentity(o.m)) { o.subpaths = G.transformSubs(o.subpaths, o.m); o.m = G.I(); }
        o.subpaths = G.transformSubs(o.subpaths, M); scaleStroke(o, M); break;
      case 'rect': case 'ellipse': case 'image':
        N = G.mul(M, o.m); sx = Math.hypot(N[0], N[1]); sy = Math.hypot(N[2], N[3]); dotp = N[0] * N[2] + N[1] * N[3];
        if (sx > 1e-9 && sy > 1e-9 && abs(dotp) < 1e-6 * sx * sy) {
          if (o.type === 'ellipse') { o.cx *= sx; o.cy *= sy; o.rx *= sx; o.ry *= sy; }
          else { o.x *= sx; o.y *= sy; o.w *= sx; o.h *= sy; }
          o.m = [N[0] / sx, N[1] / sx, N[2] / sy, N[3] / sy, N[4], N[5]];
          if (o.type !== 'image') scaleStroke(o, M);
        } else if (o.type === 'image') { o.m = N; }
        else { toPath(o); transformObj(o, M); }
        break;
      case 'polygon': case 'star':
        N = G.mul(M, o.m); sx = Math.hypot(N[0], N[1]); sy = Math.hypot(N[2], N[3]); dotp = N[0] * N[2] + N[1] * N[3];
        if (sx > 1e-9 && abs(dotp) < 1e-6 * sx * sy && abs(sx - sy) < 1e-6 * sx) {
          o.cx *= sx; o.cy *= sx;
          if (o.type === 'polygon') o.r *= sx; else { o.r1 *= sx; o.r2 *= sx; }
          o.m = [N[0] / sx, N[1] / sx, N[2] / sy, N[3] / sy, N[4], N[5]];
          scaleStroke(o, M);
        } else { toPath(o); transformObj(o, M); }
        break;
      case 'text':
        o.m = G.mul(M, o.m); break;
    }
    // clean numeric noise in matrices; fold pure translations into the shape parameters
    if (o.m) o.m = o.m.map(function (v) { return abs(v) < 1e-12 ? 0 : v; });
    if (o.m && o.type !== 'group' && o.type !== 'path' && abs(o.m[0] - 1) < 1e-9 && abs(o.m[1]) < 1e-9 && abs(o.m[2]) < 1e-9 && abs(o.m[3] - 1) < 1e-9 && (o.m[4] || o.m[5])) {
      var tx = o.m[4], ty = o.m[5];
      if (o.type === 'ellipse' || o.type === 'polygon' || o.type === 'star') { o.cx += tx; o.cy += ty; }
      else { o.x += tx; o.y += ty; }
      o.m = [1, 0, 0, 1, 0, 0];
    }
  }
  SV.transformObj = transformObj;
  SV.transformIds = function (ids, M) { ids.forEach(function (id) { var o = getObj(id); if (o) transformObj(o, M); }); };

  /* ================= painting → SVG ================= */
  function paintStops(stops) {
    return stops.map(function (s) {
      return '<stop offset="' + fmt(s.o) + '" stop-color="' + s.c + '"' + (s.a != null && s.a < 1 ? ' stop-opacity="' + fmt(s.a) + '"' : '') + '/>';
    }).join('');
  }
  function gradSVG(p, id) {
    if (p.type === 'radial') {
      return '<radialGradient id="' + id + '" cx="' + fmt(p.cx) + '" cy="' + fmt(p.cy) + '" r="' + fmt(p.r) + '"' +
        (p.fx != null ? ' fx="' + fmt(p.fx) + '" fy="' + fmt(p.fy) + '"' : '') + '>' + paintStops(p.stops) + '</radialGradient>';
    }
    return '<linearGradient id="' + id + '" x1="' + fmt(p.x1) + '" y1="' + fmt(p.y1) + '" x2="' + fmt(p.x2) + '" y2="' + fmt(p.y2) + '">' + paintStops(p.stops) + '</linearGradient>';
  }
  SV.gradSVG = gradSVG;
  function paintRef(p, ctx, o, which) {
    if (!p) return 'none';
    if (typeof p === 'string') return p;
    var id = ctx.gradId(o, which);
    ctx.defs.push(gradSVG(p, id));
    return 'url(#' + id + ')';
  }
  function styleAttrs(o, ctx) {
    var st = o.style, a = '';
    if (ctx.outline) {
      if (o.type === 'text') return ' fill="#000"';
      return ' fill="none" stroke="#000" stroke-width="1" vector-effect="non-scaling-stroke"';
    }
    if (o.type !== 'image') {
      a += ' fill="' + paintRef(st.fill, ctx, o, 'f') + '"';
      if (st.fill && st.rule === 'evenodd') a += ' fill-rule="evenodd"';
      if (st.stroke && st.sw > 0) {
        a += ' stroke="' + paintRef(st.stroke, ctx, o, 's') + '" stroke-width="' + fmt(st.sw) + '"';
        if (st.cap && st.cap !== 'butt') a += ' stroke-linecap="' + st.cap + '"';
        if (st.join && st.join !== 'miter') a += ' stroke-linejoin="' + st.join + '"';
        if (st.join === 'miter' && st.miter && st.miter !== 4) a += ' stroke-miterlimit="' + fmt(st.miter) + '"';
        if (st.dash && st.dash.length) a += ' stroke-dasharray="' + st.dash.map(fmt).join(' ') + '"';
      }
    }
    return a;
  }
  function commonAttrs(o, ctx) {
    var st = o.style || {}, a = '';
    if (!G.isIdentity(o.m)) a += ' transform="matrix(' + o.m.map(fmt).join(' ') + ')"';
    if (!ctx.outline) {
      if (st.opacity != null && st.opacity < 1) a += ' opacity="' + fmt(st.opacity) + '"';
      if (st.blend && st.blend !== 'normal') a += ' style="mix-blend-mode:' + st.blend + '"';
    }
    if (ctx.hideId && ctx.hideId === o.id) a += ' visibility="hidden"';
    if (ctx.names && o.name) a += ' id="' + ctx.uniqueName(o.name) + '"';
    return a;
  }
  function objToSVG(o, ctx) {
    if (o.hidden && !ctx.keepHidden) return '';
    var c = commonAttrs(o, ctx), s, lb;
    switch (o.type) {
      case 'group':
        return '<g' + c + '>' + o.children.map(function (ch) { return objToSVG(ch, ctx); }).join('') + '</g>';
      case 'rect':
        s = styleAttrs(o, ctx);
        return '<rect x="' + fmt(o.x) + '" y="' + fmt(o.y) + '" width="' + fmt(o.w) + '" height="' + fmt(o.h) + '"' + (o.rx > 0 ? ' rx="' + fmt(min(o.rx, o.w / 2, o.h / 2)) + '"' : '') + s + c + '/>';
      case 'ellipse':
        s = styleAttrs(o, ctx);
        if (abs(o.rx - o.ry) < 1e-9) return '<circle cx="' + fmt(o.cx) + '" cy="' + fmt(o.cy) + '" r="' + fmt(o.rx) + '"' + s + c + '/>';
        return '<ellipse cx="' + fmt(o.cx) + '" cy="' + fmt(o.cy) + '" rx="' + fmt(o.rx) + '" ry="' + fmt(o.ry) + '"' + s + c + '/>';
      case 'polygon': case 'star':
        s = styleAttrs(o, ctx);
        return '<polygon points="' + localSubs(o)[0].pts.map(function (p) { return fmt(p.x) + ',' + fmt(p.y); }).join(' ') + '"' + s + c + '/>';
      case 'path':
        s = styleAttrs(o, ctx);
        return '<path d="' + G.toD(o.subpaths) + '"' + s + c + '/>';
      case 'text':
        s = styleAttrs(o, ctx);
        var f = o.font, lay = textLayout(o);
        var anchor = f.align === 'center' ? 'middle' : f.align === 'right' ? 'end' : 'start';
        var t = '<text x="' + fmt(o.x) + '" y="' + fmt(o.y) + '" font-family="' + esc(SV.fontStack(f.family)) + '" font-size="' + fmt(f.size) + '"' +
          (f.weight && f.weight != 400 ? ' font-weight="' + f.weight + '"' : '') + (f.style === 'italic' ? ' font-style="italic"' : '') +
          (anchor !== 'start' ? ' text-anchor="' + anchor + '"' : '') + (lay.tr ? ' letter-spacing="' + fmt(lay.tr) + '"' : '') +
          ' xml:space="preserve"' + s + c + '>';
        lay.lines.forEach(function (ln, i) { t += '<tspan x="' + fmt(o.x) + '" y="' + fmt(o.y + i * lay.L) + '">' + esc(ln) + '</tspan>'; });
        return t + '</text>';
      case 'image':
        if (ctx.outline) {
          lb = localBox(o);
          return '<path d="M' + fmt(o.x) + ' ' + fmt(o.y) + 'h' + fmt(o.w) + 'v' + fmt(o.h) + 'h' + fmt(-o.w) + 'zM' + fmt(o.x) + ' ' + fmt(o.y) + 'L' + fmt(o.x + o.w) + ' ' + fmt(o.y + o.h) + 'M' + fmt(o.x + o.w) + ' ' + fmt(o.y) + 'L' + fmt(o.x) + ' ' + fmt(o.y + o.h) + '" fill="none" stroke="#000" stroke-width="1" vector-effect="non-scaling-stroke"' + c + '/>';
        }
        var href = ctx.live && o.asset ? 'sv-asset:' + o.asset : ((S.doc.assets && S.doc.assets[o.asset]) || o.href || '');
        return '<image href="' + esc(href) + '" x="' + fmt(o.x) + '" y="' + fmt(o.y) + '" width="' + fmt(o.w) + '" height="' + fmt(o.h) + '" preserveAspectRatio="none"' + c + '/>';
    }
    return '';
  }
  SV.objToSVG = objToSVG;

  /* ================= DOM refs & view ================= */
  var D = SV.dom = {};
  function V() { return [S.view.zoom, 0, 0, S.view.zoom, S.view.x, S.view.y]; }
  SV.viewM = V;
  function toScreen(p) { return { x: p.x * S.view.zoom + S.view.x, y: p.y * S.view.zoom + S.view.y }; }
  function toDoc(sx, sy) { return { x: (sx - S.view.x) / S.view.zoom, y: (sy - S.view.y) / S.view.zoom }; }
  SV.toScreen = toScreen; SV.toDoc = toDoc;
  function stageRect() { return D.stage.getBoundingClientRect(); }
  function evDoc(e) { var r = stageRect(); return toDoc(e.clientX - r.left, e.clientY - r.top); }
  SV.evDoc = evDoc;

  SV.setZoom = function (z, cx, cy) {
    z = clamp(z, 0.02, 64);
    var r = stageRect();
    if (cx == null) { cx = r.width / 2; cy = r.height / 2; }
    var d = toDoc(cx, cy);
    S.view.zoom = z; S.view.x = cx - d.x * z; S.view.y = cy - d.y * z;
    SV.requestRender(true);
  };
  SV.zoomStep = function (dir, cx, cy) {
    var steps = [0.03125, 0.0625, 0.125, 0.1667, 0.25, 0.333, 0.5, 0.667, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 64];
    var z = S.view.zoom, nz = z;
    if (dir > 0) { for (var i = 0; i < steps.length; i++) if (steps[i] > z * 1.001) { nz = steps[i]; break; } }
    else { for (var j = steps.length - 1; j >= 0; j--) if (steps[j] < z / 1.001) { nz = steps[j]; break; } }
    SV.setZoom(nz, cx, cy);
  };
  SV.fitArtboard = function () {
    var r = stageRect(), pad = r.width < 500 ? 16 : 48;
    var z = min((r.width - pad * 2) / S.doc.width, (r.height - pad * 2) / S.doc.height);
    z = clamp(z, 0.02, 64);
    S.view.zoom = z; S.view.x = (r.width - S.doc.width * z) / 2; S.view.y = (r.height - S.doc.height * z) / 2;
    SV.requestRender(true);
  };
  SV.actualSize = function () { SV.setZoom(1); var r = stageRect(); S.view.x = (r.width - S.doc.width) / 2; S.view.y = (r.height - S.doc.height) / 2; SV.requestRender(true); };
  SV.zoomToRect = function (b) {
    var r = stageRect(); if (b.w < 1 || b.h < 1) return;
    var z = clamp(min(r.width / b.w, r.height / b.h) * 0.92, 0.02, 64);
    S.view.zoom = z; S.view.x = r.width / 2 - (b.x + b.w / 2) * z; S.view.y = r.height / 2 - (b.y + b.h / 2) * z;
    SV.requestRender(true);
  };

  /* ================= rendering ================= */
  var objEls = new Map(), layerEls = new Map(), rafPending = false, uiPending = false;
  SV.requestRender = function (ui) {
    if (ui) uiPending = true;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      renderDoc(); renderOverlay(); if (SV.drawRulers) SV.drawRulers();
      if (S.editing && SV.positionEditor) SV.positionEditor();
      if (uiPending) { uiPending = false; SV.ui && SV.ui.update(); }
    });
  };
  SV.renderNow = function () { renderDoc(); renderOverlay(); if (SV.drawRulers) SV.drawRulers(); if (SV.ui) SV.ui.update(); };
  var tmpSvg = null;
  function elFromString(str) {
    if (!tmpSvg) tmpSvg = document.createElementNS(SVGNS, 'svg');
    tmpSvg.innerHTML = str;
    var el = tmpSvg.firstElementChild;
    if (str.indexOf('sv-asset:') >= 0) {
      Array.prototype.forEach.call(el.querySelectorAll('image'), function (im) {
        var hr = im.getAttribute('href') || '';
        if (hr.indexOf('sv-asset:') === 0) im.setAttribute('href', (S.doc.assets && S.doc.assets[hr.slice(9)]) || '');
      });
    }
    return el;
  }
  function liveCtx(o) {
    return { defs: [], live: true, outline: S.prefs.outline, hideId: S.editing ? S.editing.id : null, gradId: function (ob, w) { return 'sv-' + ob.id + '-' + w; } };
  }
  function renderDoc() {
    var doc = S.doc, z = S.view.zoom;
    var tr = 'matrix(' + z + ' 0 0 ' + z + ' ' + S.view.x + ' ' + S.view.y + ')';
    D.vpBack.setAttribute('transform', tr);
    D.vpArt.setAttribute('transform', tr);
    D.artboard.setAttribute('width', doc.width); D.artboard.setAttribute('height', doc.height);
    D.artShadow.setAttribute('width', doc.width); D.artShadow.setAttribute('height', doc.height);
    D.artShadow.setAttribute('x', 3 / z); D.artShadow.setAttribute('y', 4 / z);
    D.docsvg.classList.toggle('outline', !!S.prefs.outline);
    renderGrid();
    var seenL = new Set(), prevL = null;
    doc.layers.forEach(function (L) {
      seenL.add(L.id);
      var g = layerEls.get(L.id);
      if (!g) { g = document.createElementNS(SVGNS, 'g'); g.setAttribute('data-layer', L.id); layerEls.set(L.id, g); }
      if (g.parentNode !== D.vpArt || g.previousSibling !== prevL) D.vpArt.insertBefore(g, prevL ? prevL.nextSibling : D.vpArt.firstChild);
      prevL = g;
      g.style.display = L.hidden ? 'none' : '';
      var prev = null;
      L.children.forEach(function (o) {
        var ctx = liveCtx(o), body = objToSVG(o, ctx);
        var sig = body + ctx.defs.join('');
        var c = objEls.get(o.id), el;
        if (c && c.sig === sig) el = c.el;
        else {
          el = elFromString('<g data-id="' + o.id + '">' + (ctx.defs.length ? '<defs>' + ctx.defs.join('') + '</defs>' : '') + body + '</g>');
          if (c && c.el.parentNode) c.el.parentNode.replaceChild(el, c.el);
          objEls.set(o.id, { sig: sig, el: el, seen: true });
        }
        objEls.get(o.id).seen = true;
        if (el.parentNode !== g || el.previousSibling !== prev) g.insertBefore(el, prev ? prev.nextSibling : g.firstChild);
        prev = el;
      });
      while (prev ? prev.nextSibling : g.firstChild) { var extra = prev ? prev.nextSibling : g.firstChild; g.removeChild(extra); }
    });
    layerEls.forEach(function (g, id) { if (!seenL.has(id)) { if (g.parentNode) g.parentNode.removeChild(g); layerEls.delete(id); } });
    objEls.forEach(function (c, id) { if (!c.seen) { if (c.el.parentNode) c.el.parentNode.removeChild(c.el); objEls.delete(id); } c.seen = false; });
  }
  SV.renderDoc = renderDoc;
  SV.resetRenderCache = function () { objEls.forEach(function (c) { if (c.el.parentNode) c.el.parentNode.removeChild(c.el); }); objEls.clear(); };

  function renderGrid() {
    if (!S.prefs.grid) { D.grid.innerHTML = ''; return; }
    var r = stageRect(), z = S.view.zoom, gs = S.prefs.gridSize, major = gs * 10;
    var step = gs * z < 6 ? major : gs;
    if (step * z < 6) { D.grid.innerHTML = ''; return; }
    var d0 = toDoc(0, 0), d1 = toDoc(r.width, r.height), minor = '', maj = '';
    var x = Math.floor(d0.x / step) * step, y;
    for (; x <= d1.x; x += step) { var sx = round(x * z + S.view.x) + 0.5; var isM = abs(x / major - round(x / major)) < 1e-6; (isM ? (maj += 'M' + sx + ' 0V' + r.height) : (minor += 'M' + sx + ' 0V' + r.height)); }
    for (y = Math.floor(d0.y / step) * step; y <= d1.y; y += step) { var sy = round(y * z + S.view.y) + 0.5; var isMy = abs(y / major - round(y / major)) < 1e-6; (isMy ? (maj += 'M0 ' + sy + 'H' + r.width) : (minor += 'M0 ' + sy + 'H' + r.width)); }
    D.grid.innerHTML = '<path d="' + minor + '" class="grid-minor"/><path d="' + maj + '" class="grid-major"/>';
  }

  /* ================= overlay (selection UI) ================= */
  function scr(p) { return toScreen(p); }
  function selColorOf(id) { var L = layerOf(id); return L ? L.color : LAYER_COLORS[0]; }
  SV.HANDLE_NAMES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  function handlePositions(b) {
    var x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
    return { nw: [x0, y0], n: [xm, y0], ne: [x1, y0], e: [x1, ym], se: [x1, y1], s: [xm, y1], sw: [x0, y1], w: [x0, ym] };
  }
  SV.handlePositions = handlePositions;
  function screenBox(b) { var a = scr({ x: b.x, y: b.y }); return { x: a.x, y: a.y, w: b.w * S.view.zoom, h: b.h * S.view.zoom }; }
  SV.screenBox = screenBox;
  function outlineD(o) {
    if (o.type === 'group') return o.children.filter(function (c) { return !c.hidden; }).map(outlineD).join('');
    return G.toD(docSubs(o), V());
  }
  SV.outlineD = outlineD;
  function renderOverlay() {
    if (!D.overlay) return;
    var out = [], r = stageRect(), z = S.view.zoom, tool = S.tool;
    // guides
    if (S.prefs.guides) {
      S.doc.guides.v.forEach(function (gx) { var x = round(gx * z + S.view.x) + 0.5; out.push('<line class="guide" x1="' + x + '" y1="0" x2="' + x + '" y2="' + r.height + '"/>'); });
      S.doc.guides.h.forEach(function (gy) { var y = round(gy * z + S.view.y) + 0.5; out.push('<line class="guide" x1="0" y1="' + y + '" x2="' + r.width + '" y2="' + y + '"/>'); });
    }
    if (S.guideDrag) {
      var gd = S.guideDrag;
      if (gd.axis === 'v') { var gx2 = round(gd.pos * z + S.view.x) + 0.5; out.push('<line class="guide active" x1="' + gx2 + '" y1="0" x2="' + gx2 + '" y2="' + r.height + '"/>'); }
      else { var gy2 = round(gd.pos * z + S.view.y) + 0.5; out.push('<line class="guide active" x1="0" y1="' + gy2 + '" x2="' + r.width + '" y2="' + gy2 + '"/>'); }
    }
    // hover highlight
    if (S.hover && S.sel.indexOf(S.hover) < 0 && !S.op) {
      var ho = getObj(S.hover);
      if (ho) out.push('<path class="hover" d="' + outlineD(ho) + '" stroke="' + selColorOf(ho.id) + '"/>');
    }
    var direct = tool === 'direct' || tool === 'addAnchor' || tool === 'deleteAnchor' || tool === 'convertAnchor' || tool === 'pen' || tool === 'scissors';
    var objs = selObjs();
    if (!S.editing) {
      objs.forEach(function (o) {
        var col = selColorOf(o.id);
        if (o.type === 'text' || o.type === 'image') {
          var lb = localBox(o), M = G.mul(V(), o.m);
          var pts = [[lb.x, lb.y], [lb.x + lb.w, lb.y], [lb.x + lb.w, lb.y + lb.h], [lb.x, lb.y + lb.h]].map(function (p) { var q = G.ap(M, p[0], p[1]); return fmt(q.x) + ',' + fmt(q.y); });
          out.push('<polygon class="selo" points="' + pts.join(' ') + '" stroke="' + col + '"/>');
          if (o.type === 'text') { var a = G.ap(M, lb.x, o.y), bpt = G.ap(M, lb.x + lb.w, o.y); out.push('<line class="selo" x1="' + fmt(a.x) + '" y1="' + fmt(a.y) + '" x2="' + fmt(bpt.x) + '" y2="' + fmt(bpt.y) + '" stroke="' + col + '"/>'); }
        } else {
          out.push('<path class="selo" d="' + outlineD(o) + '" stroke="' + col + '"/>');
        }
        if (direct) out.push(anchorsSVG(o, col));
      });
      // bounding box
      if ((tool === 'select' || tool === 'rotate' || tool === 'scale') && objs.length && !S.pen) {
        var b = selBBox();
        if (b) {
          var sb = screenBox(b), col = selColorOf(objs[0].id);
          out.push('<rect class="bbox" x="' + fmt(sb.x) + '" y="' + fmt(sb.y) + '" width="' + fmt(sb.w) + '" height="' + fmt(sb.h) + '" stroke="' + col + '"/>');
          if (tool === 'select' && (b.w * z > 6 || b.h * z > 6)) {
            var hp = handlePositions(sb);
            SV.HANDLE_NAMES.forEach(function (n) { out.push('<rect class="handle" x="' + fmt(hp[n][0] - 3.5) + '" y="' + fmt(hp[n][1] - 3.5) + '" width="7" height="7" stroke="' + col + '"/>'); });
          }
          if ((tool === 'rotate' || tool === 'scale')) {
            var org = S.origin || { x: b.x + b.w / 2, y: b.y + b.h / 2 }, so = scr(org);
            out.push('<g class="origin" transform="translate(' + fmt(so.x) + ' ' + fmt(so.y) + ')"><circle r="5"/><path d="M-9 0H9M0 -9V9"/></g>');
          }
        }
      }
    }
    // pen in progress
    if (S.pen && tool === 'pen') {
      var po = getObj(S.pen.id);
      if (po && S.pen.cursor && !S.op) {
        var sp = po.subpaths[S.pen.sub], last = sp.pts[sp.pts.length - 1], c = S.pen.cursor;
        var p0 = scr(last), p1 = scr({ x: last.ox, y: last.oy }), p3 = scr(c);
        out.push('<path class="rubber" d="M' + fmt(p0.x) + ' ' + fmt(p0.y) + 'C' + fmt(p1.x) + ' ' + fmt(p1.y) + ' ' + fmt(p3.x) + ' ' + fmt(p3.y) + ' ' + fmt(p3.x) + ' ' + fmt(p3.y) + '"/>');
      }
    }
    // pencil preview
    if (S.op && S.op.kind === 'pencil' && S.op.pts.length > 1) {
      out.push('<path class="pencil" d="M' + S.op.pts.map(function (p) { var q = scr(p); return fmt(q.x) + ' ' + fmt(q.y); }).join('L') + '"/>');
    }
    // gradient annotator
    if (tool === 'gradient' && objs.length === 1 && objs[0].style && objs[0].style.fill && typeof objs[0].style.fill === 'object') {
      var go = objs[0], gp = go.style.fill, gb = localBox(go.type === 'group' ? go : go), GM = G.mul(V(), go.type === 'path' ? G.I() : go.m);
      if (go.type === 'path') gb = G.subsBBox(go.subpaths);
      if (gb) {
        var gs1, gs2;
        if (gp.type === 'radial') { gs1 = [gp.cx, gp.cy]; gs2 = [gp.cx + gp.r, gp.cy]; } else { gs1 = [gp.x1, gp.y1]; gs2 = [gp.x2, gp.y2]; }
        var A1 = G.ap(GM, gb.x + gs1[0] * gb.w, gb.y + gs1[1] * gb.h), A2 = G.ap(GM, gb.x + gs2[0] * gb.w, gb.y + gs2[1] * gb.h);
        out.push('<line class="gradline" x1="' + fmt(A1.x) + '" y1="' + fmt(A1.y) + '" x2="' + fmt(A2.x) + '" y2="' + fmt(A2.y) + '"/><circle class="gradend" cx="' + fmt(A1.x) + '" cy="' + fmt(A1.y) + '" r="5"/><rect class="gradend" x="' + fmt(A2.x - 4) + '" y="' + fmt(A2.y - 4) + '" width="8" height="8"/>');
      }
    }
    // marquee
    if (S.marquee) {
      var mq = S.marquee, m0 = scr({ x: mq.x, y: mq.y });
      out.push('<rect class="marquee' + (S.marquee.zoom ? ' zoom' : '') + '" x="' + fmt(m0.x) + '" y="' + fmt(m0.y) + '" width="' + fmt(mq.w * z) + '" height="' + fmt(mq.h * z) + '"/>');
    }
    // smart guides
    S.snapLines.forEach(function (l) {
      var a = scr({ x: l[0], y: l[1] }), bq = scr({ x: l[2], y: l[3] });
      out.push('<line class="smart" x1="' + fmt(a.x) + '" y1="' + fmt(a.y) + '" x2="' + fmt(bq.x) + '" y2="' + fmt(bq.y) + '"/>');
    });
    // readout
    if (S.readout) {
      var ro = S.readout, lines = ro.text.split('\n'), w = max.apply(null, lines.map(function (l) { return l.length; })) * 6.4 + 14, h = lines.length * 14 + 8;
      var rx = min(ro.x + 16, r.width - w - 4), ry = min(ro.y + 18, r.height - h - 4);
      out.push('<g class="readout" transform="translate(' + fmt(rx) + ' ' + fmt(ry) + ')"><rect width="' + fmt(w) + '" height="' + h + '" rx="3"/>' + lines.map(function (l, i) { return '<text x="7" y="' + (15 + i * 14) + '">' + esc(l) + '</text>'; }).join('') + '</g>');
    }
    D.overlay.innerHTML = out.join('');
  }
  SV.renderOverlay = renderOverlay;
  function anchorsSVG(o, col) {
    if (o.type === 'group') return o.children.map(function (c) { return anchorsSVG(c, col); }).join('');
    if (o.type === 'text' || o.type === 'image') return '';
    var subs = docSubs(o), selp = S.psel[o.id] || [], out = '';
    subs.forEach(function (sp, si) {
      var n = sp.pts.length;
      sp.pts.forEach(function (a, i) {
        var isSel = selp.indexOf(si + ':' + i) >= 0;
        var prevSel = selp.indexOf(si + ':' + ((i - 1 + n) % n)) >= 0 && (sp.closed || i > 0);
        var nextSel = selp.indexOf(si + ':' + ((i + 1) % n)) >= 0 && (sp.closed || i < n - 1);
        var s = scr(a);
        if (o.type === 'path' && (isSel || prevSel || nextSel || (S.pen && S.pen.id === o.id))) {
          if (G.hasIn(a) && (isSel || prevSel || (S.pen && S.pen.id === o.id))) { var hi = scr({ x: a.ix, y: a.iy }); out += '<line class="hline" x1="' + fmt(s.x) + '" y1="' + fmt(s.y) + '" x2="' + fmt(hi.x) + '" y2="' + fmt(hi.y) + '" stroke="' + col + '"/><circle class="hdot" cx="' + fmt(hi.x) + '" cy="' + fmt(hi.y) + '" r="3" stroke="' + col + '"/>'; }
          if (G.hasOut(a) && (isSel || nextSel || (S.pen && S.pen.id === o.id))) { var ho = scr({ x: a.ox, y: a.oy }); out += '<line class="hline" x1="' + fmt(s.x) + '" y1="' + fmt(s.y) + '" x2="' + fmt(ho.x) + '" y2="' + fmt(ho.y) + '" stroke="' + col + '"/><circle class="hdot" cx="' + fmt(ho.x) + '" cy="' + fmt(ho.y) + '" r="3" stroke="' + col + '"/>'; }
        }
        out += '<rect class="anchor' + (isSel ? ' sel' : '') + '" x="' + fmt(s.x - 3) + '" y="' + fmt(s.y - 3) + '" width="6" height="6" stroke="' + col + '"' + (isSel ? ' fill="' + col + '"' : '') + '/>';
      });
    });
    return out;
  }

  /* ================= history ================= */
  function snapshot() {
    return JSON.stringify({ doc: S.doc, sel: S.sel, layer: S.activeLayer }, function (k, v) { return k === 'assets' ? undefined : v; });
  }
  SV.snapshot = snapshot;
  SV.commit = function (label) {
    var snap = snapshot();
    if (S.history[S.hIdx] === snap) { SV.requestRender(true); return false; }
    var now = Date.now();
    if (label && label === S.lastLabel && label === 'nudge' && now - S.lastTime < 900 && S.hIdx > 0 && S.hIdx !== S.savedIdx) {
      S.history[S.hIdx] = snap;
    } else {
      S.history.length = S.hIdx + 1;
      S.history.push(snap);
      if (S.history.length > 200) { S.history.shift(); S.savedIdx--; }
      S.hIdx = S.history.length - 1;
    }
    S.lastLabel = label || ''; S.lastTime = now;
    SV.scheduleAutosave();
    SV.requestRender(true);
    return true;
  };
  function restore(snap) {
    var o = JSON.parse(snap), assets = S.doc.assets || {};
    S.doc = o.doc; S.doc.assets = assets;
    S.sel = (o.sel || []).filter(function (id) { return !!getObj(id); });
    S.psel = {};
    S.activeLayer = o.layer;
    S.pen = null; S.op = null; S.hover = null;
    SV.clearTextCache();
    SV.requestRender(true);
  }
  SV.undo = function () {
    if (S.editing) return;
    if (S.pen) SV.finishPen();
    if (S.hIdx <= 0) return SV.toast('Nothing to undo');
    S.hIdx--; restore(S.history[S.hIdx]); SV.scheduleAutosave();
  };
  SV.redo = function () {
    if (S.editing) return;
    if (S.hIdx >= S.history.length - 1) return SV.toast('Nothing to redo');
    S.hIdx++; restore(S.history[S.hIdx]); SV.scheduleAutosave();
  };
  SV.revert = function () { if (S.hIdx >= 0) restore(S.history[S.hIdx]); };
  SV.resetHistory = function () { S.history = [snapshot()]; S.hIdx = 0; S.savedIdx = 0; };
  SV.isDirty = function () { return S.hIdx !== S.savedIdx; };
  SV.markSaved = function () { S.savedIdx = S.hIdx; SV.requestRender(true); };

  /* ================= autosave ================= */
  var AUTOSAVE_KEY = 'slopvector.autosave.v1', autosaveTimer = null, quotaWarned = false;
  SV.scheduleAutosave = function () {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(SV.autosaveNow, 700);
  };
  SV.autosaveNow = function () {
    var payload;
    try { payload = JSON.stringify({ savedAt: Date.now(), doc: S.doc, fileName: S.fileName }); } catch (e) { return; }
    var r = lsSet(AUTOSAVE_KEY, payload);
    if (r !== true) {
      // retry without raster assets
      var lite;
      try { lite = JSON.stringify({ savedAt: Date.now(), doc: Object.assign({}, S.doc, { assets: {} }), fileName: S.fileName, lite: true }); } catch (e2) { return; }
      var r2 = lsSet(AUTOSAVE_KEY, lite);
      if (!quotaWarned) { quotaWarned = true; SV.toast(r2 === true ? 'Autosave: images too large for browser storage — saved without them' : 'Autosave unavailable (browser storage full or blocked)', 'warn'); }
    }
  };
  SV.clearAutosave = function () { clearTimeout(autosaveTimer); lsDel(AUTOSAVE_KEY); };
  SV.loadAutosave = function () {
    var raw = lsGet(AUTOSAVE_KEY); if (!raw) return null;
    try { var o = JSON.parse(raw); if (o && o.doc && o.doc.layers) return o; } catch (e) { /* ignore */ }
    return null;
  };

  /* ================= document load ================= */
  SV.loadDoc = function (doc, opts) {
    opts = opts || {};
    if (!doc.guides) doc.guides = { h: [], v: [] };
    if (!doc.assets) doc.assets = {};
    if (!doc.layers || !doc.layers.length) doc.layers = [mk.layer('Layer 1')];
    S.doc = doc; S.sel = []; S.psel = {}; S.pen = null; S.op = null; S.editing = null;
    S.activeLayer = doc.layers[doc.layers.length - 1].id;
    SV.clearTextCache(); SV.resetRenderCache();
    if (opts.resetHistory) SV.resetHistory();
    if (opts.fit !== false) SV.fitArtboard();
    SV.requestRender(true);
  };

  /* ================= selection helpers ================= */
  SV.select = function (ids, opts) {
    S.sel = ids.filter(function (id, i) { return ids.indexOf(id) === i && getObj(id); });
    if (!opts || !opts.keepPoints) S.psel = {};
    if (S.sel.length) { var L = layerOf(S.sel[S.sel.length - 1]); if (L) S.activeLayer = L.id; }
    SV.requestRender(true);
  };
  SV.selectAll = function () {
    if (S.tool === 'type' && S.editing) return;
    var ids = [];
    S.doc.layers.forEach(function (L) { if (L.hidden || L.locked) return; L.children.forEach(function (o) { if (!o.hidden && !o.locked) ids.push(o.id); }); });
    if (S.tool === 'direct') {
      S.psel = {};
      ids.forEach(function (id) { var o = getObj(id); leaves(o).forEach(function (l) { selectAllPoints(l); }); });
    }
    SV.select(ids, { keepPoints: S.tool === 'direct' });
  };
  function selectAllPoints(o) {
    if (o.type === 'text' || o.type === 'image' || o.type === 'group') return;
    var keys = []; localSubs(o).forEach(function (sp, si) { sp.pts.forEach(function (a, i) { keys.push(si + ':' + i); }); });
    S.psel[o.id] = keys;
  }
  SV.selectAllPoints = selectAllPoints;
  SV.deselect = function () { if (S.pen) SV.finishPen(); SV.select([]); };

  /* ================= hit testing ================= */
  function hitObj(o, p, tol) {
    if (o.hidden || o.locked) return null;
    if (o.type === 'group') {
      for (var i = o.children.length - 1; i >= 0; i--) { var r = hitObj(o.children[i], p, tol); if (r) return r; }
      return null;
    }
    if (o.type === 'text' || o.type === 'image') {
      var q = G.ap(G.inv(o.m), p.x, p.y), b = localBox(o), t2 = tol / Math.sqrt(abs(G.det(o.m)) || 1);
      return (q.x >= b.x - t2 && q.x <= b.x + b.w + t2 && q.y >= b.y - t2 && q.y <= b.y + b.h + t2) ? o : null;
    }
    var bb = objBBox(o), sw = (o.style.stroke && !S.prefs.outline) ? o.style.sw / 2 : 0, pad = max(sw, tol);
    if (!bb || p.x < bb.x - pad || p.x > bb.x + bb.w + pad || p.y < bb.y - pad || p.y > bb.y + bb.h + pad) return null;
    var polys = flatPolys(o);
    if (o.style.fill && !S.prefs.outline && G.pointInPolys(polys, p, o.style.rule)) return o;
    if (G.distToPolys(polys, p) <= pad) return o;
    return null;
  }
  SV.hitTest = function (p, opts) {
    opts = opts || {};
    var tol = (opts.tol || 4) / S.view.zoom, layers = S.doc.layers;
    for (var li = layers.length - 1; li >= 0; li--) {
      var L = layers[li]; if (L.hidden || L.locked) continue;
      for (var i = L.children.length - 1; i >= 0; i--) {
        var o = L.children[i];
        if (opts.skip && opts.skip.indexOf(o.id) >= 0) continue;
        var leaf = hitObj(o, p, tol);
        if (leaf) return { obj: leaf, top: o, layer: L };
      }
    }
    return null;
  };
  // anchor / handle hit on given objects (doc coords) → {o, si, i, part:'a'|'in'|'out'}
  SV.hitAnchor = function (objs, p, handlesToo) {
    var tol = 6 / S.view.zoom, best = null;
    objs.forEach(function (o) {
      leaves(o).forEach(function (l) {
        if (l.type === 'text' || l.type === 'image' || !isEditable(l)) return;
        var subs = docSubs(l), selp = S.psel[l.id] || [];
        subs.forEach(function (sp, si) {
          var n = sp.pts.length;
          sp.pts.forEach(function (a, i) {
            var cands = [['a', a.x, a.y]];
            if (handlesToo && l.type === 'path') {
              var isSel = selp.indexOf(si + ':' + i) >= 0, prevSel = selp.indexOf(si + ':' + ((i - 1 + n) % n)) >= 0, nextSel = selp.indexOf(si + ':' + ((i + 1) % n)) >= 0;
              var penMode = S.pen && S.pen.id === l.id;
              if (G.hasIn(a) && (isSel || prevSel || penMode)) cands.push(['in', a.ix, a.iy]);
              if (G.hasOut(a) && (isSel || nextSel || penMode)) cands.push(['out', a.ox, a.oy]);
            }
            cands.forEach(function (c) {
              var d = Math.hypot(c[1] - p.x, c[2] - p.y);
              if (d <= tol && (!best || d < best.d - 1e-9 || (c[0] !== 'a' && best.part === 'a' && d <= best.d + 1e-9))) best = { o: l, si: si, i: i, part: c[0], d: d };
            });
          });
        });
      });
    });
    return best;
  };
  SV.hitSegment = function (objs, p) {
    var tol = 5 / S.view.zoom, best = null;
    objs.forEach(function (o) {
      leaves(o).forEach(function (l) {
        if (l.type === 'text' || l.type === 'image' || !isEditable(l)) return;
        docSubs(l).forEach(function (sp, si) {
          var r = G.nearestOnSub(sp, p);
          if (r && r.d <= tol && (!best || r.d < best.d)) best = { o: l, si: si, i: r.i, t: r.t, d: r.d, p: r.p };
        });
      });
    });
    return best;
  };

  /* ================= snapping ================= */
  SV.buildSnap = function (excludeIds) {
    var xs = [], ys = [], ex = new Set();
    (excludeIds || []).forEach(function (id) { var o = getObj(id); if (o) { ex.add(id); leaves(o).forEach(function (l) { ex.add(l.id); }); } });
    var W = S.doc.width, H = S.doc.height;
    if (S.prefs.smart) {
      [0, W / 2, W].forEach(function (x) { xs.push({ v: x, a: 0, b: H }); });
      [0, H / 2, H].forEach(function (y) { ys.push({ v: y, a: 0, b: W }); });
      S.doc.layers.forEach(function (L) {
        if (L.hidden) return;
        L.children.forEach(function (o) {
          if (o.hidden || ex.has(o.id)) return;
          var b = objBBox(o); if (!b) return;
          [b.x, b.x + b.w / 2, b.x + b.w].forEach(function (x) { xs.push({ v: x, a: b.y, b: b.y + b.h }); });
          [b.y, b.y + b.h / 2, b.y + b.h].forEach(function (y) { ys.push({ v: y, a: b.x, b: b.x + b.w }); });
        });
      });
    }
    if (S.prefs.guides) {
      S.doc.guides.v.forEach(function (x) { xs.push({ v: x, a: -1e5, b: 1e5, guide: true }); });
      S.doc.guides.h.forEach(function (y) { ys.push({ v: y, a: -1e5, b: 1e5, guide: true }); });
    }
    return { xs: xs, ys: ys };
  };
  function nearest(list, vals, th) {
    var best = null;
    vals.forEach(function (v, k) { list.forEach(function (c) { var d = c.v - v; if (abs(d) <= th && (!best || abs(d) < abs(best.d))) best = { d: d, c: c, k: k }; }); });
    return best;
  }
  // snap a box moving by (dx,dy) → adjusted {dx,dy}; records smart lines
  SV.snapBox = function (snap, b, dx, dy) {
    S.snapLines = [];
    var th = 6 / S.view.zoom;
    if (S.prefs.snapGrid) {
      var gs = S.prefs.gridSize;
      dx = round((b.x + dx) / gs) * gs - b.x; dy = round((b.y + dy) / gs) * gs - b.y;
      return { dx: dx, dy: dy };
    }
    if (!snap) return { dx: dx, dy: dy };
    var nx = nearest(snap.xs, [b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx], th);
    var ny = nearest(snap.ys, [b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy], th);
    if (nx) dx += nx.d; if (ny) dy += ny.d;
    if (nx) { var x = nx.c.v; S.snapLines.push([x, min(nx.c.a, b.y + dy) - 8 / S.view.zoom, x, max(nx.c.b, b.y + b.h + dy) + 8 / S.view.zoom]); }
    if (ny) { var y = ny.c.v; S.snapLines.push([min(ny.c.a, b.x + dx) - 8 / S.view.zoom, y, max(ny.c.b, b.x + b.w + dx) + 8 / S.view.zoom, y]); }
    return { dx: dx, dy: dy };
  };
  SV.snapPoint = function (snap, p) {
    S.snapLines = [];
    if (S.prefs.snapGrid) { var gs = S.prefs.gridSize; return { x: round(p.x / gs) * gs, y: round(p.y / gs) * gs }; }
    if (!snap) return p;
    var th = 6 / S.view.zoom, q = { x: p.x, y: p.y };
    var nx = nearest(snap.xs, [p.x], th), ny = nearest(snap.ys, [p.y], th);
    if (nx) { q.x += nx.d; S.snapLines.push([q.x, min(nx.c.a, p.y), q.x, max(nx.c.b, p.y)]); }
    if (ny) { q.y += ny.d; S.snapLines.push([min(ny.c.a, p.x), q.y, max(ny.c.b, p.x), q.y]); }
    return q;
  };
  function constrain45(p0, p) {
    var dx = p.x - p0.x, dy = p.y - p0.y, a = Math.atan2(dy, dx), step = PI / 4, sa = round(a / step) * step, l = Math.hypot(dx, dy);
    var c = Math.cos(sa), s = Math.sin(sa), proj = dx * c + dy * s;
    return { x: p0.x + c * proj, y: p0.y + s * proj, ang: sa, len: l };
  }
  SV.constrain45 = constrain45;

  /* ================= misc doc ops used by tools ================= */
  SV.insertObj = function (o, layer, opts) {
    layer = layer || activeLayer();
    if (layer.locked || layer.hidden) { SV.toast('Layer “' + layer.name + '” is ' + (layer.locked ? 'locked' : 'hidden') + ' — unlock it or pick another layer', 'warn'); return false; }
    if (opts && opts.index != null) layer.children.splice(opts.index, 0, o); else layer.children.push(o);
    return true;
  };
  SV.removeObj = function (id) {
    var f = find(id); if (!f) return;
    f.arr.splice(f.idx, 1);
    // drop empty groups
    var p = f.parent;
    while (p && p.children.length === 0) { var pf = find(p.id); if (!pf) break; pf.arr.splice(pf.idx, 1); p = pf.parent; }
  };
  SV.replaceObj = function (id, o) { var f = find(id); if (f) f.arr[f.idx] = o; };
  SV.canDraw = function () {
    var L = activeLayer();
    if (L.locked || L.hidden) { SV.toast('Layer “' + L.name + '” is ' + (L.locked ? 'locked' : 'hidden') + ' — unlock it or pick another layer', 'warn'); return false; }
    return true;
  };
  SV.newStyle = function (kind) {
    var st = clone(S.style);
    if (kind === 'line' || kind === 'pencil') { st.fill = null; if (!st.stroke) st.stroke = '#0a0a0a'; }
    if (kind === 'brush') { st.fill = null; if (!st.stroke) st.stroke = '#0a0a0a'; st.sw = S.brush.size; st.cap = 'round'; st.join = 'round'; }
    if (kind === 'text') { var f = st.fill; st.fill = (typeof f === 'string' && f.toLowerCase() !== '#ffffff') ? f : '#0a0a0a'; st.stroke = null; st.dash = null; }
    return st;
  };
  SV.toast = function (msg, kind) { if (SV.ui && SV.ui.toast) SV.ui.toast(msg, kind); };
})();
