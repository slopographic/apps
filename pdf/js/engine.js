/* Slop PDF — engine: document model, undo/redo, pdf.js loading + rendering, pdf-lib export.
   Model:
     files  (Map id → {id, name, bytes, doc (pdf.js proxy), info[i] = {view:[x0,y0,x1,y1], rotate}, color})
     assets (Map id → {id, mime, url, w, h})   images used by annotations (logos, signatures)
     state  {pages:[{id, f, i, rot, annots:[]} | {id, blank:{w,h}, rot, annots:[]}], meta, stamps, forms, flattenForms}
   Annotation geometry lives in the page's unrotated user space measured from the top-left
   of the visible box (pdf.js page.view), in PDF points:
     box kinds  (text, rect, ellipse, image, whiteout, hlbox): cx, cy, w, h, rot (degrees; the
                 page rotation the box is upright at)
     path kinds (pen, marker, line, arrow): pts [[u,v],...]
   The export draws everything with pdf-lib onto copied pages, so original content stays vector. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util;
  var E = SP.engine = U.emitter();

  E.COLORS = ['#c6f432', '#ff5fa2', '#38d6ff', '#ff9f1c', '#a98bff', '#2ee6a8', '#ffd23f', '#ff6b5a'];
  E.files = new Map();
  E.assets = new Map();
  E.state = blank();
  function blank() {
    return { pages: [], meta: { title: '', author: '', subject: '', keywords: '' }, stamps: { pageNumbers: null, watermark: null }, forms: {}, flattenForms: false };
  }
  E.SIZES = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008], a5: [419.53, 595.28], a3: [841.89, 1190.55] };

  /* ------------------------------------------------------------------ pdf.js */
  var libP = null;
  // Resolve vendor/ relative to this script (pdf/js/engine.js), so tests and other pages can load it too.
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  E.vendorBase = function () { return SP.vendorBase || new URL(SCRIPT_SRC ? '../../vendor/pdfjs/' : '../vendor/pdfjs/', SCRIPT_SRC || document.baseURI).href; };
  E.pdfjs = function () {
    if (!libP) {
      libP = (async function () {
        if (window.pdfjsLib) return window.pdfjsLib; // offline single-file build injects it
        var base = E.vendorBase();
        var lib = await import(base + 'pdf.min.js');
        lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js';
        window.pdfjsLib = lib;
        return lib;
      })();
      libP.catch(function () { libP = null; });
    }
    return libP;
  };
  E.docParams = function (data, password) {
    var p = { data: data, isEvalSupported: false, enableXfa: false, useSystemFonts: true, verbosity: 0 };
    if (password != null) p.password = password;
    if (SP.offline) {
      p.useWorkerFetch = false;
      if (SP.offline.FontFactory) p.StandardFontDataFactory = SP.offline.FontFactory;
    } else {
      var base = E.vendorBase();
      p.cMapUrl = base + 'cmaps/'; p.cMapPacked = true; p.standardFontDataUrl = base + 'standard_fonts/';
    }
    return p;
  };
  /** Opens bytes with pdf.js. askPassword(name, wrong) → Promise<string|null>. Resolves {doc, password}. */
  E.openPdfjs = function (bytes, name, askPassword) {
    return E.pdfjs().then(function (lib) {
      return new Promise(function (resolve, reject) {
        var last = '', task = lib.getDocument(E.docParams(bytes.slice()));
        task.onPassword = function (update, reason) {
          if (!askPassword) { var e0 = new Error('This PDF needs a password.'); e0.code = 'password'; task.destroy(); reject(e0); return; }
          askPassword(name, reason === lib.PasswordResponses.INCORRECT_PASSWORD).then(function (pw) {
            if (pw == null) { var e = new Error('Password entry cancelled.'); e.code = 'cancelled'; task.destroy(); reject(e); return; }
            last = pw; update(pw);
          });
        };
        task.promise.then(function (doc) { resolve({ doc: doc, password: last }); }, reject);
      });
    });
  };
  E.friendlyError = function (e, name) {
    var n = e && e.name, msg = (e && e.message) || String(e);
    if (e && e.code === 'cancelled') return null;
    if (n === 'InvalidPDFException') return '“' + name + '” is not a valid PDF, or it is damaged beyond repair.';
    if (n === 'MissingPDFException') return '“' + name + '” is empty.';
    if (n === 'PasswordException') return '“' + name + '” needs the correct password.';
    return '“' + name + '” could not be opened: ' + msg;
  };

  /* --------------------------------------------------------------- files */
  var colorIdx = 0;
  /** Registers PDF bytes as a source file. Decrypts protected PDFs so they can be rewritten. */
  E.registerPdf = async function (bytes, name, askPassword, opts) {
    opts = opts || {};
    var r = await E.openPdfjs(bytes, name, askPassword), doc = r.doc, finalBytes = bytes, locked = null, decrypted = false;
    if (SP.decrypt.isEncrypted(bytes)) {
      try {
        var dec = await SP.decrypt.decryptPdf(bytes, r.password);
        if (dec) {
          var r2 = await E.openPdfjs(dec, name, null);
          await doc.destroy(); doc = r2.doc; finalBytes = dec; decrypted = true;
        }
      } catch (e) { locked = e.message || 'Unsupported encryption'; console.warn('Slop PDF: could not remove encryption', e); }
    }
    var f = { id: opts.id || U.uid('f'), name: name, bytes: finalBytes, doc: doc, numPages: doc.numPages, color: opts.color || E.COLORS[colorIdx++ % E.COLORS.length], info: [], decrypted: decrypted, locked: locked, fields: undefined };
    var n = doc.numPages, next = 0;
    async function worker() {
      while (next < n) { var i = next++; var pg = await doc.getPage(i + 1); f.info[i] = { view: pg.view.slice(), rotate: ((pg.rotate % 360) + 360) % 360 }; }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    E.files.set(f.id, f);
    if (!opts.silent) E.emit('files');
    return f;
  };
  E.pagesForFile = function (f) {
    var out = [];
    for (var i = 0; i < f.numPages; i++) out.push({ id: U.uid('p'), f: f.id, i: i, rot: 0, annots: [] });
    return out;
  };
  E.readMeta = async function (f) {
    try {
      var md = await f.doc.getMetadata(), inf = (md && md.info) || {};
      return { title: inf.Title || '', author: inf.Author || '', subject: inf.Subject || '', keywords: inf.Keywords || '' };
    } catch (e) { return null; }
  };
  E.fileOfPage = function (p) { return p && p.f ? E.files.get(p.f) : null; };

  /* ------------------------------------------------------------ geometry */
  E.geom = function (p) {
    if (p.blank) return { W: p.blank.w, H: p.blank.h, x0: 0, y0: 0, base: 0 };
    var f = E.files.get(p.f), inf = f && f.info[p.i];
    if (!inf) return { W: 612, H: 792, x0: 0, y0: 0, base: 0 };
    var v = inf.view;
    return { W: v[2] - v[0], H: v[3] - v[1], x0: v[0], y0: v[1], base: inf.rotate };
  };
  E.rotation = function (p) { var g = E.geom(p); return (((g.base + (p.rot || 0)) % 360) + 360) % 360; };
  E.viewSize = function (p) { var g = E.geom(p), R = E.rotation(p); return R % 180 ? { w: g.H, h: g.W } : { w: g.W, h: g.H }; };
  /** unrotated page point (u,v) → view point (x,y) at rotation R (clockwise) */
  E.toView = function (R, W, H, u, v) {
    if (R === 90) return [H - v, u];
    if (R === 180) return [W - u, H - v];
    if (R === 270) return [v, W - u];
    return [u, v];
  };
  E.toPage = function (R, W, H, x, y) {
    if (R === 90) return [y, H - x];
    if (R === 180) return [W - x, H - y];
    if (R === 270) return [W - y, x];
    return [x, y];
  };
  E.BOX = { text: 1, rect: 1, ellipse: 1, image: 1, whiteout: 1, hlbox: 1 };
  E.isBox = function (a) { return !!E.BOX[a.type]; };
  /** Axis-aligned rectangle of an annotation in view space (points) for a page at rotation R. */
  E.annotViewRect = function (a, R, W, H) {
    if (E.isBox(a)) {
      var c = E.toView(R, W, H, a.cx, a.cy), va = ((((R - (a.rot || 0)) % 360) + 360) % 360);
      var sw = va % 180 ? a.h : a.w, sh = va % 180 ? a.w : a.h;
      return { x: c[0] - sw / 2, y: c[1] - sh / 2, w: sw, h: sh };
    }
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    a.pts.forEach(function (pt) { var q = E.toView(R, W, H, pt[0], pt[1]); minx = Math.min(minx, q[0]); miny = Math.min(miny, q[1]); maxx = Math.max(maxx, q[0]); maxy = Math.max(maxy, q[1]); });
    return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
  };
  /** Moves/resizes annotation so its view rect becomes r (mutates a). */
  E.setAnnotViewRect = function (a, r, R, W, H) {
    if (E.isBox(a)) {
      var c = E.toPage(R, W, H, r.x + r.w / 2, r.y + r.h / 2), va = ((((R - (a.rot || 0)) % 360) + 360) % 360);
      a.cx = c[0]; a.cy = c[1];
      if (va % 180) { a.w = r.h; a.h = r.w; } else { a.w = r.w; a.h = r.h; }
      return a;
    }
    var o = E.annotViewRect(a, R, W, H);
    var sx = o.w > 0.01 ? r.w / o.w : 1, sy = o.h > 0.01 ? r.h / o.h : 1;
    a.pts = a.pts.map(function (pt) {
      var q = E.toView(R, W, H, pt[0], pt[1]);
      var nx = r.x + (q[0] - o.x) * sx, ny = r.y + (q[1] - o.y) * sy;
      var b = E.toPage(R, W, H, nx, ny);
      return [U.round(b[0], 2), U.round(b[1], 2)];
    });
    return a;
  };

  /* ---------------------------------------------------------- undo / redo */
  var undoS = [], redoS = [], lastKey = null, lastT = 0;
  E.commit = function (label, fn, coalesce) {
    var now = Date.now();
    if (!(coalesce && coalesce === lastKey && now - lastT < 1500)) {
      undoS.push({ label: label, snap: JSON.stringify(E.state) });
      if (undoS.length > 300) undoS.shift();
      redoS.length = 0;
    }
    lastKey = coalesce || null; lastT = now;
    var r = fn(E.state);
    E.emit('change', { label: label });
    return r;
  };
  E.undo = function () {
    var u = undoS.pop(); if (!u) return null;
    redoS.push({ label: u.label, snap: JSON.stringify(E.state) });
    E.state = JSON.parse(u.snap); lastKey = null;
    E.emit('change', { label: 'Undo ' + u.label, history: true });
    return u.label;
  };
  E.redo = function () {
    var r = redoS.pop(); if (!r) return null;
    undoS.push({ label: r.label, snap: JSON.stringify(E.state) });
    E.state = JSON.parse(r.snap); lastKey = null;
    E.emit('change', { label: 'Redo ' + r.label, history: true });
    return r.label;
  };
  E.canUndo = function () { return undoS.length > 0; };
  E.canRedo = function () { return redoS.length > 0; };
  E.undoLabel = function () { return undoS.length ? undoS[undoS.length - 1].label : ''; };
  E.redoLabel = function () { return redoS.length ? redoS[redoS.length - 1].label : ''; };
  E.resetHistory = function () { undoS = []; redoS = []; lastKey = null; };
  E.endCoalesce = function () { lastKey = null; };

  /* --------------------------------------------------- organizer operations */
  function idSet(ids) { var s = new Set(); ids.forEach(function (i) { s.add(i); }); return s; }
  E.ops = {
    rotate: function (st, ids, delta) { var s = idSet(ids); st.pages.forEach(function (p) { if (s.has(p.id)) p.rot = (((p.rot || 0) + delta) % 360 + 360) % 360; }); },
    remove: function (st, ids) { var s = idSet(ids); st.pages = st.pages.filter(function (p) { return !s.has(p.id); }); },
    duplicate: function (st, ids) {
      var s = idSet(ids), out = [], added = [];
      st.pages.forEach(function (p) {
        out.push(p);
        if (s.has(p.id)) {
          var c = JSON.parse(JSON.stringify(p)); c.id = U.uid('p');
          c.annots.forEach(function (a) { a.id = U.uid('a'); });
          out.push(c); added.push(c.id);
        }
      });
      st.pages = out; return added;
    },
    /** move pages ids so they sit before the page that is currently at index `before` (0..len) */
    move: function (st, ids, before) {
      var s = idSet(ids), moving = [], rest = [], adj = before;
      st.pages.forEach(function (p, i) { if (s.has(p.id)) { moving.push(p); if (i < before) adj--; } else rest.push(p); });
      adj = U.clamp(adj, 0, rest.length);
      st.pages = rest.slice(0, adj).concat(moving, rest.slice(adj));
    },
    insert: function (st, index, pages) { st.pages.splice(U.clamp(index, 0, st.pages.length), 0, ...pages); },
    reverse: function (st, ids) {
      if (!ids || ids.length < 2) { st.pages.reverse(); return; }
      var s = idSet(ids), pos = [], sel = [];
      st.pages.forEach(function (p, i) { if (s.has(p.id)) { pos.push(i); sel.push(p); } });
      sel.reverse(); pos.forEach(function (i, k) { st.pages[i] = sel[k]; });
    },
    sort: function (st, mode) {
      var a = st.pages.slice(), n = a.length, out = [];
      if (mode === 'collate' || mode === 'collate-same') {
        var h = Math.ceil(n / 2), fronts = a.slice(0, h), backs = a.slice(h);
        if (mode === 'collate') backs.reverse();
        for (var i = 0; i < h; i++) { out.push(fronts[i]); if (backs[i]) out.push(backs[i]); }
      } else if (mode === 'odd-even') {
        out = a.filter(function (_, i) { return i % 2 === 0; }).concat(a.filter(function (_, i) { return i % 2 === 1; }));
      } else if (mode === 'even-odd') {
        out = a.filter(function (_, i) { return i % 2 === 1; }).concat(a.filter(function (_, i) { return i % 2 === 0; }));
      } else if (mode === 'source') {
        var order = Array.from(E.files.keys());
        out = a.map(function (p, i) { return { p: p, i: i }; }).sort(function (x, y) {
          var fx = x.p.f ? order.indexOf(x.p.f) : 1e9, fy = y.p.f ? order.indexOf(y.p.f) : 1e9;
          if (fx !== fy) return fx - fy;
          if (x.p.f && y.p.f && x.p.i !== y.p.i) return x.p.i - y.p.i;
          return x.i - y.i;
        }).map(function (x) { return x.p; });
      } else out = a;
      st.pages = out;
    }
  };
  E.pageById = function (id) { var p = null; E.state.pages.some(function (x) { if (x.id === id) { p = x; return true; } return false; }); return p; };
  E.indexOf = function (id) { for (var i = 0; i < E.state.pages.length; i++) if (E.state.pages[i].id === id) return i; return -1; };
  E.blankPage = function (w, h) { return { id: U.uid('p'), blank: { w: w, h: h }, rot: 0, annots: [] }; };

  /* ------------------------------------------------------------- fonts */
  var FONTMAP = {
    Helvetica: ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'],
    Times: ['Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic'],
    Courier: ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique']
  };
  E.CSSFONT = {
    Helvetica: 'Helvetica, Arial, "Liberation Sans", "Nimbus Sans", sans-serif',
    Times: '"Times New Roman", Times, "Liberation Serif", "Nimbus Roman", serif',
    Courier: '"Courier New", Courier, "Liberation Mono", "Nimbus Mono PS", monospace'
  };
  E.stdFontName = function (a) { var fam = FONTMAP[a.font] ? a.font : 'Helvetica'; return FONTMAP[fam][(a.bold ? 1 : 0) + (a.italic ? 2 : 0)]; };
  var mdoc = null, mfonts = {}, charsets = {};
  E.initFonts = async function () {
    if (mdoc) return;
    mdoc = await PDFLib.PDFDocument.create();
    Object.keys(FONTMAP).forEach(function (fam) {
      FONTMAP[fam].forEach(function (nm) { mfonts[nm] = mdoc.embedStandardFont(nm); charsets[nm] = new Set(mfonts[nm].getCharacterSet()); });
    });
  };
  E.sanitize = function (text, fontName) {
    var cs = charsets[fontName] || charsets.Helvetica, out = '';
    text = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
    for (var ch of text) { var cp = ch.codePointAt(0); out += (ch === '\n' || !cs || cs.has(cp)) ? ch : (cp === 0x2011 ? '-' : '?'); }
    return out;
  };
  E.measure = function (text, fontName, size) {
    var f = mfonts[fontName] || mfonts.Helvetica;
    try { return f.widthOfTextAtSize(E.sanitize(text, fontName), size); } catch (e) { return text.length * size * 0.55; }
  };
  /** Text layout shared by the on-screen SVG and the pdf-lib export. */
  E.textLayout = function (a) {
    var fn = E.stdFontName(a), s = a.size || 14, lines = E.sanitize(a.text || '', fn).split('\n');
    var pad = s * 0.2, lh = s * 1.2, maxW = 0;
    lines.forEach(function (l) { maxW = Math.max(maxW, E.measure(l, fn, s)); });
    return { lines: lines, font: fn, size: s, pad: pad, lh: lh, w: Math.max(maxW, s * 0.5) + pad * 2, h: lines.length * lh + pad * 2, base: function (i) { return pad + i * lh + s * 0.9; } };
  };

  /* ------------------------------------------------------------- stamps */
  E.pageNumberText = function (pn, n, total) {
    switch (pn.format) {
      case 'page': return 'Page ' + n;
      case 'n-of': return n + ' / ' + total;
      case 'page-of': return 'Page ' + n + ' of ' + total;
      case 'dash': return '– ' + n + ' –';
      default: return String(n);
    }
  };
  /** Synthetic annotations for page numbers and watermark (same renderer + exporter as user annotations). */
  E.stampAnnots = function (p, index, total, stamps) {
    stamps = stamps || E.state.stamps;
    var out = [], g = E.geom(p), R = E.rotation(p), vs = E.viewSize(p);
    var pn = stamps && stamps.pageNumbers;
    if (pn && !(pn.skipFirst && index === 0)) {
      var n = (pn.start || 1) + index - (pn.skipFirst ? 1 : 0);
      var last = (pn.start || 1) + total - 1 - (pn.skipFirst ? 1 : 0);
      var a = { id: 'pn', type: 'text', text: E.pageNumberText(pn, n, last), font: pn.font || 'Helvetica', bold: !!pn.bold, size: pn.size || 11, color: pn.color || '#000000', opacity: 1, rot: R };
      var t = E.textLayout(a), m = pn.margin == null ? 28 : pn.margin;
      var pos = pn.position || 'bottom-center', vx, vy;
      vx = /left/.test(pos) ? m + t.w / 2 - t.pad : /right/.test(pos) ? vs.w - m - t.w / 2 + t.pad : vs.w / 2;
      vy = /top/.test(pos) ? m + t.h / 2 - t.pad : vs.h - m - t.h / 2 + t.pad;
      var c = E.toPage(R, g.W, g.H, vx, vy);
      a.cx = c[0]; a.cy = c[1]; a.w = t.w; a.h = t.h;
      out.push(a);
    }
    var wm = stamps && stamps.watermark;
    if (wm && wm.text) {
      var b = { id: 'wm', type: 'text', text: wm.text, font: wm.font || 'Helvetica', bold: wm.bold !== false, size: wm.size || 60, color: wm.color || '#ff3b6b', opacity: wm.opacity == null ? 0.25 : wm.opacity, rot: R + (wm.angle == null ? 45 : wm.angle) };
      var tb = E.textLayout(b), cc = E.toPage(R, g.W, g.H, vs.w / 2, vs.h / 2);
      b.cx = cc[0]; b.cy = cc[1]; b.w = tb.w; b.h = tb.h;
      out.push(b);
    }
    return out;
  };

  /* -------------------------------------------------------------- forms */
  E.loadFields = async function (f) {
    if (f.fields !== undefined) return f.fields;
    var list = [];
    try {
      var objs = await f.doc.getFieldObjects();
      if (objs) Object.keys(objs).forEach(function (name) {
        var ws = (objs[name] || []).filter(function (w) { return w && w.type && w.id; });
        if (!ws.length) return;
        var type = ws[0].type;
        if (type === 'button' || type === 'signature') return;
        var fld = { name: name, type: type, widgets: ws.map(function (w) { return { id: w.id, exportValue: w.exportValues, value: w.value, page: w.page }; }), readOnly: ws[0].editable === false, page: ws[0].page };
        if (type === 'radiobutton') {
          fld.options = ws.map(function (w) { return w.exportValues; });
          var on = ws.filter(function (w) { return w.value && w.value !== 'Off' && w.value === w.exportValues; })[0];
          fld.value = on ? on.exportValues : (ws[0].value && ws[0].value !== 'Off' ? ws[0].value : '');
        } else if (type === 'checkbox') {
          fld.value = !!(ws[0].value && ws[0].value !== 'Off');
        } else if (type === 'combobox' || type === 'listbox') {
          fld.options = (ws[0].items || []).map(function (it) { return [it.exportValue, it.displayValue]; });
          fld.value = Array.isArray(ws[0].value) ? (ws[0].value[0] || '') : (ws[0].value || '');
        } else {
          fld.value = ws[0].value == null ? '' : String(ws[0].value);
          fld.multiline = !!ws[0].multiline;
        }
        list.push(fld);
      });
    } catch (e) { console.warn('Slop PDF: could not read form fields', e); }
    f.fields = list;
    return list;
  };
  E.formKey = function (fid) { var v = E.state.forms[fid]; return v && Object.keys(v).length ? JSON.stringify(v) : ''; };
  function syncStorage(f) {
    if (!f.fields || !f.fields.length) return;
    var vals = E.state.forms[f.id] || {}, st = f.doc.annotationStorage;
    f.fields.forEach(function (fld) {
      var has = Object.prototype.hasOwnProperty.call(vals, fld.name), v = has ? vals[fld.name] : fld.value;
      fld.widgets.forEach(function (w) {
        if (fld.type === 'checkbox') st.setValue(w.id, { value: !!v });
        else if (fld.type === 'radiobutton') st.setValue(w.id, { value: v === w.exportValue });
        else if (fld.type === 'listbox') st.setValue(w.id, { value: v ? [v] : [] });
        else st.setValue(w.id, { value: v == null ? '' : String(v) });
      });
    });
  }

  /* ---------------------------------------------------------- rendering */
  var cache = new Map(), MAXCACHE = 600, queue = [], active = 0;
  function pump() {
    while (active < 3 && queue.length) {
      var job = queue.pop(); // LIFO: most recently requested (visible) first
      active++;
      job.run().then(job.res, job.rej).finally(function () { active--; pump(); });
    }
  }
  function schedule(run) { return new Promise(function (res, rej) { queue.push({ run: run, res: res, rej: rej }); pump(); }); }
  E.renderToCanvas = async function (f, i, scale, canvas) {
    var lib = await E.pdfjs(), pg = await f.doc.getPage(i + 1);
    if (f.fields && f.fields.length) syncStorage(f);
    var vp = pg.getViewport({ scale: scale, rotation: 0 });
    canvas = canvas || document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(vp.width)); canvas.height = Math.max(1, Math.floor(vp.height));
    var ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    var task = pg.render({ canvasContext: ctx, viewport: vp, annotationMode: lib.AnnotationMode.ENABLE_STORAGE, annotationStorage: f.doc.annotationStorage });
    canvas._task = task;
    await task.promise;
    return canvas;
  };
  E.bucket = function (px) { return px <= 200 ? 200 : px <= 320 ? 320 : px <= 480 ? 480 : px <= 720 ? 720 : 1000; };
  /** Cached thumbnail object-URL for a page (unrotated raster). px = longest side in device px. */
  E.thumbURL = function (p, px) {
    if (p.blank) return Promise.resolve(null);
    var f = E.files.get(p.f); if (!f) return Promise.resolve(null);
    var b = E.bucket(px);
    var key = f.id + ':' + p.i + ':' + b + ':' + E.formKey(f.id);
    var hit = cache.get(key);
    if (hit) { cache.delete(key); cache.set(key, hit); return hit.p; }
    var g = E.geom(p), scale = b / Math.max(g.W, g.H);
    var entry = { url: null };
    entry.p = schedule(async function () {
      var c = await E.renderToCanvas(f, p.i, scale);
      var blob = await U.canvasToBlob(c, 'image/png');
      entry.url = URL.createObjectURL(blob);
      c.width = c.height = 0;
      return entry.url;
    });
    entry.p.catch(function () { cache.delete(key); });
    cache.set(key, entry);
    while (cache.size > MAXCACHE) {
      var k0 = cache.keys().next().value, e0 = cache.get(k0); cache.delete(k0);
      if (e0 && e0.url) setTimeout(function (u) { URL.revokeObjectURL(u); }.bind(null, e0.url), 30000);
    }
    return entry.p;
  };
  E.dropCache = function (fid) {
    Array.from(cache.keys()).forEach(function (k) { if (!fid || k.indexOf(fid + ':') === 0) { var e = cache.get(k); cache.delete(k); if (e && e.url) URL.revokeObjectURL(e.url); } });
  };

  /* ------------------------------------------------------------- export */
  function N(k) { return PDFLib.PDFName.of(k); }
  function rgb(hex) { var c = U.hexToRgb(hex); return PDFLib.rgb(c.r, c.g, c.b); }
  async function embedAsset(out, id, cacheMap) {
    if (cacheMap.has(id)) return cacheMap.get(id);
    var as = E.assets.get(id); if (!as) return null;
    var bytes = U.dataURLToBytes(as.url), img;
    img = as.mime === 'image/jpeg' ? await out.embedJpg(bytes) : await out.embedPng(bytes);
    cacheMap.set(id, img);
    return img;
  }
  async function drawAnnot(out, page, a, g, ctx) {
    var L = PDFLib, op = 'opacity' in a ? a.opacity : 1;
    var blend = (a.type === 'hlbox' || a.type === 'marker') ? L.BlendMode.Multiply : undefined;
    if (!E.isBox(a)) {
      if (!a.pts || !a.pts.length) return;
      var d = '';
      if (a.type === 'pen' || a.type === 'marker') {
        a.pts.forEach(function (pt, k) { d += (k ? 'L' : 'M') + U.round(pt[0], 2) + ' ' + U.round(pt[1], 2) + ' '; });
        if (a.pts.length === 1) d += 'L' + (a.pts[0][0] + 0.01) + ' ' + a.pts[0][1];
      } else {
        var p1 = a.pts[0], p2 = a.pts[a.pts.length - 1];
        d = 'M' + p1[0] + ' ' + p1[1] + ' L' + p2[0] + ' ' + p2[1];
      }
      var o = { x: g.x0, y: g.y0 + g.H, borderColor: rgb(a.color || '#000'), borderWidth: a.width || 2, borderLineCap: L.LineCapStyle.Round, borderOpacity: op };
      if (blend) o.blendMode = blend;
      page.drawSvgPath(d, o);
      if (a.type === 'arrow') {
        var head = E.arrowHead(a);
        var o2 = { x: g.x0, y: g.y0 + g.H, color: rgb(a.color || '#000'), opacity: op };
        page.drawSvgPath(head, o2);
      }
      return;
    }
    var phi = -(a.rot || 0) * Math.PI / 180, cs = Math.cos(phi), sn = Math.sin(phi);
    if (Math.abs(cs) < 1e-9) cs = 0; if (Math.abs(sn) < 1e-9) sn = 0;
    var w = a.w, h = a.h;
    var e = g.x0 + a.cx - (w / 2) * cs - (h / 2) * sn;
    var f = g.y0 + g.H - a.cy + (w / 2) * sn - (h / 2) * cs;
    page.pushOperators(L.pushGraphicsState(), L.concatTransformationMatrix(cs, -sn, sn, cs, e, f));
    if (a.type === 'text') {
      var t = E.textLayout(a);
      var font = ctx.fonts[t.font] || (ctx.fonts[t.font] = out.embedStandardFont(t.font));
      t.lines.forEach(function (line, i) {
        if (!line) return;
        page.drawText(line, { x: t.pad, y: h - t.base(i), size: t.size, font: font, color: rgb(a.color || '#000'), opacity: op });
      });
    } else if (a.type === 'image') {
      var img = await embedAsset(out, a.asset, ctx.images);
      if (img) page.drawImage(img, { x: 0, y: 0, width: w, height: h, opacity: op });
    } else {
      var fill = a.fill && a.fill !== 'none' ? rgb(a.fill) : null;
      var sw = a.type === 'whiteout' || a.type === 'hlbox' ? 0 : (a.width == null ? 2 : a.width);
      var stroke = sw > 0 && a.color && a.color !== 'none' ? rgb(a.color) : null;
      var ro = {};
      if (fill) { ro.color = fill; ro.opacity = a.type === 'hlbox' ? (a.opacity == null ? 0.4 : a.opacity) : (a.fillOpacity == null ? op : a.fillOpacity); }
      if (stroke) { ro.borderColor = stroke; ro.borderWidth = sw; ro.borderOpacity = op; }
      if (blend) ro.blendMode = blend;
      if (fill || stroke) {
        if (a.type === 'ellipse') {
          ro.x = w / 2; ro.y = h / 2; ro.xScale = Math.max(0.1, (w - sw) / 2); ro.yScale = Math.max(0.1, (h - sw) / 2);
          page.drawEllipse(ro);
        } else {
          ro.x = sw / 2; ro.y = sw / 2; ro.width = Math.max(0.1, w - sw); ro.height = Math.max(0.1, h - sw);
          page.drawRectangle(ro);
        }
      }
    }
    page.pushOperators(L.popGraphicsState());
  }
  /** Arrow head triangle (page space) as an SVG path string. */
  E.arrowHead = function (a) {
    var p1 = a.pts[0], p2 = a.pts[a.pts.length - 1], w = a.width || 2;
    var dx = p2[0] - p1[0], dy = p2[1] - p1[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    var hl = Math.max(8, w * 4), hw = Math.max(4, w * 2.2);
    var bx = p2[0] - ux * hl, by = p2[1] - uy * hl;
    return 'M' + U.round(p2[0] + ux * w * 0.5, 2) + ' ' + U.round(p2[1] + uy * w * 0.5, 2) + ' L' + U.round(bx - uy * hw, 2) + ' ' + U.round(by + ux * hw, 2) + ' L' + U.round(bx + uy * hw, 2) + ' ' + U.round(by - ux * hw, 2) + ' Z';
  };

  function fillForm(src, vals, flatten) {
    var L = PDFLib, form;
    try { form = src.getForm(); } catch (e) { return; }
    var fields = form.getFields(); if (!fields.length) return;
    Object.keys(vals || {}).forEach(function (name) {
      var v = vals[name];
      try {
        var fld = form.getField(name);
        if (fld instanceof L.PDFTextField) { var s = E.sanitize(String(v == null ? '' : v), 'Helvetica'); if (s) fld.setText(s); else fld.setText(undefined); }
        else if (fld instanceof L.PDFCheckBox) { if (v) fld.check(); else fld.uncheck(); }
        else if (fld instanceof L.PDFRadioGroup) { if (v && v !== 'Off') fld.select(String(v)); else fld.clear(); }
        else if (fld instanceof L.PDFDropdown || fld instanceof L.PDFOptionList) { if (v) fld.select(String(v)); else fld.clear(); }
      } catch (e) { console.warn('Slop PDF: could not set field', name, e); }
    });
    try { form.updateFieldAppearances(); } catch (e) { console.warn('Slop PDF: field appearance update failed', e); }
    if (flatten) { try { form.flatten({ updateFieldAppearances: false }); } catch (e) { console.warn('Slop PDF: flatten failed', e); } }
  }
  /* Strip /P back-pointers and park internal link targets as page numbers, so copyPages
     does not drag the donor's whole page tree along. Fixed up again after copying. */
  function prepareLinks(src) {
    var L = PDFLib, pages = src.getPages(), idx = new Map();
    pages.forEach(function (pg, i) { idx.set(pg.ref.toString(), i); });
    function park(arr) {
      if (!(arr instanceof L.PDFArray) || !arr.size()) return false;
      var first = arr.get(0);
      if (first instanceof L.PDFRef) { var t = idx.get(first.toString()); arr.set(0, t == null ? L.PDFNull : L.PDFNumber.of(t)); return true; }
      return false;
    }
    pages.forEach(function (pg) {
      var annots = pg.node.Annots(); if (!annots) return;
      for (var k = 0; k < annots.size(); k++) {
        var d = src.context.lookup(annots.get(k));
        if (!(d instanceof L.PDFDict)) continue;
        d.delete(N('P'));
        var parked = park(d.lookup(N('Dest')));
        var A = d.lookup(N('A'));
        if (A instanceof L.PDFDict) { var S = A.lookup(N('S')); if (S && S.asString && S.asString() === '/GoTo') parked = park(A.lookup(N('D'))) || parked; }
        if (parked) d.set(N('SlopDest'), L.PDFBool.True);
      }
    });
  }
  function fixLinks(out, page, fid, firstOut) {
    var L = PDFLib, annots = page.node.Annots(); if (!annots) return;
    for (var k = annots.size() - 1; k >= 0; k--) {
      var d = out.context.lookup(annots.get(k));
      if (!(d instanceof L.PDFDict) || !d.get(N('SlopDest'))) continue;
      d.delete(N('SlopDest'));
      var arrs = [d.lookup(N('Dest'))], A = d.lookup(N('A'));
      if (A instanceof L.PDFDict) arrs.push(A.lookup(N('D')));
      var dead = false;
      arrs.forEach(function (arr) {
        if (!(arr instanceof L.PDFArray) || !arr.size()) return;
        var t = arr.get(0);
        if (t instanceof L.PDFNumber) { var ref = firstOut.get(fid + ':' + t.asNumber()); if (ref) arr.set(0, ref); else dead = true; }
        else if (t === L.PDFNull) dead = true;
      });
      if (dead) annots.remove(k);
    }
  }
  function rebuildAcroForm(out, srcDocs) {
    var L = PDFLib, fields = [], seen = new Set();
    out.getPages().forEach(function (pg) {
      var annots = pg.node.Annots(); if (!annots) return;
      for (var k = 0; k < annots.size(); k++) {
        var ref = annots.get(k), d = out.context.lookup(ref);
        if (!(d instanceof L.PDFDict)) continue;
        var st = d.lookup(N('Subtype'));
        if (!st || st.asString() !== '/Widget') continue;
        if (ref instanceof L.PDFRef) d.set(N('P'), pg.ref);
        var curRef = ref, cur = d, guard = 0;
        while (cur.get(N('Parent')) && guard++ < 32) { curRef = cur.get(N('Parent')); cur = out.context.lookup(curRef); if (!(cur instanceof L.PDFDict)) break; }
        if (curRef instanceof L.PDFRef && !seen.has(curRef.toString())) { seen.add(curRef.toString()); fields.push(curRef); }
      }
    });
    if (!fields.length) return;
    var acro = out.context.obj({ Fields: fields });
    for (var entry of srcDocs) {
      var src = entry[1], sa = src.catalog.lookup(N('AcroForm'));
      if (sa instanceof L.PDFDict) {
        var copier = L.PDFObjectCopier.for(src.context, out.context);
        ['DA', 'DR', 'Q', 'NeedAppearances'].forEach(function (k) { var v = sa.get(N(k)); if (v) acro.set(N(k), copier.copy(v)); });
        break;
      }
    }
    out.catalog.set(N('AcroForm'), out.context.register(acro));
  }
  /** Drop objects no longer reachable from the trailer (orphans left by copying/flattening). */
  function gc(doc) {
    var L = PDFLib, ctx = doc.context, keep = new Set(), stack = [];
    function push(o) {
      if (!o) return;
      if (o instanceof L.PDFRef) { var k = o.toString(); if (keep.has(k)) return; keep.add(k); var t = ctx.lookup(o); if (t) stack.push(t); }
      else stack.push(o);
    }
    push(ctx.trailerInfo.Root); push(ctx.trailerInfo.Info);
    while (stack.length) {
      var o = stack.pop();
      if (o instanceof L.PDFDict) o.entries().forEach(function (e) { push(e[1]); });
      else if (o instanceof L.PDFArray) o.asArray().forEach(push);
      else if (o instanceof L.PDFStream) o.dict.entries().forEach(function (e) { push(e[1]); });
    }
    ctx.enumerateIndirectObjects().forEach(function (e) { if (!keep.has(e[0].toString())) ctx.delete(e[0]); });
  }

  /** Builds the output PDF. opts: {pages, stamps (default true), meta (default true), onProgress} → Uint8Array */
  E.build = async function (opts) {
    opts = opts || {};
    var L = PDFLib, st = E.state, pages = opts.pages || st.pages;
    if (!pages.length) throw new Error('There are no pages to export.');
    await E.initFonts();
    var out = await L.PDFDocument.create({ updateMetadata: false });
    var need = new Map();
    pages.forEach(function (p) { if (!p.blank) { if (!need.has(p.f)) need.set(p.f, []); need.get(p.f).push(p.i); } });
    var copied = new Map(), srcDocs = new Map(), step = 0, steps = need.size + pages.length;
    for (var entry of need) {
      var fid = entry[0], f = E.files.get(fid);
      if (!f) throw new Error('A source file is missing.');
      if (f.locked) throw new Error('“' + f.name + '” uses encryption Slop PDF cannot remove (' + f.locked + '), so its pages cannot be exported.');
      var src = await L.PDFDocument.load(f.bytes, { updateMetadata: false, ignoreEncryption: true, throwOnInvalidObject: false });
      var vals = st.forms[fid];
      if ((vals && Object.keys(vals).length) || st.flattenForms) fillForm(src, vals || {}, !!st.flattenForms);
      prepareLinks(src);
      copied.set(fid, await out.copyPages(src, entry[1]));
      srcDocs.set(fid, src);
      if (opts.onProgress) opts.onProgress(++step / steps);
    }
    var counters = new Map(), firstOut = new Map(), ctx = { fonts: {}, images: new Map() }, placed = [];
    var stamps = opts.stamps === false ? null : st.stamps;
    for (var k = 0; k < pages.length; k++) {
      var p = pages[k], page;
      if (p.blank) page = out.addPage([p.blank.w, p.blank.h]);
      else {
        var c = counters.get(p.f) || 0; counters.set(p.f, c + 1);
        page = out.addPage(copied.get(p.f)[c]);
        var key = p.f + ':' + p.i;
        if (!firstOut.has(key)) firstOut.set(key, page.ref);
        placed.push([page, p.f]);
      }
      var g = E.geom(p);
      page.setRotation(L.degrees(E.rotation(p)));
      var list = (p.annots || []).concat(stamps ? E.stampAnnots(p, k, pages.length, stamps) : []);
      for (var j = 0; j < list.length; j++) await drawAnnot(out, page, list[j], g, ctx);
      if (opts.onProgress && k % 8 === 0) { opts.onProgress(++step / steps); await U.sleep(0); }
    }
    placed.forEach(function (x) { fixLinks(out, x[0], x[1], firstOut); });
    if (!st.flattenForms) rebuildAcroForm(out, srcDocs);
    if (opts.meta !== false) E.applyMeta(out);
    gc(out);
    return out.save({ useObjectStreams: true, updateFieldAppearances: false });
  };
  E.applyMeta = function (out) {
    var m = E.state.meta || {};
    if (m.title) out.setTitle(m.title, { showInWindowTitleBar: true });
    if (m.author) out.setAuthor(m.author);
    if (m.subject) out.setSubject(m.subject);
    if (m.keywords) out.setKeywords(String(m.keywords).split(/[,;]+/).map(function (s) { return s.trim(); }).filter(Boolean));
    out.setProducer('Slop PDF · slopographic.com/pdf');
    out.setCreator('Slop PDF');
    var now = new Date();
    out.setCreationDate(now); out.setModificationDate(now);
  };

  /** Re-opens output with pdf.js; resolves the pdf.js doc (caller destroys) after checking the page count. */
  E.openOutput = async function (bytes, expected) {
    var r = await E.openPdfjs(bytes, 'output', null);
    if (expected != null && r.doc.numPages !== expected) { await r.doc.destroy(); throw new Error('Validation failed: expected ' + expected + ' pages, got ' + r.doc.numPages + '.'); }
    return r.doc;
  };
  E.validate = async function (bytes, expected) { var d = await E.openOutput(bytes, expected); var n = d.numPages; await d.destroy(); return n; };

  /* ------------------------------------------------- post-processing tools */
  async function renderOut(doc, i, dpi, maxPx) {
    var pg = await doc.getPage(i + 1), scale = dpi / 72, vp = pg.getViewport({ scale: scale });
    var lim = maxPx || 7000, k = Math.min(1, lim / Math.max(vp.width, vp.height));
    if (k < 1) { scale *= k; vp = pg.getViewport({ scale: scale }); }
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(vp.width)); c.height = Math.max(1, Math.round(vp.height));
    var cx = c.getContext('2d', { alpha: false }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
    var lib = await E.pdfjs();
    await pg.render({ canvasContext: cx, viewport: vp, annotationMode: lib.AnnotationMode.ENABLE }).promise;
    return { canvas: c, wPt: vp.width / scale, hPt: vp.height / scale };
  }
  /** Lossy compression: every page becomes a JPEG. */
  E.rasterize = async function (bytes, o) {
    var doc = await E.openOutput(bytes), out = await PDFLib.PDFDocument.create();
    try {
      for (var i = 0; i < doc.numPages; i++) {
        var r = await renderOut(doc, i, o.dpi || 110);
        var jb = await U.blobToBytes(await U.canvasToBlob(r.canvas, 'image/jpeg', o.quality || 0.7));
        r.canvas.width = r.canvas.height = 0;
        var img = await out.embedJpg(jb), pg = out.addPage([r.wPt, r.hPt]);
        pg.drawImage(img, { x: 0, y: 0, width: r.wPt, height: r.hPt });
        if (o.onProgress) o.onProgress((i + 1) / doc.numPages);
      }
    } finally { await doc.destroy(); }
    E.applyMeta(out);
    return out.save({ useObjectStreams: true });
  };
  /** Lossless re-save: object streams + dropping unreachable objects. */
  E.resave = async function (bytes) {
    var d = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    gc(d);
    return d.save({ useObjectStreams: true, updateFieldAppearances: false });
  };
  E.toImages = async function (bytes, o) {
    var doc = await E.openOutput(bytes), files = [], mime = o.format === 'jpeg' ? 'image/jpeg' : 'image/png', ext = o.format === 'jpeg' ? 'jpg' : 'png';
    var idx = o.indices || Array.from({ length: doc.numPages }, function (_, i) { return i; });
    try {
      for (var k = 0; k < idx.length; k++) {
        var r = await renderOut(doc, idx[k], o.dpi || 150, 12000);
        var b = await U.blobToBytes(await U.canvasToBlob(r.canvas, mime, o.quality || 0.9));
        r.canvas.width = r.canvas.height = 0;
        files.push({ name: (o.base || 'page') + '-' + String(idx[k] + 1).padStart(String(doc.numPages).length, '0') + '.' + ext, data: b, mime: mime });
        if (o.onProgress) o.onProgress((k + 1) / idx.length);
      }
    } finally { await doc.destroy(); }
    return files;
  };
  E.extractText = async function (bytes) {
    var doc = await E.openOutput(bytes), parts = [];
    try {
      for (var i = 0; i < doc.numPages; i++) {
        var pg = await doc.getPage(i + 1), tc = await pg.getTextContent(), s = '';
        tc.items.forEach(function (it) { if (typeof it.str === 'string') { s += it.str; if (it.hasEOL) s += '\n'; } });
        parts.push('— Page ' + (i + 1) + ' —\n' + s.replace(/[ \t]+\n/g, '\n').trim());
      }
    } finally { await doc.destroy(); }
    return parts.join('\n\n') + '\n';
  };

  /* ------------------------------------------------------------- images */
  function jpegOrientation(b) {
    if (b[0] !== 0xff || b[1] !== 0xd8) return 1;
    var o = 2;
    while (o + 4 < b.length) {
      if (b[o] !== 0xff) return 1;
      var marker = b[o + 1], len = (b[o + 2] << 8) | b[o + 3];
      if (marker === 0xe1 && b[o + 4] === 0x45 && b[o + 5] === 0x78 && b[o + 6] === 0x69 && b[o + 7] === 0x66) {
        var t = o + 10, le = b[t] === 0x49;
        var r16 = function (p) { return le ? b[p] | (b[p + 1] << 8) : (b[p] << 8) | b[p + 1]; };
        var r32 = function (p) { return le ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0 : ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0; };
        var ifd = t + r32(t + 4), n = r16(ifd);
        for (var i = 0; i < n; i++) { var e = ifd + 2 + i * 12; if (r16(e) === 0x0112) return r16(e + 8); }
        return 1;
      }
      if (marker === 0xda) return 1;
      o += 2 + len;
    }
    return 1;
  }
  /** Normalises an image file to {mime, bytes, w, h} that pdf-lib can embed (PNG or JPEG). */
  E.prepareImage = async function (bytes, kind) {
    kind = kind || U.sniff(bytes);
    var blob = new Blob([bytes], { type: 'image/' + (kind === 'jpeg' ? 'jpeg' : kind) });
    var bmp = await createImageBitmap(blob);
    var w = bmp.width, h = bmp.height;
    if ((kind === 'jpeg' && jpegOrientation(bytes) === 1) || kind === 'png') { bmp.close(); return { mime: kind === 'jpeg' ? 'image/jpeg' : 'image/png', bytes: bytes, w: w, h: h }; }
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var cx = c.getContext('2d');
    if (kind === 'jpeg') { cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); }
    cx.drawImage(bmp, 0, 0); bmp.close();
    var type = kind === 'jpeg' ? 'image/jpeg' : 'image/png';
    var out = await U.blobToBytes(await U.canvasToBlob(c, type, 0.92));
    c.width = c.height = 0;
    return { mime: type, bytes: out, w: w, h: h };
  };
  /** items: [{bytes, kind}], o: {size:'fit'|'a4'|'letter', margin (pt), orientation:'auto'|'portrait'|'landscape'} */
  E.imagesToPdf = async function (items, o) {
    o = o || {};
    var out = await PDFLib.PDFDocument.create();
    for (var i = 0; i < items.length; i++) {
      var im = await E.prepareImage(items[i].bytes, items[i].kind);
      var img = im.mime === 'image/jpeg' ? await out.embedJpg(im.bytes) : await out.embedPng(im.bytes);
      var pw, ph, m = o.margin || 0;
      if (!o.size || o.size === 'fit') {
        pw = im.w * 0.75; ph = im.h * 0.75;
        var k = Math.min(1, 842 / Math.max(pw, ph)); pw *= k; ph *= k;
        pw += 2 * m; ph += 2 * m;
      } else {
        var sz = E.SIZES[o.size] || E.SIZES.a4; pw = sz[0]; ph = sz[1];
        var land = o.orientation === 'landscape' || (o.orientation !== 'portrait' && im.w > im.h);
        if (land) { var t = pw; pw = ph; ph = t; }
      }
      var page = out.addPage([pw, ph]);
      var aw = pw - 2 * m, ah = ph - 2 * m, s = Math.min(aw / im.w, ah / im.h);
      var dw = im.w * s, dh = im.h * s;
      page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
    }
    out.setProducer('Slop PDF · slopographic.com/pdf');
    return out.save();
  };

  /* --------------------------------------------------------- sample PDF */
  E.makeSample = async function () {
    var L = PDFLib, doc = await L.PDFDocument.create();
    var H = doc.embedStandardFont(L.StandardFonts.HelveticaBold), R = doc.embedStandardFont(L.StandardFonts.Helvetica), T = doc.embedStandardFont(L.StandardFonts.TimesRomanItalic);
    var ink = L.rgb(0.04, 0.04, 0.04), bone = L.rgb(0.945, 0.929, 0.894), lime = L.rgb(0.831, 1, 0.227), pink = L.rgb(1, 0.37, 0.64), cyan = L.rgb(0.22, 0.84, 1), grey = L.rgb(0.35, 0.35, 0.35);
    var blob = 'M100 0C100 0 30 78 30 122a70 70 0 0 0 140 0C170 78 100 0 100 0z';
    function para(pg, text, x, y, w, size, font, color) {
      var words = text.split(' '), line = '', lh = size * 1.45;
      words.forEach(function (wd) {
        var test = line ? line + ' ' + wd : wd;
        if (font.widthOfTextAtSize(test, size) > w && line) { pg.drawText(line, { x: x, y: y, size: size, font: font, color: color }); y -= lh; line = wd; } else line = test;
      });
      if (line) { pg.drawText(line, { x: x, y: y, size: size, font: font, color: color }); y -= lh; }
      return y;
    }
    function footer(pg, n) {
      pg.drawText('SLOPOGRAPHIC · FIELD MANUAL Nº 001', { x: 56, y: 30, size: 7.5, font: H, color: grey });
      pg.drawText(String(n), { x: pg.getWidth() - 64, y: 30, size: 9, font: H, color: grey });
    }
    // 1 — cover
    var p1 = doc.addPage(E.SIZES.a4);
    p1.drawRectangle({ x: 0, y: 0, width: p1.getWidth(), height: p1.getHeight(), color: ink });
    p1.drawSvgPath(blob, { x: 330, y: 760, scale: 1.6, color: lime });
    p1.drawSvgPath('M60 140a40 40 0 0 0 32 39', { x: 330, y: 760, scale: 1.6, borderColor: L.rgb(1, 1, 1), borderWidth: 6, borderLineCap: L.LineCapStyle.Round, borderOpacity: 0.85 });
    p1.drawCircle({ x: 120, y: 420, size: 26, color: pink }); p1.drawCircle({ x: 175, y: 470, size: 12, color: cyan }); p1.drawCircle({ x: 92, y: 488, size: 7, color: lime });
    p1.drawText('FIELD MANUAL Nº 001', { x: 56, y: 330, size: 11, font: H, color: lime });
    p1.drawText("Sloppo's Guide", { x: 56, y: 270, size: 50, font: H, color: bone });
    p1.drawText('to Goo', { x: 56, y: 214, size: 50, font: H, color: bone });
    p1.drawText('Everything a well-adjusted slime needs to know.', { x: 56, y: 172, size: 16, font: T, color: bone });
    p1.drawRectangle({ x: 56, y: 96, width: 140, height: 26, color: lime });
    p1.drawText('SLOPOGRAPHIC', { x: 66, y: 104, size: 11, font: H, color: ink });
    // 2 — what is goo
    var p2 = doc.addPage(E.SIZES.a4);
    p2.drawRectangle({ x: 0, y: 0, width: p2.getWidth(), height: p2.getHeight(), color: bone });
    p2.drawText('01', { x: 56, y: 760, size: 13, font: H, color: pink });
    p2.drawText('What is goo?', { x: 56, y: 722, size: 34, font: H, color: ink });
    var y = para(p2, 'Goo is any substance that is too thick to pour politely and too thin to stack. Scientists call it a non-Newtonian fluid. Sloppo calls it home, lunch and, on Sundays, a bed.', 56, 680, 483, 12.5, R, ink);
    y = para(p2, 'This guide covers the four classical goos, how to store them, and what to do when your goo develops opinions. Use the Slop PDF editor to reorder, rotate, sign or stamp these pages: everything happens in your browser.', 56, y - 10, 483, 12.5, R, ink);
    p2.drawText('Viscosity by goo type', { x: 56, y: y - 34, size: 15, font: H, color: ink });
    var bars = [['Lime slime', 0.92, lime], ['Pink ooze', 0.64, pink], ['Blue gel', 0.41, cyan], ['Grey sludge', 0.78, grey]], by = y - 70;
    bars.forEach(function (b) {
      p2.drawText(b[0], { x: 56, y: by + 5, size: 11, font: R, color: ink });
      p2.drawRectangle({ x: 160, y: by, width: 360, height: 20, color: L.rgb(0.88, 0.86, 0.81) });
      p2.drawRectangle({ x: 160, y: by, width: 360 * b[1], height: 20, color: b[2] });
      p2.drawText(Math.round(b[1] * 100) + '%', { x: 165 + 360 * b[1] - 34, y: by + 6, size: 9, font: H, color: ink });
      by -= 34;
    });
    p2.drawSvgPath(blob, { x: 420, y: by - 10, scale: 0.55, color: lime, borderColor: ink, borderWidth: 3 });
    p2.drawText('Fig. 1 — Sloppo, at rest.', { x: 56, y: by - 60, size: 11, font: T, color: grey });
    footer(p2, 2);
    // 3 — the goo spectrum (landscape)
    var p3 = doc.addPage([841.89, 595.28]);
    p3.drawRectangle({ x: 0, y: 0, width: p3.getWidth(), height: p3.getHeight(), color: L.rgb(1, 1, 1) });
    p3.drawText('02', { x: 56, y: 530, size: 13, font: H, color: cyan });
    p3.drawText('The goo spectrum', { x: 56, y: 494, size: 34, font: H, color: ink });
    para(p3, 'A landscape page, so you can try rotating it in the organizer. Each swatch below is a vector shape: zoom in all you like.', 56, 458, 700, 12.5, R, grey);
    var sw = [[lime, 'LIME', 'Classic. Glows faintly.'], [pink, 'BUBBLEGUM', 'Sticky. Smells of 1997.'], [cyan, 'GLACIER', 'Cold, polite, wobbly.'], [L.rgb(1, 0.62, 0.11), 'MARMALADE', 'Bitter. Rare. Prized.']];
    sw.forEach(function (s, i) {
      var x = 56 + i * 186;
      p3.drawRectangle({ x: x, y: 230, width: 170, height: 170, color: s[0] });
      p3.drawCircle({ x: x + 120, y: 350, size: 22, color: L.rgb(1, 1, 1), opacity: 0.55 });
      p3.drawText(s[1], { x: x, y: 204, size: 13, font: H, color: ink });
      p3.drawText(s[2], { x: x, y: 186, size: 10.5, font: R, color: grey });
    });
    p3.drawLine({ start: { x: 56, y: 140 }, end: { x: 786, y: 140 }, thickness: 2, color: ink, dashArray: [6, 6] });
    p3.drawText('Warmer  >>', { x: 720, y: 120, size: 10, font: H, color: ink });
    footer(p3, 3);
    // 4 — license form
    var p4 = doc.addPage(E.SIZES.a4);
    p4.drawRectangle({ x: 0, y: 0, width: p4.getWidth(), height: p4.getHeight(), color: bone });
    p4.drawText('03', { x: 56, y: 760, size: 13, font: H, color: L.rgb(0.45, 0.6, 0) });
    p4.drawText('Goo licence application', { x: 56, y: 722, size: 30, font: H, color: ink });
    para(p4, 'A real fillable form. Open the Forms tool to fill it in, then sign it with the Sign tool.', 56, 690, 483, 12, R, grey);
    var form = doc.getForm();
    var labels = [['Applicant name', 'applicant', 620], ['Favourite goo', 'favourite', 560]];
    labels.forEach(function (l) {
      p4.drawText(l[0], { x: 56, y: l[2] + 30, size: 10, font: H, color: ink });
      var tf = form.createTextField(l[1]);
      tf.addToPage(p4, { x: 56, y: l[2], width: 483, height: 24, borderColor: ink, borderWidth: 1, backgroundColor: L.rgb(1, 1, 1) });
    });
    p4.drawText('Goo grade', { x: 56, y: 530, size: 10, font: H, color: ink });
    var dd = form.createDropdown('grade');
    dd.addOptions(['Starter slime', 'Advanced ooze', 'Master of muck']);
    dd.addToPage(p4, { x: 56, y: 500, width: 220, height: 24, borderColor: ink, borderWidth: 1, backgroundColor: L.rgb(1, 1, 1) });
    var cb = form.createCheckBox('agree');
    cb.addToPage(p4, { x: 56, y: 450, width: 16, height: 16, borderColor: ink, borderWidth: 1, backgroundColor: L.rgb(1, 1, 1) });
    p4.drawText('I promise to keep my goo hydrated and never feed it after midnight.', { x: 82, y: 454, size: 11, font: R, color: ink });
    p4.drawLine({ start: { x: 56, y: 330 }, end: { x: 300, y: 330 }, thickness: 1, color: ink });
    p4.drawText('Signature', { x: 56, y: 314, size: 9, font: H, color: grey });
    p4.drawLine({ start: { x: 340, y: 330 }, end: { x: 539, y: 330 }, thickness: 1, color: ink });
    p4.drawText('Date', { x: 340, y: 314, size: 9, font: H, color: grey });
    p4.drawSvgPath(blob, { x: 470, y: 250, scale: 0.4, color: pink });
    footer(p4, 4);
    form.updateFieldAppearances(R);
    doc.setTitle("Sloppo's Guide to Goo"); doc.setAuthor('Sloppo'); doc.setSubject('A Slopographic field manual'); doc.setKeywords(['goo', 'slime', 'slopographic']);
    doc.setProducer('Slop PDF · slopographic.com/pdf'); doc.setCreator('Slop PDF');
    return doc.save();
  };

  /* -------------------------------------------------------- persistence */
  E.serialize = function () {
    return {
      v: 1,
      files: Array.from(E.files.values()).filter(function (f) { return !f.locked; }).map(function (f) { return { id: f.id, name: f.name, bytes: f.bytes, color: f.color }; }),
      assets: Array.from(E.assets.values()),
      state: JSON.parse(JSON.stringify(E.state))
    };
  };
  E.restore = async function (data) {
    if (!data || data.v !== 1) return false;
    for (var i = 0; i < data.files.length; i++) {
      var fd = data.files[i];
      try { await E.registerPdf(fd.bytes instanceof Uint8Array ? fd.bytes : new Uint8Array(fd.bytes), fd.name, null, { id: fd.id, color: fd.color, silent: true }); }
      catch (e) { console.warn('Slop PDF: could not restore', fd.name, e); }
    }
    (data.assets || []).forEach(function (a) { E.assets.set(a.id, a); });
    var st = data.state || blank();
    st.pages = (st.pages || []).filter(function (p) { return p.blank || E.files.has(p.f); });
    E.state = Object.assign(blank(), st);
    colorIdx = E.files.size;
    E.resetHistory();
    E.emit('files');
    E.emit('change', { label: 'Restore', history: true });
    return true;
  };
  E.closeAll = function () {
    E.files.forEach(function (f) { try { f.doc.destroy(); } catch (e) { /* ignore */ } });
    E.files.clear(); E.assets.clear(); E.dropCache();
    E.state = blank(); E.resetHistory(); colorIdx = 0;
    E.emit('files'); E.emit('change', { label: 'Close all', history: true });
  };
  E.addAsset = function (a) { a.id = a.id || U.uid('img'); E.assets.set(a.id, a); return a; };
})();
