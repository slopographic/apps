/* Slop PDF macros — the pure model: step types and their fields, normalising and validating steps and macros,
   and the saved list (localStorage 'slop.pdf.macros.v1', envelope {v:1, data}). No DOM beyond localStorage. */
(function () {
  'use strict';
  var M = window.SlopPdfMacro = window.SlopPdfMacro || {};
  var KEY = 'slop.pdf.macros.v1';
  var POSITIONS = [['bottom-center', 'Bottom centre'], ['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right'],
    ['top-center', 'Top centre'], ['top-left', 'Top left'], ['top-right', 'Top right']];
  var ALIGN = [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']];

  function F(k, t, label, o) { var f = { k: k, t: t, label: label }; for (var x in o) f[x] = o[x]; return f; }

  /** Step types, in menu order. Each field: k (key), t (text|bool|num|select|colour|pages|image), label, def. */
  M.STEP_TYPES = {
    replaceText: { label: 'Replace text', fields: [
      F('find', 'text', 'Find', { req: true, max: 500, def: '' }),
      F('replace', 'text', 'Replace with', { max: 500, def: '' }),
      F('regex', 'bool', 'Regular expression', { def: false }),
      F('caseSensitive', 'bool', 'Match case', { def: false }),
      F('cover', 'colour', 'Cover colour', { def: '#ffffff' }),
      F('pages', 'pages', 'Pages', { def: '' })],
      check: function (s) {
        if (!s.regex || !s.find) return null;
        try { new RegExp(s.find); return null; } catch (e) { return 'Find is not a valid regular expression: ' + e.message; }
      } },
    addHeaderFooter: { label: 'Header or footer', fields: [
      F('position', 'select', 'Where', { def: 'footer', opts: [['header', 'Header'], ['footer', 'Footer']] }),
      F('text', 'text', 'Text (tokens: {page} {pages} {date} {filename})', { req: true, max: 300, def: 'Page {page} of {pages}' }),
      F('align', 'select', 'Align', { def: 'center', opts: ALIGN }),
      F('size', 'num', 'Size (pt)', { def: 9, min: 4, max: 72 }),
      F('colour', 'colour', 'Colour', { def: '#555555' }),
      F('pages', 'pages', 'Pages', { def: '' })] },
    addWatermark: { label: 'Watermark', fields: [
      // the flat fields are the layer a step had before layers: still checked, used when there are no layers, not shown
      F('text', 'text', 'Text', { req: true, max: 200, def: 'DRAFT', legacy: true }),
      F('opacity', 'num', 'Opacity (0 to 1)', { def: 0.2, min: 0.02, max: 1, legacy: true }),
      F('angle', 'num', 'Angle (degrees)', { def: 45, min: -360, max: 360, legacy: true }),
      F('size', 'num', 'Size (pt)', { def: 72, min: 8, max: 400, legacy: true }),
      F('colour', 'colour', 'Colour', { def: '#888888', legacy: true }),
      F('pages', 'pages', 'Pages', { def: '', legacy: true }),
      F('layers', 'layers', 'Layers, bottom first', { def: [] })] },
    addPageNumbers: { label: 'Page numbers', fields: [
      F('format', 'select', 'Format', { def: 'n-of', opts: [['n', '1'], ['page', 'Page 1'], ['n-of', '1 / 5'], ['page-of', 'Page 1 of 5'], ['dash', '– 1 –']] }),
      F('position', 'select', 'Position', { def: 'bottom-center', opts: POSITIONS }),
      F('start', 'num', 'First number', { def: 1, min: -9999, max: 9999, int: true }),
      F('size', 'num', 'Size (pt)', { def: 10, min: 4, max: 72 }),
      F('colour', 'colour', 'Colour', { def: '#000000' }),
      F('pages', 'pages', 'Pages', { def: '' })] },
    rotate: { label: 'Rotate', fields: [
      F('angle', 'select', 'Angle', { def: 90, opts: [[90, '90° clockwise'], [180, '180°'], [270, '90° anticlockwise']] }),
      F('pages', 'pages', 'Pages', { def: '' })] },
    deletePages: { label: 'Delete pages', fields: [F('pages', 'pages', 'Pages', { req: true, def: '' })] },
    extractPages: { label: 'Keep only these pages', fields: [F('pages', 'pages', 'Pages', { req: true, def: '' })] },
    stamp: { label: 'Stamp', fields: [
      F('imageDataUrl', 'image', 'Image (PNG or JPEG)', { def: '' }),
      F('text', 'text', 'Text, used when there is no image', { max: 200, def: '' }),
      F('x', 'num', 'Left (% of page width)', { def: 70, min: 0, max: 100 }),
      F('y', 'num', 'Top (% of page height)', { def: 85, min: 0, max: 100 }),
      F('width', 'num', 'Image width (% of page width)', { def: 20, min: 1, max: 100 }),
      F('colour', 'colour', 'Text colour', { def: '#000000' }),
      F('pages', 'pages', 'Pages', { def: '' })],
      check: function (s) { return s.imageDataUrl || s.text ? null : 'A stamp needs an image or some text.'; } }
  };
  M.TYPE_ORDER = ['replaceText', 'addHeaderFooter', 'addWatermark', 'addPageNumbers', 'rotate', 'deletePages', 'extractPages', 'stamp'];
  var IMG = /^data:image\/(png|jpeg);base64,[a-z0-9+/=]+$/i;

  /** One watermark layer (core/watermark.js) checked for the macro: text needs text, a logo needs a PNG or JPEG. */
  function layerOf(raw) {
    var WM = window.SlopPdfWm, L = WM.normalize(raw || {});
    if (L.kind === 'text' && !L.text.trim()) return { err: 'needs text.' };
    if (L.kind === 'image' && !IMG.test(L.asset)) return { err: 'needs a PNG or JPEG logo.' };
    try { WM.parsePages(L.pages, Infinity); } catch (e) { return { err: 'has a page range that cannot be read: ' + e.message }; }
    return { v: L };
  }
  /** The layers a watermark step draws: its layers, or the one layer its flat fields describe. */
  M.layersOf = function (s) {
    var WM = window.SlopPdfWm;
    if (Array.isArray(s.layers) && s.layers.length) return s.layers.map(function (x) { return WM.normalize(x); });
    return [WM.normalize({ kind: 'text', text: s.text, size: s.size, opacity: s.opacity, rot: s.angle, colour: s.colour, pages: s.pages })];
  };

  function coerce(f, v) {
    switch (f.t) {
      case 'text': {
        var s = String(v);
        if (f.req && !s.trim()) return { err: 'is required.' };
        if (f.max && s.length > f.max) return { err: 'is longer than ' + f.max + ' characters.' };
        return { v: s };
      }
      case 'bool': return { v: !!v };
      case 'num': {
        var n = typeof v === 'number' ? v : (String(v).trim() === '' ? NaN : Number(v));
        if (!isFinite(n)) return { err: 'must be a number.' };
        if (f.int) n = Math.round(n);
        if (f.min != null && n < f.min) return { err: 'must be at least ' + f.min + '.' };
        if (f.max != null && n > f.max) return { err: 'must be at most ' + f.max + '.' };
        return { v: n };
      }
      case 'select': {
        var hit = (f.opts || []).find(function (o) { return String(o[0]) === String(v); });
        return hit ? { v: hit[0] } : { err: 'has a choice that is not offered.' };
      }
      case 'colour': {
        var c = String(v).trim().toLowerCase();
        return /^#[0-9a-f]{6}$/.test(c) ? { v: c } : { err: 'must be a colour such as #ff0000.' };
      }
      case 'pages': {
        var p = String(v == null ? '' : v);
        try { M.parsePages(p, Infinity); return { v: p.trim() }; } catch (e) { return { err: e.message }; }
      }
      case 'layers': {
        var arr = Array.isArray(v) ? v : [], outL = [];
        for (var li = 0; li < arr.length; li++) {
          var lr = layerOf(arr[li]);
          if (lr.err) return { err: 'layer ' + (li + 1) + ' ' + lr.err };
          outL.push(lr.v);
        }
        return { v: outL };
      }
      case 'image': {
        var u = String(v || '');
        if (!u) return { v: '' };
        return IMG.test(u) ? { v: u } : { err: 'must be a PNG or JPEG image.' };
      }
    }
    return { v: v };
  }

  /** Canonical step from raw input. Returns { step, errors }. step is null only for an unknown type. */
  M.normalizeStep = function (raw) {
    var def = raw && M.STEP_TYPES[raw.type];
    if (!def) return { step: null, errors: ['This step type is not known.'] };
    var out = { type: raw.type }, errors = [];
    def.fields.forEach(function (f) {
      var v = raw[f.k];
      if (v === undefined || v === null) v = f.def;
      var r = coerce(f, v);
      if (r.err) { errors.push(def.label + ': ' + f.label + ' ' + r.err); out[f.k] = v; }
      else out[f.k] = r.v;
    });
    if (raw.type === 'addWatermark') {
      if (Array.isArray(raw.layers) && !raw.layers.length) errors.push('Watermark: add at least one layer.');
      out.layers = M.layersOf(out); // a step without layers draws the one layer its flat fields describe
    }
    if (def.check && !errors.length) { var ce = def.check(out); if (ce) errors.push(def.label + ': ' + ce); }
    return { step: out, errors: errors };
  };
  M.newStep = function (type) { return M.normalizeStep({ type: type }).step; };
  M.newMacro = function (name) {
    return { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name: name || 'New macro', pattern: '', auto: 'off', steps: [] };
  };
  /** Short description of a step for lists and logs. */
  M.stepLabel = function (s) {
    var q = function (t) { return '“' + String(t || '').slice(0, 30) + '”'; };
    switch (s.type) {
      case 'replaceText': return 'Replace ' + q(s.find) + ' with ' + q(s.replace);
      case 'addHeaderFooter': return (s.position === 'header' ? 'Header' : 'Footer') + ' ' + q(s.text);
      case 'addWatermark': { var L0 = M.layersOf(s)[0]; return 'Watermark ' + (L0.kind === 'image' ? 'logo' : q(L0.text)) + (M.layersOf(s).length > 1 ? ' + ' + (M.layersOf(s).length - 1) + ' more' : ''); }
      case 'addPageNumbers': return 'Page numbers, ' + s.position;
      case 'rotate': return 'Rotate ' + s.angle + '°' + (s.pages ? ' (' + s.pages + ')' : '');
      case 'deletePages': return 'Delete pages ' + (s.pages || 'all');
      case 'extractPages': return 'Keep pages ' + (s.pages || 'all');
      case 'stamp': return 'Stamp ' + (s.imageDataUrl ? 'image' : q(s.text));
    }
    return M.STEP_TYPES[s.type] ? M.STEP_TYPES[s.type].label : 'Unknown step';
  };

  /** Problems that would stop a macro from running. Empty array when it is ready. */
  M.validateMacro = function (m) {
    var errs = [];
    if (!m || typeof m !== 'object') return ['There is no macro to run.'];
    if (!Array.isArray(m.steps) || !m.steps.length) errs.push('The macro has no steps yet. Add a step first.');
    (m.steps || []).forEach(function (s, i) {
      M.normalizeStep(s).errors.forEach(function (e) { errs.push('Step ' + (i + 1) + ', ' + e); });
    });
    if (m.pattern) { try { M.compilePattern(m.pattern); } catch (e) { errs.push('The file name pattern is not a valid regular expression.'); } }
    if ((m.auto === 'ask' || m.auto === 'silent') && !String(m.pattern || '').trim()) errs.push('Set a file name pattern to run this macro on dropped files.');
    return errs;
  };

  /** Canonical macro for storage (steps normalised, unknown fields dropped). Null when the shape is wrong. */
  M.sanitizeMacro = function (m) {
    if (!m || typeof m !== 'object' || typeof m.id !== 'string' || !Array.isArray(m.steps)) return null;
    return {
      id: m.id, name: String(m.name || 'Untitled macro'), pattern: String(m.pattern || ''),
      auto: m.auto === 'ask' || m.auto === 'silent' ? m.auto : 'off',
      steps: m.steps.map(function (s) { return M.normalizeStep(s).step; }).filter(Boolean)
    };
  };

  /* ----------------------------------------------------------- storage */
  var store, mem = [];
  function localStore() {
    if (store === undefined) { try { store = window.localStorage || null; } catch (e) { store = null; } }
    return store;
  }
  /** Replaces the storage used (tests pass a fake, or null for memory only). */
  M.setStorage = function (s) { store = s; mem = []; };
  function fromMemory() { return mem.map(function (m) { return M.sanitizeMacro(m); }).filter(Boolean); }
  /** The saved macros. Storage that is missing, blocked or unreadable gives the memory copy (empty at first). */
  M.load = function () {
    try {
      var s = localStore();
      if (!s) return fromMemory();
      var raw = s.getItem(KEY);
      if (raw == null) return [];
      var env = JSON.parse(raw);
      if (!env || env.v !== 1 || !Array.isArray(env.data)) return [];
      return env.data.map(M.sanitizeMacro).filter(Boolean);
    } catch (e) { return fromMemory(); }
  };
  /** Saves the whole list. Returns false when the browser would not keep it (the memory copy still holds it). */
  M.save = function (list) {
    var clean = (list || []).map(M.sanitizeMacro).filter(Boolean);
    mem = JSON.parse(JSON.stringify(clean));
    try {
      var s = localStore();
      if (!s) return false;
      s.setItem(KEY, JSON.stringify({ v: 1, data: clean }));
      return true;
    } catch (e) { return false; }
  };
})();
