/* Slop Slides: DOM helpers and the icon set (stroke icons, 24x24). */
(function () {
  'use strict';
  var SS = window.SS;
  var D = SS.dom = {};
  D.h = function (tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      (Array.isArray(c) ? c : [c]).forEach(function (x) { if (x != null && x !== false) n.append(x.nodeType ? x : document.createTextNode(String(x))); });
    }
    return n;
  };
  D.$ = function (sel, root) { return (root || document).querySelector(sel); };
  D.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var P = {
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    slide: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
    text: '<path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6"/>',
    shape: '<rect x="3.5" y="11" width="9" height="9" rx="1.5"/><circle cx="15.5" cy="8.5" r="5"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5-5-9 8.5"/>',
    table: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9.5h18M3 14.5h18M9 4.5v15M15 4.5v15"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    media: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    format: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    animate: '<path d="M5 12a7 7 0 1 0 7-7"/><path d="M12 5V2.5M5 5l1.8 1.8M2.5 12H5"/><circle cx="12" cy="12" r="2.2"/>',
    document: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    menu: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    zoomIn: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M8 11h6M11 8v6"/>',
    zoomOut: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M8 11h6"/>',
    notes: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 6a9.7 9.7 0 0 1 1.4-.1C18 5.9 21.5 12 21.5 12a17 17 0 0 1-3 3.6M6.4 7.4A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-.9"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    alignL: '<path d="M4 3v18M8 7h10M8 12h6M8 17h12"/>', alignC: '<path d="M12 3v18M6 7h12M8 12h8M5 17h14"/>', alignR: '<path d="M20 3v18M6 7h10M10 12h6M4 17h12"/>',
    alignT: '<path d="M3 4h18M7 8v10M12 8v6M17 8v12"/>', alignM: '<path d="M3 12h18M7 6v12M12 8v8M17 5v14"/>', alignB: '<path d="M3 20h18M7 6v10M12 10v6M17 4v12"/>',
    distH: '<path d="M4 4v16M20 4v16"/><rect x="9" y="8" width="6" height="8" rx="1"/>', distV: '<path d="M4 4h16M4 20h16"/><rect x="8" y="9" width="8" height="6" rx="1"/>',
    front: '<rect x="8" y="8" width="11" height="11" rx="1.5" fill="currentColor"/><path d="M5 15V5h10"/>', back: '<rect x="5" y="5" width="11" height="11" rx="1.5"/><path d="M19 9v10H9" />',
    group: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M3 15v6h6M21 9V3h-6" stroke-dasharray="2 2"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    tl: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>', tc: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>', tr: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>', tj: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
    vt: '<path d="M4 4h16M8 8h8M8 12h8"/>', vm: '<path d="M8 8h8M4 12h16M8 16h8"/>', vb: '<path d="M8 12h8M8 16h8M4 20h16"/>',
    bullets: '<circle cx="5" cy="7" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="5" cy="17" r="1.2"/><path d="M9 7h11M9 12h11M9 17h11"/>',
    numbers: '<path d="M4 5h1.5v4M4 9h3M4 14.5c0-1 2.8-1 2.8.3 0 1-2.8 2-2.8 3.2h3M10 7h10M10 12h10M10 17h10"/>',
    indent: '<path d="M4 6h16M10 10h10M10 14h10M4 18h16M4 9l3 3-3 3"/>', outdent: '<path d="M4 6h16M10 10h10M10 14h10M4 18h16M7 9l-3 3 3 3"/>',
    flipH: '<path d="M12 3v18M9 7 4 17h5zM15 7l5 10h-5z"/>', flipV: '<path d="M3 12h18M7 9 17 4v5zM7 15l10 5v-5z"/>',
    present: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/><path d="m10 8 4 2-4 2z"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12 5 5 9-10"/>', more: '<path d="m9 6 6 6-6 6"/>',
    laser: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
    timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>',
    open: '<path d="M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9.5a2 2 0 0 0-2-2h-7L10 5H5a2 2 0 0 0-2 2.5z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'
  };
  D.ICONS = P;
  D.icon = function (name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || P.sparkle) + '</svg>'; };
  /** A toolbar button: D.btn('play', 'Play', fn, {label: true}) */
  D.btn = function (icon, title, fn, o) {
    o = o || {};
    var b = D.h('button', { type: 'button', class: 'tb' + (o.label ? ' tb-l' : '') + (o.cls ? ' ' + o.cls : ''), title: title, 'aria-label': title, html: D.icon(icon) + (o.label ? '<span>' + (o.label === true ? title : o.label) + '</span>' : '') });
    if (fn) b.addEventListener('click', fn);
    return b;
  };
})();
