/* SlopConfig validator: validate(input, opts) → { ok, value, errors[] }. It never throws. input is the text of a file or
 * an object already parsed. It rejects: a wrong format or version, unknown envelope keys, an unknown kind, an app other
 * than the expected one (opts.app), unknown keys in strict kinds, wrong types and values, code or markup in text, and
 * anything over the size limits. Every import and every AI reply goes through here before anything is applied.
 * errors are { path, message }; path is "data.pages[0].name" style ('' for the whole file). Exposes SlopConfig.validate. */
(function (g) {
  'use strict';
  const C = (g.SlopConfig = g.SlopConfig || {});
  const { FORMAT, VERSION, SHARED, SHARED_APP, LIMITS, ENVELOPE_KEYS, KIND_RX, APP_RX } = C.consts;
  const CODE_RX = /<\s*\/?\s*(script|iframe|object|embed|style|link|meta|svg|math)\b|javascript:|vbscript:|data:text\/html|<[^>]*\son[a-z]+\s*=/i;
  const LOCALE_RX = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
  const CURRENCY_RX = /^[A-Z]{3}$/;
  const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const join = (p, k) => (p ? `${p}.${k}` : k);

  /** UTF-8 length of a string in bytes (a loop, so it works in every JS realm). */
  function byteSize(s) {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c < 0xdc00) { n += 4; i++; } // a surrogate pair is one 4-byte character
      else n += 3;
    }
    return n;
  }

  function checkString(spec, v, path, err, cap) {
    if (typeof v !== 'string') return err(path, 'must be text');
    const max = spec.max != null ? spec.max : cap;
    if (v.length > max) return err(path, `must be at most ${max} characters`);
    if (spec.min && v.length < spec.min) return err(path, `must be at least ${spec.min} characters`);
    if (spec.pattern && !spec.pattern.test(v)) return err(path, 'has an invalid format');
    if (CODE_RX.test(v)) err(path, 'contains code or markup, which is not allowed');
  }

  function checkNumber(spec, v, path, err) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return err(path, 'must be a number');
    if (spec.integer && !Number.isInteger(v)) return err(path, 'must be a whole number');
    if (spec.min !== undefined && v < spec.min) return err(path, `must be at least ${spec.min}`);
    if (spec.max !== undefined && v > spec.max) return err(path, `must be at most ${spec.max}`);
  }

  function checkCell(v, path, err) {
    if (v === null || typeof v === 'boolean') return;
    if (typeof v === 'number') return checkNumber({}, v, path, err);
    if (typeof v === 'string') return checkString({ max: LIMITS.text }, v, path, err, LIMITS.text);
    err(path, 'must be text, a number, true, false or null');
  }

  function checkArray(spec, v, path, err, depth) {
    if (!Array.isArray(v)) return err(path, 'must be a list');
    const max = spec.max != null ? spec.max : LIMITS.items;
    if (v.length > max) return err(path, `must have at most ${max} items`);
    if (v.length < (spec.min || 0)) return err(path, `needs at least ${spec.min} item${spec.min > 1 ? 's' : ''}`);
    v.forEach((x, i) => checkSpec(spec.items, x, `${path}[${i}]`, err, depth + 1));
  }

  function checkObject(spec, v, path, err, depth) {
    if (!isObj(v)) return err(path, 'must be an object');
    const fields = spec.fields;
    for (const k of Object.keys(v)) {
      const p = join(path, k);
      if (BAD_KEYS.includes(k)) err(p, 'is not allowed');
      else if (!hasOwn(fields, k) && spec.strict !== false) err(p, 'is not a known key here');
    }
    for (const k of Object.keys(fields)) {
      const s = fields[k], p = join(path, k);
      const val = hasOwn(v, k) ? v[k] : undefined;
      if (val === undefined) { if (s.required) err(p, 'is required'); continue; }
      checkSpec(s, val, p, err, depth + 1);
    }
  }

  function checkSpec(spec, v, path, err, depth) {
    if (depth > 12) return err(path, 'is nested too deeply');
    switch (spec.type) {
      case 'string': return checkString(spec, v, path, err, LIMITS.str);
      case 'text': return checkString(spec, v, path, err, LIMITS.text);
      case 'number': return checkNumber(spec, v, path, err);
      case 'bool': if (typeof v !== 'boolean') err(path, 'must be true or false'); return;
      case 'enum': if (!spec.values.includes(v)) err(path, `must be one of: ${spec.values.join(', ')}`); return;
      case 'currency': if (typeof v !== 'string' || !CURRENCY_RX.test(v)) err(path, 'must be a 3-letter currency code such as USD'); return;
      case 'locale': if (typeof v !== 'string' || !LOCALE_RX.test(v)) err(path, 'must be a language tag such as en-US'); return;
      case 'cell': return checkCell(v, path, err);
      case 'array': return checkArray(spec, v, path, err, depth);
      case 'object': return checkObject(spec, v, path, err, depth);
      default: return err(path, 'has an unknown type in the schema');
    }
  }

  /** The envelope checks. Returns the entry for the kind, or null, after recording what is wrong. */
  function checkEnvelope(obj, opts, err) {
    for (const k of Object.keys(obj)) if (!ENVELOPE_KEYS.includes(k)) err(k, 'is not part of the file format');
    if (obj.format !== FORMAT) err('format', `must be "${FORMAT}"`);
    if (obj.version !== VERSION) {
      err('version', obj.version === undefined ? `is required; this app reads version ${VERSION}`
        : `is version ${JSON.stringify(obj.version)}; this app reads version ${VERSION}`);
    }
    if (typeof obj.name !== 'string' || !obj.name.trim() || obj.name.length > 120) err('name', 'is required: 1 to 120 characters');
    if (obj.description !== undefined) checkString({ max: 1000 }, obj.description, 'description', err, 1000);
    if (typeof obj.created !== 'string' || obj.created.length > 40 || Number.isNaN(Date.parse(obj.created))) {
      err('created', 'must be a date and time such as 2026-10-11T09:00:00Z');
    }
    const kindOk = typeof obj.kind === 'string' && KIND_RX.test(obj.kind);
    const appOk = typeof obj.app === 'string' && APP_RX.test(obj.app);
    if (!kindOk) err('kind', 'must be a short lowercase name such as "template" or "settings"');
    if (!appOk) err('app', 'must be an app id such as "tables", or "slop" for shared kinds');
    if (appOk && Array.isArray(g.SLOP_APPS) && obj.app !== SHARED_APP && !g.SLOP_APPS.some((a) => a && a.id === obj.app)) {
      err('app', `"${obj.app}" is not an app in the registry`);
    }
    if (!kindOk || !appOk) return null;
    const entry = C.getKind(obj.kind, obj.app);
    if (!entry) {
      const owners = C.owners(obj.kind);
      err(owners.length ? 'app' : 'kind', owners.length
        ? `mismatched app: "${obj.kind}" belongs to ${owners.join(', ')}, not to "${obj.app}"`
        : `unknown kind "${obj.kind}" for app "${obj.app}"`);
      return null;
    }
    if (opts.app && obj.app !== opts.app && entry.app !== SHARED) {
      err('app', `mismatched app: this file is for "${obj.app}", and this app is "${opts.app}"`);
    }
    return entry;
  }

  function fail(errors) { return { ok: false, value: null, errors }; }

  function run(input, opts) {
    const errors = [];
    const err = (path, message) => { if (errors.length < LIMITS.errors) errors.push({ path: path || '', message }); };
    let obj = input, json = null;
    if (typeof input === 'string') {
      if (byteSize(input) > LIMITS.bytes) { err('', 'the file is larger than 5 MB'); return fail(errors); }
      try { obj = JSON.parse(input); } catch (e) { err('', `not valid JSON: ${e.message}`); return fail(errors); }
      json = input;
    }
    if (!isObj(obj)) { err('', 'the file must hold one JSON object'); return fail(errors); }
    const entry = checkEnvelope(obj, opts, err);
    if (entry) {
      if (obj.data === undefined) err('data', 'is required');
      else checkSpec(entry.schema, obj.data, 'data', err, 0);
      // kind-specific rules the schema cannot say (for example out > in): run only when the shape is right
      if (!errors.length && entry.check) for (const e of entry.check(obj.data) || []) err(e.path ? `data.${e.path}` : 'data', e.message);
    }
    if (!json) {
      try { json = JSON.stringify(obj); } catch (e) { err('', 'the file cannot be read as JSON'); return fail(errors); }
    }
    if (json && byteSize(json) > LIMITS.bytes) err('', 'the file is larger than 5 MB');
    if (errors.length) return fail(errors);
    return { ok: true, value: JSON.parse(json), errors: [] };
  }

  /** validate(input, { app }) → { ok, value, errors }. app: the app importing (files for another app are refused). */
  function validate(input, opts) {
    try { return run(input, opts || {}); } catch (e) {
      return fail([{ path: '', message: `could not check the file: ${e && e.message ? e.message : e}` }]);
    }
  }

  /** One line per error, for a status bar or a log: "data.pages[0].name: is required". */
  function errorText(errors) {
    return (errors || []).map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).join('; ');
  }

  C.validate = validate;
  C.errorText = errorText;
  C.byteSize = byteSize;
})(typeof window !== 'undefined' ? window : globalThis);
