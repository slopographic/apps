/* Slop Vector — ui: paint swatches and the colour picker */
(function () {
  'use strict';
  var G = window.SVGeom, SV = window.SV, S = SV.state, D = SV.dom, IO = SV.io, C = SV.cmd;
  var clone = SV.clone, getObj = SV.getObj, esc = SV.esc, fmt = G.fmt;
  var abs = Math.abs, min = Math.min, max = Math.max, round = Math.round, PI = Math.PI;
  var UI = SV.ui = SV.ui || {}; UI.st = UI.st || {};
  var IS_MAC = SV.IS_MAC;
  var $ = UI._p = UI._p || {};
  function btn() { return $.btn.apply(this, arguments); }
  function dialog() { return $.dialog.apply(this, arguments); }
  function h() { return $.h.apply(this, arguments); }
  function row() { return $.row.apply(this, arguments); }
  function showPanel() { return $.showPanel.apply(this, arguments); }
  function swatches() { return $.swatches.apply(this, arguments); }

  /* ================= paint helpers ================= */
  function gradCSS(g) {
    var stops = g.stops.slice().sort(function (a, b) { return a.o - b.o; }).map(function (s) { return rgba(s.c, s.a == null ? 1 : s.a) + ' ' + round(s.o * 100) + '%'; }).join(', ');
    if (g.type === 'radial') return 'radial-gradient(circle at ' + round((g.fx != null ? g.fx : g.cx) * 100) + '% ' + round((g.fy != null ? g.fy : g.cy) * 100) + '%, ' + stops + ')';
    var ang = Math.atan2((g.y2 - g.y1), (g.x2 - g.x1)) * 180 / PI + 90;
    return 'linear-gradient(' + round(ang) + 'deg, ' + stops + ')';
  }
  UI.gradCSS = gradCSS;
  function rgba(hex, a) { var c = hexToRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function paintBG(el, p) {
    el.classList.toggle('none', !p);
    el.style.background = !p ? '' : typeof p === 'string' ? p : gradCSS(p);
  }
  UI.paintBG = paintBG;
  function paintLabel(p) { if (!p) return 'None'; if (typeof p === 'string') return p.toUpperCase(); return (p.type === 'radial' ? 'Radial' : 'Linear') + ' gradient'; }

  /* ================= colour conversions & picker ================= */
  function hexToRgb(hex) {
    hex = String(hex || '#000').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex.slice(0, 6), 16); if (isNaN(n)) n = 0;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function rgbToHex(r, g, b) { return '#' + [r, g, b].map(function (v) { return ('0' + SV.clamp(round(v), 0, 255).toString(16)).slice(-2); }).join(''); }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = max(r, g, b), mn = min(r, g, b), d = mx - mn, hh = 0;
    if (d) { if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; hh *= 60; if (hh < 0) hh += 360; }
    return [hh, mx ? d / mx : 0, mx];
  }
  function hsvToRgb(hh, s, v) {
    var c = v * s, x = c * (1 - abs((hh / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (hh < 60) { r = c; g = x; } else if (hh < 120) { r = x; g = c; } else if (hh < 180) { g = c; b = x; } else if (hh < 240) { g = x; b = c; } else if (hh < 300) { r = x; b = c; } else { r = c; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }
  UI.hexToRgb = hexToRgb; UI.rgbToHex = rgbToHex;
  UI.st.picker = null;
  var recent = [];
  try { recent = JSON.parse(SV.lsGet('slopvector.recentColors') || '[]') || []; } catch (e) { recent = []; }
  UI.closePicker = function (cancel) {
    if (!UI.st.picker) return false;
    var p = UI.st.picker; UI.st.picker = null;
    p.el.remove();
    document.removeEventListener('pointerdown', p.outside, true);
    if (!cancel && p.changed && p.hex) {
      recent = [p.hex].concat(recent.filter(function (c) { return c !== p.hex; })).slice(0, 12);
      SV.lsSet('slopvector.recentColors', JSON.stringify(recent));
    }
    if (p.onDone) p.onDone(cancel ? undefined : p.value, p.changed);
    return true;
  };
  // opts: {allowNone, title}
  UI.pickColor = function (anchor, initial, onInput, onDone, opts) {
    UI.closePicker();
    opts = opts || {};
    var hex = typeof initial === 'string' ? initial : (initial && initial.stops ? initial.stops[0].c : '#d4ff3a');
    var hsv = rgbToHsv.apply(null, hexToRgb(hex));
    var el = h('div', { class: 'picker', role: 'dialog', 'aria-label': opts.title || 'Color picker' });
    var head = h('div', { class: 'picker-head' }, [h('span', { text: opts.title || 'Color' }), h('button', { class: 'xbtn', type: 'button', 'aria-label': 'Close', html: '&times;', onclick: function () { UI.closePicker(); } })]);
    var sv = h('div', { class: 'pk-sv' }), svDot = h('div', { class: 'pk-dot' }); sv.appendChild(svDot);
    var hue = h('div', { class: 'pk-hue' }), hueDot = h('div', { class: 'pk-hdot' }); hue.appendChild(hueDot);
    var prev = h('div', { class: 'pk-prev' });
    var hexIn = h('input', { class: 'pk-hex mono', type: 'text', maxlength: '7', spellcheck: 'false', 'aria-label': 'Hex color' });
    var rIn = h('input', { class: 'mono', type: 'number', min: 0, max: 255, 'aria-label': 'Red' }), gIn = h('input', { class: 'mono', type: 'number', min: 0, max: 255, 'aria-label': 'Green' }), bIn = h('input', { class: 'mono', type: 'number', min: 0, max: 255, 'aria-label': 'Blue' });
    var sw = h('div', { class: 'pk-swatches' });
    var palette = ['#0a0a0a', '#ffffff', '#f1ede4', '#d4ff3a', '#ff3d8b', '#7a5cff', '#00c2b8', '#ff8a00', '#ffe14d', '#3a7bff', '#ff4d4d', '#2ecc71'];
    function swatchBtn(c) { var b = h('button', { class: 'pk-sw', type: 'button', title: c, style: { background: c } }); b.addEventListener('click', function () { setHex(c, true); }); return b; }
    palette.concat(recent.filter(function (c) { return palette.indexOf(c) < 0; }).slice(0, 6)).forEach(function (c) { sw.appendChild(swatchBtn(c)); });
    var row = h('div', { class: 'pk-row' }, [prev, h('label', { class: 'pk-l' }, ['#', hexIn]), h('label', { class: 'pk-l' }, ['R', rIn]), h('label', { class: 'pk-l' }, ['G', gIn]), h('label', { class: 'pk-l' }, ['B', bIn])]);
    var foot = h('div', { class: 'pk-foot' });
    if (opts.allowNone) foot.appendChild(h('button', { class: 'btn small', type: 'button', text: 'None', onclick: function () { st.value = null; st.changed = true; onInput && onInput(null); UI.closePicker(); } }));
    if (opts.allowGradient) foot.appendChild(h('button', { class: 'btn small', type: 'button', text: 'Gradient…', onclick: function () { UI.closePicker(); opts.allowGradient(); } }));
    foot.appendChild(h('span', { class: 'grow' }));
    foot.appendChild(h('button', { class: 'btn small primary', type: 'button', text: 'Done', onclick: function () { UI.closePicker(); } }));
    el.appendChild(head); el.appendChild(sv); el.appendChild(hue); el.appendChild(row); el.appendChild(sw); el.appendChild(foot);
    document.body.appendChild(el);
    var st = { el: el, hex: hex, value: initial, changed: false, onDone: onDone };
    function paint(fire) {
      var rgb = hsvToRgb(hsv[0], hsv[1], hsv[2]); hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
      sv.style.background = 'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(' + hsv[0] + ',100%,50%))';
      svDot.style.left = (hsv[1] * 100) + '%'; svDot.style.top = ((1 - hsv[2]) * 100) + '%';
      hueDot.style.left = (hsv[0] / 360 * 100) + '%';
      prev.style.background = hex;
      if (document.activeElement !== hexIn) hexIn.value = hex.slice(1).toUpperCase();
      if (document.activeElement !== rIn) rIn.value = round(rgb[0]); if (document.activeElement !== gIn) gIn.value = round(rgb[1]); if (document.activeElement !== bIn) bIn.value = round(rgb[2]);
      if (fire) { st.hex = hex; st.value = hex; st.changed = true; if (onInput) onInput(hex); }
    }
    function setHex(c, fire) { var keepH = hsv[0]; hsv = rgbToHsv.apply(null, hexToRgb(c)); if (hsv[1] === 0) hsv[0] = keepH; paint(fire); }
    function drag(target, fn) {
      target.addEventListener('pointerdown', function (e) {
        e.preventDefault(); try { target.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
        fn(e);
        var mv = function (ev) { fn(ev); }, up = function () { target.removeEventListener('pointermove', mv); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', up); };
        target.addEventListener('pointermove', mv); target.addEventListener('pointerup', up); target.addEventListener('pointercancel', up);
      });
    }
    drag(sv, function (e) { var r = sv.getBoundingClientRect(); hsv[1] = SV.clamp((e.clientX - r.left) / r.width, 0, 1); hsv[2] = SV.clamp(1 - (e.clientY - r.top) / r.height, 0, 1); paint(true); });
    drag(hue, function (e) { var r = hue.getBoundingClientRect(); hsv[0] = SV.clamp((e.clientX - r.left) / r.width, 0, 0.9999) * 360; paint(true); });
    hexIn.addEventListener('input', function () { var v = hexIn.value.replace(/[^0-9a-f]/gi, ''); if (v.length === 6 || v.length === 3) setHex('#' + v, true); });
    hexIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') UI.closePicker(); });
    [rIn, gIn, bIn].forEach(function (inp) { inp.addEventListener('input', function () { setHex(rgbToHex(+rIn.value || 0, +gIn.value || 0, +bIn.value || 0), true); }); });
    paint(false);
    // position
    var r = anchor.getBoundingClientRect(), pw = el.offsetWidth, ph = el.offsetHeight;
    var left = r.left, top = r.bottom + 6;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (top + ph > window.innerHeight - 8) top = max(8, r.top - ph - 6);
    el.style.left = max(8, left) + 'px'; el.style.top = max(8, top) + 'px';
    st.outside = function (e) { if (!el.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) UI.closePicker(); };
    setTimeout(function () { document.addEventListener('pointerdown', st.outside, true); }, 0);
    UI.st.picker = st;
    return st;
  };
  // edit fill/stroke of selection via UI.st.picker
  function editPaint(which, anchor) {
    S.focus = which;
    var cur = SV.currentPaint(which), before = SV.snapshot();
    UI.pickColor(anchor, cur, function (hex) {
      SV.applyStyle(which, hex, { commit: false });
    }, function (val, changed) {
      if (changed) SV.commit('color ' + which); else SV.requestRender(true);
    }, { allowNone: true, title: which === 'fill' ? 'Fill' : 'Stroke', allowGradient: function () { var p = SV.currentPaint(which); if (!p || typeof p !== 'object') SV.applyStyle(which, SV.defaultGradient(p)); showPanel('gradient'); } });
    void before;
  }
  UI.editPaint = editPaint;

  $.editPaint = editPaint; $.gradCSS = gradCSS; $.hexToRgb = hexToRgb; $.paintBG = paintBG; $.paintLabel = paintLabel; $.rgbToHex = rgbToHex;
})();
