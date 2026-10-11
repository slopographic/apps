// Record validation and save rules over the definitions in schema-defs.js: prepare() (trim, defaults,
// derived totals, validation) and checkTransition() before store.js saves. Money is integer minor units.
// Tax rates are integer basis points. Dates are YYYY-MM-DD. Exposes window.SlopData.schema.
(function (g) {
  'use strict';
  const ns = (g.SlopData = g.SlopData || {});
  const { ENUM, ACCT, DEFAULT_CHART, DEFAULT_SETTINGS, DEFAULT_SEQUENCES, INVOICE_NEXT, ORDER_NEXT, RX, LINE, JLINE, COUNT, DEFS, COLLECTIONS, movementError, journalErrors, fxErrors } = ns.schemaDefs;
  const MAX = 9e12;
  const META = ['createdAt', 'updatedAt', 'version', 'deletedAt'];
  const ok = (value) => ({ ok: true, value }), clone = (v) => (Array.isArray(v) ? v.slice() : v);
  const fail = (code, message, extra) => Object.assign({ ok: false, code, message: message || code }, extra || {});
  const isResult = (v) => !!v && typeof v === 'object' && typeof v.ok === 'boolean';
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  ns.result = { ok, fail, isResult };

  const lineOk = (l) => isObj(l) && Number.isSafeInteger(l.qty) && Number.isSafeInteger(l.unitPrice) && Number.isSafeInteger(l.taxRate) && Math.abs(l.qty * l.unitPrice) <= MAX;
  /** Recomputes line amounts and document totals from the lines (in place). Skipped when a line is unusable. */
  function derive(rec) {
    if (!Array.isArray(rec.lines) || !rec.lines.every(lineOk)) return;
    const m = ns.money;
    rec.lines = rec.lines.map((l) => { const a = m.lineAmounts(l); return { ...l, net: a.net, tax: a.tax, total: a.total }; });
    const t = m.documentTotals(rec.lines);
    rec.subtotal = t.subtotal;
    rec.tax = t.tax;
    rec.total = t.total;
  }

  const isDate = (v) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(`${v}T00:00:00Z`);
    return !isNaN(d) && d.toISOString().slice(0, 10) === v;
  };

  function checkValue(s, v, field, errors) {
    const bad = (message) => errors.push({ field, message });
    switch (s.t) {
      case 'id': if (typeof v !== 'string' || v.length > 80) bad('must be an id of up to 80 characters'); break;
      case 'string': case 'text': case 'currency': case 'locale': {
        const max = s.max || (s.t === 'text' ? 5000 : 200);
        if (typeof v !== 'string' || v.length > max) bad(`must be text of at most ${max} characters`);
        else if (s.pattern && !s.pattern.test(v)) bad('has an invalid format');
        else if (s.t === 'currency' && !RX.currency.test(v)) bad('must be a 3-letter currency code');
        else if (s.t === 'locale' && !RX.locale.test(v)) bad('must be a language tag such as en-US');
        break;
      }
      case 'bool': if (typeof v !== 'boolean') bad('must be true or false'); break;
      case 'int': if (!Number.isSafeInteger(v) || v < s.min || v > s.max) bad(`must be a whole number from ${s.min} to ${s.max}`); break;
      case 'money': if (!Number.isSafeInteger(v) || v < s.min || v > MAX) bad(`must be a whole amount in minor units, from ${s.min} to ${MAX}`); break;
      case 'rate': if (!Number.isSafeInteger(v) || v < 0 || v > 10000) bad('must be a tax rate in basis points, 0 to 10000'); break;
      case 'date': if (typeof v !== 'string' || !isDate(v)) bad('must be a date as YYYY-MM-DD'); break;
      case 'ts': if (!Number.isSafeInteger(v) || v < 0) bad('must be a timestamp in milliseconds'); break;
      case 'enum': if (!s.values.includes(v)) bad(`must be one of ${s.values.join(', ')}`); break;
      case 'ean': if (!ns.barcode.isValidEan(v)) bad('must be an EAN-8, UPC-A, EAN-13 or GTIN-14 with a valid check digit'); break;
      case 'strings': if (!Array.isArray(v) || v.length > s.max || v.some((x) => typeof x !== 'string' || !x || x.length > s.itemMax)) bad(`must be up to ${s.max} tags of up to ${s.itemMax} characters`); break;
      case 'lines': case 'jlines': case 'countLines': checkList(s, v, field, errors); break;
    }
  }

  function checkList(s, v, field, errors) {
    if (!Array.isArray(v) || v.length < (s.min || 0)) { errors.push({ field, message: `needs at least ${s.min || 0} entr${s.min > 1 ? 'ies' : 'y'}` }); return; }
    const specs = s.t === 'lines' ? LINE : s.t === 'jlines' ? JLINE : COUNT;
    v.forEach((l, i) => {
      const f = `${field}[${i}]`;
      if (!isObj(l)) { errors.push({ field: f, message: 'must be an object' }); return; }
      checkFields(specs, l, errors, `${f}.`, []);
      if (s.t === 'lines' && Math.abs(l.qty * l.unitPrice) > MAX) errors.push({ field: f, message: 'line amount is too large' });
    });
  }

  function checkFields(specs, rec, errors, prefix, skip) {
    for (const [k, s] of Object.entries(specs)) {
      const v = rec[k];
      if (v === undefined || v === null || v === '') {
        if (s.req && !skip.includes(k)) errors.push({ field: prefix + k, message: 'is required' });
        continue;
      }
      checkValue(s, v, prefix + k, errors);
    }
  }

  function checkMeta(rec, errors) {
    for (const k of ['createdAt', 'updatedAt', 'deletedAt']) if (rec[k] !== undefined && !(Number.isSafeInteger(rec[k]) && rec[k] >= 0)) errors.push({ field: k, message: 'must be a timestamp' });
    if (rec.version !== undefined && !(Number.isSafeInteger(rec.version) && rec.version >= 1)) errors.push({ field: 'version', message: 'must be a whole number from 1' });
  }

  /** Totals must match what the lines say (skipped when the lines already have errors). */
  function checkDerived(rec, errors) {
    if (!Array.isArray(rec.lines) || errors.some((e) => e.field.startsWith('lines'))) return;
    const c = { ...rec, lines: rec.lines.map((l) => ({ ...l })) };
    derive(c);
    const bad = ['subtotal', 'tax', 'total'].some((k) => c[k] !== rec[k])
      || c.lines.some((l, i) => ['net', 'tax', 'total'].some((k) => l[k] !== rec.lines[i][k]));
    if (bad) errors.push({ field: 'total', message: 'does not match the lines' });
  }

  /** Checks a record in its stored shape. opts: skipKey (no id yet), deferNumber (number assigned later). */
  function validate(name, rec, opts = {}) {
    const d = DEFS[name];
    if (!d) return [{ field: '', message: `unknown collection ${name}` }];
    if (!isObj(rec)) return [{ field: '', message: 'record must be an object' }];
    const errors = [];
    for (const k of Object.keys(rec)) if (!(k in d.fields) && !META.includes(k)) errors.push({ field: k, message: `is not a field of ${name}` });
    checkFields(d.fields, rec, errors, '', opts.skipKey ? [d.key] : []);
    checkMeta(rec, errors);
    if (d.derive) checkDerived(rec, errors);
    if (d.check) for (const m of d.check(rec, opts)) errors.push({ field: '', message: m });
    return errors;
  }

  /** Normalises input: trims text, drops blanks, applies defaults, derives totals, then validates.
   *  Returns { ok, value, errors }. Unknown fields are errors; meta fields (createdAt...) are ignored. */
  function prepare(name, input, opts = {}) {
    const d = DEFS[name];
    if (!d) return { ok: false, value: null, errors: [{ field: '', message: `unknown collection ${name}` }] };
    if (!isObj(input)) return { ok: false, value: null, errors: [{ field: '', message: 'record must be an object' }] };
    const errors = [], out = {};
    for (const k of Object.keys(input)) if (!(k in d.fields) && !META.includes(k)) errors.push({ field: k, message: `is not a field of ${name}` });
    for (const [k, s] of Object.entries(d.fields)) {
      let v = typeof input[k] === 'string' ? input[k].trim() : input[k];
      if (v === '' || v === null) v = undefined;
      if (v === undefined) { if (s.def === undefined) continue; v = clone(s.def); } else v = normalize(s, v);
      if (v === '' || v === undefined) continue;
      out[k] = v;
    }
    derive(out);
    errors.push(...validate(name, out, { ...opts, skipKey: true }));   // the store assigns the key before saving
    return { ok: errors.length === 0, value: out, errors };
  }

  function normalize(s, v) {
    if (s.t === 'ean') return ns.barcode.normalizeEan(v);
    if (s.t === 'currency') return String(v).toUpperCase();
    if (s.t === 'strings' && Array.isArray(v)) return [...new Set(v.map((x) => (typeof x === 'string' ? x.trim() : x)).filter(Boolean))];
    if (s.t === 'lines' && Array.isArray(v)) return v.map((l) => (isObj(l) ? { ...l } : l));
    if (s.t === 'jlines' && Array.isArray(v)) return v.map((l) => (isObj(l) ? { ...l, debit: l.debit ?? 0, credit: l.credit ?? 0 } : l));
    return v;
  }

  /** Why a store.put may not move a record from prev to next, or null. */
  function checkTransition(name, prev, next) {
    const d = DEFS[name];
    if (!d) return 'unknown collection';
    if (d.immutable) return `${name} records cannot be changed`;
    const same = (keys) => keys.every((k) => JSON.stringify(prev[k]) === JSON.stringify(next[k]));
    if (name === 'invoices') {
      if (prev.status !== next.status && !INVOICE_NEXT[prev.status].includes(next.status)) return `an invoice cannot go from ${prev.status} to ${next.status}`;
      if (prev.status !== 'draft' && !same(['customerId', 'date', 'dueDate', 'number', 'currency', 'lines', 'notes', 'orderId', 'subtotal', 'tax', 'total'])) return 'an issued invoice cannot be changed; void it and issue a new one';
    }
    if (name === 'orders') {
      if (prev.status !== next.status && !ORDER_NEXT[prev.status].includes(next.status)) return `an order cannot go from ${prev.status} to ${next.status}`;
      if (!['draft', 'open'].includes(prev.status) && !same(['customerId', 'date', 'number', 'currency', 'lines', 'notes'])) return 'a closed order cannot be changed';
    }
    if (name === 'numbering' && next.next < prev.next) return 'a numbering sequence can only move forward';
    return null;
  }

  /** Why a record may not be deleted, or null. */
  function removable(name, rec) {
    const d = DEFS[name];
    if (!d) return 'unknown collection';
    if (d.immutable) return `${name} records cannot be deleted`;
    if (d.noRemove) return d.noRemove;
    return d.removeRule ? d.removeRule(rec) : null;
  }

  /** Joins errors into one readable line: "lines[0].qty must be a whole number...". */
  function errorText(errors) {
    const e = (errors || [])[0];
    return !e ? 'invalid record' : e.field ? `${e.field} ${e.message}` : e.message;
  }

  ns.schema = {
    COLLECTIONS, MAX_MINOR: MAX, META, ENUM, ACCT, DEFAULT_CHART, DEFAULT_SETTINGS, DEFAULT_SEQUENCES, INVOICE_NEXT, ORDER_NEXT,
    def: (name) => DEFS[name] || null, prepare, validate, checkTransition, removable, derive, movementError, journalErrors, fxErrors, errorText,
  };
})(typeof window !== 'undefined' ? window : globalThis);
