/* Slop PDF — utilities: DOM helpers, icons, storage, zip writer, range parsing.
   Classic script; everything hangs off window.SP. No network access. */
(function () {
  'use strict';
  var SP = window.SP = window.SP || {};
  var U = SP.util = {};

  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  function setAttrs(el, attrs, isSvg) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class' || k === 'className') { if (isSvg) el.setAttribute('class', v); else el.className = v; }
      else if (k === 'style' && typeof v === 'object') { Object.keys(v).forEach(function (p) { if (p.indexOf('--') === 0) el.style.setProperty(p, v[p]); else el.style[p] = v[p]; }); }
      else if (k === 'dataset') { Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; }); }
      else if (k.indexOf('on') === 0 && typeof v === 'function') { el.addEventListener(k.slice(2).toLowerCase(), v); }
      else if (k === 'html') { el.innerHTML = v; }
      else if (k === 'text') { el.textContent = v; }
      else if (!isSvg && (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden')) { el[k] = v; }
      else el.setAttribute(k, v === true ? '' : v);
    });
  }
  /** h('div', {class:'x', onclick: fn}, 'text', child, [children]) */
  U.h = function (tag) {
    var el = document.createElement(tag);
    setAttrs(el, arguments[1], false);
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  };
  var SVGNS = 'http://www.w3.org/2000/svg';
  U.SVGNS = SVGNS;
  U.s = function (tag) {
    var el = document.createElementNS(SVGNS, tag);
    setAttrs(el, arguments[1], true);
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  };

  var n = 0;
  U.uid = function (p) { n++; return (p || 'i') + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7) + n.toString(36); };
  U.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  U.round = function (v, d) { var m = Math.pow(10, d || 0); return Math.round(v * m) / m; };
  U.fmtBytes = function (b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' KB';
    return (b / 1048576).toFixed(b < 10485760 ? 2 : 1) + ' MB';
  };
  U.debounce = function (fn, ms) {
    var t = null;
    var d = function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { t = null; fn.apply(s, a); }, ms); };
    d.flush = function () { if (t) { clearTimeout(t); t = null; fn(); } };
    return d;
  };
  U.nextFrame = function () { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); };
  U.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  U.esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- storage (always try/catch: private mode, blocked storage, previews) ---------- */
  U.store = {
    get: function (k, def) { try { var v = localStorage.getItem('slop-pdf.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set: function (k, v) { try { localStorage.setItem('slop-pdf.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem('slop-pdf.' + k); } catch (e) { /* ignore */ } }
  };

  /* Tiny IndexedDB key/value store. Every call resolves (null on failure). */
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res) {
      try {
        if (!window.indexedDB) return res(null);
        var rq = indexedDB.open('slop-pdf', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('kv'); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { res(null); };
        rq.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      if (!d) return null;
      return new Promise(function (res) {
        try {
          var t = d.transaction('kv', mode), st = t.objectStore('kv'), out = fn(st);
          t.oncomplete = function () { res(out && 'result' in out ? out.result : true); };
          t.onerror = t.onabort = function () { res(null); };
        } catch (e) { res(null); }
      });
    }).catch(function () { return null; });
  }
  U.idb = {
    get: function (k) { return tx('readonly', function (st) { return st.get(k); }); },
    set: function (k, v) { return tx('readwrite', function (st) { st.put(v, k); }); },
    del: function (k) { return tx('readwrite', function (st) { st.delete(k); }); }
  };

  /* ---------- bytes ---------- */
  U.readFile = function (file) {
    if (file.arrayBuffer) return file.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(new Uint8Array(r.result)); }; r.onerror = function () { rej(r.error); }; r.readAsArrayBuffer(file); });
  };
  U.dataURLToBytes = function (url) {
    var b64 = url.slice(url.indexOf(',') + 1), bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  U.bytesToBase64 = function (bytes) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  };
  U.bytesToDataURL = function (bytes, mime) { return 'data:' + mime + ';base64,' + U.bytesToBase64(bytes); };
  U.canvasToBlob = function (canvas, type, q) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (b) { if (b) res(b); else rej(new Error('Could not encode image')); }, type, q);
    });
  };
  U.blobToBytes = function (blob) { return U.readFile(blob); };
  U.sniff = function (b) {
    if (!b || b.length < 4) return 'unknown';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
    if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
    var lim = Math.min(b.length - 4, 1024);
    for (var i = 0; i < lim; i++) if (b[i] === 0x25 && b[i + 1] === 0x50 && b[i + 2] === 0x44 && b[i + 3] === 0x46) return 'pdf';
    return 'unknown';
  };
  U.indexOfBytes = function (hay, needle, from) {
    var n0 = needle[0], nl = needle.length;
    outer: for (var i = from || 0, e = hay.length - nl; i <= e; i++) {
      if (hay[i] !== n0) continue;
      for (var j = 1; j < nl; j++) if (hay[i + j] !== needle[j]) continue outer;
      return i;
    }
    return -1;
  };
  U.ascii = function (s) { var o = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i) & 255; return o; };

  U.download = function (data, name, mime) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 4000);
  };

  U.safeName = function (s, ext) {
    s = String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim();
    if (!s) s = 'document';
    if (ext) { var re = new RegExp('\\.' + ext + '$', 'i'); if (!re.test(s)) s += '.' + ext; }
    return s;
  };
  U.baseName = function (s) { return String(s || 'document').replace(/\.[a-z0-9]{1,5}$/i, ''); };

  /* ---------- colour ---------- */
  U.hexToRgb = function (hex) {
    hex = String(hex || '#000').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var v = parseInt(hex, 16) || 0;
    return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
  };

  /* ---------- page ranges: "1-3, 5, 8-" → [[0,1,2],[4],[7..n-1]] ---------- */
  U.parseRanges = function (str, max) {
    var parts = String(str || '').split(/[,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!parts.length) throw new Error('Enter at least one page range, like 1-3, 5, 8-');
    return parts.map(function (p) {
      var m = /^(\d*)\s*(?:(-|–|—|to|\.\.)\s*(\d*))?$/i.exec(p);
      if (!m || (!m[1] && !m[3])) throw new Error('“' + p + '” is not a page range');
      var a = m[1] ? parseInt(m[1], 10) : 1;
      var b = m[2] ? (m[3] ? parseInt(m[3], 10) : max) : a;
      if (a < 1 || b < 1 || a > max || b > max) throw new Error('“' + p + '” is outside 1–' + max);
      var out = [];
      if (a <= b) for (var i = a; i <= b; i++) out.push(i - 1);
      else for (var j = a; j >= b; j--) out.push(j - 1);
      return out;
    });
  };
  U.describeIdx = function (idx) {
    // [0,1,2,4] -> "1–3, 5"
    var out = [], i = 0;
    while (i < idx.length) {
      var j = i;
      while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
      out.push(j > i ? (idx[i] + 1) + '–' + (idx[j] + 1) : String(idx[i] + 1));
      i = j + 1;
    }
    return out.join(', ');
  };

  /* ---------- store-only ZIP writer (no compression, no library) ---------- */
  var CRC = null;
  U.crc32 = function (bytes) {
    if (!CRC) {
      CRC = new Uint32Array(256);
      for (var k = 0; k < 256; k++) { var c = k; for (var j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[k] = c >>> 0; }
    }
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) crc = CRC[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  /** files: [{name, data: Uint8Array}] → Blob (application/zip) */
  U.makeZip = function (files, date) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0, used = {};
    var d = date || new Date();
    var dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
    var dosDate = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      var name = f.name, base = name, k = 2;
      while (used[name.toLowerCase()]) { name = base.replace(/(\.[^.]+)?$/, function (ext) { return ' (' + k + ')' + (ext || ''); }); k++; }
      used[name.toLowerCase()] = 1;
      var nb = enc.encode(name), data = f.data, crc = U.crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nb.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nb, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nb.length, true);
      ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nb);
      offset += 30 + nb.length + data.length;
    });
    var cdSize = central.reduce(function (s, p) { return s + p.length; }, 0);
    var eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054b50, true); eo.setUint16(4, 0, true); eo.setUint16(6, 0, true);
    eo.setUint16(8, files.length, true); eo.setUint16(10, files.length, true);
    eo.setUint32(12, cdSize, true); eo.setUint32(16, offset, true); eo.setUint16(20, 0, true);
    return new Blob(parts.concat(central, [new Uint8Array(eo.buffer)]), { type: 'application/zip' });
  };

  /* ---------- tiny event emitter ---------- */
  U.emitter = function () {
    var m = {};
    return {
      on: function (ev, fn) { (m[ev] = m[ev] || []).push(fn); return function () { m[ev] = (m[ev] || []).filter(function (f) { return f !== fn; }); }; },
      emit: function (ev, a, b) { (m[ev] || []).slice().forEach(function (fn) { try { fn(a, b); } catch (e) { console.warn(e); } }); }
    };
  };

  /* ---------- icons (24px stroke icons) ---------- */
  var P = {
    open: '<path d="M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9.5a2 2 0 0 0-2-2h-7L10 5H5a2 2 0 0 0-2 2.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    organize: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
    sign: '<path d="M3 17c3-1 4.5-9 7-9s.5 9 3 9 2.5-4 4-4 1.5 3 4 3"/><path d="M3 21h18"/>',
    numbers: '<path d="M4 6h3v12M4 18h6"/><path d="M14 8a3 3 0 1 1 5 2.2L14 16h6"/>',
    watermark: '<path d="M12 3s-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-6-11-6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    forms: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M7 9h4M7 14h4"/><rect x="13" y="7.5" width="4.5" height="3" rx=".6"/><rect x="13" y="12.5" width="4.5" height="3" rx=".6"/>',
    compress: '<path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5"/>',
    convert: '<rect x="3" y="3" width="11" height="14" rx="1.5"/><path d="M14 9h5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-2"/><path d="m11 14 2.5-3 3 4 1.5-1.5"/>',
    split: '<path d="M6 4v5M18 4v5M6 15v5M18 15v5"/><path d="M3 12h3M9 12h2M13 12h2M18 12h3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    rotl: '<path d="M4 4v5h5"/><path d="M4.6 15a8 8 0 1 0 1.9-8.3L4 9"/>',
    rotr: '<path d="M20 4v5h-5"/><path d="M19.4 15a8 8 0 1 1-1.9-8.3L20 9"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    extract: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 18v-6M9 15l3 3 3-3"/>',
    blank: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
    insert: '<path d="M4 4h7v16H4zM20 12h-6M17 9l-3 3 3 3"/>',
    reverse: '<path d="M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3"/>',
    sort: '<path d="M4 6h9M4 12h7M4 18h5M17 4v16M14 17l3 3 3-3"/>',
    zoomin: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/>',
    zoomout: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    prev: '<path d="m15 18-6-6 6-6"/>',
    next: '<path d="m9 18 6-6-6-6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    select: '<path d="M5 3l14 8-6 1.8L10 19z"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    pen: '<path d="M3 21c2-5 4-6 6-8l7-7a2.1 2.1 0 0 1 3 3l-7 7c-2 2-3 4-8 6"/>',
    marker: '<path d="m9 15 9.5-9.5a2.1 2.1 0 0 0-3-3L6 12l-1 4z"/><path d="M4 21h9" stroke-width="3" opacity=".55"/>',
    rect: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
    line: '<path d="M5 19 19 5"/>',
    arrow: '<path d="M5 19 19 5M10 5h9v9"/>',
    whiteout: '<rect x="3" y="6" width="18" height="12" rx="1.5" fill="currentColor" fill-opacity=".18"/><path d="M7 12h10"/>',
    hlbox: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M3 10h18M3 14h18" opacity=".5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v7M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13M17 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-2c-3 0-4.5-1.5-6.5-4l-2.3-3a1.5 1.5 0 0 1 2.3-2L8 14"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    textfile: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    selectall: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 2.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'
  };
  U.icon = function (name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (P[name] || P.file) + '</svg>';
  };
  U.iconEl = function (name, cls) { var t = document.createElement('span'); t.innerHTML = U.icon(name, cls); return t.firstChild; };
})();
